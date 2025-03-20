import { Entity, System } from '@lastolivegames/becsy';
import { mat3 } from 'gl-matrix';
import { Camera, CanvasConfig, ComputedCamera, Transform } from '../components';

/**
 * Compute the points of the path according to the definition.
 */
export class ComputeCamera extends System {
  private readonly canvasConfig = this.singleton.read(CanvasConfig);

  private readonly cameras = this.query(
    (q) => q.current.addedOrChanged.with(Camera, Transform).trackWrites,
  );

  /**
   * Matrix in world space.
   */
  #matrix = mat3.create();

  /**
   * Projection matrix.
   */
  #projectionMatrix = mat3.create();

  /**
   * Invert matrix in world space.
   */
  #viewMatrix = mat3.create();

  /**
   * projectionMatrix * viewMatrix
   */
  #viewProjectionMatrix = mat3.create();

  /**
   * Invert viewProjectionMatrix.
   */
  #viewProjectionMatrixInv = mat3.create();

  #prevWidth: number;
  #prevHeight: number;

  constructor() {
    super();
    this.query((q) => q.using(ComputedCamera).write);
    this.schedule((s) => s.afterWritersOf(Camera));
  }

  execute(): void {
    const { width, height } = this.canvasConfig;

    this.cameras.addedOrChanged.forEach((entity) => {
      this.#prevWidth = width;
      this.#prevHeight = height;

      this.projection(width, height);
      this.updateMatrix(entity.read(Transform));
      this.updateComputedCamera(entity);
    });

    if (this.#prevWidth !== width || this.#prevHeight !== height) {
      this.#prevWidth = width;
      this.#prevHeight = height;
      this.cameras.current.forEach((entity) => {
        this.projection(width, height);
        this.updateComputedCamera(entity);
      });
    }
  }

  private updateComputedCamera(entity: Entity) {
    const { translation, rotation, scale } = entity.read(Transform);

    if (!entity.has(ComputedCamera)) {
      entity.add(ComputedCamera);
    }

    Object.assign(entity.write(ComputedCamera), {
      projectionMatrix: this.#projectionMatrix,
      viewMatrix: this.#viewMatrix,
      viewProjectionMatrix: this.#viewProjectionMatrix,
      viewProjectionMatrixInv: this.#viewProjectionMatrixInv,
      x: translation.x,
      y: translation.y,
      rotation,
      zoom: 1 / scale.x,
    });
  }

  private projection(width: number, height: number) {
    mat3.projection(this.#projectionMatrix, width, height);
    this.updateViewProjectionMatrix();
  }

  private updateMatrix(transform: Transform) {
    const { translation, rotation, scale } = transform;
    mat3.identity(this.#matrix);
    mat3.translate(this.#matrix, this.#matrix, [translation.x, translation.y]);
    mat3.rotate(this.#matrix, this.#matrix, rotation);
    mat3.scale(this.#matrix, this.#matrix, [scale.x, scale.y]);
    mat3.invert(this.#viewMatrix, this.#matrix);
    this.updateViewProjectionMatrix();
  }

  private updateViewProjectionMatrix() {
    mat3.multiply(
      this.#viewProjectionMatrix,
      this.#projectionMatrix,
      this.#viewMatrix,
    );
    mat3.invert(this.#viewProjectionMatrixInv, this.#viewProjectionMatrix);
  }
}
