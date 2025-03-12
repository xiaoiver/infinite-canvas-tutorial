import * as d3 from 'd3-color';

export function parseColor(color: string): d3.RGBColor {
  if (!color) {
    return d3.rgb(0, 0, 0, 0);
  }

  let colorRGB: d3.RGBColor | undefined;
  if (color === 'none') {
    colorRGB = d3.rgb(255, 255, 255, 0);
  } else {
    colorRGB = d3.rgb(color)?.rgb() || d3.rgb(0, 0, 0, 1);
  }
  return colorRGB;
}
