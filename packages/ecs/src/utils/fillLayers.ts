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

/** 恰好一条启用层时返回该层（用于与单 FillGradient 相同的纹理路径） */
export function getSingleEnabledFillLayer(
  entity: Entity,
): FillLayerItem | null {
  const enabled = getEnabledFillLayers(entity);
  return enabled.length === 1 ? (enabled[0] ?? null) : null;
}

export function fillLayersNeedFillImage(layers: FillLayerItem[]): boolean {
  return layers.some((l) => l.type === 'gradient');
}

/** 单层不透明度，缺省为 1 */
export function fillLayerOpacity(o?: number): number {
  if (o == null || Number.isNaN(o)) {
    return 1;
  }
  return Math.min(1, Math.max(0, o));
}
