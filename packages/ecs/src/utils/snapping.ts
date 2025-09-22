/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/f55ecb96cc8db9a2417d48cd8077833c3822d64e/packages/excalidraw/snapping.ts
 */

import { AABB, API, Culled, Selected } from '..';
import { rangeIntersection, rangesOverlap } from './math';

const round = (x: number) => {
  const decimalPlaces = 6;
  return Math.round(x * 10 ** decimalPlaces) / 10 ** decimalPlaces;
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

const VISIBLE_GAPS_LIMIT_PER_AXIS = 99999;

const SNAP_DISTANCE = 8;
// snap distance with zoom value taken into consideration
export const getSnapDistance = (zoomValue: number) => {
  return SNAP_DISTANCE / zoomValue;
};

const getElementsCorners = (api: API, elements: string[]) => {
  const { minX, minY, maxX, maxY } = api.getGeometryBounds(
    elements.map((id) => api.getNodeById(id)),
  );
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

  const unculled = api
    .getNodes()
    .map((node) => api.getEntity(node))
    .filter((entity) => !entity.has(Culled));

  // Snap points of other elements.
  const referenceSnapPoints: [number, number][] = unculled
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

    console.log('horizontalGaps', horizontalGaps);
    console.log('verticalGaps', verticalGaps);
  }
};

const getVisibleGaps = (api: API) => {
  // Unculled and unselected elements
  const referenceBounds = api
    .getNodes()
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

  const verticallySorted = referenceBounds.sort((a, b) => a[1] - b[1]);

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

export const snapDraggedElements = (dragOffset: [number, number], api: API) => {
  const { snapToObjectsEnabled, cameraZoom, layersSelected } =
    api.getAppState();
  if (!snapToObjectsEnabled) {
    return {
      snapOffset: {
        x: 0,
        y: 0,
      },
      snapLines: [],
    };
  }

  const selected = layersSelected;

  dragOffset[0] = round(dragOffset[0]);
  dragOffset[1] = round(dragOffset[1]);
  const nearestSnapsX: Snaps = [];
  const nearestSnapsY: Snaps = [];
  const snapDistance = getSnapDistance(cameraZoom);
  const minOffset = [snapDistance, snapDistance] as [number, number];

  // Snap points itself.
  const selectionSnapPoints = getElementsCorners(api, selected);

  // Get point snaps
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
  const snapOffset = {
    x: nearestSnapsX[0]?.offset ?? 0,
    y: nearestSnapsY[0]?.offset ?? 0,
  };

  // const selectionPoints = getElementsCorners(selectedElements, elementsMap, {
  //   dragOffset,
  // });
};
