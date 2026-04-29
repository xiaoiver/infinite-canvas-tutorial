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

  it('expanded root carries template flex props for Yoga getNodeByEntity', () => {
    const graph: SerializedNode[] = [
      {
        id: 'tpl',
        type: 'rect',
        reusable: true,
        display: 'flex',
        width: 200,
        height: 100,
        x: 0,
        y: 0,
        zIndex: 0,
      } as SerializedNode,
      {
        id: 'inst',
        type: 'ref',
        ref: 'tpl',
        x: 10,
        y: 20,
        fill: 'red',
        zIndex: 0,
      } as SerializedNode,
    ];
    const merged = mergeSerializedNodesForRefLookup(graph, undefined);
    const out = expandRefSerializedNodes(graph, merged);
    const root = out.find((n) => n.id === 'inst')!;
    expect((root as { display?: string }).display).toBe('flex');
    expect((root as { width?: number }).width).toBe(200);
  });

  it('applies Pencil-style descendants by template id for nested nodes', () => {
    const graph: SerializedNode[] = [
      {
        id: 'round-button',
        type: 'rect',
        reusable: true,
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        zIndex: 0,
        fill: 'grey',
      } as SerializedNode,
      {
        id: 'label',
        type: 'text',
        parentId: 'round-button',
        x: 0,
        y: 0,
        width: 100,
        height: 40,
        zIndex: 0,
        content: 'OK',
        fill: 'black',
        fontSize: 16,
      } as SerializedNode,
      {
        id: 'red-round-button',
        type: 'ref',
        ref: 'round-button',
        fill: '#FF0000',
        zIndex: 0,
        x: 0,
        y: 0,
        descendants: {
          label: { content: 'Cancel', fill: '#FFFFFF' },
        },
      } as SerializedNode,
    ];
    const merged = mergeSerializedNodesForRefLookup(graph, undefined);
    const out = expandRefSerializedNodes(graph, merged);
    const t = out.find(
      (n) => n.id === 'red-round-button__label',
    )! as { content: string; fill: string; type: string };
    expect(t.type).toBe('text');
    expect(t.content).toBe('Cancel');
    expect(t.fill).toBe('#FFFFFF');
    const root = out.find((n) => n.id === 'red-round-button')! as { fill: string; descendants?: unknown };
    expect(root.fill).toBe('#FF0000');
    expect(root.descendants).toBeUndefined();
  });
});
