import {
  Camera,
  Canvas,
  ComputedBounds,
  ComputedCamera,
  System,
  Transform,
  toDomPrecision,
  Theme
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';
import { ExtendedAPI } from '../API';

export class ZoomLevel extends System {
  #zoomChangedEvent: CustomEvent;
  #positionChangedEvent: CustomEvent;

  private readonly cameras = this.query(
    (q) => q.changed.with(ComputedCamera).trackWrites,
  );

  constructor() {
    super();
    this.query((q) => q.using(Camera, Transform, Theme).write.and.using(Canvas, ComputedBounds).read);
  }

  initialize() {
    this.#zoomChangedEvent = new CustomEvent(Event.CAMERA_ZOOM_CHANGED, {
      detail: {
        zoom: undefined,
      },
      bubbles: true,
      composed: true,
    });
    this.#positionChangedEvent = new CustomEvent(Event.CAMERA_POSITION_CHANGED, {
      detail: {
        x: undefined,
        y: undefined,
      },
      bubbles: true,
      composed: true,
    });
  }

  execute(): void {
    this.cameras.changed.forEach((camera) => {
      const { canvas } = camera.read(Camera);

      const api = canvas.read(Canvas).api as ExtendedAPI;

      const { zoom, x, y, rotation } = camera.read(ComputedCamera);

      api.setAppState({
        ...api.getAppState(),
        cameraZoom: zoom,
        cameraX: x,
        cameraY: y,
        cameraRotation: rotation,
      });

      const cosR = Math.cos(rotation);
      const sinR = Math.sin(rotation);

      const a = toDomPrecision(zoom * cosR);
      const b = toDomPrecision(-zoom * sinR);
      const c = toDomPrecision(zoom * sinR);
      const d = toDomPrecision(zoom * cosR);
      const e = toDomPrecision(-zoom * (cosR * x + sinR * y));
      const f = toDomPrecision(zoom * (sinR * x - cosR * y));

      api.getHtmlLayer().style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;

      if (zoom !== this.#zoomChangedEvent.detail.zoom) {
        this.#zoomChangedEvent.detail.zoom = zoom;
        api.element.dispatchEvent(this.#zoomChangedEvent);
      } else if (x !== this.#positionChangedEvent.detail.x || y !== this.#positionChangedEvent.detail.y) {
        this.#positionChangedEvent.detail.x = x;
        this.#positionChangedEvent.detail.y = y;
        api.element.dispatchEvent(this.#positionChangedEvent);
      }
    });
  }
}
