import { field, Entity, Type } from '@lastolivegames/becsy';
import { BitmapFont } from '../utils/bitmap-font/BitmapFont';

export class Font {
  @field.ref declare canvas: Entity;

  @field({ type: Type.staticString(['bitmap']), default: 'bitmap' })
  declare type: 'bitmap';

  @field.object declare bitmapFont: BitmapFont;

  constructor(font?: Partial<Font>) {
    Object.assign(this, font);
  }
}
