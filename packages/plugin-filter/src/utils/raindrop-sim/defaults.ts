import type { SimulatorOptions } from './simulator';
import { Rect, Vec2 } from './math';

/** raindrop-fx default simulator options (viewport set per size). */
export const RAINDROP_FX_SIM_DEFAULTS: Omit<SimulatorOptions, 'viewport'> = {
  spawnInterval: [0.1, 0.1],
  spawnSize: [60, 100],
  spawnLimit: 2000,
  slipRate: 0,
  motionInterval: [0.1, 0.4],
  xShifting: [0, 0.1],
  colliderSize: 1,
  trailDropDensity: 0.2,
  trailDistance: [20, 30],
  trailDropSize: [0.3, 0.5],
  trailSpread: 0.6,
  initialSpread: 0.5,
  shrinkRate: 0.01,
  velocitySpread: 0.3,
  evaporate: 10,
  gravity: 2400,
};

/**
 * GPU render options — defaults from raindrop-fx `index.ts` (RaindropFX constructor).
 * @see https://github.com/SardineFish/raindrop-fx/blob/master/src/index.ts
 */
export type RaindropFxBackgroundWrapMode = 'clamp' | 'repeat' | 'mirror';

export const RAINDROP_FX_RENDER_DEFAULTS = {
  backgroundBlurSteps: 3,
  backgroundWrapMode: 'clamp' as RaindropFxBackgroundWrapMode,
  mist: true,
  mistColor: [0.01, 0.01, 0.01, 1] as [number, number, number, number],
  mistTime: 10,
  mistBlurStep: 4,
  dropletsPerSecond: 500,
  dropletSize: [10, 30] as [number, number],
  raindropCompose: 'smoother' as const,
  raindropEraserSize: [0.93, 1.0] as [number, number],
};

export type RaindropFxComposeMode = 'smoother' | 'harder';

export const RAINDROP_FX_COMPOSE_DEFAULTS = {
  smoothRaindrop: [0.96, 0.99] as [number, number],
  refractBase: 0.4,
  refractScale: 0.6,
  raindropLightPos: [-1, 1, 2, 0] as [number, number, number, number],
  raindropDiffuseLight: [0.2, 0.2, 0.2] as [number, number, number],
  raindropShadowOffset: 0.8,
  raindropSpecularLight: [0, 0, 0] as [number, number, number],
  raindropSpecularShininess: 256,
  raindropLightBump: 1,
};

export const RAIN_DROPDROP_TEXTURE_DEFAULT = '/raindrop.png';

/** raindrop-fx demo uses fixed sim dt (see raindrop-fx index.ts). */
export const RAINDROP_FX_SIM_DT = 0.03;

/** 1 = raindrop-fx original (clear raindrop compose RT each frame). */
export const RAINDROP_FX_COMPOSE_DECAY_DEFAULT = 1;

export function simulatorOptionsForViewport(
  width: number,
  height: number,
): SimulatorOptions {
  return {
    ...RAINDROP_FX_SIM_DEFAULTS,
    viewport: new Rect(Vec2.zero(), new Vec2(width, height)),
  };
}
