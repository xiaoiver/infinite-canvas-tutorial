import type { VectorNetworkSerializedNode } from '@infinite-canvas-tutorial/ecs';

/**
 * Wireframe cube for Vector Network demos (alexharri.com / Figma classic example).
 * 7 vertices, 9 segments.
 *   6 -------- 5
 *  /         / |
 * 3 -------- 2 |
 * |         | /4
 * |         |/
 * 0 -------- 1
 */
export const VECTOR_NETWORK_CUBE: Pick<
  VectorNetworkSerializedNode,
  'vertices' | 'segments'
> = {
  vertices: [
    { x: 0, y: 80 },
    { x: 80, y: 80 },
    { x: 80, y: 0 },
    { x: 0, y: 0 },
    { x: 110, y: 50 },
    { x: 110, y: -30 },
    { x: 30, y: -30 },
  ],
  segments: [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
    { start: 2, end: 3 },
    { start: 3, end: 0 },
    { start: 3, end: 6 },
    { start: 6, end: 5 },
    { start: 2, end: 5 },
    { start: 1, end: 4 },
    { start: 4, end: 5 },
  ],
};

export function createVectorNetworkCubeNode(
  overrides: Partial<VectorNetworkSerializedNode> = {},
): VectorNetworkSerializedNode {
  return {
    type: 'vector-network',
    id: 'vn-cube',
    zIndex: 2,
    x: 120,
    y: 80,
    strokes: [{ type: 'solid', value: '#147af3', opacity: 1 }],
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...VECTOR_NETWORK_CUBE,
    ...overrides,
  };
}
