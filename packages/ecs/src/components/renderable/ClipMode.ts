import { field, Type } from '@lastolivegames/becsy';

export type ClipModeValue =
  | 'clip'
  | 'erase';

export class ClipMode {
  @field({
    type: Type.staticString(['clip', 'erase']),
    default: 'clip',
  })
  declare value: ClipModeValue;

  constructor(value?: ClipModeValue) {
    this.value = value ?? 'clip';
  }
}
