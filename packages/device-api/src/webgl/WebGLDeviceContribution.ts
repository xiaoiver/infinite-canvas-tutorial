import { DeviceContribution } from '../api';
import { Device_GL } from './Device';

export interface WebGLRendererPluginOptions {
  targets: ('webgl1' | 'webgl2')[];
  xrCompatible: boolean;
  antialias: boolean;
  preserveDrawingBuffer: boolean;
  premultipliedAlpha: boolean;
  shaderDebug: boolean;
  trackResources: boolean;
  onContextCreationError: (e: Event) => void;
  onContextLost: (e: Event) => void;
  onContextRestored: (e: Event) => void;
}

export class WebGLDeviceContribution implements DeviceContribution {
  constructor(private pluginOptions: Partial<WebGLRendererPluginOptions>) {}

  async createSwapChain($canvas: HTMLCanvasElement) {
    const {
      targets,
      xrCompatible,
      antialias = false,
      preserveDrawingBuffer = false,
      premultipliedAlpha = true,
      shaderDebug,
      trackResources,
    } = this.pluginOptions;
    const options: WebGLContextAttributes & { xrCompatible: boolean } = {
      // alpha: true,
      antialias,
      // @see https://stackoverflow.com/questions/27746091/preservedrawingbuffer-false-is-it-worth-the-effort
      preserveDrawingBuffer,
      // @see https://webglfundamentals.org/webgl/lessons/webgl-qna-how-to-use-the-stencil-buffer.html
      stencil: true,
      // @see https://webglfundamentals.org/webgl/lessons/webgl-and-alpha.html
      premultipliedAlpha,
      xrCompatible,
    };
    this.handleContextEvents($canvas);

    let gl: WebGLRenderingContext | WebGL2RenderingContext;
    if (targets.includes('webgl2')) {
      gl =
        $canvas.getContext('webgl2', options) ||
        ($canvas.getContext(
          'experimental-webgl2',
          options,
        ) as WebGL2RenderingContext);
    }

    if (!gl && targets.includes('webgl1')) {
      gl =
        $canvas.getContext('webgl', options) ||
        ($canvas.getContext(
          'experimental-webgl',
          options,
        ) as WebGLRenderingContext);
    }

    return new Device_GL(gl as WebGLRenderingContext | WebGL2RenderingContext, {
      shaderDebug,
      trackResources,
    });
  }

  private handleContextEvents($canvas: HTMLCanvasElement) {
    const { onContextLost, onContextRestored, onContextCreationError } =
      this.pluginOptions;
    // bind context event listeners
    if (onContextCreationError) {
      // @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextcreationerror_event
      $canvas.addEventListener(
        'webglcontextcreationerror',
        onContextCreationError,
        false,
      );
    }
    if (onContextLost) {
      $canvas.addEventListener('webglcontextlost', onContextLost, false);
    }
    if (onContextRestored) {
      $canvas.addEventListener(
        'webglcontextrestored',
        onContextRestored,
        false,
      );
    }
  }
}
