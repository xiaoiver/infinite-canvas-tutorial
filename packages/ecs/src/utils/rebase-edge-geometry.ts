import { vec2 } from 'gl-matrix';
import type { API } from '../API';
import type {
  PathSerializedNode,
  PolylineSerializedNode,
  SerializedNode,
} from '../types/serialized-node';
import {
  Children,
  ComputedPoints,
  Group,
  Line,
  Path,
  Polyline,
} from '../components';
import { updateBounds } from '../systems/ComputeBounds';
import { updateComputedPoints } from '../systems/ComputePoints';
import { updateGlobalTransform } from '../systems/Transform';
import { deserializePoints } from './deserialize';
import { serializePoints } from './serialize/points';
import { shiftPath } from './serialize/transform';

const EPS = 1e-6;

/**
 * 将 Polyline / Path / Line 的局部几何包围盒移回以 (0,0) 为 min，并平移 node.x/y，
 * 使实体原点与 `fitSelected` / `selectionOBB` 的 Konva 盒一致。
 * 否则编辑锚点后局部 min≠(0,0) 时，`getTransform(oldNode)` 与 `selection.obb` 不一致会导致锚点与笔迹错位。
 */
export function rebasePolylinePathGeometryToLocalOrigin(
  api: API,
  node: SerializedNode,
): void {
  const t = node.type;
  if (
    t !== 'polyline' &&
    t !== 'rough-polyline' &&
    t !== 'path' &&
    t !== 'rough-path' &&
    t !== 'line' &&
    t !== 'rough-line'
  ) {
    return;
  }

  const entity = api.getEntity(node);
  if (!entity) {
    return;
  }

  /**
   * Polyline 的 ComputedBounds.geometryBounds 用 shiftedPoints（描边对齐），
   * 与 Polyline.points 控制点不在同一套坐标；必须用原始点算 min，否则 rebase 后锚点与框错位。
   */
  let minX: number;
  let minY: number;
  let maxX: number;
  let maxY: number;
  if (entity.has(Polyline)) {
    const b = Polyline.getGeometryBounds({
      points: entity.read(Polyline).points,
    });
    minX = b.minX;
    minY = b.minY;
    maxX = b.maxX;
    maxY = b.maxY;
  } else if (entity.has(Path)) {
    const computed = entity.has(ComputedPoints)
      ? entity.read(ComputedPoints)
      : undefined;
    const b = Path.getGeometryBounds(entity.read(Path), computed);
    minX = b.minX;
    minY = b.minY;
    maxX = b.maxX;
    maxY = b.maxY;
  } else if (entity.has(Line)) {
    const { x1, y1, x2, y2 } = entity.read(Line);
    const b = Line.getGeometryBounds({ x1, y1, x2, y2 });
    minX = b.minX;
    minY = b.minY;
    maxX = b.maxX;
    maxY = b.maxY;
  } else {
    return;
  }
  if (
    (Math.abs(minX) < EPS && Math.abs(minY) < EPS) ||
    !Number.isFinite(minX + minY + maxX + maxY)
  ) {
    return;
  }

  const m = api.getTransform(entity);
  const w0 = vec2.transformMat3(vec2.create(), [0, 0], m);
  const wMin = vec2.transformMat3(vec2.create(), [minX, minY], m);
  const dx = wMin[0] - w0[0];
  const dy = wMin[1] - w0[1];

  const fresh = api.getNodeById(node.id) ?? node;
  const nx = (fresh.x ?? 0) + dx;
  const ny = (fresh.y ?? 0) + dy;
  const w = maxX - minX;
  const h = maxY - minY;

  if (entity.has(Polyline)) {
    const pts = deserializePoints(
      (fresh as PolylineSerializedNode).points,
    ).map(
      (p) => [p[0] - minX, p[1] - minY] as [number, number],
    );
    api.updateNode(fresh, {
      x: nx,
      y: ny,
      width: w,
      height: h,
      points: serializePoints(pts),
    });
  } else if (entity.has(Path)) {
    const d = shiftPath((fresh as PathSerializedNode).d, -minX, -minY);
    api.updateNode(fresh, {
      x: nx,
      y: ny,
      width: w,
      height: h,
      d,
    });
  } else if (entity.has(Line)) {
    const { x1, y1, x2, y2 } = entity.read(Line);
    api.updateNode(fresh, {
      x: nx,
      y: ny,
      width: w,
      height: h,
      x1: x1 - minX,
      y1: y1 - minY,
      x2: x2 - minX,
      y2: y2 - minY,
    });
  }

  const synced = api.getEntity(api.getNodeById(node.id) ?? fresh);
  if (synced) {
    updateGlobalTransform(synced);
    updateComputedPoints(synced);
    /**
     * `ComputeBounds` 在调度上早于 `Select`；rebase 后若不同步刷新 `ComputedBounds`，
     * `getOBB` 仍用旧的 `selectionOBB`（局部 min 已变时尤其明显：移动「左上角」锚点后框与笔迹错位）。
     */
    updateBounds(synced);
    let ancestor: typeof synced | undefined = synced;
    while (ancestor?.has(Children)) {
      const parent = ancestor.read(Children).parent;
      if (!parent?.has(Group)) {
        break;
      }
      updateBounds(parent);
      ancestor = parent;
    }
  }
}
