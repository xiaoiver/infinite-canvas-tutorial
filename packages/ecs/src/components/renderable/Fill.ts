import { field, Type } from '@lastolivegames/becsy';
import { Texture } from '@antv/g-device-api';
import { type Pattern } from '../../utils';

export class FillSolid {
  /**
   * It's a presentation attribute that defines the color used to paint the element.
   *
   * Default to `black`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill
   */
  @field({ type: Type.dynamicString(20), default: 'black' })
  declare value: string;

  constructor(value?: string) {
    this.value = value;
  }
}

export class FillGradient {
  @field.dynamicString(100) declare value: string;
  constructor(value?: string) {
    this.value = value;
  }
}

/**
 * A pattern using the specified image and repetition.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createPattern
 */
export class FillPattern {
  /**
   * An image to be used as the pattern's image.
   *
   */
  @field.object declare image: string | CanvasImageSource;

  /**
   * A string indicating how to repeat the pattern's image.
   */
  @field.object declare repetition:
    | 'repeat'
    | 'repeat-x'
    | 'repeat-y'
    | 'no-repeat';

  /**
   * Uses a DOMMatrix object as the pattern's transformation matrix and invokes it on the pattern.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasPattern/setTransform
   */
  @field.object declare transform: string;

  constructor(value?: Pattern) {
    this.image = value?.image;
    this.repetition = value?.repetition;
    this.transform = value?.transform;
  }
}

export class FillTexture {
  @field.object declare value: Texture;

  constructor(value?: Texture) {
    this.value = value;
  }
}

export class FillImage {
  @field.object declare src: TexImageSource;

  /**
   * @see https://developer.mozilla.org/zh-CN/docs/Web/CSS/object-fit
   * @see https://tympanus.net/codrops/2025/03/11/replicating-css-object-fit-in-webgl/
   */
  @field({
    type: Type.staticString(['contain', 'cover', 'fill', 'none', 'scale-down']),
    default: 'contain',
  })
  declare objectFit: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';

  constructor(value?: Partial<FillImage>) {
    this.src = value?.src;
    this.objectFit = value?.objectFit;
  }
}
