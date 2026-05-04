import { isNil, path2Absolute } from '@antv/util';
import toposort from 'toposort';
import { Entity } from '@lastolivegames/becsy';
import { mat3, vec2 } from 'gl-matrix';
import { IPointData } from '@pixi/math';
import {
  Ellipse,
  FillSolid,
  FillGradient,
  Name,
  Opacity,
  Path,
  Polyline,
  Rect,
  Renderable,
  Stroke,
  StrokeGradient,
  Text,
  Transform,
  Visibility,
  DropShadow,
  ZIndex,
  Font,
  AABB,
  TextDecoration,
  FillImage,
  FillPattern,
  MaterialDirty,
  SizeAttenuation,
  StrokeAttenuation,
  Brush,
  Wireframe,
  Rough,
  VectorNetwork,
  Marker,
  InnerShadow,
  Line,
  LockAspectRatio,
  HTML,
  HTMLContainer,
  Embed,
  Filter,
  Binding,
  Binded,
  PartialBinding,
  EdgeLabel,
  Locked,
  ClipMode,
  Flex,
  Group,
  IconFont,
} from '../../components';
import type {
  AttenuationAttributes,
  BrushSerializedNode,
  DropShadowAttributes,
  EdgeSerializedNode,
  EmbedSerializedNode,
  FillAttributes,
  FilterAttributes,
  GSerializedNode,
  HtmlSerializedNode,
  IconFontSerializedNode,
  InnerShadowAttributes,
  LineSerializedNode,
  MarkerAttributes,
  NameAttributes,
  NodeSerializedNode,
  PathSerializedNode,
  PolylineSerializedNode,
  RectSerializedNode,
  RoughAttributes,
  SerializedNode,
  TextSerializedNode,
  VectorNetworkSerializedNode,
  StrokeAttributes,
  VisibilityAttributes,
  WireframeAttributes,
  FlexboxLayoutAttributes,
} from '../../types/serialized-node';
import {
  isDataUrl,
  isUrl,
  serializePoints,
  shiftPath,
  transformPath,
  serializeBrushPoints,
} from '../serialize';
import {
  buildIconFontScalablePrimitives,
  resolveIconFontWireStyle,
} from '../icon-font';
import { Mat3 } from '../../components/math/Mat3';
import { formatNumber } from '../serialize/points';
import { deserializeBrushPoints, deserializePoints } from './points';
import { EntityCommands, Commands } from '../../commands';
import { isGradient } from '../gradient';
import { isPattern } from '../pattern';
import {
  resolveDesignVariableValue,
  designVariableRefKeyFromWire,
  type DesignVariablesMap,
} from '../design-variables';
import { getComputedInheritGroupWireMap } from '../inherit-group-wire';
import { buildGroupWirePresentation } from '../group-presentation';
import type { ThemeMode } from '../../components/Theme';
import { measureText } from '../../systems/ComputeTextMetrics';
import { DOMAdapter } from '../../environment';
import { safeAddComponent } from '../../history';
import {
  EdgeState,
  updateFixedTerminalPoints,
  updateFloatingTerminalPoints,
  updatePoints,
} from '../binding';
import {
  normalizePathCommands,
  toPathData,
  type PathCommand,
} from '../path-edit';
import { pointAndNormalAlongPolylineByT } from '../polyline-arclength';
import simplify from 'simplify-js';
import { expandRefSerializedNodes, mergeSerializedNodesForRefLookup } from './expand-ref-nodes';
import { insertIconFontChildFromPrimitive } from '../insert-icon-font-child-entity';
import { resetFillImageSvgRerasterSchedule } from '../fillImageSvgReraster';
import { hasRasterPostEffects } from '../filter';

export function inferXYWidthHeight(node: SerializedNode) {
  if (node.type === 'g') {
    return node;
  }

  if (
    isNil(node.width) ||
    isNil(node.height) ||
    isNil(node.x) ||
    isNil(node.y)
  ) {
    const { type } = node;
    let bounds: AABB;
    if (type === 'rect' || type === 'html' || type === 'embed' || type === 'iconfont') {
      bounds = Rect.getGeometryBounds(node as Partial<Rect>);
    } else if (type === 'ellipse' || type === 'rough-ellipse') {
      bounds = Ellipse.getGeometryBounds(node);
    } else if (type === 'polyline' || type === 'rough-polyline') {
      bounds = Polyline.getGeometryBounds(node);
    } else if (type === 'line' || type === 'rough-line') {
      bounds = Line.getGeometryBounds(node);
    } else if (type === 'path' || type === 'rough-path') {
      bounds = Path.getGeometryBounds(node);
    } else if (type === 'text') {
      const metrics = measureText(node);
      bounds = Text.getGeometryBounds(node, metrics);
    } else if (type === 'brush') {
      bounds = Brush.getGeometryBounds(node);
    } else if (type === 'vector-network') {
      bounds = VectorNetwork.getGeometryBounds(node);
    }

    if (bounds) {
      node.x = bounds.minX;
      node.y = bounds.minY;
      node.width = bounds.maxX - bounds.minX;
      node.height = bounds.maxY - bounds.minY;

      if (type === 'polyline' || type === 'rough-polyline') {
        node.points = serializePoints(
          deserializePoints(node.points).map((point) => {
            return [point[0] - bounds.minX, point[1] - bounds.minY];
          }),
        );
      } else if (type === 'line' || type === 'rough-line') {
        node.x1 = node.x1 - bounds.minX;
        node.y1 = node.y1 - bounds.minY;
        node.x2 = node.x2 - bounds.minX;
        node.y2 = node.y2 - bounds.minY;
      } else if (type === 'path' || type === 'rough-path') {
        node.d = shiftPath(node.d, -bounds.minX, -bounds.minY);
      } else if (type === 'brush') {
        node.points = serializeBrushPoints(
          deserializeBrushPoints(node.points).map((point) => {
            return {
              ...point,
              x: point.x - bounds.minX,
              y: point.y - bounds.minY,
            };
          }),
        );
      } else if (type === 'text') {
        node.anchorX = (node.anchorX ?? 0) - bounds.minX;
        node.anchorY = (node.anchorY ?? 0) - bounds.minY;
      } else if (type === 'vector-network') {
        node.vertices = node.vertices.map((vertex) => ({
          ...vertex,
          x: vertex.x - bounds.minX,
          y: vertex.y - bounds.minY,
        }));
      }
    } else {
      throw new Error('Cannot infer x, y, width or height for node');
    }

    return node;
  }
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * 与 draw.io {@link https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/shape/mxShape.js#L1230-L1321 mxShape.prototype.addPoints}
 * 一致：将折线顶点转为 SVG `d`（开放路径，无 close）。圆角段用二次贝塞尔 Q，控制点为角点。
 */
function addOpenPointsToPathD(pts: IPointData[], rounded: boolean, arcSize: number): string {
  if (pts.length === 0) {
    return '';
  }
  const close = false;
  const initialMove = true;
  const exclude: number[] | null = null;

  const points = pts;
  const pe = points[points.length - 1];

  const parts: string[] = [];
  let pt = points[0];
  let i = 1;

  const moveTo = (x: number, y: number) => {
    parts.push(`M ${formatNumber(x)} ${formatNumber(y)}`);
  };
  const lineTo = (x: number, y: number) => {
    parts.push(`L ${formatNumber(x)} ${formatNumber(y)}`);
  };
  const quadTo = (cx: number, cy: number, x: number, y: number) => {
    parts.push(
      `Q ${formatNumber(cx)} ${formatNumber(cy)} ${formatNumber(x)} ${formatNumber(y)}`,
    );
  };

  if (initialMove) {
    moveTo(pt.x, pt.y);
  } else {
    lineTo(pt.x, pt.y);
  }

  while (i < (close ? points.length : points.length - 1)) {
    let tmp = points[mod(i, points.length)];
    let dx = pt.x - tmp.x;
    let dy = pt.y - tmp.y;

    if (
      rounded &&
      (dx !== 0 || dy !== 0) &&
      (exclude == null || exclude.indexOf(i - 1) < 0)
    ) {
      let dist = Math.sqrt(dx * dx + dy * dy);
      const nx1 = (dx * Math.min(arcSize, dist / 2)) / dist;
      const ny1 = (dy * Math.min(arcSize, dist / 2)) / dist;

      const x1 = tmp.x + nx1;
      const y1 = tmp.y + ny1;
      lineTo(x1, y1);

      let next = points[mod(i + 1, points.length)];

      while (
        i < points.length - 2 &&
        Math.round(next.x - tmp.x) === 0 &&
        Math.round(next.y - tmp.y) === 0
      ) {
        next = points[mod(i + 2, points.length)];
        i++;
      }

      dx = next.x - tmp.x;
      dy = next.y - tmp.y;

      dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const nx2 = (dx * Math.min(arcSize, dist / 2)) / dist;
      const ny2 = (dy * Math.min(arcSize, dist / 2)) / dist;

      const x2 = tmp.x + nx2;
      const y2 = tmp.y + ny2;

      quadTo(tmp.x, tmp.y, x2, y2);
      tmp = { x: x2, y: y2 };
    } else {
      lineTo(tmp.x, tmp.y);
    }

    pt = tmp;
    i++;
  }

  if (!close) {
    lineTo(pe.x, pe.y);
  }

  return parts.join(' ');
}

/** 对齐 mxPolyline.paintCurvedLine：中间段终点取相邻点中点，末段收敛到最后一点。 */
function addCurvedLineToPathD(pts: IPointData[]): string {
  if (pts.length < 2) {
    return '';
  }

  const parts: string[] = [
    `M ${formatNumber(pts[0].x)} ${formatNumber(pts[0].y)}`,
  ];
  const n = pts.length;

  for (let i = 1; i < n - 2; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const ix = (p0.x + p1.x) / 2;
    const iy = (p0.y + p1.y) / 2;
    parts.push(
      `Q ${formatNumber(p0.x)} ${formatNumber(p0.y)} ${formatNumber(ix)} ${formatNumber(iy)}`,
    );
  }

  const p0 = pts[n - 2];
  const p1 = pts[n - 1];
  parts.push(
    `Q ${formatNumber(p0.x)} ${formatNumber(p0.y)} ${formatNumber(p1.x)} ${formatNumber(p1.y)}`,
  );

  return parts.join(' ');
}

/** 对齐 mxPolyline.paintBezierLine。 */
function addBezierLineToPathD(pts: IPointData[]): string {
  const n = pts.length;
  if (n < 2) {
    return '';
  }

  const parts: string[] = [
    `M ${formatNumber(pts[0].x)} ${formatNumber(pts[0].y)}`,
  ];

  // 2 点退化为直线
  if (n === 2) {
    parts.push(`L ${formatNumber(pts[1].x)} ${formatNumber(pts[1].y)}`);
    return parts.join(' ');
  }

  // 3n+1：直接把点解释为三次贝塞尔控制点
  if ((n - 1) % 3 === 0) {
    for (let i = 1; i + 2 < n; i += 3) {
      const cp1 = pts[i];
      const cp2 = pts[i + 1];
      const end = pts[i + 2];
      parts.push(
        `C ${formatNumber(cp1.x)} ${formatNumber(cp1.y)} ` +
        `${formatNumber(cp2.x)} ${formatNumber(cp2.y)} ` +
        `${formatNumber(end.x)} ${formatNumber(end.y)}`,
      );
    }
    return parts.join(' ');
  }

  // 非 3n+1：与 draw.io 一样回退到曲线插值
  return addCurvedLineToPathD(pts);
}

/** 用路径命令端点折线近似 `d`，供边标签沿路径插值（曲线段为弦近似）。 */
export function polylineVertexApproxFromPathD(d: string | undefined): [number, number][] | null {
  if (!d) {
    return null;
  }
  const cmds = path2Absolute(d) as [string, ...number[]][];
  const pts: [number, number][] = [];
  for (const row of cmds) {
    const [command, ...data] = row;
    if (command === 'M' || command === 'L') {
      pts.push([data[0], data[1]]);
    } else if (command === 'Q') {
      pts.push([data[2], data[3]]);
    } else if (command === 'C') {
      pts.push([data[4], data[5]]);
    }
  }
  return pts.length >= 2 ? pts : null;
}

export function hasTerminalPoint(p?: { x: number; y: number } | null): boolean {
  return p != null && Number.isFinite(p.x) && Number.isFinite(p.y);
}

/**
 * 边几何在画布/父级坐标系下的起点或终点（`inferXYWidthHeight` 之后的局部坐标 + `edge.x`/`edge.y`）。
 * 用于将浮动端的 `sourcePoint` / `targetPoint` 与当前 stroke 保持一致并写回场景数据。
 */
export function getWorldTerminalOfEdge(
  edge: SerializedNode & { x?: number; y?: number },
  which: 'start' | 'end',
): { x: number; y: number } | null {
  const ox = edge.x ?? 0;
  const oy = edge.y ?? 0;
  const t = edge.type;
  if (t === 'line' || t === 'rough-line') {
    const e = edge as LineSerializedNode & {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };
    if (which === 'start') {
      return { x: ox + e.x1, y: oy + e.y1 };
    }
    return { x: ox + e.x2, y: oy + e.y2 };
  }
  if (t === 'polyline' || t === 'rough-polyline') {
    const pts = deserializePoints((edge as PolylineSerializedNode).points);
    if (pts.length < 1) {
      return null;
    }
    const p = which === 'start' ? pts[0] : pts[pts.length - 1];
    return { x: ox + p[0], y: oy + p[1] };
  }
  if (t === 'path' || t === 'rough-path') {
    const pts = polylineVertexApproxFromPathD((edge as PathSerializedNode).d);
    if (!pts || pts.length < 1) {
      return null;
    }
    const p = which === 'start' ? pts[0] : pts[pts.length - 1];
    return { x: ox + p[0], y: oy + p[1] };
  }
  return null;
}

/**
 * 边的两端是否都能解析：一侧为连接节点，或提供了对应的 `sourcePoint` / `targetPoint`（画布坐标）。
 */
export function edgeEndsResolvable(
  edge: EdgeSerializedNode,
  fromNode: SerializedNode | undefined | null,
  toNode: SerializedNode | undefined | null,
): boolean {
  const hasStart = fromNode != null || hasTerminalPoint(edge.sourcePoint);
  const hasEnd = toNode != null || hasTerminalPoint(edge.targetPoint);
  return hasStart && hasEnd;
}

/**
 * 归一化后为「单段贝塞尔」且紧跟在 M 之后：一段 C，或一段 Q（无 C/Q 混用、无多段 Q 链）。
 * 多段正交曲线（多 Q）仍走整条 {@link inferEdgePoints}。
 */
function pathHasPreservableSingleBezierSegment(d: string | undefined): boolean {
  if (!d) {
    return false;
  }
  const cmds = normalizePathCommands(d);
  const cCount = cmds.filter((c) => c[0] === 'C').length;
  const qCount = cmds.filter((c) => c[0] === 'Q').length;
  if (cCount > 0 && qCount > 0) {
    return false;
  }
  if (cmds.length < 2 || cmds[0][0] !== 'M') {
    return false;
  }
  const firstSeg = cmds[1][0];
  if (cCount === 1 && qCount === 0) {
    return firstSeg === 'C';
  }
  if (cCount === 0 && qCount === 1) {
    return firstSeg === 'Q';
  }
  return false;
}

/**
 * 绑定 preserve 时缓存的 path 局部几何与 {@link Transform} 一致字段。
 * 仅用 {@link shiftPath(d, x, y)} 会把局部点当成只平移，忽略 scale/rotation，与画布上真实位置不一致。
 */
export interface EdgePathPreserveSnapshot {
  d: string;
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

function pathLocalToWorldPathD(d: string, snap: EdgePathPreserveSnapshot): string {
  const m = Mat3.toGLMat3(
    Mat3.fromTransform(
      new Transform({
        translation: { x: snap.x, y: snap.y },
        rotation: snap.rotation ?? 0,
        scale: { x: snap.scaleX ?? 1, y: snap.scaleY ?? 1 },
      }),
    ),
  );
  return transformPath(d, m);
}

function pathWorldToLocalPathD(worldD: string, snap: EdgePathPreserveSnapshot): string {
  const m = Mat3.toGLMat3(
    Mat3.fromTransform(
      new Transform({
        translation: { x: snap.x, y: snap.y },
        rotation: snap.rotation ?? 0,
        scale: { x: snap.scaleX ?? 1, y: snap.scaleY ?? 1 },
      }),
    ),
  );
  const inv = mat3.create();
  if (!mat3.invert(inv, m)) {
    return worldD;
  }
  return transformPath(worldD, inv);
}

/**
 * preserve 写入局部 `d` 后：按与 {@link inferXYWidthHeight} 相同方式用 {@link shiftPath} 把 bbox 最小角贴到局部原点，
 * 再用快照中的旋转/缩放把「归一化前的 bbox 角」映射到世界坐标写回 `x/y`。
 * 切勿在无 `x/y` 时直接调用 {@link inferXYWidthHeight}：会把 `translation` 设成 `d` 的局部 min（常为 0），丢失画布平移。
 *
 * 亦用于 {@link applyElementUpdates}：仅更新 `d` 时保持与边绑定一致的布局语义。
 */
export function applyPathPreserveLayoutFromSnapshot(
  edge: SerializedNode,
  prev: EdgePathPreserveSnapshot,
): void {
  const pn = edge as PathSerializedNode;
  const b = Path.getGeometryBounds({ d: pn.d });
  const mPrev = Mat3.toGLMat3(
    Mat3.fromTransform(
      new Transform({
        translation: { x: prev.x, y: prev.y },
        rotation: prev.rotation ?? 0,
        scale: { x: prev.scaleX ?? 1, y: prev.scaleY ?? 1 },
      }),
    ),
  );
  const corner = vec2.transformMat3(vec2.create(), [b.minX, b.minY], mPrev);
  pn.d = shiftPath(pn.d, -b.minX, -b.minY);
  edge.x = corner[0];
  edge.y = corner[1];
  edge.rotation = prev.rotation ?? 0;
  edge.scaleX = prev.scaleX ?? 1;
  edge.scaleY = prev.scaleY ?? 1;
  const b2 = Path.getGeometryBounds({ d: pn.d });
  edge.width = b2.maxX - b2.minX;
  edge.height = b2.maxY - b2.minY;
}

/** 与 {@link Mat3.fromTransform}+{@link transformPath} 一致的世界坐标端点（勿用仅平移的 shiftPath）。 */
function pathEndpointsWorldFromPreserveSnapshot(
  snap: EdgePathPreserveSnapshot,
): { start: IPointData; end: IPointData } | null {
  const worldD = pathLocalToWorldPathD(snap.d, snap);
  const cmds = normalizePathCommands(worldD);
  return extractBezierEndpointsFromNormalizedCmds(cmds);
}

function extractBezierEndpointsFromNormalizedCmds(
  cmds: PathCommand[],
): { start: IPointData; end: IPointData } | null {
  if (cmds.length < 1 || cmds[0][0] !== 'M') {
    return null;
  }
  const m = cmds[0];
  const start = { x: m[1] as number, y: m[2] as number };
  const last = cmds[cmds.length - 1];
  const t = last[0];
  let end: IPointData;
  if (t === 'C') {
    end = { x: last[5] as number, y: last[6] as number };
  } else if (t === 'Q') {
    end = { x: last[3] as number, y: last[4] as number };
  } else if (t === 'L') {
    end = { x: last[1] as number, y: last[2] as number };
  } else {
    return null;
  }
  return { start, end };
}

/**
 * 与 {@link inferEdgePoints} 相同的路由输入，只计算两端在世界坐标系下的位置（不写回 `d`）。
 */
export function inferEdgeTerminalWorldPoints(
  from: SerializedNode | null,
  to: SerializedNode | null,
  edge: EdgeSerializedNode,
): { start: IPointData; end: IPointData } | null {
  if (from) {
    inferXYWidthHeight(from);
  }
  if (to) {
    inferXYWidthHeight(to);
  }

  type NodeWithBounds = SerializedNode & {
    width: number;
    height: number;
    x: number;
    y: number;
  };
  const state = edge as PolylineSerializedNode & {
    width: number;
    height: number;
    x: number;
    y: number;
  } & { absolutePoints: (IPointData | null)[] };
  state.absolutePoints = [null, null];
  updateFixedTerminalPoints(
    state,
    from as NodeWithBounds | null,
    to as NodeWithBounds | null,
  );
  updatePoints(state, null, from as NodeSerializedNode | null, to as NodeSerializedNode | null);
  updateFloatingTerminalPoints(
    state,
    from as NodeWithBounds | null,
    to as NodeWithBounds | null,
  );

  /** 勿对 absolutePoints 做 simplify：会挪动首尾点，与真实绑定点不一致，preserve 时产生整体偏移。 */
  const pts = state.absolutePoints?.filter((p): p is IPointData => p != null);
  delete state.absolutePoints;
  if (!pts || pts.length < 2) {
    return null;
  }
  return { start: pts[0], end: pts[pts.length - 1] };
}

function applyEndpointDeltasToPathCommands(
  cmds: PathCommand[],
  dSx: number,
  dSy: number,
  dEx: number,
  dEy: number,
): PathCommand[] {
  const out = cmds.map((c) => [...c] as PathCommand);
  if (out.length === 0) {
    return out;
  }
  const m = out[0];
  if (m[0] === 'M') {
    (m[1] as number) += dSx;
    (m[2] as number) += dSy;
  }
  if (out.length > 1) {
    const s = out[1];
    if (s[0] === 'C') {
      (s[1] as number) += dSx;
      (s[2] as number) += dSy;
    } else if (s[0] === 'Q') {
      (s[1] as number) += dSx;
      (s[2] as number) += dSy;
    }
  }
  const last = out[out.length - 1];
  if (last[0] === 'C') {
    (last[3] as number) += dEx;
    (last[4] as number) += dEy;
    (last[5] as number) += dEx;
    (last[6] as number) += dEy;
  } else if (last[0] === 'Q') {
    (last[1] as number) += dEx;
    (last[2] as number) += dEy;
    (last[3] as number) += dEx;
    (last[4] as number) += dEy;
  } else if (last[0] === 'L') {
    (last[1] as number) += dEx;
    (last[2] as number) += dEy;
  }
  return out;
}

/**
 * 绑定变更时若当前 `d` 为单段 C 或单段 Q（紧跟 M，用户拖过 Handle），只平移端点与相邻控制点，避免整条被正交路由覆盖。
 *
 * @returns `true` 表示已写回 `d` 并完成布局（归一化 `d` 并恢复 `x/y/width/height`）；`false` 时应回退到 {@link inferEdgePoints}。
 */
export function inferEdgePointsPreservingBezierHandles(
  from: SerializedNode | null,
  to: SerializedNode | null,
  edge: EdgeState,
  prev: EdgePathPreserveSnapshot,
): boolean {
  const t = edge.type;
  if ((t !== 'path' && t !== 'rough-path') || !pathHasPreservableSingleBezierSegment(prev.d)) {
    return false;
  }

  const edgeNode = edge as SerializedNode as EdgeSerializedNode;

  const oldEnds = pathEndpointsWorldFromPreserveSnapshot(prev);
  const newPts = inferEdgeTerminalWorldPoints(from, to, edgeNode);
  if (!oldEnds || !newPts) {
    return false;
  }

  // 仅对已绑定端应用「绑定路由」带来的位移。悬空端的 targetPoint/sourcePoint 往往在用户拖 path 端点时尚未更新，
  // 若仍用 inferEdgeTerminalWorldPoints 会与 d 冲突，表现为整条曲线被平移或端点被拉回。
  const applyStart = Boolean(edgeNode.fromId);
  const applyEnd = Boolean(edgeNode.toId);
  const dSx = applyStart ? newPts.start.x - oldEnds.start.x : 0;
  const dSy = applyStart ? newPts.start.y - oldEnds.start.y : 0;
  const dEx = applyEnd ? newPts.end.x - oldEnds.end.x : 0;
  const dEy = applyEnd ? newPts.end.y - oldEnds.end.y : 0;

  const eps = 1e-5;
  if (
    Math.abs(dSx) < eps &&
    Math.abs(dSy) < eps &&
    Math.abs(dEx) < eps &&
    Math.abs(dEy) < eps
  ) {
    (edge as PathSerializedNode).d = prev.d;
    applyPathPreserveLayoutFromSnapshot(edge as SerializedNode, prev);
    return true;
  }

  const worldD = pathLocalToWorldPathD(prev.d, prev);
  const cmds = normalizePathCommands(worldD);
  const next = applyEndpointDeltasToPathCommands(cmds, dSx, dSy, dEx, dEy);
  const worldOut = toPathData(next);
  (edge as PathSerializedNode).d = pathWorldToLocalPathD(worldOut, prev);
  applyPathPreserveLayoutFromSnapshot(edge as SerializedNode, prev);
  return true;
}

/** @deprecated 使用 {@link inferEdgePointsPreservingBezierHandles}（已支持 Q） */
export const inferEdgePointsPreservingCubicHandles = inferEdgePointsPreservingBezierHandles;

/**
 * 根据 `from` / `to` 节点与可选的 `sourcePoint` / `targetPoint` 计算边几何（与 mxGraph 悬空端语义一致）。
 */
export function inferEdgePoints(
  from: SerializedNode | null,
  to: SerializedNode | null,
  edge: EdgeState,
) {
  if (from) {
    inferXYWidthHeight(from);
  }
  if (to) {
    inferXYWidthHeight(to);
  }

  type NodeWithBounds = SerializedNode & { width: number; height: number; x: number; y: number };
  const state = edge as PolylineSerializedNode & { width: number; height: number; x: number; y: number } & { absolutePoints: (IPointData | null)[] };
  state.absolutePoints = [null, null];
  updateFixedTerminalPoints(
    state,
    from as NodeWithBounds | null,
    to as NodeWithBounds | null,
  );
  updatePoints(state, null, from as NodeSerializedNode | null, to as NodeSerializedNode | null);
  updateFloatingTerminalPoints(state, from as NodeWithBounds | null, to as NodeWithBounds | null);

  state.absolutePoints = simplify(state.absolutePoints);

  if (edge.type === 'line' || edge.type === 'rough-line') {
    const pts = state.absolutePoints.filter((p): p is IPointData => p != null);
    if (pts.length >= 2) {
      edge.x1 = pts[0].x;
      edge.y1 = pts[0].y;
      const end = pts[pts.length - 1];
      edge.x2 = end.x;
      edge.y2 = end.y;
    }
  } else if (edge.type === 'polyline' || edge.type === 'rough-polyline') {
    edge.points = serializePoints(state.absolutePoints.map((point) => {
      return [point.x, point.y];
    }));
  } else if (edge.type === 'path' || edge.type === 'rough-path') {
    if (edge.bezier) {
      const pts = state.absolutePoints.filter((p): p is IPointData => p != null);
      if (pts.length >= 2) {
        (edge as PathSerializedNode).d = addBezierLineToPathD(pts);
      }
    } else if (edge.curved) {
      const pts = state.absolutePoints.filter((p): p is IPointData => p != null);
      if (pts.length >= 2) {
        (edge as PathSerializedNode).d = addCurvedLineToPathD(pts);
      }
    } else {
      const pts = state.absolutePoints.filter((p): p is IPointData => p != null);
      if (pts.length >= 2) {
        const arcSize =
          typeof (edge as EdgeState & { arcSize?: number }).arcSize === 'number'
            ? (edge as EdgeState & { arcSize: number }).arcSize
            : 10;
        if (edge.rounded) {
          (edge as PathSerializedNode).d = addOpenPointsToPathD(pts, true, arcSize);
        } else {
          (edge as PathSerializedNode).d =
            `M ${formatNumber(pts[0].x)} ${formatNumber(pts[0].y)} ` +
            pts
              .slice(1)
              .map((p) => `L ${formatNumber(p.x)} ${formatNumber(p.y)}`)
              .join(' ');
        }
      }
    }
  }
  delete state.absolutePoints;
}

export function inferPointsWithFromIdAndToId(
  from: SerializedNode,
  to: SerializedNode,
  edge: EdgeState,
) {
  inferEdgePoints(from, to, edge);
}

/**
 * After bound edge geometry is finalized ({@link inferXYWidthHeight}), place child `text` nodes
 * with `edgeLabelPosition` on the edge in parent-local coordinates (same rules as {@link layoutTextAnchoredInParent}).
 */
function layoutSerializedEdgeLabelChildren(
  edge: SerializedNode,
  nodes: SerializedNode[],
) {
  const edgeId = edge.id;
  if (!edgeId) {
    return;
  }
  const labelNodes = nodes.filter(
    (n): n is TextSerializedNode =>
      n.type === 'text' &&
      n.parentId === edgeId &&
      (n as TextSerializedNode).edgeLabelPosition != null &&
      !Number.isNaN((n as TextSerializedNode).edgeLabelPosition!),
  );
  if (labelNodes.length === 0) {
    return;
  }

  let points: [number, number][] | null = null;
  if (edge.type === 'polyline' || edge.type === 'rough-polyline') {
    points = deserializePoints((edge as PolylineSerializedNode).points) as [
      number,
      number,
    ][];
  } else if (edge.type === 'line' || edge.type === 'rough-line') {
    const l = edge as LineSerializedNode;
    points = [
      [l.x1, l.y1],
      [l.x2, l.y2],
    ];
  } else if (edge.type === 'path' || edge.type === 'rough-path') {
    points = polylineVertexApproxFromPathD((edge as PathSerializedNode).d);
  }
  if (!points || points.length < 2) {
    return;
  }

  for (const labelNode of labelNodes) {
    const t = labelNode.edgeLabelPosition ?? 0.5;
    const offset = labelNode.edgeLabelOffset ?? 0;
    const { point: [px, py], normal: [nx, ny] } = pointAndNormalAlongPolylineByT(points, t);
    const ax = px + nx * offset;
    const ay = py + ny * offset;
    const copy = {
      ...labelNode,
      anchorX: ax,
      anchorY: ay,
    };
    delete (copy as Partial<TextSerializedNode>).x;
    delete (copy as Partial<TextSerializedNode>).y;
    delete (copy as Partial<TextSerializedNode>).width;
    delete (copy as Partial<TextSerializedNode>).height;
    inferXYWidthHeight(copy as SerializedNode);
    Object.assign(labelNode, {
      x: copy.x,
      y: copy.y,
      width: copy.width,
      height: copy.height,
      anchorX: copy.anchorX,
      anchorY: copy.anchorY,
    });
  }
}

export async function loadImage(url: string, entity: Entity) {
  const image = await DOMAdapter.get().createImage(url);
  resetFillImageSvgRerasterSchedule(entity);
  safeAddComponent(entity, FillImage, {
    src: image as ImageBitmap,
    url,
  });
  safeAddComponent(entity, MaterialDirty);
}

function serializeRough(attributes: RoughAttributes, entity: EntityCommands) {
  const {
    roughSeed,
    roughRoughness,
    roughBowing,
    roughFillStyle,
    roughFillWeight,
    roughHachureAngle,
    roughHachureGap,
    roughCurveStepCount,
    roughCurveFitting,
    roughFillLineDash,
    roughFillLineDashOffset,
    roughDisableMultiStroke,
    roughDisableMultiStrokeFill,
    roughSimplification,
    roughDashOffset,
    roughDashGap,
    roughZigzagOffset,
    roughPreserveVertices,
  } = attributes;
  entity.insert(
    new Rough({
      seed: roughSeed,
      roughness: roughRoughness,
      bowing: roughBowing,
      fillStyle: roughFillStyle,
      fillWeight: roughFillWeight,
      hachureAngle: roughHachureAngle,
      hachureGap: roughHachureGap,
      curveStepCount: roughCurveStepCount,
      curveFitting: roughCurveFitting,
      fillLineDash: roughFillLineDash,
      fillLineDashOffset: roughFillLineDashOffset,
      disableMultiStroke: roughDisableMultiStroke,
      disableMultiStrokeFill: roughDisableMultiStrokeFill,
      simplification: roughSimplification,
      dashOffset: roughDashOffset,
      dashGap: roughDashGap,
      zigzagOffset: roughZigzagOffset,
      preserveVertices: roughPreserveVertices,
    }),
  );
}

export type SerializedNodesToEntitiesOptions = {
  /**
   * 用于解析边的 `fromId`/`toId`、绑定边拓扑与边标签子节点。
   * 不传时仅使用入参 `nodes`（例如整图反序列化）。
   * 增量添加（如 {@link API.updateNode} 只传入新节点）时应传入「当前场景 + 本批节点」合并后的列表。
   */
  lookupNodes?: SerializedNode[];
  /** 文档级设计变量，用于解析 `$token` 形式的 fill/stroke/fontSize 等 */
  variables?: DesignVariablesMap;
  /** 用于多主题设计变量条目的条件匹配 */
  themeMode?: ThemeMode;
};

export function serializedNodesToEntities(
  nodes: SerializedNode[],
  fonts: Entity[],
  commands: Commands,
  idEntityMap?: Map<string, EntityCommands>,
  options?: SerializedNodesToEntitiesOptions,
): {
  entities: Entity[];
  idEntityMap: Map<string, EntityCommands>;
} {
  const mergedForRef = mergeSerializedNodesForRefLookup(
    nodes,
    options?.lookupNodes,
  );
  const expandedNodes = expandRefSerializedNodes(nodes, mergedForRef);
  const graph = mergeSerializedNodesForRefLookup(
    expandedNodes,
    options?.lookupNodes,
  );
  const inheritGroupWireById = getComputedInheritGroupWireMap(graph);

  // The old entities are already added to canvas.
  let existedVertices: string[] = [];
  if (idEntityMap) {
    existedVertices = Array.from(idEntityMap.keys());
  }

  const vertices = Array.from(
    new Set([...existedVertices, ...expandedNodes.map((node) => node.id)]),
  );
  let edges = expandedNodes
    .filter((node) => !isNil(node.parentId))
    .map((node) => [node.parentId, node.id] as [string, string]);

  // bindings should also be sorted
  expandedNodes.forEach((node) => {
    if (
      node.type === 'line' ||
      node.type === 'polyline' ||
      node.type === 'path' ||
      node.type === 'rough-line' ||
      node.type === 'rough-polyline' ||
      node.type === 'rough-path'
    ) {
      const { fromId, toId } = node as EdgeSerializedNode;
      if (fromId) {
        edges.push([fromId, node.id]);
      }
      if (toId) {
        edges.push([toId, node.id]);
      }
    }
  });

  // remove edges that are not in the graph (batch or full lookup)
  edges = edges.filter(([fromId, toId]) => {
    return (
      graph.some((node) => node.id === fromId) &&
      graph.some((node) => node.id === toId)
    );
  });

  const sorted = toposort.array(vertices, edges);

  if (!idEntityMap) {
    idEntityMap = new Map<string, EntityCommands>();
  }

  const entities: Entity[] = [];
  for (const id of sorted) {
    const node = expandedNodes.find((n) => n.id === id);

    if (!node) {
      continue;
    }

    const attributes = node;
    if (!attributes.type) {
      attributes.type = 'rect';
    }

    const { parentId, type } = node;
    if (type === 'ref') {
      throw new Error(
        'ref nodes must be expanded before serializedNodesToEntities (expandRefSerializedNodes)',
      );
    }
    const designVariables = options?.variables;
    const themeMode = options?.themeMode;
    const wirePaint = inheritGroupWireById.get(id) ?? {};
    const wireMergedAttrs = { ...attributes, ...wirePaint };

    /** `iconfont` 拆成子 path/circle/line 时，父级不挂 Fill/Stroke。 */
    let skipParentFillStroke = false;
    /**
     * 子 path/ellipse/line 的 `EntityCommands`；`execute` 前用 `hold()`+`getDescendants` 不可靠，带
     * `filter` 时直接 `insert(MaterialDirty)`。
     */
    const iconfontChildCommands: EntityCommands[] = [];

    const entityCommands = commands.spawn();
    idEntityMap.set(id, entityCommands);

    // Infer points: full binding,或仅 sourcePoint/targetPoint / 单侧节点
    if (
      type === 'line' ||
      type === 'rough-line' ||
      type === 'polyline' ||
      type === 'rough-polyline' ||
      type === 'path' ||
      type === 'rough-path'
    ) {
      const edgeAttrs = attributes as EdgeSerializedNode;
      const { fromId, toId } = edgeAttrs;
      const fromNode = fromId ? graph.find((n) => n.id === fromId) : undefined;
      const toNode = toId ? graph.find((n) => n.id === toId) : undefined;

      if (edgeEndsResolvable(edgeAttrs, fromNode, toNode)) {
        inferEdgePoints(
          fromNode ?? null,
          toNode ?? null,
          attributes as EdgeState,
        );

        if (fromId && toId && fromNode && toNode) {
          const fromEntityCommands = idEntityMap.get(fromId);
          const fromEntity = fromEntityCommands?.id().hold();
          const toEntityCommands = idEntityMap.get(toId);
          const toEntity = toEntityCommands?.id().hold();

          safeAddComponent(fromEntity, Binded);
          safeAddComponent(toEntity, Binded);
          entityCommands.insert(
            new Binding({
              from: fromEntity,
              to: toEntity,
            }),
          );
        } else if (fromNode && !toNode) {
          const fromEntityCommands = idEntityMap.get(fromId!);
          const fromEntity = fromEntityCommands?.id().hold();
          safeAddComponent(fromEntity, Binded);
          entityCommands.insert(
            new PartialBinding({
              attached: fromEntity,
              sourceIsAttached: 1,
            }),
          );
        } else if (toNode && !fromNode) {
          const toEntityCommands = idEntityMap.get(toId!);
          const toEntity = toEntityCommands?.id().hold();
          safeAddComponent(toEntity, Binded);
          entityCommands.insert(
            new PartialBinding({
              attached: toEntity,
              sourceIsAttached: 0,
            }),
          );
        }
      }
    }

    // Make sure the entity has a width and height
    inferXYWidthHeight(attributes);

    const edgeAttrsForLabel = attributes as EdgeSerializedNode;
    if (
      (type === 'line' ||
        type === 'rough-line' ||
        type === 'polyline' ||
        type === 'rough-polyline' ||
        type === 'path' ||
        type === 'rough-path') &&
      edgeEndsResolvable(
        edgeAttrsForLabel,
        edgeAttrsForLabel.fromId
          ? graph.find((n) => n.id === edgeAttrsForLabel.fromId)
          : undefined,
        edgeAttrsForLabel.toId
          ? graph.find((n) => n.id === edgeAttrsForLabel.toId)
          : undefined,
      )
    ) {
      layoutSerializedEdgeLabelChildren(attributes, graph);
    }

    const { x, y, width, height, rotation = 0, scaleX = 1, scaleY = 1 } = attributes;
    const absoluteX = x ?? 0;
    const absoluteY = y ?? 0;
    const absoluteWidth = width ?? 0;
    const absoluteHeight = height ?? 0;

    entityCommands.insert(
      new Transform({
        translation: {
          x: absoluteX,
          y: absoluteY,
        },
        rotation,
        scale: {
          x: scaleX,
          y: scaleY,
        },
      }),
    );

    entityCommands.insert(new Renderable());

    if (type === 'g') {
      entityCommands.insert(
        new Group(
          buildGroupWirePresentation(
            wireMergedAttrs as GSerializedNode,
            designVariables,
            themeMode,
          ),
        ),
      );
    } else if (type === 'ellipse' || type === 'rough-ellipse') {
      entityCommands.insert(
        new Ellipse({
          cx: absoluteWidth / 2,
          cy: absoluteHeight / 2,
          rx: absoluteWidth / 2,
          ry: absoluteHeight / 2,
        }),
      );

      if (type === 'rough-ellipse') {
        serializeRough(attributes as RoughAttributes, entityCommands);
      }
    } else if (type === 'rect' || type === 'rough-rect') {
      const { cornerRadius } = attributes as RectSerializedNode;
      const resolvedCr = resolveDesignVariableValue(
        cornerRadius,
        designVariables,
        themeMode,
      );
      const crNum = (() => {
        if (resolvedCr === undefined || resolvedCr === null) {
          return undefined;
        }
        const n =
          typeof resolvedCr === 'number'
            ? resolvedCr
            : parseFloat(String(resolvedCr));
        return Number.isFinite(n) ? Math.max(0, n) : undefined;
      })();
      entityCommands.insert(
        new Rect({
          x: 0,
          y: 0,
          width: absoluteWidth,
          height: absoluteHeight,
          cornerRadius: crNum ?? 0,
        }),
      );
      if (type === 'rough-rect') {
        serializeRough(attributes as RoughAttributes, entityCommands);
      }
    } else if (type === 'polyline' || type === 'rough-polyline') {
      const { points, hitStrokeWidth } = attributes as PolylineSerializedNode;
      entityCommands.insert(
        new Polyline({
          points: deserializePoints(points),
          ...(hitStrokeWidth != null && hitStrokeWidth >= 0
            ? { hitStrokeWidth }
            : {}),
        }),
      );
      if (type === 'rough-polyline') {
        serializeRough(attributes as RoughAttributes, entityCommands);
      }
    } else if (type === 'line' || type === 'rough-line') {
      const { x1, y1, x2, y2, hitStrokeWidth } = attributes as LineSerializedNode;
      entityCommands.insert(
        new Line({
          x1,
          y1,
          x2,
          y2,
          ...(hitStrokeWidth != null && hitStrokeWidth >= 0
            ? { hitStrokeWidth }
            : {}),
        }),
      );
      if (type === 'rough-line') {
        serializeRough(attributes as RoughAttributes, entityCommands);
      }
    } else if (type === 'brush') {
      const {
        points,
        brushType,
        brushStamp,
        stampInterval,
        stampMode,
        stampNoiseFactor,
        stampRotationFactor,
      } = attributes as BrushSerializedNode;
      entityCommands.insert(
        new Brush({
          points: deserializeBrushPoints(points),
          type: brushType,
          stampInterval,
          stampMode,
          stampNoiseFactor,
          stampRotationFactor,
        }),
      );

      if (brushStamp) {
        loadImage(brushStamp, entityCommands.id());
      }
    } else if (type === 'path' || type === 'rough-path') {
      const { d, fillRule, tessellationMethod, hitStrokeWidth } =
        attributes as PathSerializedNode;
      entityCommands.insert(
        new Path({
          d,
          fillRule,
          tessellationMethod,
          ...(hitStrokeWidth != null && hitStrokeWidth >= 0
            ? { hitStrokeWidth }
            : {}),
        }),
      );
      if (type === 'rough-path') {
        serializeRough(attributes as RoughAttributes, entityCommands);
      }
    } else if (type === 'text') {
      const {
        anchorX,
        anchorY,
        content,
        fontFamily,
        fontSize,
        fontWeight = 'normal',
        fontStyle = 'normal',
        fontVariant = 'normal',
        fontKerning = true,
        letterSpacing = 0,
        lineHeight = 0,
        whiteSpace = 'normal',
        wordWrap = false,
        wordWrapWidth,
        maxLines,
        textAlign = 'start',
        textBaseline = 'alphabetic',
        decorationThickness = 0,
        decorationColor = 'black',
        decorationLine = 'none',
        decorationStyle = 'solid',
        // fontBoundingBoxAscent = 0,
        // fontBoundingBoxDescent = 0,
        // hangingBaseline = 0,
        // ideographicBaseline = 0,
        edgeLabelPosition,
        edgeLabelOffset,
      } = attributes as TextSerializedNode;

      const resolvedFontSize = resolveDesignVariableValue(
        fontSize,
        designVariables,
        themeMode,
      );
      const resolvedDecorationColor = resolveDesignVariableValue(
        decorationColor,
        designVariables,
        themeMode,
      );

      // let anchorX = 0;
      // let anchorY = 0;
      // if (textAlign === 'center') {
      //   anchorX = width / 2;
      // } else if (textAlign === 'right' || textAlign === 'end') {
      //   anchorX = width;
      // }

      // if (textBaseline === 'middle') {
      //   anchorY = height / 2;
      // } else if (textBaseline === 'alphabetic' || textBaseline === 'hanging') {
      //   anchorY = height;
      // }

      const bitmapFonts = fonts.map((font) => font.read(Font).bitmapFont);
      const bitmapFont = bitmapFonts.find(
        (font) => font.fontFamily === fontFamily,
      );

      entityCommands.insert(
        new Text({
          anchorX,
          anchorY,
          content,
          fontFamily,
          fontSize:
            typeof resolvedFontSize === 'number'
              ? resolvedFontSize
              : Number(resolvedFontSize),
          fontSizeVariableRef: designVariableRefKeyFromWire(fontSize),
          fontWeight,
          fontStyle,
          fontVariant,
          fontKerning,
          letterSpacing,
          lineHeight,
          whiteSpace,
          wordWrap,
          wordWrapWidth,
          maxLines,
          textAlign,
          textBaseline,
          bitmapFont,
        }),
      );

      if (decorationLine !== 'none' && decorationThickness > 0) {
        entityCommands.insert(
          new TextDecoration({
            color: resolvedDecorationColor,
            line: decorationLine,
            style: decorationStyle,
            thickness: decorationThickness,
          }),
        );
      }

      if (
        edgeLabelPosition != null &&
        !Number.isNaN(edgeLabelPosition)
      ) {
        entityCommands.insert(
          new EdgeLabel({
            labelPosition: edgeLabelPosition,
            labelOffset: edgeLabelOffset ?? 0,
          }),
        );
      }
    } else if (type === 'vector-network') {
      const { vertices, segments, regions } =
        attributes as VectorNetworkSerializedNode;
      entityCommands.insert(new VectorNetwork({ vertices, segments, regions }));
    } else if (type === 'html') {
      const { html } = attributes as HtmlSerializedNode;
      entityCommands.insert(new HTML({ x: 0, y: 0, width: absoluteWidth, height: absoluteHeight, html }));
      entityCommands.insert(new HTMLContainer());
    } else if (type === 'embed') {
      const { url } = attributes as EmbedSerializedNode;
      entityCommands.insert(new Embed({ x: 0, y: 0, width: absoluteWidth, height: absoluteHeight, url }));
      entityCommands.insert(new HTMLContainer());
    } else if (type === 'iconfont') {
      const {
        iconFontName = '',
        iconFontFamily = 'lucide',
      } = attributes as IconFontSerializedNode;
      const rName = resolveDesignVariableValue(
        iconFontName,
        designVariables,
        themeMode,
      );
      const rFamily = resolveDesignVariableValue(
        iconFontFamily,
        designVariables,
        themeMode,
      );

      const iconAttrs = wireMergedAttrs as IconFontSerializedNode;
      const groupPres = buildGroupWirePresentation(
        iconAttrs,
        designVariables,
        themeMode,
      );
      const { userColorStroke, userColorFill, rSw } = resolveIconFontWireStyle(
        iconAttrs,
        designVariables,
        themeMode,
        groupPres,
      );

      const prims = buildIconFontScalablePrimitives(
        String(rName ?? iconFontName ?? ''),
        String(rFamily ?? iconFontFamily ?? 'lucide'),
        absoluteWidth,
        absoluteHeight,
      );
      if (prims && prims.length > 0) {
        entityCommands.insert(new Group(groupPres));
        skipParentFillStroke = true;
        const v = (attributes as VisibilityAttributes).visibility;
        const filterWire = (wireMergedAttrs as FilterAttributes).filter;
        const resolvedFilterForPrim =
          filterWire != null && `${filterWire}`.trim() !== ''
            ? resolveDesignVariableValue(
                filterWire,
                designVariables,
                themeMode,
              )
            : undefined;
        const strokeAsPlaceholderFillForRasterFilter =
          typeof resolvedFilterForPrim === 'string' &&
          hasRasterPostEffects(resolvedFilterForPrim);

        for (let i = 0; i < prims.length; i++) {
          const prim = prims[i]!;
          const ch = commands.spawn();
          insertIconFontChildFromPrimitive(ch, prim, {
            userColorStroke,
            userColorFill,
            rSw,
            zIndex: attributes.zIndex != null ? attributes.zIndex! : 0,
            visibility: (v as 'inherited' | 'hidden' | 'visible' | undefined) ?? 'inherited',
            name: `${id}__i${i}`,
            strokeAsPlaceholderFillForRasterFilter,
          });
          entityCommands.appendChild(ch);
          iconfontChildCommands.push(ch);
        }
      } else {
        entityCommands.insert(
          new Rect({
            x: 0,
            y: 0,
            width: absoluteWidth,
            height: absoluteHeight,
            cornerRadius: 0,
          }),
        );
        const fattrs = wireMergedAttrs as FillAttributes & StrokeAttributes;
        if (fattrs.stroke == null && fattrs.fill != null) {
          fattrs.stroke = fattrs.fill;
        }
        if (fattrs.strokeWidth == null) {
          fattrs.strokeWidth = 2;
        }
        fattrs.fill = 'none';
      }
      entityCommands.insert(
        new IconFont({
          iconFontName: String(rName ?? iconFontName ?? ''),
          iconFontFamily: String(rFamily ?? iconFontFamily ?? 'lucide'),
          layoutWidth: absoluteWidth > 0 ? absoluteWidth : 0,
          layoutHeight: absoluteHeight > 0 ? absoluteHeight : 0,
        }),
      );
    }

    if (attributes.clipMode) {
      entityCommands.insert(new ClipMode(attributes.clipMode));
    }

    const { fill, fillOpacity, opacity } = wireMergedAttrs as FillAttributes;
    const resolvedFill = resolveDesignVariableValue(
      fill,
      designVariables,
      themeMode,
    );
    if (resolvedFill && !skipParentFillStroke) {
      if (isGradient(resolvedFill)) {
        entityCommands.insert(new FillGradient(resolvedFill));
      } else if (isDataUrl(resolvedFill) || isUrl(resolvedFill)) {
        loadImage(resolvedFill, entityCommands.id());
      } else {
        try {
          const parsed = JSON.parse(resolvedFill as string) as FillPattern;
          if (isPattern(parsed)) {
            entityCommands.insert(new FillPattern(parsed));
          }
        } catch (e) {
          entityCommands.insert(
            new FillSolid(
              resolvedFill as string,
              designVariableRefKeyFromWire(fill),
            ),
          );
        }
      }
    }

    const {
      stroke,
      strokeWidth,
      strokeDasharray,
      strokeLinecap,
      strokeLinejoin,
      strokeMiterlimit,
      strokeOpacity,
      strokeDashoffset,
      strokeAlignment,
    } = wireMergedAttrs as StrokeAttributes;
    const resolvedStroke = resolveDesignVariableValue(
      stroke,
      designVariables,
      themeMode,
    );
    const resolvedStrokeWidth = resolveDesignVariableValue(
      strokeWidth,
      designVariables,
      themeMode,
    );
    if (resolvedStroke && !skipParentFillStroke) {
      const rawW =
        resolvedStrokeWidth !== undefined ? resolvedStrokeWidth : strokeWidth;
      const widthInit =
        rawW !== undefined && rawW !== null
          ? {
            width: typeof rawW === 'number' ? rawW : Number(rawW),
          }
          : {};
      const dashPair =
        strokeDasharray === 'none'
          ? ([0, 0] as [number, number])
          : (((strokeDasharray?.includes(',')
            ? strokeDasharray?.split(',')
            : strokeDasharray?.split(' ')
          )?.map(Number) ?? [0, 0]) as [number, number]);
      const strokeCommon = {
        ...widthInit,
        colorVariableRef: designVariableRefKeyFromWire(stroke),
        widthVariableRef: designVariableRefKeyFromWire(strokeWidth),
        dasharray: dashPair,
        linecap: strokeLinecap,
        linejoin: strokeLinejoin,
        miterlimit: strokeMiterlimit,
        dashoffset: strokeDashoffset,
        alignment: strokeAlignment,
      };
      if (isGradient(resolvedStroke as string)) {
        entityCommands.insert(
          new Stroke({
            color: 'none',
            ...strokeCommon,
          }),
        );
        entityCommands.insert(
          new StrokeGradient(resolvedStroke as string),
        );
      } else {
        entityCommands.insert(
          new Stroke({
            color: resolvedStroke,
            ...strokeCommon,
          }),
        );
      }
    }

    const { markerStart, markerEnd, markerFactor } =
      attributes as MarkerAttributes;
    if (markerStart || markerEnd) {
      entityCommands.insert(
        new Marker({
          start: markerStart,
          end: markerEnd,
          factor: markerFactor,
        }),
      );
    }

    if (opacity || fillOpacity || strokeOpacity) {
      const rfo = resolveDesignVariableValue(
        fillOpacity,
        designVariables,
        themeMode,
      );
      const rso = resolveDesignVariableValue(
        strokeOpacity,
        designVariables,
        themeMode,
      );
      const to01 = (v: unknown): number => {
        if (v === undefined || v === null) {
          return 1;
        }
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
      };
      entityCommands.insert(
        new Opacity({
          opacity,
          fillOpacity: to01(rfo),
          strokeOpacity: to01(rso),
        }),
      );
    }

    const {
      dropShadowBlurRadius,
      dropShadowColor,
      dropShadowOffsetX,
      dropShadowOffsetY,
    } = attributes as DropShadowAttributes;
    if (dropShadowBlurRadius) {
      entityCommands.insert(
        new DropShadow({
          color: resolveDesignVariableValue(
            dropShadowColor,
            designVariables,
            themeMode,
          ),
          blurRadius: dropShadowBlurRadius,
          offsetX: dropShadowOffsetX,
          offsetY: dropShadowOffsetY,
        }),
      );
    }

    const {
      innerShadowBlurRadius,
      innerShadowColor,
      innerShadowOffsetX,
      innerShadowOffsetY,
    } = attributes as InnerShadowAttributes;
    if (innerShadowBlurRadius) {
      entityCommands.insert(
        new InnerShadow({
          color: resolveDesignVariableValue(
            innerShadowColor,
            designVariables,
            themeMode,
          ),
          blurRadius: innerShadowBlurRadius,
          offsetX: innerShadowOffsetX,
          offsetY: innerShadowOffsetY,
        }),
      );
    }

    const { visibility } = attributes as VisibilityAttributes;
    entityCommands.insert(new Visibility(visibility));

    const { name } = attributes as NameAttributes;
    entityCommands.insert(new Name(name));

    const { lockAspectRatio } = attributes;
    if (lockAspectRatio) {
      entityCommands.insert(new LockAspectRatio());
    }

    const { zIndex } = attributes;
    entityCommands.insert(new ZIndex(zIndex ?? 0));

    const { sizeAttenuation, strokeAttenuation } =
      attributes as AttenuationAttributes;
    if (sizeAttenuation) {
      entityCommands.insert(new SizeAttenuation());
    }
    if (strokeAttenuation) {
      entityCommands.insert(new StrokeAttenuation());
    }

    const { wireframe } = attributes as WireframeAttributes;
    if (wireframe) {
      entityCommands.insert(new Wireframe(true));
    }

    const { locked } = attributes;
    if (locked) {
      entityCommands.insert(new Locked());
    }

    const { filter } = attributes as FilterAttributes;
    if (filter) {
      entityCommands.insert(new Filter({ value: filter }));
      entityCommands.insert(new MaterialDirty());
      if (type === 'iconfont' || (type as string) === 'icon_font') {
        for (const ch of iconfontChildCommands) {
          ch.insert(new MaterialDirty());
        }
      }
    }

    const { display } = attributes as FlexboxLayoutAttributes;
    if (display === 'flex') {
      entityCommands.insert(new Flex());
    }

    if (parentId) {
      idEntityMap.get(parentId)?.appendChild(entityCommands);
    }

    entities.push(entityCommands.id().hold());
  }

  return { entities, idEntityMap };
}
