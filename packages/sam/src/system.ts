import { Canvas, System } from '@infinite-canvas-tutorial/ecs';

export class SAMSystem extends System {
  private readonly canvases = this.query((q) => q.added.with(Canvas));

  execute() {
    this.canvases.added.forEach((canvas) => {
      const { api } = canvas.read(Canvas);
    });
  }
}
