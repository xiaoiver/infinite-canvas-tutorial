import {
  BufferFrequencyHint,
  BufferUsage,
  type Buffer,
  type Device,
} from '@infinite-canvas-tutorial/device-api';
import { MeshDrawBindings } from './mesh-draw-bindings';
import { ShadowDrawBindings } from './shadow-draw-bindings';
import type { Mesh3D } from '../../components/geometry3d/Mesh3D';
import { ResourceScope } from '../../resources/ResourceScope';
import {
  MeshModelUniforms,
  MESH_MODEL_UNIFORM_FLOATS,
} from './mesh-model-uniforms';

export interface MeshGPUData {
  vertexBuffer: Buffer;
  normalBuffer: Buffer;
  tangentBuffer: Buffer;
  colorBuffer: Buffer;
  uvBuffer: Buffer;
  uv1Buffer: Buffer;
  indexBuffer: Buffer | null;
  indexCount: number;
  vertexCount: number;
  /** Deferred submission requires a separate model UBO for every mesh. */
  modelUniformBuffer: Buffer;
  modelUniforms: MeshModelUniforms;
  bindings: MeshDrawBindings;
  outlineBindings: MeshDrawBindings;
  shadowBindings: ShadowDrawBindings;
  localBounds: { min: [number, number, number]; max: [number, number, number] };
}

interface Entry {
  data: MeshGPUData;
  dirty: boolean;
  dispose: () => void;
}

/** Geometry invalidation is independent of pose/material uniform updates. */
export class MeshGPUCache {
  private entries = new Map<number, Entry>();
  private disposed = false;

  constructor(private device: Device) {}

  invalidate(ids: Iterable<number>): void {
    for (const id of ids) {
      const entry = this.entries.get(id);
      if (entry) entry.dirty = true;
    }
  }

  retain(ids: ReadonlySet<number>): void {
    const releases = new ResourceScope();
    for (const [id, entry] of this.entries) {
      if (!ids.has(id)) {
        this.entries.delete(id);
        releases.add(entry.dispose);
      }
    }
    releases.dispose();
  }

  get(id: number, mesh: Mesh3D): MeshGPUData | null {
    if (this.disposed) throw new Error('Mesh GPU cache has been disposed');
    const previous = this.entries.get(id);
    if (!mesh.positions.length) {
      this.entries.delete(id);
      previous?.dispose();
      return null;
    }
    if (previous && !previous.dirty) return previous.data;

    const scope = new ResourceScope();
    const buffer = (
      viewOrSize: Float32Array | Uint32Array | number,
      usage: BufferUsage,
    ) => {
      const resource = this.device.createBuffer({
        viewOrSize,
        usage,
        hint:
          usage === BufferUsage.UNIFORM
            ? BufferFrequencyHint.DYNAMIC
            : BufferFrequencyHint.STATIC,
      });
      scope.add(() => resource.destroy());
      return resource;
    };
    let data: MeshGPUData;
    try {
      const geometry = {
        vertexBuffer: buffer(mesh.positions, BufferUsage.VERTEX),
        normalBuffer: buffer(mesh.normals, BufferUsage.VERTEX),
        tangentBuffer: buffer(
          mesh.tangents?.length === mesh.vertexCount * 4
            ? mesh.tangents
            : new Float32Array(mesh.vertexCount * 4),
          BufferUsage.VERTEX,
        ),
        colorBuffer: buffer(
          mesh.colors?.length === mesh.vertexCount * 4
            ? mesh.colors
            : new Float32Array(mesh.vertexCount * 4).fill(1),
          BufferUsage.VERTEX,
        ),
        // Optional UVs must still satisfy the shared input layout.
        uvBuffer: buffer(
          mesh.uvs?.length === mesh.vertexCount * 2
            ? mesh.uvs
            : new Float32Array(mesh.vertexCount * 2),
          BufferUsage.VERTEX,
        ),
        uv1Buffer: buffer(
          mesh.uvs1?.length === mesh.vertexCount * 2
            ? mesh.uvs1
            : new Float32Array(mesh.vertexCount * 2),
          BufferUsage.VERTEX,
        ),
        indexBuffer: mesh.indices?.length
          ? buffer(mesh.indices, BufferUsage.INDEX)
          : null,
        indexCount: mesh.indices?.length ?? 0,
        vertexCount: mesh.vertexCount,
        modelUniformBuffer: buffer(
          MESH_MODEL_UNIFORM_FLOATS * 4,
          BufferUsage.UNIFORM,
        ),
      };
      data = {
        ...geometry,
        modelUniforms: new MeshModelUniforms(geometry.modelUniformBuffer),
        bindings: new MeshDrawBindings(
          this.device,
          geometry.modelUniformBuffer,
        ),
        outlineBindings: new MeshDrawBindings(
          this.device,
          geometry.modelUniformBuffer,
        ),
        shadowBindings: new ShadowDrawBindings(
          this.device,
          geometry.modelUniformBuffer,
        ),
        localBounds: meshBounds(mesh.positions),
      };
      scope.add(() => data.bindings.destroy());
      scope.add(() => data.outlineBindings.destroy());
      scope.add(() => data.shadowBindings.destroy());
    } catch (error) {
      // Keep the previous entry dirty for retry; never publish partial buffers.
      try {
        scope.dispose();
      } catch {
        /* Preserve the allocation error after attempting every release. */
      }
      throw error;
    }
    this.entries.set(id, {
      data,
      dirty: false,
      dispose: () => scope.dispose(),
    });
    previous?.dispose();
    return data;
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.retain(new Set());
  }
}

function meshBounds(positions: Float32Array): MeshGPUData['localBounds'] {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], positions[i + axis]);
      max[axis] = Math.max(max[axis], positions[i + axis]);
    }
  }
  return { min, max };
}
