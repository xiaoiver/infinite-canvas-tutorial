import { Matrix } from '@pixi/math';

const defaultMatrix = new Matrix();

/**
 * Axis-Aligned Bounding Box
 */
export class AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  matrix = defaultMatrix;

  constructor(
    minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
  ) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }

  isEmpty() {
    return this.minX > this.maxX || this.minY > this.maxY;
  }

  clear() {
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    this.matrix = defaultMatrix;
    return this;
  }

  containsPoint(x: number, y: number): boolean {
    if (this.minX <= x && this.minY <= y && this.maxX >= x && this.maxY >= y) {
      return true;
    }

    return false;
  }

  addBounds(bounds: AABB, matrix?: Matrix) {
    this.addFrame(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, matrix);
  }

  addFrame(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    matrix?: Matrix,
  ): void {
    matrix ||= this.matrix;

    const a = matrix.a;
    const b = matrix.b;
    const c = matrix.c;
    const d = matrix.d;
    const tx = matrix.tx;
    const ty = matrix.ty;

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

  // applyMatrix(matrix: Matrix): void {
  //   const minX = this.minX;
  //   const minY = this.minY;
  //   const maxX = this.maxX;
  //   const maxY = this.maxY;

  //   // multiple bounds by matrix
  //   const { a, b, c, d, tx, ty } = matrix;

  //   let x = a * minX + c * minY + tx;
  //   let y = b * minX + d * minY + ty;

  //   this.minX = x;
  //   this.minY = y;
  //   this.maxX = x;
  //   this.maxY = y;

  //   x = a * maxX + c * minY + tx;
  //   y = b * maxX + d * minY + ty;
  //   this.minX = x < this.minX ? x : this.minX;
  //   this.minY = y < this.minY ? y : this.minY;
  //   this.maxX = x > this.maxX ? x : this.maxX;
  //   this.maxY = y > this.maxY ? y : this.maxY;

  //   x = a * minX + c * maxY + tx;
  //   y = b * minX + d * maxY + ty;
  //   this.minX = x < this.minX ? x : this.minX;
  //   this.minY = y < this.minY ? y : this.minY;
  //   this.maxX = x > this.maxX ? x : this.maxX;
  //   this.maxY = y > this.maxY ? y : this.maxY;

  //   x = a * maxX + c * maxY + tx;
  //   y = b * maxX + d * maxY + ty;
  //   this.minX = x < this.minX ? x : this.minX;
  //   this.minY = y < this.minY ? y : this.minY;
  //   this.maxX = x > this.maxX ? x : this.maxX;
  //   this.maxY = y > this.maxY ? y : this.maxY;
  // }
}
