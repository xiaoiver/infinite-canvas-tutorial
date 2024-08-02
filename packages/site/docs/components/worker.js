import { Canvas, Circle } from '@infinite-canvas-tutorial/core';

let canvas;
async function init(offscreenCanvas, devicePixelRatio) {
  canvas = await new Canvas({
    canvas: offscreenCanvas,
    devicePixelRatio,
    getBoundingClientRect: () => ({top: 0, left: 0}),
    setCursor: () => {},
  }).initialized;

  const circle = new Circle({
    cx: 100,
    cy: 100,
    r: 100,
    fill: 'red'
  });

  canvas.appendChild(circle);

  circle.addEventListener('pointerenter', () => {
    circle.fill = 'green';
  });
  circle.addEventListener('pointerleave', () => {
    circle.fill = 'red';
  });

  // const animate = () => {
  canvas.render();
  
  // 将渲染结果转换为ImageBitmap并发送到主线程
  const imageBitmap = offscreenCanvas.transferToImageBitmap();
  // eslint-disable-next-line no-undef
  self.postMessage(imageBitmap);

  //   requestAnimationFrame(animate);
  // };
  // animate();
}

// eslint-disable-next-line no-undef
self.onmessage = function(event) {
  const { type } = event.data;

  if (type === 'init') {
    const { offscreenCanvas, devicePixelRatio } = event.data;
    init(offscreenCanvas, devicePixelRatio);
  } else if (type === 'event') {
    const { name, event: ev, offscreenCanvas } = event.data;
    ev.target = offscreenCanvas;
    ev.preventDefault = () => {};
    ev.composedPath = () => {
      return [offscreenCanvas];
    };
  
    if (name === 'pointermove') {
      canvas.pluginContext.hooks.pointerMove.call(ev);
    } else if (name === 'pointerdown') {
      canvas.pluginContext.hooks.pointerDown.call(ev);
    } else if (name === 'pointerleave') {
      canvas.pluginContext.hooks.pointerOut.call(ev);
    } else if (name === 'pointerover') {
      canvas.pluginContext.hooks.pointerOver.call(ev);
    } else if (name === 'pointerup') {
      canvas.pluginContext.hooks.pointerUp.call(ev);
    }
  }
};