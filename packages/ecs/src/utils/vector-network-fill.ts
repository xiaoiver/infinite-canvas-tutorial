import earcut from 'earcut';
import { isClockWise } from './curve/shape-path';
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

function tessellateOrientedFill(
  vertices: VectorVertexLike[],
  seg: VectorSegmentLike,
  from: number,
  to: number,
): [number, number][] {
  const flat = tessellateVectorSegment(vertices, seg);
  if (flat.length === 0) {
    return [];
  }
  if (seg.start === from && seg.end === to) {
    return flatToPairs(flat);
  }
  if (seg.end === from && seg.start === to) {
    return flatToPairs(flat).reverse();
  }
  return [];
}

/**
 * Closed 2D contour from a Figma-style loop (ordered segment indices).
 */
export function contourFromSegmentLoop(
  vertices: VectorVertexLike[],
  segments: VectorSegmentLike[],
  loop: ReadonlyArray<number>,
): [number, number][] {
  if (loop.length === 0) {
    return [];
  }
  const out: [number, number][] = [];
  let prevVertexIdx = -1;

  for (let k = 0; k < loop.length; k++) {
    const segIdx = loop[k];
    if (segIdx < 0 || segIdx >= segments.length) {
      continue;
    }
    const seg = segments[segIdx];
    let from = seg.start;
    let to = seg.end;
    if (prevVertexIdx >= 0) {
      if (seg.start === prevVertexIdx) {
        from = seg.start;
        to = seg.end;
      } else if (seg.end === prevVertexIdx) {
        from = seg.end;
        to = seg.start;
      } else {
        from = seg.start;
        to = seg.end;
      }
    }

    const piece = tessellateOrientedFill(vertices, seg, from, to);
    for (const pt of piece) {
      if (out.length > 0 && closePointsEqual(out[out.length - 1], pt)) {
        continue;
      }
      out.push(pt);
    }
    prevVertexIdx = to;
  }

  if (out.length >= 2 && closePointsEqual(out[0], out[out.length - 1])) {
    out.pop();
  }
  return out;
}

/** Same earcut grouping as {@link Mesh} for Path nonzero fills. */
function earcutTriangulateContours(
  rawPoints: [number, number][][],
): { vertices: number[]; indices: number[] } {
  const flatAll = rawPoints.flat(2);
  if (flatAll.length === 0) {
    return { vertices: [], indices: [] };
  }

  let holes: number[] = [];
  let contours: [number, number][] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  let firstClockWise = isClockWise(rawPoints[0]);

  rawPoints.forEach((points) => {
    const isHole = isClockWise(points) !== firstClockWise;
    if (isHole) {
      holes.push(contours.length);
    } else {
      firstClockWise = isClockWise(points);

      if (holes.length > 0) {
        indices.push(
          ...earcut(contours.flat(), holes).map((i) => i + indexOffset),
        );
        indexOffset += contours.length;
        holes = [];
        contours = [];
      }
    }
    contours.push(...points);
  });

  if (contours.length) {
    indices.push(
      ...earcut(contours.flat(), holes).map((i) => i + indexOffset),
    );
  }

  return { vertices: flatAll, indices };
}

/**
 * Indexed mesh for VectorNetwork fill: `regions` → triangulation (nonzero / earcut, evenodd / libtess).
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
    if (contours.length === 0) {
      continue;
    }

    if (resolveRegionFillRule(region) === 'evenodd') {
      const tri = triangulate(contours, 'evenodd');
      const nv = tri.length / 2;
      for (let i = 0; i < tri.length; i++) {
        allPoints.push(tri[i]);
      }
      for (let i = 0; i < nv; i++) {
        allIndices.push(vOffset + i);
      }
      vOffset += nv;
    } else {
      const { vertices: flat, indices } = earcutTriangulateContours(contours);
      allPoints.push(...flat);
      for (const i of indices) {
        allIndices.push(i + vOffset);
      }
      vOffset += flat.length / 2;
    }
  }

  return { points: allPoints, indices: allIndices };
}
