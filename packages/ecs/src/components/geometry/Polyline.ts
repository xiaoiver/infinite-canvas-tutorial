import { field, Type } from '@lastolivegames/becsy';
import { AABB } from '../math';
import { Marker, Stroke } from '../renderable';
import type {
  PolylineSerializedNode,
  RoughPolylineSerializedNode,
} from '../../types/serialized-node';
import { deserializePoints } from '../../utils';

type PolylineInput =
  | Partial<Polyline>
  | Partial<PolylineSerializedNode>
  | Partial<RoughPolylineSerializedNode>;

/**
 * 可选的 Polyline 几何包围盒提供者。设置后 `Polyline.getGeometryBounds` 将使用该函数。
 */
export type PolylineGeometryBoundsProvider = (
  polyline: PolylineInput,
  marker?: Marker,
) => AABB;

/**
 * 可选的 Polyline 渲染包围盒提供者（含 stroke）。设置后 `Polyline.getRenderBounds` 将使用该函数。
 */
export type PolylineRenderBoundsProvider = (
  polyline: Polyline,
  stroke?: Stroke,
  marker?: Marker,
) => AABB;

/** Polyline 命中测试入参（无 fill，仅 stroke）。可与 wasm hitTestPath 通过 points→d 复用。 */
export type PolylineHitTestOptions = {
  points: [number, number][];
  x: number;
  y: number;
  stroke?: Stroke;
};

/**
 * 可选的 Polyline 命中测试提供者。设置后可在 pickAtPoint 中用 wasm hitTestPath（points 转 d）替代 inPolyline。
 */
export type PolylineHitTestProvider = (opts: PolylineHitTestOptions) => boolean;

/** 与 Path 的 computePathBounds 返回结构一致，用于从 path d 得到 bbox。 */
type PolylineBoundsResult = { minX: number; minY: number; maxX: number; maxY: number };

function pointsToPathD(points: [number, number][]): string {
  if (!points || points.length < 2) return '';
  const [x0, y0] = points[0];
  let d = `M ${x0} ${y0}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0]} ${points[i][1]}`;
  }
  return d;
}

/**
 * 从“外部 computePathBounds”创建 Polyline.geometryBoundsProvider。
 * 将 points 转为 path d（M x0 y0 L x1 y1 ...），再调用 computePathBounds({ d })。
 */
export function createGeometryBoundsProviderFromComputePathBoundsForPolyline(
  computePathBounds: (opts: { d: string }) => PolylineBoundsResult | null | undefined,
): PolylineGeometryBoundsProvider {
  return (polyline: PolylineInput, marker?: Marker) => {
    let points = (polyline as { points?: [number, number][] | string }).points;
    if (!points || points.length < 2) return new AABB(0, 0, 0, 0);
    if (typeof points === 'string') points = deserializePoints(points);
    const d = pointsToPathD(points);
    if (!d) return new AABB(0, 0, 0, 0);
    try {
      const result = computePathBounds({ d });
      if (result && Number.isFinite(result.minX + result.minY + result.maxX + result.maxY)) {
        return new AABB(result.minX, result.minY, result.maxX, result.maxY);
      }
    } catch {
      // fallback to builtin
    }
    const prev = Polyline.geometryBoundsProvider;
    Polyline.geometryBoundsProvider = null;
    const aabb = Polyline.getGeometryBounds(polyline);
    Polyline.geometryBoundsProvider = prev;
    return aabb;
  };
}

/**
 * 从“外部 computePathBounds”创建 Polyline.renderBoundsProvider。
 * 将 points 转为 path d，再调用 computePathBounds({ d, stroke, markerStart?, markerEnd?, markerFactor? })。
 */
export function createRenderBoundsProviderFromComputePathBoundsForPolyline(
  computePathBounds: (opts: {
    d: string;
    stroke?: {
      width: number;
      linecap: string;
      linejoin: string;
      miterLimit: number;
      alignment?: string;
      dasharray?: number[];
      dashoffset?: number;
      blur?: number;
    };
    markerStart?: string;
    markerEnd?: string;
    markerFactor?: number;
  }) => PolylineBoundsResult | null | undefined,
): PolylineRenderBoundsProvider {
  return (polyline: Polyline, stroke?: Stroke, marker?: Marker) => {
    const d = pointsToPathD(polyline.points);
    if (!d) return new AABB(0, 0, 0, 0);
    try {
      const opts: Parameters<typeof computePathBounds>[0] = { d };
      if (stroke && stroke.width > 0) {
        opts.stroke = {
          width: stroke.width,
          linecap: stroke.linecap,
          linejoin: stroke.linejoin,
          miterLimit: stroke.miterlimit,
          alignment: stroke.alignment,
          dasharray: stroke.dasharray ? [...stroke.dasharray] : undefined,
          dashoffset: stroke.dashoffset,
          blur: 0,
        };
      }
      if (marker) {
        opts.markerStart = marker.start;
        opts.markerEnd = marker.end;
        opts.markerFactor = marker.factor;
      }
      const result = computePathBounds(opts);
      if (result && Number.isFinite(result.minX + result.minY + result.maxX + result.maxY)) {
        return new AABB(result.minX, result.minY, result.maxX, result.maxY);
      }
    } catch {
      // fallback to builtin
    }
    const prev = Polyline.renderBoundsProvider;
    Polyline.renderBoundsProvider = null;
    const aabb = Polyline.getRenderBounds(polyline, stroke, marker);
    Polyline.renderBoundsProvider = prev;
    return aabb;
  };
}

/**
 * 从“外部 hitTestPath”创建 Polyline.hitTestProvider。
 * 将 points 转为 path d，再调用 hitTestPath({ d, x, y, fill: false, fillRule: 'nonzero', stroke })。
 * 例如 wasm: `Polyline.hitTestProvider = createHitTestProviderFromHitTestPathForPolyline(wasm.hitTestPath);`
 */
export function createHitTestProviderFromHitTestPathForPolyline(
  hitTestPath: (opts: {
    d: string;
    x: number;
    y: number;
    fill: boolean;
    fillRule: string;
    stroke?: {
      width: number;
      linecap: string;
      linejoin: string;
      miterLimit: number;
      alignment?: string;
      dasharray?: number[];
      dashoffset?: number;
      blur?: number;
    };
  }) => boolean,
): PolylineHitTestProvider {
  return (opts: PolylineHitTestOptions) => {
    const d = pointsToPathD(opts.points);
    if (!d) return false;
    try {
      const wasmOpts: Parameters<typeof hitTestPath>[0] = {
        d,
        x: opts.x,
        y: opts.y,
        fill: false,
        fillRule: 'nonzero',
      };
      if (opts.stroke && opts.stroke.width > 0) {
        wasmOpts.stroke = {
          width: opts.stroke.width,
          linecap: opts.stroke.linecap,
          linejoin: opts.stroke.linejoin,
          miterLimit: opts.stroke.miterlimit,
          alignment: opts.stroke.alignment,
          dasharray: opts.stroke.dasharray ? [...opts.stroke.dasharray] : undefined,
          dashoffset: opts.stroke.dashoffset,
          blur: 0,
        };
      }
      return hitTestPath(wasmOpts);
    } catch {
      return false;
    }
  };
}

/**
 * Basic shape that creates straight lines connecting several points.
 * Typically a polyline is used to create open shapes as the last point doesn't have to be connected to the first point.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/polyline
 */
export class Polyline {
  /** 若设置，则 getGeometryBounds 使用此提供者；否则使用内置实现。 */
  static geometryBoundsProvider: PolylineGeometryBoundsProvider | null = null;

  /** 若设置，则 getRenderBounds 使用此提供者；否则使用内置实现。 */
  static renderBoundsProvider: PolylineRenderBoundsProvider | null = null;

  /** 若设置，则 pickAtPoint 等对 Polyline 的命中检测可调用此提供者（如 wasm hitTestPath）；否则使用 inPolyline。 */
  static hitTestProvider: PolylineHitTestProvider | null = null;

  static getGeometryBounds(
    polyline: PolylineInput,
  ) {
    if (Polyline.geometryBoundsProvider) {
      return Polyline.geometryBoundsProvider(polyline);
    }
    let { points } = polyline;

    if (!points || points.length < 2) {
      return new AABB(0, 0, 0, 0);
    }

    if (typeof points === 'string') {
      points = deserializePoints(points);
    }

    // FIXME: account for strokeLinejoin & strokeLinecap
    const minX = Math.min(
      ...points.map((point) => (isNaN(point[0]) ? Infinity : point[0])),
    );
    const maxX = Math.max(
      ...points.map((point) => (isNaN(point[0]) ? -Infinity : point[0])),
    );
    const minY = Math.min(
      ...points.map((point) => (isNaN(point[1]) ? Infinity : point[1])),
    );
    const maxY = Math.max(
      ...points.map((point) => (isNaN(point[1]) ? -Infinity : point[1])),
    );

    return new AABB(minX, minY, maxX, maxY);
  }

  static getRenderBounds(polyline: Polyline, stroke?: Stroke, marker?: Marker) {
    if (Polyline.renderBoundsProvider) {
      return Polyline.renderBoundsProvider(polyline, stroke, marker);
    }
    const { width = 0, linecap = 'butt', linejoin = 'miter', miterlimit = 4 } = stroke ?? {};

    // Cap：端点处延伸。butt/round 为半宽 0.5；square 为 45° 方向 (√2/2)*width。
    let capFactor = 0.5;
    if (linecap === 'square') {
      capFactor = Math.SQRT1_2;
    }

    // Join：拐角处延伸。miter 时尖角可伸出 (width/2)*miter_limit，bbox 最坏需 (width/2)*miter_limit 的扩张，即 factor = miter_limit/2。
    const joinFactor =
      linejoin === 'miter' ? (miterlimit * 0.5) : 0.5;

    const style_expansion = Math.max(capFactor, joinFactor) * width;

    const { minX, minY, maxX, maxY } = Polyline.getGeometryBounds(polyline);
    return new AABB(
      minX - style_expansion,
      minY - style_expansion,
      maxX + style_expansion,
      maxY + style_expansion,
    );
  }

  /**
   * The points attribute defines a list of points. Each point is defined by a pair of number representing a X and a Y coordinate in the user coordinate system. If the attribute contains an odd number of coordinates, the last one will be ignored.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/points
   */
  @field({
    type: Type.object,
    default: [
      [0, 0],
      [0, 0],
    ],
  })
  declare points: [number, number][];

  /**
   * Stroke width used for pointer hit-testing only (Konva `hitStrokeWidth`).
   * `-1` means use `Stroke.width`.
   */
  @field({ type: Type.float32, default: -1 }) declare hitStrokeWidth: number;

  constructor(props?: Partial<Polyline>) {
    Object.assign(this, props);
  }
}
