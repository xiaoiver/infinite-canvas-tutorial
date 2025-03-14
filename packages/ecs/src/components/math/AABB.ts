import { field, Type } from '@lastolivegames/becsy';
import { m3Type, Mat3 } from './Mat3';

/**
 * Axis-Aligned Bounding Box
 */
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

  /**
   * The transformation matrix of the bounding box.
   */
  @field({ type: m3Type, default: Mat3.IDENTITY }) declare matrix: Mat3;

  constructor(
    minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    matrix = Mat3.IDENTITY,
  ) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
    this.matrix = matrix;
  }

  addBounds(bounds: AABB, matrix?: Mat3) {
    this.addFrame(
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
      matrix || this.matrix,
    );
  }

  addFrame(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    matrix?: Mat3,
  ): void {
    matrix ||= this.matrix;

    const a = matrix.m00;
    const b = matrix.m01;
    const c = matrix.m10;
    const d = matrix.m11;
    const tx = matrix.m20;
    const ty = matrix.m21;

    let minX = this.minX;
    let minY = this.minY;
    let maxX = this.maxX;
    let maxY = this.maxY;

    let x = a * x0 + c * y0 + tx;
    let y = b * x0 + d * y0 + ty;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    x = a * x1 + c * y0 + tx;
    y = b * x1 + d * y0 + ty;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    x = a * x0 + c * y1 + tx;
    y = b * x0 + d * y1 + ty;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    x = a * x1 + c * y1 + tx;
    y = b * x1 + d * y1 + ty;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }
}

export const aabbType = Type.vector(
  Type.float32,
  ['minX', 'minY', 'maxX', 'maxY'],
  AABB,
);
