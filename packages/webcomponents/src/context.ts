import { createContext } from '@lit/context';
import {
  SerializedNode,
  Pen,
  Theme,
  ThemeMode,
} from '@infinite-canvas-tutorial/ecs';
import { API } from './API';

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
  cameraZoom: number;
  penbarAll: Pen[];
  penbarSelected: Pen[];
  taskbarAll: Task[];
  taskbarSelected: Task[];
  layersSelected: SerializedNode['id'][];
}

export const appStateContext = createContext<AppState>(Symbol('appAtate'));

export const nodesContext = createContext<SerializedNode[]>(Symbol('nodes'));

export const apiContext = createContext<API>(Symbol('api'));

export const getDefaultAppState = () => {
  return {
    // TODO: Flatten theme
    theme: {
      mode: ThemeMode.LIGHT,
      colors: {
        [ThemeMode.LIGHT]: {},
        [ThemeMode.DARK]: {},
      },
    },
    cameraZoom: 1,
    penbarAll: [Pen.HAND, Pen.SELECT, Pen.DRAW_RECT],
    penbarSelected: [Pen.HAND],
    taskbarAll: [Task.SHOW_LAYERS_PANEL, Task.SHOW_PROPERTIES_PANEL],
    taskbarSelected: [],
    layersSelected: [],
  };
};
