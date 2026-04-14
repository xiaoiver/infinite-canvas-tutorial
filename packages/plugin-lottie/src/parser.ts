import type { PathArray } from '@antv/util';
import {
  isNumber,
  distanceSquareRoot,
  isNil,
  getTotalLength,
} from '@antv/util';
import type { LoadAnimationOptions } from './load-animation-options';
import { completeData } from './complete-data';
import {
  bakeScalarExpressionTrack,
  bakeShapePathExpressionTrack,
  bakeVectorExpressionTrack,
  propertyHasExpression,
  type BakedKeyframeAnimation,
} from './expressions';
import * as Lottie from './type';
import { filterUndefined } from '@infinite-canvas-tutorial/ecs';

const rad2deg = (rad: number) => rad * (180 / Math.PI);

export interface KeyframeAnimationKeyframe {
  easing?: string;
  offset: number;
  [key: string]: any;
}

export interface KeyframeAnimation {
  duration?: number;
  delay?: number;
  easing?: string;
  keyframes: Record<string, any>[];
  transformOrigin?: {
    x: number;
    y: number;
  };
}

export interface CustomElementOption {
  type: string;

  keyframeAnimation?: KeyframeAnimation[];
  children?: CustomElementOption[];

  shape?: Record<string, any>;
  style?: Record<string, any>;
  clipPath?: CustomElementOption;
  extra?: any;

  name?: string;
  anchorX?: number;
  anchorY?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  x?: number;
  y?: number;

  visibilityStartOffset?: number;
  visibilityEndOffset?: number;
  visibilityFrame?: number;
}

export class ParseContext {
  fps: number;
  frameTime = 1000 / 30;
  startFrame = 0;
  endFrame: number;
  version: string;
  autoplay = false;
  fill: FillMode = 'auto';
  iterations = 0;

  /** Composition size (for expression `width` / `height`). */
  compWidth = 0;
  compHeight = 0;

  /**
   * Bake AE expression strings (`x` on properties) into keyframes.
   * Uses a minimal evaluator unless {@link expressionEngine} is `lottie-web`; disable if untrusted JSON.
   */
  expressions = true;

  /**
   * @see LoadAnimationOptions.expressionEngine
   */
  expressionEngine: 'simple' | 'lottie-web' = 'lottie-web';

  /** Current JSON while parsing a layer (for lottie-web ExpressionManager `thisLayer`). */
  expressionLayer?: Record<string, unknown>;

  /** Root animation JSON (optional future use for comp-wide expression APIs). */
  animation?: Lottie.Animation;

  assetsMap: Map<string, Lottie.Asset> = new Map();

  layerOffsetTime: number;
}

function expressionBakeContext(ctx: ParseContext) {
  return {
    startFrame: ctx.startFrame,
    endFrame: ctx.endFrame,
    fps: ctx.fps,
    frameTime: ctx.frameTime,
    compWidth: ctx.compWidth,
    compHeight: ctx.compHeight,
    expressionEngine: ctx.expressionEngine,
    expressionLayer: ctx.expressionLayer,
  };
}

/**
 * Expression bake returns only `keyframes`; we still need static `attrs` for initial
 * {@link LottieAnimation.buildHierachy} (e.g. `shape.cx` / `cy`). Otherwise `formatKeyframes` →
 * empty animation leaves the ellipse/path with undefined geometry.
 */
function seedTargetFromBakedOrStaticK(
  baked: BakedKeyframeAnimation,
  lottieVal: Lottie.MultiDimensional | Lottie.Value,
  target: Record<string, any>,
  targetPropName: string,
  propNames: string[],
  convertVal?: (val: number) => number,
) {
  const row = baked.keyframes[0] as Record<string, unknown>;
  const payload = targetPropName ? row[targetPropName] : row;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    for (const n of propNames) {
      const v = (payload as Record<string, unknown>)[n];
      if (typeof v === 'number' && Number.isFinite(v)) {
        target[n] = convertVal ? convertVal(v) : v;
      }
    }
  }
  for (const n of propNames) {
    if (typeof target[n] === 'number' && Number.isFinite(target[n])) {
      continue;
    }
    if (isMultiDimensionalValue(lottieVal)) {
      const i = propNames.indexOf(n);
      const val = getMultiDimensionValue(lottieVal.k as number[], i);
      target[n] = convertVal ? convertVal(val) : val;
    } else if (isValue(lottieVal) && propNames.length === 1 && n === propNames[0]) {
      target[n] = convertVal ? convertVal(lottieVal.k as number) : (lottieVal.k as number);
    }
  }
}

function isNumberArray(val: any): val is number[] {
  return Array.isArray(val) && typeof val[0] === 'number';
}

function isMultiDimensionalValue(val?: { k?: any }): val is { k: number[] } {
  return isNumberArray(val?.k);
}

function isMultiDimensionalKeyframedValue(val?: {
  k?: any;
}): val is { k: Lottie.OffsetKeyframe[] } {
  const k = val?.k;
  return Array.isArray(k) && k[0].t !== undefined && isNumberArray(k[0].s);
}

function isValue(val?: { k?: any }): val is { k: number } {
  // TODO is [100] sort of value?
  return typeof val?.k === 'number';
}

function isKeyframedValue(val?: {
  k?: any;
}): val is { k: Lottie.OffsetKeyframe[] } {
  const k = val?.k;
  return Array.isArray(k) && k[0].t !== undefined && typeof k[0].s === 'number';
}

function toColorString(val: number | number[]) {
  const opacity = getMultiDimensionValue(val, 3);

  return `rgba(${[
    Math.round(getMultiDimensionValue(val, 0) * 255),
    Math.round(getMultiDimensionValue(val, 1) * 255),
    Math.round(getMultiDimensionValue(val, 2) * 255),
    !isNil(opacity) ? opacity : 1,
  ].join(',')})`;
}

function getMultiDimensionValue(val: number | number[], dimIndex?: number) {
  // eslint-disable-next-line no-nested-ternary
  return val != null
    ? typeof val === 'number'
      ? val
      : val[dimIndex || 0]
    : NaN;
}

/**
 * @see https://lottiefiles.github.io/lottie-docs/concepts/#easing-handles
 */
function getMultiDimensionEasingBezierString(
  kf: Pick<Lottie.OffsetKeyframe, 'o' | 'i'>,
  nextKf: Pick<Lottie.OffsetKeyframe, 'o' | 'i'>,
  dimIndex?: number,
) {
  const bezierEasing: number[] = [];
  bezierEasing.push(
    (kf.o?.x &&
      (getMultiDimensionValue(kf.o.x, dimIndex) ||
        getMultiDimensionValue(kf.o.x, 0))) ||
    0,
    (kf.o?.y &&
      (getMultiDimensionValue(kf.o.y, dimIndex) ||
        getMultiDimensionValue(kf.o.y, 0))) ||
    0,
    (kf.i?.x &&
      (getMultiDimensionValue(kf.i.x, dimIndex) ||
        getMultiDimensionValue(kf.i.x, 0))) ||
    1,
    (kf.i?.y &&
      (getMultiDimensionValue(kf.i.y, dimIndex) ||
        getMultiDimensionValue(kf.i.y, 0))) ||
    1,
    // nextKf?.o?.x ? getMultiDimensionValue(nextKf.o.x, dimIndex) : 1,
    // nextKf?.o?.y ? getMultiDimensionValue(nextKf.o.y, dimIndex) : 1,
  );

  // linear by default
  if (
    !(
      bezierEasing[0] === 0 &&
      bezierEasing[1] === 0 &&
      bezierEasing[2] === 1 &&
      bezierEasing[3] === 1
    )
  ) {
    return `cubic-bezier(${bezierEasing.join(',')})`;
  }
}

/**
 * @see https://lottiefiles.github.io/lottie-docs/concepts/#keyframe
 */
function parseKeyframe(
  kfs: Lottie.OffsetKeyframe[],
  bezierEasingDimIndex: number,
  context: ParseContext,
  setVal: (kfObj: any, val: any) => void,
) {
  const kfsLen = kfs.length;
  // const offset = context.layerStartTime;
  const duration = context.endFrame - context.startFrame;
  const out: KeyframeAnimation = {
    duration: 0,
    delay: 0,
    keyframes: [],
  };

  let prevKf;
  for (let i = 0; i < kfsLen; i++) {
    const kf = kfs[i];
    const nextKf = kfs[i + 1];

    // If h is present and it's 1, you don't need i and o,
    // as the property will keep the same value until the next keyframe.
    const isDiscrete = kf.h === 1;
    const offset =
      (kf.t + context.layerOffsetTime - context.startFrame) / duration;

    const outKeyframe: KeyframeAnimationKeyframe = {
      offset,
    };
    if (!isDiscrete) {
      outKeyframe.easing = getMultiDimensionEasingBezierString(
        kf,
        nextKf,
        bezierEasingDimIndex,
      );
    }
    // Use end state of later frame if start state not exits.
    // @see https://lottiefiles.github.io/lottie-docs/concepts/#old-lottie-keyframes
    const startVal = kf.s || prevKf?.e;
    if (startVal) {
      setVal(outKeyframe, startVal);
    }

    if (outKeyframe.offset > 0 && i === 0) {
      // Set initial
      const initialKeyframe = {
        offset: 0,
      };
      if (startVal) {
        setVal(initialKeyframe, startVal);
      }
      out.keyframes.push(initialKeyframe);
    }

    out.keyframes.push(outKeyframe);

    if (isDiscrete && nextKf) {
      // Use two keyframe to simulate the discrete animation.
      const extraKeyframe: KeyframeAnimationKeyframe = {
        offset: Math.max(
          (nextKf.t + context.layerOffsetTime - context.startFrame) / duration,
          0,
        ),
      };
      setVal(extraKeyframe, startVal);
      out.keyframes.push(extraKeyframe);
    }

    prevKf = kf;
  }

  if (kfsLen) {
    out.duration = context.frameTime * duration;
  }

  return out;
}

function parseOffsetKeyframe(
  kfs: Lottie.OffsetKeyframe[],
  targetPropName: string,
  propNames: string[],
  keyframeAnimations: KeyframeAnimation[],
  context: ParseContext,
  convertVal?: (val: number) => number,
) {
  for (let dimIndex = 0; dimIndex < propNames.length; dimIndex++) {
    const propName = propNames[dimIndex];
    const keyframeAnim = parseKeyframe(
      kfs,
      dimIndex,
      context,
      (outKeyframe, startVal) => {
        let val = getMultiDimensionValue(startVal, dimIndex);
        if (convertVal) {
          val = convertVal(val);
        }
        (targetPropName
          ? (outKeyframe[targetPropName] = {} as any)
          : outKeyframe)[propName] = val;
      },
    );

    // moving position around a curved path
    const needOffsetPath = kfs.some((kf) => kf.ti && kf.to);
    if (needOffsetPath) {
      const offsetPath: PathArray = [] as unknown as PathArray;

      kfs.forEach((kf, i) => {
        keyframeAnim.keyframes[i].offsetPath = offsetPath;

        // convert to & ti(Tangent for values (eg: moving position around a curved path)) to offsetPath & offsetDistance
        // @see https://lottiefiles.github.io/lottie-docs/concepts/#animated-position
        if (kf.ti && kf.to) {
          if (i === 0) {
            offsetPath.push(['M', kf.s[0], kf.s[1]]);
          }

          keyframeAnim.keyframes[i].segmentLength = getTotalLength(offsetPath);

          // @see https://lottiefiles.github.io/lottie-docs/concepts/#bezier
          // The nth bezier segment is defined as:
          // v[n], v[n]+o[n], v[n+1]+i[n+1], v[n+1]
          offsetPath.push([
            'C',
            kf.s[0] + kf.to[0],
            kf.s[1] + kf.to[1],
            kf.s[0] + kf.ti[0],
            kf.s[1] + kf.ti[1],
            kf.e[0],
            kf.e[1],
          ]);
        }
      });

      // calculate offsetDistance: segmentLength / totalLength
      const totalLength = getTotalLength(offsetPath);
      keyframeAnim.keyframes.forEach((kf) => {
        kf.offsetDistance = isNil(kf.segmentLength)
          ? 1
          : kf.segmentLength / totalLength;
        delete kf.segmentLength;
      });
    }

    if (keyframeAnim.keyframes.length) {
      keyframeAnimations.push(keyframeAnim);
    }
  }
}

function parseColorOffsetKeyframe(
  kfs: Lottie.OffsetKeyframe[],
  targetPropName: string,
  propName: string,
  keyframeAnimations: KeyframeAnimation[],
  context: ParseContext,
) {
  const keyframeAnim = parseKeyframe(
    kfs,
    0,
    context,
    (outKeyframe, startVal) => {
      (targetPropName
        ? (outKeyframe[targetPropName] = {} as any)
        : outKeyframe)[propName] = toColorString(startVal);
    },
  );
  if (keyframeAnim.keyframes.length) {
    keyframeAnimations.push(keyframeAnim);
  }
}

function parseValue(
  lottieVal: Lottie.MultiDimensional | Lottie.Value,
  attrs: Record<string, any>,
  targetPropName: string,
  propNames: string[],
  animations: KeyframeAnimation[],
  context: ParseContext,
  convertVal?: (val: number) => number,
) {
  if (targetPropName) {
    attrs[targetPropName] = attrs[targetPropName] || {};
  }
  const target = targetPropName ? attrs[targetPropName] : attrs;

  if (context.expressions && propertyHasExpression(lottieVal as { x?: string })) {
    const code = String((lottieVal as unknown as { x: string }).x);
    const bakeCtx = expressionBakeContext(context);
    let baked = null;

    if (isValue(lottieVal) || isKeyframedValue(lottieVal)) {
      baked = bakeScalarExpressionTrack(
        code,
        lottieVal as Lottie.Value,
        bakeCtx,
        targetPropName,
        propNames[0],
        convertVal,
      );
    } else if (
      isMultiDimensionalValue(lottieVal)
      || isMultiDimensionalKeyframedValue(lottieVal)
    ) {
      baked = bakeVectorExpressionTrack(
        code,
        lottieVal as Lottie.MultiDimensional,
        bakeCtx,
        targetPropName,
        propNames,
        convertVal,
      );
    }

    if (baked) {
      animations.push(baked);
      seedTargetFromBakedOrStaticK(
        baked,
        lottieVal,
        target,
        targetPropName,
        propNames,
        convertVal,
      );
      return;
    }
  }

  if (isValue(lottieVal)) {
    const val = lottieVal.k;
    target[propNames[0]] = convertVal ? convertVal(val) : val;
  } else if (isKeyframedValue(lottieVal)) {
    parseOffsetKeyframe(
      lottieVal.k,
      targetPropName,
      propNames,
      animations,
      context,
      convertVal,
    );
  } else if (isMultiDimensionalValue(lottieVal)) {
    for (let i = 0; i < propNames.length; i++) {
      const val = getMultiDimensionValue(lottieVal.k, i);
      target[propNames[i]] = convertVal ? convertVal(val) : val;
    }
  } else if (isMultiDimensionalKeyframedValue(lottieVal)) {
    // TODO Merge dimensions
    parseOffsetKeyframe(
      lottieVal.k,
      targetPropName,
      propNames,
      animations,
      context,
      convertVal,
    );
  }
}

/**
 * @see https://lottiefiles.github.io/lottie-docs/concepts/#transform
 */
function parseTransforms(
  ks: Lottie.Transform,
  attrs: Record<string, any>,
  animations: KeyframeAnimation[],
  context: ParseContext,
  targetProp = '',
  transformProps = {
    x: 'x',
    y: 'y',
    rotation: 'rotation',
    scaleX: 'scaleX',
    scaleY: 'scaleY',
    anchorX: 'anchorX',
    anchorY: 'anchorY',
    skew: 'skew',
    skewAxis: 'skewAxis',
  },
) {
  // @see https://lottiefiles.github.io/lottie-docs/concepts/#split-vector
  if ((ks.p as Lottie.Position)?.s) {
    parseValue(
      (ks.p as Lottie.Position).x,
      attrs,
      targetProp,
      [transformProps.x],
      animations,
      context,
    );
    parseValue(
      (ks.p as Lottie.Position).y,
      attrs,
      targetProp,
      [transformProps.y],
      animations,
      context,
    );
  } else {
    parseValue(
      ks.p as Lottie.MultiDimensional,
      attrs,
      targetProp,
      [transformProps.x, transformProps.y],
      animations,
      context,
    );
  }
  parseValue(
    ks.s,
    attrs,
    targetProp,
    [transformProps.scaleX, transformProps.scaleY],
    animations,
    context,
    (val) => val / 100,
  );
  parseValue(
    ks.r,
    attrs,
    targetProp,
    [transformProps.rotation],
    animations,
    context,
  );

  parseValue(
    ks.a,
    attrs,
    targetProp,
    [transformProps.anchorX, transformProps.anchorY],
    animations,
    context,
  );

  parseValue(
    ks.sk,
    attrs,
    targetProp,
    [transformProps.skew],
    animations,
    context,
  );

  parseValue(
    ks.sa,
    attrs,
    targetProp,
    [transformProps.skewAxis],
    animations,
    context,
  );

  // Group/layer transform opacity is a style property (0~100 -> 0~1),
  // not a geometric transform component.
  parseValue(
    ks.o as unknown as Lottie.Value,
    attrs,
    'style',
    ['opacity'],
    animations,
    context,
    (val) => val / 100,
  );
}

function isGradientFillOrStroke(
  fl: any,
): fl is Lottie.GradientFillShape | Lottie.GradientStrokeShape {
  return fl.g && fl.s && fl.e;
}

function toFinitePoint(value: number[] | undefined): [number, number] {
  const x = value?.[0];
  const y = value?.[1];
  return [
    typeof x === 'number' && Number.isFinite(x) ? x : 0,
    typeof y === 'number' && Number.isFinite(y) ? y : 0,
  ];
}

function pickFirstArraySample(value?: { k?: any }): number[] | undefined {
  const k = value?.k;
  if (!Array.isArray(k) || k.length === 0) {
    return undefined;
  }

  // static: { a:0, k:[...] }
  if (typeof k[0] === 'number') {
    return k as number[];
  }

  // keyframed: { a:1, k:[{ t, s:[...] }, ...] }
  if (k[0] && typeof k[0] === 'object' && Array.isArray(k[0].s)) {
    return k[0].s as number[];
  }

  return undefined;
}

function convertColorStops(arr: number[], count: number) {
  const colorStops = [];
  for (let i = 0; i < count * 4;) {
    const offset = arr[i++];
    const r = Math.round(arr[i++] * 255);
    const g = Math.round(arr[i++] * 255);
    const b = Math.round(arr[i++] * 255);
    if (
      !Number.isFinite(offset)
      || !Number.isFinite(r)
      || !Number.isFinite(g)
      || !Number.isFinite(b)
    ) {
      continue;
    }
    colorStops.push({
      offset,
      color: `rgb(${r}, ${g}, ${b})`,
    });
  }
  return colorStops;
}

function joinColorStops(colorStops: any[]) {
  return `${colorStops
    .map(({ offset, color }) => `${color} ${offset * 100}%`)
    .join(', ')}`;
}

/**
 * TODO:
 * * Transition
 * * Highlight length & angle in Radial Gradient
 *
 * @see https://lottiefiles.github.io/lottie-docs/concepts/#gradients
 * @see https://lottiefiles.github.io/lottie-docs/shapes/#gradients
 */
function parseGradient(
  shape: Lottie.GradientFillShape | Lottie.GradientStrokeShape,
  gradientSample?: number[],
) {
  const colorArr = gradientSample ?? pickFirstArraySample(shape.g.k as { k?: any }) ?? [];
  const colorStops = convertColorStops(colorArr, shape.g.p);
  if (!colorStops.length) {
    return '#000';
  }
  const start = toFinitePoint(
    isMultiDimensionalValue(shape.s)
      ? (shape.s.k as number[])
      : pickFirstArraySample(shape.s as { k?: any }),
  );
  const end = toFinitePoint(
    isMultiDimensionalValue(shape.e)
      ? (shape.e.k as number[])
      : pickFirstArraySample(shape.e as { k?: any }),
  );
  // @see https://lottiefiles.github.io/lottie-docs/constants/#gradienttype
  if (shape.t === Lottie.GradientType.Linear) {
    const angle = rad2deg(
      Math.atan2(
        end[1] - start[1],
        end[0] - start[0],
      ),
    );

    // @see https://g-next.antv.vision/zh/docs/api/css/css-properties-values-api#linear-gradient
    return `linear-gradient(${angle}deg, ${joinColorStops(colorStops)})`;
  }
  if (shape.t === Lottie.GradientType.Radial) {
    // TODO: highlight length & angle (h & a)
    // Highlight Length, as a percentage between s and e
    // Highlight Angle, relative to the direction from s to e
    const size = distanceSquareRoot(
      end,
      start,
    );

    // @see https://g-next.antv.vision/zh/docs/api/css/css-properties-values-api#radial-gradient
    return `radial-gradient(circle ${size}px at ${start[0]}px ${start[1]
      }px, ${joinColorStops(colorStops)})`;
  }
  // Invalid gradient
  return '#000';
}

function parseGradientOffsetKeyframe(
  shape: Lottie.GradientFillShape | Lottie.GradientStrokeShape,
  targetPropName: string,
  propName: string,
  keyframeAnimations: KeyframeAnimation[],
  context: ParseContext,
) {
  if (!isMultiDimensionalKeyframedValue(shape.g.k as { k?: any })) {
    return;
  }
  const keyframeAnim = parseKeyframe(
    (shape.g.k as { k: Lottie.OffsetKeyframe[] }).k,
    0,
    context,
    (outKeyframe, startVal) => {
      (targetPropName
        ? (outKeyframe[targetPropName] = {} as any)
        : outKeyframe)[propName] = parseGradient(shape, startVal as number[]);
    },
  );
  if (keyframeAnim.keyframes.length) {
    keyframeAnimations.push(keyframeAnim);
  }
}
function parseFill(
  fl: Lottie.FillShape | Lottie.GradientFillShape,
  attrs: Record<string, any>,
  animations: KeyframeAnimation[],
  context: ParseContext,
) {
  attrs.style = attrs.style || {};
  // Color
  if (isGradientFillOrStroke(fl)) {
    attrs.style.fill = parseGradient(fl);
    parseGradientOffsetKeyframe(fl, 'style', 'fill', animations, context);
  } else if (isMultiDimensionalValue(fl.c)) {
    attrs.style.fill = toColorString(fl.c.k);
  } else if (isMultiDimensionalKeyframedValue(fl.c)) {
    parseColorOffsetKeyframe(fl.c.k, 'style', 'fill', animations, context);
  }

  // FillRule @see https://lottiefiles.github.io/lottie-docs/constants/#fillrule
  attrs.style.fillRule =
    fl.r === Lottie.FillRule.EvenOdd ? 'evenodd' : 'nonzero';

  // Opacity
  parseValue(
    fl.o,
    attrs,
    'style',
    ['fillOpacity'],
    animations,
    context,
    (opacity) => opacity / 100,
  );
}

function parseStroke(
  st: Lottie.StrokeShape,
  attrs: Record<string, any>,
  animations: KeyframeAnimation[],
  context: ParseContext,
) {
  attrs.style = attrs.style || {};
  // Color
  if (isGradientFillOrStroke(st)) {
    attrs.style.stroke = parseGradient(st);
    parseGradientOffsetKeyframe(st, 'style', 'stroke', animations, context);
  } else if (isMultiDimensionalValue(st.c)) {
    attrs.style.stroke = toColorString(st.c.k);
  } else if (isMultiDimensionalKeyframedValue(st.c)) {
    parseColorOffsetKeyframe(st.c.k, 'style', 'stroke', animations, context);
  }

  // Opacity
  parseValue(
    st.o,
    attrs,
    'style',
    ['strokeOpacity'],
    animations,
    context,
    (opacity) => opacity / 100,
  );
  // Line width
  parseValue(st.w, attrs, 'style', ['strokeWidth'], animations, context);

  switch (st.lj) {
    case Lottie.LineJoin.Bevel:
      attrs.style.strokeLinejoin = 'bevel';
      break;
    case Lottie.LineJoin.Round:
      attrs.style.strokeLinejoin = 'round';
      break;
    case Lottie.LineJoin.Miter:
      attrs.style.strokeLinejoin = 'miter';
      break;
  }

  switch (st.lc) {
    case Lottie.LineCap.Butt:
      attrs.style.strokeLinecap = 'butt';
      break;
    case Lottie.LineCap.Round:
      attrs.style.strokeLinecap = 'round';
      break;
    case Lottie.LineCap.Square:
      attrs.style.strokeLinecap = 'square';
      break;
  }

  // Line dash
  const dashArray: number[] = [];
  let dashOffset = 0;
  if (st.d) {
    st.d.forEach((item) => {
      if (item.n !== 'o') {
        dashArray.push(item.v.k);
      } else {
        dashOffset = item.v.k;
      }
    });

    attrs.style.strokeDasharray = dashArray;
    attrs.style.strokeDashoffset = dashOffset;
  }
}

/** Non-empty vertex list; empty `v` is often a placeholder when `ks.x` holds the path expression. */
function isBezier(k: any): k is Lottie.Bezier {
  return (
    k
    && k.i
    && k.o
    && k.v
    && Array.isArray(k.v)
    && k.v.length > 0
  );
}

/**
 * @see https://lottiefiles.github.io/lottie-docs/shapes/#path
 */
function parseShapePaths(
  shape: Pick<Lottie.PathShape, 'ks'>,
  animations: KeyframeAnimation[],
  context: ParseContext,
) {
  const attrs: any = {
    type: 'path',
    // Should have no fill and stroke by default
    style: {
      fill: 'none',
      stroke: 'none',
    },
  };
  const ks = shape.ks as Lottie.ShapeProperty & { x?: string };

  if (context.expressions && propertyHasExpression(ks as { x?: string })) {
    const bakeCtx = expressionBakeContext(context);
    const baked = bakeShapePathExpressionTrack(String(ks.x), ks, bakeCtx);
    if (baked) {
      animations.push(baked);
      const first = baked.keyframes[0] as { shape?: Record<string, unknown> };
      attrs.shape = first?.shape ?? { in: [], out: [], v: [] };
      return attrs;
    }
  }

  // @see https://lottiefiles.github.io/lottie-docs/concepts/#bezier
  if (isBezier(shape.ks.k)) {
    attrs.shape = {
      in: shape.ks.k.i,
      out: shape.ks.k.o,
      v: shape.ks.k.v,
      close: shape.ks.k.c,
    };
  } else if (Array.isArray(shape.ks.k)) {
    const keyframeAnim = parseKeyframe(
      shape.ks.k as any as Lottie.OffsetKeyframe[],
      0,
      context,
      (outKeyframe, startVal) => {
        outKeyframe.shape = {
          in: startVal[0].i,
          out: startVal[0].o,
          v: startVal[0].v,
          close: startVal[0].c,
        };
      },
    );
    if (keyframeAnim.keyframes.length) {
      animations.push(keyframeAnim);
    }
  }
  return attrs;
}

/**
 * @see https://lottiefiles.github.io/lottie-docs/shapes/#rectangle
 */
function parseShapeRect(
  shape: Lottie.RectShape,
  animations: KeyframeAnimation[],
  context: ParseContext,
) {
  const attrs = {
    type: 'rect',
    // Should have no fill and stroke by default
    style: {
      fill: 'none',
      stroke: 'none',
    },
    shape: {},
  };

  parseValue(shape.p, attrs, 'shape', ['x', 'y'], animations, context);
  parseValue(shape.s, attrs, 'shape', ['width', 'height'], animations, context);
  parseValue(shape.r, attrs, 'shape', ['r'], animations, context);

  return attrs;
}

/**
 * @see https://lottiefiles.github.io/lottie-docs/layers/#image-layer
 */
function parseImageLayer(layer: Lottie.ImageLayer, context: ParseContext) {
  const attrs = {
    type: 'image',
    style: {},
    shape: {
      width: 0,
      height: 0,
      src: '',
    },
  };

  const asset = context.assetsMap.get(layer.refId) as Lottie.ImageAsset;
  if (asset) {
    attrs.shape.width = asset.w;
    attrs.shape.height = asset.h;
    // TODO: url to fetch
    attrs.shape.src = asset.p;
  }

  return attrs;
}

/**
 * @see https://lottiefiles.github.io/lottie-docs/shapes/#ellipse
 */
function parseShapeEllipse(
  shape: Lottie.EllipseShape,
  animations: KeyframeAnimation[],
  context: ParseContext,
) {
  const attrs: any = {
    type: 'ellipse',
    // Should have no fill and stroke by default
    style: {
      fill: 'none',
      stroke: 'none',
    },
    shape: {},
  };

  parseValue(shape.p, attrs, 'shape', ['cx', 'cy'], animations, context);
  parseValue(
    shape.s,
    attrs,
    'shape',
    ['rx', 'ry'],
    animations,
    context,
    (val) => val / 2,
  );
  return attrs;
}

function parseShapeLayer(layer: Lottie.ShapeLayer, context: ParseContext) {
  const GROUP_TRANSFORM_ATTR_KEYS = new Set([
    'x',
    'y',
    'scaleX',
    'scaleY',
    'rotation',
    'anchorX',
    'anchorY',
    'skew',
    'skewAxis',
  ]);

  const stripGroupTransformAttrs = <T extends CustomElementOption>(el: T): T => {
    const next = { ...el } as Record<string, any>;
    GROUP_TRANSFORM_ATTR_KEYS.forEach((key) => {
      if (key in next) {
        delete next[key];
      }
    });
    return next as T;
  };

  const pickGroupTransformAttrs = (
    attrs: Record<string, any>,
  ): Partial<CustomElementOption> => {
    const out: Record<string, any> = {};
    GROUP_TRANSFORM_ATTR_KEYS.forEach((key) => {
      if (typeof attrs[key] === 'number' && Number.isFinite(attrs[key])) {
        out[key] = attrs[key];
      }
    });
    return out;
  };

  const isGroupTransformAnimationTrack = (animation: KeyframeAnimation): boolean =>
    animation.keyframes.some((kf) => {
      const payload = Object.keys(kf).filter(
        (k) => k !== 'offset' && k !== 'easing',
      );
      if (payload.some((k) => GROUP_TRANSFORM_ATTR_KEYS.has(k))) {
        return true;
      }
      return false;
    });

  function tryCreateShape(
    shape: Lottie.ShapeElement,
    keyframeAnimations: KeyframeAnimation[],
  ) {
    let ecEl: any;
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (shape.ty) {
      case Lottie.ShapeType.Path:
        ecEl = parseShapePaths(
          shape as Lottie.PathShape,
          keyframeAnimations,
          context,
        );
        break;
      case Lottie.ShapeType.Ellipse:
        ecEl = parseShapeEllipse(
          shape as Lottie.EllipseShape,
          keyframeAnimations,
          context,
        );
        break;
      case Lottie.ShapeType.Rectangle:
        ecEl = parseShapeRect(
          shape as Lottie.RectShape,
          keyframeAnimations,
          context,
        );
        break;
      case Lottie.ShapeType.PolyStar:
        // TODO: parseShapePolyStar
        break;
    }
    return ecEl;
  }

  function parseModifiers(
    shapes: Lottie.ShapeElement[],
    modifiers: {
      attrs: Record<string, any>;
      keyframeAnimations: KeyframeAnimation[];
    },
  ) {
    shapes.forEach((shape) => {
      if (shape.hd) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
      switch (shape.ty) {
        case Lottie.ShapeType.Repeater:
          parseValue(
            (shape as Lottie.RepeatShape).c,
            modifiers.attrs,
            'shape',
            ['repeat'],
            modifiers.keyframeAnimations,
            context,
          );
          parseTransforms(
            (shape as Lottie.RepeatShape).tr,
            modifiers.attrs,
            modifiers.keyframeAnimations,
            context,
            'shape',
            {
              x: 'repeatX',
              y: 'repeatY',
              rotation: 'repeatRot',
              scaleX: 'repeatScaleX',
              scaleY: 'repeatScaleY',
              anchorX: 'repeatAnchorX',
              anchorY: 'repeatAnchorY',
              skew: 'repeatSkew',
              skewAxis: 'repeatSkewAxis',
            },
          );
          break;
        case Lottie.ShapeType.Trim:
          parseValue(
            (shape as Lottie.TrimShape).s,
            modifiers.attrs,
            'shape',
            ['trimStart'],
            modifiers.keyframeAnimations,
            context,
          );
          parseValue(
            (shape as Lottie.TrimShape).e,
            modifiers.attrs,
            'shape',
            ['trimEnd'],
            modifiers.keyframeAnimations,
            context,
          );
          break;
      }
    });
  }

  function parseIterations(
    shapes: Lottie.ShapeElement[],
    modifiers: {
      attrs: Record<string, any>;
      keyframeAnimations: KeyframeAnimation[];
    },
    keepTransformOnGroup = false,
  ) {
    const ecEls: CustomElementOption[] = [];
    const attrs: Record<string, any> = {};
    const keyframeAnimations: KeyframeAnimation[] = [];

    // Order is reversed
    shapes = shapes.slice().reverse();

    // Modifiers first:
    parseModifiers(shapes, modifiers);

    shapes.forEach((shape) => {
      if (shape.hd) {
        return;
      }

      let ecEl: CustomElementOption | undefined;
      /** Indices into {@link keyframeAnimations} for this shape only (path / ellipse / rect). */
      let ownKfRange: [number, number] | undefined;
      switch (shape.ty) {
        case Lottie.ShapeType.Group:
          ecEl = {
            type: 'g',
            children: parseIterations(
              (shape as Lottie.GroupShapeElement).it,
              // Modifiers will be applied to all childrens.
              modifiers,
              true,
            ),
          };
          break;
        // TODO Multiple fill and stroke
        case Lottie.ShapeType.Fill:
        case Lottie.ShapeType.GradientFill:
          parseFill(
            shape as Lottie.FillShape,
            attrs,
            keyframeAnimations,
            context,
          );
          break;
        case Lottie.ShapeType.Stroke:
        case Lottie.ShapeType.GradientStroke:
          parseStroke(
            shape as Lottie.StrokeShape,
            attrs,
            keyframeAnimations,
            context,
          );
          break;
        case Lottie.ShapeType.Transform:
          parseTransforms(
            shape as Lottie.TransformShape,
            attrs,
            keyframeAnimations,
            context,
          );
          break;
        // TODO Multiple shapes.
        default: {
          const kfStart = keyframeAnimations.length;
          ecEl = tryCreateShape(shape, keyframeAnimations);
          if (ecEl) {
            ownKfRange = [kfStart, keyframeAnimations.length];
          }
        }
      }
      if (ecEl) {
        ecEl.name = shape.nm;
        if (ownKfRange) {
          (ecEl as CustomElementOption & { _ownKfRange?: [number, number] })._ownKfRange
            = ownKfRange;
        }
        ecEls.push(ecEl);
      }
    });

    const sharedPrefixEnd = ecEls.reduce<number | undefined>((acc, el) => {
      const r = (el as CustomElementOption & { _ownKfRange?: [number, number] })._ownKfRange;
      if (!r) {
        return acc;
      }
      const start = r[0];
      return acc === undefined ? start : Math.min(acc, start);
    }, undefined) ?? 0;

    ecEls.forEach((el, idx) => {
      // Apply modifiers first
      const merged = {
        ...el,
        ...filterUndefined(modifiers.attrs),
        ...attrs,
      };
      el = keepTransformOnGroup ? stripGroupTransformAttrs(merged) : merged;

      if (keyframeAnimations.length || modifiers.keyframeAnimations.length) {
        const ownRange = (el as CustomElementOption & { _ownKfRange?: [number, number] })
          ._ownKfRange;
        delete (el as CustomElementOption & { _ownKfRange?: [number, number] })._ownKfRange;

        if (ownRange) {
          const shared = keyframeAnimations.slice(0, sharedPrefixEnd);
          const own = keyframeAnimations.slice(ownRange[0], ownRange[1]);
          el.keyframeAnimation = [
            ...modifiers.keyframeAnimations,
            ...shared,
            ...own,
          ];
        } else {
          // e.g. `ty: gr` — no shape-local track appended in this iteration.
          el.keyframeAnimation = [
            ...modifiers.keyframeAnimations,
            ...keyframeAnimations,
          ];
        }
        if (keepTransformOnGroup && el.keyframeAnimation?.length) {
          el.keyframeAnimation = el.keyframeAnimation.filter(
            (animation) => !isGroupTransformAnimationTrack(animation),
          );
          if (!el.keyframeAnimation.length) {
            delete el.keyframeAnimation;
          }
        }
      }

      applyGroupOpacityToChildren(el);

      ecEls[idx] = el;
    });
    if (keepTransformOnGroup) {
      const groupTransformAttrs = pickGroupTransformAttrs(attrs);
      const groupTransformAnimations = keyframeAnimations.filter(
        (animation) => isGroupTransformAnimationTrack(animation),
      );
      if (
        Object.keys(groupTransformAttrs).length
        || groupTransformAnimations.length
      ) {
        const groupNode: CustomElementOption = {
          type: 'g',
          children: ecEls,
          ...(groupTransformAttrs as CustomElementOption),
        };
        if (groupTransformAnimations.length) {
          groupNode.keyframeAnimation = groupTransformAnimations;
        }
        return [groupNode];
      }
    }
    return ecEls;
  }

  return {
    type: 'g',
    children: parseIterations(layer.shapes, {
      attrs: {},
      keyframeAnimations: [],
    }),
  } as CustomElementOption;
}

function traverse(
  el: CustomElementOption,
  cb: (el: CustomElementOption) => void,
) {
  cb(el);
  if (el.type === 'g') {
    el.children?.forEach((child) => {
      traverse(child, cb);
    });
  }
}

function pickOpacityFromKeyframe(keyframe: Record<string, any>) {
  if (typeof keyframe.opacity === 'number' && Number.isFinite(keyframe.opacity)) {
    return keyframe.opacity;
  }
  if (
    keyframe.style
    && typeof keyframe.style === 'object'
    && typeof keyframe.style.opacity === 'number'
    && Number.isFinite(keyframe.style.opacity)
  ) {
    return keyframe.style.opacity;
  }
}

function extractOpacityAnimations(
  animations: KeyframeAnimation[] | undefined,
): KeyframeAnimation[] {
  if (!animations?.length) {
    return [];
  }
  const result: KeyframeAnimation[] = [];
  animations.forEach((animation) => {
    const opacityKeyframes = animation.keyframes
      .map((keyframe) => {
        const opacity = pickOpacityFromKeyframe(keyframe as Record<string, any>);
        if (typeof opacity !== 'number') {
          return null;
        }
        return {
          offset: keyframe.offset,
          style: { opacity },
        };
      })
      .filter((keyframe): keyframe is { offset: number; style: { opacity: number } } => !!keyframe);
    if (opacityKeyframes.length) {
      result.push({
        ...animation,
        keyframes: opacityKeyframes,
      });
    }
  });
  return result;
}

function stripOpacityAnimations(
  animations: KeyframeAnimation[] | undefined,
): KeyframeAnimation[] {
  if (!animations?.length) {
    return [];
  }
  return animations
    .map((animation) => {
      const stripped = animation.keyframes
        .map((keyframe) => {
          const next = { ...keyframe } as Record<string, any>;
          delete next.opacity;
          if (next.style && typeof next.style === 'object') {
            next.style = { ...next.style };
            delete next.style.opacity;
            if (!Object.keys(next.style).length) {
              delete next.style;
            }
          }
          const hasPayload = Object.keys(next).some((key) => key !== 'offset');
          return hasPayload ? next : null;
        })
        .filter((keyframe): keyframe is KeyframeAnimation['keyframes'][number] => !!keyframe);
      if (!stripped.length) {
        return null;
      }
      return {
        ...animation,
        keyframes: stripped,
      };
    })
    .filter((animation): animation is KeyframeAnimation => !!animation);
}

function applyGroupOpacityToChildren(el: CustomElementOption) {
  if (el.type !== 'g') {
    return;
  }

  const staticOpacity = el.style?.opacity;
  const hasStaticOpacity = typeof staticOpacity === 'number' && Number.isFinite(staticOpacity);
  const opacityAnimations = extractOpacityAnimations(el.keyframeAnimation);
  if (!hasStaticOpacity && !opacityAnimations.length) {
    return;
  }

  traverse(el, (current) => {
    if (current === el || current.type === 'g') {
      return;
    }
    current.style = current.style || {};
    if (hasStaticOpacity) {
      const baseOpacity = typeof current.style.opacity === 'number' ? current.style.opacity : 1;
      current.style.opacity = baseOpacity * staticOpacity;
    }
    if (opacityAnimations.length) {
      current.keyframeAnimation = (current.keyframeAnimation || []).concat(opacityAnimations);
    }
  });

  if (el.style && typeof el.style === 'object' && 'opacity' in el.style) {
    delete el.style.opacity;
    if (!Object.keys(el.style).length) {
      delete el.style;
    }
  }
  if (el.keyframeAnimation?.length) {
    el.keyframeAnimation = stripOpacityAnimations(el.keyframeAnimation);
    if (!el.keyframeAnimation.length) {
      delete el.keyframeAnimation;
    }
  }
}

function addLayerOpacity(
  layer: Lottie.Layer,
  layerGroup: CustomElementOption,
  context: ParseContext,
) {
  const opacityAttrs = {} as CustomElementOption;
  const opacityAnimations: KeyframeAnimation[] = [];

  if (layer.ks?.o) {
    parseValue(
      layer.ks.o,
      opacityAttrs,
      'style',
      ['opacity'],
      opacityAnimations,
      context,
      (val) => val / 100,
    );

    if (opacityAttrs.style?.opacity || opacityAnimations.length) {
      // apply opacity to group's children
      traverse(layerGroup, (el) => {
        if (el.type !== 'g' && el.style) {
          Object.assign(el.style, opacityAttrs.style);
          if (opacityAnimations.length) {
            el.keyframeAnimation = (el.keyframeAnimation || []).concat(
              opacityAnimations,
            );
          }
        }
      });
    }
  }
}

function parseSolidShape(layer: Lottie.SolidColorLayer) {
  return {
    type: 'rect',
    shape: {
      x: 0,
      y: 0,
      width: layer.sw,
      height: layer.sh,
    },
    style: {
      fill: layer.sc,
    },
  } as CustomElementOption;
}

function parseLayers(
  layers: Lottie.Layer[],
  context: ParseContext,
  precompLayerTl?: {
    st: number;
  },
) {
  const elements: CustomElementOption[] = [];

  // Order is reversed
  layers = layers.slice().reverse();
  const layerIndexMap: Map<number, CustomElementOption> = new Map();
  const offsetTime = precompLayerTl?.st || 0;

  layers?.forEach((layer) => {
    context.expressionLayer = layer as unknown as Record<string, unknown>;

    // Layer time is offseted by the precomp layer.

    // Use the ip, op, st of ref from.
    const layerIp = offsetTime + layer.ip;
    const layerOp = offsetTime + layer.op;
    const layerSt = offsetTime + layer.st;
    context.layerOffsetTime = offsetTime;

    let layerGroup: CustomElementOption | undefined;
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (layer.ty) {
      case Lottie.LayerType.shape:
        // @see https://lottiefiles.github.io/lottie-docs/layers/#shape-layer
        layerGroup = parseShapeLayer(layer as Lottie.ShapeLayer, context);
        break;
      case Lottie.LayerType.null:
        // @see https://lottiefiles.github.io/lottie-docs/layers/#null-layer
        layerGroup = {
          type: 'g',
          children: [],
        };
        break;
      case Lottie.LayerType.solid:
        // @see https://lottiefiles.github.io/lottie-docs/layers/#solid-color-layer
        layerGroup = {
          type: 'g',
          children: [],
        };
        // Anything you can do with solid layers, you can do better with a shape layer and a rectangle shape
        // since none of this layer's own properties can be animated.
        if ((layer as Lottie.SolidColorLayer).sc) {
          layerGroup.children.push(
            parseSolidShape(layer as Lottie.SolidColorLayer),
          );
        }
        break;
      case Lottie.LayerType.precomp:
        // @see https://lottiefiles.github.io/lottie-docs/layers/#precomposition-layer
        layerGroup = {
          type: 'g',
          children: parseLayers(
            (
              context.assetsMap.get(
                (layer as Lottie.PrecompLayer).refId,
              ) as Lottie.PrecompAsset
            )?.layers || [],
            context,
            {
              st: layerSt,
            },
          ),
        };
        break;
      case Lottie.LayerType.text:
        // TODO: https://lottiefiles.github.io/lottie-docs/layers/#text-layer
        break;
      case Lottie.LayerType.image:
        // TODO: https://lottiefiles.github.io/lottie-docs/layers/#image-layer
        layerGroup = layerGroup = {
          type: 'g',
          children: [parseImageLayer(layer as Lottie.ImageLayer, context)],
        };
        break;
    }

    if (layerGroup) {
      const keyframeAnimations: KeyframeAnimation[] = [];
      const attrs: Record<string, any> = {
        name: layer.nm,
      };
      if (layer.ks) {
        parseTransforms(layer.ks, attrs, keyframeAnimations, context);
      }

      Object.assign(layerGroup, attrs);
      if (layer.ind != null) {
        layerIndexMap.set(layer.ind, layerGroup);
      }

      layerGroup.extra = {
        layerParent: layer.parent,
      };
      // Masks @see https://lottiefiles.github.io/lottie-docs/layers/#masks
      // @see https://lottie-animation-community.github.io/docs/specs/layers/common/#clipping-masks
      // TODO: not support alpha and other modes.
      // @see https://lottie-animation-community.github.io/docs/specs/properties/mask-mode-types/
      if (layer.hasMask && layer.masksProperties?.length) {
        const maskKeyframeAnimations: KeyframeAnimation[] = [];
        // TODO: Only support one mask now.
        const attrs = parseShapePaths(
          {
            ks: layer.masksProperties[0].pt,
          },
          maskKeyframeAnimations,
          context,
        );

        layerGroup.clipPath = {
          type: 'path',
          ...attrs,
        };
        if (maskKeyframeAnimations.length) {
          layerGroup.clipPath.keyframeAnimation = maskKeyframeAnimations;
        }
      }

      addLayerOpacity(layer, layerGroup, context);

      // Update in and out animation.
      if (
        layerIp != null &&
        layerOp != null &&
        (layerIp > context.startFrame || layerOp < context.endFrame)
      ) {
        const duration = context.endFrame - context.startFrame;
        const visibilityStartOffset = (layerIp - context.startFrame) / duration;
        const visibilityEndOffset = (layerOp - context.startFrame) / duration;
        layerGroup.visibilityStartOffset = visibilityStartOffset;
        layerGroup.visibilityEndOffset = visibilityEndOffset;
        layerGroup.visibilityFrame = duration;
      }
      if (keyframeAnimations.length) {
        layerGroup.keyframeAnimation = keyframeAnimations;
      }

      elements.push(layerGroup);
    }
  });

  // Build hierarchy
  return elements.filter((el) => {
    const parentLayer = layerIndexMap.get(el.extra?.layerParent);
    if (parentLayer) {
      parentLayer.children?.push(el);
      return false;
    }
    return true;
  });
}

const DEFAULT_LOAD_ANIMATION_OPTIONS: LoadAnimationOptions = {
  loop: true,
  autoplay: false,
  fill: 'both',
  expressions: true,
  expressionEngine: 'lottie-web',
};
export function parse(
  data: Lottie.Animation,
  options: Partial<LoadAnimationOptions>,
) {
  completeData(data);
  const { loop, autoplay, fill, expressions, expressionEngine } = {
    ...DEFAULT_LOAD_ANIMATION_OPTIONS,
    ...options,
  };
  const context = new ParseContext();

  context.fps = data.fr || 30;
  context.frameTime = 1000 / context.fps;
  context.startFrame = data.ip;
  context.endFrame = data.op;
  context.version = data.v;
  context.autoplay = !!autoplay;
  context.fill = fill;
  context.expressions = expressions !== false;
  context.expressionEngine = expressionEngine ?? 'simple';
  context.animation = data;
  context.compWidth = data.w ?? 0;
  context.compHeight = data.h ?? 0;
  // eslint-disable-next-line no-nested-ternary
  context.iterations = isNumber(loop) ? loop : loop ? Infinity : 1 as number;
  // @see https://lottiefiles.github.io/lottie-docs/assets/
  data.assets?.forEach((asset) => {
    context.assetsMap.set(asset.id, asset);
  });

  const elements = parseLayers(data.layers || [], context);

  return {
    width: data.w,
    height: data.h,
    elements,
    context,
  };
}