import { createDocumentWorld } from '../helpers/ecs-document';
import {
  Theme,
  ThemeMode,
  Pen,
  Selected,
  Highlighted,
} from '../../packages/ecs/src';

it('selection changes preserve unrelated theme and variable state ownership', async () => {
  const world = await createDocumentWorld();
  const api = world.apis[0];
  try {
    await world.reset(
      api,
      ['a', 'b'].map((id, index) => ({
        id,
        type: 'rect' as const,
        x: index * 60,
        y: 10,
        width: 40,
        height: 30,
        fills: [{ type: 'solid' as const, value: 'red' }],
      })),
    );
    await world.edit(
      api,
      (editor) =>
        editor.setAppState({
          themeMode: ThemeMode.DARK,
          theme: {
            mode: ThemeMode.DARK,
            colors: { dark: { background: '#102030' } },
          },
        }),
      'NEVER',
    );
    const initial = api.getAppState();
    const palette = api.getCanvas().read(Theme).colors;
    await world.edit(
      api,
      (editor) => {
        editor.highlightNodes([
          editor.getNodeById('a'),
          editor.getNodeById('b'),
        ]);
        editor.selectNodes([editor.getNodeById('a')]);
      },
      'NEVER',
    );
    expect(api.getAppState().layersSelected).toEqual(['a']);
    expect(api.getEntity(api.getNodeById('a')).has(Selected)).toBe(true);
    expect(api.getAppState().theme).toBe(initial.theme);
    expect(api.getAppState().variables).toBe(initial.variables);
    expect(api.getCanvas().read(Theme).colors).toBe(palette);
    await world.edit(
      api,
      (editor) => editor.selectNodes([editor.getNodeById('b')], true),
      'NEVER',
    );
    expect(api.getAppState().layersSelected).toEqual(['a', 'b']);
    await world.edit(
      api,
      (editor) => editor.deselectNodes([editor.getNodeById('a')]),
      'NEVER',
    );
    expect(api.getAppState().layersSelected).toEqual(['b']);
    expect(api.getAppState().layersHighlighted).not.toContain('a');
    expect(api.getEntity(api.getNodeById('a')).has(Selected)).toBe(false);
    expect(api.getEntity(api.getNodeById('a')).has(Highlighted)).toBe(false);
    expect(api.getCanvas().read(Theme).colors).toBe(palette);
    expect(api.getAppState().theme).toBe(initial.theme);
    expect(api.getAppState().variables).toBe(initial.variables);
    await world.edit(
      api,
      (editor) => editor.setAppState({ penbarSelected: Pen.HAND }),
      'NEVER',
    );
    for (let i = 0; i < 4; i++) await world.frame();
    expect(api.getAppState().layersSelected).toEqual([]);
    expect(api.getCanvas().read(Theme).colors).toBe(palette);
    expect(api.getAppState().theme).toBe(initial.theme);
    expect(api.getAppState().variables).toBe(initial.variables);
  } finally {
    await world.dispose();
  }
});
