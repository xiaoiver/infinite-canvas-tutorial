/**
 * 单层 fill 与下层合成时使用的混合模式（与设计类工具命名对齐；缺省为 `normal`）。
 */
export type FillLayerBlendMode =
  | 'normal'
  | 'darken'
  | 'multiply'
  | 'linearBurn'
  | 'colorBurn'
  | 'light'
  | 'screen'
  | 'linearDodge'
  | 'colorDodge'
  | 'overlay'
  | 'softLight'
  | 'hardLight'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';
