import { field, Type } from '@lastolivegames/becsy';

export type ClipModeValue =
  | 'clip'
  | 'erase'
  | 'soft';

export class ClipMode {
  @field({
    type: Type.staticString(['clip', 'erase', 'soft']),
    default: 'clip',
  })
  declare value: ClipModeValue;

  /** When value is 'soft': alpha (0–1) for content outside the mask. Default 0.5. */
  @field({ type: Type.float32, default: 0.5 })
  declare outsideAlpha: number;

  constructor(value?: ClipModeValue, outsideAlpha?: number) {
    this.value = value ?? 'clip';
    this.outsideAlpha = outsideAlpha ?? 0.5;
  }
}
