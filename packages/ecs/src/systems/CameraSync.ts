import { System } from '@lastolivegames/becsy';
import {
  Camera,
  Camera3D,
  Canvas,
  canvasWorldToWorld3D,
  ComputedCamera,
} from '../components';

/**
 * Synchronizes Camera3D with the 2D Camera in unified 3D space mode.
 *
 * When Camera3D.linked is true, this system reads the 2D camera's pan (x, y)
 * and zoom from ComputedCamera, then updates Camera3D.eye and Camera3D.center
 * so that all objects — both 2D (on the z=0 plane) and 3D — live in one
 * continuous space.
 *
 * Mapping (2D canvas is Y-down; WebGL 3D is Y-up — negate Y):
 * - 2D pan (x, y) → Camera3D.eye = (x, -y, baseDistance / zoom)
 * - 2D pan (x, y) → Camera3D.center = (x, -y, 0)
 * - 2D zoom → controls camera distance from the z=0 plane
 *
 * Mesh positions: use {@link canvasWorldToWorld3D} so (x, y) matches 2D nodes.
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
    this.query((q) =>
      q.using(Camera, Canvas, ComputedCamera).read.and.using(Camera3D).write,
    );
  }

  execute(): void {
    const cam2dEntity = this.cameras2D.current[0];
    if (!cam2dEntity) return;

    const camera2d = cam2dEntity.read(Camera);
    if (!camera2d.canvas) return;

    const { width, height } = camera2d.canvas.read(Canvas);
    if (width <= 0 || height <= 0) return;

    const computed = cam2dEntity.read(ComputedCamera);
    const { x, y, zoom } = computed;

    // Match 2D mat3.projection(width,height): visible world height = height / zoom.
    const baseDistance = height / 2;
    const distance = baseDistance / zoom;

    const [, worldY] = canvasWorldToWorld3D(x, y);

    for (const cam3dEntity of this.cameras3D.current) {
      const cam3d = cam3dEntity.read(Camera3D);
      if (!cam3d.linked) continue;

      const writeCam = cam3dEntity.write(Camera3D);
      writeCam.baseDistance = baseDistance;
      writeCam.eye = [x, worldY, distance];
      writeCam.center = [x, worldY, 0];
    }
  }
}
