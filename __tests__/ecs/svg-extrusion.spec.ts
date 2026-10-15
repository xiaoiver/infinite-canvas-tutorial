import { JSDOM } from 'jsdom';
import {
  ComputeBounds,
  ComputeCamera,
  EnsureExtrudeMeshes,
  Extrude3D,
  Mesh3D,
  PostUpdate,
  SyncExtrude3D,
  system,
  svgElementsToExtrudedNodes,
  svgElementsToSerializedNodes,
  type API,
} from '../../packages/ecs/src';
import { createDocumentWorld } from '../helpers/ecs-document';

const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
  <path id="ring" d="M10 10 H110 V110 H10 Z M35 35 H85 V85 H35 Z" fill="#3366cc" fill-rule="evenodd"/>
  <polygon id="triangle" points="120,10 190,10 155,90" fill="#ee8844"/>
  <path id="open" d="M10 10 L40 10 L40 40" fill="#3366cc"/>
  <path id="stroked" d="M0 0 H20 V20 H0 Z" fill="#3366cc" stroke="black"/>
  <path id="unfilled" d="M0 0 H20 V20 H0 Z" fill="none"/>
</svg>`;
const elements = () => {
  const dom = new JSDOM(markup, { contentType: 'image/svg+xml' });
  return Array.from(
    dom.window.document.querySelector('svg')!.children,
  ) as SVGElement[];
};

it('maps only supported closed SVG paths and polygons to extrusion sources', () => {
  const input = elements();
  const ordinary = svgElementsToSerializedNodes(input);
  expect(ordinary.every((node) => !('extrude3d' in node))).toBe(true);

  const nodes = svgElementsToExtrudedNodes(input, 24);
  expect(
    nodes.filter((node) => 'extrude3d' in node).map((node) => node.id),
  ).toEqual(['ring', 'triangle']);
  expect(nodes.find((node) => node.id === 'ring')).toMatchObject({
    type: 'path',
    fillRule: 'evenodd',
    strokes: [{ type: 'solid', value: 'none' }],
    extrude3d: 24,
  });
  expect(() => svgElementsToExtrudedNodes(input, 0)).toThrow(RangeError);
  expect(() => svgElementsToExtrudedNodes(input, Infinity)).toThrow(RangeError);
});

let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
beforeAll(async () => {
  world = await createDocumentWorld(1, false, [
    () => {
      system(PostUpdate)(EnsureExtrudeMeshes);
      system((s) => s.after(ComputeBounds).before(ComputeCamera))(
        EnsureExtrudeMeshes,
      );
      system(PostUpdate)(SyncExtrude3D);
      system((s) => s.after(EnsureExtrudeMeshes).before(ComputeCamera))(
        SyncExtrude3D,
      );
    },
  ]);
  [api] = world.apis;
});
afterAll(async () => world?.dispose());

it('renders imported SVG contours as 3D companions while keeping other paths in 2D', async () => {
  await world.reset(api, svgElementsToExtrudedNodes(elements(), 24));
  for (const id of ['ring', 'triangle']) {
    const source = api.getEntity(api.getNodeById(id))!;
    expect(
      source.read(Extrude3D).meshEntity?.read(Mesh3D).indices.length,
    ).toBeGreaterThan(0);
  }
  for (const id of ['open', 'stroked', 'unfilled']) {
    expect(api.getEntity(api.getNodeById(id))!.has(Extrude3D)).toBe(false);
  }
});
