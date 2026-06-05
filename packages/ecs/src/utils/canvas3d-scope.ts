import type { Entity } from '@lastolivegames/becsy';
import { Camera, Canvas3DScope, Children } from '../components';
import { isEntityAlive } from '../systems/Transform';

/** Walk scene graph to the owning 2D {@link Camera} canvas. */
export function resolveCanvasFromSceneGraph(entity: Entity): Entity | undefined {
  let current: Entity | undefined = entity;
  const visited = new Set<Entity>();

  while (current && !visited.has(current)) {
    visited.add(current);
    if (current.has(Canvas3DScope)) {
      return current.read(Canvas3DScope).canvas;
    }
    if (current.has(Camera)) {
      const canvas = current.read(Camera).canvas;
      if (canvas) {
        return canvas;
      }
    }
    if (current.has(Children)) {
      current = current.read(Children).parent;
    } else {
      break;
    }
  }

  return undefined;
}

export function entityBelongsToCanvas(
  entity: Entity,
  canvas: Entity,
  canvasCount: number,
): boolean {
  if (entity.has(Canvas3DScope)) {
    const scopedCanvas = entity.read(Canvas3DScope).canvas;
    return isEntityAlive(scopedCanvas) && scopedCanvas === canvas;
  }
  return canvasCount === 1;
}

export function findCamera3DForCanvas(
  cameras3D: readonly Entity[],
  canvas: Entity,
  canvasCount: number,
): Entity | undefined {
  for (const camera of cameras3D) {
    if (!isEntityAlive(camera)) {
      continue;
    }
    if (camera.has(Canvas3DScope)) {
      const scopedCanvas = camera.read(Canvas3DScope).canvas;
      if (isEntityAlive(scopedCanvas) && scopedCanvas === canvas) {
        return camera;
      }
      continue;
    }
    if (canvasCount === 1) {
      return camera;
    }
  }
  return undefined;
}

export function findCamera2DForCanvas(
  cameras2D: readonly Entity[],
  canvas: Entity,
): Entity | undefined {
  return cameras2D.find(
    (e) => e.has(Camera) && e.read(Camera).canvas === canvas,
  );
}

export function filterEntitiesForCanvas(
  entities: readonly Entity[],
  canvas: Entity,
  canvasCount: number,
): Entity[] {
  return entities.filter((e) => entityBelongsToCanvas(e, canvas, canvasCount));
}
