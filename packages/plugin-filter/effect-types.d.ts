/**
 * Filter effect type definitions shared with `@infinite-canvas-tutorial/ecs`.
 * Source of truth for runtime: `packages/plugin-filter/src/filter.ts`.
 * Keep in sync when adding effect types.
 */

export type RainFxParams = RainFxRenderOptions;
/** raindrop-fx simulator overrides ({@link RAINDROP_FX_SIM_DEFAULTS} when omitted). */
export type RainFxSimParams = Partial<{
  spawnInterval: number;
  spawnSize: number;
  motionInterval: number;
  trailDistance: number;
  gravity: number;
  spawnLimit: number;
  trailDropDensity: number;
  trailSpread: number;
  xShifting: number;
  slipRate: number;
}>;
export interface FilterObject {
    name: string;
    params: string;
}

export type Effect = BrightnessEffect | ContrastEffect | HueSaturationEffect | PixelateEffect | DotEffect | ColorHalftoneEffect | HalftoneDotsEffect | FlutedGlassEffect | TsunamiEffect | RainEffect | BurnEffect | CrtEffect | VignetteEffect | AsciiEffect | GlitchEffect | LiquidGlassEffect | LiquidMetalEffect | HeatmapEffect | GemSmokeEffect | LutEffect | AdjustmentEffect | DropShadowEffect | BlurEffect | NoiseEffect | FXAA;
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

export interface BrightnessEffect {
    type: 'brightness';
    value: number;
}

export interface ContrastEffect {
    type: 'contrast';
    value: number;
}

export interface HueSaturationEffect {
    type: 'hueSaturation';
    hue: number;
    saturation: number;
}

export interface PixelateEffect {
    type: 'pixelate';
    size: number;
}

export interface DotEffect {
    type: 'dot';
    scale: number;
    angle: number;
    /** 1 = grayscale halftone, 0 = color */
    grayscale: number;
}

export interface ColorHalftoneEffect {
    type: 'colorHalftone';
    centerX?: number;
    centerY?: number;
    angle: number;
    size: number;
}

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

export type RainCodropsWaterParams = {
    minRefraction?: number;
    maxRefraction?: number;
    brightness?: number;
    alphaMultiply?: number;
    alphaSubtract?: number;
    renderShadow?: boolean;
    renderShine?: boolean;
};

export type RainCodropsSimParams = {
    rainChance?: number;
    rainLimit?: number;
    maxDrops?: number;
    dropletsRate?: number;
};

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

export type RaindropsCodropsSimOptions = {
    rainChance: number;
    rainLimit: number;
    maxDrops: number;
    dropletsRate: number;
};

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

export interface VignetteEffect {
    type: 'vignette';
    /** 0 = center of frame, 1 = edge */
    size: number;
    /** 0 = no darkening, 1 = max */
    amount: number;
}

export interface AsciiEffect {
    type: 'ascii';
    /** Cell size in pixels (`uSize`) */
    size: number;
    /** Solid `color` for glyphs vs sampled tint (`uReplaceColor`) */
    replaceColor: boolean;
    /** CSS color when replacing */
    color: string;
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
    /** Blur strength in pixels (Pixi `strength`). */
    value: number;
    /** Pass count / kernel steps; integer ≥ 1. */
    quality?: number;
    /** Clamp UVs to filter bounds (reduces edge bleed). */
    clamp?: boolean;
    /** Per-axis pixel scale; larger = blurrier. */
    pixelSize?: number | {
        x: number;
        y: number;
    };
}

export interface NoiseEffect {
    type: 'noise';
    value: number;
}

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

export interface LutEffect {
    type: 'lut';
    /** Cache key: logical name (e.g. `fuji`) or same string as in `url("…")`. */
    lutKey: string;
    strength: number;
}

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

export interface FXAA {
    type: 'fxaa';
}

export type DefaultEffectKind = 'brightness' | 'contrast' | 'saturate' | 'noise' | 'fxaa' | 'blur' | 'pixelate' | 'dot' | 'colorHalftone' | 'halftoneDots' | 'flutedGlass' | 'crt' | 'vignette' | 'ascii' | 'glitch' | 'liquidGlass' | 'liquidMetal' | 'heatmap' | 'gemSmoke' | 'lut' | 'tsunami' | 'rain' | 'burn';
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

export type RaindropFxBackgroundWrapMode = 'clamp' | 'repeat' | 'mirror';
export type RaindropFxComposeMode = 'smoother' | 'harder';