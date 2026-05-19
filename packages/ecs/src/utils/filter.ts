/**
 * CSS Filter / Effect
 */
import type { Entity } from '@lastolivegames/becsy';
import {
  Children,
  Circle,
  Ellipse,
  Filter,
  IconFont,
  Line,
  Path,
  Polyline,
  Rough,
  Stroke,
} from '../components';
import { cssColorToHex, parseColor } from './color';
import { hasValidStroke } from './style';
import { getPostEffectEngineTimeSeconds } from './postEffectEngineTime';
import { getFirstGradientStrokeLayerValue } from './strokeLayers';
import {
  RAIN_DROPDROP_TEXTURE_DEFAULT,
  RAINDROP_FX_COMPOSE_DECAY_DEFAULT,
  RAINDROP_FX_COMPOSE_DEFAULTS,
  RAINDROP_FX_RENDER_DEFAULTS,
  RAINDROP_FX_SIM_DEFAULTS,
  simulatorOptionsForViewport,
  type RaindropFxBackgroundWrapMode,
  type RaindropFxComposeMode,
} from './raindrop-sim/defaults';
import type { SimulatorOptions } from './raindrop-sim/simulator';
import type { RainFxRenderOptions } from './rain-fx/rain-fx-gpu-renderer';

export {
  RAIN_DROPDROP_TEXTURE_DEFAULT,
  RAINDROP_FX_RENDER_DEFAULTS,
  RAINDROP_FX_COMPOSE_DEFAULTS,
  RAINDROP_FX_COMPOSE_DECAY_DEFAULT,
  RAINDROP_FX_SIM_DEFAULTS,
  RAINDROP_FX_SIM_DT,
  type RaindropFxBackgroundWrapMode,
  type RaindropFxComposeMode,
} from './raindrop-sim/defaults';

/** GPU raindrop-fx render overrides stored on {@link RainEffect}. */
export type RainFxParams = RainFxRenderOptions;

/** raindrop-fx simulator overrides ({@link RAINDROP_FX_SIM_DEFAULTS} when omitted). */
export type RainFxSimParams = Partial<
  Pick<
    SimulatorOptions,
    | 'spawnInterval'
    | 'spawnSize'
    | 'motionInterval'
    | 'trailDistance'
    | 'gravity'
    | 'spawnLimit'
    | 'trailDropDensity'
    | 'trailSpread'
    | 'xShifting'
    | 'slipRate'
  >
>;

export function rainFxRenderOptionsFromEffect(
  effect: RainEffect,
): RainFxRenderOptions {
  return effect.rainFx ? { ...effect.rainFx } : {};
}

/** Full {@link RaindropSimulator} options for a raindrop-fx {@link RainEffect}. */
export function raindropSimulatorOptionsForEffect(
  effect: RainEffect,
  width: number,
  height: number,
): SimulatorOptions {
  const base = simulatorOptionsForViewport(width, height);
  const s = effect.rainFxSim;
  if (!s) {
    return base;
  }
  const D = RAINDROP_FX_SIM_DEFAULTS;
  const z = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;
  return {
    ...base,
    spawnInterval: s.spawnInterval ?? base.spawnInterval,
    spawnSize: s.spawnSize ?? base.spawnSize,
    motionInterval: s.motionInterval ?? base.motionInterval,
    trailDistance: s.trailDistance ?? base.trailDistance,
    gravity: z(s.gravity, D.gravity),
    spawnLimit: Math.max(1, Math.round(z(s.spawnLimit, D.spawnLimit))),
    trailDropDensity: z(s.trailDropDensity, D.trailDropDensity),
    trailSpread: z(s.trailSpread, D.trailSpread),
    xShifting: s.xShifting ?? base.xShifting,
    slipRate: Math.max(0, Math.min(1, z(s.slipRate, D.slipRate))),
  };
}

export interface FilterObject {
  name: string;
  params: string;
}

export type Effect =
  | BrightnessEffect
  | ContrastEffect
  | HueSaturationEffect
  | PixelateEffect
  | DotEffect
  | ColorHalftoneEffect
  | HalftoneDotsEffect
  | FlutedGlassEffect
  | TsunamiEffect
  | RainEffect
  | BurnEffect
  | CrtEffect
  | VignetteEffect
  | AsciiEffect
  | GlitchEffect
  | LiquidGlassEffect
  | LiquidMetalEffect
  | HeatmapEffect
  | GemSmokeEffect
  | LutEffect
  | AdjustmentEffect
  | DropShadowEffect
  | BlurEffect
  | NoiseEffect
  | FXAA;

/** Defaults aligned with Pixi {@link https://github.com/pixijs/filters/blob/main/src/adjustment/AdjustmentFilter.ts AdjustmentFilter}. */
export const ADJUSTMENT_DEFAULTS = {
  gamma: 1,
  contrast: 1,
  saturation: 1,
  brightness: 1,
  red: 1,
  green: 1,
  blue: 1,
  alpha: 1,
} as const;

export interface AdjustmentEffect {
  type: 'adjustment';
  gamma: number;
  contrast: number;
  saturation: number;
  brightness: number;
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

/** `value`: glfx-style offset in [-1, 1]; 0 = no change (matches filter string number, not CSS `brightness()` multiplier). */
export interface BrightnessEffect {
  type: 'brightness';
  value: number;
}

/** `value`: glfx-style offset in [-1, 1]; 0 = no change. */
export interface ContrastEffect {
  type: 'contrast';
  value: number;
}

/**
 * glfx hue/saturation pass ({@link https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/huesaturation.js huesaturation}).
 * `hue` ∈ [-1, 1] (±1 = ±180°), `saturation` ∈ [-1, 1] (glfx semantics; CPU clamps positive branch away from 1).
 */
export interface HueSaturationEffect {
  type: 'hueSaturation';
  hue: number;
  saturation: number;
}

/**
 * Block size in pixels (square), same semantics as Pixi {@link https://github.com/pixijs/filters/blob/main/src/pixelate/pixelate.frag pixelate} `uSize`.
 */
export interface PixelateEffect {
  type: 'pixelate';
  size: number;
}

/**
 * Pixi {@link https://github.com/pixijs/filters/blob/main/src/dot/dot.frag Dot} screen (defaults: scale 1, angle 5 rad, grayscale on).
 */
export interface DotEffect {
  type: 'dot';
  scale: number;
  angle: number;
  /** 1 = grayscale halftone, 0 = color */
  grayscale: number;
}

/**
 * glfx {@link https://github.com/evanw/glfx.js/blob/master/src/filters/fun/colorhalftone.js colorHalftone}.
 * `angle` in radians; `size` = dot diameter in pixels (`scale = π / size` on GPU).
 * Omit `centerX` / `centerY` to use texture center at upload time.
 */
export interface ColorHalftoneEffect {
  type: 'colorHalftone';
  centerX?: number;
  centerY?: number;
  angle: number;
  size: number;
}

/**
 * paper-design {@link https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/halftone-dots.ts halftone-dots}
 * (minimal: no sizing transform in vertex).
 */
export interface HalftoneDotsEffect {
  type: 'halftoneDots';
  /** Grid density 0–1 (`u_size`). */
  size: number;
  /** Max dot size vs cell 0–2 (`u_radius`). */
  radius: number;
  /** Luminance contrast 0–1 (`u_contrast`). */
  contrast: number;
  /** 0 = square, 1 = hex. */
  grid: number;
  /** 0 classic, 1 gooey, 2 holes, 3 soft. */
  dotStyle: number;
  /**
   * When true (default), dot color comes from sampled image; when false, uses foreground/background colors (`u_H3`/`u_H4`).
   */
  originalColors?: boolean;
}

/** Defaults for {@link HalftoneDotsEffect} / `halftone-dots()` when params are omitted. */
export const HALFTONE_DOTS_DEFAULTS = {
  size: 0.5,
  radius: 0.5,
  contrast: 0.5,
  grid: 0,
  dotStyle: 0,
  originalColors: true,
} as const;

/** Uniform packing for {@link HalftoneDotsEffect} (5 × vec4, std140). */
export function halftoneDotsUniformValues(
  effect: HalftoneDotsEffect,
  textureWidth: number,
  textureHeight: number,
): number[] {
  const tw = Math.max(1, textureWidth);
  const th = Math.max(1, textureHeight);
  const d = HALFTONE_DOTS_DEFAULTS;
  let size = Number.isFinite(effect.size) ? effect.size : d.size;
  size = Math.max(0, Math.min(1, size));
  let radius = Number.isFinite(effect.radius) ? effect.radius : d.radius;
  radius = Math.max(0, Math.min(2, radius));
  let contrast = Number.isFinite(effect.contrast) ? effect.contrast : d.contrast;
  contrast = Math.max(0, Math.min(1, contrast));
  let grid = Number.isFinite(effect.grid) ? effect.grid : d.grid;
  grid = grid > 0.5 ? 1 : 0;
  let dotStyle = Number.isFinite(effect.dotStyle) ? effect.dotStyle : d.dotStyle;
  dotStyle = Math.max(0, Math.min(3, Math.floor(dotStyle)));
  const aspect = tw / th;
  const originalColors = effect.originalColors === false ? 0 : 1;
  return [
    size,
    radius,
    contrast,
    aspect,
    grid,
    dotStyle,
    originalColors,
    0,
    0,
    0,
    0.5,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
  ];
}

/** Defaults for {@link FlutedGlassEffect} (paper-design ranges). */
export const FLUTED_GLASS_DEFAULTS = {
  size: 0.5,
  shadows: 0.6,
  angle: 45,
  stretch: 0.2,
  shape: 1,
  distortion: 0.5,
  highlights: 0.4,
  distortionShape: 1,
  shift: 0,
  blur: 0.15,
  edges: 0.3,
  marginLeft: 0,
  marginRight: 0,
  marginTop: 0,
  marginBottom: 0,
  grainMixer: 0,
  grainOverlay: 0,
} as const;

/**
 * paper-design {@link https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/fluted-glass.ts fluted-glass}
 * (post-process: `v_Uv`, no vertex sizing).
 */
export interface FlutedGlassEffect {
  type: 'flutedGlass';
  size: number;
  shadows: number;
  angle: number;
  stretch: number;
  /** 1 lines … 5 pattern ({@link GlassGridShapes}). */
  shape: number;
  distortion: number;
  highlights: number;
  /** 1 prism … 5 flat ({@link GlassDistortionShapes}). */
  distortionShape: number;
  shift: number;
  blur: number;
  edges: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  grainMixer: number;
  grainOverlay: number;
}

export const GlassGridShapes = {
  lines: 1,
  linesIrregular: 2,
  wave: 3,
  zigzag: 4,
  pattern: 5,
} as const;

export const GlassDistortionShapes = {
  prism: 1,
  lens: 2,
  contour: 3,
  cascade: 4,
  flat: 5,
} as const;

/** 9 × vec4 std140 → 36 floats (`u_FG0`…`u_FG8`). */
export function flutedGlassUniformValues(
  effect: FlutedGlassEffect,
  textureWidth: number,
  textureHeight: number,
): number[] {
  const tw = Math.max(1, textureWidth);
  const th = Math.max(1, textureHeight);
  const d = FLUTED_GLASS_DEFAULTS;
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const z = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;

  const size = clamp01(z(effect.size, d.size));
  const shadows = clamp01(z(effect.shadows, d.shadows));
  let angle = z(effect.angle, d.angle);
  angle = Math.max(0, Math.min(180, angle));
  const stretch = clamp01(z(effect.stretch, d.stretch));
  let shape = Math.round(z(effect.shape, d.shape));
  shape = Math.max(1, Math.min(5, shape));
  const distortion = clamp01(z(effect.distortion, d.distortion));
  const highlights = clamp01(z(effect.highlights, d.highlights));
  let distortionShape = Math.round(z(effect.distortionShape, d.distortionShape));
  distortionShape = Math.max(1, Math.min(5, distortionShape));
  let shift = z(effect.shift, d.shift);
  shift = Math.max(-1, Math.min(1, shift));
  const blur = clamp01(z(effect.blur, d.blur));
  const edges = clamp01(z(effect.edges, d.edges));
  const marginLeft = clamp01(z(effect.marginLeft, d.marginLeft));
  const marginRight = clamp01(z(effect.marginRight, d.marginRight));
  const marginTop = clamp01(z(effect.marginTop, d.marginTop));
  const marginBottom = clamp01(z(effect.marginBottom, d.marginBottom));
  const grainMixer = clamp01(z(effect.grainMixer, d.grainMixer));
  const grainOverlay = clamp01(z(effect.grainOverlay, d.grainOverlay));

  const aspect = tw / th;
  const pixelRatio = 1;

  const colorBack: [number, number, number, number] = [1, 1, 1, 1];
  const colorShadow: [number, number, number, number] = [0.15, 0.15, 0.18, 1];
  const colorHighlight: [number, number, number, number] = [0.92, 0.92, 0.96, 1];

  return [
    tw,
    th,
    pixelRatio,
    aspect,
    ...colorBack,
    ...colorShadow,
    ...colorHighlight,
    size,
    shadows,
    angle,
    stretch,
    shape,
    distortion,
    highlights,
    distortionShape,
    shift,
    blur,
    edges,
    grainMixer,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    grainOverlay,
    0,
    0,
    0,
  ];
}

/** Defaults for {@link TsunamiEffect} (ribbed refraction pass). */
export const TSUNAMI_DEFAULTS = {
  stripeCount: 45,
  /** Degrees; converted to radians for the GPU. */
  stripeAngle: 0,
  distortion: 0.32,
  reflection: 0.17,
  disturbance: 0.03,
  contortion: 0.13,
  /** 0/1 — modulate highlight with luminance when 1. */
  blend: 0,
  dispersion: 0.22,
  drift: 0,
  shadowIntensity: 0.5,
  offset: 0,
} as const;

/**
 * Tsunami ribbed-glass style post-process (stripes + refraction + optional RGB split).
 * 4 × vec4 std140 → `u_TS0`…`u_TS3` (16 floats).
 */
export interface TsunamiEffect {
  type: 'tsunami';
  stripeCount: number;
  stripeAngle: number;
  distortion: number;
  reflection: number;
  disturbance: number;
  contortion: number;
  blend: number;
  dispersion: number;
  drift: number;
  shadowIntensity: number;
  offset: number;
}

export function tsunamiUniformValues(
  effect: TsunamiEffect,
  textureWidth: number,
  textureHeight: number,
): number[] {
  const tw = Math.max(1, textureWidth);
  const th = Math.max(1, textureHeight);
  const D = TSUNAMI_DEFAULTS;
  const z = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;

  let stripeCount = z(effect.stripeCount, D.stripeCount);
  stripeCount = Math.max(1, Math.min(256, stripeCount));
  let stripeAngleDeg = z(effect.stripeAngle, D.stripeAngle);
  stripeAngleDeg = Math.max(-180, Math.min(180, stripeAngleDeg));
  const stripeAngleRad = (stripeAngleDeg * Math.PI) / 180;

  const distortion = Math.max(0, z(effect.distortion, D.distortion));
  const reflection = Math.max(0, z(effect.reflection, D.reflection));
  const disturbance = Math.max(0, Math.min(1, z(effect.disturbance, D.disturbance)));
  const contortion = Math.max(0, z(effect.contortion, D.contortion));
  const blend = z(effect.blend, D.blend) > 0.5 ? 1 : 0;
  const dispersion = Math.max(0, z(effect.dispersion, D.dispersion));
  const drift = Math.max(-1, Math.min(1, z(effect.drift, D.drift)));
  const shadowIntensity = Math.max(0, z(effect.shadowIntensity, D.shadowIntensity));
  const offset = z(effect.offset, D.offset);

  return [
    tw,
    th,
    stripeCount,
    stripeAngleRad,
    distortion,
    reflection,
    disturbance,
    contortion,
    blend,
    dispersion,
    drift,
    shadowIntensity,
    offset,
    0,
    0,
    0,
  ];
}

/** Defaults for procedural `rain()` (no `url()` drop textures). */
export const RAIN_DEFAULTS = {
  minRefraction: 2.5,
  refractionDelta: 6.5,
  brightness: 1,
  density: 1,
  alphaMultiply: 1.15,
  alphaSubtract: 0.12,
  streakCount: 80,
  dropScale: 1,
  renderShadow: true,
  renderShine: false,
} as const;

/**
 * Codrops {@link https://github.com/codrops/RainEffect/blob/master/src/rain-renderer.js rain-renderer.js} /
 * {@link https://github.com/codrops/RainEffect/blob/master/src/shaders/water.frag water.frag} defaults
 * (when {@link RainEffect.dropColorUrl} + {@link RainEffect.dropAlphaUrl} drive {@link RaindropsCodropsSimulator}).
 */
export const RAINDROPS_WATER_DEFAULTS = {
  minRefraction: 256,
  maxRefraction: 512,
  brightness: 1,
  alphaMultiply: 20,
  alphaSubtract: 5,
  renderShadow: false,
  renderShine: true,
} as const;

/** Default Codrops drop sprite URLs (webcomponents examples serve these at `/`). */
export const RAIN_DROP_TEXTURE_DEFAULTS = {
  dropColorUrl: '/drop-color.png',
  dropAlphaUrl: '/drop-alpha.png',
  dropShineUrl: '/drop-shine.png',
} as const;

export type RainCodropsWaterParams = {
  minRefraction?: number;
  maxRefraction?: number;
  brightness?: number;
  alphaMultiply?: number;
  alphaSubtract?: number;
  renderShadow?: boolean;
  renderShine?: boolean;
};

/** Defaults for {@link RaindropsCodropsSimulator} spawn density (Codrops `raindrops.js`). */
export const RAINDROPS_SIM_DEFAULTS = {
  rainChance: 0.3,
  rainLimit: 3,
  maxDrops: 900,
  dropletsRate: 50,
} as const;

export type RainCodropsSimParams = {
  rainChance?: number;
  rainLimit?: number;
  maxDrops?: number;
  dropletsRate?: number;
};

/**
 * Default {@link RainEffect}: Codrops path with {@link RAIN_DROP_TEXTURE_DEFAULTS}.  
 * Bare `rain()` parses/formats to this. Numeric-only `rain(…)` stays procedural.
 */
export function createDefaultRainEffect(): RainEffect {
  return {
    type: 'rain',
    dropTextureUrl: RAIN_DROPDROP_TEXTURE_DEFAULT,
  };
}

/** raindrop-fx path: `rain()` or `rain(url("sprite.png"))`. */
export function isRainFxEffect(
  e: Effect,
): e is RainEffect & { dropTextureUrl: string } {
  if (e.type !== 'rain') {
    return false;
  }
  const u = (e as RainEffect).dropTextureUrl?.trim() ?? '';
  return u.length > 0;
}

function isDefaultRainCodropsEffect(e: RainEffect): boolean {
  if (!isRainCodropsRainEffect(e)) {
    return false;
  }
  const d = RAIN_DROP_TEXTURE_DEFAULTS;
  if (
    e.dropColorUrl !== d.dropColorUrl ||
    e.dropAlphaUrl !== d.dropAlphaUrl ||
    (e.dropShineUrl?.trim() ?? '') !== d.dropShineUrl
  ) {
    return false;
  }
  if ((e.rainSimScale ?? 1) !== 1) {
    return false;
  }
  const W = { ...RAINDROPS_WATER_DEFAULTS, ...e.codropsWater };
  const WD = RAINDROPS_WATER_DEFAULTS;
  if (
    W.minRefraction !== WD.minRefraction ||
    W.maxRefraction !== WD.maxRefraction ||
    W.brightness !== WD.brightness ||
    W.alphaMultiply !== WD.alphaMultiply ||
    W.alphaSubtract !== WD.alphaSubtract ||
    (W.renderShadow ?? WD.renderShadow) !== WD.renderShadow ||
    (W.renderShine ?? WD.renderShine) !== WD.renderShine
  ) {
    return false;
  }
  const S = { ...RAINDROPS_SIM_DEFAULTS, ...e.codropsSim };
  const SD = RAINDROPS_SIM_DEFAULTS;
  return (
    S.rainChance === SD.rainChance &&
    S.rainLimit === SD.rainLimit &&
    S.maxDrops === SD.maxDrops &&
    S.dropletsRate === SD.dropletsRate
  );
}

/**
 * `rain()` / `rain(url("…"))` → raindrop-fx sim + compose (default sprite `/raindrop.png`).  
 * `rain(url(color), url(alpha), …)` → legacy Codrops path.
 */
export interface RainEffect {
  type: 'rain';
  /** raindrop-fx style drop normal map (single sprite). Default {@link RAIN_DROPDROP_TEXTURE_DEFAULT}. */
  dropTextureUrl?: string;
  /** raindrop-fx GPU pass overrides ({@link RAINDROP_FX_RENDER_DEFAULTS} / compose defaults when omitted). */
  rainFx?: RainFxParams;
  /** raindrop-fx {@link RaindropSimulator} overrides ({@link RAINDROP_FX_SIM_DEFAULTS} when omitted). */
  rainFxSim?: RainFxSimParams;
  /** When both URLs are set, {@link RaindropsCodropsSimulator} + {@link rainCodropsWater} shader. */
  dropColorUrl?: string;
  dropAlphaUrl?: string;
  /** Codrops `u_textureShine` (optional third `url("…")` in filter string). */
  dropShineUrl?: string;
  /** Passed to {@link RaindropsCodropsSimulator} constructor `scale` (default `1`). */
  rainSimScale?: number;
  /** Overrides {@link RaindropsCodropsSimulator} spawn density (see {@link RAINDROPS_SIM_DEFAULTS}). */
  codropsSim?: RainCodropsSimParams;
  /** Overrides {@link RAINDROPS_WATER_DEFAULTS} for the water pass. */
  codropsWater?: RainCodropsWaterParams;
  /** Legacy procedural rain (unused when raindrop-fx or Codrops path is active). */
  minRefraction?: number;
  refractionDelta?: number;
  brightness?: number;
  density?: number;
  alphaMultiply?: number;
  alphaSubtract?: number;
  streakCount?: number;
  dropScale?: number;
  renderShadow?: boolean;
  renderShine?: boolean;
}

/** Options for {@link RaindropsCodropsSimulator} from a {@link RainEffect} (Codrops path only). */
export function raindropsSimulatorOptionsForEffect(
  effect: RainEffect,
): Pick<
  import('./raindrops-codrops/raindrops-simulator').RaindropsCodropsOptions,
  'rainChance' | 'rainLimit' | 'maxDrops' | 'dropletsRate'
> {
  const D = RAINDROPS_SIM_DEFAULTS;
  const s = effect.codropsSim ?? {};
  const z = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;
  return {
    rainChance: Math.max(0, Math.min(1, z(s.rainChance, D.rainChance))),
    rainLimit: Math.max(0, z(s.rainLimit, D.rainLimit)),
    maxDrops: Math.max(1, Math.round(z(s.maxDrops, D.maxDrops))),
    dropletsRate: Math.max(0, z(s.dropletsRate, D.dropletsRate)),
  };
}

function parseCodropsRainNumericTail(parts: string[]): {
  codropsWater: RainCodropsWaterParams;
  codropsSim?: RainCodropsSimParams;
  rainSimScale: number;
} {
  const WD = RAINDROPS_WATER_DEFAULTS;
  const SD = RAINDROPS_SIM_DEFAULTS;
  const pf = (i: number, def: number) => {
    const v = parts[i] !== undefined ? parseFloat(parts[i]) : def;
    return Number.isFinite(v) ? v : def;
  };
  const n = parts.length;
  /** Legacy: parallax at 5–8, shadow 9, shine 10, sim 11. New (n≥11): shadow 5, shine 6, sim 7, density 8–10 (+ droplets 11 when n=12). */
  const legacyParallaxLayout =
    n >= 12 && !(n === 12 && parseFloat(parts[10] ?? '0') > 10);
  const hasDensityTail = n >= 11 && !legacyParallaxLayout;
  let tailShadowIdx: number;
  let simScaleIdx: number;
  if (legacyParallaxLayout) {
    tailShadowIdx = 9;
    simScaleIdx = 11;
  } else if (hasDensityTail) {
    tailShadowIdx = 5;
    simScaleIdx = 7;
  } else {
    tailShadowIdx = n >= 10 ? 7 : 5;
    simScaleIdx = tailShadowIdx + 2;
  }
  const codropsWater: RainCodropsWaterParams = {
    minRefraction: pf(0, WD.minRefraction),
    maxRefraction: pf(1, WD.maxRefraction),
    brightness: pf(2, WD.brightness),
    alphaMultiply: pf(3, WD.alphaMultiply),
    alphaSubtract: pf(4, WD.alphaSubtract),
    renderShadow: pf(tailShadowIdx, WD.renderShadow ? 1 : 0) > 0.5,
    renderShine: pf(tailShadowIdx + 1, WD.renderShine ? 1 : 0) > 0.5,
  };
  const codropsSim: RainCodropsSimParams | undefined = hasDensityTail
    ? {
      rainChance: pf(8, SD.rainChance),
      rainLimit: pf(9, SD.rainLimit),
      maxDrops: pf(10, SD.maxDrops),
      ...(parts[11] !== undefined
        ? { dropletsRate: pf(11, SD.dropletsRate) }
        : {}),
    }
    : undefined;
  return {
    codropsWater,
    codropsSim,
    rainSimScale: pf(simScaleIdx, 1),
  };
}

export function isRainCodropsRainEffect(
  e: Effect,
): e is RainEffect & { dropColorUrl: string; dropAlphaUrl: string } {
  if (e.type !== 'rain' || isRainFxEffect(e)) {
    return false;
  }
  const c = (e as RainEffect).dropColorUrl?.trim() ?? '';
  const a = (e as RainEffect).dropAlphaUrl?.trim() ?? '';
  return c.length > 0 && a.length > 0;
}

/** Drop sprite URLs in filter strings (raindrop-fx + Codrops) for export preload. */
export function collectRainDropTextureUrlsFromFilterValue(
  filterValue: string | undefined | null,
): string[] {
  if (filterValue == null || !String(filterValue).trim()) {
    return [];
  }
  const urls: string[] = [];
  for (const e of parseEffect(filterValue)) {
    if (e.type !== 'rain') {
      continue;
    }
    if (isRainFxEffect(e)) {
      urls.push(e.dropTextureUrl.trim());
      continue;
    }
    if (!isRainCodropsRainEffect(e)) {
      continue;
    }
    urls.push(e.dropColorUrl.trim(), e.dropAlphaUrl.trim());
    const shine = e.dropShineUrl?.trim();
    if (shine) {
      urls.push(shine);
    }
  }
  return urls;
}

/** @deprecated Use {@link collectRainDropTextureUrlsFromFilterValue} */
export const collectRainCodropsDropTextureUrlsFromFilterValue =
  collectRainDropTextureUrlsFromFilterValue;

export function raindropComposeUniformValues(_effect: RainEffect): number[] {
  const C = RAINDROP_FX_COMPOSE_DEFAULTS;
  const smooth = C.smoothRaindrop;
  const refractBase = C.refractBase;
  const refractScale = C.refractScale;
  const lightPos = C.raindropLightPos;
  const diffuse = C.raindropDiffuseLight;
  const shadow = C.raindropShadowOffset;
  const spec = C.raindropSpecularLight;
  const shininess = C.raindropSpecularShininess;
  return [
    smooth[0],
    smooth[1],
    refractBase,
    refractScale,
    lightPos[0],
    lightPos[1],
    lightPos[2],
    lightPos[3],
    diffuse[0],
    diffuse[1],
    diffuse[2],
    shadow,
    spec[0],
    spec[1],
    spec[2],
    shininess,
  ];
}

export function rainCodropsWaterUniformValues(
  effect: RainEffect,
  textureWidth: number,
  textureHeight: number,
): number[] {
  const tw = Math.max(1, textureWidth);
  const th = Math.max(1, textureHeight);
  const D = RAINDROPS_WATER_DEFAULTS;
  const w = { ...D, ...effect.codropsWater };
  const z = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;
  const ratio = tw / Math.max(th, 1);
  const minRef = Math.max(0, z(w.minRefraction, D.minRefraction));
  const maxRef = Math.max(minRef, z(w.maxRefraction, D.maxRefraction));
  const refDelta = maxRef - minRef;
  const brightness = Math.max(0, z(w.brightness, D.brightness));
  const alphaMul = Math.max(0, z(w.alphaMultiply, D.alphaMultiply));
  const alphaSub = z(w.alphaSubtract, D.alphaSubtract);
  const renderShadow = (w.renderShadow ?? D.renderShadow) ? 1 : 0;
  const renderShine = (w.renderShine ?? D.renderShine) ? 1 : 0;
  const hasShineTexture = (effect.dropShineUrl?.trim().length ?? 0) > 0 ? 1 : 0;
  return [
    tw,
    th,
    ratio,
    0,
    0,
    0,
    0,
    0,
    minRef,
    refDelta,
    brightness,
    alphaMul,
    alphaSub,
    renderShadow,
    renderShine,
    hasShineTexture,
  ];
}

export function rainUniformValues(
  effect: RainEffect,
  textureWidth: number,
  textureHeight: number,
): number[] {
  if (isRainFxEffect(effect)) {
    return raindropComposeUniformValues(effect);
  }
  if (isRainCodropsRainEffect(effect)) {
    return rainCodropsWaterUniformValues(effect, textureWidth, textureHeight);
  }
  const tw = Math.max(1, textureWidth);
  const th = Math.max(1, textureHeight);
  const D = RAIN_DEFAULTS;
  const z = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;

  const time = getPostEffectEngineTimeSeconds();

  let minRef = z(effect.minRefraction, D.minRefraction);
  minRef = Math.max(0, minRef);
  let refDelta = z(effect.refractionDelta, D.refractionDelta);
  refDelta = Math.max(0, refDelta);
  const brightness = Math.max(0, z(effect.brightness, D.brightness));
  const density = Math.max(0.05, z(effect.density, D.density));
  const alphaMul = Math.max(0, z(effect.alphaMultiply, D.alphaMultiply));
  const alphaSub = z(effect.alphaSubtract, D.alphaSubtract);
  let streakCount = z(effect.streakCount, D.streakCount);
  streakCount = Math.max(8, Math.min(256, streakCount));
  const dropScale = Math.max(0.1, z(effect.dropScale, D.dropScale));
  const renderShadow = effect.renderShadow !== false ? 1 : 0;
  const renderShine = effect.renderShine === true ? 1 : 0;

  return [
    tw,
    th,
    time,
    0,
    minRef,
    refDelta,
    brightness,
    density,
    alphaMul,
    alphaSub,
    streakCount,
    dropScale,
    0,
    0,
    renderShadow,
    renderShine,
  ];
}

/** Defaults for {@link BurnEffect} (radial burn + optional wave distortion + dispersion). */
export const BURN_DEFAULTS = {
  burn: 0.5,
  density: 1,
  softness: 0.2,
  /** Chromatic edge strength in the burn pass (GPU scales internally). */
  dispersion: 0.1,
  /** First-pass style UV wave amount (0 = off). */
  distortion: 0.3,
  edgeColor: '#ff6600',
  maskColor: '#ffffff',
  invertMask: false,
  transparent: false,
} as const;

/**
 * Single-pass burn with optional pre-warp. 4 × vec4 std140 → `u_BR0`…`u_BR3` (16 floats).
 */
export interface BurnEffect {
  type: 'burn';
  burn: number;
  density: number;
  softness: number;
  dispersion: number;
  distortion: number;
  edgeColor: string;
  maskColor: string;
  invertMask: boolean;
  transparent: boolean;
}

export function burnUniformValues(
  effect: BurnEffect,
  _textureWidth: number,
  _textureHeight: number,
): number[] {
  const D = BURN_DEFAULTS;
  const z = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;

  const burn = Math.max(0, Math.min(1, z(effect.burn, D.burn)));
  const density = Math.max(0.01, z(effect.density, D.density));
  const softness = Math.max(0, z(effect.softness, D.softness));
  const dispersion = Math.max(0, z(effect.dispersion, D.dispersion));
  const distortion = z(effect.distortion, D.distortion);

  const e = parseColor(effect.edgeColor?.trim() ? effect.edgeColor : D.edgeColor);
  const m = parseColor(effect.maskColor?.trim() ? effect.maskColor : D.maskColor);

  return [
    burn,
    density,
    softness,
    dispersion,
    distortion,
    effect.invertMask ? 1 : 0,
    effect.transparent ? 1 : 0,
    0,
    e.r / 255,
    e.g / 255,
    e.b / 255,
    e.opacity,
    m.r / 255,
    m.g / 255,
    m.b / 255,
    m.opacity,
  ];
}

/** CRT filter defaults (no vignette — use {@link VignetteEffect} / `vignette()`). */
export const CRT_DEFAULTS = {
  curvature: 1,
  lineWidth: 1,
  lineContrast: 0.25,
  verticalLine: 0,
  time: 0,
} as const;

/**
 * CRT-style scanlines only (see {@link crtUniformValues} / post-processing `crt` shader).
 */
export interface CrtEffect {
  type: 'crt';
  curvature: number;
  lineWidth: number;
  lineContrast: number;
  /** 0 = horizontal scanlines, 1 = vertical */
  verticalLine: number;
  /** Animates scanlines when changed over time (ignored when {@link useEngineTime} is true) */
  time: number;
  /** When true, GPU uses the global frame clock from `PostEffectTime` instead of `time`. */
  useEngineTime?: boolean;
}

/** Defaults for {@link VignetteEffect} / `vignette(size, amount)`. */
export const VIGNETTE_DEFAULTS = {
  size: 0.5,
  amount: 0.5,
} as const;

/**
 * Radial lens vignette (`smoothstep` on UV distance), separate pass from CRT.
 */
export interface VignetteEffect {
  type: 'vignette';
  /** 0 = center of frame, 1 = edge */
  size: number;
  /** 0 = no darkening, 1 = max */
  amount: number;
}

/** 3 × vec4 (`u_CRT0`…`u_CRT2`), std140. */
export function crtUniformValues(
  effect: CrtEffect,
  textureWidth: number,
  textureHeight: number,
): number[] {
  const w = Math.max(1, textureWidth);
  const h = Math.max(1, textureHeight);
  const D = CRT_DEFAULTS;
  const z = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;

  const curvature = z(effect.curvature, D.curvature);
  const lineWidth = Math.max(0, z(effect.lineWidth, D.lineWidth));
  const lineContrast = z(effect.lineContrast, D.lineContrast);
  const verticalLine = z(effect.verticalLine, D.verticalLine) > 0.5 ? 1 : 0;
  const time = effect.useEngineTime
    ? getPostEffectEngineTimeSeconds()
    : z(effect.time, D.time);

  return [
    curvature,
    lineWidth,
    lineContrast,
    verticalLine,
    0,
    0,
    0,
    time,
    w,
    h,
    w,
    h,
  ];
}

/** `u_Vignette`: vec4(size, amount, 0, 0), std140. */
export function vignetteUniformValues(effect: VignetteEffect): number[] {
  const D = VIGNETTE_DEFAULTS;
  const z = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;
  const size = Math.max(0, Math.min(1, z(effect.size, D.size)));
  const amount = Math.max(0, Math.min(1, z(effect.amount, D.amount)));
  return [size, amount, 0, 0];
}

/** Pixi {@link https://github.com/pixijs/filters/blob/main/src/ascii/ascii.frag ASCIIFilter} defaults. */
export const ASCII_DEFAULTS = {
  size: 8,
  replaceColor: false,
  color: '#ffffff',
} as const;

/**
 * ASCII / bitmap-font style blocks from luminance (Pixi `ASCIIFilter`).
 */
export interface AsciiEffect {
  type: 'ascii';
  /** Cell size in pixels (`uSize`) */
  size: number;
  /** Solid `color` for glyphs vs sampled tint (`uReplaceColor`) */
  replaceColor: boolean;
  /** CSS color when replacing */
  color: string;
}

/** 3 × vec4 std140: `u_ASCII0`, `u_ASCII1`, `u_InputSizeAscii`. */
export function asciiUniformValues(
  effect: AsciiEffect,
  textureWidth: number,
  textureHeight: number,
): number[] {
  const w = Math.max(1, textureWidth);
  const h = Math.max(1, textureHeight);
  const D = ASCII_DEFAULTS;
  let cell = effect.size;
  if (!Number.isFinite(cell) || cell < 1) {
    cell = D.size;
  }
  cell = Math.max(1, Math.min(cell, Math.min(w, h)));
  const rgb = parseColor(effect.color?.trim() ? effect.color : D.color);
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const rep = effect.replaceColor ? 1 : 0;
  return [cell, rep, r, g, b, 0, 0, 0, w, h, 0, 0];
}

export interface DropShadowEffect {
  type: 'drop-shadow';
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}

/** Kawase blur defaults (Pixi {@link https://github.com/pixijs/filters/blob/main/src/kawase-blur/KawaseBlurFilter.ts KawaseBlurFilter}). */
export const BLUR_DEFAULTS = {
  value: 4,
  quality: 3,
  clamp: true,
  pixelSize: 1,
} as const;

export interface BlurEffect {
  type: 'blur';
  /** Blur strength in pixels (Pixi `strength`). */
  value: number;
  /** Pass count / kernel steps; integer ≥ 1. */
  quality?: number;
  /** Clamp UVs to filter bounds (reduces edge bleed). */
  clamp?: boolean;
  /** Per-axis pixel scale; larger = blurrier. */
  pixelSize?: number | { x: number; y: number };
}

export interface NoiseEffect {
  type: 'noise';
  value: number;
}

/** Digital block glitch + RGB split; `filter` e.g. `glitch(0.17, 0.24, auto, 0.2)` — jitter, rgbSplit, time, blocks. */
export const GLITCH_DEFAULTS = {
  jitter: 0.17,
  /** 0–1 digital block glitch strength (independent of {@link jitter}). */
  blocks: 0.2,
  rgbSplit: 0.24,
  time: 0,
} as const;

export interface GlitchEffect {
  type: 'glitch';
  /** 0–1 UV jitter strength (does not affect block glitch). */
  jitter: number;
  /** 0–1 block / digital glitch strength (does not affect jitter). */
  blocks: number;
  /** Horizontal channel separation scale (shader maps to pixel offset). */
  rgbSplit: number;
  /** Seconds; ignored when {@link useEngineTime} is true. */
  time: number;
  /** When true, uses engine time from `PostEffectTime` / `setPostEffectEngineTimeSeconds`. */
  useEngineTime?: boolean;
}

/** 2 × vec4 std140: `u_Glitch0`, `u_Glitch1`. */
export function glitchUniformValues(
  effect: GlitchEffect,
  textureWidth: number,
  textureHeight: number,
): number[] {
  const w = Math.max(1, textureWidth);
  const h = Math.max(1, textureHeight);
  const D = GLITCH_DEFAULTS;
  const z = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;
  const jitter = Math.max(0, Math.min(1, z(effect.jitter, D.jitter)));
  const blocks = Math.max(0, Math.min(1, z(effect.blocks, D.blocks)));
  const rgbSplit = Math.max(0, z(effect.rgbSplit, D.rgbSplit));
  const time = effect.useEngineTime
    ? getPostEffectEngineTimeSeconds()
    : z(effect.time, D.time);
  return [jitter, rgbSplit, time, blocks, w, h, 0, 0];
}

/** Defaults aligned with {@link https://github.com/OverShifted/LiquidGlass/blob/master/assets/shaders/BatchRenderer2D.glsl OverShifted LiquidGlass} uniforms. */
export const LIQUID_GLASS_DEFAULTS = {
  powerFactor: 4,
  fPower: 3,
  noise: 0.1,
  glowWeight: 0.3,
  glowBias: 0,
  glowEdge0: 0.06,
  glowEdge1: 0,
  a: 0.7,
  b: 2.3,
  c: 5.2,
  d: 6.9,
  centerX: 0.5,
  centerY: 0.5,
  scaleX: 1,
  scaleY: 1,
  ellipseSizeX: 1,
  ellipseSizeY: 1,
} as const;

export interface LiquidGlassEffect {
  type: 'liquidGlass';
  /** Superellipse exponent (higher → squarer silhouette). */
  powerFactor: number;
  /** Refractive fall-off power on `f(dist)`. */
  fPower: number;
  /** RGB grain strength. */
  noise: number;
  glowWeight: number;
  glowBias: number;
  glowEdge0: number;
  glowEdge1: number;
  /** `f(dist)` coefficients (see reference shader). */
  a: number;
  b: number;
  c: number;
  d: number;
  /** Lens center X in normalized texture UV [0, 1] (same space as post-process `v_Uv`). */
  centerX: number;
  /** Lens center Y in normalized texture UV [0, 1]. */
  centerY: number;
  /** Per-axis scale on the refracted offset in NDC (reference `v_QuadNDC2ScreenNDCScale`). */
  scaleX: number;
  scaleY: number;
  /**
   * Horizontal / vertical size of the superellipse in lens space (shader: `pShape = p / vec2(ellipseSizeX, ellipseSizeY)`).
   * Default `1` matches the old fixed shape; **larger** values stretch the lens wider/taller on that axis.
   */
  ellipseSizeX: number;
  ellipseSizeY: number;
}

/** 5 × vec4 std140: `u_LG0`–`u_LG4`. */
export function liquidGlassUniformValues(
  effect: LiquidGlassEffect,
  textureWidth: number,
  textureHeight: number,
): number[] {
  const w = Math.max(1, textureWidth);
  const h = Math.max(1, textureHeight);
  const D = LIQUID_GLASS_DEFAULTS;
  const z = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;
  const aspect = w / h;
  return [
    z(effect.powerFactor, D.powerFactor),
    z(effect.fPower, D.fPower),
    z(effect.noise, D.noise),
    z(effect.glowWeight, D.glowWeight),
    z(effect.glowBias, D.glowBias),
    z(effect.glowEdge0, D.glowEdge0),
    z(effect.glowEdge1, D.glowEdge1),
    aspect,
    z(effect.a, D.a),
    z(effect.b, D.b),
    z(effect.c, D.c),
    z(effect.d, D.d),
    z(effect.centerX, D.centerX),
    z(effect.centerY, D.centerY),
    z(effect.scaleX, D.scaleX),
    z(effect.scaleY, D.scaleY),
    w,
    h,
    z(effect.ellipseSizeX, D.ellipseSizeX),
    z(effect.ellipseSizeY, D.ellipseSizeY),
  ];
}

/**
 * Paper Design {@link https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/liquid-metal.ts liquid-metal} (raster). Optional CPU Poisson + R/G when `useImage`+`usePoisson` and WebGL readback.
 * Aligned with `webcomponents/examples/main.ts` example:
 * `liquid-metal(2, 0.1, 0.3, 0.3, 0.07, 0.4, 70, 3, 1, transparent, #ffffff, auto, 1)`.
 */
export const LIQUID_METAL_DEFAULTS = {
  colorBack: 'transparent',
  colorTint: '#ffffff',
  /** Stripe density 1–10. */
  repetition: 2,
  softness: 0.1,
  shiftRed: 0.3,
  shiftBlue: 0.3,
  distortion: 0.07,
  contour: 0.4,
  angle: 70,
  /** 0=none, 1=circle, 2=daisy, 3=diamond, 4=metaballs (no scene mask). */
  shape: 3,
  useImage: true,
  time: 0,
  useEngineTime: true,
  /** When `useImage` and WebGL: CPU Poisson map (paper R/G). WebGPU cannot sync-readback; falls back in Drawcall. */
  usePoisson: true,
} as const;

export interface LiquidMetalEffect {
  type: 'liquidMetal';
  colorBack: string;
  colorTint: string;
  repetition: number;
  softness: number;
  shiftRed: number;
  shiftBlue: number;
  distortion: number;
  contour: number;
  angle: number;
  shape: number;
  useImage: boolean;
  time: number;
  useEngineTime?: boolean;
  /** Use CPU Poisson + R/G texture when `useImage` (see {@link LIQUID_METAL_DEFAULTS.usePoisson}). */
  usePoisson?: boolean;
}

/** 6 × vec4 std140: `u_LM0`–`u_LM5` (24 floats). */
export function liquidMetalUniformValues(
  effect: LiquidMetalEffect,
  textureWidth: number,
  textureHeight: number,
): number[] {
  const w = Math.max(1, textureWidth);
  const h = Math.max(1, textureHeight);
  const D = LIQUID_METAL_DEFAULTS;
  const z = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;
  const time = effect.useEngineTime
    ? getPostEffectEngineTimeSeconds()
    : z(effect.time, D.time);
  const colorBack = parseColor(
    effect.colorBack?.trim() ? effect.colorBack : D.colorBack,
  );
  const colorTint = parseColor(
    effect.colorTint?.trim() ? effect.colorTint : D.colorTint,
  );
  const shape = Math.max(0, Math.min(4, Math.floor(z(effect.shape, D.shape))));
  const repetition = Math.max(1, Math.min(10, z(effect.repetition, D.repetition)));
  const usePoissonWanted =
    effect.useImage && (effect.usePoisson !== false);
  return [
    w,
    h,
    time,
    w / h,
    colorBack.r / 255,
    colorBack.g / 255,
    colorBack.b / 255,
    colorBack.opacity,
    colorTint.r / 255,
    colorTint.g / 255,
    colorTint.b / 255,
    colorTint.opacity,
    repetition,
    z(effect.softness, D.softness),
    z(effect.shiftRed, D.shiftRed),
    z(effect.shiftBlue, D.shiftBlue),
    z(effect.distortion, D.distortion),
    z(effect.contour, D.contour),
    z(effect.angle, D.angle),
    shape,
    effect.useImage ? 1 : 0,
    usePoissonWanted ? 1 : 0,
    0,
    0,
  ];
}

const HM_PAD = 10;

/**
 * 与 Paper Design {@link https://shaders.paper.design} `<Heatmap … />` 典型参数一致
 *（`colors` / `colorBack` / `contour` / `angle` / `noise` / `innerGlow` / `outerGlow`）；
 * `speed` / `scale` 在 React 侧由该组件处理，本仓库 filter 中时间由 `time` + `useEngineTime` 体现。
 */
export const HEATMAP_DEFAULTS = {
  contour: 0.5,
  angle: 0,
  noise: 0,
  innerGlow: 0.5,
  outerGlow: 0.5,
  useImage: true,
  usePreprocess: true,
  time: 0,
  colorBack: '#000000',
  colors: [
    '#112069',
    '#1f3ca3',
    '#3265e7',
    '#6bd8ff',
    '#ffe77a',
    '#ff9a1f',
    '#ff4d00',
  ],
} as const;

export interface HeatmapEffect {
  type: 'heatmap';
  contour: number;
  angle: number;
  noise: number;
  innerGlow: number;
  outerGlow: number;
  useImage: boolean;
  time: number;
  useEngineTime?: boolean;
  /** When `useImage` + WebGL: run CPU R/G/B blur pass (see {@link HEATMAP_DEFAULTS.usePreprocess}). */
  usePreprocess?: boolean;
  colorBack: string;
  /** Up to 10 gradient colors (see Paper `maxColorCount: 10`). */
  colors: string[];
}

/** 14×vec4 std140: `u_HM0`…`u_HM3` + `u_hmC[10]` (56 floats). */
export function heatmapUniformValues(
  effect: HeatmapEffect,
  textureWidth: number,
  textureHeight: number,
): number[] {
  const w = Math.max(1, textureWidth);
  const h = Math.max(1, textureHeight);
  const D = HEATMAP_DEFAULTS;
  const zf = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;
  const time = effect.useEngineTime
    ? getPostEffectEngineTimeSeconds()
    : zf(effect.time, D.time);
  const colorBack = parseColor(
    effect.colorBack?.trim() ? effect.colorBack : D.colorBack,
  );
  const palette: string[] =
    effect.colors?.length > 0 ? [...effect.colors] : [...D.colors];
  const nColors = Math.max(1, Math.min(10, palette.length));
  const uColors: [number, number, number, number][] = [];
  for (let i = 0; i < 10; i++) {
    if (i >= nColors) {
      uColors.push([0, 0, 0, 0]);
      continue;
    }
    const s = palette[Math.min(i, palette.length - 1)]!;
    const c = parseColor(s);
    uColors.push([c.r / 255, c.g / 255, c.b / 255, c.opacity]);
  }
  const out: number[] = [
    w,
    h,
    time,
    nColors,
    w / h,
    zf(effect.noise, D.noise),
    zf(effect.contour, D.contour),
    zf(effect.angle, D.angle),
    zf(effect.innerGlow, D.innerGlow),
    zf(effect.outerGlow, D.outerGlow),
    0.0,
    0.0,
    colorBack.r / 255,
    colorBack.g / 255,
    colorBack.b / 255,
    colorBack.opacity,
  ];
  for (let j = 0; j < HM_PAD; j++) {
    out.push(
      uColors[j]![0]!,
      uColors[j]![1]!,
      uColors[j]![2]!,
      uColors[j]![3]!,
    );
  }
  return out;
}

const GS_COLOR_PAD = 6;

/** Paper gem-smoke; up to 6 smoke colors. */
export const GEM_SMOKE_DEFAULTS = {
  innerDistortion: 0.5,
  outerDistortion: 0.5,
  outerGlow: 0.5,
  innerGlow: 0.5,
  offset: 0,
  angle: 0,
  size: 0.5,
  /** 0=full canvas, 1=circle, 2=daisy, 3=diamond, 4=metaballs */
  shape: 3,
  useImage: true,
  usePoisson: true,
  time: 0,
  colorBack: '#000000',
  colorInner: 'rgba(255,255,255,0.15)',
  colors: [
    '#88ccff',
    '#ffffff',
    '#ffaaee',
    '#6644ff',
    '#3322aa',
    '#110066',
  ],
} as const;

/**
 * Per-shape raster LUT (see {@link registerCubeLutFromText}).
 * Filter examples (strength ∈ [0, 1], default 1):
 * - Named: `lut(fuji, 1)` — key must match `registerCubeLutFromText(device, "fuji", text)`.
 * - URL path: `lut(url("./grade.cube"), 1)` — key is the string inside `url("…")`.
 * - Explicit name: `lut(name("my-grade"), 1)`.
 */
export interface LutEffect {
  type: 'lut';
  /** Cache key: logical name (e.g. `fuji`) or same string as in `url("…")`. */
  lutKey: string;
  strength: number;
}

/** New LUT row in UI before a cube file is registered (`lutKey` placeholder). */
export const LUT_EFFECT_DEFAULTS = {
  type: 'lut' as const,
  lutKey: 'custom',
  strength: 1,
} as const;

export interface GemSmokeEffect {
  type: 'gemSmoke';
  innerDistortion: number;
  outerDistortion: number;
  outerGlow: number;
  innerGlow: number;
  offset: number;
  angle: number;
  size: number;
  shape: number;
  useImage: boolean;
  time: number;
  useEngineTime?: boolean;
  /** WebGL + `useImage`: CPU Poisson R/G 与 liquid metal 同格式（见 {@link imageDataToLiquidMetalPoissonMap}）。 */
  usePoisson?: boolean;
  colorBack: string;
  colorInner: string;
  colors: string[];
}

/** 12×vec4 std140: `u_GS0`…`u_GS5` + `u_gsC[6]`（48 floats）。 */
export function gemSmokeUniformValues(
  effect: GemSmokeEffect,
  textureWidth: number,
  textureHeight: number,
): number[] {
  const w = Math.max(1, textureWidth);
  const h = Math.max(1, textureHeight);
  const D = GEM_SMOKE_DEFAULTS;
  const zf = (v: number | undefined, def: number) =>
    Number.isFinite(v as number) ? (v as number) : def;
  const time = effect.useEngineTime
    ? getPostEffectEngineTimeSeconds()
    : zf(effect.time, D.time);
  const colorBack = parseColor(
    effect.colorBack?.trim() ? effect.colorBack : D.colorBack,
  );
  const colorInner = parseColor(
    effect.colorInner?.trim() ? effect.colorInner : D.colorInner,
  );
  const palette: string[] =
    effect.colors?.length > 0 ? [...effect.colors] : [...D.colors];
  const nColors = Math.max(1, Math.min(GS_COLOR_PAD, palette.length));
  const shape = Math.max(0, Math.min(4, Math.floor(zf(effect.shape, D.shape))));
  const usePoissonWanted = effect.useImage && (effect.usePoisson !== false);
  const uColors: [number, number, number, number][] = [];
  for (let i = 0; i < GS_COLOR_PAD; i++) {
    if (i >= nColors) {
      uColors.push([0, 0, 0, 0]);
      continue;
    }
    const s = palette[Math.min(i, palette.length - 1)]!;
    const c = parseColor(s);
    uColors.push([c.r / 255, c.g / 255, c.b / 255, c.opacity]);
  }
  return [
    w,
    h,
    time,
    w / h,
    nColors,
    zf(effect.innerDistortion, D.innerDistortion),
    zf(effect.outerDistortion, D.outerDistortion),
    zf(effect.outerGlow, D.outerGlow),
    zf(effect.innerGlow, D.innerGlow),
    zf(effect.offset, D.offset),
    zf(effect.angle, D.angle),
    zf(effect.size, D.size),
    colorBack.r / 255,
    colorBack.g / 255,
    colorBack.b / 255,
    colorBack.opacity,
    colorInner.r / 255,
    colorInner.g / 255,
    colorInner.b / 255,
    colorInner.opacity,
    shape,
    effect.useImage ? 1 : 0,
    usePoissonWanted ? 1 : 0,
    0,
    ...uColors.flatMap((c) => [c[0]!, c[1]!, c[2]!, c[3]!]),
  ];
}

export interface FXAA {
  type: 'fxaa';
}

/** Effect types implemented by {@link Drawcall.createPostProcessing} raster chain (see `FRAG_MAP`). */
const RASTER_POST_EFFECT_TYPES = new Set<Effect['type']>([
  'noise',
  'brightness',
  'contrast',
  'blur',
  'pixelate',
  'dot',
  'colorHalftone',
  'halftoneDots',
  'flutedGlass',
  'tsunami',
  'rain',
  'burn',
  'crt',
  'vignette',
  'ascii',
  'glitch',
  'liquidGlass',
  'liquidMetal',
  'heatmap',
  'gemSmoke',
  'lut',
]);

/** True when `adjustment` only changes saturation (Pixi/CSS-style `saturate()`). */
export function isSaturateOnlyAdjustment(
  effect: Extract<Effect, { type: 'adjustment' }>,
): boolean {
  const d = ADJUSTMENT_DEFAULTS;
  return (
    effect.gamma === d.gamma &&
    effect.contrast === d.contrast &&
    effect.brightness === d.brightness &&
    effect.red === d.red &&
    effect.green === d.green &&
    effect.blue === d.blue &&
    effect.alpha === d.alpha
  );
}

/** Pixi/CSS multiplier (1 = identity) → glfx `saturation` uniform (0 = identity). */
export function pixiSaturationToGlfx(s: number): number {
  if (!Number.isFinite(s)) {
    return 0;
  }
  if (s <= 1) {
    return Math.max(-1, Math.min(0, s - 1));
  }
  return Math.min(s - 1, 0.999);
}

/** Inverse of {@link pixiSaturationToGlfx} for formatting filter strings. */
export function glfxSaturationToPixi(glfx: number): number {
  if (glfx <= 0) {
    return glfx + 1;
  }
  return glfx + 1;
}

function clampGlfxHue(h: number): number {
  if (!Number.isFinite(h)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, h));
}

function parsePixelBlockSize(params: string): number {
  const n = parseFloat(params.replace(/px/gi, '').trim());
  if (!Number.isFinite(n) || n <= 0) {
    return 1;
  }
  return n;
}

/** Avoid `(1.001 - saturation) → 0` in the positive-saturation branch (see glfx huesaturation). */
function clampGlfxHueSaturation(s: number): number {
  if (!Number.isFinite(s)) {
    return 0;
  }
  const v = Math.max(-1, Math.min(1, s));
  if (v > 0.999) {
    return 0.999;
  }
  return v;
}

function parseHueRotateDegrees(params: string): number {
  const s = params.trim().toLowerCase();
  const num = parseFloat(s);
  if (!Number.isFinite(num)) {
    return 0;
  }
  if (s.includes('grad')) {
    return (num * 360) / 400;
  }
  if (s.includes('turn')) {
    return num * 360;
  }
  if (s.includes('rad')) {
    return (num * 180) / Math.PI;
  }
  return num;
}

/** Map CSS `hue-rotate` degrees to glfx `hue` ∈ [-1, 1] (±180° rotation at ±1), with 360° → identity. */
function degreesToGlfxHue(deg: number): number {
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) {
    a -= 360;
  }
  return clampGlfxHue(a / 180);
}

export function filterRasterPostEffects(effects: Effect[]): Effect[] {
  const out: Effect[] = [];
  for (const e of effects) {
    if (e.type === 'adjustment' && isSaturateOnlyAdjustment(e)) {
      const sat = pixiSaturationToGlfx(e.saturation);
      if (sat !== 0) {
        out.push({
          type: 'hueSaturation',
          hue: 0,
          saturation: clampGlfxHueSaturation(sat),
        });
      }
      continue;
    }
    if (e.type === 'hueSaturation') {
      out.push({
        type: 'hueSaturation',
        hue: clampGlfxHue(e.hue),
        saturation: clampGlfxHueSaturation(e.saturation),
      });
      continue;
    }
    if (RASTER_POST_EFFECT_TYPES.has(e.type)) {
      out.push(e);
    }
  }
  return out;
}

export function hasRasterPostEffects(filterValue: string | undefined): boolean {
  if (!filterValue) {
    return false;
  }
  return filterRasterPostEffects(parseEffect(filterValue)).length > 0;
}

/**
 * 自身或 `iconfont` 根上的 {@link Filter} 字符串。子 path/ellipse/line 未挂 `Filter` 时沿父链取
 * 带 `IconFont` 且带 `Filter` 的节点（与反序列化一致：滤镜写在 icon 根上）。
 */
export function getRasterFilterValueForShape(instance: Entity): string | undefined {
  if (instance.has(Filter)) {
    const v = instance.read(Filter).value;
    if (v) {
      return v;
    }
  }
  let e: Entity | undefined = instance;
  for (let d = 0; d < 64; d++) {
    if (!e.has(Children)) {
      return undefined;
    }
    const p = e.read(Children).parent;
    if (!p) {
      return undefined;
    }
    if (p.has(IconFont) && p.has(Filter)) {
      return p.read(Filter).value || undefined;
    }
    e = p;
  }
  return undefined;
}

function isUnderIconFontEntity(entity: Entity): boolean {
  let e: Entity | undefined = entity;
  for (let d = 0; d < 64; d++) {
    if (!e.has(Children)) {
      return false;
    }
    const p = e.read(Children).parent;
    if (!p) {
      return false;
    }
    if (p.has(IconFont)) {
      return true;
    }
    e = p;
  }
  return false;
}

/**
 * {@link SmoothPolyline} 纯色描边 + 栅格类 filter：将描边栅格进纹理再采样（与渐变描边纹理路径区分）。
 * - Icon 子 path/ellipse/line 等（父级带 IconFont）
 * - 独立的 polyline / line / path（圆角矩形等实体描边由 SDF 处理，不经过此分支）
 *
 * Canvas 描边为居中；独立折线需 `stroke.alignment === 'center'`。
 */
export function shouldRasterizeStrokeForFilterTexture(shape: Entity): boolean {
  if (getFirstGradientStrokeLayerValue(shape) != null) {
    return false;
  }
  const fv = getRasterFilterValueForShape(shape);
  if (!fv || !hasRasterPostEffects(fv)) {
    return false;
  }
  if (!shape.has(Stroke) || !hasValidStroke(shape.read(Stroke))) {
    return false;
  }
  const st = shape.read(Stroke);
  const [da, db] = st.dasharray;
  if (da > 0 && db > 0) {
    return false;
  }
  if (shape.has(Rough)) {
    return false;
  }

  if (isUnderIconFontEntity(shape)) {
    return shape.hasSomeOf(Path, Line, Ellipse, Polyline, Circle);
  }

  if (!shape.hasSomeOf(Polyline, Line, Path)) {
    return false;
  }
  return st.alignment === 'center';
}

function parseCssFilterScalar(params: string): number {
  const s = params.trim();
  if (s.endsWith('%')) {
    return parseFloat(s.slice(0, -1)) / 100;
  }
  return parseFloat(s);
}

/**
 * Brightness / contrast filter params are **not** CSS multipliers: the parenthesized number is the
 * glfx-style offset in [-1, 1] (0 = no change). Same as {@link https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/brightnesscontrast.js glfx} `brightness` / `contrast` uniforms after clamping.
 */
function clampGlfxBrightness(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, value));
}

/** Avoid (1 - contrast) → 0 in the positive-contrast branch (see glfx brightnessContrast). */
function clampGlfxContrast(c: number): number {
  const v = clampGlfxBrightness(c);
  if (v > 0.999) {
    return 0.999;
  }
  return v;
}

function makeAdjustment(
  partial: Partial<Omit<AdjustmentEffect, 'type'>>,
): AdjustmentEffect {
  return {
    type: 'adjustment',
    ...ADJUSTMENT_DEFAULTS,
    ...partial,
  };
}

function parseLutStrengthSuffix(rest: string): number {
  const t = rest.trim();
  if (!t.length) {
    return 1;
  }
  const part = t.split(',')[0]!.trim();
  const sv = parseFloat(part);
  return Number.isFinite(sv) ? Math.max(0, Math.min(1, sv)) : 1;
}

function parseLutFilterParams(
  params: string,
): { lutKey: string; strength: number } | undefined {
  const raw = params.trim();
  if (!raw) {
    return undefined;
  }

  const urlLead = raw.match(/^\s*url\s*\(\s*(['"])(.*?)\1\s*\)/i);
  if (urlLead) {
    const lutKey = urlLead[2]!.trim();
    if (!lutKey) {
      return undefined;
    }
    const rest = raw
      .slice(urlLead.index! + urlLead[0].length)
      .replace(/^\s*,\s*/, '');
    return { lutKey, strength: parseLutStrengthSuffix(rest) };
  }

  const nameLead = raw.match(/^\s*name\s*\(\s*(['"])(.*?)\1\s*\)/i);
  if (nameLead) {
    const lutKey = nameLead[2]!.trim();
    if (!lutKey) {
      return undefined;
    }
    const rest = raw
      .slice(nameLead.index! + nameLead[0].length)
      .replace(/^\s*,\s*/, '');
    return { lutKey, strength: parseLutStrengthSuffix(rest) };
  }

  const comma = raw.indexOf(',');
  const first = (comma >= 0 ? raw.slice(0, comma) : raw).trim();
  const rest = comma >= 0 ? raw.slice(comma + 1) : '';
  let lutKey: string | undefined;
  const quoted = first.match(/^(['"])(.*)\1$/);
  if (quoted && quoted[2]!.length > 0) {
    lutKey = quoted[2]!;
  } else if (/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(first)) {
    lutKey = first;
  }
  if (!lutKey) {
    return undefined;
  }
  return { lutKey, strength: parseLutStrengthSuffix(rest) };
}

/** Serialize {@link LutEffect.lutKey} for a filter string (name vs `url("…")`). */
export function formatLutFilterSegment(lutKey: string, strength: number): string {
  if (/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(lutKey)) {
    return `lut(${lutKey}, ${strength})`;
  }
  const u = lutKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `lut(url("${u}"), ${strength})`;
}

/** Single `url("…")` for raindrop-fx sprite; returns null if Codrops multi-url tail. */
function parseRainFxDropTextureUrl(params: string): string | null {
  const raw = params.trim();
  if (!raw) {
    return null;
  }
  const m = raw.match(/^\s*url\s*\(\s*(['"])(.*?)\1\s*\)/i);
  if (!m || m.index === undefined) {
    return null;
  }
  const after = raw.slice(m.index + m[0].length);
  if (/^\s*,\s*url\s*\(/i.test(after)) {
    return null;
  }
  const u = m[2]!.trim();
  return u.length > 0 ? u : null;
}

function mergedRainFxParams(fx?: RainFxParams): RainFxParams {
  const R = RAINDROP_FX_RENDER_DEFAULTS;
  const C = RAINDROP_FX_COMPOSE_DEFAULTS;
  return {
    backgroundBlurSteps: fx?.backgroundBlurSteps ?? R.backgroundBlurSteps,
    backgroundWrapMode: fx?.backgroundWrapMode ?? R.backgroundWrapMode,
    mist: fx?.mist ?? R.mist,
    mistTime: fx?.mistTime ?? R.mistTime,
    mistBlurStep: fx?.mistBlurStep ?? R.mistBlurStep,
    dropletsPerSecond: fx?.dropletsPerSecond ?? R.dropletsPerSecond,
    dropletSize: fx?.dropletSize ?? [...R.dropletSize],
    smoothRaindrop: fx?.smoothRaindrop ?? [...C.smoothRaindrop],
    refractBase: fx?.refractBase ?? C.refractBase,
    refractScale: fx?.refractScale ?? C.refractScale,
    raindropCompose: fx?.raindropCompose ?? R.raindropCompose,
    mistColor: fx?.mistColor ?? [...R.mistColor],
    raindropEraserSize: fx?.raindropEraserSize ?? [...R.raindropEraserSize],
    raindropLightPos: fx?.raindropLightPos ?? [...C.raindropLightPos],
    raindropDiffuseLight: fx?.raindropDiffuseLight ?? [...C.raindropDiffuseLight],
    raindropShadowOffset: fx?.raindropShadowOffset ?? C.raindropShadowOffset,
    raindropSpecularLight: fx?.raindropSpecularLight ?? [...C.raindropSpecularLight],
    raindropSpecularShininess:
      fx?.raindropSpecularShininess ?? C.raindropSpecularShininess,
    raindropLightBump: fx?.raindropLightBump ?? C.raindropLightBump,
    composeDecay: fx?.composeDecay ?? RAINDROP_FX_COMPOSE_DECAY_DEFAULT,
  };
}

function mergedRainFxSimParams(sim?: RainFxSimParams): Required<RainFxSimParams> {
  const D = RAINDROP_FX_SIM_DEFAULTS;
  return {
    spawnInterval: sim?.spawnInterval ?? [...D.spawnInterval],
    spawnSize: sim?.spawnSize ?? [...D.spawnSize],
    motionInterval: sim?.motionInterval ?? [...D.motionInterval],
    trailDistance: sim?.trailDistance ?? [...D.trailDistance],
    gravity: sim?.gravity ?? D.gravity,
    spawnLimit: sim?.spawnLimit ?? D.spawnLimit,
    trailDropDensity: sim?.trailDropDensity ?? D.trailDropDensity,
    trailSpread: sim?.trailSpread ?? D.trailSpread,
    xShifting: sim?.xShifting ?? [...D.xShifting],
    slipRate: sim?.slipRate ?? D.slipRate,
  };
}

function rainFxMistColorDefault(): [number, number, number, number] {
  return [...RAINDROP_FX_RENDER_DEFAULTS.mistColor];
}

function rainFxEraserDefault(): [number, number] {
  return [...RAINDROP_FX_RENDER_DEFAULTS.raindropEraserSize];
}

function rainFxVec4Near(
  a: [number, number, number, number],
  b: [number, number, number, number],
  eps = 0.0005,
): boolean {
  return (
    Math.abs(a[0] - b[0]) <= eps &&
    Math.abs(a[1] - b[1]) <= eps &&
    Math.abs(a[2] - b[2]) <= eps &&
    Math.abs(a[3] - b[3]) <= eps
  );
}

function rainFxVec2Near(
  a: [number, number],
  b: [number, number],
  eps = 0.0005,
): boolean {
  return Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps;
}

function rainFxVec3Near(
  a: [number, number, number],
  b: [number, number, number],
  eps = 0.0005,
): boolean {
  return (
    Math.abs(a[0] - b[0]) <= eps &&
    Math.abs(a[1] - b[1]) <= eps &&
    Math.abs(a[2] - b[2]) <= eps
  );
}

function isDefaultRainFxSimParams(sim?: RainFxSimParams): boolean {
  const m = mergedRainFxSimParams(sim);
  const D = RAINDROP_FX_SIM_DEFAULTS;
  return (
    m.spawnInterval[0] === D.spawnInterval[0] &&
    m.spawnInterval[1] === D.spawnInterval[1] &&
    m.spawnSize[0] === D.spawnSize[0] &&
    m.spawnSize[1] === D.spawnSize[1] &&
    m.motionInterval[0] === D.motionInterval[0] &&
    m.motionInterval[1] === D.motionInterval[1] &&
    m.trailDistance[0] === D.trailDistance[0] &&
    m.trailDistance[1] === D.trailDistance[1] &&
    m.gravity === D.gravity &&
    m.spawnLimit === D.spawnLimit &&
    m.trailDropDensity === D.trailDropDensity &&
    m.trailSpread === D.trailSpread &&
    m.xShifting[0] === D.xShifting[0] &&
    m.xShifting[1] === D.xShifting[1] &&
    m.slipRate === D.slipRate
  );
}

function isDefaultRainFxEffect(e: RainEffect): boolean {
  return isDefaultRainFxParams(e.rainFx) && isDefaultRainFxSimParams(e.rainFxSim);
}

function rainFxParsedTailToEffectFields(parsed: {
  rainFx: RainFxParams;
  rainFxSim?: RainFxSimParams;
}): Pick<RainEffect, 'rainFx' | 'rainFxSim'> {
  return {
    ...(!isDefaultRainFxParams(parsed.rainFx) ? { rainFx: parsed.rainFx } : {}),
    ...(parsed.rainFxSim && !isDefaultRainFxSimParams(parsed.rainFxSim)
      ? { rainFxSim: parsed.rainFxSim }
      : {}),
  };
}

function isDefaultRainFxParams(fx?: RainFxParams): boolean {
  const m = mergedRainFxParams(fx);
  const R = RAINDROP_FX_RENDER_DEFAULTS;
  const C = RAINDROP_FX_COMPOSE_DEFAULTS;
  return (
    m.backgroundBlurSteps === R.backgroundBlurSteps &&
    m.mist === R.mist &&
    m.mistTime === R.mistTime &&
    m.mistBlurStep === R.mistBlurStep &&
    m.dropletsPerSecond === R.dropletsPerSecond &&
    m.dropletSize![0] === R.dropletSize[0] &&
    m.dropletSize![1] === R.dropletSize[1] &&
    m.smoothRaindrop![0] === C.smoothRaindrop[0] &&
    m.smoothRaindrop![1] === C.smoothRaindrop[1] &&
    m.refractBase === C.refractBase &&
    m.refractScale === C.refractScale &&
    m.raindropCompose === R.raindropCompose &&
    m.backgroundWrapMode === R.backgroundWrapMode &&
    rainFxVec4Near(m.mistColor!, rainFxMistColorDefault()) &&
    rainFxVec2Near(m.raindropEraserSize!, rainFxEraserDefault()) &&
    rainFxVec4Near(m.raindropLightPos!, [...C.raindropLightPos]) &&
    rainFxVec3Near(m.raindropDiffuseLight!, [...C.raindropDiffuseLight]) &&
    m.raindropShadowOffset === C.raindropShadowOffset &&
    rainFxVec3Near(m.raindropSpecularLight!, [...C.raindropSpecularLight]) &&
    m.raindropSpecularShininess === C.raindropSpecularShininess &&
    m.raindropLightBump === C.raindropLightBump &&
    m.composeDecay === RAINDROP_FX_COMPOSE_DECAY_DEFAULT
  );
}

function wrapModeFromIndex(i: number): RaindropFxBackgroundWrapMode {
  if (i >= 1.5) {
    return 'mirror';
  }
  if (i >= 0.5) {
    return 'repeat';
  }
  return 'clamp';
}

function wrapModeToIndex(mode: RaindropFxBackgroundWrapMode): number {
  if (mode === 'mirror') {
    return 2;
  }
  if (mode === 'repeat') {
    return 1;
  }
  return 0;
}

function parseRainFxNumericTail(tail: string):
  | { rainFx: RainFxParams; rainFxSim?: RainFxSimParams }
  | undefined {
  const parts = tail
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) {
    return undefined;
  }
  const R = RAINDROP_FX_RENDER_DEFAULTS;
  const C = RAINDROP_FX_COMPOSE_DEFAULTS;
  const pf = (i: number, def: number) => {
    const v = parts[i] !== undefined ? parseFloat(parts[i]!) : def;
    return Number.isFinite(v) ? v : def;
  };
  const composeMode: RaindropFxComposeMode =
    pf(11, 0) > 0.5 ? 'harder' : 'smoother';
  const fx: RainFxParams = {
    backgroundBlurSteps: Math.round(pf(0, R.backgroundBlurSteps)),
    mist: pf(1, R.mist ? 1 : 0) > 0.5,
    mistTime: pf(2, R.mistTime),
    mistBlurStep: Math.round(pf(3, R.mistBlurStep)),
    dropletsPerSecond: pf(4, R.dropletsPerSecond),
    dropletSize: [pf(5, R.dropletSize[0]), pf(6, R.dropletSize[1])],
    smoothRaindrop: [pf(7, C.smoothRaindrop[0]), pf(8, C.smoothRaindrop[1])],
    refractBase: pf(9, C.refractBase),
    refractScale: pf(10, C.refractScale),
    raindropCompose: composeMode,
  };
  if (parts.length > 12) {
    fx.composeDecay = pf(12, RAINDROP_FX_COMPOSE_DECAY_DEFAULT);
  }
  if (parts.length > 13) {
    fx.backgroundWrapMode = wrapModeFromIndex(pf(13, 0));
  }
  if (parts.length > 17) {
    fx.mistColor = [pf(14, R.mistColor[0]), pf(15, R.mistColor[1]), pf(16, R.mistColor[2]), pf(17, R.mistColor[3])];
  }
  if (parts.length > 19) {
    fx.raindropEraserSize = [pf(18, R.raindropEraserSize[0]), pf(19, R.raindropEraserSize[1])];
  }
  if (parts.length > 31) {
    fx.raindropLightPos = [
      pf(20, C.raindropLightPos[0]),
      pf(21, C.raindropLightPos[1]),
      pf(22, C.raindropLightPos[2]),
      pf(23, C.raindropLightPos[3]),
    ];
    fx.raindropDiffuseLight = [
      pf(24, C.raindropDiffuseLight[0]),
      pf(25, C.raindropDiffuseLight[1]),
      pf(26, C.raindropDiffuseLight[2]),
    ];
    fx.raindropShadowOffset = pf(27, C.raindropShadowOffset);
    fx.raindropSpecularLight = [
      pf(28, C.raindropSpecularLight[0]),
      pf(29, C.raindropSpecularLight[1]),
      pf(30, C.raindropSpecularLight[2]),
    ];
    fx.raindropSpecularShininess = pf(31, C.raindropSpecularShininess);
  }
  if (parts.length > 32) {
    fx.raindropLightBump = pf(32, C.raindropLightBump);
  }
  const sim: RainFxSimParams = {};
  let hasSim = false;
  if (parts.length > 34) {
    sim.trailDistance = [pf(33, RAINDROP_FX_SIM_DEFAULTS.trailDistance[0]), pf(34, RAINDROP_FX_SIM_DEFAULTS.trailDistance[1])];
    hasSim = true;
  }
  if (parts.length > 35) {
    sim.gravity = pf(35, RAINDROP_FX_SIM_DEFAULTS.gravity);
    hasSim = true;
  }
  if (parts.length > 36) {
    sim.spawnLimit = Math.round(pf(36, RAINDROP_FX_SIM_DEFAULTS.spawnLimit));
    hasSim = true;
  }
  if (parts.length > 37) {
    sim.trailDropDensity = pf(37, RAINDROP_FX_SIM_DEFAULTS.trailDropDensity);
    hasSim = true;
  }
  if (parts.length > 38) {
    sim.trailSpread = pf(38, RAINDROP_FX_SIM_DEFAULTS.trailSpread);
    hasSim = true;
  }
  if (parts.length > 40) {
    sim.xShifting = [
      pf(39, RAINDROP_FX_SIM_DEFAULTS.xShifting[0]),
      pf(40, RAINDROP_FX_SIM_DEFAULTS.xShifting[1]),
    ];
    hasSim = true;
  }
  if (parts.length > 41) {
    sim.slipRate = pf(41, RAINDROP_FX_SIM_DEFAULTS.slipRate);
    hasSim = true;
  }
  if (parts.length > 43) {
    sim.spawnInterval = [
      pf(42, RAINDROP_FX_SIM_DEFAULTS.spawnInterval[0]),
      pf(43, RAINDROP_FX_SIM_DEFAULTS.spawnInterval[1]),
    ];
    hasSim = true;
  }
  if (parts.length > 45) {
    sim.spawnSize = [
      pf(44, RAINDROP_FX_SIM_DEFAULTS.spawnSize[0]),
      pf(45, RAINDROP_FX_SIM_DEFAULTS.spawnSize[1]),
    ];
    hasSim = true;
  }
  if (parts.length > 47) {
    sim.motionInterval = [
      pf(46, RAINDROP_FX_SIM_DEFAULTS.motionInterval[0]),
      pf(47, RAINDROP_FX_SIM_DEFAULTS.motionInterval[1]),
    ];
    hasSim = true;
  }
  return { rainFx: fx, ...(hasSim ? { rainFxSim: sim } : {}) };
}

/** `rain()`, `rain(url("…"))`, or `rain(…numeric…)` for raindrop-fx; null → Codrops / procedural. */
function parseRainFxFilterParams(raw: string): RainEffect | null {
  const t = raw.trim();
  if (!t) {
    return null;
  }
  if (!/url\s*\(/i.test(t)) {
    const parsed = parseRainFxNumericTail(t);
    if (!parsed) {
      return null;
    }
    return {
      type: 'rain',
      dropTextureUrl: RAIN_DROPDROP_TEXTURE_DEFAULT,
      ...rainFxParsedTailToEffectFields(parsed),
    };
  }
  const dropUrl = parseRainFxDropTextureUrl(t);
  if (dropUrl === null) {
    return null;
  }
  const m = t.match(/^\s*url\s*\(\s*(['"])(.*?)\1\s*\)/i);
  if (!m || m.index === undefined) {
    return null;
  }
  const after = t
    .slice(m.index + m[0].length)
    .replace(/^\s*,\s*/, '')
    .trim();
  const parsed = after.length > 0 ? parseRainFxNumericTail(after) : undefined;
  return {
    type: 'rain',
    dropTextureUrl: dropUrl,
    ...(parsed ? rainFxParsedTailToEffectFields(parsed) : {}),
  };
}

function appendRainFxExtendedTail(parts: number[], m: RainFxParams): void {
  parts.push(
    m.composeDecay!,
    wrapModeToIndex(m.backgroundWrapMode!),
    m.mistColor![0],
    m.mistColor![1],
    m.mistColor![2],
    m.mistColor![3],
    m.raindropEraserSize![0],
    m.raindropEraserSize![1],
  );
}

function appendRainFxLightingTail(parts: number[], m: RainFxParams): void {
  parts.push(
    m.raindropLightPos![0],
    m.raindropLightPos![1],
    m.raindropLightPos![2],
    m.raindropLightPos![3],
    m.raindropDiffuseLight![0],
    m.raindropDiffuseLight![1],
    m.raindropDiffuseLight![2],
    m.raindropShadowOffset!,
    m.raindropSpecularLight![0],
    m.raindropSpecularLight![1],
    m.raindropSpecularLight![2],
    m.raindropSpecularShininess!,
    m.raindropLightBump!,
  );
}

function appendRainFxSimTail(parts: number[], sm: Required<RainFxSimParams>): void {
  parts.push(
    sm.trailDistance[0],
    sm.trailDistance[1],
    sm.gravity,
    sm.spawnLimit,
    sm.trailDropDensity,
    sm.trailSpread,
    sm.xShifting[0],
    sm.xShifting[1],
    sm.slipRate,
    sm.spawnInterval[0],
    sm.spawnInterval[1],
    sm.spawnSize[0],
    sm.spawnSize[1],
    sm.motionInterval[0],
    sm.motionInterval[1],
  );
}

function formatRainFxNumericTail(e: RainEffect): string {
  if (!isRainFxEffect(e) || isDefaultRainFxEffect(e)) {
    return '';
  }
  const m = mergedRainFxParams(e.rainFx);
  const sm = mergedRainFxSimParams(e.rainFxSim);
  const C = RAINDROP_FX_COMPOSE_DEFAULTS;
  const composeFlag = m.raindropCompose === 'harder' ? 1 : 0;
  const parts = [
    m.backgroundBlurSteps,
    m.mist ? 1 : 0,
    m.mistTime,
    m.mistBlurStep,
    m.dropletsPerSecond,
    m.dropletSize![0],
    m.dropletSize![1],
    m.smoothRaindrop![0],
    m.smoothRaindrop![1],
    m.refractBase,
    m.refractScale,
    composeFlag,
  ];
  const mistDef = rainFxMistColorDefault();
  const eraserDef = rainFxEraserDefault();
  const hasExtendedTail =
    m.composeDecay !== RAINDROP_FX_COMPOSE_DECAY_DEFAULT ||
    m.backgroundWrapMode !== RAINDROP_FX_RENDER_DEFAULTS.backgroundWrapMode ||
    !rainFxVec4Near(m.mistColor!, mistDef) ||
    !rainFxVec2Near(m.raindropEraserSize!, eraserDef);
  const hasLighting =
    !rainFxVec4Near(m.raindropLightPos!, [...C.raindropLightPos]) ||
    !rainFxVec3Near(m.raindropDiffuseLight!, [...C.raindropDiffuseLight]) ||
    m.raindropShadowOffset !== C.raindropShadowOffset ||
    !rainFxVec3Near(m.raindropSpecularLight!, [...C.raindropSpecularLight]) ||
    m.raindropSpecularShininess !== C.raindropSpecularShininess ||
    m.raindropLightBump !== C.raindropLightBump;
  const hasSim = !isDefaultRainFxSimParams(e.rainFxSim);
  if (hasExtendedTail || hasLighting || hasSim) {
    appendRainFxExtendedTail(parts, m);
  }
  if (hasLighting || hasSim) {
    appendRainFxLightingTail(parts, m);
  }
  if (hasSim) {
    appendRainFxSimTail(parts, sm);
  }
  return `, ${parts.join(', ')}`;
}

function parseRainDropTextureUrls(params: string): {
  dropColorUrl: string;
  dropAlphaUrl: string;
  dropShineUrl?: string;
  numericTail: string;
} | null {
  const raw = params.trim();
  if (!raw) {
    return null;
  }
  const m1 = raw.match(/^\s*url\s*\(\s*(['"])(.*?)\1\s*\)/i);
  if (!m1 || m1.index === undefined) {
    return null;
  }
  const after1 = raw.slice(m1.index + m1[0].length).replace(/^\s*,\s*/, '');
  const m2 = after1.match(/^\s*url\s*\(\s*(['"])(.*?)\1\s*\)/i);
  if (!m2 || m2.index === undefined) {
    return null;
  }
  let tail = after1
    .slice(m2.index + m2[0].length)
    .replace(/^\s*,\s*/, '');
  const dropColorUrl = m1[2]!.trim();
  const dropAlphaUrl = m2[2]!.trim();
  if (!dropColorUrl || !dropAlphaUrl) {
    return null;
  }
  let dropShineUrl: string | undefined;
  const m3 = tail.match(/^\s*url\s*\(\s*(['"])(.*?)\1\s*\)/i);
  if (m3 && m3.index === 0) {
    const u = m3[2]!.trim();
    if (u) {
      dropShineUrl = u;
    }
    tail = tail.slice(m3[0].length).replace(/^\s*,\s*/, '');
  }
  return { dropColorUrl, dropAlphaUrl, dropShineUrl, numericTail: tail.trim() };
}

/**
 * 从 CSS filter 字符串中解析出一个或多个 filter 对象
 *
 * @example
 * parseEffect('blur(5px)')
 * // => [{ name: 'blur', value: 5 }]
 *
 * @example
 * parseEffect('drop-shadow(3px 3px red) sepia(100%)')
 * // => [{ name: 'drop-shadow', x: 3, y: 3, blur: 0, spread: 0, color: 'red' }, { name: 'sepia', value: 100 }]
 *
 * @example
 * parseEffect('blur(5px) brightness(-0.2) drop-shadow(16px 16px 20px blue)')
 * // => [
 * //   { type: 'blur', value: 5 },
 * //   { type: 'brightness', value: -0.2 },
 * //   { type: 'drop-shadow', x: 16, y: 16, blur: 20, spread: 0, color: 'blue' }
 * // ]
 */
export function parseEffect(filter: string): Effect[] {
  if (!filter || typeof filter !== 'string') {
    return [];
  }

  const filters: FilterObject[] = [];
  let i = 0;
  const len = filter.length;

  // 跳过前导空白
  while (i < len && /\s/.test(filter[i])) {
    i++;
  }

  while (i < len) {
    // 提取 filter 名称（直到遇到 '('）
    const nameStart = i;
    while (i < len && filter[i] !== '(' && !/\s/.test(filter[i])) {
      i++;
    }

    if (i === nameStart) {
      // 没有找到有效的 filter 名称，跳过
      i++;
      continue;
    }

    const name = filter.slice(nameStart, i).trim();

    // 跳过空白
    while (i < len && /\s/.test(filter[i])) {
      i++;
    }

    // 如果下一个字符不是 '('，说明这个名称不完整，跳过
    if (i >= len || filter[i] !== '(') {
      // 可能是 url(#filter-id) 这种情况，尝试继续解析
      i++;
      continue;
    }

    // 跳过 '('
    i++;

    // 提取参数（需要处理嵌套括号，比如 url() 中的内容）
    const paramsStart = i;
    let depth = 1;
    let inString = false;
    let stringChar = '';

    while (i < len && depth > 0) {
      const char = filter[i];

      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        } else if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
        }
      } else {
        if (char === stringChar) {
          // 检查是否是转义的引号（前一个字符不是反斜杠，或者是转义的反斜杠）
          if (
            i === 0 ||
            filter[i - 1] !== '\\' ||
            (i > 1 && filter[i - 2] === '\\')
          ) {
            inString = false;
          }
        }
      }

      if (depth > 0) {
        i++;
      }
    }

    const params = filter.slice(paramsStart, i).trim();

    // 跳过 ')'
    if (i < len && filter[i] === ')') {
      i++;
    }

    filters.push({ name, params });

    // 跳过后续空白
    while (i < len && /\s/.test(filter[i])) {
      i++;
    }
  }

  // Convert filters to effects
  const effects: Effect[] = [];
  for (const filter of filters) {
    if (filter.name === 'blur') {
      const blurParts = filter.params
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const radiusRaw = (blurParts[0] ?? '').replace(/px$/i, '');
      const v = parseFloat(radiusRaw);
      const qRaw =
        blurParts[1] !== undefined ? parseFloat(blurParts[1]) : NaN;
      const cRaw =
        blurParts[2] !== undefined ? parseFloat(blurParts[2]) : NaN;
      effects.push({
        type: 'blur',
        value: Number.isFinite(v) ? v : BLUR_DEFAULTS.value,
        quality: Number.isFinite(qRaw)
          ? Math.max(1, Math.round(qRaw))
          : BLUR_DEFAULTS.quality,
        clamp:
          blurParts[2] !== undefined
            ? Number.isFinite(cRaw)
              ? cRaw > 0.5
              : BLUR_DEFAULTS.clamp
            : BLUR_DEFAULTS.clamp,
      });
    } else if (filter.name === 'brightness') {
      effects.push({
        type: 'brightness',
        value: clampGlfxBrightness(parseFloat(filter.params.trim())),
      });
    } else if (filter.name === 'contrast') {
      effects.push({
        type: 'contrast',
        value: clampGlfxContrast(parseFloat(filter.params.trim())),
      });
    } else if (filter.name === 'saturate') {
      effects.push(
        makeAdjustment({ saturation: parseCssFilterScalar(filter.params) }),
      );
    } else if (filter.name === 'hue-rotate') {
      effects.push({
        type: 'hueSaturation',
        hue: degreesToGlfxHue(parseHueRotateDegrees(filter.params)),
        saturation: 0,
      });
    } else if (filter.name === 'drop-shadow') {
      // drop-shadow 标准格式: offset-x offset-y blur-radius [spread-radius] color
      // 支持 3 个数+颜色(如 5px 5px 15px red) 或 4 个数+颜色
      const parts = filter.params.trim().split(/\s+/);
      const nums: number[] = [];
      let colorStart = 0;
      for (let i = 0; i < parts.length; i++) {
        const num = parseFloat(parts[i]);
        if (!Number.isNaN(num)) {
          nums.push(num);
          colorStart = i + 1;
        } else {
          break;
        }
      }
      const color = parts.slice(colorStart).join(' ').trim() || 'black';
      const [x = 0, y = 0, blur = 0, spread = 0] = nums;
      effects.push({
        type: 'drop-shadow',
        x,
        y,
        blur,
        spread,
        color,
      });
    } else if (filter.name === 'noise') {
      effects.push({ type: 'noise', value: parseFloat(filter.params) });
    } else if (filter.name === 'pixelate') {
      effects.push({
        type: 'pixelate',
        size: parsePixelBlockSize(filter.params),
      });
    } else if (filter.name === 'dot') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const scale = parts[0] !== undefined ? parseFloat(parts[0]) : 1;
      const angle = parts[1] !== undefined ? parseFloat(parts[1]) : 5;
      const g = parts[2] !== undefined ? parseFloat(parts[2]) : 1;
      effects.push({
        type: 'dot',
        scale: Number.isFinite(scale) ? scale : 1,
        angle: Number.isFinite(angle) ? angle : 5,
        grayscale: Number.isFinite(g) ? (g > 0.5 ? 1 : 0) : 1,
      });
    } else if (filter.name === 'color-halftone') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      if (parts.length >= 4) {
        const cx = parseFloat(parts[0]);
        const cy = parseFloat(parts[1]);
        const angle = parseFloat(parts[2]);
        const size = parseFloat(parts[3]);
        effects.push({
          type: 'colorHalftone',
          centerX: Number.isFinite(cx) ? cx : undefined,
          centerY: Number.isFinite(cy) ? cy : undefined,
          angle: Number.isFinite(angle) ? angle : 0,
          size: Number.isFinite(size) && size > 0 ? size : 4,
        });
      } else if (parts.length === 2) {
        const size = parseFloat(parts[0]);
        const angle = parseFloat(parts[1]);
        effects.push({
          type: 'colorHalftone',
          angle: Number.isFinite(angle) ? angle : 0,
          size: Number.isFinite(size) && size > 0 ? size : 4,
        });
      } else {
        const size = parts[0] !== undefined ? parseFloat(parts[0]) : 4;
        effects.push({
          type: 'colorHalftone',
          angle: 0,
          size: Number.isFinite(size) && size > 0 ? size : 4,
        });
      }
    } else if (filter.name === 'halftone-dots') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const HD = HALFTONE_DOTS_DEFAULTS;
      const size = parts[0] !== undefined ? parseFloat(parts[0]) : HD.size;
      const radius = parts[1] !== undefined ? parseFloat(parts[1]) : HD.radius;
      const contrast =
        parts[2] !== undefined ? parseFloat(parts[2]) : HD.contrast;
      let grid = 0;
      if (parts[3] !== undefined) {
        const g = parts[3].toLowerCase();
        if (g === 'hex' || g === '1') {
          grid = 1;
        } else {
          const gn = parseFloat(parts[3]);
          if (Number.isFinite(gn)) {
            grid = gn > 0.5 ? 1 : 0;
          }
        }
      }
      let dotStyle = 0;
      if (parts[4] !== undefined) {
        const t = parts[4].toLowerCase();
        if (t === 'gooey') {
          dotStyle = 1;
        } else if (t === 'holes') {
          dotStyle = 2;
        } else if (t === 'soft') {
          dotStyle = 3;
        } else if (t === 'classic') {
          dotStyle = 0;
        } else {
          const n = parseFloat(parts[4]);
          if (Number.isFinite(n)) {
            dotStyle = Math.max(0, Math.min(3, Math.round(n)));
          }
        }
      }
      let originalColors: boolean | undefined;
      if (parts[5] !== undefined) {
        const p = parts[5].toLowerCase();
        if (p === 'false' || p === '0' || p === 'no') {
          originalColors = false;
        } else if (p === 'true' || p === '1' || p === 'yes') {
          originalColors = true;
        } else {
          const n = parseFloat(parts[5]);
          if (Number.isFinite(n)) {
            originalColors = n > 0.5;
          }
        }
      }
      effects.push({
        type: 'halftoneDots',
        size: Number.isFinite(size) ? size : HD.size,
        radius: Number.isFinite(radius) ? radius : HD.radius,
        contrast: Number.isFinite(contrast) ? contrast : HD.contrast,
        grid,
        dotStyle,
        ...(originalColors !== undefined ? { originalColors } : {}),
      });
    } else if (filter.name === 'fluted-glass') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const D = FLUTED_GLASS_DEFAULTS;
      const pf = (i: number, def: number) => {
        const v = parts[i] !== undefined ? parseFloat(parts[i]) : def;
        return Number.isFinite(v) ? v : def;
      };
      effects.push({
        type: 'flutedGlass',
        size: pf(0, D.size),
        shadows: pf(1, D.shadows),
        angle: pf(2, D.angle),
        stretch: pf(3, D.stretch),
        shape: pf(4, D.shape),
        distortion: pf(5, D.distortion),
        highlights: pf(6, D.highlights),
        distortionShape: pf(7, D.distortionShape),
        shift: pf(8, D.shift),
        blur: pf(9, D.blur),
        edges: pf(10, D.edges),
        marginLeft: pf(11, D.marginLeft),
        marginRight: pf(12, D.marginRight),
        marginTop: pf(13, D.marginTop),
        marginBottom: pf(14, D.marginBottom),
        grainMixer: pf(15, D.grainMixer),
        grainOverlay: pf(16, D.grainOverlay),
      });
    } else if (filter.name === 'tsunami') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const D = TSUNAMI_DEFAULTS;
      const pf = (i: number, def: number) => {
        const v = parts[i] !== undefined ? parseFloat(parts[i]) : def;
        return Number.isFinite(v) ? v : def;
      };
      effects.push({
        type: 'tsunami',
        stripeCount: pf(0, D.stripeCount),
        stripeAngle: pf(1, D.stripeAngle),
        distortion: pf(2, D.distortion),
        reflection: pf(3, D.reflection),
        disturbance: pf(4, D.disturbance),
        contortion: pf(5, D.contortion),
        blend: pf(6, D.blend),
        dispersion: pf(7, D.dispersion),
        drift: pf(8, D.drift),
        shadowIntensity: pf(9, D.shadowIntensity),
        offset: pf(10, D.offset),
      });
    } else if (filter.name === 'rain') {
      const raw = filter.params.trim();
      const fxEffect = parseRainFxFilterParams(raw);
      if (fxEffect) {
        effects.push(fxEffect);
      } else if (raw.length === 0) {
        effects.push(createDefaultRainEffect());
      } else {
        const urlPair = parseRainDropTextureUrls(raw);
        if (urlPair) {
          const parts = urlPair.numericTail.length
            ? urlPair.numericTail
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
            : [];
          const RD = RAIN_DEFAULTS;
          const parsed = parseCodropsRainNumericTail(parts);
          effects.push({
            type: 'rain',
            dropColorUrl: urlPair.dropColorUrl,
            dropAlphaUrl: urlPair.dropAlphaUrl,
            dropShineUrl: urlPair.dropShineUrl,
            rainSimScale: parsed.rainSimScale,
            codropsSim: parsed.codropsSim,
            codropsWater: parsed.codropsWater,
            minRefraction: RD.minRefraction,
            refractionDelta: RD.refractionDelta,
            brightness: RD.brightness,
            density: RD.density,
            alphaMultiply: RD.alphaMultiply,
            alphaSubtract: RD.alphaSubtract,
            streakCount: RD.streakCount,
            dropScale: RD.dropScale,
            renderShadow: RD.renderShadow,
            renderShine: RD.renderShine,
          });
        } else {
          console.warn(
            'rain(): unrecognized parameters; using default raindrop-fx rain()',
          );
          effects.push(createDefaultRainEffect());
        }
      }
    } else if (filter.name === 'burn') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const D = BURN_DEFAULTS;
      const pf = (i: number, def: number) => {
        const v = parts[i] !== undefined ? parseFloat(parts[i]) : def;
        return Number.isFinite(v) ? v : def;
      };
      let edgeColor: string = D.edgeColor;
      let maskColor: string = D.maskColor;
      if (parts.length >= 7) {
        edgeColor = parts[5]!.trim();
        maskColor = parts[6]!.trim();
      }
      let invertMask: boolean = D.invertMask;
      if (parts[7] !== undefined) {
        invertMask = parseFloat(parts[7]) > 0.5;
      }
      let transparent: boolean = D.transparent;
      if (parts[8] !== undefined) {
        transparent = parseFloat(parts[8]) > 0.5;
      }
      effects.push({
        type: 'burn',
        burn: pf(0, D.burn),
        density: pf(1, D.density),
        softness: pf(2, D.softness),
        dispersion: pf(3, D.dispersion),
        distortion: pf(4, D.distortion),
        edgeColor,
        maskColor,
        invertMask,
        transparent,
      });
    } else if (filter.name === 'crt') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const D = CRT_DEFAULTS;
      const pf = (i: number, def: number) => {
        const v = parts[i] !== undefined ? parseFloat(parts[i]) : def;
        return Number.isFinite(v) ? v : def;
      };
      const n = parts.length;
      /** Legacy 11-arg Pixi (`time` at index 7); 8-arg had trailing vignette (ignored here). New: 5 args, `time` at 4. */
      const timeIdx = n >= 11 ? 7 : 4;
      let useEngineTime = false;
      let time: number = D.time;
      const timeToken = parts[timeIdx]?.trim().toLowerCase();
      if (timeToken === 'auto' || timeToken === 'engine') {
        useEngineTime = true;
      } else {
        time = pf(timeIdx, D.time);
      }
      effects.push({
        type: 'crt',
        curvature: pf(0, D.curvature),
        lineWidth: pf(1, D.lineWidth),
        lineContrast: pf(2, D.lineContrast),
        verticalLine: pf(3, D.verticalLine),
        time,
        ...(useEngineTime ? { useEngineTime: true } : {}),
      });
    } else if (filter.name === 'vignette') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const D = VIGNETTE_DEFAULTS;
      const pf = (i: number, def: number) => {
        const v = parts[i] !== undefined ? parseFloat(parts[i]) : def;
        return Number.isFinite(v) ? v : def;
      };
      effects.push({
        type: 'vignette',
        size: pf(0, D.size),
        amount: pf(1, D.amount),
      });
    } else if (filter.name === 'ascii') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const D = ASCII_DEFAULTS;
      const pf = (i: number, def: number) => {
        const v = parts[i] !== undefined ? parseFloat(parts[i]) : def;
        return Number.isFinite(v) ? v : def;
      };
      const size = Math.max(1, pf(0, D.size));
      let replaceColor: boolean = D.replaceColor;
      if (parts[1] !== undefined) {
        replaceColor = parseFloat(parts[1]) > 0.5;
      }
      let color: string = D.color;
      if (parts.length >= 3) {
        color = parts.slice(2).join(',').trim();
      }
      effects.push({
        type: 'ascii',
        size,
        replaceColor,
        color,
      });
    } else if (filter.name === 'glitch') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const D = GLITCH_DEFAULTS;
      const pf = (i: number, def: number) => {
        const v = parts[i] !== undefined ? parseFloat(parts[i]) : def;
        return Number.isFinite(v) ? v : def;
      };
      /** Omitted time arg → engine time (animated), per {@link GLITCH_DEFAULTS}. */
      let useEngineTime = parts.length < 3;
      let time: number = D.time;
      if (parts.length >= 3) {
        const rawT = parts[2]!.trim().toLowerCase();
        if (rawT === 'auto' || rawT === 'engine') {
          useEngineTime = true;
        } else {
          const tv = parseFloat(parts[2]!);
          if (Number.isFinite(tv)) {
            useEngineTime = false;
            time = tv;
          }
        }
      }
      const blocks =
        parts.length >= 4 ? pf(3, D.blocks) : D.blocks;
      effects.push({
        type: 'glitch',
        jitter: parts[0] !== undefined ? pf(0, D.jitter) : D.jitter,
        blocks,
        rgbSplit: parts[1] !== undefined ? pf(1, D.rgbSplit) : D.rgbSplit,
        time,
        ...(useEngineTime ? { useEngineTime: true } : {}),
      });
    } else if (filter.name === 'liquid-glass') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const D = LIQUID_GLASS_DEFAULTS;
      const pf = (i: number, def: number) => {
        const v = parts[i] !== undefined ? parseFloat(parts[i]) : def;
        return Number.isFinite(v) ? v : def;
      };
      effects.push({
        type: 'liquidGlass',
        powerFactor: pf(0, D.powerFactor),
        fPower: pf(1, D.fPower),
        noise: pf(2, D.noise),
        glowWeight: pf(3, D.glowWeight),
        glowBias: pf(4, D.glowBias),
        glowEdge0: pf(5, D.glowEdge0),
        glowEdge1: pf(6, D.glowEdge1),
        a: pf(7, D.a),
        b: pf(8, D.b),
        c: pf(9, D.c),
        d: pf(10, D.d),
        centerX: pf(11, D.centerX),
        centerY: pf(12, D.centerY),
        scaleX: pf(13, D.scaleX),
        scaleY: pf(14, D.scaleY),
        ellipseSizeX: pf(15, D.ellipseSizeX),
        ellipseSizeY: pf(16, D.ellipseSizeY),
      });
    } else if (filter.name === 'liquid-metal') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const D = LIQUID_METAL_DEFAULTS;
      const pf = (i: number, def: number) => {
        const v = parts[i] !== undefined ? parseFloat(parts[i]) : def;
        return Number.isFinite(v) ? v : def;
      };
      let colorBack: string = D.colorBack;
      let colorTint: string = D.colorTint;
      if (parts.length >= 11) {
        colorBack = parts[9]!.trim();
        colorTint = parts[10]!.trim();
      } else if (parts.length === 10) {
        colorBack = parts[9]!.trim();
      }
      let useImage: boolean = D.useImage;
      if (parts.length > 8) {
        useImage = parseFloat(parts[8]!) > 0.5;
      }
      let useEngineTime = false;
      let time: number = D.time;
      if (parts.length >= 12) {
        const rawT = parts[11]!.trim().toLowerCase();
        if (rawT === 'auto' || rawT === 'engine') {
          useEngineTime = true;
        } else {
          const tv = parseFloat(parts[11]!);
          time = Number.isFinite(tv) ? tv : D.time;
        }
      } else if (D.useEngineTime) {
        useEngineTime = true;
      }
      const shape = Math.max(0, Math.min(4, Math.floor(pf(7, D.shape))));
      let usePoisson: boolean = D.usePoisson;
      if (parts.length > 12) {
        usePoisson = parseFloat(parts[12]!) > 0.5;
      }
      effects.push({
        type: 'liquidMetal',
        repetition: pf(0, D.repetition),
        softness: pf(1, D.softness),
        shiftRed: pf(2, D.shiftRed),
        shiftBlue: pf(3, D.shiftBlue),
        distortion: pf(4, D.distortion),
        contour: pf(5, D.contour),
        angle: pf(6, D.angle),
        shape,
        useImage,
        colorBack,
        colorTint,
        time,
        usePoisson,
        ...(useEngineTime ? { useEngineTime: true } : {}),
      });
    } else if (filter.name === 'heat-map' || filter.name === 'heatmap') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const D = HEATMAP_DEFAULTS;
      const pf = (i: number, def: number) => {
        const v = parts[i] !== undefined ? parseFloat(parts[i]!) : def;
        return Number.isFinite(v) ? v : def;
      };
      let useImage: boolean = D.useImage;
      if (parts.length > 5) {
        useImage = parseFloat(parts[5]!) > 0.5;
      }
      let usePreprocess: boolean = D.usePreprocess;
      if (parts.length > 6) {
        usePreprocess = parseFloat(parts[6]!) > 0.5;
      }
      let useEngineTime = false;
      let time: number = D.time;
      if (parts.length > 7) {
        const rawT = parts[7]!.trim().toLowerCase();
        if (rawT === 'auto' || rawT === 'engine') {
          useEngineTime = true;
        } else {
          const tv = parseFloat(parts[7]!);
          time = Number.isFinite(tv) ? tv : D.time;
        }
      }
      let colorBack: string = D.colorBack;
      const gradColors: string[] = [];
      if (parts.length > 8) {
        colorBack = parts[8]!.trim();
        for (let c = 9; c < parts.length && c < 8 + 10; c++) {
          gradColors.push(parts[c]!.trim());
        }
      }
      effects.push({
        type: 'heatmap',
        contour: pf(0, D.contour),
        angle: pf(1, D.angle),
        noise: pf(2, D.noise),
        innerGlow: pf(3, D.innerGlow),
        outerGlow: pf(4, D.outerGlow),
        useImage,
        usePreprocess,
        time,
        colorBack,
        colors: gradColors.length > 0 ? gradColors : [...D.colors],
        ...(useEngineTime ? { useEngineTime: true } : {}),
      });
    } else if (filter.name === 'gem-smoke' || filter.name === 'gemSmoke') {
      const raw = filter.params.trim();
      const parts = raw.length
        ? raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const D = GEM_SMOKE_DEFAULTS;
      const pf = (i: number, def: number) => {
        const v = parts[i] !== undefined ? parseFloat(parts[i]!) : def;
        return Number.isFinite(v) ? v : def;
      };
      let useImage: boolean = D.useImage;
      if (parts.length > 8) {
        useImage = parseFloat(parts[8]!) > 0.5;
      }
      let usePoisson: boolean = D.usePoisson;
      if (parts.length > 9) {
        usePoisson = parseFloat(parts[9]!) > 0.5;
      }
      let useEngineTime = false;
      let time: number = D.time;
      if (parts.length > 10) {
        const rawT = parts[10]!.trim().toLowerCase();
        if (rawT === 'auto' || rawT === 'engine') {
          useEngineTime = true;
        } else {
          const tv = parseFloat(parts[10]!);
          time = Number.isFinite(tv) ? tv : D.time;
        }
      }
      let colorBack: string = D.colorBack;
      let colorInner: string = D.colorInner;
      const gradColors: string[] = [];
      if (parts.length > 11) {
        colorBack = parts[11]!.trim();
      }
      if (parts.length > 12) {
        colorInner = parts[12]!.trim();
        for (let c = 13; c < parts.length && c < 13 + 6; c++) {
          gradColors.push(parts[c]!.trim());
        }
      }
      effects.push({
        type: 'gemSmoke',
        innerDistortion: pf(0, D.innerDistortion),
        outerDistortion: pf(1, D.outerDistortion),
        outerGlow: pf(2, D.outerGlow),
        innerGlow: pf(3, D.innerGlow),
        offset: pf(4, D.offset),
        angle: pf(5, D.angle),
        size: pf(6, D.size),
        shape: Math.max(0, Math.min(4, Math.floor(pf(7, D.shape)))),
        useImage,
        usePoisson,
        time,
        colorBack,
        colorInner,
        colors: gradColors.length > 0 ? gradColors : [...D.colors],
        ...(useEngineTime ? { useEngineTime: true } : {}),
      });
    } else if (filter.name === 'lut' || filter.name === 'LUT') {
      const parsed = parseLutFilterParams(filter.params);
      if (parsed && parsed.lutKey.length > 0) {
        effects.push({
          type: 'lut',
          lutKey: parsed.lutKey,
          strength: parsed.strength,
        });
      }
    } else if (filter.name === 'fxaa') {
      effects.push({ type: 'fxaa' });
    }
  }

  return effects;
}

/**
 * True when the filter string includes CRT with `useEngineTime` / `time: auto`, which must
 * redraw every frame even if no component changes (see {@link MeshPipeline}).
 */
export function filterStringUsesEngineTimeCrt(
  filterValue: string | undefined | null,
): boolean {
  if (filterValue == null || !String(filterValue).trim()) {
    return false;
  }
  for (const e of parseEffect(filterValue)) {
    if (e.type === 'crt' && e.useEngineTime) {
      return true;
    }
  }
  return false;
}

/** True when the filter string uses glitch with engine time (`auto`), for continuous redraw. */
export function filterStringUsesEngineTimeGlitch(
  filterValue: string | undefined | null,
): boolean {
  if (filterValue == null || !String(filterValue).trim()) {
    return false;
  }
  for (const e of parseEffect(filterValue)) {
    if (e.type === 'glitch' && e.useEngineTime) {
      return true;
    }
  }
  return false;
}

/** CRT or glitch with `useEngineTime` — either needs {@link PostEffectTime} + per-frame render. */
export function filterStringUsesEngineTimePost(
  filterValue: string | undefined | null,
): boolean {
  if (filterValue == null || !String(filterValue).trim()) {
    return false;
  }
  for (const e of parseEffect(filterValue)) {
    if (e.type === 'liquidMetal' && e.useEngineTime) {
      return true;
    }
    if (e.type === 'heatmap' && e.useEngineTime) {
      return true;
    }
    if (e.type === 'gemSmoke' && e.useEngineTime) {
      return true;
    }
    if (e.type === 'rain') {
      return true;
    }
  }
  return (
    filterStringUsesEngineTimeCrt(filterValue) ||
    filterStringUsesEngineTimeGlitch(filterValue)
  );
}

/**
 * Serialize supported effects to a `filter` string (round-trip with {@link parseEffect} for supported types).
 * `brightness` / `contrast` write glfx offsets directly (not CSS multipliers).
 * Unknown or partially-supported `adjustment` entries are omitted.
 */
export function formatFilter(effects: Effect[]): string {
  if (!effects.length) {
    return '';
  }
  const parts: string[] = [];
  for (const effect of effects) {
    switch (effect.type) {
      case 'brightness':
        parts.push(`brightness(${effect.value})`);
        break;
      case 'contrast':
        parts.push(`contrast(${effect.value})`);
        break;
      case 'noise':
        parts.push(`noise(${effect.value})`);
        break;
      case 'pixelate':
        parts.push(`pixelate(${effect.size}px)`);
        break;
      case 'dot':
        parts.push(
          `dot(${effect.scale}, ${effect.angle}, ${effect.grayscale})`,
        );
        break;
      case 'colorHalftone':
        if (
          effect.centerX !== undefined &&
          effect.centerY !== undefined
        ) {
          parts.push(
            `color-halftone(${effect.centerX}, ${effect.centerY}, ${effect.angle}, ${effect.size})`,
          );
        } else {
          const a = effect.angle;
          const hasAngle =
            Number.isFinite(a) && Math.abs(a) > 1e-6;
          if (hasAngle) {
            parts.push(`color-halftone(${effect.size}, ${a})`);
          } else {
            parts.push(`color-halftone(${effect.size})`);
          }
        }
        break;
      case 'halftoneDots': {
        const oc = effect.originalColors === false ? 0 : 1;
        parts.push(
          `halftone-dots(${effect.size}, ${effect.radius}, ${effect.contrast}, ${effect.grid}, ${effect.dotStyle}, ${oc})`,
        );
        break;
      }
      case 'flutedGlass': {
        const e = effect;
        parts.push(
          `fluted-glass(${e.size}, ${e.shadows}, ${e.angle}, ${e.stretch}, ${e.shape}, ${e.distortion}, ${e.highlights}, ${e.distortionShape}, ${e.shift}, ${e.blur}, ${e.edges}, ${e.marginLeft}, ${e.marginRight}, ${e.marginTop}, ${e.marginBottom}, ${e.grainMixer}, ${e.grainOverlay})`,
        );
        break;
      }
      case 'tsunami': {
        const e = effect;
        parts.push(
          `tsunami(${e.stripeCount}, ${e.stripeAngle}, ${e.distortion}, ${e.reflection}, ${e.disturbance}, ${e.contortion}, ${e.blend}, ${e.dispersion}, ${e.drift}, ${e.shadowIntensity}, ${e.offset})`,
        );
        break;
      }
      case 'rain': {
        const e = effect;
        if (isRainFxEffect(e)) {
          const esc = (u: string) =>
            `url("${u.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
          const tail = formatRainFxNumericTail(e);
          const url = e.dropTextureUrl ?? RAIN_DROPDROP_TEXTURE_DEFAULT;
          if (url === RAIN_DROPDROP_TEXTURE_DEFAULT && !tail) {
            parts.push('rain()');
          } else if (url === RAIN_DROPDROP_TEXTURE_DEFAULT) {
            parts.push(`rain(${tail.replace(/^\s*,\s*/, '')})`);
          } else {
            parts.push(`rain(${esc(url)}${tail})`);
          }
        } else if (isDefaultRainCodropsEffect(e)) {
          parts.push('rain()');
        } else if (isRainCodropsRainEffect(e)) {
          const esc = (u: string) =>
            `url("${u.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
          const W = { ...RAINDROPS_WATER_DEFAULTS, ...e.codropsWater };
          const S = { ...RAINDROPS_SIM_DEFAULTS, ...e.codropsSim };
          const ss = e.rainSimScale ?? 1;
          const urlParts = [esc(e.dropColorUrl), esc(e.dropAlphaUrl)];
          const shine = e.dropShineUrl?.trim();
          if (shine) {
            urlParts.push(esc(shine));
          }
          parts.push(
            `rain(${urlParts.join(', ')}, ${W.minRefraction}, ${W.maxRefraction}, ${W.brightness}, ${W.alphaMultiply}, ${W.alphaSubtract}, ${W.renderShadow ? 1 : 0}, ${W.renderShine ? 1 : 0}, ${ss}, ${S.rainChance}, ${S.rainLimit}, ${S.maxDrops}, ${S.dropletsRate})`,
          );
        } else {
          const sh = e.renderShadow ? 1 : 0;
          const shn = e.renderShine ? 1 : 0;
          parts.push(
            `rain(${e.minRefraction}, ${e.refractionDelta}, ${e.brightness}, ${e.density}, ${e.alphaMultiply}, ${e.alphaSubtract}, ${e.streakCount}, ${e.dropScale}, ${sh}, ${shn})`,
          );
        }
        break;
      }
      case 'burn': {
        const e = effect;
        parts.push(
          `burn(${e.burn}, ${e.density}, ${e.softness}, ${e.dispersion}, ${e.distortion}, ${cssColorToHex(e.edgeColor)}, ${cssColorToHex(e.maskColor)}, ${e.invertMask ? 1 : 0}, ${e.transparent ? 1 : 0})`,
        );
        break;
      }
      case 'crt': {
        const e = effect;
        const timeParam = e.useEngineTime ? 'auto' : e.time;
        parts.push(
          `crt(${e.curvature}, ${e.lineWidth}, ${e.lineContrast}, ${e.verticalLine}, ${timeParam})`,
        );
        break;
      }
      case 'vignette': {
        const e = effect;
        parts.push(`vignette(${e.size}, ${e.amount})`);
        break;
      }
      case 'ascii': {
        const e = effect;
        const rep = e.replaceColor ? 1 : 0;
        parts.push(`ascii(${e.size}, ${rep}, ${cssColorToHex(e.color)})`);
        break;
      }
      case 'glitch': {
        const e = effect;
        const timeParam = e.useEngineTime ? 'auto' : e.time;
        parts.push(
          `glitch(${e.jitter}, ${e.rgbSplit}, ${timeParam}, ${e.blocks})`,
        );
        break;
      }
      case 'liquidGlass': {
        const e = effect;
        parts.push(
          `liquid-glass(${e.powerFactor}, ${e.fPower}, ${e.noise}, ${e.glowWeight}, ${e.glowBias}, ${e.glowEdge0}, ${e.glowEdge1}, ${e.a}, ${e.b}, ${e.c}, ${e.d}, ${e.centerX}, ${e.centerY}, ${e.scaleX}, ${e.scaleY}, ${e.ellipseSizeX}, ${e.ellipseSizeY})`,
        );
        break;
      }
      case 'liquidMetal': {
        const e = effect;
        const timeParam = e.useEngineTime ? 'auto' : e.time;
        const pois = e.usePoisson !== false ? 1 : 0;
        parts.push(
          `liquid-metal(${e.repetition}, ${e.softness}, ${e.shiftRed}, ${e.shiftBlue}, ${e.distortion}, ${e.contour}, ${e.angle}, ${e.shape}, ${e.useImage ? 1 : 0}, ${cssColorToHex(e.colorBack)}, ${cssColorToHex(e.colorTint)}, ${timeParam}, ${pois})`,
        );
        break;
      }
      case 'heatmap': {
        const e = effect;
        const timeParam = e.useEngineTime ? 'auto' : e.time;
        const pre = e.usePreprocess !== false ? 1 : 0;
        const grad = (e.colors?.length ? e.colors : [...HEATMAP_DEFAULTS.colors])
          .map((s) => cssColorToHex(s))
          .join(', ');
        parts.push(
          `heat-map(${e.contour}, ${e.angle}, ${e.noise}, ${e.innerGlow}, ${e.outerGlow}, ${e.useImage ? 1 : 0}, ${pre}, ${timeParam}, ${cssColorToHex(e.colorBack)}, ${grad})`,
        );
        break;
      }
      case 'gemSmoke': {
        const e = effect;
        const timeParam = e.useEngineTime ? 'auto' : e.time;
        const pois = e.usePoisson !== false ? 1 : 0;
        const grad = (e.colors?.length ? e.colors : [...GEM_SMOKE_DEFAULTS.colors])
          .map((s) => cssColorToHex(s))
          .join(', ');
        parts.push(
          `gem-smoke(${e.innerDistortion}, ${e.outerDistortion}, ${e.outerGlow}, ${e.innerGlow}, ${e.offset}, ${e.angle}, ${e.size}, ${e.shape}, ${e.useImage ? 1 : 0}, ${pois}, ${timeParam}, ${cssColorToHex(e.colorBack)}, ${cssColorToHex(e.colorInner)}, ${grad})`,
        );
        break;
      }
      case 'lut': {
        parts.push(formatLutFilterSegment(effect.lutKey, effect.strength));
        break;
      }
      case 'fxaa':
        parts.push('fxaa()');
        break;
      case 'blur': {
        const q = effect.quality ?? BLUR_DEFAULTS.quality;
        const clamp = effect.clamp !== false;
        const qDef = q === BLUR_DEFAULTS.quality;
        const cDef = clamp === BLUR_DEFAULTS.clamp;
        if (qDef && cDef) {
          parts.push(`blur(${effect.value}px)`);
        } else if (cDef) {
          parts.push(`blur(${effect.value}px, ${q})`);
        } else {
          parts.push(`blur(${effect.value}px, ${q}, ${clamp ? 1 : 0})`);
        }
        break;
      }
      case 'drop-shadow': {
        const { x, y, blur, spread, color } = effect;
        parts.push(
          `drop-shadow(${x}px ${y}px ${blur}px ${spread}px ${color})`,
        );
        break;
      }
      case 'adjustment': {
        const e = effect;
        const d = ADJUSTMENT_DEFAULTS;
        const onlySat =
          e.gamma === d.gamma &&
          e.contrast === d.contrast &&
          e.brightness === d.brightness &&
          e.red === d.red &&
          e.green === d.green &&
          e.blue === d.blue &&
          e.alpha === d.alpha;
        if (onlySat) {
          parts.push(`saturate(${e.saturation})`);
        }
        break;
      }
      case 'hueSaturation': {
        const { hue, saturation } = effect;
        if (hue !== 0) {
          parts.push(`hue-rotate(${hue * 180}deg)`);
        }
        if (saturation !== 0) {
          parts.push(`saturate(${glfxSaturationToPixi(saturation)})`);
        }
        break;
      }
      default:
        break;
    }
  }
  return parts.join(' ');
}

/** Pixi-style saturation multiplier for a new saturate-only `adjustment` row. */
export const SATURATE_ADJUSTMENT_SATURATION = 1.25;

/**
 * Picker value when adding an effect row in UI (`saturate` maps to `adjustment` with only
 * {@link SATURATE_ADJUSTMENT_SATURATION} changed).
 */
export type DefaultEffectKind =
  | 'brightness'
  | 'contrast'
  | 'saturate'
  | 'noise'
  | 'fxaa'
  | 'blur'
  | 'pixelate'
  | 'dot'
  | 'colorHalftone'
  | 'halftoneDots'
  | 'flutedGlass'
  | 'crt'
  | 'vignette'
  | 'ascii'
  | 'glitch'
  | 'liquidGlass'
  | 'liquidMetal'
  | 'heatmap'
  | 'gemSmoke'
  | 'lut'
  | 'tsunami'
  | 'rain'
  | 'burn';

/** Default {@link Effect} for a new row (effects panel / authoring). */
export function createDefaultEffect(kind: DefaultEffectKind): Effect {
  switch (kind) {
    case 'brightness':
      return { type: 'brightness', value: 0 };
    case 'contrast':
      return { type: 'contrast', value: 0 };
    case 'noise':
      return { type: 'noise', value: 0.1 };
    case 'fxaa':
      return { type: 'fxaa' };
    case 'blur':
      return {
        type: 'blur',
        value: BLUR_DEFAULTS.value,
        quality: BLUR_DEFAULTS.quality,
        clamp: BLUR_DEFAULTS.clamp,
      };
    case 'pixelate':
      return { type: 'pixelate', size: 8 };
    case 'dot':
      return { type: 'dot', scale: 1, angle: 5, grayscale: 1 };
    case 'colorHalftone':
      return { type: 'colorHalftone', angle: 0, size: 5 };
    case 'halftoneDots':
      return {
        type: 'halftoneDots',
        size: HALFTONE_DOTS_DEFAULTS.size,
        radius: HALFTONE_DOTS_DEFAULTS.radius,
        contrast: HALFTONE_DOTS_DEFAULTS.contrast,
        grid: HALFTONE_DOTS_DEFAULTS.grid,
        dotStyle: HALFTONE_DOTS_DEFAULTS.dotStyle,
        originalColors: HALFTONE_DOTS_DEFAULTS.originalColors,
      };
    case 'flutedGlass':
      return { type: 'flutedGlass', ...FLUTED_GLASS_DEFAULTS };
    case 'crt':
      return { type: 'crt', ...CRT_DEFAULTS, useEngineTime: false };
    case 'vignette':
      return { type: 'vignette', ...VIGNETTE_DEFAULTS };
    case 'ascii':
      return { type: 'ascii', ...ASCII_DEFAULTS };
    case 'glitch':
      return {
        type: 'glitch',
        ...GLITCH_DEFAULTS,
        useEngineTime: true,
      };
    case 'liquidGlass':
      return { type: 'liquidGlass', ...LIQUID_GLASS_DEFAULTS };
    case 'tsunami':
      return { type: 'tsunami', ...TSUNAMI_DEFAULTS };
    case 'rain':
      return createDefaultRainEffect();
    case 'burn':
      return { type: 'burn', ...BURN_DEFAULTS };
    case 'liquidMetal':
      return { type: 'liquidMetal', ...LIQUID_METAL_DEFAULTS };
    case 'heatmap':
      return {
        type: 'heatmap',
        ...HEATMAP_DEFAULTS,
        colors: [...HEATMAP_DEFAULTS.colors],
        useEngineTime: true,
      };
    case 'gemSmoke':
      return {
        type: 'gemSmoke',
        ...GEM_SMOKE_DEFAULTS,
        colors: [...GEM_SMOKE_DEFAULTS.colors],
        useEngineTime: true,
      };
    case 'lut':
      return { ...LUT_EFFECT_DEFAULTS };
    case 'saturate':
      return {
        type: 'adjustment',
        ...ADJUSTMENT_DEFAULTS,
        saturation: SATURATE_ADJUSTMENT_SATURATION,
      };
    default:
      return { type: 'brightness', value: 0 };
  }
}
