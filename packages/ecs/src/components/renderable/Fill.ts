import { component, field, Type, World } from '@lastolivegames/becsy';

import { Texture } from '@antv/g-device-api';
import { type Pattern } from '../../utils';

/**
 * @see https://lastolivegames.github.io/becsy/guide/architecture/components#components
 * For components with a single field it might be tempting to name it the same as the component,
 * but this leads to awkward code when accessing it later, e.g., entity.read(Acceleration).acceleration.
 * Instead, we recommend naming the sole field value so the code becomes entity.read(Acceleration).value instead.
 */

const fillEnum = World.defineEnum('Fill');
export
@component(fillEnum)
class FillSolid {
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

export
@component(fillEnum)
class FillGradient {
  @field.dynamicString(100) declare value: string;
  constructor(value?: string) {
    this.value = value;
  }
}

/**
 * A pattern using the specified image and repetition.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createPattern
 */
export
@component(fillEnum)
class FillPattern {
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

export
@component(fillEnum)
class FillTexture {
  @field.object declare value: Texture;

  constructor(value?: Texture) {
    this.value = value;
  }
}

export
@component(fillEnum)
class FillImage {
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
