import {
  parseGradient,
  parseGradientAST,
  formatMeshGradientStringSuffix,
  effectiveMeshGradientPointsNum,
  isMeshGradientGradient,
  type MeshGradient,
} from '../../packages/ecs/src/utils/gradient';
import {
  DEFAULT_MESH_GRADIENT_CORNER_POSITIONS,
  buildMeshGradientUniformValues,
  paddingMeshGradientUniforms,
  MESH_GRADIENT_UNIFORM_FLOAT32_COUNT,
} from '../../packages/ecs/src/utils/mesh-gradient-padding';

const mesh = (value: string) => parseGradient(value)![0] as MeshGradient;

it('pads omitted mesh colors with the background and positions with independent defaults', () => {
  const g = mesh('mesh-gradient(#fff, #f00, #00f 0.25 0.75)');
  expect(isMeshGradientGradient(g)).toBe(true);
  expect(g.colors).toEqual(['#f00', '#00f', ...Array(7).fill('#fff')]);
  expect(g.pointsNum).toBe(2);
  expect(g.positions).toEqual(
    DEFAULT_MESH_GRADIENT_CORNER_POSITIONS.map((p, i) =>
      i === 1 ? [0.25, 0.75] : p,
    ),
  );
  g.positions![0][0] = 9;
  expect(DEFAULT_MESH_GRADIENT_CORNER_POSITIONS[0]).toEqual([0, 0]);
  expect(mesh('mesh-gradient(#fff, #f00)').positions![0]).toEqual([0, 0]);
});

it('keeps all nine explicit corners and optional controls through serialization', () => {
  const colors = [
    '#f00',
    '#0f0',
    '#00f',
    '#ff0',
    '#0ff',
    '#f0f',
    '#aaa',
    '#bbb',
    '#ccc',
  ];
  const g = mesh(
    `mesh-gradient(#fff, ${colors.join(
      ', ',
    )}, gtype(3), wshape(2), warp(.75, .4), time(2.5), points(10))`,
  );
  expect(g).toMatchObject({
    colors,
    gradientTypeIndex: 3,
    warpShapeIndex: 2,
    warpSize: 0.75,
    warpRatio: 0.4,
    time: 2.5,
    pointsNum: 10,
  });
  expect(
    mesh(
      `mesh-gradient(#fff, ${colors.join(', ')}${formatMeshGradientStringSuffix(
        g,
      )})`,
    ),
  ).toEqual(g);
});

it('reads tail controls after fewer than nine corners and supports rgba colors', () => {
  const g = mesh(
    'mesh-gradient(black, rgba(255,0,0,.5) 0.2 0.8, WARP(.2, .3), GTYPE(1), WSHAPE(3), TIME(4), POINTS(2))',
  );
  expect(g).toMatchObject({
    backgroundColor: 'black',
    pointsNum: 2,
    gradientTypeIndex: 1,
    warpShapeIndex: 3,
    warpSize: 0.2,
    warpRatio: 0.3,
    time: 4,
  });
  expect(g.colors[0]).toBe('rgba(255,0,0,.5)');
  expect(g.positions![0]).toEqual([0.2, 0.8]);
});

it.each([
  'mesh-gradient()',
  'mesh-gradient(123, red)',
  'mesh-gradient(black red)',
  'mesh-gradient(black,)',
  'mesh-gradient(black, red,)',
  'mesh-gradient(black, red 0.5)',
  'mesh-gradient(black, red, warp())',
  'mesh-gradient(black, red, warp(1))',
  'mesh-gradient(black, red, warp(1,))',
  'mesh-gradient(black, red, warp(1,2,3))',
  'mesh-gradient(black, red, gtype())',
  'mesh-gradient(black, red, gtype(1,2))',
  'mesh-gradient(black, red, time(1) warp(1,2))',
  'mesh-gradient(black, red, time(1), unknown(2))',
  'mesh-gradient(black, red, blue, green, white, cyan, yellow, pink, orange, purple, black)',
])(
  'rejects malformed mesh paint %s without poisoning the next parse',
  (value) => {
    expect(() => parseGradientAST(value)).toThrow();
    expect(mesh('mesh-gradient(black, red)').pointsNum).toBe(1);
  },
);

it.each([
  [{}, ''],
  [
    {
      gradientTypeIndex: 2,
      warpShapeIndex: 0,
      warpSize: 0.5,
      warpRatio: 0,
      time: 0,
      pointsNum: 9,
    },
    '',
  ],
  [{ warpRatio: 0.7 }, ', warp(0.5, 0.7)'],
  [{ warpSize: 0.9 }, ', warp(0.9, 0)'],
  [
    { gradientTypeIndex: 0, warpShapeIndex: 1, time: 5, pointsNum: 10 },
    ', gtype(0), wshape(1), time(5), points(10)',
  ],
] as [Partial<MeshGradient>, string][])(
  'serializes only nondefault controls %j',
  (g, expected) => {
    expect(formatMeshGradientStringSuffix(g)).toBe(expected);
  },
);

it.each([
  [{ colors: [] }, 1],
  [{ colors: ['red', 'blue'] }, 2],
  [{ colors: Array(9).fill('red') }, 9],
  [{ colors: ['red', ' WHITE ', ...Array(7).fill('blue')] }, 1],
  [{ colors: Array(9) }, 1],
  [{ pointsNum: 0 }, 1],
  [{ pointsNum: 5 }, 5],
  [{ pointsNum: 10 }, 10],
] as [Partial<MeshGradient>, number][])(
  'infers active point count for %j',
  (patch, expected) => {
    const g: MeshGradient = {
      type: 'mesh-gradient',
      backgroundColor: 'white',
      colors: ['red'],
      ...patch,
    };
    expect(effectiveMeshGradientPointsNum(g)).toBe(expected);
  },
);

it.each([
  [[], []],
  [
    [1, 2, 3, 4],
    [1, 2, 3, 4],
  ],
  [
    [
      [1, 2, 3],
      [4, 5],
    ],
    [1, 2, 3, 0, 4, 5, 0, 0],
  ],
  [
    [1, [2, 3]],
    [1, 2, 3, 0],
  ],
  [
    [1, [2, 3, 4, 5, 6]],
    [1, 0, 0, 0, 2, 3, 4, 5, 6, 0, 0, 0],
  ],
  [
    [new Float32Array([1, 2]), 3],
    [1, 2, 3, 0],
  ],
] as [Parameters<typeof paddingMeshGradientUniforms>[0], number[]][])(
  'packs %j with four-float boundaries',
  (values, expected) => {
    const copy = values.map((value) =>
      typeof value === 'number' ? value : Array.from(value),
    );
    expect(paddingMeshGradientUniforms(values)).toEqual(expected);
    expect(
      values.map((value) =>
        typeof value === 'number' ? value : Array.from(value),
      ),
    ).toEqual(copy);
  },
);

it('places every point and control at its shader UBO offset', () => {
  const colors: [number, number, number][] = Array.from(
    { length: 10 },
    (_, i) => [i, i + 0.25, i + 0.5],
  );
  const positions: [number, number][] = Array.from({ length: 10 }, (_, i) => [
    i / 10,
    i / 20,
  ]);
  const params = {
    backgroundRgb: [1, 2, 3] as [number, number, number],
    pointColors: colors,
    pointPositions: positions,
    pointsNum: 10,
    noiseRatio: 0.1,
    noiseTime: 0.2,
    warpShapeIndex: 3,
    warpSize: 0.4,
    warpRatio: 0.5,
    gradientTypeIndex: 2,
    time: 6,
  };
  const packed = buildMeshGradientUniformValues(params);
  expect(packed).toHaveLength(92);
  for (let i = 0; i < 10; i++) {
    expect(packed.slice(i * 8, i * 8 + 8)).toEqual([
      ...colors[i],
      0,
      ...positions[i],
      0,
      0,
    ]);
  }
  expect(packed.slice(80)).toEqual([
    1, 2, 3, 10, 0.1, 0.2, 3, 0.4, 0.5, 2, 6, 0,
  ]);
  const buffer = new Float32Array(MESH_GRADIENT_UNIFORM_FLOAT32_COUNT);
  buffer.set(packed);
  expect([...buffer.slice(92)]).toEqual([0, 0, 0, 0]);
  expect(
    buildMeshGradientUniformValues({
      ...params,
      pointColors: [],
      pointPositions: [],
    }).slice(0, 80),
  ).toEqual(Array(80).fill(0));
});
