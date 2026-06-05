import { createUnitCubeGeometry } from './unit-cube';
import { createUnitCylinderGeometry } from './unit-cylinder';
import { createUnitPlaneGeometry } from './unit-plane';
import { createUnitSphereGeometry } from './unit-sphere';
import type { Mesh3DGeometryData, Mesh3DGeometrySpec } from './types';
import { emptyMesh3DGeometry } from './types';

export * from './types';
export { createUnitCubeGeometry } from './unit-cube';
export { createUnitSphereGeometry } from './unit-sphere';
export { createUnitCylinderGeometry } from './unit-cylinder';
export { createUnitPlaneGeometry } from './unit-plane';

export function createGeometry(spec: Mesh3DGeometrySpec): Mesh3DGeometryData {
  switch (spec.type) {
    case 'cube':
      return createUnitCubeGeometry();
    case 'sphere':
      return createUnitSphereGeometry(spec.segments);
    case 'cylinder':
      return createUnitCylinderGeometry(spec.segments, spec.cap ?? true);
    case 'plane':
      return createUnitPlaneGeometry();
    case 'gltf':
      return emptyMesh3DGeometry();
  }
}
