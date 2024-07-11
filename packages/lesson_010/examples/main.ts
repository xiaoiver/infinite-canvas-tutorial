import { Canvas, Circle, Ellipse, Rect } from '../src';

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
  shaderCompilerPath:
    'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm',
}).initialized;

for (let i = 0; i < 1; i++) {
  const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
    Math.random() * 255,
  )},${Math.floor(Math.random() * 255)})`;
  const circle = new Circle({
    // cx: Math.random() * 1000,
    // cy: Math.random() * 1000,
    // r: Math.random() * 20,
    cx: 300,
    cy: 300,
    r: 50,
    fill: 'red',
    // stroke: 'black',
    // strokeWidth: 20,
    opacity: 0.5,
    // strokeOpacity: 0.5,
  });
  canvas.appendChild(circle);

  const ellipse = new Ellipse({
    // cx: Math.random() * 1000,
    // cy: Math.random() * 1000,
    // rx: Math.random() * 20,
    // ry: Math.random() * 20,
    cx: 100,
    cy: 300,
    rx: 50,
    ry: 100,
    stroke: 'black',
    // strokeWidth: 20,
    // strokeOpacity: 0.5,
    fillOpacity: 0.5,
    fill: 'red',
  });
  canvas.appendChild(ellipse);

  const rect = new Rect({
    x: 0,
    y: 0,
    width: 400,
    height: 100,
    fill: 'red',
    // fillOpacity: 0.5,
    // strokeWidth: 10,
    // stroke: 'black',
    // strokeOpacity: 0.5,
    cornerRadius: 50,
    batchable: false,
    dropShadowColor: 'black',
    dropShadowOffsetX: 10,
    dropShadowOffsetY: 10,
    dropShadowBlurRadius: 10,
  });
  canvas.appendChild(rect);

  const rect2 = new Rect({
    x: 50,
    y: 50,
    width: 400,
    height: 100,
    fill: 'red',
    // fillOpacity: 0.5,
    // strokeWidth: 10,
    // stroke: 'black',
    // strokeOpacity: 0.5,
    // batchable: false,
    cornerRadius: 50,
    // dropShadowColor: 'black',
    // dropShadowOffsetX: 10,
    // dropShadowOffsetY: 10,
    // dropShadowBlurRadius: 10,
    innerShadowColor: 'blue',
    innerShadowOffsetX: 10,
    innerShadowOffsetY: 10,
    innerShadowBlurRadius: 10,
  });
  canvas.appendChild(rect2);

  // circle.addEventListener('pointerenter', () => {
  //   circle.fill = 'red';
  // });
  // circle.addEventListener('pointerleave', () => {
  //   circle.fill = fill;
  // });
}

// for (let i = 0; i < 100; i++) {
//   const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
//     Math.random() * 255,
//   )},${Math.floor(Math.random() * 255)})`;
//   const rect = new Rect({
//     x: Math.random() * 1000,
//     y: Math.random() * 1000,
//     fill,
//     batchable: false,
//     dropShadowColor: 'black',
//     dropShadowOffsetX: Math.random() * 5,
//     dropShadowOffsetY: Math.random() * 5,
//     dropShadowBlurRadius: Math.random() * 10,
//   });
//   rect.width = Math.random() * 40;
//   rect.height = Math.random() * 40;
//   rect.cornerRadius = Math.min(rect.width / 2, rect.height / 2);
//   canvas.appendChild(rect);

//   rect.addEventListener('pointerenter', () => {
//     rect.fill = 'red';
//   });
//   rect.addEventListener('pointerleave', () => {
//     rect.fill = fill;
//   });
// }

const animate = () => {
  canvas.render();
  requestAnimationFrame(animate);
};
animate();

window.addEventListener('resize', () => {
  resize(window.innerWidth, window.innerHeight);
  canvas.resize(window.innerWidth, window.innerHeight);
});
