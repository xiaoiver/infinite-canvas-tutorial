import type { API, Entity, SerializedNode } from '../../packages/ecs/src';
import { nodeLookupForPass } from '../../packages/ecs/src/utils/node-lookup';
function owner(id: number) {
  return {
    __id: id,
    isSame: jest.fn((other: Entity) => other.__id === id),
  } as unknown as Entity;
}
function scene(nodes: SerializedNode[], entries: [string, Entity][]) {
  const commands = new Map(
    entries.map(([id, entity]) => [id, { id: jest.fn(() => entity) }]),
  );
  const api = {
    getNodes: jest.fn(() => nodes),
    getEntityCommands: jest.fn(() => commands),
    getNodeByEntity: jest.fn(() => undefined),
  };
  return { api: api as unknown as API, mocks: api, commands };
}
const node = (id: string, x = 0) => ({ id, type: 'rect', x } as SerializedNode);
it('is lazy, accepts held/transient identities and snapshots each collection only once', () => {
  const nodes = Array.from({ length: 1024 }, (_, i) => node(String(i))),
    owners = nodes.map((_, i) => owner(i));
  const s = scene(
    nodes,
    nodes.map((n, i) => [n.id, owners[i]]),
  );
  const lookup = nodeLookupForPass(s.api);
  expect(lookup(undefined)).toBeUndefined();
  expect(s.mocks.getNodes).not.toHaveBeenCalled();
  for (let i = 0; i < nodes.length; i++)
    expect(lookup(owner(i))).toBe(nodes[i]);
  expect(lookup(owner(9999))).toBeUndefined();
  expect(s.mocks.getNodes).toHaveBeenCalledTimes(1);
  expect(s.mocks.getEntityCommands).toHaveBeenCalledTimes(1);
  s.commands.forEach((c) => expect(c.id).toHaveBeenCalledTimes(1));
  expect(s.mocks.getNodeByEntity).not.toHaveBeenCalled();
});
it('preserves first wire IDs and mapping insertion order, including an absent first wire', () => {
  const entity = owner(1),
    first = node('first', 1),
    duplicate = node('first', 2),
    alias = node('alias');
  const s = scene(
    [alias, first, duplicate],
    [
      ['first', entity],
      ['alias', owner(1)],
    ],
  );
  expect(nodeLookupForPass(s.api)(owner(1))).toBe(first);
  s.commands.delete('first');
  s.commands.set('missing', { id: jest.fn(() => entity) });
  const missing = scene(
    [alias],
    [
      ['missing', entity],
      ['alias', owner(1)],
    ],
  );
  expect(nodeLookupForPass(missing.api)(owner(1))).toBeUndefined();
});
it('refreshes in-place documents, deletions and reused numeric keys in a fresh pass', () => {
  const original = node('a', 1),
    nodes = [original],
    s = scene(nodes, [['a', owner(7)]]);
  expect(nodeLookupForPass(s.api)(owner(7))).toBe(original);
  nodes[0] = node('a', 2);
  expect(nodeLookupForPass(s.api)(owner(7))).toBe(nodes[0]);
  s.commands.delete('a');
  expect(nodeLookupForPass(s.api)(owner(7))).toBeUndefined();
  const replacement = node('b', 3);
  nodes.splice(0, 1, replacement);
  s.commands.set('b', { id: jest.fn(() => owner(7)) });
  expect(nodeLookupForPass(s.api)(owner(7))).toBe(replacement);
});
it('isolates API snapshots and keeps unusual identity adapters on the ordinary API fallback', () => {
  const a = scene([node('a')], [['a', owner(2)]]),
    b = scene([node('b')], [['b', owner(2)]]);
  expect(nodeLookupForPass(a.api)(owner(2))?.id).toBe('a');
  expect(nodeLookupForPass(b.api)(owner(2))?.id).toBe('b');
  const strict = owner(2);
  (strict.isSame as jest.Mock).mockReturnValue(false);
  const s = scene([node('strict')], [['strict', strict]]);
  const fallback = node('fallback');
  s.mocks.getNodeByEntity.mockReturnValue(fallback as any);
  const query = owner(2);
  expect(nodeLookupForPass(s.api)(query)).toBe(fallback);
  expect(s.mocks.getNodeByEntity).toHaveBeenCalledWith(query);
});
it('does not publish a partial snapshot after an exception', () => {
  const nodes = [node('a'), node('b')],
    s = scene(nodes, [
      ['a', owner(1)],
      ['b', owner(2)],
    ]);
  s.commands.get('b')!.id.mockImplementationOnce(() => {
    throw new Error('mapping unavailable');
  });
  const lookup = nodeLookupForPass(s.api);
  expect(() => lookup(owner(2))).toThrow('mapping unavailable');
  expect(lookup(owner(2))).toBe(nodes[1]);
  expect(lookup(owner(1))).toBe(nodes[0]);
  expect(s.mocks.getNodes).toHaveBeenCalledTimes(2);
});

it('does not eagerly scan unrelated nodes or mappings for a sparse view', () => {
  const nodes = [node('a'), node('b'), node('unrelated')],
    s = scene(nodes, [
      ['a', owner(1)],
      ['b', owner(2)],
      ['unrelated', owner(3)],
    ]);
  Object.defineProperty(nodes, 2, {
    get: () => {
      throw new Error('unrelated wire read');
    },
  });
  s.commands.get('unrelated')!.id.mockImplementation(() => {
    throw new Error('unrelated mapping read');
  });
  const lookup = nodeLookupForPass(s.api);
  expect(lookup(owner(1))).toBe(nodes[0]);
  expect(lookup(owner(2))).toBe(nodes[1]);
  expect(s.commands.get('unrelated')!.id).not.toHaveBeenCalled();
});
