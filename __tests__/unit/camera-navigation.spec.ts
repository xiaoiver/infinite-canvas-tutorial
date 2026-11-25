import { Camera } from '../../packages/core/src/Camera';
import { DOMAdapter, type Adapter } from '../../packages/core/src/environment';
it.each([false, true])(
  'immediate navigation cancels the previous flight and updates matrices synchronously (flight started: %s)',
  (started) => {
    const camera = new Camera(200, 200);
    const callbacks = new Map<number, FrameRequestCallback>();
    let id = 0;
    const previous = DOMAdapter.get();
    DOMAdapter.set({
      requestAnimationFrame: () => 0,
      cancelAnimationFrame() {},
    } as Adapter);
    const adapter = DOMAdapter.get();
    const schedule = jest
      .spyOn(adapter, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callbacks.set(++id, callback);
        return id;
      });
    const cancel = jest
      .spyOn(adapter, 'cancelAnimationFrame')
      .mockImplementation((key) => {
        callbacks.delete(key);
      });
    try {
      camera.gotoLandmark({ x: 100, y: 200, zoom: 3 }, { duration: 100 });
      expect(callbacks.size).toBe(1);
      if (started) {
        const [key, callback] = callbacks.entries().next().value!;
        callbacks.delete(key);
        callback(1000);
        expect(callbacks.size).toBe(1);
      }
      const target = { x: 20, y: 30, zoom: 2, rotation: 0 };
      camera.gotoLandmark(target, { duration: 0 });
      expect(callbacks.size).toBe(0);
      const anchor = camera.canvas2Viewport({ x: 20, y: 30 });
      expect(anchor.x).toBeCloseTo(0, 5);
      expect(anchor.y).toBeCloseTo(0, 5);
      expect(camera.zoom).toBe(2);
      expect(target).toEqual({ x: 20, y: 30, zoom: 2, rotation: 0 });
    } finally {
      schedule.mockRestore();
      cancel.mockRestore();
      DOMAdapter.set(previous);
    }
  },
);
