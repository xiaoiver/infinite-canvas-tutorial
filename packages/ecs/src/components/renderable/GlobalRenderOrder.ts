import { field, Type } from '@lastolivegames/becsy';

export class GlobalRenderOrder {
  @field({ type: Type.float32, default: 0 })
  declare value: number;
}
