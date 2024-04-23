import { FederatedEventTarget, FederatedPointerEvent } from '../events';
import { Shape } from '../shapes';
import { distanceBetweenPoints } from '../utils';
import type { Plugin, PluginContext } from './interfaces';

function closest(
  el: FederatedEventTarget,
  selector: (shape: FederatedEventTarget) => boolean,
): FederatedEventTarget | null {
  do {
    if (el && selector(el)) return el;
    el = el.parent;
  } while (el !== undefined);
  return null;
}

export interface DragndropPluginOptions {
  /**
   * How drops are checked for. The allowed values are:
   * - 'pointer' – the pointer must be over the dropzone (default)
   * - 'center' – the draggable element’s center must be over the dropzone
   * @see https://interactjs.io/docs/dropzone/#accept
   */
  overlap: 'pointer' | 'center';

  /**
   * Threshold for triggering `dragstart` event in milliseconds.
   */
  dragstartTimeThreshold: number;

  /**
   * Threshold for triggering `dragstart` event in pixels.
   */
  dragstartDistanceThreshold: number;
}

export class Dragndrop implements Plugin {
  #options: DragndropPluginOptions;

  constructor(options: Partial<DragndropPluginOptions> = {}) {
    this.#options = {
      overlap: 'pointer',
      dragstartTimeThreshold: 0,
      dragstartDistanceThreshold: 0,
      ...options,
    };
  }

  apply(context: PluginContext) {
    const {
      root,
      hooks,
      api: { elementsFromPoint },
    } = context;

    const handlePointerdown = (event: FederatedPointerEvent) => {
      const target = event.target as Shape;
      const draggableEventTarget = closest(target, (s) => s.draggable === true);

      if (draggableEventTarget) {
        // delay triggering dragstart event
        let dragstartTriggered = false;
        const dragstartTimeStamp = event.timeStamp;
        const dragstartClientCoordinates: [number, number] = [
          event.clientX,
          event.clientY,
        ];

        let currentDroppable = null;
        let lastDragClientCoordinates = [event.clientX, event.clientY];

        const handlePointermove = (event: FederatedPointerEvent) => {
          if (!dragstartTriggered) {
            const timeElapsed = event.timeStamp - dragstartTimeStamp;
            const distanceMoved = distanceBetweenPoints(
              event.clientX,
              event.clientY,
              ...dragstartClientCoordinates,
            );
            // check thresholds
            if (
              timeElapsed <= this.#options.dragstartTimeThreshold ||
              distanceMoved <= this.#options.dragstartDistanceThreshold
            ) {
              return;
            }

            // @see https://developer.mozilla.org/zh-CN/docs/Web/API/Document/dragstart_event
            event.type = 'dragstart';

            draggableEventTarget.dispatchEvent(event);
            dragstartTriggered = true;
          }

          // @see https://developer.mozilla.org/zh-CN/docs/Web/API/Document/drag_event
          event.type = 'drag';
          event.dx = event.clientX - lastDragClientCoordinates[0];
          event.dy = event.clientY - lastDragClientCoordinates[1];
          draggableEventTarget.dispatchEvent(event);
          lastDragClientCoordinates = [event.clientX, event.clientY];

          // const point =
          //   this.#options.overlap === 'pointer'
          //     ? [event.canvasX, event.canvasY]
          //     : target.getBounds().center;

          const point = [event.globalX, event.globalY];
          const elementsBelow = elementsFromPoint(point[0], point[1]);

          // prevent from picking the dragging element
          const elementBelow = elementsBelow[elementsBelow.indexOf(target) + 1];

          if (elementBelow) {
            const droppableBelow = closest(
              elementBelow,
              (s) => s.droppable === true,
            );
            if (currentDroppable !== droppableBelow) {
              if (currentDroppable) {
                // null when we were not over a droppable before this event
                // @see https://developer.mozilla.org/zh-CN/docs/Web/API/Document/dragleave_event
                event.type = 'dragleave';
                event.target = currentDroppable;
                currentDroppable.dispatchEvent(event);
              }

              if (droppableBelow) {
                // @see https://developer.mozilla.org/zh-CN/docs/Web/API/Document/dragleave_event
                event.type = 'dragenter';
                event.target = droppableBelow;
                droppableBelow.dispatchEvent(event);
              }

              currentDroppable = droppableBelow;
              if (currentDroppable) {
                // null if we're not coming over a droppable now
                // @see https://developer.mozilla.org/zh-CN/docs/Web/API/Document/dragover_event
                event.type = 'dragover';
                event.target = currentDroppable;
                currentDroppable.dispatchEvent(event);
              }
            }
          }
        };

        root.addEventListener('pointermove', handlePointermove);
        const stopDragging = function (
          originalPointerUpEvent: FederatedPointerEvent,
        ) {
          if (dragstartTriggered) {
            // prevent click event being triggerd
            // @see https://github.com/antvis/G/issues/1091
            // @ts-ignore
            originalPointerUpEvent.detail = {
              preventClick: true,
            };

            // clone event first
            // const event = originalPointerUpEvent.clone();
            const event = originalPointerUpEvent;

            // drop should fire before dragend
            // @see https://javascript.tutorialink.com/is-there-a-defined-ordering-between-dragend-and-drop-events/

            if (currentDroppable) {
              // @see https://developer.mozilla.org/zh-CN/docs/Web/API/Document/drop_event
              event.type = 'drop';
              event.target = currentDroppable;
              currentDroppable.dispatchEvent(event);
            }

            // @see https://developer.mozilla.org/zh-CN/docs/Web/API/Document/dragend_event
            event.type = 'dragend';
            draggableEventTarget.dispatchEvent(event);

            dragstartTriggered = false;
          }

          root.removeEventListener('pointermove', handlePointermove);
        };

        target.addEventListener('pointerup', stopDragging, { once: true });
        target.addEventListener('pointerupoutside', stopDragging, {
          once: true,
        });
      }
    };

    hooks.init.tap(() => {
      root.addEventListener('pointerdown', handlePointerdown);
    });
    hooks.destroy.tap(() => {
      root.removeEventListener('pointerdown', handlePointerdown);
    });
  }
}
