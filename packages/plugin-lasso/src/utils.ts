import { isPolygonsIntersect } from '@antv/util';
import { API, Rect } from '@infinite-canvas-tutorial/ecs';

export function selectByLassoPath(api: API, lassoPath: [number, number][]) {
  const lassoBounds = lassoPath.reduce(
    (acc, item) => {
      return [
        Math.min(acc[0], item[0]),
        Math.min(acc[1], item[1]),
        Math.max(acc[2], item[0]),
        Math.max(acc[3], item[1]),
      ];
    },
    [Infinity, Infinity, -Infinity, -Infinity],
  ) as [number, number, number, number];

  const elements = api.elementsFromBBox(
    lassoBounds[0],
    lassoBounds[1],
    lassoBounds[2],
    lassoBounds[3],
  );

  // TODO: filter locked elements
  const selectedElements = [];

  elements.forEach((e) => {
    const points = [];
    if (e.has(Rect)) {
      // FIXME: Account for the global transform
      const { x, y, width, height } = api.getNodeByEntity(e);
      points.push(
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
      );
    }

    if (points.length === 0) {
      return;
    }

    if (isPolygonsIntersect(lassoPath, points)) {
      selectedElements.push(e);
    }
  });

  return selectedElements;
}
