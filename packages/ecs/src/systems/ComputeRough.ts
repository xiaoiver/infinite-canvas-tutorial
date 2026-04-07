import { Entity, System } from '@lastolivegames/becsy';
import { Drawable } from 'roughjs/bin/core';
import {
  Canvas,
  Circle,
  ComputedPoints,
  ComputedRough,
  Ellipse,
  FillSolid,
  FractionalIndex,
  getRoughOptions,
  Line,
  Path,
  Polyline,
  Rect,
  Rough,
  Stroke,
} from '../components';
import {
  deserializePoints,
  generator,
  parsePath,
  shiftPath,
} from '../utils';
import { getWatercolorFillContoursFromEntity } from '../utils/watercolor-rough';
import { safeAddComponent } from '../history';
import { SerializedNode } from '../types/serialized-node';

/**
 * 重算 {@link ComputedRough}（Rough 线段在仅 {@link Line} 端点变化时不会触发 `Rough` 的 changed）。
 * 供 {@link ElementsChange} 在写入 Line 后与渲染同帧同步，避免锚点已动而笔迹仍用旧几何。
 */
export function refreshComputedRoughForEntity(entity: Entity): void {
  if (!entity.has(Rough)) {
    return;
  }

  let drawable: Drawable;

  const rough = entity.read(Rough);
  const fillComponent = entity.has(FillSolid)
    ? entity.read(FillSolid)
    : { value: 'none' };
  const strokeComponent = entity.has(Stroke)
    ? entity.read(Stroke)
    : { color: 'none', width: 0, dasharray: [], dashoffset: 0 };
  const { color, width, dasharray, dashoffset } = strokeComponent;
  const { value: fill } = fillComponent;

  const roughOptions = getRoughOptions({
    // @ts-ignore
    fill,
    stroke: color,
    strokeWidth: width,
    strokeDasharray: [dasharray[0], dasharray[1]].join(','),
    strokeDashoffset: dashoffset,
    roughSeed: rough.seed,
    roughRoughness: rough.roughness,
    roughBowing: rough.bowing,
    roughFillStyle: rough.fillStyle,
    roughFillWeight: rough.fillWeight,
    roughHachureAngle: rough.hachureAngle,
    roughHachureGap: rough.hachureGap,
    roughCurveStepCount: rough.curveStepCount,
    roughCurveFitting: rough.curveFitting,
    roughFillLineDash: rough.fillLineDash,
    roughFillLineDashOffset: rough.fillLineDashOffset,
    roughDisableMultiStroke: rough.disableMultiStroke,
    roughDisableMultiStrokeFill: rough.disableMultiStrokeFill,
    roughSimplification: rough.simplification,
    roughDashOffset: rough.dashOffset,
    roughDashGap: rough.dashGap,
    roughZigzagOffset: rough.zigzagOffset,
  });

  if (entity.has(Circle)) {
    const { cx, cy, r } = entity.read(Circle);
    drawable = generator.circle(cx, cy, r * 2, roughOptions);
  } else if (entity.has(Ellipse)) {
    const { cx, cy, rx, ry } = entity.read(Ellipse);
    drawable = generator.ellipse(cx, cy, rx * 2, ry * 2, roughOptions);
  } else if (entity.has(Rect)) {
    const { x, y, width, height } = entity.read(Rect);
    drawable = generator.rectangle(x, y, width, height, roughOptions);
  } else if (entity.has(Line)) {
    const { x1, y1, x2, y2 } = entity.read(Line);
    drawable = generator.line(x1, y1, x2, y2, roughOptions);
  } else if (entity.has(Polyline)) {
    const { points } = entity.read(Polyline);
    drawable = generator.linearPath(points, roughOptions);
  } else if (entity.has(Path)) {
    const { d } = entity.read(Path);
    drawable = generator.path(d, roughOptions);
  } else {
    return;
  }

  const drawableSets = drawable.sets;
  let strokePoints: [number, number][][] = [];
  let fillPoints: [number, number][][] = [];
  let fillPathPoints: [number, number][][] = [];

  drawableSets.forEach((set) => {
    const { subPaths } = parsePath(set);
    const points = subPaths.map((subPath) =>
      subPath
        .getPoints()
        .map((point) => [point[0], point[1]] as [number, number]),
    );

    if (set.type === 'path') {
      strokePoints = points;
    } else if (set.type === 'fillPath') {
      fillPathPoints = points;
    } else if (set.type === 'fillSketch') {
      fillPoints = points;
    }
  });

  if (rough.fillStyle === 'watercolor') {
    const wc = getWatercolorFillContoursFromEntity(entity);
    if (wc) {
      fillPathPoints = wc;
      fillPoints = [];
    }
  }

  safeAddComponent(entity, ComputedRough, {
    drawableSets,
    strokePoints,
    fillPoints,
    fillPathPoints,
  });
}

export class ComputeRough extends System {
  roughs = this.query(
    (q) =>
      q.addedOrChanged
        .with(Rough)
        .and.withAny(Circle, Ellipse, Rect, Line, Polyline, Path, FillSolid, Stroke)
        .trackWrites,
  );

  constructor() {
    super();
    this.query((q) => q.current.with(ComputedRough).write);
    this.query((q) => q.using(Canvas, FractionalIndex, ComputedPoints).read);
  }

  execute() {
    this.roughs.addedOrChanged.forEach((entity) => {
      refreshComputedRoughForEntity(entity);
    });
  }
}

export function computeDrawableSets(node: SerializedNode) {
  let drawable: Drawable;

  const roughOptions = getRoughOptions(node);

  const { x, y, width, height, type } = node;
  if (type === 'ellipse' || type === 'rough-ellipse') {
    const { cx, cy, rx, ry } = node;
    drawable = generator.ellipse(cx - x, cy - y, rx * 2, ry * 2, roughOptions);
  } else if (type === 'rect' || type === 'rough-rect') {
    drawable = generator.rectangle(0, 0, width, height, roughOptions);
  } else if (type === 'line' || type === 'rough-line') {
    const { x1, y1, x2, y2 } = node;
    drawable = generator.line(x1 - x, y1 - y, x2 - x, y2 - y, roughOptions);
  } else if (type === 'polyline' || type === 'rough-polyline') {
    const { points } = node;
    drawable = generator.linearPath(deserializePoints(points), roughOptions);
  } else if (type === 'path' || type === 'rough-path') {
    const { d } = node;
    drawable = generator.path(shiftPath(d, -x, -y), roughOptions);
  }

  return drawable.sets;
}