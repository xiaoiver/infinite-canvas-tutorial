import { field } from '@lastolivegames/becsy';
import { m3Type, Mat3 } from '../math/Mat3';
import { Transform } from './Transform';

export class GlobalTransform {
  /**
   * Matrix in world space
   */
  @field(m3Type) declare matrix: Mat3;

  constructor(matrix: Mat3 = Mat3.IDENTITY) {
    this.matrix = matrix;
  }
}
