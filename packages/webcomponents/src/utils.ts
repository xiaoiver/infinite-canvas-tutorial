import { Entity, ComponentType } from '@infinite-canvas-tutorial/ecs';

export async function checkWebGPUSupport() {
  if ('gpu' in navigator) {
    const gpu = await navigator.gpu.requestAdapter();
    if (!gpu) {
      throw new Error('No WebGPU adapter available.');
    }
  } else {
    throw new Error('WebGPU is not supported by the browser.');
  }
}

/**
 * Transforms array of objects containing `id` attribute,
 * or array of ids (strings), into a Map, keyd by `id`.
 */
export const arrayToMap = <T extends { id: string } | string>(
  items: readonly T[] | Map<string, T>,
) => {
  if (items instanceof Map) {
    return items;
  }
  return items.reduce((acc: Map<string, T>, element) => {
    acc.set(typeof element === 'string' ? element : element.id, element);
    return acc;
  }, new Map());
};

export const mapToArray = <T extends { id: string } | string>(
  map: Map<string, T>,
) => Array.from(map.values());

export const getUpdatedTimestamp = () => Date.now();

export function createOrSetComponent<T>(
  entity: Entity,
  componentCtor: ComponentType<T>,
  component: Partial<T>,
) {
  if (!entity.has(componentCtor)) {
    entity.add(componentCtor);
  }
  Object.assign(entity.write(componentCtor), component);
}

export function removeComponent<T>(
  entity: Entity,
  componentCtor: ComponentType<T>,
) {
  if (entity.has(componentCtor)) {
    entity.remove(componentCtor);
  }
}
