import {
  API,
  Commands,
  DefaultPlugins,
  DefaultStateManagement,
  DOMAdapter,
  CheckboardStyle,
  GPUResource,
  PreStartUp,
  System,
  ThemeMode,
  system,
  type PathSerializedNode,
  type RectSerializedNode,
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

async function render(
  node: RectSerializedNode | PathSerializedNode,
  globalFilter = '',
) {
  const pending = api.edit(() => {
    api.setAppState({ filter: globalFilter });
    api.deleteNodesById(api.getNodes().map((n) => n.id));
    api.updateNodes([node]);
  });
  await world.frames();
  await pending;
  const gl = canvas.getContext('webgl1') as unknown as WebGLRenderingContext;
  const data = new Uint8Array(4);
  gl.readPixels(40, 119, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
  expect(gl.getError()).toBe(gl.NO_ERROR);
  return [...data];
}

for (const kind of ['rect', 'path'] as const) {
  for (const global of [false, true]) {
    it.each([
      ['brightness(0.2)', [51, 51, 255, 128]],
      ['brightness(-0.4)', [0, 0, 153, 128]],
      ['contrast(0.5)', [0, 0, 255, 128]],
      ['contrast(-0.5)', [64, 64, 191, 128]],
      ['brightness(0.8) brightness(-0.5)', [77, 77, 128, 128]],
      ['contrast(0.8) contrast(-0.5)', [64, 64, 191, 128]],
      ['brightness(0.2) contrast(-0.5)', [89, 89, 191, 128]],
    ] as [string, number[]][])(
      `${kind} ${
        global ? 'canvas' : 'shape'
      } filter %s preserves alpha and clamps between passes`,
      async (filter, expected) => {
        // Primary channels avoid Cairo unpremultiplication rounding in the input.
        const node: RectSerializedNode | PathSerializedNode = {
          id: 'shape',
          type: kind,
          x: 10,
          y: 10,
          zIndex: 0,
          width: 67,
          height: 59,
          ...(kind === 'path' ? { d: 'M0 0H67V59H0Z' } : {}),
          fills: [{ type: 'solid', value: 'rgba(0,0,255,0.5)' }],
          strokes: [],
          filter: global ? '' : filter,
        };
        const actual = await render(node, global ? filter : '');
        // The backbuffer is premultiplied; compare directly instead of amplifying
        // 8-bit rounding by dividing low alpha values.
        const premultiplied = expected.map((c, i) =>
          i === 3 ? c : (c * expected[3]) / 255,
        );
        for (let i = 0; i < 4; i++) {
          if (Math.abs(actual[i] - premultiplied[i]) > 2)
            throw new Error(
              JSON.stringify({ actual, premultiplied, filter, global }),
            );
        }
      },
    );
  }
}

for (const kind of ['rect', 'path'] as const) {
  for (const global of [false, true]) {
    it.each([
      'hue-rotate(90deg)',
      'noise(0.7)',
      'dot(1,5,1)',
      'color-halftone(4)',
    ])(
      `${kind} ${
        global ? 'canvas' : 'shape'
      } %s retains color strength at half alpha`,
      async (filter) => {
        const shape = (
          alpha: number,
        ): RectSerializedNode | PathSerializedNode => ({
          id: 'shape',
          type: kind,
          x: 10,
          y: 10,
          zIndex: 0,
          width: 67,
          height: 59,
          ...(kind === 'path' ? { d: 'M0 0H67V59H0Z' } : {}),
          fills: [{ type: 'solid', value: `rgba(0,0,255,${alpha})` }],
          strokes: [],
          filter: global ? '' : filter,
        });
        const opaque = await render(shape(1), global ? filter : '');
        const half = await render(shape(0.5), global ? filter : '');
        expect(opaque[3]).toBe(255);
        expect(Math.abs(half[3] - 128)).toBeLessThanOrEqual(1);
        for (let c = 0; c < 3; c++) {
          expect(
            Math.abs(half[c] - (opaque[c] * half[3]) / 255),
          ).toBeLessThanOrEqual(2);
          expect(half[c]).toBeLessThanOrEqual(half[3]);
        }
        if (filter.startsWith('dot')) expect(opaque[0]).toBe(opaque[1]);
        if (filter.startsWith('dot')) expect(opaque[1]).toBe(opaque[2]);
        if (filter.startsWith('hue') || filter.startsWith('noise'))
          expect(opaque.slice(0, 3)).not.toEqual([0, 0, 255]);
      },
    );
  }
}
