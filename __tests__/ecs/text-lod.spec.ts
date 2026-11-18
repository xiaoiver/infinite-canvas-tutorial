import {
  Mat3,
  Text,
  ComputedTextMetrics,
  ComputedLOD,
  Canvas,
  Culled,
  Editable,
  GlobalTransform,
} from '../../packages/ecs/src';
import {
  chooseTextLOD,
  projectedFontHeight,
  textProxyLines,
} from '../../packages/ecs/src/utils/text-lod';
import { createDocumentWorld } from '../helpers/ecs-document';

const projection = new Mat3(2 / 200, 0, 0, 0, -2 / 100, 0, -1, 1, 1);
const projected = (world = Mat3.IDENTITY) =>
  projectedFontHeight(12, world, projection, 200, 100);
it('projects rotation, nested/nonuniform scale, reflection and CSS dimensions', () => {
  expect(projected()).toBeCloseTo(12);
  expect(projected(new Mat3(2, 0, 0, 0, 0.25, 0, 0, 0, 1))).toBeCloseTo(3);
  expect(projected(new Mat3(0, 2, 0, -0.25, 0, 0, 0, 0, 1))).toBeCloseTo(3);
  expect(projected(new Mat3(-1, 0, 0, 0, -1, 0, 1e6, -1e6, 1))).toBeCloseTo(12);
  // DPR never enters semantic projection. Doubling physical framebuffer has no input here.
  expect(
    projectedFontHeight(12, Mat3.IDENTITY, projection, 200, 100),
  ).toBeCloseTo(12);
});
it.each([0, NaN, Infinity, -1])(
  'falls back for invalid font/viewport/transform %s',
  (bad) => {
    expect(
      chooseTextLOD(
        projectedFontHeight(bad, Mat3.IDENTITY, projection, 200, 100),
        'text-proxy',
      ),
    ).toBe('full');
    expect(
      chooseTextLOD(
        projectedFontHeight(12, Mat3.IDENTITY, projection, bad, 100),
        'text-proxy',
      ),
    ).toBe('full');
    expect(
      chooseTextLOD(
        projected(new Mat3(1, 0, 0, 0, bad, 0, 0, 0, 1)),
        'text-proxy',
      ),
    ).toBe('full');
  },
);
it('uses strict 6 / 8 thresholds and forced-full hysteresis', () => {
  expect([5.9, 6, 7, 8, 8.1].map((h) => chooseTextLOD(h, 'full'))).toEqual([
    'text-proxy',
    'full',
    'full',
    'full',
    'full',
  ]);
  expect(
    [5.9, 6, 7, 8, 8.1].map((h) => chooseTextLOD(h, 'text-proxy')),
  ).toEqual(['text-proxy', 'text-proxy', 'text-proxy', 'text-proxy', 'full']);
  expect(chooseTextLOD(2, 'text-proxy', true)).toBe('full');
  expect(
    chooseTextLOD(
      projected(new Mat3(1, 0, 0.1, 0, 1, 0, 0, 0, 1)),
      'text-proxy',
    ),
  ).toBe('full');
});
it('keeps per-line widths, alignment and empty line spacing', () => {
  const lines = textProxyLines(
    { textAlign: 'center' } as Text,
    {
      width: 60,
      lineHeight: 20,
      lineMetrics: [{ width: 60 }, { width: 0 }, { width: 20 }],
      lines: ['long', '', 'a'],
      fontMetrics: { fontSize: 12, fontBoundingBoxAscent: 10 },
    } as ComputedTextMetrics,
  );
  expect(lines.map((l) => [l.x, l.width])).toEqual([
    [0, 60],
    [20, 20],
  ]);
  expect(lines[1].y - lines[0].y).toBe(40);
});

let world: Awaited<ReturnType<typeof createDocumentWorld>>;
beforeAll(async () => {
  world = await createDocumentWorld(2);
});
afterAll(async () => {
  await world?.dispose();
});
const level = (index = 0) => {
  const e = world.apis[index].getEntity(world.apis[index].getNodeById('text'));
  return e.has(ComputedLOD) ? e.read(ComputedLOD).level : 'full';
};
// node-canvas omits browser fontBoundingBox metrics. Supply measured em metrics explicitly.
async function browserMetrics(api: (typeof world.apis)[0]) {
  await world.edit(
    api,
    (editor) => {
      const e = editor.getEntity(editor.getNodeById('text'));
      const m = e.read(ComputedTextMetrics).fontMetrics;
      e.write(ComputedTextMetrics).fontMetrics = {
        ...m,
        fontBoundingBoxAscent: m.emHeightAscent,
        fontBoundingBoxDescent: m.emHeightDescent,
      };
    },
    'NEVER',
  );
}
const seed = {
  id: 'text',
  type: 'text',
  x: 20,
  y: 20,
  width: 90,
  height: 20,
  zIndex: 0,
  content: 'ordinary text',
  fontSize: 12,
  fills: [{ type: 'solid', value: '#123456' }],
} as any;
it('updates on camera, interaction, visibility, content and runtime switch without document mutation', async () => {
  const api = world.apis[0];
  await world.reset(api, [seed]);
  await browserMetrics(api);
  const original = JSON.stringify(api.getNodes());
  api.setTextLODEnabled(true);
  await world.edit(api, (editor) => editor.setAppState({ cameraZoom: 0.3 }));
  await world.frame();
  expect(level()).toBe('text-proxy');
  expect(JSON.stringify(api.getNodes())).toBe(original);
  await world.edit(api, (editor) =>
    editor.selectNodes([editor.getNodeById('text')]),
  );
  expect(level()).toBe('full');
  await world.edit(api, (editor) => {
    editor.selectNodes([]);
    editor.highlightNodes([editor.getNodeById('text')]);
  });
  expect(level()).toBe('full');
  await world.edit(api, (editor) => editor.highlightNodes([]));
  expect(level()).toBe('text-proxy');
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('text'), { isEditing: true }),
  );
  expect(level()).toBe('full');
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('text'), {
      isEditing: false,
      visibility: 'hidden',
    }),
  );
  expect(level()).toBe('full');
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('text'), { visibility: 'visible' }),
  );
  expect(level()).toBe('text-proxy');
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('text'), { fontSize: 40 }),
  );
  expect(level()).toBe('full');
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('text'), { fontSize: 12 }),
  );
  await browserMetrics(api);
  expect(level()).toBe('text-proxy');
  api.setTextLODEnabled(false);
  await world.frame();
  await world.frame();
  expect(level()).toBe('full');
});
it('recomputes culling reentry, isolates canvases/DPR, and keeps deletion authoritative', async () => {
  const [a, b] = world.apis;
  for (const api of [a, b]) {
    await world.reset(api, [seed]);
    await browserMetrics(api);
  }
  a.setTextLODEnabled(true);
  for (const api of [a, b])
    await world.edit(api, (editor) => editor.setAppState({ cameraZoom: 0.3 }));
  expect(level()).toBe('text-proxy');
  expect(level(1)).toBe('full');
  await world.edit(a, (e) => {
    e.getCanvas().write(Canvas).devicePixelRatio = 3;
  });
  expect(level()).toBe('text-proxy');
  await world.edit(a, (editor) =>
    editor.updateNode(editor.getNodeById('text'), { x: 10000 }),
  );
  expect(a.getEntity(a.getNodeById('text')).has(Culled)).toBe(true);
  await world.edit(a, (editor) => {
    editor.setAppState({ cameraZoom: 0.8 });
    editor.updateNode(editor.getNodeById('text'), { x: 20 });
  });
  expect(level()).toBe('full');
  await world.edit(
    a,
    (editor) => (editor.getCanvas().write(Canvas).devicePixelRatio = 3),
  );
  expect(level()).toBe('full');
  await world.edit(a, (editor) => {
    editor.setAppState({ cameraZoom: 0.2 });
    editor.deleteNodesById(['text']);
  });
  expect(a.getNodeById('text')).toBeUndefined();
  expect(level(1)).toBe('full');
});
it.each([
  { filter: 'blur(2px)' },
  { content: 'Hello 😀' },
  { content: 'مرحبا' },
  { decorationLine: 'underline', decorationThickness: 1 },
  { fills: [{ type: 'gradient', value: 'linear-gradient(red, blue)' }] },
  { strokes: [{ type: 'solid', value: 'red' }], strokeWidth: 1 },
  { clipMode: 'clip' },
  { blendMode: 'multiply' },
])('safely falls back for unsupported style %j', async (patch) => {
  const api = world.apis[0];
  await world.reset(api, [{ ...seed, ...patch }]);
  await browserMetrics(api);
  api.setTextLODEnabled(true);
  await world.edit(api, (editor) => editor.setAppState({ cameraZoom: 0.2 }));
  await world.frame();
  expect(level()).toBe('full');
});

it('resets hysteresis and camera ownership when text is reparented between canvases', async () => {
  const [a, b] = world.apis;
  await world.reset(a, [seed, { ...seed, id: 'sibling' }]);
  await world.reset(b, [{ ...seed, id: 'existing-child' }]);
  await browserMetrics(a);
  a.setTextLODEnabled(true);
  b.setTextLODEnabled(true);
  await world.edit(a, (e) => e.setAppState({ cameraZoom: 0.3 }));
  await world.edit(b, (e) => e.setAppState({ cameraZoom: 1 }));
  const entity = a.getEntity(a.getNodeById('text'));
  expect(level()).toBe('text-proxy');
  await world.edit(
    a,
    (e) => {
      const commands = e.getCommands();
      commands.entity(a.getCamera()).removeChild(commands.entity(entity));
      commands.entity(b.getCamera()).appendChild(commands.entity(entity));
      commands.execute();
    },
    'NEVER',
  );
  expect(entity.read(ComputedLOD).camera.__id).toBe(b.getCamera().__id);
  expect(entity.read(ComputedLOD).level).toBe('full');
  await world.edit(
    a,
    (e) => {
      const commands = e.getCommands();
      commands.entity(b.getCamera()).removeChild(commands.entity(entity));
      commands.entity(a.getCamera()).appendChild(commands.entity(entity));
      commands.execute();
    },
    'NEVER',
  );
  expect(entity.read(ComputedLOD).camera.__id).toBe(a.getCamera().__id);
  expect(level()).toBe('text-proxy');
});

it('forces selected ancestors full and falls back for clip/effect ancestors', async () => {
  const api = world.apis[0];
  const group = { id: 'group', type: 'g', x: 0, y: 0, zIndex: 0 } as any;
  await world.reset(api, [group, { ...seed, parentId: 'group' }]);
  await browserMetrics(api);
  api.setTextLODEnabled(true);
  await world.edit(api, (e) => e.setAppState({ cameraZoom: 0.2 }));
  expect(level()).toBe('text-proxy');
  await world.edit(api, (e) => e.selectNodes([e.getNodeById('group')]));
  expect(level()).toBe('full');
  await world.edit(api, (e) => e.selectNodes([]));
  expect(level()).toBe('text-proxy');
  await world.edit(api, (e) =>
    e.updateNode(e.getNodeById('group'), { filter: 'blur(2px)' }),
  );
  expect(level()).toBe('full');
  await world.reset(api, [
    { ...group, clipMode: 'clip' },
    { ...seed, parentId: 'group' },
  ]);
  await browserMetrics(api);
  await world.frame();
  expect(level()).toBe('full');
});

it('restores full for anomalous per-line metrics rather than silently dropping the text', async () => {
  const api = world.apis[0];
  await world.reset(api, [seed]);
  await browserMetrics(api);
  api.setTextLODEnabled(true);
  await world.edit(api, (e) => e.setAppState({ cameraZoom: 0.2 }));
  expect(level()).toBe('text-proxy');
  await world.edit(
    api,
    (e) => {
      const entity = e.getEntity(e.getNodeById('text'));
      const lines = entity.read(ComputedTextMetrics).lineMetrics;
      entity.write(ComputedTextMetrics).lineMetrics = lines.map(
        (line) => ({ ...line, width: NaN } as any),
      );
    },
    'NEVER',
  );
  expect(level()).toBe('full');
});
