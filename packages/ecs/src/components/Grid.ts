import { field, Type } from '@lastolivegames/becsy';

export enum CheckboardStyle {
  NONE = 'none',
  GRID = 'grid',
  DOTS = 'dots',
}

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
