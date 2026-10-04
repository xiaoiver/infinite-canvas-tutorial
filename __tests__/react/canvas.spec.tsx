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
import type {
  CanvasEditOptions,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import {
  useCanvasNode,
  useCanvasSelection,
  useCanvasHistory,
  useCanvasStatus,
  useCanvasCamera,
} from '../../packages/react/src/hooks';
import {
  useCanvasEvent,
  type CanvasEventOptions,
} from '../../packages/react/src/useCanvasEvent';

const canvases: TestCanvas[] = [];
class TestCanvas extends HTMLElement {
  state = { cameraZoom: 1, layersSelected: [], filter: '' };
  nodes: SerializedNode[] = [];
  history = { canUndo: false, canRedo: false };
  historySubscribers = new Set<(state: any) => void>();
  cleanups = new Set<() => void>();
  api = {
    element: this,
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
    edit: jest.fn(async (update, options: CanvasEditOptions = {}) => {
      update(this.api);
      this.api.record(options.capture);
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
  commit(patch = {}, nodesChanged = false) {
    this.state = { ...this.state, ...patch };
    this.subscribers.forEach((listener) =>
      listener(
        { appState: this.state, nodes: this.nodes },
        { nodesChanged, appStateChanged: true },
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

function StatusProbe({
  render = () => {},
}: {
  render?: (value: ReturnType<typeof useCanvasStatus>) => void;
}) {
  const lifecycle = useCanvasStatus();
  const api = useCanvasAPI();
  render(lifecycle);
  return (
    <output data-testid="lifecycle">{`${lifecycle.status}:${api !== null}:${
      lifecycle.error?.message ?? ''
    }`}</output>
  );
}

it('keeps initialization loading through async preparation and the initial commit', async () => {
  let finishPreparation!: () => void;
  let finishCommit!: (applied: boolean) => void;
  const preparation = new Promise<void>((resolve) => {
    finishPreparation = resolve;
  });
  const commit = new Promise<boolean>((resolve) => {
    finishCommit = resolve;
  });
  const render = jest.fn();
  const editor = (shown = true) => (
    <CanvasProvider>
      {shown && (
        <InfiniteCanvas
          runtime={runtime}
          initialNodes={[]}
          onReady={() => preparation}
        />
      )}
      <StatusProbe render={render} />
    </CanvasProvider>
  );
  expect(renderToString(editor())).toContain('idle:false:');
  expect(runtime.acquire).not.toHaveBeenCalled();
  await act(async () => root.render(editor()));
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'loading:false:',
  );
  canvases[0].api.edit.mockReturnValueOnce(commit);
  await act(async () => canvases[0].ready());
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'loading:true:',
  );
  await act(async () => finishPreparation());
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'loading:true:',
  );
  await act(async () => finishCommit(true));
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'ready:true:',
  );
  render.mockClear();
  await act(async () => canvases[0].commit({ cameraZoom: 2 }));
  expect(render).not.toHaveBeenCalled();
  await act(async () => root.render(editor(false)));
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'idle:false:',
  );
});

it('preserves lifecycle errors after teardown and resets them on recreation and removal', async () => {
  const failure = new Error('preparation failed');
  const editor = (renderer: 'webgl' | 'webgpu', shown = true) => (
    <CanvasProvider>
      {shown && (
        <InfiniteCanvas
          runtime={runtime}
          renderer={renderer}
          onReady={() => {
            if (renderer === 'webgl') throw failure;
          }}
        />
      )}
      <StatusProbe />
    </CanvasProvider>
  );
  await act(async () => root.render(editor('webgl')));
  await act(async () => canvases[0].ready());
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'error:false:preparation failed',
  );
  expect(canvases[0].historySubscribers.size).toBe(0);
  expect(canvases[0].subscribers.size).toBe(0);
  expect(release).toHaveBeenCalledTimes(1);
  await act(async () => root.render(editor('webgpu')));
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'loading:false:',
  );
  await act(async () => canvases[1].ready());
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'ready:true:',
  );
  await act(async () => root.render(editor('webgpu', false)));
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'idle:false:',
  );
});

it('ignores a preparation rejection from a removed canvas after recreation', async () => {
  let fail!: (reason: Error) => void;
  const preparation = new Promise<void>((_resolve, reject) => {
    fail = reject;
  });
  const editor = (renderer: 'webgl' | 'webgpu') => (
    <CanvasProvider>
      <InfiniteCanvas
        runtime={runtime}
        renderer={renderer}
        onReady={() => (renderer === 'webgl' ? preparation : undefined)}
      />
      <StatusProbe />
    </CanvasProvider>
  );
  await act(async () => root.render(editor('webgl')));
  await act(async () => canvases[0].ready());
  await act(async () => root.render(editor('webgpu')));
  await act(async () => canvases[1].ready());
  await act(async () => fail(new Error('obsolete preparation')));
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'ready:true:',
  );
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it('reports runtime failures through the Provider before an API attaches', async () => {
  runtime.acquire = () => ({
    ready: Promise.reject(new Error('offline')),
    release,
  });
  await act(async () =>
    root.render(
      <CanvasProvider>
        <InfiniteCanvas runtime={runtime} />
        <StatusProbe />
      </CanvasProvider>,
    ),
  );
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'error:false:offline',
  );
  await act(async () =>
    root.render(
      <CanvasProvider>
        <StatusProbe />
      </CanvasProvider>,
    ),
  );
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'idle:false:',
  );
});

it('exposes locale update errors without discarding the active API', async () => {
  const editor = (locale: string) => (
    <CanvasProvider>
      <InfiniteCanvas runtime={runtime} locale={locale} />
      <StatusProbe />
    </CanvasProvider>
  );
  await act(async () => root.render(editor('en')));
  await act(async () => canvases[0].ready());
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'ready:true:',
  );
  canvases[0].api.setLocale.mockRejectedValueOnce(new Error('locale failed'));
  await act(async () => root.render(editor('zh-Hans')));
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'error:true:locale failed',
  );
  expect(canvases).toHaveLength(1);
  expect(canvases[0].api.destroy).not.toHaveBeenCalled();
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
  let finish!: () => void;
  const preparation = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const onReady = jest.fn(async (api) => {
    expect(api.updateNodes).not.toHaveBeenCalled();
    await preparation;
  });
  await act(async () =>
    root.render(
      <StrictMode>
        <InfiniteCanvas
          ref={ref}
          runtime={runtime}
          initialNodes={nodes}
          onReady={onReady}
          fallback="Loading initial scene"
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
  expect(canvases[0].api.edit).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Loading initial scene');
  await act(async () => finish());
  expect(canvases[0].api.updateNodes).toHaveBeenCalledWith(nodes);
  expect(canvases[0].api.edit).toHaveBeenCalledWith(expect.any(Function), {
    capture: 'NEVER',
    signal: expect.any(AbortSignal),
  });
  expect(canvases[0].api.record).toHaveBeenCalledTimes(1);
  expect(canvases[0].api.record).toHaveBeenCalledWith('NEVER');
  expect(canvases[0].api.runAtNextTick).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('Loading initial scene');
  expect(canvases[0].querySelector('[slot="penbar-item"]')!.textContent).toBe(
    'Custom tool',
  );
  expect(canvases[0].api.destroy).not.toHaveBeenCalled();
});

it('aborts a pending initial edit on recreation and ignores its late completion', async () => {
  let finish!: (applied: boolean) => void;
  const pending = new Promise<boolean>((resolve) => {
    finish = resolve;
  });
  const onError = jest.fn();
  const editor = (renderer: 'webgl' | 'webgpu') => (
    <InfiniteCanvas
      runtime={runtime}
      renderer={renderer}
      initialNodes={[{ id: 'rect', type: 'rect', zIndex: 0, width: 10 }]}
      fallback="Loading initial scene"
      onError={onError}
    />
  );
  await act(async () => root.render(editor('webgl')));
  canvases[0].api.edit.mockReturnValueOnce(pending);
  await act(async () => canvases[0].ready());
  const options = canvases[0].api.edit.mock.calls[0][1];
  expect(options.signal!.aborted).toBe(false);
  expect(host.textContent).toContain('Loading initial scene');
  await act(async () => root.render(editor('webgpu')));
  expect(options.signal!.aborted).toBe(true);
  await act(async () => finish(true));
  expect(host.textContent).toContain('Loading initial scene');
  expect(canvases[0].api.updateNodes).not.toHaveBeenCalled();
  await act(async () => canvases[1].ready());
  expect(canvases[1].api.updateNodes).toHaveBeenCalledTimes(1);
  expect(host.textContent).not.toContain('Loading initial scene');
  expect(onError).not.toHaveBeenCalled();
});

it('cancels a queued initial edit on unmount without reporting its late rejection', async () => {
  let fail!: (reason: Error) => void;
  const pending = new Promise<boolean>((_resolve, reject) => {
    fail = reject;
  });
  const onError = jest.fn();
  await act(async () =>
    root.render(
      <InfiniteCanvas runtime={runtime} initialNodes={[]} onError={onError} />,
    ),
  );
  canvases[0].api.edit.mockReturnValueOnce(pending);
  await act(async () => canvases[0].ready());
  const options = canvases[0].api.edit.mock.calls[0][1];
  await act(async () => root.render(null));
  expect(options.signal!.aborted).toBe(true);
  await act(async () => fail(new Error('removed canvas')));
  expect(canvases[0].api.updateNodes).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledTimes(1);
});

it('reports a failed initial edit, clears its Provider API, and releases the runtime', async () => {
  const onError = jest.fn();
  const onAPIChange = jest.fn();
  await act(async () =>
    root.render(
      <CanvasProvider>
        <InfiniteCanvas
          runtime={runtime}
          initialNodes={[]}
          onError={onError}
          onAPIChange={onAPIChange}
        />
        <Toolbar />
      </CanvasProvider>,
    ),
  );
  const error = new Error('initial edit failed');
  canvases[0].api.edit.mockRejectedValueOnce(error);
  await act(async () => canvases[0].ready());
  expect(onError).toHaveBeenCalledWith(error);
  expect(host.querySelector('[role="alert"]')!.textContent).toBe(error.message);
  expect(host.querySelector('output')!.textContent).toBe('false:1:false:0');
  expect(onAPIChange.mock.calls.map(([api]) => api)).toEqual([
    canvases[0].api,
    null,
  ]);
  expect(canvases[0].api.destroy).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledTimes(1);
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
        initialNodes={[]}
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
  expect(canvases[0].api.edit).not.toHaveBeenCalled();
  expect(canvases[0].api.updateNodes).not.toHaveBeenCalled();
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
      <CanvasProvider>
        <InfiniteCanvas
          runtime={runtime}
          initializationTimeout={100}
          onError={onError}
        />
        <StatusProbe />
      </CanvasProvider>,
    ),
  );
  await act(async () => jest.advanceTimersByTime(100));
  expect(host.querySelector('ic-spectrum-canvas')).toBeNull();
  expect(host.querySelector('[role="alert"]')!.textContent).toContain(
    'timed out',
  );
  expect(release).toHaveBeenCalledTimes(1);
  expect(
    host.querySelector('[data-testid="lifecycle"]')!.textContent,
  ).toContain('error:false:Canvas initialization timed out.');
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
      new CustomEvent('ic-camera-changed', { detail: { zoom: 2 } }),
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

it('updates object selectors for committed in-place node mutations', async () => {
  const render = jest.fn();
  function Probe() {
    const node = useCanvasSelector((state) =>
      state.nodes.find((node) => node.id === 'rect'),
    );
    render(node);
    return <output>{node?.width}</output>;
  }
  await act(async () =>
    root.render(
      <CanvasProvider>
        <InfiniteCanvas runtime={runtime} />
        <Probe />
      </CanvasProvider>,
    ),
  );
  const canvas = canvases[0];
  canvas.nodes = [{ id: 'rect', type: 'rect', zIndex: 0, width: 100 }];
  await act(async () => canvas.ready());
  const previous = render.mock.calls.at(-1)![0];
  render.mockClear();
  await act(async () => {
    canvas.nodes[0].width = 120;
    canvas.commit({}, true);
  });
  expect(host.querySelector('output')!.textContent).toBe('120');
  expect(render).toHaveBeenCalledTimes(1);
  expect(previous.width).toBe(100);
  render.mockClear();
  await act(async () => canvas.commit({ cameraZoom: 2 }));
  expect(render).not.toHaveBeenCalled();
});

it('keeps node, selection, and history hooks stable through unrelated updates', async () => {
  const nodeRender = jest.fn();
  const selectionRender = jest.fn();
  const historyRender = jest.fn();
  function Node() {
    nodeRender(useCanvasNode('rect'));
    return null;
  }
  function Selection() {
    selectionRender(useCanvasSelection());
    return null;
  }
  function History() {
    historyRender(useCanvasHistory());
    return null;
  }
  await act(async () =>
    root.render(
      <CanvasProvider>
        <InfiniteCanvas runtime={runtime} />
        <Node />
        <Selection />
        <History />
      </CanvasProvider>,
    ),
  );
  const canvas = canvases[0];
  canvas.nodes = [
    {
      id: 'rect',
      type: 'rect',
      zIndex: 0,
      width: 100,
      fills: [{ type: 'solid', value: 'red' }],
    },
    { id: 'other', type: 'rect', zIndex: 1, width: 50 },
  ];
  await act(async () => canvas.ready());
  await act(async () => canvas.commit({ layersSelected: ['rect'] }));
  const previousNode = nodeRender.mock.calls.at(-1)![0];
  const previousSelection = selectionRender.mock.calls.at(-1)![0];
  nodeRender.mockClear();
  selectionRender.mockClear();
  historyRender.mockClear();
  await act(async () => {
    canvas.nodes[1].width = 90;
    canvas.commit({ cameraZoom: 2 }, true);
    canvas.historySubscribers.forEach((listener) => listener(canvas.history));
  });
  expect(nodeRender).not.toHaveBeenCalled();
  expect(selectionRender).not.toHaveBeenCalled();
  expect(historyRender).not.toHaveBeenCalled();
  await act(async () => {
    canvas.nodes[0].width = 120;
    canvas.nodes[0].fills![0].value = 'blue';
    canvas.commit({}, true);
  });
  expect(nodeRender).toHaveBeenCalledTimes(1);
  expect(selectionRender).toHaveBeenCalledTimes(1);
  expect(historyRender).not.toHaveBeenCalled();
  expect(nodeRender.mock.calls[0][0]).toMatchObject({
    width: 120,
    fills: [{ value: 'blue' }],
  });
  expect(previousNode).toMatchObject({ width: 100, fills: [{ value: 'red' }] });
  expect(previousSelection[0]).toEqual(previousNode);
  expect(previousSelection[0]).toBe(previousNode);
  expect(selectionRender.mock.calls[0][0][0]).toBe(nodeRender.mock.calls[0][0]);
  await act(async () =>
    canvas.historySubscribers.forEach((listener) =>
      listener({ canUndo: true, canRedo: false }),
    ),
  );
  expect(historyRender).toHaveBeenCalledTimes(1);
  expect(historyRender.mock.calls[0][0]).toEqual({
    canUndo: true,
    canRedo: false,
  });
});

it('resolves changed node IDs and ordered selection and resets hooks on destruction', async () => {
  const render = jest.fn();
  function Probe({ id }: { id?: string | null }) {
    const node = useCanvasNode(id);
    const selection = useCanvasSelection();
    const history = useCanvasHistory();
    render({ node, selection, history });
    return (
      <output>{`${node?.id ?? 'none'}:${selection
        .map((node) => node.id)
        .join(',')}`}</output>
    );
  }
  const editor = (id?: string | null) => (
    <CanvasProvider>
      <InfiniteCanvas runtime={runtime} />
      <Probe id={id} />
    </CanvasProvider>
  );
  expect(renderToString(editor())).toContain('none:');
  expect(render.mock.calls.at(-1)![0]).toEqual({
    node: null,
    selection: [],
    history: { canUndo: false, canRedo: false },
  });
  await act(async () => root.render(editor('rect')));
  const canvas = canvases[0];
  canvas.nodes = [
    { id: 'rect', type: 'rect', zIndex: 0 },
    { id: 'other', type: 'rect', zIndex: 1 },
    { id: 'deleted', type: 'rect', zIndex: 2, isDeleted: true },
  ];
  await act(async () => canvas.ready());
  await act(async () =>
    canvas.commit({ layersSelected: ['other', 'missing', 'deleted', 'rect'] }),
  );
  expect(host.querySelector('output')!.textContent).toBe('rect:other,rect');
  await act(async () => root.render(editor('other')));
  expect(host.querySelector('output')!.textContent).toBe('other:other,rect');
  await act(async () => root.render(editor('deleted')));
  expect(host.querySelector('output')!.textContent).toBe('none:other,rect');
  await act(async () => {
    canvas.nodes[1].isDeleted = true;
    canvas.commit({}, true);
  });
  expect(host.querySelector('output')!.textContent).toBe('none:rect');
  await act(async () => canvas.api.destroy());
  expect(render.mock.calls.at(-1)![0]).toEqual({
    node: null,
    selection: [],
    history: { canUndo: false, canRedo: false },
  });
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
        <StatusProbe />
      </CanvasProvider>
    </StrictMode>
  );
  await act(async () => root.render(editor('webgl')));
  await act(async () => canvases[0].ready());
  expect(host.querySelector('output')!.textContent).toBe('true:1:false:0');
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'ready:true:',
  );
  await act(async () => root.render(editor('webgpu')));
  expect(host.querySelector('output')!.textContent).toBe('false:1:false:0');
  expect(canvases[0].subscribers.size).toBe(0);
  await act(async () => canvases[1].ready());
  await act(async () => canvases[1].api.destroy());
  expect(host.querySelector('output')!.textContent).toBe('false:1:false:0');
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'idle:false:',
  );
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
        <StatusProbe />
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
  expect(host.querySelector('[data-testid="lifecycle"]')!.textContent).toBe(
    'ready:true:',
  );
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

it('keeps camera snapshots stable and follows camera events, recreation, and removal', async () => {
  const render = jest.fn();
  function CameraProbe() {
    const camera = useCanvasCamera();
    render(camera);
    return <output>{JSON.stringify(camera)}</output>;
  }
  const editor = (renderer: 'webgl' | 'webgpu', shown = true) => (
    <CanvasProvider>
      {shown && <InfiniteCanvas runtime={runtime} renderer={renderer} />}
      <CameraProbe />
    </CanvasProvider>
  );
  renderToString(editor('webgl'));
  expect(render).toHaveBeenLastCalledWith({ x: 0, y: 0, zoom: 1, rotation: 0 });
  expect(runtime.acquire).not.toHaveBeenCalled();
  await act(async () => root.render(editor('webgl')));
  await act(async () => canvases[0].ready());
  render.mockClear();
  await act(async () => canvases[0].commit({ filter: 'blur(2px)' }));
  expect(render).not.toHaveBeenCalled();
  const first = canvases[0];
  const move = () => {
    Object.assign(first.state, { cameraX: 20, cameraY: -10, cameraZoom: 2 });
    first.dispatchEvent(new CustomEvent('ic-camera-changed'));
  };
  await act(async () => move());
  const previous = render.mock.calls[0][0];
  expect(previous).toEqual({ x: 20, y: -10, zoom: 2, rotation: 0 });
  await act(async () => move());
  expect(render).toHaveBeenCalledTimes(1);
  await act(async () => {
    Object.assign(first.state, { cameraRotation: Math.PI / 2 });
    first.dispatchEvent(new CustomEvent('ic-camera-changed'));
  });
  expect(render).toHaveBeenLastCalledWith({
    x: 20,
    y: -10,
    zoom: 2,
    rotation: Math.PI / 2,
  });
  expect(previous.rotation).toBe(0);
  await act(async () => root.render(editor('webgpu')));
  expect(render).toHaveBeenLastCalledWith({ x: 0, y: 0, zoom: 1, rotation: 0 });
  await act(async () => canvases[1].ready());
  render.mockClear();
  await act(async () => move());
  expect(render).not.toHaveBeenCalled();
  await act(async () => canvases[1].commit({ cameraZoom: 3 }));
  expect(render).toHaveBeenLastCalledWith({ x: 0, y: 0, zoom: 3, rotation: 0 });
  await act(async () => root.render(editor('webgpu', false)));
  expect(render).toHaveBeenLastCalledWith({ x: 0, y: 0, zoom: 1, rotation: 0 });
});

function EventProbe({
  name = 'ic-point-drawn',
  listener,
  options,
}: {
  name?: 'ic-point-drawn' | 'ic-camera-zoom-changed';
  listener: (event: CustomEvent) => void;
  options?: CanvasEventOptions;
}) {
  useCanvasEvent(name, listener, options);
  return null;
}

const dispatchPoint = (canvas: TestCanvas) =>
  canvas.dispatchEvent(
    new CustomEvent('ic-point-drawn', { detail: { x: 12, y: 34 } }),
  );

it('subscribes after API attachment, remains SSR safe, and requires a Provider', async () => {
  const listener = jest.fn();
  const editor = (
    <CanvasProvider>
      <InfiniteCanvas runtime={runtime} />
      <EventProbe listener={listener} />
    </CanvasProvider>
  );
  renderToString(editor);
  expect(runtime.acquire).not.toHaveBeenCalled();
  expect(() => renderToString(<EventProbe listener={listener} />)).toThrow(
    'inside CanvasProvider',
  );
  await act(async () => root.render(editor));
  dispatchPoint(canvases[0]);
  expect(listener).not.toHaveBeenCalled();
  await act(async () => canvases[0].ready());
  dispatchPoint(canvases[0]);
  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({ detail: { x: 12, y: 34 } }),
  );
});

it('uses the latest callback without rearming a once listener on rerenders', async () => {
  const first = jest.fn();
  const second = jest.fn();
  const editor = (listener: jest.Mock) => (
    <CanvasProvider>
      <InfiniteCanvas runtime={runtime} />
      <EventProbe listener={listener} options={{ once: true }} />
    </CanvasProvider>
  );
  await act(async () => root.render(editor(first)));
  await act(async () => canvases[0].ready());
  await act(async () => root.render(editor(second)));
  dispatchPoint(canvases[0]);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  await act(async () => root.render(editor(first)));
  dispatchPoint(canvases[0]);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});

it('switches event names and pauses and resumes subscriptions', async () => {
  const listener = jest.fn();
  const editor = (
    name: 'ic-point-drawn' | 'ic-camera-zoom-changed',
    enabled = true,
  ) => (
    <CanvasProvider>
      <InfiniteCanvas runtime={runtime} />
      <EventProbe name={name} listener={listener} options={{ enabled }} />
    </CanvasProvider>
  );
  await act(async () => root.render(editor('ic-point-drawn', false)));
  await act(async () => canvases[0].ready());
  dispatchPoint(canvases[0]);
  expect(listener).not.toHaveBeenCalled();
  await act(async () => root.render(editor('ic-point-drawn')));
  dispatchPoint(canvases[0]);
  expect(listener).toHaveBeenCalledTimes(1);
  await act(async () => root.render(editor('ic-camera-zoom-changed')));
  dispatchPoint(canvases[0]);
  canvases[0].dispatchEvent(
    new CustomEvent('ic-camera-zoom-changed', { detail: { zoom: 2 } }),
  );
  expect(listener).toHaveBeenCalledTimes(2);
  expect(listener.mock.calls[1][0].detail).toEqual({ zoom: 2 });
  await act(async () => root.render(editor('ic-camera-zoom-changed', false)));
  canvases[0].dispatchEvent(new CustomEvent('ic-camera-zoom-changed'));
  expect(listener).toHaveBeenCalledTimes(2);
});

it('honors aborted signals and can subscribe again with a new signal', async () => {
  const listener = jest.fn();
  const controller = new AbortController();
  const editor = (signal: AbortSignal) => (
    <CanvasProvider>
      <InfiniteCanvas runtime={runtime} />
      <EventProbe listener={listener} options={{ signal }} />
    </CanvasProvider>
  );
  controller.abort();
  await act(async () => root.render(editor(controller.signal)));
  await act(async () => canvases[0].ready());
  dispatchPoint(canvases[0]);
  expect(listener).not.toHaveBeenCalled();
  const next = new AbortController();
  await act(async () => root.render(editor(next.signal)));
  dispatchPoint(canvases[0]);
  expect(listener).toHaveBeenCalledTimes(1);
  next.abort();
  dispatchPoint(canvases[0]);
  await act(async () => root.render(editor(next.signal)));
  dispatchPoint(canvases[0]);
  expect(listener).toHaveBeenCalledTimes(1);
});

it('cleans up a removed subscriber under StrictMode and preserves other listeners', async () => {
  const listener = jest.fn();
  const external = jest.fn();
  const editor = (shown = true) => (
    <StrictMode>
      <CanvasProvider>
        <InfiniteCanvas runtime={runtime} />
        {shown && <EventProbe listener={listener} />}
      </CanvasProvider>
    </StrictMode>
  );
  await act(async () => root.render(editor()));
  const canvas = canvases[canvases.length - 1];
  await act(async () => canvas.ready());
  canvas.addEventListener('ic-point-drawn', external);
  dispatchPoint(canvas);
  expect(listener).toHaveBeenCalledTimes(1);
  await act(async () => root.render(editor(false)));
  dispatchPoint(canvas);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(external).toHaveBeenCalledTimes(2);
  expect(canvas.isConnected).toBe(true);
  await act(async () => root.render(editor()));
  dispatchPoint(canvas);
  expect(listener).toHaveBeenCalledTimes(2);
});

it('isolates Providers and rejects detached events before cleanup when recreating', async () => {
  const left = jest.fn();
  const right = jest.fn();
  let oldCanvas: TestCanvas;
  const editor = (renderer: 'webgl' | 'webgpu') => (
    <>
      <CanvasProvider>
        <InfiniteCanvas
          runtime={runtime}
          renderer={renderer}
          onAPIChange={(api) => {
            if (!api && oldCanvas) dispatchPoint(oldCanvas);
          }}
        />
        <EventProbe listener={left} />
      </CanvasProvider>
      <CanvasProvider>
        <InfiniteCanvas runtime={runtime} />
        <EventProbe listener={right} />
      </CanvasProvider>
    </>
  );
  await act(async () => root.render(editor('webgl')));
  oldCanvas = canvases[0];
  await act(async () => canvases.forEach((canvas) => canvas.ready()));
  dispatchPoint(oldCanvas);
  expect(left).toHaveBeenCalledTimes(1);
  expect(right).not.toHaveBeenCalled();
  await act(async () => root.render(editor('webgpu')));
  dispatchPoint(oldCanvas);
  expect(left).toHaveBeenCalledTimes(1);
  await act(async () => canvases[2].ready());
  dispatchPoint(canvases[2]);
  expect(left).toHaveBeenCalledTimes(2);
  dispatchPoint(canvases[1]);
  expect(right).toHaveBeenCalledTimes(1);
});

it('removes event subscriptions synchronously on API destruction', async () => {
  const listener = jest.fn();
  await act(async () =>
    root.render(
      <CanvasProvider>
        <InfiniteCanvas runtime={runtime} />
        <EventProbe listener={listener} />
      </CanvasProvider>,
    ),
  );
  const canvas = canvases[0];
  await act(async () => canvas.ready());
  dispatchPoint(canvas);
  await act(async () => {
    canvas.api.destroy();
    dispatchPoint(canvas);
  });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(canvas.cleanups.size).toBe(0);
});
