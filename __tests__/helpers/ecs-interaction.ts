import { App, DOMAdapter } from '../../packages/ecs/src';
import { NodeJSAdapter, createMouseEvent } from '../utils';

/** Own the render loop so input cannot race an automatic ECS frame. */
export function createECSInteraction() {
  const previousAdapter = DOMAdapter.get();
  DOMAdapter.set({
    ...NodeJSAdapter,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  });
  const app = new App();
  const frames = async (count = 2) => {
    for (let i = 0; i < count; i++) await app.world.execute();
  };

  return {
    app,
    frames,
    async mouse(
      canvas: HTMLCanvasElement,
      type: string,
      x: number,
      y: number,
      time?: number,
    ) {
      // Double-click timing belongs to event dispatch, not slow GPU frames.
      // Restore the real clock before executing systems or measuring performance.
      const clock =
        time === undefined
          ? undefined
          : jest.spyOn(performance, 'now').mockReturnValue(time);
      try {
        canvas.dispatchEvent(
          createMouseEvent(type, { clientX: x, clientY: y }),
        );
      } finally {
        clock?.mockRestore();
      }
      await frames();
    },
    async dispose() {
      try {
        await app.exit();
      } finally {
        DOMAdapter.set(previousAdapter);
      }
    },
  };
}
