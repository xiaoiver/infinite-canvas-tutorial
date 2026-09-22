import type { Entity } from '@lastolivegames/becsy';
import { Extrude3D } from '../components';
import type { Extrude3DAttributes } from '../types/serialized-node';
import { parseColor } from './color';
import {
  getFirstFillLayerOpacityMul,
  getFirstSolidFillLayerValue,
} from './fillLayers';

const DEFAULT_EXTRUDE_DEPTH = 100;

/** Spline-style: extruded rects skip 2D fill/stroke drawcalls; only the 3D mesh draws. */
export function shouldSuppress2DShapeRender(entity: Entity): boolean {
  return entity.has(Extrude3D);
}

/** Maps the host rect's first solid fill to {@link Material3D.baseColor}. */
export function extrudeMaterialBaseColorFromEntity(
  entity: Entity,
): [number, number, number, number] {
  const solid = getFirstSolidFillLayerValue(entity);
  if (!solid) {
    return [0.25, 0.55, 0.95, 1];
  }
  const rgb = parseColor(solid);
  const opacity = getFirstFillLayerOpacityMul(entity);
  return [
    rgb.r / 255,
    rgb.g / 255,
    rgb.b / 255,
    (rgb.opacity ?? 1) * opacity,
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
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  return DEFAULT_EXTRUDE_DEPTH;
}
