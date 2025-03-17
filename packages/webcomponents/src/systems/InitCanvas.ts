import {
  Camera,
  CanvasConfig,
  Commands,
  ComputedCamera,
  System,
  Transform,
} from '@infinite-canvas-tutorial/ecs';
import { LitElement } from 'lit';
import { Event } from '../event';

export class InitCanvasSystem extends System {
  private readonly commands = new Commands(this);

  private readonly cameras = this.query((q) => q.current.with(ComputedCamera));
  private readonly canvasConfig = this.singleton.write(CanvasConfig);

  container: LitElement;
  canvas: HTMLCanvasElement;
  renderer: string;
  shaderCompilerPath: string;
  zoom: number;

  #zoomEvent: CustomEvent;

  constructor() {
    super();
    this.query((q) => q.using(CanvasConfig, Camera, Transform).write);

    this.#zoomEvent = new CustomEvent(Event.ZOOM_CHANGED, {
      detail: {
        zoom: this.zoom,
      },
      bubbles: true,
      composed: true,
    });
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
  }

  execute(): void {
    this.cameras.current.forEach((camera) => {
      const { zoom } = camera.read(ComputedCamera);
      if (zoom !== this.#zoomEvent.detail.zoom) {
        this.#zoomEvent.detail.zoom = zoom;
        this.container.dispatchEvent(this.#zoomEvent);
      }
    });
  }
}

declare global {
  interface HTMLElementEventMap {
    [Event.ZOOM_CHANGED]: CustomEvent<{ zoom: number }>;
    [Event.RESIZED]: CustomEvent<{ width: number; height: number }>;
  }
}
