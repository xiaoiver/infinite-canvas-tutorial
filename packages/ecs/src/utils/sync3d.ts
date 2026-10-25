import type { Entity } from '@lastolivegames/becsy';
import { Material3D, Transform3D } from '../components';
import type { Material3DTextureTransform } from '../components/geometry3d/Material3D';

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
    if (
      key === 'baseColor' ||
      key === 'outlineColor' ||
      key === 'rimLightColor'
    )
      return !sameNumbers(current[key], patch[key]!);
    if (key === 'emissiveFactor')
      return !sameNumbers(current.emissiveFactor, patch.emissiveFactor!);
    if (key === 'sideColor')
      return current.sideColor === null
        ? patch.sideColor !== null
        : patch.sideColor === null ||
            !sameNumbers(current.sideColor, patch.sideColor!);
    if (
      key === 'mapTextureTransform' ||
      key === 'metallicRoughnessTextureTransform' ||
      key === 'emissiveTextureTransform' ||
      key === 'normalTextureTransform' ||
      key === 'occlusionTextureTransform'
    ) {
      const previous = current[key];
      const next = value as Material3DTextureTransform | null;
      if (previous === null || next === null) return previous !== next;
      return (
        !sameNumbers(previous.offset ?? [0, 0], next.offset ?? [0, 0]) ||
        !sameNumbers(previous.scale ?? [1, 1], next.scale ?? [1, 1]) ||
        (previous.rotation ?? 0) !== (next.rotation ?? 0)
      );
    }
    return (
      current[key] !== (typeof value === 'number' ? Math.fround(value) : value)
    );
  });
  if (changed) Object.assign(entity.write(Material3D), patch);
}
