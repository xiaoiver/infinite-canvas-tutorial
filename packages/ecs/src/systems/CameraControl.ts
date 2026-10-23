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
  Camera3D,
} from '../components';
import { API } from '../API';
import { safeAddComponent } from '../history';
import {
  isNavigableCamera3D,
  orbitCamera3D,
  panCamera3D,
  zoomCamera3D,
} from '../utils/isometric-navigation';

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 4;
const PINCH_FACTOR = 100;

export class CameraControl extends System {
  private readonly cameras = this.query(
    (q) => q.current.and.removed.with(Camera).read,
  );
  private readonly gesturePens = new Map<number, Pen>();

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
    this.query((q) => q.using(Camera3D).write);
  }

  execute() {
    this.cameras.removed.forEach((entity) =>
      this.gesturePens.delete(entity.__id),
    );
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
      const { width, height } = canvas.read(Canvas);
      const camera3D = canvas.has(Camera3D) ? canvas.read(Camera3D) : undefined;
      const navigate3D = camera3D && isNavigableCamera3D(camera3D);
      const pen = api.getAppState().penbarSelected;
      const orbit3D = pen === Pen.ORBIT_3D && navigate3D;
      const navigationPen = pen === Pen.HAND || orbit3D;

      const cameraControl = entity.write(ComputedCameraControl);

      // A held selection pointer must not become a camera pan on tool change.
      const toolChanged =
        this.gesturePens.has(entity.__id) &&
        this.gesturePens.get(entity.__id) !== pen;
      if (toolChanged) {
        this.releaseInputPoints(entity, canvas, cameraControl);
      }

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

      if (pen === Pen.TEXT) {
        cursor.value = 'text';
      }

      if (
        input.pointerDownTrigger &&
        !input.pointerCancelled &&
        input.key !== 'Escape'
      ) {
        this.gesturePens.set(entity.__id, pen);
        this.createEntity(InputPoint, {
          prevPoint: input.pointerDownViewport,
          canvas,
        });

        {
          const [x, y] = input.pointerDownViewport;
          cameraControl.pointerDownViewportX = x;
          cameraControl.pointerDownViewportY = y;
          const { x: wx, y: wy } = api.viewport2Canvas({
            x,
            y,
          });
          cameraControl.pointerDownCanvasX = wx;
          cameraControl.pointerDownCanvasY = wy;
        }

        if (navigationPen) {
          cursor.value = 'grabbing';

          cameraControl.rotate = !!orbit3D || input.shiftKey;
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
          cameraControl.startMousePos = vec2.fromValues(
            pointerViewport[0],
            pointerViewport[1],
          );
        }
      }

      // Pointdown on canvas, then pointerup outside of canvas, inputPoints will not be deleted
      if (inputPoints.length > 1) {
        inputPoints.forEach((point) => {
          point.delete();
        });
      }

      inputPoints.forEach((point) => {
        if (toolChanged) return;
        const inputPoint = point.write(InputPoint);
        const {
          prevPoint: [prevX, prevY],
        } = inputPoint;
        const [x, y] = pointerViewport;
        if (prevX === x && prevY === y) {
          return;
        }

        if (navigationPen) {
          cursor.value = 'grabbing';
          if (navigate3D) {
            if (cameraControl.rotate) {
              orbitCamera3D(canvas.write(Camera3D), x - prevX, y - prevY);
            } else {
              panCamera3D(
                canvas.write(Camera3D),
                [prevX, prevY],
                [x, y],
                width,
                height,
              );
            }
            inputPoint.prevPoint = [x, y];
          } else if (cameraControl.rotate) {
            this.rotateCamera(entity);
          } else {
            this.moveCamera(entity);
          }
        }
      });

      if (
        input.pointerUpTrigger ||
        input.pointerCancelled ||
        (pen === Pen.SELECT && input.key === 'Escape')
      ) {
        this.releaseInputPoints(entity, canvas, cameraControl);
        if (navigationPen) {
          cursor.value = 'grab';
          cameraControl.rotate = false;
        }
      }

      if (input.wheelTrigger) {
        if (navigate3D) {
          if (
            !input.shiftKey &&
            (input.metaKey ||
              input.ctrlKey ||
              Math.abs(input.deltaY) >= Math.abs(input.deltaX))
          ) {
            zoomCamera3D(
              canvas.write(Camera3D),
              pointerViewport,
              input.deltaY,
              width,
              height,
              api.getAppState().cameraZoomFactor,
            );
          } else {
            panCamera3D(
              canvas.write(Camera3D),
              pointerViewport,
              [
                pointerViewport[0] - input.deltaX,
                pointerViewport[1] - input.deltaY,
              ],
              width,
              height,
            );
          }
        } else if (input.metaKey || input.ctrlKey) {
          this.zoomByClientPoint(
            entity,
            api,
            { x: pointerViewport[0], y: pointerViewport[1] },
            input.deltaY,
          );
        } else {
          this.panByViewportDelta(entity, input.deltaX, input.deltaY);
        }
      }

      if (input.touchPanDeltaX !== 0 || input.touchPanDeltaY !== 0) {
        if (navigate3D) {
          panCamera3D(
            canvas.write(Camera3D),
            pointerViewport,
            [
              pointerViewport[0] + input.touchPanDeltaX,
              pointerViewport[1] + input.touchPanDeltaY,
            ],
            width,
            height,
          );
        } else {
          this.panByViewportDelta(
            entity,
            -input.touchPanDeltaX,
            -input.touchPanDeltaY,
          );
        }
      }
    });
  }

  private panByViewportDelta(entity: Entity, deltaX: number, deltaY: number) {
    const transform = entity.write(Transform);
    const { x, y } = transform.translation;
    const { rotation } = transform;
    const scale = transform.scale.x;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    transform.translation = {
      x: x + (deltaX * cos - deltaY * sin) * scale,
      y: y + (deltaX * sin + deltaY * cos) * scale,
    };
  }

  private releaseInputPoints(
    camera: Entity,
    canvas: Entity,
    control: ComputedCameraControl,
  ) {
    Object.assign(control, {
      pointerDownViewportX: undefined,
      pointerDownViewportY: undefined,
      pointerDownCanvasX: undefined,
      pointerDownCanvasY: undefined,
      rotate: false,
    });
    for (const point of canvas.read(Canvas).inputPoints) point.delete();
    this.gesturePens.delete(camera.__id);
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
    const { cameraZoomFactor } = api.getAppState();

    // multiply the wheel movement by the current zoom level
    // so we zoom less when zoomed in and more when zoomed out
    const newZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, zoom * Math.pow(2, dist * -cameraZoomFactor)),
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
