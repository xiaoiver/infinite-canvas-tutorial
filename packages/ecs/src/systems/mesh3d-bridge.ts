import type { MeshPipeline3D } from './MeshPipeline3D';
import type { Entity } from '@lastolivegames/becsy';
import type { API } from '../API';
import { Canvas } from '../components';

const instances = new Map<MeshPipeline3D, Set<API>>();
const owners = new WeakMap<API, MeshPipeline3D>();

export function registerMeshPipeline3D(system: MeshPipeline3D): void {
  if (!instances.has(system)) instances.set(system, new Set());
}

/** Called in PreUpdate, before the 2D compositor runs in Last. */
export function syncMeshPipeline3DCanvases(
  system: MeshPipeline3D,
  apis: API[],
): void {
  const next = new Set(apis);
  for (const api of instances.get(system) ?? []) {
    if (!next.has(api) && owners.get(api) === system) owners.delete(api);
  }
  for (const api of next) owners.set(api, system);
  instances.set(system, next);
}

export function getMeshPipeline3D(canvas?: Entity): MeshPipeline3D | null {
  if (canvas) return owners.get(canvas.read(Canvas).api) ?? null;
  // Preserve the public accessor when there is exactly one initialized owner.
  return instances.size === 1 ? instances.keys().next().value! : null;
}

export function unregisterMeshPipeline3D(system: MeshPipeline3D): void {
  for (const api of instances.get(system) ?? []) {
    if (owners.get(api) === system) owners.delete(api);
  }
  instances.delete(system);
}
