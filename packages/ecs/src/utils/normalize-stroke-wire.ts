import type { Stroke } from '../components/renderable/Stroke';
import type { SerializedFillLayerItem, StrokeAttributes } from '../types/serialized-node';
import { isFillLayerEnabled } from './fillLayers';
import { isPattern } from './pattern';

/** 与 Figma「虚线端帽」一致：无额外延伸 / 方形 / 圆角（半圆帽）。 */
export function normalizeStrokeDashCap(
  v: unknown,
): Stroke['dashcap'] | undefined {
  if (v === undefined || v === null) {
    return undefined;
  }
  const s = String(v).trim().toLowerCase();
  if (s === '' || s === 'none' || s === 'butt') {
    return 'none';
  }
  if (s === 'square') {
    return 'square';
  }
  if (s === 'round') {
    return 'round';
  }
  return undefined;
}

/**
 * 将历史 wire 上的 `stroke` + `strokeOpacity` 合并为权威字段 `strokes`，并删除旧键。
 * 应在场景反序列化、继承计算之前对节点调用（与 {@link migrateLegacyFillWireInPlace} 对称）。
 */
function strokeOpacityMeansLegacyPaint(attrs: Record<string, unknown>): boolean {
  if (!('strokeOpacity' in attrs) || attrs.strokeOpacity === undefined) {
    return false;
  }
  if (attrs.strokeOpacity === null) {
    return true;
  }
  const n =
    typeof attrs.strokeOpacity === 'number'
      ? attrs.strokeOpacity
      : parseFloat(String(attrs.strokeOpacity));
  if (!Number.isFinite(n)) {
    return true;
  }
  // 仅 `strokeOpacity: 1` 且无 `stroke` 时与未写该属性等价（避免 defaultAttributes 与占位 `strokes` 误触发重建为 `#000`）
  if (n === 1 && !('stroke' in attrs)) {
    return false;
  }
  return true;
}

export function migrateLegacyStrokeWireInPlace(attrs: Record<string, unknown>): void {
  const hasLegacyStrokePaint =
    ('stroke' in attrs &&
      attrs.stroke !== undefined &&
      attrs.stroke !== null) ||
    strokeOpacityMeansLegacyPaint(attrs);

  if (Array.isArray(attrs.strokes)) {
    // `defaultAttributes` 会先铺 `strokes`（如占位 `none`），而 SVG / 旧线框仍带 `stroke`；
    // 若同时存在 legacy 键，必须以 legacy 为准重建 `strokes`，不能仅删 `stroke`。
    if (hasLegacyStrokePaint) {
      delete attrs.strokes;
    } else {
      delete attrs.stroke;
      delete attrs.strokeOpacity;
      return;
    }
  }

  const stroke = attrs.stroke;
  const so = attrs.strokeOpacity;
  if (
    stroke !== undefined &&
    stroke !== null &&
    typeof stroke === 'object' &&
    isPattern(stroke)
  ) {
    const p = stroke as import('./pattern').Pattern;
    const img = p.image;
    if (typeof img === 'string' && img.trim() !== '') {
      attrs.strokes = [
        {
          type: 'pattern',
          value: img,
          repetition: p.repetition ?? 'repeat',
          transform: p.transform ?? '',
          opacity: coalesceOpacityToOptional(so) ?? 1,
        },
      ];
      delete attrs.stroke;
      delete attrs.strokeOpacity;
    }
    return;
  }
  if (stroke !== undefined && stroke !== null && String(stroke).trim() !== '') {
    attrs.strokes = [
      {
        type: 'solid',
        value: String(stroke),
        opacity: coalesceOpacityToOptional(so) ?? 1,
      },
    ];
    delete attrs.stroke;
    delete attrs.strokeOpacity;
    return;
  }
  if (so !== undefined && so !== null) {
    attrs.strokes = [
      {
        type: 'solid',
        value: '#000000',
        opacity: coalesceOpacityToOptional(so) ?? 1,
      },
    ];
    delete attrs.stroke;
    delete attrs.strokeOpacity;
    return;
  }
  delete attrs.stroke;
  delete attrs.strokeOpacity;
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
export function firstEnabledStrokePresentation(
  strokes: SerializedFillLayerItem[] | undefined,
): { stroke: string; strokeOpacity: unknown } | null {
  if (!Array.isArray(strokes) || strokes.length === 0) {
    return null;
  }
  const L = strokes.find(isFillLayerEnabled);
  if (!L) {
    return null;
  }
  return {
    stroke: L.value as string,
    strokeOpacity: L.opacity ?? 1,
  };
}

/** 第一个启用层的 `value`（实色、渐变串、图片 URL 等），无则 `undefined`。 */
export function getPrimaryStrokeValue(
  attrs: Partial<StrokeAttributes>,
): string | undefined {
  return firstEnabledStrokePresentation(attrs.strokes)?.stroke;
}
