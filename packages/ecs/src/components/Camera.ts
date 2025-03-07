import { mat3, vec2 } from 'gl-matrix';
// import { ClipSpaceNearZ } from '@antv/g-device-api';
import { field } from '@lastolivegames/becsy';

export class Camera {
  // @field.staticString([ClipSpaceNearZ.NEGATIVE_ONE, ClipSpaceNearZ.ZERO]) declare clipSpaceNearZ: ClipSpaceNearZ;

  /**
   * x in canvas space
   */
  @field.float32 declare x: number;

  /**
   * y in canvas space
   */
  @field.float32 declare y: number;

  /**
   * rotation in canvas space
   */
  @field.float32 declare rotation: number;

  /**
   * Zoom factor of the camera, default is 1.
   * @see https://threejs.org/docs/#api/en/cameras/OrthographicCamera.zoom
   */
  @field.float32 declare zoom: number;

  @field.float32 declare width: number;
  @field.float32 declare height: number;

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

  /**
   * Animation ID of landmark animation.
   */
  #landmarkAnimationID: number;

  constructor(width?: number, height?: number) {
    this.width = width || 0;
    this.height = height || 0;
    this.zoom = 1;
    this.x = 0;
    this.y = 0;
    this.rotation = 0;

    this.projection(width, height);
    this.updateMatrix();
  }

  projection(width: number, height: number) {
    this.width = width;
    this.height = height;
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
    // if (this.onchange) {
    //   this.onchange();
    // }
  }
}
