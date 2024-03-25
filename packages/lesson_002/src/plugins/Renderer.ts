import {
  BufferFrequencyHint,
  BufferUsage,
  Format,
  TextureUsage,
  TransparentWhite,
  VertexStepMode,
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@antv/g-device-api';
import type {
  SwapChain,
  DeviceContribution,
  Device,
  RenderPass,
} from '@antv/g-device-api';
import type { Plugin, PluginContext } from './interfaces';

export class Renderer implements Plugin {
  #swapChain: SwapChain;
  #device: Device;
  #renderPass: RenderPass;

  apply(context: PluginContext) {
    const { hooks, canvas, renderer } = context;

    hooks.initAsync.tapPromise(async () => {
      let deviceContribution: DeviceContribution;
      if (renderer === 'webgl') {
        deviceContribution = new WebGLDeviceContribution({
          targets: ['webgl2', 'webgl1'],
          shaderDebug: true,
          trackResources: true,
          onContextCreationError: () => {},
          onContextLost: () => {},
          onContextRestored(e) {},
        });
      } else {
        const shaderCompilerPath = new URL(
          '/public/glsl_wgsl_compiler_bg.wasm',
          import.meta.url,
        ).href;
        deviceContribution = new WebGPUDeviceContribution({
          shaderCompilerPath,
          onContextLost: () => {},
        });
      }

      const { width, height } = canvas;
      const swapChain = await deviceContribution.createSwapChain(canvas);
      swapChain.configureSwapChain(width, height);

      this.#swapChain = swapChain;
      this.#device = swapChain.getDevice();
    });

    hooks.resize.tap((width, height) => {
      this.#swapChain.configureSwapChain(width, height);
    });

    hooks.destroy.tap(() => {
      this.#device.destroy();
    });

    hooks.beginFrame.tap(() => {
      const { width, height } = canvas;

      const renderTarget = this.#device.createRenderTargetFromTexture(
        this.#device.createTexture({
          format: Format.U8_RGBA_RT,
          width,
          height,
          usage: TextureUsage.RENDER_TARGET,
        }),
      );
      const onscreenTexture = this.#swapChain.getOnscreenTexture();
      this.#device.beginFrame();

      this.#renderPass = this.#device.createRenderPass({
        colorAttachment: [renderTarget],
        colorResolveTo: [onscreenTexture],
        colorClearColor: [TransparentWhite],
      });
    });

    hooks.endFrame.tap(() => {
      this.#device.submitPass(this.#renderPass);
      this.#device.endFrame();
    });

    hooks.render.tap((shape) => {
      const program = this.#device.createProgram({
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

      const vertexBuffer = this.#device.createBuffer({
        viewOrSize: new Float32Array([0, 0.5, -0.5, -0.5, 0.5, -0.5]),
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });
      this.#device.setResourceName(vertexBuffer, 'a_Position');

      const inputLayout = this.#device.createInputLayout({
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

      const pipeline = this.#device.createRenderPipeline({
        inputLayout,
        program,
        colorAttachmentFormats: [Format.U8_RGBA_RT],
      });

      this.#renderPass.setPipeline(pipeline);
      this.#renderPass.setVertexInput(
        inputLayout,
        [
          {
            buffer: vertexBuffer,
          },
        ],
        null,
      );
      // this.#renderPass.setViewport(0, 0, $canvas.width, $canvas.height);
      this.#renderPass.draw(3);
    });
  }
}
