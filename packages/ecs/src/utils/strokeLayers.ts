import type { Entity } from '@lastolivegames/becsy';
import { Stroke } from '../components/renderable/Stroke';
import { StrokeLayers } from '../components/renderable/Fill';
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

/** 首个启用 `solid` 描边层的颜色字符串（线框 `strokes` 数组）。 */
export function getFirstSolidStrokeLayerValueFromWire(
  layers: FillLayerItem[] | undefined,
): string | null {
  if (!layers?.length) {
    return null;
  }
  for (const L of layers) {
    if (L.type === 'solid' && L.enabled !== false) {
      const v = String(L.value ?? '').trim();
      if (v !== '' && v.toLowerCase() !== 'none') {
        return L.value;
      }
    }
  }
  return null;
}

export function getFirstSolidStrokeLayerValue(entity: Entity): string | null {
  return getFirstSolidStrokeLayerValueFromWire(getEnabledStrokeLayers(entity));
}

/** 首个启用描边层的 `value`（solid / gradient 字符串）。 */
export function getFirstStrokeLayerWireValue(entity: Entity): string | null {
  const L = getEnabledStrokeLayers(entity)[0];
  if (!L) {
    return null;
  }
  if (L.type === 'solid' || L.type === 'gradient') {
    const v = L.value;
    return typeof v === 'string' ? v : null;
  }
  return null;
}

/**
 * GPU / Canvas 纯色描边（`StrokeLayers` 首条启用 solid）。
 */
export function resolveGpuStrokeColor(entity: Entity): string | null {
  return getFirstSolidStrokeLayerValue(entity);
}

/** 首个启用 `gradient` 描边层的 CSS 渐变字符串（与填充栈对称）。 */
export function getFirstGradientStrokeLayerValue(entity: Entity): string | null {
  for (const L of getEnabledStrokeLayers(entity)) {
    if (L.type === 'gradient') {
      const v = L.value;
      return typeof v === 'string' ? v : null;
    }
  }
  return null;
}

/** 线宽 > 0 且存在 `Stroke` 组件。 */
export function entityHasValidStrokeGeometry(entity: Entity): boolean {
  return entity.has(Stroke) && entity.read(Stroke).width > 0;
}

/**
 * 是否存在「应参与命中 / 可见」的描边颜料（以 `StrokeLayers` 为准）。
 */
export function entityHasRenderableStrokePaint(entity: Entity): boolean {
  const en = getEnabledStrokeLayers(entity);
  const L = en[0];
  if (!L) {
    return false;
  }
  if (L.type === 'solid') {
    const v = String(L.value ?? '').trim().toLowerCase();
    return v !== '' && v !== 'none';
  }
  return true;
}

/** 几何线宽有效且存在可渲染描边颜料。 */
export function hasValidStrokeEntity(entity: Entity): boolean {
  return (
    entityHasValidStrokeGeometry(entity) &&
    entityHasRenderableStrokePaint(entity)
  );
}

/**
 * 与 {@link fillLayerOpacity} 一致：单层 `strokes[].opacity` 乘到 GPU 描边 alpha。
 * 纯色走 `strokeColor.a`；渐变描边走 `u_Opacity.z`。
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
  if (getFirstGradientStrokeLayerValue(entity) != null) {
    return { strokeColorAlphaMul: 1, strokeUniformOpacityMul: lo };
  }
  return { strokeColorAlphaMul: lo, strokeUniformOpacityMul: 1 };
}
