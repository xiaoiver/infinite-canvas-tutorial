import {
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  Device,
  Format,
  InputLayout,
  Program,
  RenderPipeline,
  Texture,
  TextureUsage,
  TransparentWhite,
  VertexStepMode,
} from '@infinite-canvas-tutorial/device-api';
import { vert, frag } from '../shaders/mesh-fill-gradient';
import { parseColor } from '../utils/color';
import {
  buildMeshGradientUniformValues,
  DEFAULT_MESH_GRADIENT_CORNER_POSITIONS,
  MESH_GRADIENT_UNIFORM_FLOAT32_COUNT,
} from '../utils/mesh-gradient-padding';
import { effectiveMeshGradientPointsNum, type MeshGradient } from '../utils/gradient';
import type { RenderCache } from '../utils/render-cache';

function colorToLinearRgb(color: string): [number, number, number] {
  const { r, g, b } = parseColor(color);
  return [r / 255, g / 255, b / 255];
}

/** `Math.max(1, Math.floor(x))` is NaN if x is NaN/undefined — WebGL 会得到 0×0 附件并报错。 */
function clampRenderTargetSize(n: number): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) {
    return 1;
  }
  // 与常见 WebGL MAX_TEXTURE_SIZE 一致的量级
  return Math.min(v, 16384);
}

/**
 * 全量站点 mesh-gradient 片元（无片内随机 noise 混色），`Uniforms` 与
 * `MeshGradient.vue` / `paddingUniforms` 布局一致（92 float 有效，缓冲 96 float 补零）。
 *
 * WebGL2：同一块 `Uniforms` 必须出现在 **vertex** 与 fragment，见
 * `mesh-fill-gradient.ts`（`Device.setPipeline` 只扫描 VS 做 `uniformBlockBinding`）。
 *
 * 资源与 `packages/site/docs/components/MeshGradient.vue` 已验证路径对齐：`U8_RGBA_NORM`、
 * 默认 megaState（不单独写 depth=ALWAYS 等），避免与站点行为不一致导致离屏全黑。
 */
export class MeshGradientPass {
  #program: Program | null = null;
  #pipeline: RenderPipeline | null = null;
  #inputLayout: InputLayout | null = null;
  #vertexBuffer: Buffer | null = null;
  #uniformBuffer: Buffer | null = null;

  constructor(
    private readonly device: Device,
    private readonly renderCache: RenderCache,
  ) { }

  render(gradient: MeshGradient, width: number, height: number): Texture {
    const w = clampRenderTargetSize(width);
    const h = clampRenderTargetSize(height);
    this.#ensurePipeline();

    const texture = this.device.createTexture({
      format: Format.U8_RGBA_NORM,
      width: w,
      height: h,
      usage: TextureUsage.RENDER_TARGET | TextureUsage.SAMPLED,
    });
    const renderTarget = this.device.createRenderTargetFromTexture(texture);

    const pointColors: [number, number, number][] = Array.from(
      { length: 10 },
      (_, i) =>
        i < 9
          ? colorToLinearRgb(gradient.colors[i] ?? '#000')
          : ([0, 0, 0] as [number, number, number]),
    );
    const pointPositions: [number, number][] = Array.from(
      { length: 10 },
      (_, i) => {
        const p = gradient.positions?.[i];
        if (
          p != null &&
          Array.isArray(p) &&
          p.length >= 2 &&
          Number.isFinite(p[0] as number) &&
          Number.isFinite(p[1] as number)
        ) {
          return [p[0]!, p[1]!];
        }
        return DEFAULT_MESH_GRADIENT_CORNER_POSITIONS[i]!;
      },
    );
    const [br, bg, bb] = colorToLinearRgb(gradient.backgroundColor);
    // gtype(2) mesh 模式全用 3×3 的 9 点；gtype(0) 等用逻辑点数。勿用 `pointsNum ?? 9`：
    // 缺 `pointsNum` 时应与 `parseGradient` 一致用颜色推断，否则单角点串会误用 9 而首帧错。
    const gType = gradient.gradientTypeIndex ?? 2;
    const uPointsNum =
      gType === 2 ? 9 : effectiveMeshGradientPointsNum(gradient);
    const uboFlat = buildMeshGradientUniformValues({
      backgroundRgb: [br, bg, bb],
      pointColors,
      pointPositions,
      pointsNum: uPointsNum,
      noiseRatio: 0,
      noiseTime: 0,
      warpShapeIndex: gradient.warpShapeIndex ?? 0,
      warpSize: gradient.warpSize ?? 0.5,
      warpRatio: gradient.warpRatio ?? 0,
      gradientTypeIndex: gradient.gradientTypeIndex ?? 2,
      time: gradient.time ?? 0,
    });
    const data = new Float32Array(MESH_GRADIENT_UNIFORM_FLOAT32_COUNT);
    data.set(uboFlat, 0);

    this.#uniformBuffer!.setSubData(0, new Uint8Array(data.buffer));
    const legacyPoints = Object.assign(
      {},
      ...Array.from({ length: 10 }, (_, index) => ({
        [`u_Points[${index}].color`]: pointColors[index]!,
        [`u_Points[${index}].position`]: pointPositions[index]!,
      })),
    );
    this.#program!.setUniformsLegacy({
      ...legacyPoints,
      u_BgColor: [br, bg, bb],
      u_PointsNum: uPointsNum,
      u_NoiseRatio: 0,
      u_NoiseTime: 0,
      u_WarpShapeIndex: gradient.warpShapeIndex ?? 0,
      u_WarpSize: gradient.warpSize ?? 0.5,
      u_WarpRatio: gradient.warpRatio ?? 0,
      u_GradientTypeIndex: gradient.gradientTypeIndex ?? 2,
      u_Time: gradient.time ?? 0,
    } as Record<string, unknown>);

    const bindings = this.renderCache.createBindings({
      pipeline: this.#pipeline!,
      uniformBufferBindings: [{ buffer: this.#uniformBuffer! }],
    });

    const isWebGPU = this.device.queryVendorInfo().platformString === 'WebGPU';
    const renderPass = this.device.createRenderPass({
      colorAttachment: [renderTarget],
      colorResolveTo: [null],
      colorClearColor: [TransparentWhite],
      colorStore: [true],
      depthStencilAttachment: null,
      depthStencilResolveTo: null,
    });

    // 与 MeshGradient.vue：setPipeline → setBindings → setVertexInput → (WebGL) setViewport → draw
    renderPass.setPipeline(this.#pipeline!);
    renderPass.setBindings(bindings);
    renderPass.setVertexInput(
      this.#inputLayout!,
      [{ buffer: this.#vertexBuffer! }],
      null,
    );
    if (!isWebGPU) {
      renderPass.setViewport(0, 0, w, h);
    }
    renderPass.draw(3);
    this.device.submitPass(renderPass);

    bindings.destroy();
    return texture;
  }

  #ensurePipeline(): void {
    if (this.#program) {
      return;
    }

    const isWebGPU = this.device.queryVendorInfo().platformString === 'WebGPU';
    const diagnosticDerivativeUniformityHeader = isWebGPU
      ? 'diagnostic(off,derivative_uniformity);\n'
      : '';

    this.#uniformBuffer = this.device.createBuffer({
      viewOrSize:
        Float32Array.BYTES_PER_ELEMENT * MESH_GRADIENT_UNIFORM_FLOAT32_COUNT,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.#program = this.renderCache.createProgram({
      vertex: { glsl: vert },
      fragment: {
        glsl: frag,
        postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
      },
    });

    this.#vertexBuffer = this.device.createBuffer({
      viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.#inputLayout = this.device.createInputLayout({
      vertexBufferDescriptors: [
        {
          arrayStride: 4 * 2,
          stepMode: VertexStepMode.VERTEX,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: Format.F32_RG,
            },
          ],
        },
      ],
      indexBufferFormat: null,
      program: this.#program,
    });

    this.#pipeline = this.renderCache.createRenderPipeline({
      inputLayout: this.#inputLayout,
      program: this.#program,
      colorAttachmentFormats: [Format.U8_RGBA_NORM],
      depthStencilAttachmentFormat: null,
    });
  }
}
