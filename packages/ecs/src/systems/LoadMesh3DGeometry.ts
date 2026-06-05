import { System } from '@lastolivegames/becsy';
import {
  Material3D,
  Mesh3D,
  Mesh3DNode,
  Mesh3DNodeTarget,
} from '../components';
import { requestGltfMeshLoad } from '../utils/gltf/request-gltf-mesh-load';

/**
 * Async glTF geometry loader for declarative {@link Mesh3DNode} sources.
 * Runs after {@link EnsureMesh3DNodes} creates companion meshes and
 * {@link SyncExtrude3D} (PostUpdate chain), before {@link SyncMesh3DNodes}.
 */
export class LoadMesh3DGeometry extends System {
  private readonly sources = this.query((q) =>
    q.current.with(Mesh3DNode).read,
  );

  constructor() {
    super();
    this.query((q) =>
      q
        .using(Mesh3DNodeTarget)
        .read.and.using(Mesh3D, Material3D, Mesh3DNode)
        .write,
    );
  }

  execute(): void {
    for (const source of this.sources.current) {
      requestGltfMeshLoad(source);
    }
  }
}
