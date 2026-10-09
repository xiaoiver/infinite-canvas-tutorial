import { ThemeMode, type SerializedNode } from '../../packages/ecs/src';
import {
  coerceDesignVariableType,
  designVariableThemeMatches,
  findThemedValueEntryIndexForMode,
  pickThemedValueFromVariableEntries,
  prepareSerializedNodesForSvgExport,
  updateDesignVariableValueForMode,
  type DesignVariable,
  type DesignVariableThemedEntry,
} from '../../packages/ecs/src/utils/design-variables';

const { LIGHT, DARK } = ThemeMode;

describe('design variable editing and export contracts', () => {
  const selections: [
    string,
    DesignVariableThemedEntry[],
    ThemeMode | undefined,
    string | number,
    number,
  ][] = [
    ['empty', [], DARK, '', 0],
    [
      'scalar fallback without theme',
      [{ value: 1, theme: { Mode: 'Dark' } }, { value: 2 }],
      undefined,
      2,
      1,
    ],
    [
      'first entry without a default',
      [{ value: 1, theme: { Mode: 'Dark' } }],
      LIGHT,
      1,
      0,
    ],
    [
      'empty default axes',
      [
        { value: 1, theme: {} },
        { value: 2, theme: { Mode: 'Dark' } },
      ],
      LIGHT,
      1,
      0,
    ],
    [
      'case and whitespace',
      [{ value: 1 }, { value: 2, theme: { ' MODE ': ' dArK ' } }],
      DARK,
      2,
      1,
    ],
    [
      'unknown axis falls back',
      [{ value: 1 }, { value: 2, theme: { Mode: 'Dark', Brand: 'A' } }],
      DARK,
      1,
      0,
    ],
    [
      'last equal-specificity match wins',
      [
        { value: 1, theme: { Mode: 'Dark' } },
        { value: 2, theme: { mode: 'dark' } },
      ],
      DARK,
      2,
      1,
    ],
    [
      'most specific match wins',
      [
        { value: 1, theme: { mode: 'dark', Mode: 'Dark' } },
        { value: 2, theme: { mode: 'dark' } },
      ],
      DARK,
      1,
      0,
    ],
    [
      'no mode and no default',
      [
        { value: 1, theme: { Mode: 'Dark' } },
        { value: 2, theme: { Mode: 'Light' } },
      ],
      undefined,
      1,
      0,
    ],
  ];
  it.each(selections)(
    'selects the documented fallback: %s',
    (_name, entries, mode, value, index) => {
      expect(pickThemedValueFromVariableEntries(entries, mode)).toBe(value);
      if (mode !== undefined)
        expect(findThemedValueEntryIndexForMode(entries, mode)).toBe(index);
    },
  );

  it('matches all theme axes, including absent and empty constraints', () => {
    expect(designVariableThemeMatches(undefined, {})).toBe(true);
    expect(designVariableThemeMatches({}, {})).toBe(true);
    expect(
      designVariableThemeMatches(
        { Mode: 'dark', Brand: 'A' },
        { mode: 'DARK', brand: 'a' },
      ),
    ).toBe(true);
    expect(
      designVariableThemeMatches(
        { Mode: 'dark', Brand: 'A' },
        { mode: 'dark' },
      ),
    ).toBe(false);
  });

  it.each([
    ['scalar', { type: 'number', value: 1 }, { type: 'number', value: 5 }],
    [
      'empty entries',
      { type: 'number', value: [] },
      { type: 'number', value: 5 },
    ],
    [
      'theme entry',
      {
        type: 'number',
        value: [{ value: 1 }, { value: 2, theme: { Mode: 'Dark' } }],
      },
      {
        type: 'number',
        value: [{ value: 1 }, { value: 5, theme: { Mode: 'Dark' } }],
      },
    ],
    [
      'default entry',
      { type: 'number', value: [{ value: 1 }] },
      { type: 'number', value: [{ value: 5 }] },
    ],
  ] as const)(
    'edits %s without mutating the source definition',
    (_name, source, expected) => {
      const def = structuredClone(source) as DesignVariable;
      expect(updateDesignVariableValueForMode(def, DARK, 5)).toEqual(expected);
      expect(def).toEqual(source);
    },
  );

  it.each([
    ['color', 12, '12'],
    ['color', 'red', 'red'],
    ['number', 12, 12],
    ['number', '12.5px', 12.5],
    ['number', 'invalid', 0],
    ['number', Infinity, 0],
    ['string', 12, '12'],
  ] as const)(
    'coerces %s from %s and preserves themed entries',
    (type, value, expected) => {
      expect(coerceDesignVariableType({ type: 'string', value }, type)).toEqual(
        { type, value: expected },
      );
      const def: DesignVariable = {
        type: 'string',
        value: [{ value, theme: { Mode: 'Dark' } }],
      };
      expect(coerceDesignVariableType(def, type)).toEqual({
        type,
        value: [{ value: expected, theme: { Mode: 'Dark' } }],
      });
      expect(def.value).toEqual([{ value, theme: { Mode: 'Dark' } }]);
    },
  );

  it.each(['resolved', 'preserve-token', 'css-var'] as const)(
    'exports multilayer bindings with %s without modifying the document',
    (mode) => {
      const node = {
        id: 'shape',
        type: 'rect',
        zIndex: 0,
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        fills: [{ type: 'solid', value: '$paint', opacity: '$alpha' }],
        strokes: [{ type: 'solid', value: '$paint', opacity: '$alpha' }],
        strokeWidth: '$size',
        cornerRadius: '$size',
      } as unknown as SerializedNode;
      const original = structuredClone(node);
      const result = prepareSerializedNodesForSvgExport(
        [node],
        {
          paint: {
            type: 'color',
            value: [
              { value: 'red' },
              { value: 'blue', theme: { Mode: 'Dark' } },
            ],
          },
          alpha: { type: 'number', value: 0.5 },
          size: { type: 'number', value: 4 },
        },
        mode,
        DARK,
      );
      const expected =
        mode === 'resolved'
          ? { value: 'blue', opacity: 0.5, size: 4 }
          : mode === 'css-var'
          ? {
              value: 'var(--paint)',
              opacity: 'var(--alpha)',
              size: 'var(--size)',
            }
          : { value: '$paint', opacity: '$alpha', size: '$size' };
      for (const key of ['fills', 'strokes'])
        expect(result.nodes[0][key]).toEqual([
          { type: 'solid', value: expected.value, opacity: expected.opacity },
        ]);
      expect(result.nodes[0]['strokeWidth']).toBe(expected.size);
      expect(result.nodes[0]['cornerRadius']).toBe(expected.size);
      if (mode === 'css-var')
        expect(result.cssRootStyle).toContain('--paint:blue');
      expect(node).toEqual(original);
    },
  );
});
