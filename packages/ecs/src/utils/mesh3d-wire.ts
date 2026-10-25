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
    toneSteps:
      Number.isInteger(material.toneSteps) &&
      material.toneSteps! >= 2 &&
      material.toneSteps! <= 8
        ? material.toneSteps
        : 0,
    outlineWidth:
      Number.isFinite(material.outlineWidth) && material.outlineWidth! > 0
        ? Math.min(material.outlineWidth!, 8)
        : 0,
    outlineColor: material.outlineColor
      ? parseMesh3DBaseColor(material.outlineColor)
      : [0.08, 0.12, 0.2, 1],
    rimLightStrength:
      Number.isFinite(material.rimLightStrength) &&
      material.rimLightStrength! > 0
        ? Math.min(material.rimLightStrength!, 1)
        : 0,
    rimLightColor: material.rimLightColor
      ? parseMesh3DBaseColor(material.rimLightColor)
      : [0.55, 0.8, 1, 1],
    baseColorOverridden: material.baseColor !== undefined,
    metallicOverridden: material.metallic !== undefined,
    roughnessOverridden: material.roughness !== undefined,
    metallicRoughnessMapOverridden: material.metallicRoughnessMap !== undefined,
    metallicRoughnessTextureTransformOverridden:
      material.metallicRoughnessTextureTransform !== undefined,
    mapOverridden: material.map !== undefined,
    mapTextureTransformOverridden: material.mapTextureTransform !== undefined,
    emissiveFactorOverridden: material.emissiveFactor !== undefined,
    emissiveStrengthOverridden: material.emissiveStrength !== undefined,
    unlitOverridden: material.unlit !== undefined,
    emissiveMapOverridden: material.emissiveMap !== undefined,
    emissiveTextureTransformOverridden:
      material.emissiveTextureTransform !== undefined,
    normalMapOverridden: material.normalMap !== undefined,
    normalTextureTransformOverridden:
      material.normalTextureTransform !== undefined,
    occlusionMapOverridden: material.occlusionMap !== undefined,
    occlusionTextureTransformOverridden:
      material.occlusionTextureTransform !== undefined,
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
    attenuation: node.attenuation,
    referenceDistance: node.referenceDistance,
    innerConeAngle: node.innerConeAngle,
    outerConeAngle: node.outerConeAngle,
    castShadow: node.castShadow,
    shadowStrength: node.shadowStrength,
    shadowSoftness: node.shadowSoftness,
    shadowBiasScale: node.shadowBiasScale,
    shadowNormalBias: node.shadowNormalBias,
  });
}
