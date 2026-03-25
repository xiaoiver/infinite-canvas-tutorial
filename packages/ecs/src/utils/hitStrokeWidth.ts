import type { Entity } from '@lastolivegames/becsy';
import { Line } from '../components/geometry/Line';
import { Path } from '../components/geometry/Path';
import { Polyline } from '../components/geometry/Polyline';
import type { Stroke } from '../components/renderable/Stroke';

/**
 * Effective stroke width for hit-testing (Konva-style `hitStrokeWidth`).
 * When `hitOverride` is unset or negative, returns `visualWidth`.
 * Otherwise returns at least `visualWidth` so the pick region never shrinks below the painted stroke.
 */
export function resolveHitStrokeWidth(
  visualWidth: number,
  hitOverride?: number,
): number {
  if (
    hitOverride == null ||
    !Number.isFinite(hitOverride) ||
    hitOverride < 0
  ) {
    return visualWidth;
  }
  return Math.max(visualWidth, hitOverride);
}

/** Per-entity override stored on Line / Polyline / Path; `-1` means use stroke width only. */
export function readHitStrokeWidthField(entity: Entity): number {
  if (entity.has(Line)) {
    return entity.read(Line).hitStrokeWidth;
  }
  if (entity.has(Polyline)) {
    return entity.read(Polyline).hitStrokeWidth;
  }
  if (entity.has(Path)) {
    return entity.read(Path).hitStrokeWidth;
  }
  return -1;
}

export function strokeWidthForHitTest(
  entity: Entity,
  stroke: { width: number } | undefined,
): number {
  if (!stroke) {
    return 0;
  }
  const field = readHitStrokeWidthField(entity);
  const override = field >= 0 ? field : undefined;
  return resolveHitStrokeWidth(stroke.width, override);
}

/**
 * Becsy `Stroke` 组件字段不在普通可枚举属性上，`Object.assign({}, stroke)` 会得到空对象，
 * 进而把 `undefined` 传给 WASM（如 `computePathBounds`），触发 serde 报错。
 * 这里按字段拷贝为普通对象，并写入用于命中/R-Bush 的线宽。
 */
export function cloneStrokeWithHitTestWidth(
  entity: Entity,
  stroke: Stroke,
): Stroke {
  return {
    color: stroke.color,
    width: strokeWidthForHitTest(entity, stroke),
    linecap: stroke.linecap,
    linejoin: stroke.linejoin,
    miterlimit: stroke.miterlimit,
    alignment: stroke.alignment,
    dasharray: stroke.dasharray,
    dashoffset: stroke.dashoffset,
  } as Stroke;
}
