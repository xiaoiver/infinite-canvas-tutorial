import { extrudePathContours } from '../../packages/ecs/src/utils/extrude3d-geometry';
import type { Mesh3DGeometryData } from '../../packages/ecs/src/utils/geometry3d/types';
import { insetFillBoundaries } from '../../packages/ecs/src/utils/geometry3d/inset-fill-boundaries';

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
    if ([a, b, c].some((index) => n[index + 2] !== normalZ)) continue;
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

it('chamfers both ends of a convex closed contour without opening the mesh', () => {
  const result = extrudePathContours([rect(0, 0, 10, 10)], 8, 'nonzero', 1);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(capArea(result.geometry, 1)).toBeCloseTo(64);
  expect(capArea(result.geometry, -1)).toBeCloseTo(64);
  const { normals, positions } = result.geometry;
  expect(
    [...normals].some((value, i) => i % 3 === 2 && value > 0.6 && value < 0.8),
  ).toBe(true);
  expect(Math.max(...positions.filter((_, i) => i % 3 === 2))).toBe(4);
  assertClosed(result.geometry);
});

it('bevels a sampled circular contour', () => {
  const circle: Point[] = Array.from({ length: 48 }, (_, i) => [
    10 * Math.cos((i * 2 * Math.PI) / 48),
    10 * Math.sin((i * 2 * Math.PI) / 48),
  ]);
  const result = extrudePathContours([circle], 4, 'nonzero', 0.5);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(capArea(result.geometry, 1)).toBeLessThan(300);
  expect(capArea(result.geometry, 1)).toBeGreaterThan(280);
  assertClosed(result.geometry);
});

it('keeps a rounded bevel on a detailed SVG-like contour', () => {
  const contour: Point[] = Array.from({ length: 1200 }, (_, i) => [
    100 * Math.cos((i * 2 * Math.PI) / 1200),
    100 * Math.sin((i * 2 * Math.PI) / 1200),
  ]);
  expect(insetFillBoundaries([contour], 1)?.[0]).toHaveLength(1200);
  const result = extrudePathContours([contour], 10, 'nonzero', 1, 4);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(capArea(result.geometry, 1)).toBeLessThan(31000);
  expect(result.geometry.indices.length).toBeGreaterThan(1200 * 6);
});

it.each([
  [[rect(0, 0, 10, 10), rect(2, 2, 6, 6)], 'evenodd'],
  [[rect(0, 0, 10, 1)], 'nonzero'],
] as [Point[][], CanvasFillRule][])(
  'keeps sharp geometry when beveling would change topology %#',
  (contours, fillRule) => {
    const sharp = extrudePathContours(contours, 8, fillRule);
    const requested = extrudePathContours(contours, 8, fillRule, 1);
    const rounded = extrudePathContours(contours, 8, fillRule, 1, 4);
    expect(sharp.ok).toBe(true);
    expect(requested).toEqual(sharp);
    expect(rounded).toEqual(sharp);
  },
);

it('insets a topology-preserving concave contour', () => {
  const contour: Point[] = [
    [0, 0],
    [10, 0],
    [10, 5],
    [5, 5],
    [5, 10],
    [0, 10],
  ];
  expect(insetFillBoundaries([contour], 1)).toEqual([
    [
      [1, 1],
      [9, 1],
      [9, 4],
      [4, 4],
      [4, 9],
      [1, 9],
    ],
  ]);
  const result = extrudePathContours([contour], 8, 'nonzero', 1);
  expect(result).toMatchObject({ ok: true });
  if (result.ok) {
    expect(capArea(result.geometry, 1)).toBeCloseTo(39);
    assertClosed(result.geometry);
  }
});

it('bevels a hole while keeping a closed volume', () => {
  const result = extrudePathContours(
    [rect(0, 0, 20, 20), rect(7, 7, 6, 6)],
    8,
    'evenodd',
    1,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(capArea(result.geometry, 1)).toBeCloseTo(260);
  expect(capArea(result.geometry, -1)).toBeCloseTo(260);
  assertClosed(result.geometry);
});

it.each([
  ['rectangle', [rect(0, 0, 20, 20)], 'nonzero', 324, 88],
  ['holed ring', [rect(0, 0, 20, 20), rect(7, 7, 6, 6)], 'evenodd', 260, 176],
] as [string, Point[][], CanvasFillRule, number, number][])(
  'rounds the bevel of a %s while preserving its caps and closed volume',
  (_name, contours, fillRule, area, vertexCount) => {
    const result = extrudePathContours(contours, 8, fillRule, 1, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { geometry } = result;
    expect(capArea(geometry, 1)).toBeCloseTo(area);
    expect(capArea(geometry, -1)).toBeCloseTo(area);
    expect(geometry.positions.length / 3).toBe(vertexCount);
    expect(
      [...geometry.normals].some(
        (normal, i) => i % 3 === 2 && normal > 0.3 && normal < 0.5,
      ),
    ).toBe(true);
    expect(
      new Set([...geometry.positions].filter((_, i) => i % 3 === 2)).size,
    ).toBe(10);
    assertClosed(geometry);
  },
);

it.each([
  ['two islands', [rect(0, 0, 10, 10), rect(20, 0, 10, 10)], 128],
  [
    'nested island',
    [rect(0, 0, 30, 30), rect(5, 5, 20, 20), rect(12, 12, 6, 6)],
    316,
  ],
] as [string, Point[][], number][])(
  'bevels %s without changing filled topology',
  (_name, contours, area) => {
    const result = extrudePathContours(contours, 8, 'evenodd', 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(capArea(result.geometry, 1)).toBeCloseTo(area);
    assertClosed(result.geometry);
  },
);

it('rejects nonfinite and negative bevel sizes', () => {
  expect(extrudePathContours([rect(0, 0, 10, 10)], 8, 'nonzero', -1)).toEqual({
    ok: false,
    reason: 'invalid-bevel',
  });
  expect(
    extrudePathContours([rect(0, 0, 10, 10)], 8, 'nonzero', Infinity),
  ).toEqual({
    ok: false,
    reason: 'invalid-bevel',
  });
});

it.each([0, 1.5, 9, Infinity])(
  'rejects invalid bevel segment count %s',
  (segments) => {
    expect(
      extrudePathContours([rect(0, 0, 10, 10)], 8, 'nonzero', 1, segments),
    ).toEqual({
      ok: false,
      reason: 'invalid-bevel',
    });
  },
);

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

it('reuses cap vertices on a curved shape without merging hard wall normals', () => {
  const segments = 128;
  const circle: Point[] = Array.from({ length: segments }, (_, i) => [
    10 * Math.cos((i * 2 * Math.PI) / segments),
    10 * Math.sin((i * 2 * Math.PI) / segments),
  ]);
  const result = extrudePathContours([circle], 4);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const { positions, normals, indices } = result.geometry;
  // Two shared cap rings plus four vertices per flat-shaded wall segment.
  expect(positions.length / 3).toBe(segments * 6);
  expect(indices.length).toBe((segments - 2) * 6 + segments * 6);
  expect(
    normals.filter((_, i) => i % 3 === 2 && Math.abs(normals[i]) === 1),
  ).toHaveLength(segments * 2);
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
