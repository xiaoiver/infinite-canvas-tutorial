import { field, Type } from '@lastolivegames/becsy';

export class AABB {
  /**
   * The minimum x coordinate of the bounding box.
   */
  @field({ type: Type.float32, default: Infinity }) declare minX: number;
  /**
   * The minimum y coordinate of the bounding box.
   */
  @field({ type: Type.float32, default: Infinity }) declare minY: number;
  /**
   * The maximum x coordinate of the bounding box.
   */
  @field({ type: Type.float32, default: -Infinity }) declare maxX: number;
  /**
   * The maximum y coordinate of the bounding box.
   */
  @field({ type: Type.float32, default: -Infinity }) declare maxY: number;
}

export const aabbType = Type.vector(
  Type.float32,
  ['minX', 'minY', 'maxX', 'maxY'],
  AABB,
);
