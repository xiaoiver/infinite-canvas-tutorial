import { Entity, System } from '@lastolivegames/becsy';
import { IPointData } from '@pixi/math';
import { mat3, vec2 } from 'gl-matrix';
import {
  Canvas,
  Input,
  InputPoint,
  Pen,
  Camera,
  ComputedCamera,
  Transform,
  Cursor,
} from '../components';
import { ComputeCamera } from './ComputeCamera';

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 4;
const PINCH_FACTOR = 100;

export class CameraControl extends System {
  private readonly points = this.query((q) => q.current.with(InputPoint).write);
  private readonly cameras = this.query(
    (q) =>
      q.current
        .with(Camera)
        .read.and.with(ComputedCamera)
        .read.and.with(Transform).write,
  );

  private startInvertViewProjectionMatrix = mat3.create();
  private startCameraX: number;
  private startCameraY: number;
  private startCameraRotation: number;
  private startPos = vec2.create();
  private startMousePos: vec2;
  private rotate = false;

  constructor() {
    super();
    this.query((q) => q.using(Canvas).read.and.using(Input, Cursor).write);
    this.schedule((s) => s.after(ComputeCamera));
  }

  initialize() {}

  execute() {
    this.cameras.current.forEach((entity) => {
      const camera = entity.read(Camera);
      const canvas = camera.canvas.read(Canvas);

      if (!camera.canvas.has(Input)) {
        camera.canvas.add(Input);
      }
      if (!camera.canvas.has(Cursor)) {
        camera.canvas.add(Cursor);
      }

      const input = camera.canvas.write(Input);
      const cursor = camera.canvas.write(Cursor);

      const transform = entity.read(Transform);
      const computedCamera = entity.read(ComputedCamera);
      const x = transform.translation.x;
      const y = transform.translation.y;
      const rotation = transform.rotation;
      const viewProjectionMatrixInv = computedCamera.viewProjectionMatrixInv;

      if (input.pointerDownTrigger) {
        this.createEntity(InputPoint, {
          prevPoint: input.pointerWorld,
        });
        if (canvas.pen === Pen.HAND) {
          cursor.value = 'grabbing';

          this.rotate = input.shiftKey;
          mat3.copy(
            this.startInvertViewProjectionMatrix,
            viewProjectionMatrixInv,
          );
          this.startCameraX = x;
          this.startCameraY = y;
          this.startCameraRotation = rotation;
          vec2.transformMat3(
            this.startPos,
            this.getClipSpaceMousePosition(entity),
            this.startInvertViewProjectionMatrix,
          );
          this.startMousePos = [input.pointerWorld[0], input.pointerWorld[1]];
        }
      }
      for (const point of this.points.current) {
        point.write(InputPoint).prevPoint = input.pointerWorld;
        if (canvas.pen === Pen.HAND) {
          cursor.value = 'grabbing';
          if (this.rotate) {
            this.rotateCamera(entity);
          } else {
            this.moveCamera(entity);
          }
        }
      }
      if (input.pointerUpTrigger) {
        for (const point of this.points.current) {
          point.delete();
        }
        if (canvas.pen === Pen.HAND) {
          cursor.value = 'grab';
          this.rotate = false;
        }
      }

      if (input.wheelTrigger) {
        if (input.metaKey || input.ctrlKey) {
          this.zoomByClientPoint(
            entity,
            { x: input.pointerWorld[0], y: input.pointerWorld[1] },
            input.deltaY,
          );
        } else {
          const { x, y, zoom } = entity.read(ComputedCamera);
          // TODO: account for rotation
          const transform = entity.write(Transform);
          Object.assign(transform, {
            translation: {
              x: x + input.deltaX / zoom,
              y: y + input.deltaY / zoom,
            },
            rotation: rotation,
          });
        }

        input.wheelTrigger = false;
        input.ctrlKey = false;
        input.metaKey = false;
        input.shiftKey = false;
      }
    });
  }

  private moveCamera(entity: Entity) {
    const pos = vec2.transformMat3(
      vec2.create(),
      this.getClipSpaceMousePosition(entity),
      this.startInvertViewProjectionMatrix,
    );

    const transform = entity.write(Transform);
    Object.assign(transform, {
      translation: {
        x: this.startCameraX + this.startPos[0] - pos[0],
        y: this.startCameraY + this.startPos[1] - pos[1],
      },
      rotation: this.startCameraRotation,
    });
  }

  private rotateCamera(entity: Entity) {
    const transform = entity.write(Transform);
    const input = entity.read(Camera).canvas.read(Input);

    const delta =
      (input.pointerWorld[0] - this.startMousePos[0]) / PINCH_FACTOR;

    // compute a matrix to pivot around the camera space startPos
    const camMat = mat3.create();
    mat3.translate(camMat, camMat, [this.startPos[0], this.startPos[1]]);
    mat3.rotate(camMat, camMat, delta);
    mat3.translate(camMat, camMat, [-this.startPos[0], -this.startPos[1]]);

    // multiply in the original camera matrix
    const matrix = this.updateMatrix(
      this.startCameraX,
      this.startCameraY,
      this.startCameraRotation,
      1 / transform.scale.x,
    );
    mat3.multiply(camMat, camMat, matrix);

    // now we can set the rotation and get the needed
    // camera position from the matrix

    Object.assign(transform, {
      translation: {
        x: camMat[6],
        y: camMat[7],
      },
      rotation: this.startCameraRotation + delta,
    });
  }

  private zoomByClientPoint = (
    entity: Entity,
    client: IPointData,
    dist: number,
  ) => {
    const { x, y, zoom, rotation } = entity.read(ComputedCamera);

    // multiply the wheel movement by the current zoom level
    // so we zoom less when zoomed in and more when zoomed out
    const newZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, zoom * Math.pow(2, dist * -0.01)),
    );

    this.applyLandmark(
      {
        x,
        y,
        zoom: newZoom,
        rotation,
        viewportX: client.x,
        viewportY: client.y,
      },
      entity,
    );
  };

  private getClipSpaceMousePosition(entity: Entity): vec2 {
    const camera = entity.read(Camera);
    const canvas = camera.canvas.read(Canvas);
    const input = camera.canvas.read(Input);

    const { element, devicePixelRatio } = canvas;

    // get canvas relative css position
    const rect = (element as HTMLCanvasElement).getBoundingClientRect();
    const cssX = input.pointerWorld[0] - rect.left;
    const cssY = input.pointerWorld[1] - rect.top;

    // get normalized 0 to 1 position across and down canvas
    const normalizedX =
      cssX /
      ((element as HTMLCanvasElement).clientWidth ||
        canvas.width / devicePixelRatio);
    const normalizedY =
      cssY /
      ((element as HTMLCanvasElement).clientHeight ||
        canvas.height / devicePixelRatio);

    // convert to clip space
    const clipX = normalizedX * 2 - 1;
    const clipY = normalizedY * -2 + 1;

    return [clipX, clipY];
  }

  private updateMatrix(x: number, y: number, rotation: number, zoom: number) {
    const zoomScale = 1 / zoom;
    const matrix = mat3.create();
    mat3.identity(matrix);
    mat3.translate(matrix, matrix, [x, y]);
    mat3.rotate(matrix, matrix, rotation);
    mat3.scale(matrix, matrix, [zoomScale, zoomScale]);
    return matrix;
  }

  applyLandmark(
    landmark: {
      x: number;
      y: number;
      zoom: number;
      rotation: number;
      viewportX: number;
      viewportY: number;
    },
    entity: Entity,
  ) {
    const { projectionMatrix, viewProjectionMatrixInv } =
      entity.read(ComputedCamera);
    const { x, y, zoom, rotation, viewportX, viewportY } = landmark;
    const useFixedViewport = viewportX || viewportY;
    let preZoomX = 0;
    let preZoomY = 0;
    if (useFixedViewport) {
      const canvas = this.viewport2Canvas(
        entity,
        {
          x: viewportX,
          y: viewportY,
        },
        viewProjectionMatrixInv,
      );
      preZoomX = canvas.x;
      preZoomY = canvas.y;
    }

    const viewMatrix = mat3.create();
    const viewProjectionMatrix = mat3.create();
    const viewProjectionMatrixInv2 = mat3.create();
    const matrix = this.updateMatrix(x, y, rotation, zoom);
    mat3.invert(viewMatrix, matrix);
    mat3.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);
    mat3.invert(viewProjectionMatrixInv2, viewProjectionMatrix);

    if (useFixedViewport) {
      const { x: postZoomX, y: postZoomY } = this.viewport2Canvas(
        entity,
        {
          x: viewportX,
          y: viewportY,
        },
        viewProjectionMatrixInv2,
      );

      Object.assign(entity.write(Transform), {
        translation: {
          x: x + preZoomX - postZoomX,
          y: y + preZoomY - postZoomY,
        },
        rotation,
        scale: { x: 1 / zoom, y: 1 / zoom },
      });
    }
  }

  private viewport2Canvas(
    entity: Entity,
    { x, y }: IPointData,
    viewProjectionMatrixInv: mat3,
  ): IPointData {
    const camera = entity.read(Camera);
    const { width, height } = camera.canvas.read(Canvas);
    const canvas = vec2.transformMat3(
      vec2.create(),
      [(x / width) * 2 - 1, (1 - y / height) * 2 - 1],
      viewProjectionMatrixInv,
    );
    return { x: canvas[0], y: canvas[1] };
  }
}
