import { field } from '@lastolivegames/becsy';
import { AABB, aabbType, OBB, obbType } from '../math';

export class ComputedBounds {
  /**
   * The bounding box of the render.
   * e.g. Stroke / Shadow included.
   */
  @field(aabbType) declare renderBounds: AABB;

  /**
   * The bounding box of the geometry.
   * e.g. Stroke excluded.
   */
  @field(aabbType) declare geometryBounds: AABB;

  /**
   * Account for world transform.
   */
  @field(aabbType) declare bounds: AABB;

  @field(obbType) declare obb: OBB;
}
