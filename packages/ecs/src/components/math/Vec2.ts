import { Type } from '@lastolivegames/becsy';
import { Vec3 } from './Vec3';

/**
 * A 2-dimensional vector.
 */
export class Vec2 {
  static ZERO = Vec2.splat(0);
  static ONE = Vec2.splat(1);
  static X = new Vec2(1, 0);
  static Y = new Vec2(0, 1);

  static splat(v: number) {
    return new Vec2(v, v);
  }

  constructor(public x: number, public y: number) {}

  to_array() {
    return [this.x, this.y];
  }

  add(rhs: number | Vec2) {
    if (typeof rhs === 'number') {
      return new Vec2(this.x + rhs, this.y + rhs);
    } else {
      return new Vec2(this.x + rhs.x, this.y + rhs.y);
    }
  }
  add_assign(rhs: number | Vec2) {
    if (typeof rhs === 'number') {
      this.x += rhs;
      this.y += rhs;
    } else {
      this.x += rhs.x;
      this.y += rhs.y;
    }
    return this;
  }

  sub(rhs: number | Vec2) {
    if (typeof rhs === 'number') {
      return new Vec2(this.x - rhs, this.y - rhs);
    } else {
      return new Vec2(this.x - rhs.x, this.y - rhs.y);
    }
  }
  sub_assign(rhs: number | Vec2) {
    if (typeof rhs === 'number') {
      this.x -= rhs;
      this.y -= rhs;
    } else {
      this.x -= rhs.x;
      this.y -= rhs.y;
    }
    return this;
  }

  mul(rhs: number | Vec2) {
    if (typeof rhs === 'number') {
      return new Vec2(this.x * rhs, this.y * rhs);
    } else {
      return new Vec2(this.x * rhs.x, this.y * rhs.y);
    }
  }
  mul_assign(rhs: number | Vec2) {
    if (typeof rhs === 'number') {
      this.x *= rhs;
      this.y *= rhs;
    } else {
      this.x *= rhs.x;
      this.y *= rhs.y;
    }
    return this;
  }

  div(rhs: number | Vec2) {
    if (typeof rhs === 'number') {
      return new Vec2(this.x / rhs, this.y / rhs);
    } else {
      return new Vec2(this.x / rhs.x, this.y / rhs.y);
    }
  }
  div_assign(rhs: number | Vec2) {
    if (typeof rhs === 'number') {
      this.x /= rhs;
      this.y /= rhs;
    } else {
      this.x /= rhs.x;
      this.y /= rhs.y;
    }
    return this;
  }

  eq(rhs: Vec2) {
    return this.x === rhs.x && this.y === rhs.y;
  }

  min(rhs: Vec2) {
    return new Vec2(Math.min(this.x, rhs.x), Math.min(this.y, rhs.y));
  }

  max(rhs: Vec2) {
    return new Vec2(Math.max(this.x, rhs.x), Math.max(this.y, rhs.y));
  }

  ceil() {
    return new Vec2(Math.ceil(this.x), Math.ceil(this.y));
  }

  extend(z: number) {
    return new Vec3(this.x, this.y, z);
  }
}

export const v2Type = Type.vector(Type.float32, ['x', 'y'], Vec2 as any);
