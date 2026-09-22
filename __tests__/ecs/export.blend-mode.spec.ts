import { JSDOM } from 'jsdom';
import { XMLSerializer } from '@xmldom/xmldom';
import { DOMAdapter } from '../../packages/ecs/src/environment';
import type { Adapter } from '../../packages/ecs/src/environment/adapter';
import { serializeNodesToSVGElements } from '../../packages/ecs/src/utils/serialize/svg';
import type { RectSerializedNode } from '../../packages/ecs/src/types/serialized-node';

// Minimal adapter (no headless-gl / node-canvas) — SVG serialization only needs a
// document to create elements and an XML serializer to stringify the result.
const MinimalSVGAdapter = {
  getDocument: () => new JSDOM().window._document,
  // @ts-expect-error compatible with @xmldom/xmldom
  getXMLSerializer: () => new XMLSerializer(),
} as unknown as Adapter;

DOMAdapter.set(MinimalSVGAdapter);

function styleOf(el: SVGElement): string {
  return el.getAttribute('style') ?? '';
}

describe('Export SVG node-level blend mode (mix-blend-mode)', () => {
  it('writes `mix-blend-mode` onto the export root for a blended node', async () => {
    const nodes: RectSerializedNode[] = [
      {
        id: 'r1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 48,
        height: 48,
        fills: [{ type: 'solid', value: '#22c55e', opacity: 1 }],
        blendMode: 'multiply',
        zIndex: 0,
      },
    ];
    const [root] = await serializeNodesToSVGElements(nodes);
    expect(styleOf(root)).toMatch(/mix-blend-mode:\s*multiply/);
  });

  it('maps camelCase mode names to CSS keywords (colorBurn -> color-burn)', async () => {
    const nodes: RectSerializedNode[] = [
      {
        id: 'r2',
        type: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fills: [{ type: 'solid', value: '#000000', opacity: 1 }],
        blendMode: 'colorBurn',
        zIndex: 0,
      },
    ];
    const [root] = await serializeNodesToSVGElements(nodes);
    expect(styleOf(root)).toMatch(/mix-blend-mode:\s*color-burn/);
  });

  it('does not emit `mix-blend-mode` for normal / missing blend mode', async () => {
    const nodes: RectSerializedNode[] = [
      {
        id: 'r3',
        type: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fills: [{ type: 'solid', value: '#000000', opacity: 1 }],
        blendMode: 'normal',
        zIndex: 0,
      },
      {
        id: 'r4',
        type: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fills: [{ type: 'solid', value: '#000000', opacity: 1 }],
        zIndex: 1,
      },
    ];
    const [normalRoot, missingRoot] = await serializeNodesToSVGElements(nodes);
    expect(styleOf(normalRoot)).not.toContain('mix-blend-mode');
    expect(styleOf(missingRoot)).not.toContain('mix-blend-mode');
  });

  it('keeps `blendMode` from leaking as a stray attribute', async () => {
    const nodes: RectSerializedNode[] = [
      {
        id: 'r5',
        type: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fills: [{ type: 'solid', value: '#000000', opacity: 1 }],
        blendMode: 'screen',
        zIndex: 0,
      },
    ];
    const [root] = await serializeNodesToSVGElements(nodes);
    const xml = DOMAdapter.get().getXMLSerializer()!.serializeToString(root);
    expect(xml).not.toMatch(/\sblend-?mode=/i);
    expect(styleOf(root)).toMatch(/mix-blend-mode:\s*screen/);
  });
});
