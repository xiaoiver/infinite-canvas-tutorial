import { field, Type } from '@lastolivegames/becsy';

export class ZIndex {
  @field({ type: Type.float32, default: 0 })
  declare value: number;

  @field({ type: Type.dynamicString(1000) })
  declare fractionalIndex: string;
}
