import type { API } from '../../packages/ecs/src/API';
import {
  AABB,
  ComputedCamera,
  ComputedVisibility,
  Culled,
  Transformable,
  type Entity,
} from '../../packages/ecs/src';
import { getDefaultAppState } from '../../packages/ecs/src/context';
import type { SerializedNode } from '../../packages/ecs/src/types/serialized-node';

export interface SnapObject {
  id: string;
  bounds: AABB;
  parentId?: string;
  visible?: boolean;
  culled?: boolean;
  missing?: boolean;
  lockAspectRatio?: boolean;
}

// Only the scene-read boundary is substituted. Tests execute the production
// snapping and resize calculations without a renderer, timers or GPU context.
export function createSnappingScene(objects: SnapObject[], zoom = 1) {
  const state = {
    ...getDefaultAppState(),
    layersSelected: ['selected'],
    snapToObjectsEnabled: true,
    snapToObjectsDistance: 5,
    flipEnabled: true,
  };
  const nodes: SerializedNode[] = objects.map((object) => ({
    id: object.id,
    type: 'rect',
    zIndex: 0,
    parentId: object.parentId,
    lockAspectRatio: object.lockAspectRatio,
  }));
  const camera = { zoom };
  const transformer = {} as Transformable;
  const api = {
    getAppState: () => state,
    getNodes: () => nodes,
    getNodeById: (id: string) => nodes.find((node) => node.id === id),
    getCamera: () =>
      ({
        read: (component: unknown) => {
          if (component === ComputedCamera) return camera;
          if (component === Transformable) return transformer;
          throw new Error('Unexpected camera component');
        },
        write: (component: unknown) => {
          if (component === Transformable) return transformer;
          throw new Error('Unexpected camera write');
        },
      } as unknown as Entity),
    getEntity: (node: SerializedNode) => {
      const object = objects.find((entry) => entry.id === node.id)!;
      if (object.missing) return undefined;
      return {
        has: (component: unknown) =>
          component === Culled
            ? !!object.culled
            : component === ComputedVisibility && object.visible !== undefined,
        read: (component: unknown) => {
          if (component === ComputedVisibility)
            return { visible: object.visible };
          throw new Error('Unexpected reference component');
        },
      } as unknown as Entity;
    },
    getGeometryBounds: (selection: SerializedNode[]) => {
      const bounds = selection.map(
        (node) => objects.find((entry) => entry.id === node.id)!.bounds,
      );
      return new AABB(
        Math.min(...bounds.map((box) => box.minX)),
        Math.min(...bounds.map((box) => box.minY)),
        Math.max(...bounds.map((box) => box.maxX)),
        Math.max(...bounds.map((box) => box.maxY)),
      );
    },
  };
  return { api: api as unknown as API, state, camera, transformer, nodes };
}
