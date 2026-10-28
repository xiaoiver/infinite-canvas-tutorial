import { mat4 } from 'gl-matrix';
import Rbush from 'rbush';
import type { GlbMeshSource } from './export-glb';

type Bounds = {
  index: number;
  order?: number;
  eligible: boolean;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  plane: number;
  depth: number;
  layer: number;
};

const overlaps = (a: Bounds, b: Bounds) =>
  a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

function sourceBounds(
  source: GlbMeshSource,
  index: number,
): Bounds | undefined {
  const { positions } = source.mesh;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    minZ = Math.min(minZ, positions[i + 2]);
    maxX = Math.max(maxX, positions[i]);
    maxY = Math.max(maxY, positions[i + 1]);
    maxZ = Math.max(maxZ, positions[i + 2]);
  }
  const { translation, rotation, scale } = source.transform;
  const matrix = mat4.create();
  mat4.translate(matrix, matrix, translation);
  mat4.rotateX(matrix, matrix, rotation[0]);
  mat4.rotateY(matrix, matrix, rotation[1]);
  mat4.rotateZ(matrix, matrix, rotation[2]);
  mat4.scale(matrix, matrix, scale);
  let worldMinX = Infinity;
  let worldMinY = Infinity;
  let worldMaxX = -Infinity;
  let worldMaxY = -Infinity;
  for (const x of [minX, maxX]) {
    for (const y of [minY, maxY]) {
      for (const z of [minZ, maxZ]) {
        const worldX =
          matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
        const worldY =
          matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
        worldMinX = Math.min(worldMinX, worldX);
        worldMinY = Math.min(worldMinY, worldY);
        worldMaxX = Math.max(worldMaxX, worldX);
        worldMaxY = Math.max(worldMaxY, worldY);
      }
    }
  }
  const plane = translation[2] + minZ * scale[2];
  const depth = (maxZ - minZ) * scale[2];
  if (
    ![worldMinX, worldMinY, worldMaxX, worldMaxY, plane, depth].every(
      Number.isFinite,
    )
  )
    return;
  const order = source.painterOrder;
  return {
    index,
    order,
    eligible:
      order !== undefined &&
      Number.isFinite(order) &&
      source.material.alphaMode !== 'blend' &&
      source.material.baseColor[3] >= 1 &&
      Math.abs(rotation[0]) <= 1e-7 &&
      Math.abs(rotation[1]) <= 1e-7 &&
      scale[2] > 0 &&
      depth > 0,
    minX: worldMinX,
    minY: worldMinY,
    maxX: worldMaxX,
    maxY: worldMaxY,
    plane,
    depth,
    layer: 0,
  };
}

/**
 * Separate overlapping, opaque SVG extrusion layers in exported GLBs.
 * Unrelated 3D objects do not disable an SVG stack; any object intersecting
 * that stack's XY bounds does, so authored 3D placement stays untouched.
 */
export function extrusionLayerOffsets(
  sources: readonly GlbMeshSource[],
): ReadonlyMap<number, number> {
  if (
    sources.filter(
      (source) =>
        source.painterOrder !== undefined &&
        Number.isFinite(source.painterOrder),
    ).length < 2
  )
    return new Map();
  const bounds: Bounds[] = [];
  for (const [index, source] of sources.entries()) {
    const item = sourceBounds(source, index);
    if (!item) return new Map();
    bounds.push(item);
  }
  const eligible = bounds.filter((item) => item.eligible);
  if (eligible.length < 2) return new Map();
  eligible.sort((a, b) => a.plane - b.plane);
  const planes: Bounds[][] = [];
  for (const item of eligible) {
    const last = planes[planes.length - 1];
    if (last && Math.abs(last[0].plane - item.plane) <= 1e-6) last.push(item);
    else planes.push([item]);
  }

  const all = new Rbush<Bounds>();
  all.load(bounds);
  const offsets = new Map<number, number>();
  for (const plane of planes) {
    if (plane.length < 2) continue;
    const samePlane = new Rbush<Bounds>();
    samePlane.load(plane);
    const seen = new Set<number>();
    for (const first of plane) {
      if (seen.has(first.index)) continue;
      const component: Bounds[] = [];
      const pending = [first];
      seen.add(first.index);
      while (pending.length) {
        const item = pending.pop()!;
        component.push(item);
        for (const neighbor of samePlane.search(item)) {
          if (!seen.has(neighbor.index) && overlaps(item, neighbor)) {
            seen.add(neighbor.index);
            pending.push(neighbor);
          }
        }
      }
      if (component.length < 2) continue;
      const members = new Set(component.map((item) => item.index));
      // A tilted, transparent, independently placed or differently elevated
      // mesh overlapping this region makes any automatic shift ambiguous.
      if (
        component.some((item) =>
          all
            .search(item)
            .some(
              (other) => !members.has(other.index) && overlaps(item, other),
            ),
        )
      )
        continue;

      component.sort((a, b) => a.order! - b.order! || a.index - b.index);
      const earlierLayers = new Rbush<Bounds>();
      let maxLayer = 0;
      for (const item of component) {
        for (const earlier of earlierLayers.search(item)) {
          if (overlaps(item, earlier))
            item.layer = Math.max(item.layer, earlier.layer + 1);
        }
        earlierLayers.insert(item);
        maxLayer = Math.max(maxLayer, item.layer);
      }
      if (!maxLayer) continue;
      // Limit this independent stack to 5% of its thinnest extrusion.
      const minDepth = component.reduce(
        (min, item) => Math.min(min, item.depth),
        Infinity,
      );
      const step = (minDepth * 0.05) / maxLayer;
      for (const item of component) {
        if (item.layer) offsets.set(item.index, -item.layer * step);
      }
    }
  }
  return offsets;
}
