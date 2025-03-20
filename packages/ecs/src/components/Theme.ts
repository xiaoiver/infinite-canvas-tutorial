import { field, Type } from '@lastolivegames/becsy';

export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
}

interface ThemeColors {
  /**
   * Background color of page.
   */
  background: string;
  /**
   * Color of grid.
   */
  grid: string;
  /**
   * Fill color of the selection brush.
   */
  selectionBrushFill: string;
  /**
   * Stroke color of the selection brush.
   */
  selectionBrushStroke: string;
}

export class Theme {
  /**
   * Theme.
   */
  @field({
    type: Type.staticString([ThemeMode.LIGHT, ThemeMode.DARK]),
    default: ThemeMode.LIGHT,
  })
  declare mode: ThemeMode;

  /**
   * Theme colors.
   * @see https://github.com/dgmjs/dgmjs/blob/main/packages/core/src/colors.ts#L130
   */
  @field({
    type: Type.object,
    default: {
      [ThemeMode.LIGHT]: {
        background: '#fbfbfb',
        grid: '#dedede',
        selectionBrushFill: '#dedede',
        selectionBrushStroke: '#dedede',
      },
      [ThemeMode.DARK]: {
        background: '#121212',
        grid: '#242424',
        selectionBrushFill: '#242424',
        selectionBrushStroke: '#242424',
      },
    },
  })
  declare colors: Partial<{
    [ThemeMode.LIGHT]: Partial<ThemeColors>;
    [ThemeMode.DARK]: Partial<ThemeColors>;
  }>;
}
