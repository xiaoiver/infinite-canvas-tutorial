import {
  Canvas,
  Circle,
  Rect,
  RoughCircle,
  RoughEllipse,
  RoughRect,
  RoughPolyline,
  RoughPath,
  Path,
  fromSVGElement,
  deserializeNode,
  serializeNode,
  toSVGElement,
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

const circle1 = new Circle({
  cx: 0,
  cy: 0,
  r: 50,
  fill: 'red',
  // zIndex: 999,
});
canvas.appendChild(circle1);

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
