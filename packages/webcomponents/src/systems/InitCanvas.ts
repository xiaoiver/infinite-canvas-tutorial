import {
  Camera,
  Canvas,
  Commands,
  PreStartUp,
  System,
  Transform,
} from '@infinite-canvas-tutorial/ecs';
import { LitElement } from 'lit';
import { Event } from '../event';

export class InitCanvasSystem extends System {
  private readonly commands = new Commands(this);

  container: LitElement;
  canvas: HTMLCanvasElement;
  renderer: 'webgl' | 'webgpu';
  shaderCompilerPath: string;
  zoom: number;

  constructor() {
    super();
    this.query((q) => q.using(Canvas, Camera, Transform).write);
    this.schedule((s) => s.before(PreStartUp));
  }

  initialize(): void {
    const {
      container,
      canvas: $canvas,
      renderer,
      shaderCompilerPath,
      zoom,
    } = this;

    const canvas = this.commands
      .spawn(
        new Canvas({
          element: $canvas,
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
          renderer,
          shaderCompilerPath,
        }),
      )
      .id();

    this.commands.spawn(
      new Camera({
        canvas,
      }),
      new Transform({
        scale: {
          x: 1 / zoom,
          y: 1 / zoom,
        },
      }),
    );

    this.commands.execute();

    container.addEventListener(Event.RESIZED, (e) => {
      const { width, height } = e.detail;
      Object.assign(canvas.write(Canvas), {
        width,
        height,
      });
    });

    container.addEventListener(Event.PEN_CHANGED, (e) => {
      const { selected } = e.detail;
      Object.assign(canvas.write(Canvas), {
        pen: selected[0],
      });
    });
  }
}
