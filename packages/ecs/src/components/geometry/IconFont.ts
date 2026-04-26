import { field, Type } from '@lastolivegames/becsy';

/**
 * 图标字体元数据（与 Pencil `iconfont` 节点对应）；具体 path 由渲染/lookup 解析。
 * @see https://docs.pencil.dev/for-developers/the-pen-format
 */
export class IconFont {
  @field({ type: Type.dynamicString(128), default: '' }) declare iconFontName: string;
  @field({ type: Type.dynamicString(128), default: '' }) declare iconFontFamily: string;

  /**
   * 与「节点」上的 `width`/`height` 一致：语义上的图标外框（如 32×32）。
   * 子 path 的并集在均匀缩放+居中后通常严格落在此框内，用并集作 bounds 会小于该框；
   * {@link packages/ecs/src/systems/ComputeBounds.ts} 在二者皆 >0 时用 (0,0)–(layoutWidth,layoutHeight) 作为本实体局部几何/选中框，与 `SerializedNode` 对齐。
   * 0 表示未设（老数据/占位），回退为 Group 的「子 AABB 并集」行为。
   */
  @field({ type: Type.float32, default: 0 })
  declare layoutWidth: number;
  @field({ type: Type.float32, default: 0 })
  declare layoutHeight: number;

  constructor(props?: Partial<IconFont>) {
    Object.assign(this, props);
  }
}
