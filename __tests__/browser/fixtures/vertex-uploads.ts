/** Observe native vertex-buffer uploads, including WebGL2 COPY_WRITE_BUFFER updates. */
export function installVertexUploadProbe() {
  const probe = {
    calls: 0,
    bytes: 0,
    allocations: 0,
    reset() {
      this.calls = this.bytes = this.allocations = 0;
    },
  };
  const get = HTMLCanvasElement.prototype.getContext;
  const seen = new WeakSet<object>();
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const context = get.apply(this, args);
    if (context && 'bufferSubData' in context && !seen.has(context)) {
      seen.add(context);
      const gl = context as WebGL2RenderingContext;
      const sub = gl.bufferSubData.bind(gl),
        data = gl.bufferData.bind(gl),
        bind = gl.bindBuffer.bind(gl);
      const vertices = new WeakSet<WebGLBuffer>(),
        bound = new Map<number, WebGLBuffer>();
      gl.bindBuffer = (target, buffer) => {
        if (buffer) {
          bound.set(target, buffer);
          if (target === gl.ARRAY_BUFFER) vertices.add(buffer);
        } else bound.delete(target);
        return bind(target, buffer);
      };
      gl.bufferSubData = ((...args: any[]) => {
        const [target, , src, srcOffset = 0, length] = args;
        if (vertices.has(bound.get(target))) {
          probe.calls++;
          probe.bytes += length ?? src.byteLength - srcOffset;
        }
        return sub(...(args as [number, number, ArrayBufferView]));
      }) as typeof gl.bufferSubData;
      gl.bufferData = ((
        target: number,
        src: number | ArrayBufferView,
        usage: number,
      ) => {
        if (target === gl.ARRAY_BUFFER) probe.allocations++;
        return data(target, src as ArrayBufferView, usage);
      }) as typeof gl.bufferData;
    }
    return context;
  } as typeof get;
  Object.assign(window, { vertexUploads: probe });
}
declare global {
  interface Window {
    vertexUploads: {
      calls: number;
      bytes: number;
      allocations: number;
      reset(): void;
    };
  }
}
