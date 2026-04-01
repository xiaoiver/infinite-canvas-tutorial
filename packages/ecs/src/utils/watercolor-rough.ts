import { vec2 } from 'gl-matrix';
import {
  convolution1D as conv1d,
  K_GAUSS_BLUR_5,
} from '@watercolorizer/convolution';
import { watercolorize } from '@watercolorizer/watercolorizer';
import { Entity } from '@lastolivegames/becsy';
import {
  Circle,
  ComputedPoints,
  Ellipse,
  Path,
  Rect,
  Rough,
} from '../components';
import type { FillAttributes, RoughAttributes, StrokeAttributes, SerializedNode } from '../types/serialized-node';
import { deserializePoints } from './deserialize/points';

const minmax = (list: number[]): [min: number, max: number] =>
  list.reduce<[number, number]>(
    ([min, max], i) => [Math.min(min, i), Math.max(max, i)],
    [Infinity, -Infinity],
  );

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Any point with [0]/[1] (vec2 from gl-matrix or tuples from geometry libs). */
type Point2 = vec2 | readonly [number, number];

export function randomWeights(
  points: readonly Point2[],
  floor: number = 0,
): number[] {
  const { length } = points;
  const initialWeights = Array.from({ length }, () => Math.random());

  const smoothed = conv1d(
    K_GAUSS_BLUR_5,
    initialWeights,
    Array.from<number>({ length }),
  );

  const [min, max] = minmax(smoothed);
  return smoothed
    .map((it) => (it - min) / (max - min))
    .map((it) => it * (1 - floor) + floor);
}

/**
 * Same pipeline as {@link randomWeights} (Gaussian-smoothed random weights) but
 * uses a seeded PRNG so ECS / SVG export stay reproducible for a given seed.
 */
export function seededRandomWeights(
  length: number,
  seed: number,
  floor = 0.1,
): number[] {
  if (length === 0) {
    return [];
  }
  const rand = mulberry32(seed >>> 0);
  const initialWeights = Array.from({ length }, () => rand());

  const smoothed = conv1d(
    K_GAUSS_BLUR_5,
    initialWeights,
    Array.from<number>({ length }),
  );

  const [min, max] = minmax(smoothed);
  const span = max - min;
  if (span <= 1e-12) {
    return Array.from({ length }, () => 1);
  }
  return smoothed
    .map((it) => (it - min) / span)
    .map((it) => it * (1 - floor) + floor);
}


/**
 * Matches the demo in `watercolor/App.vue`: moderate evolution counts so layers
 * stay closer to the source outline than the old defaults (evolutions: 5, …).
 */
const WATERCOLOR_OPTS_APP_LIKE = {
  preEvolutions: 4,
  evolutions: 2,
  layersPerEvolution: 4,
  layerEvolutions: 2,
} as const;

/** Axis-aligned rectangles: fewer layers + higher weight floor → less “balloon” bleed. */
const WATERCOLOR_OPTS_RECT = {
  preEvolutions: 3,
  evolutions: 2,
  layersPerEvolution: 3,
  layerEvolutions: 2,
} as const;

/** SVG export: per-layer alpha similar to the library README canvas example (~10%). */
export const WATERCOLOR_LAYER_FILL_OPACITY = 0.1;

function toSeed(seed?: number) {
  if (!seed || seed <= 0) {
    return 1;
  }
  return Math.floor(seed) >>> 0;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function getWatercolorOptions(
  polygon: [number, number][],
  seed: number | undefined,
  roughness: number,
  profile: 'default' | 'rect',
) {
  const roughScale = clamp(roughness, 0, 10) / 10;
  const s = toSeed(seed);
  const weightSeed = (s ^ 0x9e3779b9) >>> 0;

  // App.vue uses floor 0.1; slightly lower floor when roughness is high.
  const baseFloor = 0.05 + 0.1 * (1 - roughScale);
  const floor =
    profile === 'rect' ? Math.min(0.22, baseFloor + 0.06) : baseFloor;

  const vertexWeights = seededRandomWeights(polygon.length, weightSeed, floor);

  const baseOpts =
    profile === 'rect' ? WATERCOLOR_OPTS_RECT : WATERCOLOR_OPTS_APP_LIKE;

  return {
    ...baseOpts,
    vertexWeights,
  };
}

export function polygonToPathD(points: [number, number][]): string {
  if (points.length === 0) {
    return '';
  }
  const [x0, y0] = points[0];
  const rest = points.slice(1);
  return (
    `M ${x0} ${y0} ` +
    rest.map(([x, y]) => `L ${x} ${y}`).join(' ') +
    ' Z'
  );
}

function sampleEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  segments: number,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return pts;
}

/**
 * Subdivide an axis-aligned rectangle so watercolor has more vertices along each
 * edge (like high-$n$ regular polygons in App.vue), reducing midpoint bulge.
 */
function subdivideAxisAlignedRect(
  width: number,
  height: number,
  divisions: number,
): [number, number][] {
  const n = Math.max(2, Math.floor(divisions));
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    out.push([(width * i) / n, 0]);
  }
  for (let i = 1; i < n; i++) {
    out.push([width, (height * i) / n]);
  }
  for (let i = 1; i < n; i++) {
    out.push([(width * (n - i)) / n, height]);
  }
  for (let i = 1; i < n; i++) {
    out.push([0, (height * (n - i)) / n]);
  }
  return out;
}

function isSamePoint(
  a: [number, number],
  b: [number, number],
  epsilon = 1e-6,
) {
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon;
}

function normalizePolygon(
  points: [number, number][],
): [number, number][] {
  if (points.length === 0) {
    return points;
  }

  const deduped: [number, number][] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (!isSamePoint(points[i], deduped[deduped.length - 1])) {
      deduped.push(points[i]);
    }
  }

  if (
    deduped.length >= 2 &&
    isSamePoint(deduped[0], deduped[deduped.length - 1])
  ) {
    deduped.pop();
  }

  return deduped;
}

function contoursFromBasePolygon(
  base: [number, number][] | null,
  seed: number | undefined,
  roughness: number,
  profile: 'default' | 'rect',
): [number, number][][] {
  if (!base) {
    return [];
  }
  const polygon = normalizePolygon(base);
  if (polygon.length < 3) {
    return [];
  }

  const options = getWatercolorOptions(polygon, seed, roughness, profile);
  const contours: [number, number][][] = [];
  for (const layer of watercolorize(polygon, options)) {
    if (layer.length >= 3) {
      contours.push(layer.map(([x, y]) => [x, y] as [number, number]));
    }
  }
  return contours;
}

export function getWatercolorFillContoursFromEntity(
  entity: Entity,
): [number, number][][] | null {
  const rough = entity.read(Rough);
  if (rough.fillStyle !== 'watercolor') {
    return null;
  }

  let base: [number, number][] | null = null;
  let profile: 'default' | 'rect' = 'default';

  if (entity.has(Rect)) {
    const { width, height } = entity.read(Rect);
    const d = Math.max(4, Math.min(16, Math.round(Math.hypot(width, height) / 40)));
    base = subdivideAxisAlignedRect(width, height, d);
    profile = 'rect';
  } else if (entity.has(Circle)) {
    const { cx, cy, r } = entity.read(Circle);
    base = sampleEllipse(cx, cy, r, r, 36);
  } else if (entity.has(Ellipse)) {
    const { cx, cy, rx, ry } = entity.read(Ellipse);
    base = sampleEllipse(cx, cy, rx, ry, 40);
  } else if (entity.has(Path)) {
    const rawPoints = entity.read(ComputedPoints).points;
    if (rawPoints.length > 0) {
      base = rawPoints[0].map(([x, y]) => [x, y] as [number, number]);
    }
  }

  const contours = contoursFromBasePolygon(
    base,
    rough.seed,
    rough.roughness,
    profile,
  );
  return contours.length ? contours : null;
}

export function getWatercolorFillContoursFromSerializedNode(
  node: SerializedNode,
): [number, number][][] | null {
  const { roughFillStyle, roughSeed, roughRoughness } = node as RoughAttributes &
    StrokeAttributes &
    FillAttributes;
  if (roughFillStyle !== 'watercolor') {
    return null;
  }

  const { x, y, width, height, type } = node;
  let base: [number, number][] | null = null;
  let profile: 'default' | 'rect' = 'default';

  if (type === 'ellipse' || type === 'rough-ellipse') {
    const { cx, cy, rx, ry } = node;
    base = sampleEllipse(cx - x, cy - y, rx, ry, 40);
  } else if (type === 'rect' || type === 'rough-rect') {
    const d = Math.max(4, Math.min(16, Math.round(Math.hypot(width, height) / 40)));
    base = subdivideAxisAlignedRect(width, height, d);
    profile = 'rect';
  } else if (type === 'path' || type === 'rough-path') {
  } else if (type === 'polyline' || type === 'rough-polyline') {
    const { points } = node;
    if (!points) {
      return null;
    }
    const pts = deserializePoints(points);
    if (pts.length >= 3) {
      base = pts.map(([px, py]) => [px, py] as [number, number]);
    }
  }

  const contours = contoursFromBasePolygon(
    base,
    roughSeed,
    roughRoughness,
    profile,
  );
  return contours.length ? contours : null;
}
