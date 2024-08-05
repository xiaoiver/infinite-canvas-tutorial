import _gl from 'gl';
import { JSDOM } from 'jsdom';

var lastTime = 0;
export const requestAnimationFrame = function (callback) {
  var currTime = new Date().getTime();
  var timeToCall = Math.max(0, 16 - (currTime - lastTime));
  var id = setTimeout(function () {
    callback(currTime + timeToCall);
  }, timeToCall);
  lastTime = currTime + timeToCall;
  return id;
};

export const cancelAnimationFrame = function (id) {
  clearTimeout(id);
};

export function sleep(n: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, n);
  });
}

export function getCanvas(width = 100, height = 100) {
  let gl = _gl(width, height, {
    antialias: false,
    preserveDrawingBuffer: true,
    stencil: true,
  });

  const mockedCanvas: HTMLCanvasElement = {
    width,
    height,
    // @ts-ignore
    getContext: () => {
      // @ts-ignore
      gl.canvas = mockedCanvas;
      // 模拟 DOM API，返回小程序 context，它应当和 CanvasRenderingContext2D 一致
      // @see https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLCanvasElement/getContext
      return gl;
    },
    addEventListener: () => {},
  };

  return mockedCanvas;
}

export function createMouseEvent(type: string, options: any = {}) {
  const window = new JSDOM().window;
  return new (window as any).MouseEvent(type, {
    altKey: false,
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    clientX: 0,
    clientY: 0,
    composed: true,
    ctrlKey: false,
    detail: 0,
    height: 1,
    isPrimary: true,
    metaKey: false,
    movementX: 0,
    movementY: 0,
    pointerId: 1,
    pointerType: 'mouse',
    pressure: 0.5,
    relatedTarget: null,
    screenX: 0,
    screenY: 0,
    shiftKey: false,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    view: window,
    which: 1,
    width: 1,
    ...options,
  });
}
