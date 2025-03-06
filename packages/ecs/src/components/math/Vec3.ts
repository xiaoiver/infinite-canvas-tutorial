import { Type } from '@lastolivegames/becsy';
import { Vec2 } from './Vec2';

/**
 * A 3-dimensional vector.
 */
export class Vec3 {
  static ZERO = Vec3.splat(0);
  static ONE = Vec3.splat(1);
  static MAX = Vec3.splat(Number.MAX_VALUE);
  static MIN = Vec3.splat(Number.MIN_VALUE);
  static NEG_Z = new Vec3(0, 0, -1);
  static X = new Vec3(1, 0, 0);
  static Y = new Vec3(0, 1, 0);
  static Z = new Vec3(0, 0, 1);

  static splat(v: number) {
    return new Vec3(v, v, v);
  }

  /**
   * Creates a new vector from an array.
   */
  static from_array(a: [number, number, number]) {
    return new Vec3(a[0], a[1], a[2]);
  }

  static copy(a: Vec3) {
    return new Vec3(a.x, a.y, a.z);
  }

  constructor(public x: number, public y: number, public z: number) {}

  /**
   * `[x, y, z]`
   */
  to_array(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  xxx() {
    return new Vec3(this.x, this.x, this.x);
  }

  yyy() {
    return new Vec3(this.y, this.y, this.y);
  }

  zzz() {
    return new Vec3(this.z, this.z, this.z);
  }

  xy() {
    return new Vec2(this.x, this.y);
  }

  /**
   * Computes the length of `self`.
   */
  _length() {
    return Math.sqrt(this.dot(this));
  }

  /**
   * Computes the dot product of `self` and `rhs`.
   */
  dot(rhs: Vec3) {
    return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
  }

  /**
   * Computes the cross product of `self` and `rhs`.
   */
  cross(rhs: Vec3) {
    return new Vec3(
      this.y * rhs.z - this.z * rhs.y,
      this.z * rhs.x - this.x * rhs.z,
      this.x * rhs.y - this.y * rhs.x,
    );
  }

  /**
   * Returns a vector containing the minimum values for each element of `self` and `rhs`.
   */
  min(rhs: Vec3) {
    return new Vec3(
      Math.min(this.x, rhs.x),
      Math.min(this.y, rhs.y),
      Math.min(this.z, rhs.z),
    );
  }

  /**
   * Returns a vector containing the maximum values for each element of `self` and `rhs`.
   */
  max(rhs: Vec3) {
    return new Vec3(
      Math.max(this.x, rhs.x),
      Math.max(this.y, rhs.y),
      Math.max(this.z, rhs.z),
    );
  }

  abs() {
    return new Vec3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z));
  }

  neg() {
    return this.mul(-1);
  }

  add(rhs: number | Vec3) {
    if (typeof rhs === 'number') {
      return new Vec3(this.x + rhs, this.y + rhs, this.z + rhs);
    }
    return new Vec3(this.x + rhs.x, this.y + rhs.y, this.z + rhs.z);
  }

  add_assign(rhs: number | Vec3) {
    if (typeof rhs === 'number') {
      this.x += rhs;
      this.y += rhs;
      this.z += rhs;
    } else {
      this.x += rhs.x;
      this.y += rhs.y;
      this.z += rhs.z;
    }
    return this;
  }

  sub(rhs: number | Vec3) {
    if (typeof rhs === 'number') {
      return new Vec3(this.x - rhs, this.y - rhs, this.z - rhs);
    }
    return new Vec3(this.x - rhs.x, this.y - rhs.y, this.z - rhs.z);
  }

  sub_assign(rhs: number | Vec3) {
    if (typeof rhs === 'number') {
      this.x -= rhs;
      this.y -= rhs;
      this.z -= rhs;
    } else {
      this.x -= rhs.x;
      this.y -= rhs.y;
      this.z -= rhs.z;
    }
    return this;
  }

  mul(rhs: number | Vec3) {
    if (typeof rhs === 'number') {
      return new Vec3(this.x * rhs, this.y * rhs, this.z * rhs);
    }
    return new Vec3(this.x * rhs.x, this.y * rhs.y, this.z * rhs.z);
  }

  mul_assign(rhs: number | Vec3) {
    if (typeof rhs === 'number') {
      this.x *= rhs;
      this.y *= rhs;
      this.z *= rhs;
    } else {
      this.x *= rhs.x;
      this.y *= rhs.y;
      this.z *= rhs.z;
    }
    return this;
  }

  div(rhs: number | Vec3) {
    if (typeof rhs === 'number') {
      return new Vec3(this.x / rhs, this.y / rhs, this.z / rhs);
    }
    return new Vec3(this.x / rhs.x, this.y / rhs.y, this.z / rhs.z);
  }

  div_assign(rhs: number | Vec3) {
    if (typeof rhs === 'number') {
      this.x /= rhs;
      this.y /= rhs;
      this.z /= rhs;
    } else {
      this.x /= rhs.x;
      this.y /= rhs.y;
      this.z /= rhs.z;
    }
    return this;
  }

  /**
   * Returns a vector containing the reciprocal `1.0/n` of each element of `self`.
   */
  recip() {
    return new Vec3(1 / this.x, 1 / this.y, 1 / this.z);
  }

  eq(rhs: Vec3) {
    return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z;
  }

  ceil() {
    return new Vec3(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z));
  }

  /**
   * Creates a 2D vector from the `x` and `y` elements of `self`, discarding `z`.
   */
  truncate() {
    return new Vec2(this.x, this.y);
  }
  /**
   * Computes the squared length of `self`.
   */
  length_squared() {
    return this.dot(this);
  }

  /**
   * Computes `1.0 / length()`.
   */
  length_recip() {
    return 1 / this._length();
  }

  normalize() {
    const normalized = this.mul(this.length_recip());
    return normalized;
  }

  /// Returns the angle (in radians) between two vectors.
  ///
  /// The inputs do not need to be unit vectors however they must be non-zero.
  angle_between(rhs: Vec3) {
    return Math.acos(
      this.dot(rhs) / Math.sqrt(this.length_squared() * rhs.length_squared()),
    );
  }

  /**
   * Returns some vector that is orthogonal to the given one.
   * The input vector must be finite and non-zero.
   *
   * The output vector is not necessarily unit length. For that use
   * [`Self::any_orthonormal_vector()`] instead.
   */
  any_orthonormal_vector() {
    // This can probably be optimized
    if (Math.abs(this.x) > Math.abs(this.y)) {
      return new Vec3(-this.z, 0.0, this.x); // self.cross(Self::Y)
    } else {
      return new Vec3(0.0, this.z, -this.y); // self.cross(Self::X)
    }
  }
}

export const v3Type = Type.vector(Type.float32, ['x', 'y', 'z'], Vec3 as any);
