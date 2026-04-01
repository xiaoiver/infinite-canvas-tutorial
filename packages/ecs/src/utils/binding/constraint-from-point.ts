import type { SerializedNode } from '../../types/serialized-node';
import { inferXYWidthHeight } from '../deserialize/entity';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Normalized connection constraint from a canvas-space point on a node (draw.io style).
 */
export function constraintAttrsFromCanvasPoint(
  node: SerializedNode,
  canvasX: number,
  canvasY: number,
): { x: number; y: number; perimeter: boolean; dx: number; dy: number } {
  inferXYWidthHeight(node);
  const { x, y, width, height } = node as SerializedNode & {
    width: number;
    height: number;
  };
  const nx = width > 0 ? clamp((canvasX - x) / width, 0, 1) : 0.5;
  const ny = height > 0 ? clamp((canvasY - y) / height, 0, 1) : 0.5;
  return { x: nx, y: ny, perimeter: true, dx: 0, dy: 0 };
}
