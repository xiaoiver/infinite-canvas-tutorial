import { Entity, field } from '@lastolivegames/becsy';
import { Binding } from './Binding';

export class Binded {
  @field.backrefs(Binding, 'from') declare fromBindings: Entity[];
  @field.backrefs(Binding, 'to') declare toBindings: Entity[];
}
