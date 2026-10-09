import { AABB } from '../../packages/ecs/src';
import {
  calculateOffset,
  getGridPoint,
  snapDraggedElements,
  snapResizingElements,
  type SnapLine,
} from '../../packages/ecs/src/utils/snapping';
import { createSnappingScene } from '../helpers/snapping-scene';

const selected = { id: 'selected', bounds: new AABB(0, 0, 20, 20) };
const noSnap = { snapOffset: [0, 0], snapLines: [] };

describe('object alignment', () => {
  it.each([0.25, 1, 4])(
    'uses CSS-pixel attraction and release at zoom %s',
    (zoom) => {
      const { api } = createSnappingScene(
        [selected, { id: 'reference', bounds: new AABB(100, 200, 160, 260) }],
        zoom,
      );
      const bounds = new AABB(0, 0, 20, 20);
      const atThreshold = 80 - 5 / zoom;
      const attracted = snapDraggedElements(
        api,
        [atThreshold, 0],
        undefined,
        bounds,
      );
      expect(attracted.snapOffset).toEqual([5 / zoom, 0]);
      expect(attracted.snapLines).toContainEqual({
        type: 'points',
        points: [
          [100, 0],
          [100, 20],
          [100, 200],
          [100, 260],
        ],
      });
      // Every pointer sample starts at the pointer-down geometry. Feeding the
      // previous correction back must not keep a pointer outside the threshold stuck.
      expect(
        snapDraggedElements(
          api,
          [atThreshold - 1 / zoom, 0],
          attracted.snapOffset,
          bounds,
        ),
      ).toEqual(noSnap);
      expect(bounds).toEqual(new AABB(0, 0, 20, 20));
    },
  );

  it('selects the nearer alignment, deduplicates guides and removes stale ones', () => {
    const { api } = createSnappingScene([
      selected,
      { id: 'farther', bounds: new AABB(103, 200, 143, 240) },
      { id: 'nearer', bounds: new AABB(100, 300, 140, 340) },
      { id: 'same-coordinate', bounds: new AABB(100, 300, 140, 340) },
    ]);
    const result = snapDraggedElements(api, [79, 0]);
    expect(result.snapOffset).toEqual([1, 0]);
    expect(result.snapLines).toEqual([
      {
        type: 'points',
        points: [
          [100, 0],
          [100, 20],
          [100, 300],
          [100, 340],
        ],
      },
    ]);
    expect(snapDraggedElements(api, [60, 0], result.snapOffset)).toEqual(
      noSnap,
    );
  });

  it('uses the previous correction only to break an equal-distance tie', () => {
    const { api } = createSnappingScene([
      selected,
      { id: 'left', bounds: new AABB(-4, 200, -4, 200) },
      { id: 'right', bounds: new AABB(4, 300, 4, 300) },
    ]);
    expect(snapDraggedElements(api, [0, 0]).snapOffset).toEqual([-4, 0]);
    expect(snapDraggedElements(api, [0, 0], [4, 0]).snapOffset).toEqual([4, 0]);
    expect(snapDraggedElements(api, [-1, 0], [4, 0]).snapOffset).toEqual([
      -3, 0,
    ]);
  });

  it('excludes selected nodes, ancestors and descendants from its references', () => {
    const bounds = new AABB(100, 200, 140, 240);
    const { api, state } = createSnappingScene([
      { ...selected, parentId: 'parent' },
      { id: 'parent', parentId: 'root', bounds },
      { id: 'root', bounds },
      { id: 'child', parentId: 'selected', bounds },
      { id: 'grandchild', parentId: 'child', bounds },
      { id: 'also-selected', bounds },
    ]);
    state.layersSelected.push('also-selected');
    expect(
      snapDraggedElements(api, [79, 0], undefined, selected.bounds),
    ).toEqual(noSnap);
    expect(snapResizingElements(api, [99, 0])).toEqual(noSnap);
  });

  it('keeps independent siblings eligible and tolerates cyclic ancestry', () => {
    const { api } = createSnappingScene([
      { ...selected, parentId: 'a' },
      { id: 'a', parentId: 'b', bounds: new AABB(50, 50, 200, 200) },
      { id: 'b', parentId: 'a', bounds: new AABB(50, 50, 200, 200) },
      { id: 'sibling', parentId: 'a', bounds: new AABB(100, 200, 140, 240) },
    ]);
    expect(snapDraggedElements(api, [79, 0]).snapOffset).toEqual([1, 0]);
  });

  it.each([
    { visible: false },
    { culled: true },
    { missing: true },
    { bounds: new AABB(NaN, 200, 140, 240) },
    { bounds: new AABB(100, 200, Infinity, 240) },
  ])('ignores unavailable or invalid reference geometry: %o', (override) => {
    const { api } = createSnappingScene([
      selected,
      { id: 'reference', bounds: new AABB(100, 200, 140, 240), ...override },
    ]);
    expect(snapDraggedElements(api, [79, 0])).toEqual(noSnap);
    expect(snapResizingElements(api, [99, 0])).toEqual(noSnap);
  });

  it('returns no correction with snapping disabled, no selection or no references', () => {
    const empty = createSnappingScene([selected]);
    expect(snapDraggedElements(empty.api, [2, 3])).toEqual(noSnap);
    expect(snapResizingElements(empty.api, [2, 3])).toEqual(noSnap);
    const { api, state } = createSnappingScene([
      selected,
      { id: 'reference', bounds: new AABB(100, 200, 140, 240) },
    ]);
    expect(snapDraggedElements(api, [79, 0]).snapOffset).toEqual([1, 0]);
    state.snapToObjectsEnabled = false;
    expect(snapDraggedElements(api, [79, 0])).toEqual(noSnap);
    expect(snapResizingElements(api, [99, 0])).toEqual(noSnap);
    state.snapToObjectsEnabled = true;
    state.layersSelected = [];
    expect(
      snapDraggedElements(api, [79, 0], undefined, selected.bounds),
    ).toEqual(noSnap);
  });

  it.each([
    [0, 1],
    [-1, 1],
    [NaN, 1],
    [Infinity, 1],
    [5, 0],
    [5, -1],
    [5, NaN],
  ])(
    'does not attract with invalid distance/zoom (%s, %s)',
    (distance, zoom) => {
      const { api, state } = createSnappingScene(
        [
          selected,
          {
            id: 'reference',
            bounds: new AABB(100, 200, 140, 240),
            visible: true,
          },
        ],
        zoom,
      );
      state.snapToObjectsDistance = distance;
      expect(snapDraggedElements(api, [79, 0])).toEqual(noSnap);
      expect(snapResizingElements(api, [99, 0])).toEqual(noSnap);
    },
  );
});

describe.each(['horizontal', 'vertical'] as const)(
  '%s equal spacing',
  (axis) => {
    const bounds = (start: number, end: number, across = 0) =>
      axis === 'horizontal'
        ? new AABB(start, across, end, across + 20)
        : new AABB(across, start, across + 20, end);
    const offset = (n: number): [number, number] =>
      axis === 'horizontal' ? [n, 0] : [0, n];
    const guide = (from: number, to: number): SnapLine => ({
      type: 'gap',
      direction: axis,
      points:
        axis === 'horizontal'
          ? [
              [from, 10],
              [to, 10],
            ]
          : [
              [10, from],
              [10, to],
            ],
    });
    it.each([
      [
        'between',
        76,
        4,
        [
          [40, 80],
          [100, 140],
        ],
      ],
      [
        'before',
        -124,
        4,
        [
          [-100, 0],
          [40, 140],
        ],
      ],
      [
        'after',
        284,
        -4,
        [
          [40, 140],
          [180, 280],
        ],
      ],
    ] as const)(
      'snaps %s two references and displays the two equal gaps',
      (_, position, correction, gaps) => {
        const { api } = createSnappingScene([
          { id: 'selected', bounds: bounds(position, position + 20) },
          { id: 'a', bounds: bounds(0, 40) },
          { id: 'b', bounds: bounds(140, 180) },
        ]);
        const result = snapDraggedElements(api, [0, 0]);
        expect(result.snapOffset).toEqual(offset(correction));
        expect(result.snapLines.filter((line) => line.type === 'gap')).toEqual(
          gaps.map(([from, to]) => guide(from, to)),
        );
      },
    );

    it('does not invent gaps when references do not overlap on the other axis', () => {
      const { api } = createSnappingScene([
        { id: 'selected', bounds: bounds(76, 96) },
        { id: 'a', bounds: bounds(0, 40) },
        { id: 'b', bounds: bounds(140, 180, 100) },
      ]);
      const result = snapDraggedElements(api, [0, 0]);
      expect(result.snapOffset).toEqual([0, 0]);
      expect(result.snapLines.filter((line) => line.type === 'gap')).toEqual(
        [],
      );
    });

    it('does not attract a selection outside the shared gap corridor', () => {
      const { api } = createSnappingScene([
        { id: 'selected', bounds: bounds(76, 96, 100) },
        { id: 'a', bounds: bounds(0, 40) },
        { id: 'b', bounds: bounds(140, 180) },
      ]);
      expect(snapDraggedElements(api, [0, 0])).toEqual(noSnap);
    });
  },
);

describe('resize attraction', () => {
  const scene = () =>
    createSnappingScene([
      selected,
      { id: 'reference', bounds: new AABB(100, 100, 140, 140) },
    ]);

  it('snaps free corners independently on both axes', () => {
    const { api } = scene();
    const result = snapResizingElements(api, [97, 96]);
    expect(result.snapOffset).toEqual([3, 4]);
    expect(result.snapLines).toEqual([
      {
        type: 'points',
        points: [
          [100, 100],
          [100, 140],
        ],
      },
      {
        type: 'points',
        points: [
          [100, 100],
          [140, 100],
        ],
      },
    ]);
    expect(snapResizingElements(api, [94, 94])).toEqual(noSnap);
  });

  it.each([
    {
      direction: [1, 0],
      point: [97, 100],
      expected: [3, 0],
      points: [
        [100, 100],
        [100, 140],
      ],
    },
    {
      direction: [0, -4],
      point: [100, 96],
      expected: [0, 4],
      points: [
        [100, 100],
        [140, 100],
      ],
    },
  ])(
    'moves only along the resize side (%o)',
    ({ direction, point, expected, points }) => {
      const { api } = scene();
      const result = snapResizingElements(
        api,
        point as [number, number],
        direction as [number, number],
      );
      expect(result.snapOffset[0]).toBeCloseTo(expected[0], 8);
      expect(result.snapOffset[1]).toBeCloseTo(expected[1], 8);
      // An already aligned, non-moving axis must not produce a misleading guide.
      expect(result.snapLines).toEqual([{ type: 'points', points }]);
    },
  );

  it('normalizes rotated/aspect-locked rays and limits actual travel distance', () => {
    const { api } = scene();
    const result = snapResizingElements(api, [97, 96], [6, 8]);
    expect(result.snapOffset[0]).toBeCloseTo(3);
    expect(result.snapOffset[1]).toBeCloseTo(4);
    expect(snapResizingElements(api, [96.94, 95.92], [6, 8])).toEqual(noSnap);
    expect(snapResizingElements(api, [97, 96], [-3, -4]).snapOffset).toEqual(
      result.snapOffset,
    );
    expect(snapResizingElements(api, [97, 96], [0, 0])).toEqual(noSnap);
  });
});

describe('grid and object snapping', () => {
  it('preserves object correction per axis and applies grid only to other axes', () => {
    expect(calculateOffset([3, 5], [10, 10], [2, 0], 8)).toEqual([12, 11]);
    expect(calculateOffset([3, 5], [10, 10], [0, -2], 8)).toEqual([13, 8]);
    expect(calculateOffset([3, 5], [10, 10], [2, -2], 8)).toEqual([12, 8]);
    expect(calculateOffset([3, 5], [10, 10], [0, 0], 0)).toEqual([10, 10]);
  });

  it('stabilizes floating-point grid boundaries and supports negative coordinates', () => {
    expect(calculateOffset([0, 0], [7.9999999, 8.0000001], [0, 0], 16)).toEqual(
      [16, 16],
    );
    expect(getGridPoint(-17, -31, 16)).toEqual([-16, -32]);
    expect(getGridPoint(1.25, -3.5, 0)).toEqual([1.25, -3.5]);
  });
});
