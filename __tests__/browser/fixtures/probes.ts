/** Observe native resource ownership without replacing the renderer or worker. */
export function installProbes() {
  const globalListeners: {
    target: EventTarget;
    type: string;
    listener: unknown;
    capture: boolean;
  }[] = [];
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  const types = new Set([
    'keydown',
    'keyup',
    'pointermove',
    'pointerup',
    'mousemove',
    'mouseup',
    'touchmove',
    'touchend',
  ]);
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    const capture = typeof options === 'boolean' ? options : !!options?.capture;
    if (
      (this === window || this === document) &&
      types.has(type) &&
      !globalListeners.some(
        (e) =>
          e.target === this &&
          e.type === type &&
          e.listener === listener &&
          e.capture === capture,
      )
    ) {
      globalListeners.push({ target: this, type, listener, capture });
    }
    return add.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function (
    type,
    listener,
    options,
  ) {
    const capture = typeof options === 'boolean' ? options : !!options?.capture;
    const index = globalListeners.findIndex(
      (e) =>
        e.target === this &&
        e.type === type &&
        e.listener === listener &&
        e.capture === capture,
    );
    if (index >= 0) globalListeners.splice(index, 1);
    return remove.call(this, type, listener, options);
  };
  const resources: { side: string; live: Map<string, Set<object>> }[] = [];
  const seen = new WeakSet<object>();
  const stacks = new WeakMap<object, string>();
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const context = getContext.apply(this, args);
    if (context && 'createBuffer' in context && !seen.has(context)) {
      seen.add(context);
      const live = new Map<string, Set<object>>();
      resources.push({
        side: this.closest('section')?.id || 'offscreen',
        live,
      });
      for (const kind of [
        'Buffer',
        'Texture',
        'Program',
        'Shader',
        'Framebuffer',
        'Renderbuffer',
        'VertexArray',
      ]) {
        const gl = context as unknown as Record<
          string,
          (...args: unknown[]) => object
        >;
        if (!gl[`create${kind}`]) continue;
        const create = gl[`create${kind}`].bind(gl),
          dispose = gl[`delete${kind}`].bind(gl);
        const objects = new Set<object>();
        live.set(kind, objects);
        gl[`create${kind}`] = (...values) => {
          const resource = create(...values);
          if (resource) {
            objects.add(resource);
            stacks.set(resource, new Error().stack!);
          }
          return resource;
        };
        gl[`delete${kind}`] = (resource) => {
          objects.delete(resource as object);
          return dispose(resource);
        };
      }
    }
    return context;
  } as typeof getContext;
  Object.assign(window, {
    lifecycleProbes: {
      listeners: () => globalListeners.length,
      leaks: () =>
        resources.flatMap((r) =>
          [...r.live.values()].flatMap((set) =>
            [...set].map((obj) => ({ side: r.side, stack: stacks.get(obj) })),
          ),
        ),
      resources: () =>
        resources.map(({ side, live }) => ({
          side,
          live: Object.fromEntries(
            [...live].map(([key, values]) => [key, values.size]),
          ),
        })),
    },
  });
}
