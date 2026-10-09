import {
  FillLayers,
  Group,
  Opacity,
  Path,
  Stroke,
  StrokeLayers,
  ThemeMode,
  Text,
  Rect,
  Parent,
  ComputedRough,
  registerIconifyIconSet,
  unregisterIconifyIconSet,
  type API,
  type SerializedNode,
} from '../../packages/ecs/src';
import { createDocumentWorld } from '../helpers/ecs-document';

const group = (patch: Partial<SerializedNode> = {}): SerializedNode =>
  ({
    id: 'group',
    type: 'g',
    zIndex: 0,
    x: 0,
    y: 0,
    ...patch,
  } as SerializedNode);
const shape = (patch: Partial<SerializedNode> = {}): SerializedNode =>
  ({
    id: 'shape',
    type: 'path',
    parentId: 'group',
    zIndex: 1,
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    d: 'M0 0L40 0L40 40L0 40Z',
    ...patch,
  } as SerializedNode);
const solid = (value: string) => [{ type: 'solid' as const, value }];
let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
beforeAll(async () => {
  world = await createDocumentWorld();
  [api] = world.apis;
  registerIconifyIconSet('inherit-test', {
    width: 20,
    height: 20,
    icons: {
      triangle: { body: '<path d="M0 0L20 0L10 20Z" fill="currentColor"/>' },
    },
  });
});
afterAll(async () => {
  unregisterIconifyIconSet('inherit-test');
  await world?.dispose();
});
beforeEach(async () => {
  await world.reset(api, []);
  await world.edit(
    api,
    (editor) =>
      editor.setAppState(
        { variables: {}, themeMode: ThemeMode.LIGHT },
        { replaceVariables: true },
      ),
    'NEVER',
  );
  api.clearHistory();
});
const entity = (id = 'shape') => api.getEntity(api.getNodeById(id));
const update = (id: string, patch: Partial<SerializedNode>) =>
  world.edit(api, (editor) => editor.updateNode(editor.getNodeById(id), patch));
const presentation = (id = 'shape') => {
  const e = entity(id);
  return {
    fills: e.has(FillLayers) ? structuredClone(e.read(FillLayers).layers) : [],
    strokes: e.has(StrokeLayers)
      ? structuredClone(e.read(StrokeLayers).layers)
      : [],
    width: e.has(Stroke) ? e.read(Stroke).width : 1,
    linecap: e.has(Stroke) ? e.read(Stroke).linecap : 'butt',
    linejoin: e.has(Stroke) ? e.read(Stroke).linejoin : 'miter',
    opacity: e.has(Opacity) ? e.read(Opacity).opacity : 1,
    fillRule: e.has(Path) ? e.read(Path).fillRule : 'nonzero',
  };
};
const cases = [
  ['fills', solid('red'), solid('blue'), 'fills'],
  ['strokes', solid('red'), solid('blue'), 'strokes'],
  ['strokeWidth', 2, 6, 'width'],
  ['strokeLinecap', 'round', 'square', 'linecap'],
  ['strokeLinejoin', 'round', 'bevel', 'linejoin'],
  ['opacity', 0.5, 0.25, 'opacity'],
  ['fillRule', 'nonzero', 'evenodd', 'fillRule'],
] as const;

describe('group presentation synchronization', () => {
  it.each(cases)(
    'propagates %s without baking it into child wire and survives history',
    async (key, before, after, field) => {
      await world.reset(api, [group({ [key]: before }), shape()]);
      const childWire = structuredClone(api.getNodeById('shape'));
      expect(presentation()[field]).toEqual(before);
      await update('group', { [key]: after });
      expect(presentation()[field]).toEqual(after);
      expect(api.getNodeById('shape')).toEqual(childWire);
      await world.history(api, 'undo');
      expect(presentation()[field]).toEqual(before);
      await world.history(api, 'redo');
      expect(presentation()[field]).toEqual(after);
      const edited = presentation();
      const nodes = structuredClone(api.getNodes());
      await world.reset(api, []);
      await world.reset(api, nodes);
      expect(presentation()).toEqual(edited);
    },
  );

  it.each(cases)(
    'clearing a child %s override restores inheritance',
    async (key, inherited, own, field) => {
      await world.reset(api, [
        group({ [key]: inherited }),
        shape({ [key]: own }),
      ]);
      await update('shape', { [key]: undefined });
      expect(presentation()[field]).toEqual(inherited);
      expect(api.getNodeById('shape')).not.toHaveProperty(key);
      await world.history(api, 'undo');
      expect(presentation()[field]).toEqual(own);
      await world.history(api, 'redo');
      expect(presentation()[field]).toEqual(inherited);
    },
  );

  it('preserves authored dash geometry when inherited stroke paint is disabled and restored', async () => {
    await world.reset(api, [
      group({ strokes: solid('red') }),
      shape({
        strokeWidth: 4,
        strokeDasharray: '5, 3',
        strokeDashoffset: 2,
        strokeDashCap: 'round',
        strokeAlignment: 'outer',
        strokeMiterlimit: 8,
      }),
    ]);
    await update('group', { strokes: [] });
    await update('group', { strokes: solid('blue') });
    const stroke = entity().read(Stroke);
    expect(stroke.width).toBe(4);
    expect([...stroke.dasharray]).toEqual([5, 3]);
    expect(stroke.dashoffset).toBe(2);
    expect(stroke.dashcap).toBe('round');
    expect(stroke.alignment).toBe('outer');
    expect(stroke.miterlimit).toBe(8);
  });

  it('reparents a group and refreshes descendants without changing their explicit overrides', async () => {
    await world.reset(api, [
      group({ id: 'red', fills: solid('red'), strokeWidth: 2 }),
      group({ id: 'blue', fills: solid('blue'), strokeWidth: 6 }),
      group({ parentId: 'red' }),
      shape(),
      shape({ id: 'own', fills: solid('green') }),
    ]);
    await update('group', { parentId: 'blue' });
    expect(presentation().fills).toEqual(solid('blue'));
    expect(presentation().width).toBe(6);
    expect(presentation('own').fills).toEqual(solid('green'));
    expect(entity('group').read(Group).fill).toBe('blue');
    await world.history(api, 'undo');
    expect(presentation().fills).toEqual(solid('red'));
    await world.history(api, 'redo');
    expect(presentation().fills).toEqual(solid('blue'));
  });

  it('refreshes vector icon children when inherited paint changes', async () => {
    await world.reset(api, [
      group({ fills: solid('red') }),
      {
        id: 'icon',
        type: 'iconfont',
        parentId: 'group',
        zIndex: 1,
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        iconFontFamily: 'inherit-test',
        iconFontName: 'triangle',
      },
    ]);
    const fills = () =>
      entity('icon').read(Parent).children[0].read(FillLayers).layers;
    expect(fills()[0].value).toBe('red');
    await update('group', { fills: solid('blue') });
    expect(fills()[0].value).toBe('blue');
    await world.history(api, 'undo');
    expect(fills()[0].value).toBe('red');
    await world.history(api, 'redo');
    expect(fills()[0].value).toBe('blue');
  });

  it('rebuilds rough fill geometry when inherited paint becomes empty', async () => {
    await world.reset(api, [
      group({ fills: solid('red') }),
      shape({ type: 'rough-path', roughFillStyle: 'solid', roughSeed: 1 }),
    ]);
    const hasFill = () =>
      entity()
        .read(ComputedRough)
        .drawableSets.some((set) => set.type === 'fillPath');
    expect(hasFill()).toBe(true);
    await update('group', { fills: [] });
    expect(hasFill()).toBe(false);
    await world.history(api, 'undo');
    expect(hasFill()).toBe(true);
  });

  it('detaching from the group restores presentation defaults', async () => {
    await world.reset(api, [
      group({
        fills: solid('red'),
        strokeWidth: 6,
        opacity: 0.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'bevel',
        fillRule: 'evenodd',
      }),
      shape(),
    ]);
    await update('shape', { parentId: undefined });
    expect(presentation()).toEqual({
      fills: [],
      strokes: [],
      width: 1,
      opacity: 1,
      linecap: 'butt',
      linejoin: 'miter',
      fillRule: 'nonzero',
    });
    await world.history(api, 'undo');
    expect(presentation().fills).toEqual(solid('red'));
  });

  it('inherits through a non-group parent without inheriting that parent own paint', async () => {
    await world.reset(api, [
      group({ fills: solid('red') }),
      shape({ id: 'middle', fills: solid('green') }),
      shape({ parentId: 'middle' }),
    ]);
    await update('group', { fills: solid('blue') });
    expect(presentation().fills).toEqual(solid('blue'));
    expect(presentation('middle').fills).toEqual(solid('green'));
  });

  it('keeps empty and disabled paint overrides independent of group updates', async () => {
    await world.reset(api, [
      group({ fills: solid('red'), strokes: solid('red') }),
      shape({
        fills: [],
        strokes: [{ type: 'solid', value: 'green', enabled: false }],
      }),
    ]);
    await update('group', { fills: solid('blue'), strokes: solid('blue') });
    expect(presentation().fills).toEqual([]);
    expect(presentation().strokes).toEqual([
      { type: 'solid', value: 'green', enabled: false },
    ]);
  });

  it.each(['parent-first', 'child-first'] as const)(
    'applies batch edits against the final scene (%s)',
    async (order) => {
      await world.reset(api, [
        group({ fills: solid('red') }),
        shape({ fills: solid('green') }),
      ]);
      const parent = { ...api.getNodeById('group'), fills: solid('blue') };
      const child = { ...api.getNodeById('shape'), fills: undefined };
      await world.edit(api, (editor) =>
        editor.updateNodes(
          order === 'parent-first' ? [parent, child] : [child, parent],
        ),
      );
      expect(presentation().fills).toEqual(solid('blue'));
      await world.history(api, 'undo');
      expect(presentation().fills).toEqual(solid('green'));
      await world.history(api, 'redo');
      expect(presentation().fills).toEqual(solid('blue'));
    },
  );

  it('initializes a new child from its parent final batch values', async () => {
    await world.reset(api, [group({ fills: solid('red') })]);
    await world.edit(api, (editor) =>
      editor.updateNodes([
        shape(),
        {
          ...editor.getNodeById('group'),
          fills: solid('blue'),
        } as SerializedNode,
      ]),
    );
    expect(presentation().fills).toEqual(solid('blue'));
    expect(api.getNodeById('shape')).not.toHaveProperty('fills');
    await world.history(api, 'undo');
    expect(api.getNodeById('shape')).toBeUndefined();
    await world.history(api, 'redo');
    expect(presentation().fills).toEqual(solid('blue'));
  });

  it('refreshes untouched descendants when a remote snapshot changes only the group', async () => {
    await world.reset(api, [group({ fills: solid('red') }), shape()]);
    const child = structuredClone(api.getNodeById('shape'));
    await world.edit(
      api,
      (editor) =>
        editor.replaceDocument(
          [group({ fills: solid('blue') }), child],
          'remote',
        ),
      'NEVER',
    );
    expect(presentation().fills).toEqual(solid('blue'));
    expect(api.getNodeById('shape')).toEqual(child);
  });

  it('keeps theme preference out of document undo while restoring edited geometry', async () => {
    await world.edit(
      api,
      (editor) =>
        editor.setAppState({
          variables: {
            color: {
              type: 'color',
              value: [
                { value: 'red' },
                { value: 'blue', theme: { Mode: 'Dark' } },
              ],
            },
          },
        }),
      'NEVER',
    );
    await world.reset(api, [group({ fills: solid('$color') }), shape()]);
    await update('shape', { x: 30 });
    api.setAppState({ themeMode: ThemeMode.DARK });
    await world.frame();
    expect(presentation().fills).toEqual(solid('blue'));
    await world.history(api, 'undo');
    expect(api.getNodeById('shape').x).toBe(0);
    expect(api.getAppState().themeMode).toBe(ThemeMode.DARK);
    expect(presentation().fills).toEqual(solid('blue'));
    expect(api.isUndoStackEmpty()).toBe(true);
    await world.history(api, 'redo');
    expect(api.getNodeById('shape').x).toBe(30);
  });

  it('refreshes inherited variable bindings on definition and theme changes', async () => {
    await world.edit(
      api,
      (editor) =>
        editor.setAppState({
          variables: {
            color: {
              type: 'color',
              value: [
                { value: 'red' },
                { value: 'blue', theme: { Mode: 'Dark' } },
              ],
            },
          },
        }),
      'NEVER',
    );
    await world.reset(api, [group({ fills: solid('$color') }), shape()]);
    expect(presentation().fills).toEqual(solid('red'));
    await world.edit(
      api,
      (editor) => editor.setAppState({ themeMode: ThemeMode.DARK }),
      'NEVER',
    );
    expect(presentation().fills).toEqual(solid('blue'));
    await world.edit(api, (editor) =>
      editor.setAppState({
        variables: { color: { type: 'color', value: 'green' } },
      }),
    );
    expect(presentation().fills).toEqual(solid('green'));
    await world.history(api, 'undo');
    expect(presentation().fills).toEqual(solid('blue'));
    await world.history(api, 'redo');
    expect(presentation().fills).toEqual(solid('green'));
    expect(api.getNodeById('group')['fills']).toEqual(solid('$color'));
    expect(api.getNodeById('shape')).not.toHaveProperty('fills');
  });
});

describe('design variable component synchronization', () => {
  it.each([
    ['fontSize', 20, 32],
    ['letterSpacing', 2, 5],
    ['lineHeight', 24, 40],
    ['fontFamily', 'serif', 'sans-serif'],
    ['fontVariant', 'normal', 'small-caps'],
  ] as const)(
    'loads and refreshes text %s consistently through history',
    async (key, before, after) => {
      const definition = (value: string | number) => ({
        type:
          typeof value === 'number' ? ('number' as const) : ('string' as const),
        value,
      });
      await world.edit(
        api,
        (editor) =>
          editor.setAppState({ variables: { value: definition(before) } }),
        'NEVER',
      );
      await world.reset(api, [
        {
          id: 'text',
          type: 'text',
          zIndex: 0,
          x: 0,
          y: 0,
          width: 160,
          height: 40,
          content: 'Variable text',
          [key]: '$value',
        } as SerializedNode,
      ]);
      const read = () => entity('text').read(Text)[key];
      expect(read()).toBe(before);
      await world.edit(api, (editor) =>
        editor.setAppState({ variables: { value: definition(after) } }),
      );
      expect(read()).toBe(after);
      await world.history(api, 'undo');
      expect(read()).toBe(before);
      await world.history(api, 'redo');
      expect(read()).toBe(after);
      expect(api.getNodeById('text')[key]).toBe('$value');
    },
  );

  it.each([
    ['fontSize', 28, 12],
    ['letterSpacing', 4, 0],
    ['lineHeight', 32, 0],
  ] as const)(
    'falls back safely when the variable backing %s is removed',
    async (key, value, fallback) => {
      await world.edit(
        api,
        (editor) =>
          editor.setAppState({
            variables: { value: { type: 'number', value } },
          }),
        'NEVER',
      );
      await world.reset(api, [
        {
          id: 'text',
          type: 'text',
          zIndex: 0,
          x: 0,
          y: 0,
          width: 160,
          height: 40,
          content: 'Safe fallback',
          [key]: '$value',
        } as SerializedNode,
      ]);
      await world.edit(api, (editor) =>
        editor.setAppState({ variables: {} }, { replaceVariables: true }),
      );
      expect(entity('text').read(Text)[key]).toBe(fallback);
      await world.history(api, 'undo');
      expect(entity('text').read(Text)[key]).toBe(value);
      await world.history(api, 'redo');
      expect(entity('text').read(Text)[key]).toBe(fallback);
      expect(api.getNodeById('text')[key]).toBe('$value');
    },
  );

  it('resets the corner radius and stroke width after their variable is removed', async () => {
    await world.edit(
      api,
      (editor) =>
        editor.setAppState({
          variables: { size: { type: 'number', value: 8 } },
        }),
      'NEVER',
    );
    await world.reset(api, [
      {
        id: 'rect',
        type: 'rect',
        zIndex: 0,
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        cornerRadius: '$size',
        strokeWidth: '$size',
        strokes: solid('black'),
      } as unknown as SerializedNode,
    ]);
    expect(entity('rect').read(Rect).cornerRadius).toBe(8);
    await world.edit(api, (editor) =>
      editor.setAppState({ variables: {} }, { replaceVariables: true }),
    );
    expect(entity('rect').read(Rect).cornerRadius).toBe(0);
    expect(entity('rect').read(Stroke).width).toBe(1);
    await world.history(api, 'undo');
    expect(entity('rect').read(Rect).cornerRadius).toBe(8);
    expect(entity('rect').read(Stroke).width).toBe(8);
  });
});
