import type { FillAttributes, SerializedFillLayerItem } from '../types/serialized-node';
import { fillLayerOpacity, isFillLayerEnabled } from './fillLayers';

/**
 * 将历史 wire 上的 `fill` / `fillOpacity` / `fillLayers` 合并为权威字段 `fills`，并删除旧键。
 * 应在场景反序列化、继承计算之前对节点调用。
 */
export function migrateLegacyFillWireInPlace(attrs: Record<string, unknown>): void {
  if (Array.isArray(attrs.fills)) {
    delete attrs.fill;
    delete attrs.fillOpacity;
    delete attrs.fillLayers;
    return;
  }
  if (Array.isArray(attrs.fillLayers)) {
    attrs.fills = (attrs.fillLayers as SerializedFillLayerItem[]).map((L) => ({
      ...L,
    }));
    delete attrs.fillLayers;
    delete attrs.fill;
    delete attrs.fillOpacity;
    return;
  }
  const fill = attrs.fill;
  const fo = attrs.fillOpacity;
  if (fill !== undefined && fill !== null && String(fill).trim() !== '') {
    attrs.fills = [
      {
        type: 'solid',
        value: String(fill),
        opacity: coalesceOpacityToOptional(fo),
      },
    ];
    delete attrs.fill;
    delete attrs.fillOpacity;
    delete attrs.fillLayers;
    return;
  }
  if (fo !== undefined && fo !== null) {
    attrs.fills = [
      {
        type: 'solid',
        value: '#000000',
        opacity: coalesceOpacityToOptional(fo),
      },
    ];
    delete attrs.fill;
    delete attrs.fillOpacity;
    delete attrs.fillLayers;
    return;
  }
  delete attrs.fill;
  delete attrs.fillOpacity;
  delete attrs.fillLayers;
}

function coalesceOpacityToOptional(fo: unknown): number | undefined {
  if (fo === undefined || fo === null) {
    return undefined;
  }
  const n = typeof fo === 'number' ? fo : parseFloat(String(fo));
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return Math.max(0, Math.min(1, n));
}

/** 第一个启用层，用于 Group / iconfont / 工具条展示。 */
export function firstEnabledFillPresentation(
  fills: SerializedFillLayerItem[] | undefined,
): { fill: string; fillOpacity: unknown } | null {
  if (!Array.isArray(fills) || fills.length === 0) {
    return null;
  }
  const L = fills.find(isFillLayerEnabled);
  if (!L) {
    return null;
  }
  return {
    fill: L.value,
    fillOpacity: L.opacity ?? 1,
  };
}

/** 第一个启用层的 `value`（如实色、渐变串、图片 URL），无则 `undefined`。 */
export function getPrimaryFillValue(
  attrs: Partial<FillAttributes>,
): string | undefined {
  return firstEnabledFillPresentation(attrs.fills)?.fill;
}
