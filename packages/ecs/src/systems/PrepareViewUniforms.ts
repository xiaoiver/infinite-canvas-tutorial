import { System } from '@lastolivegames/becsy';
import { CanvasConfig, Camera, WindowResized } from '../components';
import { mat3 } from 'gl-matrix';

/**
 * Extract matrices from {@link Camera} component.
 */
export class PrepareViewUniforms extends System {
  private readonly canvasConfig = this.singleton.read(CanvasConfig);

  private readonly camera = this.query(
    (q) => q.addedOrChanged.with(Camera).trackWrites.using(Camera).write,
  );

  private readonly windowResized = this.query(
    (q) => q.changed.with(WindowResized).trackWrites,
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

  x: number;
  y: number;
  rotation: number;
  zoom: number;

  get projectionMatrix() {
    return this.#projectionMatrix;
  }

  get viewMatrix() {
    return this.#viewMatrix;
  }

  get viewProjectionMatrixInv() {
    return this.#viewProjectionMatrixInv;
  }

  execute(): void {
    const { width, height } = this.canvasConfig;

    this.camera.addedOrChanged.forEach((entity) => {
      const { x, y, rotation, zoom } = entity.read(Camera);
      this.x = x || 0;
      this.y = y || 0;
      this.rotation = rotation || 0;
      this.zoom = zoom || 1;

      this.projection(width, height);
      this.updateMatrix();
    });

    this.windowResized.changed.forEach((entity) => {
      const { width, height } = entity.read(WindowResized);
      this.projection(width, height);
    });
  }

  private projection(width: number, height: number) {
    mat3.projection(this.#projectionMatrix, width, height);
    this.updateViewProjectionMatrix();
  }

  private updateMatrix() {
    const zoomScale = 1 / this.zoom;
    mat3.identity(this.#matrix);
    mat3.translate(this.#matrix, this.#matrix, [this.x, this.y]);
    mat3.rotate(this.#matrix, this.#matrix, this.rotation);
    mat3.scale(this.#matrix, this.#matrix, [zoomScale, zoomScale]);
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
