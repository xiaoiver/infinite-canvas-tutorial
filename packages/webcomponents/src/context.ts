import { createContext } from '@lit/context';
import { Pen } from '@infinite-canvas-tutorial/ecs';
export interface AppState {
  zoom: number;
  pen: Pen;
}

export const appStateContext = createContext<AppState>(Symbol('appAtate'));
