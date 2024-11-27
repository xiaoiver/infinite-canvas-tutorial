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

// const circle = new Circle({
//   cx: 100,
//   cy: 100,
//   r: 50,
//   fill: 'red',
//   stroke: 'black',
//   strokeWidth: 20,
//   sizeAttenuation: true,
// });
// canvas.appendChild(circle);

// const shadowedRect = new Rect({
//   x: 200,
//   y: 200,
//   width: 100,
//   height: 100,
//   dropShadowBlurRadius: 10,
//   dropShadowColor: 'black',
//   sizeAttenuation: true,
// });
// canvas.appendChild(shadowedRect);

const path = new Path({
  d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
  fill: 'black',
  sizeAttenuation: true,
});
canvas.appendChild(path);
canvas.render();

path.d = 'M 100 0 L 200 0 L 200 100 L 100 100 Z';
path.fill = 'red';
canvas.render();

// const polyline = new Polyline({
//   points: [
//     [0, 0],
//     [100, 100],
//     [200, 0],
//   ],
//   stroke: 'black',
//   strokeWidth: 20,
//   // sizeAttenuation: true,
// });
// canvas.appendChild(polyline);
// canvas.render();

// polyline.points = [
//   [100, 0],
//   [200, 100],
//   [300, 0],
// ];
// canvas.render();

// const polyline2 = new Polyline({
//   points: [
//     [0, 0],
//     [100, 100],
//     [200, 0],
//   ],
//   stroke: 'black',
//   strokeWidth: 20,
//   sizeAttenuation: true,
// });
// canvas.appendChild(polyline2);
// polyline2.position.x = 200;

// console.log(toSVGElement(serializeNode(rect1)));

// const animate = () => {
//   canvas.render();
//   requestAnimationFrame(animate);
// };
// animate();

window.addEventListener('resize', () => {
  resize(window.innerWidth, window.innerHeight);
  canvas.resize(window.innerWidth, window.innerHeight);
});
