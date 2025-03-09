import { component, field } from '@lastolivegames/becsy';

export enum CheckboardStyle {
  NONE = 'none',
  GRID = 'grid',
  DOTS = 'dots',
}

@component
export class Grid {
  /**
   * Checkboard style.
   */
  @field.staticString([
    CheckboardStyle.NONE,
    CheckboardStyle.GRID,
    CheckboardStyle.DOTS,
  ])
  declare checkboardStyle: CheckboardStyle;
}
