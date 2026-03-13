import { Entity, System, Canvas, GPUResource, Grid, Theme, ComputedCamera, Camera } from '@infinite-canvas-tutorial/ecs';
import init, { registerDefaultFont, runWithCanvas, setCameraTransform } from '@infinite-canvas-tutorial/vello-renderer';

export class InitVello extends System {
  private readonly canvases = this.query(
    (q) => q.added.and.changed.and.removed.and.current.with(Canvas).trackWrites,
  );

  private readonly cameras = this.query((q) => q.with(Camera).changed.with(ComputedCamera).trackWrites);

  canvasIds: WeakMap<HTMLCanvasElement, number> = new WeakMap();

  constructor() {
    super();
    this.query((q) => q.using(GPUResource, Canvas, Theme, Grid).write.and.using(Camera).read);
  }

  async prepare() {
    await init();

    const r = await fetch('/NotoSans-Regular.ttf');
    const buf = await r.arrayBuffer();
    registerDefaultFont(buf);
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
