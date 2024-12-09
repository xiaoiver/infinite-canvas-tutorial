import { GConstructor } from './mixins';
import { Shape, ShapeAttributes } from './Shape';

export interface TextAttributes extends ShapeAttributes {
  /**
   * Text alignment used when drawing text.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textAlign
   */
  textAlign: CanvasTextAlign;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
   */
  textBaseline: CanvasTextBaseline;
}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redeclare
export class Text extends TextWrapper(Shape) {}
export function TextWrapper<TBase extends GConstructor>(Base: TBase) {
  // @ts-expect-error - Mixin class
  return class TextWrapper extends Base implements TextAttributes {
    constructor(attributes: Partial<TextAttributes> = {}) {
      super(attributes);

      // const { textAlign, textBaseline } = attributes;
    }
  };
}
