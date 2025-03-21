import { field, Type } from '@lastolivegames/becsy';
import { m3Type, Mat3 } from '../math/Mat3';

export class ComputedCamera {
  /**
   * x in canvas space
   */
  @field({ type: Type.float32, default: 0 }) declare x: number;

  /**
   * y in canvas space
   */
  @field({ type: Type.float32, default: 0 }) declare y: number;

  /**
   * rotation in canvas space
   */
  @field({ type: Type.float32, default: 0 }) declare rotation: number;

  /**
   * Zoom factor of the camera, default is 1.
   * @see https://threejs.org/docs/#api/en/cameras/OrthographicCamera.zoom
   */
  @field({ type: Type.float32, default: 1 }) declare zoom: number;

  /**
   * Projection matrix.
   */
  @field({ type: m3Type, default: Mat3.IDENTITY })
  declare projectionMatrix: Mat3;

  /**
   * Invert matrix in world space.
   */
  @field({ type: m3Type, default: Mat3.IDENTITY })
  declare viewMatrix: Mat3;

  /**
   * projectionMatrix * viewMatrix
   */
  @field({ type: m3Type, default: Mat3.IDENTITY })
  declare viewProjectionMatrix: Mat3;

  /**
   * Invert viewProjectionMatrix.
   */
  @field({ type: m3Type, default: Mat3.IDENTITY })
  declare viewProjectionMatrixInv: Mat3;
}
