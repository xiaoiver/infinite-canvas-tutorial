import { Entity, field } from '@lastolivegames/becsy';
import { Highlighted, Selected } from '../pen';

/**
 * A camera can have one transformer which includes a mask and 4 anchors.
 */
export class Transformable {
  /**
   * Transformer
   */
  @field.ref declare mask: Entity;

  /**
   * Anchors
   */
  @field.ref declare tlAnchor: Entity;
  @field.ref declare trAnchor: Entity;
  @field.ref declare blAnchor: Entity;
  @field.ref declare brAnchor: Entity;

  /**
   * Selected list
   */
  @field.backrefs(Selected, 'camera') declare selecteds: Entity[];

  /**
   * Highlighted list
   */
  @field.backrefs(Highlighted, 'camera') declare highlighteds: Entity[];

  constructor(transformable?: Partial<Transformable>) {
    Object.assign(this, transformable);
  }
}
