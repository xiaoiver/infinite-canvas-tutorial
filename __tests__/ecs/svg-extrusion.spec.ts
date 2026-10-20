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
  Transform3D,
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

it('places the local bounds origin correctly under SVG scale and matrix transforms', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<rect id="scaled" x="10" y="20" width="30" height="40" transform="scale(2 3)"/>' +
    '<rect id="turned" x="10" y="20" width="30" height="40" transform="matrix(0 2 -3 0 5 7)"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const input = Array.from(dom.window.document.documentElement.children) as SVGElement[];
  const nodes = svgElementsToSerializedNodes(input);
  expect(nodes.find((node) => node.id === 'scaled')).toMatchObject({
    x: 20, y: 60, scaleX: 2, scaleY: 3,
  });
  expect(nodes.find((node) => node.id === 'turned')).toMatchObject({
    x: -55, y: 27, scaleX: 2, scaleY: 3,
  });
});

it('maps an explicit SVG viewBox into the extrusion viewport', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 100 50" width="300" height="100">' +
    '<path id="square" d="M10 20 H20 V30 H10 Z" fill="red"/>' +
    '<rect id="box-in-viewbox" x="30" y="20" width="10" height="10" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const node = svgElementsToExtrudedNodes(svg, 20).find((item) => item.id === 'square');
  // Default xMidYMid meet: scale 2 and center 100-wide viewport in 300 pixels.
  expect(node).toMatchObject({
    type: 'path', x: 50, y: 0, width: 10, height: 10,
    scaleX: 2, scaleY: 2, extrude3d: 20,
  });
  expect(node?.type === 'path' && node.d).toContain('H10');
  expect(svgElementsToExtrudedNodes(svg, 20).find((item) => item.id === 'box-in-viewbox'))
    .toMatchObject({ type: 'rect', x: 90, y: 0, width: 10, scaleX: 2, extrude3d: 20 });
});

it('expands repeated and forward SVG use references without losing siblings', async () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
    '<use id="first" href="#stamp" x="10" y="20" fill="red"/>' +
    '<rect id="between" x="50" width="10" height="10" fill="green"/>' +
    '<defs><path id="stamp" d="M0 0 H20 V20 H0 Z"/></defs>' +
    '<use id="second" xlink:href="#stamp" x="80" y="20" fill="blue"/>' +
    '<use id="missing" href="#unknown"/>' +
    '<use id="relative" href="#stamp" x="10%"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  const flatNodes = svgElementsToSerializedNodes(
    Array.from(svg.children) as SVGElement[],
  );
  expect(nodes.map((node) => node.id)).toEqual([
    'first', 'first--stamp', 'between', 'second', 'second--stamp',
  ]);
  expect(flatNodes.map((node) => node.id)).toEqual(nodes.map((node) => node.id));
  expect(svg.querySelector('#first--stamp')).toBeNull();
  expect(nodes.find((node) => node.id === 'first--stamp')).toMatchObject({
    type: 'path', parentId: 'first', extrude3d: 16,
  });
  expect(nodes.find((node) => node.id === 'second--stamp')).toMatchObject({
    type: 'path', parentId: 'second', extrude3d: 16,
  });
  expect(nodes.find((node) => node.id === 'between')).toMatchObject({
    type: 'rect', extrude3d: 16,
  });
  await world.reset(api, nodes);
  for (const id of ['first--stamp', 'second--stamp']) {
    const entity = api.getEntity(api.getNodeById(id))!;
    expect(entity.read(Extrude3D).meshEntity?.read(Mesh3D).indices.length)
      .toBeGreaterThan(0);
  }
  const firstColor = api.getEntity(api.getNodeById('first--stamp'))!
    .read(Extrude3D).meshEntity!.read(Material3D).baseColor;
  const secondColor = api.getEntity(api.getNodeById('second--stamp'))!
    .read(Extrude3D).meshEntity!.read(Material3D).baseColor;
  expect(firstColor.slice(0, 3)).toEqual([1, 0, 0]);
  expect(secondColor.slice(0, 3)).toEqual([0, 0, 1]);
});

it('composes use offsets, transforms, and viewBox for extrusion outlines', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 100 100">' +
    '<defs><rect id="tile" x="0" y="0" width="10" height="10" transform="translate(2 3)"/></defs>' +
    '<use id="placed" href="#tile" x="10" y="20" transform="translate(5 0)" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 16).find((node) => node.id === 'placed--tile'))
    .toMatchObject({
      type: 'rect', parentId: undefined, x: 67, y: 23,
      width: 10, height: 10, extrude3d: 16,
    });
});

it('retains both group and child transforms in a referenced group', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<defs><g id="motif" transform="translate(2 3)">' +
    '<rect id="tile" width="10" height="10" transform="translate(4 5)"/>' +
    '</g></defs>' +
    '<use id="placed" href="#motif" x="10" y="20" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  expect(nodes.find((node) => node.id === 'placed--tile')).toMatchObject({
    type: 'rect', parentId: 'placed--motif', x: 4, y: 5, extrude3d: 16,
  });
  expect(nodes.find((node) => node.id === 'placed--motif')).toMatchObject({
    type: 'g', parentId: 'placed', x: 2, y: 3,
  });
  expect(nodes.find((node) => node.id === 'placed')).toMatchObject({
    type: 'g', x: 10, y: 20,
  });
});

it('retains an outer single-child group transform around a use instance', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 100 100">' +
    '<defs><rect id="tile" width="10" height="10" transform="translate(2 3)"/></defs>' +
    '<g id="outer" transform="translate(7 11)">' +
    '<use id="placed" href="#tile" x="10" y="20" transform="translate(5 0)" fill="red"/>' +
    '</g></svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 16).find((node) => node.id === 'placed--tile'))
    .toMatchObject({ type: 'rect', x: 74, y: 34, extrude3d: 16 });
});

it('expands nested use aliases with unique IDs for each instance', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<defs><path id="tile" d="M0 0 H10 V10 H0 Z" fill="green"/>' +
    '<use id="alias" href="#tile" x="5"/>' +
    '<g id="pair"><use href="#alias"/><use href="#tile" x="20"/></g></defs>' +
    '<use id="pair-a" href="#pair" fill="red"/>' +
    '<use id="pair-b" href="#pair" x="50" fill="blue"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  const paths = nodes.filter((node) => node.type === 'path');
  expect(paths).toHaveLength(4);
  expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
  expect(paths.every((node) => node.extrude3d === 16)).toBe(true);
  expect(paths[0]).toMatchObject({ fills: [{ value: 'green' }] });
});

it('clips a referenced shape inside a sliced SVG viewport', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" ' +
    'preserveAspectRatio="xMidYMid slice">' +
    '<defs><rect id="tile" x="90" y="20" width="20" height="20"/></defs>' +
    '<use id="edge" href="#tile" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 16).find((node) => node.id === 'edge--tile'))
    .toMatchObject({
      type: 'path', x: 90, y: 20, width: 10, height: 20,
      fillRule: 'evenodd', extrude3d: 16,
    });
});

it('maps a symbol viewBox into repeated use viewports with independent paints', async () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<defs><symbol id="badge" viewBox="0 0 100 50">' +
    '<rect id="tile" width="100" height="50"/></symbol></defs>' +
    '<use id="first-badge" href="#badge" x="10" y="20" width="200" height="200" fill="red"/>' +
    '<use id="second-badge" href="#badge" x="240" y="20" width="200" height="200" fill="blue"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  expect(nodes.find((node) => node.id === 'first-badge--badge')).toMatchObject({
    type: 'g', parentId: 'first-badge', x: 0, y: 50, scaleX: 2, scaleY: 2,
  });
  expect(nodes.find((node) => node.id === 'first-badge--tile')).toMatchObject({
    type: 'rect', parentId: 'first-badge--badge', extrude3d: 16,
  });
  expect(nodes.find((node) => node.id === 'second-badge--tile')).toMatchObject({
    type: 'rect', parentId: 'second-badge--badge', extrude3d: 16,
  });
  await world.reset(api, nodes);
  for (const id of ['first-badge--tile', 'second-badge--tile']) {
    const entity = api.getEntity(api.getNodeById(id))!;
    expect(entity.read(Extrude3D).meshEntity?.read(Mesh3D).indices.length)
      .toBeGreaterThan(0);
  }
  const firstColor = api.getEntity(api.getNodeById('first-badge--tile'))!
    .read(Extrude3D).meshEntity!.read(Material3D).baseColor;
  const secondColor = api.getEntity(api.getNodeById('second-badge--tile'))!
    .read(Extrude3D).meshEntity!.read(Material3D).baseColor;
  expect(firstColor.slice(0, 3)).toEqual([1, 0, 0]);
  expect(secondColor.slice(0, 3)).toEqual([0, 0, 1]);
});

it('uses symbol dimensions when an instance omits one or both dimensions', async () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<defs><symbol id="badge" viewBox="0 0 100 50" width="200" height="100">' +
    '<rect id="tile" width="100" height="50"/></symbol></defs>' +
    '<use id="intrinsic" href="#badge" x="10" fill="red"/>' +
    '<use id="wide" href="#badge" x="240" width="300" fill="blue"/>' +
    '<use id="tall" href="#badge" x="560" height="150" fill="green"/>' +
    '<use id="invalid" href="#badge" width="0" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  const flatNodes = svgElementsToSerializedNodes(Array.from(svg.children) as SVGElement[]);
  expect(flatNodes.map((node) => node.id)).toEqual(nodes.map((node) => node.id));
  expect(nodes.find((node) => node.id === 'intrinsic--badge')).toMatchObject({
    type: 'g', x: 0, y: 0, scaleX: 2, scaleY: 2,
  });
  expect(nodes.find((node) => node.id === 'wide--badge')).toMatchObject({
    type: 'g', x: 50, y: 0, scaleX: 2, scaleY: 2,
  });
  expect(nodes.find((node) => node.id === 'tall--badge')).toMatchObject({
    type: 'g', x: 0, y: 25, scaleX: 2, scaleY: 2,
  });
  expect(nodes.find((node) => node.id === 'invalid')).toBeUndefined();
  await world.reset(api, nodes);
  for (const id of ['intrinsic--tile', 'wide--tile', 'tall--tile']) {
    const entity = api.getEntity(api.getNodeById(id))!;
    expect(entity.read(Extrude3D).meshEntity?.read(Mesh3D).indices.length)
      .toBeGreaterThan(0);
  }
});

it('honors symbol aspect-ratio alignment and nonuniform scaling', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<defs><symbol id="aligned" viewBox="0 0 100 50" preserveAspectRatio="xMaxYMin meet">' +
    '<path id="shape" d="M0 0 H100 V50 H0 Z"/></symbol>' +
    '<symbol id="stretched" viewBox="0 0 100 50" preserveAspectRatio="none">' +
    '<path id="wide" d="M0 0 H100 V50 H0 Z"/></symbol></defs>' +
    '<use id="right" href="#aligned" width="300" height="100" fill="red"/>' +
    '<use id="none" href="#stretched" width="300" height="100" fill="blue"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  expect(nodes.find((node) => node.id === 'right--aligned')).toMatchObject({
    type: 'g', x: 100, y: 0, scaleX: 2, scaleY: 2,
  });
  expect(nodes.find((node) => node.id === 'none--stretched')).toMatchObject({
    type: 'g', x: 0, y: 0, scaleX: 3, scaleY: 2,
  });
});

it('combines root and symbol viewBoxes for a holed path extrusion', async () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 200 100">' +
    '<defs><symbol id="ring" viewBox="0 0 100 50">' +
    '<path id="outline" d="M0 0 H100 V50 H0 Z M25 10 H75 V40 H25 Z" fill-rule="evenodd"/>' +
    '</symbol></defs>' +
    '<use id="badge" href="#ring" x="10" y="20" width="100" height="100" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  expect(nodes.find((node) => node.id === 'badge--outline')).toMatchObject({
    type: 'path', parentId: undefined, x: 20, y: 90,
    scaleX: 2, scaleY: 2, fillRule: 'evenodd', extrude3d: 16,
  });
  await world.reset(api, nodes);
  const entity = api.getEntity(api.getNodeById('badge--outline'))!;
  expect(entity.read(Extrude3D).meshEntity?.read(Mesh3D).indices.length)
    .toBeGreaterThan(0);
});

it('clips symbol slice instances to their own viewport', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<defs><symbol id="sliced" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">' +
    '<rect id="partial" x="20" y="10" width="20" height="40"/>' +
    '<rect id="inside" x="60" y="40" width="10" height="10"/>' +
    '<rect id="outside" x="20" y="80" width="10" height="10"/>' +
    '</symbol></defs>' +
    '<use id="instance" href="#sliced" width="200" height="100" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  expect(nodes.find((node) => node.id === 'instance--partial')).toMatchObject({
    type: 'path', x: 40, y: 0, width: 40, height: 50,
    fillRule: 'evenodd', extrude3d: 16,
  });
  expect(nodes.find((node) => node.id === 'instance--inside')).toMatchObject({
    type: 'rect', parentId: 'instance--sliced',
    x: 60, y: 40, width: 10, height: 10, extrude3d: 16,
  });
  expect(nodes.find((node) => node.id === 'instance--outside'))
    .toMatchObject({ visibility: 'hidden' });
});

it('intersects root and symbol slice viewports', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" ' +
    'preserveAspectRatio="xMidYMid slice">' +
    '<defs><symbol id="sliced" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">' +
    '<rect id="full" width="100" height="100"/></symbol></defs>' +
    '<use id="instance" href="#sliced" x="50" width="100" height="100" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 16).find((node) => node.id === 'instance--full'))
    .toMatchObject({
      type: 'path', x: 50, y: 0, width: 50, height: 100,
      fillRule: 'evenodd', extrude3d: 16,
    });
});

it('clips a symbol slice viewport after the symbol transform', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<defs><symbol id="sliced" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" ' +
    'transform="translate(7 3)">' +
    '<rect id="edge" x="90" y="20" width="20" height="20"/></symbol></defs>' +
    '<use id="instance" href="#sliced" width="100" height="100" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 16).find((node) => node.id === 'instance--edge'))
    .toMatchObject({
      type: 'path', x: 97, y: 23, width: 10, height: 20,
      fillRule: 'evenodd', extrude3d: 16,
    });
});

it('skips symbols without an explicit viewport and retains siblings', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<defs><symbol id="badge" viewBox="0 0 100 50"><rect width="100" height="50"/></symbol></defs>' +
    '<use id="missing-size" href="#badge" fill="red"/>' +
    '<rect id="following" width="10" height="10" fill="green"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 16).map((node) => node.id))
    .toEqual(['following']);
});

it('maps an inline nested SVG viewBox without a use element', async () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<svg id="nested" x="20" y="30" width="200" height="100" ' +
    'viewBox="0 0 100 100" preserveAspectRatio="none" fill="red">' +
    '<path id="ring" d="M0 0 H100 V100 H0 Z M25 25 H75 V75 H25 Z" fill-rule="evenodd"/>' +
    '</svg></svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  const flat = svgElementsToSerializedNodes(Array.from(svg.children) as SVGElement[]);
  expect(flat.map((node) => node.id)).toEqual(nodes.map((node) => node.id));
  expect(nodes.find((node) => node.id === 'nested')).toMatchObject({
    type: 'g', x: 20, y: 30, scaleX: 2, scaleY: 1,
  });
  expect(nodes.find((node) => node.id === 'ring')).toMatchObject({
    type: 'path', parentId: 'nested',
    fillRule: 'evenodd', extrude3d: 16,
  });
  await world.reset(api, nodes);
  const ring = api.getEntity(api.getNodeById('ring'))!;
  const companion = ring.read(Extrude3D).meshEntity!;
  expect(companion.read(Mesh3D).indices.length)
    .toBeGreaterThan(0);
  const originalX = companion.read(Transform3D).translation[0];
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('nested'), { x: 70 }), 'NEVER');
  expect(ring.read(Extrude3D).meshEntity).toBe(companion);
  expect(companion.read(Transform3D).translation[0]).toBeCloseTo(originalX + 50);
});

it('expands repeated references to an SVG viewport with independent dimensions', async () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<defs><svg id="panel" x="5" y="7" width="100" height="50" viewBox="10 20 50 25">' +
    '<rect id="tile" x="10" y="20" width="50" height="25"/></svg></defs>' +
    '<use id="large" href="#panel" x="20" y="30" width="200" height="100" fill="red"/>' +
    '<use id="small" href="#panel" x="260" y="30" fill="blue"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  expect(nodes.find((node) => node.id === 'large--panel')).toMatchObject({
    type: 'g', parentId: 'large', x: -35, y: -73, scaleX: 4, scaleY: 4,
  });
  expect(nodes.find((node) => node.id === 'small--panel')).toMatchObject({
    type: 'g', parentId: 'small', x: -15, y: -33, scaleX: 2, scaleY: 2,
  });
  await world.reset(api, nodes);
  for (const id of ['large--tile', 'small--tile']) {
    const entity = api.getEntity(api.getNodeById(id))!;
    expect(entity.read(Extrude3D).meshEntity?.read(Mesh3D).indices.length)
      .toBeGreaterThan(0);
  }
  const largeColor = api.getEntity(api.getNodeById('large--tile'))!
    .read(Extrude3D).meshEntity!.read(Material3D).baseColor;
  const smallColor = api.getEntity(api.getNodeById('small--tile'))!
    .read(Extrude3D).meshEntity!.read(Material3D).baseColor;
  expect(largeColor.slice(0, 3)).toEqual([1, 0, 0]);
  expect(smallColor.slice(0, 3)).toEqual([0, 0, 1]);
});

it('keeps an inline SVG available to a later use reference', async () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<svg id="source" x="10" width="100" height="50" viewBox="0 0 100 50">' +
    '<rect id="tile" width="100" height="50" fill="red"/></svg>' +
    '<use id="copy" href="#source" x="150" width="200" height="100"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  expect(nodes.map((node) => node.id)).toEqual([
    'source', 'tile', 'copy', 'copy--source', 'copy--tile',
  ]);
  expect(nodes.find((node) => node.id === 'copy--source')).toMatchObject({
    type: 'g', parentId: 'copy', x: 10, y: 0, scaleX: 2, scaleY: 2,
  });
  await world.reset(api, nodes);
  for (const id of ['tile', 'copy--tile']) {
    const entity = api.getEntity(api.getNodeById(id))!;
    expect(entity.read(Extrude3D).meshEntity?.read(Mesh3D).indices.length)
      .toBeGreaterThan(0);
  }
});

it('clips a sliced nested SVG viewport after its offset', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<svg id="nested" x="30" y="20" width="100" height="100" ' +
    'viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">' +
    '<rect id="edge" x="80" y="20" width="40" height="20" fill="red"/>' +
    '</svg></svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 16).find((node) => node.id === 'edge'))
    .toMatchObject({
      type: 'path', x: 110, y: 40, width: 20, height: 20,
      fillRule: 'evenodd', extrude3d: 16,
    });
});

it('clips nested SVG overflow by default and honors visible overflow', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<svg id="clipped" width="100" height="100" viewBox="0 0 100 100" ' +
    'preserveAspectRatio="none">' +
    '<rect id="edge" x="80" y="20" width="40" height="20" fill="red"/></svg>' +
    '<svg id="visible" x="150" width="100" height="100" viewBox="0 0 100 100" ' +
    'preserveAspectRatio="none" overflow="hidden" style="overflow:visible">' +
    '<rect id="overhang" x="80" y="20" width="40" height="20" fill="blue"/></svg>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  expect(nodes.find((node) => node.id === 'edge')).toMatchObject({
    type: 'path', x: 80, y: 20, width: 20, height: 20,
    fillRule: 'evenodd', extrude3d: 16,
  });
  expect(nodes.find((node) => node.id === 'overhang')).toMatchObject({
    type: 'rect', parentId: 'visible', x: 80, y: 20,
    width: 40, height: 20, extrude3d: 16,
  });
});

it('clips an inline SVG and its later instance with separate inherited paints', async () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<g fill="blue"><svg id="card" x="20" y="35" width="180" height="180" ' +
    'viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">' +
    '<path id="shape" d="M0 0 H120 V100 H0 Z M30 25 H70 V75 H30 Z" fill-rule="evenodd"/>' +
    '</svg></g>' +
    '<use id="copy" href="#card" x="240" width="180" height="180" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  expect(nodes.find((node) => node.id === 'shape')).toMatchObject({
    type: 'path', x: 20, y: 35, width: 180, height: 180,
    fillRule: 'evenodd', extrude3d: 16,
  });
  expect(nodes.find((node) => node.id === 'copy--shape')).toMatchObject({
    type: 'path', x: 260, y: 35, width: 180, height: 180,
    fillRule: 'evenodd', extrude3d: 16,
  });
  await world.reset(api, nodes);
  const original = api.getEntity(api.getNodeById('shape'))!
    .read(Extrude3D).meshEntity!;
  const copy = api.getEntity(api.getNodeById('copy--shape'))!
    .read(Extrude3D).meshEntity!;
  expect(original.read(Mesh3D).indices.length).toBeGreaterThan(0);
  expect(copy.read(Mesh3D).indices.length).toBeGreaterThan(0);
  expect(original.read(Material3D).baseColor.slice(0, 3)).toEqual([0, 0, 1]);
  expect(copy.read(Material3D).baseColor.slice(0, 3)).toEqual([1, 0, 0]);
});

it('stops cyclic use references while retaining later SVG nodes', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<defs><g id="loop"><use href="#loop"/></g></defs>' +
    '<use id="cyclic" href="#loop"/>' +
    '<rect id="after-cycle" width="10" height="10" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 16);
  expect(nodes.find((node) => node.id === 'after-cycle'))
    .toMatchObject({ type: 'rect', extrude3d: 16 });
  expect(nodes.some((node) => node.type === 'path')).toBe(false);
});

it('preserves nested SVG skew and matrix shear on editable extrusion outlines', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<g id="group" fill="#ff0000" transform="skewX(45)">' +
    '<path id="sheared" d="M0 0 H10 V10 H0 Z"/>' +
    '<rect id="matrix" x="0" y="20" width="10" height="10" transform="matrix(1 0 .5 1 4 6)"/>' +
    '</g>' +
    '<g id="hidden" visibility="hidden" transform="skewX(20)">' +
    '<rect id="hidden-a" x="0" y="40" width="10" height="10" fill="red"/>' +
    '<rect id="hidden-b" x="20" y="40" width="10" height="10" fill="red"/>' +
    '</g></svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 20);
  const sheared = nodes.find((node) => node.id === 'sheared');
  const matrix = nodes.find((node) => node.id === 'matrix');
  expect(sheared).toMatchObject({
    type: 'path', parentId: undefined, x: 0, y: 0,
    width: 20, height: 10, extrude3d: 20,
    fills: [{ value: '#ff0000' }],
  });
  expect(sheared?.type === 'path' && sheared.d).toContain('L20 10');
  expect(matrix).toMatchObject({
    type: 'path', parentId: undefined, x: 40, y: 26,
    width: 25, height: 10, extrude3d: 20,
  });
  expect(nodes.find((node) => node.id === 'hidden-a')).toMatchObject({
    type: 'path', parentId: undefined, visibility: 'hidden',
  });
});

it('applies nonuniform viewBox scaling and still keeps unsupported strokes in 2D', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="100" preserveAspectRatio="none">' +
    '<ellipse id="oval" cx="20" cy="20" rx="10" ry="5" fill="red"/>' +
    '<path id="stroke" d="M0 0 H10 V10 H0 Z" fill="red" stroke="black"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 20);
  expect(nodes.find((node) => node.id === 'oval')).toMatchObject({
    type: 'path', x: 20, y: 15, width: 20, height: 10,
    scaleX: 2, scaleY: 1, extrude3d: 20,
  });
  expect(nodes.find((node) => node.id === 'stroke')).not.toHaveProperty('extrude3d');
});

it('applies root transforms after viewBox alignment', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="100" ' +
    'preserveAspectRatio="xMaxYMin meet" transform="translate(7 3)">' +
    '<path id="aligned" d="M0 0 H10 V10 H0 Z" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 20).find((node) => node.id === 'aligned'))
    .toMatchObject({ type: 'path', x: 207, y: 3, scaleX: 1, scaleY: 1 });
});

it('extrudes explicitly closed SVG polylines and leaves open or stroked ones in 2D', async () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<polyline id="closed" points="10,20 50,20 50,60 10,20" fill="red"/>' +
    '<polyline id="open" points="70,20 110,20 110,60" fill="blue"/>' +
    '<polyline id="stroked" points="130,20 170,20 170,60 130,20" fill="green" stroke="black"/>' +
    '<polyline id="invalid" points="0,0 bad,20 20,20 0,0" fill="purple"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 20);
  expect(nodes.find((node) => node.id === 'closed')).toMatchObject({
    type: 'path', x: 10, y: 20, width: 40, height: 40,
    d: 'M0 0 L40 0 L40 40 Z', fillRule: 'nonzero', extrude3d: 20,
  });
  expect(nodes.find((node) => node.id === 'open')).toMatchObject({ type: 'polyline' });
  expect(nodes.find((node) => node.id === 'stroked')).toMatchObject({ type: 'polyline' });
  expect(nodes.find((node) => node.id === 'invalid')).toMatchObject({ type: 'polyline' });
  await world.reset(api, [nodes.find((node) => node.id === 'closed')!]);
  const entity = api.getEntity(api.getNodeById('closed'))!;
  expect(entity.read(Extrude3D).meshEntity?.read(Mesh3D).indices.length)
    .toBeGreaterThan(0);
});

it('clips a closed SVG polyline after viewBox and group transforms', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 100 100" ' +
    'preserveAspectRatio="xMidYMid slice">' +
    '<g fill="red" transform="translate(10 0)">' +
    '<polyline id="clipped-polyline" points="10,10 70,10 70,90 10,90 10,10"/>' +
    '</g></svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const node = svgElementsToExtrudedNodes(svg, 20)
    .find((item) => item.id === 'clipped-polyline');
  expect(node).toMatchObject({
    type: 'path', x: 40, y: 0, width: 120, height: 100,
    fillRule: 'evenodd', extrude3d: 20,
    fills: [{ value: 'red' }],
  });
});

it('clips slice extrusions to the viewport while preserving fully contained shapes', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="100" ' +
    'preserveAspectRatio="xMidYMid slice">' +
    '<rect id="partial" x="20" y="10" width="20" height="40" fill="red"/>' +
    '<rect id="inside" x="60" y="40" width="10" height="10" fill="blue"/>' +
    '<rect id="outside" x="20" y="80" width="10" height="10" fill="green"/>' +
    '<ellipse id="curved" cx="50" cy="75" rx="10" ry="20" fill="purple"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 20);
  expect(nodes.find((node) => node.id === 'partial')).toMatchObject({
    type: 'path', x: 40, y: 0, width: 40, height: 50,
    fillRule: 'evenodd', extrude3d: 20,
  });
  expect(nodes.find((node) => node.id === 'inside')).toMatchObject({
    type: 'rect', x: 120, y: 30, width: 10, height: 10,
    scaleX: 2, scaleY: 2, extrude3d: 20,
  });
  expect(nodes.find((node) => node.id === 'outside')).toMatchObject({
    visibility: 'hidden',
  });
  expect(nodes.find((node) => node.id === 'outside')).not.toHaveProperty('extrude3d', 20);
  const curved = nodes.find((node) => node.id === 'curved');
  expect(curved).toMatchObject({ type: 'path', fillRule: 'evenodd', extrude3d: 20 });
  expect(curved?.type === 'path' && curved.d.split('L').length).toBeGreaterThan(8);
  expect(curved?.y).toBeCloseTo(60);
  expect(curved?.height).toBeCloseTo(40);
});

it('clips an identity-scale slice within a transformed root viewport', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" ' +
    'preserveAspectRatio="xMidYMid slice" transform="translate(7 3)">' +
    '<rect id="edge" x="90" y="20" width="20" height="20" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 20).find((node) => node.id === 'edge'))
    .toMatchObject({
      type: 'path', x: 97, y: 23, width: 10, height: 20,
      fillRule: 'evenodd', extrude3d: 20,
    });
});

it('clips a slice viewport reflected by the root transform', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" ' +
    'preserveAspectRatio="xMidYMid slice" transform="scale(-1 1)">' +
    '<rect id="reflected-edge" x="90" y="20" width="20" height="20" fill="red"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 20).find((node) => node.id === 'reflected-edge'))
    .toMatchObject({
      type: 'path', x: -100, y: 20, width: 10, height: 20,
      fillRule: 'evenodd', extrude3d: 20,
    });
});

it('imports rotated SVG rectangles with their original center and dimensions', () => {
  const dom = new JSDOM(
    `<svg xmlns="http://www.w3.org/2000/svg">
      <rect id="rotated" x="10" y="20" width="40" height="30"
        transform="rotate(30 30 35)" fill="red"/>
    </svg>`,
    { contentType: 'image/svg+xml' },
  );
  const nodes = svgElementsToExtrudedNodes(
    Array.from(
      dom.window.document.querySelector('svg')!.children,
    ) as SVGElement[],
    24,
  );
  const node = nodes.find((item) => item.id === 'rotated')!;
  expect(node).toMatchObject({
    type: 'rect',
    width: 40,
    height: 30,
    extrude3d: 24,
  });
  expect(node.rotation).toBeCloseTo(Math.PI / 6);
  expect(
    node.x + Math.cos(node.rotation!) * 20 - Math.sin(node.rotation!) * 15,
  ).toBeCloseTo(30);
  expect(
    node.y + Math.sin(node.rotation!) * 20 + Math.cos(node.rotation!) * 15,
  ).toBeCloseTo(35);
});

it('preserves independent SVG rect radii when creating extrusion paths', () => {
  const dom = new JSDOM(
    `<svg xmlns="http://www.w3.org/2000/svg">
      <rect id="unequal" width="60" height="40" rx="12" ry="6" fill="red"/>
      <rect id="rx-only" width="60" height="40" rx="8" fill="red"/>
      <rect id="ry-only" width="60" height="40" ry="8" fill="red"/>
      <rect id="clamped" width="60" height="40" rx="50" ry="30" fill="red"/>
      <rect id="square" width="60" height="40" rx="12" ry="0" fill="red"/>
    </svg>`,
    { contentType: 'image/svg+xml' },
  );
  const input = Array.from(dom.window.document.querySelector('svg')!.children);
  const nodes = svgElementsToExtrudedNodes(input as SVGElement[], 24);
  const path = (id: string) => {
    const node = nodes.find((item) => item.id === id);
    expect(node).toMatchObject({ type: 'path', extrude3d: 24 });
    return node?.type === 'path' ? node.d : '';
  };

  expect(path('unequal')).toContain('M12 0 H48 A12 6 0 0 1 60 6');
  expect(path('rx-only')).toContain('A8 8 0 0 1');
  expect(path('ry-only')).toContain('A8 8 0 0 1');
  expect(path('clamped')).toContain('M30 0 H30 A30 20 0 0 1 60 20');
  expect(nodes.find((node) => node.id === 'square')).toMatchObject({
    type: 'rect',
    cornerRadius: 0,
    extrude3d: 24,
  });
});

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

it('imports inline paint declarations with priority over presentation attributes', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
    <path id="styled" d="M0 0 H20 V20 H0 Z" fill="none" style="fill: #2563eb; fill-opacity: .4; fill-rule: evenodd"/>
    <path id="outlined" d="M30 0 H50 V20 H30 Z" fill="red" stroke="none" style="stroke: #111; stroke-width: 3"/>
    <g id="painted-group" style="fill: #22c55e; stroke: none">
      <rect id="inherited" x="60" width="20" height="20"/>
      <rect id="own-paint" x="90" width="20" height="20" style="fill: #f97316"/>
    </g>
    <g id="single-override" fill="red">
      <path id="single-path" d="M120 0 H140 V20 H120 Z" style="fill: blue"/>
    </g>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const before = svg.outerHTML;
  const nodes = svgElementsToExtrudedNodes(svg, 18);
  expect(nodes.find((node) => node.id === 'styled')).toMatchObject({
    extrude3d: 18, fillRule: 'evenodd',
    fills: [{ type: 'solid', value: '#2563eb', opacity: 0.4 }],
  });
  expect(nodes.find((node) => node.id === 'outlined')).not.toHaveProperty('extrude3d');
  expect(nodes.find((node) => node.id === 'outlined')).toMatchObject({
    strokeWidth: 3, strokes: [{ type: 'solid', value: '#111' }],
  });
  expect(nodes.find((node) => node.id === 'inherited')).toMatchObject({ extrude3d: 18 });
  expect(nodes.find((node) => node.id === 'own-paint')).toMatchObject({
    extrude3d: 18, fills: [{ type: 'solid', value: '#f97316' }],
  });
  expect(nodes.find((node) => node.id === 'single-override')).toMatchObject({
    extrude3d: 18, fills: [{ type: 'solid', value: 'blue' }],
  });
  expect(svg.outerHTML).toBe(before);
});

it('resolves currentColor from the SVG root, groups, and independent use instances', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg" color="#111111" style="color: #a855f7">
    <path id="root-color" d="M0 0 H20 V20 H0 Z" fill="currentColor"/>
    <g id="group" color="#0ea5e9">
      <path id="group-color" d="M30 0 H50 V20 H30 Z" style="fill: currentColor"/>
    </g>
    <defs><path id="tile" d="M0 0 H20 V20 H0 Z" fill="currentColor"/></defs>
    <use id="first-colored" href="#tile" x="60" style="color: #ef4444"/>
    <use id="second-colored" href="#tile" x="90" color="#22c55e"/>
    <path id="outlined-color" d="M120 0 H140 V20 H120 Z" fill="red" stroke="currentColor"/>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 18);
  const fill = (id: string) => (nodes.find((node) => node.id === id) as { fills?: { value: string }[] })?.fills?.[0]?.value;
  expect(fill('root-color')).toBe('rgb(168, 85, 247)');
  expect(fill('group')).toBe('#0ea5e9');
  expect(fill('first-colored--tile')).toBe('rgb(239, 68, 68)');
  expect(fill('second-colored--tile')).toBe('#22c55e');
  expect(nodes.find((node) => node.id === 'outlined-color')).toMatchObject({
    strokes: [{ type: 'solid', value: 'rgb(168, 85, 247)' }],
  });
  expect(nodes.find((node) => node.id === 'outlined-color')).not.toHaveProperty('extrude3d');
  const flat = svgElementsToSerializedNodes(Array.from(svg.children) as SVGElement[]);
  expect((flat.find((node) => node.id === 'root-color') as { fills?: { value: string }[] }).fills?.[0]?.value)
    .toBe('rgb(168, 85, 247)');
  expect((flat.find((node) => node.id === 'first-colored--tile') as { fills?: { value: string }[] }).fills?.[0]?.value)
    .toBe('rgb(239, 68, 68)');
});

it('uses SVG currentColor black when no color is declared', () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg"><path id="black" d="M0 0 H20 V20 H0 Z" fill="currentColor"/></svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 12).find((node) => node.id === 'black'))
    .toMatchObject({ extrude3d: 12, fills: [{ type: 'solid', value: '#000000' }] });
});

it('clips an extrusion with a local SVG clipPath while retaining holes', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="window"><rect x="10" y="0" width="60" height="60"/></clipPath></defs>
    <path id="clipped-ring" d="M0 0 H80 V80 H0 Z M20 20 H50 V50 H20 Z"
      fill="red" fill-rule="evenodd" clip-path="url(#window)"/>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const node = svgElementsToExtrudedNodes(svg, 16).find((item) => item.id === 'clipped-ring');
  expect(node).toMatchObject({
    type: 'path', x: 10, y: 0, width: 60, height: 60,
    fillRule: 'evenodd', extrude3d: 16,
  });
  expect(node?.type === 'path' && node.d.match(/M/g)?.length).toBe(2);
});

it('unites clipPath shapes and applies a group clip in transformed user space', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="pair">
      <rect x="10" width="20" height="40"/>
      <rect x="50" width="20" height="40"/>
    </clipPath></defs>
    <g id="shifted" transform="translate(100 25)" style="clip-path: url(#pair)">
      <path id="two-islands" d="M0 0 H80 V40 H0 Z" fill="blue"/>
      <rect id="other" x="120" width="10" height="10" fill="green"/>
    </g>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 12);
  const island = nodes.find((node) => node.id === 'two-islands');
  expect(island).toMatchObject({
    type: 'path', x: 110, y: 25, width: 60, height: 40,
    fillRule: 'evenodd', extrude3d: 12,
  });
  expect(island?.type === 'path' && island.d.match(/M/g)?.length).toBe(2);
  expect(nodes.find((node) => node.id === 'other')).toMatchObject({
    visibility: 'hidden', extrude3d: undefined,
  });
});

it('applies objectBoundingBox clips to shapes and keeps unresolved clips in 2D', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="center" clipPathUnits="objectBoundingBox">
      <rect x="0.25" y="0.25" width="0.5" height="0.5"/>
    </clipPath>
    <clipPath id="percentage" clipPathUnits="objectBoundingBox">
      <rect x="25%" y="25%" width="50%" height="50%"/>
    </clipPath>
    <clipPath id="mixed" clipPathUnits="objectBoundingBox">
      <rect x="0.1" width="0.2" height="1"/>
      <circle cx="0.75" cy="0.5" r="0.2"/>
    </clipPath></defs>
    <rect id="bounded" x="20" y="30" width="100" height="80" fill="red" clip-path="url(#center)"/>
    <rect id="percentage-bounded" x="20" y="30" width="100" height="80" fill="red" clip-path="url(#percentage)"/>
    <rect id="mixed-bounded" x="20" y="30" width="100" height="80" fill="red" clip-path="url(#mixed)"/>
    <rect id="unresolved" x="150" y="30" width="20" height="20" fill="red" clip-path="url(#missing)"/>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 20);
  expect(nodes.find((node) => node.id === 'bounded')).toMatchObject({
    type: 'path', x: 45, y: 50, width: 50, height: 40, extrude3d: 20,
  });
  expect(nodes.find((node) => node.id === 'percentage-bounded')).toMatchObject({
    type: 'path', x: 45, y: 50, width: 50, height: 40, extrude3d: 20,
  });
  const mixed = nodes.find((node) => node.id === 'mixed-bounded');
  expect(mixed).toMatchObject({ type: 'path', extrude3d: 20 });
  expect(mixed?.type === 'path' && mixed.d.match(/M/g)?.length).toBe(2);
  expect(nodes.find((node) => node.id === 'unresolved')).not.toHaveProperty('extrude3d', 20);
});

it('uses a transformed group bounding box for objectBoundingBox clips', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="middle" clipPathUnits="objectBoundingBox">
      <rect x="20%" width="60%" height="1"/>
    </clipPath></defs>
    <g id="group" transform="translate(100 20)" clip-path="url(#middle)">
      <rect id="left" x="10" y="10" width="50" height="40" fill="red"/>
      <g transform="translate(5 0)">
        <rect id="right" x="70" y="10" width="40" height="40" fill="blue"/>
      </g>
    </g>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 12);
  expect(nodes.find((node) => node.id === 'left')).toMatchObject({
    type: 'path', x: 131, y: 30, width: 29, height: 40, extrude3d: 12,
  });
  expect(nodes.find((node) => node.id === 'right')).toMatchObject({
    type: 'path', x: 175, y: 30, height: 40, extrude3d: 12,
  });
  expect(nodes.find((node) => node.id === 'right')?.width).toBeCloseTo(19);
});

it('measures a path bounding box for a direct objectBoundingBox clip', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="half" clipPathUnits="objectBoundingBox">
      <rect width="50%" height="1"/>
    </clipPath></defs>
    <path id="triangle" d="M10 10 H110 L60 90 Z" fill="red"
      clip-path="url(#half)"/>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 12).find((node) => node.id === 'triangle'))
    .toMatchObject({ type: 'path', x: 10, y: 10, width: 50, height: 80, extrude3d: 12 });
});

it('clips repeated group instances using each instance bounding box', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
    <defs>
      <g id="pair"><rect id="tile" width="40" height="30"/></g>
      <clipPath id="half" clipPathUnits="objectBoundingBox">
        <rect width="0.5" height="1"/>
      </clipPath>
    </defs>
    <use id="first" href="#pair" x="10" fill="red" clip-path="url(#half)"/>
    <use id="second" href="#pair" x="100" fill="blue" clip-path="url(#half)"/>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 12);
  expect(nodes.find((node) => node.id === 'first--tile')).toMatchObject({
    type: 'path', x: 10, y: 0, width: 20, height: 30, extrude3d: 12,
  });
  expect(nodes.find((node) => node.id === 'second--tile')).toMatchObject({
    type: 'path', x: 100, y: 0, width: 20, height: 30, extrude3d: 12,
  });
});

it('resolves local use shapes within clipPath and rejects cyclic definitions', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
    <defs>
      <g id="window"><rect width="20" height="30"/></g>
      <use id="window-alias" href="#window"/>
      <clipPath id="pair"><use href="#window-alias" x="10"/>
        <use href="#window" x="50" transform="translate(5 0)"/></clipPath>
      <use id="cycle-a" href="#cycle-b"/>
      <use id="cycle-b" href="#cycle-a"/>
      <clipPath id="cycle"><use href="#cycle-a"/></clipPath>
    </defs>
    <rect id="cut" width="80" height="30" fill="red" clip-path="url(#pair)"/>
    <rect id="fallback" x="100" width="40" height="30" fill="blue"
      clip-path="url(#cycle)"/>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 12);
  const cut = nodes.find((node) => node.id === 'cut');
  expect(cut).toMatchObject({ type: 'path', x: 10, y: 0, width: 65, height: 30,
    extrude3d: 12 });
  expect(cut?.type === 'path' && cut.d.match(/M/g)?.length).toBe(2);
  expect(nodes.find((node) => node.id === 'fallback')).not.toHaveProperty('extrude3d', 12);
});

it('keeps an evenodd hole in a clipPath and clips repeated use instances independently', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
    <defs>
      <path id="tile" d="M0 0 H80 V80 H0 Z" fill="red"/>
      <clipPath id="ring-clip">
        <path d="M0 0 H60 V60 H0 Z M20 20 H40 V40 H20 Z" clip-rule="evenodd"/>
      </clipPath>
    </defs>
    <use id="first-cut" href="#tile" x="10" y="15" clip-path="url(#ring-clip)"/>
    <use id="second-cut" href="#tile" x="110" y="15" style="clip-path: url(#ring-clip)"/>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const before = svg.outerHTML;
  const nodes = svgElementsToExtrudedNodes(svg, 14);
  for (const [id, x] of [['first-cut--tile', 10], ['second-cut--tile', 110]] as const) {
    const node = nodes.find((item) => item.id === id);
    expect(node).toMatchObject({
      type: 'path', x, y: 15, width: 60, height: 60,
      fillRule: 'evenodd', extrude3d: 14,
    });
    expect(node?.type === 'path' && node.d.match(/M/g)?.length).toBe(2);
  }
  expect(svg.outerHTML).toBe(before);
});

it('intersects a clipPath with a sliced root viewBox', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg"
    width="100" height="100" viewBox="0 0 100 50" preserveAspectRatio="xMidYMid slice">
    <defs><clipPath id="band"><rect x="30" y="0" width="40" height="50"/></clipPath></defs>
    <path id="slice-and-clip" d="M0 0 H100 V50 H0 Z" fill="red" clip-path="url(#band)"/>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 14).find((node) => node.id === 'slice-and-clip'))
    .toMatchObject({ type: 'path', x: 10, y: 0, width: 80, height: 100, extrude3d: 14 });
});

it('inherits clip-rule and visibility through clipPath groups', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="grouped-clip">
      <g clip-rule="evenodd">
        <path d="M0 0 H80 V80 H0 Z M20 20 H60 V60 H20 Z"/>
      </g>
      <g visibility="hidden">
        <rect x="90" width="20" height="20"/>
      </g>
    </clipPath></defs>
    <path id="group-cut" d="M0 0 H120 V80 H0 Z" fill="red" clip-path="url(#grouped-clip)"/>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const node = svgElementsToExtrudedNodes(svg, 12).find((item) => item.id === 'group-cut');
  expect(node).toMatchObject({
    type: 'path', x: 0, y: 0, width: 80, height: 80,
    fillRule: 'evenodd', extrude3d: 12,
  });
  expect(node?.type === 'path' && node.d.match(/M/g)?.length).toBe(2);
});

it('composes transforms inside clipPath definitions', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="moved-clip" transform="translate(5 0)">
      <g transform="translate(10 0)"><rect width="20" height="20"/></g>
    </clipPath></defs>
    <path id="moved-cut" d="M0 0 H80 V30 H0 Z" fill="red" clip-path="url(#moved-clip)"/>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 12).find((node) => node.id === 'moved-cut'))
    .toMatchObject({ type: 'path', x: 15, y: 0, width: 20, height: 20, extrude3d: 12 });
});

it('keeps editable group membership when a clipPath fully contains a shape', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="wide"><rect x="-10" y="-10" width="100" height="100"/></clipPath></defs>
    <g id="clipped-group" clip-path="url(#wide)">
      <rect id="inside-rect" x="10" y="10" width="20" height="20" fill="red"/>
      <rect id="inside-other" x="40" y="10" width="20" height="20" fill="blue"/>
    </g>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  expect(svgElementsToExtrudedNodes(svg, 12).find((node) => node.id === 'inside-rect'))
    .toMatchObject({ type: 'rect', parentId: 'clipped-group', extrude3d: 12 });
});

it('does not extrude hidden SVG nodes and allows visibility overrides', () => {
  const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
    <rect id="display-none" width="20" height="20" fill="red" style="display: none"/>
    <g id="hidden-group" visibility="hidden">
      <rect id="still-hidden" x="30" width="20" height="20" fill="red"/>
      <rect id="visible-override" x="60" width="20" height="20" fill="red" style="visibility: visible"/>
    </g>
    <rect id="masked" x="90" width="20" height="20" fill="red" mask="url(#mask)"/>
    <rect id="filtered" x="120" width="20" height="20" fill="red" style="filter: url(#blur)"/>
    <rect id="paint-server" x="150" width="20" height="20" fill="url(#pattern)"/>
  </svg>`, { contentType: 'image/svg+xml' });
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 12);
  expect(nodes.find((node) => node.id === 'display-none')).toMatchObject({ visibility: 'hidden' });
  expect(nodes.find((node) => node.id === 'display-none')).not.toHaveProperty('extrude3d', 12);
  expect(nodes.find((node) => node.id === 'still-hidden')).toMatchObject({ visibility: 'hidden' });
  expect(nodes.find((node) => node.id === 'still-hidden')).not.toHaveProperty('extrude3d', 12);
  expect(nodes.find((node) => node.id === 'visible-override')).toMatchObject({ extrude3d: 12 });
  for (const id of ['masked', 'filtered', 'paint-server'])
    expect(nodes.find((node) => node.id === id)).not.toHaveProperty('extrude3d', 12);
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

it('extrudes slice-clipped holes and disconnected pieces', async () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="100" ' +
    'preserveAspectRatio="xMidYMid slice">' +
    '<path id="ring-slice" fill="red" fill-rule="evenodd" d="M10 10 H90 V90 H10 Z M30 30 H70 V70 H30 Z"/>' +
    '<path id="split-slice" fill="blue" d="M10 0 H90 V90 H70 V20 H30 V90 H10 Z"/>' +
    '<path id="duplicate-slice" fill="green" d="M10 10 H90 V90 H10 Z M10 10 H90 V90 H10 Z"/>' +
    '</svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 20);
  const ring = nodes.find((node) => node.id === 'ring-slice');
  const split = nodes.find((node) => node.id === 'split-slice');
  const duplicate = nodes.find((node) => node.id === 'duplicate-slice');
  expect(ring).toMatchObject({ type: 'path', fillRule: 'evenodd', extrude3d: 20 });
  expect(split).toMatchObject({ type: 'path', fillRule: 'evenodd', extrude3d: 20 });
  expect(duplicate).toMatchObject({ type: 'path', fillRule: 'evenodd', extrude3d: 20 });
  expect(ring?.type === 'path' && ring.d.match(/M/g)).toHaveLength(2);
  expect(split?.type === 'path' && split.d.match(/M/g)).toHaveLength(2);
  await world.reset(api, nodes);
  for (const id of ['ring-slice', 'split-slice', 'duplicate-slice']) {
    const entity = api.getEntity(api.getNodeById(id))!;
    expect(entity.read(Extrude3D).meshEntity?.read(Mesh3D).indices.length)
      .toBeGreaterThan(0);
  }
});

it('builds a 3D companion for a sheared SVG path with an evenodd hole', async () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="100">' +
    '<g transform="skewY(12)" fill="#3366cc">' +
    '<path id="sheared-ring" fill-rule="evenodd" d="M10 10 H70 V70 H10 Z M25 25 H55 V55 H25 Z"/>' +
    '</g></svg>',
    { contentType: 'image/svg+xml' },
  );
  const svg = dom.window.document.documentElement as unknown as SVGSVGElement;
  const nodes = svgElementsToExtrudedNodes(svg, 18);
  const ring = nodes.find((node) => node.id === 'sheared-ring');
  expect(ring).toMatchObject({
    type: 'path', fillRule: 'evenodd', parentId: undefined, extrude3d: 18,
  });
  expect(ring?.type === 'path' && ring.d.match(/M/g)).toHaveLength(2);
  await world.reset(api, nodes);
  const entity = api.getEntity(api.getNodeById('sheared-ring'))!;
  expect(entity.read(Extrude3D).meshEntity?.read(Mesh3D).indices.length)
    .toBeGreaterThan(0);
});

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

it('bevels supported SVG contours, including a holed ring', async () => {
  const nodes = svgElementsToExtrudedNodes(elements(), 24).map((node) =>
    (node.type === 'path' || node.type === 'rect') && node.extrude3d
      ? { ...node, extrude3d: { depth: 24, bevelSize: 2 } }
      : node,
  );
  await world.reset(api, nodes);
  const normalZ = (id: string) => {
    const source = api.getEntity(api.getNodeById(id))!;
    return source
      .read(Extrude3D)
      .meshEntity!.read(Mesh3D)
      .normals.filter((_, i) => i % 3 === 2);
  };
  for (const id of ['ring', 'circle', 'box']) {
    expect(
      [...normalZ(id)].some(
        (value) => Math.abs(value) > 0 && Math.abs(value) < 1,
      ),
    ).toBe(true);
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
    'No ready 3D meshes to export',
  );
});
