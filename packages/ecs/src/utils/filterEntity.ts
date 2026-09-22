/**
 * ECS entity helpers for {@link Filter} / raster post-effects (stays in core; uses becsy + components).
 */
import type { Entity } from '@lastolivegames/becsy';
import {
  Children,
  Circle,
  Ellipse,
  Filter,
  IconFont,
  Line,
  Path,
  Polyline,
  Rough,
  Stroke,
} from '../components';
import { hasValidStrokeEntity, getFirstGradientStrokeLayerValue } from './strokeLayers';
import { hasRasterPostEffects } from '../filter/api';

/**
 * 自身或 `iconfont` 根上的 {@link Filter} 字符串。子 path/ellipse/line 未挂 `Filter` 时沿父链取
 * 带 `IconFont` 且带 `Filter` 的节点（与反序列化一致：滤镜写在 icon 根上）。
 */
export function getRasterFilterValueForShape(instance: Entity): string | undefined {
  if (instance.has(Filter)) {
    const v = instance.read(Filter).value;
    if (v) {
      return v;
    }
  }
  let e: Entity | undefined = instance;
  for (let d = 0; d < 64; d++) {
    if (!e.has(Children)) {
      return undefined;
    }
    const p = e.read(Children).parent;
    if (!p) {
      return undefined;
    }
    if (p.has(IconFont) && p.has(Filter)) {
      return p.read(Filter).value || undefined;
    }
    e = p;
  }
  return undefined;
}

function isUnderIconFontEntity(entity: Entity): boolean {
  let e: Entity | undefined = entity;
  for (let d = 0; d < 64; d++) {
    if (!e.has(Children)) {
      return false;
    }
    const p = e.read(Children).parent;
    if (!p) {
      return false;
    }
    if (p.has(IconFont)) {
      return true;
    }
    e = p;
  }
  return false;
}

/**
 * {@link SmoothPolyline} 纯色描边 + 栅格类 filter：将描边栅格进纹理再采样（与渐变描边纹理路径区分）。
 */
export function shouldRasterizeStrokeForFilterTexture(shape: Entity): boolean {
  if (getFirstGradientStrokeLayerValue(shape) != null) {
    return false;
  }
  const fv = getRasterFilterValueForShape(shape);
  if (!fv || !hasRasterPostEffects(fv)) {
    return false;
  }
  if (!hasValidStrokeEntity(shape)) {
    return false;
  }
  const st = shape.read(Stroke);
  const [da, db] = st.dasharray;
  if (da > 0 && db > 0) {
    return false;
  }
  if (shape.has(Rough)) {
    return false;
  }

  if (isUnderIconFontEntity(shape)) {
    return shape.hasSomeOf(Path, Line, Ellipse, Polyline, Circle);
  }

  if (!shape.hasSomeOf(Polyline, Line, Path)) {
    return false;
  }
  return st.alignment === 'center';
}
