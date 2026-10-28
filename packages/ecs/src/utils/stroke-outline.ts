import ClipperLib from 'clipper-lib';
import { flattenPath } from './curve/adaptive';
import { parsePath } from './curve/shape-path';

const SCALE = 1000;

/** Resolve a solid SVG stroke into filled contours that the Path extruder accepts. */
export function strokeOutline(
  d: string,
  width: number,
  linecap: CanvasLineCap = 'butt',
  linejoin: CanvasLineJoin = 'miter',
  miterlimit = 4,
): string {
  if (!Number.isFinite(width) || width <= 0) return '';
  const { subPaths } = parsePath(d);
  const contours = flattenPath(subPaths, 4, width / 2);
  const offset = new ClipperLib.ClipperOffset(
    Math.max(2, Number.isFinite(miterlimit) ? miterlimit : 4),
    SCALE / 8,
  );
  for (let index = 0; index < subPaths.length; index++) {
    const points = contours[index];
    if (points.length < 2) continue;
    const first = points[0];
    const last = points[points.length - 1];
    const closed = subPaths[index].autoClose ||
      Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-5;
    const path = points.map(([x, y]) => ({
      X: Math.round(x * SCALE), Y: Math.round(y * SCALE),
    }));
    if (closed && path.length > 2 &&
      path[0].X === path[path.length - 1].X &&
      path[0].Y === path[path.length - 1].Y) path.pop();
    offset.AddPath(
      path,
      linejoin === 'round' ? ClipperLib.JoinType.jtRound
        : linejoin === 'bevel' ? ClipperLib.JoinType.jtSquare
        : ClipperLib.JoinType.jtMiter,
      closed ? ClipperLib.EndType.etClosedLine
        : linecap === 'round' ? ClipperLib.EndType.etOpenRound
        : linecap === 'square' ? ClipperLib.EndType.etOpenSquare
        : ClipperLib.EndType.etOpenButt,
    );
  }
  const result: ClipperLib.Paths = [];
  offset.Execute(result, (width * SCALE) / 2);
  return result.map((path) => path.length < 3 ? ''
    : `M${path.map(({ X, Y }) => `${X / SCALE} ${Y / SCALE}`).join('L')}Z`).join('');
}
