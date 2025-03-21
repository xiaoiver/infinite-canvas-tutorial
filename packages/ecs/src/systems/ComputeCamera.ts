import { Entity, System } from '@lastolivegames/becsy';
import { mat3 } from 'gl-matrix';
import { Camera, Canvas, ComputedCamera, Mat3, Transform } from '../components';

/**
 * Compute the points of the path according to the definition.
 */
export class ComputeCamera extends System {
  private readonly cameras = this.query(
    (q) => q.current.addedOrChanged.with(Camera, Transform).trackWrites,
  );

  private readonly canvases = this.query(
    (q) => q.changed.with(Canvas).trackWrites,
  );

  constructor() {
    super();
    this.query((q) => q.using(ComputedCamera).write.and.using(Canvas).read);
    this.schedule((s) => s.afterWritersOf(Camera));
  }

  execute(): void {
    this.cameras.addedOrChanged.forEach((entity) => {
      const camera = entity.read(Camera);
      const { width, height } = camera.canvas.read(Canvas);

      this.projection(entity, width, height);
      this.updateMatrix(entity);
      this.updateComputedCamera(entity);
    });

    this.canvases.changed.forEach((entity) => {
      const { cameras, width, height } = entity.read(Canvas);

      cameras.forEach((camera) => {
        this.projection(camera, width, height);
        this.updateComputedCamera(camera);
      });
    });
  }

  private updateComputedCamera(entity: Entity) {
    const { translation, rotation, scale } = entity.read(Transform);

    Object.assign(entity.write(ComputedCamera), {
      x: translation.x,
      y: translation.y,
      rotation,
      zoom: 1 / scale.x,
    });
  }

  private projection(camera: Entity, width: number, height: number) {
    if (!camera.has(ComputedCamera)) {
      camera.add(ComputedCamera);
    }

    const projectionMatrix = mat3.projection(mat3.create(), width, height);
    camera.write(ComputedCamera).projectionMatrix =
      Mat3.fromGLMat3(projectionMatrix);

    this.updateViewProjectionMatrix(camera);
  }

  private updateMatrix(entity: Entity) {
    const { translation, rotation, scale } = entity.read(Transform);

    const viewMatrix = mat3.create();
    mat3.identity(viewMatrix);
    mat3.translate(viewMatrix, viewMatrix, [translation.x, translation.y]);
    mat3.rotate(viewMatrix, viewMatrix, rotation);
    mat3.scale(viewMatrix, viewMatrix, [scale.x, scale.y]);
    mat3.invert(viewMatrix, viewMatrix);

    entity.write(ComputedCamera).viewMatrix = Mat3.fromGLMat3(viewMatrix);
    this.updateViewProjectionMatrix(entity);
  }

  private updateViewProjectionMatrix(camera: Entity) {
    const { projectionMatrix, viewMatrix } = camera.write(ComputedCamera);

    const viewProjectionMatrix = mat3.multiply(
      mat3.create(),
      Mat3.toGLMat3(projectionMatrix),
      Mat3.toGLMat3(viewMatrix),
    );
    const viewProjectionMatrixInv = mat3.invert(
      mat3.create(),
      viewProjectionMatrix,
    );

    Object.assign(camera.write(ComputedCamera), {
      viewProjectionMatrix: Mat3.fromGLMat3(viewProjectionMatrix),
      viewProjectionMatrixInv: Mat3.fromGLMat3(viewProjectionMatrixInv),
    });
  }
}
