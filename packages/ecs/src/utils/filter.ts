/**
 * CSS Filter / Effect
 */
import { cssColorToHex, parseColor } from './color';
import { getPostEffectEngineTimeSeconds } from './postEffectEngineTime';

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
  | CrtEffect
  | VignetteEffect
  | AsciiEffect
  | GlitchEffect
  | LiquidGlassEffect
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

/** Uniform packing for {@link HalftoneDotsEffect} (5 × vec4, std140). */
export function halftoneDotsUniformValues(
  effect: HalftoneDotsEffect,
  textureWidth: number,
  textureHeight: number,
): number[] {
  const tw = Math.max(1, textureWidth);
  const th = Math.max(1, textureHeight);
  let size = Number.isFinite(effect.size) ? effect.size : 0.5;
  size = Math.max(0, Math.min(1, size));
  let radius = Number.isFinite(effect.radius) ? effect.radius : 0.5;
  radius = Math.max(0, Math.min(2, radius));
  let contrast = Number.isFinite(effect.contrast) ? effect.contrast : 0.5;
  contrast = Math.max(0, Math.min(1, contrast));
  let grid = Number.isFinite(effect.grid) ? effect.grid : 0;
  grid = grid > 0.5 ? 1 : 0;
  let dotStyle = Number.isFinite(effect.dotStyle) ? effect.dotStyle : 0;
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
  stripeCount: 32,
  /** Degrees; converted to radians for the GPU. */
  stripeAngle: 0,
  distortion: 1,
  reflection: 0.2,
  disturbance: 0.15,
  contortion: 0.1,
  /** 0/1 — modulate highlight with luminance when 1. */
  blend: 0,
  dispersion: 0.15,
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

export interface BlurEffect {
  type: 'blur';
  value: number;
}

export interface NoiseEffect {
  type: 'noise';
  value: number;
}

/** Digital block glitch + RGB split; `filter` e.g. `glitch(0.45, 0.004, auto, 0.35)` — jitter, rgbSplit, time, blocks. */
export const GLITCH_DEFAULTS = {
  jitter: 0.45,
  /** 0–1 digital block glitch strength (independent of {@link jitter}). */
  blocks: 0,
  rgbSplit: 0.004,
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

export interface FXAA {
  type: 'fxaa';
}

/** Effect types implemented by {@link Drawcall.createPostProcessing} raster chain (see `FRAG_MAP`). */
const RASTER_POST_EFFECT_TYPES = new Set<Effect['type']>([
  'noise',
  'brightness',
  'contrast',
  'pixelate',
  'dot',
  'colorHalftone',
  'halftoneDots',
  'flutedGlass',
  'tsunami',
  'crt',
  'vignette',
  'ascii',
  'glitch',
  'liquidGlass',
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
      effects.push({ type: 'blur', value: parseFloat(filter.params) });
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
      const size = parts[0] !== undefined ? parseFloat(parts[0]) : 0.5;
      const radius = parts[1] !== undefined ? parseFloat(parts[1]) : 0.5;
      const contrast = parts[2] !== undefined ? parseFloat(parts[2]) : 0.5;
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
        size: Number.isFinite(size) ? size : 0.5,
        radius: Number.isFinite(radius) ? radius : 0.5,
        contrast: Number.isFinite(contrast) ? contrast : 0.5,
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
      let useEngineTime = false;
      let time: number = D.time;
      if (parts.length >= 3) {
        const rawT = parts[2]!.trim().toLowerCase();
        if (rawT === 'auto' || rawT === 'engine') {
          useEngineTime = true;
        } else {
          const tv = parseFloat(parts[2]!);
          time = Number.isFinite(tv) ? tv : D.time;
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
      case 'fxaa':
        parts.push('fxaa()');
        break;
      case 'blur':
        parts.push(`blur(${effect.value}px)`);
        break;
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
