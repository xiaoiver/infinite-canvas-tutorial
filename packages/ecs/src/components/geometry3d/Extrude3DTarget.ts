import { Entity, field } from '@lastolivegames/becsy';

/** Marks a Mesh3D entity owned by a rect with {@link Extrude3D}. */
export class Extrude3DTarget {
  @field.ref declare source: Entity;

  constructor(props?: { source?: Entity }) {
    if (props?.source) {
      this.source = props.source;
    }
  }
}
