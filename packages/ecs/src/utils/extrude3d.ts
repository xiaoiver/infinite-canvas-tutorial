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

/** The side color replaces the fill color while retaining layer opacity. */
export function extrudeMaterialSideColorFromEntity(
  entity: Entity,
): [number, number, number, number] | null {
  const sideColor = entity.read(Extrude3D).sideColor;
  if (!sideColor) return null;
  const rgb = parseColor(sideColor);
  return [
    rgb.r / 255,
    rgb.g / 255,
    rgb.b / 255,
    rgb.opacity * getFirstFillLayerOpacityMul(entity),
  ];
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
    bevelSize:
      typeof options.bevelSize === 'number' &&
      Number.isFinite(options.bevelSize) &&
      Number.isFinite(Math.fround(options.bevelSize)) &&
      options.bevelSize > 0
        ? options.bevelSize
        : 0,
    bevelSegments:
      Number.isInteger(options.bevelSegments) &&
      options.bevelSegments! >= 1 &&
      options.bevelSegments! <= 8
        ? options.bevelSegments!
        : 1,
    sideColor: typeof options.sideColor === 'string' ? options.sideColor : null,
    z: Number.isFinite(options.z) ? options.z! : 0,
    rotation: (Array.isArray(options.rotation) &&
    options.rotation.length === 3 &&
    options.rotation.every(Number.isFinite)
      ? [...options.rotation]
      : [0, 0, 0]) as [number, number, number],
  };
}

export function extrude3DToWire(
  pose: Pick<Extrude3D, 'depth' | 'z' | 'rotation'> &
    Partial<Pick<Extrude3D, 'bevelSize' | 'bevelSegments'>>,
  previous?: Extrude3DAttributes['extrude3d'],
): Extrude3DAttributes['extrude3d'] {
  const sideColor =
    previous && typeof previous === 'object' ? previous.sideColor : undefined;
  const bevelSize =
    pose.bevelSize === undefined
      ? previous && typeof previous === 'object'
        ? previous.bevelSize
        : undefined
      : pose.bevelSize > 0
      ? pose.bevelSize
      : undefined;
  const bevelSegments =
    pose.bevelSegments === undefined
      ? previous && typeof previous === 'object'
        ? previous.bevelSegments
        : undefined
      : pose.bevelSegments > 1
      ? pose.bevelSegments
      : undefined;
  if (
    sideColor === undefined &&
    bevelSize === undefined &&
    bevelSegments === undefined &&
    pose.z === 0 &&
    pose.rotation.every((angle) => angle === 0)
  ) {
    return previous === true && pose.depth === DEFAULT_EXTRUDE_DEPTH
      ? true
      : pose.depth;
  }
  return {
    depth: pose.depth,
    z: pose.z,
    rotation: [...pose.rotation],
    ...(sideColor === undefined ? {} : { sideColor }),
    ...(bevelSize === undefined ? {} : { bevelSize }),
    ...(bevelSegments === undefined ? {} : { bevelSegments }),
  };
}
