import { API } from '@infinite-canvas-tutorial/ecs';

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

  console.log('elements', elements);
}
