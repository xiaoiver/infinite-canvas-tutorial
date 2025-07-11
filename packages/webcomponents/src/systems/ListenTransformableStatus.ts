import {
  Camera,
  Canvas,
  TransformableStatus,
  System,
  Transformable,
  getSceneRoot,
  Children,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';
import { ExtendedAPI } from '../API';

export class ListenTransformableStatus extends System {
  #transformableStatusChangedEvent: CustomEvent;

  private readonly transformable = this.query(
    (q) => q.changed.with(Transformable).trackWrites,
  );

  constructor() {
    super();
    this.query((q) => q.using(Camera, Canvas, Children).read);
  }

  initialize() {
    this.#transformableStatusChangedEvent = new CustomEvent(
      Event.TRANSFORMABLE_STATUS_CHANGED,
      {
        detail: {
          status: TransformableStatus.IDLE,
        },
        bubbles: true,
        composed: true,
      },
    );
  }

  execute(): void {
    this.transformable.changed.forEach((selected) => {
      const { status, mask } = selected.read(Transformable);

      const camera = getSceneRoot(mask);

      if (status !== this.#transformableStatusChangedEvent.detail.status) {
        this.#transformableStatusChangedEvent.detail.status = status;
        const api =
          camera &&
          camera.has(Camera) &&
          camera.read(Camera).canvas &&
          camera.read(Camera).canvas.has(Canvas) &&
          (camera.read(Camera).canvas.read(Canvas).api as ExtendedAPI);
        if (api) {
          api.element.dispatchEvent(this.#transformableStatusChangedEvent);
        }
      }
    });
  }
}
