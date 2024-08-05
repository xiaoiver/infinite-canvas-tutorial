import _gl from 'gl';
import {
  BufferFrequencyHint,
  BufferUsage,
  DeviceContribution,
  Format,
  PrimitiveTopology,
  TextureUsage,
  TransparentWhite,
  VertexStepMode,
  WebGLDeviceContribution,
} from '@antv/g-device-api';
import '../useSnapshotMatchers';

export function getWebGLDeviceContributionAndCanvas(): [
  WebGLDeviceContribution,
  HTMLCanvasElement,
] {
  const deviceContribution = new WebGLDeviceContribution({
    targets: ['webgl2', 'webgl1'],
    antialias: true,
    shaderDebug: true,
    trackResources: true,
  });

  const width = 100;
  const height = 100;
  let gl = _gl(width, height, {
    antialias: false,
    preserveDrawingBuffer: true,
    stencil: true,
  });

  const mockCanvas: HTMLCanvasElement = {
    width,
    height,
    // @ts-ignore
    getContext: () => {
      // @ts-ignore
      gl.canvas = mockCanvas;
      // 模拟 DOM API，返回小程序 context，它应当和 CanvasRenderingContext2D 一致
      // @see https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLCanvasElement/getContext
      return gl;
    },
  };
  return [deviceContribution, mockCanvas];
}

export async function render(
  deviceContribution: DeviceContribution,
  $canvas: HTMLCanvasElement,
  useRAF = true,
) {
  // create swap chain and get device
  const swapChain = await deviceContribution.createSwapChain($canvas);
  // TODO: resize
  swapChain.configureSwapChain($canvas.width, $canvas.height);
  const device = swapChain.getDevice();

  const onscreenTexture = swapChain.getOnscreenTexture();

  const program = device.createProgram({
    vertex: {
      glsl: `
layout(location = 0) in vec2 a_Position;

void main() {
  gl_Position = vec4(a_Position, 0.0, 1.0);
} 
`,
    },
    fragment: {
      glsl: `
out vec4 outputColor;

void main() {
  outputColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`,
    },
  });

  const vertexBuffer = device.createBuffer({
    viewOrSize: new Float32Array([
      0, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, 0, 0.5,
    ]),
    usage: BufferUsage.VERTEX,
    hint: BufferFrequencyHint.DYNAMIC,
  });

  const inputLayout = device.createInputLayout({
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
    program,
  });

  const pipeline = device.createRenderPipeline({
    inputLayout,
    program,
    topology: PrimitiveTopology.LINES,
    colorAttachmentFormats: [Format.U8_RGBA_RT],
  });

  const renderTarget = device.createRenderTargetFromTexture(
    device.createTexture({
      format: Format.U8_RGBA_RT,
      width: $canvas.width,
      height: $canvas.height,
      usage: TextureUsage.RENDER_TARGET,
    }),
  );

  let id: number;
  const frame = () => {
    device.beginFrame();

    const renderPass = device.createRenderPass({
      colorAttachment: [renderTarget],
      colorResolveTo: [onscreenTexture],
      colorClearColor: [TransparentWhite],
    });

    renderPass.setPipeline(pipeline);
    renderPass.setVertexInput(
      inputLayout,
      [
        {
          buffer: vertexBuffer,
        },
      ],
      null,
    );
    renderPass.setViewport(0, 0, $canvas.width, $canvas.height);
    renderPass.draw(6);

    device.submitPass(renderPass);

    device.endFrame();

    if (useRAF) {
      requestAnimationFrame(frame);
    }
  };

  frame();

  return () => {
    if (useRAF && id) {
      cancelAnimationFrame(id);
    }
    program.destroy();
    vertexBuffer.destroy();
    inputLayout.destroy();
    pipeline.destroy();
    renderTarget.destroy();
    device.destroy();

    // For debug.
    device.checkForLeaks();
  };
}

describe('Device API', () => {
  it('should render correctly.', async () => {
    const [webGLDeviceContribution, $canvas] =
      getWebGLDeviceContributionAndCanvas();

    const disposeCallback = await render(
      webGLDeviceContribution,
      $canvas,
      false,
    );

    const dir = `${__dirname}/snapshots`;

    expect($canvas.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'primitive-topology-lines',
    );

    disposeCallback();
  });
});
