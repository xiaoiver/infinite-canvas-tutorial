import * as d3 from 'd3-color';
import {
  Entity,
  System,
  Camera,
  Canvas,
  Children,
  Circle,
  ComputedBounds,
  ComputedCamera,
  ComputedPoints,
  ComputedRough,
  ComputedTextMetrics,
  Culled,
  DropShadow,
  Ellipse,
  FillGradient,
  FillImage,
  FillPattern,
  FillSolid,
  FillTexture,
  FractionalIndex,
  GlobalRenderOrder,
  GlobalTransform,
  GPUResource,
  Grid,
  InnerShadow,
  Line,
  Opacity,
  Path,
  Polyline,
  RasterScreenshotRequest,
  Rect,
  Renderable,
  Rough,
  Screenshot,
  SizeAttenuation,
  StrokeAttenuation,
  Stroke,
  Text,
  Theme,
  ToBeDeleted,
  Wireframe,
  MaterialDirty,
  GeometryDirty,
  TextDecoration,
  Parent,
  UI,
  ZIndex,
  Brush,
  Marker,
  VectorNetwork,
  Filter,
  Transform,
  Locked,
  ClipMode,
  Flex,
  safeAddComponent,
  getSceneRoot,
  getDescendants,
  parseGradient,
  computeLinearGradient,
  computeRadialGradient,
  computeConicGradient,
  getRoughOptions,
  parseEffect,
} from '@infinite-canvas-tutorial/ecs';
import { addRect, addEllipse, addLine, addPath, addPolyline, addText, addImageRect, addGroup, addRoughRect,clearShapes, addRoughEllipse, addRoughLine } from '@infinite-canvas-tutorial/vello-renderer';
import { InitVello } from './InitVello';

/** 将 CSS 颜色字符串转为 [r,g,b,a]，取值 0–1。 */
function colorToRgba(colorStr: string): [number, number, number, number] {
  const rgb = d3.rgb(colorStr)?.rgb();
  if (!rgb) return [0, 0, 0, 1];
  return [rgb.r / 255, rgb.g / 255, rgb.b / 255, rgb.opacity];
}

type FillGradientSpec = {
  type: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
  stops: { offset: number; color: [number, number, number, number] }[];
};

function buildSingleGradient(
  g: NonNullable<ReturnType<typeof parseGradient>>[number],
  min: [number, number],
  width: number,
  height: number,
): FillGradientSpec | null {
  if (!g) return null;
  const stops = g.steps.map((s) => ({
    offset: s.offset.type === '%' ? s.offset.value / 100 : s.offset.value,
    color: colorToRgba(s.color),
  }));
  if (g.type === 'linear-gradient') {
    const { x1, y1, x2, y2 } = computeLinearGradient(min, width, height, g.angle);
    return { type: 'linear', x1, y1, x2, y2, cx: 0, cy: 0, r: 0, startAngle: 0, endAngle: Math.PI * 2, stops };
  }
  if (g.type === 'radial-gradient') {
    const { x, y, r } = computeRadialGradient(min, width, height, g.cx, g.cy, g.size);
    return { type: 'radial', x1: 0, y1: 0, x2: 0, y2: 0, cx: x, cy: y, r, startAngle: 0, endAngle: Math.PI * 2, stops };
  }
  if (g.type === 'conic-gradient') {
    const { x, y } = computeConicGradient(min, width, height, g.cx, g.cy);
    const startAngle = ((g.angle ?? 0) * Math.PI) / 180;
    return { type: 'conic', x1: 0, y1: 0, x2: 0, y2: 0, cx: x, cy: y, r: 0, startAngle, endAngle: startAngle + Math.PI * 2, stops };
  }
  return null;
}

/** 将 CSS 渐变字符串解析为 Rust fillGradient 格式，支持多渐变叠加。 */
function buildFillGradients(
  cssGradient: string,
  min: [number, number],
  width: number,
  height: number,
): FillGradientSpec[] {
  const gradients = parseGradient(cssGradient);
  if (!gradients?.length) return [];
  const result: FillGradientSpec[] = [];
  for (const g of gradients) {
    const spec = buildSingleGradient(g, min, width, height);
    if (spec) result.push(spec);
  }
  return result;
}

/** 将 TexImageSource 转为 RGBA；支持 ImageBitmap、HTMLImageElement 等。 */
function imageToRgba(src: TexImageSource): { width: number; height: number; data: Uint8Array } | null {
  try {
    const width =
      'width' in src && typeof src.width === 'number'
        ? src.width
        : 'naturalWidth' in src
          ? (src as HTMLImageElement).naturalWidth
          : 0;
    const height =
      'height' in src && typeof src.height === 'number'
        ? src.height
        : 'naturalHeight' in src
          ? (src as HTMLImageElement).naturalHeight
          : 0;
    if (width === 0 || height === 0) return null;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(src as CanvasImageSource, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    return {
      width: imageData.width,
      height: imageData.height,
      data: new Uint8Array(imageData.data),
    };
  } catch {
    return null;
  }
}

type GPURenderer = {
  uniformBuffer: Buffer;
  uniformLegacyObject: Record<string, unknown>;
};

export class VelloPipeline extends System {
  private initVello = this.attach(InitVello);

  private canvases = this.query((q) => q.current.with(Canvas).read);

  private cameras = this.query(
    (q) => q.addedOrChanged.with(ComputedCamera).trackWrites,
  );

  private renderables = this.query(
    (q) =>
      q.added.and.changed.and.removed
        .with(Renderable)
        .withAny(
          Circle,
          Ellipse,
          Rect,
          Line,
          Polyline,
          Path,
          Text,
          Brush,
          VectorNetwork,
          Transform,
        ).trackWrites,
  );

  private lines = this.query((q) => q.added.and.removed.with(Line));
  private polylines = this.query((q) => q.added.and.removed.with(Polyline));
  private paths = this.query((q) => q.added.and.removed.with(Path));
  private vectorNetworks = this.query((q) =>
    q.added.and.removed.with(VectorNetwork),
  );

  private toBeDeleted = this.query(
    (q) => q.addedOrChanged.with(ToBeDeleted).trackWrites,
  );

  private culleds = this.query(
    (q) => q.addedOrChanged.and.removed.with(Culled).trackWrites,
  );

  private grids = this.query(
    (q) => q.addedChangedOrRemoved.with(Grid).trackWrites,
  );
  private themes = this.query(
    (q) => q.addedChangedOrRemoved.with(Theme).trackWrites,
  );

  private rasterScreenshotRequests = this.query(
    (q) => q.addedChangedOrRemoved.with(RasterScreenshotRequest).trackWrites,
  );

  private fillSolids = this.query(
    (q) => q.addedChangedOrRemoved.with(FillSolid).trackWrites,
  );
  private fillGradients = this.query(
    (q) => q.addedChangedOrRemoved.with(FillGradient).trackWrites,
  );
  private fillPatterns = this.query(
    (q) => q.addedChangedOrRemoved.with(FillPattern).trackWrites,
  );
  private fillTextures = this.query(
    (q) => q.addedChangedOrRemoved.with(FillTexture).trackWrites,
  );
  private fillImages = this.query(
    (q) => q.addedChangedOrRemoved.with(FillImage).trackWrites,
  );
  private strokes = this.query(
    (q) => q.addedChangedOrRemoved.with(Stroke).trackWrites,
  );
  private opacities = this.query(
    (q) => q.addedChangedOrRemoved.with(Opacity).trackWrites,
  );
  private innerShadows = this.query(
    (q) => q.addedChangedOrRemoved.with(InnerShadow).trackWrites,
  );
  private dropShadows = this.query(
    (q) => q.addedChangedOrRemoved.with(DropShadow).trackWrites,
  );
  private wireframes = this.query(
    (q) => q.addedChangedOrRemoved.with(Wireframe).trackWrites,
  );
  private roughs = this.query(
    (q) => q.addedChangedOrRemoved.with(Rough).trackWrites,
  );
  private fractionalIndexes = this.query(
    (q) => q.addedChangedOrRemoved.with(FractionalIndex).trackWrites,
  );
  private textDecorations = this.query(
    (q) => q.addedChangedOrRemoved.with(TextDecoration).trackWrites,
  );
  private sizeAttenuations = this.query(
    (q) => q.addedChangedOrRemoved.with(SizeAttenuation).trackWrites,
  );
  private strokeAttenuations = this.query(
    (q) => q.addedChangedOrRemoved.with(StrokeAttenuation).trackWrites,
  );
  private markers = this.query(
    (q) => q.addedChangedOrRemoved.with(Marker).trackWrites,
  );
  private filters = this.query(
    (q) => q.addedChangedOrRemoved.with(Filter).trackWrites,
  );
  private clipModes = this.query(
    (q) => q.addedChangedOrRemoved.with(ClipMode).trackWrites,
  );

  renderers: Map<Entity, GPURenderer> = new Map();

  private pendingRenderables: WeakMap<
    Entity,
    {
      type: 'add' | 'remove';
      entity: Entity;
    }[]
  > = new WeakMap();

  

  constructor() {
    super();
    this.query(
      (q) =>
        q.current
          .with(
            Theme,
            Grid,
            GPUResource,
            Camera,
            ComputedCamera,
            Parent,
            Children,
            Circle,
            Ellipse,
            Rect,
            Line,
            Polyline,
            Path,
            ComputedPoints,
            ComputedBounds,
            GlobalTransform,
            Opacity,
            Stroke,
            InnerShadow,
            DropShadow,
            Wireframe,
            GlobalRenderOrder,
            Rough,
            ComputedRough,
            Text,
            ComputedTextMetrics,
            FillImage,
            FillPattern,
            FillGradient,
            FillSolid,
            FillTexture,
            FractionalIndex,
            SizeAttenuation,
            StrokeAttenuation,
            TextDecoration,
            UI,
            ZIndex,
            Marker,
            Locked,
            ClipMode,
            Flex,
          )
          .read.and.using(
            RasterScreenshotRequest,
            Screenshot,
            GeometryDirty,
            MaterialDirty,
          ).write,
    );
  }

  private renderCamera(canvas: Entity, camera: Entity, sort = false) {
    const { api, element } = canvas.read(Canvas);
    const canvasId = this.initVello.canvasIds.get(element as HTMLCanvasElement);
    if (canvasId === undefined) {
      return;
    }

    clearShapes(canvasId);
    getDescendants(camera)
      .filter((e) => !e.has(Culled))
      .forEach((entity) => {
        let zIndex = 0;
        if (entity.has(ZIndex)) {
          zIndex = entity.read(ZIndex).value;
        }

        const transform = api.getTransform(entity);
        // gl-matrix mat3 为列主序：col0=[0,1,2], col1=[3,4,5], col2=[6,7,8]
        const localTransform = {
          m00: transform[0],
          m01: transform[3],
          m02: transform[6],
          m10: transform[1],
          m11: transform[4],
          m12: transform[7],
          m20: transform[2],
          m21: transform[5],
          m22: transform[8],
        };
        const baseOpts: Record<string, unknown> = {
          id: `${entity.__id}`,
          parentId:
            entity.has(Children) && !entity.read(Children).parent.has(Camera)
              ? `${entity.read(Children).parent.__id}`
              : undefined,
          zIndex,
          localTransform,
          sizeAttenuation: entity.has(SizeAttenuation),
          strokeAttenuation: entity.has(StrokeAttenuation),
        };

        if (entity.has(Renderable)) {
          if (entity.has(FillSolid)) {
            const fillSolid = entity.read(FillSolid).value;
            const {
              r,
              g,
              b,
              opacity,
            } = d3.rgb(fillSolid)?.rgb() || d3.rgb(0, 0, 0, 1);
            baseOpts.fill = [r / 255, g / 255, b / 255, opacity];
          }
          // FillGradient 在各自 shape 分支中根据 bounds 计算 fillGradient

          if (entity.has(Stroke)) {
            const { width, color, linecap, linejoin, miterlimit, dasharray, dashoffset, alignment } = entity.read(Stroke);
            if (width > 0 && color !== 'none') {
              const {
                r,
                g,
                b,
                opacity,
              } = d3.rgb(color)?.rgb() ?? d3.rgb(0, 0, 0, 1);
              baseOpts.stroke = {
                width,
                color: [r / 255, g / 255, b / 255, opacity],
                linecap: linecap ?? 'butt',
                linejoin: linejoin ?? 'miter',
                miterLimit: miterlimit ?? 4,
                dasharray: dasharray ?? [],
                dashoffset: dashoffset ?? 0,
                alignment: alignment ?? 'center',
              };
            }
          }

          if (entity.has(Opacity)) {
            const { opacity, fillOpacity, strokeOpacity } = entity.read(Opacity);
            baseOpts.opacity = opacity;
            baseOpts.fillOpacity = fillOpacity;
            baseOpts.strokeOpacity = strokeOpacity;
          }

          if (entity.has(Marker)) {
            const { start, end, factor } = entity.read(Marker);
            baseOpts.markerStart = start;
            baseOpts.markerEnd = end;
            baseOpts.markerFactor = factor;
          }

          let fillBlur: number | undefined = undefined;
          let dropShadow: {
            color: [number, number, number, number];
            blur: number;
            offsetX: number;
            offsetY: number;
          } | undefined = undefined;
          if (entity.has(Filter)) {
            const { value } = entity.read(Filter);
            const effects = parseEffect(value);
            for (const effect of effects) {
              if (effect.type === 'blur') {
                fillBlur = effect.value;
              } else if (effect.type === 'drop-shadow') {
                const {
                  r,
                  g,
                  b,
                  opacity,
                } = d3.rgb(effect.color)?.rgb() ?? d3.rgb(0, 0, 0, 1);
                dropShadow = {
                  color: [r / 255, g / 255, b / 255, opacity],
                  blur: effect.blur,
                  offsetX: effect.x,
                  offsetY: effect.y,
                };
              }
            }
          }

          if (entity.has(Circle)) {
            const { cx, cy, r } = entity.read(Circle);
            const opts: Record<string, unknown> = { ...baseOpts, cx, cy, rx: r, ry: r };
            if (entity.has(FillGradient)) {
              const grads = buildFillGradients(
                entity.read(FillGradient).value,
                [cx - r, cy - r],
                2 * r,
                2 * r,
              );
              if (grads.length) opts.fillGradients = grads;
            }

            if (entity.has(Rough)) { 
              const { roughness, bowing, fillStyle, hachureAngle, hachureGap, curveStepCount, simplification } = entity.read(Rough);
              addRoughEllipse(canvasId, {
                ...opts,
                roughness,
                bowing,
                fillStyle,
                hachureAngle,
                hachureGap,
                curveStepCount,
                simplification,
              });
            } else {
              addEllipse(canvasId, opts);
            }
          } else if (entity.has(Ellipse)) {
            const { cx, cy, rx, ry } = entity.read(Ellipse);
            const opts: Record<string, unknown> = { ...baseOpts, cx, cy, rx, ry };
            if (entity.has(FillGradient)) {
              const grads = buildFillGradients(
                entity.read(FillGradient).value,
                [cx - rx, cy - ry],
                2 * rx,
                2 * ry,
              );
              if (grads.length) opts.fillGradients = grads;
            }

            if (entity.has(Rough)) { 
              const { roughness, bowing, fillStyle, hachureAngle, hachureGap, curveStepCount, simplification } = entity.read(Rough);
              addRoughEllipse(canvasId, {
                ...opts,
                roughness,
                bowing,
                fillStyle,
                hachureAngle,
                hachureGap,
                curveStepCount,
                simplification,
              });
            } else {
              addEllipse(canvasId, opts);
            }
          } else if (entity.has(Line)) {
            const { x1, y1, x2, y2 } = entity.read(Line);
            const opts: Record<string, unknown> = {
              ...baseOpts,
              x1,
              y1,
              x2,
              y2,
            };
            if (entity.has(Marker)) {
              const { start, end, factor } = entity.read(Marker);
              opts.markerStart = start;
              opts.markerEnd = end;
              opts.markerFactor = factor;
            }

            if (entity.has(Rough)) { 
              const { roughness, bowing, simplification } = entity.read(Rough);
              addRoughLine(canvasId, {
                ...opts,
                roughness,
                bowing,
                simplification,
              });
            } else {
              addLine(canvasId, opts);
            }
          } else if (entity.has(Rect)) {
            const { x, y, width, height, cornerRadius } = entity.read(Rect);
            const opts: Record<string, unknown> = {
              ...baseOpts,
              x,
              y,
              width,
              height,
              radius: cornerRadius ?? 0,
              fillBlur: fillBlur ?? 0,
              dropShadow: dropShadow ?? undefined,
            };
            if (entity.has(FillGradient)) {
              const grads = buildFillGradients(entity.read(FillGradient).value, [x, y], width, height);
              if (grads.length) opts.fillGradients = grads;
            }
            if (entity.has(FillImage)) {
              const fillImage = entity.read(FillImage);
              const imageData = imageToRgba(fillImage.src);
              if (imageData) {
                addImageRect(canvasId, {
                  ...opts,
                  imageWidth: imageData.width,
                  imageHeight: imageData.height,
                  imageData: imageData.data,
                });
              }
            } else if (entity.has(Rough)) { 
              const { roughness, bowing, fillStyle, hachureAngle, hachureGap, curveStepCount, simplification } = entity.read(Rough);
              addRoughRect(canvasId, {
                ...opts,
                roughness,
                bowing,
                fillStyle,
                hachureAngle,
                hachureGap,
                curveStepCount,
                simplification,
              });
            } else {
              addRect(canvasId, opts);
            }
          } else if (entity.has(Path)) {
            const { d, fillRule } = entity.read(Path);
            if (d) {
              const opts: Record<string, unknown> = {
                ...baseOpts,
                d,
                fillRule: fillRule ?? 'nonzero',
              };
              if (entity.has(FillGradient) && entity.has(ComputedBounds)) {
                const { minX, minY, maxX, maxY } = entity.read(ComputedBounds).geometryBounds;
                const grads = buildFillGradients(
                  entity.read(FillGradient).value,
                  [minX, minY],
                  maxX - minX,
                  maxY - minY,
                );
                if (grads.length) opts.fillGradients = grads;
              }
              addPath(canvasId, opts);
            }
          } else if (entity.has(Polyline)) {
            const { points } = entity.read(Polyline);
            if (points && points.length >= 2) {
              const opts: Record<string, unknown> = {
                ...baseOpts,
                points,
              };
              addPolyline(canvasId, opts);
            }
          } else if (entity.has(Text)) {
            const { content, fontSize, fontFamily, anchorX, anchorY } = entity.read(Text);
            const opts: Record<string, unknown> = {
              ...baseOpts,
              content,
              fontSize,
              fontFamily,
              anchorX,
              anchorY,
            };
            addText(canvasId, opts);
          }
        } else {
          // Group
          addGroup(canvasId, baseOpts);
        }
      });
    this.pendingRenderables.delete(camera);
  }

  execute() {
    new Set([
      ...this.renderables.added,
      ...this.renderables.changed,
      ...this.polylines.added,
      ...this.lines.added,
      ...this.paths.added,
      ...this.vectorNetworks.added,
      ...this.culleds.removed,
    ]).forEach((entity) => {
      const camera = getSceneRoot(entity);

      if (this.renderables.added.includes(entity)) {
        safeAddComponent(entity, GeometryDirty);
        safeAddComponent(entity, MaterialDirty);
      }

      if (this.renderables.changed.includes(entity)) {
        if (
          entity.has(Line) ||
          entity.has(Polyline) ||
          entity.has(Path) ||
          entity.has(Text) ||
          entity.has(Rough) ||
          entity.has(Brush)
        ) {
          safeAddComponent(entity, GeometryDirty);
        }
        if (entity.has(Text)) {
          safeAddComponent(entity, MaterialDirty);
        }
      }

      // The gpu resources is not ready for the camera.
      if (!this.pendingRenderables.has(camera)) {
        this.pendingRenderables.set(camera, []);
      }

      this.pendingRenderables.get(camera).push({
        type: 'add',
        entity,
      });
    });

    new Set([
      ...this.toBeDeleted.addedOrChanged,
      ...this.renderables.removed,
      ...this.polylines.removed,
      ...this.lines.removed,
      ...this.paths.removed,
      ...this.vectorNetworks.removed,
      ...this.culleds.addedOrChanged,
    ]).forEach((entity) => {
      const camera = getSceneRoot(entity);

      // The gpu resources is not ready for the camera.
      if (!this.pendingRenderables.has(camera)) {
        this.pendingRenderables.set(camera, []);
      }
      this.pendingRenderables.get(camera).push({
        type: 'remove',
        entity,
      });
    });

    // Handle some special cases.
    [
      ...this.strokes.addedChangedOrRemoved,
      ...this.markers.addedChangedOrRemoved,
    ].forEach((entity) => {
      if (entity.has(Polyline) || entity.has(Path) || entity.has(Line)) {
        safeAddComponent(entity, GeometryDirty);
      }
    });

    this.canvases.current.forEach((canvas) => {
      let toRender =
        this.grids.addedChangedOrRemoved.includes(canvas) ||
        this.themes.addedChangedOrRemoved.includes(canvas) ||
        this.rasterScreenshotRequests.addedChangedOrRemoved.includes(canvas);

      const { cameras } = canvas.read(Canvas);
      cameras.forEach((camera) => {
        if (!toRender && this.pendingRenderables.get(camera)) {
          const pendingRenderables = this.pendingRenderables.get(camera);
          toRender = !!pendingRenderables.length;
        }

        if (!toRender && this.cameras.addedOrChanged.includes(camera)) {
          toRender = true;
        }

        if (
          !toRender &&
          (!!this.fillSolids.addedChangedOrRemoved.length ||
            !!this.fillGradients.addedChangedOrRemoved.length ||
            !!this.fillPatterns.addedChangedOrRemoved.length ||
            !!this.fillTextures.addedChangedOrRemoved.length ||
            !!this.fillImages.addedChangedOrRemoved.length ||
            !!this.strokes.addedChangedOrRemoved.length ||
            !!this.opacities.addedChangedOrRemoved.length ||
            !!this.innerShadows.addedChangedOrRemoved.length ||
            !!this.dropShadows.addedChangedOrRemoved.length ||
            !!this.wireframes.addedChangedOrRemoved.length ||
            !!this.roughs.addedChangedOrRemoved.length ||
            !!this.fractionalIndexes.addedChangedOrRemoved.length ||
            !!this.textDecorations.addedChangedOrRemoved.length ||
            !!this.sizeAttenuations.addedChangedOrRemoved.length ||
            !!this.strokeAttenuations.addedChangedOrRemoved.length ||
            !!this.markers.addedChangedOrRemoved.length ||
            !!this.filters.addedChangedOrRemoved.length ||
            !!this.clipModes.addedChangedOrRemoved.length)
        ) {
          toRender = true;
        }

        if (toRender) {
          this.renderCamera(canvas, camera, true);
        }
      });
    });
  }
}
