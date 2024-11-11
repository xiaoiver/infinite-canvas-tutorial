import {
  Canvas,
  Rect,
  RoughCircle,
  RoughRect,
  Path,
  fromSVGElement,
  deserializeNode,
} from '../src';

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
  // shaderCompilerPath: '/glsl_wgsl_compiler_bg.wasm',
}).initialized;

const circle = new RoughCircle({
  cx: 0,
  cy: 0,
  r: 50,
  fill: 'black',
  strokeWidth: 2,
  stroke: 'red',
  seed: 1,
  roughness: 1,
  fillStyle: 'dots',
});
canvas.appendChild(circle);

const rect = new RoughRect({
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  fill: 'black',
  strokeWidth: 2,
  stroke: 'red',
  seed: 1,
  roughness: 1,
  fillStyle: 'dots',
});
rect.position.x = 200;
rect.position.y = 200;
canvas.appendChild(rect);

rect.addEventListener('pointerenter', () => {
  rect.fill = 'blue';
});
rect.addEventListener('pointerleave', () => {
  rect.fill = 'black';
});

// setTimeout(() => {
//   ring.seed = 1000;
//   ring.roughness = 5;
//   ring.bowing = 5;
//   ring.stroke = 'green';
//   ring.fillStyle = 'zigzag';
// }, 2000);

canvas.render();

const animate = () => {
  canvas.render();
  requestAnimationFrame(animate);
};
animate();

// canvas.destroy();

window.addEventListener('resize', () => {
  resize(window.innerWidth, window.innerHeight);
  canvas.resize(window.innerWidth, window.innerHeight);
});
