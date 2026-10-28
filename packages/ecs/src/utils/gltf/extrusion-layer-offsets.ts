import Rbush from 'rbush';
import type { GlbMeshSource } from './export-glb';

type Bounds = {
  index: number;
  order: number;
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

/**
 * Give opaque, flat SVG layers distinct depths in exported GLBs. Node order
 * alone cannot resolve coplanar depth tests in independent glTF viewers.
 * The offset is export-only; the editor's meshes and transforms are untouched.
 */
export function extrusionLayerOffsets(
  sources: readonly GlbMeshSource[],
): ReadonlyMap<number, number> {
  if (
    sources.length < 2 ||
    sources.some(
      (source) =>
        source.painterOrder === undefined ||
        !Number.isFinite(source.painterOrder) ||
        source.material.alphaMode === 'blend' ||
        source.material.baseColor[3] < 1 ||
        Math.abs(source.transform.rotation[0]) > 1e-7 ||
        Math.abs(source.transform.rotation[1]) > 1e-7 ||
        source.transform.scale[2] <= 0,
    )
  )
    return new Map();

  const bounds: Bounds[] = [];
  for (const [index, source] of sources.entries()) {
    const positions = source.mesh.positions;
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
    const cosine = Math.cos(rotation[2]);
    const sine = Math.sin(rotation[2]);
    const corners = [
      [minX, minY],
      [minX, maxY],
      [maxX, minY],
      [maxX, maxY],
    ];
    const worldX = corners.map(
      ([x, y]) => translation[0] + cosine * scale[0] * x - sine * scale[1] * y,
    );
    const worldY = corners.map(
      ([x, y]) => translation[1] + sine * scale[0] * x + cosine * scale[1] * y,
    );
    const plane = translation[2] + minZ * scale[2];
    const depth = (maxZ - minZ) * scale[2];
    if (
      !Number.isFinite(plane) ||
      !(depth > 0) ||
      !worldX.every(Number.isFinite) ||
      !worldY.every(Number.isFinite)
    )
      return new Map();
    bounds.push({
      index,
      order: source.painterOrder!,
      minX: Math.min(...worldX),
      minY: Math.min(...worldY),
      maxX: Math.max(...worldX),
      maxY: Math.max(...worldY),
      plane,
      depth,
      layer: 0,
    });
  }

  // Only a single original surface plane is adjusted. Mixed elevations are
  // intentional 3D placement and must not be crossed by a paint-order offset.
  const plane = bounds[0].plane;
  if (bounds.some((item) => Math.abs(item.plane - plane) > 1e-6))
    return new Map();
  bounds.sort((a, b) => a.order - b.order || a.index - b.index);
  const earlierLayers = new Rbush<Bounds>();
  let maxLayer = 0;
  for (const item of bounds) {
    for (const earlier of earlierLayers.search(item)) {
      if (overlaps(item, earlier))
        item.layer = Math.max(item.layer, earlier.layer + 1);
    }
    earlierLayers.insert(item);
    maxLayer = Math.max(maxLayer, item.layer);
  }
  if (!maxLayer) return new Map();
  // Limit the entire staircase to 5% of the thinnest extrusion. This keeps
  // side walls visually close to the authored geometry even for many layers.
  const minDepth = bounds.reduce(
    (min, item) => Math.min(min, item.depth),
    Infinity,
  );
  const step = (minDepth * 0.05) / maxLayer;
  const offsets = new Map<number, number>();
  for (const item of bounds) {
    const offset = item.layer * step;
    if (offset) offsets.set(item.index, -offset);
  }
  return offsets;
}
