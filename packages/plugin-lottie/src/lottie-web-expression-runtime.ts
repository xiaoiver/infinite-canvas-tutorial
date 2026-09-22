/**
 * Bridges bake-time evaluation to airbnb lottie-web {@link ExpressionManager}.
 * @see https://github.com/airbnb/lottie-web/blob/master/player/js/utils/expressions/ExpressionManager.js
 */

import ExpressionManager from './vendor/lottie-expression-manager.bundle.mjs';
import {
  sampleScalarAtFrame,
  sampleVectorAtFrame,
} from './expression-sampling';
import {
  createCompMock,
  createElemMock,
  createMockExpressionProperty,
  type CompMock,
} from './lottie-web-expression-mocks';
import type * as Lottie from './type';

function cloneBezier(b: Lottie.Bezier): Lottie.Bezier {
  return {
    v: b.v.map((row) => [...row]),
    i: b.i.map((row) => [...row]),
    o: b.o.map((row) => [...row]),
    c: b.c,
  };
}

function isBezierShapeData(k: unknown): k is Lottie.Bezier {
  return (
    typeof k === 'object'
    && k !== null
    && !Array.isArray(k)
    && Array.isArray((k as Lottie.Bezier).v)
    && Array.isArray((k as Lottie.Bezier).i)
    && Array.isArray((k as Lottie.Bezier).o)
  );
}

function sampleShapeBezierAtFrame(
  kfs: Lottie.ShapePropKeyframe[],
  frame: number,
): Lottie.Bezier {
  if (!kfs.length) {
    return { v: [], i: [], o: [] };
  }
  if (frame <= kfs[0].t) {
    return cloneBezier(kfs[0].s[0]);
  }
  for (let i = 0; i < kfs.length - 1; i++) {
    const cur = kfs[i];
    const next = kfs[i + 1];
    if (frame >= cur.t && frame < next.t) {
      return cloneBezier(cur.s[0]);
    }
  }
  return cloneBezier(kfs[kfs.length - 1].s[0]);
}

function initVectorProperty(
  prop: Record<string, unknown>,
  vec: number[],
) {
  prop.v = vec;
  prop.pv = vec;
}

function initScalarProperty(prop: Record<string, unknown>, n: number) {
  prop.v = n;
  prop.pv = n;
}

export interface LottieWebBakeContext {
  startFrame: number;
  endFrame: number;
  fps: number;
  compWidth: number;
  compHeight: number;
  expressionLayer?: Record<string, unknown>;
}

export function bakeFramesWithExpressionManager(
  code: string,
  propertyData: Record<string, unknown>,
  bake: LottieWebBakeContext,
  forEachFrame: (frame: number, evaluated: unknown) => void,
): boolean {
  const layer = bake.expressionLayer;
  if (!layer || layer.ty !== 4) {
    return false;
  }

  const comp = createCompMock(bake.fps, bake.compWidth, bake.compHeight);
  const elem = createElemMock(layer, comp) as Record<string, unknown>;
  (elem as { sourceRectAtTime?: () => unknown }).sourceRectAtTime = () => ({
    top: 0,
    left: 0,
    width: bake.compWidth,
    height: bake.compHeight,
  });

  const data = { ...propertyData, x: code };
  const property = createMockExpressionProperty(
    data,
    comp,
    elem as { comp: CompMock },
  ) as Record<string, unknown>;

  ExpressionManager.resetFrame();

  let execute: (v: unknown) => unknown;
  try {
    execute = ExpressionManager.initiateExpression(
      elem,
      data,
      property,
    ) as (v: unknown) => unknown;
  } catch {
    return false;
  }

  const start = Math.floor(bake.startFrame);
  const end = Math.floor(bake.endFrame);
  const k = propertyData.k;
  const isAnimated
    = Array.isArray(k)
    && k.length > 0
    && (k[0] as Lottie.OffsetKeyframe).t !== undefined;

  for (let f = start; f <= end; f++) {
    comp.renderedFrame = f;
    comp.globalData.frameId = f;
    (elem.globalData as { frameId: number }).frameId = f;
    property.frameExpressionId = -1;

    let baseVal: number | number[];
    if (isAnimated) {
      const kfs = k as Lottie.OffsetKeyframe[];
      const s0 = kfs[0].s;
      if (typeof s0 === 'number') {
        baseVal = sampleScalarAtFrame(kfs, f);
      } else {
        baseVal = sampleVectorAtFrame(kfs, f);
      }
    } else if (typeof k === 'number') {
      baseVal = k;
    } else {
      baseVal = [...(k as number[])];
    }

    if (Array.isArray(baseVal)) {
      initVectorProperty(property, baseVal);
    } else {
      initScalarProperty(property, baseVal);
    }

    try {
      const evaluated = execute.call(
        property,
        Array.isArray(baseVal) ? [...baseVal] : baseVal,
      );
      forEachFrame(f, evaluated);
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Bake path `ks` expressions that return `{ v, i, o }` (shape property).
 * Scalar/vector {@link bakeFramesWithExpressionManager} cannot pass bezier `k` as `value`.
 */
export function bakeShapePathFramesWithExpressionManager(
  code: string,
  ks: { k: Lottie.Bezier | Lottie.ShapePropKeyframe[] },
  bake: LottieWebBakeContext,
  forEachFrame: (frame: number, evaluated: unknown) => void,
): boolean {
  const layer = bake.expressionLayer;
  if (!layer || layer.ty !== 4) {
    return false;
  }

  const comp = createCompMock(bake.fps, bake.compWidth, bake.compHeight);
  const elem = createElemMock(layer, comp) as Record<string, unknown>;
  (elem as { sourceRectAtTime?: () => unknown }).sourceRectAtTime = () => ({
    top: 0,
    left: 0,
    width: bake.compWidth,
    height: bake.compHeight,
  });

  const data = { ...ks, x: code } as Record<string, unknown>;
  const property = createMockExpressionProperty(
    data,
    comp,
    elem as { comp: CompMock },
  ) as Record<string, unknown>;
  property.propType = 'shape';

  ExpressionManager.resetFrame();

  let execute: (v: unknown) => unknown;
  try {
    execute = ExpressionManager.initiateExpression(
      elem,
      data,
      property,
    ) as (v: unknown) => unknown;
  } catch {
    return false;
  }

  const start = Math.floor(bake.startFrame);
  const end = Math.floor(bake.endFrame);
  const k = ks.k;
  const isShapeKeyframeAnimated
    = Array.isArray(k)
    && k.length > 0
    && (k[0] as Lottie.ShapePropKeyframe).t !== undefined;

  for (let f = start; f <= end; f++) {
    comp.renderedFrame = f;
    comp.globalData.frameId = f;
    (elem.globalData as { frameId: number }).frameId = f;
    property.frameExpressionId = -1;

    let baseBezier: Lottie.Bezier;
    if (isShapeKeyframeAnimated) {
      baseBezier = sampleShapeBezierAtFrame(k as Lottie.ShapePropKeyframe[], f);
    } else if (isBezierShapeData(k)) {
      baseBezier = cloneBezier(k);
    } else {
      baseBezier = { v: [], i: [], o: [] };
    }

    const passVal = cloneBezier(baseBezier);
    property.v = passVal;
    property.pv = passVal;

    try {
      const evaluated = execute.call(property, passVal);
      forEachFrame(f, evaluated);
    } catch {
      return false;
    }
  }

  return true;
}
