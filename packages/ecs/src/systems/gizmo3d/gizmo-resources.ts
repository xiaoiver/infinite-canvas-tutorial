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
import { ResourceScope } from '../../resources/ResourceScope';
import {
  gizmoDisplayVert,
  gizmoDisplayFrag,
} from '../../shaders/gizmo3d-display';
import {
  getGizmoMeshParts,
  gizmoPartDrawLayer,
} from '../../utils/gizmo-interaction';
import type { GizmoMeshData } from '../../utils/gizmo-geometry';
import type { RenderCache } from '../../utils/render-cache';
import {
  buildGizmoUniforms,
  GIZMO_UNIFORM_FLOATS,
  type GizmoDrawInstance,
} from './gizmo-uniforms';

interface Geometry {
  part: GizmoMeshData;
  vertices: { buffer: Buffer }[];
  indices: { buffer: Buffer };
}
interface DrawBuffers {
  scene: Buffer;
  model: Buffer;
  bindings: Bindings;
}
interface ObjectResources {
  parts: DrawBuffers[];
  dispose: () => void;
}

/** Owns buffers/bindings; the canvas RenderCache owns program/layout/pipeline. */
export class GizmoResources {
  private scope = new ResourceScope();
  private objects = new Map<number, ObjectResources>();
  private disposed = false;
  private program: Program;
  private pipeline: RenderPipeline;
  private inputLayout: InputLayout;
  private geometry: Geometry[];

  constructor(private device: Device, renderCache: RenderCache) {
    try {
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

      this.geometry = [...getGizmoMeshParts()]
        .sort(
          (a, b) =>
            gizmoPartDrawLayer(a.kind, a.axis) -
            gizmoPartDrawLayer(b.kind, b.axis),
        )
        .map((part) => {
          const colors = new Float32Array((part.positions.length / 3) * 4);
          for (let i = 0; i < colors.length; i += 4) colors.set(part.color, i);
          const vertex = (data: Float32Array) => ({
            buffer: this.own(
              this.scope,
              device.createBuffer({
                viewOrSize: data,
                usage: BufferUsage.VERTEX,
                hint: BufferFrequencyHint.STATIC,
              }),
            ),
          });
          return {
            part,
            vertices: [
              vertex(part.positions),
              vertex(part.normals),
              vertex(colors),
            ],
            indices: {
              buffer: this.own(
                this.scope,
                device.createBuffer({
                  viewOrSize: part.indices,
                  usage: BufferUsage.INDEX,
                  hint: BufferFrequencyHint.STATIC,
                }),
              ),
            },
          };
        });
    } catch (error) {
      this.rollback(this.scope);
      throw error;
    }
  }

  private own<T extends { destroy(): void }>(
    scope: ResourceScope,
    resource: T,
  ): T {
    scope.add(() => resource.destroy());
    return resource;
  }

  private rollback(scope: ResourceScope) {
    // Scope attempts every release; preserve the original allocation failure.
    try {
      scope.dispose();
    } catch {
      /* cleanup after partial allocation */
    }
  }

  private object(id: number): ObjectResources {
    const existing = this.objects.get(id);
    if (existing) return existing;
    const scope = new ResourceScope();
    try {
      // Each object AND each handle needs its own UBOs. WebGPU writes all buffers
      // before submitting the pass, so sharing across objects loses earlier poses.
      const parts = this.geometry.map(() => {
        const uniform = () =>
          this.own(
            scope,
            this.device.createBuffer({
              viewOrSize: GIZMO_UNIFORM_FLOATS * 4,
              usage: BufferUsage.UNIFORM,
              hint: BufferFrequencyHint.DYNAMIC,
            }),
          );
        const scene = uniform();
        const model = uniform();
        const bindings = this.own(
          scope,
          this.device.createBindings({
            pipeline: this.pipeline,
            uniformBufferBindings: [{ buffer: scene }, { buffer: model }],
          }),
        );
        return { scene, model, bindings };
      });
      const dispose = this.scope.add(() => {
        this.objects.delete(id);
        scope.dispose();
      });
      const result = { parts, dispose };
      this.objects.set(id, result);
      return result;
    } catch (error) {
      this.rollback(scope);
      throw error;
    }
  }

  retainObjects(ids: ReadonlySet<number>): void {
    const releases = new ResourceScope();
    for (const [id, object] of this.objects)
      if (!ids.has(id)) releases.add(object.dispose);
    releases.dispose();
  }

  draw(
    pass: RenderPass,
    instances: readonly GizmoDrawInstance[],
    width: number,
    height: number,
  ): void {
    if (this.disposed) throw new Error('Gizmo resources have been disposed');
    this.retainObjects(new Set(instances.map(({ id }) => id)));
    pass.setViewport(0, 0, width, height);
    pass.setPipeline(this.pipeline);
    for (const instance of instances) {
      const object = this.object(instance.id);
      this.geometry.forEach(({ part, vertices, indices }, i) => {
        const buffers = object.parts[i];
        const { sceneBuffer, modelBuffer, legacy } = buildGizmoUniforms(
          instance,
          part,
        );
        buffers.scene.setSubData(0, new Uint8Array(sceneBuffer.buffer));
        buffers.model.setSubData(0, new Uint8Array(modelBuffer.buffer));
        this.program.setUniformsLegacy(legacy);
        pass.setBindings(buffers.bindings);
        pass.setVertexInput(this.inputLayout, vertices, indices);
        pass.drawIndexed(part.indices.length);
      });
    }
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scope.dispose();
  }
}
