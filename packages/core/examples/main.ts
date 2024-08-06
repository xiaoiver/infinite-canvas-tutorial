import { Canvas, Circle, Rect } from '../src';
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';

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
  // backgroundColor: 'red',
  // gridColor: 'white',
  // renderer: 'webgpu',
  // shaderCompilerPath:
  //   'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm',
}).initialized;

const origin = new Rect({
  x: 50,
  y: 50,
  width: 100,
  height: 100,
  fill: 'green',
});
canvas.appendChild(origin);

const parent = new Rect({
  width: 100,
  height: 100,
  fill: 'black',
});
parent.position = { x: 50, y: 50 };
canvas.appendChild(parent);

const child = new Rect({
  width: 50,
  height: 50,
  fill: 'red',
});
child.position = { x: 50, y: 50 };
parent.appendChild(child);

parent.position.x += 50;
parent.position.y += 50;
canvas.render();

parent.pivot = { x: 50, y: 50 };
parent.rotation = Math.PI / 4;
parent.scale.x = 0.5;
parent.scale.y = 0.5;

canvas.render();

// const image = (await load(
//   // 'https://infinitecanvas.cc/canvas.png',
//   'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAADElEQVQImWNgoBMAAABpAAFEI8ARAAAAAElFTkSuQmCC',
//   ImageLoader,
// )) as ImageBitmap;
// const circle4 = new Circle({
//   cx: 100,
//   cy: 100,
//   r: 50,
//   fill: image,
//   stroke: 'black',
//   strokeWidth: 20,
//   strokeOpacity: 0.5,
// });
// canvas.appendChild(circle4);

// const circle5 = new Circle({
//   cx: 200,
//   cy: 100,
//   r: 50,
//   fill: image,
//   stroke: 'black',
//   strokeWidth: 20,
//   strokeOpacity: 0.5,
//   strokeAlignment: 'inner',
// });
// canvas.appendChild(circle5);

// const circle6 = new Circle({
//   cx: 300,
//   cy: 100,
//   r: 50,
//   fill: image,
//   stroke: 'black',
//   strokeWidth: 20,
//   strokeOpacity: 0.5,
//   strokeAlignment: 'outer',
// });
// canvas.appendChild(circle6);

// const circle = new Circle({
//   cx: 300,
//   cy: 300,
//   r: 50,
//   fill: '#F67676',
//   stroke: 'black',
//   strokeWidth: 20,
//   strokeOpacity: 0.5,
// });
// canvas.appendChild(circle);
// circle.addEventListener('pointerenter', () => {
//   circle.fill = 'green';
// });
// circle.addEventListener('pointerleave', () => {
//   circle.fill = '#F67676';
// });

// const circle2 = new Circle({
//   cx: 200,
//   cy: 300,
//   r: 50,
//   fill: '#F67676',
//   stroke: 'black',
//   strokeWidth: 20,
//   strokeOpacity: 0.5,
//   strokeAlignment: 'inner',
// });
// canvas.appendChild(circle2);
// circle2.addEventListener('pointerenter', () => {
//   circle2.fill = 'green';
// });
// circle2.addEventListener('pointerleave', () => {
//   circle2.fill = '#F67676';
// });

// const circle3 = new Circle({
//   cx: 100,
//   cy: 300,
//   r: 50,
//   fill: '#F67676',
//   stroke: 'black',
//   strokeWidth: 20,
//   strokeOpacity: 0.5,
//   strokeAlignment: 'outer',
//   pointerEvents: 'stroke',
// });
// canvas.appendChild(circle3);
// circle3.addEventListener('pointerenter', () => {
//   circle3.stroke = 'green';
// });
// circle3.addEventListener('pointerleave', () => {
//   circle3.stroke = 'black';
// });

// const animate = () => {
//   canvas.render();
//   requestAnimationFrame(animate);
// };
// animate();

// canvas.destroy();

window.addEventListener('resize', () => {
  resize(window.innerWidth, window.innerHeight);
  canvas.resize(window.innerWidth, window.innerHeight);
});
