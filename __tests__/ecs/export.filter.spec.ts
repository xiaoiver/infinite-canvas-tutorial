import { DOMAdapter } from '../../packages/ecs/src/environment';
import { serializeNodesToSVGElements } from '../../packages/ecs/src/utils/serialize/svg';
import type { RectSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import { NodeJSAdapter } from '../utils';

DOMAdapter.set(NodeJSAdapter);

function countRectElements(el: SVGElement): number {
  return (
    (el.localName === 'rect' ? 1 : 0) + el.querySelectorAll('rect').length
  );
}

describe('Export SVG filter (Figma-style, fill + stroke)', () => {
  it('applies wire `filter` to the whole shape via style on the export root (one rect, fill + stroke)', async () => {
    const nodes: RectSerializedNode[] = [
      {
        id: 'r1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 48,
        height: 48,
        fill: '#22c55e',
        stroke: '#0f172a',
        strokeWidth: 6,
        filter: 'blur(2px)',
        zIndex: 0,
      },
    ];
    const [root] = await serializeNodesToSVGElements(nodes);
    const xml = DOMAdapter.get().getXMLSerializer().serializeToString(root);

    expect(xml).toContain('blur(2px)');
    expect(xml).toMatch(/style="[^"]*filter:\s*blur\(2px\)/);
    expect(countRectElements(root)).toBe(1);
    expect(root.getAttribute('style') ?? '').toMatch(/filter:\s*blur\(2px\)/);
  });

  it('applies `filter` when only stroke is visible', async () => {
    const nodes: RectSerializedNode[] = [
      {
        id: 'r2',
        type: 'rect',
        x: 0,
        y: 0,
        width: 30,
        height: 30,
        fill: 'none',
        stroke: '#ef4444',
        strokeWidth: 4,
        filter: 'blur(1px)',
        zIndex: 0,
      },
    ];
    const [root] = await serializeNodesToSVGElements(nodes);
    const xml = DOMAdapter.get().getXMLSerializer().serializeToString(root);
    expect(xml).toContain('blur(1px)');
    expect(countRectElements(root)).toBe(1);
  });
});
