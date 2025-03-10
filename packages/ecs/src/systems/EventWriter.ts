import { co, System } from '@lastolivegames/becsy';
import { CanvasConfig, Event, InteractivePointerEvent } from '../components';
import { getGlobalThis } from '../utils';

export class EventWriter extends System {
  private readonly canvasConfig = this.singleton.read(CanvasConfig);
  private readonly event = this.singleton.write(Event);

  #onDestroyCallbacks: (() => void)[] = [];

  @co private *write(ev: InteractivePointerEvent | WheelEvent): Generator {
    this.event.value = ev;
    yield co.waitForFrames(1);
    this.event.value = null;
    yield;
  }

  initialize(): void {
    const { canvas } = this.canvasConfig;

    const globalThis = getGlobalThis();
    const supportsPointerEvents = !!globalThis.PointerEvent;
    const supportsTouchEvents = 'ontouchstart' in globalThis;

    const onPointerMove = (ev: InteractivePointerEvent) => {
      // @see https://stackoverflow.com/questions/49500339/cant-prevent-touchmove-from-scrolling-window-on-ios
      ev.preventDefault();
      this.write(ev);
    };

    const onPointerUp = (ev: InteractivePointerEvent) => {
      this.write(ev);
    };

    const onPointerDown = (ev: InteractivePointerEvent) => {
      this.write(ev);
    };

    const onPointerOver = (ev: InteractivePointerEvent) => {
      this.write(ev);
    };

    const onPointerOut = (ev: InteractivePointerEvent) => {
      this.write(ev);
    };

    const onPointerCancel = (ev: InteractivePointerEvent) => {
      this.write(ev);
    };

    const onPointerWheel = (ev: WheelEvent) => {
      this.write(ev);
    };

    const addPointerEventListener = ($el: HTMLCanvasElement) => {
      globalThis.addEventListener('pointermove', onPointerMove, true);
      $el.addEventListener('pointerdown', onPointerDown, true);
      $el.addEventListener('pointerleave', onPointerOut, true);
      $el.addEventListener('pointerover', onPointerOver, true);
      globalThis.addEventListener('pointerup', onPointerUp, true);
      globalThis.addEventListener('pointercancel', onPointerCancel, true);
    };

    const addTouchEventListener = ($el: HTMLCanvasElement) => {
      $el.addEventListener('touchstart', onPointerDown, true);
      $el.addEventListener('touchend', onPointerUp, true);
      $el.addEventListener('touchmove', onPointerMove, true);
      $el.addEventListener('touchcancel', onPointerCancel, true);
    };

    const addMouseEventListener = ($el: HTMLCanvasElement) => {
      globalThis.addEventListener('mousemove', onPointerMove, true);
      $el.addEventListener('mousedown', onPointerDown, true);
      $el.addEventListener('mouseout', onPointerOut, true);
      $el.addEventListener('mouseover', onPointerOver, true);
      globalThis.addEventListener('mouseup', onPointerUp, true);
    };

    const removePointerEventListener = ($el: HTMLCanvasElement) => {
      globalThis.removeEventListener('pointermove', onPointerMove, true);
      $el.removeEventListener('pointerdown', onPointerDown, true);
      $el.removeEventListener('pointerleave', onPointerOut, true);
      $el.removeEventListener('pointerover', onPointerOver, true);
      globalThis.removeEventListener('pointerup', onPointerUp, true);
    };

    const removeTouchEventListener = ($el: HTMLCanvasElement) => {
      $el.removeEventListener('touchstart', onPointerDown, true);
      $el.removeEventListener('touchend', onPointerUp, true);
      $el.removeEventListener('touchmove', onPointerMove, true);
      $el.removeEventListener('touchcancel', onPointerCancel, true);
    };

    const removeMouseEventListener = ($el: HTMLCanvasElement) => {
      globalThis.removeEventListener('mousemove', onPointerMove, true);
      $el.removeEventListener('mousedown', onPointerDown, true);
      $el.removeEventListener('mouseout', onPointerOut, true);
      $el.removeEventListener('mouseover', onPointerOver, true);
      globalThis.removeEventListener('mouseup', onPointerUp, true);
    };

    if ('addEventListener' in globalThis) {
      if (supportsPointerEvents) {
        addPointerEventListener(canvas as HTMLCanvasElement);
      } else {
        addMouseEventListener(canvas as HTMLCanvasElement);

        if (supportsTouchEvents) {
          addTouchEventListener(canvas as HTMLCanvasElement);
        }
      }

      // use passive event listeners
      // @see https://zhuanlan.zhihu.com/p/24555031
      canvas.addEventListener('wheel', onPointerWheel, {
        // passive: true,
        capture: true,
      });

      this.#onDestroyCallbacks.push(() => {
        if (supportsPointerEvents) {
          removePointerEventListener(canvas as HTMLCanvasElement);
        } else {
          removeMouseEventListener(canvas as HTMLCanvasElement);

          if (supportsTouchEvents) {
            removeTouchEventListener(canvas as HTMLCanvasElement);
          }
        }

        canvas.removeEventListener('wheel', onPointerWheel, true);
      });
    }
  }

  finalize(): void {
    this.#onDestroyCallbacks.forEach((callback) => callback());
  }
}
