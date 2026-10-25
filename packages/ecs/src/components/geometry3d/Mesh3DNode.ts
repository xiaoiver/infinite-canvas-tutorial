import { Entity, field } from '@lastolivegames/becsy';
import type { Camera3DNodeConfig } from '../../types/serialized-node';
import type {
  Material3DAlphaMode,
  Material3DTextureTransform,
} from './Material3D';
import type {
  Mesh3DGeometrySpec,
  Mesh3DNodeGeometry,
} from '../../utils/geometry3d/types';

export type { Mesh3DGeometrySpec, Mesh3DNodeGeometry };

/** Declarative mesh3d node backing data (see {@link Mesh3DNodeSerializedNode}). */
export class Mesh3DNode {
  @field.object declare geometry: Mesh3DGeometrySpec;

  /** Depth in canvas world units (linked mode). */
  @field.float32 declare z: number;

  @field.object declare rotation3d: [number, number, number];

  /** Uniform scale or per-axis scale applied to unit geometry. */
  @field.object declare scale3d: number | [number, number, number];

  @field.object declare baseColor: [number, number, number, number];

  @field.float32 declare toneSteps: number;

  @field.float32 declare outlineWidth: number;

  @field.object declare outlineColor: [number, number, number, number];

  @field.float32 declare rimLightStrength: number;

  @field.object declare rimLightColor: [number, number, number, number];

  /** Preserve an explicit white override of an imported glTF base color. */
  @field.boolean declare baseColorOverridden: boolean;

  @field.float32 declare ambient: number;

  @field.float32 declare diffuse: number;

  @field.float32 declare specular: number;

  @field.float32 declare shininess: number;

  /** Metalness 0..1 (PBR metallic-roughness workflow). */
  @field.float32 declare metallic: number;

  /** Preserve an explicit zero override of an imported glTF metalness. */
  @field.boolean declare metallicOverridden: boolean;

  /** Perceptual roughness 0..1 (PBR metallic-roughness workflow). */
  @field.float32 declare roughness: number;

  /** Preserve an explicit one override of an imported glTF roughness. */
  @field.boolean declare roughnessOverridden: boolean;

  /** Optional glTF metallic-roughness texture (G: roughness, B: metallic). */
  @field.object declare metallicRoughnessMap: string | null;

  /** Null inherits the imported PBR texture's UV set. */
  @field.object declare metallicRoughnessTexCoord: 0 | 1 | null;

  /** Null inherits the imported PBR texture transform unless overridden. */
  @field.object
  declare metallicRoughnessTextureTransform: Material3DTextureTransform | null;

  @field.boolean declare metallicRoughnessTextureTransformOverridden: boolean;

  /** Preserve an explicit null override of an imported glTF PBR texture. */
  @field.boolean declare metallicRoughnessMapOverridden: boolean;

  /** Optional base-color texture (image URL or data URL). */
  @field.object declare map: string | null;

  /** Null inherits the imported base-color texture's UV set. */
  @field.object declare mapTexCoord: 0 | 1 | null;

  /** Null inherits the imported base-color texture transform unless overridden. */
  @field.object declare mapTextureTransform: Material3DTextureTransform | null;

  @field.boolean declare mapTextureTransformOverridden: boolean;

  /** Preserve an explicit null override of an imported glTF texture. */
  @field.boolean declare mapOverridden: boolean;

  @field.object declare emissiveFactor: [number, number, number];

  @field.boolean declare emissiveFactorOverridden: boolean;

  @field.float32 declare emissiveStrength: number;

  @field.boolean declare emissiveStrengthOverridden: boolean;

  @field.boolean declare unlit: boolean;

  @field.boolean declare unlitOverridden: boolean;

  @field.object declare emissiveMap: string | null;

  @field.boolean declare emissiveMapOverridden: boolean;

  @field.object declare emissiveTexCoord: 0 | 1 | null;

  @field.object
  declare emissiveTextureTransform: Material3DTextureTransform | null;

  @field.boolean declare emissiveTextureTransformOverridden: boolean;

  /** Null inherits the imported glTF double-sided setting. */
  @field.object declare doubleSided: boolean | null;

  @field.object declare normalMap: string | null;
  @field.boolean declare normalMapOverridden: boolean;
  @field.object declare normalTexCoord: 0 | 1 | null;
  @field.object
  declare normalTextureTransform: Material3DTextureTransform | null;
  @field.boolean declare normalTextureTransformOverridden: boolean;
  @field.object declare normalScale: number | null;

  @field.object declare occlusionMap: string | null;
  @field.boolean declare occlusionMapOverridden: boolean;
  @field.object declare occlusionTexCoord: 0 | 1 | null;
  @field.object
  declare occlusionTextureTransform: Material3DTextureTransform | null;
  @field.boolean declare occlusionTextureTransformOverridden: boolean;
  @field.object declare occlusionStrength: number | null;

  /** Null inherits the imported glTF material (or opaque for primitives). */
  @field.object declare alphaMode: Material3DAlphaMode | null;

  /** Null inherits the imported glTF cutoff (or 0.5 for primitives). */
  @field.object declare alphaCutoff: number | null;

  @field.object declare specularMap: string | null;

  @field.object declare bumpMap: string | null;

  @field.object declare environmentMap: string | null;

  @field.float32 declare bumpScale: number;

  @field.boolean declare castShadow: boolean;

  @field.boolean declare receiveShadow: boolean;

  /** Spawn {@link Camera3D} for this canvas when absent (first mesh3d wins). */
  @field.object declare camera3d?: Camera3DNodeConfig;

  /** Companion mesh entity; managed by {@link EnsureMesh3DNodes}. */
  @field.ref declare meshEntity?: Entity;

  constructor(props?: Partial<Mesh3DNode>) {
    if (props) {
      Object.assign(this, props);
    }
    this.geometry ??= { type: 'cube' };
    this.z ??= 0;
    this.rotation3d ??= [0, 0, 0];
    this.scale3d ??= 100;
    this.baseColor ??= [1, 1, 1, 1];
    this.toneSteps ??= 0;
    this.outlineWidth ??= 0;
    this.outlineColor ??= [0.08, 0.12, 0.2, 1];
    this.rimLightStrength ??= 0;
    this.rimLightColor ??= [0.55, 0.8, 1, 1];
    this.baseColorOverridden ??= false;
    this.ambient ??= 0.5;
    this.diffuse ??= 0.75;
    this.specular ??= 0.4;
    this.shininess ??= 48;
    this.metallic ??= 0;
    this.metallicOverridden ??= false;
    this.roughness ??= 1;
    this.roughnessOverridden ??= false;
    this.metallicRoughnessMap ??= null;
    this.metallicRoughnessTexCoord ??= null;
    this.metallicRoughnessTextureTransform ??= null;
    this.metallicRoughnessTextureTransformOverridden ??= false;
    this.metallicRoughnessMapOverridden ??= false;
    this.map ??= null;
    this.mapTexCoord ??= null;
    this.mapTextureTransform ??= null;
    this.mapTextureTransformOverridden ??= false;
    this.mapOverridden ??= false;
    this.emissiveFactor ??= [0, 0, 0];
    this.emissiveFactorOverridden ??= false;
    this.emissiveStrength ??= 1;
    this.emissiveStrengthOverridden ??= false;
    this.unlit ??= false;
    this.unlitOverridden ??= false;
    this.emissiveMap ??= null;
    this.emissiveMapOverridden ??= false;
    this.emissiveTexCoord ??= null;
    this.emissiveTextureTransform ??= null;
    this.emissiveTextureTransformOverridden ??= false;
    this.doubleSided ??= null;
    this.normalMap ??= null;
    this.normalMapOverridden ??= false;
    this.normalTexCoord ??= null;
    this.normalTextureTransform ??= null;
    this.normalTextureTransformOverridden ??= false;
    this.normalScale ??= null;
    this.occlusionMap ??= null;
    this.occlusionMapOverridden ??= false;
    this.occlusionTexCoord ??= null;
    this.occlusionTextureTransform ??= null;
    this.occlusionTextureTransformOverridden ??= false;
    this.occlusionStrength ??= null;
    this.alphaMode ??= null;
    this.alphaCutoff ??= null;
    this.specularMap ??= null;
    this.bumpMap ??= null;
    this.environmentMap ??= null;
    this.bumpScale ??= 1;
    this.castShadow ??= true;
    this.receiveShadow ??= true;
  }
}
