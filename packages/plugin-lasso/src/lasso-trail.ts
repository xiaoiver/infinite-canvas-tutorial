/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/lasso/index.ts
 */

import {
  API,
  TRANSFORMER_ANCHOR_STROKE_COLOR,
  TRANSFORMER_MASK_FILL_COLOR,
} from '@infinite-canvas-tutorial/ecs';
import { AnimatedTrail } from '@infinite-canvas-tutorial/webcomponents';
import type { AnimationFrameHandler } from '@infinite-canvas-tutorial/webcomponents';
import simplify from 'simplify-js';

/**
 * Exponential ease-out method
 */
export const easeOut = (k: number) => {
  return 1 - Math.pow(1 - k, 4);
};

export class LassoTrail extends AnimatedTrail {
  constructor(animationFrameHandler: AnimationFrameHandler, api: API) {
    const {
      trailStroke = TRANSFORMER_ANCHOR_STROKE_COLOR,
      trailStrokeDasharray,
      trailStrokeDashoffset,
      trailFill = TRANSFORMER_MASK_FILL_COLOR,
      trailFillOpacity = 0.5,
    } = api.getAppState().penbarLasso;
    super(animationFrameHandler, api, {
      animateTrail: true,
      streamline: 0.4,
      sizeMapping: (c) => {
        const DECAY_TIME = Infinity;
        const DECAY_LENGTH = 5000;
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
      fill: () => trailFill,
      stroke: () => trailStroke,
      fillOpacity: () => trailFillOpacity,
      strokeDasharray: trailStrokeDasharray,
      strokeDashoffset: trailStrokeDashoffset,
    });
  }

  startPath(x: number, y: number) {
    this.clearTrails();
    super.startPath(x, y);
  }

  endPath(): void {
    super.endPath();
    this.clearTrails();
  }

  clearTrails(): void {
    super.clearTrails();
    this.stop();
  }

  /** Snapshot the current gesture for preview or commit before endPath clears it. */
  getPoints(): [number, number][] {
    const originalPoints = this.getCurrentTrail()?.originalPoints;
    if (!originalPoints?.length) return [];

    const [startX, startY] = originalPoints[0];
    // A tap or small touch jitter must not become a selection/mask.
    if (
      !originalPoints.some(([x, y]) => Math.hypot(x - startX, y - startY) >= 5)
    ) {
      return [];
    }
    const lassoPath = originalPoints.map(([x, y]) =>
      this.api.viewport2Canvas({ x, y }),
    );
    const simplifyDistance = 5 / this.api.getAppState().cameraZoom;
    return simplify(lassoPath, simplifyDistance).map(({ x, y }) => [x, y]);
  }
}
