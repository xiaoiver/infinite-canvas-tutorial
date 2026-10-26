import type { SerializedNode } from '../../packages/ecs/src';
import {
  reconcileRefInstances,
  serializedNodesToCode,
} from '../../packages/ecs/src/utils/codegen';
import { expandRefSerializedNodes } from '../../packages/ecs/src/utils/deserialize/expand-ref-nodes';

const source: SerializedNode[] = [
  {
    id: 'page',
    type: 'rect',
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    zIndex: 0,
    display: 'flex',
  } as SerializedNode,
  {
    id: 'card-template',
    type: 'rect',
    name: 'PlanCard',
    x: 500,
    y: 0,
    width: 180,
    height: 100,
    zIndex: 1,
    display: 'flex',
    reusable: true,
  } as SerializedNode,
  {
    id: 'price',
    parentId: 'card-template',
    type: 'text',
    x: 0,
    y: 0,
    zIndex: 2,
    content: '$0',
  } as SerializedNode,
  {
    id: 'growth',
    parentId: 'page',
    type: 'ref',
    ref: 'card-template',
    x: 0,
    y: 0,
    zIndex: 3,
    descendants: { price: { content: '$29' } },
  } as SerializedNode,
];

describe('design-to-code expanded ref reconciliation', () => {
  const baseline = expandRefSerializedNodes(structuredClone(source), source);

  it('recovers a nested instance and its edited text as a component prop', () => {
    const current = structuredClone(baseline);
    const price = current.find((node) => node.id === 'growth__price')!;
    if (price.type !== 'text') throw new Error('Missing text clone');
    price.content = '$39';
    price.version = 2;
    price.versionNonce = 123;
    price.updated = 456;
    current.find((node) => node.id === 'card-template')!.version = 2;

    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      descendants: { price: { content: '$39' } },
    });
    expect(recovered.some((node) => node.id === 'growth__price')).toBe(false);
    const react = serializedNodesToCode(recovered);
    expect(react).toContain('export function PlanCard');
    expect(react).toContain('<PlanCard');
    expect(react).toContain('$39');
  });

  it('uses the expanded document after an unsupported card resize', () => {
    const current = structuredClone(baseline);
    const card = current.find((node) => node.id === 'growth')!;
    card.width = 220;
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.some((node) => node.id === 'card-template')).toBe(false);
    expect(recovered.find((node) => node.id === 'growth')?.width).toBe(220);
    const react = serializedNodesToCode(recovered);
    expect(react).not.toContain('export function PlanCard');
    expect(react).toContain('w-[220px]');
  });

  it('uses the expanded document for unsupported source overrides', () => {
    const unsupportedSource = structuredClone(source);
    const ref = unsupportedSource.find((node) => node.id === 'growth')!;
    (ref as { strokeWidth?: number }).strokeWidth = 2;
    const expanded = expandRefSerializedNodes(
      structuredClone(unsupportedSource),
      unsupportedSource,
    );
    const recovered = reconcileRefInstances(
      unsupportedSource,
      expanded,
      expanded,
    );
    expect(recovered.some((node) => node.type === 'ref')).toBe(false);
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'rect',
      strokeWidth: 2,
    });
  });

  it('omits a deleted instance and falls back when the template changes', () => {
    const withoutInstance = baseline.filter(
      (node) => node.id !== 'growth' && node.id !== 'growth__price',
    );
    expect(
      reconcileRefInstances(source, baseline, withoutInstance).some(
        (node) => node.id === 'growth',
      ),
    ).toBe(false);

    const editedTemplate = structuredClone(baseline);
    const template = editedTemplate.find(
      (node) => node.id === 'card-template',
    )!;
    template.width = 200;
    expect(
      reconcileRefInstances(source, baseline, editedTemplate).some(
        (node) => node.id === 'card-template',
      ),
    ).toBe(false);
  });
});
