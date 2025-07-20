import {
  Camera,
  Canvas,
  TransformableStatus,
  System,
  Transformable,
  getSceneRoot,
  Children,
  SelectOBB,
  SelectVectorNetwork,
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
    this.query(
      (q) =>
        q.using(Camera, Canvas, Children, SelectOBB, SelectVectorNetwork).read,
    );
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
    this.transformable.changed.forEach((camera) => {
      if (camera.has(SelectOBB)) {
        const { status, mask } = camera.read(Transformable);
        if (mask) {
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
        }
      }
    });
  }
}
