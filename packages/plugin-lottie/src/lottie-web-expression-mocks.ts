/**
 * Minimal elem / layerInterface mocks so lottie-web {@link initiateExpression} can run
 * bake-time evaluation. Mirrors name lookup from ShapeExpressionInterface (group/ellipse).
 *
 * @see https://github.com/airbnb/lottie-web/blob/master/player/js/utils/expressions/ShapeInterface.js
 * Effects: aligned with {@link https://github.com/airbnb/lottie-web/blob/master/player/js/utils/expressions/EffectInterface.js EffectInterface.js}
 * — outer `thisLayer.effect(name)` matches `nm` / `mn` / `ix`, or 1-based index; inner control lookup
 * is the same. Nested `ty === 5` effect groups inside `ef` are not fully modeled (rare in baked JSON).
 */

import type * as Lottie from './type';
import ExpressionManager from './vendor/lottie-expression-manager.bundle.mjs';
import {
  coerceVectorEvalResult,
  sampleScalarAtFrame,
  sampleVectorAtFrame,
} from './expression-sampling';

export interface CompMock {
  renderedFrame: number;
  globalData: {
    frameRate: number;
    frameId: number;
    /** Required by lottie-web ExpressionManager (`comp(...)` / project APIs). */
    projectInterface: () => unknown;
  };
  frameDuration: number;
  displayStartTime: number;
  currentFrame: number;
  compInterface: { width: () => number; height: () => number };
}

function readMultiValue(
  prop: Lottie.MultiDimensional | Lottie.Value | undefined,
  comp: CompMock,
): Float32Array {
  if (!prop?.k) {
    return new Float32Array([0, 0]);
  }
  const k = prop.k;
  if (Array.isArray(k) && k.length > 0 && (k[0] as Lottie.OffsetKeyframe).t !== undefined) {
    return Float32Array.from(
      sampleVectorAtFrame(k as Lottie.OffsetKeyframe[], comp.renderedFrame),
    );
  }
  if (Array.isArray(k) && typeof (k as number[])[0] === 'number') {
    return Float32Array.from(k as number[]);
  }
  return new Float32Array([0, 0]);
}

type EllipsePositionExprCache = {
  execute: (v: unknown) => unknown;
  property: Record<string, unknown>;
  elem: Record<string, unknown>;
};

/** One `initiateExpression` per shape `el` with `p.x` — reused across frames; frame comes from {@link CompMock.renderedFrame}. */
const ellipsePositionExprCache = new WeakMap<Record<string, unknown>, EllipsePositionExprCache>();

/**
 * Ellipse `position` in expressions: Bodymovin may attach `p.x`. Static {@link readMultiValue} ignores it,
 * so nested paths (e.g. `group.content("p0").position` inside a path `ks.x` bake) stay frozen at `p.k`.
 */
function readEllipsePositionWithExpression(
  item: Record<string, unknown>,
  comp: CompMock,
  layer: Record<string, unknown>,
  compW: number,
  compH: number,
): Float32Array {
  const p = item.p as (Lottie.MultiDimensional & { x?: string }) | undefined;
  if (!p || typeof p.x !== 'string' || !p.x.trim()) {
    return readMultiValue(p, comp);
  }

  let cache = ellipsePositionExprCache.get(item);
  if (!cache) {
    const elem = createElemMock(layer, comp) as Record<string, unknown>;
    (elem as { sourceRectAtTime?: () => unknown }).sourceRectAtTime = () => ({
      top: 0,
      left: 0,
      width: compW,
      height: compH,
    });
    const data = { ...p } as Record<string, unknown>;
    const property = createMockExpressionProperty(
      data,
      comp,
      elem as { comp: CompMock },
    ) as Record<string, unknown>;
    let execute: (v: unknown) => unknown;
    try {
      execute = ExpressionManager.initiateExpression(
        elem,
        data,
        property,
      ) as (v: unknown) => unknown;
    } catch {
      return readMultiValue(p, comp);
    }
    cache = { execute, property, elem };
    ellipsePositionExprCache.set(item, cache);
  }

  const { execute, property, elem } = cache;
  (elem.globalData as { frameId: number }).frameId = comp.renderedFrame;
  comp.globalData.frameId = comp.renderedFrame;
  property.frameExpressionId = -1;

  const k = p.k;
  const isAnimated
    = Array.isArray(k)
      && k.length > 0
      && typeof (k as Lottie.OffsetKeyframe[])[0] === 'object'
      && (k as Lottie.OffsetKeyframe[])[0].t !== undefined;

  let baseVec: number[];
  if (isAnimated) {
    baseVec = sampleVectorAtFrame(k as Lottie.OffsetKeyframe[], comp.renderedFrame);
  } else if (Array.isArray(k) && typeof (k as number[])[0] === 'number') {
    baseVec = [...(k as number[])];
  } else {
    return new Float32Array([0, 0]);
  }

  property.v = baseVec;
  property.pv = baseVec;
  try {
    const evaluated = execute.call(property, [...baseVec]);
    return Float32Array.from(coerceVectorEvalResult(evaluated, 2, baseVec));
  } catch {
    return readMultiValue(p, comp);
  }
}

function buildShapeChildInterface(
  item: Record<string, unknown> | undefined,
  comp: CompMock,
  layer: Record<string, unknown>,
) {
  if (!item) {
    return null;
  }
  if (item.ty === 'el') {
    const compW = comp.compInterface.width();
    const compH = comp.compInterface.height();
    return {
      get position() {
        return readEllipsePositionWithExpression(item, comp, layer, compW, compH);
      },
    };
  }
  return null;
}

function buildGroupContentsInterface(
  gr: { it?: Record<string, unknown>[] },
  comp: CompMock,
  layer: Record<string, unknown>,
) {
  const it = gr.it || [];
  function pick(name: string | number) {
    if (typeof name === 'number') {
      return buildShapeChildInterface(it[name - 1] as Record<string, unknown>, comp, layer);
    }
    const ch = it.find((x) => x.nm === name);
    return buildShapeChildInterface(ch as Record<string, unknown>, comp, layer);
  }
  // AE / Bodymovin: `group("p0")` and `group.content("p0")` both resolve children.
  const pickFn = pick as Record<string, unknown> & typeof pick;
  pickFn.content = pick;
  return pickFn;
}

type EffectControlJson = {
  ty?: number;
  nm?: string;
  mn?: string;
  ix?: number;
  v?: { k?: unknown };
};

type EffectGroupJson = {
  ef?: EffectControlJson[];
  nm?: string;
  mn?: string;
  ix?: number;
  ty?: number;
};

function effectEntryMatchesName(entry: EffectGroupJson, name: string): boolean {
  return entry.nm === name || entry.mn === name || String(entry.ix ?? '') === name;
}

function controlMatchesName(entry: EffectControlJson, name: string): boolean {
  return entry.nm === name || entry.mn === name || String(entry.ix ?? '') === name;
}

function findEffectGroup(
  list: EffectGroupJson[] | undefined,
  nameOrIndex: string | number,
): EffectGroupJson | undefined {
  if (!list?.length) {
    return undefined;
  }
  if (typeof nameOrIndex === 'number') {
    const i = Math.floor(nameOrIndex) - 1;
    return i >= 0 && i < list.length ? list[i] : undefined;
  }
  return list.find((e) => effectEntryMatchesName(e, nameOrIndex));
}

function findEffectControl(
  list: EffectControlJson[] | undefined,
  nameOrIndex: string | number,
): EffectControlJson | undefined {
  if (!list?.length) {
    return undefined;
  }
  if (typeof nameOrIndex === 'number') {
    const i = Math.floor(nameOrIndex) - 1;
    return i >= 0 && i < list.length ? list[i] : undefined;
  }
  return list.find((c) => controlMatchesName(c, nameOrIndex));
}

/**
 * Sample effect control value at {@link CompMock.renderedFrame}.
 * @see https://github.com/airbnb/lottie-web/blob/master/player/js/utils/expressions/EffectInterface.js — `createValueInterface`
 */
function readEffectControlValue(ctrl: EffectControlJson | undefined, comp: CompMock): number | Float32Array {
  if (!ctrl?.v?.k) {
    return 0;
  }
  const ty = ctrl.ty ?? 0;
  const vk = ctrl.v.k;

  if (ty === 6) {
    if (
      Array.isArray(vk)
      && vk.length > 0
      && typeof (vk as Lottie.OffsetKeyframe[])[0] === 'object'
      && (vk as Lottie.OffsetKeyframe[])[0]?.t !== undefined
    ) {
      return Float32Array.from(
        sampleVectorAtFrame(vk as Lottie.OffsetKeyframe[], comp.renderedFrame),
      );
    }
    if (Array.isArray(vk) && typeof (vk as number[])[0] === 'number') {
      return Float32Array.from(vk as number[]);
    }
    return new Float32Array([0, 0, 0]);
  }

  if (typeof vk === 'number') {
    return vk;
  }
  if (
    Array.isArray(vk)
    && vk.length > 0
    && typeof (vk as Lottie.OffsetKeyframe[])[0] === 'object'
    && (vk as Lottie.OffsetKeyframe[])[0]?.t !== undefined
  ) {
    return sampleScalarAtFrame(vk as Lottie.OffsetKeyframe[], comp.renderedFrame);
  }
  if (Array.isArray(vk) && typeof (vk as number[])[0] === 'number') {
    return (vk as number[])[0] ?? 0;
  }
  return 0;
}

function buildEffectInterface(layer: { ef?: unknown[] }, comp: CompMock) {
  return function effectOuter(effectName: string | number) {
    const eg = findEffectGroup(layer.ef as EffectGroupJson[] | undefined, effectName);
    if (!eg?.ef) {
      return function innerWhenMissing(_ctrlName: string | number) {
        return 0;
      };
    }
    return function innerControl(ctrlName: string | number) {
      const ctrl = findEffectControl(eg.ef, ctrlName);
      return readEffectControlValue(ctrl, comp);
    };
  };
}

export function buildLayerExpressionInterface(
  layer: Record<string, unknown>,
  comp: CompMock,
) {
  const shapes = (layer.shapes as unknown[] | undefined) || [];

  function findGroup(nm: string) {
    for (const s of shapes) {
      const sh = s as { ty?: string; nm?: string };
      if (sh.ty === 'gr' && sh.nm === nm) {
        return s as { it?: Record<string, unknown>[] };
      }
    }
    return null;
  }

  function content(nm: string) {
    const gr = findGroup(nm);
    if (!gr) {
      return null;
    }
    return buildGroupContentsInterface(gr, comp, layer);
  }

  const layerFn = function _layerFn(sel: string | number | undefined) {
    if (sel === 'ADBE Root Vectors Group' || sel === 'Contents' || sel === 2) {
      function rootPick(name: string | number) {
        if (typeof name === 'number') {
          const item = shapes[name - 1] as Record<string, unknown> | undefined;
          if (item?.ty === 'gr') {
            return buildGroupContentsInterface(
              item as { it?: Record<string, unknown>[] },
              comp,
              layer,
            );
          }
          return buildShapeChildInterface(item, comp, layer);
        }
        const gr = findGroup(name as string);
        return gr ? buildGroupContentsInterface(gr, comp, layer) : null;
      }
      const rootPickFn = rootPick as Record<string, unknown> & typeof rootPick;
      rootPickFn.content = rootPick;
      return rootPickFn;
    }
    if (sel === 4 || sel === 'ADBE Effect Parade' || sel === 'effects' || sel === 'Effects') {
      return buildEffectInterface(layer, comp);
    }
    return null;
  } as Record<string, unknown> & ((sel: string | number) => unknown);

  layerFn.content = content;
  layerFn.effect = buildEffectInterface(layer, comp);
  layerFn.text = undefined;
  layerFn.toWorld = (arr: number[]) => arr;
  layerFn.fromWorld = (arr: number[]) => arr;
  layerFn.toComp = (arr: number[]) => arr;
  layerFn.fromComp = (arr: number[]) => arr;
  layerFn.fromCompToSurface = (arr: number[]) => arr;
  layerFn.mask = null;
  layerFn.sampleImage = () => [1, 1, 1, 1];

  return layerFn;
}

export function createCompMock(
  fps: number,
  width: number,
  height: number,
): CompMock {
  return {
    renderedFrame: 0,
    globalData: {
      frameRate: fps,
      frameId: 0,
      projectInterface: function projectInterface() {
        return {};
      },
    },
    frameDuration: 1 / fps,
    displayStartTime: 0,
    currentFrame: 0,
    compInterface: {
      width: () => width,
      height: () => height,
    },
  };
}

export function createElemMock(
  layer: Record<string, unknown>,
  comp: CompMock,
) {
  const layerInterface = buildLayerExpressionInterface(layer, comp);
  return {
    data: {
      ty: layer.ty,
      nm: layer.nm,
      ip: layer.ip,
      op: layer.op,
      ind: layer.ind,
      sw: layer.sw,
      sh: layer.sh,
    },
    globalData: {
      renderConfig: { runExpressions: true },
      frameId: 0,
      pushExpression() {},
      popExpression() {},
      registerExpressionProperty() {},
    },
    comp,
    layerInterface,
  };
}

export function createMockExpressionProperty(
  data: Record<string, unknown>,
  comp: CompMock,
  elem: { comp: CompMock },
) {
  const k = data.k as unknown;
  const kf
    = Array.isArray(k)
      && k.length > 0
      && typeof (k as Lottie.OffsetKeyframe[])[0] === 'object'
      && (k as Lottie.OffsetKeyframe[])[0].t !== undefined;

  const prop = {
    data,
    kf: !!kf,
    keyframes: kf ? k : null,
    v: 0 as unknown,
    pv: 0 as unknown,
    mult: 1,
    comp,
    elem,
    propType: undefined as string | undefined,
    frameExpressionId: -1,
    getValueAtTime(_t: number) {
      return prop.v;
    },
    getVelocityAtTime() {
      return 0;
    },
    loopIn: undefined as unknown,
    loopOut: undefined as unknown,
    smooth: undefined as unknown,
  };

  return prop;
}
