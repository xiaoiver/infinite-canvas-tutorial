import { field, Type } from '@lastolivegames/becsy';
import { CheckboardStyle } from '../format/modes';
export { CheckboardStyle } from '../format/modes';

export class Grid {
  /**
   * Checkboard style.
   */
  @field({
    type: Type.staticString([
      CheckboardStyle.NONE,
      CheckboardStyle.GRID,
      CheckboardStyle.DOTS,
    ]),
    default: CheckboardStyle.GRID,
  })
  declare checkboardStyle: CheckboardStyle;
}
