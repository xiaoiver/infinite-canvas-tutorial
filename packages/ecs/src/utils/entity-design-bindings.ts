import type { Entity } from '@lastolivegames/becsy';
import { FillSolid, Stroke, Text } from '../components';

/**
 * 从 ECS 组件读取与序列化一致的填充字符串（优先设计变量 `$token`）。
 */
export function readFillWireFromEntity(entity: Entity): string | undefined {
  if (!entity.has(FillSolid)) {
    return undefined;
  }
  const f = entity.read(FillSolid);
  if (f.fillVariableRef) {
    return `$${f.fillVariableRef}`;
  }
  return f.value;
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
