import { field, Type } from '@lastolivegames/becsy';

export class FractionalIndex {
  @field({ type: Type.dynamicString(1000) })
  declare value: string;

  constructor(value?: string) {
    this.value = value ?? undefined;
  }
}
