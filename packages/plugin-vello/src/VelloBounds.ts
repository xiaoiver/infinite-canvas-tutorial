import {
  type Entity,
  Text,
  AABB,
  registerBoundsCalculator,
  type BoundsResult,
} from '@infinite-canvas-tutorial/ecs';
import { computeTextBounds } from '@infinite-canvas-tutorial/vello-renderer';

/**
 * 使用 Vello wasm 的 computeTextBounds 来计算 Text 的几何/渲染包围盒。
 *
 * 当前实现仅示例如何调用，可根据需要补充更多 Text 属性映射。
 */
export function registerVelloTextBounds() {
  registerBoundsCalculator((entity: Entity): BoundsResult | null => {
    if (!entity.has(Text)) {
      return null;
    }

    const text = entity.read(Text);
    const {
      content,
      fontSize,
      fontFamily,
      anchorX,
      anchorY,
      textAlign,
      textBaseline,
      lineHeight,
      letterSpacing,
      wordWrap,
      wordWrapWidth,
    } = text;
    const fontKerning = 'fontKerning' in text ? (text as { fontKerning?: boolean }).fontKerning : true;

    const opts: Record<string, unknown> = {
      id: entity.__id,
      content,
      fontSize,
      fontFamily,
      anchorX,
      anchorY,
      textAlign,
      textBaseline,
      lineHeight,
      letterSpacing,
      fontKerning,
      wordWrap: wordWrap ?? false,
      wordWrapWidth: wordWrapWidth ?? 0,
    };

    const bounds = computeTextBounds(opts);
    if (
      !bounds ||
      typeof bounds.min_x !== 'number' ||
      typeof bounds.min_y !== 'number' ||
      typeof bounds.max_x !== 'number' ||
      typeof bounds.max_y !== 'number'
    ) {
      return null;
    }

    const geometryBounds = new AABB(
      bounds.min_x,
      bounds.min_y,
      bounds.max_x,
      bounds.max_y,
    );

    // 这里简单地将 renderBounds 与 geometryBounds 相同；
    // 如需考虑描边/阴影，可在此基础上扩展。
    const renderBounds = new AABB(
      bounds.min_x,
      bounds.min_y,
      bounds.max_x,
      bounds.max_y,
    );

    return { geometryBounds, renderBounds };
  });
}

