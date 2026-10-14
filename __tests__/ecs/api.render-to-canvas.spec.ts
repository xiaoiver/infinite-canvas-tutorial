import type { SerializedNode } from '../../packages/ecs/src/types/serialized-node';
import { createCanvas, loadImage } from 'canvas';
import { DOMAdapter } from '../../packages/ecs/src/environment';
import type { Adapter } from '../../packages/ecs/src/environment/adapter';
import { createDocumentWorld } from '../helpers/ecs-document';

let world: Awaited<ReturnType<typeof createDocumentWorld>>;
beforeAll(async () => {
  world = await createDocumentWorld();
});
afterAll(async () => {
  await world?.dispose();
});

const shape = (id: string, patch: Record<string, unknown>): SerializedNode =>
  ({
    id,
    type: 'rect',
    zIndex: 0,
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    ...patch,
  } as SerializedNode);

async function render(node: SerializedNode, canvas?: HTMLCanvasElement) {
  const api = world.apis[0];
  await world.reset(api, [node]);
  return api.renderToCanvas(api.getNodeById(node.id), {
    canvas,
    width: 100,
    height: 80,
  });
}

const pixel = (canvas: HTMLCanvasElement, x: number, y: number) =>
  Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);

it('draws a rectangle border on all four sides and leaves the center filled', async () => {
  const canvas = await render(
    shape('rect', {
      x: 10,
      y: 10,
      width: 30,
      height: 30,
      fills: [{ type: 'solid', value: '#ff0000' }],
      strokes: [{ type: 'solid', value: '#0000ff' }],
      strokeWidth: 4,
    }),
  );
  expect(pixel(canvas, 10, 20)).toEqual([0, 0, 255, 255]);
  expect(pixel(canvas, 25, 25)).toEqual([255, 0, 0, 255]);
  expect(pixel(canvas, 40, 20)).toEqual([0, 0, 255, 255]);
});

it('starts each ellipse with its own Canvas2D path', async () => {
  const api = world.apis[0];
  const nodes = [
    shape('red', {
      type: 'ellipse',
      x: 5,
      y: 5,
      width: 20,
      height: 20,
      fills: [{ type: 'solid', value: 'red' }],
    }),
    shape('blue', {
      type: 'ellipse',
      x: 45,
      y: 5,
      width: 20,
      height: 20,
      fills: [{ type: 'solid', value: 'blue' }],
    }),
  ];
  await world.reset(api, nodes);
  const canvas = await api.renderToCanvas(api.getNodeById('red'), {
    width: 80,
    height: 40,
  });
  await api.renderToCanvas(api.getNodeById('blue'), { canvas });
  expect(pixel(canvas, 15, 15)).toEqual([255, 0, 0, 255]);
  expect(pixel(canvas, 55, 15)).toEqual([0, 0, 255, 255]);
});

it('fills an offset SVG path with H/V/Z commands', async () => {
  const canvas = await render(
    shape('path', {
      type: 'path',
      x: 10,
      y: 12,
      width: 20,
      height: 20,
      d: 'M2 2 H20 V20 H2 Z',
      fills: [{ type: 'solid', value: 'red' }],
    }),
  );
  expect(pixel(canvas, 20, 20)).toEqual([255, 0, 0, 255]);
  expect(pixel(canvas, 5, 5)[3]).toBe(0);
});

it.each([
  ['quadratic', 'M0 20 Q20 -10 40 20 L40 30 L0 30 Z', 30, 23],
  ['arc', 'M0 20 A20 20 0 0 1 40 20 L40 35 L0 35 Z', 30, 20],
] as const)('fills %s SVG path geometry', async (_kind, d, x, y) => {
  const canvas = await render(
    shape('path', {
      type: 'path',
      x: 10,
      y: 10,
      width: 40,
      height: 40,
      d,
      fills: [{ type: 'solid', value: 'red' }],
    }),
  );
  expect(pixel(canvas, x, y)).toEqual([255, 0, 0, 255]);
});

it('translates local line endpoints with the node', async () => {
  const canvas = await render(
    shape('line', {
      type: 'line',
      x: 10,
      y: 10,
      x1: 0,
      y1: 5,
      x2: 30,
      y2: 5,
      strokes: [{ type: 'solid', value: 'blue' }],
      strokeWidth: 4,
    }),
  );
  expect(pixel(canvas, 20, 15)).toEqual([0, 0, 255, 255]);
  expect(pixel(canvas, 20, 5)[3]).toBe(0);
});

it('keeps successive open polylines from repainting one another', async () => {
  const api = world.apis[0];
  const nodes = [
    shape('red', {
      type: 'polyline',
      x: 10,
      y: 10,
      points: '0,0 30,0',
      strokes: [{ type: 'solid', value: 'red' }],
      strokeWidth: 4,
    }),
    shape('blue', {
      type: 'polyline',
      x: 10,
      y: 30,
      points: '0,0 30,0',
      strokes: [{ type: 'solid', value: 'blue' }],
      strokeWidth: 4,
    }),
  ];
  await world.reset(api, nodes);
  const canvas = await api.renderToCanvas(api.getNodeById('red'), {
    width: 80,
    height: 50,
  });
  await api.renderToCanvas(api.getNodeById('blue'), { canvas });
  expect(pixel(canvas, 20, 10)).toEqual([255, 0, 0, 255]);
  expect(pixel(canvas, 20, 30)).toEqual([0, 0, 255, 255]);
});

it('does not paint a stroke when no stroke layer is enabled', async () => {
  const canvas = await render(
    shape('line', {
      type: 'line',
      x1: 0,
      y1: 15,
      x2: 40,
      y2: 15,
    }),
  );
  expect(pixel(canvas, 20, 15)[3]).toBe(0);
});

it('keeps node, fill-layer and stroke-layer opacity independent', async () => {
  const canvas = await render(
    shape('opacity', {
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      opacity: 0.5,
      fills: [{ type: 'solid', value: 'red', opacity: 0.5 }],
      strokes: [{ type: 'solid', value: 'blue', opacity: 0.25 }],
      strokeWidth: 4,
    }),
  );
  expect(pixel(canvas, 20, 20)).toEqual([255, 0, 0, 64]);
  expect(pixel(canvas, 9, 20)).toEqual([0, 0, 255, 32]);
});

it('honors the SVG evenodd rule for nested contours', async () => {
  const d = 'M0 0 H40 V40 H0 Z M10 10 H30 V30 H10 Z';
  const evenodd = await render(
    shape('even', {
      type: 'path',
      d,
      fillRule: 'evenodd',
      fills: [{ type: 'solid', value: 'red' }],
    }),
  );
  expect(pixel(evenodd, 5, 5)).toEqual([255, 0, 0, 255]);
  expect(pixel(evenodd, 20, 20)[3]).toBe(0);
  const nonzero = await render(
    shape('nonzero', {
      type: 'path',
      d,
      fillRule: 'nonzero',
      fills: [{ type: 'solid', value: 'red' }],
    }),
  );
  expect(pixel(nonzero, 20, 20)).toEqual([255, 0, 0, 255]);
});

it('renders children in order after asynchronous image decoding, under the parent transform', async () => {
  const blue = createCanvas(2, 2);
  blue.getContext('2d').fillStyle = 'blue';
  blue.getContext('2d').fillRect(0, 0, 2, 2);
  const source = blue.toDataURL();
  const previous = DOMAdapter.get();
  DOMAdapter.set({
    ...previous,
    createImage: async (url: string) => {
      await Promise.resolve();
      return loadImage(url);
    },
  } as unknown as Adapter);
  try {
    const api = world.apis[0];
    await world.reset(api, [
      shape('parent', {
        type: 'group',
        x: 10,
        y: 10,
        width: 30,
        height: 30,
        opacity: 0.5,
      }),
      shape('image', {
        parentId: 'parent',
        zIndex: 1,
        width: 20,
        height: 20,
        fills: [{ type: 'image', value: source }],
      }),
      shape('front', {
        parentId: 'parent',
        zIndex: 2,
        width: 20,
        height: 20,
        fills: [{ type: 'solid', value: 'red' }],
      }),
    ]);
    expect(
      api
        .getChildren(api.getNodeById('parent'))
        .map((entity) => api.getNodeByEntity(entity)?.id),
    ).toEqual(['image', 'front']);
    const canvas = await api.renderToCanvas(api.getNodeById('parent'), {
      width: 60,
      height: 60,
    });
    const [r, , b, a] = pixel(canvas, 15, 15);
    expect(r).toBeGreaterThan(b);
    expect(a).toBeGreaterThan(180);
    expect(pixel(canvas, 5, 5)[3]).toBe(0);
  } finally {
    DOMAdapter.set(previous);
  }
});

it('respects the local radius of a rounded rectangle', async () => {
  const canvas = await render(
    shape('round', {
      x: 10,
      y: 10,
      width: 30,
      height: 30,
      cornerRadius: 10,
      fills: [{ type: 'solid', value: 'red' }],
    }),
  );
  expect(pixel(canvas, 11, 11)[3]).toBe(0);
  expect(pixel(canvas, 25, 25)).toEqual([255, 0, 0, 255]);
});

it('clips an image fill to the rounded rectangle before drawing its stroke', async () => {
  const source = createCanvas(2, 2);
  source.getContext('2d').fillStyle = 'red';
  source.getContext('2d').fillRect(0, 0, 2, 2);
  const previous = DOMAdapter.get();
  DOMAdapter.set({
    ...previous,
    createImage: async (url: string) => loadImage(url),
  } as unknown as Adapter);
  try {
    const canvas = await render(
      shape('rounded-image', {
        x: 10,
        y: 10,
        width: 30,
        height: 30,
        cornerRadius: 10,
        fills: [{ type: 'image', value: source.toDataURL() }],
        strokes: [{ type: 'solid', value: 'blue' }],
        strokeWidth: 2,
      }),
    );
    expect(pixel(canvas, 11, 11)[3]).toBe(0);
    expect(pixel(canvas, 25, 25)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 25, 10)[2]).toBe(255);
  } finally {
    DOMAdapter.set(previous);
  }
});

it('restores canvas state if an image cannot be decoded', async () => {
  const previous = DOMAdapter.get();
  DOMAdapter.set({
    ...previous,
    createImage: async (url: string) => loadImage(url),
  } as unknown as Adapter);
  try {
    const api = world.apis[0];
    const bad = shape('bad', {
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      fills: [{ type: 'image', value: 'data:image/png;base64,broken' }],
    });
    await world.reset(api, [bad]);
    const canvas = world.window.document.createElement('canvas');
    canvas.width = 60;
    canvas.height = 60;
    await expect(
      api.renderToCanvas(api.getNodeById('bad'), { canvas }),
    ).rejects.toThrow();
    await world.reset(api, [
      shape('good', {
        width: 20,
        height: 20,
        fills: [{ type: 'solid', value: 'red' }],
      }),
    ]);
    await api.renderToCanvas(api.getNodeById('good'), { canvas });
    expect(pixel(canvas, 5, 5)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 25, 25)[3]).toBe(0);
  } finally {
    DOMAdapter.set(previous);
  }
});
