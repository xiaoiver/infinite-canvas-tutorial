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

  it('preserves an explicitly sized card after resize', () => {
    const current = structuredClone(baseline);
    const card = current.find((node) => node.id === 'growth')!;
    card.width = 220;
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.some((node) => node.id === 'card-template')).toBe(true);
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      width: 220,
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain('export function PlanCard');
    expect(react).toContain('planCardWidth?: number');
    expect(react).toContain('width: planCardWidth');
    expect(react).toContain('planCardWidth={220}');
  });

  it('falls back when a text child is moved outside its template layout', () => {
    const current = structuredClone(baseline);
    current.find((node) => node.id === 'growth__price')!.x = 12;
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.some((node) => node.type === 'ref')).toBe(false);
  });

  it('uses the expanded document for unsupported source overrides', () => {
    const unsupportedSource = structuredClone(source);
    const ref = unsupportedSource.find((node) => node.id === 'growth')!;
    (ref as { dropShadowBlurRadius?: number }).dropShadowBlurRadius = 12;
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
      dropShadowBlurRadius: 12,
    });
  });

  it('preserves instance opacity and text weight as component props', () => {
    const current = structuredClone(baseline);
    const card = current.find((node) => node.id === 'growth')!;
    const price = current.find((node) => node.id === 'growth__price')!;
    if (price.type !== 'text') throw new Error('Missing text clone');
    card.opacity = 0.7;
    price.fontWeight = 800;
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      opacity: 0.7,
      descendants: { price: { fontWeight: 800 } },
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain('planCardOpacity?: number');
    expect(react).toContain("import type { CSSProperties } from 'react';");
    expect(react).toContain("priceFontWeight?: CSSProperties['fontWeight']");
    expect(react).toContain('planCardOpacity = 1');
    expect(react).toContain('priceFontWeight = 400');
    expect(react).toContain('opacity: planCardOpacity');
    expect(react).toContain('fontWeight: priceFontWeight');
    expect(react).toContain('planCardOpacity={0.70}');
    expect(react).toContain('priceFontWeight={800}');
  });

  it('preserves instance text styling as component props', () => {
    const current = structuredClone(baseline);
    const price = current.find((node) => node.id === 'growth__price')!;
    if (price.type !== 'text') throw new Error('Missing text clone');
    price.fontStyle = 'italic';
    price.fontFamily = 'Georgia';
    price.textAlign = 'center';
    price.letterSpacing = 1.5;
    price.lineHeight = 48;
    price.anchorX = 28.5;
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      descendants: {
        price: {
          fontStyle: 'italic',
          fontFamily: 'Georgia',
          textAlign: 'center',
          letterSpacing: 1.5,
          lineHeight: 48,
          anchorX: 28.5,
        },
      },
    });
    expect(
      expandRefSerializedNodes(recovered, recovered).find(
        (node) => node.id === 'growth__price',
      ),
    ).toMatchObject({ anchorX: 28.5, textAlign: 'center' });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain("priceFontStyle?: CSSProperties['fontStyle']");
    expect(react).toContain('priceFontFamily?: string');
    expect(react).toContain("priceTextAlign?: CSSProperties['textAlign']");
    expect(react).toContain(
      "priceLetterSpacing?: CSSProperties['letterSpacing']",
    );
    expect(react).toContain("priceLineHeight?: CSSProperties['lineHeight']");
    expect(react).toContain('fontStyle: priceFontStyle');
    expect(react).toContain('fontFamily: priceFontFamily');
    expect(react).toContain('textAlign: priceTextAlign');
    expect(react).toContain('letterSpacing: priceLetterSpacing');
    expect(react).toContain('priceLineHeight = 0');
    expect(react).toContain(
      'lineHeight: typeof priceLineHeight === "number" ? (priceLineHeight > 0 ? priceLineHeight + "px" : undefined) : priceLineHeight',
    );
    expect(react).toContain('priceFontStyle="italic"');
    expect(react).toContain('priceFontFamily="Georgia"');
    expect(react).toContain('priceTextAlign="center"');
    expect(react).toContain('priceLetterSpacing={1.50}');
    expect(react).toContain('priceLineHeight={48}');
  });

  it('uses the template line height as a pixel-valued prop default', () => {
    const withLineHeight = structuredClone(source);
    const price = withLineHeight.find((node) => node.id === 'price')!;
    if (price.type !== 'text') throw new Error('Missing text template');
    price.lineHeight = 24;
    const ref = withLineHeight.find((node) => node.id === 'growth')!;
    if (ref.type !== 'ref') throw new Error('Missing instance');
    ref.descendants = { price: { lineHeight: 40 } };
    const react = serializedNodesToCode(withLineHeight);
    expect(react).toContain('priceLineHeight = 24');
    expect(react).toContain('priceLineHeight={40}');
    expect(react).not.toContain('leading-[24px]');
  });

  it('falls back for an anchor move without a text alignment edit', () => {
    const current = structuredClone(baseline);
    const price = current.find((node) => node.id === 'growth__price')!;
    if (price.type !== 'text') throw new Error('Missing text clone');
    price.anchorX = 20;
    expect(
      reconcileRefInstances(source, baseline, current).some(
        (node) => node.type === 'ref',
      ),
    ).toBe(false);
  });

  it('preserves edited stroke width and color as instance props', () => {
    const current = structuredClone(baseline);
    const card = current.find((node) => node.id === 'growth')!;
    card.strokeWidth = 2;
    card.strokes = [{ type: 'solid', value: '#9655ff' }];
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      strokeWidth: 2,
      strokes: [{ type: 'solid', value: '#9655ff' }],
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain('planCardStrokeWidth?: number');
    expect(react).toContain('planCardStrokes?: string');
    expect(react).toContain('borderWidth: planCardStrokeWidth');
    expect(react).toContain('borderColor: planCardStrokes');
    expect(react).toContain('borderStyle: "solid"');
    expect(react).toContain('planCardStrokeWidth={2}');
    expect(react).toContain('planCardStrokes="#9655ff"');
  });

  it('flattens a layered stroke that cannot be represented by one CSS border', () => {
    const current = structuredClone(baseline);
    const card = current.find((node) => node.id === 'growth')!;
    card.strokeWidth = 2;
    card.strokes = [
      { type: 'solid', value: '#9655ff' },
      { type: 'solid', value: '#ffffff' },
    ];
    const recovered = reconcileRefInstances(source, baseline, current);
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
