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
  Light3D,
  Mesh3D,
  Material3D,
  Transform3D,
  ToBeDeleted,
} from '../components';
import {
  findCamera2DForCanvas,
  findCamera3DForCanvas,
  filterEntitiesForCanvas,
} from '../utils/canvas3d-scope';
import { isEntityAlive } from './Transform';
import type { RenderCache } from '../utils/render-cache';
import { makeAttachmentClearDescriptor } from '../render-graph/utils';
import { vert, frag } from '../shaders/mesh3d';
import { vert as shadowVert, frag as shadowFrag } from '../shaders/shadow3d';
import type { RGGraphBuilder } from '../render-graph/interface';
import { RGAttachmentSlot } from '../render-graph/interface';
import { RGRenderTargetDescription } from '../render-graph/RenderTargetDescription';
import { loadImageBitmapUniversal } from '../utils/load-image-bitmap';
import { irradianceFromBitmap } from '../utils/environment-irradiance';
import {
  getMeshPipeline3D,
  registerMeshPipeline3D,
  syncMeshPipeline3DCanvases,
  unregisterMeshPipeline3D,
} from './mesh3d-bridge';
import { RenderGizmo3D } from './RenderGizmo3D';
import { MeshGPUCache } from './mesh3d/mesh-gpu-cache';
import { fitDirectionalShadow, SHADOW_MAP_SIZE } from './mesh3d/shadow-projection';
import { ResourceScope } from '../resources/ResourceScope';
import type { API } from '../API';

import {
  MeshSceneUniforms,
  MESH_SCENE_UNIFORM_FLOATS,
} from './mesh3d/mesh-scene-uniforms';

/** Async base-color texture state, cached per canvas owner + URL. */
interface TextureCacheEntry {
  texture: Texture;
  status: 'loading' | 'ready' | 'error';
  irradiance: Float32Array | null;
}

/** Each canvas owns its uniforms, geometry cache and loaded textures. */
interface MeshPipeline3DCanvasState {
  device: Device;
  renderCache: RenderCache;
  owner: ResourceScope;
  dispose: () => void;
  program: Program;
  pipeline: RenderPipeline;
  inputLayout: InputLayout;
  sceneUniformBuffer: Buffer;
  sceneUniforms: MeshSceneUniforms;
  meshGPUCache: MeshGPUCache;
  /** 1x1 opaque-white fallback for meshes without a base-color texture. */
  whiteTexture: Texture;
  /** Shared sampler for base-color textures. */
  sampler: Sampler;
  shadowSampler: Sampler;
  shadowProgram: Program;
  shadowPipeline: RenderPipeline;
  shadowInputLayout: InputLayout;
  shadowSceneBuffer?: Buffer;
  shadowResources: ResourceScope;
  /** Loaded base-color textures keyed by URL. */
  textureCache: Map<string, TextureCacheEntry>;
}

export interface ShadowFrame {
  viewProjection: Float32Array;
  lightIndex: number;
  resolveID: number;
}

/**
 * 3D mesh rendering. Draw calls are injected into {@link MeshPipeline}'s render
 * graph (3D pass, then 2D/grid on the same color target) so the backbuffer is
 * composited once. GPU buffers are cached per Mesh3D entity and canvas resource owner.
 */
export class MeshPipeline3D extends System {
  private gizmo = this.attach(RenderGizmo3D);

  private canvases = this.query((q) => q.current.with(Canvas).read);

  /** Read-only: camera uniforms are updated in {@link drawMeshes} at render time. */
  private cameras3D = this.query((q) => q.current.with(Camera3D).read);

  private cameras2D = this.query(
    (q) => q.current.with(Camera, ComputedCamera).read,
  );

  private meshes3D = this.query(
    (q) => q.current.and.removed.with(Mesh3D, Material3D, Transform3D).read,
  );

  private lights3D = this.query((q) => q.current.with(Light3D).read);

  private geometryDirty = this.query(
    (q) => q.addedOrChanged.with(Mesh3D).trackWrites,
  );

  private extrudeSources = this.query((q) => q.current.with(Extrude3D).read);

  private states = new Map<API, MeshPipeline3DCanvasState>();

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(Canvas3DScope, ToBeDeleted)
          .read.and.current.with(
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
          ).read,
    );
  }

  initialize(): void {
    // A rejected World must not replace the renderer of an active canvas.
    registerMeshPipeline3D(this);
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
      return mesh && isEntityAlive(mesh) && canvasMeshes.includes(mesh);
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
    const seen = new Set<number>();

    const add = (entity: Entity) => {
      if (
        seen.has(entity.__id) ||
        !isEntityAlive(entity) ||
        entity.has(ToBeDeleted) ||
        !entity.has(Mesh3D) ||
        !entity.has(Material3D) ||
        !entity.has(Transform3D) ||
        !filterEntitiesForCanvas([entity], canvas, canvasCount).length
      ) {
        return;
      }
      seen.add(entity.__id);
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
    const state = this.states.get(canvas.read(Canvas).api);
    return !!state && this.matches(state, canvas);
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
    shadowTexture?: Texture,
    shadowFrame?: ShadowFrame,
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
    const sceneLegacy = state.sceneUniforms.update(
      camera,
      aspect,
      cam2d,
      filterEntitiesForCanvas(this.lights3D.current, canvas, canvasCount),
      shadowTexture && shadowFrame
        ? {
            viewProjection: shadowFrame.viewProjection,
            lightIndex: shadowFrame.lightIndex,
            texelSize: 1 / SHADOW_MAP_SIZE,
          }
        : undefined,
    );

    renderPass.setViewport(0, 0, width, height);
    renderPass.setPipeline(state.pipeline);

    for (const meshEntity of this.collectMeshEntities(canvas)) {
      const gpuData = state.meshGPUCache.get(
        meshEntity.__id,
        meshEntity.read(Mesh3D),
      );
      if (!gpuData) continue;

      const material = meshEntity.read(Material3D);
      const { texture: baseColorTexture, ready: mapReady } =
        this.resolveMaterialTexture(state, device, material.map);
      const { texture: specularTexture, ready: specularMapReady } =
        this.resolveMaterialTexture(state, device, material.specularMap);
      const { texture: bumpTexture, ready: bumpMapReady } =
        this.resolveMaterialTexture(state, device, material.bumpMap);
      const {
        texture: environmentTexture,
        ready: environmentMapReady,
        irradiance: environmentIrradiance,
      } = this.resolveMaterialTexture(
        state,
        device,
        material.environmentMap,
        true,
      );

      const modelLegacy = gpuData.modelUniforms.update(
        meshEntity.read(Transform3D),
        meshEntity.read(Material3D),
        {
          mapReady,
          specularMapReady,
          bumpMapReady,
          environmentMapReady,
          environmentIrradiance,
        },
      );

      state.program.setUniformsLegacy({
        ...sceneLegacy,
        ...modelLegacy,
      });

      const bindings = gpuData.bindings.get(
        state.pipeline,
        state.sceneUniformBuffer,
        state.sampler,
        baseColorTexture,
        specularTexture,
        bumpTexture,
        environmentTexture,
        shadowTexture ?? state.whiteTexture,
        state.shadowSampler,
      );
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
    }

    // Draw 3D gizmos on top of meshes (depth disabled, always visible)
    const gizmo = this.gizmo;
    if (gizmo && gizmo.hasGizmoContent(canvas)) {
      gizmo.drawGizmos(renderPass, canvas, width, height);
    }
  }

  /** Add a depth-map pass before the shared 3D/2D pass when a directional light requests shadows. */
  scheduleShadowPass(builder: RGGraphBuilder, canvas: Entity): ShadowFrame | undefined {
    const state = this.initPipeline(canvas);
    if (!state || !this.shouldComposite(canvas)) return undefined;
    const lights = filterEntitiesForCanvas(
      this.lights3D.current, canvas, this.canvases.current.length || 1,
    );
    let lightIndex = 0;
    let direction: readonly number[] | undefined;
    for (const entity of lights) {
      const light = entity.read(Light3D);
      if (light.type === 'ambient') continue;
      if (lightIndex >= 8) break;
      if (light.type === 'directional' && light.castShadow && light.intensity > 0) {
        direction = light.direction;
        break;
      }
      lightIndex++;
    }
    if (!direction) return undefined;
    const meshes = this.collectMeshEntities(canvas);
    const bounds = meshes.flatMap((entity) => {
      const gpu = state.meshGPUCache.get(entity.__id, entity.read(Mesh3D));
      if (!gpu) return [];
      gpu.modelUniforms.updatePoseOnly(entity.read(Transform3D));
      return [{ ...gpu.localBounds, model: gpu.modelUniforms.getModelMatrix() }];
    });
    const viewProjection = fitDirectionalShadow(direction, bounds);
    if (!viewProjection) return undefined;
    if (!state.shadowSceneBuffer) {
      const buffer = state.device.createBuffer({
        viewOrSize: 16 * 4,
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
      state.shadowResources.add(() => buffer.destroy());
      state.shadowSceneBuffer = buffer;
    }
    const shadowSceneBuffer = state.shadowSceneBuffer;
    const color = new RGRenderTargetDescription(Format.U8_RGBA_RT);
    color.setDimensions(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE, 1);
    color.colorClearColor = TransparentWhite;
    color.sampledForShaderRead = true;
    const depth = new RGRenderTargetDescription(Format.D24_S8);
    depth.setDimensions(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE, 1);
    depth.depthClearValue = 1;
    depth.stencilClearValue = 0;
    const colorID = builder.createRenderTargetID(color, 'Directional Shadow Color');
    const depthID = builder.createRenderTargetID(depth, 'Directional Shadow Depth');
    builder.pushPass((pass) => {
      pass.setDebugName('Directional Shadow Map');
      pass.attachRenderTargetID(RGAttachmentSlot.Color0, colorID);
      pass.attachRenderTargetID(RGAttachmentSlot.DepthStencil, depthID);
      pass.exec((renderPass) => {
        shadowSceneBuffer.setSubData(0, new Uint8Array(viewProjection.buffer));
        state.shadowProgram.setUniformsLegacy({
          u_ShadowLightViewProjection: viewProjection,
        });
        renderPass.setViewport(0, 0, SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
        renderPass.setPipeline(state.shadowPipeline);
        for (const entity of meshes) {
          const gpu = state.meshGPUCache.get(entity.__id, entity.read(Mesh3D));
          if (!gpu) continue;
          gpu.modelUniforms.updatePoseOnly(entity.read(Transform3D));
          state.shadowProgram.setUniformsLegacy({
            u_ShadowModelMatrix: gpu.modelUniforms.getModelMatrix(),
          });
          renderPass.setBindings(gpu.shadowBindings.get(
            state.shadowPipeline, shadowSceneBuffer,
          ));
          renderPass.setVertexInput(
            state.shadowInputLayout,
            [{ buffer: gpu.vertexBuffer }],
            gpu.indexBuffer ? { buffer: gpu.indexBuffer } : null,
          );
          if (gpu.indexBuffer) renderPass.drawIndexed(gpu.indexCount);
          else renderPass.draw(gpu.vertexCount);
        }
      });
    });
    return { viewProjection, lightIndex, resolveID: builder.resolveRenderTarget(colorID) };
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

  private matches(state: MeshPipeline3DCanvasState, canvas: Entity): boolean {
    if (!canvas.has(GPUResource)) return false;
    const { device, renderCache, scope } = canvas.read(GPUResource);
    return (
      state.device === device &&
      state.renderCache === renderCache &&
      state.owner === scope
    );
  }

  private initPipeline(canvas: Entity): MeshPipeline3DCanvasState | null {
    if (!canvas.has(GPUResource)) return null;
    const { api } = canvas.read(Canvas);
    const previous = this.states.get(api);
    if (previous && this.matches(previous, canvas)) return previous;
    previous?.dispose();
    const { device, renderCache, scope: owner } = canvas.read(GPUResource);
    const resources = new ResourceScope();
    const own = <T extends { destroy(): void }>(resource: T): T => {
      resources.add(() => resource.destroy());
      return resource;
    };
    try {
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

      const shadowProgram = renderCache.createProgram({
        vertex: { glsl: shadowVert, entryPoint: 'main' },
        fragment: { glsl: shadowFrag, entryPoint: 'main' },
      });
      const shadowInputLayout = renderCache.createInputLayout({
        vertexBufferDescriptors: [{
          arrayStride: 3 * 4,
          stepMode: VertexStepMode.VERTEX,
          attributes: [{ format: Format.F32_RGB, offset: 0, shaderLocation: 0 }],
        }],
        indexBufferFormat: Format.U32_R,
        program: shadowProgram,
      });
      const shadowPipeline = renderCache.createRenderPipeline({
        inputLayout: shadowInputLayout,
        program: shadowProgram,
        colorAttachmentFormats: [Format.U8_RGBA_RT],
        depthStencilAttachmentFormat: Format.D24_S8,
        topology: PrimitiveTopology.TRIANGLES,
        megaStateDescriptor: makeMegaState({
          depthWrite: true,
          depthCompare: CompareFunction.LESS,
          cullMode: CullMode.BACK,
        }),
      });
      const shadowResources = new ResourceScope();
      resources.add(() => shadowResources.dispose());

      const sceneUniformBuffer = own(
        device.createBuffer({
          viewOrSize: MESH_SCENE_UNIFORM_FLOATS * 4,
          usage: BufferUsage.UNIFORM,
          hint: BufferFrequencyHint.DYNAMIC,
        }),
      );

      const whiteTexture = own(
        device.createTexture({
          format: Format.U8_RGBA_NORM,
          width: 1,
          height: 1,
          usage: TextureUsage.SAMPLED,
        }),
      );
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
      const shadowSampler = renderCache.createSampler({
        addressModeU: AddressMode.CLAMP_TO_EDGE,
        addressModeV: AddressMode.CLAMP_TO_EDGE,
        minFilter: FilterMode.POINT,
        magFilter: FilterMode.POINT,
        mipmapFilter: MipmapFilterMode.NO_MIP,
        lodMinClamp: 0,
        lodMaxClamp: 0,
      });

      const state: MeshPipeline3DCanvasState = {
        device,
        renderCache,
        owner,
        dispose: () => {},
        program,
        pipeline,
        inputLayout,
        sceneUniformBuffer,
        sceneUniforms: new MeshSceneUniforms(sceneUniformBuffer),
        meshGPUCache: new MeshGPUCache(device),
        whiteTexture,
        sampler,
        shadowSampler,
        shadowProgram,
        shadowPipeline,
        shadowInputLayout,
        shadowResources,
        textureCache: new Map(),
      };
      resources.add(() => {
        const releases = new ResourceScope();
        for (const entry of state.textureCache.values())
          releases.add(() => entry.texture.destroy());
        // Async image completions must not allocate after the owner is gone.
        state.textureCache.clear();
        releases.dispose();
      });
      // Bindings reference textures and UBOs: release meshes before either.
      own(state.meshGPUCache);
      this.states.set(api, state);
      state.dispose = owner.add(() => {
        if (this.states.get(api) === state) this.states.delete(api);
        resources.dispose();
      });
      return this.states.get(api) === state ? state : null;
    } catch (error) {
      try {
        resources.dispose();
      } catch {
        /* Preserve the allocation error. */
      }
      throw error;
    }
  }

  /**
   * Resolve a material texture URL. Returns the device white fallback (and
   * `ready: false`) until the image has loaded.
   */
  private resolveMaterialTexture(
    state: MeshPipeline3DCanvasState,
    device: Device,
    url: string | null,
    environment = false,
  ): { texture: Texture; ready: boolean; irradiance: Float32Array | null } {
    if (!url) {
      return { texture: state.whiteTexture, ready: false, irradiance: null };
    }

    const key = `${environment ? 'environment' : 'material'}:${url}`;
    const cached = state.textureCache.get(key);
    if (cached) {
      return {
        texture:
          cached.status === 'ready' ? cached.texture : state.whiteTexture,
        ready: cached.status === 'ready',
        irradiance: cached.status === 'ready' ? cached.irradiance : null,
      };
    }

    const texture = device.createTexture({
      format: Format.U8_RGBA_NORM,
      width: 1,
      height: 1,
      usage: TextureUsage.SAMPLED,
    });
    texture.setImageData([new Uint8Array([255, 255, 255, 255])]);
    const entry: TextureCacheEntry = {
      texture,
      status: 'loading',
      irradiance: null,
    };
    state.textureCache.set(key, entry);

    void loadImageBitmapUniversal(url)
      .then((bitmap) => {
        if (state.textureCache.get(key) !== entry) {
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
        if (environment) {
          try {
            entry.irradiance = irradianceFromBitmap(bitmap);
          } catch (error) {
            console.warn(
              '[MeshPipeline3D] could not read environment pixels',
              url,
              error,
            );
          }
        }
        entry.texture.destroy();
        entry.texture = loaded;
        entry.status = 'ready';
      })
      .catch((err) => {
        console.warn('[MeshPipeline3D] failed to load material map', url, err);
        entry.status = 'error';
      });

    return { texture: state.whiteTexture, ready: false, irradiance: null };
  }

  execute() {
    syncMeshPipeline3DCanvases(
      this,
      this.canvases.current.map((canvas) => canvas.read(Canvas).api),
    );
    const active = new Map(
      this.canvases.current.map((canvas) => [canvas.read(Canvas).api, canvas]),
    );
    const dirty = this.geometryDirty.addedOrChanged.map(
      (entity) => entity.__id,
    );
    const removed = new Set(this.meshes3D.removed.map((entity) => entity.__id));
    for (const [api, state] of this.states) {
      const canvas = active.get(api);
      if (!canvas || !this.matches(state, canvas)) state.dispose();
      else {
        state.meshGPUCache.retain(
          new Set(
            this.collectMeshEntities(canvas)
              .filter(
                (entity) =>
                  !removed.has(entity.__id) &&
                  entity.read(Mesh3D).positions.length,
              )
              .map((entity) => entity.__id),
          ),
        );
        state.meshGPUCache.invalidate(dirty);
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
    const releases = new ResourceScope();
    for (const state of this.states.values()) releases.add(state.dispose);
    releases.dispose();
  }
}

export { getMeshPipeline3D };
