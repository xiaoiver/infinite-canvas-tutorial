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

/**
 * GPU / Canvas 描边颜色：`StrokeLayers` 优先；否则 `Stroke.color`（非 `none`）。
 */
export function resolveGpuStrokeColor(entity: Entity): string | null {
  const fromLayer = getFirstSolidStrokeLayerValue(entity);
  if (fromLayer != null) {
    return fromLayer;
  }
  if (!entity.has(Stroke)) {
    return null;
  }
  const c = entity.read(Stroke).color;
  if (c && c !== 'none') {
    return c;
  }
  return null;
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

/**
 * 是否存在「应参与命中 / 可见」的描边颜料（以 `StrokeLayers` 为准；无栈时回退 `Stroke.color`）。
 */
export function entityHasRenderableStrokePaint(entity: Entity): boolean {
  if (entity.has(StrokeLayers)) {
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
  if (!entity.has(Stroke)) {
    return false;
  }
  const c = String(entity.read(Stroke).color ?? '').trim().toLowerCase();
  return c !== '' && c !== 'none';
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
