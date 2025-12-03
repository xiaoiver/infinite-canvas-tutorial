import { field, Type } from '@lastolivegames/becsy';

export class Filter {
  @field({ type: Type.object, default: '' }) declare value: string;

  constructor(props?: Partial<Filter>) {
    Object.assign(this, props);
  }
}
