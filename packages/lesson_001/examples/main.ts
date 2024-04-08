import { Canvas } from '../src';

const $canvas = document.getElementById('canvas') as HTMLCanvasElement;
const resize = (width: number, height: number) => {
  $canvas.width = width * window.devicePixelRatio;
  $canvas.height = height * window.devicePixelRatio;
  $canvas.style.width = `${width}px`;
  $canvas.style.height = `${height}px`;
  $canvas.style.outline = 'none';
  $canvas.style.padding = '0px';
  $canvas.style.margin = '0px';
};
resize(window.innerWidth, window.innerHeight);

const canvas = await new Canvas({
  canvas: $canvas,
  // renderer: 'webgpu',
  // shaderCompilerPath:
  //   'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm',
}).initialized;

const animate = () => {
  canvas.render();
  requestAnimationFrame(animate);
};
animate();

window.addEventListener('resize', () => {
  resize(window.innerWidth, window.innerHeight);
  canvas.resize(window.innerWidth, window.innerHeight);
});
