/**
 * An oriented bounding box is a rotated rectangle.
 *
 * @see https://github.com/ShukantPal/pixi-essentials/blob/master/packages/bounds/src/OrientedBounds.ts
 */
import { field, Type } from '@lastolivegames/becsy';

export class OBB {
  @field({ type: Type.float32, default: 0 }) declare x: number;
  @field({ type: Type.float32, default: 0 }) declare y: number;
  @field({ type: Type.float32, default: 0 }) declare width: number;
  @field({ type: Type.float32, default: 0 }) declare height: number;
  @field({ type: Type.float32, default: 0 }) declare rotation: number;
  @field({ type: Type.float32, default: 0 }) declare scaleX: number;
  @field({ type: Type.float32, default: 0 }) declare scaleY: number;

  constructor(obb: Partial<OBB> = {}) {
    this.x = obb.x ?? 0;
    this.y = obb.y ?? 0;
    this.width = obb.width ?? 0;
    this.height = obb.height ?? 0;
    this.rotation = obb.rotation ?? 0;
    this.scaleX = obb.scaleX ?? 1;
    this.scaleY = obb.scaleY ?? 1;
  }
}

export const obbType = Type.vector(
  Type.float32,
  ['x', 'y', 'width', 'height', 'rotation', 'scaleX', 'scaleY'],
  OBB,
);
