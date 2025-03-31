import {
  Camera,
  CameraControl,
  Canvas,
  ComputedCamera,
  System,
  Transform,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';
import { Container } from '../components';

export class ZoomLevelSystem extends System {
  #zoomEvent: CustomEvent;

  private readonly cameraControl = this.attach(CameraControl);

  private readonly cameras = this.query(
    (q) => q.changed.with(ComputedCamera).trackWrites,
  );

  private readonly canvases = this.query((q) => q.added.with(Canvas));

  constructor() {
    super();
    this.query(
      (q) => q.using(Camera, Transform).write.and.using(Container).read,
    );
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
    this.canvases.added.forEach((canvas) => {
      const { cameras, width, height } = canvas.read(Canvas);

      const container = canvas.read(Container);

      container.element.addEventListener(Event.ZOOM_TO, (e) => {
        const { zoom } = e.detail;

        cameras.forEach((camera) => {
          const { x, y, rotation } = camera.read(ComputedCamera);

          this.cameraControl.applyLandmark(
            {
              zoom,
              x,
              y,
              rotation,
              viewportX: width / 2,
              viewportY: height / 2,
            },
            camera,
          );
        });
      });
    });

    this.cameras.changed.forEach((camera) => {
      const { canvas } = camera.read(Camera);

      const container = canvas.read(Container);

      const { zoom } = camera.read(ComputedCamera);

      if (zoom !== this.#zoomEvent.detail.zoom) {
        this.#zoomEvent.detail.zoom = zoom;
        container.element.dispatchEvent(this.#zoomEvent);
      }
    });
  }
}
