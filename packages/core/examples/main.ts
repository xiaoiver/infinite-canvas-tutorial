import { Canvas, Path, fromSVGElement, deserializeNode } from '../src';
import rough from 'roughjs';

const generator = rough.generator();
const rect = generator.rectangle(0, 0, 100, 100);

console.log(rect);

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

fetch(
  '/Ghostscript_Tiger.svg',
  // '/photo-camera.svg',
).then(async (res) => {
  const svg = await res.text();

  const $container = document.createElement('div');
  $container.innerHTML = svg;

  const $svg = $container.children[0];

  for (const child of $svg.children) {
    const group = await deserializeNode(fromSVGElement(child as SVGElement));
    canvas.appendChild(group);
  }
});

// const ring = new Path({
//   // d: 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 Z M 50 30 A 20 20 0 1 1 50 70 A 20 20 0 1 1 50 30 Z',
//   // d: 'M 10 10 L 90 10 L 90 90 L 10 90 Z M 0 0 L 0 100 L 100 100 L 100 0 Z',
//   // d: 'M 10 10 L 90 10 L 90 90 L 10 90 Z M 0 0 L 100 0 L 100 100 L 0 100 Z',
//   // d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
//   // d: 'M255.4,130.8c-53.8,0-97.6,43.8-97.6,97.6s43.8,97.6,97.6,97.6c53.8,0,97.6-43.8,97.6-97.6    C352.9,174.6,309.1,130.8,255.4,130.8z M255.4,303.7c-41.5,0-75.3-33.8-75.3-75.3s33.8-75.3,75.3-75.3s75.3,33.8,75.3,75.3    C330.7,269.9,296.9,303.7,255.4,303.7z',
//   fill: 'black',
//   // opacity: 0.5,
//   strokeWidth: 2,
//   stroke: 'red',
// });
// // ring.position.x = 200;
// // ring.position.y = 200;
// canvas.appendChild(ring);

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
