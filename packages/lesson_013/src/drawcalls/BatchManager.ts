import { Buffer, Device, RenderPass } from '@antv/g-device-api';
import { Drawcall, SDF, ShadowRect, SmoothPolyline } from '.';
import {
  Circle,
  Ellipse,
  Path,
  Polyline,
  Rect,
  RoughCircle,
  RoughEllipse,
  RoughPath,
  RoughPolyline,
  RoughRect,
  type Shape,
} from '../shapes';
import { RenderCache } from '../utils/render-cache';
import { Mesh } from './Mesh';

/**
 * Since a shape may have multiple drawcalls, we need to cache them and maintain an 1-to-many relationship.
 *
 * e.g. we need 2 drawcalls for a Circle with dashed stroke:
 * - A SDF drawcall to draw the fill.
 * - A Path drawcall to draw the dashed stroke.
 *
 * e.g. 3 drawcalls for a Rect with drop shadow.
 */
const SHAPE_DRAWCALL_CTORS = new WeakMap<typeof Shape, (typeof Drawcall)[]>();
SHAPE_DRAWCALL_CTORS.set(Circle, [SDF, SmoothPolyline]);
SHAPE_DRAWCALL_CTORS.set(Ellipse, [SDF, SmoothPolyline]);
SHAPE_DRAWCALL_CTORS.set(Rect, [ShadowRect, SDF, SmoothPolyline]);
SHAPE_DRAWCALL_CTORS.set(Polyline, [SmoothPolyline]);
// SHAPE_DRAWCALL_CTORS.set(Path, [SDFPath]);
SHAPE_DRAWCALL_CTORS.set(Path, [Mesh, SmoothPolyline]);
SHAPE_DRAWCALL_CTORS.set(RoughCircle, [
  Mesh, // fillStyle === 'solid'
  SmoothPolyline, // fill
  SmoothPolyline, // stroke
]);
SHAPE_DRAWCALL_CTORS.set(RoughEllipse, [
  Mesh, // fillStyle === 'solid'
  SmoothPolyline, // fill
  SmoothPolyline, // stroke
]);
SHAPE_DRAWCALL_CTORS.set(RoughRect, [
  ShadowRect,
  Mesh, // fillStyle === 'solid'
  SmoothPolyline, // fill
  SmoothPolyline, // stroke
]);
SHAPE_DRAWCALL_CTORS.set(RoughPolyline, [SmoothPolyline]);
SHAPE_DRAWCALL_CTORS.set(RoughPath, [
  Mesh, // fillStyle === 'solid'
  SmoothPolyline, // fill
  SmoothPolyline, // stroke
]);

export class BatchManager {
  /**
   * Drawcalls to flush in the next frame.
   */
  #drawcallsToFlush: Drawcall[] = [];

  /**
   * Cache drawcalls for non batchable shape.
   */
  #nonBatchableDrawcallsCache: Record<number, Drawcall[]> = Object.create(null);

  #batchableDrawcallsCache: Record<number, Drawcall[]> = Object.create(null);

  #instancesCache = new WeakMap<typeof Shape, Drawcall[][]>();

  #renderCache: RenderCache;

  constructor(private device: Device) {
    this.#renderCache = new RenderCache(device);
  }

  private collectDrawcallCtors(shape: Shape) {
    return SHAPE_DRAWCALL_CTORS.get(shape.constructor as typeof Shape)
      ?.map((DrawcallCtor) => {
        if (
          // @ts-ignore
          !DrawcallCtor.check ||
          // @ts-ignore
          (DrawcallCtor.check && DrawcallCtor.check(shape))
        ) {
          return DrawcallCtor;
        }
      })
      .filter((drawcallCtor) => !!drawcallCtor);
  }

  private createDrawcalls(shape: Shape, instanced = false) {
    return this.collectDrawcallCtors(shape).map((DrawcallCtor, index) => {
      // @ts-ignore
      const drawcall = new DrawcallCtor(
        this.device,
        this.#renderCache,
        instanced,
        index,
      );
      drawcall.add(shape);
      return drawcall;
    });
  }

  private getOrCreateNonBatchableDrawcalls(shape: Shape) {
    let existed = this.#nonBatchableDrawcallsCache[shape.uid];
    if (!existed) {
      existed = this.createDrawcalls(shape) || [];
      this.#nonBatchableDrawcallsCache[shape.uid] = existed;
    }

    return existed;
  }

  private getOrCreateBatchableDrawcalls(shape: Shape) {
    let existed: Drawcall[] | undefined =
      this.#batchableDrawcallsCache[shape.uid];
    if (!existed) {
      const shapeCtor = shape.constructor as typeof Shape;
      let instancedDrawcalls = this.#instancesCache.get(shapeCtor);
      if (!instancedDrawcalls) {
        instancedDrawcalls = [];
      }

      const ctors = this.collectDrawcallCtors(shape);
      existed = instancedDrawcalls.find(
        (drawcalls) =>
          drawcalls.length === ctors.length &&
          drawcalls.every((drawcall) => drawcall.validate(shape)),
      );

      if (!existed) {
        existed = this.createDrawcalls(shape, true) || [];
        instancedDrawcalls.push(existed);
        this.#instancesCache.set(shapeCtor, instancedDrawcalls);
      }

      existed.forEach((drawcall) => {
        drawcall.add(shape);
      });

      this.#batchableDrawcallsCache[shape.uid] = existed;
    }

    return existed;
  }

  add(shape: Shape) {
    if (shape.batchable) {
      const drawcalls = this.getOrCreateBatchableDrawcalls(shape);
      if (this.#drawcallsToFlush.indexOf(drawcalls[0]) === -1) {
        this.#drawcallsToFlush.push(...drawcalls);
      }
    } else {
      this.#drawcallsToFlush.push(
        ...this.getOrCreateNonBatchableDrawcalls(shape),
      );
    }
  }

  /**
   * Called when a shape is:
   * * removed from the scene graph.
   * * culled from viewport.
   * * invisible.
   */
  remove(shape: Shape) {
    if (shape.batchable) {
      this.getOrCreateBatchableDrawcalls(shape).forEach((drawcall) => {
        drawcall.remove(shape);
      });
      delete this.#batchableDrawcallsCache[shape.uid];
    } else {
      delete this.#nonBatchableDrawcallsCache[shape.uid];
    }
  }

  destroy() {
    for (const key in this.#nonBatchableDrawcallsCache) {
      this.#nonBatchableDrawcallsCache[key].forEach((drawcall) => {
        if (!drawcall.destroyed) {
          drawcall.destroy();
        }
      });
    }
    for (const key in this.#batchableDrawcallsCache) {
      this.#batchableDrawcallsCache[key].forEach((drawcall) => {
        if (!drawcall.destroyed) {
          drawcall.destroy();
        }
      });
    }
    this.#renderCache.destroy();
  }

  clear() {
    this.#drawcallsToFlush = [];
  }

  flush(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    uniformLegacyObject: Record<string, unknown>,
  ) {
    const geometryDirtyDrawcalls = [];
    const materialDirtyDrawcalls = [];
    const geometryDirtyShapes = [];
    const materialDirtyShapes = [];
    this.#drawcallsToFlush.forEach((drawcall) => {
      drawcall.shapes.forEach((shape) => {
        if (shape.geometryDirtyFlag) {
          geometryDirtyShapes.push(shape);
          geometryDirtyDrawcalls.push(drawcall);
        }
        if (shape.materialDirtyFlag) {
          materialDirtyShapes.push(shape);
          materialDirtyDrawcalls.push(drawcall);
        }
      });
    });

    geometryDirtyDrawcalls.forEach(
      (drawcall) => (drawcall.geometryDirty = true),
    );
    materialDirtyDrawcalls.forEach(
      (drawcall) => (drawcall.materialDirty = true),
    );
    geometryDirtyShapes.forEach((shape) => {
      if (shape.geometryDirtyFlag) {
        shape.preCreateGeometry?.();
        shape.geometryDirtyFlag = false;
      }
    });
    materialDirtyShapes.forEach((shape) => (shape.materialDirtyFlag = false));
    this.#drawcallsToFlush.forEach((drawcall) => {
      drawcall.submit(renderPass, uniformBuffer, uniformLegacyObject);
    });
  }

  stats() {
    return {
      drawcallCount: this.#drawcallsToFlush.length,
    };
  }
}
