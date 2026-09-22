import { field } from '@lastolivegames/becsy';

/**
 * A 3D material component defining surface appearance.
 * @see https://docs.rs/bevy/latest/bevy/pbr/struct.StandardMaterial.html
 */
export class Material3D {
  /**
   * Base color [r, g, b, a], each in 0..1 range.
   */
  @field.object declare baseColor: [number, number, number, number];

  /**
   * Ambient light intensity (0..1).
   */
  @field.float32 declare ambient: number;

  /**
   * Diffuse light intensity (0..1).
   */
  @field.float32 declare diffuse: number;

  /**
   * Specular light intensity (0..1).
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
   * environment tinted by {@link baseColor} and have no diffuse contribution.
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

  /** Optional specular intensity texture (grayscale), multiplied into specular. */
  @field.object declare specularMap: string | null;

  /** Optional bump / height map (grayscale) for normal perturbation. */
  @field.object declare bumpMap: string | null;

  /** Bump map strength (AntV G `bumpScale`, typically 1–10). */
  @field.float32 declare bumpScale: number;

  constructor(material?: Partial<Material3D>) {
    if (material) {
      Object.assign(this, material);
    }
    this.baseColor ??= [1, 1, 1, 1];
    this.ambient ??= 0.1;
    this.diffuse ??= 0.7;
    this.specular ??= 0.3;
    this.shininess ??= 32;
    this.metallic ??= 0;
    this.roughness ??= 1;
    this.map ??= null;
    this.specularMap ??= null;
    this.bumpMap ??= null;
    this.bumpScale ??= 1;
  }
}
