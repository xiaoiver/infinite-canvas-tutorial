/** Example-only, per-context counters. No WebGL prototypes or renderer APIs change. */
export interface WebGLFrameWork {
  drawcalls: number;
  indices: number;
  vertices: number;
}

export function observeWebGLFrame(
  device: { beginFrame(): void; endFrame(): void },
  canvas: HTMLCanvasElement,
  report: (work: WebGLFrameWork) => void,
) {
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) throw new Error('This example requires WebGL.');
  const restore: (() => void)[] = [];
  let active = false;
  let work: WebGLFrameWork = { drawcalls: 0, indices: 0, vertices: 0 };
  function wrap(
    target: object,
    key: string,
    around: (call: () => unknown, args: number[]) => unknown,
  ) {
    const object = target as Record<string, (...args: number[]) => unknown>;
    const original = object[key];
    if (!original) return;
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    object[key] = function (...args: number[]) {
      return around(() => original.apply(this, args), args);
    };
    restore.push(() => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else delete object[key];
    });
  }
  wrap(device, 'beginFrame', (call) => {
    work = { drawcalls: 0, indices: 0, vertices: 0 };
    active = true;
    return call();
  });
  wrap(device, 'endFrame', (call) => {
    try {
      return call();
    } finally {
      active = false;
      report({ ...work });
    }
  });
  function draw(indexed: boolean, instances: boolean) {
    return (call: () => unknown, args: number[]) => {
      const result = call();
      if (active) {
        work.drawcalls++;
        const count = indexed ? args[1] : args[2];
        const rows = instances ? args[indexed ? 4 : 3] : 1;
        work[indexed ? 'indices' : 'vertices'] += count * rows;
      }
      return result;
    };
  }
  wrap(gl, 'drawElements', draw(true, false));
  wrap(gl, 'drawArrays', draw(false, false));
  if ('drawElementsInstanced' in gl) {
    wrap(gl, 'drawElementsInstanced', draw(true, true));
    wrap(gl, 'drawArraysInstanced', draw(false, true));
  } else {
    const extension = gl.getExtension('ANGLE_instanced_arrays');
    if (extension) {
      wrap(extension, 'drawElementsInstancedANGLE', draw(true, true));
      wrap(extension, 'drawArraysInstancedANGLE', draw(false, true));
    }
  }
  return () => {
    active = false;
    restore.reverse().forEach((undo) => undo());
  };
}
