import { EventWriter } from '../../packages/ecs/src/systems/EventWriter';
import { Canvas } from '../../packages/ecs/src/components';
import { DOMAdapter } from '../../packages/ecs/src/environment';
import { JSDOM } from 'jsdom';

let mockQuery: any;
jest.mock('../../packages/ecs/node_modules/@lastolivegames/becsy', () => ({
  System: class {
    query() {
      return mockQuery;
    }
    accessRecentlyDeletedData() {}
  },
  co: (_target: any, _key: string, descriptor: any) => descriptor,
}));
jest.mock('../../packages/ecs/src/components', () => ({
  Canvas: class {},
  Input: class {},
  Cursor: class {},
}));
jest.mock('../../packages/ecs/src/utils', () => ({ isBrowser: true }));
jest.mock('../../packages/ecs/src/history', () => ({ safeAddComponent() {} }));
jest.mock('../../packages/ecs/src/environment', () => ({
  DOMAdapter: { get: jest.fn() },
}));

describe('input listener lifecycle', () => {
  it('retains timestamped coalesced samples and the release position within a frame', () => {
    const { window } = new JSDOM();
    (window as any).PointerEvent = window.MouseEvent;
    (DOMAdapter.get as jest.Mock).mockReturnValue({ getWindow: () => window });
    const element = window.document.createElement('canvas');
    window.document.body.append(element);
    const input = { pointerSamples: [] } as any;
    const api = {
      getCanvasElement: () => element,
      client2Viewport: ({ x, y }) => ({ x: x - 100, y: y - 50 }),
    };
    const entity = {
      __id: 1,
      hold: () => entity,
      read: (type) =>
        type === Canvas ? { element, api, width: 640, height: 320 } : input,
      write: () => input,
    };
    mockQuery = { added: [entity], removed: [] };
    const writer = new EventWriter();
    writer.execute();
    const event = (
      type: string,
      x: number,
      timeStamp: number,
      pressure: number,
    ) => {
      const result = new window.MouseEvent(type, {
        clientX: x + 100,
        clientY: 70,
        button: 0,
      });
      Object.defineProperties(result, {
        pointerId: { value: 1 },
        pointerType: { value: 'pen' },
        timeStamp: { value: timeStamp },
        pressure: { value: pressure },
      });
      return result;
    };
    // Hover does not enter the active-stroke queue.
    element.dispatchEvent(event('pointermove', 0, 1, 0));
    element.dispatchEvent(event('pointerdown', 0, 10, 0.2));
    const move = event('pointermove', 12, 16, 0.8);
    Object.defineProperty(move, 'getCoalescedEvents', {
      value: () => [
        event('pointermove', 4, 12, 0.4),
        event('pointermove', 8, 14, 0.6),
      ],
    });
    element.dispatchEvent(move);
    element.dispatchEvent(event('pointerup', 15, 18, 0));
    expect(
      input.pointerSamples.map(
        ({ phase, x, y, timeStamp, pressure, pointerType }) => [
          phase,
          x,
          y,
          timeStamp,
          pressure,
          pointerType,
        ],
      ),
    ).toEqual([
      ['down', 0, 20, 10, 0.2, 'pen'],
      ['move', 4, 20, 12, 0.4, 'pen'],
      ['move', 8, 20, 14, 0.6, 'pen'],
      ['move', 12, 20, 16, 0.8, 'pen'],
      ['up', 15, 20, 18, 0, 'pen'],
    ]);
    writer.finalize();
    window.close();
  });

  it('routes Escape through the canvas event path and retains the handled keydown through keyup', () => {
    const { window } = new JSDOM();
    (window as any).PointerEvent = window.MouseEvent;
    (DOMAdapter.get as jest.Mock).mockReturnValue({ getWindow: () => window });
    const inputs = [{}, {}] as Array<{ key?: string; event?: Event }>;
    const elements = inputs.map(() => {
      const element = window.document.createElement('canvas');
      window.document.body.append(element);
      return element;
    });
    elements[1].tabIndex = -1;
    const canvases = inputs.map((input, index) => {
      const entity = {
        __id: index,
        hold: () => entity,
        read: (type) =>
          type === Canvas ? { element: elements[index], api: {} } : input,
        write: () => input,
      };
      return entity;
    });
    mockQuery = { added: canvases, removed: [] };
    const writer = new EventWriter();
    writer.execute();
    expect(elements[0].tabIndex).toBe(0);
    expect(elements[1].tabIndex).toBe(-1);
    elements[0].addEventListener('keydown', (event) => event.preventDefault());
    const down = new window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    elements[0].dispatchEvent(down);
    elements[0].dispatchEvent(
      new window.KeyboardEvent('keyup', { key: 'Escape', bubbles: true }),
    );
    expect(inputs[0].key).toBe('Escape');
    expect(inputs[0].event).toBe(down);
    expect(inputs[0].event!.defaultPrevented).toBe(true);
    expect(inputs[1].key).toBeUndefined();
    inputs[0].key = undefined;
    const input = window.document.createElement('input');
    window.document.body.append(input);
    input.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(inputs.every((state) => state.key === undefined)).toBe(true);
    writer.finalize();
    window.close();
  });
  it('removes global listeners on world exit even if the canvas was just deleted', () => {
    const { window } = new JSDOM();
    (window as any).PointerEvent = window.MouseEvent;
    (DOMAdapter.get as jest.Mock).mockReturnValue({ getWindow: () => window });
    const input = {};
    const canvas = {
      __id: 1,
      hold: () => canvas,
      read: jest.fn((type) =>
        type === Canvas
          ? { element: window.document.createElement('canvas'), api: {} }
          : input,
      ),
      write: jest.fn(() => input),
    };
    mockQuery = { added: [canvas], removed: [] };
    const writer = new EventWriter();
    writer.execute();
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Shift' }));
    expect(canvas.write).toHaveBeenCalled();
    canvas.write.mockClear();
    canvas.read.mockImplementation(() => {
      throw new Error('Canvas already deleted');
    });
    writer.finalize();
    writer.finalize();
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Shift' }));
    window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'Shift' }));
    expect(canvas.write).not.toHaveBeenCalled();
    window.close();
  });
});
