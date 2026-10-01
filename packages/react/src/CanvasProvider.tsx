'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { createCanvasStore, type CanvasState, type CanvasStore } from './store';
import { createCanvasActions } from './actions';

export const CanvasContext = createContext<CanvasStore | null>(null);

/** Scope one canvas and its sibling/slot controls to their own API and state. */
export function CanvasProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createCanvasStore);
  return (
    <CanvasContext.Provider value={store}>{children}</CanvasContext.Provider>
  );
}

/** Select committed document state, live camera/selection, or history availability. */
export function useCanvasSelector<T>(
  selector: (state: CanvasState) => T,
  isEqual: (previous: T, next: T) => boolean = Object.is,
): T {
  const store = useContext(CanvasContext);
  if (!store)
    throw new Error('Canvas hooks must be used inside CanvasProvider.');
  return useSyncExternalStoreWithSelector(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
    selector,
    isEqual,
  );
}

/** Returns null during SSR, before readiness, and after canvas removal. */
export function useCanvasAPI() {
  return useCanvasSelector((state) => state.api);
}

/** Stable editing actions scoped to the nearest Provider; does not subscribe. */
export function useCanvasActions() {
  const store = useContext(CanvasContext);
  if (!store)
    throw new Error('Canvas hooks must be used inside CanvasProvider.');
  return useMemo(() => createCanvasActions(store), [store]);
}
