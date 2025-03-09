import { component, field } from '@lastolivegames/becsy';

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

@component
export class Theme {
  /**
   * Theme.
   */
  @field.staticString([ThemeMode.LIGHT, ThemeMode.DARK])
  declare mode: ThemeMode;
  /**
   * Theme colors.
   * @see https://github.com/dgmjs/dgmjs/blob/main/packages/core/src/colors.ts#L130
   */
  @field.object declare colors: Partial<{
    [ThemeMode.LIGHT]: Partial<ThemeColors>;
    [ThemeMode.DARK]: Partial<ThemeColors>;
  }>;
}
