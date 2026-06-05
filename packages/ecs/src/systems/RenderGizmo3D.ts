import { Entity, System } from '@lastolivegames/becsy';
import { mat4 as glMat4 } from 'gl-matrix';
import type {
  Bindings,
  Device,
  RenderPass,
} from '@infinite-canvas-tutorial/device-api';
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
  Canvas3DScope,
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
  filterEntitiesForCanvas,
  findCamera2DForCanvas,
  findCamera3DForCanvas,
} from '../utils/canvas3d-scope';
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
import type { RenderCache } from '../utils/render-cache';

/** Per-WebGL-context gizmo pipeline (multi-canvas safe). */
interface Gizmo3DDeviceState {
  program: Program;
  pipeline: RenderPipeline;
  inputLayout: InputLayout;
  gizmoParts: GizmoPartGPU[];
  sceneLegacyUniforms: Record<string, unknown>;
}

/** std140 ModelUniforms3D / SceneUniforms3D pack size (floats). */
const GIZMO_UNIFORM_FLOATS = 52;

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
  /** Per-part UBOs: WebGPU batches queue.writeBuffer before submit (shared buffer = last write wins). */
  sceneUniformBuffer: Buffer;
  modelUniformBuffer: Buffer;
  bindings: Bindings | null;
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

  private deviceStates = new WeakMap<Device, Gizmo3DDeviceState>();
  private trackedDevices = new Set<Device>();

  constructor() {
    super();
    registerGizmo3D(this);
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
          Selected3D,
          Transform3D,
        )
        .read,
    );
  }

  /** True when there are selected 3D entities to show gizmos for. */
  hasGizmoContent(canvas?: Entity): boolean {
    if (canvas) {
      const canvasCount = this.canvases.current.length || 1;
      return this.selected3D.current.some(
        (entity) =>
          entity.has(Selected3D) &&
          filterEntitiesForCanvas([entity], canvas, canvasCount).length > 0,
      );
    }
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
    if (!this.hasGizmoContent(canvas)) return;
    if (width <= 0 || height <= 0) return;

    const state = this.initPipeline(canvas);
    if (!state) return;

    const canvasCount = this.canvases.current.length || 1;
    const cameraEntity = findCamera3DForCanvas(
      this.cameras3D.current,
      canvas,
      canvasCount,
    );
    if (!cameraEntity) return;

    const camera = cameraEntity.read(Camera3D);
    const cam2d = camera.linked
      ? findCamera2DForCanvas(this.cameras2D.current, canvas)
      : undefined;
    const { width: logicalW, height: logicalH } = canvas.read(Canvas);
    const aspect =
      camera.linked && logicalW > 0 && logicalH > 0
        ? logicalW / logicalH
        : width / height;

    const sceneUniforms = buildCamera3DSceneUniforms(camera, aspect, cam2d);

    renderPass.setViewport(0, 0, width, height);
    renderPass.setPipeline(state.pipeline);

    for (const entity of this.selected3D.current) {
      if (!entity.has(Selected3D)) continue;
      if (
        !filterEntitiesForCanvas([entity], canvas, canvasCount).length
      ) {
        continue;
      }

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

      const drawOrder = [...state.gizmoParts].sort(
        (a, b) => gizmoDrawLayer(a) - gizmoDrawLayer(b),
      );

      const rotation = transform.rotation;

      for (const part of drawOrder) {
        const highlighted =
          sel.activeAxis === part.axis && sel.activePartKind === part.partKind;

        this.uploadSceneUniforms(
          state,
          part.sceneUniformBuffer,
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
          part.modelUniformBuffer,
          modelMat,
          translation,
          part.color,
          gizmoPartUsesLinkedZScreenBias(part.partKind, part.axis),
        );

        state.program.setUniformsLegacy({
          ...state.sceneLegacyUniforms,
          ...modelLegacy,
        });

        renderPass.setBindings(part.bindings!);
        renderPass.setVertexInput(
          state.inputLayout,
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
  }

  private uploadSceneUniforms(
    state: Gizmo3DDeviceState,
    sceneUniformBuffer: Buffer,
    uniforms: ReturnType<typeof buildCamera3DSceneUniforms>,
    anchor: [number, number, number],
    gizmoWorldExtent: number,
    highlighted: boolean,
  ): void {

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
    sceneUniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));

    state.sceneLegacyUniforms = {
      u_ProjectionMatrix3D: Mat4.toGLMat4(uniforms.projMatrix),
      u_ViewMatrix3D: Mat4.toGLMat4(uniforms.viewMatrix),
      u_CanvasViewProjection3D: Mat4.toGLMat4(uniforms.canvasViewProjection),
      u_SceneParams: sceneParams,
    };
  }

  private uploadModelUniforms(
    modelUniformBuffer: Buffer,
    modelMat: glMat4,
    translation: [number, number, number],
    color: [number, number, number, number],
    applyLinkedZBias: boolean,
  ): Record<string, unknown> {
    const normalMat = glMat4.create();
    glMat4.invert(normalMat, modelMat);
    glMat4.transpose(normalMat, normalMat);

    const buffer = new Float32Array(GIZMO_UNIFORM_FLOATS);
    buffer.set(modelMat as unknown as Float32Array, 0);
    buffer.set(normalMat as unknown as Float32Array, 16);
    buffer.set(color, 32);
    buffer.set([1, applyLinkedZBias ? 1 : 0, 0, 0], 36);
    buffer.set([-0.5, -0.7, -0.5, 0], 40);
    buffer.set([translation[0], translation[1], translation[2], 0], 44);
    modelUniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));

    return {
      u_ModelMatrix3D: modelMat,
      u_NormalMatrix3D: normalMat,
      u_BaseColor: color,
      u_LightParams: [1, applyLinkedZBias ? 1 : 0, 0, 0],
      u_LightDirection: [-0.5, -0.7, -0.5, 0],
      u_CanvasAnchor: [translation[0], translation[1], translation[2], 0],
    };
  }

  private initPipeline(canvas: Entity): Gizmo3DDeviceState | null {
    if (!canvas.has(GPUResource)) return null;

    const { device, renderCache } = canvas.read(GPUResource);
    return this.ensureDeviceState(device, renderCache);
  }

  private ensureDeviceState(
    device: Device,
    renderCache: RenderCache,
  ): Gizmo3DDeviceState {
    const existing = this.deviceStates.get(device);
    if (existing) {
      return existing;
    }

    const program = renderCache.createProgram({
      vertex: { glsl: gizmoDisplayVert, entryPoint: 'main' },
      fragment: { glsl: gizmoDisplayFrag, entryPoint: 'main' },
    });

    const inputLayout = renderCache.createInputLayout({
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

    const gizmoParts = this.uploadGizmoMeshes(
      device,
      createCombinedTransformGizmo(),
    );

    for (const part of gizmoParts) {
      part.bindings = device.createBindings({
        pipeline,
        uniformBufferBindings: [
          { buffer: part.sceneUniformBuffer },
          { buffer: part.modelUniformBuffer },
        ],
      });
    }

    const state: Gizmo3DDeviceState = {
      program,
      pipeline,
      inputLayout,
      gizmoParts,
      sceneLegacyUniforms: {},
    };
    this.deviceStates.set(device, state);
    this.trackedDevices.add(device);
    return state;
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

  private dropDeviceState(device: Device): void {
    const state = this.deviceStates.get(device);
    if (!state) {
      return;
    }
    for (const part of state.gizmoParts) {
      try {
        part.bindings?.destroy();
        part.vertexBuffer.destroy();
        part.normalBuffer.destroy();
        part.colorBuffer.destroy();
        part.indexBuffer.destroy();
        part.sceneUniformBuffer.destroy();
        part.modelUniformBuffer.destroy();
      } catch {
        /* device already destroyed */
      }
    }
    this.deviceStates.delete(device);
    this.trackedDevices.delete(device);
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
      const sceneUniformBuffer = device.createBuffer({
        viewOrSize: GIZMO_UNIFORM_FLOATS * 4,
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
      const modelUniformBuffer = device.createBuffer({
        viewOrSize: GIZMO_UNIFORM_FLOATS * 4,
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
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
        sceneUniformBuffer,
        modelUniformBuffer,
        bindings: null,
      };
    });
  }

  finalize(): void {
    unregisterGizmo3D(this);
    for (const device of [...this.trackedDevices]) {
      this.dropDeviceState(device);
    }
  }

  execute(): void {
    const activeDevices = this.getActiveDevices();
    for (const device of [...this.trackedDevices]) {
      if (!activeDevices.has(device)) {
        this.dropDeviceState(device);
      }
    }
  }
}

/** Planes under rings, rings under arrows (arrows win overlapping picks). */
function gizmoDrawLayer(part: GizmoPartGPU): number {
  if (part.isPlane) return 0;
  if (part.partKind === 'rotate') return 1;
  return 2;
}
