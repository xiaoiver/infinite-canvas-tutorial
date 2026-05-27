import { System } from '@lastolivegames/becsy';
import { Camera, Camera3D, ComputedCamera } from '../components';

/**
 * Synchronizes Camera3D with the 2D Camera in unified 3D space mode.
 *
 * When Camera3D.linked is true, this system reads the 2D camera's pan (x, y)
 * and zoom from ComputedCamera, then updates Camera3D.eye and Camera3D.center
 * so that all objects — both 2D (on the z=0 plane) and 3D — live in one
 * continuous space.
 *
 * Mapping:
 * - 2D pan (x, y) → Camera3D.eye = (x, y, baseDistance / zoom)
 * - 2D pan (x, y) → Camera3D.center = (x, y, 0)
 * - 2D zoom → controls camera distance from the z=0 plane
 *
 * @see https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects
 */
export class CameraSync extends System {
  private readonly cameras2D = this.query(
    (q) => q.current.with(Camera, ComputedCamera).read,
  );

  private readonly cameras3D = this.query(
    (q) => q.current.with(Camera3D).write,
  );

  constructor() {
    super();
    // Declare component access for becsy's dependency graph.
    this.query(
      (q) => q.using(Camera, ComputedCamera, Camera3D).read.write,
    );
  }

  execute(): void {
    // Find the first 2D camera with computed state
    const cam2dEntity = this.cameras2D.current[0];
    if (!cam2dEntity) return;

    const computed = cam2dEntity.read(ComputedCamera);
    const { x, y, zoom } = computed;

    // Update all linked Camera3D instances
    for (const cam3dEntity of this.cameras3D.current) {
      const cam3d = cam3dEntity.read(Camera3D);
      if (!cam3d.linked) continue;

      // Map 2D camera state → 3D camera position
      const distance = cam3d.baseDistance / zoom;

      const writeCam = cam3dEntity.write(Camera3D);
      writeCam.eye = [x, y, distance];
      writeCam.center = [x, y, 0];
    }
  }
}
