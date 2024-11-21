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
  renderer: 'webgpu',
  shaderCompilerPath: '/glsl_wgsl_compiler_bg.wasm',
}).initialized;

const rect1 = new RoughPolyline({
  points: [
    [50, 50],
    [50, 150],
    [150, 50],
  ],
  stroke: 'black',
  strokeWidth: 2,
  roughness: 2,
  // fill: 'none',
});
canvas.appendChild(rect1);
canvas.render();

console.log(toSVGElement(serializeNode(rect1)));

// const animate = () => {
//   canvas.render();
//   requestAnimationFrame(animate);
// };
// animate();

window.addEventListener('resize', () => {
  resize(window.innerWidth, window.innerHeight);
  canvas.resize(window.innerWidth, window.innerHeight);
});
