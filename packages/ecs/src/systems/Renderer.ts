import * as d3 from 'd3-color';
import {
  BufferFrequencyHint,
  BufferUsage,
  Format,
  TextureUsage,
  TransparentBlack,
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@antv/g-device-api';
import type {
  SwapChain,
  DeviceContribution,
  Device,
  RenderPass,
  Buffer,
  RenderTarget,
} from '@antv/g-device-api';
import { Commands } from '../Commands';
import { AppConfig } from '../components/AppConfig';

export const RendererSystem = async ({ commands }: { commands: Commands }) => {
  const appConfig = commands.world.get(AppConfig);
  const { canvas, renderer, shaderCompilerPath } = appConfig;

  let deviceContribution: DeviceContribution;
  if (renderer === 'webgl') {
    deviceContribution = new WebGLDeviceContribution({
      targets: ['webgl2', 'webgl1'],
      antialias: true,
      shaderDebug: true,
      trackResources: false,
      onContextCreationError: () => {},
      onContextLost: () => {},
      onContextRestored(e) {},
    });
  } else {
    deviceContribution = new WebGPUDeviceContribution({
      shaderCompilerPath,
      onContextLost: () => {},
    });
  }

  const { width, height } = canvas;
  const swapChain = await deviceContribution.createSwapChain(
    canvas as HTMLCanvasElement,
  );
  swapChain.configureSwapChain(width, height);

  console.log('xx');
};
