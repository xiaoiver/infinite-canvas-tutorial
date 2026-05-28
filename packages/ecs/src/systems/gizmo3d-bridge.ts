import type { RenderGizmo3D } from './RenderGizmo3D';

let instance: RenderGizmo3D | null = null;

export function registerGizmo3D(system: RenderGizmo3D): void {
  instance = system;
}

export function getGizmo3D(): RenderGizmo3D | null {
  return instance;
}

export function unregisterGizmo3D(system: RenderGizmo3D): void {
  if (instance === system) {
    instance = null;
  }
}
