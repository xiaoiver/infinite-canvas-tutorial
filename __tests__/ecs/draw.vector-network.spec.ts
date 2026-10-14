import {
  Canvas,
  Cursor,
  GlobalTransform,
  Pen,
  VectorNetwork,
  type API,
  type VectorNetworkSerializedNode,
} from '../../packages/ecs/src';
import { createSelectionWorld } from '../helpers/ecs-selection';

let world: Awaited<ReturnType<typeof createSelectionWorld>>;
let api: API;
let other: API;
const seed = (
  patch: Partial<VectorNetworkSerializedNode> = {},
): VectorNetworkSerializedNode => ({
  id: 'existing',
  type: 'vector-network',
  version: 1,
  zIndex: 1,
  x: 30,
  y: 40,
  width: 120,
  height: 60,
  vertices: [
    { x: 0, y: 0 },
    { x: 60, y: 0 },
    { x: 120, y: 60 },
  ],
  segments: [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
  ],
  regions: [],
  fills: [],
  strokes: [{ type: 'solid', value: 'blue' }],
  strokeWidth: 3,
  ...patch,
});
const nodes = (canvas = api) =>
  canvas
    .getNodes()
    .filter(
      (node) => node.type === 'vector-network',
    ) as VectorNetworkSerializedNode[];
const preview = (canvas = api) =>
  canvas
    .getSvgLayer()
    ?.querySelector<SVGSVGElement>('[data-vector-network-pen-preview]');
const geometry = (node = nodes()[0]) => {
  const {
    x,
    y,
    width,
    height,
    rotation,
    scaleX,
    scaleY,
    vertices,
    segments,
    regions,
    fills,
    strokes,
    strokeWidth,
  } = node;
  return structuredClone({
    x,
    y,
    width,
    height,
    rotation,
    scaleX,
    scaleY,
    vertices,
    segments,
    regions,
    fills,
    strokes,
    strokeWidth,
  });
};
function point(
  node: VectorNetworkSerializedNode,
  x: number,
  y: number,
  canvas = api,
) {
  const m = canvas.getEntity(node).read(GlobalTransform).matrix;
  return canvas.canvas2Viewport({
    x: m.m00 * x + m.m10 * y + m.m20,
    y: m.m01 * x + m.m11 * y + m.m21,
  });
}
const anchors = (node = nodes()[0]) =>
  node.vertices.map((v) => point(node, v.x, v.y));
const close = (
  actual: { x: number; y: number },
  expected: { x: number; y: number },
) => {
  expect(actual.x).toBeCloseTo(expected.x, 3);
  expect(actual.y).toBeCloseTo(expected.y, 3);
};
const click = (x: number, y: number, canvas = api) => world.click(canvas, x, y);
async function drag(
  x: number,
  y: number,
  dx: number,
  dy: number,
  release = true,
) {
  await world.pointer(api, 'pointerdown', x, y);
  await world.pointer(api, 'pointermove', x + dx, y + dy);
  if (release) await world.pointer(api, 'pointerup', x + dx, y + dy);
}
async function pen(canvas = api) {
  await world.edit(
    canvas,
    (editor) => editor.setAppState({ penbarSelected: Pen.VECTOR_NETWORK }),
    'NEVER',
  );
  await world.frames();
}
async function prepare(node = seed()) {
  await world.reset(api, [node]);
  await world.edit(
    api,
    (editor) => editor.selectNodes([editor.getNodeById(node.id)]),
    'NEVER',
  );
  await pen();
  api.clearHistory();
}

beforeAll(async () => {
  world = await createSelectionWorld(2);
  [api, other] = world.apis;
  for (const canvas of world.apis) {
    const layer = world.window.document.createElement('div');
    world.window.document.body.append(layer);
    await world.edit(
      canvas,
      () => {
        canvas.getCanvas().write(Canvas).svgLayer = layer;
      },
      'NEVER',
    );
  }
});
beforeEach(async () => {
  for (const canvas of world.apis) {
    await world.pointer(canvas, 'pointercancel', 190, 190);
    await world.edit(
      canvas,
      (editor) => {
        editor.setAppState({
          penbarSelected: Pen.SELECT,
          snapToPixelGridEnabled: false,
          snapToObjectsEnabled: false,
        });
        editor.gotoLandmark({ x: 0, y: 0, zoom: 1 }, { duration: 0 });
      },
      'NEVER',
    );
    await world.reset(canvas, []);
    await world.frames();
    canvas.clearHistory();
  }
  await pen();
});
afterEach(() => world.assertNoErrors());
afterAll(async () => {
  await world?.dispose();
});

it('keeps the first anchor transient and commits one reversible step per edge', async () => {
  await click(30, 40);
  expect(nodes()).toEqual([]);
  expect(api.isUndoStackEmpty()).toBe(true);
  await click(130, 40);
  const first = geometry();
  expect(nodes()).toHaveLength(1);
  close(anchors()[0], { x: 30, y: 40 });
  close(anchors()[1], { x: 130, y: 40 });
  expect(nodes()[0].segments).toEqual([{ start: 0, end: 1 }]);
  expect(api.getAppState().layersSelected).toEqual([nodes()[0].id]);
  expect(api.getEntity(nodes()[0]).read(VectorNetwork).vertices).toEqual(
    nodes()[0].vertices,
  );
  await click(130, 140);
  const second = geometry();
  await world.key(api, 'Enter');
  expect(api.getAppState().penbarSelected).toBe(Pen.SELECT);
  expect(preview()).toBeNull();
  await world.history(api, 'undo');
  expect(geometry()).toEqual(first);
  await world.history(api, 'undo');
  expect(nodes()).toEqual([]);
  expect(api.isUndoStackEmpty()).toBe(true);
  await world.history(api, 'redo');
  await world.history(api, 'redo');
  expect(geometry()).toEqual(second);
  expect(nodes(other)).toEqual([]);
  expect(other.isUndoStackEmpty()).toBe(true);
});

it('uses the same cubic controls for the live preview and committed geometry', async () => {
  await drag(30, 90, 20, -20);
  await drag(130, 90, 20, -20, false);
  const curve = preview()!.querySelector('[data-pen-part="curve"]')!;
  const coordinates = curve
    .getAttribute('d')!
    .match(/-?\d+(?:\.\d+)?/g)!
    .map(Number);
  expect(coordinates).toHaveLength(8);
  [30, 90, 50, 70, 110, 110, 130, 90].forEach((value, i) =>
    expect(coordinates[i]).toBeCloseTo(value, 3),
  );
  expect(
    preview()!
      .querySelector('[data-pen-part="handles"]')!
      .getAttribute('stroke-dasharray'),
  ).toBe('4 3');
  expect(nodes()).toEqual([]);
  await world.pointer(api, 'pointerup', 150, 70);
  expect(nodes()[0].segments[0]).toMatchObject({ start: 0, end: 1 });
  close(nodes()[0].segments[0].tangentStart!, { x: 20, y: -20 });
  close(nodes()[0].segments[0].tangentEnd!, { x: -20, y: 20 });
  expect(
    nodes()[0].vertices.every((v) => v.handleMirroring === 'ANGLE_AND_LENGTH'),
  ).toBe(true);
  await click(170, 140);
  expect(nodes()[0].segments[1]).toMatchObject({ start: 1, end: 2 });
  close(nodes()[0].segments[1].tangentStart!, { x: 20, y: -20 });
  expect(nodes()[0].segments[1].tangentEnd).toBeUndefined();
});

it.each(['click', 'drag'] as const)(
  'closes at the pressed first anchor with %s and restores the face through history',
  async (mode) => {
    await drag(30, 90, 0, -20);
    await click(130, 30);
    await click(130, 150);
    const before = geometry();
    if (mode === 'drag') await drag(32, 91, -20, 0);
    else await click(32, 91);
    const node = nodes()[0];
    expect(node.vertices).toHaveLength(3);
    expect(node.segments).toHaveLength(3);
    expect(node.segments[2]).toMatchObject({ start: 2, end: 0 });
    // Drag uses the snapped anchor, so its vector includes the press offset.
    close(
      node.segments[2].tangentEnd!,
      mode === 'drag' ? { x: 18, y: -1 } : { x: 0, y: 20 },
    );
    expect(node.regions).toHaveLength(1);
    expect(api.getAppState().penbarSelected).toBe(Pen.SELECT);
    const after = geometry();
    await world.history(api, 'undo');
    expect(geometry()).toEqual(before);
    await world.history(api, 'redo');
    expect(geometry()).toEqual(after);
  },
);

it('finishes at the active anchor without a zero-length edge or extra history', async () => {
  await click(30, 40);
  await click(130, 40);
  const before = geometry();
  await click(131, 41);
  expect(geometry()).toEqual(before);
  expect(api.getAppState().penbarSelected).toBe(Pen.SELECT);
  await world.history(api, 'undo');
  expect(nodes()).toEqual([]);
  expect(api.isUndoStackEmpty()).toBe(true);
});

it.each(['pointercancel', 'Escape', 'Enter', 'tool', 'leave'] as const)(
  'drops an unfinished gesture on %s and ignores the trailing release',
  async (reason) => {
    await click(30, 40);
    await drag(130, 40, 10, 10, false);
    if (reason === 'tool')
      await world.edit(
        api,
        (editor) => editor.setAppState({ penbarSelected: Pen.HAND }),
        'NEVER',
      );
    else if (reason === 'leave')
      await world.pointer(api, 'pointerleave', 210, 40);
    else if (reason === 'pointercancel')
      await world.pointer(api, reason, 140, 50);
    else await world.key(api, reason);
    await world.pointer(api, 'pointerup', 140, 50);
    expect(nodes()).toEqual([]);
    expect(api.isUndoStackEmpty()).toBe(true);
    if (reason === 'Escape' || reason === 'Enter' || reason === 'tool')
      expect(preview()).toBeNull();
  },
);

it.each([0.5, 2])(
  'snaps in viewport pixels, independent of camera zoom %s',
  async (zoom) => {
    await world.edit(
      api,
      (editor) => editor.gotoLandmark({ zoom }, { duration: 0 }),
      'NEVER',
    );
    await world.frames();
    await click(30, 30);
    await click(140, 30);
    await click(140, 150);
    await world.pointer(api, 'pointermove', 41, 30);
    expect(api.getCanvas().read(Cursor).value).toBe('crosshair');
    await world.pointer(api, 'pointermove', 39, 30);
    expect(api.getCanvas().read(Cursor).value).toBe('pointer');
    await click(39, 30);
    expect(nodes()[0].vertices).toHaveLength(3);
    expect(nodes()[0].segments[2]).toEqual({ start: 2, end: 0 });
  },
);

it('ignores secondary-button presses and sub-threshold drags', async () => {
  await world.click(api, 30, 40, { button: 2 });
  expect(nodes()).toEqual([]);
  expect(preview()).toBeNull();
  await drag(30, 40, 3, 0);
  await click(130, 40);
  close(anchors()[0], { x: 30, y: 40 });
  expect(nodes()[0].segments[0]).toEqual({ start: 0, end: 1 });
});

it('reuses the preview DOM until the pointer or camera actually changes', async () => {
  await click(30, 40);
  await world.pointer(api, 'pointermove', 130, 90);
  const svg = preview()!;
  const curve = svg.querySelector('[data-pen-part="curve"]');
  await world.frames(4);
  expect(svg.querySelector('[data-pen-part="curve"]')).toBe(curve);
  await world.edit(
    api,
    (editor) => editor.gotoLandmark({ zoom: 2 }, { duration: 0 }),
    'NEVER',
  );
  await world.frames();
  expect(svg.querySelector('[data-pen-part="curve"]')).not.toBe(curve);
  await world.pointer(api, 'pointerleave', 210, 90);
  expect(svg.style.display).toBe('none');
  await world.pointer(api, 'pointermove', 120, 90);
  expect(svg.style.display).toBe('');
});

it.each([false, true])(
  'resumes a curve and preserves existing world anchors (transformed=%s)',
  async (transformed) => {
    await prepare(
      seed(
        transformed
          ? { x: 140, y: 50, rotation: 0.3, scaleX: -0.75, scaleY: 0.8 }
          : {},
      ),
    );
    const before = geometry();
    const fixed = anchors();
    const from = fixed[2];
    const target = { x: from.x - 20, y: from.y + 50 };
    await drag(from.x, from.y, -5, 15);
    expect(geometry()).toEqual(before);
    expect(api.isUndoStackEmpty()).toBe(true);
    await drag(target.x, target.y, -5, 10, false);
    const values = preview()!
      .querySelector('[data-pen-part="curve"]')!
      .getAttribute('d')!
      .match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!
      .map(Number);
    await world.pointer(api, 'pointerup', target.x - 5, target.y + 10);
    const node = nodes()[0];
    expect(nodes()).toHaveLength(1);
    expect(node.vertices).toHaveLength(4);
    anchors()
      .slice(0, 3)
      .forEach((p, i) => close(p, fixed[i]));
    close(anchors()[3], target);
    expect(node.segments.slice(0, 2)).toEqual(before.segments);
    expect(node.strokes).toEqual(before.strokes);
    const s = node.segments[2],
      a = node.vertices[s.start],
      b = node.vertices[s.end];
    const controls = [
      point(node, a.x, a.y),
      point(node, a.x + s.tangentStart!.x, a.y + s.tangentStart!.y),
      point(node, b.x + s.tangentEnd!.x, b.y + s.tangentEnd!.y),
      point(node, b.x, b.y),
    ];
    controls.forEach((p, i) =>
      close(p, { x: values[i * 2], y: values[i * 2 + 1] }),
    );
    const after = geometry();
    await world.history(api, 'undo');
    expect(geometry()).toEqual(before);
    await world.history(api, 'redo');
    expect(geometry()).toEqual(after);
  },
);

it('branches from a shared vertex without changing existing edges', async () => {
  await prepare();
  const before = geometry(),
    fixed = anchors();
  await click(fixed[1].x, fixed[1].y);
  await click(90, 150);
  expect(nodes()[0].vertices).toHaveLength(4);
  expect(nodes()[0].segments).toEqual([
    ...before.segments,
    { start: 1, end: 3 },
  ]);
  fixed.forEach((p, i) => close(anchors()[i], p));
});

it.each([false, true])(
  'does not duplicate an existing edge (reverse=%s)',
  async (reverse) => {
    await prepare();
    const before = geometry(),
      fixed = anchors();
    await click(fixed[reverse ? 1 : 0].x, fixed[reverse ? 1 : 0].y);
    await click(fixed[reverse ? 0 : 1].x, fixed[reverse ? 0 : 1].y);
    expect(geometry()).toEqual(before);
    expect(api.isUndoStackEmpty()).toBe(true);
    expect(api.getAppState().penbarSelected).toBe(Pen.SELECT);
  },
);

it.each([
  'geometry',
  'version',
  'lock',
  'hide',
  'delete',
  'selection',
  'undo',
] as const)(
  'abandons stale continuation after %s without overwriting the changed network',
  async (reason) => {
    await click(30, 40);
    await click(130, 40);
    await click(130, 140);
    const id = nodes()[0].id;
    await drag(60, 170, 10, 0, false);
    if (reason === 'undo') await world.history(api, 'undo');
    else
      await world.edit(
        api,
        (editor) => {
          const node = editor.getNodeById(id) as VectorNetworkSerializedNode;
          if (reason === 'delete') editor.deleteNodesById([node.id]);
          else if (reason === 'selection') editor.selectNodes([]);
          else
            editor.updateNode(
              node,
              reason === 'geometry'
                ? {
                    vertices: node.vertices.map((v, i) =>
                      i === 1 ? { ...v, y: v.y + 10 } : v,
                    ),
                  }
                : reason === 'version'
                ? { name: 'remote change' }
                : reason === 'lock'
                ? { locked: true }
                : { visibility: 'hidden' },
            );
        },
        'NEVER',
      );
    await world.frames();
    const changed = structuredClone(api.getNodeById(id));
    await world.pointer(api, 'pointerup', 70, 170);
    expect(api.getNodeById(id)).toEqual(changed);
    expect(preview()).toBeNull();
  },
);

it('keeps simultaneous canvas sessions and their history independent', async () => {
  await pen(other);
  await click(30, 40);
  await click(60, 70, other);
  expect(preview()).toBeTruthy();
  expect(preview(other)).toBeTruthy();
  await click(130, 40);
  expect(nodes(other)).toEqual([]);
  await click(160, 70, other);
  expect(nodes()).toHaveLength(1);
  expect(nodes(other)).toHaveLength(1);
  const unchanged = geometry(nodes(other)[0]);
  await world.edit(
    api,
    (editor) => editor.setAppState({ penbarSelected: Pen.SELECT }),
    'NEVER',
  );
  expect(preview()).toBeNull();
  expect(preview(other)).toBeTruthy();
  await world.history(api, 'undo');
  expect(nodes()).toEqual([]);
  expect(geometry(nodes(other)[0])).toEqual(unchanged);
  expect(other.getHistoryState().canUndo).toBe(true);
});

it('splits an edge crossing into a junction and continues from the clicked endpoint', async () => {
  await click(30, 30);
  await click(150, 150);
  await click(30, 150);
  const before = geometry();
  await click(150, 30);
  const crossed = geometry();
  expect(nodes()[0].vertices).toHaveLength(5);
  close(anchors()[4], { x: 90, y: 90 });
  expect(
    nodes()[0].segments.filter((s) => s.start === 4 || s.end === 4),
  ).toHaveLength(4);
  expect(nodes()[0].regions).toHaveLength(1);
  await click(180, 30);
  expect(nodes()[0].segments.some((s) => s.start === 3 && s.end === 5)).toBe(
    true,
  );
  await world.history(api, 'undo');
  expect(geometry()).toEqual(crossed);
  await world.history(api, 'undo');
  expect(geometry()).toEqual(before);
  await world.history(api, 'redo');
  expect(geometry()).toEqual(crossed);
});

it('allows a distinct curved edge back to the first anchor to form a two-vertex face', async () => {
  await click(40, 100);
  await click(140, 100);
  await drag(40, 100, 0, -40);
  expect(nodes()[0].vertices).toHaveLength(2);
  expect(nodes()[0].segments).toHaveLength(2);
  expect(nodes()[0].regions).toHaveLength(1);
  expect(nodes()[0].regions![0].loops[0]).toHaveLength(2);
});

it('preserves the original paints and region when adding an internal branch and reconnecting to vertex zero', async () => {
  await prepare(
    seed({
      vertices: [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
        { x: 120, y: 120 },
        { x: 0, y: 120 },
      ],
      segments: [
        { start: 0, end: 1 },
        { start: 1, end: 2 },
        { start: 2, end: 3 },
        { start: 3, end: 0 },
      ],
      regions: [{ fillRule: 'evenodd', loops: [[0, 1, 2, 3]] }],
      fills: [{ type: 'solid', value: 'red' }],
    }),
  );
  const before = geometry();
  const fixed = anchors();
  await click(fixed[1].x, fixed[1].y);
  await click(90, 100);
  await drag(fixed[0].x, fixed[0].y, -10, -10);
  expect(nodes()[0].vertices).toHaveLength(5);
  expect(nodes()[0].segments).toHaveLength(6);
  expect(nodes()[0].segments.slice(0, 4)).toEqual(before.segments);
  expect(nodes()[0].regions).toEqual(before.regions);
  expect(nodes()[0].fills).toEqual(before.fills);
  expect(nodes()[0].strokes).toEqual(before.strokes);
  expect(nodes()[0].segments[5].end).toBe(0);
});

it.each(['locked', 'hidden', 'singular', 'away'] as const)(
  'starts a separate network when the selected network is %s',
  async (reason) => {
    await prepare(
      seed(
        reason === 'locked'
          ? { locked: true }
          : reason === 'hidden'
          ? { visibility: 'hidden' }
          : reason === 'singular'
          ? { scaleX: 0 }
          : {},
      ),
    );
    const before = geometry();
    await click(30, 150);
    expect(api.getAppState().layersSelected).toEqual([]);
    await click(150, 150);
    expect(nodes()).toHaveLength(2);
    expect(geometry(nodes().find((node) => node.id === 'existing')!)).toEqual(
      before,
    );
    const added = nodes().find((node) => node.id !== 'existing')!;
    expect(added.zIndex).toBe(2);
    expect(added.segments).toEqual([{ start: 0, end: 1 }]);
  },
);

it('finishes a resumed edge if its parent becomes noninvertible', async () => {
  await world.reset(api, [
    { id: 'parent', type: 'g', zIndex: 0, x: 0, y: 0, width: 0, height: 0 },
    seed({ parentId: 'parent' }),
  ]);
  await world.edit(
    api,
    (editor) => editor.selectNodes([editor.getNodeById('existing')]),
    'NEVER',
  );
  await pen();
  const before = geometry();
  const from = anchors()[2];
  await click(from.x, from.y);
  await world.edit(
    api,
    (editor) => editor.updateNode(editor.getNodeById('parent'), { scaleX: 0 }),
    'NEVER',
  );
  await world.frames();
  await click(170, 170);
  expect(geometry()).toEqual(before);
  expect(api.getAppState().penbarSelected).toBe(Pen.SELECT);
  expect(api.isUndoStackEmpty()).toBe(true);
});

it('ignores a cancelled press and release delivered in a single frame', async () => {
  world.dispatch(api, 'pointerdown', 30, 40);
  world.dispatch(api, 'pointercancel', 30, 40);
  world.dispatch(api, 'pointerup', 30, 40);
  await world.frames();
  await click(130, 40);
  expect(nodes()).toEqual([]);
  expect(api.isUndoStackEmpty()).toBe(true);
});

it('can draw without an optional SVG preview layer', async () => {
  const layer = api.getSvgLayer();
  try {
    await world.edit(
      api,
      () => {
        api.getCanvas().write(Canvas).svgLayer = undefined;
      },
      'NEVER',
    );
    await click(30, 40);
    await click(130, 40);
    expect(nodes()).toHaveLength(1);
    expect(nodes()[0].segments).toEqual([{ start: 0, end: 1 }]);
  } finally {
    await world.edit(
      api,
      () => {
        api.getCanvas().write(Canvas).svgLayer = layer;
      },
      'NEVER',
    );
  }
});

// Destruction is last because the shared World intentionally keeps its canvases
// alive between cases, just like select.interaction.spec.ts.
it('removes a destroyed canvas preview and listeners while another canvas keeps drawing', async () => {
  await pen(other);
  await click(30, 40);
  await click(60, 70, other);
  const layer = other.getSvgLayer();
  const element = other.getCanvasElement();
  expect(preview(other)).toBeTruthy();
  await world.edit(api, () => other.destroy(), 'NEVER');
  await world.frames();
  expect(layer.querySelector('[data-vector-network-pen-preview]')).toBeNull();
  for (const type of ['pointermove', 'pointerup', 'pointercancel']) {
    element.dispatchEvent(
      new world.window.MouseEvent(type, {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    );
  }
  world.assertNoErrors();
  await click(130, 40);
  expect(nodes()).toHaveLength(1);
  expect(preview()).toBeTruthy();
});
