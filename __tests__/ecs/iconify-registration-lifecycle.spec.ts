import {
  Ellipse,
  FillLayers,
  Path,
  ThemeMode,
  type IconFontSerializedNode,
  type SerializedNode,
} from '../../packages/ecs/src';
import {
  buildIconFontScalablePrimitives,
  getRegisteredIconifyIconNames,
  registerIconifyIconSet,
  resolveIconFontWireStyle,
  unregisterIconifyIconSet,
} from '../../packages/ecs/src/utils/icon-font';
import { createDocumentWorld } from '../helpers/ecs-document';

const family = 'quote-shapes-test';

afterEach(() => unregisterIconifyIconSet(family));

it('uses the theme color but keeps an explicit zero-width icon stroke', () => {
  const node = {
    id: 'themed-icon',
    type: 'iconfont',
    fills: [{ type: 'solid', value: '$icon-color' }],
    strokeWidth: 0,
  } as IconFontSerializedNode;
  const variables = {
    'icon-color': {
      type: 'color' as const,
      value: [
        { value: '#ff0000', theme: { Mode: 'Light' } },
        { value: '#00ff00', theme: { Mode: 'Dark' } },
      ],
    },
  };
  const group = { fill: '#ffffff', stroke: '#0000ff', strokeWidth: 6 };
  expect(
    resolveIconFontWireStyle(node, variables, ThemeMode.LIGHT, group),
  ).toEqual({ userColorFill: '#ff0000', userColorStroke: '#0000ff', rSw: 0 });
  expect(
    resolveIconFontWireStyle(node, variables, ThemeMode.DARK, group),
  ).toEqual({ userColorFill: '#00ff00', userColorStroke: '#0000ff', rSw: 0 });
});

it('replaces cached bodies and resolves explicit family and normalized icon names', () => {
  registerIconifyIconSet(family, {
    default: {
      width: 10,
      height: 10,
      icons: {
        box: { body: '<path d="M0 0H10V10H0Z" fill="red"/>' },
        zeta: { body: '<path d="M0 0H5V5H0Z" fill="red"/>' },
      },
    },
  });
  expect(getRegisteredIconifyIconNames(family.toUpperCase())).toEqual([
    'box',
    'zeta',
  ]);
  const first = buildIconFontScalablePrimitives(
    `${family}:BoxIcon`,
    'other-family',
    20,
    20,
  );
  expect(first?.[0]).toMatchObject({ kind: 'path', style: { fill: 'red' } });
  expect(buildIconFontScalablePrimitives('new', family, 20, 20)).toBeNull();

  registerIconifyIconSet(family, {
    width: 10,
    height: 10,
    icons: {
      box: { body: '<path d="M0 0H5V5H0Z" fill="blue"/>' },
      new: { body: '<path d="M0 0H10V10H0Z" fill="green"/>' },
    },
  });
  const replaced = buildIconFontScalablePrimitives('BoxIcon', family, 20, 20);
  expect(replaced?.[0]).toMatchObject({
    kind: 'path',
    style: { fill: 'blue' },
  });
  expect(replaced?.[0]).not.toEqual(first?.[0]);
  expect(
    buildIconFontScalablePrimitives('new', family, 20, 20)?.[0]?.style.fill,
  ).toBe('green');

  unregisterIconifyIconSet(family);
  expect(buildIconFontScalablePrimitives('box', family, 20, 20)).toBeNull();
  expect(getRegisteredIconifyIconNames(family)).toEqual([]);
});

it('materializes single-quoted paired SVG shapes as icon child entities', async () => {
  registerIconifyIconSet(family, {
    width: 20,
    height: 20,
    icons: {
      mixed: {
        body:
          "<g fill='red'><path d='M0 0H10V10H0Z'></path>" +
          "<g fill='blue'><rect x='10' y='0' width='10' height='10'></rect></g>" +
          "<circle cx='5' cy='15' r='2'></circle></g>",
      },
    },
  });
  const world = await createDocumentWorld();
  try {
    const [api] = world.apis;
    await world.reset(api, [
      {
        id: 'mixed',
        type: 'iconfont',
        iconFontName: 'mixed',
        iconFontFamily: family,
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        zIndex: 0,
      } as SerializedNode,
    ]);
    const children = api.getChildren(api.getNodeById('mixed'));
    expect(children).toHaveLength(3);
    expect(children[0]!.has(Path)).toBe(true);
    expect(children[1]!.has(Path)).toBe(true);
    expect(children[2]!.has(Ellipse)).toBe(true);
    expect(
      children.map((child) => child.read(FillLayers).layers[0]?.value),
    ).toEqual(['red', 'blue', 'red']);
  } finally {
    await world.dispose();
  }
});
