import { Random } from 'roughjs/bin/math';
import { vec2 } from 'gl-matrix';

export function pointToLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
  y: number,
) {
  const d: [number, number] = [x2 - x1, y2 - y1];
  if (vec2.exactEquals(d, [0, 0])) {
    return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
  }
  const u: [number, number] = [-d[1], d[0]];
  vec2.normalize(u, u);
  const a: [number, number] = [x - x1, y - y1];
  return Math.abs(vec2.dot(a, u));
}

export function bisect(norm: vec2, norm2: vec2, dy: number) {
  const bisect = vec2.scale(
    vec2.create(),
    vec2.add(vec2.create(), norm, norm2),
    0.5,
  );
  vec2.scale(bisect, bisect, 1 / vec2.dot(norm, bisect));
  return vec2.scale(bisect, bisect, dy);
}

const random = new Random(Date.now());
export const randomInteger = () => Math.floor(random.next() * 2 ** 31);

export function inRange(value: number, min: number, max: number) {
  return value >= min && value <= max;
}
