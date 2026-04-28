import {
  expandRefSerializedNodes,
  mergeSerializedNodesForRefLookup,
} from '../../packages/ecs/src/utils/deserialize/expand-ref-nodes';
import type { SerializedNode } from '../../packages/ecs/src';

describe('ref + reusable (Pencil-style components)', () => {
  it('expands a ref to the template root type and applies instance overrides on the root', () => {
    const graph: SerializedNode[] = [
      {
        id: 'foo',
        type: 'rect',
        reusable: true,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 0,
        fill: '#FF0000',
      } as SerializedNode,
      {
        id: 'bar',
        type: 'ref',
        ref: 'foo',
        x: 120,
        y: 0,
        zIndex: 0,
      } as SerializedNode,
    ];
    const merged = mergeSerializedNodesForRefLookup(graph, undefined);
    const out = expandRefSerializedNodes(graph, merged);
    const bar = out.find((n) => n.id === 'bar')!;
    expect(bar.type).toBe('rect');
    expect(bar.x).toBe(120);
    expect(bar.y).toBe(0);
    expect((bar as { reusable?: boolean }).reusable).toBeUndefined();
    expect((bar as { fill: string }).fill).toBe('#FF0000');
    expect(out.some((n) => n.id === 'foo')).toBe(true);
  });

  it('remaps child ids and parentId under a group template', () => {
    const graph: SerializedNode[] = [
      {
        id: 'gfoo',
        type: 'g',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        zIndex: 0,
      } as SerializedNode,
      {
        id: 'child1',
        type: 'rect',
        parentId: 'gfoo',
        x: 0,
        y: 0,
        width: 5,
        height: 5,
        zIndex: 0,
      } as SerializedNode,
      { id: 'gbar', type: 'ref', ref: 'gfoo', x: 50, y: 0, zIndex: 0 } as SerializedNode,
    ];
    const merged = mergeSerializedNodesForRefLookup(graph, undefined);
    const out = expandRefSerializedNodes(
      [graph[2]!] as SerializedNode[],
      merged,
    );
    expect(out.find((n) => n.id === 'gbar')?.type).toBe('g');
    const ch = out.find((n) => n.id === 'gbar__child1')!;
    expect(ch.type).toBe('rect');
    expect(ch.parentId).toBe('gbar');
  });
});
