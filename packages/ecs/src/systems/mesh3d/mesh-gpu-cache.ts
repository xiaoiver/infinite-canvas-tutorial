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
  geometry: SharedGeometry;
  dispose: () => void;
}

type GeometryKey = Pick<
  Mesh3D,
  'positions' | 'normals' | 'tangents' | 'colors' | 'uvs' | 'uvs1' | 'indices'
>;
type GeometryBuffers = Pick<
  MeshGPUData,
  | 'vertexBuffer'
  | 'normalBuffer'
  | 'tangentBuffer'
  | 'colorBuffer'
  | 'uvBuffer'
  | 'uv1Buffer'
  | 'indexBuffer'
  | 'indexCount'
  | 'vertexCount'
  | 'localBounds'
>;
interface SharedGeometry {
  key: GeometryKey;
  buffers: GeometryBuffers;
  bytes: number;
  references: number;
  active: boolean;
  dispose: () => void;
}

function geometryMatches(key: GeometryKey, mesh: Mesh3D): boolean {
  return (
    key.positions === mesh.positions &&
    key.normals === mesh.normals &&
    key.tangents === mesh.tangents &&
    key.colors === mesh.colors &&
    key.uvs === mesh.uvs &&
    key.uvs1 === mesh.uvs1 &&
    key.indices === mesh.indices
  );
}

/** Geometry invalidation is independent of pose/material uniform updates. */
export class MeshGPUCache {
  private entries = new Map<number, Entry>();
  private geometry = new Map<Float32Array, SharedGeometry[]>();
  private disposed = false;

  constructor(private device: Device) {}

  /** Live GPU allocation estimate, excluding device-specific alignment. */
  stats(): {
    instances: number;
    uniqueGeometries: number;
    geometryBytes: number;
    modelUniformBytes: number;
  } {
    const shared = [...this.geometry.values()].flat();
    return {
      instances: this.entries.size,
      uniqueGeometries: shared.length,
      geometryBytes: shared.reduce((total, item) => total + item.bytes, 0),
      modelUniformBytes: this.entries.size * MESH_MODEL_UNIFORM_FLOATS * 4,
    };
  }

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

    // An in-place write can retain the same typed-array identities. Re-upload
    // that mesh without changing another instance's existing GPU snapshot.
    const fresh = !!previous && geometryMatches(previous.geometry.key, mesh);
    if (fresh) previous.geometry.active = false;
    const geometry = this.acquireGeometry(mesh, fresh);
    const scope = new ResourceScope();
    scope.add(() => this.releaseGeometry(geometry));
    let data: MeshGPUData;
    try {
      const modelUniformBuffer = this.device.createBuffer({
        viewOrSize: MESH_MODEL_UNIFORM_FLOATS * 4,
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
      scope.add(() => modelUniformBuffer.destroy());
      const bindings = new MeshDrawBindings(this.device, modelUniformBuffer);
      scope.add(() => bindings.destroy());
      const outlineBindings = new MeshDrawBindings(
        this.device,
        modelUniformBuffer,
      );
      scope.add(() => outlineBindings.destroy());
      const shadowBindings = new ShadowDrawBindings(
        this.device,
        modelUniformBuffer,
      );
      scope.add(() => shadowBindings.destroy());
      data = {
        ...geometry.buffers,
        modelUniformBuffer,
        modelUniforms: new MeshModelUniforms(modelUniformBuffer),
        bindings,
        outlineBindings,
        shadowBindings,
      };
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
      geometry,
      dispose: () => scope.dispose(),
    });
    previous?.dispose();
    return data;
  }

  private acquireGeometry(mesh: Mesh3D, fresh: boolean): SharedGeometry {
    const matching = this.geometry.get(mesh.positions) ?? [];
    if (!fresh) {
      for (let i = matching.length - 1; i >= 0; i--) {
        const shared = matching[i];
        if (shared.active && geometryMatches(shared.key, mesh)) {
          shared.references++;
          return shared;
        }
      }
    }
    const scope = new ResourceScope();
    let bytes = 0;
    const buffer = (view: Float32Array | Uint32Array, usage: BufferUsage) => {
      const resource = this.device.createBuffer({
        viewOrSize: view,
        usage,
        hint: BufferFrequencyHint.STATIC,
      });
      bytes += view.byteLength;
      scope.add(() => resource.destroy());
      return resource;
    };
    let buffers: GeometryBuffers;
    try {
      buffers = {
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
        localBounds: meshBounds(mesh.positions),
      };
    } catch (error) {
      try {
        scope.dispose();
      } catch {
        /* Preserve the allocation error after attempting every release. */
      }
      throw error;
    }
    const key: GeometryKey = {
      positions: mesh.positions,
      normals: mesh.normals,
      tangents: mesh.tangents,
      colors: mesh.colors,
      uvs: mesh.uvs,
      uvs1: mesh.uvs1,
      indices: mesh.indices,
    };
    const shared: SharedGeometry = {
      key,
      buffers,
      bytes,
      references: 1,
      active: true,
      dispose: () => scope.dispose(),
    };
    matching.push(shared);
    this.geometry.set(mesh.positions, matching);
    return shared;
  }

  private releaseGeometry(shared: SharedGeometry): void {
    if (--shared.references > 0) return;
    const bucket = this.geometry.get(shared.key.positions);
    if (bucket) {
      const index = bucket.indexOf(shared);
      if (index !== -1) bucket.splice(index, 1);
      if (!bucket.length) this.geometry.delete(shared.key.positions);
    }
    shared.dispose();
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
