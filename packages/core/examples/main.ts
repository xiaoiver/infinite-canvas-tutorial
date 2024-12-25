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

for (let i = 0; i < 2; i++) {
  const circle = new Circle({
    cx: i * 100,
    cy: i * 100,
    r: 50,
    fill: `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
      Math.random() * 255,
    )},${Math.floor(Math.random() * 255)})`,
    batchable: true,
    wireframe: true,
    stroke: 'black',
    strokeWidth: 10,
    strokeOpacity: 0.5,
  });
  canvas.appendChild(circle);
}

// const rect = new Rect({
//   x: 300,
//   y: 100,
//   width: 100,
//   height: 100,
//   fill: '#F67676',
//   // stroke: 'black',
//   // strokeWidth: 10,
//   dropShadowBlurRadius: 10,
//   dropShadowColor: 'rgba(0, 0, 0, 0.5)',
//   dropShadowOffsetX: 10,
//   dropShadowOffsetY: 10,
//   // batchable: false,
//   wireframe: true,
// });
// canvas.appendChild(rect);

// const path = new Path({
//   d: 'M 100 100 L 200 200 L 300 100 L 400 200 L 500 100 Z',
//   fill: '#F67676',
//   batchable: false,
//   wireframe: true,
// });
// canvas.appendChild(path);

// const polyline = new Polyline({
//   points: [
//     [100, 100],
//     [200, 200],
//     [300, 100],
//   ],
//   stroke: '#F67676',
//   strokeWidth: 20,
//   strokeLinecap: 'round',
//   strokeLinejoin: 'round',
//   // bowing: 2,
//   // roughness: 4,
//   wireframe: true,
// });
// canvas.appendChild(polyline);

// const text = new Text({
//   x: 50,
//   y: 50,
//   content: 'Hello, world!\n你好世界\n你好世界\n你好世界\n你好世界',
//   fontSize: 20,
//   fill: '#F67676',
// });
// canvas.appendChild(text);

// const bounds = text.getGeometryBounds();
// console.log(bounds);

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
