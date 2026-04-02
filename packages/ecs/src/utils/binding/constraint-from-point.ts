import type { SerializedNode } from '../../types/serialized-node';
import { inferXYWidthHeight } from '../deserialize/entity';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function rotateAround(px: number, py: number, cx: number, cy: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
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
    rotation?: number;
  };
  const rotation = (node as SerializedNode & { rotation?: number }).rotation ?? 0;
  const unrotated = rotation === 0
    ? { x: canvasX, y: canvasY }
    : rotateAround(canvasX, canvasY, x, y, -rotation);
  const nx = width > 0 ? clamp((unrotated.x - x) / width, 0, 1) : 0.5;
  const ny = height > 0 ? clamp((unrotated.y - y) / height, 0, 1) : 0.5;
  return { x: nx, y: ny, perimeter: true, dx: 0, dy: 0 };
}
