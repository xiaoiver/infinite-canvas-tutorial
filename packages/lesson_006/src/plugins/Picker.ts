import { Point } from '@pixi/math';
import { Group, Shape } from '../shapes';
import type { PickingResult, Plugin, PluginContext } from './interfaces';
import { traverse } from '../utils';

const tempLocalPosition = new Point();

export class Picker implements Plugin {
  apply(context: PluginContext) {
    const { hooks, root } = context;

    hooks.pickSync.tap((result: PickingResult) => {
      return this.pick(result, root);
    });
  }

  private pick(result: PickingResult, root: Group) {
    const {
      position: { x, y },
    } = result;

    const picked: Shape[] = [];
    traverse(root, (shape: Shape) => {
      if (this.hitTest(shape, x, y)) {
        picked.unshift(shape);
      }
    });

    result.picked = picked;
    return result;
  }

  private hitTest(shape: Shape, wx: number, wy: number): boolean {
    // if (!shape.getBounds().containsPoint(x, y)) {
    //   return false;
    // }

    if (shape.pointerEvents === 'none') {
      return false;
    }

    if (shape.hitArea || shape.renderable) {
      shape.worldTransform.applyInverse({ x: wx, y: wy }, tempLocalPosition);
      const { x, y } = tempLocalPosition;

      if (shape.hitArea) {
        return shape.hitArea.contains(x, y);
      }

      return shape.containsPoint(x, y);
    }

    return false;
  }
}
