// import { ClipSpaceNearZ } from '@antv/g-device-api';
import { field } from '@lastolivegames/becsy';

export class Camera {
  // @field.staticString([ClipSpaceNearZ.NEGATIVE_ONE, ClipSpaceNearZ.ZERO]) declare clipSpaceNearZ: ClipSpaceNearZ;

  /**
   * x in canvas space
   */
  @field.float32 declare x: number;

  /**
   * y in canvas space
   */
  @field.float32 declare y: number;

  /**
   * rotation in canvas space
   */
  @field.float32 declare rotation: number;

  /**
   * Zoom factor of the camera, default is 1.
   * @see https://threejs.org/docs/#api/en/cameras/OrthographicCamera.zoom
   */
  @field.float32 declare zoom: number;
}
