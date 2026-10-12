import '../../packages/ecs/src';
import { buildPathFillMesh } from '../../packages/ecs/src/utils/path-fill-mesh';
import { Mesh } from '../../packages/ecs/src/drawcalls/Mesh';
import { PathDrawcall } from '../../packages/ecs/src/drawcalls/PathDrawcall';
import {
  ComputedPoints,
  Path,
  TesselationMethod,
} from '../../packages/ecs/src/components';
import type { Entity } from '../../packages/ecs/src';

type Point = [number, number];
const rectangle = (
  x: number,
  y: number,
  width: number,
  height: number,
): Point[] => [
  [x, y],
  [x + width, y],
  [x + width, y + height],
  [x, y + height],
  [x, y],
];
function shape(
  contours: Point[][],
  fillRule: CanvasFillRule = 'nonzero',
  tessellationMethod = TesselationMethod.EARCUT,
) {
  const components = new Map<unknown, unknown>([
    [Path, { d: 'same path data', fillRule, tessellationMethod }],
    [ComputedPoints, { points: contours }],
  ]);
  return {
    has: (type: unknown) => components.has(type),
    read: (type: unknown) => components.get(type),
  } as unknown as Entity;
}
function drawcall(instance: Entity) {
  return {
    shapes: [instance],
    pathPoints: new Map(),
    points: [] as number[],
    indexBufferData: new Uint32Array(),
    vertexBuffers: [],
    vertexBufferDatas: [],
    device: { createBuffer: jest.fn(() => ({ destroy: jest.fn() })) },
    api: { getNodeByEntity: () => ({}) },
  };
}
function meshArea(mesh: { points: number[]; indexBufferData: Uint32Array }) {
  const { points: p, indexBufferData: indices } = mesh;
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [...indices.slice(i, i + 3)].map((index) => index * 2);
    area +=
      Math.abs(
        (p[b] - p[a]) * (p[c + 1] - p[a + 1]) -
          (p[b + 1] - p[a + 1]) * (p[c] - p[a]),
      ) / 2;
  }
  return area;
}

it.each([
  [
    'same-direction evenodd hole',
    [rectangle(0, 0, 100, 100), rectangle(25, 25, 50, 50)],
    'evenodd',
    7500,
  ],
  [
    'disconnected same-direction contours',
    [rectangle(0, 0, 20, 20), rectangle(50, 0, 20, 20)],
    'nonzero',
    800,
  ],
  [
    'overlapping contours use parity',
    [rectangle(0, 0, 100, 100), rectangle(50, 0, 100, 100)],
    'evenodd',
    10000,
  ],
] as [string, Point[][], CanvasFillRule, number][])(
  'fills %s using the requested rule',
  (_name, contours, rule, area) => {
    const mesh = drawcall(shape(contours, rule));
    Mesh.prototype.createGeometry.call(mesh as unknown as Mesh);
    expect(meshArea(mesh)).toBeCloseTo(area, 6);
  },
);

it('does not batch identical paths with different fill rules', () => {
  const parent = jest
    .spyOn(PathDrawcall.prototype, 'validate')
    .mockReturnValue(true);
  try {
    const mesh = drawcall(shape([], 'nonzero'));
    expect(
      Mesh.prototype.validate.call(
        mesh as unknown as Mesh,
        shape([], 'evenodd'),
      ),
    ).toBe(false);
  } finally {
    parent.mockRestore();
  }
});

// Public geometry behavior, with real Earcut/libtess and only GPU uploads stubbed.
const cases: [string, Point[][], number, number][] = [
  ['single square', [rectangle(0, 0, 100, 100)], 10000, 10000],
  [
    'same-direction hole',
    [rectangle(0, 0, 100, 100), rectangle(25, 25, 50, 50)],
    10000,
    7500,
  ],
  [
    'opposite-direction hole first',
    [rectangle(25, 25, 50, 50).reverse(), rectangle(0, 0, 100, 100)],
    7500,
    7500,
  ],
  [
    'nested island first',
    [
      rectangle(40, 40, 20, 20),
      rectangle(20, 20, 60, 60),
      rectangle(0, 0, 100, 100),
    ],
    10000,
    6800,
  ],
  [
    'separate reversed islands',
    [rectangle(0, 0, 20, 20), rectangle(50, 0, 20, 20).reverse()],
    800,
    800,
  ],
  [
    'overlapping same-direction squares',
    [rectangle(0, 0, 100, 100), rectangle(50, 0, 100, 100)],
    15000,
    10000,
  ],
  [
    'overlapping opposite-direction squares',
    [rectangle(0, 0, 100, 100), rectangle(50, 0, 100, 100).reverse()],
    10000,
    10000,
  ],
  [
    'duplicate contours',
    [rectangle(0, 0, 100, 100), rectangle(0, 0, 100, 100)],
    10000,
    0,
  ],
  [
    'opposite duplicate contours',
    [rectangle(0, 0, 100, 100), rectangle(0, 0, 100, 100).reverse()],
    0,
    0,
  ],
  [
    'touching squares',
    [rectangle(0, 0, 50, 50), rectangle(50, 0, 50, 50)],
    5000,
    5000,
  ],
  [
    'self-touching contour',
    [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
        [-10, 0],
        [-10, -10],
        [0, -10],
        [0, 0],
      ],
    ],
    200,
    200,
  ],
  [
    'empty and incomplete loops',
    [
      [],
      [[0, 0]],
      [
        [0, 0],
        [1, 1],
      ],
    ],
    0,
    0,
  ],
  [
    'valid contour after empty loops',
    [[], rectangle(0, 0, 100, 100)],
    10000,
    10000,
  ],
];
for (const method of [TesselationMethod.EARCUT, TesselationMethod.LIBTESS]) {
  for (const rule of ['nonzero', 'evenodd'] as const) {
    it.each(cases)(
      `${method}/${rule} resolves %s without overlapping triangles`,
      (_name, contours, nonzero, evenodd) => {
        const original = JSON.parse(JSON.stringify(contours));
        const mesh = drawcall(shape(contours, rule, method));
        Mesh.prototype.createGeometry.call(mesh as unknown as Mesh);
        expect(meshArea(mesh)).toBeCloseTo(
          rule === 'nonzero' ? nonzero : evenodd,
          6,
        );
        expect(contours).toEqual(original);
        expect(mesh.points.every(Number.isFinite)).toBe(true);
        expect(
          [...mesh.indexBufferData].every(
            (index) => index < mesh.points.length / 2,
          ),
        ).toBe(true);
      },
    );
  }
}

it.each([
  ['evenodd', TesselationMethod.EARCUT],
  ['nonzero', TesselationMethod.LIBTESS],
] as const)('resolves a self-crossing bowtie with %s/%s', (rule, method) => {
  const mesh = drawcall(
    shape(
      [
        [
          [0, 0],
          [100, 100],
          [100, 0],
          [0, 100],
        ],
      ],
      rule,
      method,
    ),
  );
  Mesh.prototype.createGeometry.call(mesh as unknown as Mesh);
  expect(meshArea(mesh)).toBeCloseTo(5000, 6);
});

it('does not batch paths that request different tessellators', () => {
  const parent = jest
    .spyOn(PathDrawcall.prototype, 'validate')
    .mockReturnValue(true);
  try {
    const mesh = drawcall(shape([]));
    expect(
      Mesh.prototype.validate.call(
        mesh as unknown as Mesh,
        shape([], 'nonzero', TesselationMethod.LIBTESS),
      ),
    ).toBe(false);
    expect(
      Mesh.prototype.validate.call(mesh as unknown as Mesh, shape([])),
    ).toBe(true);
  } finally {
    parent.mockRestore();
  }
});

it('rebuilds geometry from current precision points and releases old buffers, including empty output', () => {
  const instance = shape([rectangle(0, 0, 10, 10)]);
  const mesh = drawcall(instance);
  Mesh.prototype.createGeometry.call(mesh as unknown as Mesh);
  expect(meshArea(mesh)).toBe(100);
  mesh.pathPoints.set(instance, [rectangle(0, 0, 20, 20)]);
  Mesh.prototype.createGeometry.call(mesh as unknown as Mesh);
  expect(meshArea(mesh)).toBe(400);
  mesh.pathPoints.set(instance, []);
  Mesh.prototype.createGeometry.call(mesh as unknown as Mesh);
  expect(mesh.points).toEqual([]);
  expect(mesh.indexBufferData).toHaveLength(0);
  const buffers = mesh.device.createBuffer.mock.results.map(
    (result) => result.value,
  );
  buffers
    .slice(0, 4)
    .forEach((buffer) => expect(buffer.destroy).toHaveBeenCalledTimes(1));
  buffers
    .slice(4)
    .forEach((buffer) => expect(buffer.destroy).not.toHaveBeenCalled());
});

it('defaults to nonzero and Earcut for an ordinary contour', () => {
  const mesh = buildPathFillMesh([rectangle(0, 0, 20, 20)]);
  expect(
    meshArea({
      points: mesh.points,
      indexBufferData: new Uint32Array(mesh.indices),
    }),
  ).toBe(400);
});
