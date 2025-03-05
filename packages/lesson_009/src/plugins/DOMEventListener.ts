import type { Plugin, PluginContext } from './interfaces';

export type InteractivePointerEvent =
  | PointerEvent
  | TouchEvent
  | MouseEvent
  | WheelEvent;

export class DOMEventListener implements Plugin {
  apply(context: PluginContext) {
    const {
      canvas,
      hooks,
      globalThis,
      supportsPointerEvents,
      supportsTouchEvents,
    } = context;

    const onPointerMove = (ev: InteractivePointerEvent) => {
      // @see https://stackoverflow.com/questions/49500339/cant-prevent-touchmove-from-scrolling-window-on-ios
      ev.preventDefault();
      hooks.pointerMove.call(ev);
    };

    const onPointerUp = (ev: InteractivePointerEvent) => {
      hooks.pointerUp.call(ev);
    };

    const onPointerDown = (ev: InteractivePointerEvent) => {
      hooks.pointerDown.call(ev);
    };

    const onPointerOver = (ev: InteractivePointerEvent) => {
      hooks.pointerOver.call(ev);
    };

    const onPointerOut = (ev: InteractivePointerEvent) => {
      hooks.pointerOut.call(ev);
    };

    const onPointerCancel = (ev: InteractivePointerEvent) => {
      hooks.pointerCancel.call(ev);
    };

    const onPointerWheel = (ev: InteractivePointerEvent) => {
      hooks.pointerWheel.call(ev);
    };

    const addPointerEventListener = ($el: HTMLCanvasElement) => {
      globalThis.document.addEventListener('pointermove', onPointerMove, true);
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
      globalThis.document.addEventListener('mousemove', onPointerMove, true);
      $el.addEventListener('mousedown', onPointerDown, true);
      $el.addEventListener('mouseout', onPointerOut, true);
      $el.addEventListener('mouseover', onPointerOver, true);
      globalThis.addEventListener('mouseup', onPointerUp, true);
    };

    const removePointerEventListener = ($el: HTMLCanvasElement) => {
      globalThis.document.removeEventListener(
        'pointermove',
        onPointerMove,
        true,
      );
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
      globalThis.document.removeEventListener('mousemove', onPointerMove, true);
      $el.removeEventListener('mousedown', onPointerDown, true);
      $el.removeEventListener('mouseout', onPointerOut, true);
      $el.removeEventListener('mouseover', onPointerOver, true);
      globalThis.removeEventListener('mouseup', onPointerUp, true);
    };

    hooks.init.tap(() => {
      if (supportsPointerEvents) {
        addPointerEventListener(canvas);
      } else {
        addMouseEventListener(canvas);

        if (supportsTouchEvents) {
          addTouchEventListener(canvas);
        }
      }

      // use passive event listeners
      // @see https://zhuanlan.zhihu.com/p/24555031
      canvas.addEventListener('wheel', onPointerWheel, {
        // passive: true,
        capture: true,
      });
    });

    hooks.destroy.tap(() => {
      if (supportsPointerEvents) {
        removePointerEventListener(canvas);
      } else {
        removeMouseEventListener(canvas);

        if (supportsTouchEvents) {
          removeTouchEventListener(canvas);
        }
      }

      canvas.removeEventListener('wheel', onPointerWheel, true);
    });
  }
}
