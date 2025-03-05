import { mat3, vec2 } from 'gl-matrix';
import { IPointData, Point, Rectangle } from '@pixi/math';
import type { Plugin, PluginContext } from './interfaces';
import type { FederatedPointerEvent, FederatedWheelEvent } from '../events';

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 4;
const PINCH_FACTOR = 100;

/**
 * @see https://webglfundamentals.org/webgl/lessons/webgl-qna-how-to-implement-zoom-from-mouse-in-2d-webgl.html
 * @see https://github.com/davidfig/pixi-viewport/blob/master/src/Viewport.ts
 */
export class CameraControl implements Plugin {
  #isMouseDown?: boolean;
  #touches: Record<number, { last: IPointData | null }> = {};
  #isPinch?: boolean;
  #pinching = false;

  apply(context: PluginContext) {
    const {
      canvas,
      camera,
      root,
      api: { client2Viewport, viewport2Canvas },
    } = context;

    root.hitArea = new Rectangle(
      -Number.MAX_VALUE,
      -Number.MAX_VALUE,
      Infinity,
      Infinity,
    );
    root.draggable = true;

    const startInvertViewProjectionMatrix = mat3.create();
    let startCameraX: number;
    let startCameraY: number;
    let startCameraRotation: number;
    const startPos = vec2.create();
    let startMousePos: vec2;
    let rotate = false;

    function getClipSpaceMousePosition(
      e: FederatedPointerEvent | FederatedWheelEvent,
    ): vec2 {
      // get canvas relative css position
      const rect = canvas.getBoundingClientRect();
      const cssX = e.nativeEvent.clientX - rect.left;
      const cssY = e.nativeEvent.clientY - rect.top;

      // get normalized 0 to 1 position across and down canvas
      const normalizedX = cssX / canvas.clientWidth;
      const normalizedY = cssY / canvas.clientHeight;

      // convert to clip space
      const clipX = normalizedX * 2 - 1;
      const clipY = normalizedY * -2 + 1;

      return [clipX, clipY];
    }

    function moveCamera(e: FederatedPointerEvent) {
      const pos = vec2.transformMat3(
        vec2.create(),
        getClipSpaceMousePosition(e),
        startInvertViewProjectionMatrix,
      );

      camera.x = startCameraX + startPos[0] - pos[0];
      camera.y = startCameraY + startPos[1] - pos[1];
    }

    function rotateCamera(e: FederatedPointerEvent) {
      const delta = (e.nativeEvent.clientX - startMousePos[0]) / 100;

      // compute a matrix to pivot around the camera space startPos
      const camMat = mat3.create();
      mat3.translate(camMat, camMat, [startPos[0], startPos[1]]);
      mat3.rotate(camMat, camMat, delta);
      mat3.translate(camMat, camMat, [-startPos[0], -startPos[1]]);

      // multiply in the original camera matrix
      camera.x = startCameraX;
      camera.y = startCameraY;
      camera.rotation = startCameraRotation;
      mat3.multiply(camMat, camMat, camera.matrix);

      // now we can set the rotation and get the needed
      // camera position from the matrix
      camera.rotation = startCameraRotation + delta;
      camera.x = camMat[6];
      camera.y = camMat[7];
    }

    root.addEventListener('dragstart', (e: FederatedPointerEvent) => {
      if (this.#isPinch) {
        return;
      }

      rotate = e.shiftKey;
      mat3.copy(
        startInvertViewProjectionMatrix,
        camera.viewProjectionMatrixInv,
      );
      startCameraX = camera.x;
      startCameraY = camera.y;
      startCameraRotation = camera.rotation;
      vec2.transformMat3(
        startPos,
        getClipSpaceMousePosition(e),
        startInvertViewProjectionMatrix,
      );
      startMousePos = [e.nativeEvent.clientX, e.nativeEvent.clientY];
    });

    root.addEventListener('drag', (e: FederatedPointerEvent) => {
      if (this.#isPinch) {
        return;
      }

      if (rotate) {
        rotateCamera(e);
      } else {
        moveCamera(e);
      }
    });

    root.addEventListener('dragend', (e: FederatedPointerEvent) => {
      if (this.#isPinch) {
        return;
      }
      rotate = false;
    });

    const zoomByPoint = (x: number, y: number, dist: number) => {
      const { x: preZoomX, y: preZoomY } = viewport2Canvas(
        client2Viewport({
          x,
          y,
        }),
      );

      // multiply the wheel movement by the current zoom level
      // so we zoom less when zoomed in and more when zoomed out
      const newZoom = camera.zoom * Math.pow(2, dist * -0.01);
      camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

      const { x: postZoomX, y: postZoomY } = viewport2Canvas(
        client2Viewport({
          x,
          y,
        }),
      );

      // camera needs to be moved the difference of before and after
      camera.x += preZoomX - postZoomX;
      camera.y += preZoomY - postZoomY;
    };

    root.addEventListener('wheel', (e: FederatedWheelEvent) => {
      e.preventDefault();

      zoomByPoint(e.nativeEvent.clientX, e.nativeEvent.clientY, e.deltaY);
    });

    const down = (event: FederatedPointerEvent) => {
      if (event.pointerType === 'mouse') {
        this.#isMouseDown = true;
      } else if (!this.#touches[event.pointerId]) {
        this.#touches[event.pointerId] = { last: null };
      }

      if (this.touchCount >= 2) {
        this.#isPinch = true;
      } else {
        this.#isPinch = false;
      }
    };

    const up = (event: FederatedPointerEvent) => {
      if (event.pointerType === 'mouse') {
        this.#isMouseDown = false;
      }

      if (event.pointerType !== 'mouse') {
        delete this.#touches[event.pointerId];
      }

      if (this.#pinching) {
        if (this.touchCount <= 1) {
          this.#pinching = false;
          this.#isPinch = false;
          return true;
        }
      }
    };

    const move = (e: FederatedPointerEvent) => {
      if (this.touchCount >= 2) {
        const x = e.global.x;
        const y = e.global.y;
        const pointers = this.#touches;
        const keys = Object.keys(pointers);
        const firstKey = Number(keys[0]);
        const secondKey = Number(keys[1]);
        const first = pointers[firstKey];
        const second = pointers[secondKey];
        const last =
          first.last && second.last
            ? Math.sqrt(
                Math.pow(second.last.x - first.last.x, 2) +
                  Math.pow(second.last.y - first.last.y, 2),
              )
            : null;

        if (firstKey === e.pointerId) {
          first.last = { x, y };
        } else if (secondKey === e.pointerId) {
          second.last = { x, y };
        }

        if (last) {
          const point = new Point(
            first.last.x + (second.last.x - first.last.x) / 2,
            first.last.y + (second.last.y - first.last.y) / 2,
          );

          const dist = Math.sqrt(
            Math.pow(second.last.x - first.last.x, 2) +
              Math.pow(second.last.y - first.last.y, 2),
          );

          zoomByPoint(point.x, point.y, (last / dist - 1) * PINCH_FACTOR);
        } else if (!this.#pinching) {
          this.#pinching = true;
        }
      }
    };

    // pinch
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointerupoutside', up);
    root.addEventListener('pointercancel', up);
  }

  /**
   * count of mouse/touch pointers that are down on the viewport
   */
  get touchCount(): number {
    return (this.#isMouseDown ? 1 : 0) + Object.keys(this.#touches).length;
  }
}
