import {
  Camera,
  CanvasConfig,
  Commands,
  Pen,
  System,
  Transform,
} from '@infinite-canvas-tutorial/ecs';
import { LitElement } from 'lit';
import { Event } from '../event';

export class InitCanvasSystem extends System {
  private readonly commands = new Commands(this);
  private readonly canvasConfig = this.singleton.write(CanvasConfig);

  container: LitElement;
  canvas: HTMLCanvasElement;
  renderer: string;
  shaderCompilerPath: string;
  zoom: number;

  constructor() {
    super();
    this.query((q) => q.using(CanvasConfig, Camera, Transform).write);
  }

  initialize(): void {
    const { container, canvas, renderer, shaderCompilerPath, zoom } = this;

    Object.assign(this.singleton.write(CanvasConfig), {
      canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      renderer,
      shaderCompilerPath,
    });

    this.commands.spawn(
      new Camera(),
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
      Object.assign(this.canvasConfig, {
        width,
        height,
      });
    });

    container.addEventListener(Event.PEN_CHANGED, (e) => {
      const { pen } = e.detail;
      Object.assign(this.canvasConfig, {
        pen,
      });
    });
  }
}

declare global {
  interface HTMLElementEventMap {
    [Event.PEN_CHANGED]: CustomEvent<{ pen: Pen }>;
    [Event.RESIZED]: CustomEvent<{ width: number; height: number }>;
  }
}
