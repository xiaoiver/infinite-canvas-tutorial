import { field } from '@lastolivegames/becsy';

export type Material3DAlphaMode = 'opaque' | 'mask' | 'blend';

/** glTF KHR_texture_transform coordinates, applied after UV-set selection. */
export type Material3DTextureTransform = {
  offset?: [number, number];
  scale?: [number, number];
  rotation?: number;
};

/**
 * A 3D material component defining surface appearance.
 * @see https://docs.rs/bevy/latest/bevy/pbr/struct.StandardMaterial.html
 */
export class Material3D {
  /**
   * Authored sRGB base color [r, g, b, a], each in 0..1 range. Lighting uses
   * linear RGB; alpha is unchanged.
   */
  @field.object declare baseColor: [number, number, number, number];

  /** Optional side-wall color for an extruded mesh; null uses baseColor. */
  @field.object declare sideColor: [number, number, number, number] | null;

  /** Optional number of lit luminance bands; zero keeps continuous PBR shading. */
  @field.float32 declare toneSteps: number;

  /** Screen-space silhouette width in CSS pixels; zero disables the extra pass. */
  @field.float32 declare outlineWidth: number;

  /** Authored sRGB outline color. */
  @field.object declare outlineColor: [number, number, number, number];

  /**
   * Ambient light intensity (0..1).
   */
  @field.float32 declare ambient: number;

  /**
   * Legacy diffuse light intensity (0..1).
   * @deprecated Retained for wire compatibility; metallic and roughness now
   * control the direct-light response.
   */
  @field.float32 declare diffuse: number;

  /**
   * Legacy specular light intensity (0..1).
   * @deprecated Retained for wire compatibility; metallic and roughness now
   * control the direct-light response.
   */
  @field.float32 declare specular: number;

  /**
   * Shininess exponent for specular highlights.
   *
   * @deprecated Retained for backward compatibility. The renderer now uses a
   * metallic-roughness workflow ({@link metallic} / {@link roughness}); this
   * field no longer affects shading.
   */
  @field.float32 declare shininess: number;

  /**
   * Metalness in the 0..1 range. 0 = dielectric, 1 = metal. Metals reflect the
   * direct light tinted by {@link baseColor} and have no direct diffuse contribution.
   * Without an environment map, ambient remains a simple fill.
   */
  @field.float32 declare metallic: number;

  /**
   * Perceptual roughness in the 0..1 range. 0 = smooth/mirror-like, 1 = fully
   * rough/diffuse. Drives the GGX specular lobe width.
   */
  @field.float32 declare roughness: number;

  /** glTF metallic-roughness texture: green scales roughness, blue scales metallic. */
  @field.object declare metallicRoughnessMap: string | null;

  /** UV set for the metallic-roughness texture: 0 or 1. */
  @field.float32 declare metallicRoughnessTexCoord: number;

  @field.object
  declare metallicRoughnessTextureTransform: Material3DTextureTransform | null;

  /**
   * Optional base-color texture (image URL or data URL). Sampled with the
   * mesh UV coordinates and multiplied by {@link baseColor}.
   */
  @field.object declare map: string | null;

  /** UV set for the base-color texture: 0 or 1. */
  @field.float32 declare mapTexCoord: number;

  @field.object declare mapTextureTransform: Material3DTextureTransform | null;

  /** Linear RGB emitted by the surface, independent of scene lights. */
  @field.object declare emissiveFactor: [number, number, number];

  /** KHR_materials_emissive_strength multiplier; 1 preserves core glTF emission. */
  @field.float32 declare emissiveStrength: number;

  /** Draw base color without scene lighting or tone mapping (KHR_materials_unlit). */
  @field.boolean declare unlit: boolean;

  /** Optional glTF emissive texture, sampled as sRGB and multiplied by emissiveFactor. */
  @field.object declare emissiveMap: string | null;

  @field.float32 declare emissiveTexCoord: number;

  @field.object
  declare emissiveTextureTransform: Material3DTextureTransform | null;

  /** Render both faces; back-face lighting reverses the geometric normal. */
  @field.boolean declare doubleSided: boolean;

  /** glTF tangent-space normal texture (linear RGB). */
  @field.object declare normalMap: string | null;
  @field.float32 declare normalTexCoord: number;
  @field.object
  declare normalTextureTransform: Material3DTextureTransform | null;
  @field.float32 declare normalScale: number;

  /** glTF ambient-occlusion texture; red channel attenuates indirect light. */
  @field.object declare occlusionMap: string | null;
  @field.float32 declare occlusionTexCoord: number;
  @field.object
  declare occlusionTextureTransform: Material3DTextureTransform | null;
  @field.float32 declare occlusionStrength: number;

  /** Opaque, alpha-tested cutout, or sorted alpha blending. */
  @field.object declare alphaMode: Material3DAlphaMode;

  /** Alpha-test threshold for `mask` materials, in the 0..1 range. */
  @field.float32 declare alphaCutoff: number;

  /** Optional specular intensity texture (grayscale), multiplied into specular. */
  @field.object declare specularMap: string | null;

  /** Optional bump / height map (grayscale) for normal perturbation. */
  @field.object declare bumpMap: string | null;

  /** Optional equirectangular LDR image or Radiance .hdr URL for environment light. */
  @field.object declare environmentMap: string | null;

  /** Bump map strength (AntV G `bumpScale`, typically 1–10). */
  @field.float32 declare bumpScale: number;

  /** Whether this mesh is drawn into shadow maps. */
  @field.boolean declare castShadow: boolean;

  /** Whether direct lighting on this mesh is occluded by shadow maps. */
  @field.boolean declare receiveShadow: boolean;

  constructor(material?: Partial<Material3D>) {
    if (material) {
      Object.assign(this, material);
    }
    this.baseColor ??= [1, 1, 1, 1];
    this.sideColor ??= null;
    this.toneSteps ??= 0;
    this.outlineWidth ??= 0;
    this.outlineColor ??= [0.08, 0.12, 0.2, 1];
    this.ambient ??= 0.5;
    this.diffuse ??= 0.7;
    this.specular ??= 0.3;
    this.shininess ??= 32;
    this.metallic ??= 0;
    this.roughness ??= 1;
    this.metallicRoughnessMap ??= null;
    this.metallicRoughnessTexCoord ??= 0;
    this.metallicRoughnessTextureTransform ??= null;
    this.map ??= null;
    this.mapTexCoord ??= 0;
    this.mapTextureTransform ??= null;
    this.emissiveFactor ??= [0, 0, 0];
    this.emissiveStrength ??= 1;
    this.unlit ??= false;
    this.emissiveMap ??= null;
    this.emissiveTexCoord ??= 0;
    this.emissiveTextureTransform ??= null;
    this.doubleSided ??= false;
    this.normalMap ??= null;
    this.normalTexCoord ??= 0;
    this.normalTextureTransform ??= null;
    this.normalScale ??= 1;
    this.occlusionMap ??= null;
    this.occlusionTexCoord ??= 0;
    this.occlusionTextureTransform ??= null;
    this.occlusionStrength ??= 1;
    this.alphaMode ??= 'opaque';
    this.alphaCutoff ??= 0.5;
    this.specularMap ??= null;
    this.bumpMap ??= null;
    this.environmentMap ??= null;
    this.bumpScale ??= 1;
    this.castShadow ??= true;
    this.receiveShadow ??= true;
  }
}
