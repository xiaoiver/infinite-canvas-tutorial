import type { Entity } from '@lastolivegames/becsy';
import { Material3D, Transform3D } from '../components';

export function sameNumbers(
  a: readonly number[],
  b: readonly number[],
): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** Avoid publishing ECS change notifications for an unchanged derived pose. */
export function syncTransform3D(entity: Entity, pose: Transform3D): void {
  const current = entity.read(Transform3D);
  if (
    (['translation', 'rotation', 'scale'] as const).some(
      (key) => !sameNumbers(current[key], pose[key]),
    )
  )
    Object.assign(entity.write(Transform3D), pose);
}

/** Scalar material fields use Becsy float32 storage; compare after conversion. */
export function syncMaterial3D(
  entity: Entity,
  patch: Partial<Material3D>,
): void {
  const current = entity.read(Material3D);
  const changed = (Object.keys(patch) as (keyof Material3D)[]).some((key) => {
    const value = patch[key];
    if (key === 'baseColor')
      return !sameNumbers(current.baseColor, patch.baseColor!);
    return (
      current[key] !== (typeof value === 'number' ? Math.fround(value) : value)
    );
  });
  if (changed) Object.assign(entity.write(Material3D), patch);
}
