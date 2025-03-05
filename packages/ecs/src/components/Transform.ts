import { trait } from 'koota';
import { Transform as PixiTransform } from '@pixi/math';

/**
 * @example
 * ```ts
 * // Get the transform
 * const transform = entity.get(Transform);
 *
 * // Set the transform
 * entity.set(Transform, (transform) => {
 *   transform.position.set(100, 100);
 *   return transform;
 * });
 * ```
 */
export const Transform = trait(() => new PixiTransform());
