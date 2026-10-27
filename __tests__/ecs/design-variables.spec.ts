import { RectSerializedNode } from '../../packages/ecs/src';
import { ThemeMode } from '../../packages/ecs/src/components/Theme';
import {
  isDesignVariableReference,
  resolveDesignVariableValue,
  resolveSerializedNodesDesignVariables,
  prepareSerializedNodesForSvgExport,
  buildDesignVariablesCssRootBlock,
  buildDesignVariableThemeContext,
  getDesignVariableLightDarkValues,
  setDesignVariableLightDarkColumn,
} from '../../packages/ecs/src/utils/design-variables';

describe('design variables', () => {
  it('detects $ references', () => {
    expect(isDesignVariableReference('$color.bg')).toBe(true);
    expect(isDesignVariableReference('$--primary')).toBe(true);
    expect(isDesignVariableReference('$brand/primary')).toBe(true);
    expect(isDesignVariableReference('$')).toBe(false);
    expect(isDesignVariableReference('red')).toBe(false);
    expect(isDesignVariableReference('$48,295')).toBe(false);
    expect(isDesignVariableReference('$29')).toBe(false);
  });

  it('resolves color and number tokens', () => {
    const variables = {
      'color.bg': { type: 'color' as const, value: '#FFFFFF' },
      'text.title': { type: 'number' as const, value: 72 },
    };
    expect(resolveDesignVariableValue('$color.bg', variables)).toBe('#FFFFFF');
    expect(resolveDesignVariableValue('$text.title', variables)).toBe(72);
    expect(resolveDesignVariableValue('#abc', variables)).toBe('#abc');
  });

  it('leaves unknown tokens unchanged', () => {
    expect(resolveDesignVariableValue('$missing', {})).toBe('$missing');
  });

  it('resolveSerializedNodesDesignVariables resolves known keys', () => {
    const nodes = [
      {
        id: 'a',
        type: 'rect',
        fills: [{ type: 'solid', value: '$color.bg', opacity: 1 }],
        strokes: [{ type: 'solid', value: '$color.bg', opacity: 1 }],
        zIndex: 0,
      },
    ];
    const out = resolveSerializedNodesDesignVariables(nodes as any, {
      'color.bg': { type: 'color', value: '#eee' },
    });
    expect((out[0] as RectSerializedNode).fills?.[0]?.value).toBe('#eee');
    expect((out[0] as RectSerializedNode).strokes?.[0]?.value).toBe('#eee');
    expect(nodes[0].fills?.[0]?.value).toBe('$color.bg');
  });

  it('resolves design variables in reusable instance overrides', () => {
    const nodes = [
      {
        id: 'instance',
        type: 'ref',
        ref: 'template',
        fills: [{ type: 'solid', value: '$color.bg' }],
        descendants: {
          action: {
            fills: [{ type: 'solid', value: '$color.accent' }],
          },
        },
      },
    ];
    const variables = {
      'color.bg': { type: 'color' as const, value: '#eee' },
      'color.accent': { type: 'color' as const, value: '#7969f5' },
    };
    const resolved = resolveSerializedNodesDesignVariables(
      nodes as any,
      variables,
    )[0] as (typeof nodes)[number];
    expect(resolved.fills[0].value).toBe('#eee');
    expect(resolved.descendants.action.fills[0].value).toBe('#7969f5');
    expect(nodes[0].descendants.action.fills[0].value).toBe('$color.accent');

    const cssVars = prepareSerializedNodesForSvgExport(
      nodes as any,
      variables,
      'css-var',
    ).nodes[0] as (typeof nodes)[number];
    expect(cssVars.descendants.action.fills[0].value).toBe(
      'var(--color-accent)',
    );
  });

  it('resolves text content while preserving literal prices', () => {
    const nodes = [
      { id: 'title', type: 'text', content: '$copy.title' },
      { id: 'price', type: 'text', content: '$29' },
      {
        id: 'instance',
        type: 'ref',
        ref: 'template',
        descendants: { label: { content: '$copy.action' } },
      },
    ];
    const variables = {
      'copy.title': { type: 'string' as const, value: 'Welcome' },
      'copy.action': { type: 'string' as const, value: 'Continue' },
    };
    for (const mode of ['resolved', 'css-var'] as const) {
      const exported = prepareSerializedNodesForSvgExport(
        nodes as any,
        variables,
        mode,
      ).nodes as typeof nodes;
      expect(exported[0].content).toBe('Welcome');
      expect(exported[1].content).toBe('$29');
      expect(exported[2].descendants?.label.content).toBe('Continue');
    }
    expect(nodes[0].content).toBe('$copy.title');
    expect(nodes[2].descendants?.label.content).toBe('$copy.action');
  });

  it('prepareSerializedNodesForSvgExport css-var', () => {
    const nodes = [
      {
        id: 'a',
        type: 'rect',
        fills: [{ type: 'solid', value: '$color.bg', opacity: 1 }],
        zIndex: 0,
      },
    ];
    const vars = {
      'color.bg': { type: 'color' as const, value: '#00f' },
    };
    const { nodes: out, cssRootStyle } = prepareSerializedNodesForSvgExport(
      nodes as any,
      vars,
      'css-var',
    );
    expect((out[0] as { fills?: { value: string }[] }).fills?.[0]?.value).toBe(
      'var(--color-bg)',
    );
    expect(cssRootStyle).toContain('--color-bg:#00f');
  });

  it('buildDesignVariablesCssRootBlock', () => {
    expect(
      buildDesignVariablesCssRootBlock({
        'text.size': { type: 'number', value: 16 },
      }),
    ).toContain('--text-size:16px');
  });

  it('resolves themed variable entries (Pencil style)', () => {
    const variables = {
      '--primary': {
        type: 'color' as const,
        value: [
          { value: '#AAAAAA' },
          { value: '#FF8400', theme: { Mode: 'Dark' } },
        ],
      },
    };
    expect(
      resolveDesignVariableValue('$--primary', variables, ThemeMode.LIGHT),
    ).toBe('#AAAAAA');
    expect(
      resolveDesignVariableValue('$--primary', variables, ThemeMode.DARK),
    ).toBe('#FF8400');
  });

  it('buildDesignVariableThemeContext exposes mode and Mode', () => {
    const c = buildDesignVariableThemeContext(ThemeMode.DARK);
    expect(c.mode).toBe('dark');
    expect(c.Mode).toBe('Dark');
  });

  it('setDesignVariableLightDarkColumn keeps peer column and normalizes to Light/Dark', () => {
    const def: {
      type: 'color';
      value: { value: string; theme?: { Mode: string } }[];
    } = {
      type: 'color',
      value: [
        { value: '#000000', theme: { Mode: 'Light' } },
        { value: '#111111', theme: { Mode: 'Dark' } },
      ],
    };
    const next = setDesignVariableLightDarkColumn(
      def,
      ThemeMode.LIGHT,
      '#ffffff',
    );
    const pair = getDesignVariableLightDarkValues(next);
    expect(pair.light).toBe('#ffffff');
    expect(pair.dark).toBe('#111111');
  });
});
