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
jest.mock('../../packages/ecs/src/utils', () => ({ isBrowser: false }));
jest.mock('../../packages/ecs/src/history', () => ({ safeAddComponent() {} }));
jest.mock('../../packages/ecs/src/environment', () => ({
  DOMAdapter: { get: jest.fn() },
}));

describe('input listener lifecycle', () => {
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
