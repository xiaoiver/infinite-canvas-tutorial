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

  // d3-color 会在 alpha<=0 时把 r,g,b 设为 NaN，这里做兜底
  const rgb = colorRGB!;
  if (Number.isNaN(rgb.r) || Number.isNaN(rgb.g) || Number.isNaN(rgb.b)) {
    return d3.rgb(
      Number.isNaN(rgb.r) ? 0 : rgb.r,
      Number.isNaN(rgb.g) ? 0 : rgb.g,
      Number.isNaN(rgb.b) ? 0 : rgb.b,
      rgb.opacity
    );
  }
  return rgb;
}
