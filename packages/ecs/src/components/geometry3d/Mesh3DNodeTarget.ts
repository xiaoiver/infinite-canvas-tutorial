import { Entity, field } from '@lastolivegames/becsy';

/** Marks a Mesh3D entity owned by a declarative {@link Mesh3DNode} source. */
export class Mesh3DNodeTarget {
  @field.ref declare source: Entity;

  constructor(props?: { source?: Entity }) {
    if (props?.source) {
      this.source = props.source;
    }
  }
}
