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

  it('expands a line endpoint edit rather than keeping stale component geometry', () => {
    const nodes = [
      {
        id: 'line-template',
        type: 'line',
        name: 'Connector',
        reusable: true,
        x: 0,
        y: 0,
        width: 40,
        height: 1,
        x1: 0,
        y1: 0,
        x2: 40,
        y2: 0,
        zIndex: 0,
        strokeWidth: 2,
        strokes: [{ type: 'solid', value: '#000000' }],
      },
      {
        id: 'line-instance',
        type: 'ref',
        ref: 'line-template',
        x: 50,
        y: 0,
        zIndex: 1,
        x2: 25,
      },
    ] as SerializedNode[];
    const react = serializedNodesToCode(nodes);
    expect(react).not.toContain('<Connector');
    expect(react).toContain('d={"M 0 0 L 25 0"}');
  });

  it('expands a marker override rather than keeping stale reusable arrowheads', () => {
    const nodes = [
      {
        id: 'arrow-template',
        type: 'line',
        name: 'Arrow',
        reusable: true,
        x: 0,
        y: 0,
        width: 40,
        height: 1,
        x1: 0,
        y1: 0,
        x2: 40,
        y2: 0,
        zIndex: 0,
        strokeWidth: 2,
        strokes: [{ type: 'solid', value: '#000000' }],
        markerEnd: 'line',
      },
      {
        id: 'arrow-instance',
        type: 'ref',
        ref: 'arrow-template',
        x: 50,
        y: 0,
        zIndex: 1,
        markerEnd: 'triangle',
      },
    ] as SerializedNode[];
    const react = serializedNodesToCode(nodes);
    expect(react).not.toContain('<Arrow');
    expect(react).toContain('markerEnd={"url(#ic-marker-61-72-72-6f-77-2d-69-6e-73-74-61-6e-63-65-end)"}');
    expect(react).toContain(' Z"} fill={"#000000"}');
  });

  it('expands a path paint override to keep SVG fill on the instance', () => {
    const nodes = [
      {
        id: 'shape-template',
        type: 'path',
        name: 'BadgeShape',
        reusable: true,
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        zIndex: 0,
        d: 'M 0 0 L 40 0 L 40 40 Z',
        fills: [{ type: 'solid', value: '#ff0000' }],
      },
      {
        id: 'shape-instance',
        type: 'ref',
        ref: 'shape-template',
        x: 50,
        y: 0,
        zIndex: 1,
        fills: [{ type: 'solid', value: '#0000ff' }],
      },
    ] as SerializedNode[];
    const react = serializedNodesToCode(nodes);
    expect(react).not.toContain('<BadgeShape');
    expect(react).toContain('fill={"#0000ff"}');
    const html = serializedNodesToCode(nodes, { framework: 'html-css' });
    expect(html).toContain('fill="#0000ff"');
  });

  it('expands a gradient paint override on a reusable path', () => {
    const nodes = [
      {
        id: 'gradient-template',
        type: 'path',
        name: 'GradientBadge',
        reusable: true,
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        zIndex: 0,
        d: 'M 0 0 L 40 0 L 40 40 Z',
        fills: [{ type: 'solid', value: '#ff0000' }],
      },
      {
        id: 'gradient-instance',
        type: 'ref',
        ref: 'gradient-template',
        x: 50,
        y: 0,
        zIndex: 1,
        fills: [
          {
            type: 'gradient',
            value: 'linear-gradient(90deg, #ffffff 0%, #000000 100%)',
          },
        ],
      },
    ] as SerializedNode[];
    const react = serializedNodesToCode(nodes);
    expect(react).not.toContain('<GradientBadge');
    expect(react).toContain('<linearGradient');
    expect(react).toContain('fill={"url(#ic-gradient-');
    const html = serializedNodesToCode(nodes, { framework: 'html-css' });
    expect(html).toContain('<linearGradient');
    expect(html).toContain('fill="url(#ic-gradient-');
  });

  it('expands a reusable path when stroke alignment changes', () => {
    const nodes = [
      {
        id: 'outline-template',
        type: 'path',
        name: 'Outline',
        reusable: true,
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        zIndex: 0,
        d: 'M 0 0 L 40 0 L 40 40 Z',
        strokeWidth: 2,
        strokes: [{ type: 'solid', value: '#000000' }],
      },
      {
        id: 'outline-instance',
        type: 'ref',
        ref: 'outline-template',
        x: 50,
        y: 0,
        zIndex: 1,
        strokeAlignment: 'inner',
      },
    ] as SerializedNode[];
    const react = serializedNodesToCode(nodes);
    expect(react).not.toContain('<Outline');
    expect(react).toContain('<clipPath');
    expect(react).toContain('strokeWidth={4}');
  });

  it('expands a reusable path when its vector shadow changes', () => {
    const nodes = [
      {
        id: 'shadow-template',
        type: 'path',
        name: 'ShadowShape',
        reusable: true,
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        zIndex: 0,
        d: 'M 0 0 L 40 0 L 40 40 Z',
        fills: [{ type: 'solid', value: '#ff0000' }],
        dropShadowColor: '#000000',
        dropShadowOffsetX: 2,
        dropShadowOffsetY: 2,
        dropShadowBlurRadius: 2,
      },
      {
        id: 'shadow-instance',
        type: 'ref',
        ref: 'shadow-template',
        x: 50,
        y: 0,
        zIndex: 1,
        dropShadowBlurRadius: 8,
      },
    ] as SerializedNode[];
    const react = serializedNodesToCode(nodes);
    expect(react).not.toContain('<ShadowShape');
    expect(react).toContain('drop-shadow(2px 2px 8px #000000)');
  });

  it('keeps a child visibility edit as a component prop', () => {
    const current = structuredClone(baseline);
    current.find((node) => node.id === 'growth__price')!.visibility = 'hidden';
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      descendants: { price: { visibility: 'hidden' } },
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain("priceVisibility?: CSSProperties['visibility']");
    expect(react).toContain('visibility: priceVisibility');
    expect(react).toContain('priceVisibility="hidden"');
    const html = serializedNodesToCode(recovered, { framework: 'html-css' });
    expect(html).toContain('visibility: hidden');

    const inherited = structuredClone(recovered);
    const ref = inherited.find((node) => node.id === 'growth');
    if (ref?.type !== 'ref') throw new Error('Missing instance');
    ref.descendants = { price: { visibility: 'inherited' } };
    expect(serializedNodesToCode(inherited)).toContain(
      'priceVisibility="inherit"',
    );
  });

  it('positions a preserved component inside a free-layout parent', () => {
    const nodes = structuredClone(source);
    const parent = nodes.find((node) => node.id === 'page')!;
    delete parent.display;
    const instance = nodes.find((node) => node.id === 'growth')!;
    instance.x = 42;
    instance.y = 64;
    const react = serializedNodesToCode(nodes);
    expect(react).toContain('absolute left-[42px] top-[64px]');
    expect(react).toContain('<PlanCard');
    expect(react).not.toContain('growthX');
  });

  it('keeps a top-level component instance beside a sized scene root', () => {
    const nodes = structuredClone(source);
    const instance = nodes.find((node) => node.id === 'growth')!;
    delete instance.parentId;
    instance.x = 450;
    instance.y = 25;
    const react = serializedNodesToCode(nodes);
    expect(react).toContain(
      'className="relative" style={{ width: 630, height: 300 }}',
    );
    expect(react).toContain('absolute left-[450px] top-[25px]');
    expect(react).toContain('<PlanCard');
    const html = serializedNodesToCode(nodes, { framework: 'html-css' });
    expect(html).toContain('position: relative; width: 630px; height: 300px');
    expect(html).toContain('position: absolute; left: 450px; top: 25px');
  });

  it('includes a rotated component instance in the scene frame', () => {
    const nodes = structuredClone(source);
    nodes.find((node) => node.id === 'card-template')!.rotation = Math.PI / 2;
    const instance = nodes.find((node) => node.id === 'growth')!;
    delete instance.parentId;
    instance.x = 450;
    instance.y = 25;
    const react = serializedNodesToCode(nodes);
    expect(react).toContain('style={{ width: 450, height: 300 }}');
    expect(react).toContain('absolute left-[450px] top-[25px]');
    expect(react).toContain('rotate(1.570796rad)');
  });

  it('expands an instance whose free-layout child moved', () => {
    const nodes = structuredClone(source);
    delete nodes.find((node) => node.id === 'card-template')!.display;
    const instance = nodes.find((node) => node.id === 'growth')!;
    if (instance.type !== 'ref') throw new Error('Missing instance');
    instance.descendants = { price: { x: 30, y: 12 } };
    const react = serializedNodesToCode(nodes);
    expect(react).not.toContain('<PlanCard');
    expect(react).toContain('absolute left-[30px] top-[12px]');
  });

  it('expands a component instance when its clipping mode changes', () => {
    const nodes = structuredClone(source);
    const instance = nodes.find((node) => node.id === 'growth')!;
    instance.clipMode = 'clip';
    const react = serializedNodesToCode(nodes);
    expect(react).not.toContain('<PlanCard');
    expect(react).toContain('overflow-hidden');
  });

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

  it('preserves edits to a reusable card gradient as a component prop', () => {
    const gradientSource = structuredClone(source);
    const original = 'linear-gradient(90deg, #1d4ed8, #38bdf8)';
    const edited = 'linear-gradient(90deg, #7c3aed, #f472b6)';
    Object.assign(gradientSource.find((node) => node.id === 'card-template')!, {
      fills: [{ type: 'gradient', value: original }],
    });
    const gradientBaseline = expandRefSerializedNodes(
      structuredClone(gradientSource),
      gradientSource,
    );
    const current = structuredClone(gradientBaseline);
    Object.assign(current.find((node) => node.id === 'growth')!, {
      fills: [{ type: 'gradient', value: edited }],
    });
    const recovered = reconcileRefInstances(
      gradientSource,
      gradientBaseline,
      current,
    );
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      fills: [{ type: 'gradient', value: edited }],
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain('planCardFills?: string');
    expect(react).toContain('backgroundImage: planCardFills');
    expect(react).toContain(`planCardFills="${edited}"`);
    expect(
      serializedNodesToCode(recovered, { framework: 'html-css' }),
    ).toContain(`background-image: ${edited}`);

    Object.assign(current.find((node) => node.id === 'growth')!, {
      fills: [{ type: 'solid', value: '#7c3aed' }],
    });
    expect(
      reconcileRefInstances(gradientSource, gradientBaseline, current).some(
        (node) => node.type === 'ref',
      ),
    ).toBe(false);
  });

  it('preserves a reusable ellipse gradient value override', () => {
    const nodes = [
      {
        id: 'dot-template',
        name: 'StatusDot',
        type: 'ellipse',
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        zIndex: 0,
        reusable: true,
        fills: [{ type: 'gradient', value: 'radial-gradient(red, blue)' }],
      },
      {
        id: 'dot-instance',
        type: 'ref',
        ref: 'dot-template',
        x: 20,
        y: 0,
        zIndex: 1,
        fills: [{ type: 'gradient', value: 'radial-gradient(green, blue)' }],
      },
    ] as SerializedNode[];
    const react = serializedNodesToCode(nodes);
    expect(react).toContain('export function StatusDot');
    expect(react).toContain('backgroundImage: statusDotFills');
    expect(react).toContain('rounded-[50%]');
    expect(react).toContain('statusDotFills="radial-gradient(green, blue)"');
  });

  it('binds a positioned conic gradient edit on a reusable ellipse', () => {
    const nodes = [
      {
        id: 'conic-template',
        name: 'ConicBadge',
        type: 'ellipse',
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        zIndex: 0,
        reusable: true,
        fills: [
          {
            type: 'gradient',
            value: 'conic-gradient(circle at 25% 75%, red, blue)',
          },
        ],
      },
      {
        id: 'conic-instance',
        type: 'ref',
        ref: 'conic-template',
        x: 50,
        y: 0,
        zIndex: 1,
        fills: [
          {
            type: 'gradient',
            value: 'conic-gradient(circle at 25% 75%, green, blue)',
          },
        ],
      },
    ] as SerializedNode[];
    const react = serializedNodesToCode(nodes);
    expect(react).toContain('backgroundImage: conicBadgeFills');
    expect(react).toContain(
      'conicBadgeFills="conic-gradient(at 25% 75%, green, blue)"',
    );
    expect(react).not.toContain('conic-gradient(circle');
  });

  it('expands a rotated instance instead of dropping its transform', () => {
    const directRef = structuredClone(source);
    Object.assign(directRef.find((node) => node.id === 'growth')!, {
      rotation: Math.PI / 2,
      scaleX: -1,
    });
    const directCode = serializedNodesToCode(directRef);
    expect(directCode).not.toContain('export function PlanCard');
    expect(directCode).toContain(
      'transform: "rotate(1.570796rad) scale(-1, 1)"',
    );

    const current = structuredClone(baseline);
    Object.assign(current.find((node) => node.id === 'growth')!, {
      rotation: Math.PI / 2,
      scaleX: -1,
    });
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.some((node) => node.type === 'ref')).toBe(false);
    expect(serializedNodesToCode(recovered)).toContain(
      'transform: "rotate(1.570796rad) scale(-1, 1)"',
    );
  });

  it('expands translucent solid fill edits so fill opacity is not lost', () => {
    const translucentSource = structuredClone(source);
    Object.assign(
      translucentSource.find((node) => node.id === 'card-template')!,
      { fills: [{ type: 'solid', value: '#2563eb', opacity: 0.5 }] },
    );
    const translucentBaseline = expandRefSerializedNodes(
      structuredClone(translucentSource),
      translucentSource,
    );
    const current = structuredClone(translucentBaseline);
    Object.assign(current.find((node) => node.id === 'growth')!, {
      fills: [{ type: 'solid', value: '#7c3aed', opacity: 0.5 }],
    });
    const recovered = reconcileRefInstances(
      translucentSource,
      translucentBaseline,
      current,
    );
    expect(recovered.some((node) => node.type === 'ref')).toBe(false);
    expect(serializedNodesToCode(recovered)).toContain(
      'backgroundColor: "color-mix(in srgb, #7c3aed 50%, transparent)"',
    );

    const directRef = structuredClone(translucentSource);
    Object.assign(directRef.find((node) => node.id === 'growth')!, {
      fills: [{ type: 'solid', value: '#7c3aed', opacity: 0.5 }],
    });
    const directCode = serializedNodesToCode(directRef);
    expect(directCode).not.toContain('export function PlanCard');
    expect(directCode).toContain(
      'backgroundColor: "color-mix(in srgb, #7c3aed 50%, transparent)"',
    );
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

  it('preserves node blend mode as an instance CSS prop', () => {
    const blendedSource = structuredClone(source);
    Object.assign(blendedSource.find((node) => node.id === 'card-template')!, {
      blendMode: 'screen',
    });
    Object.assign(blendedSource.find((node) => node.id === 'growth')!, {
      blendMode: 'light',
    });
    const blendedBaseline = expandRefSerializedNodes(
      structuredClone(blendedSource),
      blendedSource,
    );
    const current = structuredClone(blendedBaseline);
    Object.assign(current.find((node) => node.id === 'growth')!, {
      blendMode: 'multiply',
    });
    const recovered = reconcileRefInstances(
      blendedSource,
      blendedBaseline,
      current,
    );
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      blendMode: 'multiply',
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain(
      "planCardBlendMode?: CSSProperties['mixBlendMode']",
    );
    expect(react).toContain('planCardBlendMode = "screen"');
    expect(react).toContain('mixBlendMode: planCardBlendMode');
    expect(react).toContain('planCardBlendMode="multiply"');
    const html = serializedNodesToCode(recovered, { framework: 'html-css' });
    expect(html).toContain('mix-blend-mode: multiply');

    const aliased = serializedNodesToCode(blendedSource);
    expect(aliased).toContain('planCardBlendMode="lighten"');
    const normal = structuredClone(blendedSource);
    Object.assign(normal.find((node) => node.id === 'growth')!, {
      blendMode: 'normal',
    });
    expect(serializedNodesToCode(normal)).toContain(
      'planCardBlendMode="normal"',
    );
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
    (ref as { flex?: number }).flex = 1;
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
      flex: 1,
    });
  });

  it('preserves flex item sizing and alignment on an instance child', () => {
    const current = structuredClone(baseline);
    Object.assign(current.find((node) => node.id === 'growth__price')!, {
      alignSelf: 'center',
      flexGrow: 2,
      flexShrink: 0,
      flexBasis: 120,
    });
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      descendants: {
        price: {
          alignSelf: 'center',
          flexGrow: 2,
          flexShrink: 0,
          flexBasis: 120,
        },
      },
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain("priceAlignSelf?: CSSProperties['alignSelf']");
    expect(react).toContain('priceFlexGrow?: number');
    expect(react).toContain('priceFlexShrink?: number');
    expect(react).toContain("priceFlexBasis?: CSSProperties['flexBasis']");
    expect(react).toContain('priceFlexBasis={120}');
    expect(react).toContain('flexBasis: priceFlexBasis');
    expect(react).not.toContain('basis-[120px]');

    const html = serializedNodesToCode(recovered, { framework: 'html-css' });
    expect(html).toContain('align-self: center');
    expect(html).toContain('flex-grow: 2');
    expect(html).toContain('flex-shrink: 0');
    expect(html).toContain('flex-basis: 120px');
  });

  it('preserves instance size constraints without fixed template classes', () => {
    const boundedSource = structuredClone(source);
    Object.assign(boundedSource.find((node) => node.id === 'card-template')!, {
      minWidth: 120,
      maxWidth: 250,
      minHeight: 70,
      maxHeight: 130,
    });
    const boundedBaseline = expandRefSerializedNodes(
      structuredClone(boundedSource),
      boundedSource,
    );
    const current = structuredClone(boundedBaseline);
    Object.assign(current.find((node) => node.id === 'growth')!, {
      minWidth: 150,
      maxWidth: 220,
      minHeight: 80,
      maxHeight: 120,
    });
    const recovered = reconcileRefInstances(
      boundedSource,
      boundedBaseline,
      current,
    );
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      minWidth: 150,
      maxWidth: 220,
      minHeight: 80,
      maxHeight: 120,
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain("planCardMinWidth?: CSSProperties['minWidth']");
    expect(react).toContain("planCardMaxWidth?: CSSProperties['maxWidth']");
    expect(react).toContain("planCardMinHeight?: CSSProperties['minHeight']");
    expect(react).toContain("planCardMaxHeight?: CSSProperties['maxHeight']");
    expect(react).toContain('planCardMinWidth={150}');
    expect(react).toContain('minWidth: planCardMinWidth');
    expect(react).not.toContain('min-w-[120px]');
    expect(react).not.toContain('max-w-[250px]');

    const html = serializedNodesToCode(recovered, { framework: 'html-css' });
    expect(html).toContain('min-width: 150px');
    expect(html).toContain('max-width: 220px');
    expect(html).toContain('min-height: 80px');
    expect(html).toContain('max-height: 120px');
  });

  it('binds an image fill override to the component image source', () => {
    const imageSource: SerializedNode[] = [
      {
        id: 'photo-template',
        type: 'rect',
        name: 'PhotoCard',
        x: 0,
        y: 0,
        width: 160,
        height: 100,
        zIndex: 0,
        reusable: true,
        fills: [{ type: 'image', value: 'https://example.com/default.png' }],
      } as SerializedNode,
      {
        id: 'photo-instance',
        type: 'ref',
        ref: 'photo-template',
        x: 200,
        y: 0,
        zIndex: 1,
        fills: [{ type: 'image', value: 'https://example.com/first.png' }],
      } as SerializedNode,
    ];
    const baseline = expandRefSerializedNodes(
      structuredClone(imageSource),
      imageSource,
    );
    const current = structuredClone(baseline);
    Object.assign(current.find((node) => node.id === 'photo-instance')!, {
      fills: [{ type: 'image', value: 'https://example.com/second.png' }],
    });
    const recovered = reconcileRefInstances(imageSource, baseline, current);
    expect(
      recovered.find((node) => node.id === 'photo-instance'),
    ).toMatchObject({
      type: 'ref',
      fills: [{ type: 'image', value: 'https://example.com/second.png' }],
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain('photoCardFills?: string');
    expect(react).toContain('src={photoCardFills}');
    expect(react).toContain('photoCardFills="https://example.com/second.png"');
    expect(react).not.toContain('style={{ src:');

    const html = serializedNodesToCode(recovered, { framework: 'html-css' });
    expect(html).toContain('src="https://example.com/second.png"');

    Object.assign(current.find((node) => node.id === 'photo-instance')!, {
      fills: [{ type: 'solid', value: '#ff0000' }],
    });
    expect(
      reconcileRefInstances(imageSource, baseline, current).some(
        (node) => node.type === 'ref',
      ),
    ).toBe(false);
    const changedFillSource = structuredClone(imageSource);
    Object.assign(
      changedFillSource.find((node) => node.id === 'photo-instance')!,
      { fills: [{ type: 'solid', value: '#ff0000' }] },
    );
    const changedFillReact = serializedNodesToCode(changedFillSource);
    expect(changedFillReact).not.toContain('export function PhotoCard');
    expect(changedFillReact).toContain('bg-[#ff0000]');

    const changedFitSource = structuredClone(imageSource);
    Object.assign(
      changedFitSource.find((node) => node.id === 'photo-instance')!,
      {
        fills: [
          {
            type: 'image',
            value: 'https://example.com/first.png',
            objectFit: 'cover',
            objectPosition: 'left top',
          },
        ],
      },
    );
    const changedFitReact = serializedNodesToCode(changedFitSource);
    expect(changedFitReact).not.toContain('export function PhotoCard');
    expect(changedFitReact).toContain('objectFit: "cover"');
    expect(changedFitReact).toContain('objectPosition: "left top"');
    const changedFitHtml = serializedNodesToCode(changedFitSource, {
      framework: 'html-css',
    });
    expect(changedFitHtml).toContain('object-fit: cover');
    expect(changedFitHtml).toContain('object-position: left top');
  });

  it('expands a reusable rectangle when a solid fill layer changes', () => {
    const templateFills = [
      { type: 'solid', value: '#ff0000' },
      { type: 'solid', value: '#0000ff', opacity: 0.5 },
    ];
    const nodes: SerializedNode[] = [
      {
        id: 'layered-template',
        type: 'rect',
        name: 'LayeredCard',
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        zIndex: 0,
        reusable: true,
        fills: templateFills,
      } as SerializedNode,
      {
        id: 'layered-instance',
        type: 'ref',
        ref: 'layered-template',
        x: 120,
        y: 0,
        zIndex: 1,
        fills: [templateFills[0], { type: 'solid', value: '#00ff00' }],
      } as SerializedNode,
    ];
    const react = serializedNodesToCode(nodes);
    expect(react).not.toContain('export function LayeredCard');
    expect(react).toContain('backgroundImage:');
    expect(react).toContain('#00ff00');
    const html = serializedNodesToCode(nodes, { framework: 'html-css' });
    expect(html).toContain('background-image:');
    expect(html).toContain('#00ff00');
  });

  it('expands a reusable rectangle when its pattern repeat changes', () => {
    const nodes = [
      {
        id: 'pattern-template',
        type: 'rect',
        name: 'PatternCard',
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        zIndex: 0,
        reusable: true,
        fills: [{ type: 'pattern', value: '/tile.png', repetition: 'repeat' }],
      },
      {
        id: 'pattern-instance',
        type: 'ref',
        ref: 'pattern-template',
        x: 120,
        y: 0,
        zIndex: 1,
        fills: [{ type: 'pattern', value: '/tile.png', repetition: 'repeat-y' }],
      },
    ] as SerializedNode[];
    const react = serializedNodesToCode(nodes);
    expect(react).not.toContain('export function PatternCard');
    expect(react).toContain('backgroundRepeat: "repeat-y"');
    const html = serializedNodesToCode(nodes, { framework: 'html-css' });
    expect(html).toContain('background-repeat: repeat-y');
  });

  it('combines image fill opacity with node opacity in flat and reusable exports', () => {
    const imageSource: SerializedNode[] = [
      {
        id: 'photo-template',
        type: 'rect',
        name: 'PhotoCard',
        x: 0,
        y: 0,
        width: 160,
        height: 100,
        zIndex: 0,
        reusable: true,
        fills: [
          { type: 'image', value: 'https://example.com/a.png', opacity: 0.5 },
        ],
      } as SerializedNode,
      {
        id: 'photo-instance',
        type: 'ref',
        ref: 'photo-template',
        x: 200,
        y: 0,
        zIndex: 1,
        opacity: 0.6,
        fills: [
          { type: 'image', value: 'https://example.com/b.png', opacity: 0.5 },
        ],
      } as SerializedNode,
    ];
    const react = serializedNodesToCode(imageSource);
    expect(react).toContain('photoCardOpacity={0.60}');
    expect(react).toContain('opacity: photoCardOpacity * 0.50');
    expect(react).toContain('photoCardFills="https://example.com/b.png"');
    const html = serializedNodesToCode(imageSource, {
      framework: 'html-css',
    });
    expect(html).toContain('opacity: 0.30');

    const changedPaint = structuredClone(imageSource);
    Object.assign(changedPaint.find((node) => node.id === 'photo-instance')!, {
      fills: [
        { type: 'image', value: 'https://example.com/b.png', opacity: 0.25 },
      ],
    });
    const changedReact = serializedNodesToCode(changedPaint);
    expect(changedReact).not.toContain('export function PhotoCard');
    expect(changedReact).toContain('opacity-[0.15]');
    const changedHtml = serializedNodesToCode(changedPaint, {
      framework: 'html-css',
    });
    expect(changedHtml).toContain('opacity: 0.15');

    const baseline = expandRefSerializedNodes(
      structuredClone(imageSource),
      imageSource,
    );
    const edited = structuredClone(baseline);
    Object.assign(edited.find((node) => node.id === 'photo-instance')!, {
      fills: [
        { type: 'image', value: 'https://example.com/b.png', opacity: 0.25 },
      ],
    });
    expect(
      reconcileRefInstances(imageSource, baseline, edited).some(
        (node) => node.type === 'ref',
      ),
    ).toBe(false);

    const variableOpacitySource = structuredClone(imageSource);
    for (const node of variableOpacitySource) {
      if (node.type === 'ref' || node.id === 'photo-template') {
        node.fills = [
          {
            type: 'image',
            value: 'https://example.com/a.png',
            opacity: '$opacity.image',
          },
        ];
      }
    }
    const variableHtml = serializedNodesToCode(variableOpacitySource, {
      framework: 'html-css',
      variablesMode: 'css-var',
    });
    expect(variableHtml).toContain(
      'opacity: calc(0.60 * var(--opacity-image))',
    );
  });

  it('keeps flex alignment and direction edits as instance props', () => {
    const current = structuredClone(baseline);
    const card = current.find((node) => node.id === 'growth')!;
    Object.assign(card, {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    });
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain(
      "planCardFlexDirection?: CSSProperties['flexDirection']",
    );
    expect(react).toContain("planCardAlignItems?: CSSProperties['alignItems']");
    expect(react).toContain(
      "planCardJustifyContent?: CSSProperties['justifyContent']",
    );
    expect(react).toContain("planCardFlexWrap?: CSSProperties['flexWrap']");
    expect(react).toContain('planCardJustifyContent="space-between"');
    expect(react).toContain('justifyContent: planCardJustifyContent');
    expect(react).not.toContain('justify-between');
  });

  it('still expands an instance if a flex edit also moves a child manually', () => {
    const current = structuredClone(baseline);
    Object.assign(current.find((node) => node.id === 'growth')!, {
      justifyContent: 'space-between',
    });
    current.find((node) => node.id === 'growth__price')!.x = 12;
    expect(
      reconcileRefInstances(source, baseline, current).some(
        (node) => node.type === 'ref',
      ),
    ).toBe(false);
  });

  it('preserves instance spacing and CSS shorthand box values', () => {
    const current = structuredClone(baseline);
    const card = current.find((node) => node.id === 'growth')!;
    const price = current.find((node) => node.id === 'growth__price')!;
    card.padding = [8, 16];
    card.gap = 12;
    card.rowGap = 3;
    card.columnGap = 5;
    price.margin = [1, 2, 3, 4];
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      padding: [8, 16],
      gap: 12,
      rowGap: 3,
      columnGap: 5,
      descendants: { price: { margin: [1, 2, 3, 4] } },
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain('planCardPadding?: string');
    expect(react).toContain('planCardGap?: number');
    expect(react).toContain('priceMargin?: string');
    expect(react).toContain('padding: planCardPadding');
    expect(react).toContain('gap: planCardGap');
    expect(react).toContain('rowGap: planCardRowGap');
    expect(react).toContain('columnGap: planCardColumnGap');
    expect(react).toContain('margin: priceMargin');
    expect(react).toContain('planCardPadding="8px 16px"');
    expect(react).toContain('planCardGap={12}');
    expect(react).toContain('planCardRowGap={3}');
    expect(react).toContain('planCardColumnGap={5}');
    expect(react).toContain('priceMargin="1px 2px 3px 4px"');
  });

  it('emits gap before row-gap when the source override lists row-gap first', () => {
    const direct = structuredClone(source);
    const ref = direct.find((node) => node.id === 'growth')!;
    if (ref.type !== 'ref') throw new Error('Missing instance');
    ref.rowGap = 3;
    ref.gap = 12;
    const react = serializedNodesToCode(direct);
    expect(react.indexOf('gap: planCardGap')).toBeLessThan(
      react.indexOf('rowGap: planCardRowGap'),
    );
  });

  it('preserves a drop shadow as one React prop and separate .ic overrides', () => {
    const current = structuredClone(baseline);
    const card = current.find((node) => node.id === 'growth')!;
    card.dropShadowColor = '#19243d';
    card.dropShadowOffsetX = 2;
    card.dropShadowOffsetY = 6;
    card.dropShadowBlurRadius = 12;
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      dropShadowColor: '#19243d',
      dropShadowOffsetX: 2,
      dropShadowOffsetY: 6,
      dropShadowBlurRadius: 12,
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain('planCardDropShadow?: string');
    expect(react).toContain('planCardDropShadow = "none"');
    expect(react).toContain('boxShadow: planCardDropShadow');
    expect(react).toContain('planCardDropShadow="2px 6px 12px #19243d"');
  });

  it('combines a partial shadow override with the template in css-var mode', () => {
    const shadowSource = structuredClone(source);
    const template = shadowSource.find((node) => node.id === 'card-template')!;
    template.dropShadowColor = '$color.shadow';
    template.dropShadowOffsetY = 4;
    template.dropShadowBlurRadius = 5;
    const ref = shadowSource.find((node) => node.id === 'growth')!;
    if (ref.type !== 'ref') throw new Error('Missing instance');
    ref.dropShadowBlurRadius = 12;
    const react = serializedNodesToCode(shadowSource, {
      variablesMode: 'css-var',
      variables: { 'color.shadow': { type: 'color', value: '#19243d' } },
    });
    expect(react).toContain(
      'planCardDropShadow="0px 4px 12px var(--color-shadow)"',
    );
    expect(react).toContain(
      'planCardDropShadow = "0px 4px 5px var(--color-shadow)"',
    );
    expect(react).not.toContain('shadow-[');
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

  it('preserves text decoration as one component prop', () => {
    const current = structuredClone(baseline);
    Object.assign(current.find((node) => node.id === 'growth__price')!, {
      decorationLine: 'underline',
      decorationStyle: 'wavy',
      decorationColor: '#ff00ff',
      decorationThickness: 2,
    });
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      descendants: {
        price: {
          decorationLine: 'underline',
          decorationStyle: 'wavy',
          decorationColor: '#ff00ff',
          decorationThickness: 2,
        },
      },
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain(
      "priceTextDecoration?: CSSProperties['textDecoration']",
    );
    expect(react).toContain('textDecoration: priceTextDecoration');
    expect(react).toContain('priceTextDecoration="wavy underline #ff00ff 2px"');
    const html = serializedNodesToCode(recovered, { framework: 'html-css' });
    expect(html).toContain('text-decoration: wavy underline #ff00ff 2px');

    Object.assign(current.find((node) => node.id === 'growth__price')!, {
      decorationThickness: 0,
    });
    const withoutThickness = reconcileRefInstances(source, baseline, current);
    expect(serializedNodesToCode(withoutThickness)).toContain(
      'priceTextDecoration="none"',
    );
    expect(
      serializedNodesToCode(withoutThickness, { framework: 'html-css' }),
    ).not.toContain('text-decoration:');

    const decoratedSource = structuredClone(source);
    Object.assign(decoratedSource.find((node) => node.id === 'price')!, {
      decorationLine: 'underline',
      decorationColor: '$color.accent',
      decorationThickness: 2,
    });
    const decoratedRef = decoratedSource.find((node) => node.id === 'growth')!;
    if (decoratedRef.type !== 'ref') throw new Error('Missing ref');
    decoratedRef.descendants = {
      ...decoratedRef.descendants,
      price: {
        ...decoratedRef.descendants?.price,
        decorationStyle: 'dashed',
      },
    };
    const cssVarReact = serializedNodesToCode(decoratedSource, {
      variablesMode: 'css-var',
    });
    expect(cssVarReact).toContain(
      'priceTextDecoration="dashed underline var(--color-accent) 2px"',
    );
  });

  it('preserves font variant and kerning edits as CSS-valued props', () => {
    const current = structuredClone(baseline);
    Object.assign(current.find((node) => node.id === 'growth__price')!, {
      fontVariant: 'small-caps',
      fontKerning: false,
    });
    const recovered = reconcileRefInstances(source, baseline, current);
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      descendants: {
        price: { fontVariant: 'small-caps', fontKerning: false },
      },
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain("priceFontVariant?: CSSProperties['fontVariant']");
    expect(react).toContain("priceFontKerning?: CSSProperties['fontKerning']");
    expect(react).toContain('priceFontVariant="small-caps"');
    expect(react).toContain('priceFontKerning="none"');
    expect(react).toContain('fontVariant: priceFontVariant');
    expect(react).toContain('fontKerning: priceFontKerning');
    const html = serializedNodesToCode(recovered, { framework: 'html-css' });
    expect(html).toContain('font-variant: small-caps');
    expect(html).toContain('font-kerning: none');

    const defaults = structuredClone(source);
    Object.assign(defaults.find((node) => node.id === 'price')!, {
      fontKerning: true,
    });
    const ref = defaults.find((node) => node.id === 'growth')!;
    if (ref.type !== 'ref') throw new Error('Missing ref');
    ref.descendants = {
      ...ref.descendants,
      price: { ...ref.descendants?.price, fontKerning: false },
    };
    expect(serializedNodesToCode(defaults)).toContain(
      'priceFontKerning = "normal"',
    );
  });

  it('preserves wrap width edits on an already wrapped reusable text', () => {
    const wrappedSource = structuredClone(source);
    Object.assign(wrappedSource.find((node) => node.id === 'price')!, {
      wordWrap: true,
      wordWrapWidth: 80,
    });
    const wrappedBaseline = expandRefSerializedNodes(
      structuredClone(wrappedSource),
      wrappedSource,
    );
    const current = structuredClone(wrappedBaseline);
    Object.assign(current.find((node) => node.id === 'growth__price')!, {
      wordWrapWidth: 120,
    });
    const recovered = reconcileRefInstances(
      wrappedSource,
      wrappedBaseline,
      current,
    );
    expect(recovered.find((node) => node.id === 'growth')).toMatchObject({
      type: 'ref',
      descendants: { price: { wordWrapWidth: 120 } },
    });
    const react = serializedNodesToCode(recovered);
    expect(react).toContain('priceWordWrapWidth?: number');
    expect(react).toContain('priceWordWrapWidth={120}');
    expect(react).toContain('maxWidth: priceWordWrapWidth');
    expect(react).toContain('whitespace-pre-wrap');
    const html = serializedNodesToCode(recovered, { framework: 'html-css' });
    expect(html).toContain('max-width: 120px');

    Object.assign(current.find((node) => node.id === 'growth__price')!, {
      wordWrap: false,
    });
    const flattened = reconcileRefInstances(
      wrappedSource,
      wrappedBaseline,
      current,
    );
    expect(flattened.some((node) => node.type === 'ref')).toBe(false);
    expect(serializedNodesToCode(flattened)).toContain('whitespace-pre');

    const directRef = structuredClone(wrappedSource);
    const growth = directRef.find((node) => node.id === 'growth')!;
    if (growth.type !== 'ref') throw new Error('Missing ref');
    growth.descendants = {
      ...growth.descendants,
      price: { ...growth.descendants?.price, wordWrap: false },
    };
    const directReact = serializedNodesToCode(directRef);
    expect(directReact).not.toContain('export function PlanCard');
    expect(directReact).toContain('whitespace-pre');
  });

  it('expands a reusable text when its truncation settings change', () => {
    const wrappedSource = structuredClone(source);
    Object.assign(wrappedSource.find((node) => node.id === 'price')!, {
      wordWrap: true,
      wordWrapWidth: 80,
      maxLines: 2,
      textOverflow: 'ellipsis',
    });
    const wrappedBaseline = expandRefSerializedNodes(
      structuredClone(wrappedSource),
      wrappedSource,
    );
    const current = structuredClone(wrappedBaseline);
    Object.assign(current.find((node) => node.id === 'growth__price')!, {
      maxLines: 1,
      textOverflow: 'clip',
    });
    const recovered = reconcileRefInstances(
      wrappedSource,
      wrappedBaseline,
      current,
    );
    expect(recovered.some((node) => node.type === 'ref')).toBe(false);
    expect(serializedNodesToCode(recovered)).toContain(
      'maxHeight: "calc(1 * 1lh)"',
    );

    const directRef = structuredClone(wrappedSource);
    const growth = directRef.find((node) => node.id === 'growth')!;
    if (growth.type !== 'ref') throw new Error('Missing ref');
    growth.descendants = {
      ...growth.descendants,
      price: { ...growth.descendants?.price, maxLines: 1 },
    };
    expect(serializedNodesToCode(directRef)).toContain('WebkitLineClamp: 1');
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
