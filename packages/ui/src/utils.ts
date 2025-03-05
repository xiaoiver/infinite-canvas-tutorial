import * as d3 from 'd3-color';

export function rgbaToRgbAndOpacity(rgba: string) {
  const { r, g, b, opacity } = d3.rgb(rgba);
  return {
    rgb: `rgb(${r}, ${g}, ${b})`,
    opacity,
  };
}

export function rgbAndOpacityToRgba(rgb: string, opacity: number) {
  const { r, g, b } = d3.rgb(rgb);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
