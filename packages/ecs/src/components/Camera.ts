// import { ClipSpaceNearZ } from '@antv/g-device-api';
import { component, field, Type } from '@lastolivegames/becsy';

@component
export class Camera {
  // @field.staticString([ClipSpaceNearZ.NEGATIVE_ONE, ClipSpaceNearZ.ZERO]) declare clipSpaceNearZ: ClipSpaceNearZ;

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
}
