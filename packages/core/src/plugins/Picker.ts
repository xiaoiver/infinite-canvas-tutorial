import { Point } from '@pixi/math';
import type { Shape } from '../shapes';
import type { PickingResult, Plugin, PluginContext } from './interfaces';
import { DOMAdapter } from '../environment/adapter';

const tempLocalPosition = new Point();

export class Picker implements Plugin {
  #ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

  apply(context: PluginContext) {
    const {
      hooks,
      root,
      api: { elementsFromBBox },
    } = context;

    const canvas = DOMAdapter.get().createCanvas(1, 1);
    if (canvas) {
      this.#ctx = canvas.getContext('2d') as
        | OffscreenCanvasRenderingContext2D
        | CanvasRenderingContext2D;
    }

    hooks.pickSync.tap((result: PickingResult) => {
      const {
        position: { x, y },
      } = result;

      const picked: Shape[] = [root];
      elementsFromBBox(x, y, x, y).forEach((shape) => {
        if (this.hitTest(shape, x, y)) {
          picked.unshift(shape);
        }
      });
      result.picked = picked;
      return result;
    });
  }

  private hitTest(shape: Shape, wx: number, wy: number): boolean {
    if (shape.hitArea || shape.renderable) {
      shape.worldTransform.applyInverse({ x: wx, y: wy }, tempLocalPosition);
      const { x, y } = tempLocalPosition;

      if (shape.hitArea) {
        return shape.hitArea.contains(x, y);
      }

      return shape.containsPoint(x, y, this.#ctx);
    }

    return false;
  }
}
