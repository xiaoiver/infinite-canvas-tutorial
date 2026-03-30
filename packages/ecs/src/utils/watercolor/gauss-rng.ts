export interface RngOptions {
  rng?: () => number;
}

export function gaussRng(
  μ: number = 0,
  σ: number = 1,
  { rng = Math.random }: RngOptions = {},
) {
  const u = 1 - rng();
  const v = rng();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * σ + μ;
}
