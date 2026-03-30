import { rgb } from 'd3-color';
import { vec2 } from 'gl-matrix';
import { gaussRng } from './gauss-rng';

/** [id, r, g, b] or [id, r, g, b, alpha] in 0–255 / opacity units (matches prior sRGBTuple use). */
export type PaletteColor = readonly [number, number, number, number, number?];

type Bounds = [number, number, number, number];

/** Any 2D point indexable as [0]=x,[1]=y (gl-matrix vec2, tuple, etc.). */
type Vec2ish = { readonly 0: number; readonly 1: number };

function fromHex(hex: string, id: number): PaletteColor {
  const c = rgb(hex);
  return [id, c.r, c.g, c.b];
}

function mixPalette(a: PaletteColor, b: PaletteColor, t: number): PaletteColor {
  const [, ar, ag, ab] = a;
  const [, br, bg, bb] = b;
  return [
    a[0],
    ar + (br - ar) * t,
    ag + (bg - ag) * t,
    ab + (bb - ab) * t,
  ];
}

const boundsOf = (points: Vec2ish[]): Bounds => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    const x = p[0];
    const y = p[1];
    x0 = Math.min(x, x0);
    y0 = Math.min(y, y0);
    x1 = Math.max(x, x1);
    y1 = Math.max(y, y1);
  }
  return [x0, y0, x1, y1];
};

const centerOf = ([x0, y0, x1, y1]: Bounds): vec2 =>
  vec2.fromValues((x1 + x0) / 2, (y1 + y0) / 2);

const dimensionsOf = ([x0, y0, x1, y1]: Bounds): vec2 =>
  vec2.fromValues(x1 - x0, y1 - y0);

const HEX = [
  `#000000`,
  `#1D2B53`,
  `#7E2553`,
  `#008751`,
  `#AB5236`,
  `#5F574F`,
  `#FF004D`,
  `#FFA300`,
  `#FFEC27`,
  `#00E436`,
  `#29ADFF`,
  `#83769C`,
  `#FF77A8`,
] as const;

export const colors: PaletteColor[] = HEX.map((h, i) => fromHex(h, i));

const setAlpha = ([id, r, g, b]: PaletteColor, alpha: number): PaletteColor => [
  id,
  r,
  g,
  b,
  alpha,
];

export const toCSS = ([, r, g, b, a = 1]: PaletteColor) =>
  `rgba(${[r, g, b].map((it) => it.toFixed(0)).join(' ')} / ${(a * 100).toFixed(1)}%)`;

export const generateFillStyle = (
  ctx: CanvasRenderingContext2D,
  points: Vec2ish[],
  base: PaletteColor,
) => {
  const bounds = boundsOf(points);
  const dim = dimensionsOf(bounds);
  const w = dim[0];
  const h = dim[1];
  const c = centerOf(bounds);
  const cx = c[0];
  const cy = c[1];

  const [cx0, cy0] = [cx + gaussRng(0, w / 4), cy + gaussRng(0, h / 15)];
  const [cx1, cy1] = [cx0 + gaussRng(0, 10), cy0 + gaussRng(0, 10)];

  const g = ctx.createRadialGradient(cx0, cy0, w / 10, cx1, cy1, w);

  const alt = colors[Math.floor(Math.random() * colors.length)];

  const clr0 = setAlpha(mixPalette(base, alt, Math.random()), 0);
  const clr1 = setAlpha(mixPalette(base, alt, Math.random() * 0.3), 0.1);
  const clr2 = setAlpha(mixPalette(base, alt, Math.random() * 0.15), 0.3);

  const dir = Math.random() < 0.25;
  g.addColorStop(dir ? 0.0 : 1.0, toCSS(clr2));
  g.addColorStop(dir ? 1.0 : 0.0, toCSS(clr0));

  return Math.random() < 0.5 ? g : toCSS(clr1);
};
