import { field } from '@lastolivegames/becsy';

export type Material3DAlphaMode = 'opaque' | 'mask' | 'blend';

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

  /**
   * Optional base-color texture (image URL or data URL). Sampled with the
   * mesh UV coordinates and multiplied by {@link baseColor}.
   */
  @field.object declare map: string | null;

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
    this.ambient ??= 0.5;
    this.diffuse ??= 0.7;
    this.specular ??= 0.3;
    this.shininess ??= 32;
    this.metallic ??= 0;
    this.roughness ??= 1;
    this.map ??= null;
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
