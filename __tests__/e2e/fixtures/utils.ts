import { Canvas } from '../../../packages/core/src';

export async function initExample(
  $container: HTMLElement,
  render: (canvas: Canvas, $canvas: HTMLCanvasElement) => Promise<() => void>,
  renderer: 'webgl' | 'webgpu' = 'webgl',
) {
  const $canvas = document.createElement('canvas');
  $canvas.width = 400;
  $canvas.height = 400;
  $canvas.style.width = '400px';
  $canvas.style.height = '400px';
  $container.appendChild($canvas);

  const canvas = await new Canvas({
    canvas: $canvas,
    renderer,
    shaderCompilerPath: '/infinitecanvas/glsl_wgsl_compiler_bg.wasm',
  }).initialized;

  await render(canvas, $canvas);

  return () => {
    canvas.destroy();
  };
}
