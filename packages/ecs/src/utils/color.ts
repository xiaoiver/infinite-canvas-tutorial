import * as d3 from 'd3-color';

function modernRgb(color: string): d3.RGBColor | undefined {
  const match = /^rgba?\(\s*([^(),]+)\s*\)$/i.exec(color);
  if (!match || !/\s/.test(match[1])) return;
  const [channels, opacity, extra] = match[1]
    .split('/')
    .map((part) => part.trim());
  if (extra !== undefined) return;
  const values = channels.split(/\s+/);
  if (values.length !== 3) return;
  const channel = (value: string) =>
    value.endsWith('%') ? Number(value.slice(0, -1)) * 2.55 : Number(value);
  const rgb = values.map(channel);
  const alpha =
    opacity === undefined
      ? 1
      : opacity.endsWith('%')
      ? Number(opacity.slice(0, -1)) / 100
      : Number(opacity);
  if (![...rgb, alpha].every(Number.isFinite)) return;
  return d3.rgb(
    ...(rgb.map((value) => Math.max(0, Math.min(255, value))) as [
      number,
      number,
      number,
    ]),
    Math.max(0, Math.min(1, alpha)),
  );
}

export function parseColor(color: string): d3.RGBColor {
  if (!color) {
    return d3.rgb(0, 0, 0, 0);
  }

  let colorRGB: d3.RGBColor | undefined;
  if (color === 'none') {
    colorRGB = d3.rgb(255, 255, 255, 0);
  } else {
    colorRGB = modernRgb(color) ?? d3.rgb(color).rgb();
  }

  // d3-color 会在 alpha<=0 时把 r,g,b 设为 NaN，这里做兜底
  const rgb = colorRGB!;
  if (!Number.isFinite(rgb.opacity)) return d3.rgb(0, 0, 0, 1);
  if (Number.isNaN(rgb.r) || Number.isNaN(rgb.g) || Number.isNaN(rgb.b)) {
    return d3.rgb(
      Number.isNaN(rgb.r) ? 0 : rgb.r,
      Number.isNaN(rgb.g) ? 0 : rgb.g,
      Number.isNaN(rgb.b) ? 0 : rgb.b,
      rgb.opacity,
    );
  }
  return rgb;
}

/** 将任意 CSS 颜色（含命名色如 `grey`）规范为 Hex，供取色器等需要 `#rrggbb` 的 UI 使用。 */
export function cssColorToHex(color: string): string {
  if (!color || color === 'none') {
    return '#000000';
  }
  const rgb = parseColor(color);
  const c = d3.rgb(rgb.r, rgb.g, rgb.b, rgb.opacity);
  return c.opacity < 1 ? c.formatHex8() : c.formatHex();
}
