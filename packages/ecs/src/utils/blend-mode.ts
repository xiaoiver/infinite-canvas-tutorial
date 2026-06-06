import type { FillLayerBlendMode } from '../types/fill-layer-blend';

/**
 * 节点（图层）级混合模式（"mix mode"）到 CSS `mix-blend-mode` 关键字的映射。
 *
 * 与 fill 层级混合模式（{@link import('./fillLayerComposeGpu').fillLayerBlendModeToIndex}）共享
 * {@link FillLayerBlendMode} 命名；其中 `light` 在着色器中实现为 `max`（即 `lighten`）。
 *
 * 部分模式（`linearBurn` / `linearDodge`）没有标准 CSS `mix-blend-mode` 关键字，映射为 `null`，
 * 导出 SVG 时按 `normal` 处理（不写出 `mix-blend-mode`）。
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode
 */
const BLEND_MODE_TO_CSS: Record<FillLayerBlendMode, string | null> = {
  normal: 'normal',
  darken: 'darken',
  multiply: 'multiply',
  linearBurn: null,
  colorBurn: 'color-burn',
  light: 'lighten',
  screen: 'screen',
  linearDodge: null,
  colorDodge: 'color-dodge',
  overlay: 'overlay',
  softLight: 'soft-light',
  hardLight: 'hard-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

/**
 * 将节点级 {@link FillLayerBlendMode} 转为 CSS `mix-blend-mode` 关键字。
 *
 * 缺省（`undefined` / `normal`）或无 CSS 等价物时返回 `null`，调用方可据此跳过写出样式。
 */
export function toCSSMixBlendMode(
  mode: FillLayerBlendMode | undefined,
): string | null {
  if (!mode) {
    return null;
  }
  const css = BLEND_MODE_TO_CSS[mode];
  if (!css || css === 'normal') {
    return null;
  }
  return css;
}
