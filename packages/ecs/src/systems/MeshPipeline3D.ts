import { mat4 as glMat4 } from 'gl-matrix';
import { Entity, System } from '@lastolivegames/becsy';
import type { Device, RenderPass } from '@infinite-canvas-tutorial/device-api';
import {
  BlendFactor,
  BlendMode,
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  ChannelWriteMask,
  CompareFunction,
  CullMode,
  Format,
  InputLayout,
  PrimitiveTopology,
  Program,
  RenderPipeline,
  Sampler,
  Texture,
  TextureUsage,
  AddressMode,
  FilterMode,
  MipmapFilterMode,
  TransparentBlack,
  VertexStepMode,
  TransparentWhite,
  makeMegaState,
} from '@infinite-canvas-tutorial/device-api';
import {
  Camera,
  Camera3D,
  Canvas,
  Canvas3DScope,
  ComputedCamera,
  Extrude3D,
  GPUResource,
  LIGHT_3D_TYPE,
  Light3D,
  Mesh3D,
  Material3D,
  Transform3D,
  mat3ViewProjectionToMat4,
  mat3ViewToMat4,
  linkedPerspectiveEyeDistance,
} from '../components';
import {
  findCamera2DForCanvas,
  findCamera3DForCanvas,
  filterEntitiesForCanvas,
} from '../utils/canvas3d-scope';
import { isEntityAlive } from './Transform';
import { Mat4 } from '../components/math/Mat4';
import type { RenderCache } from '../utils/render-cache';
import { makeAttachmentClearDescriptor } from '../render-graph/utils';
import { vert, frag } from '../shaders/mesh3d';
import { loadImageBitmapUniversal } from '../utils/load-image-bitmap';
import { SetupDevice } from './SetupDevice';
import {
  getMeshPipeline3D,
  registerMeshPipeline3D,
  unregisterMeshPipeline3D,
} from './mesh3d-bridge';
import { getGizmo3D } from './gizmo3d-bridge';

const MAX_3D_LIGHTS = 8;
const SCENE_UNIFORM_FLOATS = 188;
const MODEL_UNIFORM_FLOATS = 52;

interface MeshGPUData {
  vertexBuffer: Buffer;
  normalBuffer: Buffer;
  uvBuffer: Buffer;
  indexBuffer: Buffer | null;
  indexCount: number;
  vertexCount: number;
  /** Per-mesh model UBO (WebGPU: one shared buffer + multiple writes loses all but the last). */
  modelUniformBuffer: Buffer;
}

/** Async base-color texture state, cached per device + URL. */
interface TextureCacheEntry {
  texture: Texture;
  status: 'loading' | 'ready' | 'error';
}

/** Per-WebGL-context mesh3d pipeline + mesh buffer cache (multi-canvas safe). */
interface MeshPipeline3DDeviceState {
  program: Program;
  pipeline: RenderPipeline;
  inputLayout: InputLayout;
  sceneUniformBuffer: Buffer;
  sceneLegacyUniforms: Record<string, unknown>;
  sceneParams: number[];
  canvasViewProjection: Mat4;
  meshGPUCache: Map<Entity, MeshGPUData>;
  /** 1x1 opaque-white fallback for meshes without a base-color texture. */
  whiteTexture: Texture;
  /** Shared sampler for base-color textures. */
  sampler: Sampler;
  /** Loaded base-color textures keyed by URL. */
  textureCache: Map<string, TextureCacheEntry>;
}

/**
 * 3D mesh rendering. Draw calls are injected into {@link MeshPipeline}'s render
 * graph (3D pass, then 2D/grid on the same color target) so the backbuffer is
 * composited once. GPU buffers are cached per Mesh3D entity and per WebGL device.
 */
export class MeshPipeline3D extends System {
  private setupDevice = this.attach(SetupDevice);

  private canvases = this.query((q) => q.current.with(Canvas).read);

  /** Read-only: camera uniforms are updated in {@link drawMeshes} at render time. */
  private cameras3D = this.query((q) => q.current.with(Camera3D).read);

  private cameras2D = this.query((q) =>
    q.current.with(Camera, ComputedCamera).read,
  );

  private meshes3D = this.query((q) =>
    q.current.with(Mesh3D, Material3D, Transform3D).read,
  );

  private lights3D = this.query((q) => q.current.with(Light3D).read);

  private meshes3DDirty = this.query((q) =>
    q.addedOrChanged.and.removed
      .with(Mesh3D, Material3D, Transform3D)
      .trackWrites,
  );

  private extrudeSources = this.query((q) => q.current.with(Extrude3D).read);

  private deviceStates = new WeakMap<Device, MeshPipeline3DDeviceState>();
  private trackedDevices = new Set<Device>();

  constructor() {
    super();
    registerMeshPipeline3D(this);
    this.query((q) =>
      q
        .using(Canvas3DScope)
        .read.and.current
        .with(
          GPUResource,
          Canvas,
          Camera,
          Camera3D,
          ComputedCamera,
          Extrude3D,
          Light3D,
          Mesh3D,
          Material3D,
          Transform3D,
        )
        .read,
    );
  }

  /** Prefer linked camera for this canvas when extrude meshes exist. */
  private resolveRenderCameraEntity(canvas: Entity): Entity | undefined {
    const canvasCount = this.canvases.current.length || 1;
    const scoped = findCamera3DForCanvas(
      this.cameras3D.current,
      canvas,
      canvasCount,
    );
    if (scoped) {
      return scoped;
    }

    const cameras = this.cameras3D.current;
    if (cameras.length === 0) {
      return undefined;
    }

    const canvasMeshes = this.collectMeshEntities(canvas);
    const hasExtrudeMeshes = this.extrudeSources.current.some((e) => {
      const mesh = e.read(Extrude3D).meshEntity;
      return (
        mesh &&
        isEntityAlive(mesh) &&
        canvasMeshes.includes(mesh)
      );
    });
    if (hasExtrudeMeshes) {
      const linked = cameras.find((c) => c.read(Camera3D).linked);
      if (linked) {
        return linked;
      }
    }
    return cameras[0];
  }

  /** Meshes belonging to {@link canvas}. */
  private collectMeshEntities(canvas: Entity): Entity[] {
    const canvasCount = this.canvases.current.length || 1;
    const out: Entity[] = [];
    const seen = new Set<Entity>();

    const add = (entity: Entity) => {
      if (
        seen.has(entity) ||
        !isEntityAlive(entity) ||
        !entity.has(Mesh3D) ||
        !entity.has(Material3D) ||
        !entity.has(Transform3D) ||
        !filterEntitiesForCanvas([entity], canvas, canvasCount).length
      ) {
        return;
      }
      seen.add(entity);
      out.push(entity);
    };

    for (const entity of this.meshes3D.current) {
      add(entity);
    }

    for (const source of this.extrudeSources.current) {
      const meshEntity = source.read(Extrude3D).meshEntity;
      if (meshEntity) {
        add(meshEntity);
      }
    }

    return out;
  }

  /** True when {@link canvas} has 3D content to draw. */
  has3DContent(canvas?: Entity): boolean {
    if (canvas) {
      return (
        !!findCamera3DForCanvas(
          this.cameras3D.current,
          canvas,
          this.canvases.current.length || 1,
        ) && this.collectMeshEntities(canvas).length > 0
      );
    }
    return this.canvases.current.some((c) => this.has3DContent(c));
  }

  /**
   * Create the mesh3d pipeline when content exists. Call from {@link MeshPipeline}
   * before building the render graph so `shouldComposite()` can be true same frame.
   */
  prepareForComposite(canvas: Entity): void {
    if (!this.has3DContent(canvas) || !canvas.has(GPUResource)) {
      return;
    }
    this.initPipeline(canvas);
  }

  /** True when 3D draw calls should run for {@link canvas}. */
  shouldComposite(canvas: Entity): boolean {
    if (!this.has3DContent(canvas) || !canvas.has(GPUResource)) {
      return false;
    }
    const { device } = canvas.read(GPUResource);
    return this.deviceStates.has(device);
  }

  /**
   * Draws all 3D meshes into an active render pass (same targets as 2D).
   * Called at the start of {@link MeshPipeline}'s main pass so color/depth are
   * cleared once and 2D keeps its GREATER depth convention on a fresh buffer.
   */
  drawMeshes(
    renderPass: RenderPass,
    canvas: Entity,
    width: number,
    height: number,
  ): void {

    if (width <= 0 || height <= 0) {
      return;
    }

    const state = this.initPipeline(canvas);
    if (!state || !this.shouldComposite(canvas)) {
      return;
    }

    const { device } = canvas.read(GPUResource);
    const cameraEntity = this.resolveRenderCameraEntity(canvas);
    if (!cameraEntity) {
      return;
    }
    const camera = cameraEntity.read(Camera3D);
    const canvasCount = this.canvases.current.length || 1;
    const cam2d = camera.linked
      ? findCamera2DForCanvas(this.cameras2D.current, canvas)
      : undefined;
    const { width: logicalW, height: logicalH } = canvas.read(Canvas);
    // Linked mode: ortho extents follow 2D logical canvas size (not DPR pixels).
    const aspect =
      camera.linked && logicalW > 0 && logicalH > 0
        ? logicalW / logicalH
        : width / height;
    this.updateSceneUniforms(
      state,
      camera,
      aspect,
      cam2d,
      canvas,
      canvasCount,
    );

    renderPass.setViewport(0, 0, width, height);
    renderPass.setPipeline(state.pipeline);

    for (const meshEntity of this.collectMeshEntities(canvas)) {
      const forceRebuild =
        this.meshes3DDirty.addedOrChanged.includes(meshEntity);
      const gpuData = this.getOrCreateMeshGPU(
        meshEntity,
        device,
        state,
        forceRebuild,
      );
      if (!gpuData) continue;

      const material = meshEntity.read(Material3D);
      const { texture: baseColorTexture, ready: mapReady } =
        this.resolveMaterialTexture(state, device, material.map);
      const { texture: specularTexture, ready: specularMapReady } =
        this.resolveMaterialTexture(state, device, material.specularMap);
      const { texture: bumpTexture, ready: bumpMapReady } =
        this.resolveMaterialTexture(state, device, material.bumpMap);

      const modelLegacy = this.updateModelUniforms(
        meshEntity,
        gpuData.modelUniformBuffer,
        {
          mapReady,
          specularMapReady,
          bumpMapReady,
        },
      );

      state.program.setUniformsLegacy({
        ...state.sceneLegacyUniforms,
        ...modelLegacy,
      });

      const bindings = device.createBindings({
        pipeline: state.pipeline,
        uniformBufferBindings: [
          { buffer: state.sceneUniformBuffer },
          { buffer: gpuData.modelUniformBuffer },
        ],
        samplerBindings: [
          { texture: baseColorTexture, sampler: state.sampler },
          { texture: specularTexture, sampler: state.sampler },
          { texture: bumpTexture, sampler: state.sampler },
        ],
      });
      renderPass.setBindings(bindings);
      renderPass.setVertexInput(
        state.inputLayout,
        [
          { buffer: gpuData.vertexBuffer },
          { buffer: gpuData.normalBuffer },
          { buffer: gpuData.uvBuffer },
        ],
        gpuData.indexBuffer ? { buffer: gpuData.indexBuffer } : null,
      );

      if (gpuData.indexBuffer) {
        renderPass.drawIndexed(gpuData.indexCount);
      } else {
        renderPass.draw(gpuData.vertexCount);
      }
      bindings.destroy();
    }

    // Draw 3D gizmos on top of meshes (depth disabled, always visible)
    const gizmo = getGizmo3D();
    if (gizmo && gizmo.hasGizmoContent(canvas)) {
      gizmo.drawGizmos(renderPass, canvas, width, height);
    }
  }

  /** Color clear descriptor for the 3D pass (first pass in the shared graph). */
  getColorClearDescriptor(
    canvas: Entity,
  ): ReturnType<typeof makeAttachmentClearDescriptor> | undefined {
    if (!this.shouldComposite(canvas)) {
      return undefined;
    }
    const cameraEntity = this.resolveRenderCameraEntity(canvas);
    const camera = cameraEntity?.read(Camera3D);
    return camera?.clearColor
      ? makeAttachmentClearDescriptor(TransparentWhite)
      : undefined;
  }

  private initPipeline(canvas: Entity): MeshPipeline3DDeviceState | null {
    if (!canvas.has(GPUResource)) {
      return null;
    }
    const { device, renderCache } = canvas.read(GPUResource);
    return this.ensureDeviceState(device, renderCache);
  }

  private ensureDeviceState(
    device: Device,
    renderCache: RenderCache,
  ): MeshPipeline3DDeviceState {
    const existing = this.deviceStates.get(device);
    if (existing) {
      return existing;
    }

    const program = renderCache.createProgram({
      vertex: { glsl: vert, entryPoint: 'main' },
      fragment: { glsl: frag, entryPoint: 'main' },
    });

    const inputLayout = renderCache.createInputLayout({
      vertexBufferDescriptors: [
        {
          arrayStride: 3 * 4,
          stepMode: VertexStepMode.VERTEX,
          attributes: [
            {
              format: Format.F32_RGB,
              offset: 0,
              shaderLocation: 0,
            },
          ],
        },
        {
          arrayStride: 3 * 4,
          stepMode: VertexStepMode.VERTEX,
          attributes: [
            {
              format: Format.F32_RGB,
              offset: 0,
              shaderLocation: 1,
            },
          ],
        },
        {
          arrayStride: 2 * 4,
          stepMode: VertexStepMode.VERTEX,
          attributes: [
            {
              format: Format.F32_RG,
              offset: 0,
              shaderLocation: 2,
            },
          ],
        },
      ],
      indexBufferFormat: Format.U32_R,
      program,
    });

    const pipeline = renderCache.createRenderPipeline({
      inputLayout,
      program,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
      depthStencilAttachmentFormat: Format.D24_S8,
      topology: PrimitiveTopology.TRIANGLES,
      megaStateDescriptor: makeMegaState({
        attachmentsState: [
          {
            channelWriteMask: ChannelWriteMask.ALL,
            rgbBlendState: {
              blendMode: BlendMode.ADD,
              blendSrcFactor: BlendFactor.ONE,
              blendDstFactor: BlendFactor.ZERO,
            },
            alphaBlendState: {
              blendMode: BlendMode.ADD,
              blendSrcFactor: BlendFactor.ONE,
              blendDstFactor: BlendFactor.ZERO,
            },
          },
        ],
        blendConstant: TransparentBlack,
        depthWrite: true,
        depthCompare: CompareFunction.GREATER,
        cullMode: CullMode.BACK,
      }),
    });

    const sceneUniformBuffer = device.createBuffer({
      viewOrSize: SCENE_UNIFORM_FLOATS * 4,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    const whiteTexture = device.createTexture({
      format: Format.U8_RGBA_NORM,
      width: 1,
      height: 1,
      usage: TextureUsage.SAMPLED,
    });
    whiteTexture.setImageData([new Uint8Array([255, 255, 255, 255])]);

    const sampler = renderCache.createSampler({
      addressModeU: AddressMode.REPEAT,
      addressModeV: AddressMode.CLAMP_TO_EDGE,
      minFilter: FilterMode.BILINEAR,
      magFilter: FilterMode.BILINEAR,
      mipmapFilter: MipmapFilterMode.LINEAR,
      lodMinClamp: 0,
      lodMaxClamp: 0,
    });

    const state: MeshPipeline3DDeviceState = {
      program,
      pipeline,
      inputLayout,
      sceneUniformBuffer,
      sceneLegacyUniforms: {},
      sceneParams: [0, 0, 0, 0],
      canvasViewProjection: Mat4.IDENTITY,
      meshGPUCache: new Map(),
      whiteTexture,
      sampler,
      textureCache: new Map(),
    };
    this.deviceStates.set(device, state);
    this.trackedDevices.add(device);
    return state;
  }

  private dropDeviceState(device: Device): void {
    const state = this.deviceStates.get(device);
    if (!state) {
      return;
    }
    for (const data of state.meshGPUCache.values()) {
      try {
        data.vertexBuffer.destroy();
        data.normalBuffer.destroy();
        data.uvBuffer.destroy();
        data.indexBuffer?.destroy();
        data.modelUniformBuffer.destroy();
      } catch {
        /* device already destroyed */
      }
    }
    try {
      state.sceneUniformBuffer.destroy();
      state.whiteTexture.destroy();
      for (const entry of state.textureCache.values()) {
        entry.texture.destroy();
      }
      state.textureCache.clear();
    } catch {
      /* device already destroyed */
    }
    this.deviceStates.delete(device);
    this.trackedDevices.delete(device);
  }

  private resolveDeviceForMesh(entity: Entity): Device | null {
    if (entity.has(Canvas3DScope)) {
      const canvas = entity.read(Canvas3DScope).canvas;
      if (isEntityAlive(canvas) && canvas.has(GPUResource)) {
        return canvas.read(GPUResource).device;
      }
    }
    return null;
  }

  private getActiveDevices(): Set<Device> {
    const devices = new Set<Device>();
    for (const canvas of this.canvases.current) {
      if (canvas.has(GPUResource)) {
        devices.add(canvas.read(GPUResource).device);
      }
    }
    return devices;
  }

  private getOrCreateMeshGPU(
    entity: Entity,
    device: Device,
    state: MeshPipeline3DDeviceState,
    forceRebuild = false,
  ): MeshGPUData | null {
    const mesh = entity.read(Mesh3D);
    if (mesh.positions.length === 0) return null;

    const meshDevice = this.resolveDeviceForMesh(entity) ?? device;
    if (meshDevice !== device) {
      return null;
    }

    let data = state.meshGPUCache.get(entity);
    if (data && !forceRebuild) return data;

    if (data) {
      data.vertexBuffer.destroy();
      data.normalBuffer.destroy();
      data.uvBuffer.destroy();
      data.indexBuffer?.destroy();
      data.modelUniformBuffer.destroy();
    }

    const vertexBuffer = device.createBuffer({
      viewOrSize: mesh.positions,
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });

    const normalBuffer = device.createBuffer({
      viewOrSize: mesh.normals,
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });

    // UVs are optional per geometry; fall back to a zero-filled array matching
    // the vertex count so the shared input layout always has a valid buffer for
    // attribute location 2.
    const uvData =
      mesh.uvs && mesh.uvs.length === mesh.vertexCount * 2
        ? mesh.uvs
        : new Float32Array(mesh.vertexCount * 2);
    const uvBuffer = device.createBuffer({
      viewOrSize: uvData,
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });

    let indexBuffer: Buffer | null = null;
    let indexCount = 0;
    if (mesh.indices && mesh.indices.length > 0) {
      indexBuffer = device.createBuffer({
        viewOrSize: mesh.indices,
        usage: BufferUsage.INDEX,
        hint: BufferFrequencyHint.STATIC,
      });
      indexCount = mesh.indices.length;
    }

    const modelUniformBuffer = device.createBuffer({
      viewOrSize: MODEL_UNIFORM_FLOATS * 4,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    data = {
      vertexBuffer,
      normalBuffer,
      uvBuffer,
      indexBuffer,
      indexCount,
      vertexCount: mesh.vertexCount,
      modelUniformBuffer,
    };
    state.meshGPUCache.set(entity, data);
    return data;
  }

  private updateSceneUniforms(
    state: MeshPipeline3DDeviceState,
    camera: Camera3D,
    aspect: number,
    cam2d: Entity | undefined,
    canvas: Entity,
    canvasCount: number,
  ) {

    let projMatrix: Mat4;
    let viewMatrix: Mat4;

    // linked + orthographic: share 2D view-projection (extrude3d / canvas x,y).
    if (camera.linked && cam2d && camera.projection === 'orthographic') {
      const vp = cam2d.read(ComputedCamera).viewProjectionMatrix;
      const zScale = camera.far > 0 ? -2 / camera.far : 0;
      projMatrix = mat3ViewProjectionToMat4(vp, zScale);
      viewMatrix = Mat4.IDENTITY;
      state.canvasViewProjection = Mat4.IDENTITY;
      state.sceneParams = [0, 0, 0, 0];
    } else if (camera.linked && cam2d && camera.projection === 'perspective') {
      const computed = cam2d.read(ComputedCamera);
      const camera2d = cam2d.read(Camera);
      const canvasHeight = camera2d.canvas
        ? camera2d.canvas.read(Canvas).height
        : 0;
      const eyeZ = linkedPerspectiveEyeDistance(
        canvasHeight,
        computed.zoom,
        camera.fovy,
      );
      const zShift = new Mat4(
        1, 0, 0, 0, //
        0, 1, 0, 0, //
        0, 0, 1, 0, //
        0, 0, -eyeZ, 1, //
      );
      viewMatrix = Mat4.multiply(
        mat3ViewToMat4(computed.viewMatrix),
        zShift,
      );
      projMatrix = Mat4.perspective(
        camera.fovy,
        aspect,
        camera.near,
        camera.far,
      );
      state.canvasViewProjection = mat3ViewProjectionToMat4(
        computed.viewProjectionMatrix,
        0,
      );
      state.sceneParams = [computed.x, computed.y, 1, eyeZ];
    } else {
      state.canvasViewProjection = Mat4.IDENTITY;
      state.sceneParams = [0, 0, 0, 0];
      if (camera.projection === 'orthographic') {
        const distance = Math.abs(camera.eye[2] - camera.center[2]);
        const halfH = distance;
        const halfW = halfH * aspect;
        projMatrix = Mat4.ortho(
          -halfW,
          halfW,
          -halfH,
          halfH,
          camera.near,
          camera.far,
        );
      } else {
        projMatrix = Mat4.perspective(
          camera.fovy,
          aspect,
          camera.near,
          camera.far,
        );
      }
      viewMatrix = Mat4.lookAt(camera.eye, camera.center, camera.up);
    }

    const lighting = this.packLightUniforms(canvas, canvasCount);
    const buffer = new Float32Array(SCENE_UNIFORM_FLOATS);
    buffer.set(projMatrix.toFloat32Array(), 0);
    buffer.set(viewMatrix.toFloat32Array(), 16);
    buffer.set(state.canvasViewProjection.toFloat32Array(), 32);
    buffer.set(state.sceneParams, 48);
    buffer.set(lighting.ambient, 52);
    buffer.set([lighting.count, 0, 0, 0], 56);
    buffer.set(lighting.positions, 60);
    buffer.set(lighting.directions, 92);
    buffer.set(lighting.colors, 124);
    buffer.set(lighting.params, 156);

    state.sceneUniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));
    state.sceneLegacyUniforms = {
      u_ProjectionMatrix3D: Mat4.toGLMat4(projMatrix),
      u_ViewMatrix3D: Mat4.toGLMat4(viewMatrix),
      u_CanvasViewProjection3D: Mat4.toGLMat4(state.canvasViewProjection),
      u_SceneParams: state.sceneParams,
      u_AmbientLight: lighting.ambient,
      u_LightCount: [lighting.count, 0, 0, 0],
      u_LightPositions: lighting.positions,
      u_LightDirections: lighting.directions,
      u_LightColors: lighting.colors,
      u_LightParams3D: lighting.params,
    };
  }

  private packLightUniforms(canvas: Entity, canvasCount: number) {
    const scopedLights = filterEntitiesForCanvas(
      this.lights3D.current,
      canvas,
      canvasCount,
    );
    const ambient: [number, number, number, number] = [0, 0, 0, 1];
    const positions = new Float32Array(MAX_3D_LIGHTS * 4);
    const directions = new Float32Array(MAX_3D_LIGHTS * 4);
    const colors = new Float32Array(MAX_3D_LIGHTS * 4);
    const params = new Float32Array(MAX_3D_LIGHTS * 4);
    let count = 0;

    const addAmbient = (light: Light3D) => {
      ambient[0] += light.color[0] * light.intensity;
      ambient[1] += light.color[1] * light.intensity;
      ambient[2] += light.color[2] * light.intensity;
    };

    const addPunctual = (light: Light3D) => {
      if (count >= MAX_3D_LIGHTS) {
        return;
      }

      const offset = count * 4;
      const type = LIGHT_3D_TYPE[light.type as keyof typeof LIGHT_3D_TYPE];
      const inner = Math.max(0, light.innerConeAngle);
      const outer = Math.max(inner, light.outerConeAngle);

      positions.set([...light.position, 0], offset);
      directions.set(
        [...light.direction, light.type === 'spot' ? Math.cos(outer) : 0],
        offset,
      );
      colors.set([...light.color, 0], offset);
      params.set(
        [
          type,
          light.intensity,
          light.range,
          light.type === 'spot' ? Math.cos(inner) : 0,
        ],
        offset,
      );
      count++;
    };

    if (scopedLights.length === 0) {
      addAmbient(new Light3D({ type: 'ambient' }));
      addPunctual(new Light3D({ type: 'directional' }));
    } else {
      let hasDirectional = false;
      for (const entity of scopedLights) {
        const light = entity.read(Light3D);
        if (light.type === 'ambient') {
          addAmbient(light);
        } else {
          if (light.type === 'directional') {
            hasDirectional = true;
          }
          addPunctual(light);
        }
      }
      // Custom lights replace the default bundle; keep a directional fill unless
      // the scene author already added one (avoids a black mesh when only
      // ambient + mis-scaled point/spot lights are present).
      if (!hasDirectional && count < MAX_3D_LIGHTS) {
        addPunctual(new Light3D({ type: 'directional', intensity: 0.75 }));
      }
    }

    return { ambient, count, positions, directions, colors, params };
  }

  /**
   * Resolve a material texture URL. Returns the device white fallback (and
   * `ready: false`) until the image has loaded.
   */
  private resolveMaterialTexture(
    state: MeshPipeline3DDeviceState,
    device: Device,
    url: string | null,
  ): { texture: Texture; ready: boolean } {
    if (!url) {
      return { texture: state.whiteTexture, ready: false };
    }

    const cached = state.textureCache.get(url);
    if (cached) {
      return {
        texture:
          cached.status === 'ready' ? cached.texture : state.whiteTexture,
        ready: cached.status === 'ready',
      };
    }

    const texture = device.createTexture({
      format: Format.U8_RGBA_NORM,
      width: 1,
      height: 1,
      usage: TextureUsage.SAMPLED,
    });
    texture.setImageData([new Uint8Array([255, 255, 255, 255])]);
    const entry: TextureCacheEntry = { texture, status: 'loading' };
    state.textureCache.set(url, entry);

    void loadImageBitmapUniversal(url)
      .then((bitmap) => {
        if (state.textureCache.get(url) !== entry) {
          return;
        }
        const loaded = device.createTexture({
          format: Format.U8_RGBA_NORM,
          width: bitmap.width,
          height: bitmap.height,
          usage: TextureUsage.SAMPLED,
          // Standard image row-0-at-top → GPU v=1; geometry UV uses 1-v for screen-top.
          pixelStore: { unpackFlipY: true },
        });
        loaded.setImageData([bitmap]);
        entry.texture.destroy();
        entry.texture = loaded;
        entry.status = 'ready';
      })
      .catch((err) => {
        console.warn('[MeshPipeline3D] failed to load material map', url, err);
        entry.status = 'error';
      });

    return { texture: state.whiteTexture, ready: false };
  }

  private updateModelUniforms(
    entity: Entity,
    modelUniformBuffer: Buffer,
    textureReady: {
      mapReady: boolean;
      specularMapReady: boolean;
      bumpMapReady: boolean;
    } = {
      mapReady: false,
      specularMapReady: false,
      bumpMapReady: false,
    },
  ): Record<string, unknown> {
    const transform = entity.read(Transform3D);
    const material = entity.read(Material3D);

    const modelMat = glMat4.create();
    glMat4.translate(modelMat, modelMat, transform.translation);
    glMat4.rotateX(modelMat, modelMat, transform.rotation[0]);
    glMat4.rotateY(modelMat, modelMat, transform.rotation[1]);
    glMat4.rotateZ(modelMat, modelMat, transform.rotation[2]);
    glMat4.scale(modelMat, modelMat, transform.scale);

    const normalMat = glMat4.create();
    glMat4.invert(normalMat, modelMat);
    glMat4.transpose(normalMat, normalMat);

    const legacy = {
      u_ModelMatrix3D: modelMat,
      u_NormalMatrix3D: normalMat,
      u_BaseColor: material.baseColor,
      u_LightParams: [
        material.ambient,
        material.diffuse,
        material.specular,
        material.shininess,
      ],
      u_LightDirection: [-0.5, -0.7, -0.5, 0],
    };

    const mapFlag = textureReady.mapReady ? 1 : 0;
    const specularMapFlag = textureReady.specularMapReady ? 1 : 0;
    const bumpMapFlag = textureReady.bumpMapReady ? 1 : 0;
    const buffer = new Float32Array(MODEL_UNIFORM_FLOATS);
    buffer.set(Array.from(modelMat as unknown as Float32Array), 0);
    buffer.set(Array.from(normalMat as unknown as Float32Array), 16);
    buffer.set(material.baseColor, 32);
    buffer.set(
      [material.ambient, material.diffuse, material.specular, material.shininess],
      36,
    );
    buffer.set([-0.5, -0.7, -0.5, 0], 40);
    buffer.set(
      [
        transform.translation[0],
        transform.translation[1],
        transform.translation[2],
        0,
      ],
      44,
    );
    buffer.set(
      [mapFlag, specularMapFlag, bumpMapFlag, material.bumpScale],
      48,
    );

    modelUniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));
    return {
      ...legacy,
      u_CanvasAnchor: [
        transform.translation[0],
        transform.translation[1],
        transform.translation[2],
        0,
      ],
      u_MaterialFlags: [
        mapFlag,
        specularMapFlag,
        bumpMapFlag,
        material.bumpScale,
      ],
    };
  }

  execute() {
    for (const entity of this.meshes3DDirty.removed) {
      for (const device of this.trackedDevices) {
        const state = this.deviceStates.get(device);
        const data = state?.meshGPUCache.get(entity);
        if (!data) {
          continue;
        }
        data.vertexBuffer.destroy();
        data.normalBuffer.destroy();
        data.uvBuffer.destroy();
        data.indexBuffer?.destroy();
        data.modelUniformBuffer.destroy();
        state!.meshGPUCache.delete(entity);
      }
    }

    const activeDevices = this.getActiveDevices();
    for (const device of [...this.trackedDevices]) {
      if (!activeDevices.has(device)) {
        this.dropDeviceState(device);
      }
    }

    if (!this.has3DContent()) {
      return;
    }

    for (const canvas of this.canvases.current) {
      this.prepareForComposite(canvas);
    }
  }

  finalize() {
    unregisterMeshPipeline3D(this);
    for (const device of [...this.trackedDevices]) {
      this.dropDeviceState(device);
    }
  }
}

export { getMeshPipeline3D };
