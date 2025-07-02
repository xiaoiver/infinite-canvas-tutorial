import { Buffer, Device, RenderPass } from '@antv/g-device-api';
import { Entity } from '@lastolivegames/becsy';
import {
  Drawcall,
  SDF,
  ShadowRect,
  SmoothPolyline,
  Mesh,
  SDFText,
  // Custom as CustomDrawcall,
} from '../drawcalls';
import {
  Circle,
  Ellipse,
  Path,
  Polyline,
  Rect,
  Renderable,
  Rough,
  Text,
} from '../components';
import { TexturePool } from '../resources';
import { RenderCache } from '../utils';
import { sortByFractionalIndex } from './Sort';

/**
 * Since a shape may have multiple drawcalls, we need to cache them and maintain an 1-to-many relationship.
 *
 * e.g. we need 2 drawcalls for a Circle with dashed stroke:
 * - A SDF drawcall to draw the fill.
 * - A Path drawcall to draw the dashed stroke.
 *
 * e.g. 3 drawcalls for a Rect with drop shadow.
 */
function getDrawcallCtors(shape: Entity) {
  const SHAPE_DRAWCALL_CTORS: (typeof Drawcall)[] = [];
  if (shape.has(Circle) || shape.has(Ellipse)) {
    if (shape.has(Rough)) {
      SHAPE_DRAWCALL_CTORS.push(Mesh, SmoothPolyline, SmoothPolyline);
    } else {
      SHAPE_DRAWCALL_CTORS.push(SDF, SmoothPolyline);
    }
  } else if (shape.has(Rect)) {
    if (shape.has(Rough)) {
      SHAPE_DRAWCALL_CTORS.push(
        ShadowRect,
        Mesh,
        SmoothPolyline,
        SmoothPolyline,
      );
    } else {
      SHAPE_DRAWCALL_CTORS.push(ShadowRect, SDF, SmoothPolyline);
    }
  } else if (shape.has(Polyline)) {
    SHAPE_DRAWCALL_CTORS.push(SmoothPolyline);
  } else if (shape.has(Path)) {
    if (shape.has(Rough)) {
      SHAPE_DRAWCALL_CTORS.push(Mesh, SmoothPolyline, SmoothPolyline);
    } else {
      SHAPE_DRAWCALL_CTORS.push(Mesh, SmoothPolyline);
    }
  } else if (shape.has(Text)) {
    SHAPE_DRAWCALL_CTORS.push(SDFText);
  }
  return SHAPE_DRAWCALL_CTORS;
}
// SHAPE_DRAWCALL_CTORS.set(Custom, [CustomDrawcall]);

export class BatchManager {
  /**
   * Drawcalls to flush in the next frame.
   */
  #drawcallsToFlush: Drawcall[] = [];

  /**
   * Cache drawcalls for non batchable shape.
   */
  #nonBatchableDrawcallsCache: WeakMap<Entity, Drawcall[]> = new WeakMap();

  #batchableDrawcallsCache: WeakMap<Entity, Drawcall[]> = new WeakMap();

  #instancesCache: Record<
    | 'circle'
    | 'ellipse'
    | 'rect'
    | 'polyline'
    | 'path'
    | 'text'
    | 'rough-circle'
    | 'rough-ellipse'
    | 'rough-rect'
    | 'rough-polyline'
    | 'rough-path'
    | 'text',
    Drawcall[][]
  > = Object.create(null);

  constructor(
    private readonly device: Device,
    private readonly renderCache: RenderCache,
    private readonly texturePool: TexturePool,
  ) {}

  private collectDrawcallCtors(shape: Entity) {
    return getDrawcallCtors(shape)
      .map((DrawcallCtor) => {
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

  private createDrawcalls(shape: Entity, instanced = false) {
    return this.collectDrawcallCtors(shape).map((DrawcallCtor, index) => {
      // @ts-ignore
      const drawcall = new DrawcallCtor(
        this.device,
        this.renderCache,
        this.texturePool,
        instanced,
        index,
      ) as Drawcall;
      drawcall.add(shape);
      return drawcall;
    });
  }

  private getOrCreateNonBatchableDrawcalls(shape: Entity) {
    let existed = this.#nonBatchableDrawcallsCache.get(shape);
    if (!existed) {
      existed = this.createDrawcalls(shape) || [];
      this.#nonBatchableDrawcallsCache.set(shape, existed);
    }

    return existed;
  }

  private getOrCreateBatchableDrawcalls(shape: Entity) {
    let existed: Drawcall[] | undefined =
      this.#batchableDrawcallsCache.get(shape);
    if (!existed) {
      const geometryCtor = shape.has(Circle)
        ? shape.has(Rough)
          ? 'rough-circle'
          : 'circle'
        : shape.has(Ellipse)
        ? shape.has(Rough)
          ? 'rough-ellipse'
          : 'ellipse'
        : shape.has(Rect)
        ? shape.has(Rough)
          ? 'rough-rect'
          : 'rect'
        : shape.has(Polyline)
        ? shape.has(Rough)
          ? 'rough-polyline'
          : 'polyline'
        : shape.has(Path)
        ? shape.has(Rough)
          ? 'rough-path'
          : 'path'
        : shape.has(Text)
        ? 'text'
        : undefined;

      let instancedDrawcalls = this.#instancesCache[geometryCtor];
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
        this.#instancesCache[geometryCtor] = instancedDrawcalls;
      }

      existed.forEach((drawcall) => {
        drawcall.add(shape);
      });

      this.#batchableDrawcallsCache.set(shape, existed);
    }

    return existed;
  }

  add(shape: Entity) {
    let drawcalls: Drawcall[];
    if (shape.read(Renderable).batchable) {
      drawcalls = this.getOrCreateBatchableDrawcalls(shape);
    } else {
      drawcalls = this.getOrCreateNonBatchableDrawcalls(shape);
    }
    if (this.#drawcallsToFlush.indexOf(drawcalls[0]) === -1) {
      this.#drawcallsToFlush.push(...drawcalls);
    }
  }

  /**
   * Called when a shape is:
   * * removed from the scene graph.
   * * culled from viewport.
   * * invisible.
   */
  remove(shape: Entity) {
    if (shape.read(Renderable).batchable) {
      this.getOrCreateBatchableDrawcalls(shape).forEach((drawcall) => {
        drawcall.remove(shape);
      });
      this.#batchableDrawcallsCache.delete(shape);
    } else {
      this.#nonBatchableDrawcallsCache.get(shape)?.forEach((drawcall) => {
        this.#drawcallsToFlush.splice(
          this.#drawcallsToFlush.indexOf(drawcall),
          1,
        );
      });
      this.#nonBatchableDrawcallsCache.delete(shape);
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
  }

  clear() {
    this.#drawcallsToFlush = [];
  }

  sort() {
    this.#drawcallsToFlush.sort((a, b) => {
      const aShape = a.shapes[0];
      const bShape = b.shapes[0];
      return sortByFractionalIndex(aShape, bShape);
    });
  }

  flush(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    uniformLegacyObject: Record<string, unknown>,
  ) {
    const geometryDirtyDrawcalls: Drawcall[] = [];
    const materialDirtyDrawcalls: Drawcall[] = [];
    const geometryDirtyShapes: Entity[] = [];
    const materialDirtyShapes: Entity[] = [];
    this.#drawcallsToFlush.forEach((drawcall) => {
      drawcall.shapes.forEach((shape) => {
        // if (shape.geometryDirtyFlag) {
        geometryDirtyShapes.push(shape);
        geometryDirtyDrawcalls.push(drawcall);
        // }
        // if (shape.materialDirtyFlag) {
        materialDirtyShapes.push(shape);
        materialDirtyDrawcalls.push(drawcall);
        // }
      });
    });

    geometryDirtyDrawcalls.forEach(
      (drawcall) => (drawcall.geometryDirty = true),
    );
    materialDirtyDrawcalls.forEach(
      (drawcall) => (drawcall.materialDirty = true),
    );
    // geometryDirtyShapes.forEach((shape) => {
    //   if (shape.geometryDirtyFlag) {
    //     shape.preCreateGeometry?.();
    //     shape.geometryDirtyFlag = false;
    //   }
    // });
    // materialDirtyShapes.forEach((shape) => (shape.materialDirtyFlag = false));
    this.#drawcallsToFlush.forEach((drawcall) => {
      drawcall.submit(renderPass, uniformBuffer, uniformLegacyObject);
    });

    // console.log('flush', this.#drawcallsToFlush);
  }

  stats() {
    return {
      drawcallCount: this.#drawcallsToFlush.length,
    };
  }
}
