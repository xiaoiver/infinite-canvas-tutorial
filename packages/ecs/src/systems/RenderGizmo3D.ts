import { Entity, System } from '@lastolivegames/becsy';
import { mat4 as glMat4 } from 'gl-matrix';
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
  makeMegaState,
} from '@infinite-canvas-tutorial/device-api';
import {
  Camera,
  Camera3D,
  Canvas,
  ComputedCamera,
  GPUResource,
  Transform3D,
} from '../components';
import { Selected3D } from '../components/geometry3d/Selected3D';
import { Mat4 } from '../components/math/Mat4';
import { gizmoDisplayVert, gizmoDisplayFrag } from '../shaders/gizmo3d-display';
import {
  createCombinedTransformGizmo,
  computeGizmoScale,
  GIZMO_AXIS_ARROW_LENGTH,
  GIZMO_ROTATE_RING_RADIUS,
  type GizmoMeshData,
  type GizmoPartKind,
} from '../utils/gizmo-geometry';
import { computeLinkedPerspectiveZGizmoScreenBias } from '../utils/gizmo-projection';
import {
  buildGizmoModelMatrix,
  gizmoPartUsesLinkedZScreenBias,
} from '../utils/gizmo-interaction';
import {
  buildCamera3DSceneUniforms,
  packSceneUniformBuffer,
  sceneUniformsToPickScene,
} from '../utils/mesh3d-scene';
import { SetupDevice } from './SetupDevice';
import {
  registerGizmo3D,
  unregisterGizmo3D,
} from './gizmo3d-bridge';

interface GizmoPartGPU {
  vertexBuffer: Buffer;
  normalBuffer: Buffer;
  colorBuffer: Buffer;
  indexBuffer: Buffer;
  indexCount: number;
  color: [number, number, number, number];
  axis: string;
  partKind: GizmoPartKind;
  /** Plane handles drawn before rings / arrows. */
  isPlane: boolean;
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
    return this.selected3D.current.some((entity) => entity.has(Selected3D));
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

    const sceneUniforms = buildCamera3DSceneUniforms(camera, aspect, cam2d);

    renderPass.setViewport(0, 0, width, height);
    renderPass.setPipeline(this.pipeline);

    const bindings = device.createBindings({
      pipeline: this.pipeline,
      uniformBufferBindings: [
        { buffer: this.sceneUniformBuffer },
        { buffer: this.modelUniformBuffer },
      ],
    });

    // Draw gizmo for each selected entity (Pick3D may remove Selected3D earlier this frame).
    for (const entity of this.selected3D.current) {
      if (!entity.has(Selected3D)) continue;

      const transform = entity.read(Transform3D);
      const sel = entity.read(Selected3D);
      const translation = transform.translation;

      // Gizmo scale for constant screen size
      const gizmoScale = computeGizmoScale(
        camera.eye,
        translation,
        camera.fovy,
        logicalH > 0 ? logicalH : height,
        150,
        camera.linked,
      );

      const extent =
        gizmoScale *
        Math.max(GIZMO_AXIS_ARROW_LENGTH, GIZMO_ROTATE_RING_RADIUS * 2);

      const drawOrder = [...this.gizmoParts].sort(
        (a, b) => gizmoDrawLayer(a) - gizmoDrawLayer(b),
      );

      const rotation = transform.rotation;

      for (const part of drawOrder) {
        const highlighted =
          sel.activeAxis === part.axis && sel.activePartKind === part.partKind;

        this.uploadSceneUniforms(
          sceneUniforms,
          translation,
          extent,
          highlighted,
        );

        const modelMat = buildGizmoModelMatrix(
          translation,
          rotation,
          gizmoScale,
          part.partKind,
        );
        const modelLegacy = this.uploadModelUniforms(
          modelMat,
          translation,
          part.color,
          gizmoPartUsesLinkedZScreenBias(part.partKind, part.axis),
        );

        this.program!.setUniformsLegacy({
          ...this.sceneLegacyUniforms,
          ...modelLegacy,
        });

        renderPass.setBindings(bindings);
        renderPass.setVertexInput(
          this.inputLayout,
          [
            { buffer: part.vertexBuffer },
            { buffer: part.normalBuffer },
            { buffer: part.colorBuffer },
          ],
          { buffer: part.indexBuffer },
        );
        renderPass.drawIndexed(part.indexCount);
      }
    }

    bindings.destroy();
  }

  private uploadSceneUniforms(
    uniforms: ReturnType<typeof buildCamera3DSceneUniforms>,
    anchor: [number, number, number],
    gizmoWorldExtent: number,
    highlighted: boolean,
  ): void {
    if (!this.sceneUniformBuffer) return;

    let sceneParams: [number, number, number, number] = [...uniforms.sceneParams];
    if (uniforms.mode === 'linkedPerspective') {
      const pickScene = sceneUniformsToPickScene(uniforms);
      if (pickScene.mode === 'linkedPerspective') {
        const bias = computeLinkedPerspectiveZGizmoScreenBias(
          anchor,
          gizmoWorldExtent,
          pickScene,
        );
        sceneParams = [bias[0], bias[1], 1, 0];
      }
    }
    sceneParams[3] = highlighted ? 1 : 0;

    const buffer = packSceneUniformBuffer({ ...uniforms, sceneParams });
    this.sceneUniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));

    this.sceneLegacyUniforms = {
      u_ProjectionMatrix3D: Mat4.toGLMat4(uniforms.projMatrix),
      u_ViewMatrix3D: Mat4.toGLMat4(uniforms.viewMatrix),
      u_CanvasViewProjection3D: Mat4.toGLMat4(uniforms.canvasViewProjection),
      u_SceneParams: sceneParams,
    };
  }

  private uploadModelUniforms(
    modelMat: glMat4,
    translation: [number, number, number],
    color: [number, number, number, number],
    applyLinkedZBias: boolean,
  ): Record<string, unknown> {
    const normalMat = glMat4.create();
    glMat4.invert(normalMat, modelMat);
    glMat4.transpose(normalMat, normalMat);

    if (this.modelUniformBuffer) {
      const buffer = new Float32Array(52);
      buffer.set(modelMat as unknown as Float32Array, 0);
      buffer.set(normalMat as unknown as Float32Array, 16);
      buffer.set(color, 32);
      buffer.set([1, applyLinkedZBias ? 1 : 0, 0, 0], 36);
      buffer.set([-0.5, -0.7, -0.5, 0], 40);
      buffer.set(
        [translation[0], translation[1], translation[2], 0],
        44,
      );
      this.modelUniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));
    }

    return {
      u_ModelMatrix3D: modelMat,
      u_NormalMatrix3D: normalMat,
      u_BaseColor: color,
      u_LightParams: [1, applyLinkedZBias ? 1 : 0, 0, 0],
      u_LightDirection: [-0.5, -0.7, -0.5, 0],
      u_CanvasAnchor: [translation[0], translation[1], translation[2], 0],
    };
  }

  private initPipeline(canvas: Entity): void {
    if (this.initialized) return;
    if (!canvas.has(GPUResource)) return;

    const { device, renderCache } = canvas.read(GPUResource);

    this.program = renderCache.createProgram({
      vertex: { glsl: gizmoDisplayVert, entryPoint: 'main' },
      fragment: { glsl: gizmoDisplayFrag, entryPoint: 'main' },
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
        {
          arrayStride: 4 * 4,
          stepMode: VertexStepMode.VERTEX,
          attributes: [
            { format: Format.F32_RGBA, offset: 0, shaderLocation: 2 },
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

    // Match mesh3d SceneUniforms3D / ModelUniforms3D (52 floats each).
    this.sceneUniformBuffer = device.createBuffer({
      viewOrSize: 52 * 4,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.modelUniformBuffer = device.createBuffer({
      viewOrSize: 52 * 4,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.gizmoParts = this.uploadGizmoMeshes(
      device,
      createCombinedTransformGizmo(),
    );

    this.initialized = true;
  }

  private uploadGizmoMeshes(
    device: Device,
    meshes: GizmoMeshData[],
  ): GizmoPartGPU[] {
    return meshes.map((part) => {
      const vertexCount = part.positions.length / 3;
      const colors = new Float32Array(vertexCount * 4);
      for (let i = 0; i < vertexCount; i++) {
        colors[i * 4] = part.color[0];
        colors[i * 4 + 1] = part.color[1];
        colors[i * 4 + 2] = part.color[2];
        colors[i * 4 + 3] = part.color[3];
      }

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
      const colorBuffer = device.createBuffer({
        viewOrSize: colors,
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.STATIC,
      });
      const indexBuffer = device.createBuffer({
        viewOrSize: part.indices,
        usage: BufferUsage.INDEX,
        hint: BufferFrequencyHint.STATIC,
      });
      const isPlane =
        part.axis === 'xy' || part.axis === 'xz' || part.axis === 'yz';
      return {
        vertexBuffer,
        normalBuffer,
        colorBuffer,
        indexBuffer,
        indexCount: part.indices.length,
        color: part.color,
        axis: part.axis,
        partKind: part.kind,
        isPlane,
      };
    });
  }

  execute(): void {
    // Rendering is driven by MeshPipeline3D calling drawGizmos.
    // No per-frame logic needed here.
  }
}

/** Planes under rings, rings under arrows (arrows win overlapping picks). */
function gizmoDrawLayer(part: GizmoPartGPU): number {
  if (part.isPlane) return 0;
  if (part.partKind === 'rotate') return 1;
  return 2;
}
