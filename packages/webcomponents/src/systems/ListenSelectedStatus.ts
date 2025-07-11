import {
  Camera,
  Canvas,
  Selected,
  SeletedStatus,
  System,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';
import { ExtendedAPI } from '../API';

export class ListenSelectedStatus extends System {
  #selectedStatusChangedEvent: CustomEvent;

  private readonly selected = this.query(
    (q) => q.changed.with(Selected).trackWrites,
  );

  constructor() {
    super();
    this.query((q) => q.using(Camera, Canvas).read);
  }

  initialize() {
    this.#selectedStatusChangedEvent = new CustomEvent(
      Event.SELECTED_STATUS_CHANGED,
      {
        detail: {
          selected: [],
          status: SeletedStatus.IDLE,
        },
        bubbles: true,
        composed: true,
      },
    );
  }

  execute(): void {
    this.selected.changed.forEach((selected) => {
      const { status, camera } = selected.read(Selected);

      if (status !== this.#selectedStatusChangedEvent.detail.status) {
        this.#selectedStatusChangedEvent.detail.status = status;
        // this.#selectedStatusChangedEvent.detail.selected = selected.read(Selected).selected;
        const api =
          camera &&
          camera.has(Canvas) &&
          (camera.read(Canvas).api as ExtendedAPI);
        if (api) {
          api.element.dispatchEvent(this.#selectedStatusChangedEvent);
        }
      }
    });
  }
}
