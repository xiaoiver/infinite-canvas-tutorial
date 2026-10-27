import { Entity, field } from '@lastolivegames/becsy';

/**
 * Extrudes a supported 2D source into a 3D companion mesh.
 * {@link EnsureExtrudeMeshes} spawns the mesh; {@link SyncExtrude3D} keeps it aligned.
 */
export class Extrude3D {
  /** Extrusion depth in canvas world units (along view axis). */
  @field.float32 declare depth: number;

  /** Bevel size in canvas world units. */
  @field.float32 declare bevelSize: number;

  /** One segment makes a straight bevel; more segments make a rounded profile. */
  @field.int32 declare bevelSegments: number;

  /** Optional CSS color for the companion mesh's side walls and bevels. */
  @field.object declare sideColor: string | null;

  @field.float32 declare metallic: number;

  @field.float32 declare roughness: number;

  /** Optional number of lit luminance bands; zero keeps continuous PBR shading. */
  @field.float32 declare toneSteps: number;

  @field.float32 declare outlineWidth: number;

  @field.object declare outlineColor: string | null;

  @field.float32 declare rimLightStrength: number;

  @field.object declare rimLightColor: string | null;

  /** Elevation of the unrotated front plane; the mesh center is z - depth / 2. */
  @field.float32 declare z: number;

  /** Local XYZ Euler angles composed after the source's canvas rotation. */
  @field.object declare rotation: [number, number, number];

  /** Companion mesh entity; managed by {@link EnsureExtrudeMeshes}. */
  @field.ref declare meshEntity?: Entity;

  constructor(props?: Partial<Extrude3D>) {
    if (props) {
      Object.assign(this, props);
    }
    this.depth ??= 100;
    this.bevelSize ??= 0;
    this.bevelSegments ??= 1;
    this.sideColor ??= null;
    this.metallic ??= 0;
    this.roughness ??= 1;
    this.toneSteps ??= 0;
    this.outlineWidth ??= 0;
    this.outlineColor ??= null;
    this.rimLightStrength ??= 0;
    this.rimLightColor ??= null;
    this.z ??= 0;
    this.rotation ??= [0, 0, 0];
  }
}
