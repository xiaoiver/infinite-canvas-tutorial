import { field, Type } from '@lastolivegames/becsy';

export class ZIndex {
  @field({ type: Type.float32, default: 0 })
  declare value: number;

  constructor(value?: number) {
    this.value = value ?? undefined;
  }
}
