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
  ComputedCameraControl,
  Mat3,
} from '../components';
import { API } from '../API';
import { safeAddComponent } from '../history';

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 4;
const PINCH_FACTOR = 100;

export class CameraControl extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(Canvas, ComputedCamera)
          .read.update.and.using(
            Input,
            Cursor,
            ComputedCameraControl,
            Transform,
            InputPoint,
          )
          .write.and.using(Input).read,
    );
  }

  execute() {
    this.cameras.current.forEach((entity) => {
      const camera = entity.read(Camera);
      safeAddComponent(entity, ComputedCameraControl);

      if (!camera.canvas) {
        return;
      }

      if (!entity.has(ComputedCamera)) {
        return;
      }

      const canvas = camera.canvas.hold();
      const { api, inputPoints } = canvas.read(Canvas);
      const pen = api.getAppState().penbarSelected[0];

      const cameraControl = entity.write(ComputedCameraControl);

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      const { pointerViewport } = input;

      const transform = entity.read(Transform);
      const computedCamera = entity.read(ComputedCamera);
      const viewProjectionMatrixInv = Mat3.toGLMat3(
        computedCamera.viewProjectionMatrixInv,
      );

      const x = transform.translation.x;
      const y = transform.translation.y;
      const rotation = transform.rotation;

      if (pen === Pen.HAND) {
        cursor.value = 'grab';
      } else if (pen === Pen.TEXT) {
        cursor.value = 'text';
      }

      if (input.pointerDownTrigger) {
        this.createEntity(InputPoint, {
          prevPoint: pointerViewport,
          canvas,
        });

        {
          const [x, y] = pointerViewport;
          cameraControl.pointerDownViewportX = x;
          cameraControl.pointerDownViewportY = y;
          const { x: wx, y: wy } = api.viewport2Canvas({
            x,
            y,
          });
          cameraControl.pointerDownCanvasX = wx;
          cameraControl.pointerDownCanvasY = wy;
        }

        if (pen === Pen.HAND) {
          cursor.value = 'grabbing';

          cameraControl.rotate = input.shiftKey;
          mat3.copy(
            cameraControl.startInvertViewProjectionMatrix,
            viewProjectionMatrixInv,
          );
          cameraControl.startCameraX = x;
          cameraControl.startCameraY = y;
          cameraControl.startCameraRotation = rotation;
          vec2.transformMat3(
            cameraControl.startPos,
            this.getClipSpaceMousePosition(entity),
            cameraControl.startInvertViewProjectionMatrix,
          );
          cameraControl.startMousePos = pointerViewport;
        }
      }

      inputPoints.forEach((point) => {
        const inputPoint = point.write(InputPoint);
        const {
          prevPoint: [prevX, prevY],
        } = inputPoint;
        const [x, y] = pointerViewport;
        if (prevX === x && prevY === y) {
          return;
        }

        if (pen === Pen.HAND) {
          cursor.value = 'grabbing';
          if (cameraControl.rotate) {
            this.rotateCamera(entity);
          } else {
            this.moveCamera(entity);
          }
        }
      });

      if (input.pointerUpTrigger) {
        Object.assign(cameraControl, {
          pointerDownViewportX: undefined,
          pointerDownViewportY: undefined,
          pointerDownCanvasX: undefined,
          pointerDownCanvasY: undefined,
        });

        for (const point of canvas.read(Canvas).inputPoints) {
          point.delete();
        }
        if (pen === Pen.HAND) {
          cursor.value = 'grab';
          cameraControl.rotate = false;
        }
      }

      if (input.wheelTrigger) {
        if (input.metaKey || input.ctrlKey) {
          this.zoomByClientPoint(
            entity,
            api,
            { x: pointerViewport[0], y: pointerViewport[1] },
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
      }

      Object.assign(input, {
        wheelTrigger: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      });
    });
  }

  private moveCamera(entity: Entity) {
    const {
      startInvertViewProjectionMatrix,
      startPos,
      startCameraX,
      startCameraY,
      startCameraRotation,
    } = entity.read(ComputedCameraControl);

    const pos = vec2.transformMat3(
      vec2.create(),
      this.getClipSpaceMousePosition(entity),
      startInvertViewProjectionMatrix,
    );

    const transform = entity.write(Transform);
    Object.assign(transform, {
      translation: {
        x: startCameraX + startPos[0] - pos[0],
        y: startCameraY + startPos[1] - pos[1],
      },
      rotation: startCameraRotation,
    });
  }

  private rotateCamera(entity: Entity) {
    const {
      startPos,
      startCameraX,
      startCameraY,
      startCameraRotation,
      startMousePos,
    } = entity.read(ComputedCameraControl);

    const transform = entity.write(Transform);
    const input = entity.read(Camera).canvas.read(Input);

    const delta = (input.pointerViewport[0] - startMousePos[0]) / PINCH_FACTOR;

    // compute a matrix to pivot around the camera space startPos
    const camMat = mat3.create();
    mat3.translate(camMat, camMat, [startPos[0], startPos[1]]);
    mat3.rotate(camMat, camMat, delta);
    mat3.translate(camMat, camMat, [-startPos[0], -startPos[1]]);

    // multiply in the original camera matrix
    const matrix = updateMatrix(
      startCameraX,
      startCameraY,
      startCameraRotation,
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
      rotation: startCameraRotation + delta,
    });
  }

  private zoomByClientPoint = (
    camera: Entity,
    api: API,
    client: IPointData,
    dist: number,
  ) => {
    const { zoom } = camera.read(ComputedCamera);

    // multiply the wheel movement by the current zoom level
    // so we zoom less when zoomed in and more when zoomed out
    const newZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, zoom * Math.pow(2, dist * -0.01)),
    );

    api.gotoLandmark(
      api.createLandmark({
        viewportX: client.x,
        viewportY: client.y,
        zoom: newZoom,
      }),
      { duration: 0 },
    );
  };

  private getClipSpaceMousePosition(entity: Entity): vec2 {
    const camera = entity.read(Camera);
    const canvas = camera.canvas.read(Canvas);
    const input = camera.canvas.read(Input);

    const { element, devicePixelRatio } = canvas;

    // get canvas relative css position
    const rect = (element as HTMLCanvasElement).getBoundingClientRect();
    const cssX = input.pointerViewport[0] - rect.left;
    const cssY = input.pointerViewport[1] - rect.top;

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
}

export function updateMatrix(
  x: number,
  y: number,
  rotation: number,
  zoom: number,
) {
  const zoomScale = 1 / zoom;
  const matrix = mat3.create();
  mat3.identity(matrix);
  mat3.translate(matrix, matrix, [x, y]);
  mat3.rotate(matrix, matrix, rotation);
  mat3.scale(matrix, matrix, [zoomScale, zoomScale]);
  return matrix;
}
