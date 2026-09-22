import type { AppState } from '../context';

/** Only document settings and selection participate in undo/redo. */
export type ObservedAppState = Pick<AppState, 'filter' | 'layersSelected'>;

export function observeAppState(state: ObservedAppState): ObservedAppState {
  return { filter: state.filter, layersSelected: [...state.layersSelected] };
}
