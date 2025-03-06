import { Entity, field } from '@lastolivegames/becsy';
import { Children } from './Children';

export class Parent {
  /**
   * The backrefs field type lets you build 1-N relationships where the N is unbounded.
   */
  @field.backrefs(Children, 'parent') declare children: Entity[];
}
