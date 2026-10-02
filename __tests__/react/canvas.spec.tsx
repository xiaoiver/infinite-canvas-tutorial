import { StrictMode, createRef } from 'react';
import { act } from './act';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  InfiniteCanvas,
  type InfiniteCanvasHandle,
} from '../../packages/react/src/InfiniteCanvas';
import type { CanvasRuntime } from '../../packages/react/src/runtime';
import {
  CanvasProvider,
  useCanvasAPI,
  useCanvasActions,
  useCanvasSelector,
} from '../../packages/react/src/CanvasProvider';
import type { CanvasActions } from '../../packages/react/src/actions';

const canvases: TestCanvas[] = [];
class TestCanvas extends HTMLElement {
  state = { cameraZoom: 1, layersSelected: [], filter: '' };
  nodes = [];
  history = { canUndo: false, canRedo: false };
  historySubscribers = new Set<(state: any) => void>();
  cleanups = new Set<() => void>();
  api = {
    getAppState: () => this.state,
    getNodes: () => this.nodes,
    getHistoryState: () => this.history,
    subscribeHistory: jest.fn((listener) => {
      this.historySubscribers.add(listener);
      return () => this.historySubscribers.delete(listener);
    }),
    onDestroy: (cleanup) => {
      const dispose = () => {
        if (!this.cleanups.delete(dispose)) return;
        cleanup();
      };
      this.cleanups.add(dispose);
      return dispose;
    },
    subscribe: jest.fn((listener) => {
      this.subscribers.add(listener);
      return () => this.subscribers.delete(listener);
    }),
    destroy: jest.fn(() => {
      [...this.cleanups].forEach((cleanup) => cleanup());
      this.subscribers.clear();
      this.historySubscribers.clear();
    }),
    setLocale: jest.fn().mockResolvedValue(undefined),
    setAppState: jest.fn(),
    updateNodes: jest.fn(),
    record: jest.fn(),
    runAtNextTick: jest.fn((task) => task()),
    edit: jest.fn(async (update) => {
      update(this.api);
      this.api.record();
      return true;
    }),
  };
  subscribers = new Set<(snapshot: any, changes: any) => void>();
  constructor() {
    super();
    canvases.push(this);
  }
  disconnectedCallback() {
    queueMicrotask(() => this.api.destroy());
  }
  ready() {
    this.dispatchEvent(new CustomEvent('ic-ready', { detail: this.api }));
  }
  commit(patch = {}) {
    this.state = { ...this.state, ...patch };
    this.subscribers.forEach((listener) =>
      listener(
        { appState: this.state, nodes: this.nodes },
        { nodesChanged: false, appStateChanged: true },
      ),
    );
  }
}
customElements.define('ic-spectrum-canvas', TestCanvas);

let root: Root;
let host: HTMLDivElement;
let runtime: CanvasRuntime;
let release: jest.Mock;
beforeEach(() => {
  canvases.length = 0;
  release = jest.fn();
  runtime = { acquire: jest.fn(() => ({ ready: Promise.resolve(), release })) };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  jest.useRealTimers();
});

it('renders on the server without starting the browser runtime', () => {
  expect(
    renderToString(<InfiniteCanvas runtime={runtime} fallback="Loading" />),
  ).toContain('Loading');
  expect(runtime.acquire).not.toHaveBeenCalled();
});

it('keeps action-only consumers stable through readiness, edits, and recreation', async () => {
  let actions!: CanvasActions;
  const render = jest.fn();
  function Controls() {
    actions = useCanvasActions();
    render(actions);
    return null;
  }
  const editor = (renderer: 'webgl' | 'webgpu') => (
    <CanvasProvider>
      <InfiniteCanvas runtime={runtime} renderer={renderer} />
      <Controls />
    </CanvasProvider>
  );
  renderToString(editor('webgl'));
  expect(runtime.acquire).not.toHaveBeenCalled();
  render.mockClear();
  await act(async () => root.render(editor('webgl')));
  const retained = actions;
  expect(await retained.edit(jest.fn())).toBe(false);
  render.mockClear();
  await act(async () => canvases[0].ready());
  await act(async () => canvases[0].commit({ filter: 'blur(2px)' }));
  expect(render).not.toHaveBeenCalled();
  await act(async () => root.render(editor('webgpu')));
  expect(actions).toBe(retained);
  expect(await retained.edit(jest.fn())).toBe(false);
  await act(async () => canvases[1].ready());
  const nodes = [{ id: 'rect', type: 'rect' as const, zIndex: 0, width: 100 }];
  await act(async () => {
    expect(await retained.updateNodes(nodes)).toBe(true);
  });
  expect(canvases[0].api.updateNodes).not.toHaveBeenCalled();
  expect(canvases[1].api.updateNodes).toHaveBeenCalledWith(nodes);
});

it('survives StrictMode and seeds nodes into ECS after async preparation', async () => {
  const ref = createRef<InfiniteCanvasHandle>();
  const nodes = [{ id: 'rect', type: 'rect' as const, width: 10, height: 10 }];
  const onReady = jest.fn(async (api) => {
    expect(api.updateNodes).not.toHaveBeenCalled();
  });
  await act(async () =>
    root.render(
      <StrictMode>
        <InfiniteCanvas
          ref={ref}
          runtime={runtime}
          initialNodes={nodes}
          onReady={onReady}
        >
          <span slot="penbar-item">Custom tool</span>
        </InfiniteCanvas>
      </StrictMode>,
    ),
  );
  expect(canvases).toHaveLength(1);
  expect(ref.current!.api).toBeNull();
  await act(async () => canvases[0].ready());
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(ref.current!.api).toBe(canvases[0].api);
  expect(canvases[0].api.updateNodes).toHaveBeenCalledWith(nodes);
  expect(canvases[0].querySelector('[slot="penbar-item"]')!.textContent).toBe(
    'Custom tool',
  );
  expect(canvases[0].api.destroy).not.toHaveBeenCalled();
});

it('does not create a canvas if unmounted while the runtime starts', async () => {
  let finish!: () => void;
  const ready = new Promise<void>((resolve) => {
    finish = resolve;
  });
  runtime.acquire = () => ({ ready, release });
  await act(async () => root.render(<InfiniteCanvas runtime={runtime} />));
  await act(async () => root.render(null));
  await act(async () => finish());
  expect(canvases).toHaveLength(0);
  expect(release).toHaveBeenCalledTimes(1);
});

it('uses updated callbacks without recreating the canvas or overwriting other subscribers', async () => {
  const first = jest.fn();
  const second = jest.fn();
  await act(async () =>
    root.render(<InfiniteCanvas runtime={runtime} onNodesChange={first} />),
  );
  await act(async () => canvases[0].ready());
  await act(async () =>
    root.render(<InfiniteCanvas runtime={runtime} onNodesChange={second} />),
  );
  const external = jest.fn();
  canvases[0].api.subscribe(external);
  await act(async () =>
    canvases[0].subscribers.forEach((listener) =>
      listener(
        { nodes: [], appState: {} },
        { nodesChanged: true, appStateChanged: false },
      ),
    ),
  );
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  expect(external).toHaveBeenCalledTimes(1);
  expect(canvases).toHaveLength(1);
});

it('aborts async preparation and clears the API when removed', async () => {
  let finish!: () => void;
  let signal!: AbortSignal;
  const onAPIChange = jest.fn();
  const onError = jest.fn();
  const onReady = jest.fn((_api, context) => {
    signal = context.signal;
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  await act(async () =>
    root.render(
      <InfiniteCanvas
        runtime={runtime}
        onReady={onReady}
        onAPIChange={onAPIChange}
        onError={onError}
      />,
    ),
  );
  await act(async () => canvases[0].ready());
  await act(async () => root.render(null));
  expect(signal.aborted).toBe(true);
  expect(onAPIChange.mock.calls.map(([api]) => api)).toEqual([
    canvases[0].api,
    null,
  ]);
  expect(canvases[0].api.destroy).toHaveBeenCalledTimes(1);
  expect(canvases[0].subscribers.size).toBe(0);
  await act(async () => finish());
  expect(onError).not.toHaveBeenCalled();
});

it('keeps subscriptions and events scoped to their owning canvas', async () => {
  const left = jest.fn();
  const right = jest.fn();
  await act(async () =>
    root.render(
      <>
        <InfiniteCanvas
          key="left"
          runtime={runtime}
          onSelectedNodesChange={left}
        />
        <InfiniteCanvas
          key="right"
          runtime={runtime}
          onSelectedNodesChange={right}
        />
      </>,
    ),
  );
  await act(async () => canvases.forEach((canvas) => canvas.ready()));
  canvases[0].dispatchEvent(
    new CustomEvent('ic-selected-nodes-changed', {
      detail: { selected: ['left'] },
    }),
  );
  expect(left).toHaveBeenCalledWith(['left']);
  expect(right).not.toHaveBeenCalled();
  await act(async () =>
    root.render(
      <InfiniteCanvas
        key="right"
        runtime={runtime}
        onSelectedNodesChange={right}
      />,
    ),
  );
  expect(canvases[1].api.destroy).not.toHaveBeenCalled();
});

it('reports startup failures and releases the runtime', async () => {
  runtime.acquire = () => ({
    ready: Promise.reject(new Error('offline')),
    release,
  });
  const onError = jest.fn();
  await act(async () =>
    root.render(<InfiniteCanvas runtime={runtime} onError={onError} />),
  );
  expect(host.querySelector('[role="alert"]')!.textContent).toBe('offline');
  expect(onError).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledTimes(1);
});

it('times out GPU initialization and removes the pending canvas', async () => {
  jest.useFakeTimers();
  const onError = jest.fn();
  await act(async () =>
    root.render(
      <InfiniteCanvas
        runtime={runtime}
        initializationTimeout={100}
        onError={onError}
      />,
    ),
  );
  await act(async () => jest.advanceTimersByTime(100));
  expect(host.querySelector('ic-spectrum-canvas')).toBeNull();
  expect(host.querySelector('[role="alert"]')!.textContent).toContain(
    'timed out',
  );
  expect(release).toHaveBeenCalledTimes(1);
});

function Toolbar({ id = 'toolbar' }: { id?: string }) {
  const api = useCanvasAPI();
  const zoom = useCanvasSelector((state) => state.appState?.cameraZoom ?? 1);
  const canUndo = useCanvasSelector((state) => state.canUndo);
  const selection = useCanvasSelector(
    (state) => state.appState?.layersSelected.length ?? 0,
  );
  return (
    <output
      data-testid={id}
    >{`${!!api}:${zoom}:${canUndo}:${selection}`}</output>
  );
}

it('hydrates a Provider with a stable empty server snapshot before GPU readiness', async () => {
  const editor = (
    <CanvasProvider>
      <InfiniteCanvas runtime={runtime} />
      <Toolbar />
    </CanvasProvider>
  );
  const html = renderToString(editor);
  expect(html).toContain('false:1:false:0');
  expect(runtime.acquire).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  host.innerHTML = html;
  const recoverable = jest.fn();
  await act(async () => {
    root = hydrateRoot(host, editor, { onRecoverableError: recoverable });
  });
  await act(async () => canvases[0].ready());
  expect(host.querySelector('output')!.textContent).toBe('true:1:false:0');
  expect(recoverable).not.toHaveBeenCalled();
});

it('only rerenders selectors whose value changes and keeps API consumers stable', async () => {
  const zoomRender = jest.fn();
  const apiRender = jest.fn();
  function Zoom() {
    const zoom = useCanvasSelector((state) => state.appState?.cameraZoom ?? 1);
    zoomRender(zoom);
    return <span>{zoom}</span>;
  }
  function APIConsumer() {
    apiRender(useCanvasAPI());
    return null;
  }
  await act(async () =>
    root.render(
      <CanvasProvider>
        <InfiniteCanvas runtime={runtime} />
        <Zoom />
        <APIConsumer />
      </CanvasProvider>,
    ),
  );
  await act(async () => canvases[0].ready());
  zoomRender.mockClear();
  apiRender.mockClear();
  await act(async () => canvases[0].commit({ filter: 'blur(2px)' }));
  expect(zoomRender).not.toHaveBeenCalled();
  expect(apiRender).not.toHaveBeenCalled();
  await act(async () => {
    canvases[0].state = { ...canvases[0].state, cameraZoom: 2 };
    canvases[0].dispatchEvent(
      new CustomEvent('ic-camera-zoom-changed', { detail: { zoom: 2 } }),
    );
  });
  expect(zoomRender).toHaveBeenCalledTimes(1);
  expect(apiRender).not.toHaveBeenCalled();
});

it('supports inline object selectors, custom equality, and changed selectors', async () => {
  const render = jest.fn();
  function Probe({ field }: { field: 'cameraZoom' | 'filter' }) {
    const selected = useCanvasSelector(
      (state) => ({ value: state.appState?.[field] }),
      (a, b) => a.value === b.value,
    );
    render(selected);
    return <output>{String(selected.value)}</output>;
  }
  const editor = (field: 'cameraZoom' | 'filter') => (
    <CanvasProvider>
      <InfiniteCanvas runtime={runtime} />
      <Probe field={field} />
    </CanvasProvider>
  );
  await act(async () => root.render(editor('cameraZoom')));
  await act(async () => canvases[0].ready());
  render.mockClear();
  await act(async () => canvases[0].commit({ filter: 'blur(2px)' }));
  expect(render).not.toHaveBeenCalled();
  await act(async () => root.render(editor('filter')));
  expect(host.querySelector('output')!.textContent).toBe('blur(2px)');
  expect(canvases).toHaveLength(1);
});

it('isolates Providers and updates history and selection without polling', async () => {
  const editor = (left: boolean) => (
    <>
      {left && (
        <CanvasProvider key="left">
          <InfiniteCanvas runtime={runtime} />
          <Toolbar id="left" />
        </CanvasProvider>
      )}
      <CanvasProvider key="right">
        <InfiniteCanvas runtime={runtime} />
        <Toolbar id="right" />
      </CanvasProvider>
    </>
  );
  await act(async () => root.render(editor(true)));
  await act(async () => canvases.forEach((canvas) => canvas.ready()));
  await act(async () => {
    canvases[0].historySubscribers.forEach((listener) =>
      listener({ canUndo: true, canRedo: false }),
    );
    canvases[0].state = {
      ...canvases[0].state,
      layersSelected: ['rect'] as any,
    };
    canvases[0].dispatchEvent(
      new CustomEvent('ic-selected-nodes-changed', {
        detail: { selected: [] },
      }),
    );
  });
  expect(host.querySelector('[data-testid="left"]')!.textContent).toBe(
    'true:1:true:1',
  );
  expect(host.querySelector('[data-testid="right"]')!.textContent).toBe(
    'true:1:false:0',
  );
  await act(async () => root.render(editor(false)));
  expect(canvases[0].historySubscribers.size).toBe(0);
  expect(canvases[1].api.destroy).not.toHaveBeenCalled();
  await act(async () => canvases[1].commit({ cameraZoom: 3 }));
  expect(host.querySelector('output')!.textContent).toBe('true:3:false:0');
});

it('releases Provider ownership under StrictMode, recreation, and API destruction', async () => {
  const editor = (renderer: 'webgl' | 'webgpu') => (
    <StrictMode>
      <CanvasProvider>
        <InfiniteCanvas runtime={runtime} renderer={renderer} />
        <Toolbar />
      </CanvasProvider>
    </StrictMode>
  );
  await act(async () => root.render(editor('webgl')));
  await act(async () => canvases[0].ready());
  expect(host.querySelector('output')!.textContent).toBe('true:1:false:0');
  await act(async () => root.render(editor('webgpu')));
  expect(host.querySelector('output')!.textContent).toBe('false:1:false:0');
  expect(canvases[0].subscribers.size).toBe(0);
  await act(async () => canvases[1].ready());
  await act(async () => canvases[1].api.destroy());
  expect(host.querySelector('output')!.textContent).toBe('false:1:false:0');
  expect(canvases[1].historySubscribers.size).toBe(0);
});

it('rejects a second canvas in one Provider without replacing its API', async () => {
  const onError = jest.fn();
  await act(async () =>
    root.render(
      <CanvasProvider>
        <InfiniteCanvas runtime={runtime} />
        <InfiniteCanvas runtime={runtime} onError={onError} />
        <Toolbar />
      </CanvasProvider>,
    ),
  );
  expect(onError).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringContaining('one mounted'),
    }),
  );
  expect(canvases).toHaveLength(1);
  await act(async () => canvases[0].ready());
  expect(host.querySelector('output')!.textContent).toBe('true:1:false:0');
});

it('clears Provider state after async preparation fails', async () => {
  await act(async () =>
    root.render(
      <CanvasProvider>
        <InfiniteCanvas
          runtime={runtime}
          onReady={async () => {
            throw new Error('preparation failed');
          }}
        />
        <Toolbar />
      </CanvasProvider>,
    ),
  );
  await act(async () => canvases[0].ready());
  expect(host.querySelector('output')!.textContent).toBe('false:1:false:0');
  expect(canvases[0].historySubscribers.size).toBe(0);
});
