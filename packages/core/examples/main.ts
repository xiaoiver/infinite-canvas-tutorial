import { Canvas, ImageExporter, Rect, Polyline, Circle, Ellipse } from '../src';

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

// const polyline1 = new Polyline({
//   points: [
//     [100, 100],
//     [100, 200],
//     [200, 200],
//     [200, 100],
//   ],
//   stroke: 'red',
//   strokeWidth: 20,
//   // strokeLinejoin: 'round',
//   // strokeDasharray: [10, 10],
//   // strokeDashoffset: 0,
//   // sizeAttenuation: false,
// });
// canvas.appendChild(polyline1);

// polyline1.strokeDasharray = [10, 10];

// canvas.render();

// polyline1.addEventListener('pointerenter', () => {
//   polyline1.stroke = 'green';
// });
// polyline1.addEventListener('pointerleave', () => {
//   polyline1.stroke = 'red';
// });

// const exporter = new ImageExporter({
//   canvas,
// });

// const svg = exporter.toSVG({ grid: true });

// console.log(svg);

// const rect = new Rect({
//   x: 50,
//   y: 50,
//   width: 50,
//   height: 50,
//   fill: 'black',
//   fillOpacity: 0.5,
//   dropShadowBlurRadius: 10,
//   dropShadowColor: 'black',
//   dropShadowOffsetX: 10,
//   dropShadowOffsetY: 10,
//   stroke: 'red',
//   strokeWidth: 10,
//   // strokeAlignment: 'inner',
//   strokeDasharray: [5, 5],
//   strokeDashoffset: 0,
// });
// rect.strokeDasharray = [5, 5];
// canvas.appendChild(rect);

// const rect2 = new Rect({
//   x: 150,
//   y: 50,
//   width: 50,
//   height: 50,
//   fill: 'black',
//   fillOpacity: 0.5,
//   stroke: 'red',
//   strokeWidth: 10,
//   dropShadowBlurRadius: 10,
//   dropShadowColor: 'black',
//   dropShadowOffsetX: 10,
//   dropShadowOffsetY: 10,
// });
// canvas.appendChild(rect2);

const circle = new Circle({
  cx: 350,
  cy: 100,
  r: 50,
  fill: 'black',
  stroke: 'red',
  strokeWidth: 20,
  fillOpacity: 0.5,
});

setTimeout(() => {
  circle.strokeDasharray = [5, 5];
}, 1000);
canvas.appendChild(circle);

// const ellipse = new Ellipse({
//   cx: 350,
//   cy: 300,
//   rx: 100,
//   ry: 50,
//   fill: 'black',
//   stroke: 'red',
//   strokeWidth: 20,
//   fillOpacity: 0.5,
//   strokeDasharray: [5, 5],
// });
// canvas.appendChild(ellipse);

canvas.render();

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
