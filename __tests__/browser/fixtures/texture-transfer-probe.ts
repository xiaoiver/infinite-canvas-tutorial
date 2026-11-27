/** Native texture calls/typed source bytes; no timers or GPU queries. */
export function installTextureTransfers() {
  if ((window as any).textureTransfers)
    throw new Error('Texture probe already installed');
  let disposed = false;
  const wrapped = new WeakMap<object, Set<string>>();
  const empty = () => ({
    creates: 0,
    deletes: 0,
    uploads: 0,
    typedBytes: 0,
    domUploads: 0,
    offsetUploads: 0,
    rgba32fBytesPeak: 0,
  });
  let work = empty();
  const sizes = new Map<object, number>();
  const states = new WeakMap<
    object,
    { unit: number; bindings: Map<string, object | null> }
  >();
  const allStates = new Set<{
    unit: number;
    bindings: Map<string, object | null>;
  }>();
  const undo: (() => void)[] = [];
  const live = () => [...sizes.values()].reduce((n, v) => n + v, 0);
  const state = (gl: any) => {
    let s = states.get(gl);
    if (!s) {
      s = { unit: gl.TEXTURE0, bindings: new Map() };
      states.set(gl, s);
      allStates.add(s);
    }
    return s;
  };
  for (const proto of [
    window.WebGLRenderingContext?.prototype,
    window.WebGL2RenderingContext?.prototype,
  ]) {
    if (!proto) continue;
    const wrap = (
      name: string,
      observe: (gl: any, args: any[], result: any) => void,
    ) => {
      let target: any = proto;
      while (target && !Object.getOwnPropertyDescriptor(target, name))
        target = Object.getPrototypeOf(target);
      if (!target || typeof target[name] !== 'function') return;
      let names = wrapped.get(target);
      if (!names) wrapped.set(target, (names = new Set()));
      if (names.has(name)) return;
      names.add(name);
      const original = target[name];
      const descriptor = Object.getOwnPropertyDescriptor(target, name);
      Object.defineProperty(target, name, {
        configurable: true,
        writable: true,
        value: function (...args: any[]) {
          const result = original.apply(this, args);
          if (!disposed) observe(this, args, result);
          return result;
        },
      });
      undo.push(() => {
        if (descriptor) Object.defineProperty(target, name, descriptor);
        else delete target[name];
      });
    };
    wrap('createTexture', () => work.creates++);
    wrap('deleteTexture', (_gl, [texture]) => {
      work.deletes++;
      sizes.delete(texture);
      for (const s of allStates)
        for (const [k, v] of s.bindings)
          if (v === texture) s.bindings.set(k, null);
    });
    wrap('activeTexture', (gl, [unit]) => {
      state(gl).unit = unit;
    });
    wrap('bindTexture', (gl, [target, texture]) => {
      const s = state(gl);
      s.bindings.set(`${s.unit}:${target}`, texture);
    });
    const storage = (
      gl: any,
      target: number,
      format: number,
      width: number,
      height: number,
      levels: number,
    ) => {
      const s = state(gl),
        t = s.bindings.get(`${s.unit}:${target}`);
      if (!t || target !== gl.TEXTURE_2D) return;
      if (format === gl.RGBA32F) {
        let bytes = 0;
        for (let l = 0; l < levels; l++)
          bytes += Math.max(1, width >> l) * Math.max(1, height >> l) * 16;
        sizes.set(t, bytes);
      } else sizes.delete(t);
      work.rgba32fBytesPeak = Math.max(work.rgba32fBytesPeak, live());
    };
    wrap('texStorage2D', (gl, [target, levels, format, width, height]) =>
      storage(gl, target, format, width, height, levels),
    );
    const upload = (args: any[]) => {
      const source = args.length >= 9 ? args[8] : args.at(-1);
      if (source == null) return;
      work.uploads++;
      if (ArrayBuffer.isView(source)) {
        if (args.length >= 10 && args[9]) work.offsetUploads++;
        else work.typedBytes += source.byteLength;
      } else if (typeof source === 'number') work.offsetUploads++;
      else work.domUploads++;
    };
    wrap('texImage2D', (gl, args) => {
      if (args.length >= 9 && args[1] === 0)
        storage(
          gl,
          args[0],
          args[2] === gl.RGBA && args[7] === gl.FLOAT ? gl.RGBA32F : args[2],
          args[3],
          args[4],
          1,
        );
      upload(args);
    });
    wrap('texSubImage2D', (_gl, args) => upload(args));
  }
  const probe = {
    reset() {
      work = empty();
      work.rgba32fBytesPeak = live();
    },
    snapshot() {
      return { ...work, rgba32fBytesLive: live() };
    },
    dispose() {
      disposed = true;
      undo
        .splice(0)
        .reverse()
        .forEach((f) => f());
      sizes.clear();
      for (const s of allStates) s.bindings.clear();
      allStates.clear();
      delete (window as any).textureTransfers;
      return true;
    },
  };
  (window as any).textureTransfers = probe;
}
declare global {
  interface Window {
    textureTransfers?: {
      reset(): void;
      snapshot(): {
        creates: number;
        deletes: number;
        uploads: number;
        typedBytes: number;
        domUploads: number;
        offsetUploads: number;
        rgba32fBytesPeak: number;
        rgba32fBytesLive: number;
      };
      dispose(): boolean;
    };
  }
}
