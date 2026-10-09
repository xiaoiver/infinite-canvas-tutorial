import {
  ComputedTextMetrics,
  DropShadow,
  Ellipse,
  FillLayers,
  Filter,
  IconFont,
  IconFontEllipseStrokeRasterPlaceholder,
  InnerShadow,
  Line,
  NodeLayerBlendMode,
  Parent,
  Path,
  Stroke,
  StrokeLayers,
  Text,
  TextDecoration,
  Visibility,
  registerIconifyIconSet,
  unregisterIconifyIconSet,
  type API,
  type SerializedNode,
  type TextSerializedNode,
} from '../../packages/ecs/src';
import { createDocumentWorld } from '../helpers/ecs-document';
import './filter-test-setup';

const textNode = (
  patch: Partial<TextSerializedNode> = {},
): TextSerializedNode => ({
  id: 'text',
  type: 'text',
  zIndex: 0,
  x: 10,
  y: 20,
  width: 300,
  height: 24,
  content: 'one two three four five six',
  fontFamily: 'sans-serif',
  fontSize: 20,
  fills: [{ type: 'solid', value: 'black' }],
  ...patch,
});
const iconNode = (patch: Partial<SerializedNode> = {}): SerializedNode =>
  ({
    id: 'icon',
    type: 'iconfont',
    zIndex: 0,
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    iconFontFamily: 'sync-test',
    iconFontName: 'circle',
    ...patch,
  } as SerializedNode);
let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
beforeAll(async () => {
  world = await createDocumentWorld();
  [api] = world.apis;
  registerIconifyIconSet('sync-test', {
    width: 20,
    height: 20,
    icons: {
      circle: {
        body: '<circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/>',
      },
      line: {
        body: '<line x1="2" y1="3" x2="18" y2="17" stroke="currentColor" stroke-width="2"/>',
      },
      path: {
        body: '<path d="M2 2L18 2L10 18Z" fill="currentColor" stroke="none" fill-rule="evenodd"/>',
      },
      pair: {
        body: '<circle cx="5" cy="10" r="4" fill="red"/><circle cx="15" cy="10" r="4" fill="blue"/>',
      },
    },
  });
});
afterAll(async () => {
  unregisterIconifyIconSet('sync-test');
  await world?.dispose();
});
beforeEach(async () => {
  await world.reset(api, []);
});
const entity = (id = 'text') => api.getEntity(api.getNodeById(id));
const update = (patch: Partial<SerializedNode>, id = 'text') =>
  world.edit(api, (editor) => editor.updateNode(editor.getNodeById(id), patch));

describe('text property synchronization', () => {
  beforeEach(async () => {
    await world.reset(api, [textNode()]);
  });

  it.each([
    ['content', 'changed'],
    ['fontFamily', 'serif'],
    ['fontSize', 32],
    ['fontWeight', 700],
    ['fontStyle', 'italic'],
    ['fontVariant', 'small-caps'],
    ['fontKerning', false],
    ['letterSpacing', 3],
    ['lineHeight', 40],
    ['anchorX', 12],
    ['anchorY', 18],
    ['wordWrap', true],
    ['wordWrapWidth', 60],
    ['whiteSpace', 'pre'],
    ['maxLines', 2],
    ['textOverflow', 'clip'],
    ['leading', 5],
  ] as const)(
    'applies %s to the component and restores it through undo/redo',
    async (key, value) => {
      const original = entity().read(Text)[key];
      await update({ [key]: value });
      expect(api.getNodeById('text')[key]).toBe(value);
      expect(entity().read(Text)[key]).toBe(value);
      await world.history(api, 'undo');
      expect(entity().read(Text)[key]).toBe(original);
      await world.history(api, 'redo');
      expect(entity().read(Text)[key]).toBe(value);
    },
  );

  it('reflows measured lines when wrapping, line count and overflow change', async () => {
    const lines = () => [...entity().read(ComputedTextMetrics).lines];
    expect(lines()).toHaveLength(1);
    await update({ wordWrap: true, wordWrapWidth: 60 });
    expect(lines().length).toBeGreaterThan(2);
    await update({ maxLines: 1, textOverflow: 'ellipsis' });
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toMatch(/\.\.\.$/);
    await update({ textOverflow: 'clip' });
    expect(lines()[0]).not.toMatch(/\.\.\.$/);
    await world.history(api, 'undo');
    expect(lines()[0]).toMatch(/\.\.\.$/);
    await world.history(api, 'redo');
    expect(lines()[0]).not.toMatch(/\.\.\.$/);
  });

  it('loads clipping and leading consistently with an edited text layout', async () => {
    const patch: Partial<TextSerializedNode> = {
      wordWrap: true,
      wordWrapWidth: 60,
      maxLines: 2,
      textOverflow: 'clip',
      leading: 5,
    };
    await update(patch);
    const metrics = () => {
      const { lines, width, height, lineHeight } =
        entity().read(ComputedTextMetrics);
      return { lines: [...lines], width, height, lineHeight };
    };
    const edited = metrics();
    expect(edited.lines).toHaveLength(2);
    expect(edited.lines[1]).not.toMatch(/\.\.\.$/);
    await world.reset(api, []);
    await world.reset(api, [textNode(patch)]);
    expect(metrics()).toEqual(edited);
  });

  it.each([
    ['fontVariant', 'small-caps', 'normal'],
    ['letterSpacing', 3, 0],
    ['lineHeight', 40, 0],
    ['wordWrapWidth', 80, 0],
    ['fontSize', 32, 12],
    ['fontWeight', 700, 'normal'],
    ['fontStyle', 'italic', 'normal'],
    ['fontKerning', false, true],
    ['anchorX', 12, 0],
    ['anchorY', 18, 0],
  ] as const)(
    'clearing %s restores its default immediately and remains reversible',
    async (key, value, fallback) => {
      await world.reset(api, [textNode({ [key]: value })]);
      await update({ [key]: undefined });
      expect(api.getNodeById('text')).not.toHaveProperty(key);
      expect(entity().read(Text)[key]).toBe(fallback);
      await world.history(api, 'undo');
      expect(entity().read(Text)[key]).toBe(value);
      await world.history(api, 'redo');
      expect(entity().read(Text)[key]).toBe(fallback);
    },
  );

  it.each(['center', 'right', 'left'] as const)(
    'keeps the text box fixed when changing alignment to %s',
    async (textAlign) => {
      await world.reset(api, [
        textNode({ textAlign: 'end', textBaseline: 'alphabetic' }),
      ]);
      const bounds = () =>
        Text.getGeometryBounds(
          entity().read(Text),
          entity().read(ComputedTextMetrics),
        );
      const original = bounds();
      await update({ textAlign, textBaseline: 'middle' });
      expect(bounds().minX).toBeCloseTo(original.minX, 3);
      expect(bounds().minY).toBeCloseTo(original.minY, 3);
      expect(entity().read(Text).anchorX).toBeCloseTo(
        (api.getNodeById('text') as TextSerializedNode).anchorX,
        3,
      );
      await world.history(api, 'undo');
      expect(bounds().minX).toBeCloseTo(original.minX, 3);
      await world.history(api, 'redo');
      expect(bounds().minY).toBeCloseTo(original.minY, 3);
    },
  );

  it('updates path layout and restores ordinary text after clearing the path', async () => {
    await update({
      path: 'M0 0L600 0',
      side: 'right',
      startOffset: 20,
      pathOffset: 10,
    });
    const glyphs = entity().read(ComputedTextMetrics).pathGlyphs;
    expect(glyphs.length).toBeGreaterThan(0);
    expect(entity().read(Text)).toMatchObject({
      side: 'right',
      startOffset: 20,
      pathOffset: 10,
    });
    await update({
      path: undefined,
      side: undefined,
      startOffset: undefined,
      pathOffset: undefined,
    });
    expect(entity().read(Text)).toMatchObject({
      path: '',
      side: 'left',
      startOffset: 0,
      pathOffset: 0,
    });
    expect(entity().read(ComputedTextMetrics).pathGlyphs ?? []).toHaveLength(0);
    await world.history(api, 'undo');
    expect(entity().read(ComputedTextMetrics).pathGlyphs).toEqual(glyphs);
  });

  it('uses snapshot anchors when replacing a document with a different alignment', async () => {
    await world.reset(api, [
      textNode({ textAlign: 'right', textBaseline: 'middle' }),
    ]);
    expect(entity().read(Text)).toMatchObject({
      anchorX: 0,
      anchorY: 0,
      textAlign: 'right',
      textBaseline: 'middle',
    });
    expect((api.getNodeById('text') as TextSerializedNode).anchorX ?? 0).toBe(
      0,
    );
  });
});

describe('icon child synchronization', () => {
  const children = () =>
    entity('icon').has(Parent) ? entity('icon').read(Parent).children : [];
  const visible = () =>
    children().filter((child) => child.read(Visibility).value !== 'hidden');
  const snapshot = () =>
    visible().map((child) => ({
      path: child.has(Path) ? child.read(Path).d : null,
      ellipse: child.has(Ellipse)
        ? [
            child.read(Ellipse).cx,
            child.read(Ellipse).cy,
            child.read(Ellipse).rx,
            child.read(Ellipse).ry,
          ]
        : null,
      line: child.has(Line)
        ? [
            child.read(Line).x1,
            child.read(Line).y1,
            child.read(Line).x2,
            child.read(Line).y2,
          ]
        : null,
      fills: child.has(FillLayers)
        ? structuredClone(child.read(FillLayers).layers)
        : [],
      strokes: child.has(StrokeLayers)
        ? structuredClone(child.read(StrokeLayers).layers)
        : [],
      width: child.read(Stroke).width,
      placeholder: child.has(IconFontEllipseStrokeRasterPlaceholder),
    }));
  beforeEach(async () => {
    await world.reset(api, [iconNode()]);
  });

  it.each(['circle', 'line', 'path'] as const)(
    'resizes %s geometry in place, with stable undo/redo',
    async (name) => {
      await world.reset(api, [iconNode({ iconFontName: name })]);
      const original = snapshot();
      await update({ width: 80, height: 60 }, 'icon');
      const changed = snapshot();
      expect(changed).not.toEqual(original);
      expect(entity('icon').read(IconFont)).toMatchObject({
        layoutWidth: 80,
        layoutHeight: 60,
      });
      await world.history(api, 'undo');
      expect(snapshot()).toEqual(original);
      await world.history(api, 'redo');
      expect(snapshot()).toEqual(changed);
    },
  );

  it.each(['line', 'path', 'pair', 'missing'] as const)(
    'switches to %s and matches freshly loaded geometry and paint',
    async (name) => {
      await update({ iconFontName: name }, 'icon');
      const changed = snapshot();
      await world.history(api, 'undo');
      expect(visible()).toHaveLength(1);
      expect(visible()[0].has(Ellipse)).toBe(true);
      await world.history(api, 'redo');
      expect(snapshot()).toEqual(changed);
      await world.reset(api, []);
      await world.reset(api, [iconNode({ iconFontName: name })]);
      expect(snapshot()).toEqual(changed);
    },
  );

  it('hides surplus children and restores them on undo without adding document nodes', async () => {
    await world.reset(api, [iconNode({ iconFontName: 'pair' })]);
    const original = snapshot();
    await update({ iconFontName: 'circle' }, 'icon');
    expect(children()).toHaveLength(2);
    expect(visible()).toHaveLength(1);
    await world.history(api, 'undo');
    expect(snapshot()).toEqual(original);
    expect(api.getNodes()).toHaveLength(1);
  });

  it('recovers an unresolved icon when a valid name is assigned', async () => {
    await world.reset(api, []);
    await world.reset(api, [iconNode({ iconFontName: 'missing' })]);
    expect(visible()).toHaveLength(0);
    await update({ iconFontName: 'circle' }, 'icon');
    expect(visible()).toHaveLength(1);
    expect(visible()[0].has(Ellipse)).toBe(true);
    const recovered = snapshot();
    await world.reset(api, []);
    await world.reset(api, [iconNode()]);
    expect(snapshot()).toEqual(recovered);
  });

  it('removes old child stroke layers when stroke becomes none', async () => {
    expect(visible()[0].has(StrokeLayers)).toBe(true);
    await update({ strokes: [{ type: 'solid', value: 'none' }] }, 'icon');
    expect(visible()[0].has(StrokeLayers)).toBe(false);
    await world.history(api, 'undo');
    expect(visible()[0].has(StrokeLayers)).toBe(true);
  });

  it('recolors child strokes without adding root paint and restores authored color on undo', async () => {
    const original = snapshot();
    await update(
      { strokes: [{ type: 'solid', value: 'blue' }], strokeWidth: 5 },
      'icon',
    );
    expect(visible()[0].read(StrokeLayers).layers).toEqual([
      { type: 'solid', value: 'blue' },
    ]);
    expect(visible()[0].read(Stroke).width).toBe(5);
    expect(entity('icon').has(Stroke)).toBe(false);
    await world.history(api, 'undo');
    expect(snapshot()).toEqual(original);
  });

  it('adds and removes the ellipse raster placeholder when only filter changes', async () => {
    expect(visible()[0].has(IconFontEllipseStrokeRasterPlaceholder)).toBe(
      false,
    );
    await update({ filter: 'blur(4px)' }, 'icon');
    expect(visible()[0].has(IconFontEllipseStrokeRasterPlaceholder)).toBe(true);
    const blurred = snapshot();
    await world.history(api, 'undo');
    expect(visible()[0].has(IconFontEllipseStrokeRasterPlaceholder)).toBe(
      false,
    );
    await world.history(api, 'redo');
    expect(snapshot()).toEqual(blurred);
    await update({ filter: '' }, 'icon');
    expect(visible()[0].has(IconFontEllipseStrokeRasterPlaceholder)).toBe(
      false,
    );
    expect(visible()[0].has(FillLayers)).toBe(false);
  });
});

describe('effect synchronization', () => {
  beforeEach(async () => {
    await world.reset(api, [textNode()]);
  });

  it('updates all decoration fields and restores them through undo/redo', async () => {
    await update({
      decorationLine: 'underline',
      decorationStyle: 'wavy',
      decorationColor: 'red',
      decorationThickness: 3,
    });
    expect(entity().read(TextDecoration)).toMatchObject({
      line: 'underline',
      style: 'wavy',
      color: 'red',
      thickness: 3,
    });
    await world.history(api, 'undo');
    expect(entity().has(TextDecoration)).toBe(false);
    await world.history(api, 'redo');
    expect(entity().read(TextDecoration).style).toBe('wavy');
    await update({ decorationLine: 'none' });
    expect(entity().read(TextDecoration).line).toBe('none');
  });

  it.each(['drop', 'inner'] as const)(
    'retains other %s shadow fields across a partial update and undo',
    async (kind) => {
      const component = kind === 'drop' ? DropShadow : InnerShadow;
      await world.reset(api, [
        textNode({
          [`${kind}ShadowColor`]: 'red',
          [`${kind}ShadowBlurRadius`]: 4,
          [`${kind}ShadowOffsetX`]: 3,
          [`${kind}ShadowOffsetY`]: 5,
        }),
      ]);
      await update({ [`${kind}ShadowOffsetX`]: -7 });
      expect(entity().read(component)).toMatchObject({
        color: 'red',
        blurRadius: 4,
        offsetX: -7,
        offsetY: 5,
      });
      await world.history(api, 'undo');
      expect(entity().read(component).offsetX).toBe(3);
      await world.history(api, 'redo');
      expect(entity().read(component).offsetX).toBe(-7);
    },
  );

  it('switches blend mode back to normal and restores the component on undo', async () => {
    await update({ blendMode: 'multiply' });
    expect(entity().read(NodeLayerBlendMode).mode).toBe('multiply');
    await update({ blendMode: 'normal' });
    expect(entity().has(NodeLayerBlendMode)).toBe(false);
    await world.history(api, 'undo');
    expect(entity().read(NodeLayerBlendMode).mode).toBe('multiply');
    await world.history(api, 'redo');
    expect(entity().has(NodeLayerBlendMode)).toBe(false);
  });

  it('clears a filter immediately and restores it on undo', async () => {
    await world.reset(api, [textNode({ filter: 'blur(2px)' })]);
    await update({ filter: undefined });
    expect(entity().has(Filter)).toBe(false);
    await world.history(api, 'undo');
    expect(entity().read(Filter).value).toBe('blur(2px)');
    await world.history(api, 'redo');
    expect(entity().has(Filter)).toBe(false);
  });
});
