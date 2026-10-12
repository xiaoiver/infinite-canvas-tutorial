import {
  BufferFrequencyHint,
  BufferUsage,
  Format,
  TextureUsage,
  VertexStepMode,
  TransparentBlack,
  ViewportOrigin,
  fullscreenMegaState,
  type Device,
  type Texture,
  type Sampler,
} from '@infinite-canvas-tutorial/device-api';
import { Mat3 } from '../components';
import { paddingMat3 } from './matrix';
import type { RenderCache } from './render-cache';
import type { SolidShapeRasterBounds } from './solidShapeRasterForFilter';

const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const padded = (matrix: number[]) =>
  paddingMat3(Mat3.fromGLMat3(new Float32Array(matrix)));

/** Capture the existing fill shader/geometry before spatial filters can move it. */
export function createRasterFilterInput(options: {
  device: Device;
  renderCache: RenderCache;
  vertex: string;
  fragment: string;
  points: Float32Array;
  indices: Uint32Array;
  uniforms: Record<string, unknown>;
  texture: Texture;
  sampler: Sampler;
  bounds: SolidShapeRasterBounds;
}) {
  const { device, renderCache, texture, sampler, bounds } = options;
  const width = Math.max(1, Math.ceil(bounds.maxX - bounds.minX));
  const height = Math.max(1, Math.ceil(bounds.maxY - bounds.minY));
  const bw = bounds.maxX - bounds.minX;
  const bh = bounds.maxY - bounds.minY;
  // Texture v=0 represents the top of local geometry on both backends.
  const ySign =
    device.queryVendorInfo().viewportOrigin === ViewportOrigin.UPPER_LEFT
      ? -1
      : 1;
  const projection = [
    2 / bw,
    0,
    0,
    0,
    (ySign * 2) / bh,
    0,
    -1 - (2 * bounds.minX) / bw,
    ySign * (-1 - (2 * bounds.minY) / bh),
    1,
  ];
  const uniforms = Object.fromEntries(
    Object.entries(options.uniforms).map(([key, value]) => [
      key,
      [...(value as number[])],
    ]),
  );
  // Paint/layer alpha is captured once; inherited shape opacity belongs to the
  // final composite and must not be applied again on every filter pass.
  uniforms.u_Opacity[0] = 1;
  const program = renderCache.createProgram({
    vertex: { glsl: options.vertex },
    fragment: {
      glsl: options.fragment,
      postprocess: (source) =>
        device.queryVendorInfo().platformString === 'WebGPU'
          ? 'diagnostic(off,derivative_uniformity);\n' + source
          : source,
    },
  });
  const inputLayout = renderCache.createInputLayout({
    vertexBufferDescriptors: [
      {
        arrayStride: 8,
        stepMode: VertexStepMode.VERTEX,
        attributes: [{ shaderLocation: 1, offset: 0, format: Format.F32_RG }],
      },
    ],
    indexBufferFormat: Format.U32_R,
    program,
  });
  const pipeline = renderCache.createRenderPipeline({
    inputLayout,
    program,
    colorAttachmentFormats: [Format.U8_RGBA_RT],
    depthStencilAttachmentFormat: null,
    megaStateDescriptor: fullscreenMegaState,
  });
  const vertices = device.createBuffer({
    viewOrSize: options.points,
    usage: BufferUsage.VERTEX,
    hint: BufferFrequencyHint.STATIC,
  });
  const indices = device.createBuffer({
    viewOrSize: options.indices,
    usage: BufferUsage.INDEX,
    hint: BufferFrequencyHint.STATIC,
  });
  const scene = device.createBuffer({
    viewOrSize: new Float32Array([
      ...padded(projection),
      ...padded(identity),
      ...padded(identity),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
    ]),
    usage: BufferUsage.UNIFORM,
    hint: BufferFrequencyHint.STATIC,
  });
  const shape = device.createBuffer({
    viewOrSize: new Float32Array([
      ...padded(identity),
      ...Object.values(uniforms).flat(),
    ]),
    usage: BufferUsage.UNIFORM,
    hint: BufferFrequencyHint.STATIC,
  });
  const output = device.createTexture({
    format: Format.U8_RGBA_RT,
    width,
    height,
    usage: TextureUsage.RENDER_TARGET | TextureUsage.SAMPLED,
  });
  const target = device.createRenderTargetFromTexture(output);
  const bindings = device.createBindings({
    pipeline,
    uniformBufferBindings: [{ buffer: scene }, { buffer: shape }],
    samplerBindings: [{ texture, sampler }],
  });
  try {
    program.setUniformsLegacy({
      ...uniforms,
      u_ModelMatrix: identity,
      u_ProjectionMatrix: projection,
      u_ViewMatrix: identity,
      u_ViewProjectionInvMatrix: identity,
      u_BackgroundColor: [0, 0, 0, 0],
      u_GridColor: [0, 0, 0, 0],
      u_ZoomScale: 1,
      u_CheckboardStyle: 0,
    });
    device.submitRenderPassImmediate(
      {
        colorAttachment: [target],
        colorResolveTo: [null],
        colorClearColor: [TransparentBlack],
        colorStore: [true],
      },
      (pass) => {
        pass.setViewport(0, 0, width, height);
        pass.setPipeline(pipeline);
        pass.setVertexInput(inputLayout, [{ buffer: vertices }], {
          buffer: indices,
        });
        pass.setBindings(bindings);
        pass.drawIndexed(options.indices.length);
      },
    );
  } catch (error) {
    target.destroy();
    throw error;
  } finally {
    bindings.destroy();
    shape.destroy();
    scene.destroy();
    vertices.destroy();
    indices.destroy();
  }
  return {
    texture: output,
    width,
    height,
    bounds,
    // The render target owns its attached texture, so destroy exactly once.
    destroy: () => target.destroy(),
  };
}
