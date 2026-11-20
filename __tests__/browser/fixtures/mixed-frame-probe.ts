/** Benchmark-only native work counters, scoped to one owned WebGL2 context. */
export function mixedFrameProbe(canvas: HTMLCanvasElement) {
  const empty = () => ({
    drawcalls: 0,
    indices: 0,
    arrayVertices: 0,
    bufferUploads: 0,
    bufferBytes: 0,
    uniformUploads: 0,
    uniformBytes: 0,
  });
  let work = empty();
  const undo: (() => void)[] = [];
  let installed = false;
  let context: WebGL2RenderingContext | undefined;
  const storage = new Map<WebGLBuffer, number>();
  const bindings = new Map<number, WebGLBuffer | null>();
  const uniforms = new WeakSet<WebGLBuffer>();
  function install(gl: WebGL2RenderingContext) {
    installed = true;
    context = gl;
    function wrap(name: string, observe: (args: any[]) => void) {
      const target = gl as unknown as Record<
        string,
        (...args: any[]) => unknown
      >;
      const original = target[name];
      const descriptor = Object.getOwnPropertyDescriptor(target, name);
      target[name] = function (...args: any[]) {
        const result = original.apply(this, args);
        observe(args);
        return result;
      };
      undo.push(() => {
        if (descriptor) Object.defineProperty(target, name, descriptor);
        else delete target[name];
      });
    }
    wrap('bindBuffer', ([target, buffer]) => bindings.set(target, buffer));
    wrap('bufferData', ([target, source, _usage, offset = 0, length]) => {
      const buffer = bindings.get(target);
      if (target === gl.UNIFORM_BUFFER && buffer) uniforms.add(buffer);
      if (buffer) {
        const stride = source?.BYTES_PER_ELEMENT ?? 1;
        storage.set(
          buffer,
          typeof source === 'number'
            ? source
            : length === undefined || length === 0
            ? (source?.byteLength ?? 0) - offset * stride
            : length * stride,
        );
      }
    });
    wrap('bufferSubData', ([target, _offset, data, offset = 0, length]) => {
      const stride = data.BYTES_PER_ELEMENT ?? 1;
      const bytes =
        length === undefined || length === 0
          ? data.byteLength - offset * stride
          : length * stride;
      work.bufferUploads++;
      work.bufferBytes += bytes;
      const buffer = bindings.get(target);
      if (buffer && uniforms.has(buffer)) {
        work.uniformUploads++;
        work.uniformBytes += bytes;
      }
    });
    wrap('deleteBuffer', ([buffer]) => storage.delete(buffer));
    wrap('drawElements', ([, count]) => {
      work.drawcalls++;
      work.indices += count;
    });
    wrap('drawElementsInstanced', ([, count, , , instances]) => {
      work.drawcalls++;
      work.indices += count * instances;
    });
    wrap('drawArrays', ([, , count]) => {
      work.drawcalls++;
      work.arrayVertices += count;
    });
    wrap('drawArraysInstanced', ([, , count, instances]) => {
      work.drawcalls++;
      work.arrayVertices += count * instances;
    });
  }
  // Observe the context from its first real acquisition, preserving renderer attributes.
  // This includes the scene UBO created during renderer initialization.
  const original = canvas.getContext;
  const descriptor = Object.getOwnPropertyDescriptor(canvas, 'getContext');
  Object.defineProperty(canvas, 'getContext', {
    configurable: true,
    writable: true,
    value: function (...args: any[]) {
      const context = (original as any).apply(this, args);
      if (args[0] === 'webgl2' && context && !installed) install(context);
      return context;
    },
  });
  undo.unshift(() => {
    if (descriptor) Object.defineProperty(canvas, 'getContext', descriptor);
    else delete (canvas as any).getContext;
  });
  return {
    ready: () => installed,
    webglError: () => context?.getError(),
    allocatedBufferBytes: () =>
      [...storage.values()].reduce((sum, bytes) => sum + bytes, 0),
    reset() {
      work = empty();
    },
    snapshot: () => ({ ...work }),
    dispose() {
      undo.reverse().forEach((restore) => restore());
      storage.clear();
      bindings.clear();
    },
  };
}
