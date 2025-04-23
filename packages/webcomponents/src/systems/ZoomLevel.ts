import {
  Camera,
  Canvas,
  ComputedCamera,
  System,
  Transform,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';
import { ExtendedAPI } from '../API';

export class ZoomLevel extends System {
  #zoomEvent: CustomEvent;

  private readonly cameras = this.query(
    (q) => q.changed.with(ComputedCamera).trackWrites,
  );

  constructor() {
    super();
    this.query((q) => q.using(Camera, Transform).write.and.using(Canvas).read);
  }

  initialize() {
    this.#zoomEvent = new CustomEvent(Event.ZOOM_CHANGED, {
      detail: {
        zoom: undefined,
      },
      bubbles: true,
      composed: true,
    });
  }

  execute(): void {
    this.cameras.changed.forEach((camera) => {
      const { canvas } = camera.read(Camera);

      const api = canvas.read(Canvas).api as ExtendedAPI;

      const { zoom } = camera.read(ComputedCamera);

      if (zoom !== this.#zoomEvent.detail.zoom) {
        this.#zoomEvent.detail.zoom = zoom;
        api.element.dispatchEvent(this.#zoomEvent);
      }
    });
  }
}
