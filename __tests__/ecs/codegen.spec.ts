import type { SerializedNode } from '../../packages/ecs/src';
import {
  serializedNodesToCode,
  buildCodeIR,
} from '../../packages/ecs/src/utils/codegen';

describe('design-to-code (codegen)', () => {
  describe('react-tailwind emitter', () => {
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
          fills: [{ type: 'solid', value: '#ffffff', opacity: 1 }],
        } as SerializedNode,
      ];
      const code = serializedNodesToCode(nodes);
      expect(code).toContain('flex');
      expect(code).toContain('items-center');
      expect(code).toContain('justify-center');
      expect(code).toContain('gap-[10px]');
      expect(code).toContain('p-[10px]');
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
      // overridden text rendered inline
      expect(code).toContain('Save');
    });
  });

  describe('html-css emitter', () => {
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
