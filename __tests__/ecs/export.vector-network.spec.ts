import { JSDOM } from 'jsdom';
import { XMLSerializer } from '@xmldom/xmldom';
import { DOMAdapter } from '../../packages/ecs/src/environment';
import type { Adapter } from '../../packages/ecs/src/environment/adapter';
import {
  buildVectorNetworkFillPathD,
  buildVectorNetworkStrokePathD,
} from '../../packages/ecs/src/utils/vector-network-svg';
import { serializeNodesToSVGElements } from '../../packages/ecs/src/utils/serialize/svg';
import type { VectorNetworkSerializedNode } from '../../packages/ecs/src/types/serialized-node';

const MinimalSVGAdapter = {
  getDocument: () => new JSDOM().window._document,
  // @ts-expect-error compatible with @xmldom/xmldom
  getXMLSerializer: () => new XMLSerializer(),
} as unknown as Adapter;

DOMAdapter.set(MinimalSVGAdapter);

const CUBE: Pick<VectorNetworkSerializedNode, 'vertices' | 'segments'> = {
  vertices: [
    { x: 0, y: 80 },
    { x: 80, y: 80 },
    { x: 80, y: 0 },
    { x: 0, y: 0 },
    { x: 110, y: 50 },
    { x: 110, y: -30 },
    { x: 30, y: -30 },
  ],
  segments: [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
    { start: 2, end: 3 },
    { start: 3, end: 0 },
    { start: 3, end: 6 },
    { start: 6, end: 5 },
    { start: 2, end: 5 },
    { start: 1, end: 4 },
    { start: 4, end: 5 },
  ],
};

describe('vector-network SVG path builders', () => {
  it('merges degree-2 chains and splits at branches', () => {
    const d = buildVectorNetworkStrokePathD(CUBE.vertices, CUBE.segments);
    expect(d).toContain('M 0 0 L 0 80 L 80 80');
    expect(d.split(/\sM\s/).length).toBeGreaterThan(1);
  });

  it('builds closed fill loops', () => {
    const d = buildVectorNetworkFillPathD(CUBE.vertices, CUBE.segments, [
      {
        loops: [[0, 1, 2, 3]],
        fillRule: 'nonzero',
      },
    ]);
    expect(d).toContain('M 0 80');
    expect(d).toContain('Z');
  });
});

describe('Export SVG vector-network', () => {
  it('exports stroke path inside a transformed group (not vector-network tag)', async () => {
    const nodes: VectorNetworkSerializedNode[] = [
      {
        id: 'vn1',
        type: 'vector-network',
        x: 120,
        y: 80,
        zIndex: 0,
        strokes: [{ type: 'solid', value: '#147af3', opacity: 1 }],
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        fills: [{ type: 'solid', value: 'none', opacity: 1 }],
        ...CUBE,
      },
    ];

    const [root] = await serializeNodesToSVGElements(nodes);
    expect(root.tagName.toLowerCase()).toBe('g');
    expect(root.getAttribute('transform')).toContain('matrix(');

    const paths = Array.from(root.querySelectorAll('path'));
    expect(paths.length).toBe(1);
    expect(paths[0].getAttribute('stroke')).toBe('#147af3');
    expect(paths[0].getAttribute('fill')).toBe('none');
    expect(paths[0].getAttribute('d')).toMatch(/^M /);

    const xml = DOMAdapter.get().getXMLSerializer()!.serializeToString(root);
    expect(xml).not.toContain('vector-network');
  });

  it('exports filled regions with fill-rule', async () => {
    const nodes: VectorNetworkSerializedNode[] = [
      {
        id: 'vn2',
        type: 'vector-network',
        x: 0,
        y: 0,
        zIndex: 0,
        strokes: [{ type: 'solid', value: 'none', opacity: 1 }],
        fills: [{ type: 'solid', value: '#ff0000', opacity: 0.5 }],
        strokeWidth: 0,
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
        segments: [
          { start: 0, end: 1 },
          { start: 1, end: 2 },
          { start: 2, end: 3 },
          { start: 3, end: 0 },
        ],
        regions: [{ loops: [[0, 1, 2, 3]], fillRule: 'evenodd' }],
      },
    ];

    const [root] = await serializeNodesToSVGElements(nodes);
    const fillPath = root.querySelector('path[fill="#ff0000"]');
    expect(fillPath).toBeTruthy();
    expect(fillPath?.getAttribute('fill-rule')).toBe('evenodd');
    expect(fillPath?.getAttribute('fill-opacity')).toBe('0.5');
  });
});
