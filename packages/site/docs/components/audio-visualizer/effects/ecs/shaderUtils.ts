/**
 * Bridges {@link @infinite-canvas-tutorial/device-api} (ECS canvas) with shader helpers
 * typed against `@antv/g-device-api` in `../utils.ts` (same runtime layout).
 */
import type {
  Device,
  ProgramDescriptor,
  Texture,
} from '@infinite-canvas-tutorial/device-api';
import {
  camera,
  createBlitPipelineAndBindings as gCreateBlit,
  createProgram as gCreateProgram,
  math,
  prelude,
  registerShaderModule as gRegisterShaderModule,
} from '../utils';

export { prelude, math, camera };

export function registerShaderModule(device: Device, shader: string): string {
  return gRegisterShaderModule(device as never, shader);
}

export function createProgram(
  device: Device,
  desc: ProgramDescriptor,
  defines?: Record<string, boolean | number>,
) {
  return gCreateProgram(device as never, desc as never, defines);
}

export function createBlitPipelineAndBindings(device: Device, screen: Texture) {
  return gCreateBlit(device as never, screen as never);
}
