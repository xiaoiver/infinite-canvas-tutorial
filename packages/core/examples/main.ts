import {
  Canvas,
  ImageExporter,
  Rect,
  Polyline,
  Path,
  Circle,
  Ellipse,
  parsePath,
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

const svg = {
  circle: 'M40,0A40,40 0 1,1 0,-40A40,40 0 0,1 40,0Z',
  triangle: `M${[0, 1, 2]
    .map(
      (i) =>
        `${Math.sin((i / 3) * 2 * Math.PI)},${-Math.cos(
          (i / 3) * 2 * Math.PI,
        )}`,
    )
    .join('L')}Z`,
  square: `M1,1L-1,1L-1,-1L1,-1Z`,
  pentagon: `M${[0, 1, 2, 3, 4]
    .map(
      (i) =>
        `${Math.sin((i / 5) * 2 * Math.PI)},${-Math.cos(
          (i / 5) * 2 * Math.PI,
        )}`,
    )
    .join('L')}Z`,
  hexagon: `M${[0, 1, 2, 3, 4, 5]
    .map(
      (i) =>
        `${Math.sin((i / 6) * 2 * Math.PI)},${-Math.cos(
          (i / 6) * 2 * Math.PI,
        )}`,
    )
    .join('L')}Z`,
  star: `M${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    .map(
      (i) =>
        `${Math.sin((i / 10) * 2 * Math.PI) * (i % 2 === 1 ? 0.5 : 1)},${
          -Math.cos((i / 10) * 2 * Math.PI) * (i % 2 === 1 ? 0.5 : 1)
        }`,
    )
    .join('L')}Z`,
  plus: `M4,1L1,1L1,4L-1,4L-1,1L-4,1L-4,-1L-1,-1L-1,-4L1,-4L1,-1L4,-1Z`,
};

const path = new Path({
  d: 'M 100 100 L 200 200 L 300 100 Z',
});
canvas.appendChild(path);

// console.log(parsePath(svg.circle).subPaths[0].getPoints());

// const polyline1 = new Polyline({
//   points: [
//     [256, 100],
//     [356, 100],
//     [356, 200],
//     [256, 200],
//     [256, 100],
//     [256, 100.1],
//   ],
//   stroke: 'red',
//   strokeWidth: 20,
//   strokeLinejoin: 'round',
//   // strokeLinecap: 'square',
//   strokeDasharray: [5, 5],
//   // strokeDashoffset: 0,
//   // sizeAttenuation: false,
// });
// canvas.appendChild(polyline1);

// polyline1.strokeDasharray = [10, 10];
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

// const rect2 = new Rect({
//   x: 256,
//   y: 100,
//   width: 100,
//   height: 100,
//   fill: 'black',
//   fillOpacity: 0.5,
//   stroke: 'red',
//   strokeWidth: 10,
//   dropShadowBlurRadius: 10,
//   dropShadowColor: 'black',
//   dropShadowOffsetX: 10,
//   dropShadowOffsetY: 10,
//   strokeDasharray: [5, 5],
// });
// canvas.appendChild(rect2);

// const circle = new Circle({
//   cx: 350,
//   cy: 100,
//   r: 50,
//   fill: 'black',
//   stroke: 'red',
//   strokeWidth: 20,
//   fillOpacity: 0.5,
// });

// setTimeout(() => {
//   circle.strokeDasharray = [5, 5];
// }, 1000);
// canvas.appendChild(circle);

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
