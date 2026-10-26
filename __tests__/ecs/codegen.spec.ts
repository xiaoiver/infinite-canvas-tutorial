import type { SerializedNode } from '../../packages/ecs/src';
import {
  serializedNodesToCode,
  buildCodeIR,
} from '../../packages/ecs/src/utils/codegen';

describe('design-to-code (codegen)', () => {
  describe('react-tailwind emitter', () => {
    it('preserves hidden and explicitly visible nodes without removing layout space', () => {
      const nodes = [
        {
          id: 'hidden-frame',
          type: 'rect',
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          visibility: 'hidden',
          zIndex: 0,
        },
        {
          id: 'visible-label',
          type: 'text',
          parentId: 'hidden-frame',
          x: 0,
          y: 0,
          content: 'Visible',
          visibility: 'visible',
          zIndex: 1,
        },
      ] as SerializedNode[];
      const react = serializedNodesToCode(nodes);
      expect(react).toContain(
        'className="relative w-[100px] h-[50px] invisible"',
      );
      expect(react).toContain('visible');
      expect(react).not.toContain('display: "none"');
      const html = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(html).toContain('visibility: hidden');
      expect(html).toContain('visibility: visible');
    });

    it('keeps relative spacing between multiple sized scene roots', () => {
      const nodes = [
        {
          id: 'first',
          type: 'rect',
          x: -40,
          y: 20,
          width: 80,
          height: 60,
          zIndex: 0,
        },
        {
          id: 'second',
          type: 'ellipse',
          x: 100,
          y: 65,
          width: 50,
          height: 50,
          zIndex: 1,
        },
      ] as SerializedNode[];
      const react = serializedNodesToCode(nodes);
      expect(react).toContain(
        'className="relative" style={{ width: 190, height: 95 }}',
      );
      expect(react).toContain('absolute left-[0px] top-[0px]');
      expect(react).toContain('absolute left-[140px] top-[45px]');
      const html = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(html).toContain('position: relative; width: 190px; height: 95px');
      expect(html).toContain('position: absolute; left: 140px; top: 45px');

      expect(serializedNodesToCode([nodes[0]])).not.toContain('height: 95');
      expect(
        serializedNodesToCode([
          nodes[0],
          { ...nodes[1], width: undefined } as SerializedNode,
        ]),
      ).not.toContain('className="relative"');
    });

    it('sizes the multi-root frame around rotated and flipped geometry', () => {
      const nodes = [
        {
          id: 'rotated',
          type: 'rect',
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          rotation: Math.PI / 2,
          zIndex: 0,
        },
        {
          id: 'flipped',
          type: 'rect',
          x: 120,
          y: 10,
          width: 40,
          height: 30,
          scaleX: -1,
          zIndex: 1,
        },
      ] as SerializedNode[];
      const react = serializedNodesToCode(nodes);
      expect(react).toContain('style={{ width: 170, height: 100 }}');
      expect(react).toContain('absolute left-[50px] top-[0px]');
      expect(react).toContain('absolute left-[170px] top-[10px]');
      const html = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(html).toContain('position: relative; width: 170px; height: 100px');
      expect(html).toContain('position: absolute; left: 50px; top: 0px');
    });

    it('keeps local positions in a free-layout frame without disturbing flex children', () => {
      const nodes = [
        {
          id: 'frame',
          type: 'rect',
          x: 200,
          y: 100,
          width: 300,
          height: 180,
          zIndex: 0,
        },
        {
          id: 'badge',
          type: 'ellipse',
          parentId: 'frame',
          x: 25,
          y: 45,
          width: 40,
          height: 40,
          zIndex: 1,
        },
        {
          id: 'flex-row',
          type: 'rect',
          parentId: 'frame',
          x: 80,
          y: 20,
          width: 120,
          height: 60,
          display: 'flex',
          zIndex: 2,
        },
        {
          id: 'label',
          type: 'text',
          parentId: 'flex-row',
          x: 14,
          y: 12,
          content: 'Hello',
          zIndex: 3,
        },
      ] as SerializedNode[];
      const react = serializedNodesToCode(nodes);
      expect(react).toContain('className="relative');
      expect(react).toContain('absolute left-[25px] top-[45px]');
      expect(react).toContain('absolute left-[80px] top-[20px]');
      expect(react).not.toContain('left-[14px]');
      const html = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(html).toContain('position: relative');
      expect(html).toContain('position: absolute; left: 25px; top: 45px');
      expect(html).not.toContain('left: 14px');
    });

    it('clips children to a rounded rectangle or ellipse', () => {
      for (const type of ['rect', 'ellipse'] as const) {
        const nodes = [
          {
            id: 'mask',
            type,
            x: 0,
            y: 0,
            width: 100,
            height: 80,
            cornerRadius: type === 'rect' ? 16 : undefined,
            clipMode: 'clip',
            zIndex: 0,
          },
          {
            id: 'oversized-child',
            type: 'rect',
            parentId: 'mask',
            x: 0,
            y: 0,
            width: 200,
            height: 160,
            zIndex: 1,
          },
        ] as SerializedNode[];
        const react = serializedNodesToCode(nodes);
        const html = serializedNodesToCode(nodes, { framework: 'html-css' });
        expect(react).toContain('overflow-hidden');
        expect(html).toContain('overflow: hidden');
        expect(html).toContain(
          type === 'ellipse' ? 'border-radius: 50%' : 'border-radius: 16px',
        );
        expect(
          serializedNodesToCode([{ ...nodes[0], clipMode: 'erase' }]),
        ).not.toContain('overflow-hidden');
      }
    });

    it('keeps zero line height as automatic text leading', () => {
      const code = serializedNodesToCode([
        {
          id: 'auto-leading',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 0,
          content: 'Automatic leading',
          lineHeight: 0,
        } as SerializedNode,
      ]);
      expect(code).not.toContain('leading-[0px]');
    });

    it('preserves hard line breaks and maps a wrapped text width', () => {
      const text = {
        id: 'copy',
        type: 'text',
        x: 0,
        y: 0,
        zIndex: 0,
        content: 'First line\nSecond line and more',
        wordWrap: true,
        wordWrapWidth: 120,
      } as SerializedNode;
      const react = serializedNodesToCode([text]);
      expect(react).toContain('whitespace-pre-wrap');
      expect(react).toContain('inline-block');
      expect(react).toContain('max-w-[120px]');
      expect(react).toContain('overflowWrap: "anywhere"');
      const html = serializedNodesToCode([text], { framework: 'html-css' });
      expect(html).toContain('white-space: pre-wrap');
      expect(html).toContain('max-width: 120px');
      expect(html).toContain('overflow-wrap: anywhere');

      const unwrapped = serializedNodesToCode([
        { ...text, wordWrap: false } as SerializedNode,
      ]);
      expect(unwrapped).toContain('whitespace-pre');
      expect(unwrapped).not.toContain('max-w-[120px]');
    });

    it('exports wrapped line limits for ellipsis and clip', () => {
      const text = {
        id: 'summary',
        type: 'text',
        x: 0,
        y: 0,
        zIndex: 0,
        content: 'A long summary that spans several lines',
        wordWrap: true,
        wordWrapWidth: 120,
        maxLines: 2,
      } as SerializedNode;
      const react = serializedNodesToCode([text]);
      expect(react).toContain('WebkitLineClamp: 2');
      expect(react).toContain('WebkitBoxOrient: "vertical"');
      expect(react).toContain('overflow: "hidden"');
      const html = serializedNodesToCode([text], { framework: 'html-css' });
      expect(html).toContain('-webkit-line-clamp: 2');
      expect(html).toContain('display: -webkit-box');

      const clipped = { ...text, textOverflow: 'clip' } as SerializedNode;
      expect(serializedNodesToCode([clipped])).toContain(
        'maxHeight: "calc(2 * 1lh)"',
      );
      const clippedHtml = serializedNodesToCode([clipped], {
        framework: 'html-css',
      });
      expect(clippedHtml).toContain('max-height: calc(2 * 1lh)');
      expect(clippedHtml).not.toContain('-webkit-line-clamp');

      const unwrapped = serializedNodesToCode([
        { ...text, wordWrap: false } as SerializedNode,
      ]);
      expect(unwrapped).not.toContain('WebkitLineClamp');
    });

    it('exports a single CSS gradient fill as a background image', () => {
      for (const gradient of [
        'linear-gradient(90deg, #1d4ed8, #38bdf8)',
        'radial-gradient(circle at center, #ffffff, #1d4ed8)',
      ]) {
        const node = {
          id: 'gradient-card',
          type: 'rect',
          x: 0,
          y: 0,
          width: 180,
          height: 100,
          zIndex: 0,
          fills: [{ type: 'gradient', value: gradient }],
        } as SerializedNode;
        expect(serializedNodesToCode([node])).toContain(
          `backgroundImage: "${gradient}"`,
        );
        expect(
          serializedNodesToCode([node], { framework: 'html-css' }),
        ).toContain(`background-image: ${gradient}`);
      }

      const unsupported = {
        id: 'layered-card',
        type: 'rect',
        x: 0,
        y: 0,
        zIndex: 0,
        fills: [
          {
            type: 'gradient',
            value: 'linear-gradient(red, blue)',
            opacity: 0.5,
          },
        ],
      } as SerializedNode;
      expect(serializedNodesToCode([unsupported])).not.toContain(
        'backgroundImage',
      );
    });

    it('keeps ellipse geometry in HTML and React exports', () => {
      const ellipse = {
        id: 'avatar',
        type: 'ellipse',
        x: 0,
        y: 0,
        zIndex: 0,
        width: 80,
        height: 40,
        fills: [{ type: 'solid', value: '#2563eb' }],
      } as SerializedNode;
      const react = serializedNodesToCode([ellipse]);
      expect(react).toContain('w-[80px]');
      expect(react).toContain('h-[40px]');
      expect(react).toContain('rounded-[50%]');
      const html = serializedNodesToCode([ellipse], {
        framework: 'html-css',
      });
      expect(html).toContain('border-radius: 50%');
      expect(html).toContain('width: 80px');
      expect(html).toContain('height: 40px');

      const gradient = {
        ...ellipse,
        fills: [{ type: 'gradient', value: 'radial-gradient(red, blue)' }],
      } as SerializedNode;
      expect(serializedNodesToCode([gradient])).toContain(
        'backgroundImage: "radial-gradient(red, blue)"',
      );
    });

    it('exports rotation and flip around the canvas local origin', () => {
      const rotated = {
        id: 'rotated-card',
        type: 'rect',
        x: 0,
        y: 0,
        zIndex: 0,
        width: 100,
        height: 40,
        rotation: Math.PI / 4,
        scaleX: -1,
        scaleY: 0.5,
      } as SerializedNode;
      const react = serializedNodesToCode([rotated]);
      expect(react).toContain(
        'transform: "rotate(0.785398rad) scale(-1, 0.5)"',
      );
      expect(react).toContain('transformOrigin: "0 0"');
      const html = serializedNodesToCode([rotated], {
        framework: 'html-css',
      });
      expect(html).toContain('transform: rotate(0.785398rad) scale(-1, 0.5)');
      expect(html).toContain('transform-origin: 0 0');

      expect(
        serializedNodesToCode([
          { ...rotated, rotation: 0, scaleX: 1, scaleY: 1 } as SerializedNode,
        ]),
      ).not.toContain('transformOrigin');

      const text = {
        ...rotated,
        id: 'rotated-label',
        type: 'text',
        content: 'Tilted',
      } as SerializedNode;
      expect(serializedNodesToCode([text])).toContain('inline-block');
      expect(
        serializedNodesToCode([text], { framework: 'html-css' }),
      ).toContain('display: inline-block');
    });

    it('keeps a solid fill opacity on the paint instead of the whole node', () => {
      const card = {
        id: 'translucent-card',
        type: 'rect',
        x: 0,
        y: 0,
        zIndex: 0,
        width: 100,
        height: 40,
        opacity: 0.8,
        fills: [{ type: 'solid', value: '#2563eb', opacity: 0.5 }],
      } as SerializedNode;
      const react = serializedNodesToCode([card]);
      expect(react).toContain(
        'backgroundColor: "color-mix(in srgb, #2563eb 50%, transparent)"',
      );
      expect(react).toContain('opacity-[0.80]');
      const html = serializedNodesToCode([card], {
        framework: 'html-css',
      });
      expect(html).toContain(
        'background-color: color-mix(in srgb, #2563eb 50%, transparent)',
      );
      expect(html).toContain('opacity: 0.80');

      const text = {
        ...card,
        id: 'translucent-label',
        type: 'text',
        content: 'Label',
      } as SerializedNode;
      expect(serializedNodesToCode([text])).toContain(
        'color: "color-mix(in srgb, #2563eb 50%, transparent)"',
      );

      const tokenHtml = serializedNodesToCode(
        [
          {
            ...card,
            fills: [{ type: 'solid', value: '$color.surface', opacity: 0.25 }],
          } as SerializedNode,
        ],
        { framework: 'html-css', variablesMode: 'css-var' },
      );
      expect(tokenHtml).toContain(
        'color-mix(in srgb, var(--color-surface) 25%, transparent)',
      );
    });

    it('emits a single rect as a div with tailwind classes', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'r1',
          type: 'rect',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 1,
          cornerRadius: 8,
          fills: [{ type: 'solid', value: '#2563eb', opacity: 1 }],
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes, {
        framework: 'react-tailwind',
      });
      expect(code).toContain('export function Design()');
      expect(code).toContain('<div');
      expect(code).toContain('w-[100px]');
      expect(code).toContain('h-[100px]');
      expect(code).toContain('rounded-[8px]');
      expect(code).toContain('bg-[#2563eb]');
    });

    it('maps flex container + text child', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'box',
          type: 'rect',
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          zIndex: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: 10,
        } as SerializedNode,
        {
          id: 't',
          parentId: 'box',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 1,
          content: 'Button',
          fontSize: 16,
          alignSelf: 'flex-end',
          flexBasis: 80,
          fills: [{ type: 'solid', value: '#ffffff', opacity: 1 }],
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes);
      expect(code).toContain('flex');
      expect(code).toContain('items-center');
      expect(code).toContain('justify-center');
      expect(code).toContain('gap-[10px]');
      expect(code).toContain('p-[10px]');
      expect(code).toContain('self-end');
      expect(code).toContain('basis-[80px]');
      expect(code).toContain('<span');
      expect(code).toContain('Button');
      expect(code).toContain('text-[#ffffff]');
      expect(code).toContain('text-[16px]');
    });

    it('emits lucide-react icon with import', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'i',
          type: 'iconfont',
          x: 0,
          y: 0,
          width: 24,
          height: 24,
          zIndex: 1,
          iconFontName: 'search',
          iconFontFamily: 'lucide',
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes);
      expect(code).toContain("import { Search } from 'lucide-react';");
      expect(code).toContain('<Search');
      expect(code).toContain('size={24}');
    });

    it('emits iconify icon for non-lucide families', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'i',
          type: 'iconfont',
          x: 0,
          y: 0,
          width: 24,
          height: 24,
          zIndex: 1,
          iconFontName: 'home',
          iconFontFamily: 'phosphor',
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes);
      expect(code).toContain("import { Icon } from '@iconify/react';");
      expect(code).toContain('icon="phosphor:home"');
    });
  });

  describe('design variables modes', () => {
    const nodes: SerializedNode[] = [
      {
        id: 'r1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 1,
        fills: [{ type: 'solid', value: '$color.bg', opacity: 1 }],
      } as SerializedNode,
    ];
    const variables = {
      'color.bg': { type: 'color' as const, value: '#FFFFFF' },
    };

    it('resolved mode inlines literal values', () => {
      const code = serializedNodesToCode(nodes, {
        variablesMode: 'resolved',
        variables,
      });
      expect(code).toContain('bg-[#FFFFFF]');
      expect(code).not.toContain('$color.bg');
      expect(code).not.toContain('var(--color-bg)');
    });

    it('css-var mode emits var(--token) class', () => {
      const code = serializedNodesToCode(nodes, {
        variablesMode: 'css-var',
        variables,
      });
      expect(code).toContain('bg-[var(--color-bg)]');
    });

    it('preserve-token mode keeps $token via inline style', () => {
      const code = serializedNodesToCode(nodes, {
        variablesMode: 'preserve-token',
        variables,
      });
      expect(code).toContain('$color.bg');
      expect(code).toContain('style={{');
    });
  });

  describe('components and instances (preserve mode)', () => {
    const graph: SerializedNode[] = [
      {
        id: 'round-button',
        type: 'g',
        reusable: true,
        name: 'RoundButton',
        x: 0,
        y: 0,
        width: 120,
        height: 40,
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cornerRadius: 9999,
      } as SerializedNode,
      {
        id: 'label',
        parentId: 'round-button',
        type: 'text',
        name: 'label',
        x: 0,
        y: 0,
        zIndex: 1,
        content: 'Submit',
        fills: [{ type: 'solid', value: '#000000', opacity: 1 }],
      } as SerializedNode,
      {
        id: 'save-btn',
        type: 'ref',
        ref: 'round-button',
        x: 0,
        y: 0,
        zIndex: 2,
        descendants: {
          label: { content: 'Save' },
        },
      } as unknown as SerializedNode,
    ];

    it('emits a component definition and an instance with prop override', () => {
      const code = serializedNodesToCode(graph, {
        framework: 'react-tailwind',
        componentStructure: 'preserve',
      });
      // component def
      expect(code).toContain('export function RoundButton(');
      expect(code).toContain('interface RoundButtonProps');
      // default from template
      expect(code).toContain('"Submit"');
      // text bound to prop, not a literal
      expect(code).toContain('{label}');
      // instance call with overridden prop
      expect(code).toContain('<RoundButton');
      expect(code).toContain('label="Save"');
    });

    it('flatten mode expands instance into concrete DOM (no component)', () => {
      const code = serializedNodesToCode(graph, {
        framework: 'react-tailwind',
        componentStructure: 'flatten',
      });
      expect(code).not.toContain('export function RoundButton(');
      expect(code).not.toContain('<RoundButton');
      // 实例被展开为具体 DOM：保留 flex 容器与圆角
      expect(code).toContain('<div');
      expect(code).toContain('flex');
      expect(code).toContain('rounded-[9999px]');
      expect(code).toContain('<span');
      // overridden text rendered inline
      expect(code).toContain('Save');
      expect(code).not.toContain('Submit');
    });
  });

  describe('html-css emitter', () => {
    it('emits semantic controls and landmarks when node ids are annotated', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'page',
          type: 'rect',
          x: 0,
          y: 0,
          width: 320,
          height: 200,
          zIndex: 1,
          display: 'flex',
        } as SerializedNode,
        {
          id: 'title',
          parentId: 'page',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 2,
          content: 'Checkout',
        } as SerializedNode,
        {
          id: 'pay',
          parentId: 'page',
          type: 'rect',
          x: 0,
          y: 0,
          width: 120,
          height: 40,
          zIndex: 3,
          display: 'flex',
          fills: [{ type: 'solid', value: '#455ee6' }],
        } as SerializedNode,
        {
          id: 'help',
          parentId: 'page',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 4,
          content: 'Help',
        } as SerializedNode,
      ];
      const semanticElements = {
        page: { tag: 'main' as const },
        title: { tag: 'h1' as const },
        pay: { tag: 'button' as const },
        help: { tag: 'a' as const, href: '/help?topic=pay&lang=en' },
      };
      const html = serializedNodesToCode(nodes, {
        framework: 'html-css',
        semanticElements,
      });
      expect(html).toContain('<main');
      expect(html).toContain(
        '<h1 style="margin: 0; white-space: pre">Checkout</h1>',
      );
      expect(html).toContain('<button type="button"');
      expect(html).toContain('appearance: none; border: 0; padding: 0');
      expect(html).toContain('href="/help?topic=pay&amp;lang=en"');
      const react = serializedNodesToCode(nodes, { semanticElements });
      expect(react).toContain('<main');
      expect(react).toContain('<h1 className="whitespace-pre">Checkout</h1>');
      expect(react).toContain('<button type="button"');
      expect(react).toContain('href="/help?topic=pay&lang=en"');
    });

    it('keeps literal prices in generated text', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'price',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 1,
          content: '$48,295',
        } as SerializedNode,
      ];
      expect(
        serializedNodesToCode(nodes, {
          framework: 'html-css',
          variablesMode: 'css-var',
        }),
      ).toContain('$48,295');
      expect(
        serializedNodesToCode(nodes, { framework: 'react-tailwind' }),
      ).toContain('$48,295');
    });

    it('emits inline-styled html with iconify web component', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'box',
          type: 'rect',
          x: 0,
          y: 0,
          width: 200,
          height: 80,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fills: [{ type: 'solid', value: '#eee', opacity: 1 }],
        } as SerializedNode,
        {
          id: 'i',
          parentId: 'box',
          type: 'iconfont',
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          zIndex: 1,
          iconFontName: 'search',
          iconFontFamily: 'lucide',
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(code).toContain('<div style="');
      expect(code).toContain('display: flex');
      expect(code).toContain('background-color: #eee');
      expect(code).toContain('<iconify-icon icon="lucide:search"');
    });

    it('css-var mode injects :root block', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'r1',
          type: 'rect',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          zIndex: 1,
          fills: [{ type: 'solid', value: '$color.bg', opacity: 1 }],
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes, {
        framework: 'html-css',
        variablesMode: 'css-var',
        variables: { 'color.bg': { type: 'color', value: '#fff' } },
      });
      expect(code).toContain(':root{');
      expect(code).toContain('--color-bg:#fff');
      expect(code).toContain('var(--color-bg)');
    });
  });

  describe('buildCodeIR', () => {
    it('lets serialized zero-size flex containers grow around their children', () => {
      const nodes: SerializedNode[] = [
        {
          id: 'card',
          type: 'rect',
          x: 0,
          y: 0,
          width: 200,
          height: 0,
          zIndex: 1,
          display: 'flex',
          gap: 8,
        } as SerializedNode,
        {
          id: 'title',
          parentId: 'card',
          type: 'text',
          x: 0,
          y: 0,
          zIndex: 1,
          content: 'Shipping address',
        } as SerializedNode,
        {
          id: 'empty',
          type: 'rect',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          zIndex: 2,
        } as SerializedNode,
      ];
      const ir = buildCodeIR(nodes);
      expect(ir.roots[0].style).toMatchObject({ width: 200, gap: 8 });
      expect(ir.roots[0].style.height).toBeUndefined();
      expect(ir.roots[1].style).toMatchObject({ width: 0, height: 0 });
      const html = serializedNodesToCode(nodes, { framework: 'html-css' });
      expect(html).toContain('width: 200px');
      expect(html).toContain('<div style="width: 0px; height: 0px"></div>');
      expect(html).not.toContain('width: 200px; height: 0px');
    });

    it('produces a framework-agnostic tree with structured style', () => {
      const ir = buildCodeIR(
        [
          {
            id: 'r1',
            type: 'rect',
            x: 0,
            y: 0,
            width: 50,
            height: 50,
            zIndex: 1,
            cornerRadius: 4,
            fills: [{ type: 'solid', value: '#abc', opacity: 1 }],
          } as SerializedNode,
        ],
        {},
      );
      expect(ir.roots).toHaveLength(1);
      const root = ir.roots[0];
      expect(root.role).toBe('container');
      expect(root.style.width).toBe(50);
      expect(root.style.backgroundColor).toEqual({ literal: '#abc' });
      expect(root.style.borderRadius).toEqual({ literal: 4 });
    });
  });
});
