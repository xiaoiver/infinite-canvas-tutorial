/** Minimal 2D math (replaces @sardinefish/zogra-renderer vec2/Rect in raindrop-fx). */

export class Vec2 {
  constructor(
    public x = 0,
    public y = 0,
  ) {}

  static zero(): Vec2 {
    return new Vec2(0, 0);
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  plus(o: Vec2): Vec2 {
    return new Vec2(this.x + o.x, this.y + o.y);
  }

  mul(s: number): Vec2 {
    return new Vec2(this.x * s, this.y * s);
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }

  static distanceSquared(a: Vec2, b: Vec2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }
}

export function plus(a: Vec2, b: Vec2): Vec2 {
  return a.plus(b);
}

export function mul(a: Vec2, s: number): Vec2 {
  return a.mul(s);
}

export function div(a: Vec2, s: number): Vec2 {
  return new Vec2(a.x / s, a.y / s);
}

export class Rect {
  constructor(
    public readonly min: Vec2,
    public readonly size: Vec2,
  ) {}

  get xMin(): number {
    return this.min.x;
  }

  get yMin(): number {
    return this.min.y;
  }

  get xMax(): number {
    return this.min.x + this.size.x;
  }

  get yMax(): number {
    return this.min.y + this.size.y;
  }
}
