import { co, Entity, System } from '@lastolivegames/becsy';
import { Canvas, Input } from '../components';
import { getGlobalThis } from '../utils';
import { Cursor } from '..';

/**
 * This system will bind event listeners to the canvas.
 * It will also handle the pointer events and keyboard events.
 */
export class EventWriter extends System {
  private readonly canvases = this.query((q) =>
    q.added.and.removed.with(Canvas),
  );

  private readonly pointerIds = new Map<number, Set<number>>();

  #onDestroyCallbacks: WeakMap<HTMLCanvasElement, (() => void)[]> =
    new WeakMap();

  @co private *setInputTrigger(entity: Entity, triggerKey: string): Generator {
    const input = entity.write(Input);

    if (!(triggerKey in input)) return;

    Object.assign(input, { [triggerKey]: true });

    yield;

    {
      const input = entity.hold().write(Input);

      Object.assign(input, { [triggerKey]: false });
    }

    yield;
  }

  constructor() {
    super();
    this.query((q) => q.using(Input, Cursor).write);
  }

  execute(): void {
    this.canvases.added.forEach((entity) => {
      if (!entity.has(Input)) {
        entity.add(Input);
      }
      if (!entity.has(Cursor)) {
        entity.add(Cursor);
      }

      this.bindEventListeners(entity);
    });

    this.canvases.removed.forEach((entity) => {
      this.accessRecentlyDeletedData();
      const canvas = entity.read(Canvas);
      const { element } = canvas;

      this.#onDestroyCallbacks
        .get(element as HTMLCanvasElement)
        ?.forEach((callback) => callback());
    });
  }

  private bindEventListeners(entity: Entity): void {
    const { element, api } = entity.read(Canvas);

    const globalThis = getGlobalThis();
    const supportsPointerEvents = !!globalThis.PointerEvent;
    const supportsTouchEvents = 'ontouchstart' in globalThis;

    const input = entity.hold();

    this.pointerIds.set(entity.__id, new Set());
    const pointerIds = this.pointerIds.get(entity.__id);

    const onPointerMove = (e: PointerEvent) => {
      // @see https://stackoverflow.com/questions/49500339/cant-prevent-touchmove-from-scrolling-window-on-ios
      // ev.preventDefault();

      if (pointerIds.size > 1 || !pointerIds.has(e.pointerId)) return;
      const viewport = api.client2Viewport({
        x: e.clientX,
        y: e.clientY,
      });

      Object.assign(input.write(Input), {
        pointerClient: [e.clientX, e.clientY],
        pointerViewport: [viewport.x, viewport.y],
      });
    };

    const onPointerUp = (e: PointerEvent) => {
      // input.write(Input).pointerUpTrigger = true;
      this.setInputTrigger(input, 'pointerUpTrigger');
      pointerIds.delete(e.pointerId);
    };

    const onPointerDown = (e: PointerEvent) => {
      const mouseButtons = [0, 1, 2];

      if (e.pointerType === 'mouse' && !mouseButtons.includes(e.button)) return;

      pointerIds.add(e.pointerId);

      if (pointerIds.size > 1) {
        return;
      }

      // input.write(Input).pointerDownTrigger = true;
      this.setInputTrigger(input, 'pointerDownTrigger');

      if (pointerIds.size === 1) {
        const viewport = api.client2Viewport({
          x: e.clientX,
          y: e.clientY,
        });
        Object.assign(input.write(Input), {
          pointerClient: [e.clientX, e.clientY],
          pointerViewport: [viewport.x, viewport.y],
        });
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      pointerIds.delete(e.pointerId);
    };

    const onPointerWheel = (e: WheelEvent) => {
      e.preventDefault();
      input.write(Input).wheelTrigger = true;
      input.write(Input).deltaX = e.deltaX;
      input.write(Input).deltaY = e.deltaY;

      if (e.ctrlKey) {
        input.write(Input).ctrlKey = true;
      }
      if (e.shiftKey) {
        input.write(Input).shiftKey = true;
      }
      if (e.metaKey) {
        input.write(Input).metaKey = true;
      }

      const viewport = api.client2Viewport({
        x: e.clientX,
        y: e.clientY,
      });
      Object.assign(input.write(Input), {
        pointerClient: [e.clientX, e.clientY],
        pointerViewport: [viewport.x, viewport.y],
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        input.write(Input).ctrlKey = true;
      }

      if (e.key === 'Shift') {
        input.write(Input).shiftKey = true;
      }

      if (e.key === 'Meta') {
        input.write(Input).metaKey = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        input.write(Input).ctrlKey = false;
      }

      if (e.key === 'Shift') {
        input.write(Input).shiftKey = false;
      }

      if (e.key === 'Meta') {
        input.write(Input).metaKey = false;
      }
    };

    const addPointerEventListener = ($el: HTMLCanvasElement) => {
      $el.addEventListener('pointermove', onPointerMove, true);
      $el.addEventListener('pointerdown', onPointerDown, true);
      $el.addEventListener('pointerup', onPointerUp, true);
      $el.addEventListener('pointercancel', onPointerCancel, true);
    };

    const addTouchEventListener = ($el: HTMLCanvasElement) => {
      $el.addEventListener('touchstart', onPointerDown, true);
      $el.addEventListener('touchend', onPointerUp, true);
      $el.addEventListener('touchmove', onPointerMove, true);
      $el.addEventListener('touchcancel', onPointerCancel, true);
    };

    const addMouseEventListener = ($el: HTMLCanvasElement) => {
      $el.addEventListener('mousemove', onPointerMove, true);
      $el.addEventListener('mousedown', onPointerDown, true);
      $el.addEventListener('mouseup', onPointerUp, true);
    };

    const removePointerEventListener = ($el: HTMLCanvasElement) => {
      $el.removeEventListener('pointermove', onPointerMove, true);
      $el.removeEventListener('pointerdown', onPointerDown, true);
      $el.removeEventListener('pointerup', onPointerUp, true);
      $el.removeEventListener('pointercancel', onPointerCancel, true);
    };

    const removeTouchEventListener = ($el: HTMLCanvasElement) => {
      $el.removeEventListener('touchstart', onPointerDown, true);
      $el.removeEventListener('touchend', onPointerUp, true);
      $el.removeEventListener('touchmove', onPointerMove, true);
      $el.removeEventListener('touchcancel', onPointerCancel, true);
    };

    const removeMouseEventListener = ($el: HTMLCanvasElement) => {
      $el.removeEventListener('mousemove', onPointerMove, true);
      $el.removeEventListener('mousedown', onPointerDown, true);
      $el.removeEventListener('mouseup', onPointerUp, true);
    };

    if ('addEventListener' in globalThis) {
      if (supportsPointerEvents) {
        addPointerEventListener(element as HTMLCanvasElement);
      } else {
        addMouseEventListener(element as HTMLCanvasElement);

        if (supportsTouchEvents) {
          addTouchEventListener(element as HTMLCanvasElement);
        }
      }

      // use passive event listeners
      // @see https://zhuanlan.zhihu.com/p/24555031
      element.addEventListener('wheel', onPointerWheel, {
        // passive: true,
        capture: true,
      });

      globalThis.addEventListener('keydown', onKeyDown, true);
      globalThis.addEventListener('keyup', onKeyUp, true);
      this.#onDestroyCallbacks.set(element as HTMLCanvasElement, [
        () => {
          if (supportsPointerEvents) {
            removePointerEventListener(element as HTMLCanvasElement);
          } else {
            removeMouseEventListener(element as HTMLCanvasElement);

            if (supportsTouchEvents) {
              removeTouchEventListener(element as HTMLCanvasElement);
            }
          }

          element.removeEventListener('wheel', onPointerWheel, true);
          globalThis.removeEventListener('keydown', onKeyDown, true);
          globalThis.removeEventListener('keyup', onKeyUp, true);
        },
      ]);
    }
  }
}
