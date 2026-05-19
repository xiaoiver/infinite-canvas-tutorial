export interface Time {
  dt: number;
  total: number;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
