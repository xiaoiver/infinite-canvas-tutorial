import { StrictMode, act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  InfiniteCanvas,
  type InfiniteCanvasHandle,
} from '../../packages/react/src/InfiniteCanvas';
import type { CanvasRuntime } from '../../packages/react/src/runtime';

const canvases: TestCanvas[] = [];
class TestCanvas extends HTMLElement {
  api = {
    subscribe: jest.fn((listener) => {
      this.subscribers.add(listener);
      return () => this.subscribers.delete(listener);
    }),
    destroy: jest.fn(),
    setLocale: jest.fn().mockResolvedValue(undefined),
    setAppState: jest.fn(),
    updateNodes: jest.fn(),
    record: jest.fn(),
    runAtNextTick: jest.fn((task) => task()),
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
