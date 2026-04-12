/**
 * Minimal After Effects / Bodymovin expression evaluation for parse-time baking.
 * lottie-web keeps the full engine in ExpressionManager (not exported); Expressions.js
 * only wires {@link https://github.com/airbnb/lottie-web/blob/master/player/js/utils/expressions/Expressions.js initExpressions}.
 *
 * We execute the exported `x` string with composition `time` / `frame` and pre-expression `value`,
 * then read `$bm_rt` per {@link https://lottiefiles.github.io/lottie-docs/expressions/ Lottie expressions}.
 *
 * Untrusted JSON + `new Function` is unsafe; disable via `loadAnimation(..., { expressions: false })`.
 */

import type * as Lottie from './type';
import {
  coerceVectorEvalResult,
  sampleScalarAtFrame,
  sampleVectorAtFrame,
} from './expression-sampling';
import {
  bakeFramesWithExpressionManager,
  bakeShapePathFramesWithExpressionManager,
} from './lottie-web-expression-runtime';

export { sampleScalarAtFrame, sampleVectorAtFrame } from './expression-sampling';

/** Matches parser `KeyframeAnimationKeyframe` (no circular import from parser). */
export interface ExpressionKeyframe {
  easing?: string;
  offset: number;
  [key: string]: any;
}

export interface BakedKeyframeAnimation {
  duration: number;
  delay: number;
  keyframes: ExpressionKeyframe[];
}

/** Subset of `ParseContext` used for baking (avoids circular imports). */
export interface ExpressionBakeContext {
  startFrame: number;
  endFrame: number;
  /** Frames per second (composition). */
  fps: number;
  frameTime: number;
  compWidth: number;
  compHeight: number;
  /**
   * `simple`: `new Function` + globals (time, value, frame, width, height, Math).
   * `lottie-web`: bundled {@link https://github.com/airbnb/lottie-web/blob/master/player/js/utils/expressions/ExpressionManager.js ExpressionManager} + JSON layer mocks (shape layers ty=4).
   */
  expressionEngine?: 'simple' | 'lottie-web';
  /** Current layer JSON while parsing (for ExpressionManager thisLayer / effects). */
  expressionLayer?: Record<string, unknown>;
}

export function propertyHasExpression(lottieVal: {
  x?: string;
} | null | undefined): boolean {
  return typeof lottieVal?.x === 'string' && lottieVal.x.trim().length > 0;
}

export interface LottieExpressionEvalContext {
  /** Composition time in seconds (see Lottie `time`). */
  time: number;
  /** Property value without the expression (scalar or vector). */
  value: unknown;
  /** Current frame in the composition timeline. */
  frame: number;
  width?: number;
  height?: number;
}

/**
 * Evaluates a Bodymovin expression; returns `undefined` if execution fails or `$bm_rt` is missing.
 */
export function evaluateLottieExpression(
  code: string,
  ctx: LottieExpressionEvalContext,
): unknown {
  const { time, value, frame, width = 0, height = 0 } = ctx;
  const wrapped = `"use strict";\n${code}\nreturn typeof $bm_rt !== "undefined" ? $bm_rt : undefined;`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(
      'time',
      'value',
      'frame',
      'width',
      'height',
      'Math',
      wrapped,
    ) as (
      t: number,
      v: unknown,
      f: number,
      w: number,
      h: number,
      m: Math,
    ) => unknown;
    return fn(time, value, frame, width, height, Math);
  } catch {
    return undefined;
  }
}

function compositionDurationFrames(context: ExpressionBakeContext): number {
  return Math.max(1, context.endFrame - context.startFrame);
}

function makeKeyframe(
  offset: number,
  targetPropName: string,
  propNames: string[],
  values: number[],
  convertVal?: (v: number) => number,
): ExpressionKeyframe {
  const row: ExpressionKeyframe = { offset };
  if (targetPropName) {
    const inner: Record<string, number> = {};
    propNames.forEach((name, i) => {
      let v = values[i] ?? 0;
      if (convertVal) {
        v = convertVal(v);
      }
      inner[name] = v;
    });
    (row as any)[targetPropName] = inner;
  } else {
    propNames.forEach((name, i) => {
      let v = values[i] ?? 0;
      if (convertVal) {
        v = convertVal(v);
      }
      row[name] = v;
    });
  }
  return row;
}

/** Bake scalar expression into one keyframe track. */
export function bakeScalarExpressionTrack(
  code: string,
  base: Lottie.Value,
  context: ExpressionBakeContext,
  targetPropName: string,
  propName: string,
  convertVal?: (v: number) => number,
): BakedKeyframeAnimation | null {
  const durationFrames = compositionDurationFrames(context);
  const keyframes: ExpressionKeyframe[] = [];
  const start = Math.floor(context.startFrame);
  const end = Math.floor(context.endFrame);

  const k = base.k;
  const isAnimated
    = Array.isArray(k) && k.length > 0 && (k[0] as Lottie.OffsetKeyframe).t !== undefined;

  let baseVal0: number;
  if (isAnimated) {
    baseVal0 = sampleScalarAtFrame(k as Lottie.OffsetKeyframe[], start);
  } else {
    baseVal0 = k as number;
  }

  if (context.expressionEngine === 'lottie-web' && context.expressionLayer) {
    const propertyData = { ...(base as object) } as Record<string, unknown>;
    const lottieKeyframes: ExpressionKeyframe[] = [];
    const ok = bakeFramesWithExpressionManager(
      code,
      propertyData,
      {
        startFrame: context.startFrame,
        endFrame: context.endFrame,
        fps: context.fps,
        compWidth: context.compWidth,
        compHeight: context.compHeight,
        expressionLayer: context.expressionLayer,
      },
      (f, evaluated) => {
        const offset = (f - context.startFrame) / durationFrames;
        let out: number = baseVal0;
        if (typeof evaluated === 'number' && Number.isFinite(evaluated)) {
          out = evaluated;
        }
        lottieKeyframes.push(
          makeKeyframe(offset, targetPropName, [propName], [out], convertVal),
        );
      },
    );
    if (ok && lottieKeyframes.length) {
      return {
        duration: context.frameTime * durationFrames,
        delay: 0,
        keyframes: lottieKeyframes,
      };
    }
  }

  // If the expression cannot run (missing AE globals like thisLayer/linear), do not bake: dense
  // shape-only keyframes can break merged style (fill appears black). Fall back to static `k`.
  const probe = evaluateLottieExpression(code, {
    time: start / context.fps,
    value: baseVal0,
    frame: start,
    width: context.compWidth,
    height: context.compHeight,
  });
  if (probe === undefined) {
    return null;
  }

  for (let f = start; f <= end; f++) {
    const time = f / context.fps;
    let baseVal: number;
    if (isAnimated) {
      baseVal = sampleScalarAtFrame(k as Lottie.OffsetKeyframe[], f);
    } else {
      baseVal = k as number;
    }

    let out = evaluateLottieExpression(code, {
      time,
      value: baseVal,
      frame: f,
      width: context.compWidth,
      height: context.compHeight,
    });
    if (typeof out !== 'number' || Number.isNaN(out)) {
      out = baseVal;
    }
    const offset = (f - context.startFrame) / durationFrames;
    keyframes.push(
      makeKeyframe(offset, targetPropName, [propName], [out as number], convertVal),
    );
  }

  if (!keyframes.length) {
    return null;
  }

  return {
    duration: context.frameTime * durationFrames,
    delay: 0,
    keyframes,
  };
}

/** Bake multi-dimensional (e.g. position) expression into one merged track. */
export function bakeVectorExpressionTrack(
  code: string,
  base: Lottie.MultiDimensional,
  context: ExpressionBakeContext,
  targetPropName: string,
  propNames: string[],
  convertVal?: (v: number) => number,
): BakedKeyframeAnimation | null {
  const durationFrames = compositionDurationFrames(context);
  const keyframes: ExpressionKeyframe[] = [];
  const start = Math.floor(context.startFrame);
  const end = Math.floor(context.endFrame);
  const k = base.k;
  const isAnimated
    = Array.isArray(k) && k.length > 0 && (k[0] as Lottie.OffsetKeyframe).t !== undefined;

  const dim = propNames.length;

  let baseVec0: number[];
  if (isAnimated) {
    baseVec0 = sampleVectorAtFrame(k as Lottie.OffsetKeyframe[], start);
  } else {
    baseVec0 = (k as number[]).slice(0, dim);
    while (baseVec0.length < dim) {
      baseVec0.push(0);
    }
  }

  if (context.expressionEngine === 'lottie-web' && context.expressionLayer) {
    const propertyData = { ...(base as object) } as Record<string, unknown>;
    const lottieKeyframes: ExpressionKeyframe[] = [];
    const ok = bakeFramesWithExpressionManager(
      code,
      propertyData,
      {
        startFrame: context.startFrame,
        endFrame: context.endFrame,
        fps: context.fps,
        compWidth: context.compWidth,
        compHeight: context.compHeight,
        expressionLayer: context.expressionLayer,
      },
      (f, evaluated) => {
        const offset = (f - context.startFrame) / durationFrames;
        const values = coerceVectorEvalResult(evaluated, dim, baseVec0);
        lottieKeyframes.push(
          makeKeyframe(offset, targetPropName, propNames, values, convertVal),
        );
      },
    );
    if (ok && lottieKeyframes.length) {
      return {
        duration: context.frameTime * durationFrames,
        delay: 0,
        keyframes: lottieKeyframes,
      };
    }
  }

  const probe = evaluateLottieExpression(code, {
    time: start / context.fps,
    value: baseVec0,
    frame: start,
    width: context.compWidth,
    height: context.compHeight,
  });
  if (probe === undefined) {
    return null;
  }

  for (let f = start; f <= end; f++) {
    const time = f / context.fps;
    let baseVec: number[];
    if (isAnimated) {
      baseVec = sampleVectorAtFrame(k as Lottie.OffsetKeyframe[], f);
    } else {
      baseVec = (k as number[]).slice(0, dim);
      while (baseVec.length < dim) {
        baseVec.push(0);
      }
    }

    const out = evaluateLottieExpression(code, {
      time,
      value: baseVec,
      frame: f,
      width: context.compWidth,
      height: context.compHeight,
    });

    const values = coerceVectorEvalResult(out, dim, baseVec);

    const offset = (f - context.startFrame) / durationFrames;
    keyframes.push(
      makeKeyframe(offset, targetPropName, propNames, values, convertVal),
    );
  }

  if (!keyframes.length) {
    return null;
  }

  return {
    duration: context.frameTime * durationFrames,
    delay: 0,
    keyframes,
  };
}

function normalizeShapeExpressionResult(
  evaluated: unknown,
): { in: number[][]; out: number[][]; v: number[][]; close?: boolean } | null {
  if (!evaluated || typeof evaluated !== 'object') {
    return null;
  }
  const e = evaluated as Record<string, unknown>;
  const v = e.v;
  const i = e.i;
  const o = e.o;
  if (!Array.isArray(v)) {
    return null;
  }
  const rowVec = (row: unknown): number[] => {
    if (Array.isArray(row)) {
      return row.map((x) => Number(x));
    }
    if (row !== null && typeof row === 'object' && 'length' in (row as object)) {
      return Array.from(row as ArrayLike<number>).map((x) => Number(x));
    }
    const n = Number(row);
    return [n, n];
  };
  const toMat = (a: unknown): number[][] => {
    if (!Array.isArray(a)) {
      return [];
    }
    return a.map((row) => rowVec(row));
  };
  return {
    v: toMat(v),
    in: toMat(i),
    out: toMat(o),
    close: typeof e.c === 'boolean' ? e.c : undefined,
  };
}

/** Bake path `ks.x` expressions that evaluate to `{ v, i, o }` (lottie-web only). */
export function bakeShapePathExpressionTrack(
  code: string,
  ks: Lottie.ShapeProperty & { x?: string },
  context: ExpressionBakeContext,
): BakedKeyframeAnimation | null {
  const durationFrames = compositionDurationFrames(context);
  if (context.expressionEngine !== 'lottie-web' || !context.expressionLayer) {
    return null;
  }
  const keyframes: ExpressionKeyframe[] = [];
  const ok = bakeShapePathFramesWithExpressionManager(
    code,
    ks,
    {
      startFrame: context.startFrame,
      endFrame: context.endFrame,
      fps: context.fps,
      compWidth: context.compWidth,
      compHeight: context.compHeight,
      expressionLayer: context.expressionLayer,
    },
    (f, evaluated) => {
      const normalized = normalizeShapeExpressionResult(evaluated);
      if (!normalized) {
        return;
      }
      keyframes.push({
        offset: (f - context.startFrame) / durationFrames,
        shape: normalized,
      });
    },
  );
  if (!ok || !keyframes.length) {
    return null;
  }
  return {
    duration: context.frameTime * durationFrames,
    delay: 0,
    keyframes,
  };
}
