import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import { CanvasContext } from '../../packages/react/src/CanvasProvider';
import { createCanvasStore } from '../../packages/react/src/store';
import {
  useCanvasCoordinates,
  type CanvasCoordinates,
  type CanvasPoint,
} from '../../packages/react/src/useCanvasCoordinates';
import { act } from './act';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function api(offset: number) {
  return {
    getNodes: () => [],
    getAppState: () => ({}),
    getHistoryState: () => ({ canUndo: false, canRedo: false }),
    subscribe: () => () => {},
    subscribeHistory: () => () => {},
    onDestroy: (cleanup: () => void) => cleanup,
    client2Viewport: jest.fn(({ x, y }: CanvasPoint) => ({
      x: x - offset,
      y: y - offset,
    })),
    viewport2Canvas: jest.fn(({ x, y }: CanvasPoint) => ({
      x: x + 10,
      y: y + 20,
    })),
    canvas2Viewport: jest.fn(({ x, y }: CanvasPoint) => ({
      x: x - 10,
      y: y - 20,
    })),
    viewport2Client: jest.fn(({ x, y }: CanvasPoint) => ({
      x: x + offset,
      y: y + offset,
    })),
  };
}

it('returns stable conversion methods that follow attachment, current geometry, and replacement without subscribing', async () => {
  const store = createCanvasStore();
  const observe = jest.fn();
  let coordinates: CanvasCoordinates;
  function Probe() {
    coordinates = useCanvasCoordinates();
    observe(coordinates);
    return null;
  }
  const editor = (
    <StrictMode>
      <CanvasContext.Provider value={store}>
        <Probe />
      </CanvasContext.Provider>
    </StrictMode>
  );
  await act(async () => root.render(editor));
  const retained = coordinates!;
  const point = Object.freeze({ x: 50, y: 60 });
  for (const convert of Object.values(retained))
    expect(convert(point)).toBe(null);
  const lease = store.claim();
  const first = api(5);
  lease.attach(first as unknown as ExtendedAPI, document.createElement('div'));
  // Availability follows the attached API, including during async preparation.
  expect(retained.clientToCanvas(point)).toEqual({ x: 55, y: 75 });
  expect(first.client2Viewport).toHaveBeenCalledWith(point);
  expect(first.viewport2Canvas).toHaveBeenCalledWith({ x: 45, y: 55 });
  expect(retained.canvasToClient(point)).toEqual({ x: 45, y: 45 });
  expect(retained.viewportToCanvas(point)).toEqual({ x: 60, y: 80 });
  expect(retained.canvasToViewport(point)).toEqual({ x: 40, y: 40 });
  observe.mockClear();
  first.client2Viewport.mockImplementation(({ x, y }) => ({
    x: x - 100,
    y: y - 200,
  }));
  expect(retained.clientToCanvas(point)).toEqual({ x: -40, y: -120 });
  store.refresh(first as unknown as ExtendedAPI);
  expect(observe).not.toHaveBeenCalled();
  await act(async () =>
    root.render(
      <StrictMode>
        <CanvasContext.Provider value={store}>
          <Probe />
        </CanvasContext.Provider>
      </StrictMode>,
    ),
  );
  expect(coordinates!).toBe(retained);
  lease.release();
  for (const convert of Object.values(retained))
    expect(convert(point)).toBe(null);
  const nextLease = store.claim();
  const second = api(200);
  nextLease.attach(
    second as unknown as ExtendedAPI,
    document.createElement('div'),
  );
  expect(retained.clientToCanvas(point)).toEqual({ x: -140, y: -120 });
  expect(retained.canvasToClient(point)).toEqual({ x: 240, y: 240 });
  nextLease.release();
  expect(point).toEqual({ x: 50, y: 60 });
});

it('returns null for every conversion during SSR without browser globals or an API', () => {
  const store = createCanvasStore();
  function Probe() {
    const conversions = useCanvasCoordinates();
    for (const convert of Object.values(conversions))
      expect(convert({ x: 1, y: 2 })).toBe(null);
    return <span>Coordinates</span>;
  }
  expect(
    renderToString(
      <CanvasContext.Provider value={store}>
        <Probe />
      </CanvasContext.Provider>,
    ),
  ).toContain('Coordinates');
});
