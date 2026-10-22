import init, {
  glsl_compile,
} from '../../../packages/device-api/src/vendor/glsl_wgsl_compiler';
import {
  WebGPUDeviceContribution,
  ClipSpaceNearZ,
  ViewportOrigin,
  preprocessProgram_GLSL,
} from '@infinite-canvas-tutorial/device-api';
import { vert, frag } from '../../../packages/ecs/src/shaders/mesh3d';

const source = `#version 440
void main() { gl_Position = vec4(0.0, 0.0, 0.0, 1.0); }`;

const harness = {
  async compile(path?: string) {
    await init(path);
    return glsl_compile(source, 'vertex', true);
  },
  async compileMesh() {
    await init();
    const program = preprocessProgram_GLSL(
      {
        platformString: 'WebGPU',
        glslVersion: '#version 440',
        explicitBindingLocations: true,
        separateSamplerTextures: true,
        viewportOrigin: ViewportOrigin.UPPER_LEFT,
        clipSpaceNearZ: ClipSpaceNearZ.ZERO,
        supportMRT: true,
      },
      vert,
      frag,
    );
    return [
      glsl_compile(program.preprocessedVert, 'vertex', true),
      glsl_compile(program.preprocessedFrag, 'fragment', true),
    ];
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
