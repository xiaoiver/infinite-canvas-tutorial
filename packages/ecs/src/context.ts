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
  cameraX: number;
  cameraY: number;
  cameraRotation: number;
  contextBarVisible: boolean;
  contextMenuVisible: boolean;
  topbarVisible: boolean;
  penbarVisible: boolean;
  penbarAll: Pen[];
  penbarSelected: Pen[];
  taskbarVisible: boolean;
  taskbarAll: Task[];
  taskbarSelected: Task[];
  layersSelected: SerializedNode['id'][];
  layersHighlighted: SerializedNode['id'][];
  propertiesOpened: SerializedNode['id'][];
  /**
   * Allow rotate in transformer
   */
  rotateEnabled: boolean;
  /**
   * Allow flip in transformer
   */
  flipEnabled: boolean;
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
    cameraX: 0,
    cameraY: 0,
    cameraRotation: 0,
    contextBarVisible: true,
    contextMenuVisible: true,
    topbarVisible: true,
    penbarVisible: true,
    penbarAll: [
      Pen.HAND,
      Pen.SELECT,
      Pen.DRAW_RECT,
      Pen.DRAW_ELLIPSE,
      Pen.VECTOR_NETWORK,
    ],
    penbarSelected: [Pen.HAND],
    taskbarVisible: true,
    taskbarAll: [Task.SHOW_LAYERS_PANEL, Task.SHOW_PROPERTIES_PANEL],
    taskbarSelected: [],
    layersSelected: [],
    layersHighlighted: [],
    propertiesOpened: [],
    rotateEnabled: true,
    flipEnabled: true,
  };
};

export const SIBLINGS_MAX_Z_INDEX = 1000000;
export const SIBLINGS_MIN_Z_INDEX = -1000000;
export const TRANSFORMER_Z_INDEX = SIBLINGS_MAX_Z_INDEX * 10;
export const HIGHLIGHTER_Z_INDEX = TRANSFORMER_Z_INDEX - 1;
export const DRAW_RECT_Z_INDEX = HIGHLIGHTER_Z_INDEX - 10;
