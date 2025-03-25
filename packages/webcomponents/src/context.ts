import { createContext } from '@lit/context';
import { SerializedNode, Pen, Theme } from '@infinite-canvas-tutorial/ecs';
import { API } from './API';

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
  layers: {
    selected: SerializedNode['id'][];
  };
}

export const appStateContext = createContext<AppState>(Symbol('appAtate'));

export const nodesContext = createContext<SerializedNode[]>(Symbol('nodes'));

export const apiContext = createContext<API>(Symbol('api'));
