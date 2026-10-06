/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/f55ecb96cc8db9a2417d48cd8077833c3822d64e/packages/excalidraw/snapping.ts
 */

import { AABB, API, ComputedCamera, ComputedVisibility, Culled } from '..';
import { rangeIntersection, rangesOverlap } from './math';

const round = (x: number) => {
  const decimalPlaces = 6;
  return Math.round(x * 10 ** decimalPlaces) / 10 ** decimalPlaces;
};

const dedupePoints = (points: [number, number][]): [number, number][] => {
  const map = new Map<string, [number, number]>();

  for (const point of points) {
    const key = point.join(',');

    if (!map.has(key)) {
      map.set(key, point);
    }
  }

  return Array.from(map.values());
};

type PointPair = [[number, number], [number, number]];

export type PointSnap = {
  type: 'point';
  points: PointPair;
  offset: number;
};

export type Gap = {
  //  start side ↓     length
  // ┌───────────┐◄───────────────►
  // │           │-----------------┌───────────┐
  // │  start    │       ↑         │           │
  // │  element  │    overlap      │  end      │
  // │           │       ↓         │  element  │
  // └───────────┘-----------------│           │
  //                               └───────────┘
  //                               ↑ end side
  startBounds: AABB;
  endBounds: AABB;
  startSide: [[number, number], [number, number]];
  endSide: [[number, number], [number, number]];
  overlap: [number, number];
  length: number;
};

export type GapSnap = {
  type: 'gap';
  direction:
    | 'center_horizontal'
    | 'center_vertical'
    | 'side_left'
    | 'side_right'
    | 'side_top'
    | 'side_bottom';
  gap: Gap;
  offset: number;
};

export type Snap = GapSnap | PointSnap;
export type Snaps = Snap[];

export type PointSnapLine = {
  type: 'points';
  points: [number, number][];
};
export type GapSnapLine = {
  type: 'gap';
  direction: 'horizontal' | 'vertical';
  points: PointPair;
};

export type SnapLine = PointSnapLine | GapSnapLine;

const VISIBLE_GAPS_LIMIT_PER_AXIS = 99999;

const getBoundsSnapPoints = ({ minX, minY, maxX, maxY }: AABB) =>
  [
    [minX, minY],
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
    [(minX + maxX) / 2, (minY + maxY) / 2],
  ] as [number, number][];

const offsetBounds = (bounds: AABB, [dx, dy]: [number, number]) =>
  new AABB(
    bounds.minX + dx,
    bounds.minY + dy,
    bounds.maxX + dx,
    bounds.maxY + dy,
  );

/** References must not include geometry that changes with the selection. */
const getReferenceBounds = (api: API): AABB[] => {
  const nodes = api.getNodes();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const selected = new Set(api.getAppState().layersSelected);
  const ancestors = new Set<string>();
  const parents = (id: string) => {
    const result = new Set<string>();
    let parentId = byId.get(id)?.parentId;
    while (parentId && !result.has(parentId)) {
      result.add(parentId);
      parentId = byId.get(parentId)?.parentId;
    }
    return result;
  };
  selected.forEach((id) =>
    parents(id).forEach((parent) => ancestors.add(parent)),
  );

  return nodes.flatMap((node) => {
    if (
      selected.has(node.id) ||
      ancestors.has(node.id) ||
      [...parents(node.id)].some((id) => selected.has(id))
    )
      return [];
    const entity = api.getEntity(node);
    if (
      !entity ||
      entity.has(Culled) ||
      (entity.has(ComputedVisibility) &&
        !entity.read(ComputedVisibility).visible)
    )
      return [];
    const bounds = api.getGeometryBounds([node]);
    return [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(
      Number.isFinite,
    )
      ? [bounds]
      : [];
  });
};

/** AppState's distance is measured in CSS pixels, independently of camera zoom. */
const getSnapDistance = (api: API) => {
  const distance = api.getAppState().snapToObjectsDistance;
  const zoom = api.getCamera().read(ComputedCamera).zoom;
  return Number.isFinite(distance) && zoom > 0
    ? Math.max(0, distance) / zoom
    : 0;
};

const getPointSnaps = (
  selectionSnapPoints: [number, number][],
  referenceSnapPoints: [number, number][],
  nearestSnapsX: Snaps,
  nearestSnapsY: Snaps,
  minOffset: [number, number],
) => {
  for (const thisSnapPoint of selectionSnapPoints) {
    for (const otherSnapPoint of referenceSnapPoints) {
      const offsetX = round(otherSnapPoint[0] - thisSnapPoint[0]);
      const offsetY = round(otherSnapPoint[1] - thisSnapPoint[1]);

      if (Math.abs(offsetX) <= minOffset[0]) {
        if (Math.abs(offsetX) < minOffset[0]) {
          nearestSnapsX.length = 0;
        }

        nearestSnapsX.push({
          type: 'point',
          points: [thisSnapPoint, otherSnapPoint],
          offset: offsetX,
        });

        minOffset[0] = Math.abs(offsetX);
      }

      if (Math.abs(offsetY) <= minOffset[1]) {
        if (Math.abs(offsetY) < minOffset[1]) {
          nearestSnapsY.length = 0;
        }

        nearestSnapsY.push({
          type: 'point',
          points: [thisSnapPoint, otherSnapPoint],
          offset: offsetY,
        });

        minOffset[1] = Math.abs(offsetY);
      }
    }
  }
};

const getGapSnaps = (
  bounds: AABB,
  visibleGaps: ReturnType<typeof getVisibleGaps>,
  nearestSnapsX: Snaps,
  nearestSnapsY: Snaps,
  minOffset: [number, number],
) => {
  const { horizontalGaps, verticalGaps } = visibleGaps;
  const { minX, minY, maxX, maxY } = bounds;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  for (const gap of horizontalGaps) {
    if (!rangesOverlap([minY, maxY], gap.overlap)) {
      continue;
    }

    // center gap
    const gapMidX = gap.startSide[0][0] + gap.length / 2;
    const centerOffset = round(gapMidX - centerX);
    const gapIsLargerThanSelection = gap.length > maxX - minX;

    if (gapIsLargerThanSelection && Math.abs(centerOffset) <= minOffset[0]) {
      if (Math.abs(centerOffset) < minOffset[0]) {
        nearestSnapsX.length = 0;
      }
      minOffset[0] = Math.abs(centerOffset);

      const snap: GapSnap = {
        type: 'gap',
        direction: 'center_horizontal',
        gap,
        offset: centerOffset,
      };

      nearestSnapsX.push(snap);
      continue;
    }

    // side gap, from the right
    const { maxX: endMaxX } = gap.endBounds;
    const distanceToEndElementX = minX - endMaxX;
    const sideOffsetRight = round(gap.length - distanceToEndElementX);

    if (Math.abs(sideOffsetRight) <= minOffset[0]) {
      if (Math.abs(sideOffsetRight) < minOffset[0]) {
        nearestSnapsX.length = 0;
      }
      minOffset[0] = Math.abs(sideOffsetRight);

      const snap: GapSnap = {
        type: 'gap',
        direction: 'side_right',
        gap,
        offset: sideOffsetRight,
      };
      nearestSnapsX.push(snap);
      continue;
    }

    // side gap, from the left
    const { minX: startMinX } = gap.startBounds;
    const distanceToStartElementX = startMinX - maxX;
    const sideOffsetLeft = round(distanceToStartElementX - gap.length);

    if (Math.abs(sideOffsetLeft) <= minOffset[0]) {
      if (Math.abs(sideOffsetLeft) < minOffset[0]) {
        nearestSnapsX.length = 0;
      }
      minOffset[0] = Math.abs(sideOffsetLeft);

      const snap: GapSnap = {
        type: 'gap',
        direction: 'side_left',
        gap,
        offset: sideOffsetLeft,
      };
      nearestSnapsX.push(snap);
      continue;
    }
  }

  for (const gap of verticalGaps) {
    if (!rangesOverlap([minX, maxX], gap.overlap)) {
      continue;
    }

    // center gap
    const gapMidY = gap.startSide[0][1] + gap.length / 2;
    const centerOffset = round(gapMidY - centerY);
    const gapIsLargerThanSelection = gap.length > maxY - minY;

    if (gapIsLargerThanSelection && Math.abs(centerOffset) <= minOffset[1]) {
      if (Math.abs(centerOffset) < minOffset[1]) {
        nearestSnapsY.length = 0;
      }
      minOffset[1] = Math.abs(centerOffset);

      const snap: GapSnap = {
        type: 'gap',
        direction: 'center_vertical',
        gap,
        offset: centerOffset,
      };

      nearestSnapsY.push(snap);
      continue;
    }

    // side gap, from the top
    const { minY: startMinY } = gap.startBounds;
    const distanceToStartElementY = startMinY - maxY;
    const sideOffsetTop = round(distanceToStartElementY - gap.length);

    if (Math.abs(sideOffsetTop) <= minOffset[1]) {
      if (Math.abs(sideOffsetTop) < minOffset[1]) {
        nearestSnapsY.length = 0;
      }
      minOffset[1] = Math.abs(sideOffsetTop);

      const snap: GapSnap = {
        type: 'gap',
        direction: 'side_top',
        gap,
        offset: sideOffsetTop,
      };
      nearestSnapsY.push(snap);
      continue;
    }

    // side gap, from the bottom
    const { maxY: endMaxY } = gap.endBounds;
    const distanceToEndElementY = round(minY - endMaxY);
    const sideOffsetBottom = gap.length - distanceToEndElementY;

    if (Math.abs(sideOffsetBottom) <= minOffset[1]) {
      if (Math.abs(sideOffsetBottom) < minOffset[1]) {
        nearestSnapsY.length = 0;
      }
      minOffset[1] = Math.abs(sideOffsetBottom);

      const snap: GapSnap = {
        type: 'gap',
        direction: 'side_bottom',
        gap,
        offset: sideOffsetBottom,
      };
      nearestSnapsY.push(snap);
      continue;
    }
  }
};

const getVisibleGaps = (referenceBounds: AABB[]) => {
  const horizontallySorted = referenceBounds.sort((a, b) => a.minX - b.minX);

  const horizontalGaps: Gap[] = [];

  let c = 0;
  horizontal: for (let i = 0; i < horizontallySorted.length; i++) {
    const startBounds = horizontallySorted[i];

    for (let j = i + 1; j < horizontallySorted.length; j++) {
      if (++c > VISIBLE_GAPS_LIMIT_PER_AXIS) {
        break horizontal;
      }

      const endBounds = horizontallySorted[j];

      const { minY: startMinY, maxX: startMaxX, maxY: startMaxY } = startBounds;
      const { minX: endMinX, minY: endMinY, maxY: endMaxY } = endBounds;

      if (
        startMaxX < endMinX &&
        rangesOverlap([startMinY, startMaxY], [endMinY, endMaxY])
      ) {
        horizontalGaps.push({
          startBounds,
          endBounds,
          startSide: [
            [startMaxX, startMinY],
            [startMaxX, startMaxY],
          ],
          endSide: [
            [endMinX, endMinY],
            [endMinX, endMaxY],
          ],
          length: endMinX - startMaxX,
          overlap: rangeIntersection(
            [startMinY, startMaxY],
            [endMinY, endMaxY],
          )!,
        });
      }
    }
  }

  const verticallySorted = referenceBounds.sort((a, b) => a.minY - b.minY);

  const verticalGaps: Gap[] = [];

  c = 0;

  vertical: for (let i = 0; i < verticallySorted.length; i++) {
    const startBounds = verticallySorted[i];

    for (let j = i + 1; j < verticallySorted.length; j++) {
      if (++c > VISIBLE_GAPS_LIMIT_PER_AXIS) {
        break vertical;
      }
      const endBounds = verticallySorted[j];

      const { minX: startMinX, maxX: startMaxX, maxY: startMaxY } = startBounds;
      const { minX: endMinX, minY: endMinY, maxX: endMaxX } = endBounds;

      if (
        startMaxY < endMinY &&
        rangesOverlap([startMinX, startMaxX], [endMinX, endMaxX])
      ) {
        verticalGaps.push({
          startBounds,
          endBounds,
          startSide: [
            [startMinX, startMaxY],
            [startMaxX, startMaxY],
          ],
          endSide: [
            [endMinX, endMinY],
            [endMaxX, endMinY],
          ],
          length: endMinY - startMaxY,
          overlap: rangeIntersection(
            [startMinX, startMaxX],
            [endMinX, endMaxX],
          )!,
        });
      }
    }
  }

  return {
    horizontalGaps,
    verticalGaps,
  };
};

/** Calculate from unsnapped geometry; callers must never feed the last snap back in. */
export const snapDraggedElements = (
  api: API,
  dragOffset: [number, number],
  previousSnapOffset?: [number, number],
  selectionBounds = api.getGeometryBounds(
    api.getAppState().layersSelected.map((id) => api.getNodeById(id)),
  ),
) => {
  if (
    !api.getAppState().snapToObjectsEnabled ||
    !api.getAppState().layersSelected.length
  ) {
    return {
      snapOffset: [0, 0] as [number, number],
      snapLines: [] as SnapLine[],
    };
  }
  const references = getReferenceBounds(api);
  const referencePoints = references.flatMap(getBoundsSnapPoints);
  const gaps = getVisibleGaps(references);
  const candidate = offsetBounds(selectionBounds, dragOffset);
  const distance = getSnapDistance(api);
  const minOffset: [number, number] = [distance, distance];
  const nearestSnapsX: Snaps = [];
  const nearestSnapsY: Snaps = [];
  getPointSnaps(
    getBoundsSnapPoints(candidate),
    referencePoints,
    nearestSnapsX,
    nearestSnapsY,
    minOffset,
  );
  getGapSnaps(candidate, gaps, nearestSnapsX, nearestSnapsY, minOffset);

  const pickStableSnap = (snaps: Snaps, axis: 0 | 1): number => {
    const previous = previousSnapOffset?.[axis];
    return (
      snaps.find((snap) => round(snap.offset) === round(previous))?.offset ??
      snaps[0]?.offset ??
      0
    );
  };
  const snapOffset: [number, number] = [
    pickStableSnap(nearestSnapsX, 0),
    pickStableSnap(nearestSnapsY, 1),
  ];
  const snapped = offsetBounds(candidate, snapOffset);
  minOffset[0] = minOffset[1] = 0.000001;
  nearestSnapsX.length = nearestSnapsY.length = 0;
  getPointSnaps(
    getBoundsSnapPoints(snapped),
    referencePoints,
    nearestSnapsX,
    nearestSnapsY,
    minOffset,
  );
  getGapSnaps(snapped, gaps, nearestSnapsX, nearestSnapsY, minOffset);
  return {
    snapOffset,
    snapLines: [
      ...createPointSnapLines(nearestSnapsX, nearestSnapsY),
      ...createGapSnapLines(
        snapped,
        [...nearestSnapsX, ...nearestSnapsY].filter(
          (snap) => snap.type === 'gap',
        ) as GapSnap[],
      ),
    ],
  };
};

/** Snap only the moving resize handle. A direction preserves side/aspect constraints. */
export const snapResizingElements = (
  api: API,
  point: [number, number],
  direction?: [number, number],
) => {
  if (!api.getAppState().snapToObjectsEnabled) {
    return {
      snapOffset: [0, 0] as [number, number],
      snapLines: [] as SnapLine[],
    };
  }
  const referencePoints = getReferenceBounds(api).flatMap(getBoundsSnapPoints);
  const distance = getSnapDistance(api);
  const snapsX: Snaps = [];
  const snapsY: Snaps = [];
  const minOffset: [number, number] = [distance, distance];
  let snapOffset: [number, number];
  let unit: [number, number];
  if (direction) {
    const length = Math.hypot(...direction);
    if (!length)
      return {
        snapOffset: [0, 0] as [number, number],
        snapLines: [] as SnapLine[],
      };
    unit = [direction[0] / length, direction[1] / length];
    let nearest = Infinity;
    for (const reference of referencePoints) {
      for (const axis of [0, 1] as const) {
        if (Math.abs(unit[axis]) < 0.000001) continue;
        const movement = round((reference[axis] - point[axis]) / unit[axis]);
        if (
          Math.abs(movement) <= distance &&
          Math.abs(movement) < Math.abs(nearest)
        )
          nearest = movement;
      }
    }
    snapOffset = Number.isFinite(nearest)
      ? [unit[0] * nearest, unit[1] * nearest]
      : [0, 0];
  } else {
    getPointSnaps([point], referencePoints, snapsX, snapsY, minOffset);
    snapOffset = [snapsX[0]?.offset ?? 0, snapsY[0]?.offset ?? 0];
  }
  snapsX.length = snapsY.length = 0;
  getPointSnaps(
    [[point[0] + snapOffset[0], point[1] + snapOffset[1]]],
    referencePoints,
    snapsX,
    snapsY,
    [0.000001, 0.000001],
  );
  if (unit && Math.abs(unit[0]) < 0.000001) snapsX.length = 0;
  if (unit && Math.abs(unit[1]) < 0.000001) snapsY.length = 0;
  return { snapOffset, snapLines: createPointSnapLines(snapsX, snapsY) };
};

const createPointSnapLines = (
  nearestSnapsX: Snaps,
  nearestSnapsY: Snaps,
): PointSnapLine[] => {
  const snapsX = {} as { [key: string]: [number, number][] };
  const snapsY = {} as { [key: string]: [number, number][] };

  if (nearestSnapsX.length > 0) {
    for (const snap of nearestSnapsX) {
      if (snap.type === 'point') {
        const key = round(snap.points[0][0]);
        if (!snapsX[key]) {
          snapsX[key] = [];
        }
        snapsX[key].push(
          ...snap.points.map<[number, number]>((p) => [
            round(p[0]),
            round(p[1]),
          ]),
        );
      }
    }
  }

  if (nearestSnapsY.length > 0) {
    for (const snap of nearestSnapsY) {
      if (snap.type === 'point') {
        const key = round(snap.points[0][1]);
        if (!snapsY[key]) {
          snapsY[key] = [];
        }
        snapsY[key].push(
          ...snap.points.map<[number, number]>((p) => [
            round(p[0]),
            round(p[1]),
          ]),
        );
      }
    }
  }

  return Object.entries(snapsX)
    .map(([key, points]) => {
      return {
        type: 'points' as const,
        points: dedupePoints(
          points
            .map<[number, number]>((p) => {
              return [Number(key), p[1]];
            })
            .sort((a, b) => a[1] - b[1]),
        ),
      };
    })
    .concat(
      Object.entries(snapsY).map(([key, points]) => {
        return {
          type: 'points' as const,
          points: dedupePoints(
            points
              .map<[number, number]>((p) => {
                return [p[0], Number(key)];
              })
              .sort((a, b) => a[0] - b[0]),
          ),
        };
      }),
    );
};

const createGapSnapLines = (bounds: AABB, gapSnaps: GapSnap[]) => {
  const gapSnapLines: GapSnapLine[] = [];
  const { minX, minY, maxX, maxY } = bounds;

  for (const gapSnap of gapSnaps) {
    const {
      minX: startMinX,
      minY: startMinY,
      maxX: startMaxX,
      maxY: startMaxY,
    } = gapSnap.gap.startBounds;
    const {
      minX: endMinX,
      minY: endMinY,
      maxX: endMaxX,
      maxY: endMaxY,
    } = gapSnap.gap.endBounds;

    const verticalIntersection = rangeIntersection(
      [minY, maxY],
      gapSnap.gap.overlap,
    );

    const horizontalGapIntersection = rangeIntersection(
      [minX, maxX],
      gapSnap.gap.overlap,
    );

    switch (gapSnap.direction) {
      case 'center_horizontal': {
        if (verticalIntersection) {
          const gapLineY =
            (verticalIntersection[0] + verticalIntersection[1]) / 2;

          gapSnapLines.push(
            {
              type: 'gap',
              direction: 'horizontal',
              points: [
                [gapSnap.gap.startSide[0][0], gapLineY],
                [minX, gapLineY],
              ],
            },
            {
              type: 'gap',
              direction: 'horizontal',
              points: [
                [maxX, gapLineY],
                [gapSnap.gap.endSide[0][0], gapLineY],
              ],
            },
          );
        }
        break;
      }
      case 'center_vertical': {
        if (horizontalGapIntersection) {
          const gapLineX =
            (horizontalGapIntersection[0] + horizontalGapIntersection[1]) / 2;

          gapSnapLines.push(
            {
              type: 'gap',
              direction: 'vertical',
              points: [
                [gapLineX, gapSnap.gap.startSide[0][1]],
                [gapLineX, minY],
              ],
            },
            {
              type: 'gap',
              direction: 'vertical',
              points: [
                [gapLineX, maxY],
                [gapLineX, gapSnap.gap.endSide[0][1]],
              ],
            },
          );
        }
        break;
      }
      case 'side_right': {
        if (verticalIntersection) {
          const gapLineY =
            (verticalIntersection[0] + verticalIntersection[1]) / 2;

          gapSnapLines.push(
            {
              type: 'gap',
              direction: 'horizontal',
              points: [
                [startMaxX, gapLineY],
                [endMinX, gapLineY],
              ],
            },
            {
              type: 'gap',
              direction: 'horizontal',
              points: [
                [endMaxX, gapLineY],
                [minX, gapLineY],
              ],
            },
          );
        }
        break;
      }
      case 'side_left': {
        if (verticalIntersection) {
          const gapLineY =
            (verticalIntersection[0] + verticalIntersection[1]) / 2;

          gapSnapLines.push(
            {
              type: 'gap',
              direction: 'horizontal',
              points: [
                [maxX, gapLineY],
                [startMinX, gapLineY],
              ],
            },
            {
              type: 'gap',
              direction: 'horizontal',
              points: [
                [startMaxX, gapLineY],
                [endMinX, gapLineY],
              ],
            },
          );
        }
        break;
      }
      case 'side_top': {
        if (horizontalGapIntersection) {
          const gapLineX =
            (horizontalGapIntersection[0] + horizontalGapIntersection[1]) / 2;

          gapSnapLines.push(
            {
              type: 'gap',
              direction: 'vertical',
              points: [
                [gapLineX, maxY],
                [gapLineX, startMinY],
              ],
            },
            {
              type: 'gap',
              direction: 'vertical',
              points: [
                [gapLineX, startMaxY],
                [gapLineX, endMinY],
              ],
            },
          );
        }
        break;
      }
      case 'side_bottom': {
        if (horizontalGapIntersection) {
          const gapLineX =
            (horizontalGapIntersection[0] + horizontalGapIntersection[1]) / 2;

          gapSnapLines.push(
            {
              type: 'gap',
              direction: 'vertical',
              points: [
                [gapLineX, startMaxY],
                [gapLineX, endMinY],
              ],
            },
            {
              type: 'gap',
              direction: 'vertical',
              points: [
                [gapLineX, endMaxY],
                [gapLineX, minY],
              ],
            },
          );
        }
        break;
      }
    }
  }

  return gapSnapLines;
};

export const calculateOffset = (
  commonBounds: [number, number],
  dragOffset: [number, number],
  snapOffset: [number, number],
  gridSize: number,
): [number, number] => {
  const [x, y] = commonBounds;
  let nextX = x + dragOffset[0] + snapOffset[0];
  let nextY = y + dragOffset[1] + snapOffset[1];

  if (snapOffset[0] === 0 || snapOffset[1] === 0) {
    // Round before grid snap to avoid floating-point boundary jitter (e.g. 7.9999999 vs 8.0000001)
    const [nextGridX, nextGridY] = getGridPoint(
      round(x + dragOffset[0]),
      round(y + dragOffset[1]),
      gridSize,
    );

    if (snapOffset[0] === 0) {
      nextX = nextGridX;
    }

    if (snapOffset[1] === 0) {
      nextY = nextGridY;
    }
  }
  return [nextX - x, nextY - y];
};

export const getGridPoint = (
  x: number,
  y: number,
  gridSize: number,
): [number, number] => {
  if (gridSize) {
    return [
      Math.round(x / gridSize) * gridSize,
      Math.round(y / gridSize) * gridSize,
    ];
  }
  return [x, y];
};
