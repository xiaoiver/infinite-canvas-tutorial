import { field, Type } from '@lastolivegames/becsy';

/**
 * 节点整体不透明度（SVG `opacity`）。
 * 单层填充/描边透明度见 {@link FillLayers} / {@link StrokeLayers} 各层的 `opacity`。
 */
export class Opacity {
  /**
   * It specifies the transparency of an object or of a group of objects,
   * that is, the degree to which the background behind the element is overlaid.
   *
   * Default value is `1`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/opacity
   */
  @field({ type: Type.float32, default: 1 }) declare opacity: number;

  constructor(props?: Partial<Opacity>) {
    if (props?.opacity != null) {
      this.opacity = props.opacity;
    }
  }
}
