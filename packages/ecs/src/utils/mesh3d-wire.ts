import { Light3D } from '../components/geometry3d/Light3D';
import { Mesh3DNode } from '../components/geometry3d/Mesh3DNode';
import type {
  Light3DNodeSerializedNode,
  Mesh3DNodeSerializedNode,
} from '../types/serialized-node';
import {
  normalizeGeometry,
  parseLight3DColor,
  parseMesh3DBaseColor,
} from './mesh3d-node';

/** Use the same defaults for initial loading, edits and history restoration. */
export function mesh3DNodeFromWire(node: Mesh3DNodeSerializedNode): Mesh3DNode {
  const material = node.material3d ?? {};
  return new Mesh3DNode({
    ...material,
    baseColor: parseMesh3DBaseColor(material.baseColor),
    geometry: normalizeGeometry(node.geometry),
    z: node.z,
    rotation3d: node.rotation3d && [...node.rotation3d],
    scale3d: Array.isArray(node.scale3d) ? [...node.scale3d] : node.scale3d,
    camera3d: node.camera3d && { ...node.camera3d },
  });
}

export function light3DFromWire(node: Light3DNodeSerializedNode): Light3D {
  return new Light3D({
    type: node.lightType,
    color: parseLight3DColor(node.color),
    intensity: node.intensity,
    direction: node.direction && [...node.direction],
    position: [node.x ?? 0, node.y ?? 0, node.z ?? 0],
    range: node.range,
    innerConeAngle: node.innerConeAngle,
    outerConeAngle: node.outerConeAngle,
  });
}
