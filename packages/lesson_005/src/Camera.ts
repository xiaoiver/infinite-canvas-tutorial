import { ClipSpaceNearZ } from '@antv/g-device-api';
import { mat3, vec2 } from 'gl-matrix';
import { EASING_FUNCTION } from './utils';

const EPSILON = 0.01;

export interface Landmark {
  zoom: number;
  x: number;
  y: number;
  rotation: number;
}

export class Camera {
  clipSpaceNearZ = ClipSpaceNearZ.NEGATIVE_ONE;

  /**
   * Zoom factor of the camera, default is 1.
   * @see https://threejs.org/docs/#api/en/cameras/OrthographicCamera.zoom
   */
  #zoom = 1;
  #x = 0;
  #y = 0;
  #rotation = 0;
  #width = 0;
  #height = 0;

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

  constructor(width: number, height: number) {
    this.projection(width, height);
    this.updateMatrix();
  }

  projection(width: number, height: number) {
    this.#width = width;
    this.#height = height;
    mat3.projection(this.#projectionMatrix, width, height);
    this.updateViewProjectionMatrix();
  }

  private updateMatrix() {
    const zoomScale = 1 / this.#zoom;
    mat3.identity(this.#matrix);
    mat3.translate(this.#matrix, this.#matrix, [this.#x, this.#y]);
    mat3.rotate(this.#matrix, this.#matrix, this.#rotation);
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

  get projectionMatrix() {
    return this.#projectionMatrix;
  }

  get viewMatrix() {
    return this.#viewMatrix;
  }

  get viewProjectionMatrix() {
    return this.#viewProjectionMatrix;
  }

  get viewProjectionMatrixInv() {
    return this.#viewProjectionMatrixInv;
  }

  get matrix() {
    return this.#matrix;
  }

  get zoom() {
    return this.#zoom;
  }
  set zoom(zoom: number) {
    if (this.#zoom !== zoom) {
      this.#zoom = zoom;
      this.updateMatrix();
    }
  }

  get x() {
    return this.#x;
  }
  set x(x: number) {
    if (this.#x !== x) {
      this.#x = x;
      this.updateMatrix();
    }
  }

  get y() {
    return this.#y;
  }
  set y(y: number) {
    if (this.#y !== y) {
      this.#y = y;
      this.updateMatrix();
    }
  }

  get rotation() {
    return this.#rotation;
  }
  set rotation(rotation: number) {
    if (this.#rotation !== rotation) {
      this.#rotation = rotation;
      this.updateMatrix();
    }
  }

  get width() {
    return this.#width;
  }
  get height() {
    return this.#height;
  }

  createLandmark(params: Partial<Landmark> = {}): Landmark {
    return {
      zoom: this.#zoom,
      x: this.#x,
      y: this.#y,
      rotation: this.#rotation,
      ...params,
    };
  }

  gotoLandmark(
    landmark: Landmark,
    options: Partial<{
      easing: string;
      duration: number;
      onframe: (t: number) => void;
      onfinish: () => void;
    }> = {},
  ) {
    const {
      easing = 'linear',
      duration = 100,
      onframe = undefined,
      onfinish = undefined,
    } = options;

    const { zoom, x, y, rotation } = landmark;

    const endAnimation = () => {
      this.#zoom = zoom;
      this.#x = x;
      this.#y = y;
      this.#rotation = rotation;
      this.updateMatrix();
      if (onfinish) {
        onfinish();
      }
    };

    if (duration === 0) {
      endAnimation();
      return;
    }

    this.cancelLandmarkAnimation();

    let timeStart: number | undefined;
    const destPosition: vec2 = [x, y];
    const destZoomRotation: vec2 = [zoom, rotation];
    const animate = (timestamp: number) => {
      if (timeStart === undefined) {
        timeStart = timestamp;
      }
      const elapsed = timestamp - timeStart;

      if (elapsed > duration) {
        endAnimation();
        return;
      }
      // use the same ease function in animation system
      const t = EASING_FUNCTION[easing](elapsed / duration);

      const interPosition = vec2.create();
      const interZoomRotation = vec2.fromValues(1, 0);

      vec2.lerp(interPosition, [this.#x, this.#y], destPosition, t);
      vec2.lerp(
        interZoomRotation,
        [this.zoom, this.#rotation],
        destZoomRotation,
        t,
      );

      this.#x = interPosition[0];
      this.#y = interPosition[1];
      this.#zoom = interZoomRotation[0];
      this.#rotation = interZoomRotation[1];
      this.updateMatrix();

      const dist = vec2.dist(interPosition, destPosition);
      if (dist <= EPSILON) {
        endAnimation();
        return;
      }

      if (elapsed < duration) {
        if (onframe) {
          onframe(t);
        }
        this.#landmarkAnimationID = requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  cancelLandmarkAnimation() {
    if (this.#landmarkAnimationID !== undefined) {
      cancelAnimationFrame(this.#landmarkAnimationID);
    }
  }
}
