import type { Entity } from '@lastolivegames/becsy';
import { Stroke, Text } from '../components';
import { getFirstSolidFillLayerValue } from './fillLayers';

/**
 * 从 ECS 组件读取与序列化一致的填充字符串（`fills` 首条启用 solid 的 `value`，可为 `$token`）。
 */
export function readFillWireFromEntity(entity: Entity): string | undefined {
  const v = getFirstSolidFillLayerValue(entity);
  return v ?? undefined;
}

/** 描边颜色 wire */
export function readStrokeColorWireFromEntity(entity: Entity): string | undefined {
  if (!entity.has(Stroke)) {
    return undefined;
  }
  const s = entity.read(Stroke);
  if (s.colorVariableRef) {
    return `$${s.colorVariableRef}`;
  }
  return s.color;
}

/** 线宽 wire（仅当曾为变量引用时返回 `$` 形式） */
export function readStrokeWidthWireFromEntity(entity: Entity): number | string | undefined {
  if (!entity.has(Stroke)) {
    return undefined;
  }
  const s = entity.read(Stroke);
  if (s.widthVariableRef) {
    return `$${s.widthVariableRef}`;
  }
  return s.width;
}

/** 字号 wire */
export function readFontSizeWireFromEntity(entity: Entity): number | string | undefined {
  if (!entity.has(Text)) {
    return undefined;
  }
  const t = entity.read(Text);
  if (t.fontSizeVariableRef) {
    return `$${t.fontSizeVariableRef}`;
  }
  return t.fontSize;
}
