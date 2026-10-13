import init, {
  glsl_compile,
} from '../../../packages/device-api/src/vendor/glsl_wgsl_compiler';
import { WebGPUDeviceContribution } from '@infinite-canvas-tutorial/device-api';

const source = `#version 440
void main() { gl_Position = vec4(0.0, 0.0, 0.0, 1.0); }`;

const harness = {
  async compile(path?: string) {
    await init(path);
    return glsl_compile(source, 'vertex', true);
  },
  async initializeDevice(path: string) {
    // Exercise compiler failure propagation without requiring a native GPU.
    // Initialization must reject before constructing any GPU render resources.
    const original = Object.getOwnPropertyDescriptor(navigator, 'gpu');
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: {
        requestAdapter: async () => ({
          features: new Set(),
          requestDevice: async () => ({ lost: new Promise(() => {}) }),
        }),
      },
    });
    try {
      const canvas = { getContext: () => ({}) } as unknown as HTMLCanvasElement;
      await new WebGPUDeviceContribution({
        shaderCompilerPath: path,
      }).createSwapChain(canvas);
    } finally {
      if (original) Object.defineProperty(navigator, 'gpu', original);
      else Reflect.deleteProperty(navigator, 'gpu');
    }
  },
};

declare global {
  interface Window {
    shaderCompilerRegression: typeof harness;
  }
}

window.shaderCompilerRegression = harness;
