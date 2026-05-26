import type {
  RaindropFxBackgroundWrapMode,
  RaindropFxComposeMode,
} from './utils/raindrop-sim/defaults';

/** GPU raindrop-fx render overrides stored on {@link RainEffect} (see ecs `RainFxGpuRenderer`). */
export interface RainFxRenderOptions {
  backgroundBlurSteps?: number;
  backgroundWrapMode?: RaindropFxBackgroundWrapMode;
  mist?: boolean;
  mistColor?: [number, number, number, number];
  mistTime?: number;
  mistBlurStep?: number;
  dropletsPerSecond?: number;
  dropletSize?: [number, number];
  smoothRaindrop?: [number, number];
  refractBase?: number;
  refractScale?: number;
  raindropCompose?: RaindropFxComposeMode;
  raindropEraserSize?: [number, number];
  raindropLightPos?: [number, number, number, number];
  raindropDiffuseLight?: [number, number, number];
  raindropShadowOffset?: number;
  raindropSpecularLight?: [number, number, number];
  raindropSpecularShininess?: number;
  raindropLightBump?: number;
  /** 1 = raindrop-fx original (clear compose RT each frame). */
  composeDecay?: number;
}
