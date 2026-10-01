'use client';

import {
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type {
  AppState,
  CanvasSnapshot,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import { Event } from '@infinite-canvas-tutorial/webcomponents/events';
import { defaultCanvasRuntime, type CanvasRuntime } from './runtime';
import { CanvasContext } from './CanvasProvider';

interface CanvasElement extends HTMLElement {
  renderer: 'webgl' | 'webgpu';
  shaderCompilerPath: string;
  appState: Partial<AppState>;
  nodes: SerializedNode[];
  theme: 'light' | 'dark';
}

export interface InfiniteCanvasHandle {
  readonly api: ExtendedAPI | null;
  readonly element: HTMLElement | null;
}

export interface InfiniteCanvasProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    'onChange' | 'onError' | 'onResize'
  > {
  /** Reuse the same runtime for all concurrently mounted canvases. */
  runtime?: CanvasRuntime;
  /** Changing renderer or compiler path recreates the canvas. */
  renderer?: 'webgl' | 'webgpu';
  shaderCompilerPath?: string;
  /** Milliseconds to wait for GPU readiness; 0 disables the timeout. Default: 30000. */
  initializationTimeout?: number;
  /** Initial values are read once per canvas creation. Use the API for edits. */
  initialNodes?: SerializedNode[];
  initialAppState?: Partial<AppState>;
  theme?: 'light' | 'dark';
  locale?: string;
  /** Async preparation is cancelled on unmount via the supplied signal. */
  onReady?: (
    api: ExtendedAPI,
    context: { signal: AbortSignal },
  ) => void | Promise<void>;
  /** Called with null when this canvas is removed. */
  onAPIChange?: (api: ExtendedAPI | null) => void;
  onChange?: (snapshot: CanvasSnapshot) => void;
  onNodesChange?: (nodes: SerializedNode[]) => void;
  onAppStateChange?: (state: AppState) => void;
  onSelectedNodesChange?: (nodes: SerializedNode[]) => void;
  onCameraZoomChange?: (zoom: number) => void;
  onResize?: (size: { width: number; height: number }) => void;
  onError?: (error: Error) => void;
  fallback?: ReactNode;
  renderError?: (error: Error) => ReactNode;
  /** Children are mounted into the Web Component's light DOM (including slots). */
  children?: ReactNode;
}

/** React lifecycle and typed events for the Spectrum canvas Web Component. */
export const InfiniteCanvas = forwardRef<
  InfiniteCanvasHandle,
  InfiniteCanvasProps
>(function InfiniteCanvas(props, forwardedRef) {
  const {
    runtime = defaultCanvasRuntime,
    renderer = 'webgl',
    shaderCompilerPath,
    initializationTimeout = 30000,
    initialNodes,
    initialAppState,
    theme,
    locale,
    onReady,
    onAPIChange,
    onChange,
    onNodesChange,
    onAppStateChange,
    onSelectedNodesChange,
    onCameraZoomChange,
    onResize,
    onError,
    fallback = null,
    renderError,
    children,
    style,
    ...htmlProps
  } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const store = useContext(CanvasContext);
  const apiRef = useRef<ExtendedAPI | null>(null);
  const elementRef = useRef<CanvasElement | null>(null);
  const callbacks = useRef(props);
  const [element, setElement] = useState<CanvasElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<Error | null>(null);

  // Callback changes never recreate the canvas or resubscribe events.
  useEffect(() => {
    callbacks.current = props;
  });

  useImperativeHandle(
    forwardedRef,
    () => ({
      get api() {
        return apiRef.current;
      },
      get element() {
        return elementRef.current;
      },
    }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current!;
    const controller = new AbortController();
    const { signal } = controller;
    const lease = runtime.acquire();
    let canvas: CanvasElement | undefined;
    let unsubscribe: (() => void) | undefined;
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    const removers: (() => void)[] = [];
    let providerLease:
      | ReturnType<NonNullable<typeof store>['claim']>
      | undefined;
    const teardown = () => {
      if (signal.aborted) return;
      controller.abort();
      clearTimeout(readyTimer);
      unsubscribe?.();
      removers.forEach((remove) => remove());
      providerLease?.release();
      const hadAPI = apiRef.current !== null;
      apiRef.current = null;
      elementRef.current = null;
      canvas?.remove(); // The Web Component owns API.destroy().
      lease.release();
      if (hadAPI) callbacks.current.onAPIChange?.(null);
    };
    setStatus('loading');
    setError(null);
    setElement(null);

    const reportError = (reason: unknown) => {
      if (signal.aborted) return;
      const nextError =
        reason instanceof Error ? reason : new Error(String(reason));
      teardown();
      setElement(null);
      setError(nextError);
      setStatus('error');
      callbacks.current.onError?.(nextError);
    };
    try {
      providerLease = store?.claim();
    } catch (reason) {
      reportError(reason);
      return teardown;
    }
    if (initializationTimeout > 0) {
      readyTimer = setTimeout(
        () => reportError(new Error('Canvas initialization timed out.')),
        initializationTimeout,
      );
    }
    const listen = <K extends keyof HTMLElementEventMap>(
      name: K,
      listener: (event: HTMLElementEventMap[K]) => void,
    ) => {
      canvas!.addEventListener(name, listener);
      removers.push(() => canvas!.removeEventListener(name, listener));
    };

    lease.ready
      .then(() => {
        if (signal.aborted) return;
        canvas = document.createElement('ic-spectrum-canvas') as CanvasElement;
        canvas.renderer = renderer;
        if (shaderCompilerPath) canvas.shaderCompilerPath = shaderCompilerPath;
        // Seed ECS nodes through updateNodes after GPU readiness, rather than only
        // placing serialized data in Lit's state without corresponding entities.
        const nodes =
          callbacks.current.initialNodes === undefined
            ? undefined
            : structuredClone(callbacks.current.initialNodes);
        canvas.nodes = [];
        canvas.appState = { ...callbacks.current.initialAppState };
        if (callbacks.current.theme) {
          canvas.appState.themeMode = callbacks.current
            .theme as AppState['themeMode'];
          canvas.appState.themePreference = callbacks.current.theme;
        }
        if (callbacks.current.theme) canvas.theme = callbacks.current.theme;
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        listen(Event.READY, (event) => {
          clearTimeout(readyTimer);
          const api = event.detail;
          apiRef.current = api;
          unsubscribe = api.subscribe((snapshot, changes) => {
            if (signal.aborted) return;
            callbacks.current.onChange?.(snapshot);
            if (changes.nodesChanged)
              callbacks.current.onNodesChange?.(snapshot.nodes);
            if (changes.appStateChanged)
              callbacks.current.onAppStateChange?.(snapshot.appState);
          });
          Promise.resolve()
            .then(async () => {
              if (signal.aborted) return;
              if (callbacks.current.locale)
                await api.setLocale(callbacks.current.locale);
              if (signal.aborted) return;
              if (callbacks.current.theme) {
                api.setAppState({
                  themeMode: callbacks.current.theme as AppState['themeMode'],
                  themePreference: callbacks.current.theme,
                });
              }
              providerLease?.attach(api, canvas!);
              callbacks.current.onAPIChange?.(api);
              await callbacks.current.onReady?.(api, { signal });
              if (signal.aborted) return;
              if (nodes !== undefined) {
                api.runAtNextTick(() => {
                  if (signal.aborted) return;
                  try {
                    api.updateNodes(nodes);
                    api.record('NEVER');
                    setStatus('ready');
                  } catch (reason) {
                    reportError(reason);
                  }
                });
              } else {
                setStatus('ready');
              }
            })
            .catch(reportError);
        });
        listen(Event.SELECTED_NODES_CHANGED, (event) =>
          callbacks.current.onSelectedNodesChange?.(event.detail.selected),
        );
        listen(Event.CAMERA_ZOOM_CHANGED, (event) =>
          callbacks.current.onCameraZoomChange?.(event.detail.zoom),
        );
        listen(Event.RESIZED, (event) =>
          callbacks.current.onResize?.(event.detail),
        );

        elementRef.current = canvas;
        host.appendChild(canvas);
        setElement(canvas);
      })
      .catch(reportError);

    return teardown;
  }, [runtime, renderer, shaderCompilerPath, initializationTimeout, store]);

  useEffect(() => {
    if (element && theme) {
      element.theme = theme;
      apiRef.current?.setAppState({
        themeMode: theme as AppState['themeMode'],
        themePreference: theme,
      });
    }
  }, [element, theme]);

  useEffect(() => {
    const api = apiRef.current;
    if (api && locale) {
      Promise.resolve()
        .then(() => {
          if (api === apiRef.current) return api.setLocale(locale);
        })
        .catch((reason: unknown) => {
          if (api !== apiRef.current) return;
          const nextError =
            reason instanceof Error ? reason : new Error(String(reason));
          setError(nextError);
          setStatus('error');
          callbacks.current.onError?.(nextError);
        });
    }
  }, [element, locale]);

  return (
    <div {...htmlProps} style={{ position: 'relative', ...style }}>
      <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
      {element && createPortal(children, element)}
      {status === 'loading' && fallback}
      {status === 'error' &&
        error &&
        (renderError ? (
          renderError(error)
        ) : (
          <div role="alert">{error.message}</div>
        ))}
    </div>
  );
});
