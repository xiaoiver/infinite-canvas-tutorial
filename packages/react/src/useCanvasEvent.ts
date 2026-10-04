'use client';

import { useContext, useEffect, useRef } from 'react';
import type { CanvasEventMap } from '@infinite-canvas-tutorial/webcomponents/events';
import { CanvasContext, useCanvasAPI } from './CanvasProvider';

type EventMap = CanvasEventMap & HTMLElementEventMap;

export interface CanvasEventOptions extends AddEventListenerOptions {
  /** Pause the subscription without changing the callback. Defaults to true. */
  enabled?: boolean;
}

/** Subscribe to events on the nearest Provider's current canvas element. */
export function useCanvasEvent<K extends keyof EventMap>(
  name: K,
  listener: (event: EventMap[K]) => void,
  {
    enabled = true,
    capture = false,
    passive,
    once = false,
    signal,
  }: CanvasEventOptions = {},
): void {
  const api = useCanvasAPI();
  const store = useContext(CanvasContext)!;
  const callback = useRef(listener);
  useEffect(() => {
    callback.current = listener;
  }, [listener]);

  useEffect(() => {
    if (!api || !enabled || signal?.aborted) return;
    const receive = (event: Event) => {
      // Detachment can precede both React effect cleanup and API destruction.
      if (store.getSnapshot().api !== api) return;
      callback.current(event as EventMap[K]);
    };
    api.element.addEventListener(name, receive, {
      capture,
      passive,
      once,
      signal,
    });
    return api.onDestroy(() =>
      api.element.removeEventListener(name, receive, capture),
    );
  }, [api, store, name, enabled, capture, passive, once, signal]);
}
