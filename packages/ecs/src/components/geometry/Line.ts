import { field, Type } from '@lastolivegames/becsy';
import { AABB } from '../math';
import { Marker, Stroke } from '../renderable';
import type { LineSerializedNode } from '../../types/serialized-node';

type LineInput = Partial<Line> | Partial<LineSerializedNode>;

/**
 * 可选的 Line 几何包围盒提供者。设置后 `Line.getGeometryBounds` 将使用该函数。
 */
export type LineGeometryBoundsProvider = (line: LineInput) => AABB;

/**
 * 可选的 Line 渲染包围盒提供者（含 stroke）。设置后 `Line.getRenderBounds` 将使用该函数。
 */
export type LineRenderBoundsProvider = (line: Line, stroke?: Stroke, marker?: Marker) => AABB;

/** 与 Path 的 computePathBounds 返回结构一致。 */
type LineBoundsResult = { minX: number; minY: number; maxX: number; maxY: number };

function lineToPathD(line: LineInput): string {
  const { x1, y1, x2, y2 } = line;
  if (x1 == null || y1 == null || x2 == null || y2 == null) return '';
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

/**
 * 从“外部 computePathBounds”创建 Line.geometryBoundsProvider。
 * 将线段转为 path d（M x1 y1 L x2 y2），再调用 computePathBounds({ d })。
 */
export function createGeometryBoundsProviderFromComputePathBoundsForLine(
  computePathBounds: (opts: { d: string }) => LineBoundsResult | null | undefined,
): LineGeometryBoundsProvider {
  return (line: LineInput) => {
    const d = lineToPathD(line);
    if (!d) return new AABB(0, 0, 0, 0);
    try {
      const result = computePathBounds({ d });
      if (result && Number.isFinite(result.minX + result.minY + result.maxX + result.maxY)) {
        return new AABB(result.minX, result.minY, result.maxX, result.maxY);
      }
    } catch {
      // fallback to builtin
    }
    const prev = Line.geometryBoundsProvider;
    Line.geometryBoundsProvider = null;
    const aabb = Line.getGeometryBounds(line);
    Line.geometryBoundsProvider = prev;
    return aabb;
  };
}

/**
 * 从“外部 computePathBounds”创建 Line.renderBoundsProvider。
 * 将线段转为 path d，再调用 computePathBounds({ d, stroke, markerStart?, markerEnd?, markerFactor? })。
 */
export function createRenderBoundsProviderFromComputePathBoundsForLine(
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
  }) => LineBoundsResult | null | undefined,
): LineRenderBoundsProvider {
  return (line: Line, stroke?: Stroke, marker?: Marker) => {
    const d = lineToPathD(line);
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
    const prev = Line.renderBoundsProvider;
    Line.renderBoundsProvider = null;
    const aabb = Line.getRenderBounds(line, stroke, marker);
    Line.renderBoundsProvider = prev;
    return aabb;
  };
}

/** Line 命中测试入参（无 fill，仅 stroke）。可与 wasm hitTestPath 通过 d = M x1 y1 L x2 y2 复用。 */
export type LineHitTestOptions = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;
  stroke?: Stroke;
};

/**
 * 可选的 Line 命中测试提供者。设置后可在 pickAtPoint 中用 wasm hitTestPath 替代 inLine。
 */
export type LineHitTestProvider = (opts: LineHitTestOptions) => boolean;

/**
 * 从“外部 hitTestPath”创建 Line.hitTestProvider。
 * 将线段转为 path d（M x1 y1 L x2 y2），再调用 hitTestPath({ d, x, y, fill: false, stroke })。
 * 例如 wasm: `Line.hitTestProvider = createHitTestProviderFromHitTestPathForLine(wasm.hitTestPath);`
 */
export function createHitTestProviderFromHitTestPathForLine(
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
): LineHitTestProvider {
  return (opts: LineHitTestOptions) => {
    const d = `M ${opts.x1} ${opts.y1} L ${opts.x2} ${opts.y2}`;
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
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/line
 */
export class Line {
  /** 若设置，则 getGeometryBounds 使用此提供者；否则使用内置实现。 */
  static geometryBoundsProvider: LineGeometryBoundsProvider | null = null;

  /** 若设置，则 getRenderBounds 使用此提供者；否则使用内置实现。 */
  static renderBoundsProvider: LineRenderBoundsProvider | null = null;

  /** 若设置，则 pickAtPoint 等对 Line 的命中检测可调用此提供者（如 wasm hitTestPath）；否则使用 inLine。 */
  static hitTestProvider: LineHitTestProvider | null = null;

  static getGeometryBounds(line: LineInput) {
    if (Line.geometryBoundsProvider) {
      return Line.geometryBoundsProvider(line);
    }
    const { x1, y1, x2, y2 } = line;
    return new AABB(
      Math.min(x1, x2),
      Math.min(y1, y2),
      Math.max(x1, x2),
      Math.max(y1, y2),
    );
  }

  static getRenderBounds(line: Line, stroke?: Stroke, marker?: Marker) {
    if (Line.renderBoundsProvider) {
      return Line.renderBoundsProvider(line, stroke, marker);
    }
    const { width = 0, linecap = 'butt' } = stroke ?? {};

    let style_expansion = 0.5;
    if (linecap === 'square') {
      style_expansion = Math.SQRT1_2;
    }

    // const stroke_is_rectilinear = true;
    // if (
    //   strokeLinejoin === 'miter' &&
    //   style_expansion < Math.SQRT2 * strokeMiterlimit &&
    //   !stroke_is_rectilinear
    // ) {
    //   style_expansion = Math.SQRT2 * strokeMiterlimit;
    // }

    style_expansion *= width;

    const { minX, minY, maxX, maxY } = Line.getGeometryBounds(line);
    return new AABB(
      minX - style_expansion,
      minY - style_expansion,
      maxX + style_expansion,
      maxY + style_expansion,
    );
  }

  /**
   * The x1 attribute is used to specify the first x-coordinate for drawing an SVG element that requires more than one coordinate.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/x1
   */
  @field({ type: Type.float32, default: 0 }) declare x1: number;
  @field({ type: Type.float32, default: 0 }) declare y1: number;
  @field({ type: Type.float32, default: 0 }) declare x2: number;
  @field({ type: Type.float32, default: 0 }) declare y2: number;

  constructor(props?: Partial<Line>) {
    Object.assign(this, props);
  }
}
