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
  TransparentBlack,
  VertexStepMode,
  TransparentWhite,
  makeMegaState,
} from '@infinite-canvas-tutorial/device-api';
import {
  Camera,
  Camera3D,
  Canvas,
  ComputedCamera,
  Extrude3D,
  GPUResource,
  Mesh3D,
  Material3D,
  Transform3D,
  mat3ViewProjectionToMat4,
  mat3ViewToMat4,
  linkedPerspectiveEyeDistance,
} from '../components';
import { isEntityAlive } from './Transform';
import { Mat4 } from '../components/math/Mat4';
import { makeAttachmentClearDescriptor } from '../render-graph/utils';
import { vert, frag } from '../shaders/mesh3d';
import { SetupDevice } from './SetupDevice';
import {
  getMeshPipeline3D,
  registerMeshPipeline3D,
  unregisterMeshPipeline3D,
} from './mesh3d-bridge';
import { getGizmo3D } from './gizmo3d-bridge';

/**
 * GPU buffers cached per Mesh3D entity.
 */
interface MeshGPUData {
  vertexBuffer: Buffer;
  normalBuffer: Buffer;
  indexBuffer: Buffer | null;
  indexCount: number;
  vertexCount: number;
}

/**
 * 3D mesh rendering. Draw calls are injected into {@link MeshPipeline}'s render
 * graph (3D pass, then 2D/grid on the same color target) so the backbuffer is
 * composited once.
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

  private meshes3DDirty = this.query((q) =>
    q.addedOrChanged.and.removed
      .with(Mesh3D, Material3D, Transform3D)
      .trackWrites,
  );

  private extrudeSources = this.query((q) => q.current.with(Extrude3D).read);

  private meshGPUCache: Map<Entity, MeshGPUData> = new Map();

  private sceneUniformBuffer: Buffer | null = null;
  private modelUniformBuffer: Buffer | null = null;

  private pipeline: RenderPipeline | null = null;
  private program: Program | null = null;
  private inputLayout: InputLayout | null = null;

  private initialized = false;

  /** WebGL1 (headless-gl / jest) has no UBO binding; use {@link Program.setUniformsLegacy}. */
  private sceneLegacyUniforms: Record<string, unknown> = {};

  /** z: 1 = linked perspective shader path. */
  private sceneParams: number[] = [0, 0, 0, 0];

  private canvasViewProjection = Mat4.IDENTITY;

  constructor() {
    super();
    registerMeshPipeline3D(this);
    this.query(
      (q) =>
        q.current
          .with(
            GPUResource,
            Canvas,
            Camera,
            Camera3D,
            ComputedCamera,
            Extrude3D,
            Mesh3D,
            Material3D,
            Transform3D,
          )
          .read,
    );
  }

  /** Prefer linked camera when extrude meshes exist (canvas-space transforms). */
  private resolveRenderCameraEntity(): Entity | undefined {
    const cameras = this.cameras3D.current;
    if (cameras.length === 0) {
      return undefined;
    }
    const hasExtrudeMeshes = this.extrudeSources.current.some((e) => {
      const mesh = e.read(Extrude3D).meshEntity;
      return mesh && isEntityAlive(mesh);
    });
    if (hasExtrudeMeshes) {
      const linked = cameras.find((c) => c.read(Camera3D).linked);
      if (linked) {
        return linked;
      }
    }
    return cameras[0];
  }

  /** Meshes from the global query plus extrude companions (authoritative for extrude3d). */
  private collectMeshEntities(): Entity[] {
    const out: Entity[] = [];
    const seen = new Set<Entity>();

    const add = (entity: Entity) => {
      if (
        seen.has(entity) ||
        !isEntityAlive(entity) ||
        !entity.has(Mesh3D) ||
        !entity.has(Material3D) ||
        !entity.has(Transform3D)
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

  /** True when 3D entities exist (pipeline may still need {@link prepareForComposite}). */
  has3DContent(): boolean {
    return (
      this.cameras3D.current.length > 0 &&
      this.collectMeshEntities().length > 0
    );
  }

  /**
   * Create the mesh3d pipeline when content exists. Call from {@link MeshPipeline}
   * before building the render graph so `shouldComposite()` can be true same frame.
   */
  prepareForComposite(canvas: Entity): void {
    if (!this.has3DContent() || !canvas.has(GPUResource)) {
      return;
    }
    this.initPipeline(canvas);
  }

  /** True when 3D draw calls should run inside the main render pass. */
  shouldComposite(): boolean {
    return this.initialized && this.has3DContent();
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

    this.prepareForComposite(canvas);
    if (!this.shouldComposite()) {
      return;
    }

    const { device } = canvas.read(GPUResource);
    const cameraEntity = this.resolveRenderCameraEntity();
    if (!cameraEntity) {
      return;
    }
    const camera = cameraEntity.read(Camera3D);
    const cam2d = camera.linked ? this.cameras2D.current[0] : undefined;
    const { width: logicalW, height: logicalH } = canvas.read(Canvas);
    // Linked mode: ortho extents follow 2D logical canvas size (not DPR pixels).
    const aspect =
      camera.linked && logicalW > 0 && logicalH > 0
        ? logicalW / logicalH
        : width / height;
    this.updateSceneUniforms(camera, aspect, cam2d);

    renderPass.setViewport(0, 0, width, height);
    renderPass.setPipeline(this.pipeline);

    const bindings = device.createBindings({
      pipeline: this.pipeline,
      uniformBufferBindings: [
        { buffer: this.sceneUniformBuffer },
        { buffer: this.modelUniformBuffer },
      ],
    });

    for (const meshEntity of this.collectMeshEntities()) {
      const forceRebuild =
        this.meshes3DDirty.addedOrChanged.includes(meshEntity);
      const gpuData = this.getOrCreateMeshGPU(meshEntity, forceRebuild);
      if (!gpuData) continue;

      const modelLegacy = this.updateModelUniforms(meshEntity);
      this.program!.setUniformsLegacy({
        ...this.sceneLegacyUniforms,
        ...modelLegacy,
      });

      renderPass.setBindings(bindings);
      renderPass.setVertexInput(
        this.inputLayout,
        [
          { buffer: gpuData.vertexBuffer },
          { buffer: gpuData.normalBuffer },
        ],
        gpuData.indexBuffer ? { buffer: gpuData.indexBuffer } : null,
      );

      if (gpuData.indexBuffer) {
        renderPass.drawIndexed(gpuData.indexCount);
      } else {
        renderPass.draw(gpuData.vertexCount);
      }
    }

    bindings.destroy();

    // Draw 3D gizmos on top of meshes (depth disabled, always visible)
    const gizmo = getGizmo3D();
    if (gizmo && gizmo.hasGizmoContent()) {
      gizmo.drawGizmos(renderPass, canvas, width, height);
    }
  }

  /** Color clear descriptor for the 3D pass (first pass in the shared graph). */
  getColorClearDescriptor(): ReturnType<typeof makeAttachmentClearDescriptor> | undefined {
    if (!this.shouldComposite()) {
      return undefined;
    }
    const cameraEntity = this.resolveRenderCameraEntity();
    const camera = cameraEntity?.read(Camera3D);
    return camera?.clearColor
      ? makeAttachmentClearDescriptor(TransparentWhite)
      : undefined;
  }

  private initPipeline(canvas: Entity) {
    if (this.initialized) return;
    if (!canvas.has(GPUResource)) return;

    const { device, renderCache } = canvas.read(GPUResource);

    this.program = renderCache.createProgram({
      vertex: { glsl: vert, entryPoint: 'main' },
      fragment: { glsl: frag, entryPoint: 'main' },
    });

    this.inputLayout = renderCache.createInputLayout({
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
      ],
      indexBufferFormat: Format.U32_R,
      program: this.program,
    });

    this.pipeline = renderCache.createRenderPipeline({
      inputLayout: this.inputLayout,
      program: this.program,
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
        // Drawn after the 2D grid plane (depth ~0.5); do not clobber 2D depth.
        depthWrite: false,
        depthCompare: CompareFunction.ALWAYS,
        cullMode: CullMode.BACK,
      }),
    });

    this.sceneUniformBuffer = device.createBuffer({
      viewOrSize: 208,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.modelUniformBuffer = device.createBuffer({
      viewOrSize: 208,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.initialized = true;
  }

  private getOrCreateMeshGPU(
    entity: Entity,
    forceRebuild = false,
  ): MeshGPUData | null {
    const mesh = entity.read(Mesh3D);
    if (mesh.positions.length === 0) return null;

    let data = this.meshGPUCache.get(entity);
    if (data && !forceRebuild) return data;

    let device: Device | null = null;
    for (const canvas of this.canvases.current) {
      if (canvas.has(GPUResource)) {
        device = canvas.read(GPUResource).device;
        break;
      }
    }
    if (!device) return null;

    if (data) {
      data.vertexBuffer.destroy();
      data.normalBuffer.destroy();
      data.indexBuffer?.destroy();
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

    data = {
      vertexBuffer,
      normalBuffer,
      indexBuffer,
      indexCount,
      vertexCount: mesh.vertexCount,
    };
    this.meshGPUCache.set(entity, data);
    return data;
  }

  private updateSceneUniforms(
    camera: Camera3D,
    aspect: number,
    cam2d?: Entity,
  ) {
    if (!this.sceneUniformBuffer) return;

    let projMatrix: Mat4;
    let viewMatrix: Mat4;

    // linked + orthographic: share 2D view-projection (extrude3d / canvas x,y).
    if (camera.linked && cam2d && camera.projection === 'orthographic') {
      const vp = cam2d.read(ComputedCamera).viewProjectionMatrix;
      const zScale = camera.far > 0 ? -2 / camera.far : 0;
      projMatrix = mat3ViewProjectionToMat4(vp, zScale);
      viewMatrix = Mat4.IDENTITY;
      this.canvasViewProjection = Mat4.IDENTITY;
      this.sceneParams = [0, 0, 0, 0];
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
      this.canvasViewProjection = mat3ViewProjectionToMat4(
        computed.viewProjectionMatrix,
        0,
      );
      this.sceneParams = [0, 0, 1, 0];
    } else {
      this.canvasViewProjection = Mat4.IDENTITY;
      this.sceneParams = [0, 0, 0, 0];
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

    const buffer = new Float32Array(52);
    buffer.set(projMatrix.toFloat32Array(), 0);
    buffer.set(viewMatrix.toFloat32Array(), 16);
    buffer.set(this.canvasViewProjection.toFloat32Array(), 32);
    buffer.set(this.sceneParams, 48);

    this.sceneUniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));
    this.sceneLegacyUniforms = {
      u_ProjectionMatrix3D: Mat4.toGLMat4(projMatrix),
      u_ViewMatrix3D: Mat4.toGLMat4(viewMatrix),
      u_CanvasViewProjection3D: Mat4.toGLMat4(this.canvasViewProjection),
      u_SceneParams: this.sceneParams,
    };
  }

  private updateModelUniforms(entity: Entity): Record<string, unknown> {
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

    if (!this.modelUniformBuffer) {
      return legacy;
    }

    const buffer = new Float32Array(52);
    buffer.set(Array.from(modelMat as unknown as Float32Array), 0);
    buffer.set(Array.from(normalMat as unknown as Float32Array), 16);
    buffer.set(material.baseColor, 32);
    buffer.set(
      [material.ambient, material.diffuse, material.specular, material.shininess],
      36,
    );
    buffer.set([-0.5, -0.7, -0.5, 0], 40);
    buffer.set(
      [transform.translation[0], transform.translation[1], 0, 0],
      44,
    );

    this.modelUniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));
    return {
      ...legacy,
      u_CanvasAnchor: [
        transform.translation[0],
        transform.translation[1],
        0,
        0,
      ],
    };
  }

  execute() {
    for (const entity of this.meshes3DDirty.removed) {
      const data = this.meshGPUCache.get(entity);
      if (data) {
        data.vertexBuffer.destroy();
        data.normalBuffer.destroy();
        data.indexBuffer?.destroy();
        this.meshGPUCache.delete(entity);
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
    this.meshGPUCache.forEach((data) => {
      data.vertexBuffer.destroy();
      data.normalBuffer.destroy();
      data.indexBuffer?.destroy();
    });
    this.meshGPUCache.clear();
    this.sceneUniformBuffer?.destroy();
    this.modelUniformBuffer?.destroy();
  }
}

export { getMeshPipeline3D };
