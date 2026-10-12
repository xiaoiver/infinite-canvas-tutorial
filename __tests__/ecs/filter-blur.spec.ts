import {
  API,
  Commands,
  DefaultPlugins,
  DefaultStateManagement,
  DOMAdapter,
  CheckboardStyle,
  GPUResource,
  ComputedBounds,
  PreStartUp,
  System,
  ThemeMode,
  system,
  type PathSerializedNode,
  type RectSerializedNode,
  type EllipseSerializedNode,
} from '../../packages/ecs/src';
import { FilterPlugin } from '../../packages/plugin-filter/src';
import { createECSInteraction } from '../helpers/ecs-interaction';

let world: ReturnType<typeof createECSInteraction>;
let api: API;
let canvas: HTMLCanvasElement;
beforeAll(async () => {
  world = createECSInteraction();
  class Bootstrap extends System {
    access = this.query((q) => q.usingAll.write);
    initialize() {
      canvas = DOMAdapter.get().createCanvas(180, 160) as HTMLCanvasElement;
      api = new API(new DefaultStateManagement(), new Commands(this));
      api.createCanvas({
        element: canvas,
        width: 180,
        height: 160,
        devicePixelRatio: 1,
      });
      api.createCamera({ zoom: 1, x: 0, y: 0 });
      api.setAppState({
        checkboardStyle: CheckboardStyle.NONE,
        theme: {
          mode: ThemeMode.LIGHT,
          colors: { light: { background: 'transparent' } },
        },
      });
    }
  }
  world.app.addPlugins(...DefaultPlugins, FilterPlugin, () => {
    system(PreStartUp)(Bootstrap);
    system((s) => s.inAnyOrderWith(s.allSystems))(Bootstrap);
  });
  await world.app.run();
  await world.frames();
  expect(api.getCanvas().has(GPUResource)).toBe(true);
});
afterAll(async () => {
  await world?.dispose();
});

type PaintNode =
  | RectSerializedNode
  | PathSerializedNode
  | EllipseSerializedNode;
const node = (type: 'rect' | 'ellipse' | 'path'): PaintNode => ({
  id: 'shape',
  type,
  x: 40,
  y: 40,
  width: 60,
  height: 60,
  zIndex: 0,
  ...(type === 'path' ? { d: 'M0 0H60V60H0Z' } : {}),
  fills: [{ type: 'solid', value: 'rgba(0,0,255,0.5)' }],
  strokes: [],
  filter: 'blur(6px, 3)',
});
async function edit(action: () => void) {
  const pending = api.edit(action);
  await world.frames();
  await pending;
}
async function render(shape: PaintNode) {
  await edit(() => {
    api.deleteNodesById(api.getNodes().map((n) => n.id));
    api.updateNodes([shape]);
  });
}
function pixel(x: number, y: number) {
  const gl = canvas.getContext('webgl1') as unknown as WebGLRenderingContext;
  const data = new Uint8Array(4);
  gl.readPixels(x, 159 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
  expect(gl.getError()).toBe(gl.NO_ERROR);
  return [...data];
}
function bounds() {
  return api.getEntity(api.getNodeById('shape'))!.read(ComputedBounds);
}
function blue(sample: number[], minimumAlpha = 5) {
  expect(sample[0]).toBe(0);
  expect(sample[1]).toBe(0);
  expect(Math.abs(sample[2] - sample[3])).toBeLessThanOrEqual(1);
  expect(sample[3]).toBeGreaterThan(minimumAlpha);
  expect(sample[3]).toBeLessThanOrEqual(128);
}

for (const type of ['rect', 'ellipse', 'path'] as const) {
  it.each(['blur(6px, 3)', 'blur(6px, 3, 0)', 'blur(6px, 3) blur(6px, 3)'])(
    `${type} %s retains blue while spreading alpha past its outline`,
    async (filter) => {
      await render({ ...node(type), filter });
      blue(pixel(37, 70));
      blue(pixel(70, 70), 100);
      expect(pixel(2, 70)).toEqual([0, 0, 0, 0]);
    },
  );

  it(`${type} live blur edits update render bounds without changing selection geometry`, async () => {
    await render(node(type));
    const geometry = bounds().geometryBounds;
    const original = [
      geometry.minX,
      geometry.minY,
      geometry.maxX,
      geometry.maxY,
    ];
    expect(bounds().renderBounds.maxX - bounds().renderBounds.minX).toBe(90);
    await edit(() =>
      api.updateNode(api.getNodeById('shape'), { filter: 'blur(2px, 1)' }),
    );
    expect(bounds().renderBounds.maxX - bounds().renderBounds.minX).toBe(66);
    await edit(() => api.updateNode(api.getNodeById('shape'), { filter: '' }));
    expect(bounds().renderBounds.maxX - bounds().renderBounds.minX).toBe(60);
    expect(pixel(37, 70)).toEqual([0, 0, 0, 0]);
    const current = bounds().geometryBounds;
    expect([current.minX, current.minY, current.maxX, current.maxY]).toEqual(
      original,
    );
  });

  it(`${type} keeps a visible blur fringe when its geometry is outside the viewport`, async () => {
    await render({ ...node(type), x: -62 });
    blue(pixel(0, 70), 1);
  });

  it(`${type} zero blur is an identity without extra sampling or padding`, async () => {
    await render({ ...node(type), filter: 'blur(0px)' });
    expect(bounds().renderBounds.maxX - bounds().renderBounds.minX).toBe(60);
    expect(pixel(39, 70)).toEqual([0, 0, 0, 0]);
    const zero = pixel(70, 70);
    await edit(() => api.updateNode(api.getNodeById('shape'), { filter: '' }));
    expect(zero).toEqual(pixel(70, 70));
    blue(zero, 125);
  });

  it(`${type} composes layers and applies shape opacity once`, async () => {
    await render({
      ...node(type),
      opacity: 0.5,
      fills: [
        { type: 'solid', value: 'red' },
        {
          type: 'solid',
          value: 'blue',
          opacity: 0.5,
        },
      ],
    });
    const center = pixel(70, 70);
    for (const [i, value] of [64, 0, 64, 128].entries())
      if (Math.abs(center[i] - value) > 2)
        throw new Error(JSON.stringify({ type, center }));
  });
}

it('compound path blur enters a hole while preserving its transparent center', async () => {
  await render({
    ...node('path'),
    type: 'path',
    width: 100,
    height: 100,
    x: 30,
    y: 25,
    d: 'M0 0H100V100H0Z M25 25H75V75H25Z',
    fillRule: 'evenodd',
  });
  blue(pixel(57, 75));
  expect(pixel(80, 75)).toEqual([0, 0, 0, 0]);
});

it.each(['center', 'inner', 'outer'] as const)(
  'SDF blur captures a solid %s stroke before expanding the output quad',
  async (alignment) => {
    await render({
      ...node('rect'),
      fills: [],
      strokes: [{ type: 'solid', value: 'blue' }],
      strokeWidth: 8,
      strokeAlignment: alignment,
    });
    const outside = pixel(37, 70);
    expect(outside[3]).toBeGreaterThan(5);
    // The 8-bit render-target round trip can differ by one quantization step.
    expect(outside[0]).toBe(0);
    expect(outside[1]).toBe(0);
    expect(Math.abs(outside[2] - outside[3])).toBeLessThanOrEqual(1);
    expect(pixel(70, 70)).toEqual([0, 0, 0, 0]);
    await edit(() =>
      api.updateNode(api.getNodeById('shape'), { filter: 'blur(0px)' }),
    );
    const zero = [pixel(37, 70), pixel(40, 70), pixel(103, 70)];
    await edit(() => api.updateNode(api.getNodeById('shape'), { filter: '' }));
    expect(zero).toEqual([pixel(37, 70), pixel(40, 70), pixel(103, 70)]);
  },
);
