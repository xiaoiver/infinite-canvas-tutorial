/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/lasso/index.ts
 */

import {
  API,
  Pen,
  TRANSFORMER_ANCHOR_STROKE_COLOR,
  TRANSFORMER_MASK_FILL_COLOR,
} from '@infinite-canvas-tutorial/ecs';
import { AnimatedTrail } from '@infinite-canvas-tutorial/webcomponents';
import type { AnimationFrameHandler } from '@infinite-canvas-tutorial/webcomponents';
import { selectByLassoPath } from './utils';
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
      lassoTrailStroke = TRANSFORMER_ANCHOR_STROKE_COLOR,
      lassoTrailStrokeDasharray,
      lassoTrailStrokeDashoffset,
      lassoTrailFill = TRANSFORMER_MASK_FILL_COLOR,
      lassoTrailFillOpacity = 0.5,
    } = api.getAppState();
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
      fill: () => lassoTrailFill,
      stroke: () => lassoTrailStroke,
      fillOpacity: () => lassoTrailFillOpacity,
      strokeDasharray: lassoTrailStrokeDasharray,
      strokeDashoffset: lassoTrailStrokeDashoffset,
    });
  }

  startPath(x: number, y: number, keepPreviousSelection = false) {
    // clear any existing trails just in case
    this.endPath();

    super.startPath(x, y);
    // this.intersectedElements.clear();
    // this.enclosedElements.clear();

    // this.keepPreviousSelection = keepPreviousSelection;

    // if (!this.keepPreviousSelection) {
    //   this.app.setState({
    //     selectedElementIds: {},
    //     selectedGroupIds: {},
    //     selectedLinearElement: null,
    //   });
    // }
  }

  addPointToPath = (x: number, y: number, keepPreviousSelection = false) => {
    super.addPointToPath(x, y);

    // this.keepPreviousSelection = keepPreviousSelection;
    this.updateSelection();
  };

  endPath(): void {
    super.endPath();
    super.clearTrails();
    // this.intersectedElements.clear();
    // this.enclosedElements.clear();
    // this.elementsSegments = null;
  }

  private updateSelection() {
    const lassoPath = super
      .getCurrentTrail()
      ?.originalPoints?.map((p) =>
        this.api.viewport2Canvas({ x: p[0], y: p[1] }),
      );

    if (lassoPath) {
      const simplifyDistance = 5 / this.api.getAppState().cameraZoom;
      const selectedElements = selectByLassoPath(
        this.api,
        simplify(lassoPath, simplifyDistance).map((p) => [p.x, p.y]),
      );

      if (selectedElements.length > 0) {
        this.api.setAppState({
          penbarSelected: Pen.SELECT,
        });
        this.api.selectNodes(
          selectedElements.map((e) => this.api.getNodeByEntity(e)),
        );
        this.api.record();
      }
    }
  }
}
