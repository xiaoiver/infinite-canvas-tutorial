import { Rect, Vec2 } from './math';

export function random(): number {
  return Math.random() * 2 - 1;
}

export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randomInRect(rect: Rect): Vec2 {
  return new Vec2(
    rect.min.x + Math.random() * rect.size.x,
    rect.min.y + Math.random() * rect.size.y,
  );
}
