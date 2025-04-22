import { ContextProvider, createContext } from '@lit/context';
import {
  SerializedNode,
  AppState,
  DefaultStateManagement,
} from '@infinite-canvas-tutorial/ecs';
import { ExtendedAPI } from './API';

export const appStateContext = createContext<AppState>(Symbol('appAtate'));
export const nodesContext = createContext<SerializedNode[]>(Symbol('nodes'));
export const apiContext = createContext<ExtendedAPI>(Symbol('api'));

/**
 * Delegate the methods to the LitElement's context which will trigger re-rendering.
 */
export class LitStateManagement extends DefaultStateManagement {
  constructor(
    private readonly appStateProvider: ContextProvider<{
      __context__: AppState;
    }>,
    private readonly nodesProvider: ContextProvider<{
      __context__: SerializedNode[];
    }>,
  ) {
    super();
  }

  getAppState() {
    return this.appStateProvider.value;
  }

  setAppState(appState: AppState) {
    super.setAppState(appState);
    this.appStateProvider.value = appState;
  }

  getNodes() {
    return this.nodesProvider.value || [];
  }

  setNodes(nodes: SerializedNode[]) {
    super.setNodes(nodes);
    this.nodesProvider.value = nodes;
  }

  onChange(snapshot: { appState: AppState; nodes: SerializedNode[] }) {
    super.onChange(snapshot);
    // console.log('onChange', snapshot);
  }
}
