/**
 * CSS Filter / Effect
 */
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
    } else if (filter.name === 'fxaa') {
      effects.push({ type: 'fxaa' });
    }
  }

  return effects;
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
