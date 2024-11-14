import {
  Canvas,
  Rect,
  RoughCircle,
  RoughEllipse,
  RoughRect,
  RoughPolyline,
  RoughPath,
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

// const ellipse = new RoughEllipse({
//   cx: 0,
//   cy: 0,
//   rx: 50,
//   ry: 20,
//   fill: 'black',
//   strokeWidth: 2,
//   stroke: 'red',
//   seed: 1,
//   roughness: 1,
//   fillStyle: 'dots',
// });
// canvas.appendChild(ellipse);
// ellipse.position.x = 200;

// const rect = new RoughRect({
//   x: 0,
//   y: 0,
//   width: 100,
//   height: 100,
//   fill: 'black',
//   strokeWidth: 2,
//   stroke: 'red',
//   seed: 1,
//   roughness: 1,
//   fillStyle: 'dots',
//   opacity: 0.5,
// });
// rect.position.x = 200;
// rect.position.y = 200;
// canvas.appendChild(rect);

// rect.addEventListener('pointerenter', () => {
//   rect.fill = 'blue';
// });
// rect.addEventListener('pointerleave', () => {
//   rect.fill = 'black';
// });

// const polyline = new RoughPolyline({
//   points: [
//     [0, 0],
//     [100, 0],
//     [100, 100],
//     [0, 100],
//     [0, 0],
//   ],
//   strokeWidth: 2,
//   stroke: 'red',
// });
// canvas.appendChild(polyline);
// polyline.position.x = 400;

// const path = new RoughPath({
//   d: 'M10 80 Q 95 10 180 80',
//   // fill: 'none',
//   strokeWidth: 2,
//   stroke: 'red',
//   cursor: 'pointer',
// });
// canvas.appendChild(path);
// path.addEventListener('pointerenter', () => {
//   path.fill = 'blue';
// });
// path.addEventListener('pointerleave', () => {
//   path.fill = 'black';
// });

setTimeout(() => {
  circle.visible = false;
}, 2000);

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
