import * as Y from '../../packages/site/node_modules/yjs';
import { LoroDoc } from '../../packages/site/node_modules/loro-crdt';
import { yjsDocument } from '../../packages/site/docs/collaboration/yjs';
import { loroDocument } from '../../packages/site/docs/collaboration/loro';
import {
  bindDocument,
  DocumentAdapter,
} from '../../packages/site/docs/collaboration/document';

const a = {
  id: 'a',
  type: 'rect' as const,
  width: 10,
  fills: [{ type: 'solid' as const, value: 'red' }],
  version: 1,
};
const b = {
  id: 'b',
  type: 'rect' as const,
  width: 20,
  fills: [{ type: 'solid' as const, value: 'blue' }],
  version: 1,
};
const implementations = [
  {
    name: 'Yjs',
    create: () => new Y.Doc(),
    adapter: yjsDocument,
    sync: (a: Y.Doc, b: Y.Doc) => Y.applyUpdate(b, Y.encodeStateAsUpdate(a)),
  },
  {
    name: 'Loro',
    create: () => new LoroDoc(),
    adapter: loroDocument,
    sync: (a: LoroDoc, b: LoroDoc) => b.import(a.export({ mode: 'snapshot' })),
  },
];

describe.each(implementations)(
  '$name stable node synchronization',
  ({ create, adapter, sync }: any) => {
    it('deletes and reorders equal-version nodes by identity and removes missing attributes', () => {
      const doc = create();
      const store: DocumentAdapter = adapter(doc);
      store.write([], [a, b]);
      store.write([a, b], [b, a]);
      expect(store.read().map((node) => node.id)).toEqual(['b', 'a']);
      store.write([b, a], [b]);
      expect(store.read()).toEqual([b]);
      const { fills, ...withoutFill } = b;
      store.write([b], [withoutFill]);
      expect(store.read()).toEqual([withoutFill]);
      store.write([withoutFill], []);
      expect(store.read()).toEqual([]);
    });

    it('merges concurrent node edits and different attributes without relying on version counters', () => {
      const left = create(),
        right = create();
      const l: DocumentAdapter = adapter(left),
        r: DocumentAdapter = adapter(right);
      l.write([], [a, b]);
      sync(left, right);
      l.write([a, b], [{ ...a, width: 30 }, b]);
      r.write(
        [a, b],
        [
          { ...a, fills: [{ type: 'solid' as const, value: 'green' }] },
          { ...b, width: 40 },
        ],
      );
      sync(left, right);
      sync(right, left);
      expect(l.read()).toEqual(r.read());
      expect(l.read()).toEqual([
        {
          ...a,
          width: 30,
          fills: [{ type: 'solid' as const, value: 'green' }],
        },
        { ...b, width: 40 },
      ]);
    });

    it('preserves unseen remote inserts and edits when publishing a local change', () => {
      const left = create(),
        right = create();
      const l: DocumentAdapter = adapter(left),
        r: DocumentAdapter = adapter(right);
      l.write([], [a]);
      sync(left, right);
      r.write(
        [a],
        [{ ...a, fills: [{ type: 'solid' as const, value: 'green' }] }, b],
      );
      sync(right, left); // CRDT is current, but the canvas still shows [a].
      l.write([a], [{ ...a, width: 30 }]);
      expect(l.read()).toEqual([
        {
          ...a,
          fills: [{ type: 'solid' as const, value: 'green' }],
          width: 30,
        },
        b,
      ]);
    });
  },
);

it('hydrates before-ready updates, coalesces reads at the frame boundary, and cleans up without echoes', () => {
  const doc = new Y.Doc();
  const store = yjsDocument(doc);
  store.write([], [a]);
  let nodes = [];
  const queue: (() => void)[] = [];
  const api: any = {
    getNodes: () => nodes,
    runAtNextTick: (fn) => queue.push(fn),
    replaceDocument: jest.fn((next) => {
      nodes = next;
    }),
  };
  const write = jest.spyOn(store, 'write');
  const unbind = bindDocument(api, store);
  store.write([a], [a, b]);
  queue.shift()();
  expect(nodes).toEqual([a, b]);
  expect(api.replaceDocument).toHaveBeenCalledTimes(1);
  write.mockClear();
  nodes = [b];
  api.onchange({ nodes });
  expect(store.read()).toEqual([b]);
  expect(write).toHaveBeenCalledTimes(1);
  unbind();
  queue.shift()();
  expect(api.replaceDocument).toHaveBeenCalledTimes(1);
});

it('does not resurrect deleted seed nodes when a new tab joins', async () => {
  const { createYjsDemoDocument } = await import(
    '../../packages/site/docs/collaboration/yjs'
  );
  const { createLoroDemoDocument } = await import(
    '../../packages/site/docs/collaboration/loro'
  );
  for (const [create, adapter, sync] of [
    [
      createYjsDemoDocument,
      yjsDocument,
      (a, b) => Y.applyUpdate(b, Y.encodeStateAsUpdate(a)),
    ],
    [
      createLoroDemoDocument,
      loroDocument,
      (a, b) => b.import(a.export({ mode: 'snapshot' })),
    ],
  ] as any[]) {
    const original = create();
    const store = adapter(original);
    store.write(store.read(), []);
    const joining = create();
    sync(joining, original);
    sync(original, joining);
    expect(store.read()).toEqual([]);
    expect(adapter(joining).read()).toEqual([]);
  }
});

it('projects concurrent parent deletion and cyclic moves without dropping shapes', async () => {
  const { orderedNodes } = await import(
    '../../packages/site/docs/collaboration/document'
  );
  const { validateDocument } = await import('../../packages/ecs/src/document');
  const nodes = orderedNodes([
    { ...a, parentId: 'b' },
    { ...b, parentId: 'a' },
    { ...a, id: 'c', parentId: 'missing' },
  ]);
  expect(nodes).toHaveLength(3);
  expect(() => validateDocument(nodes)).not.toThrow();
  expect(nodes.find((node) => node.id === 'c').parentId).toBeUndefined();
});
