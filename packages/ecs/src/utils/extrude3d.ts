import type { Entity } from '@lastolivegames/becsy';
import { Extrude3D, Mesh3D, Path, ToBeDeleted } from '../components';
import type { Extrude3DAttributes } from '../types/serialized-node';
import { parseColor } from './color';
import {
  getFirstFillLayerOpacityMul,
  getFirstSolidFillLayerValue,
} from './fillLayers';

const DEFAULT_EXTRUDE_DEPTH = 100;

/** Keep unsupported Paths visible until a valid 3D companion is ready. */
export function shouldSuppress2DShapeRender(entity: Entity): boolean {
  if (!entity.has(Extrude3D)) return false;
  if (!entity.has(Path)) return true;
  const companion = entity.read(Extrude3D).meshEntity;
  return (
    !!companion?.alive &&
    companion.has(Mesh3D) &&
    !companion.has(ToBeDeleted) &&
    companion.read(Mesh3D).positions.length > 0
  );
}

/** Maps the source's first solid fill to {@link Material3D.baseColor}. */
export function extrudeMaterialBaseColorFromEntity(
  entity: Entity,
): [number, number, number, number] {
  const solid = getFirstSolidFillLayerValue(entity);
  if (!solid) {
    return [0.25, 0.55, 0.95, 1];
  }
  const rgb = parseColor(solid);
  const opacity = getFirstFillLayerOpacityMul(entity);
  return [rgb.r / 255, rgb.g / 255, rgb.b / 255, (rgb.opacity ?? 1) * opacity];
}

export function resolveExtrude3DDepth(
  value: Extrude3DAttributes['extrude3d'],
): number | undefined {
  if (value === undefined || value === false) {
    return undefined;
  }
  if (value === true) {
    return DEFAULT_EXTRUDE_DEPTH;
  }
  if (value && typeof value === 'object') {
    const depth = value.depth;
    return typeof depth === 'number' && Number.isFinite(depth) && depth > 0
      ? depth
      : DEFAULT_EXTRUDE_DEPTH;
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  return DEFAULT_EXTRUDE_DEPTH;
}

/** Whole-value replacement: omitted pose fields reset to the load defaults. */
export function extrude3DFromWire(value: Extrude3DAttributes['extrude3d']) {
  const depth = resolveExtrude3DDepth(value);
  if (depth === undefined) return;
  const options = value && typeof value === 'object' ? value : {};
  return {
    depth,
    z: Number.isFinite(options.z) ? options.z! : 0,
    rotation: (Array.isArray(options.rotation) &&
    options.rotation.length === 3 &&
    options.rotation.every(Number.isFinite)
      ? [...options.rotation]
      : [0, 0, 0]) as [number, number, number],
  };
}

export function extrude3DToWire(
  pose: Pick<Extrude3D, 'depth' | 'z' | 'rotation'>,
  previous?: Extrude3DAttributes['extrude3d'],
): Extrude3DAttributes['extrude3d'] {
  if (pose.z === 0 && pose.rotation.every((angle) => angle === 0)) {
    return previous === true && pose.depth === DEFAULT_EXTRUDE_DEPTH
      ? true
      : pose.depth;
  }
  return { depth: pose.depth, z: pose.z, rotation: [...pose.rotation] };
}
