import { StrictMode, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import type { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { CanvasContext } from '../../packages/react/src/CanvasProvider';
import { createCanvasStore } from '../../packages/react/src/store';
import {
  useCanvasShortcuts,
  type CanvasShortcutOptions,
  type CanvasShortcutProps,
} from '../../packages/react/src/useCanvasShortcuts';
import { act } from './act';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function canvas(store = createCanvasStore()) {
  const state = { layersSelected: ['first'] };
  const nodes = [
    { id: 'first', type: 'rect', zIndex: 0 },
    { id: 'second', type: 'rect', zIndex: 1 },
    { id: 'deleted', type: 'rect', zIndex: 2, isDeleted: true },
  ] as SerializedNode[];
  const api = {
    getAppState: () => state,
    getNodes: () => nodes,
    getHistoryState: () => ({ canUndo: true, canRedo: true }),
    subscribe: () => () => {},
    subscribeHistory: () => () => {},
    onDestroy: (cleanup: () => void) => cleanup,
    undo: jest.fn(),
    redo: jest.fn(),
    deleteNodesById: jest.fn(),
    selectNodes: jest.fn((selected: SerializedNode[]) => {
      state.layersSelected = selected.map((node) => node.id);
    }),
    edit: jest.fn(
      async (update: (api: unknown) => void, _options?: unknown) => {
        update(api);
        return true;
      },
    ),
  };
  const lease = store.claim();
  lease.attach(api as unknown as ExtendedAPI, document.createElement('div'));
  lease.setStatus('ready');
  return { store, api, lease, state };
}

function Scope({
  id = 'scope',
  options,
  children,
  observe,
}: {
  id?: string;
  options?: CanvasShortcutOptions;
  children?: ReactNode;
  observe?: (props: CanvasShortcutProps) => void;
}) {
  const props = useCanvasShortcuts(options);
  observe?.(props);
  return (
    <section {...props} data-testid={id}>
      {children ?? <button>Toolbar</button>}
    </section>
  );
}

async function press(
  target: Element,
  key: string,
  options: KeyboardEventInit = {},
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    composed: true,
    cancelable: true,
    ...options,
  });
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}

it('handles Windows and Mac history keys once, selects without history, and deletes current selection', async () => {
  const { api, store, state } = canvas();
  await act(async () =>
    root.render(
      <StrictMode>
        <CanvasContext.Provider value={store}>
          <Scope />
        </CanvasContext.Provider>
      </StrictMode>,
    ),
  );
  const button = host.querySelector('button')!;
  const native = jest.fn();
  button.addEventListener('keydown', native);
  for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
    expect((await press(button, 'z', modifier)).defaultPrevented).toBe(true);
    await press(button, 'Z', { ...modifier, shiftKey: true });
  }
  await press(button, 'y', { ctrlKey: true });
  expect(api.undo).toHaveBeenCalledTimes(2);
  expect(api.redo).toHaveBeenCalledTimes(3);
  expect(native).not.toHaveBeenCalled();
  await press(button, 'a', { ctrlKey: true });
  expect(state.layersSelected).toEqual(['first', 'second']);
  expect(api.edit.mock.calls[0][1]).toMatchObject({ capture: 'NEVER' });
  await press(button, 'Delete');
  expect(api.deleteNodesById).toHaveBeenLastCalledWith(['first', 'second']);
  state.layersSelected = ['second'];
  await press(button, 'Backspace');
  expect(api.deleteNodesById).toHaveBeenLastCalledWith(['second']);
});

it('leaves text inputs, editable ancestors, shadow inputs, opt-outs, composition, and unrelated keys alone', async () => {
  const { api, store } = canvas();
  await act(async () =>
    root.render(
      <CanvasContext.Provider value={store}>
        <Scope>
          <input />
          <textarea />
          <select />
          <div contentEditable suppressContentEditableWarning>
            <span>text</span>
          </div>
          <div role="textbox" tabIndex={0} />
          <div data-canvas-shortcuts-ignore>
            <button>Custom editor</button>
          </div>
          <div data-shadow="" />
          <button data-plain="">Toolbar</button>
        </Scope>
      </CanvasContext.Provider>,
    ),
  );
  const shadow = host
    .querySelector('[data-shadow]')!
    .attachShadow({ mode: 'open' });
  const input = document.createElement('input');
  shadow.append(input);
  const editable = [
    ...host.querySelectorAll(
      'input, textarea, select, [contenteditable] span, [role=textbox], [data-canvas-shortcuts-ignore] button',
    ),
    input,
  ];
  for (const target of editable) {
    expect((await press(target, 'z', { ctrlKey: true })).defaultPrevented).toBe(
      false,
    );
    expect((await press(target, 'Backspace')).defaultPrevented).toBe(false);
  }
  const button = host.querySelector('[data-plain]')!;
  for (const options of [
    { isComposing: true },
    { keyCode: 229 },
    { repeat: true },
    { altKey: true },
  ]) {
    expect(
      (await press(button, 'z', { ctrlKey: true, ...options }))
        .defaultPrevented,
    ).toBe(false);
  }
  for (const [key, options] of [
    ['Escape', {}],
    ['Delete', { shiftKey: true }],
    ['a', { metaKey: true, shiftKey: true }],
  ] as const) {
    expect((await press(button, key, options)).defaultPrevented).toBe(false);
  }
  const prevented = new KeyboardEvent('keydown', {
    key: 'z',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  prevented.preventDefault();
  await act(async () => {
    button.dispatchEvent(prevented);
  });
  expect(api.undo).not.toHaveBeenCalled();
  expect(api.edit).not.toHaveBeenCalled();
});

it('isolates sibling and nested Providers, disabled scopes, and portals outside the DOM boundary', async () => {
  const left = canvas();
  const right = canvas();
  const portal = document.createElement('button');
  document.body.append(portal);
  try {
    const editor = (enabled: boolean) => (
      <CanvasContext.Provider value={left.store}>
        <Scope id="left">
          <button data-left="">Left</button>
          <CanvasContext.Provider value={right.store}>
            <Scope id="right" options={{ enabled }} />
          </CanvasContext.Provider>
          {createPortal(<span>Portal</span>, portal)}
        </Scope>
      </CanvasContext.Provider>
    );
    await act(async () => root.render(editor(true)));
    await press(host.querySelector('[data-testid=right] button')!, 'z', {
      ctrlKey: true,
    });
    expect(right.api.undo).toHaveBeenCalledTimes(1);
    expect(left.api.undo).not.toHaveBeenCalled();
    await press(host.querySelector('[data-left]')!, 'z', { metaKey: true });
    expect(left.api.undo).toHaveBeenCalledTimes(1);
    await act(async () => root.render(editor(false)));
    expect(
      (
        await press(host.querySelector('[data-testid=right] button')!, 'z', {
          ctrlKey: true,
        })
      ).defaultPrevented,
    ).toBe(false);
    expect(
      (await press(portal.querySelector('span')!, 'z', { ctrlKey: true }))
        .defaultPrevented,
    ).toBe(false);
    expect(right.api.undo).toHaveBeenCalledTimes(1);
    expect(left.api.undo).toHaveBeenCalledTimes(1);
  } finally {
    portal.remove();
  }
});

it('keeps props stable and resolves readiness, removal, and replacement at key time', async () => {
  const first = canvas();
  const observe = jest.fn();
  const editor = (enabled = true) => (
    <CanvasContext.Provider value={first.store}>
      <Scope options={{ enabled }} observe={observe} />
    </CanvasContext.Provider>
  );
  await act(async () => root.render(editor()));
  const initial = observe.mock.calls[0][0];
  await act(async () => root.render(editor(false)));
  expect(observe.mock.calls.at(-1)[0]).toBe(initial);
  await act(async () => root.render(editor()));
  first.lease.setStatus('loading');
  expect(
    (await press(host.querySelector('button')!, 'Delete')).defaultPrevented,
  ).toBe(false);
  first.lease.setStatus('ready');
  await press(host.querySelector('button')!, 'Delete');
  expect(first.api.edit).toHaveBeenCalledTimes(1);
  first.lease.release();
  expect(
    (await press(host.querySelector('button')!, 'Delete')).defaultPrevented,
  ).toBe(false);
  const second = canvas(first.store);
  await press(host.querySelector('button')!, 'Delete');
  expect(first.api.edit).toHaveBeenCalledTimes(1);
  expect(second.api.edit).toHaveBeenCalledTimes(1);
});

it('reports queued edit failures to the latest callback and ignores detached owners', async () => {
  const { store, api, lease } = canvas();
  let reject: (error: Error) => void;
  api.edit.mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const first = jest.fn();
  const latest = jest.fn();
  const editor = (onError: (error: Error) => void) => (
    <CanvasContext.Provider value={store}>
      <Scope options={{ onError }} />
    </CanvasContext.Provider>
  );
  await act(async () => root.render(editor(first)));
  await press(host.querySelector('button')!, 'Delete');
  await act(async () => root.render(editor(latest)));
  const error = new Error('Edit failed');
  await act(async () => reject(error));
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledWith(error);
  await press(host.querySelector('button')!, 'Delete');
  lease.release();
  await act(async () => reject(error));
  expect(latest).toHaveBeenCalledTimes(1);
});

it('renders a focusable scope during SSR without browser listeners or an API', () => {
  const store = createCanvasStore();
  const markup = renderToString(
    <CanvasContext.Provider value={store}>
      <Scope />
    </CanvasContext.Provider>,
  );
  expect(markup).toContain('tabindex="0"');
  expect(markup).toContain('data-canvas-shortcuts=');
  expect(store.getSnapshot().api).toBe(null);
});
