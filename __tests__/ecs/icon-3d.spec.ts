import {
  iconFontToExtrudedPaths,
  canExtrudePath,
  registerIconifyIconSet,
  unregisterIconifyIconSet,
} from '../../packages/ecs/src';
import { buildPathExtrusionMesh } from '../../packages/ecs/src/utils/path-extrusion-mesh';
import { inferXYWidthHeight } from '../../packages/ecs/src/utils/deserialize/entity';

afterEach(() => unregisterIconifyIconSet('icon-3d-test'));

it('turns a round capped stroke into an extrudable editable outline', () => {
  registerIconifyIconSet('icon-3d-test', {
    width: 24,
    height: 24,
    icons: {
      stroke: {
        body: '<path d="M2 2 L22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />',
      },
    },
  });
  const converted = iconFontToExtrudedPaths(
    {
      id: 'icon',
      type: 'iconfont',
      iconFontName: 'stroke',
      iconFontFamily: 'icon-3d-test',
      x: 25,
      y: 50,
      width: 48,
      height: 48,
      stroke: '#ff0000',
    },
    { depth: 30, metallic: 1, roughness: 0.25 },
  );
  expect(converted?.group.x).toBe(25);
  expect(converted?.paths).toHaveLength(1);
  expect(converted?.paths[0].fills).toEqual([
    { type: 'solid', value: '#ff0000' },
  ]);
  expect(converted?.paths[0].extrude3d).toMatchObject({
    depth: 30,
    metallic: 1,
    roughness: 0.25,
  });
  expect(buildPathExtrusionMesh(converted!.paths[0].d!)).toBeDefined();
  expect(
    canExtrudePath(converted!.paths[0], [
      converted!.group,
      ...converted!.paths,
    ]),
  ).toBe(true);
  const path = { ...converted!.paths[0] };
  inferXYWidthHeight(path);
  expect(path.x).toBeGreaterThan(0);
  expect(path.width).toBeLessThan(48);
});

it('retains a filled icon with a hole', () => {
  registerIconifyIconSet('icon-3d-test', {
    width: 24,
    height: 24,
    icons: {
      ring: {
        body: '<path d="M0 0 H24 V24 H0 Z M6 6 H18 V18 H6 Z" fill="currentColor" fill-rule="evenodd" />',
      },
    },
  });
  const converted = iconFontToExtrudedPaths(
    {
      id: 'ring',
      type: 'iconfont',
      iconFontName: 'ring',
      iconFontFamily: 'icon-3d-test',
      width: 24,
      height: 24,
      fill: '#00ff00',
    },
    { depth: 10 },
  );
  expect(converted?.paths).toHaveLength(1);
  expect(converted?.paths[0].fillRule).toBe('evenodd');
  expect(
    buildPathExtrusionMesh(converted!.paths[0].d!, 'evenodd'),
  ).toBeDefined();
});

it('expands mixed Lucide-style strokes and retains their group transform', () => {
  registerIconifyIconSet('icon-3d-test', {
    width: 24,
    height: 24,
    icons: {
      search: {
        body: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></g>',
      },
    },
  });
  const converted = iconFontToExtrudedPaths(
    {
      id: 'search',
      type: 'iconfont',
      iconFontName: 'search',
      iconFontFamily: 'icon-3d-test',
      x: 80,
      y: 35,
      width: 48,
      height: 48,
      rotation: 0.4,
      scaleX: -1,
      stroke: '#3366ff',
    },
    { depth: 18 },
  );
  expect(converted?.group).toMatchObject({
    x: 80,
    y: 35,
    rotation: 0.4,
    scaleX: -1,
  });
  expect(converted?.paths).toHaveLength(2);
  for (const path of converted!.paths) {
    expect(path.parentId).toBe(converted!.group.id);
    expect(buildPathExtrusionMesh(path.d!, path.fillRule)).toBeDefined();
    expect(canExtrudePath(path, [converted!.group, ...converted!.paths])).toBe(
      true,
    );
  }
});
