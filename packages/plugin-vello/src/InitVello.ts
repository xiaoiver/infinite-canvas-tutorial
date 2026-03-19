import { Entity, System, Canvas, GPUResource, Grid, Theme, ComputedCamera, Camera, Path, createRenderBoundsProviderFromComputePathBounds, createGeometryBoundsProviderFromComputePathBounds, Polyline, createRenderBoundsProviderFromComputePathBoundsForPolyline, createGeometryBoundsProviderFromComputePathBoundsForPolyline, createHitTestProviderFromHitTestPath, createHitTestProviderFromHitTestPathForPolyline, Line, createGeometryBoundsProviderFromComputePathBoundsForLine, createHitTestProviderFromHitTestPathForLine, createRenderBoundsProviderFromComputePathBoundsForLine, Text, createGeometryBoundsProviderFromComputeTextBounds } from '@infinite-canvas-tutorial/ecs';
import init, { registerFont as registerFontVello, runWithCanvas, setCameraTransform, computePathBounds, hitTestPath, computeTextBounds } from '@infinite-canvas-tutorial/vello-renderer';

const FONT_URLS = [];
export function registerFont(fontUrl: string) {
  FONT_URLS.push(fontUrl);
}

/**
 * InitVello System 基类，包含 canvasIds 用于 VelloPipeline 访问。
 * 实际的 System 实现通过 InitVelloSystemImpl 创建。
 */
export class InitVello extends System {
  canvasIds: WeakMap<HTMLCanvasElement, number> = new WeakMap();

  private readonly canvases = this.query(
    (q) => q.added.and.changed.and.removed.and.current.with(Canvas).trackWrites,
  );

  private readonly cameras = this.query((q) => q.with(Camera).changed.with(ComputedCamera).trackWrites);

  constructor() {
    super();
    this.query((q) => q.using(GPUResource, Canvas, Theme, Grid).write.and.using(Camera).read);
  }

  async prepare() {
    await init();

    for (const fontUrl of FONT_URLS) {
      const r = await fetch(fontUrl);
      const buf = await r.arrayBuffer();
      registerFontVello(buf);
    }

    // 使用 Vello kurbo 计算包围盒
    Path.geometryBoundsProvider = createGeometryBoundsProviderFromComputePathBounds(computePathBounds);
    Path.renderBoundsProvider = createRenderBoundsProviderFromComputePathBounds(computePathBounds);
    Polyline.geometryBoundsProvider = createGeometryBoundsProviderFromComputePathBoundsForPolyline(computePathBounds);
    Polyline.renderBoundsProvider = createRenderBoundsProviderFromComputePathBoundsForPolyline(computePathBounds);
    Line.geometryBoundsProvider = createGeometryBoundsProviderFromComputePathBoundsForLine(computePathBounds);
    Line.renderBoundsProvider = createRenderBoundsProviderFromComputePathBoundsForLine(computePathBounds);
    Text.geometryBoundsProvider = createGeometryBoundsProviderFromComputeTextBounds(computeTextBounds);

    // 使用 Vello 进行 hit testing
    Path.hitTestProvider = createHitTestProviderFromHitTestPath(hitTestPath);
    Polyline.hitTestProvider = createHitTestProviderFromHitTestPathForPolyline(hitTestPath);
    Line.hitTestProvider = createHitTestProviderFromHitTestPathForLine(hitTestPath);
  }

  execute() {
    this.canvases.added.forEach(async (canvas) => {
      if (!canvas.has(Theme)) {
        canvas.add(Theme);
      }

      if (!canvas.has(Grid)) {
        canvas.add(Grid);
      }

      const $canvas = canvas.read(Canvas).element as HTMLCanvasElement;

      runWithCanvas($canvas, (canvasId: number) => {
        this.canvasIds.set($canvas, canvasId);
      });
    });

    this.canvases.removed.forEach((canvas) => {
      this.accessRecentlyDeletedData();
      this.destroyCanvas(canvas);
    });

    this.cameras.changed.forEach((camera) => {
      const { x, y, zoom, rotation } = camera.read(ComputedCamera);
      const canvasEntity = camera.read(Camera).canvas;
      const { element, devicePixelRatio } = canvasEntity.read(Canvas);
      // Vello 构建的变换为：S(scale) * R(rotation) * T(x, y)
      // 需要与 ECS viewMatrix = S(zoom) * R(-rotation) * T(-x, -y) 等效
      // 注意：ECS 使用 CSS 逻辑像素，Vello 使用物理像素，需要乘以 DPR
      setCameraTransform(this.canvasIds.get(element as HTMLCanvasElement), {
        x: -x * devicePixelRatio,
        y: -y * devicePixelRatio,
        scale: zoom,
        rotation: -rotation,
      });
    });
  }

  finalize(): void {
    this.canvases.current.forEach((canvas) => {
      this.destroyCanvas(canvas);
    });
  }

  private destroyCanvas(canvas: Entity) {}
}
