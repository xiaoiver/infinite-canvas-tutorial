import { Pen, CheckboardStyle, Theme, ThemeMode } from './components';
import { SerializedNode } from './utils';

export enum Task {
  SHOW_LAYERS_PANEL = 'show-layers-panel',
  SHOW_PROPERTIES_PANEL = 'show-properties-panel',
}

/**
 * Prefer flat objects.
 * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/initialdata
 */
export interface AppState {
  theme: Theme;
  checkboardStyle: CheckboardStyle;
  cameraZoom: number;
  penbarAll: Pen[];
  penbarSelected: Pen[];
  taskbarAll: Task[];
  taskbarSelected: Task[];
  layersSelected: SerializedNode['id'][];
  propertiesOpened: SerializedNode['id'][];
}

export const getDefaultAppState: () => AppState = () => {
  return {
    // TODO: Flatten theme
    theme: {
      mode: ThemeMode.LIGHT,
      colors: {
        [ThemeMode.LIGHT]: {},
        [ThemeMode.DARK]: {},
      },
    },
    checkboardStyle: CheckboardStyle.GRID,
    cameraZoom: 1,
    penbarAll: [Pen.HAND, Pen.SELECT, Pen.DRAW_RECT],
    penbarSelected: [Pen.HAND],
    taskbarAll: [Task.SHOW_LAYERS_PANEL, Task.SHOW_PROPERTIES_PANEL],
    taskbarSelected: [],
    layersSelected: [],
    propertiesOpened: [],
  };
};
