import {
  Canvas,
  Group,
  Circle,
  Rect,
  Polyline,
  RoughCircle,
  RoughEllipse,
  RoughRect,
  RoughPolyline,
  RoughPath,
  Path,
  Text,
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

const circle = new Circle({
  cx: 50,
  cy: 50,
  r: 4,
  fill: '#F67676',
});
canvas.appendChild(circle);

const text = new Text({
  x: 50,
  y: 50,
  content: 'Hello, world!\n你好世界\n你好世界\n你好世界\n你好世界',
  fontSize: 20,
  fill: '#F67676',
});
canvas.appendChild(text);

const bounds = text.getGeometryBounds();
console.log(bounds);

canvas.render();

const animate = () => {
  canvas.render();
  requestAnimationFrame(animate);
};
animate();

window.addEventListener('resize', () => {
  resize(window.innerWidth, window.innerHeight);
  canvas.resize(window.innerWidth, window.innerHeight);
});
