import { JSDOM } from 'jsdom';
import { importExtrudedSvg } from '../../packages/app/lib/import-extruded-svg';

const parser = new JSDOM('').window.DOMParser;

beforeAll(() => {
  Object.defineProperty(globalThis, 'DOMParser', {
    value: parser,
    configurable: true,
  });
});

afterAll(() => {
  Reflect.deleteProperty(globalThis, 'DOMParser');
});

it('centers imported artwork and retains editable extrusion groups with fresh IDs', () => {
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"
    viewBox="0 0 200 100"><g id="pair" fill="red">
    <rect id="solid" x="20" y="10" width="40" height="40"/>
    <path id="open" d="M80 10 L120 40" fill="none" stroke="blue"/>
    </g></svg>`;
  const first = importExtrudedSvg(source, 24, { x: 500, y: 300 });
  const second = importExtrudedSvg(source, 24, { x: 500, y: 300 });
  const group = first.find((node) => node.type === 'g')!;
  const solid = first.find((node) => node.type === 'rect')!;
  const open = first.find((node) => node.type === 'path')!;
  expect(group.x).toBeCloseTo(430, 0);
  expect(group.y).toBeCloseTo(270, 0);
  expect(solid).toMatchObject({ parentId: group.id, extrude3d: 24 });
  expect(open).toMatchObject({
    parentId: group.id, fillRule: 'evenodd',
    fills: [{ type: 'solid', value: 'blue' }],
    extrude3d: 24,
  });
  expect(new Set(first.map((node) => node.id)).size).toBe(first.length);
  expect(first[0].id).not.toBe(second[0].id);
});

it('centers a sparse SVG by its nested and rotated artwork', () => {
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">
    <g id="outer" transform="translate(200 100)">
      <g id="turned" transform="rotate(90)">
        <rect id="solid" x="10" y="0" width="20" height="10" fill="red"/>
      </g>
      <rect id="hidden" x="900" y="900" width="20" height="20"
        fill="red" visibility="hidden"/>
    </g>
  </svg>`;
  const nodes = importExtrudedSvg(source, 24, { x: 500, y: 300 });
  expect(
    nodes.find((node) => node.type === 'rect' && node.extrude3d),
  ).toMatchObject({ x: 505, y: 290, rotation: Math.PI / 2, extrude3d: 24 });
  expect(nodes.find((node) => node.visibility === 'hidden')).not.toHaveProperty(
    'extrude3d',
    24,
  );
});

it('rejects invalid SVG and empty importable documents', () => {
  expect(() =>
    importExtrudedSvg('<svg><path></svg>', 20, { x: 0, y: 0 }),
  ).toThrow('Invalid SVG file');
  expect(() =>
    importExtrudedSvg('<svg xmlns="http://www.w3.org/2000/svg"/>', 20, {
      x: 0,
      y: 0,
    }),
  ).toThrow('SVG has no importable shapes');
});
