import { field, Type } from '@lastolivegames/becsy';

export class Editable {
  @field({ type: Type.boolean, default: false }) declare isEditing: boolean;

  constructor(props?: Partial<Editable>) {
    Object.assign(this, props);
  }
}
