import { Canvas, Circle } from '@infinite-canvas-tutorial/core';

let canvas;
async function init(data) {
  const { offscreenCanvas, devicePixelRatio, boundingClientRect } = data;
  offscreenCanvas.getBoundingClientRect = () => boundingClientRect;
  canvas = await new Canvas({
    canvas: offscreenCanvas,
    devicePixelRatio,
    setCursor: (cursor) => {
      // eslint-disable-next-line no-undef
      self.postMessage({ type: 'cursor', cursor });
    },
  }).initialized;

  const circle = new Circle({
    cx: 100,
    cy: 100,
    r: 100,
    stroke: 'black',
    strokeWidth: 20,
    strokeOpacity: 0.5,
    fill: 'red',
    cursor: 'pointer',
    pointerEvents: 'stroke'
  });

  canvas.appendChild(circle);

  circle.addEventListener('pointerenter', () => {
    circle.fill = 'green';
  });
  circle.addEventListener('pointerleave', () => {
    circle.fill = 'red';
  });

  const animate = () => {
    canvas.render();
    // eslint-disable-next-line no-undef
    self.postMessage({ type: 'frame' });
    // eslint-disable-next-line no-undef
    self.requestAnimationFrame(animate);
  };
  animate();
}

// eslint-disable-next-line no-undef
self.onmessage = function(event) {
  const { type } = event.data;

  if (type === 'init') {
    init(event.data);
  } else if (type === 'resize') {
    const { width, height } = event.data;
    canvas.resize(width, height);
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
    }  else if (name === 'pointercanel') {
      canvas.pluginContext.hooks.pointerCancel.call(ev);
    } else if (name === 'wheel') {
      canvas.pluginContext.hooks.pointerWheel.call(ev);
    }
  }
};