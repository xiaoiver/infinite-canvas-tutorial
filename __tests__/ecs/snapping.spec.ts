import { AABB, API } from '../../packages/ecs/src';
import { getElementsCorners } from '../../packages/ecs/src/utils/snapping';

const createApi = (nodes: Record<string, any>, bounds: AABB) =>
  ({
    getGeometryBounds: () => bounds,
    getNodeById: (id: string) => nodes[id],
  }) as unknown as API;

describe('getElementsCorners', () => {
  it('should return bounding box corners and center for a rect', () => {
    const nodes = {
      r: { id: 'r', type: 'rect', x: 0, y: 0, width: 100, height: 50 },
    };
    const api = createApi(nodes, new AABB(0, 0, 100, 50));

    const corners = getElementsCorners(api, ['r']);
    expect(corners).toEqual([
      [0, 0],
      [100, 0],
      [0, 50],
      [100, 50],
      [50, 25],
    ]);
  });

  it('should use the anchor point of a single text element instead of the top-left corner', () => {
    // `textAlign: center` => anchor is horizontally centered within the bounds.
    const nodes = {
      t: {
        id: 't',
        type: 'text',
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        anchorX: 50,
        anchorY: 16,
        textAlign: 'center',
        textBaseline: 'alphabetic',
      },
    };
    const api = createApi(nodes, new AABB(0, 0, 100, 20));

    const corners = getElementsCorners(api, ['t']);
    // First point is the anchor (minX + anchorX, minY + anchorY) instead of [minX, minY].
    expect(corners[0]).toEqual([50, 16]);
    expect(corners.slice(1)).toEqual([
      [100, 0],
      [0, 20],
      [100, 20],
      [50, 10],
    ]);
  });

  it('should apply the drag offset to the text anchor point', () => {
    const nodes = {
      t: {
        id: 't',
        type: 'text',
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        anchorX: 0,
        anchorY: 16,
        textAlign: 'start',
        textBaseline: 'alphabetic',
      },
    };
    const api = createApi(nodes, new AABB(0, 0, 100, 20));

    const corners = getElementsCorners(api, ['t'], [10, 5]);
    // anchor = (minX + anchorX, minY + anchorY) with the drag offset applied.
    expect(corners[0]).toEqual([10, 21]);
  });

  it('should fall back to bounding box corners for a rotated text element', () => {
    const nodes = {
      t: {
        id: 't',
        type: 'text',
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        anchorX: 50,
        anchorY: 16,
        rotation: 0.5,
      },
    };
    const api = createApi(nodes, new AABB(0, 0, 100, 20));

    const corners = getElementsCorners(api, ['t']);
    expect(corners[0]).toEqual([0, 0]);
  });
});
