import type { Entity } from '@lastolivegames/becsy';
import { FillLayers, type FillLayerItem } from '../components/renderable/Fill';

export type { FillLayerItem };

/** 缺省或未写 `enabled` 视为启用 */
export function isFillLayerEnabled(l: FillLayerItem): boolean {
  return l.enabled !== false;
}

export function getEnabledFillLayersFromItems(
  layers: FillLayerItem[] | undefined,
): FillLayerItem[] {
  if (!layers?.length) {
    return [];
  }
  return layers.filter(isFillLayerEnabled);
}

export function getEnabledFillLayers(entity: Entity): FillLayerItem[] {
  if (!entity.has(FillLayers)) {
    return [];
  }
  return getEnabledFillLayersFromItems(entity.read(FillLayers).layers);
}

/**
 * 至少两条**启用**层时返回启用层列表（用于多层绘制）；否则返回 null。
 */
export function getMultiFillLayers(entity: Entity): FillLayerItem[] | null {
  if (!entity.has(FillLayers)) {
    return null;
  }
  const raw = entity.read(FillLayers).layers;
  if (!raw || raw.length < 2) {
    return null;
  }
  const enabled = getEnabledFillLayersFromItems(raw);
  if (enabled.length < 2) {
    return null;
  }
  return enabled;
}

/** 恰好一条启用层时返回该层（单层渐变/图片等与旧单组件纹理路径一致） */
export function getSingleEnabledFillLayer(
  entity: Entity,
): FillLayerItem | null {
  const enabled = getEnabledFillLayers(entity);
  return enabled.length === 1 ? (enabled[0] ?? null) : null;
}

export function fillLayersNeedFillImage(layers: FillLayerItem[]): boolean {
  return layers.some(
    (l) =>
      l.type === 'gradient' || l.type === 'image' || l.type === 'pattern',
  );
}

export type { FillLayerBlendMode } from '../types/fill-layer-blend';

/** 含非 `normal` 的 `blendMode` 时需 GPU 预合成（见 {@link composeFillLayerTexturesOnGpu}） */
export function fillLayersShouldPrecompose(layers: FillLayerItem[]): boolean {
  return layers.some((l) => {
    const b = l.blendMode;
    return b != null && b !== 'normal';
  });
}

/** 单层不透明度，缺省为 1（线框上可为数字或已解析的字符串） */
export function fillLayerOpacity(o?: number | string): number {
  if (o == null || o === '') {
    return 1;
  }
  if (typeof o === 'number') {
    return Number.isNaN(o) ? 1 : Math.min(1, Math.max(0, o));
  }
  const n = parseFloat(String(o));
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}

/** 首个启用 `solid` 层的颜色字符串（线框 `fills` 数组）。 */
export function getFirstSolidFillLayerValueFromWire(
  layers: FillLayerItem[] | undefined,
): string | null {
  if (!layers?.length) {
    return null;
  }
  for (const L of layers) {
    if (isFillLayerEnabled(L) && L.type === 'solid') {
      return L.value;
    }
  }
  return null;
}

/** 首个启用 `solid` 层的颜色字符串（ECS {@link FillLayers}）。 */
export function getFirstSolidFillLayerValue(entity: Entity): string | null {
  return getFirstSolidFillLayerValueFromWire(getEnabledFillLayers(entity));
}

/** 首个启用填充层的 `opacity` 乘子（缺省 1）。 */
export function getFirstFillLayerOpacityMul(entity: Entity): number {
  const enabled = getEnabledFillLayers(entity);
  const L = enabled[0];
  return L ? fillLayerOpacity(L.opacity) : 1;
}

/** 首个启用 `gradient` 层的 CSS 渐变字符串。 */
export function getFirstGradientFillLayerValue(entity: Entity): string | null {
  for (const L of getEnabledFillLayers(entity)) {
    if (L.type === 'gradient') {
      return L.value;
    }
  }
  return null;
}

/** 简单栅格烘焙：仅单层纯色填充 + 描边（见 {@link shouldBakeStrokeIntoRasterFilterTexture}）。 */
export function fillLayersEligibleForSimpleStrokeBake(entity: Entity): boolean {
  if (!entity.has(FillLayers)) {
    return true;
  }
  const en = getEnabledFillLayers(entity);
  if (en.length === 0) {
    return true;
  }
  if (en.length !== 1) {
    return false;
  }
  return en[0]!.type === 'solid';
}
