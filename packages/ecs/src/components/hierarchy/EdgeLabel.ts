import { field, Type } from '@lastolivegames/becsy';

/**
 * Text entity is a label on a parent edge (polyline/line). Position is recomputed from
 * {@link labelPosition} (0–1 along polyline arc length) when the edge geometry updates.
 */
export class EdgeLabel {
  @field({ type: Type.float32, default: 0.5 })
  declare labelPosition: number;

  @field({ type: Type.float32, default: 0 })
  declare labelOffset: number;

  constructor(props?: Partial<EdgeLabel>) {
    Object.assign(this, props);
  }
}
