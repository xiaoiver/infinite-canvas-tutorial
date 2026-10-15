import { extrudePathContours } from '../../packages/ecs/src/utils/extrude3d-geometry';
import type { Mesh3DGeometryData } from '../../packages/ecs/src/utils/geometry3d/types';

type Point = [number, number];
const rect = (x: number, y: number, w: number, h: number): Point[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
  [x, y],
];

function capArea(mesh: Mesh3DGeometryData, normalZ: number): number {
  let area = 0;
  const { positions: p, normals: n, indices } = mesh;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [...indices.slice(i, i + 3)].map((index) => index * 3);
    if (n[a + 2] !== normalZ) continue;
    const cross =
      (p[b] - p[a]) * (p[c + 1] - p[a + 1]) -
      (p[b + 1] - p[a + 1]) * (p[c] - p[a]);
    expect(Math.sign(cross)).toBe(normalZ);
    area += Math.abs(cross) / 2;
  }
  return area;
}

function assertClosed(mesh: Mesh3DGeometryData) {
  const { positions: p, normals: n, uvs, indices } = mesh;
  expect(n.length).toBe(p.length);
  expect(uvs?.length).toBe((p.length / 3) * 2);
  expect([...p, ...n, ...(uvs ?? [])].every(Number.isFinite)).toBe(true);
  const edges = new Map<string, number>();
  const key = (index: number) =>
    [...p.slice(index * 3, index * 3 + 3)].join(',');
  for (let i = 0; i < indices.length; i += 3) {
    const vertices = [...indices.slice(i, i + 3)];
    for (let j = 0; j < 3; j++) {
      const pair = [key(vertices[j]), key(vertices[(j + 1) % 3])].sort();
      const edge = pair.join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  expect(edges.size).toBeGreaterThan(0);
  expect([...edges.values()].every((count) => count === 2)).toBe(true);
}

it.each([
  ['square', [rect(0, 0, 10, 10)], 'nonzero', 100],
  ['two islands', [rect(0, 0, 10, 10), rect(20, 0, 10, 10)], 'nonzero', 200],
  ['evenodd hole', [rect(0, 0, 10, 10), rect(2, 2, 6, 6)], 'evenodd', 64],
  [
    'nonzero hole',
    [rect(0, 0, 10, 10), rect(2, 2, 6, 6).reverse()],
    'nonzero',
    64,
  ],
  [
    'nested island',
    [rect(0, 0, 10, 10), rect(2, 2, 6, 6), rect(4, 4, 2, 2)],
    'evenodd',
    68,
  ],
  ['overlap union', [rect(0, 0, 10, 10), rect(5, 0, 10, 10)], 'nonzero', 150],
  ['overlap parity', [rect(0, 0, 10, 10), rect(5, 0, 10, 10)], 'evenodd', 100],
  ['shared edge', [rect(0, 0, 10, 10), rect(10, 0, 10, 10)], 'nonzero', 200],
  [
    'duplicate nonzero',
    [rect(0, 0, 10, 10), rect(0, 0, 10, 10)],
    'nonzero',
    100,
  ],
] as [string, Point[][], CanvasFillRule, number][])(
  '%s extrudes a closed volume',
  (_name, contours, rule, expectedArea) => {
    const original = JSON.parse(JSON.stringify(contours));
    const result = extrudePathContours(contours, 8, rule);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(capArea(result.geometry, 1)).toBeCloseTo(expectedArea, 4);
    expect(capArea(result.geometry, -1)).toBeCloseTo(expectedArea, 4);
    assertClosed(result.geometry);
    expect(contours).toEqual(original);
  },
);

it('points wall normals out of the solid, including into a hole', () => {
  const result = extrudePathContours(
    [rect(0, 0, 10, 10), rect(2, 2, 6, 6)],
    8,
    'evenodd',
  );
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const { positions: p, normals: n } = result.geometry;
  let outer = 0;
  let inner = 0;
  for (let i = 0; i < p.length; i += 3) {
    if (n[i + 2] !== 0) continue;
    const dot = (p[i] - 5) * n[i] + (p[i + 1] - 5) * n[i + 1];
    if (p[i] === 0 || p[i] === 10 || p[i + 1] === 0 || p[i + 1] === 10) {
      expect(dot).toBeGreaterThan(0);
      outer++;
    } else {
      expect(dot).toBeLessThan(0);
      inner++;
    }
  }
  expect(outer).toBeGreaterThan(0);
  expect(inner).toBeGreaterThan(0);
});

it('rejects a self crossing that would create a non-manifold vertical edge', () => {
  expect(
    extrudePathContours(
      [
        [
          [0, 0],
          [10, 10],
          [10, 0],
          [0, 10],
        ],
      ],
      8,
      'evenodd',
    ),
  ).toEqual({ ok: false, reason: 'non-manifold' });
});

it('accepts a sampled curved contour and repeated closing points', () => {
  const circle: Point[] = Array.from({ length: 32 }, (_, i) => [
    10 * Math.cos((i * Math.PI) / 16),
    10 * Math.sin((i * Math.PI) / 16),
  ]);
  circle.push(circle[0], circle[0]);
  const result = extrudePathContours([circle], 4);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(capArea(result.geometry, 1)).toBeCloseTo(
    1600 * Math.sin(Math.PI / 16),
    4,
  );
  assertClosed(result.geometry);
});

it.each([
  [[], 2, 'empty-fill'],
  [[rect(0, 0, 10, 10)], 0, 'invalid-depth'],
  [[rect(0, 0, 10, 10)], Infinity, 'invalid-depth'],
  [
    [
      [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    ],
    2,
    'empty-fill',
  ],
  [
    [
      [
        [0, 0],
        [1, 0],
        [NaN, 1],
      ],
    ],
    2,
    'invalid-contour',
  ],
  [
    [
      [
        [0, 0],
        [1, 0],
        [0, 0],
      ],
    ],
    2,
    'invalid-contour',
  ],
  [[rect(0, 0, 10, 10), rect(0, 0, 10, 10)], 2, 'empty-fill'],
] as [Point[][], number, string][])(
  'fails closed for invalid or empty geometry %#',
  (contours, depth, reason) => {
    expect(extrudePathContours(contours, depth, 'evenodd')).toEqual({
      ok: false,
      reason,
    });
  },
);
