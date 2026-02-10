/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/lasso/index.ts
 */

import { v4 as uuidv4 } from 'uuid';
import {
  API,
  isBrowser,
  PathSerializedNode,
  Pen,
  TesselationMethod,
  TRANSFORMER_ANCHOR_STROKE_COLOR,
  TRANSFORMER_MASK_FILL_COLOR,
  updateComputedPoints,
  updateGlobalTransform,
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
  private points: [number, number][];

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

  startPath(x: number, y: number, keepPreviousSelection = false) {
    // clear any existing trails just in case
    this.endPath();

    super.startPath(x, y);
  }

  addPointToPath = (x: number, y: number, keepPreviousSelection = false) => {
    super.addPointToPath(x, y);
    this.updateSelection();
  };

  endPath(): void {
    this.points = [];

    super.endPath();
    super.clearTrails();

    const { mode, stroke, fill, fillOpacity, strokeWidth, strokeOpacity } = this.api.getAppState().penbarLasso;

    if (mode === 'draw' && this.points?.length > 0) {
      if (isBrowser) {
        const node: PathSerializedNode = {
          id: uuidv4(),
          type: 'path',
          version: 0,
          d: `M${this.points[0][0]},${this.points[0][1]}L${this.points.slice(1).map((p) => `${p[0]},${p[1]}`).join(' ')}Z`,
          fill,
          fillOpacity,
          stroke,
          strokeWidth,
          strokeOpacity,
          tessellationMethod: TesselationMethod.LIBTESS,
        };
        this.api.setAppState({
          penbarSelected: Pen.SELECT,
        });
        this.api.updateNode(node);
        this.api.selectNodes([node]);
        this.api.record();

        const entity = this.api.getEntity(node);
        if (entity) {
          updateGlobalTransform(entity);
          updateComputedPoints(entity);
        }
        // FIXME: Use the correct event name
        // @ts-ignore
        this.api.element.dispatchEvent(
          new CustomEvent('ic-rect-drawn', {
            detail: {
              node,
            },
          }),
        );
      }
    }
  }

  private updateSelection() {
    const lassoPath = super
      .getCurrentTrail()
      ?.originalPoints?.map((p) =>
        this.api.viewport2Canvas({ x: p[0], y: p[1] }),
      );

    if (lassoPath) {
      const simplifyDistance = 5 / this.api.getAppState().cameraZoom;
      const points = simplify(lassoPath, simplifyDistance).map((p) => [p.x, p.y]) as [number, number][];
      this.points = points;

      if (this.api.getAppState().penbarLasso.mode === 'draw') {

      } else {
        const selectedElements = selectByLassoPath(
          this.api,
          points,
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
}
