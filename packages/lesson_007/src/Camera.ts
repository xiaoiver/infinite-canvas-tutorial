import { ClipSpaceNearZ } from '@antv/g-device-api';
import { mat3, vec2 } from 'gl-matrix';
import { EASING_FUNCTION } from './utils';
import type { IPointData } from '@pixi/math';

const EPSILON = 0.0001;

export interface Landmark {
  x: number;
  y: number;
  zoom: number;
  viewportX: number;
  viewportY: number;
  rotation: number;
}

export class Camera {
  clipSpaceNearZ = ClipSpaceNearZ.NEGATIVE_ONE;
  onchange: () => void;

  /**
   * Zoom factor of the camera, default is 1.
   * @see https://threejs.org/docs/#api/en/cameras/OrthographicCamera.zoom
   */
  #zoom = 1;

  /**
   * x in canvas space
   */
  #x = 0;

  /**
   * y in canvas space
   */
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

  clone(): Camera {
    const camera = new Camera(this.#width, this.#height);
    camera.#x = this.#x;
    camera.#y = this.#y;
    camera.#zoom = this.#zoom;
    camera.#rotation = this.#rotation;
    camera.updateMatrix();
    return camera;
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
    if (this.onchange) {
      this.onchange();
    }
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

  createLandmark(params: Partial<Landmark> = {}): Partial<Landmark> {
    return {
      zoom: this.#zoom,
      x: this.#x,
      y: this.#y,
      rotation: this.#rotation,
      ...params,
    };
  }

  gotoLandmark(
    landmark: Partial<Landmark>,
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

    const {
      zoom = this.#zoom,
      x = this.#x,
      y = this.#y,
      rotation = this.#rotation,
      viewportX = 0,
      viewportY = 0,
    } = landmark;

    const useFixedViewport = viewportX || viewportY;

    const endAnimation = () => {
      this.applyLandmark({ x, y, zoom, rotation, viewportX, viewportY });
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
    const destPosition: vec2 = [x, y]; // in world space
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

      this.applyLandmark({
        x: interPosition[0],
        y: interPosition[1],
        zoom: interZoomRotation[0],
        rotation: interZoomRotation[1],
        viewportX,
        viewportY,
      });

      if (
        useFixedViewport
          ? vec2.dist(interZoomRotation, destZoomRotation) <= EPSILON
          : vec2.dist(interPosition, destPosition) <= EPSILON
      ) {
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

  viewport2Canvas({ x, y }: IPointData, camera?: Camera): IPointData {
    const { width, height, viewProjectionMatrixInv } = camera || this;
    const canvas = vec2.transformMat3(
      vec2.create(),
      [(x / width) * 2 - 1, (1 - y / height) * 2 - 1],
      viewProjectionMatrixInv,
    );
    return { x: canvas[0], y: canvas[1] };
  }

  canvas2Viewport({ x, y }: IPointData, camera?: Camera): IPointData {
    const { width, height, viewProjectionMatrix } = camera || this;
    const clip = vec2.transformMat3(
      vec2.create(),
      [x, y],
      viewProjectionMatrix,
    );
    return {
      x: ((clip[0] + 1) / 2) * width,
      y: (1 - (clip[1] + 1) / 2) * height,
    };
  }

  private applyLandmark(landmark: Landmark) {
    const { x, y, zoom, rotation, viewportX, viewportY } = landmark;
    const useFixedViewport = viewportX || viewportY;
    let preZoomX = 0;
    let preZoomY = 0;
    if (useFixedViewport) {
      const canvas = this.viewport2Canvas({
        x: viewportX,
        y: viewportY,
      });
      preZoomX = canvas.x;
      preZoomY = canvas.y;
    }

    this.#zoom = zoom;
    this.#rotation = rotation;
    this.#x = x;
    this.#y = y;
    this.updateMatrix();

    if (useFixedViewport) {
      const { x: postZoomX, y: postZoomY } = this.viewport2Canvas({
        x: viewportX,
        y: viewportY,
      });
      this.#x += preZoomX - postZoomX;
      this.#y += preZoomY - postZoomY;
      this.updateMatrix();
    }
  }
}
