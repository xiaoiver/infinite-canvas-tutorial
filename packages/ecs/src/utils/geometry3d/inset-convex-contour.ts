type Point = [number, number];

/**
 * Offset one counter-clockwise convex boundary toward its filled interior.
 * Returning undefined lets callers keep a sharp extrusion for holes, concave
 * outlines and offsets that would collapse the cap.
 */
export function insetConvexContour(
  contour: readonly Point[],
  distance: number,
): Point[] | undefined {
  // Keep the all-edges safety check bounded for very detailed imported SVGs.
  if (contour.length < 3 || contour.length > 2048 || !(distance > 0)) return;
  const edges = contour.map((a, i) => {
    const b = contour[(i + 1) % contour.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(length > 0)) return;
    const tangent: Point = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    return { tangent, inward: [-tangent[1], tangent[0]] as Point };
  });
  if (edges.some((edge) => !edge)) return;
  const validEdges = edges as { tangent: Point; inward: Point }[];
  const inset: Point[] = [];
  for (let i = 0; i < contour.length; i++) {
    const previous = validEdges[(i + contour.length - 1) % contour.length];
    const next = validEdges[i];
    const turn =
      previous.tangent[0] * next.tangent[1] -
      previous.tangent[1] * next.tangent[0];
    // This implementation handles convex exteriors only. A reflex corner or
    // a hole would require different topology after an inward offset.
    if (turn < -1e-7) return;
    const point = contour[i];
    let x: number;
    let y: number;
    if (turn <= 1e-7) {
      x = point[0] + next.inward[0] * distance;
      y = point[1] + next.inward[1] * distance;
    } else {
      const dx = (next.inward[0] - previous.inward[0]) * distance;
      const dy = (next.inward[1] - previous.inward[1]) * distance;
      const along = (dx * next.tangent[1] - dy * next.tangent[0]) / turn;
      x =
        point[0] + previous.inward[0] * distance + previous.tangent[0] * along;
      y =
        point[1] + previous.inward[1] * distance + previous.tangent[1] * along;
    }
    if (!Number.isFinite(Math.fround(x)) || !Number.isFinite(Math.fround(y)))
      return;
    inset.push([Math.fround(x), Math.fround(y)]);
  }

  const tolerance = Math.max(1e-5, distance * 1e-4);
  for (let i = 0; i < inset.length; i++) {
    const a = inset[i];
    const b = inset[(i + 1) % inset.length];
    const c = inset[(i + 2) % inset.length];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    if (ab <= tolerance || bc <= tolerance) return;
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross < -tolerance * ab * bc) return;
    for (let j = 0; j < contour.length; j++) {
      const original = contour[j];
      const normal = validEdges[j].inward;
      const insetDistance =
        (a[0] - original[0]) * normal[0] + (a[1] - original[1]) * normal[1];
      if (insetDistance < distance - tolerance) return;
    }
  }
  return inset;
}
