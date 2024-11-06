import {
  Canvas,
  ImageExporter,
  Rect,
  Polyline,
  Path,
  Circle,
  Ellipse,
  parsePath,
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

// const svg = {
//   circle: 'M40,0A40,40 0 1,1 0,-40A40,40 0 0,1 40,0Z',
//   triangle: `M${[0, 1, 2]
//     .map(
//       (i) =>
//         `${Math.sin((i / 3) * 2 * Math.PI)},${-Math.cos(
//           (i / 3) * 2 * Math.PI,
//         )}`,
//     )
//     .join('L')}Z`,
//   square: `M1,1L-1,1L-1,-1L1,-1Z`,
//   pentagon: `M${[0, 1, 2, 3, 4]
//     .map(
//       (i) =>
//         `${Math.sin((i / 5) * 2 * Math.PI)},${-Math.cos(
//           (i / 5) * 2 * Math.PI,
//         )}`,
//     )
//     .join('L')}Z`,
//   hexagon: `M${[0, 1, 2, 3, 4, 5]
//     .map(
//       (i) =>
//         `${Math.sin((i / 6) * 2 * Math.PI)},${-Math.cos(
//           (i / 6) * 2 * Math.PI,
//         )}`,
//     )
//     .join('L')}Z`,
//   star: `M${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
//     .map(
//       (i) =>
//         `${Math.sin((i / 10) * 2 * Math.PI) * (i % 2 === 1 ? 0.5 : 1)},${
//           -Math.cos((i / 10) * 2 * Math.PI) * (i % 2 === 1 ? 0.5 : 1)
//         }`,
//     )
//     .join('L')}Z`,
//   plus: `M4,1L1,1L1,4L-1,4L-1,1L-4,1L-4,-1L-1,-1L-1,-4L1,-4L1,-1L4,-1Z`,
// };

// const rect = new Rect({
//   x: 0,
//   y: 0,
//   width: 100,
//   height: 100,
//   fill: 'red',
//   stroke: 'black',
//   strokeWidth: 2,
// });
// canvas.appendChild(rect);
// rect.position.x = 100;
// rect.position.y = 100;

const polyline = new Polyline({
  points: [
    [10, 10],
    [90, 10],
    [90, 90],
    [10, 90],
    [10, 10],
    [NaN, NaN],
    [0, 0],
    [0, 100],
    [100, 100],
    [100, 0],
    [0, 0],
  ],
  // points: [
  //   [10, 10],
  //   [100, 0],
  //   [NaN, NaN],
  //   [100, 100],
  //   [200, 100],
  // ],
  stroke: 'black',
  strokeWidth: 8,
  strokeLinecap: 'round',
  fill: 'none',
});
canvas.appendChild(polyline);
polyline.position.x = 100;
polyline.position.y = 100;

fetch('/Ghostscript_Tiger.svg').then(async (res) => {
  const svg = await res.text();

  const $container = document.createElement('div');
  $container.innerHTML = svg;

  const group = await deserializeNode(
    fromSVGElement($container.children[0].children[0] as SVGElement),
  );
  console.log(group);

  canvas.appendChild(group);
});

const ring = new Path({
  // d: 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 Z M 50 30 A 20 20 0 1 1 50 70 A 20 20 0 1 1 50 30 Z',
  d: 'M 10 10 L 90 10 L 90 90 L 10 90 Z M 0 0 L 0 100 L 100 100 L 100 0 Z',
  // d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
  fill: 'black',
  // opacity: 0.5,
  // strokeWidth: 10,
  stroke: 'red',
  batchable: false,
});
ring.position.x = 200;
ring.position.y = 200;
canvas.appendChild(ring);

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
