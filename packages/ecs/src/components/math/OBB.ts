/**
 * An oriented bounding box is a rotated rectangle.
 *
 * @see https://github.com/ShukantPal/pixi-essentials/blob/master/packages/bounds/src/OrientedBounds.ts
 */
import { field, Type } from '@lastolivegames/becsy';
import { AABB } from './AABB';

export class OBB extends AABB {
  @field({ type: Type.float32, default: 0 }) declare rotation: number;

  constructor(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    rotation: number,
  ) {
    super(minX, minY, maxX, maxY);
    this.rotation = rotation;
  }
}
