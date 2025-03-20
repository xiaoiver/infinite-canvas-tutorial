import { LitElement } from 'lit';
import {
  Camera,
  CameraControl,
  Canvas,
  ComputedCamera,
  System,
  Transform,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';

export class ZoomLevelSystem extends System {
  container: LitElement;

  #zoomEvent: CustomEvent;

  private readonly cameraControl = this.attach(CameraControl);

  private readonly cameras = this.query((q) => q.current.with(ComputedCamera));

  constructor() {
    super();
    this.query((q) => q.using(Camera, Transform).write);
    this.schedule((s) => s.inAnyOrderWithWritersOf(Camera));
  }

  initialize() {
    this.#zoomEvent = new CustomEvent(Event.ZOOM_CHANGED, {
      detail: {
        zoom: undefined,
      },
      bubbles: true,
      composed: true,
    });

    this.container.addEventListener(Event.ZOOM_TO, (e) => {
      const { zoom } = e.detail;

      this.cameras.current.forEach((camera) => {
        const { width, height } = camera.read(Camera).canvas.read(Canvas);
        const { x, y, rotation } = camera.read(ComputedCamera);

        this.cameraControl.applyLandmark(
          { zoom, x, y, rotation, viewportX: width / 2, viewportY: height / 2 },
          camera,
        );
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
