import {
  type Entity,
  Theme,
  ThemeMode,
  parseColor,
} from '@infinite-canvas-tutorial/ecs';

/** 与 MeshPipeline.updateUniform 一致：Theme + parseColor，供 setCanvasRenderOptions 传入 WASM。 */
export function velloCanvasGridColors(canvas: Entity): {
  backgroundColor: [number, number, number, number];
  gridColor: [number, number, number, number];
} {
  const { mode, colors } = canvas.read(Theme);
  const light = colors[ThemeMode.LIGHT];
  const dark = colors[ThemeMode.DARK];
  const palette = colors[mode] ?? (mode === ThemeMode.DARK ? dark : light);
  const backgroundHex =
    palette?.background ?? (mode === ThemeMode.DARK ? '#121212' : '#fbfbfb');
  const gridHex =
    palette?.grid ?? (mode === ThemeMode.DARK ? '#242424' : '#dedede');
  const bg = parseColor(backgroundHex);
  const gr = parseColor(gridHex);
  return {
    // 与 WASM `background_rgba` 一致：0–1。勿用 [0,0,0,0] 调试常驻，否则 solid 背景被清成透明黑，合成后空白区发黑、与主题不符；与「有无阴影」无关（GI 也不是阴影贴图）。
    backgroundColor: [bg.r / 255, bg.g / 255, bg.b / 255, bg.opacity],
    gridColor: [gr.r / 255, gr.g / 255, gr.b / 255, gr.opacity],
  };
}
