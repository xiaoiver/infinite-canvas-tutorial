import type { API } from '../../packages/ecs/src';
import { createDocumentWorld } from './ecs-document';

/** Real event listeners and scene systems, with a deterministic dispatch clock. */
export async function createSelectionWorld(count = 1) {
  const world = await createDocumentWorld(count, true);
  const errors: unknown[] = [];
  world.window.addEventListener('error', (event) => {
    errors.push(event.error);
    event.preventDefault();
  });
  const assertNoErrors = () => {
    if (errors.length) throw errors.shift();
  };
  let time = 1000;
  const frames = async (count = 2) => {
    for (let i = 0; i < count; i++) await world.frame();
  };
  for (const api of world.apis) {
    world.window.document.body.append(api.getCanvasElement());
  }
  const dispatch = (
    api: API,
    type: string,
    x: number,
    y: number,
    options: MouseEventInit & {
      pointerType?: 'mouse' | 'touch' | 'pen';
      pointerId?: number;
    } = {},
  ) => {
    const event = new world.window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
      ...options,
    });
    Object.defineProperties(event, {
      pointerType: { value: options.pointerType ?? 'mouse' },
      pointerId: { value: options.pointerId ?? 1 },
      pressure: { value: 0.5 },
    });
    const clock = jest.spyOn(performance, 'now').mockReturnValue(time);
    try {
      api.getCanvasElement().dispatchEvent(event);
      assertNoErrors();
    } finally {
      clock.mockRestore();
      time += 400; // Clicks are separate unless a test explicitly sends a double click.
    }
  };
  const pointer = async (...args: Parameters<typeof dispatch>) => {
    dispatch(...args);
    await frames();
  };
  return {
    ...world,
    assertNoErrors,
    frames,
    dispatch,
    pointer,
    async click(
      api: API,
      x: number,
      y: number,
      options?: Parameters<typeof dispatch>[4],
    ) {
      await pointer(api, 'pointerdown', x, y, options);
      await pointer(api, 'pointerup', x, y, options);
    },
    async key(api: API, key: string, options: KeyboardEventInit = {}) {
      api.getCanvasElement().dispatchEvent(
        new world.window.KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key,
          ...options,
        }),
      );
      assertNoErrors();
      await frames();
      api.getCanvasElement().dispatchEvent(
        new world.window.KeyboardEvent('keyup', {
          bubbles: true,
          key,
          ...options,
        }),
      );
      assertNoErrors();
      await frames();
    },
  };
}
