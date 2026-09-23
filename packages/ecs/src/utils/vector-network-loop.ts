import type { VectorSegmentLike } from './vector-network-stroke';

/** Direction belongs to an occurrence in a walk, not to the stored segment. */
export interface OrientedVectorSegment {
  segmentIndex: number;
  from: number;
  to: number;
  reversed: boolean;
}

/**
 * Resolve an ordered index loop without inventing connections between edges.
 * Try both directions of the first edge: its stored direction need not match
 * the boundary traversal. Self-loops and two-edge curved lenses are valid.
 */
export function orientVectorLoop(
  segments: ReadonlyArray<VectorSegmentLike>,
  loop: ReadonlyArray<number>,
): OrientedVectorSegment[] | null {
  if (!loop.length || loop.some((i) => !Number.isInteger(i) || !segments[i])) {
    return null;
  }
  const first = segments[loop[0]];
  for (const reverseFirst of [false, true]) {
    const start = reverseFirst ? first.end : first.start;
    let current = start;
    const walk: OrientedVectorSegment[] = [];
    for (let i = 0; i < loop.length; i++) {
      const segmentIndex = loop[i];
      const segment = segments[segmentIndex];
      const reversed = i === 0 ? reverseFirst : segment.start !== current;
      const from = reversed ? segment.end : segment.start;
      const to = reversed ? segment.start : segment.end;
      if (from !== current) {
        break;
      }
      walk.push({ segmentIndex, from, to, reversed });
      current = to;
    }
    if (walk.length === loop.length && current === start) {
      return walk;
    }
  }
  return null;
}
