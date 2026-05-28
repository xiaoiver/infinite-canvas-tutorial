import type { MeshPipeline3D } from './MeshPipeline3D';

let instance: MeshPipeline3D | null = null;

export function registerMeshPipeline3D(system: MeshPipeline3D): void {
  instance = system;
}

export function getMeshPipeline3D(): MeshPipeline3D | null {
  return instance;
}

export function unregisterMeshPipeline3D(system: MeshPipeline3D): void {
  if (instance === system) {
    instance = null;
  }
}
