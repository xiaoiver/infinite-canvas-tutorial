import { Entity, field } from '@lastolivegames/becsy';
import { Binding } from './Binding';
import { PartialBinding } from './PartialBinding';

export class Binded {
  @field.backrefs(Binding, 'from') declare fromBindings: Entity[];
  @field.backrefs(Binding, 'to') declare toBindings: Entity[];
  @field.backrefs(PartialBinding, 'attached') declare partialBindings: Entity[];
}
