import {
  orientVectorLoop,
  type OrientedVectorSegment,
} from './vector-network-loop';
import { triangulate } from './tessy';
import {
  tessellateVectorSegment,
  type VectorSegmentLike,
  type VectorVertexLike,
} from './vector-network-stroke';

const EPS = 1e-6;

export interface VectorRegionLike {
  fillRule?: CanvasFillRule;
  /** Figma plugin API name; maps to {@link fillRule} when `fillRule` is omitted. */
  windingRule?: 'NONZERO' | 'EVENODD' | string;
  loops: ReadonlyArray<ReadonlyArray<number>>;
}

function resolveRegionFillRule(region: VectorRegionLike): CanvasFillRule {
  if (region.fillRule) {
    return region.fillRule;
  }
  const w = region.windingRule;
  if (w === 'EVENODD' || w === 'evenodd') {
    return 'evenodd';
  }
  return 'nonzero';
}

function closePointsEqual(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
}

function flatToPairs(flat: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) {
    out.push([flat[i], flat[i + 1]]);
  }
  return out;
}

/** Sample an explicitly directed boundary (also used by face detection). */
export function contourFromOrientedSegments(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
  walk: ReadonlyArray<OrientedVectorSegment>,
): [number, number][] {
  const out: [number, number][] = [];
  for (const { segmentIndex, from, to, reversed } of walk) {
    if (!vertices[from] || !vertices[to]) {
      return [];
    }
    const piece = flatToPairs(
      tessellateVectorSegment(vertices, segments[segmentIndex]),
    );
    if (reversed) {
      piece.reverse();
    }
    for (const pt of piece) {
      if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
        return [];
      }
      if (!out.length || !closePointsEqual(out[out.length - 1], pt)) {
        out.push(pt);
      }
    }
  }
  if (out.length >= 2 && closePointsEqual(out[0], out[out.length - 1])) {
    out.pop();
  }
  return out;
}

/** Closed contour from ordered segment indices; reject broken boundaries. */
export function contourFromSegmentLoop(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
  loop: ReadonlyArray<number>,
): [number, number][] {
  const walk = orientVectorLoop(segments, loop);
  return walk ? contourFromOrientedSegments(vertices, segments, walk) : [];
}

/**
 * Indexed mesh for VectorNetwork fill: `regions` → triangulation with the requested winding rule.
 */
export function buildVectorNetworkFillMesh(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
  regions: ReadonlyArray<VectorRegionLike> | undefined,
): { points: number[]; indices: number[] } {
  if (!regions?.length) {
    return { points: [], indices: [] };
  }

  const allPoints: number[] = [];
  const allIndices: number[] = [];
  let vOffset = 0;

  for (const region of regions) {
    const loops = region.loops ?? [];
    const contours: [number, number][][] = [];
    for (const loop of loops) {
      const c = contourFromSegmentLoop(vertices, segments, loop);
      if (c.length >= 3) {
        contours.push(c);
      }
    }
    if (contours.length === 0 || contours.length !== loops.length) {
      continue;
    }

    // Apply winding rules across all contours together. Grouping holes by
    // input order incorrectly joins disconnected islands and nested contours.
    const tri = triangulate(contours, resolveRegionFillRule(region));
    const nv = tri.length / 2;
    allPoints.push(...tri);
    for (let i = 0; i < nv; i++) {
      allIndices.push(vOffset + i);
    }
    vOffset += nv;
  }

  return { points: allPoints, indices: allIndices };
}
