import { Entity, System } from '@lastolivegames/becsy';
import { mat4 as glMat4 } from 'gl-matrix';
import type { RenderPass } from '@infinite-canvas-tutorial/device-api';
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
  makeMegaState,
} from '@infinite-canvas-tutorial/device-api';
import {
  Camera,
  Camera3D,
  Canvas,
  ComputedCamera,
  GPUResource,
  Transform3D,
  linkedPerspectiveEyeDistance,
  mat3ViewProjectionToMat4,
  mat3ViewToMat4,
} from '../components';
import { Selected3D } from '../components/geometry3d/Selected3D';
import { Mat4 } from '../components/math/Mat4';
import { gizmoVert, gizmoFrag } from '../shaders/gizmo3d';
import {
  createTranslateGizmo,
  computeGizmoScale,
  GizmoMeshData,
} from '../utils/gizmo-geometry';
import { SetupDevice } from './SetupDevice';
import {
  registerGizmo3D,
  unregisterGizmo3D,
} from './gizmo3d-bridge';

interface GizmoPartGPU {
  vertexBuffer: Buffer;
  normalBuffer: Buffer;
  indexBuffer: Buffer;
  indexCount: number;
  color: [number, number, number, number];
  axis: string;
}

/**
 * Renders 3D transform gizmos for selected 3D entities.
 * Draws after the main 3D pass with depth test disabled so gizmo is always visible.
 */
export class RenderGizmo3D extends System {
  private setupDevice = this.attach(SetupDevice);

  private canvases = this.query((q) => q.current.with(Canvas).read);
  private cameras3D = this.query((q) => q.current.with(Camera3D).read);
  private cameras2D = this.query((q) =>
    q.current.with(Camera, ComputedCamera).read,
  );

  private selected3D = this.query((q) =>
    q.current.with(Selected3D, Transform3D).read,
  );

  private pipeline: RenderPipeline | null = null;
  private program: Program | null = null;
  private inputLayout: InputLayout | null = null;

  private sceneUniformBuffer: Buffer | null = null;
  private modelUniformBuffer: Buffer | null = null;

  private gizmoParts: GizmoPartGPU[] = [];
  private initialized = false;

  private sceneLegacyUniforms: Record<string, unknown> = {};

  constructor() {
    super();
    registerGizmo3D(this);
    this.query((q) =>
      q.current
        .with(
          GPUResource,
          Canvas,
          Camera,
          Camera3D,
          ComputedCamera,
          Selected3D,
          Transform3D,
        )
        .read,
    );
  }

  /** True when there are selected 3D entities to show gizmos for. */
  hasGizmoContent(): boolean {
    return this.selected3D.current.length > 0;
  }

  /**
   * Draw gizmos into the active render pass.
   * Should be called after drawMeshes in MeshPipeline3D.
   */
  drawGizmos(
    renderPass: RenderPass,
    canvas: Entity,
    width: number,
    height: number,
  ): void {
    if (!this.hasGizmoContent()) return;
    if (width <= 0 || height <= 0) return;

    this.initPipeline(canvas);
    if (!this.initialized) return;

    const { device } = canvas.read(GPUResource);
    const cameraEntity = this.cameras3D.current[0];
    if (!cameraEntity) return;

    const camera = cameraEntity.read(Camera3D);
    const cam2d = camera.linked ? this.cameras2D.current[0] : undefined;
    const canvasEntity = this.canvases.current[0];
    const logicalW = canvasEntity ? canvasEntity.read(Canvas).width : width;
    const logicalH = canvasEntity ? canvasEntity.read(Canvas).height : height;
    const aspect =
      camera.linked && logicalW > 0 && logicalH > 0
        ? logicalW / logicalH
        : width / height;

    // Compute view-projection for gizmo rendering
    const vpMatrix = this.computeViewProjection(camera, aspect, cam2d);
    this.updateSceneUniforms(vpMatrix);

    renderPass.setViewport(0, 0, width, height);
    renderPass.setPipeline(this.pipeline);

    const bindings = device.createBindings({
      pipeline: this.pipeline,
      uniformBufferBindings: [
        { buffer: this.sceneUniformBuffer },
        { buffer: this.modelUniformBuffer },
      ],
    });

    // Draw gizmo for each selected entity
    for (const entity of this.selected3D.current) {
      const transform = entity.read(Transform3D);
      const sel = entity.read(Selected3D);
      const translation = transform.translation;

      // Gizmo scale for constant screen size
      const gizmoScale = computeGizmoScale(
        camera.eye,
        translation,
        camera.fovy,
        height,
      );

      for (const part of this.gizmoParts) {
        // Highlight active axis
        let color = part.color;
        if (sel.activeAxis === part.axis) {
          color = [1, 1, 0, 1]; // Yellow highlight
        }

        this.updateModelUniforms(translation, gizmoScale, color);

        this.program!.setUniformsLegacy({
          ...this.sceneLegacyUniforms,
          u_GizmoModel: this.buildGizmoModelMat4(translation, gizmoScale),
          u_GizmoColor: color,
        });

        renderPass.setBindings(bindings);
        renderPass.setVertexInput(
          this.inputLayout,
          [
            { buffer: part.vertexBuffer },
            { buffer: part.normalBuffer },
          ],
          { buffer: part.indexBuffer },
        );
        renderPass.drawIndexed(part.indexCount);
      }
    }

    bindings.destroy();
  }

  private computeViewProjection(
    camera: Camera3D,
    aspect: number,
    cam2d?: Entity,
  ): Float32Array {
    let projMatrix: Mat4;
    let viewMatrix: Mat4;

    if (camera.linked && cam2d && camera.projection === 'orthographic') {
      const vp = cam2d.read(ComputedCamera).viewProjectionMatrix;
      const zScale = camera.far > 0 ? -2 / camera.far : 0;
      projMatrix = mat3ViewProjectionToMat4(vp, zScale);
      viewMatrix = Mat4.IDENTITY;
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
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, -eyeZ, 1,
      );
      viewMatrix = Mat4.multiply(mat3ViewToMat4(computed.viewMatrix), zShift);
      projMatrix = Mat4.perspective(camera.fovy, aspect, camera.near, camera.far);
    } else {
      if (camera.projection === 'orthographic') {
        const distance = Math.abs(camera.eye[2] - camera.center[2]);
        const halfH = distance;
        const halfW = halfH * aspect;
        projMatrix = Mat4.ortho(-halfW, halfW, -halfH, halfH, camera.near, camera.far);
      } else {
        projMatrix = Mat4.perspective(camera.fovy, aspect, camera.near, camera.far);
      }
      viewMatrix = Mat4.lookAt(camera.eye, camera.center, camera.up);
    }

    const vp = glMat4.create();
    glMat4.multiply(
      vp,
      Mat4.toGLMat4(projMatrix),
      Mat4.toGLMat4(viewMatrix),
    );
    return vp as unknown as Float32Array;
  }

  private updateSceneUniforms(vpMatrix: Float32Array): void {
    if (!this.sceneUniformBuffer) return;

    const buffer = new Float32Array(16);
    buffer.set(vpMatrix, 0);
    this.sceneUniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));

    this.sceneLegacyUniforms = {
      u_GizmoViewProjection: vpMatrix,
    };
  }

  private updateModelUniforms(
    translation: [number, number, number],
    scale: number,
    color: [number, number, number, number],
  ): void {
    if (!this.modelUniformBuffer) return;

    const modelMat = this.buildGizmoModelMat4(translation, scale);
    const buffer = new Float32Array(20);
    buffer.set(modelMat as unknown as Float32Array, 0);
    buffer.set(color, 16);
    this.modelUniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));
  }

  private buildGizmoModelMat4(
    translation: [number, number, number],
    scale: number,
  ): glMat4 {
    const m = glMat4.create();
    glMat4.translate(m, m, translation);
    glMat4.scale(m, m, [scale, scale, scale]);
    return m;
  }

  private initPipeline(canvas: Entity): void {
    if (this.initialized) return;
    if (!canvas.has(GPUResource)) return;

    const { device, renderCache } = canvas.read(GPUResource);

    this.program = renderCache.createProgram({
      vertex: { glsl: gizmoVert, entryPoint: 'main' },
      fragment: { glsl: gizmoFrag, entryPoint: 'main' },
    });

    this.inputLayout = renderCache.createInputLayout({
      vertexBufferDescriptors: [
        {
          arrayStride: 3 * 4,
          stepMode: VertexStepMode.VERTEX,
          attributes: [
            { format: Format.F32_RGB, offset: 0, shaderLocation: 0 },
          ],
        },
        {
          arrayStride: 3 * 4,
          stepMode: VertexStepMode.VERTEX,
          attributes: [
            { format: Format.F32_RGB, offset: 0, shaderLocation: 1 },
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
              blendSrcFactor: BlendFactor.SRC_ALPHA,
              blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
            },
            alphaBlendState: {
              blendMode: BlendMode.ADD,
              blendSrcFactor: BlendFactor.ONE,
              blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
            },
          },
        ],
        blendConstant: TransparentBlack,
        // Always on top: disable depth test
        depthWrite: false,
        depthCompare: CompareFunction.ALWAYS,
        cullMode: CullMode.NONE,
      }),
    });

    // Scene uniform: mat4 viewProjection = 64 bytes
    this.sceneUniformBuffer = device.createBuffer({
      viewOrSize: 64,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    // Model uniform: mat4 model (64) + vec4 color (16) = 80 bytes
    this.modelUniformBuffer = device.createBuffer({
      viewOrSize: 80,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    // Upload gizmo geometry to GPU
    const gizmoMeshes = createTranslateGizmo();
    this.gizmoParts = gizmoMeshes.map((part) => {
      const vertexBuffer = device.createBuffer({
        viewOrSize: part.positions,
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.STATIC,
      });
      const normalBuffer = device.createBuffer({
        viewOrSize: part.normals,
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.STATIC,
      });
      const indexBuffer = device.createBuffer({
        viewOrSize: part.indices,
        usage: BufferUsage.INDEX,
        hint: BufferFrequencyHint.STATIC,
      });
      return {
        vertexBuffer,
        normalBuffer,
        indexBuffer,
        indexCount: part.indices.length,
        color: part.color,
        axis: part.axis,
      };
    });

    this.initialized = true;
  }

  execute(): void {
    // Rendering is driven by MeshPipeline3D calling drawGizmos.
    // No per-frame logic needed here.
  }
}
