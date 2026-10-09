import {
  Brush,
  Circle,
  DropShadow,
  Ellipse,
  Extrude3D,
  FillLayers,
  FractionalIndex,
  GeometryDirty,
  Opacity,
  Line,
  MaterialDirty,
  Path,
  Polyline,
  Rect,
  Renderable,
  Rough,
  Stroke,
  Text,
  UI,
  VectorNetwork,
  type API,
  type Entity,
} from '../../packages/ecs/src';
import { BatchManager } from '../../packages/ecs/src/systems/BatchManager';
import {
  Drawcall,
  Mesh,
  SDF,
  SDFText,
  ShadowRect,
  SmoothPolyline,
  StampBrush,
} from '../../packages/ecs/src/drawcalls';
import { RenderCache } from '../../packages/ecs/src/utils/render-cache';
import type { Device } from '../../packages/device-api/src';
import type { RGGraphBuilder } from '../../packages/ecs/src/render-graph/interface';

// Real drawcall classes/checks/validation; only scene storage and GPU submission
// are boundaries. No generated constructor substitutes in batch selection tests.
function shape(
  type: unknown = Rect,
  batchable = true,
  ...extra: [unknown, unknown][]
) {
  const data = new Map<unknown, any>([
    [type, {}],
    [Renderable, { batchable }],
    ...extra,
  ]);
  const node: { blendMode?: string } = {};
  const entity = {
    has: (component: unknown) => data.has(component),
    hasSomeOf: (...components: unknown[]) =>
      components.some((component) => data.has(component)),
    read: (component: unknown) => {
      if (!data.has(component))
        throw new Error(`Unexpected component read: ${String(component)}`);
      return data.get(component);
    },
    remove: (component: unknown) => data.delete(component),
    node,
  } as unknown as Entity;
  return { entity, data, node };
}
const managers: BatchManager[] = [];
function manager() {
  const batch = new BatchManager(null, null, null, null, {
    getNodeByEntity: (entity: Entity) => (entity as any).node,
  } as API);
  managers.push(batch);
  return batch;
}
const queued = (batch: BatchManager) =>
  batch.buildFlushSegments().flatMap((segment) => segment.drawcalls);
afterEach(() => {
  managers.splice(0).forEach((batch) => batch.destroy());
  jest.restoreAllMocks();
});

it.each<[unknown, boolean, unknown[]]>([
  [Circle, false, [SDF]],
  [Ellipse, false, [SDF]],
  [Rect, false, [SDF]],
  [Line, false, [SmoothPolyline]],
  [Polyline, false, [SmoothPolyline]],
  [Path, false, [Mesh]],
  [VectorNetwork, false, [Mesh, SmoothPolyline]],
  [Text, false, [SDFText]],
  [Brush, false, [StampBrush]],
  [Circle, true, [Mesh, SmoothPolyline, SmoothPolyline]],
  [Ellipse, true, [Mesh, SmoothPolyline, SmoothPolyline]],
  [Rect, true, [Mesh, SmoothPolyline, SmoothPolyline]],
  [Path, true, [Mesh, SmoothPolyline, SmoothPolyline]],
])(
  'selects actual renderer classes for %p (rough=%s)',
  (type, rough, constructors) => {
    const batch = manager();
    const node = shape(
      type,
      true,
      ...(rough ? [[Rough, {}] as [unknown, unknown]] : []),
    );
    batch.add(node.entity);
    expect(queued(batch).map((drawcall) => drawcall.constructor)).toEqual(
      constructors,
    );
    expect(
      queued(batch).every((drawcall) => drawcall.shapes.includes(node.entity)),
    ).toBe(true);
  },
);

it('does not reuse an empty shadow/fill batch for a fill/dashed-stroke shape with the same drawcall count', () => {
  const batch = manager();
  const old = shape(Rect, true, [DropShadow, { blurRadius: 4 }]);
  batch.add(old.entity);
  const cached = queued(batch);
  expect(cached.map((d) => d.constructor)).toEqual([ShadowRect, SDF]);
  batch.remove(old.entity);
  expect(batch.stats().drawcallCount).toBe(0);
  const next = shape(Rect, true, [Stroke, { width: 2, dasharray: [2, 2] }]);
  batch.add(next.entity);
  expect(queued(batch).map((d) => d.constructor)).toEqual([
    SDF,
    SmoothPolyline,
  ]);
  expect(queued(batch).every((d) => !cached.includes(d))).toBe(true);
});

it('reuses compatible shared batches after all members have left', () => {
  const batch = manager();
  const a = shape();
  const b = shape();
  batch.add(a.entity);
  batch.add(b.entity);
  const first = queued(batch)[0];
  expect(first.shapes).toEqual([a.entity, b.entity]);
  const destroy = jest.spyOn(first, 'destroy');
  batch.remove(a.entity);
  expect(queued(batch)).toEqual([first]);
  batch.remove(b.entity);
  expect(queued(batch)).toEqual([]);
  expect(destroy).not.toHaveBeenCalled();
  batch.add(a.entity);
  expect(queued(batch)).toEqual([first]);
  expect(first.shapes).toEqual([a.entity]);
  batch.destroy();
  batch.destroy();
  expect(destroy).toHaveBeenCalledTimes(1);
});

it('keeps incompatible fills in separate batches', () => {
  const batch = manager();
  const red = shape(Rect, true, [
    FillLayers,
    { layers: [{ type: 'solid', value: 'red' }] },
  ]);
  const blue = shape(Rect, true, [
    FillLayers,
    { layers: [{ type: 'solid', value: 'blue' }] },
  ]);
  batch.add(red.entity);
  batch.add(blue.entity);
  expect(queued(batch).map((d) => d.shapes)).toEqual([
    [red.entity],
    [blue.entity],
  ]);
});

it.each([true, false])(
  'replaces changed renderer combinations without losing other shapes (batchable=%s)',
  (batchable) => {
    const batch = manager();
    const node = shape(Rect, batchable);
    const other = shape();
    batch.add(node.entity);
    batch.add(other.entity);
    const old = queued(batch)[0];
    const destroy = jest.spyOn(old, 'destroy');
    node.data.set(DropShadow, { blurRadius: 4 });
    batch.add(node.entity);
    const newCalls = queued(batch).filter((d) =>
      d.shapes.includes(node.entity),
    );
    expect(newCalls.map((d) => d.constructor)).toEqual([ShadowRect, SDF]);
    expect(queued(batch).some((d) => d.shapes.includes(other.entity))).toBe(
      true,
    );
    expect(destroy).toHaveBeenCalledTimes(batchable ? 0 : 1);
  },
);

it.each([true, false])(
  'does not resurrect a removed UI drawcall when showing UIs (destroy=%s)',
  (destroy) => {
    const batch = manager();
    const node = shape(Rect, false, [UI, {}]);
    batch.add(node.entity);
    const old = queued(batch)[0];
    const release = jest.spyOn(old, 'destroy');
    batch.hideUIs();
    batch.remove(node.entity, destroy);
    batch.showUIs();
    expect(queued(batch)).toEqual([]);
    expect(release).toHaveBeenCalledTimes(destroy ? 1 : 0);
    batch.add(node.entity);
    expect(queued(batch)[0] === old).toBe(!destroy);
  },
);

it('does not restore an empty shared UI batch', () => {
  const batch = manager();
  const node = shape(Rect, true, [UI, {}]);
  batch.add(node.entity);
  batch.hideUIs();
  batch.remove(node.entity);
  batch.showUIs();
  expect(queued(batch)).toEqual([]);
});

it('keeps hidden UIs out of the frame on repeated add and shows them once', () => {
  const batch = manager();
  const node = shape(Rect, false, [UI, {}]);
  const scene = shape(Rect, false);
  batch.add(node.entity);
  batch.add(scene.entity);
  const [ui, ordinary] = queued(batch);
  batch.hideUIs();
  batch.hideUIs();
  batch.add(node.entity);
  expect(queued(batch)).toEqual([ordinary]);
  batch.showUIs();
  batch.showUIs();
  expect(queued(batch)).toEqual([ordinary, ui]);
});

it('clears hidden frame entries without destroying cached drawcalls', () => {
  const batch = manager();
  const node = shape(Rect, false, [UI, {}]);
  batch.add(node.entity);
  const old = queued(batch)[0];
  const destroy = jest.spyOn(old, 'destroy');
  batch.hideUIs();
  batch.clear();
  batch.showUIs();
  expect(queued(batch)).toEqual([]);
  expect(destroy).not.toHaveBeenCalled();
  batch.add(node.entity);
  expect(queued(batch)).toEqual([old]);
});

it('moves a blended node out of instancing and back without retaining stale membership', () => {
  const batch = manager();
  const a = shape();
  const b = shape();
  batch.add(a.entity);
  batch.add(b.entity);
  const shared = queued(batch)[0];
  a.node.blendMode = 'multiply';
  batch.add(a.entity);
  const blended = queued(batch)[1];
  const release = jest.spyOn(blended, 'destroy');
  expect(shared.shapes).toEqual([b.entity]);
  expect(batch.buildFlushSegments().map((s) => s.type)).toEqual([
    'normal',
    'layerBlend',
  ]);
  a.node.blendMode = 'normal';
  batch.add(a.entity);
  expect(queued(batch)).toEqual([shared]);
  expect(shared.shapes).toEqual([b.entity, a.entity]);
  expect(release).toHaveBeenCalledTimes(1);
});

it('groups each blended node separately while retaining normal drawing order', () => {
  const batch = manager();
  const nodes = Array.from({ length: 4 }, (_, i) => {
    const node = shape(
      Rect,
      false,
      [FractionalIndex, { value: `a${i}` }],
      [DropShadow, { blurRadius: 4 }],
    );
    if (i === 1 || i === 2) node.node.blendMode = 'multiply';
    return node;
  });
  [...nodes].reverse().forEach((n) => batch.add(n.entity));
  batch.sort();
  const segments = batch.buildFlushSegments();
  expect(segments.map((s) => s.type)).toEqual([
    'normal',
    'layerBlend',
    'layerBlend',
    'normal',
  ]);
  expect(segments.map((s) => s.drawcalls.map((d) => d.shapes[0]))).toEqual(
    nodes.map((n) => [n.entity, n.entity]),
  );
});

it('fans dirty flags out to every drawcall before consuming component markers', () => {
  const batch = manager();
  const node = shape(Rect, false, [DropShadow, { blurRadius: 4 }]);
  batch.add(node.entity);
  const calls = queued(batch);
  const seen: boolean[][] = [];
  calls.forEach((d) => {
    d.geometryDirty = d.materialDirty = false;
    jest.spyOn(d, 'submit').mockImplementation(() => {
      seen.push([
        d.geometryDirty,
        d.materialDirty,
        node.entity.has(GeometryDirty),
        node.entity.has(MaterialDirty),
      ]);
      d.geometryDirty = d.materialDirty = false;
    });
  });
  node.data.set(GeometryDirty, {});
  node.data.set(MaterialDirty, {});
  batch.flush(null, null, {}, null);
  expect(seen).toEqual([
    [true, true, false, false],
    [true, true, false, false],
  ]);
  seen.length = 0;
  batch.flush(null, null, {}, null);
  expect(seen).toEqual([
    [false, false, false, false],
    [false, false, false, false],
  ]);
});

it('ignores extruded shapes in 2D and can rebuild after destruction', () => {
  const batch = manager();
  batch.add(shape(Rect, true, [Extrude3D, {}]).entity);
  expect(queued(batch)).toEqual([]);
  const node = shape();
  batch.add(node.entity);
  const old = queued(batch)[0];
  batch.destroy();
  expect(queued(batch)).toEqual([]);
  batch.add(node.entity);
  expect(queued(batch)[0]).not.toBe(old);
  expect(old.destroyed).toBe(true);
});

it.each([false, true])(
  'schedules ordered blend passes and reuses frame uniforms (blended bottom=%s)',
  (blendedBottom) => {
    let id = 1000;
    const resources: {
      id: number;
      destroy: jest.Mock;
      setSubData: jest.Mock;
      setUniformsLegacy: jest.Mock;
    }[] = [];
    const allocate = () => {
      const resource = {
        id: id++,
        destroy: jest.fn(),
        setSubData: jest.fn(),
        setUniformsLegacy: jest.fn(),
      };
      resources.push(resource);
      return resource;
    };
    const device = {
      queryVendorInfo: () => ({ platformString: 'WebGL2' }),
      createBuffer: jest.fn(allocate),
      createBindings: jest.fn(allocate),
      createProgram: jest.fn(allocate),
      createInputLayout: jest.fn(allocate),
      createRenderPipeline: jest.fn(allocate),
      createSampler: jest.fn(allocate),
    };
    const cache = new RenderCache(device as unknown as Device);
    const batch = new BatchManager(
      device as unknown as Device,
      null,
      cache,
      null,
      {
        getNodeByEntity: (entity: Entity) => (entity as any).node,
      } as API,
    );
    const order: string[] = [];
    const nodes = [
      shape(Rect, false),
      shape(Rect, false, [Opacity, { opacity: 0.25 }]),
      shape(Rect, false),
    ];
    nodes[1].node.blendMode = 'multiply';
    if (blendedBottom) nodes[0].node.blendMode = 'screen';
    for (const [index, node] of nodes.entries()) {
      batch.add(node.entity);
      const drawcall = queued(batch).at(-1)!;
      jest.spyOn(drawcall, 'submit').mockImplementation(() => {
        order.push(`normal-${index}`);
      });
      jest
        .spyOn(drawcall, 'renderNodeLayerBlendSrcInPass')
        .mockImplementation(() => {
          order.push(`source-${index}`);
        });
    }
    const renderPass = {
      setViewport: jest.fn(),
      setPipeline: jest.fn(),
      setBindings: jest.fn(),
      setVertexInput: jest.fn(),
      draw: jest.fn(() => order.push('composite')),
    };
    function frame() {
      let nextTarget = 2;
      const passes: {
        targets: number[];
        execute?: (...args: any[]) => void;
      }[] = [];
      const builder = {
        pushPass(build: (pass: any) => void) {
          const record: (typeof passes)[number] = { targets: [] };
          build({
            setDebugName: () => {},
            attachRenderTargetID: (_slot: number, target: number) =>
              record.targets.push(target),
            attachResolveTexture: () => {},
            exec: (execute: (...args: any[]) => void) => {
              record.execute = execute;
            },
          });
          passes.push(record);
        },
        createRenderTargetID: () => nextTarget++,
        resolveRenderTarget(target: number) {
          // Resolving before an attached pass loses the cleared canvas backdrop.
          expect(passes.some((pass) => pass.targets.includes(target))).toBe(
            true,
          );
          return target + 100;
        },
      } as unknown as RGGraphBuilder;
      batch.scheduleFlush(
        builder,
        0,
        1,
        null,
        {},
        200,
        100,
        () => order.push('background'),
        true,
        'main',
      );
      passes.forEach((pass) =>
        pass.execute!(renderPass, {
          getResolveTextureForID: (id: number) => ({ id }),
        }),
      );
    }
    try {
      frame();
      const expected = blendedBottom
        ? [
            'background',
            'source-0',
            'composite',
            'source-1',
            'composite',
            'normal-2',
          ]
        : ['background', 'normal-0', 'source-1', 'composite', 'normal-2'];
      expect(order).toEqual(expected);
      const bufferCount = device.createBuffer.mock.calls.length;
      order.length = 0;
      frame();
      expect(order).toEqual(expected);
      expect(device.createBuffer).toHaveBeenCalledTimes(bufferCount);
      const program = device.createProgram.mock.results[0].value;
      expect(
        program.setUniformsLegacy.mock.calls.map(
          ([uniforms]) => uniforms.u_BlendParams[1],
        ),
      ).toEqual(blendedBottom ? [1, 0.25, 1, 0.25] : [0.25, 0.25]);
    } finally {
      batch.destroy();
      batch.destroy();
      cache.destroy();
    }
    resources.forEach((resource) =>
      expect(resource.destroy).toHaveBeenCalledTimes(1),
    );
  },
);

it('schedules one normal pass and consumes dirty markers before GPU submission', () => {
  const batch = manager();
  const node = shape(Rect, false, [GeometryDirty, {}]);
  batch.add(node.entity);
  const drawcall = queued(batch)[0];
  drawcall.geometryDirty = false;
  const submitted = jest.spyOn(drawcall, 'submit').mockImplementation(() => {});
  const callbacks: ((pass: unknown) => void)[] = [];
  const builder = {
    pushPass: jest.fn((build) =>
      build({
        setDebugName: () => {},
        attachRenderTargetID: () => {},
        exec: (callback: (pass: unknown) => void) => callbacks.push(callback),
      }),
    ),
  };
  const preamble = jest.fn();
  batch.scheduleFlush(
    builder as unknown as RGGraphBuilder,
    0,
    1,
    null,
    {},
    200,
    100,
    preamble,
    false,
    'main',
  );
  expect(builder.pushPass).toHaveBeenCalledTimes(1);
  expect(drawcall.geometryDirty).toBe(true);
  expect(node.entity.has(GeometryDirty)).toBe(false);
  expect(submitted).not.toHaveBeenCalled();
  const pass = {};
  callbacks[0](pass);
  expect(preamble).toHaveBeenCalledWith(pass);
  expect(submitted).toHaveBeenCalledTimes(1);
});
