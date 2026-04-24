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
    expect(isDesignVariableReference('$')).toBe(false);
    expect(isDesignVariableReference('red')).toBe(false);
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
        fill: '$color.bg',
        stroke: '$color.bg',
        zIndex: 0,
      },
    ];
    const out = resolveSerializedNodesDesignVariables(nodes as any, {
      'color.bg': { type: 'color', value: '#eee' },
    });
    expect((out[0] as RectSerializedNode).fill).toBe('#eee');
    expect((out[0] as RectSerializedNode).stroke).toBe('#eee');
    expect(nodes[0].fill).toBe('$color.bg');
  });

  it('prepareSerializedNodesForSvgExport css-var', () => {
    const nodes = [
      {
        id: 'a',
        type: 'rect',
        fill: '$color.bg',
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
    expect((out[0] as { fill: string }).fill).toBe('var(--color-bg)');
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
      resolveDesignVariableValue(
        '$--primary',
        variables,
        ThemeMode.LIGHT,
      ),
    ).toBe('#AAAAAA');
    expect(
      resolveDesignVariableValue(
        '$--primary',
        variables,
        ThemeMode.DARK,
      ),
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
