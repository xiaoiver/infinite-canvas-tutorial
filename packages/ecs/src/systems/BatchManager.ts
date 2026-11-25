import { TextBatch } from '../drawcalls/TextBatch';
import {
  Buffer,
  Device,
  RenderPass,
  SwapChain,
  Texture,
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
  TextProxy,
  PathInstances,
  StampBrush,
  // Custom as CustomDrawcall,
} from '../drawcalls';
import {
  ComputedLOD,
  Children,
  ClipMode,
  Filter,
  FractionalIndex,
  NodeLayerBlendMode,
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
import { safeRemoveComponent } from '../history';
import { API } from '../API';
import {
  getRenderNodeLayerBlendMode,
  isNonNormalNodeLayerBlend,
} from '../utils/nodeLayerBlend';
import { NodeLayerBlendCompositor } from '../utils/nodeLayerBlendGpu';
import { shouldSuppress2DShapeRender } from '../utils/extrude3d';
import { StrokeBatch } from '../drawcalls/StrokeBatch';
import { ImageBatch } from '../drawcalls/ImageBatch';
import { nodeLookupForPass } from '../utils/node-lookup';
import {
  reuseAdjacentImageTokens,
  imageRectTexture,
  invalidateImageRectTexture,
} from '../utils/image-batching';

/**
 * Since a shape may have multiple drawcalls, we need to cache them and maintain an 1-to-many relationship.
 *
 * e.g. we need 2 drawcalls for a Circle with dashed stroke:
 * - A SDF drawcall to draw the fill.
 * - A Path drawcall to draw the dashed stroke.
 *
 * e.g. 3 drawcalls for a Rect with drop shadow.
 */
function getDrawcallCtors(shape: Entity, intent: 'screen' | 'export') {
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
    if (
      intent === 'screen' &&
      shape.has(ComputedLOD) &&
      shape.read(ComputedLOD).level === 'text-proxy'
    ) {
      SHAPE_DRAWCALL_CTORS.push(TextProxy);
    } else {
      SHAPE_DRAWCALL_CTORS.push(SmoothPolyline, SDFText);
    }
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

/** Resource reuse and painter-order planning are separate responsibilities. */
export class BatchManager {
  #drawcallsToFlush: Drawcall[] = [];
  #ownedDrawcalls = new Set<Drawcall>();
  #blendCompositor?: NodeLayerBlendCompositor;
  #active = new Map<Entity, Drawcall[] | null>();
  #nonBatchableDrawcallsCache = new WeakMap<Entity, Drawcall[]>();
  #instancesCache = new Map<string, Drawcall[][]>();
  #ctorIds = new Map<typeof Drawcall, number>();
  #dirty = false;
  #pathInstancing = false;
  #textBatching = false;
  #imageBatching = false;
  #changed = new Set<Entity>();
  #ordered = false;
  #hideUIs = false;

  constructor(
    private readonly device: Device,
    private readonly swapChain: SwapChain,
    private readonly renderCache: RenderCache,
    private readonly texturePool: TexturePool,
    private readonly api: API,
    private readonly intent: 'screen' | 'export' = 'screen',
  ) {}

  setTextBatchingEnabled(enabled: boolean) {
    enabled = enabled && this.intent === 'screen';
    if (enabled !== this.#textBatching) {
      this.#textBatching = enabled;
      this.#dirty = true;
    }
  }

  setImageBatchingEnabled(enabled: boolean) {
    enabled = enabled && this.intent === 'screen';
    if (enabled !== this.#imageBatching) {
      this.#imageBatching = enabled;
      this.#dirty = true;
    }
  }

  setPathInstancingEnabled(enabled: boolean) {
    enabled = enabled && this.intent === 'screen';
    if (enabled !== this.#pathInstancing) {
      this.#pathInstancing = enabled;
      this.#dirty = true;
    }
  }

  private resolveDrawcalls(shape: Entity): {
    ctors: (typeof Drawcall)[];
    key: string | null;
  } {
    if (this.#imageBatching && shape.has(Rect)) {
      const key = this.batchKey(shape, [ImageBatch]);
      if (key !== null) return { ctors: [ImageBatch], key };
    }
    if (this.#pathInstancing && shape.has(Path)) {
      const key = this.batchKey(shape, [PathInstances]);
      if (key !== null) return { ctors: [PathInstances], key };
      const strokeKey = this.batchKey(shape, [StrokeBatch]);
      if (strokeKey !== null) return { ctors: [StrokeBatch], key: strokeKey };
    }
    const ctors = getDrawcallCtors(shape, this.intent).filter((Ctor) => {
      // Not every renderer needs a geometry-specific channel check.
      return (
        !(Ctor as typeof Drawcall & { check?: (s: Entity) => boolean }).check ||
        (Ctor as typeof Drawcall & { check: (s: Entity) => boolean }).check(
          shape,
        )
      );
    });
    if (this.#textBatching && ctors.length === 1 && ctors[0] === SDFText) {
      const key = this.batchKey(shape, [TextBatch]);
      if (key !== null) return { ctors: [TextBatch], key };
    }
    return { ctors, key: this.batchKey(shape, ctors) };
  }

  private createDrawcalls(
    shape: Entity,
    ctors: (typeof Drawcall)[],
    instanced = false,
  ) {
    return ctors.map((Ctor, index) => {
      // @ts-ignore abstract constructor: only concrete renderers occur in this list.
      const drawcall: Drawcall = new Ctor(
        this.device,
        this.swapChain,
        this.renderCache,
        this.texturePool,
        instanced,
        index,
        this.api,
      );
      this.#ownedDrawcalls.add(drawcall);
      drawcall.add(shape);
      return drawcall;
    });
  }

  private retire(drawcalls: Drawcall[]) {
    for (const d of drawcalls) {
      if (!d.destroyed) d.destroy();
      this.#ownedDrawcalls.delete(d);
    }
  }

  private getOrCreateNonBatchableDrawcalls(
    shape: Entity,
    ctors: (typeof Drawcall)[],
  ) {
    let cached = this.#nonBatchableDrawcallsCache.get(shape);
    if (
      cached &&
      (cached.length !== ctors.length ||
        cached.some((d, i) => d.constructor !== ctors[i]))
    ) {
      this.retire(cached);
      cached = undefined;
    }
    if (!cached) {
      cached = this.createDrawcalls(shape, ctors);
      this.#nonBatchableDrawcallsCache.set(shape, cached);
    }
    return cached;
  }

  private batchKey(shape: Entity, ctors: (typeof Drawcall)[]): string | null {
    // Multi-pass nodes are atomic painter-order items. Their channels cannot be
    // grouped independently without interleaving another node's shadows/fills.
    if (
      !shape.read(Renderable).batchable ||
      ctors.length !== 1 ||
      shape.has(UI) ||
      isNonNormalNodeLayerBlend(getRenderNodeLayerBlendMode(shape))
    )
      return null;
    const Ctor = ctors[0];
    const material = Ctor.batchKey?.(shape);
    if (material == null) return null;
    let ancestor: Entity = shape;
    while (ancestor) {
      if (ancestor.hasSomeOf(ClipMode, Filter, NodeLayerBlendMode)) return null;
      ancestor = ancestor.has(Children) ? ancestor.read(Children).parent : null;
    }
    if (!this.#ctorIds.has(Ctor)) this.#ctorIds.set(Ctor, this.#ctorIds.size);
    return `${this.#ctorIds.get(Ctor)}:${material}`;
  }

  /** Mark an item for reassignment, including same-constructor material edits. */
  add(shape: Entity, drawcalls?: Drawcall[]) {
    // Track material edits even while batching is disabled, so a later toggle
    // cannot reuse raster options from an earlier document state.
    if (shape.has(MaterialDirty)) invalidateImageRectTexture(shape);
    if (shouldSuppress2DShapeRender(shape)) {
      this.remove(shape);
      return;
    }
    this.#active.set(shape, drawcalls ?? null);
    this.#changed.add(shape);
    this.#dirty = true;
  }

  /** Remove the item immediately; culling may retain its private full renderer. */
  remove(shape: Entity, destroy = true) {
    this.#active.delete(shape);
    if (destroy) {
      const cached = this.#nonBatchableDrawcallsCache.get(shape);
      if (cached) this.retire(cached);
      this.#nonBatchableDrawcallsCache.delete(shape);
    }
    this.#dirty = true;
  }

  private plan() {
    if (!this.#dirty) return;
    // Snapshot keys once per dirty plan. Comparator calls must not repeatedly
    // enter Becsy component access, and each new plan must see current keys.
    const needsSort = this.#ordered && this.#active.size > 1;
    const entries = Array.from(this.#active, ([shape, explicit]) => ({
      shape,
      explicit,
      order:
        needsSort &&
        shape.has(FractionalIndex) &&
        shape.read(FractionalIndex).value,
    }));
    if (needsSort)
      entries.sort((a, b) => {
        // Keep Sort's code-unit comparison and stable ties, including missing keys.
        if (a.order < b.order) return -1;
        if (a.order > b.order) return 1;
        return 0;
      });
    // Compatibility may inspect a member again after accepting it. Resolve its
    // raster token once in this plan; a later plan must see current paint.
    const nodeLookup = this.#imageBatching
      ? nodeLookupForPass(this.api)
      : undefined;
    const imageToken = this.#imageBatching
      ? reuseAdjacentImageTokens(
          (shape: Entity) =>
            imageRectTexture(shape, this.api, nodeLookup).token,
        )
      : undefined;
    const nextPools = new Map<string, Drawcall[][]>();
    const cursors = new Map<string, number>();
    const plans: {
      key: string | null;
      calls: Drawcall[];
      shapes: Entity[];
      instances: number;
    }[] = [];
    const usedGroups = new Set<Drawcall[]>();
    const textPages = new Map<Entity, Drawcall[]>();
    for (const groups of this.#instancesCache.values())
      for (const group of groups)
        if (group[0] instanceof TextBatch)
          textPages.set(group[0].shapes[0], group);
    for (const { shape, explicit } of entries) {
      const { ctors, key } = explicit
        ? { ctors: [], key: null }
        : this.resolveDrawcalls(shape);
      if (key !== null) {
        const cached = this.#nonBatchableDrawcallsCache.get(shape);
        if (cached) {
          this.retire(cached);
          this.#nonBatchableDrawcallsCache.delete(shape);
        }
      }
      const instances = key === null ? 1 : ctors[0].instanceCount(shape);
      const previous = plans[plans.length - 1];
      if (
        key !== null &&
        previous?.key === key &&
        (ctors[0] !== ImageBatch ||
          ImageBatch.canAppend(previous.shapes, shape, this.api, imageToken)) &&
        previous.instances + instances <=
          (previous.calls[0].instanceCapacity ?? Infinity)
      ) {
        previous.shapes.push(shape);
        previous.instances += instances;
        if (this.#changed.has(shape))
          previous.calls[0].dirtyInstances.add(shape);
        continue;
      }
      let calls: Drawcall[];
      if (key !== null) {
        const pool = this.#instancesCache.get(key);
        let index = cursors.get(key) ?? 0;
        while (pool && index < pool.length && usedGroups.has(pool[index]))
          index++;
        cursors.set(key, index + 1);
        const exact = pool?.[index];
        const candidate =
          ctors[0] === TextBatch ? textPages.get(shape) : undefined;
        const recycled =
          candidate && !usedGroups.has(candidate) ? candidate : undefined;
        calls = exact ?? recycled ?? this.createDrawcalls(shape, ctors, true);
        if (!exact && recycled) calls.forEach((d) => (d.materialDirty = true));
        usedGroups.add(calls);
        if (!nextPools.has(key)) nextPools.set(key, []);
        nextPools.get(key)!.push(calls);
      } else {
        calls = explicit ?? this.getOrCreateNonBatchableDrawcalls(shape, ctors);
      }
      plans.push({ key, calls, shapes: [shape], instances });
    }
    const retained = new Set([...nextPools.values()].flat());
    for (const [key, groups] of this.#instancesCache) {
      for (const group of groups) {
        if (retained.has(group)) continue;
        // One empty page per supported key is enough for culling/reentry reuse.
        if (
          key &&
          !nextPools.has(key) &&
          (group[0].constructor as typeof Drawcall).retainEmptyPage
        ) {
          group.forEach((d) => {
            d.shapes = [];
            d.dirtyInstances.clear();
            d.geometryDirty = true;
          });
          nextPools.set(key, [group]);
        } else this.retire(group);
      }
    }
    this.#instancesCache = nextPools;
    this.#drawcallsToFlush = [];
    for (const { calls, shapes } of plans) {
      for (const d of calls) {
        if (
          d.shapes.length !== shapes.length ||
          d.shapes.some((s, i) => s !== shapes[i])
        ) {
          d.shapes = [...shapes];
          d.geometryDirty = true;
        }
        for (const shape of shapes)
          if (this.#changed.has(shape)) d.dirtyInstances.add(shape);
        if (!this.#hideUIs || !shapes.some((s) => s.has(UI)))
          this.#drawcallsToFlush.push(d);
      }
    }
    this.#changed.clear();
    this.#dirty = false;
  }

  hideUIs() {
    this.#hideUIs = true;
    this.#dirty = true;
  }
  showUIs() {
    this.#hideUIs = false;
    this.#dirty = true;
  }

  destroy() {
    this.#blendCompositor?.destroy();
    this.#blendCompositor = undefined;
    this.retire([...this.#ownedDrawcalls]);
    this.#nonBatchableDrawcallsCache = new WeakMap();
    this.#instancesCache.clear();
    this.clear();
  }

  clear() {
    this.#active.clear();
    this.#changed.clear();
    this.#drawcallsToFlush = [];
    this.#hideUIs = false;
    this.#dirty = true;
  }

  sort() {
    this.#ordered = true;
    this.#dirty = true;
  }

  buildFlushSegments(): BatchFlushSegment[] {
    this.plan();
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
          segments.push({
            type: 'layerBlend',
            drawcall,
            drawcalls: [drawcall],
          });
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
    this.plan();
    const geometry = new Set<Entity>();
    const material = new Set<Entity>();
    for (const drawcall of this.#drawcallsToFlush) {
      for (const shape of drawcall.shapes) {
        if (shape.has(GeometryDirty)) {
          if (drawcall.canUpdateGeometryRows)
            drawcall.dirtyInstances.add(shape);
          else drawcall.geometryDirty = true;
          geometry.add(shape);
        }
        if (shape.has(MaterialDirty)) {
          if (drawcall.isInstanced) drawcall.dirtyInstances.add(shape);
          else drawcall.materialDirty = true;
          material.add(shape);
        }
      }
    }
    // Export's private full plan must not consume the screen representation's markers.
    if (this.intent === 'export') return;
    geometry.forEach((shape) => safeRemoveComponent(shape, GeometryDirty));
    material.forEach((shape) => safeRemoveComponent(shape, MaterialDirty));
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
    preamble: (
      renderPass: RenderPass,
      shadowTextures: readonly Texture[],
    ) => void,
    sort: boolean,
    mainPassDebugName: string,
    shadowResolveIDs: readonly number[] = [],
  ) {
    if (sort && !this.#ordered) {
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
        shadowResolveIDs.forEach((id) => pass.attachResolveTexture(id));
        pass.exec((renderPass, scope) => {
          preamble(
            renderPass,
            shadowResolveIDs.map((id) => scope.getResolveTextureForID(id)),
          );
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
          shadowResolveIDs.forEach((id) => pass.attachResolveTexture(id));
          pass.exec((renderPass, scope) => {
            if (firstNormal) {
              preamble(
                renderPass,
                shadowResolveIDs.map((id) => scope.getResolveTextureForID(id)),
              );
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
              this.device,
              this.renderCache,
            );
            const shape = segment.drawcall.shapes[0];
            this.#blendCompositor.composite(
              renderPass,
              backdrop,
              src,
              getRenderNodeLayerBlendMode(shape),
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
    this.plan();
    return {
      drawcallCount: this.#drawcallsToFlush.length,
    };
  }
}
