/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/eraser/index.ts
 */

import { API, ThemeMode } from '@infinite-canvas-tutorial/ecs';
import { AnimatedTrail } from '@infinite-canvas-tutorial/webcomponents';
import type { AnimationFrameHandler } from '@infinite-canvas-tutorial/webcomponents';

/**
 * Exponential ease-out method
 */
export const easeOut = (k: number) => {
  return 1 - Math.pow(1 - k, 4);
};

export class EraserTrail extends AnimatedTrail {
  constructor(animationFrameHandler: AnimationFrameHandler, api: API) {
    super(animationFrameHandler, api, {
      streamline: 0.2,
      size: 5,
      keepHead: true,
      sizeMapping: (c) => {
        const DECAY_TIME = 200;
        const DECAY_LENGTH = 10;
        const t = Math.max(
          0,
          1 - (performance.now() - c.pressure) / DECAY_TIME,
        );
        const l =
          (DECAY_LENGTH -
            Math.min(DECAY_LENGTH, c.totalLength - c.currentIndex)) /
          DECAY_LENGTH;

        return Math.min(easeOut(l), easeOut(t));
      },
      fill: () =>
        api.getAppState().theme.mode === ThemeMode.LIGHT
          ? 'rgba(0, 0, 0, 0.2)'
          : 'rgba(255, 255, 255, 0.2)',
    });
  }

  startPath(x: number, y: number): void {
    this.endPath();
    super.startPath(x, y);
  }

  addPointToPath(x: number, y: number): void {
    super.addPointToPath(x, y);

    // Hit-testing
  }

  endPath(): void {
    super.endPath();
    super.clearTrails();
  }
}
