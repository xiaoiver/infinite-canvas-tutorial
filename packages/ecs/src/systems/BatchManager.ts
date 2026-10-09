import {
  Buffer,
  Device,
  RenderPass,
  SwapChain,
  TransparentBlack,
} from '@infinite-canvas-tutorial/device-api';
import {
  RGAttachmentSlot,
  type RGGraphBuilder,
} from '../render-graph/interface';
import {
  AntialiasingMode,
  makeAttachmentClearDescriptor,
  makeLayerBlendSrcColorDesc,
} from '../render-graph/utils';
import { Entity } from '@lastolivegames/becsy';
import {
  Drawcall,
  SDF,
  ShadowRect,
  SmoothPolyline,
  Mesh,
  SDFText,
  StampBrush,
  // Custom as CustomDrawcall,
} from '../drawcalls';
import {
  Brush,
  Circle,
  Ellipse,
  GeometryDirty,
  Line,
  MaterialDirty,
  Opacity,
  Path,
  Polyline,
  Rect,
  Renderable,
  Rough,
  Text,
  UI,
  VectorNetwork,
} from '../components';
import { TexturePool } from '../resources';
import { RenderCache } from '../utils';
import { sortByFractionalIndex } from './Sort';
import { safeRemoveComponent } from '../history';
import { API } from '../API';
import {
  getNodeLayerBlendMode,
  isNonNormalNodeLayerBlend,
} from '../utils/nodeLayerBlend';
import { NodeLayerBlendCompositor } from '../utils/nodeLayerBlendGpu';
import { shouldSuppress2DShapeRender } from '../utils/extrude3d';

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
  if (shouldSuppress2DShapeRender(shape)) {
    return [];
  }
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
  } else if (shape.has(Line)) {
    SHAPE_DRAWCALL_CTORS.push(SmoothPolyline);
  } else if (shape.has(Polyline)) {
    SHAPE_DRAWCALL_CTORS.push(SmoothPolyline);
  } else if (shape.has(Path)) {
    if (shape.has(Rough)) {
      SHAPE_DRAWCALL_CTORS.push(Mesh, SmoothPolyline, SmoothPolyline);
    } else {
      SHAPE_DRAWCALL_CTORS.push(Mesh, SmoothPolyline);
    }
  } else if (shape.has(Text)) {
    SHAPE_DRAWCALL_CTORS.push(SmoothPolyline, SDFText);
  } else if (shape.has(Brush)) {
    SHAPE_DRAWCALL_CTORS.push(StampBrush);
  } else if (shape.has(VectorNetwork)) {
    SHAPE_DRAWCALL_CTORS.push(Mesh, SmoothPolyline);
  }
  return SHAPE_DRAWCALL_CTORS;
}
// SHAPE_DRAWCALL_CTORS.set(Custom, [CustomDrawcall]);

export type BatchFlushSegment =
  | { type: 'normal'; drawcalls: Drawcall[] }
  | { type: 'layerBlend'; drawcall: Drawcall; drawcalls: Drawcall[] };

export class BatchManager {
  /**
   * Drawcalls to flush in the next frame.
   */
  #drawcallsToFlush: Drawcall[] = [];
  // WeakMap caches cannot be enumerated during teardown.
  #ownedDrawcalls = new Set<Drawcall>();
  #blendCompositor?: NodeLayerBlendCompositor;

  /**
   * Cache drawcalls for non batchable shape.
   */
  #nonBatchableDrawcallsCache: WeakMap<Entity, Drawcall[]> = new WeakMap();

  #batchableDrawcallsCache: WeakMap<Entity, Drawcall[]> = new WeakMap();

  #instancesCache: Record<
    | 'circle'
    | 'ellipse'
    | 'rect'
    | 'line'
    | 'polyline'
    | 'path'
    | 'text'
    | 'rough-circle'
    | 'rough-ellipse'
    | 'rough-rect'
    | 'rough-line'
    | 'rough-polyline'
    | 'rough-path'
    | 'vector-network'
    | 'text',
    Drawcall[][]
  > = Object.create(null);

  constructor(
    private readonly device: Device,
    private readonly swapChain: SwapChain,
    private readonly renderCache: RenderCache,
    private readonly texturePool: TexturePool,
    private readonly api: API,
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
        this.swapChain,
        this.renderCache,
        this.texturePool,
        instanced,
        index,
        this.api,
      ) as Drawcall;
      this.#ownedDrawcalls.add(drawcall);
      drawcall.add(shape);
      return drawcall;
    });
  }

  private getOrCreateNonBatchableDrawcalls(shape: Entity) {
    let existed = this.#nonBatchableDrawcallsCache.get(shape);
    const desiredCtors = this.collectDrawcallCtors(shape);
    if (existed) {
      const ctorMismatch =
        existed.length !== desiredCtors.length ||
        existed.some((d, i) => d.constructor !== desiredCtors[i]);
      if (ctorMismatch) {
        this.remove(shape);
        existed = undefined;
      } else {
        return existed;
      }
    }
    existed = this.createDrawcalls(shape);
    this.#nonBatchableDrawcallsCache.set(shape, existed);
    return existed;
  }

  private getOrCreateBatchableDrawcalls(shape: Entity) {
    let existed: Drawcall[] | undefined =
      this.#batchableDrawcallsCache.get(shape);
    const desiredCtors = this.collectDrawcallCtors(shape);
    if (existed) {
      const ctorMismatch =
        existed.length !== desiredCtors.length ||
        existed.some((d, i) => d.constructor !== desiredCtors[i]);
      if (ctorMismatch) {
        this.remove(shape);
        existed = undefined;
      } else {
        return existed;
      }
    }
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
        : shape.has(Line)
        ? shape.has(Rough)
          ? 'rough-line'
          : 'line'
        : shape.has(Path)
        ? shape.has(Rough)
          ? 'rough-path'
          : 'path'
        : shape.has(Text)
        ? 'text'
        : shape.has(VectorNetwork)
        ? 'vector-network'
        : shape.has(Brush)
        ? 'brush'
        : undefined;

      let instancedDrawcalls = this.#instancesCache[geometryCtor];
      if (!instancedDrawcalls) {
        instancedDrawcalls = [];
      }

      const ctors = this.collectDrawcallCtors(shape);
      existed = instancedDrawcalls.find(
        (drawcalls) =>
          drawcalls.length === ctors.length &&
          drawcalls.every(
            (drawcall, i) =>
              drawcall.constructor === ctors[i] && drawcall.validate(shape),
          ),
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

  add(shape: Entity, drawcalls?: Drawcall[]) {
    if (shouldSuppress2DShapeRender(shape)) {
      return;
    }
    if (!drawcalls) {
      const batchable = shape.read(Renderable).batchable &&
        !isNonNormalNodeLayerBlend(getNodeLayerBlendMode(this.api, shape));
      const changedBatching = batchable
        ? this.#nonBatchableDrawcallsCache.has(shape)
        : this.#batchableDrawcallsCache.has(shape);
      if (changedBatching) this.remove(shape);
      if (batchable) {
        drawcalls = this.getOrCreateBatchableDrawcalls(shape);
      } else {
        drawcalls = this.getOrCreateNonBatchableDrawcalls(shape);
      }
    }
    if (!drawcalls.length) {
      return;
    }
    for (const drawcall of drawcalls) {
      if (
        !this.#drawcallsToFlush.includes(drawcall) &&
        !this.#hidedUIs.includes(drawcall)
      ) {
        this.#drawcallsToFlush.push(drawcall);
      }
    }
  }

  #removeFromFrame(drawcall: Drawcall) {
    for (const queue of [this.#drawcallsToFlush, this.#hidedUIs]) {
      const index = queue.indexOf(drawcall);
      if (index !== -1) queue.splice(index, 1);
    }
  }

  /**
   * Called when a shape is:
   * * removed from the scene graph.
   * * culled from viewport.
   * * invisible.
   */
  remove(shape: Entity, destroy = true) {
    if (this.#batchableDrawcallsCache.has(shape)) {
      this.#batchableDrawcallsCache.get(shape)!.forEach((drawcall) => {
        drawcall.remove(shape);
        if (drawcall.shapes.length === 0) {
          this.#removeFromFrame(drawcall);
        }
      });
      this.#batchableDrawcallsCache.delete(shape);
    }
    this.#nonBatchableDrawcallsCache.get(shape)?.forEach((drawcall) => {
      if (destroy) {
        drawcall.destroy();
        this.#ownedDrawcalls.delete(drawcall);
      }

      this.#removeFromFrame(drawcall);
    });

    if (destroy) {
      this.#nonBatchableDrawcallsCache.delete(shape);
    }
  }

  #hidedUIs: Drawcall[] = [];
  hideUIs() {
    [...this.#drawcallsToFlush].forEach((drawcall) => {
      if (drawcall.shapes.some((shape) => shape.has(UI))) {
        this.#drawcallsToFlush.splice(
          this.#drawcallsToFlush.indexOf(drawcall),
          1,
        );
        this.#hidedUIs.push(drawcall);
      }
    });
  }

  showUIs() {
    this.#hidedUIs.forEach((drawcall) => {
      if (
        !drawcall.destroyed &&
        drawcall.shapes.length > 0 &&
        !this.#drawcallsToFlush.includes(drawcall)
      ) {
        this.#drawcallsToFlush.push(drawcall);
      }
    });
    this.#hidedUIs = [];
  }

  destroy() {
    this.#blendCompositor?.destroy();
    this.#blendCompositor = undefined;
    this.#ownedDrawcalls.forEach((drawcall) => {
      if (!drawcall.destroyed) drawcall.destroy();
    });
    this.#ownedDrawcalls.clear();
    this.#nonBatchableDrawcallsCache = new WeakMap();
    this.#batchableDrawcallsCache = new WeakMap();
    this.#instancesCache = Object.create(null);
    this.#hidedUIs = [];
    this.clear();
  }

  clear() {
    this.#drawcallsToFlush = [];
    this.#hidedUIs = [];
  }

  sort() {
    this.#drawcallsToFlush.sort((a, b) => {
      const aShape = a.shapes[0];
      const bShape = b.shapes[0];
      return sortByFractionalIndex(aShape, bShape);
    });
  }

  buildFlushSegments(): BatchFlushSegment[] {
    const segments: BatchFlushSegment[] = [];
    let normalBatch: Drawcall[] = [];
    for (const drawcall of this.#drawcallsToFlush) {
      if (drawcall.needsNodeLayerBlend()) {
        if (normalBatch.length > 0) {
          segments.push({ type: 'normal', drawcalls: [...normalBatch] });
          normalBatch = [];
        }
        const previous = segments[segments.length - 1];
        if (
          previous?.type === 'layerBlend' &&
          previous.drawcall.shapes[0] === drawcall.shapes[0]
        ) {
          previous.drawcalls.push(drawcall);
        } else {
          segments.push({ type: 'layerBlend', drawcall, drawcalls: [drawcall] });
        }
      } else {
        normalBatch.push(drawcall);
      }
    }
    if (normalBatch.length > 0) {
      segments.push({ type: 'normal', drawcalls: normalBatch });
    }
    return segments;
  }

  #prepareFlushDirtyFlags() {
    const geometryDirtyDrawcalls: Drawcall[] = [];
    const materialDirtyDrawcalls: Drawcall[] = [];
    const geometryDirtyShapes: Entity[] = [];
    const materialDirtyShapes: Entity[] = [];
    this.#drawcallsToFlush.forEach((drawcall) => {
      drawcall.shapes.forEach((shape) => {
        if (shape.has(GeometryDirty)) {
          geometryDirtyShapes.push(shape);
          geometryDirtyDrawcalls.push(drawcall);
        }
        if (shape.has(MaterialDirty)) {
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
    geometryDirtyShapes.forEach((shape) =>
      safeRemoveComponent(shape, GeometryDirty),
    );
    materialDirtyShapes.forEach((shape) =>
      safeRemoveComponent(shape, MaterialDirty),
    );
  }

  flushDrawcalls(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    uniformLegacyObject: Record<string, unknown>,
    builder: RGGraphBuilder,
    drawcalls: Drawcall[],
  ) {
    drawcalls.forEach((drawcall) => {
      drawcall.submit(renderPass, uniformBuffer, uniformLegacyObject, builder);
    });
  }

  scheduleFlush(
    builder: RGGraphBuilder,
    mainColorTargetID: number,
    mainDepthTargetID: number,
    uniformBuffer: Buffer,
    uniformLegacyObject: Record<string, unknown>,
    width: number,
    height: number,
    preamble: (renderPass: RenderPass) => void,
    sort: boolean,
    mainPassDebugName: string,
  ) {
    if (sort) {
      this.sort();
    }
    this.#prepareFlushDirtyFlags();

    this.#blendCompositor?.beginFrame();
    const segments = this.buildFlushSegments();
    const hasLayerBlend = segments.some((s) => s.type === 'layerBlend');

    if (!hasLayerBlend) {
      builder.pushPass((pass) => {
        pass.setDebugName(mainPassDebugName);
        pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);
        pass.attachRenderTargetID(
          RGAttachmentSlot.DepthStencil,
          mainDepthTargetID,
        );
        pass.exec((renderPass) => {
          preamble(renderPass);
          this.flushDrawcalls(
            renderPass,
            uniformBuffer,
            uniformLegacyObject,
            builder,
            this.#drawcallsToFlush,
          );
        });
      });
      return;
    }

    // A blend in the bottom layer still needs the cleared canvas/grid as its
    // backdrop. Resolving the main target before any pass attached it throws
    // and stops subsequent rendering and queued edits.
    if (segments[0]?.type === 'layerBlend') {
      segments.unshift({ type: 'normal', drawcalls: [] });
    }

    let firstNormal = true;
    const srcRenderInput = {
      backbufferWidth: width,
      backbufferHeight: height,
      antialiasingMode: AntialiasingMode.None,
    };
    const srcColorClear = makeAttachmentClearDescriptor(TransparentBlack);

    for (const segment of segments) {
      if (segment.type === 'normal') {
        builder.pushPass((pass) => {
          pass.setDebugName(
            firstNormal ? mainPassDebugName : `${mainPassDebugName} (cont)`,
          );
          pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);
          pass.attachRenderTargetID(
            RGAttachmentSlot.DepthStencil,
            mainDepthTargetID,
          );
          pass.exec((renderPass) => {
            if (firstNormal) {
              preamble(renderPass);
              firstNormal = false;
            }
            this.flushDrawcalls(
              renderPass,
              uniformBuffer,
              uniformLegacyObject,
              builder,
              segment.drawcalls,
            );
          });
        });
      } else {
        const srcColorTargetID = builder.createRenderTargetID(
          makeLayerBlendSrcColorDesc(srcRenderInput, srcColorClear),
          'Node Layer Blend Src',
        );

        builder.pushPass((pass) => {
          pass.setDebugName('Node Layer Blend Src');
          pass.attachRenderTargetID(RGAttachmentSlot.Color0, srcColorTargetID);
          pass.attachRenderTargetID(
            RGAttachmentSlot.DepthStencil,
            // Preserve parent clipping stencils and normal depth ordering.
            mainDepthTargetID,
          );
          pass.exec((renderPass) => {
            segment.drawcalls.forEach((drawcall) => {
              drawcall.renderNodeLayerBlendSrcInPass(
                renderPass,
                uniformBuffer,
                uniformLegacyObject,
              );
            });
          });
        });

        const srcResolveTextureID =
          builder.resolveRenderTarget(srcColorTargetID);
        const resolveTextureID = builder.resolveRenderTarget(mainColorTargetID);
        builder.pushPass((pass) => {
          pass.setDebugName('Node Layer Blend');
          pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);
          pass.attachRenderTargetID(
            RGAttachmentSlot.DepthStencil,
            mainDepthTargetID,
          );
          pass.attachResolveTexture(resolveTextureID);
          pass.attachResolveTexture(srcResolveTextureID);
          pass.exec((renderPass, scope) => {
            const backdrop = scope.getResolveTextureForID(resolveTextureID);
            const src = scope.getResolveTextureForID(srcResolveTextureID);
            this.#blendCompositor ??= new NodeLayerBlendCompositor(
              this.device, this.renderCache,
            );
            const shape = segment.drawcall.shapes[0];
            this.#blendCompositor.composite(
              renderPass,
              backdrop,
              src,
              getNodeLayerBlendMode(this.api, shape),
              width,
              height,
              shape.has(Opacity) ? shape.read(Opacity).opacity : 1,
            );
          });
        });
      }
    }
  }

  flush(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    uniformLegacyObject: Record<string, unknown>,
    builder: RGGraphBuilder,
  ) {
    this.#prepareFlushDirtyFlags();
    this.#drawcallsToFlush.forEach((drawcall) => {
      drawcall.submit(renderPass, uniformBuffer, uniformLegacyObject, builder);
    });
  }

  stats() {
    return {
      drawcallCount: this.#drawcallsToFlush.length,
    };
  }
}
