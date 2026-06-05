import { Entity, field } from '@lastolivegames/becsy';
import type { Projection3D } from './Camera3D';

export type Mesh3DNodeGeometry = 'cube';

/** Declarative mesh3d node backing data (see {@link Mesh3DNodeSerializedNode}). */
export class Mesh3DNode {
  @field.object declare geometry: Mesh3DNodeGeometry;

  /** Depth in canvas world units (linked mode). */
  @field.float32 declare z: number;

  @field.object declare rotation3d: [number, number, number];

  /** Uniform scale or per-axis scale applied to unit geometry. */
  @field.object declare scale3d: number | [number, number, number];

  @field.object declare baseColor: [number, number, number, number];

  @field.float32 declare ambient: number;

  @field.float32 declare diffuse: number;

  @field.float32 declare specular: number;

  @field.float32 declare shininess: number;

  /** Spawn {@link Camera3D} for this canvas when absent (first mesh3d wins). */
  @field.object declare camera3d?: {
    linked?: boolean;
    projection?: Projection3D;
    clearColor?: boolean;
  };

  /** Companion mesh entity; managed by {@link EnsureMesh3DNodes}. */
  @field.ref declare meshEntity?: Entity;

  constructor(props?: Partial<Mesh3DNode>) {
    if (props) {
      Object.assign(this, props);
    }
    this.geometry ??= 'cube';
    this.z ??= 0;
    this.rotation3d ??= [0, 0, 0];
    this.scale3d ??= 100;
    this.baseColor ??= [1, 1, 1, 1];
    this.ambient ??= 0.25;
    this.diffuse ??= 0.75;
    this.specular ??= 0.4;
    this.shininess ??= 48;
  }
}
