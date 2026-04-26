import { field, Type } from '@lastolivegames/becsy';

/**
 * 图标字体元数据（与 Pencil `iconfont` 节点对应）；具体 path 由渲染/lookup 解析。
 * @see https://docs.pencil.dev/for-developers/the-pen-format
 */
export class IconFont {
  @field({ type: Type.dynamicString(128), default: '' }) declare iconFontName: string;
  @field({ type: Type.dynamicString(128), default: '' }) declare iconFontFamily: string;

  constructor(props?: Partial<IconFont>) {
    Object.assign(this, props);
  }
}
