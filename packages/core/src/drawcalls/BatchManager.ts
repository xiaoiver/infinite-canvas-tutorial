import { TextBatch } from './TextBatch';
import { TEXT_BATCH_GLYPHS } from '../utils/text-batching';
import { Buffer, Device, RenderPass } from '@antv/g-device-api';
import {
  Drawcall,
  SDF,
  ShadowRect,
  SmoothPolyline,
  Custom as CustomDrawcall,
} from '.';
import {
  Circle,
  Custom,
  Ellipse,
  Path,
  Polyline,
  Rect,
  RoughCircle,
  RoughEllipse,
  RoughPath,
  RoughPolyline,
  RoughRect,
  Text,
  type Shape,
} from '../shapes';
import { RenderCache } from '../utils/render-cache';
import { Mesh } from './Mesh';
import { SDFText } from './SDFText';
import { TexturePool } from '../TexturePool';
import { PathInstances, PATH_INSTANCE_PAGE_SIZE } from './PathInstances';
import { StrokeBatch } from './StrokeBatch';
import { ImageBatch } from './ImageBatch';
import { cacheImageTokens, coreImageToken } from '../utils/image-batching';

type OrderedPage = {
  key: string;
  drawcalls: Drawcall[];
  shapes: Shape[];
  batchable: boolean;
  glyphs: number;
};

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
SHAPE_DRAWCALL_CTORS.set(Text, [SmoothPolyline, SDFText]); // underline
SHAPE_DRAWCALL_CTORS.set(Custom, [CustomDrawcall]);

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

  #ordered = false;
  #allowTextBatches = false;
  #allowImageBatches = false;
  #allowPathInstances = false;
  #frameShapes: Shape[] = [];
  #orderedPages: OrderedPage[] = [];
  #orderedInputShapes: Shape[] = [];
  #orderedPlanDirty = true;
  #ctorIds = new WeakMap<typeof Drawcall, number>();
  #nextCtorId = 0;

  #renderCache: RenderCache;

  #texturePool: TexturePool;

  constructor(private device: Device) {
    this.#renderCache = new RenderCache(device);
    this.#texturePool = new TexturePool();
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
        this.#texturePool,
        instanced,
        index,
      );
      drawcall.add(shape);
      return drawcall;
    });
  }

  private getOrCreateNonBatchableDrawcalls(shape: Shape) {
    let existed = this.#nonBatchableDrawcallsCache[shape.uid];
    if (existed && shape instanceof Path) {
      const ctors = this.collectDrawcallCtors(shape);
      if (
        existed.length !== ctors.length ||
        existed.some((d, i) => d.constructor !== ctors[i])
      ) {
        existed.forEach((d) => d.destroy());
        existed = undefined;
      }
    }
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
    if (this.#ordered) {
      this.#frameShapes.push(shape);
      return;
    }
    if (
      shape.batchable &&
      !(shape instanceof Path) &&
      !(shape instanceof Text)
    ) {
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
    if (this.#ordered) {
      this.#frameShapes = this.#frameShapes.filter((s) => s !== shape);
      this.#orderedPlanDirty = true;
      return;
    }
    if (
      shape.batchable &&
      !(shape instanceof Path) &&
      !(shape instanceof Text)
    ) {
      this.getOrCreateBatchableDrawcalls(shape).forEach((drawcall) => {
        drawcall.remove(shape);
      });
      delete this.#batchableDrawcallsCache[shape.uid];
    } else {
      // Every non-batched drawcall belongs exclusively to this shape.
      this.#nonBatchableDrawcallsCache[shape.uid]?.forEach((d) => d.destroy());
      delete this.#nonBatchableDrawcallsCache[shape.uid];
    }
  }

  destroy() {
    this.#orderedPages.forEach((page) =>
      page.drawcalls.forEach((d) => d.destroy()),
    );
    this.#orderedPages = [];
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
    this.#texturePool.destroy();
  }

  clear(
    ordered = false,
    allowPathInstances = ordered,
    allowTextBatches = false,
    allowImageBatches = false,
  ) {
    if (this.#ordered !== ordered) {
      // Changing planning modes must not retain unreachable batch resources.
      const unique = new Set<Drawcall>([
        ...Object.values(this.#nonBatchableDrawcallsCache).flat(),
        ...Object.values(this.#batchableDrawcallsCache).flat(),
        ...this.#orderedPages.flatMap((p) => p.drawcalls),
      ]);
      unique.forEach((d) => {
        if (!d.destroyed) d.destroy();
      });
      this.#nonBatchableDrawcallsCache = Object.create(null);
      this.#batchableDrawcallsCache = Object.create(null);
      this.#instancesCache = new WeakMap();
      this.#orderedPages = [];
      this.#orderedInputShapes = [];
      this.#orderedPlanDirty = true;
    }
    if (this.#allowTextBatches !== allowTextBatches)
      this.#orderedPlanDirty = true;
    this.#allowTextBatches = allowTextBatches;
    if (this.#allowImageBatches !== allowImageBatches)
      this.#orderedPlanDirty = true;
    this.#allowImageBatches = allowImageBatches;
    if (this.#allowPathInstances !== allowPathInstances)
      this.#orderedPlanDirty = true;
    this.#ordered = ordered;
    this.#allowPathInstances = allowPathInstances;
    this.#frameShapes = [];
    this.#drawcallsToFlush = [];
  }

  private planOrdered() {
    // A camera-only frame can change adaptive precision, but not compatibility.
    // Drawcall.prepareGeometry still runs below. Dirty shapes, visible membership
    // and capture intent invalidate this plan before any renderer is submitted.
    if (
      !this.#orderedPlanDirty &&
      this.#frameShapes.length === this.#orderedInputShapes.length &&
      this.#frameShapes.every(
        (shape, i) =>
          shape === this.#orderedInputShapes[i] &&
          !shape.renderDirtyFlag &&
          !shape.geometryDirtyFlag &&
          !shape.materialDirtyFlag,
      )
    ) {
      this.#drawcallsToFlush = this.#orderedPages.flatMap((p) => p.drawcalls);
      return;
    }
    const pools = new Map<string, { pages: OrderedPage[]; cursor: number }>();
    for (const page of this.#orderedPages) {
      const pool = pools.get(page.key) ?? { pages: [], cursor: 0 };
      pool.pages.push(page);
      pools.set(page.key, pool);
    }
    const usedPages = new Set<OrderedPage>();
    const textPages = new Map<Shape, OrderedPage>();
    for (const page of this.#orderedPages)
      if (page.drawcalls[0] instanceof TextBatch)
        textPages.set(page.shapes[0], page);
    const take = (
      pool: { pages: OrderedPage[]; cursor: number } | undefined,
    ) => {
      let page: OrderedPage | undefined;
      while (pool && pool.cursor < pool.pages.length) {
        const candidate = pool.pages[pool.cursor++];
        if (!usedPages.has(candidate)) {
          page = candidate;
          usedPages.add(candidate);
          break;
        }
      }
      return page;
    };
    // Compatibility may inspect a member again after accepting it. Resolve its
    // raster token once in this plan; a later plan must see current paint.
    const imageToken = this.#allowImageBatches
      ? cacheImageTokens(coreImageToken)
      : undefined;
    const next: OrderedPage[] = [];
    for (const shape of this.#frameShapes) {
      const textKey =
        this.#allowTextBatches && shape.constructor === Text
          ? TextBatch.batchKey(shape)
          : null;
      const pathKey =
        this.#allowPathInstances && shape.constructor === Path
          ? PathInstances.batchKey(shape)
          : null;
      const imageKey = this.#allowImageBatches
        ? ImageBatch.batchKey(shape)
        : null;
      const strokeKey =
        this.#allowPathInstances &&
        shape.constructor === Path &&
        pathKey === null
          ? StrokeBatch.batchKey(shape)
          : null;
      const ctors =
        imageKey !== null
          ? [ImageBatch]
          : strokeKey !== null
          ? [StrokeBatch]
          : textKey !== null
          ? [TextBatch]
          : pathKey === null
          ? this.collectDrawcallCtors(shape)
          : [PathInstances];
      if (!ctors?.length) continue;
      // Unsupported Paths remain individual full meshes, even if batchable was
      // explicitly requested. Mesh's ordinary shader has no instance attributes.
      const batchable =
        shape.batchable &&
        !(shape instanceof Path && pathKey === null && strokeKey === null) &&
        !(shape instanceof Text && textKey === null);
      const ctorKey = ctors
        .map((ctor) => {
          if (!this.#ctorIds.has(ctor))
            this.#ctorIds.set(ctor, this.#nextCtorId++);
          return this.#ctorIds.get(ctor);
        })
        .join(',');
      const key =
        imageKey !== null
          ? `image:${imageKey}`
          : strokeKey !== null
          ? `stroke:${strokeKey}`
          : textKey !== null
          ? `text:${textKey}`
          : pathKey === null
          ? `${ctorKey}:${batchable ? 'batch' : shape.uid}`
          : `path:${pathKey}`;
      let page = next[next.length - 1];
      const compatible =
        page?.key === key &&
        page.batchable &&
        (!page.key.startsWith('path:') ||
          page.shapes.length < PATH_INSTANCE_PAGE_SIZE) &&
        (textKey === null ||
          page.glyphs + TextBatch.glyphCount(shape) <= TEXT_BATCH_GLYPHS) &&
        page.drawcalls.every((d) => {
          if (textKey !== null) return true; // Exact material key checked above; budget is per page.
          // imageKey already checked eligibility. Only page limits remain.
          if (imageKey !== null)
            return ImageBatch.canAppend(page.shapes, shape, imageToken);
          const previous = d.shapes;
          d.shapes = page.shapes;
          try {
            return d.validate(shape);
          } finally {
            d.shapes = previous;
          }
        });
      if (!compatible) {
        const pool = pathKey === null ? pools.get(key) : undefined;
        let reused = take(pool);
        if (!reused && textKey !== null) {
          const candidate = textPages.get(shape);
          if (candidate && !usedPages.has(candidate)) {
            reused = candidate;
            usedPages.add(candidate);
          }
        }
        if (reused && reused.key !== key)
          reused.drawcalls.forEach((d) => (d.materialDirty = true));
        page = {
          key,
          batchable,
          shapes: [],
          glyphs: 0,
          drawcalls:
            pathKey !== null
              ? []
              : reused?.drawcalls ??
                ctors.map((Ctor, index) => {
                  // Constructors share this signature; concrete subclasses implement the abstract API.
                  // @ts-expect-error - Drawcall is abstract.
                  return new Ctor(
                    this.device,
                    this.#renderCache,
                    this.#texturePool,
                    batchable,
                    index,
                  );
                }),
        };
        next.push(page);
      }
      page.shapes.push(shape);
      if (textKey !== null) page.glyphs += TextBatch.glyphCount(shape);
    }
    for (const page of next) {
      if (page.key.startsWith('path:')) {
        const instanced = page.shapes.length > 1;
        if (!instanced) page.key = `single:${page.shapes[0].uid}:${page.key}`;
        page.batchable = instanced;
        const pool = pools.get(page.key);
        const reused = take(pool);
        const Ctor = instanced ? PathInstances : Mesh;
        page.drawcalls = reused?.drawcalls ?? [
          new Ctor(
            this.device,
            this.#renderCache,
            this.#texturePool,
            instanced,
            0,
          ),
        ];
      }
      for (const d of page.drawcalls) {
        if (
          d.shapes.length !== page.shapes.length ||
          page.shapes.some((s, i) => s !== d.shapes[i])
        ) {
          d.geometryDirty = true;
          // All page-local paint/binding state belongs to the current first member.
          if (d.shapes[0] !== page.shapes[0]) d.materialDirty = true;
        }
        d.shapes = page.shapes;
        this.#drawcallsToFlush.push(d);
      }
    }
    for (const page of this.#orderedPages)
      if (!usedPages.has(page)) page.drawcalls.forEach((d) => d.destroy());
    this.#orderedPages = next;
    this.#orderedInputShapes = this.#frameShapes;
    this.#orderedPlanDirty = false;
  }

  flush(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    uniformLegacyObject: Record<string, unknown>,
  ) {
    if (this.#ordered) this.planOrdered();
    const geometryDirtyDrawcalls = [];
    const materialDirtyDrawcalls = [];
    const geometryDirtyShapes = [];
    const materialDirtyShapes = [];
    this.#drawcallsToFlush.forEach((drawcall) => {
      drawcall.shapes.forEach((shape) => {
        if (shape.geometryDirtyFlag) {
          geometryDirtyShapes.push(shape);
          if (drawcall.canUpdateGeometryRows) shape.renderDirtyFlag = true;
          else geometryDirtyDrawcalls.push(drawcall);
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
