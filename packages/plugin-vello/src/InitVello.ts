import { Entity, System, Canvas, GPUResource, Grid, Theme } from '@infinite-canvas-tutorial/ecs';
import init, { runWithCanvas } from 'vello-renderer';

export class InitVello extends System {
  private readonly canvases = this.query(
    (q) => q.added.and.changed.and.removed.and.current.with(Canvas).trackWrites,
  );

  canvasIds: WeakMap<HTMLCanvasElement, number> = new WeakMap();

  constructor() {
    super();
    this.query((q) => q.using(GPUResource, Canvas, Theme, Grid).write);
  }

  async initialize() {
    await init();
    await Promise.all(
      this.canvases.current.map(async (canvas) => {
        const $canvas = canvas.read(Canvas).element as HTMLCanvasElement;
        return new Promise((resolve) => runWithCanvas($canvas, (canvasId: number) => {
          this.canvasIds.set($canvas, canvasId);
          resolve(true);
        }));
      })
    );
  }

  execute() {
    this.canvases.added.forEach(async (canvas) => {
      if (!canvas.has(Theme)) {
        canvas.add(Theme);
      }

      if (!canvas.has(Grid)) {
        canvas.add(Grid);
      }

      const {
        width,
        height,
        devicePixelRatio,
        renderer,
        shaderCompilerPath,
        element,
      } = canvas.read(Canvas);

      const holder = canvas.hold();
      
    });

    this.canvases.removed.forEach((canvas) => {
      this.accessRecentlyDeletedData();
      this.destroyCanvas(canvas);
    });
  }

  finalize(): void {
    this.canvases.current.forEach((canvas) => {
      this.destroyCanvas(canvas);
    });
  }

  private destroyCanvas(canvas: Entity) {
    const { device, renderCache, renderGraph } = canvas.read(GPUResource);
  }
}
