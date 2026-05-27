/**
 * Raindrop-fx default constants for filter string protocol.
 * GPU simulator implementation lives in `@infinite-canvas-tutorial/filter`.
 */
import type {
  RaindropFxBackgroundWrapMode,
  RaindropFxComposeMode,
} from './effect-types';

export const RAINDROP_FX_SIM_DEFAULTS = {
  spawnInterval: [0.1, 0.1] as [number, number],
  spawnSize: [60, 100] as [number, number],
  spawnLimit: 2000,
  slipRate: 0,
  motionInterval: [0.1, 0.4] as [number, number],
  xShifting: [0, 0.1] as [number, number],
  colliderSize: 1,
  trailDropDensity: 0.2,
  trailDistance: [20, 30] as [number, number],
  trailDropSize: [0.3, 0.5] as [number, number],
  trailSpread: 0.6,
  initialSpread: 0.5,
  shrinkRate: 0.01,
  velocitySpread: 0.3,
  evaporate: 10,
  gravity: 2400,
} as const;

export const RAINDROP_FX_RENDER_DEFAULTS = {
  backgroundBlurSteps: 3,
  backgroundWrapMode: 'clamp' as RaindropFxBackgroundWrapMode,
  mist: true,
  mistColor: [0.01, 0.01, 0.01, 1] as [number, number, number, number],
  mistTime: 10,
  mistBlurStep: 4,
  dropletsPerSecond: 500,
  dropletSize: [10, 30] as [number, number],
  raindropCompose: 'smoother' as RaindropFxComposeMode,
  raindropEraserSize: [0.93, 1.0] as [number, number],
};

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
export const RAINDROP_FX_SIM_DT = 0.03;
export const RAINDROP_FX_COMPOSE_DECAY_DEFAULT = 1;
