import { Canvas, ImageExporter, Rect, Polyline, Circle } from '../src';

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

const polyline1 = new Polyline({
  points: [
    [100, 100],
    [200, 200],
    [200, 100],
  ],
  stroke: 'red',
  strokeWidth: 20,
  // strokeAlignment: 'outer',
  strokeLinejoin: 'round',
  cullable: false,
  batchable: false,
});
canvas.appendChild(polyline1);

canvas.render();

const exporter = new ImageExporter({
  canvas,
});

const svg = exporter.toSVG({ grid: true });

console.log(svg);

// for (let i = 0; i < 1000; i++) {
//   const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
//     Math.random() * 255,
//   )},${Math.floor(Math.random() * 255)})`;
//   const rect = new Rect({
//     x: Math.random() * 1000,
//     y: Math.random() * 1000,
//     fill,
//     strokeWidth: 0,
//     cornerRadius: 10,
//   });
//   // rect.x = Math.random() * 1000;
//   // rect.y = Math.random() * 1000;
//   rect.width = Math.random() * 40;
//   rect.height = Math.random() * 40;
//   canvas.appendChild(rect);

//   rect.addEventListener('pointerenter', () => {
//     rect.fill = 'red';
//   });
//   rect.addEventListener('pointerleave', () => {
//     rect.fill = fill;
//   });
// }

// const rect = new Rect({
//   x: 50,
//   y: 50,
//   width: 50,
//   height: 50,
//   fill: 'black',
//   strokeWidth: 0,
//   dropShadowBlurRadius: 10,
//   dropShadowColor: 'black',
//   dropShadowOffsetX: 10,
//   dropShadowOffsetY: 10,
// });
// canvas.appendChild(rect);

// const rect2 = new Rect({
//   x: 100,
//   y: 100,
//   width: 50,
//   height: 50,
//   fill: 'black',
//   dropShadowBlurRadius: 10,
//   dropShadowColor: 'black',
//   dropShadowOffsetX: 10,
//   dropShadowOffsetY: 10,
//   batchable: false,
// });
// canvas.appendChild(rect2);

// const rect3 = new Rect({
//   x: 100,
//   y: 50,
//   width: 20,
//   height: 20,
//   fill: 'black',
//   dropShadowBlurRadius: 8,
//   dropShadowColor: 'black',
// });
// canvas.appendChild(rect3);

// canvas.render();

// const polyline1 = new Polyline({
//   points: [
//     [100, 100],
//     // [100, 200],
//     [200, 200],
//     [200, 100],
//   ],
//   stroke: 'red',
//   strokeWidth: 20,
//   // strokeAlignment: 'outer',
//   strokeLinejoin: 'round',
//   cullable: false,
//   batchable: false,
// });
// canvas.appendChild(polyline1);

// const polyline2 = new Polyline({
//   points: [
//     [220, 100],
//     [220, 200],
//     [320, 200],
//     [320, 100],
//   ],
//   stroke: 'green',
//   strokeWidth: 20,
//   strokeLinejoin: 'round',
//   // strokeAlignment: 'center',
//   cullable: false,
//   batchable: false,
// });
// canvas.appendChild(polyline2);

// canvas.render();

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
