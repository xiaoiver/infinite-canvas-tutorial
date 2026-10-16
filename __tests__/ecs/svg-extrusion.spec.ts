import { JSDOM } from 'jsdom';
import {
  ComputeBounds,
  ComputeCamera,
  EnsureExtrudeMeshes,
  ExportFormat,
  Extrude3D,
  Material3D,
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
  <rect id="box" x="210" y="10" width="30" height="40" fill="#2266cc"/>
  <rect id="rounded" x="250" y="10" width="60" height="40" rx="8" fill="#cc6622"/>
  <circle id="circle" cx="350" cy="30" r="20" fill="#22aa66"/>
  <ellipse id="ellipse" cx="420" cy="30" rx="30" ry="15" fill="#aa22aa"/>
  <ellipse id="stroked-ellipse" cx="500" cy="30" rx="30" ry="15" fill="#aa22aa" stroke="#000"/>
  <rect id="invalid-rect" x="540" y="10" width="0" height="40" fill="#2266cc"/>
  <g id="cluster" fill="#0088aa" transform="translate(8 6)">
    <rect id="grouped" x="10" y="80" width="24" height="30"/>
    <circle id="grouped-circle" cx="65" cy="95" r="15"/>
    <path id="grouped-path" d="M145 80 H170 V110 H145 Z"/>
    <ellipse id="grouped-unfilled" cx="105" cy="95" rx="20" ry="15" fill="none"/>
  </g>
  <g id="outlined" fill="#0088aa" stroke="#111111">
    <circle id="grouped-stroked-circle" cx="35" cy="150" r="15"/>
    <rect id="grouped-stroked-rect" x="60" y="135" width="30" height="30"/>
  </g>
  <g id="single" fill="#ff0000">
    <circle id="only-child" cx="230" cy="150" r="15"/>
  </g>
  <circle id="following-sibling" cx="280" cy="150" r="15" fill="#00ff00"/>
</svg>`;
const elements = () => {
  const dom = new JSDOM(markup, { contentType: 'image/svg+xml' });
  return Array.from(
    dom.window.document.querySelector('svg')!.children,
  ) as SVGElement[];
};

it('maps supported SVG paths, polygons, rectangles and ellipses to extrusion sources', () => {
  const input = elements();
  const ordinary = svgElementsToSerializedNodes(input);
  expect(ordinary.every((node) => !('extrude3d' in node))).toBe(true);
  expect(ordinary.find((node) => node.id === 'grouped')).not.toHaveProperty(
    'fills',
  );
  expect(
    ordinary.find((node) => node.id === 'grouped-circle'),
  ).not.toHaveProperty('fills');
  expect(
    ordinary.find((node) => node.id === 'grouped-path'),
  ).not.toHaveProperty('fills');

  const nodes = svgElementsToExtrudedNodes(input, 24);
  expect(
    nodes.filter((node) => 'extrude3d' in node).map((node) => node.id),
  ).toEqual([
    'ring',
    'triangle',
    'box',
    'rounded',
    'circle',
    'ellipse',
    'grouped',
    'grouped-circle',
    'grouped-path',
    'single',
    'following-sibling',
  ]);
  expect(nodes.find((node) => node.id === 'ring')).toMatchObject({
    type: 'path',
    fillRule: 'evenodd',
    strokes: [{ type: 'solid', value: 'none' }],
    extrude3d: 24,
  });
  expect(nodes.find((node) => node.id === 'box')).toMatchObject({
    type: 'rect',
    x: 210,
    y: 10,
    width: 30,
    height: 40,
    extrude3d: 24,
  });
  expect(nodes.find((node) => node.id === 'rounded')).toMatchObject({
    type: 'path',
    x: 250,
    y: 10,
    width: 60,
    height: 40,
    extrude3d: 24,
  });
  for (const id of ['rounded', 'circle', 'ellipse']) {
    const node = nodes.find((item) => item.id === id);
    expect(node).toMatchObject({ type: 'path', extrude3d: 24 });
    expect(node?.type === 'path' && node.d).toContain('A');
  }
  expect(nodes.find((node) => node.id === 'circle')).toMatchObject({
    x: 330,
    y: 10,
    width: 40,
    height: 40,
  });
  expect(nodes.find((node) => node.id === 'ellipse')).toMatchObject({
    x: 390,
    y: 15,
    width: 60,
    height: 30,
  });
  expect(nodes.find((node) => node.id === 'stroked-ellipse')).toMatchObject({
    type: 'ellipse',
  });
  expect(nodes.find((node) => node.id === 'invalid-rect')).toMatchObject({
    type: 'rect',
  });
  expect(nodes.find((node) => node.id === 'grouped')).toMatchObject({
    type: 'rect',
    parentId: 'cluster',
    extrude3d: 24,
  });
  expect(nodes.find((node) => node.id === 'grouped-circle')).toMatchObject({
    type: 'path',
    parentId: 'cluster',
    extrude3d: 24,
  });
  expect(nodes.find((node) => node.id === 'grouped-path')).toMatchObject({
    type: 'path',
    parentId: 'cluster',
    extrude3d: 24,
  });
  expect(nodes.find((node) => node.id === 'grouped-unfilled')).toMatchObject({
    type: 'ellipse',
    parentId: 'cluster',
  });
  expect(
    nodes.find((node) => node.id === 'grouped-stroked-circle'),
  ).toMatchObject({
    type: 'ellipse',
    parentId: 'outlined',
  });
  expect(nodes.find((node) => node.id === 'single')).toMatchObject({
    fills: [{ value: '#ff0000' }],
  });
  expect(nodes.find((node) => node.id === 'following-sibling')).toMatchObject({
    fills: [{ value: '#00ff00' }],
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
  for (const id of [
    'ring',
    'triangle',
    'box',
    'rounded',
    'circle',
    'ellipse',
    'grouped',
    'grouped-circle',
    'grouped-path',
    'single',
    'following-sibling',
  ]) {
    const source = api.getEntity(api.getNodeById(id))!;
    expect(
      source.read(Extrude3D).meshEntity?.read(Mesh3D).indices.length,
    ).toBeGreaterThan(0);
  }
  const inheritedColor = api
    .getEntity(api.getNodeById('grouped-circle'))!
    .read(Extrude3D)
    .meshEntity!.read(Material3D).baseColor;
  expect(inheritedColor[0]).toBeCloseTo(0);
  expect(inheritedColor[1]).toBeCloseTo(136 / 255);
  expect(inheritedColor[2]).toBeCloseTo(170 / 255);
  for (const id of [
    'open',
    'stroked',
    'unfilled',
    'stroked-ellipse',
    'invalid-rect',
    'grouped-unfilled',
    'grouped-stroked-circle',
    'grouped-stroked-rect',
  ]) {
    expect(api.getEntity(api.getNodeById(id))!.has(Extrude3D)).toBe(false);
  }
});

it('exports ready SVG extrusions through API.export with scene, node, and group scopes', async () => {
  await world.reset(api, svgElementsToExtrudedNodes(elements(), 24));
  const exportNames = (nodes = [] as ReturnType<API['getNodes']>) => {
    const bytes = api.export({
      format: ExportFormat.GLB,
      nodes,
      download: false,
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
    const glb = bytes as Uint8Array;
    expect(new DataView(glb.buffer, glb.byteOffset).getUint32(0, true)).toBe(
      0x46546c67,
    );
    const jsonLength = new DataView(glb.buffer, glb.byteOffset).getUint32(
      12,
      true,
    );
    const json = JSON.parse(
      new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)),
    ) as { nodes: { name?: string }[] };
    return json.nodes.map((node) => node.name).filter(Boolean);
  };

  expect(exportNames()).toEqual([
    'Canvas',
    'ring',
    'triangle',
    'box',
    'rounded',
    'circle',
    'ellipse',
    'grouped',
    'grouped-circle',
    'grouped-path',
    'single',
    'following-sibling',
  ]);
  expect(exportNames([api.getNodeById('box')!])).toEqual(['Canvas', 'box']);
  expect(exportNames([api.getNodeById('cluster')!])).toEqual([
    'Canvas',
    'grouped',
    'grouped-circle',
    'grouped-path',
  ]);
  expect(() => exportNames([api.getNodeById('stroked')!])).toThrow(
    'No ready extruded meshes to export',
  );
});
