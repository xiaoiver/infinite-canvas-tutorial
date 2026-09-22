import { field } from '@lastolivegames/becsy';

/**
 * A 3D mesh geometry component.
 * Stores vertex positions, normals, and indices for 3D rendering.
 *
 * @see https://docs.rs/bevy/latest/bevy/render/mesh/struct.Mesh.html
 *
 * @example
 * ```ts
 * // Create a cube mesh
 * const mesh = new Mesh3D({
 *   positions: new Float32Array([...]),
 *   normals: new Float32Array([...]),
 *   indices: new Uint32Array([...]),
 * });
 * ```
 */
export class Mesh3D {
  /**
   * Vertex positions (x, y, z) interleaved.
   */
  @field.object declare positions: Float32Array;

  /**
   * Vertex normals (x, y, z) interleaved.
   */
  @field.object declare normals: Float32Array;

  /**
   * Optional UV coordinates (u, v) interleaved.
   */
  @field.object declare uvs: Float32Array | null;

  /**
   * Triangle indices.
   */
  @field.object declare indices: Uint32Array | null;

  constructor(mesh?: Partial<Mesh3D>) {
    if (mesh) {
      Object.assign(this, mesh);
    }
    this.positions ??= new Float32Array(0);
    this.normals ??= new Float32Array(0);
    this.uvs ??= null;
    this.indices ??= null;
  }

  get vertexCount(): number {
    return this.positions.length / 3;
  }
}
