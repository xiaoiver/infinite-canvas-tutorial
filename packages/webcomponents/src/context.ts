import { createContext } from '@lit/context';
import { Pen, Theme } from '@infinite-canvas-tutorial/ecs';

export enum Task {
  SHOW_LAYERS_PANEL = 'show-layers-panel',
  SHOW_PROPERTIES_PANEL = 'show-properties-panel',
}

/**
 * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/initialdata
 */
export interface AppState {
  theme: Theme;
  camera: {
    zoom: number;
  };
  penbar: {
    all: Pen[];
    selected: Pen[];
  };
  taskbar: {
    all: Task[];
    selected: Task[];
  };
}

export const appStateContext = createContext<AppState>(Symbol('appAtate'));
