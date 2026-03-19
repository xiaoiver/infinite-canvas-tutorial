import { field, Type } from '@lastolivegames/becsy';
import { AABB } from '../math';
import { Marker, Stroke } from '../renderable';
import { parsePath } from '../../utils';

export enum TesselationMethod {
  EARCUT = 'earcut',
  LIBTESS = 'libtess',
}

/**
 * 可选的 Path 几何包围盒提供者。设置后 `Path.getGeometryBounds` 将使用该函数。
 * 未设置时使用内置的采样点 bbox 实现。
 */
export type PathGeometryBoundsProvider = (
  path: Partial<Path>,
  computed?: Partial<ComputedPoints>,
) => AABB;

/**
 * 可选的 Path 渲染包围盒提供者（含 stroke 等样式）。设置后 `Path.getRenderBounds` 将使用该函数。
 * 例如可接入 Rust/WASM 的 `path_render_bounds`（computePathBounds）以获得与 Kurbo stroke 一致的精确 bbox。
 * 未设置时使用内置的几何 bbox + style_expansion 近似。
 */
export type PathRenderBoundsProvider = (
  path: Path,
  computed: ComputedPoints,
  stroke?: Stroke,
  marker?: Marker,
) => AABB;

/** Path 命中测试的入参（与 wasm hitTestPath 对齐）。 */
export type PathHitTestOptions = {
  d: string;
  x: number;
  y: number;
  /** 是否有 fill（有 fill 时走 fill 命中，否则仅 stroke 时走 stroke 命中）。 */
  fill: boolean;
  fillRule: string;
  stroke?: Stroke;
};

/**
 * 可选的 Path 命中测试提供者。设置后可在 pickAtPoint 等逻辑中用 wasm hitTestPath 替代 Canvas2D isPointInStroke/isPointInPath。
 */
export type PathHitTestProvider = (opts: PathHitTestOptions) => boolean;

/** computePathBounds 的返回结构（如 wasm 的 camelCase 序列化）。 */
export type PathBoundsResult = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** computePathBounds 的入参（不传 stroke 即仅几何 bbox；可选 marker 用于起点/终点箭头扩张）。 */
export type ComputePathBoundsOptions = {
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
    color?: unknown;
  };
  /** 起点 marker：'none' | 'line'，为 'line' 时 bbox 在起点处按 strokeWidth * markerFactor 扩张 */
  markerStart?: string;
  /** 终点 marker：'none' | 'line' */
  markerEnd?: string;
  /** marker 尺寸因子（如箭头半径 = strokeWidth * markerFactor），默认 3 */
  markerFactor?: number;
};

/**
 * 从“外部 computePathBounds”创建 Path.geometryBoundsProvider。
 * 调用时只传 d，不传 stroke，得到路径几何的精确 bbox（与 Kurbo 一致）。
 * 例如 wasm: `Path.geometryBoundsProvider = createGeometryBoundsProviderFromComputePathBounds(wasm.computePathBounds);`
 * 当外部返回 null/undefined 或抛错时，会回退到内置实现。
 */
export function createGeometryBoundsProviderFromComputePathBounds(
  computePathBounds: (opts: ComputePathBoundsOptions) => PathBoundsResult | null | undefined,
): PathGeometryBoundsProvider {
  return (path: Partial<Path>, _computed?: Partial<ComputedPoints>) => {
    if (!path.d) {
      return new AABB(Infinity, Infinity, -Infinity, -Infinity);
    }
    try {
      const result = computePathBounds({ d: path.d });
      if (result && Number.isFinite(result.minX + result.minY + result.maxX + result.maxY)) {
        return new AABB(result.minX, result.minY, result.maxX, result.maxY);
      }
    } catch {
      // fallback to builtin
    }
    const prev = Path.geometryBoundsProvider;
    Path.geometryBoundsProvider = null;
    const aabb = Path.getGeometryBounds(path, _computed);
    Path.geometryBoundsProvider = prev;
    return aabb;
  };
}

/**
 * 从“外部 computePathBounds”创建 Path.renderBoundsProvider。
 * 例如 wasm: `Path.renderBoundsProvider = createRenderBoundsProviderFromComputePathBounds(wasm.computePathBounds);`
 * 当外部返回 null/undefined 或抛错时，会回退到内置实现。
 */
export function createRenderBoundsProviderFromComputePathBounds(
  computePathBounds: (opts: ComputePathBoundsOptions) => PathBoundsResult | null | undefined,
): PathRenderBoundsProvider {
  return (path: Path, _computed: ComputedPoints, stroke?: Stroke, marker?: Marker) => {
    try {
      const opts: ComputePathBoundsOptions = { d: path.d };
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
    const prev = Path.renderBoundsProvider;
    Path.renderBoundsProvider = null;
    const aabb = Path.getRenderBounds(path, _computed, stroke, marker);
    Path.renderBoundsProvider = prev;
    return aabb;
  };
}

/**
 * 从“外部 hitTestPath”创建 Path.hitTestProvider。
 * 例如 wasm: `Path.hitTestProvider = createHitTestProviderFromHitTestPath(wasm.hitTestPath);`
 * 入参与 wasm hitTestPath 一致（d, x, y, fill, fillRule, stroke?）。
 */
export function createHitTestProviderFromHitTestPath(
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
      color?: unknown;
    };
  }) => boolean,
): PathHitTestProvider {
  return (opts: PathHitTestOptions) => {
    try {
      const wasmOpts: Parameters<typeof hitTestPath>[0] = {
        d: opts.d,
        x: opts.x,
        y: opts.y,
        fill: opts.fill,
        fillRule: opts.fillRule,
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
 * It is the generic element to define a shape. All the basic shapes can be created with a path element.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/path
 */
export class Path {
  /** 若设置，则 getGeometryBounds 使用此提供者；否则使用内置实现。 */
  static geometryBoundsProvider: PathGeometryBoundsProvider | null = null;

  /** 若设置，则 getRenderBounds 使用此提供者；否则使用内置实现。例如接入 wasm computePathBounds。 */
  static renderBoundsProvider: PathRenderBoundsProvider | null = null;

  /** 若设置，则 pickAtPoint 等对 Path 的命中检测可调用此提供者（如 wasm hitTestPath）；否则使用 Canvas2D isPointInStroke/isPointInPath。 */
  static hitTestProvider: PathHitTestProvider | null = null;

  static getGeometryBounds(
    path: Partial<Path>,
    computed?: Partial<ComputedPoints>,
  ) {
    if (Path.geometryBoundsProvider) {
      return Path.geometryBoundsProvider(path, computed);
    }
    const { d } = path;
    let { points } = computed || {};
    if (!d) {
      return new AABB(Infinity, Infinity, -Infinity, -Infinity);
    }

    if (!points) {
      const { subPaths } = parsePath(d);
      points = subPaths.map((subPath) =>
        subPath
          .getPoints()
          .map((point) => [point[0], point[1]] as [number, number]),
      );
    }

    const flattedPoints = points.flat();

    // FIXME: account for strokeLinejoin & strokeLinecap
    const minX = Math.min(...flattedPoints.map((point) => point[0]));
    const maxX = Math.max(...flattedPoints.map((point) => point[0]));
    const minY = Math.min(...flattedPoints.map((point) => point[1]));
    const maxY = Math.max(...flattedPoints.map((point) => point[1]));

    return new AABB(minX, minY, maxX, maxY);
  }

  static getRenderBounds(
    path: Path,
    computed: ComputedPoints,
    stroke?: Stroke,
    marker?: Marker,
  ) {
    if (Path.renderBoundsProvider) {
      return Path.renderBoundsProvider(path, computed, stroke, marker);
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

    const { minX, minY, maxX, maxY } = Path.getGeometryBounds(path, computed);

    return new AABB(
      minX - style_expansion,
      minY - style_expansion,
      maxX + style_expansion,
      maxY + style_expansion,
    );
  }

  /**
   * Defines a path to be drawn.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d
   */
  @field({ type: Type.object }) declare d: string;

  /**
   * The fill rule to use for rendering the path.
   *
   * Default to `nonzero`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-rule
   */
  @field({
    type: Type.staticString(['nonzero', 'evenodd']),
    default: 'nonzero',
  })
  declare fillRule: CanvasFillRule;

  /**
   * The tesselation method to use for rendering the path.
   *
   * Default to `earcut`.
   */
  @field({ type: Type.staticString(['earcut', 'libtess']), default: 'earcut' })
  declare tessellationMethod: TesselationMethod;

  constructor(props?: Partial<Path>) {
    this.d = props?.d;
    this.fillRule = props?.fillRule;
    this.tessellationMethod = props?.tessellationMethod;
  }
}

export class ComputedPoints {
  /**
   * Sampled points of the path.
   */
  @field({ type: Type.object }) declare points: [number, number][][];

  /**
   * Account for stroke alignment.
   */
  @field({ type: Type.object }) declare shiftedPoints: [number, number][];
}
