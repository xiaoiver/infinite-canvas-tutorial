import { isNil, PathArray, path2String } from '@antv/util';
// import { mat4, quat, vec3 } from 'gl-matrix';
import type {
  CustomElementOption,
  KeyframeAnimation,
  KeyframeAnimationKeyframe,
  ParseContext,
} from './parser';
import { AnimationController, API, EllipseSerializedNode, filterUndefined, GSerializedNode, PathSerializedNode, RectSerializedNode, SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { v4 as uuidv4 } from 'uuid';

const eps = 0.0001;

const deg2rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Lottie `p` is the parent-space position of the anchor; ECS `translation` is the parent-space
 * position of local origin `(0,0)`. With `Mat3.from_scale_angle_translation` (scale → rotate → translate),
 * anchor world position is `translation + R·(sx·ax, sy·ay)`.
 *
 * @see https://lottiefiles.github.io/lottie-docs/concepts/#transform
 */
function lottieAnchorOffsetToParent(
  rotationRad: number,
  scaleX: number,
  scaleY: number,
  anchorX: number,
  anchorY: number,
): { ox: number; oy: number } {
  const rx = anchorX * scaleX;
  const ry = anchorY * scaleY;
  const c = Math.cos(rotationRad);
  const s = Math.sin(rotationRad);
  return {
    ox: rx * c - ry * s,
    oy: rx * s + ry * c,
  };
}

/**
 * Lottie `ks.a` is in layer / shape group coordinates. ECS `transformOrigin` and
 * {@link lottieAnchorOffsetToParent} expect the pivot in **node local** space where the
 * serialized geometry's bounding-box minimum is `(0,0)` (see inferXYWidthHeight).
 *
 * For an ellipse with center `(cx,cy)` and radii `rx,ry`, bbox min is `(cx-rx, cy-ry)`, so
 * pivot in local coords = `(anchorX - (cx-rx), anchorY - (cy-ry))` = `(anchorX - cx + rx, …)`.
 * When anchor equals the ellipse center `(cx,cy)`, this is `(rx, ry)` — i.e. center of the
 * axis-aligned bbox (width/2, height/2), not the raw Lottie anchor numbers.
 */
function lottieLayerAnchorToLocalPivot(
  type: string,
  shape: Record<string, any> | undefined,
  layerAnchorX: number,
  layerAnchorY: number,
): { x: number; y: number } {
  if (!shape) {
    return { x: layerAnchorX, y: layerAnchorY };
  }
  if (type === 'ellipse') {
    const { cx, cy, rx, ry } = shape;
    if (
      Number.isFinite(cx)
      && Number.isFinite(cy)
      && Number.isFinite(rx)
      && Number.isFinite(ry)
    ) {
      return {
        x: layerAnchorX - cx + rx,
        y: layerAnchorY - cy + ry,
      };
    }
  }
  if (type === 'rect') {
    // parseShapeRect / buildHierachy: shape.x,y are rectangle center; top-left = (x - w/2, y - h/2)
    const { x: cx, y: cy, width: w, height: h } = shape;
    if (
      Number.isFinite(cx)
      && Number.isFinite(cy)
      && Number.isFinite(w)
      && Number.isFinite(h)
    ) {
      return {
        x: layerAnchorX - cx + w / 2,
        y: layerAnchorY - cy + h / 2,
      };
    }
  }
  return { x: layerAnchorX, y: layerAnchorY };
}

/**
 * Bodymovin often omits `ks.a` on shape group `tr`. For ellipse/rect, the meaningful anchor is then
 * the shape position (`p` → cx/cy or rect center), not `(0,0)`. Using 0 breaks {@link lottieLayerAnchorToLocalPivot}
 * and makes {@link reconcileEcsTranslationFromLottieP} / initial `x/y` wrong for sliding ellipses along edges.
 */
function defaultLottieLayerAnchorXY(
  type: string | undefined,
  shape: Record<string, any> | undefined,
  anchorX: number | undefined,
  anchorY: number | undefined,
): { ax: number; ay: number } {
  let ax = anchorX;
  let ay = anchorY;
  if (type === 'ellipse' && shape) {
    const { cx, cy } = shape;
    if (ax === undefined && Number.isFinite(cx)) {
      ax = cx;
    }
    if (ay === undefined && Number.isFinite(cy)) {
      ay = cy;
    }
  } else if (type === 'rect' && shape) {
    const cx = shape.x;
    const cy = shape.y;
    if (ax === undefined && Number.isFinite(cx)) {
      ax = cx;
    }
    if (ay === undefined && Number.isFinite(cy)) {
      ay = cy;
    }
  }
  return { ax: ax ?? 0, ay: ay ?? 0 };
}

type LottieKeyframe = KeyframeAnimationKeyframe & {
  __lottiePx?: number;
  __lottiePy?: number;
};

/**
 * Linear sample of a 2D channel on keyframes (by arbitrary property names).
 */
function sample2DChannel(
  controls: LottieKeyframe[],
  t: number,
  uKey: keyof LottieKeyframe,
  vKey: keyof LottieKeyframe,
): { u: number; v: number } | undefined {
  const pts = controls
    .map((k) => ({
      offset: k.offset ?? 0,
      u: k[uKey] as number,
      v: k[vKey] as number,
    }))
    .filter((p) => Number.isFinite(p.u) && Number.isFinite(p.v))
    .sort((a, b) => a.offset - b.offset);

  if (pts.length === 0) {
    return undefined;
  }
  if (t <= pts[0].offset) {
    return { u: pts[0].u, v: pts[0].v };
  }
  const last = pts[pts.length - 1];
  if (t >= last.offset) {
    return { u: last.u, v: last.v };
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (t >= a.offset && t <= b.offset) {
      const span = b.offset - a.offset;
      const s = span < 1e-9 ? 0 : (t - a.offset) / span;
      return {
        u: a.u + (b.u - a.u) * s,
        v: a.v + (b.v - a.v) * s,
      };
    }
  }
  return undefined;
}

/**
 * Merged Lottie tracks can leave sparse keyframes. Fill `__lottiePx`/`__lottiePy` (Lottie anchor
 * position `p` in parent space) and scale/rotation by linear interpolation in offset space.
 *
 * ECS translation must **not** be interpolated independently of scale: `T = p - R·(S⊙a)` is
 * nonlinear in the sense that `lerp(T)` ≠ `lerp(p) - ox(lerp(S))`. We only interpolate `p` and
 * `S` (and `r`), then {@link reconcileEcsTranslationFromLottieP} recomputes `x/y` each time.
 */
function densifyMergedLottieTransformKeyframes(
  keyframes: LottieKeyframe[],
): LottieKeyframe[] {
  if (keyframes.length === 0) {
    return keyframes;
  }
  const sorted = [...keyframes].sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));

  const lottiePControls = sorted.filter(
    (k) =>
      typeof k.__lottiePx === 'number'
      && typeof k.__lottiePy === 'number'
      && Number.isFinite(k.__lottiePx)
      && Number.isFinite(k.__lottiePy),
  );
  const scaleControls = sorted.filter(
    (k) =>
      typeof k.scaleX === 'number'
      && typeof k.scaleY === 'number'
      && Number.isFinite(k.scaleX)
      && Number.isFinite(k.scaleY),
  );
  const rotControls = sorted.filter(
    (k) => typeof k.rotation === 'number' && Number.isFinite(k.rotation),
  );

  return sorted.map((kf) => {
    const t = kf.offset ?? 0;
    const out: LottieKeyframe = { ...kf };

    const needP =
      typeof out.__lottiePx !== 'number'
      || typeof out.__lottiePy !== 'number'
      || !Number.isFinite(out.__lottiePx)
      || !Number.isFinite(out.__lottiePy);
    if (needP && lottiePControls.length) {
      const p = sample2DChannel(lottiePControls, t, '__lottiePx', '__lottiePy');
      if (p) {
        out.__lottiePx = p.u;
        out.__lottiePy = p.v;
      }
    }

    const needScale =
      typeof out.scaleX !== 'number'
      || typeof out.scaleY !== 'number'
      || !Number.isFinite(out.scaleX)
      || !Number.isFinite(out.scaleY);
    if (needScale && scaleControls.length) {
      const p = sample2DChannel(scaleControls, t, 'scaleX', 'scaleY');
      if (p) {
        out.scaleX = p.u;
        out.scaleY = p.v;
      }
    }

    const needRot =
      typeof out.rotation !== 'number' || !Number.isFinite(out.rotation);
    if (needRot && rotControls.length) {
      const pts = rotControls
        .map((k) => ({ offset: k.offset ?? 0, r: k.rotation as number }))
        .filter((p) => Number.isFinite(p.r))
        .sort((a, b) => a.offset - b.offset);
      if (pts.length) {
        if (t <= pts[0].offset) {
          out.rotation = pts[0].r;
        } else if (t >= pts[pts.length - 1].offset) {
          out.rotation = pts[pts.length - 1].r;
        } else {
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            if (t >= a.offset && t <= b.offset) {
              const span = b.offset - a.offset;
              const s = span < 1e-9 ? 0 : (t - a.offset) / span;
              out.rotation = a.r + (b.r - a.r) * s;
              break;
            }
          }
        }
      }
    }

    return out;
  });
}

/**
 * `x/y` on keyframes are ECS translations: `p - ox` with **that** frame's scale/rotation.
 * Recompute from interpolated Lottie `p` and current scale/rotation. Strips `__lottiePx`/`__lottiePy`.
 */
function reconcileEcsTranslationFromLottieP(
  keyframes: LottieKeyframe[],
  element: CustomElementOption,
  object: SerializedNode & { scaleX?: number; scaleY?: number; rotation?: number },
): KeyframeAnimationKeyframe[] {
  return keyframes.map((kf) => {
    const sx = (typeof kf.scaleX === 'number' ? kf.scaleX : object.scaleX) ?? 1;
    const sy = (typeof kf.scaleY === 'number' ? kf.scaleY : object.scaleY) ?? 1;
    const rot =
      (typeof kf.rotation === 'number' ? kf.rotation : object.rotation) ?? 0;
    const px = kf.__lottiePx;
    const py = kf.__lottiePy;
    const rawKAx
      = typeof kf.anchorX === 'number' ? kf.anchorX : element.anchorX;
    const rawKAy
      = typeof kf.anchorY === 'number' ? kf.anchorY : element.anchorY;
    const { ax: layerKAx, ay: layerKAy } = defaultLottieLayerAnchorXY(
      element.type,
      element.shape,
      rawKAx ?? (typeof px === 'number' ? px : undefined),
      rawKAy ?? (typeof py === 'number' ? py : undefined),
    );
    const pivotShape =
      element.type === 'ellipse'
        && element.shape
        && typeof px === 'number'
        && typeof py === 'number'
        && Number.isFinite(px)
        && Number.isFinite(py)
        ? { ...element.shape, cx: px, cy: py }
        : element.shape;
    const { x: kAx, y: kAy } = lottieLayerAnchorToLocalPivot(
      element.type,
      pivotShape,
      layerKAx,
      layerKAy,
    );
    const { ox, oy } = lottieAnchorOffsetToParent(rot, sx, sy, kAx, kAy);

    const { __lottiePx, __lottiePy, ...rest } = kf;

    if (typeof px === 'number' && typeof py === 'number') {
      return {
        ...rest,
        x: px - ox,
        y: py - oy,
      } as KeyframeAnimationKeyframe;
    }
    return rest as KeyframeAnimationKeyframe;
  });
}

/** 不参与插值内容比较：offset/easing 及 Lottie 内部中间字段 */
const KEYFRAME_META_KEYS = new Set([
  'offset',
  'easing',
  'ignore',
  '__lottiePx',
  '__lottiePy',
]);

function keyframeValueEqual(a: unknown, b: unknown, nEps: number): boolean {
  if (a === b) {
    return true;
  }
  if (
    typeof a === 'number'
    && typeof b === 'number'
    && Number.isFinite(a)
    && Number.isFinite(b)
  ) {
    return Math.abs(a - b) < nEps;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b;
  }
  if (a == null && b == null) {
    return true;
  }
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

function keyframePayloadEqual(
  a: KeyframeAnimationKeyframe,
  b: KeyframeAnimationKeyframe,
  nEps: number,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (KEYFRAME_META_KEYS.has(k)) {
      continue;
    }
    if (!keyframeValueEqual(a[k], b[k], nEps)) {
      return false;
    }
  }
  return true;
}

/**
 * 按 offset 排序后去掉与前一帧插值属性完全相同的关键帧。
 * 注意：不能只保留「多于 1 个」关键帧——表达式烘焙若 281 帧算出相同 cx/cy（或去重后只剩 1 帧），
 * 以前 `out.length <= 1` 时返回 `[]` 会导致 `formatKeyframes` 空数组、椭圆无 `cx`/`cy` 关键帧。
 */
function collapseRedundantKeyframes(
  keyframes: KeyframeAnimationKeyframe[],
): KeyframeAnimationKeyframe[] {
  if (keyframes.length === 0) {
    return [];
  }
  const sorted = [...keyframes].sort(
    (a, b) => (a.offset ?? 0) - (b.offset ?? 0),
  );
  const out: KeyframeAnimationKeyframe[] = [];
  for (const kf of sorted) {
    if (out.length === 0) {
      out.push(kf);
      continue;
    }
    if (keyframePayloadEqual(out[out.length - 1], kf, eps)) {
      continue;
    }
    out.push(kf);
  }
  return out;
}

/**
 * Provides some control methods like:
 * - play
 * - pause
 * - stop
 * - goToAndStop
 * - goToAndPlay
 * @see https://github.com/airbnb/lottie-web/blob/master/player/js/animation/AnimationItem.js
 */
export class LottieAnimation {
  constructor(
    private width: number,
    private height: number,
    private elements: CustomElementOption[],
    private context: ParseContext,
  ) {
    this.displayObjects = this.elements.flatMap((element) =>
      this.buildHierachy(element),
    );

    // TODO: preload images
    // TODO: preload fonts
  }

  private displayObjects: SerializedNode[];
  private keyframeAnimationMap = new WeakMap<
    SerializedNode,
    KeyframeAnimation[]
  >();
  private displayObjectElementMap = new WeakMap<
    SerializedNode,
    CustomElementOption
  >();

  private animations: AnimationController[] = [];

  private buildHierachy(element: CustomElementOption, parentId?: string): SerializedNode[] {
    const {
      type,
      name,
      anchorX,
      anchorY,
      rotation,
      scaleX,
      scaleY,
      x,
      y,
      // skew = 0,
      // skewAxis = 0,
      children,
      shape,
      style,
      keyframeAnimation,
    } = element;

    let displayObject: SerializedNode;

    // TODO: repeater @see https://lottiefiles.github.io/lottie-docs/shapes/#repeater

    // @see https://lottiefiles.github.io/lottie-docs/shapes/#shape
    // TODO: polystar, convert to Bezier @see https://lottiefiles.github.io/lottie-docs/rendering/#polystar
    if (type === 'g') {
      displayObject = {
        id: uuidv4(),
        type: 'g',
      } as GSerializedNode;
    } else if (type === 'ellipse') {
      const { cx, cy, rx, ry } = shape;

      displayObject = {
        id: uuidv4(),
        type: 'ellipse',
        cx,
        cy,
        rx,
        ry,
        zIndex: 0,
      } as EllipseSerializedNode;
    } else if (type === 'path') {
      const d = this.generatePathFromShape(shape);
      const dString = path2String(d);
      displayObject = {
        id: uuidv4(),
        type: 'path',
        d: dString,
        zIndex: 0,
      } as PathSerializedNode;
    } else if (type === 'rect') {
      // @see https://lottiefiles.github.io/lottie-docs/shapes/#rectangle
      const { x: cx, y: cy, width, height, r } = shape;

      displayObject = {
        id: uuidv4(),
        type: 'rect',
        x: cx - width / 2,
        y: cy - height / 2,
        width,
        height,
        radius: r,
        zIndex: 0,
      } as RectSerializedNode;
    } else if (type === 'image') {
      const { width, height, src } = shape;

      displayObject = {
        id: uuidv4(),
        type: 'rect',
        x: 0,
        y: 0,
        width,
        height,
        fill: src,
      } as RectSerializedNode;
    }

    if (name) {
      displayObject.name = name;
    }

    // transform — Lottie `p` is anchor position in parent; ECS needs origin translation (see helper above).
    const sx = scaleX ?? 1;
    const sy = scaleY ?? 1;
    const { ax: layerAx, ay: layerAy } = defaultLottieLayerAnchorXY(
      type,
      shape,
      anchorX,
      anchorY,
    );
    const { x: localAx, y: localAy } = lottieLayerAnchorToLocalPivot(
      type,
      shape,
      layerAx,
      layerAy,
    );
    const rotRad = deg2rad(rotation ?? 0);
    const { ox, oy } = lottieAnchorOffsetToParent(rotRad, sx, sy, localAx, localAy);

    if (!isNil(x)) {
      displayObject.x = x - ox;
    }
    if (!isNil(y)) {
      displayObject.y = y - oy;
    }
    if (!isNil(scaleX)) {
      displayObject.scaleX = scaleX;
    }
    if (!isNil(scaleY)) {
      displayObject.scaleY = scaleY;
    }
    if (!isNil(rotation)) {
      displayObject.rotation = rotRad;
    }

    // TODO: match name `mn`, used in expressions

    if (style) {
      // { fill, fillOpacity, fillRule, opacity, strokeDasharray, strokeDashoffset, strokeLinejoin, strokeLinecap, strokeWidth }
      Object.keys(style).forEach((key) => {
        displayObject[key] = style[key];
      });
    }

    if (keyframeAnimation) {
      if (Math.abs(localAx) > eps || Math.abs(localAy) > eps) {
        keyframeAnimation.forEach((animation) => {
          animation.transformOrigin = {
            x: localAx,
            y: localAy,
          };
        });
      }
      this.keyframeAnimationMap.set(displayObject, keyframeAnimation);
    }

    if (parentId) {
      displayObject.parentId = parentId;
    }

    this.displayObjectElementMap.set(displayObject, element);

    if (children) {
      const childNodes = children.map((child) => this.buildHierachy(child, displayObject.id));
      return [displayObject, ...childNodes.flat()];
    } else {
      return [displayObject];
    }
  }

  getAnimations() {
    return this.animations;
  }

  /**
   * Returns the animation duration in seconds or frames.
   * @see https://github.com/airbnb/lottie-web#getdurationinframes
   */
  getDuration(inFrames = false) {
    return (
      ((inFrames ? this.fps() : 1) *
        (this.context.endFrame - this.context.startFrame) *
        this.context.frameTime) /
      1000
    );
  }
  /**
   * Returns the animation frame rate (frames / second).
   */
  fps() {
    return this.context.fps;
  }

  private isSameKeyframeOptions(
    options1: Omit<KeyframeAnimation, 'keyframes'>,
    options2: Omit<KeyframeAnimation, 'keyframes'>,
  ) {
    const e1 = options1.easing ?? 'linear';
    const e2 = options2.easing ?? 'linear';
    return (
      options1.delay === options2.delay &&
      options1.duration === options2.duration &&
      e1 === e2
    );
  }

  /** Same timeline sample (Lottie tracks can differ in keyframe count; merge by offset, not easing). */
  private keyframeOffsetsMatch(
    a: KeyframeAnimationKeyframe,
    b: KeyframeAnimationKeyframe,
    eps = 1e-6,
  ) {
    return Math.abs((a.offset ?? 0) - (b.offset ?? 0)) < eps;
  }

  /**
   * Lottie `i`/`o` are parallel to `v`; missing entries mean zero tangents (line / corner).
   * @see https://lottiefiles.github.io/lottie-docs/values/#bezier
   */
  private padBezierTangents(
    tangents: number[][] | undefined,
    vertexCount: number,
  ): number[][] {
    const src = Array.isArray(tangents) ? tangents : [];
    const out: number[][] = [];
    for (let k = 0; k < vertexCount; k++) {
      const p = src[k];
      out[k] =
        Array.isArray(p) && p.length >= 2 ? [p[0], p[1]] : [0, 0];
    }
    return out;
  }

  private generatePathFromShape(shape: Record<string, any>): PathArray {
    // @see https://lottiefiles.github.io/lottie-docs/shapes/#path
    const { close, v: verts, in: ins, out: outs } = shape;
    const v = verts ?? [];
    if (v.length === 0) {
      return [] as unknown as PathArray;
    }

    const i = this.padBezierTangents(ins, v.length);
    const out = this.padBezierTangents(outs, v.length);
    const d: PathArray = [] as unknown as PathArray;

    const x0 = v[0]?.[0] ?? 0;
    const y0 = v[0]?.[1] ?? 0;
    d.push(['M', x0, y0]);

    for (let n = 1; n < v.length; n++) {
      // @see https://lottiefiles.github.io/lottie-docs/concepts/#bezier
      // The nth bezier segment is defined as:
      // v[n], v[n]+o[n], v[n+1]+i[n+1], v[n+1]
      d.push([
        'C',
        out[n - 1][0],
        out[n - 1][1],
        i[n][0],
        i[n][1],
        v[n]?.[0] ?? 0,
        v[n]?.[1] ?? 0,
      ]);
    }

    if (close) {
      d.push([
        'C',
        out[v.length - 1][0],
        out[v.length - 1][1],
        i[0][0],
        i[0][1],
        x0,
        y0,
      ]);
      d.push(['Z']);
    }

    return d;
  }

  /**
   * render Lottie Group to canvas or a mounted display object
   */
  render(api: API) {
    api.updateNodes(this.displayObjects);

    this.displayObjects.forEach((child) => {
      let keyframeAnimation = this.keyframeAnimationMap.get(child);

      // console.log('keyframeAnimation', keyframeAnimation);

      const element = this.displayObjectElementMap.get(child);
      // if (element && element.clipPath) {
      //   const { shape, keyframeAnimation } = element.clipPath;

      //   const clipPath = new Path();
      //   // use clipPath as target's siblings
      //   child.parentElement.appendChild(clipPath);
      //   child.style.clipPath = clipPath;
      //   if (shape) {
      //     clipPath.style.d = this.generatePathFromShape(shape);
      //   }

      //   // TODO: only support one clipPath now
      //   if (keyframeAnimation && keyframeAnimation.length) {
      //     const { delay, duration, easing, keyframes } = keyframeAnimation[0];

      //     // animate clipPath with its `d` property
      //     const clipPathAnimation = clipPath.animate(
      //       keyframes.map(({ offset, shape, easing }) => {
      //         return {
      //           offset,
      //           d: path2String(this.generatePathFromShape(shape)),
      //           easing,
      //         };
      //       }),
      //       {
      //         delay,
      //         duration,
      //         easing,
      //         iterations: this.context.iterations,
      //       },
      //     );
      //     this.animations.push(clipPathAnimation);
      //   }
      // }

      // account for animation only apply to visibility, e.g. spring
      const { visibilityStartOffset, visibilityEndOffset, visibilityFrame } =
        element;
      if (
        visibilityFrame &&
        (!keyframeAnimation || !keyframeAnimation.length)
      ) {
        keyframeAnimation = [
          {
            duration: this.context.frameTime * visibilityFrame,
            keyframes: [
              { offset: 0, opacity: 1 },
              { offset: 1, opacity: 1 },
            ],
          },
        ];
      }

      if (keyframeAnimation && keyframeAnimation.length) {
        const keyframesOptions: [
          KeyframeAnimationKeyframe[],
          Omit<KeyframeAnimation, 'keyframes'>,
        ][] = [];

        keyframeAnimation.forEach(
          ({ delay = 0, duration, easing, keyframes, transformOrigin }) => {
            const formattedKeyframes = keyframes.map((keyframe) =>
              filterUndefined(keyframe),
            ) as KeyframeAnimationKeyframe[];
            const options = filterUndefined({
              delay,
              duration,
              easing,
              iterations: this.context.iterations,
              fill: this.context.fill,
              ...(transformOrigin
                && typeof transformOrigin.x === 'number'
                && typeof transformOrigin.y === 'number'
                ? { transformOrigin: { x: transformOrigin.x, y: transformOrigin.y } }
                : {}),
            }) as Omit<KeyframeAnimation, 'keyframes'>;

            keyframesOptions.push([formattedKeyframes, options]);
          },
        );

        const mergedKeyframesOptions = [keyframesOptions[0]];
        // Merge all tracks (p.x, p.y, s.x, s.y, …) into one keyframe list. Do not require equal
        // keyframe counts — position and scale often have different lengths/offsets.
        // Otherwise multiple api.animate() run on the same node and the last controller wins.
        for (let i = 1; i < keyframesOptions.length; i++) {
          const [currentKeyframes, currentOptions] = keyframesOptions[i];
          const existedKeyframeOptions = mergedKeyframesOptions.find(
            ([, options]) =>
              this.isSameKeyframeOptions(currentOptions, options),
          );

          if (existedKeyframeOptions) {
            const [existingKeyframes] = existedKeyframeOptions;
            currentKeyframes.forEach((currentKeyframe) => {
              const existedKeyframe = existingKeyframes.find((keyframe) =>
                this.keyframeOffsetsMatch(currentKeyframe, keyframe),
              );

              if (existedKeyframe) {
                Object.assign(existedKeyframe, currentKeyframe);
              } else {
                existingKeyframes.push({ ...currentKeyframe });
              }
            });
            existingKeyframes.sort((a, b) => a.offset - b.offset);
          } else {
            mergedKeyframesOptions.push(keyframesOptions[i]);
          }
        }

        // restore animations for later use
        this.animations.push(
          ...mergedKeyframesOptions
            .map(([merged, options]) => {
              // format interpolated properties, e.g. scaleX -> transform
              const formatted = this.formatKeyframes(merged, child, element);

              if (formatted.length) {
                // @ts-expect-error 
                const animation = api.animate(child, formatted, options);
                if (
                  !isNil(visibilityStartOffset) &&
                  !isNil(visibilityEndOffset)
                ) {
                  // child.hide();
                  // animation.onframe = () => {
                  //   const { progress } = animation.effect.getComputedTiming();
                  //   if (
                  //     progress >= visibilityStartOffset &&
                  //     progress < visibilityEndOffset
                  //   ) {
                  //     child.show();
                  //   } else {
                  //     child.hide();
                  //   }
                  // };
                }

                if (!this.context.autoplay) {
                  animation.pause();
                }
                return animation;
              }

              return null;
            })
            .filter((animation) => !!animation),
        );
      }
    });
  }

  private formatKeyframes(
    keyframes: Record<string, any>[],
    object: SerializedNode,
    element?: CustomElementOption,
  ) {
    keyframes.forEach((keyframe) => {
      // if ('offsetPath' in keyframe) {
      //   if (!object.style.offsetPath) {
      //     const [ox, oy] = object.getOrigin();
      //     (keyframe.offsetPath as AbsoluteArray).forEach((segment) => {
      //       if (segment[0] === 'M') {
      //         segment[1] -= ox;
      //         segment[2] -= oy;
      //       } else if (segment[0] === 'C') {
      //         segment[1] -= ox;
      //         segment[2] -= oy;
      //         segment[3] -= ox;
      //         segment[4] -= oy;
      //         segment[5] -= ox;
      //         segment[6] -= oy;
      //       }
      //     });

      //     const offsetPath = new Path({
      //       style: {
      //         d: keyframe.offsetPath,
      //       },
      //     });

      //     object.style.offsetPath = offsetPath;

      //     console.log(offsetPath);
      //   }
      //   delete keyframe.offsetPath;
      //   // offsetPath should override x/y
      //   delete keyframe.x;
      //   delete keyframe.y;
      // }

      // should keep transform during initialization
      // if (!object.style.offsetPath) {
      //   keyframe.transform = object.style.transform || '';
      // }
      // { style: { opacity: 1 } }
      if ('style' in keyframe) {
        Object.keys(keyframe.style).forEach((name) => {
          keyframe[name] = keyframe.style[name];
        });
        delete keyframe.style;
      }

      // Path morphing interpolates `d` (string), not Lottie `{ v, i, o }` — same as clipPath branch below.
      if (
        element?.type === 'path'
        && keyframe.shape
        && typeof keyframe.shape === 'object'
      ) {
        keyframe.d = path2String(
          this.generatePathFromShape(keyframe.shape as Record<string, any>),
        );
        delete keyframe.shape;
      }

      // Ellipse / rect: parser uses nested `shape.{…}`.
      // Ellipse: Lottie center `(cx,cy)` is the layer anchor in parent space — map to `x`/`y` so
      // reconcileEcsTranslationFromLottieP + history (x/y on Transform) apply; `cx`/`cy` are not applied there.
      if (element?.type === 'ellipse' && keyframe.shape && typeof keyframe.shape === 'object') {
        const s = keyframe.shape as Record<string, number>;
        if (typeof s.cx === 'number' && Number.isFinite(s.cx)) {
          keyframe.x = s.cx;
        }
        if (typeof s.cy === 'number' && Number.isFinite(s.cy)) {
          keyframe.y = s.cy;
        }
        for (const k of ['rx', 'ry'] as const) {
          if (typeof s[k] === 'number' && Number.isFinite(s[k])) {
            (keyframe as Record<string, number>)[k] = s[k];
          }
        }
        delete keyframe.shape;
      } else if (
        element?.type === 'rect'
        && keyframe.shape
        && typeof keyframe.shape === 'object'
      ) {
        const s = keyframe.shape as Record<string, number>;
        for (const k of ['x', 'y', 'width', 'height', 'r'] as const) {
          if (typeof s[k] === 'number' && Number.isFinite(s[k])) {
            (keyframe as Record<string, number>)[k] = s[k];
          }
        }
        delete keyframe.shape;
      }

      // Lottie `r` is degrees; ECS Transform.rotation is radians (Mat3).
      if (typeof keyframe.rotation === 'number') {
        keyframe.rotation = deg2rad(keyframe.rotation);
      }
    });

    // ignore empty interpolable attributes
    keyframes = keyframes.filter((keyframe) => {
      // TODO: support negative offset

      const { ignore, easing, offset, ...rest } = keyframe;
      return offset >= 0 && Object.keys(rest).length > 0;
      // return Object.keys(rest).length > 0;
    });

    if (keyframes.length) {
      // padding offset = 1
      if (keyframes[keyframes.length - 1].offset !== 1) {
        keyframes.push({
          ...keyframes[keyframes.length - 1],
          offset: 1,
        });
      }
    }

    // sort by offset
    keyframes.sort((a, b) => a.offset - b.offset);

    // remove empty attributes
    keyframes.forEach((keyframe) => {
      Object.keys(keyframe).forEach((name) => {
        if (keyframe[name] === '') {
          delete keyframe[name];
        }
      });
    });

    // Snapshot Lottie `p` (anchor position in parent) before densify/reconcile — do not lerp ECS `x/y` with scale.
    if (element) {
      keyframes.forEach((keyframe) => {
        if (
          keyframe.x != null
          && typeof keyframe.x === 'number'
          && keyframe.y != null
          && typeof keyframe.y === 'number'
        ) {
          (keyframe as LottieKeyframe).__lottiePx = keyframe.x;
          (keyframe as LottieKeyframe).__lottiePy = keyframe.y;
        }
      });
    }

    const densified = element
      ? densifyMergedLottieTransformKeyframes(keyframes as LottieKeyframe[])
      : (keyframes as LottieKeyframe[]);

    if (element) {
      return reconcileEcsTranslationFromLottieP(
        densified,
        element,
        object as SerializedNode & {
          scaleX?: number;
          scaleY?: number;
          rotation?: number;
        },
      );
    }

    return densified as KeyframeAnimationKeyframe[];
  }

  /**
   * Destroy all internal displayobjects.
   */
  destroy() {
    // Use API to destroy the animation
    // this.displayObjects.forEach((object) => {
    //   object.destroy();
    // });
  }

  /**
   * Return the size of this animation.
   * @param outputSize - If provided, the size will be copied into here as width, height.
   */
  size() {
    return { width: this.width, height: this.height };
  }

  /**
   * Bodymovin version
   */
  version() {
    return this.context.version;
  }

  private isPaused = false;
  play() {
    this.isPaused = false;
    this.animations.forEach((animation) => {
      animation.play();
    });
  }

  /**
   * Can contain 2 numeric values that will be used as first and last frame of the animation.
   * @see https://github.com/airbnb/lottie-web#playsegmentssegments-forceflag
   */
  playSegments(segments: [number, number]) {
    const [firstFrame, lastFrame] = segments;

    this.isPaused = false;
    this.animations.forEach((animation) => {
      animation.seek((firstFrame / this.fps()) * 1000);
      // const originOnFrame = animation.onframe;
      // animation.onframe = (e) => {
      //   if (originOnFrame) {
      //     // @ts-ignore
      //     originOnFrame(e);
      //   }

      //   if (animation.currentTime >= (lastFrame / this.fps()) * 1000) {
      //     animation.finish();

      //     if (originOnFrame) {
      //       animation.onframe = originOnFrame;
      //     } else {
      //       animation.onframe = null;
      //     }
      //   }
      // };
      animation.play();
    });
  }

  pause() {
    this.isPaused = true;
    this.animations.forEach((animation) => {
      animation.pause();
    });
  }

  /**
   *
   */
  togglePause() {
    if (this.isPaused) {
      this.play();
    } else {
      this.pause();
    }
  }

  /**
   * Goto and stop at a specific time(in seconds) or frame.
   * Split goToAndStop/Play into goTo & stop/play
   * @see https://github.com/airbnb/lottie-web
   */
  goTo(value: number, isFrame = false) {
    if (isFrame) {
      this.animations.forEach((animation) => {
        animation.seek((value / this.fps()) * 1000);
      });
    } else {
      this.animations.forEach((animation) => {
        animation.seek(value * 1000);
      });
    }
  }

  /**
   * @see https://github.com/airbnb/lottie-web#stop
   */
  stop() {
    this.animations.forEach((animation) => {
      animation.finish();
    });
  }

  /**
   * 1 is normal speed.
   * @see https://github.com/airbnb/lottie-web#setspeedspeed
   */
  setSpeed(speed: number) {
    this.animations.forEach((animation) => {
      animation.setPlaybackRate(speed * this.direction);
    });
  }

  private direction = 1;

  /**
   * 1 is forward, -1 is reverse.
   * @see https://github.com/airbnb/lottie-web#setdirectiondirection
   */
  setDirection(direction: 1 | -1) {
    this.direction = direction;
    this.animations.forEach((animation) => {
      animation.setPlaybackRate(direction);
    });
  }
}