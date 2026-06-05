import { Entity, field } from '@lastolivegames/becsy';

/** Marks a Mesh3D entity owned by a rect with {@link Extrude3D}. */
export class Extrude3DTarget {
  @field.ref declare source: Entity;

  /** When true, mesh translation uses canvas x/y directly (linked Camera3D). */
  @field.boolean declare unifiedSpace: boolean;

  constructor(props?: { source?: Entity; unifiedSpace?: boolean }) {
    if (props?.source) {
      this.source = props.source;
    }
    this.unifiedSpace = props?.unifiedSpace ?? true;
  }
}
