import { mat4 as glMat4 } from 'gl-matrix';
import { Entity, System } from '@lastolivegames/becsy';
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
import { RGAttachmentSlot } from '../render-graph/interface';
import {
  AntialiasingMode,
  makeAttachmentClearDescriptor,
  makeBackbufferDescSimple,
  opaqueWhiteFullClearRenderPassDescriptor,
} from '../render-graph/utils';
import { vert, frag } from '../shaders/mesh3d';
import { SetupDevice } from './SetupDevice';

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
 * 3D Mesh rendering pipeline system.
 * Renders all entities with Mesh3D + Material3D + Transform3D components
 * using a perspective camera (Camera3D).
 *
 * This system renders BEFORE the 2D MeshPipeline (order = -1) so that
 * 2D overlays (UI, HUD) can be drawn on top of the 3D scene.
 *
 * @see https://docs.rs/bevy/latest/bevy/core_pipeline/core_3d/struct.Core3dPlugin.html
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

  /**
   * Cached GPU data per mesh entity.
   */
  private meshGPUCache: Map<Entity, MeshGPUData> = new Map();

  /**
   * Scene uniform buffer (view + projection matrices).
   */
  private sceneUniformBuffer: Buffer | null = null;

  /**
   * Per-object uniform buffer (model, normal matrix, material params).
   */
  private modelUniformBuffer: Buffer | null = null;

  /**
   * Shared render pipeline for 3D meshes.
   */
  private pipeline: RenderPipeline | null = null;
  private program: Program | null = null;
  private inputLayout: InputLayout | null = null;

  private initialized = false;

  constructor() {
    super();
    this.query(
      (q) =>
        q.current
          .with(GPUResource, Canvas, Camera3D, Mesh3D, Material3D, Transform3D)
          .read,
    );
  }

  private initPipeline(canvas: Entity) {
    if (this.initialized) return;
    if (!canvas.has(GPUResource)) return;

    const { device, renderCache } = canvas.read(GPUResource);

    this.program = renderCache.createProgram({
      vertex: {
        glsl: vert,
        entryPoint: 'main',
      },
      fragment: {
        glsl: frag,
        entryPoint: 'main',
      },
    });

    this.inputLayout = renderCache.createInputLayout({
      vertexBufferDescriptors: [
        {
          arrayStride: 3 * 4, // 3 floats * 4 bytes
          stepMode: VertexStepMode.VERTEX,
          attributes: [
            {
              format: Format.F32_RGB,
              offset: 0,
              shaderLocation: 0, // a_Position3D
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
              shaderLocation: 1, // a_Normal3D
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
      megaStateDescriptor: {
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
        depthCompare: CompareFunction.LESS,
        cullMode: CullMode.BACK,
      },
    });

    // Scene uniforms: 2 mat4 = 128 bytes
    this.sceneUniformBuffer = device.createBuffer({
      viewOrSize: 128,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    // Model uniforms: 2 mat4 (128 bytes) + 3 vec4 (48 bytes) = 176 bytes
    // Padded to 192 bytes for GPU alignment
    this.modelUniformBuffer = device.createBuffer({
      viewOrSize: 192,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.initialized = true;
  }

  private getOrCreateMeshGPU(entity: Entity, forceRebuild = false): MeshGPUData | null {
    const mesh = entity.read(Mesh3D);
    if (mesh.positions.length === 0) return null;

    let data = this.meshGPUCache.get(entity);
    if (data && !forceRebuild) return data;

    // Find the canvas to get the device
    let device = null;
    for (const canvas of this.canvases.current) {
      if (canvas.has(GPUResource)) {
        device = canvas.read(GPUResource).device;
        break;
      }
    }
    if (!device) return null;

    // Clean up old buffers
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

    // Mark as clean (entity needs write access for this)
    // Note: dirty tracking is handled by becsy's change detection
    return data;
  }

  private updateSceneUniforms(camera: Camera3D, aspect: number) {
    if (!this.sceneUniformBuffer) return;

    const projMatrix = Mat4.perspective(camera.fovy, aspect, camera.near, camera.far);
    const viewMatrix = Mat4.lookAt(camera.eye, camera.center, camera.up);

    const buffer = new Float32Array(32); // 2 * 16 floats
    buffer.set(projMatrix.toFloat32Array(), 0);
    buffer.set(viewMatrix.toFloat32Array(), 16);

    this.sceneUniformBuffer.setSubData(
      0,
      new Uint8Array(buffer.buffer),
    );
  }

  private updateModelUniforms(entity: Entity) {
    if (!this.modelUniformBuffer) return;

    const transform = entity.read(Transform3D);
    const material = entity.read(Material3D);

    // Build model matrix from transform
    const modelMat = glMat4.create();
    glMat4.translate(modelMat, modelMat, transform.translation);
    glMat4.rotateX(modelMat, modelMat, transform.rotation[0]);
    glMat4.rotateY(modelMat, modelMat, transform.rotation[1]);
    glMat4.rotateZ(modelMat, modelMat, transform.rotation[2]);
    glMat4.scale(modelMat, modelMat, transform.scale);

    // Normal matrix = transpose(inverse(modelMatrix))
    const normalMat = glMat4.create();
    glMat4.invert(normalMat, modelMat);
    glMat4.transpose(normalMat, normalMat);

    // Pack uniforms: 2 mat4 (128 bytes) + 3 vec4 (48 bytes) = 176 bytes = 44 floats
    // Allocate 48 floats (192 bytes) for GPU alignment padding
    const buffer = new Float32Array(48);
    buffer.set(Array.from(modelMat as unknown as Float32Array), 0);
    buffer.set(Array.from(normalMat as unknown as Float32Array), 16);
    buffer.set(material.baseColor, 32);
    buffer.set(
      [material.ambient, material.diffuse, material.specular, material.shininess],
      36,
    );
    // Light direction (default: from top-right-front)
    buffer.set([-0.5, -0.7, -0.5, 0], 40);

    this.modelUniformBuffer.setSubData(
      0,
      new Uint8Array(buffer.buffer),
    );
  }

  execute() {
    // Remove GPU data for removed meshes
    for (const entity of this.meshes3D.removed) {
      const data = this.meshGPUCache.get(entity);
      if (data) {
        data.vertexBuffer.destroy();
        data.normalBuffer.destroy();
        data.indexBuffer?.destroy();
        this.meshGPUCache.delete(entity);
      }
    }

    // Determine if we need to render
    const hasChanges =
      this.cameras3D.addedOrChanged.length > 0 ||
      this.meshes3D.added.length > 0 ||
      this.meshes3D.changed.length > 0;

    if (!hasChanges && this.cameras3D.current.length === 0) return;

    for (const canvas of this.canvases.current) {
      if (!canvas.has(GPUResource)) continue;

      this.initPipeline(canvas);
      if (!this.initialized) continue;

      const { swapChain, renderGraph, device } =
        canvas.read(GPUResource);
      const { width, height } = swapChain.getCanvas();
      const onscreenTexture = swapChain.getOnscreenTexture();

      for (const cameraEntity of this.cameras3D.current) {
        const camera = cameraEntity.read(Camera3D);
        const aspect = width / height;

        this.updateSceneUniforms(camera, aspect);

        const renderInput = {
          backbufferWidth: width,
          backbufferHeight: height,
          antialiasingMode: AntialiasingMode.None,
        };

        const mainColorDesc = makeBackbufferDescSimple(
          RGAttachmentSlot.Color0,
          renderInput,
          camera.clearColor
            ? makeAttachmentClearDescriptor(TransparentWhite)
            : undefined,
        );
        const mainDepthDesc = makeBackbufferDescSimple(
          RGAttachmentSlot.DepthStencil,
          renderInput,
          opaqueWhiteFullClearRenderPassDescriptor,
        );

        const builder = renderGraph.newGraphBuilder();

        const mainColorTargetID = builder.createRenderTargetID(
          mainColorDesc,
          'Main Color 3D',
        );
        const mainDepthTargetID = builder.createRenderTargetID(
          mainDepthDesc,
          'Main Depth 3D',
        );

        builder.pushPass((pass) => {
          pass.setDebugName('3D Render Pass');
          pass.attachRenderTargetID(
            RGAttachmentSlot.Color0,
            mainColorTargetID,
          );
          pass.attachRenderTargetID(
            RGAttachmentSlot.DepthStencil,
            mainDepthTargetID,
          );
          pass.exec((renderPass) => {
            if (!this.pipeline) return;

            renderPass.setViewport(0, 0, width, height);
            renderPass.setPipeline(this.pipeline);

            const sceneBindings = device.createBindings({
              pipeline: this.pipeline,
              uniformBufferBindings: [
                {
                  buffer: this.sceneUniformBuffer,
                  binding: 0,
                },
              ],
            });

            for (const meshEntity of this.meshes3D.current) {
              const forceRebuild = this.meshes3D.added.includes(meshEntity) ||
                this.meshes3D.changed.includes(meshEntity);
              const gpuData = this.getOrCreateMeshGPU(meshEntity, forceRebuild);
              if (!gpuData) continue;

              this.updateModelUniforms(meshEntity);

              const modelBindings = device.createBindings({
                pipeline: this.pipeline,
                uniformBufferBindings: [
                  {
                    buffer: this.modelUniformBuffer,
                    binding: 1,
                  },
                ],
              });

              renderPass.setBindings(sceneBindings);
              renderPass.setBindings(modelBindings);
              renderPass.setVertexInput(
                this.inputLayout,
                [
                  { buffer: gpuData.vertexBuffer },
                  { buffer: gpuData.normalBuffer },
                ],
                gpuData.indexBuffer
                  ? { buffer: gpuData.indexBuffer }
                  : null,
              );

              if (gpuData.indexBuffer) {
                renderPass.drawIndexed(gpuData.indexCount);
              } else {
                renderPass.draw(gpuData.vertexCount);
              }

              modelBindings.destroy();
            }

            sceneBindings.destroy();
          });
        });

        builder.resolveRenderTargetToExternalTexture(
          mainColorTargetID,
          onscreenTexture,
        );
        renderGraph.execute();
      }
    }
  }

  finalize() {
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
