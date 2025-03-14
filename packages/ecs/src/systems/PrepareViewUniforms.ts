import { System } from '@lastolivegames/becsy';
import { mat3 } from 'gl-matrix';
import { CanvasConfig, Camera, WindowResized } from '../components';

/**
 * Extract matrices from {@link Camera} component.
 */
export class PrepareViewUniforms extends System {
  private readonly canvasConfig = this.singleton.read(CanvasConfig);
  private readonly windowResized = this.singleton.read(WindowResized);

  private readonly camera = this.query(
    (q) => q.addedOrChanged.with(Camera).trackWrites.using(Camera).write,
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
    this.camera.addedOrChanged.forEach((entity) => {
      const { width, height } = this.canvasConfig;
      const { x, y, rotation, zoom } = entity.read(Camera);
      this.x = x || 0;
      this.y = y || 0;
      this.rotation = rotation || 0;
      this.zoom = zoom || 1;

      this.projection(width, height);
      this.updateMatrix();

      console.log('camera...');
    });

    const { width, height } = this.windowResized;
    if (width > 0 && height > 0) {
      this.projection(width, height);
    }
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
