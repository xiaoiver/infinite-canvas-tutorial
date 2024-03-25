import * as d3 from 'd3-color';
import { Shape } from './Shape';

export class Circle extends Shape {
  constructor(
    config: Partial<{
      cx: number;
      cy: number;
      r: number;
      fill: string;
    }> = {},
  ) {
    super();

    const { cx, cy, r, fill } = config;

    this.cx = cx ?? 0;
    this.cy = cy ?? 0;
    this.r = r ?? 0;
    this.fill = fill ?? 'black';
  }

  #cx: number;
  #cy: number;
  #r: number;
  #fill: string;
  #fillRGB: d3.RGBColor;

  get cx() {
    return this.#cx;
  }

  set cx(cx: number) {
    this.#cx = cx;
  }

  get cy() {
    return this.#cy;
  }

  set cy(cy: number) {
    this.#cy = cy;
  }

  get r() {
    return this.#r;
  }

  set r(r: number) {
    this.#r = r;
  }

  get fill() {
    return this.#fill;
  }

  set fill(fill: string) {
    this.#fill = fill;
    this.#fillRGB = d3.rgb(fill);
  }
}
