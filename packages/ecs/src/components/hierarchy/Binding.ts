import { Entity, field } from '@lastolivegames/becsy';

/**
 * A binding between two entities.
 */
export class Binding {
  @field.ref declare from: Entity;
  @field.ref declare to: Entity;

  // TODO: anchors, e.g. sourceAnchor and targetAnchor

  constructor(props?: Partial<Binding>) {
    Object.assign(this, props);
  }
}
