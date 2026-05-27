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
  Camera3D,
  Canvas,
  GPUResource,
  Mesh3D,
  Material3D,
  Transform3D,
} from '../components';
import { Mat4 } from '../components/math/Mat4';
import type { IRenderGraphPass } from '../render-graph/interface';
import { makeAttachmentClearDescriptor } from '../render-graph/utils';
import { vert, frag } from '../shaders/mesh3d';
import { SetupDevice } from './SetupDevice';
import {
  getMeshPipeline3D,
  registerMeshPipeline3D,
  unregisterMeshPipeline3D,
} from './mesh3d-bridge';

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

  private cameras3D = this.query(
    (q) => q.addedOrChanged.and.current.with(Camera3D).trackWrites,
  );

  private meshes3D = this.query(
    (q) =>
      q.added.and.changed.and.removed.and.current
        .with(Mesh3D, Material3D, Transform3D)
        .trackWrites,
  );

  private meshGPUCache: Map<Entity, MeshGPUData> = new Map();

  private sceneUniformBuffer: Buffer | null = null;
  private modelUniformBuffer: Buffer | null = null;

  private pipeline: RenderPipeline | null = null;
  private program: Program | null = null;
  private inputLayout: InputLayout | null = null;

  private initialized = false;

  constructor() {
    super();
    registerMeshPipeline3D(this);
    this.query(
      (q) =>
        q.current
          .with(GPUResource, Canvas, Camera3D, Mesh3D, Material3D, Transform3D)
          .read,
    );
  }

  /** True when 3D should be drawn as the first pass in the 2D render graph. */
  shouldComposite(): boolean {
    return (
      this.initialized &&
      this.cameras3D.current.length > 0 &&
      this.meshes3D.current.length > 0
    );
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
    if (
      !this.shouldComposite() ||
      !this.pipeline ||
      width <= 0 ||
      height <= 0
    ) {
      return;
    }

    const { device } = canvas.read(GPUResource);
    const camera = this.cameras3D.current[0].read(Camera3D);
    const aspect = width / height;
    this.updateSceneUniforms(camera, aspect);

    renderPass.setViewport(0, 0, width, height);
    renderPass.setPipeline(this.pipeline);

    const bindings = device.createBindings({
      pipeline: this.pipeline,
      uniformBufferBindings: [
        { buffer: this.sceneUniformBuffer },
        { buffer: this.modelUniformBuffer },
      ],
    });

    for (const meshEntity of this.meshes3D.current) {
      const forceRebuild =
        this.meshes3D.added.includes(meshEntity) ||
        this.meshes3D.changed.includes(meshEntity);
      const gpuData = this.getOrCreateMeshGPU(meshEntity, forceRebuild);
      if (!gpuData) continue;

      this.updateModelUniforms(meshEntity);

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
  }

  /** @deprecated Use {@link drawMeshes} inside the main render pass instead. */
  appendRenderPass(
    pass: IRenderGraphPass,
    canvas: Entity,
    width: number,
    height: number,
  ): void {
    if (!this.shouldComposite() || !this.pipeline || width <= 0 || height <= 0) {
      return;
    }
    pass.setDebugName('3D Render Pass');
    pass.exec((renderPass) => {
      this.drawMeshes(renderPass, canvas, width, height);
    });
  }

  /** Color clear descriptor for the 3D pass (first pass in the shared graph). */
  getColorClearDescriptor(): ReturnType<typeof makeAttachmentClearDescriptor> | undefined {
    if (!this.shouldComposite()) {
      return undefined;
    }
    const camera = this.cameras3D.current[0]?.read(Camera3D);
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
      viewOrSize: 128,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.modelUniformBuffer = device.createBuffer({
      viewOrSize: 192,
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

  private updateSceneUniforms(camera: Camera3D, aspect: number) {
    if (!this.sceneUniformBuffer) return;

    const projMatrix = Mat4.perspective(
      camera.fovy,
      aspect,
      camera.near,
      camera.far,
    );
    const viewMatrix = Mat4.lookAt(camera.eye, camera.center, camera.up);

    const buffer = new Float32Array(32);
    buffer.set(projMatrix.toFloat32Array(), 0);
    buffer.set(viewMatrix.toFloat32Array(), 16);

    this.sceneUniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));
  }

  private updateModelUniforms(entity: Entity) {
    if (!this.modelUniformBuffer) return;

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

    const buffer = new Float32Array(48);
    buffer.set(Array.from(modelMat as unknown as Float32Array), 0);
    buffer.set(Array.from(normalMat as unknown as Float32Array), 16);
    buffer.set(material.baseColor, 32);
    buffer.set(
      [material.ambient, material.diffuse, material.specular, material.shininess],
      36,
    );
    buffer.set([-0.5, -0.7, -0.5, 0], 40);

    this.modelUniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));
  }

  execute() {
    for (const entity of this.meshes3D.removed) {
      const data = this.meshGPUCache.get(entity);
      if (data) {
        data.vertexBuffer.destroy();
        data.normalBuffer.destroy();
        data.indexBuffer?.destroy();
        this.meshGPUCache.delete(entity);
      }
    }

    const hasChanges =
      this.cameras3D.addedOrChanged.length > 0 ||
      this.meshes3D.added.length > 0 ||
      this.meshes3D.changed.length > 0;

    if (!hasChanges && !this.shouldComposite()) {
      return;
    }

    for (const canvas of this.canvases.current) {
      if (canvas.has(GPUResource)) {
        this.initPipeline(canvas);
      }
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
