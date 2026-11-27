import type { Page } from '@playwright/test';

/** Isolated diagnostic recorder. No production imports, GPU writes or timers. */
export function createStrokeUploadProbe() {
  type Callback = (this: any, ...args: any[]) => any;
  const restores: (() => void)[] = [],
    touched: [any, string][] = [],
    owned = new Set<Callback>();
  const deviceStates = new Set<Map<string, any>>();
  let devices = new WeakMap<object, Map<string, any>>(),
    pages = new WeakMap<object, any>();
  let heldIds = new WeakMap<object, number>(),
    nextHeldId = 0;
  const stack: { owner: any; ids: string[] }[] = [];
  const empty = () => ({
    packedCalls: 0,
    nodeSamples: 0,
    firstNodes: 0,
    unchangedGeometryNodes: 0,
    changedGeometryNodes: 0,
    unchangedGeometryBytes: 0,
    unchangedPayloadBytes: 0,
    placementChanges: 0,
    packedBytes: 0,
    spanUploadBytes: 0,
    capacityUploadBytes: 0,
    capacityAllocations: 0,
  });
  let active = false,
    counts = empty(),
    loads = 0,
    packModules = 0;
  const words = (data: Float32Array) =>
    new Uint32Array(data.buffer, data.byteOffset, data.length);
  const same = (a: Float32Array, b: Float32Array) => {
    if (a.length !== b.length) return false;
    const av = words(a),
      bv = words(b);
    return av.every((v, i) => v === bv[i]);
  };
  const span = (old: Float32Array | undefined, next: Float32Array) => {
    const n = words(next),
      o = old && words(old);
    let start = 0,
      end = n.length;
    while (start < end && o && start < o.length && n[start] === o[start])
      start++;
    while (end > start && o && end - 1 < o.length && n[end - 1] === o[end - 1])
      end--;
    return (end - start) * 4;
  };
  const wrap = (
    target: any,
    key: string,
    invoke: (f: Callback, self: any, args: any[]) => any,
  ) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key),
      f = target[key];
    if (typeof f !== 'function')
      throw new Error('Missing stroke probe method ' + key);
    const wrapper = function (this: any, ...args: any[]) {
      return invoke(f, this, args);
    };
    Object.defineProperty(target, key, {
      configurable: true,
      writable: true,
      enumerable: descriptor?.enumerable ?? false,
      value: wrapper,
    });
    owned.add(wrapper);
    touched.push([target, key]);
    restores.push(() => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else delete target[key];
    });
  };
  const installed = new WeakSet<object>();
  const probe = {
    packedModuleLoaded() {
      packModules++;
    },
    install(Ctor: any, backend: 'core' | 'ecs') {
      if (installed.has(Ctor))
        throw new Error('Upload probe already installed');
      installed.add(Ctor);
      loads++;
      wrap(Ctor.prototype, 'createGeometry', (f, self, args) => {
        const frame = { owner: self, ids: [] as string[] };
        stack.push(frame);
        try {
          return f.apply(self, args);
        } finally {
          stack.pop();
        }
      });
      wrap(Ctor.prototype, 'getStrokeBuffers', (f, self, args) => {
        const result = f.apply(self, args),
          frame = stack.at(-1);
        if (frame?.owner === self) {
          const ordinal = backend === 'core' ? args[0].uid : args[0].ordinal;
          if (!Number.isSafeInteger(ordinal) || ordinal < 0)
            throw new Error('Invalid stroke owner identity');
          let id = `core:${ordinal}`;
          if (backend === 'ecs') {
            // Ordinals may overlap across concurrent systems. Weak held handles
            // identify entities without retaining borrowed query handles.
            const held = args[0].hold();
            let key = heldIds.get(held);
            if (key === undefined) {
              key = ++nextHeldId;
              heldIds.set(held, key);
            }
            id = `ecs:${key}`;
          }
          frame.ids.push(id);
        }
        return result;
      });
      wrap(Ctor.prototype, 'destroy', (f, self, args) => {
        pages.delete(self);
        return f.apply(self, args);
      });
    },
    packed(
      parts: readonly {
        points: readonly number[];
        travel: readonly number[];
        translationAndOrder: readonly number[];
      }[],
      stride: 1 | 3,
      points: Float32Array,
      travel: Float32Array,
    ) {
      const frame = stack.at(-1);
      if (!frame) return;
      if (frame.ids.length !== parts.length)
        throw new Error('Stroke owner/part mismatch');
      let states = devices.get(frame.owner.device);
      if (!states) {
        states = new Map();
        devices.set(frame.owner.device, states);
        deviceStates.add(states);
      }
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i],
          id = frame.ids[i],
          rows = Math.max(0, Math.ceil(part.points.length / 3 - 3));
        const p = new Float32Array(part.points),
          t = new Float32Array(rows * stride),
          placement = new Float32Array(part.translationAndOrder);
        for (let j = 0; j < t.length; j++) t[j] = part.travel[j] ?? 0;
        const old = states.get(id),
          equal = old && same(old.p, p) && same(old.t, t),
          placed = old && same(old.placement, placement);
        if (active) {
          counts.nodeSamples++;
          if (!old) counts.firstNodes++;
          else if (equal) {
            counts.unchangedGeometryNodes++;
            counts.unchangedGeometryBytes += rows * (12 + stride) * 4;
          } else counts.changedGeometryNodes++;
          if (old && !placed) counts.placementChanges++;
          if (equal && placed)
            counts.unchangedPayloadBytes += rows * (15 + stride) * 4;
        }
        states.set(id, { p, t, placement });
      }
      const old = pages.get(frame.owner),
        rows = points.length / 15;
      // Diagnostic model only: power-of-two capacity without shrinking.
      // Actual GL allocation counters come from the independent native probe.
      const grow = !old || rows > old.capacity;
      const capacity = grow
        ? Math.max(16, 2 ** Math.ceil(Math.log2(rows || 1)))
        : old.capacity;
      if (active) {
        counts.packedCalls++;
        counts.packedBytes += points.byteLength + travel.byteLength;
        const bytes = span(old?.points, points) + span(old?.travel, travel);
        counts.spanUploadBytes += bytes;
        counts.capacityUploadBytes += grow
          ? points.byteLength + travel.byteLength
          : bytes;
        if (grow) counts.capacityAllocations += 2;
      }
      pages.set(frame.owner, {
        points: points.slice(),
        travel: travel.slice(),
        capacity,
      });
    },
    begin() {
      if (active || stack.length)
        throw new Error('Upload probe already active');
      counts = empty();
      active = true;
    },
    take() {
      if (!active || stack.length)
        throw new Error('Upload probe frame not complete');
      active = false;
      return { ...counts, loads, packModules };
    },
    dispose() {
      active = false;
      if (stack.length) throw new Error('Upload probe still running');
      restores
        .splice(0)
        .reverse()
        .forEach((f) => f());
      for (const [target, key] of touched)
        if (owned.has(target[key])) throw new Error('Upload wrapper survived');
      for (const state of deviceStates) state.clear();
      deviceStates.clear();
      devices = new WeakMap();
      pages = new WeakMap();
      heldIds = new WeakMap();
      touched.length = 0;
      owned.clear();
      delete (window as any).strokeUploadProbe;
      return true;
    },
  };
  (window as any).strokeUploadProbe = probe;
}

/** Observe the original emitted buffers. Rewritten modules stay in this page only. */
export async function installStrokeUploadProbe(page: Page) {
  await page.addInitScript(createStrokeUploadProbe);
  await page.route('**/utils/stroke-batching.ts*', async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    const matches = [...body.matchAll(/return\s*\{\s*points,\s*travel\s*\};/g)];
    if (matches.length !== 1)
      throw new Error('Missing packed stroke observer source');
    body = body.replace(
      matches[0][0],
      'globalThis.strokeUploadProbe?.packed(parts,travelStride,points,travel);\n' +
        matches[0][0],
    );
    body += '\nglobalThis.strokeUploadProbe?.packedModuleLoaded();\n';
    await route.fulfill({ response, body });
  });
  await page.route(
    /\/(benchmark-entry|core-path-instances|polyline-lod)\.ts(?:\?|$)/,
    async (route) => {
      const url = route.request().url(),
        path = new URL(url).pathname;
      const workflow =
        path === '/benchmark-entry.ts' ||
        path.endsWith('/examples/workflow-canvas/benchmark-entry.ts');
      const fixture =
        path === '/core-path-instances.ts' ||
        path === '/polyline-lod.ts' ||
        /\/__tests__\/browser\/fixtures\/(core-path-instances|polyline-lod)\.ts$/.test(
          path,
        );
      if (!workflow && !fixture) {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      let body = await response.text();
      if (workflow)
        body =
          'globalThis.strokeUploadProbe.install(StrokeBatch,"ecs");\n' + body;
      else {
        const matches = [
          ...body.matchAll(
            /const strokeCPU\s*=\s*strokeReuseProbe\([\s\S]*?\);/g,
          ),
        ];
        if (matches.length !== 1)
          throw new Error('Missing fixture stroke scope');
        const core = url.includes('/core-path-instances.ts');
        body = body.replace(
          matches[0][0],
          matches[0][0] +
            `\nglobalThis.strokeUploadProbe.install(${
              core ? 'StrokeBatch' : 'ReplayStrokeBatch'
            },"${core ? 'core' : 'ecs'}");\n`,
        );
      }
      await route.fulfill({ response, body });
    },
  );
}
