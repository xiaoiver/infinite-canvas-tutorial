import { field, Type } from '@lastolivegames/becsy';

export class Renderable {
  @field({ type: Type.boolean, default: false })
  declare batchable: boolean;
}
