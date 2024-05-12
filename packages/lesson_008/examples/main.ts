import { Canvas, Circle } from '../src';

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
  shaderCompilerPath:
    'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm',
}).initialized;

const circles: Circle[] = [];
for (let i = 0; i < 20000; i++) {
  const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
    Math.random() * 255,
  )},${Math.floor(Math.random() * 255)})`;
  const circle = new Circle({
    cx: Math.random() * 1000,
    cy: Math.random() * 1000,
    r: Math.random() * 20,
    fill,
    stroke: 'black',
    strokeWidth: 2,
    batchable: true,
  });
  canvas.appendChild(circle);
  circles.push(circle);

  circle.addEventListener('pointerenter', () => {
    circle.fill = 'red';
  });
  circle.addEventListener('pointerleave', () => {
    circle.fill = fill;
  });
}

const animate = () => {
  canvas.render();
  requestAnimationFrame(animate);
};
animate();

window.addEventListener('resize', () => {
  resize(window.innerWidth, window.innerHeight);
  canvas.resize(window.innerWidth, window.innerHeight);
});
