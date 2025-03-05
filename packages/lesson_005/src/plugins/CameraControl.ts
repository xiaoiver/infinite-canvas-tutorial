import { mat3, vec2 } from 'gl-matrix';
import type { Plugin, PluginContext } from './interfaces';

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 4;

/**
 * @see https://webglfundamentals.org/webgl/lessons/webgl-qna-how-to-implement-zoom-from-mouse-in-2d-webgl.html
 */
export class CameraControl implements Plugin {
  apply(context: PluginContext) {
    const { canvas, camera } = context;

    const startInvertViewProjectionMatrix = mat3.create();
    let startCameraX: number;
    let startCameraY: number;
    let startCameraRotation: number;
    const startPos = vec2.create();
    let startMousePos: vec2;
    let rotate = false;

    function getClipSpaceMousePosition(e: MouseEvent): vec2 {
      // get canvas relative css position
      const rect = canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;

      // get normalized 0 to 1 position across and down canvas
      const normalizedX = cssX / canvas.clientWidth;
      const normalizedY = cssY / canvas.clientHeight;

      // convert to clip space
      const clipX = normalizedX * 2 - 1;
      const clipY = normalizedY * -2 + 1;

      return [clipX, clipY];
    }

    function moveCamera(e: MouseEvent) {
      const pos = vec2.transformMat3(
        vec2.create(),
        getClipSpaceMousePosition(e),
        startInvertViewProjectionMatrix,
      );

      camera.x = startCameraX + startPos[0] - pos[0];
      camera.y = startCameraY + startPos[1] - pos[1];
    }

    function rotateCamera(e: MouseEvent) {
      const delta = (e.clientX - startMousePos[0]) / 100;

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

    function handleMouseMove(e: MouseEvent) {
      if (rotate) {
        rotateCamera(e);
      } else {
        moveCamera(e);
      }
    }

    function handleMouseUp(e: MouseEvent) {
      rotate = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

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
      startMousePos = [e.clientX, e.clientY];
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const position = getClipSpaceMousePosition(e);

      // position before zooming
      const [preZoomX, preZoomY] = vec2.transformMat3(
        vec2.create(),
        position,
        camera.viewProjectionMatrixInv,
      );

      // multiply the wheel movement by the current zoom level
      // so we zoom less when zoomed in and more when zoomed out
      const newZoom = camera.zoom * Math.pow(2, e.deltaY * -0.01);
      camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

      // position after zooming
      const [postZoomX, postZoomY] = vec2.transformMat3(
        vec2.create(),
        position,
        camera.viewProjectionMatrixInv,
      );

      // camera needs to be moved the difference of before and after
      camera.x += preZoomX - postZoomX;
      camera.y += preZoomY - postZoomY;
    });
  }
}
