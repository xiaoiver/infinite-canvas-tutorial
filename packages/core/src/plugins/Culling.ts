import type { Plugin, PluginContext } from './interfaces';
import { AABB, RBushNodeAABB, type Shape } from '../shapes';

export class Culling implements Plugin {
  #context: PluginContext;
  #viewport = new AABB();
  #indexed = new WeakMap<Shape, RBushNodeAABB>();

  apply(context: PluginContext) {
    const { hooks, rBushRoot } = context;
    this.#context = context;

    hooks.cameraChange.tap(this.updateViewport.bind(this));
    this.updateViewport();

    hooks.beginFrame.tap(({ all, removed, modified }) => {
      const { minX, minY, maxX, maxY } = this.#viewport;

      /**
       * Traverse the scene graph and collect all renderable shapes
       */

      [...removed, ...modified].forEach((shape) => {
        const indexed = this.#indexed.get(shape);
        if (indexed) rBushRoot.remove(indexed);
        this.#indexed.delete(shape);
      });

      const bulk: RBushNodeAABB[] = [];
      modified.forEach((shape) => {
        if (shape.renderable) {
          const bounds = shape.getBounds();
          const indexed: RBushNodeAABB = {
            minX: bounds.minX,
            minY: bounds.minY,
            maxX: bounds.maxX,
            maxY: bounds.maxY,
            shape,
          };
          this.#indexed.set(shape, indexed);
          bulk.push(indexed);
        }
      });
      rBushRoot.load(bulk);

      const shapesInViewport = rBushRoot
        .search({ minX, minY, maxX, maxY })
        .map((bush) => bush.shape);
      all.forEach((shape) => {
        if (shape.renderable && shape.cullable) {
          shape.culled = !shapesInViewport.includes(shape);
        }
      });
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
