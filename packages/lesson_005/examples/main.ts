import { Canvas, Circle, Group } from '../src';
// import { GridImplementation } from '../src/plugins';

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

// canvas.setGridImplementation(GridImplementation.LINE_GEOMETRY);

const solarSystem = new Group();
const earthOrbit = new Group();
const moonOrbit = new Group();

const sun = new Circle({
  cx: 0,
  cy: 0,
  r: 100,
  fill: 'red',
});
const earth = new Circle({
  cx: 0,
  cy: 0,
  r: 50,
  fill: 'blue',
});
const moon = new Circle({
  cx: 0,
  cy: 0,
  r: 25,
  fill: 'yellow',
});
solarSystem.appendChild(sun);
solarSystem.appendChild(earthOrbit);
earthOrbit.appendChild(earth);
earthOrbit.appendChild(moonOrbit);
moonOrbit.appendChild(moon);

solarSystem.position.x = 300;
solarSystem.position.y = 300;
earthOrbit.position.x = 100;
moonOrbit.position.x = 100;

canvas.appendChild(solarSystem);

const animate = () => {
  solarSystem.rotation += 0.01;
  earthOrbit.rotation += 0.02;

  canvas.render();
  requestAnimationFrame(animate);
};
animate();

window.addEventListener('resize', () => {
  resize(window.innerWidth, window.innerHeight);
  canvas.resize(window.innerWidth, window.innerHeight);
});
