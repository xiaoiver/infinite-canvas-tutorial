'use client';

import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type KeyboardEventHandler,
} from 'react';
import { CanvasContext, useCanvasActions } from './CanvasProvider';

export interface CanvasShortcutOptions {
  /** Enable this React shortcut scope. Defaults to true; requires ready status. */
  enabled?: boolean;
  /** Editing failures are logged to console.error when no callback is supplied. */
  onError?: (error: Error) => void;
}

export interface CanvasShortcutProps {
  tabIndex: number;
  'data-canvas-shortcuts': string;
  onKeyDownCapture: KeyboardEventHandler<HTMLElement>;
}

/** Spread onto a DOM container enclosing one Provider's canvas and controls. */
export function useCanvasShortcuts(
  options: CanvasShortcutOptions = {},
): CanvasShortcutProps {
  const actions = useCanvasActions();
  const store = useContext(CanvasContext)!;
  const id = useId();
  const latest = useRef(options);
  const mounted = useRef(false);
  useEffect(() => {
    latest.current = options;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onKeyDownCapture = useCallback<KeyboardEventHandler<HTMLElement>>(
    (event) => {
      const { api, status } = store.getSnapshot();
      if (
        !mounted.current ||
        latest.current.enabled === false ||
        !api ||
        status !== 'ready' ||
        event.defaultPrevented ||
        event.nativeEvent.isComposing ||
        event.nativeEvent.keyCode === 229 ||
        event.repeat ||
        event.altKey
      )
        return;

      const path = event.nativeEvent.composedPath();
      // React portals can bubble through React parents outside their DOM scope.
      const boundary = path.indexOf(event.currentTarget);
      if (boundary < 0) return;
      const elements = path
        .slice(0, boundary + 1)
        .filter(
          (target): target is HTMLElement => target instanceof HTMLElement,
        );
      // A nested scope owns its shortcuts, even when that scope is disabled.
      if (
        elements.find((element) =>
          element.hasAttribute('data-canvas-shortcuts'),
        ) !== event.currentTarget
      )
        return;
      if (
        elements.some((element) =>
          element.matches(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"], [data-canvas-shortcuts-ignore]',
          ),
        )
      )
        return;

      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      let command: 'undo' | 'redo' | 'selectAll' | 'delete' | undefined;
      if (modifier && key === 'z') command = event.shiftKey ? 'redo' : 'undo';
      else if (
        event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        key === 'y'
      )
        command = 'redo';
      else if (modifier && !event.shiftKey && key === 'a')
        command = 'selectAll';
      else if (
        !modifier &&
        !event.shiftKey &&
        (key === 'delete' || key === 'backspace')
      )
        command = 'delete';
      if (!command) return;

      // Capture before the Web Component's native handlers so one key edits once.
      event.preventDefault();
      event.stopPropagation();
      const report = (reason: unknown) => {
        if (!mounted.current || store.getSnapshot().api !== api) return;
        const error =
          reason instanceof Error ? reason : new Error(String(reason));
        if (latest.current.onError) latest.current.onError(error);
        else console.error(error);
      };
      try {
        if (command === 'undo' || command === 'redo') actions[command]();
        else {
          // Resolve nodes/selection in the edit stage, so queued keys compose.
          const result =
            command === 'selectAll'
              ? actions.edit(
                  (current) => {
                    current.selectNodes(
                      current.getNodes().filter((node) => !node.isDeleted),
                    );
                  },
                  { capture: 'NEVER' },
                )
              : actions.edit((current) => {
                  current.deleteNodesById(current.getAppState().layersSelected);
                });
          void result.catch(report);
        }
      } catch (error) {
        report(error);
      }
    },
    [actions, store],
  );

  return useMemo(
    () => ({
      tabIndex: 0,
      'data-canvas-shortcuts': id,
      onKeyDownCapture,
    }),
    [id, onKeyDownCapture],
  );
}
