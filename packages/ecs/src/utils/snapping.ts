/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/f55ecb96cc8db9a2417d48cd8077833c3822d64e/packages/excalidraw/snapping.ts
 */

import { AABB, API, Culled, Selected } from '..';
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

const getElementsCorners = (
  api: API,
  elements: string[],
  dragOffset?: [number, number],
) => {
  let { minX, minY, maxX, maxY } = api.getGeometryBounds(
    elements.map((id) => api.getNodeById(id)),
  );

  if (dragOffset) {
    minX += dragOffset[0];
    minY += dragOffset[1];
    maxX += dragOffset[0];
    maxY += dragOffset[1];
  }

  const boundsWidth = maxX - minX;
  const boundsHeight = maxY - minY;
  return [
    [minX, minY],
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
    [minX + boundsWidth / 2, minY + boundsHeight / 2],
  ] as [number, number][];
};

const getPointSnaps = (
  api: API,
  selectionSnapPoints: [number, number][],
  nearestSnapsX: Snaps,
  nearestSnapsY: Snaps,
  minOffset: [number, number],
) => {
  const { layersSelected } = api.getAppState();
  if (layersSelected.length === 0) {
    return [];
  }

  const unculledAndUnselected = api
    .getNodes()
    .map((node) => api.getEntity(node))
    .filter((entity) => !entity.has(Culled) && !entity.has(Selected));

  // Snap points of other elements.
  const referenceSnapPoints: [number, number][] = unculledAndUnselected
    .map((entity) => getElementsCorners(api, [api.getNodeByEntity(entity).id]))
    .flat();

  for (const thisSnapPoint of selectionSnapPoints) {
    for (const otherSnapPoint of referenceSnapPoints) {
      const offsetX = otherSnapPoint[0] - thisSnapPoint[0];
      const offsetY = otherSnapPoint[1] - thisSnapPoint[1];

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
  api: API,
  dragOffset: [number, number],
  nearestSnapsX: Snaps,
  nearestSnapsY: Snaps,
  minOffset: [number, number],
) => {
  const { layersSelected } = api.getAppState();
  if (layersSelected.length === 0) {
    return [];
  }

  const visibleGaps = getVisibleGaps(api);
  if (visibleGaps) {
    const { horizontalGaps, verticalGaps } = visibleGaps;

    // Account for the dragOffset
    let { minX, minY, maxX, maxY } = api.getGeometryBounds(
      layersSelected.map((id) => api.getNodeById(id)),
    );
    minX += dragOffset[0];
    minY += dragOffset[1];
    maxX += dragOffset[0];
    maxY += dragOffset[1];
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
  }
};

const getVisibleGaps = (api: API) => {
  // Unculled and unselected elements
  const referenceBounds = api
    .getNodes() // TODO: account for groups
    .map((node) => api.getEntity(node))
    .filter((entity) => !entity.has(Culled) && !entity.has(Selected))
    .map((entity) => api.getGeometryBounds([api.getNodeByEntity(entity)]));

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

export const snapDraggedElements = (api: API, dragOffset: [number, number]) => {
  const { snapToObjectsEnabled, snapToObjectsDistance, layersSelected } =
    api.getAppState();
  if (!snapToObjectsEnabled) {
    return {
      snapOffset: [0, 0] as [number, number],
      snapLines: [],
    };
  }

  const selected = layersSelected;

  dragOffset[0] = round(dragOffset[0]);
  dragOffset[1] = round(dragOffset[1]);
  const nearestSnapsX: Snaps = [];
  const nearestSnapsY: Snaps = [];
  const minOffset = [snapToObjectsDistance, snapToObjectsDistance] as [
    number,
    number,
  ];

  const selectionSnapPoints = getElementsCorners(api, selected);

  // get the nearest horizontal and vertical point and gap snaps
  getPointSnaps(
    api,
    selectionSnapPoints,
    nearestSnapsX,
    nearestSnapsY,
    minOffset,
  );

  // Get gap snaps
  getGapSnaps(api, dragOffset, nearestSnapsX, nearestSnapsY, minOffset);

  // using the nearest snaps to figure out how
  // much the elements need to be offset to be snapped
  // to some reference elements
  const snapOffset: [number, number] = [
    nearestSnapsX[0]?.offset ?? 0,
    nearestSnapsY[0]?.offset ?? 0,
  ];

  // once the elements are snapped
  // and moved to the snapped position
  // we want to use the element's snapped position
  // to update nearest snaps so that we can create
  // point and gap snap lines correctly without any shifting

  minOffset[0] = 0;
  minOffset[1] = 0;
  nearestSnapsX.length = 0;
  nearestSnapsY.length = 0;
  const newDragOffset: [number, number] = [
    round(dragOffset[0] + snapOffset[0]),
    round(dragOffset[1] + snapOffset[1]),
  ];

  getPointSnaps(
    api,
    getElementsCorners(api, selected, newDragOffset),
    nearestSnapsX,
    nearestSnapsY,
    minOffset,
  );

  getGapSnaps(api, newDragOffset, nearestSnapsX, nearestSnapsY, minOffset);

  const pointSnapLines = createPointSnapLines(nearestSnapsX, nearestSnapsY);

  const gapSnapLines = createGapSnapLines(
    api,
    newDragOffset,
    [...nearestSnapsX, ...nearestSnapsY].filter(
      (snap) => snap.type === 'gap',
    ) as GapSnap[],
  );

  return {
    snapOffset,
    snapLines: [...pointSnapLines, ...gapSnapLines],
  };
};

const createPointSnapLines = (nearestSnapsX: Snaps, nearestSnapsY: Snaps) => {
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
        type: 'points',
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
          type: 'points',
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

const createGapSnapLines = (
  api: API,
  dragOffset: [number, number],
  gapSnaps: GapSnap[],
) => {
  const gapSnapLines: GapSnapLine[] = [];

  let { minX, minY, maxX, maxY } = api.getGeometryBounds(
    api.getAppState().layersSelected.map((id) => api.getNodeById(id)),
  );
  minX += dragOffset[0];
  minY += dragOffset[1];
  maxX += dragOffset[0];
  maxY += dragOffset[1];

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
    const [nextGridX, nextGridY] = getGridPoint(
      x + dragOffset[0],
      y + dragOffset[1],
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
