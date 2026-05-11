import type { Entity } from '@lastolivegames/becsy';
import { StrokeLayers } from '../components/renderable/Fill';
import { StrokeGradient } from '../components/renderable/Stroke';
import {
  fillLayerOpacity,
  getEnabledFillLayersFromItems,
  isFillLayerEnabled,
  type FillLayerItem,
} from './fillLayers';

export type { FillLayerItem as StrokeLayerItem };

export function getEnabledStrokeLayersFromItems(
  layers: FillLayerItem[] | undefined,
): FillLayerItem[] {
  if (!layers?.length) {
    return [];
  }
  return layers.filter(isFillLayerEnabled);
}

export function getEnabledStrokeLayers(entity: Entity): FillLayerItem[] {
  if (!entity.has(StrokeLayers)) {
    return [];
  }
  return getEnabledStrokeLayersFromItems(entity.read(StrokeLayers).layers);
}

/**
 * 与 {@link fillLayerOpacity} 一致：单层 `strokes[].opacity` 乘到 GPU 描边 alpha。
 * 纯色走 `strokeColor.a`；渐变描边（{@link StrokeGradient}）走 `u_Opacity.z`。
 */
export function strokePaintAlphaMultipliers(entity: Entity): {
  strokeColorAlphaMul: number;
  strokeUniformOpacityMul: number;
} {
  if (!entity.has(StrokeLayers)) {
    return { strokeColorAlphaMul: 1, strokeUniformOpacityMul: 1 };
  }
  const en = getEnabledStrokeLayers(entity);
  const L = en[0];
  if (!L) {
    return { strokeColorAlphaMul: 1, strokeUniformOpacityMul: 1 };
  }
  const lo = fillLayerOpacity(L.opacity);
  if (entity.has(StrokeGradient)) {
    return { strokeColorAlphaMul: 1, strokeUniformOpacityMul: lo };
  }
  return { strokeColorAlphaMul: lo, strokeUniformOpacityMul: 1 };
}
