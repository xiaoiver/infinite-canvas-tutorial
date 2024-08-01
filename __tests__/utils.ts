import _gl from 'gl';

export function sleep(n: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, n);
  });
}

export function getCanvas(width = 100, height = 100) {
  let gl = _gl(width, height, {
    antialias: false,
    preserveDrawingBuffer: true,
    stencil: false,
    premultipliedAlpha: false,
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
