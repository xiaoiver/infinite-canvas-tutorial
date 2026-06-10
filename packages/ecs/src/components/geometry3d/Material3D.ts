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
   */
  @field.float32 declare shininess: number;

  /**
   * Optional base-color texture (image URL or data URL). Sampled with the
   * mesh UV coordinates and multiplied by {@link baseColor}.
   */
  @field.object declare map: string | null;

  constructor(material?: Partial<Material3D>) {
    if (material) {
      Object.assign(this, material);
    }
    this.baseColor ??= [1, 1, 1, 1];
    this.ambient ??= 0.1;
    this.diffuse ??= 0.7;
    this.specular ??= 0.3;
    this.shininess ??= 32;
    this.map ??= null;
  }
}
