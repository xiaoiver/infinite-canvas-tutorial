// import { ClipSpaceNearZ } from '@antv/g-device-api';
import { field, component } from '@lastolivegames/becsy';

@component
export class Camera {
  // @field.staticString([ClipSpaceNearZ.NEGATIVE_ONE, ClipSpaceNearZ.ZERO]) declare clipSpaceNearZ: ClipSpaceNearZ;

  @field.object declare projectionMatrix: Float32Array;
  @field.object declare viewMatrix: Float32Array;
  @field.object declare viewProjectionMatrixInv: Float32Array;
}
