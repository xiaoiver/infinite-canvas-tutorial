import { field } from '@lastolivegames/becsy';

export type Light3DType = 'ambient' | 'directional' | 'point' | 'spot';

export const LIGHT_3D_TYPE = {
  directional: 1,
  point: 2,
  spot: 3,
} as const;

/**
 * A 3D light component used by {@link MeshPipeline3D}.
 *
 * Supports Spline-like ambient, directional, point, and spot lights. Ambient
 * lights contribute only color/intensity; other light types are packed into the
 * scene light array up to the renderer limit.
 */
export class Light3D {
  @field.object declare type: Light3DType;

  /**
   * Light color [r, g, b], each in 0..1 range.
   */
  @field.object declare color: [number, number, number];

  /**
   * Light intensity multiplier.
   */
  @field.float32 declare intensity: number;

  /**
   * Position for point and spot lights.
   */
  @field.object declare position: [number, number, number];

  /**
   * Direction for directional and spot lights. Direction points from the light
   * toward the illuminated scene. The renderer normalizes this vector; the
   * default preserves the previous hard-coded mesh light direction.
   */
  @field.object declare direction: [number, number, number];

  /**
   * Maximum effective distance for point and spot lights. Values <= 0 disable
   * distance attenuation.
   */
  @field.float32 declare range: number;

  /**
   * Full-intensity cone angle in radians for spot lights.
   */
  @field.float32 declare innerConeAngle: number;

  /**
   * Zero-intensity cone angle in radians for spot lights.
   */
  @field.float32 declare outerConeAngle: number;

  constructor(light?: Partial<Light3D>) {
    if (light) {
      Object.assign(this, light);
    }
    this.type ??= 'directional';
    this.color ??= [1, 1, 1];
    this.intensity ??= 1;
    this.position ??= [0, 0, 0];
    this.direction ??= [-0.5, -0.7, -0.5];
    this.range ??= 0;
    this.innerConeAngle ??= Math.PI / 8;
    this.outerConeAngle ??= Math.PI / 4;
  }
}
