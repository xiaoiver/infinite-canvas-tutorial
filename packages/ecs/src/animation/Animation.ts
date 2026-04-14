import type {
  AbsoluteArray,
  CurveArray,
  PathArray,
  PathSegment,
} from '@antv/util';
import {
  clonePath,
  equalizeSegments,
  getDrawDirection,
  getRotatedCurve,
  normalizePath,
  path2Curve,
  path2String,
  reverseCurve,
} from '@antv/util';
import { color as parseD3Color } from 'd3-color';
import { PathSerializedNode } from '../types/serialized-node';
import { EASING_FUNCTION } from '../utils/easing';
import {
  parseGradient as parseCssGradient,
  type LinearGradient as CssLinearGradient,
} from '../utils/gradient';

export type AnimationDirection = 'normal' | 'reverse' | 'alternate';
export type AnimationFillMode = 'none' | 'forwards' | 'backwards' | 'both';
export type AnimationIterations = number | 'infinite';
export type AnimationPlayState = 'idle' | 'running' | 'paused' | 'finished' | 'cancelled';

export interface Keyframe {
  offset?: number;
  easing?: string;
  [property: string]: unknown;
}

export interface AnimationOptions {
  duration: number;
  delay?: number;
  iterations?: AnimationIterations;
  direction?: AnimationDirection;
  fill?: AnimationFillMode;
  easing?: string;
  transformOrigin?: {
    x: number;
    y: number;
  };
}

export interface NormalizedKeyframe extends Omit<Keyframe, 'offset' | 'easing'> {
  offset: number;
  easing: string;
}

export interface NormalizedAnimationOptions {
  duration: number;
  delay: number;
  iterations: AnimationIterations;
  direction: AnimationDirection;
  fill: AnimationFillMode;
  easing: string;
  transformOrigin?: {
    x: number;
    y: number;
  };
}

export interface AnimationSnapshot {
  currentTime: number;
  localTime: number;
  activeDuration: number;
  progress: number;
  currentIteration: number;
  isActive: boolean;
  isBefore: boolean;
  isAfter: boolean;
  direction: 'forward' | 'backward';
  playState: AnimationPlayState;
}

export type AnimationFrameValues = Record<string, unknown>;

const DEFAULT_ANIMATION_OPTIONS: NormalizedAnimationOptions = {
  duration: 300,
  delay: 0,
  iterations: 1,
  direction: 'normal',
  fill: 'none',
  easing: 'linear',
};

const RESERVED_KEYS = new Set(['offset', 'easing']);

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getOffset(keyframe: Keyframe) {
  if (!isFiniteNumber(keyframe.offset)) {
    return undefined;
  }
  return clamp01(keyframe.offset);
}

function getValidEasing(easing: string | undefined, fallback: string) {
  if (!easing) {
    return fallback;
  }
  if (EASING_FUNCTION[easing as keyof typeof EASING_FUNCTION]) {
    return easing;
  }
  if (/^spring\(\s*[-\d.]+\s*,\s*[-\d.]+\s*,\s*[-\d.]+\s*\)$/.test(easing)) {
    return easing;
  }
  return fallback;
}

export function normalizeAnimationOptions(
  options: AnimationOptions,
): NormalizedAnimationOptions {
  const duration = isFiniteNumber(options.duration)
    ? Math.max(0, options.duration)
    : DEFAULT_ANIMATION_OPTIONS.duration;
  const delay = isFiniteNumber(options.delay)
    ? Math.max(0, options.delay)
    : DEFAULT_ANIMATION_OPTIONS.delay;
  const direction = options.direction ?? DEFAULT_ANIMATION_OPTIONS.direction;
  const fill = options.fill ?? DEFAULT_ANIMATION_OPTIONS.fill;
  const iterations = options.iterations ?? DEFAULT_ANIMATION_OPTIONS.iterations;
  const easing = getValidEasing(options.easing, DEFAULT_ANIMATION_OPTIONS.easing);
  const transformOrigin = options.transformOrigin
    && isFiniteNumber(options.transformOrigin.x)
    && isFiniteNumber(options.transformOrigin.y)
    ? { x: options.transformOrigin.x, y: options.transformOrigin.y }
    : undefined;

  return {
    duration,
    delay,
    direction,
    fill,
    iterations,
    easing,
    transformOrigin,
  };
}

export function normalizeKeyframes(
  keyframes: Keyframe[],
  globalEasing = DEFAULT_ANIMATION_OPTIONS.easing,
): NormalizedKeyframe[] {
  if (!Array.isArray(keyframes) || keyframes.length === 0) {
    throw new Error('keyframes must contain at least one item.');
  }

  const copied = keyframes.map((frame) => ({ ...frame }));
  const total = copied.length;
  const computedOffsets: number[] = new Array(total);

  for (let i = 0; i < total; i++) {
    const offset = getOffset(copied[i]);
    computedOffsets[i] = offset ?? NaN;
  }

  if (Number.isNaN(computedOffsets[0])) {
    computedOffsets[0] = 0;
  }
  if (Number.isNaN(computedOffsets[total - 1])) {
    computedOffsets[total - 1] = 1;
  }

  let i = 0;
  while (i < total) {
    if (!Number.isNaN(computedOffsets[i])) {
      i++;
      continue;
    }
    const start = i - 1;
    let end = i;
    while (end < total && Number.isNaN(computedOffsets[end])) {
      end++;
    }
    const startValue = start >= 0 ? computedOffsets[start] : 0;
    const endValue = end < total ? computedOffsets[end] : 1;
    const gap = end - start;
    for (let p = 1; p < gap; p++) {
      computedOffsets[start + p] = startValue + ((endValue - startValue) * p) / gap;
    }
    i = end;
  }

  const normalized = copied.map((frame, index) => {
    const result: Record<string, unknown> = {};
    Object.keys(frame).forEach((key) => {
      if (!RESERVED_KEYS.has(key)) {
        result[key] = frame[key];
      }
    });
    return {
      ...result,
      offset: clamp01(computedOffsets[index]),
      easing: getValidEasing(frame.easing, getValidEasing(globalEasing, 'linear')),
    } as NormalizedKeyframe;
  });

  return normalized.sort((a, b) => a.offset - b.offset);
}

function getIterationCount(iterations: AnimationIterations) {
  return iterations === 'infinite' ? Infinity : Math.max(0, iterations);
}

function canApplyFillBefore(fill: AnimationFillMode) {
  return fill === 'backwards' || fill === 'both';
}

function canApplyFillAfter(fill: AnimationFillMode) {
  return fill === 'forwards' || fill === 'both';
}

function parseSpringEasing(easing: string) {
  const matched = easing.match(
    /^spring\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/,
  );
  if (!matched) {
    return null;
  }
  const mass = Number(matched[1]);
  const stiffness = Number(matched[2]);
  const damping = Number(matched[3]);
  if (!Number.isFinite(mass) || !Number.isFinite(stiffness) || !Number.isFinite(damping) || mass <= 0 || stiffness <= 0) {
    return null;
  }
  return { mass, stiffness, damping };
}

function evaluateSpringEasing(t: number, easing: string) {
  const params = parseSpringEasing(easing);
  if (!params) {
    return t;
  }
  const { mass, stiffness, damping } = params;
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega0 * t);
    const value = 1 - envelope * (Math.cos(omegaD * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(omegaD * t));
    return clamp01(value);
  }
  const value = 1 - Math.exp(-omega0 * t);
  return clamp01(value);
}

function evaluateEasing(easing: string, t: number) {
  const p = clamp01(t);
  const bezier = EASING_FUNCTION[easing as keyof typeof EASING_FUNCTION];
  if (bezier) {
    return clamp01(bezier(p));
  }
  if (easing.startsWith('spring(')) {
    return evaluateSpringEasing(p, easing);
  }
  return p;
}

interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function clamp255(value: number) {
  return Math.max(0, Math.min(255, value));
}

function parseColor(value: unknown): ParsedColor | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = parseD3Color(normalized);
  if (parsed) {
    const rgb = parsed.rgb();
    return {
      r: clamp255(rgb.r),
      g: clamp255(rgb.g),
      b: clamp255(rgb.b),
      a: clamp01(rgb.opacity),
    };
  }
  return null;
}

function colorToRgbaString(color: ParsedColor) {
  return `rgba(${Math.round(clamp255(color.r))}, ${Math.round(clamp255(color.g))}, ${Math.round(clamp255(color.b))}, ${clamp01(color.a)})`;
}

function interpolateNumber(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

/** 与 {@link packages/plugin-lottie/src/parser.ts} `parseGradient` 输出的 `linear-gradient(…deg, …)` 对齐，用于运行时插值。 */
interface ParsedLinearGradientStop {
  /** 0–1，与 Lottie `offset` 一致 */
  offset: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

interface ParsedLinearGradient {
  angleDeg: number;
  stops: ParsedLinearGradientStop[];
}

function parseLinearGradientString(value: string): ParsedLinearGradient | null {
  let parsed: ReturnType<typeof parseCssGradient>;
  try {
    parsed = parseCssGradient(value);
  } catch {
    return null;
  }
  if (!parsed || parsed.length === 0) {
    return null;
  }
  const first = parsed[0];
  if (!first || first.type !== 'linear-gradient') {
    return null;
  }
  const linear = first as CssLinearGradient;
  const stops: ParsedLinearGradientStop[] = linear.steps
    .map((step) => {
      const c = parseColor(step.color);
      if (!c) {
        return null;
      }
      // gradient.ts 的 step.offset 可能是 % / px / em；Lottie 这里主要是 %，其余类型退化到 [0,1]。
      let offset = step.offset.value;
      if (step.offset.type === '%') {
        offset /= 100;
      }
      return {
        offset: clamp01(offset),
        r: c.r,
        g: c.g,
        b: c.b,
        a: c.a,
      } as ParsedLinearGradientStop;
    })
    .filter((s): s is ParsedLinearGradientStop => !!s);
  if (stops.length === 0) {
    return null;
  }
  return { angleDeg: linear.angle, stops };
}

function evalColorAtGradientOffset(
  stops: ParsedLinearGradientStop[],
  u: number,
): Omit<ParsedLinearGradientStop, 'offset'> {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  const uu = clamp01(u);
  if (sorted.length === 1) {
    const s = sorted[0];
    return { r: s.r, g: s.g, b: s.b, a: s.a };
  }
  if (uu <= sorted[0].offset) {
    const s = sorted[0];
    return { r: s.r, g: s.g, b: s.b, a: s.a };
  }
  const last = sorted[sorted.length - 1];
  if (uu >= last.offset) {
    return { r: last.r, g: last.g, b: last.b, a: last.a };
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (uu >= a.offset && uu <= b.offset) {
      const span = b.offset - a.offset;
      const seg = span < 1e-12 ? 0 : (uu - a.offset) / span;
      return {
        r: interpolateNumber(a.r, b.r, seg),
        g: interpolateNumber(a.g, b.g, seg),
        b: interpolateNumber(a.b, b.b, seg),
        a: interpolateNumber(a.a, b.a, seg),
      };
    }
  }
  const s = sorted[0];
  return { r: s.r, g: s.g, b: s.b, a: s.a };
}

function resampleLinearGradientStops(
  stops: ParsedLinearGradientStop[],
  n: number,
): ParsedLinearGradientStop[] {
  if (stops.length === 0 || n < 1) {
    return [];
  }
  const out: ParsedLinearGradientStop[] = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? stops[0].offset : i / (n - 1);
    const c = evalColorAtGradientOffset(stops, u);
    out.push({
      offset: u,
      r: c.r,
      g: c.g,
      b: c.b,
      a: c.a,
    });
  }
  return out;
}

function formatGradientStopPercent(offset: number): string {
  const p = offset * 100;
  const rounded = Math.round(p * 1e6) / 1e6;
  return `${rounded}%`;
}

function serializeLinearGradient(g: ParsedLinearGradient): string {
  const parts = g.stops.map((s) => {
    const r = Math.round(clamp255(s.r));
    const gch = Math.round(clamp255(s.g));
    const b = Math.round(clamp255(s.b));
    const a = s.a;
    const color
      = a < 1 - 1e-6
        ? `rgba(${r}, ${gch}, ${b}, ${clamp01(a)})`
        : `rgb(${r}, ${gch}, ${b})`;
    return `${color} ${formatGradientStopPercent(s.offset)}`;
  });
  return `linear-gradient(${g.angleDeg}deg, ${parts.join(', ')})`;
}

/**
 * 在两段 `linear-gradient(...)` 之间插值（角度 + 重采样后的色标）。
 * 与 Lottie `parseGradient` 输出格式一致。
 */
function interpolateLinearGradientPaint(
  from: unknown,
  to: unknown,
  t: number,
): string | null {
  if (typeof from !== 'string' || typeof to !== 'string') {
    return null;
  }
  const a = parseLinearGradientString(from.trim());
  const b = parseLinearGradientString(to.trim());
  if (!a || !b) {
    return null;
  }
  const n = Math.max(a.stops.length, b.stops.length, 2);
  const sa = resampleLinearGradientStops(a.stops, n);
  const sb = resampleLinearGradientStops(b.stops, n);
  if (sa.length !== n || sb.length !== n) {
    return null;
  }
  const angleDeg = interpolateNumber(a.angleDeg, b.angleDeg, t);
  const stops: ParsedLinearGradientStop[] = sa.map((s, i) => ({
    offset: clamp01(interpolateNumber(s.offset, sb[i].offset, t)),
    r: interpolateNumber(s.r, sb[i].r, t),
    g: interpolateNumber(s.g, sb[i].g, t),
    b: interpolateNumber(s.b, sb[i].b, t),
    a: interpolateNumber(s.a, sb[i].a, t),
  }));
  stops.sort((x, y) => x.offset - y.offset);
  return serializeLinearGradient({ angleDeg, stops });
}

function parseDasharray(value: unknown): [number, number] | null {
  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      return [first, second];
    }
    return null;
  }

  if (typeof value === 'string') {
    const parts = value
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((item) => Number(item));
    if (parts.length >= 2 && parts.every((item) => Number.isFinite(item))) {
      return [parts[0], parts[1]];
    }
  }

  return null;
}

/** CSS paint that is a string but must never go through {@link normalizePath} / path morphing. */
function isNonSvgPathPaintString(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const s = value.trim();
  if (!s) {
    return false;
  }
  return (
    /^(linear|radial|conic)-gradient\(/i.test(s)
    || /^url\(/i.test(s)
    || /^(none|inherit|currentcolor)$/i.test(s)
  );
}

function parsePath(path: PathSerializedNode['d'] | PathArray): { absolutePath: AbsoluteArray | []; curve: CurveArray | null } {
  if (path === '' || (Array.isArray(path) && path.length === 0)) {
    return {
      absolutePath: [],
      curve: null
    };
  }

  let absolutePath: AbsoluteArray;
  try {
    absolutePath = normalizePath(path);
  } catch {
    absolutePath = normalizePath('');
    console.error(`[g]: Invalid SVG Path definition: ${path}`);
  }

  // removeRedundantMCommand(absolutePath);

  return {
    absolutePath,
    curve: null
  };
}

function mergePaths(
  left: { absolutePath: AbsoluteArray; curve: CurveArray | null },
  right: { absolutePath: AbsoluteArray; curve: CurveArray | null },
): [CurveArray, CurveArray, (b: CurveArray) => CurveArray] {
  let curve1 = left.curve;
  let curve2 = right.curve;
  if (!curve1 || curve1.length === 0) {
    // convert to curves to do morphing & picking later
    // @see http://thednp.github.io/kute.js/svgCubicMorph.html
    curve1 = path2Curve(left.absolutePath, false) as CurveArray;
    left.curve = curve1;
  }
  if (!curve2 || curve2.length === 0) {
    curve2 = path2Curve(right.absolutePath, false) as CurveArray;
    right.curve = curve2;
  }

  let curves = [curve1, curve2];
  if (curve1.length !== curve2.length) {
    curves = equalizeSegments(curve1, curve2);
  }

  const curve0 =
    getDrawDirection(curves[0]) !== getDrawDirection(curves[1])
      ? reverseCurve(curves[0])
      : (clonePath(curves[0]) as CurveArray);

  return [
    curve0,
    getRotatedCurve(curves[1], curve0) as CurveArray,
    (pathArray: CurveArray) => {
      // need converting to path string?
      return pathArray;
    },
  ];
}

function isPathArrayLike(value: unknown): value is PathArray {
  return Array.isArray(value)
    && value.length > 0
    && Array.isArray(value[0])
    && typeof (value[0] as string[])[0] === 'string';
}

/**
 * 在 {@link mergePaths} 对齐后的两条 cubic 曲线之间做逐点线性插值，输出仍为 {@link CurveArray}。
 */
function interpolateCurveArrays(c0: CurveArray, c1: CurveArray, t: number): CurveArray {
  const out: PathArray = [] as unknown as PathArray;
  const n = Math.min(c0.length, c1.length);
  for (let i = 0; i < n; i++) {
    const s0 = c0[i];
    const s1 = c1[i];
    const cmd = s0[0];
    if (cmd === 'M') {
      out.push([
        'M',
        interpolateNumber(s0[1], s1[1], t),
        interpolateNumber(s0[2], s1[2], t),
      ]);
    } else if (cmd === 'C') {
      out.push([
        'C',
        interpolateNumber(s0[1], s1[1], t),
        interpolateNumber(s0[2], s1[2], t),
        interpolateNumber(s0[3], s1[3], t),
        interpolateNumber(s0[4], s1[4], t),
        interpolateNumber(s0[5], s1[5], t),
        interpolateNumber(s0[6], s1[6], t),
      ]);
    } else {
      out.push([...s0] as PathSegment);
    }
  }
  return out as CurveArray;
}

/**
 * 对 SVG Path `d`（字符串或 {@link PathArray}）做 morph：先用 {@link mergePaths} 对齐段，再插值，最后 {@link path2String}。
 */
function interpolatePathD(from: unknown, to: unknown, t: number): string | null {
  const fromOk = typeof from === 'string' || isPathArrayLike(from);
  const toOk = typeof to === 'string' || isPathArrayLike(to);
  if (!fromOk || !toOk) {
    return null;
  }
  // `interpolateValue` runs for every animated prop; `fill` can be `linear-gradient(...)`.
  // Those are strings but not SVG `d` — do not call `normalizePath` on them.
  if (isNonSvgPathPaintString(from) || isNonSvgPathPaintString(to)) {
    return null;
  }

  const left = parsePath(from as PathSerializedNode['d'] | PathArray);
  const right = parsePath(to as PathSerializedNode['d'] | PathArray);
  if (left.absolutePath.length === 0 || right.absolutePath.length === 0) {
    return null;
  }

  try {
    const [curve0, curve1] = mergePaths(
      left as { absolutePath: AbsoluteArray; curve: CurveArray | null },
      right as { absolutePath: AbsoluteArray; curve: CurveArray | null },
    );
    const blended = interpolateCurveArrays(curve0, curve1, t);
    return path2String(blended, 'off');
  } catch {
    return null;
  }
}

function interpolateValue(from: unknown, to: unknown, t: number) {
  if (isFiniteNumber(from) && isFiniteNumber(to)) {
    return interpolateNumber(from, to, t);
  }

  const fromDasharray = parseDasharray(from);
  const toDasharray = parseDasharray(to);
  if (fromDasharray && toDasharray) {
    return [
      interpolateNumber(fromDasharray[0], toDasharray[0], t),
      interpolateNumber(fromDasharray[1], toDasharray[1], t),
    ] as [number, number];
  }

  const fromColor = parseColor(from);
  const toColor = parseColor(to);
  if (fromColor && toColor) {
    return colorToRgbaString({
      r: interpolateNumber(fromColor.r, toColor.r, t),
      g: interpolateNumber(fromColor.g, toColor.g, t),
      b: interpolateNumber(fromColor.b, toColor.b, t),
      a: interpolateNumber(fromColor.a, toColor.a, t),
    });
  }

  const morphedLinearGradient = interpolateLinearGradientPaint(from, to, t);
  if (morphedLinearGradient !== null) {
    return morphedLinearGradient;
  }

  const morphedD = interpolatePathD(from, to, t);
  if (morphedD !== null) {
    return morphedD;
  }

  return t < 1 ? from : to;
}

function getAnimatedProperties(keyframes: NormalizedKeyframe[]) {
  const props = new Set<string>();
  keyframes.forEach((keyframe) => {
    Object.keys(keyframe).forEach((key) => {
      if (!RESERVED_KEYS.has(key)) {
        props.add(key);
      }
    });
  });
  return [...props];
}

export class AnimationController {
  private readonly options: NormalizedAnimationOptions;
  private readonly keyframes: NormalizedKeyframe[];
  private playState: AnimationPlayState = 'idle';
  private startTime?: number;
  private holdTime = 0;
  private currentTime = 0;
  private playbackRate = 1;

  constructor(keyframes: Keyframe[], options: AnimationOptions) {
    this.options = normalizeAnimationOptions(options);
    this.keyframes = normalizeKeyframes(keyframes, this.options.easing);
  }

  getKeyframes() {
    return this.keyframes;
  }

  getOptions() {
    return this.options;
  }

  getPlaybackRate() {
    return this.playbackRate;
  }

  setPlaybackRate(rate: number) {
    if (!isFiniteNumber(rate) || rate === 0) {
      throw new Error('playbackRate must be a finite non-zero number.');
    }
    this.playbackRate = rate;
  }

  getPlayState() {
    return this.playState;
  }

  getCurrentTime() {
    return this.currentTime;
  }

  play(now = performance.now()) {
    if (this.playState === 'running') {
      return;
    }
    this.startTime = now - this.holdTime / Math.abs(this.playbackRate);
    this.playState = 'running';
  }

  pause() {
    if (this.playState !== 'running') {
      return;
    }
    this.holdTime = this.currentTime;
    this.playState = 'paused';
  }

  reverse(now = performance.now()) {
    this.playbackRate = -this.playbackRate;
    if (this.playState === 'running') {
      this.startTime = now - this.currentTime / Math.abs(this.playbackRate);
    }
  }

  cancel() {
    this.playState = 'cancelled';
    this.currentTime = 0;
    this.holdTime = 0;
    this.startTime = undefined;
  }

  finish() {
    const iterations = getIterationCount(this.options.iterations);
    const activeDuration = this.options.duration * iterations;
    this.currentTime = Number.isFinite(activeDuration) ? this.options.delay + activeDuration : this.currentTime;
    this.holdTime = this.currentTime;
    this.playState = 'finished';
  }

  seek(time: number) {
    if (!isFiniteNumber(time)) {
      throw new Error('seek time must be finite.');
    }
    this.currentTime = Math.max(0, time);
    this.holdTime = this.currentTime;
    if (this.playState === 'idle') {
      this.playState = 'paused';
    }
  }

  tick(now = performance.now()) {
    if (this.playState !== 'running') {
      return this.getSnapshot();
    }
    if (this.startTime === undefined) {
      this.startTime = now;
    }
    const elapsed = (now - this.startTime) * Math.abs(this.playbackRate);
    this.currentTime = Math.max(0, elapsed);
    return this.getSnapshot();
  }

  getSnapshot(): AnimationSnapshot {
    const { delay, duration, iterations, direction, fill } = this.options;
    const iterationCount = getIterationCount(iterations);
    const activeDuration = duration * iterationCount;
    const localTime = this.currentTime - delay;

    const isBefore = localTime < 0;
    const isAfter = localTime > activeDuration;
    const isInfinite = !Number.isFinite(activeDuration);
    const isActive = !isBefore && (isInfinite || !isAfter);

    let progress = 0;
    let currentIteration = 0;
    if (isActive && duration > 0) {
      const clampedLocal = isInfinite ? Math.max(0, localTime) : Math.min(localTime, activeDuration);
      currentIteration = Math.floor(clampedLocal / duration);
      const within = clampedLocal % duration;
      progress = within / duration;
    } else if (isAfter && canApplyFillAfter(fill) && duration > 0) {
      progress = 1;
      currentIteration = Math.max(0, Number.isFinite(iterationCount) ? iterationCount - 1 : 0);
    } else if (isBefore && canApplyFillBefore(fill)) {
      progress = 0;
      currentIteration = 0;
    }

    let playbackDirection: 'forward' | 'backward' = this.playbackRate >= 0
      ? 'forward'
      : 'backward';
    if (direction === 'reverse') {
      playbackDirection = playbackDirection === 'forward' ? 'backward' : 'forward';
    } else if (direction === 'alternate' && currentIteration % 2 === 1) {
      playbackDirection = playbackDirection === 'forward' ? 'backward' : 'forward';
    }

    if (this.playState === 'running' && !isInfinite && localTime >= activeDuration) {
      this.playState = 'finished';
    }

    return {
      currentTime: this.currentTime,
      localTime,
      activeDuration,
      progress: clamp01(progress),
      currentIteration,
      isActive,
      isBefore,
      isAfter,
      direction: playbackDirection,
      playState: this.playState,
    };
  }

  getCurrentValues(snapshot = this.getSnapshot()): AnimationFrameValues | null {
    const { fill } = this.options;
    const shouldApply = snapshot.isActive
      || (snapshot.isBefore && canApplyFillBefore(fill))
      || (snapshot.isAfter && canApplyFillAfter(fill));
    if (!shouldApply || this.keyframes.length === 0) {
      return null;
    }

    const baseProgress = snapshot.direction === 'forward'
      ? snapshot.progress
      : 1 - snapshot.progress;
    const progress = clamp01(baseProgress);
    const from = this.keyframes[0];
    const to = this.keyframes[this.keyframes.length - 1];

    if (progress <= from.offset) {
      const values: AnimationFrameValues = {};
      getAnimatedProperties(this.keyframes).forEach((prop) => {
        values[prop] = from[prop];
      });
      return values;
    }
    if (progress >= to.offset) {
      const values: AnimationFrameValues = {};
      getAnimatedProperties(this.keyframes).forEach((prop) => {
        values[prop] = to[prop];
      });
      return values;
    }

    let left = from;
    let right = to;
    for (let i = 0; i < this.keyframes.length - 1; i++) {
      const current = this.keyframes[i];
      const next = this.keyframes[i + 1];
      if (progress >= current.offset && progress <= next.offset) {
        left = current;
        right = next;
        break;
      }
    }

    const segmentSpan = Math.max(1e-6, right.offset - left.offset);
    const segmentT = clamp01((progress - left.offset) / segmentSpan);
    const easedT = evaluateEasing(right.easing || this.options.easing, segmentT);

    const props = getAnimatedProperties(this.keyframes);
    const values: AnimationFrameValues = {};
    props.forEach((prop) => {
      const leftValue = left[prop];
      const rightValue = right[prop];
      if (leftValue === undefined && rightValue !== undefined) {
        values[prop] = rightValue;
        return;
      }
      if (rightValue === undefined && leftValue !== undefined) {
        values[prop] = leftValue;
        return;
      }
      values[prop] = interpolateValue(leftValue, rightValue, easedT);
    });
    return values;
  }
}
