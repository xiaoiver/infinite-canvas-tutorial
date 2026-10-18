import type {
  PathSerializedNode,
  SerializedNode,
} from '../types/serialized-node';
import { getComputedInheritGroupWireForId } from './inherit-group-wire';
import { pathExtrusionPaintSupported } from './path-extrusion-paint';
import { buildPathExtrusionMesh } from './path-extrusion-mesh';

/** Match the paint and geometry checks used when creating a Path's 3D mesh. */
export function canExtrudePath(
  node: PathSerializedNode,
  scene: SerializedNode[],
): boolean {
  const paint = getComputedInheritGroupWireForId(node.id, scene) as Pick<
    PathSerializedNode,
    'fills' | 'strokes' | 'fillRule'
  >;
  return (
    pathExtrusionPaintSupported(paint.fills, paint.strokes) &&
    !!buildPathExtrusionMesh(node.d ?? '', paint.fillRule)
  );
}
