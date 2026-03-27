import { co, Entity, System } from '@lastolivegames/becsy';
import { Gesture } from '@use-gesture/vanilla';
import { Canvas, Input, Cursor } from '../components';
import { safeAddComponent } from '../history';
import { DOMAdapter } from '../environment';

const DOUBLE_CLICK_DELAY = 300;

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
      safeAddComponent(entity, Input);
      safeAddComponent(entity, Cursor);

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

    const globalThis = DOMAdapter.get().getWindow();
    const supportsPointerEvents = !!globalThis.PointerEvent;
    const supportsTouchEvents = 'ontouchstart' in globalThis;

    const input = entity.hold();

    this.pointerIds.set(entity.__id, new Set());
    const pointerIds = this.pointerIds.get(entity.__id);
    let previousPinchDistance: number | null = null;
    let isPinching = false;
    let primaryTouchPointerId: number | null = null;
    let prevTwoFingerCenterClient: { x: number; y: number } | null = null;

    const syncCtrlShiftAltMeta = (e: PointerEvent | WheelEvent) => {
      if (e.ctrlKey) {
        input.write(Input).ctrlKey = true;
      }
      if (e.shiftKey) {
        input.write(Input).shiftKey = true;
      }
      if (e.metaKey) {
        input.write(Input).metaKey = true;
      }
      if (e.altKey) {
        input.write(Input).altKey = true;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && isPinching) return;
      if (
        e.pointerType === 'touch' &&
        primaryTouchPointerId !== null &&
        e.pointerId !== primaryTouchPointerId
      ) {
        return;
      }

      // @see https://stackoverflow.com/questions/49500339/cant-prevent-touchmove-from-scrolling-window-on-ios
      // ev.preventDefault();

      // if (pointerIds.size > 1 || !pointerIds.has(e.pointerId)) return;
      const viewport = api.client2Viewport({
        x: e.clientX,
        y: e.clientY,
      });

      Object.assign(input.write(Input), {
        pointerClient: [e.clientX, e.clientY],
        pointerViewport: [viewport.x, viewport.y],
        pressure: e.pressure,
      });

      syncCtrlShiftAltMeta(e);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && isPinching) {
        pointerIds.delete(e.pointerId);
        if (e.pointerId === primaryTouchPointerId) {
          primaryTouchPointerId = null;
        }
        if (pointerIds.size < 2) {
          isPinching = false;
        }
        return;
      }

      this.setInputTrigger(input, 'pointerUpTrigger');
      pointerIds.delete(e.pointerId);
      if (e.pointerType === 'touch' && e.pointerId === primaryTouchPointerId) {
        primaryTouchPointerId = null;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const mouseButtons = [0, 1, 2];

      if (e.pointerType === 'mouse' && !mouseButtons.includes(e.button)) return;

      pointerIds.add(e.pointerId);

      // ignore right click for now
      if (pointerIds.size > 1 || e.button === 2) {
        if (e.pointerType === 'touch') {
          if (!isPinching && primaryTouchPointerId !== null) {
            // Stop any active single-touch drawing before pinch starts.
            this.setInputTrigger(input, 'pointerUpTrigger');
          }
          isPinching = true;
          primaryTouchPointerId = null;
        }
        return;
      }

      // detect double click
      const currentTime = performance.now();
      const lastPointerDownTime = input.read(Input).lastPointerDownTime;
      if (currentTime - lastPointerDownTime < DOUBLE_CLICK_DELAY) {
        this.setInputTrigger(input, 'doubleClickTrigger');
      }

      this.setInputTrigger(input, 'pointerDownTrigger');

      if (pointerIds.size === 1) {
        if (e.pointerType === 'touch') {
          primaryTouchPointerId = e.pointerId;
        }
        const viewport = api.client2Viewport({
          x: e.clientX,
          y: e.clientY,
        });
        Object.assign(input.write(Input), {
          pointerClient: [e.clientX, e.clientY],
          pointerViewport: [viewport.x, viewport.y],
          lastPointerDownTime: currentTime,
          pressure: e.pressure,
        });
      }

      syncCtrlShiftAltMeta(e);
    };

    const onPointerCancel = (e: PointerEvent) => {
      pointerIds.delete(e.pointerId);
      if (e.pointerId === primaryTouchPointerId) {
        primaryTouchPointerId = null;
      }
      if (e.pointerType === 'touch' && pointerIds.size < 2) {
        isPinching = false;
      }
    };

    const onPointerWheel = (e: WheelEvent) => {
      e.preventDefault();
      input.write(Input).wheelTrigger = true;
      input.write(Input).deltaX = e.deltaX;
      input.write(Input).deltaY = e.deltaY;

      syncCtrlShiftAltMeta(e);

      const viewport = api.client2Viewport({
        x: e.clientX,
        y: e.clientY,
      });
      Object.assign(input.write(Input), {
        pointerClient: [e.clientX, e.clientY],
        pointerViewport: [viewport.x, viewport.y],
      });
    };

    const onTwoFingerTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      prevTwoFingerCenterClient = { x: cx, y: cy };
    };

    const onTwoFingerTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      e.preventDefault();

      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      if (prevTwoFingerCenterClient === null) {
        prevTwoFingerCenterClient = { x: cx, y: cy };
        return;
      }

      const v0 = api.client2Viewport(prevTwoFingerCenterClient);
      const v1 = api.client2Viewport({ x: cx, y: cy });
      const dvx = v1.x - v0.x;
      const dvy = v1.y - v0.y;
      prevTwoFingerCenterClient = { x: cx, y: cy };
      if (dvx === 0 && dvy === 0) return;

      const inputState = input.write(Input);
      inputState.touchPanDeltaX += dvx;
      inputState.touchPanDeltaY += dvy;
      const viewport = api.client2Viewport({ x: cx, y: cy });
      inputState.pointerClient = [Math.round(cx), Math.round(cy)];
      inputState.pointerViewport = [viewport.x, viewport.y];
    };

    const onTwoFingerTouchEndOrCancel = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        prevTwoFingerCenterClient = null;
      }
    };

    const gesture = new Gesture(
      element as HTMLCanvasElement,
      {
        onPinch: ({ event, first, last, da, origin }) => {
          if (!Number.isFinite(da[0])) {
            previousPinchDistance = null;
            return;
          }

          // Needed on iOS to stop native page zoom while pinching on canvas.
          event.preventDefault();

          const currentDistance = da[0];
          if (first || previousPinchDistance === null) {
            if (primaryTouchPointerId !== null) {
              // Ensure brush systems exit drag mode when pinch starts.
              this.setInputTrigger(input, 'pointerUpTrigger');
              primaryTouchPointerId = null;
            }
            isPinching = true;
            previousPinchDistance = currentDistance;
            return;
          }

          const distanceDelta = currentDistance - previousPinchDistance;
          previousPinchDistance = currentDistance;

          const center = { x: origin[0], y: origin[1] };
          const viewport = api.client2Viewport({ x: center.x, y: center.y });
          const inputState = input.write(Input);

          // Match CameraControl wheel+ctrl zoom path for touch pinch.
          inputState.wheelTrigger = true;
          inputState.ctrlKey = true;
          inputState.deltaX = 0;
          inputState.deltaY = -distanceDelta;
          inputState.pointerClient = [center.x, center.y];
          inputState.pointerViewport = [viewport.x, viewport.y];

          if (last) {
            previousPinchDistance = null;
            isPinching = false;
          }
        },
      },
      {
        pinch: {
          preventDefault: true,
        },
        eventOptions: {
          capture: true,
        },
      },
    );

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
      if (e.key === 'Alt') {
        input.write(Input).altKey = true;
      }

      input.write(Input).key = e.key;
      input.write(Input).event = e;
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
      if (e.key === 'Alt') {
        input.write(Input).altKey = false;
      }

      input.write(Input).event = e;
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

      if (supportsTouchEvents) {
        const $el = element as HTMLCanvasElement;
        $el.addEventListener('touchstart', onTwoFingerTouchStart, {
          capture: true,
          passive: true,
        });
        $el.addEventListener('touchmove', onTwoFingerTouchMove, {
          capture: true,
          passive: false,
        });
        $el.addEventListener('touchend', onTwoFingerTouchEndOrCancel, true);
        $el.addEventListener('touchcancel', onTwoFingerTouchEndOrCancel, true);
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

          gesture.destroy();

          if (supportsTouchEvents) {
            const $el = element as HTMLCanvasElement;
            $el.removeEventListener('touchstart', onTwoFingerTouchStart, true);
            $el.removeEventListener('touchmove', onTwoFingerTouchMove, true);
            $el.removeEventListener('touchend', onTwoFingerTouchEndOrCancel, true);
            $el.removeEventListener('touchcancel', onTwoFingerTouchEndOrCancel, true);
          }

          element.removeEventListener('wheel', onPointerWheel, true);
          globalThis.removeEventListener('keydown', onKeyDown, true);
          globalThis.removeEventListener('keyup', onKeyUp, true);
        },
      ]);
    }
  }
}
