import type { Plugin, PluginContext } from './interfaces';
import { AABB, RBushNodeAABB } from '../shapes';
import { traverse } from '../utils';

export class Culling implements Plugin {
  #context: PluginContext;
  #viewport: AABB = new AABB();

  apply(context: PluginContext) {
    const { root, hooks, rBushRoot } = context;
    this.#context = context;

    hooks.cameraChange.tap(this.updateViewport.bind(this));
    this.updateViewport();

    hooks.beginFrame.tap(() => {
      const { minX, minY, maxX, maxY } = this.#viewport;

      if (rBushRoot.all().length === 0) {
        const bulk: RBushNodeAABB[] = [];
        traverse(root, (shape) => {
          if (shape.renderable) {
            const bounds = shape.getBounds();
            bulk.push({
              minX: bounds.minX,
              minY: bounds.minY,
              maxX: bounds.maxX,
              maxY: bounds.maxY,
              shape,
            });
          }
        });
        rBushRoot.clear();
        rBushRoot.load(bulk);
      }

      // const timeStart = performance.now();

      traverse(root, (shape) => {
        if (shape.renderable && shape.cullable) {
          const bounds = shape.getBounds();
          shape.culled =
            bounds.minX >= maxX ||
            bounds.minY >= maxY ||
            bounds.maxX <= minX ||
            bounds.maxY <= minY;
        }

        return shape.culled;
      });

      // const timeEllapsed = performance.now() - timeStart;
      // console.log(timeEllapsed);
    });
  }

  private updateViewport() {
    const {
      camera,
      api: { viewport2Canvas },
    } = this.#context;
    const { width, height } = camera;

    // tl, tr, br, bl
    const tl = viewport2Canvas({
      x: 0,
      y: 0,
    });
    const tr = viewport2Canvas({
      x: width,
      y: 0,
    });
    const br = viewport2Canvas({
      x: width,
      y: height,
    });
    const bl = viewport2Canvas({
      x: 0,
      y: height,
    });

    this.#viewport.minX = Math.min(tl.x, tr.x, br.x, bl.x);
    this.#viewport.minY = Math.min(tl.y, tr.y, br.y, bl.y);
    this.#viewport.maxX = Math.max(tl.x, tr.x, br.x, bl.x);
    this.#viewport.maxY = Math.max(tl.y, tr.y, br.y, bl.y);
  }
}
