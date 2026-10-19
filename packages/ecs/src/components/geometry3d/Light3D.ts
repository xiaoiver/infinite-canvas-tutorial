import { field } from '@lastolivegames/becsy';

export type Light3DType = 'ambient' | 'directional' | 'point' | 'spot';
export type Light3DAttenuation = 'range' | 'inverse-square';

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
   * Authored sRGB light color [r, g, b], each in 0..1 range. The renderer
   * converts it to linear space before accumulating radiance.
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

  /** Distance falloff for point and spot lights. `range` preserves legacy scenes. */
  @field.object declare attenuation: Light3DAttenuation;

  /** Intensity reference distance in canvas world units for inverse-square falloff. */
  @field.float32 declare referenceDistance: number;

  /**
   * Full-intensity cone angle in radians for spot lights.
   */
  @field.float32 declare innerConeAngle: number;

  /**
   * Zero-intensity cone angle in radians for spot lights.
   */
  @field.float32 declare outerConeAngle: number;

  /** Render a shadow map for this directional, point, or spot light. */
  @field.boolean declare castShadow: boolean;

  /** Shadow darkness from 0 (none) to 1 (fully occluded). */
  @field.float32 declare shadowStrength: number;

  /** PCF sampling radius in shadow texels; 1 preserves the legacy filter. */
  @field.float32 declare shadowSoftness: number;

  /** Multiplier for the receiver depth bias; 1 preserves the default bias. */
  @field.float32 declare shadowBiasScale: number;

  /** Shift shadow receivers along their surface normal in canvas world units. */
  @field.float32 declare shadowNormalBias: number;

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
    this.attenuation ??= 'range';
    this.referenceDistance ??= 100;
    this.innerConeAngle ??= Math.PI / 8;
    this.outerConeAngle ??= Math.PI / 4;
    this.castShadow ??= false;
    this.shadowStrength ??= 1;
    this.shadowSoftness ??= 1;
    this.shadowBiasScale ??= 1;
    this.shadowNormalBias ??= 0;
  }
}
