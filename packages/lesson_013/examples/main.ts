import {
  Canvas,
  RoughRect,
  RoughCircle,
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

// 添加一个文本描边测试
// 首先检查Text类是否可用
try {
  // 如果Text类可用，则使用它
  // 这里我们需要使用ECS版本的Text组件
  console.log('Testing text stroke functionality...');

  // 创建一个简单的文本元素用于测试
  // 注意：这需要根据实际的Text类实现来调整
} catch (error) {
  console.log('Text class not available in this lesson:', error);
}

// fetch(
//   '/Ghostscript_Tiger.svg',
//   // '/photo-camera.svg',
// ).then(async (res) => {
//   const svg = await res.text();

//   const $container = document.createElement('div');
//   $container.innerHTML = svg;

//   const $svg = $container.children[0];

//   for (const child of $svg.children) {
//     const group = await deserializeNode(fromSVGElement(child as SVGElement));
//     canvas.appendChild(group);
//   }
// });

// const circle = new RoughCircle({
//   cx: 0,
//   cy: 0,
//   r: 50,
//   fill: 'black',
//   strokeWidth: 2,
//   stroke: 'red',
//   fillStyle: 'solid',
// });
// canvas.appendChild(circle);

const ring = new RoughRect({
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  fill: 'black',
  strokeWidth: 2,
  stroke: 'red',
  fillStyle: 'hachure',
});
ring.position.x = 200;
ring.position.y = 200;
ring.width = 100;
ring.height = 100;
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
