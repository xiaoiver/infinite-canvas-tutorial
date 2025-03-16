import { field, Type } from '@lastolivegames/becsy';
import { mat3 } from 'gl-matrix';

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

  @field({ type: Type.object }) declare projectionMatrix: mat3;

  @field({ type: Type.object }) declare viewMatrix: mat3;

  @field({ type: Type.object }) declare viewProjectionMatrix: mat3;

  @field({ type: Type.object }) declare viewProjectionMatrixInv: mat3;
}
