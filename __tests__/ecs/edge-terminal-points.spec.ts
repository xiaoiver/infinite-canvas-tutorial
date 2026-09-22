import { inferEdgePoints, inferXYWidthHeight } from '../../packages/ecs/src/utils/deserialize/entity';
import type { EdgeState } from '../../packages/ecs/src/utils/binding/connection';

describe('edge sourcePoint / targetPoint (no fromId / toId)', () => {
  it('infers line geometry from terminal points only', () => {
    const edge = {
      id: 'e-float',
      type: 'line' as const,
      zIndex: 0,
      sourcePoint: { x: 10, y: 20 },
      targetPoint: { x: 110, y: 70 },
    };
    inferEdgePoints(null, null, edge as unknown as EdgeState);
    inferXYWidthHeight(edge as any);
    // inferXYWidthHeight 将线归一化到 AABB 左上为 (0,0)
    expect(edge.x1).toBe(0);
    expect(edge.y1).toBe(0);
    expect(edge.x2).toBe(100);
    expect(edge.y2).toBe(50);
    expect(edge.x).toBe(10);
    expect(edge.y).toBe(20);
  });
});
