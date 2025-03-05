import {
  EventBoundary,
  FederatedWheelEvent,
  type FederatedMouseEvent,
  type PixiTouch,
  FederatedPointerEvent,
  Cursor,
} from '../events';
import { isNil, isUndefined } from '../utils';
import type { InteractivePointerEvent } from './DOMEventListener';
import type { Plugin, PluginContext } from './interfaces';

const MOUSE_POINTER_ID = 1;
const TOUCH_TO_POINTER: Record<string, string> = {
  touchstart: 'pointerdown',
  touchend: 'pointerup',
  touchendoutside: 'pointerupoutside',
  touchmove: 'pointermove',
  touchcancel: 'pointercancel',
};

export class Event implements Plugin {
  #autoPreventDefault = true;
  #rootPointerEvent = new FederatedPointerEvent(null);
  #rootWheelEvent = new FederatedWheelEvent(null);
  #rootBoundary: EventBoundary;
  #context: PluginContext;

  apply(context: PluginContext) {
    const { hooks, root } = context;
    this.#context = context;
    this.#rootBoundary = new EventBoundary(root);
    this.#rootBoundary.setPickHandler((x, y) => {
      const { picked } = hooks.pickSync.call({
        position: { x, y },
        picked: [],
        topmost: true, // we only concern the topmost element
      });
      return picked[0] || null;
    });

    hooks.pointerWheel.tap((nativeEvent: WheelEvent) => {
      const wheelEvent = this.normalizeWheelEvent(nativeEvent);
      this.#rootBoundary.mapEvent(wheelEvent);
    });

    hooks.pointerDown.tap((nativeEvent: InteractivePointerEvent) => {
      const events = this.normalizeToPointerEvent(nativeEvent);
      if (this.#autoPreventDefault && (events[0] as any).isNormalized) {
        const cancelable =
          nativeEvent.cancelable || !('cancelable' in nativeEvent);

        if (cancelable) {
          nativeEvent.preventDefault();
        }
      }

      for (let i = 0, j = events.length; i < j; i++) {
        const nativeEvent = events[i];
        const federatedEvent = this.bootstrapEvent(
          this.#rootPointerEvent,
          nativeEvent,
        );

        this.#rootBoundary.mapEvent(federatedEvent);
      }

      this.setCursor(this.#rootBoundary.cursor);
    });

    hooks.pointerUp.tap((nativeEvent: InteractivePointerEvent) => {
      let target = nativeEvent.target;

      // if in shadow DOM use composedPath to access target
      if (nativeEvent.composedPath && nativeEvent.composedPath().length > 0) {
        target = nativeEvent.composedPath()[0];
      }

      const outside = target !== this.#context.canvas ? 'outside' : '';
      const normalizedEvents = this.normalizeToPointerEvent(nativeEvent);

      for (let i = 0, j = normalizedEvents.length; i < j; i++) {
        const event = this.bootstrapEvent(
          this.#rootPointerEvent,
          normalizedEvents[i],
        );

        event.type += outside;

        this.#rootBoundary.mapEvent(event);
      }

      this.setCursor(this.#rootBoundary.cursor);
    });

    hooks.pointerMove.tap(this.onPointerMove);
    hooks.pointerOver.tap(this.onPointerMove);
    hooks.pointerOut.tap(this.onPointerMove);
    hooks.pointerCancel.tap(this.onPointerMove);
  }

  private normalizeWheelEvent(nativeEvent: WheelEvent): FederatedWheelEvent {
    const event = this.#rootWheelEvent;

    this.transferMouseData(event, nativeEvent);

    // When WheelEvent is triggered by scrolling with mouse wheel, reading WheelEvent.deltaMode
    // before deltaX/deltaY/deltaZ on Firefox will result in WheelEvent.DOM_DELTA_LINE (1),
    // while reading WheelEvent.deltaMode after deltaX/deltaY/deltaZ on Firefox or reading
    // in any order on other browsers will result in WheelEvent.DOM_DELTA_PIXEL (0).
    // Therefore, we need to read WheelEvent.deltaMode after deltaX/deltaY/deltaZ in order to
    // make its behavior more consistent across browsers.
    // @see https://github.com/pixijs/pixijs/issues/8970
    event.deltaX = nativeEvent.deltaX;
    event.deltaY = nativeEvent.deltaY;
    event.deltaZ = nativeEvent.deltaZ;
    event.deltaMode = nativeEvent.deltaMode;

    const { x, y } = this.getViewportXY(nativeEvent);
    event.client.x = x;
    event.client.y = y;
    const { x: canvasX, y: canvasY } = this.#context.api.viewport2Canvas(
      event.client,
    );
    event.screen.x = canvasX;
    event.screen.y = canvasY;
    event.global.copyFrom(event.screen);
    event.offset.copyFrom(event.screen);

    event.nativeEvent = nativeEvent;
    event.type = nativeEvent.type;

    return event;
  }

  /**
   * Transfers base & mouse event data from the nativeEvent to the federated event.
   */
  private transferMouseData(
    event: FederatedMouseEvent,
    nativeEvent: MouseEvent,
  ): void {
    event.isTrusted = nativeEvent.isTrusted;
    event.srcElement = nativeEvent.srcElement;
    event.timeStamp = performance.now();
    event.type = nativeEvent.type;

    event.altKey = nativeEvent.altKey;
    event.metaKey = nativeEvent.metaKey;
    event.shiftKey = nativeEvent.shiftKey;
    event.ctrlKey = nativeEvent.ctrlKey;
    event.button = nativeEvent.button;
    event.buttons = nativeEvent.buttons;
    event.client.x = nativeEvent.clientX;
    event.client.y = nativeEvent.clientY;
    event.movement.x = nativeEvent.movementX;
    event.movement.y = nativeEvent.movementY;
    event.page.x = nativeEvent.pageX;
    event.page.y = nativeEvent.pageY;
    event.screen.x = nativeEvent.screenX;
    event.screen.y = nativeEvent.screenY;
    event.relatedTarget = null;
  }

  private setCursor(cursor: Cursor | string) {
    this.#context.canvas.style.cursor = cursor;
  }

  private normalizeToPointerEvent(
    event: InteractivePointerEvent,
  ): PointerEvent[] {
    const { supportsTouchEvents, supportsPointerEvents } = this.#context;

    const normalizedEvents = [];
    if (supportsTouchEvents && event instanceof TouchEvent) {
      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i] as PixiTouch;

        // use changedTouches instead of touches since touchend has no touches
        // @see https://stackoverflow.com/a/10079076
        if (isUndefined(touch.button)) touch.button = 0;
        if (isUndefined(touch.buttons)) touch.buttons = 1;
        if (isUndefined(touch.isPrimary)) {
          touch.isPrimary =
            event.touches.length === 1 && event.type === 'touchstart';
        }
        if (isUndefined(touch.width)) touch.width = touch.radiusX || 1;
        if (isUndefined(touch.height)) touch.height = touch.radiusY || 1;
        if (isUndefined(touch.tiltX)) touch.tiltX = 0;
        if (isUndefined(touch.tiltY)) touch.tiltY = 0;
        if (isUndefined(touch.pointerType)) touch.pointerType = 'touch';
        // @see https://developer.mozilla.org/zh-CN/docs/Web/API/Touch/identifier
        if (isUndefined(touch.pointerId))
          touch.pointerId = touch.identifier || 0;
        if (isUndefined(touch.pressure)) touch.pressure = touch.force || 0.5;
        if (isUndefined(touch.twist)) touch.twist = 0;
        if (isUndefined(touch.tangentialPressure)) touch.tangentialPressure = 0;
        touch.isNormalized = true;
        touch.type = event.type;

        normalizedEvents.push(touch);
      }
    } else if (
      !globalThis.MouseEvent ||
      (event instanceof MouseEvent &&
        (!supportsPointerEvents || !(event instanceof globalThis.PointerEvent)))
    ) {
      const tempEvent = event as PixiPointerEvent;
      if (isUndefined(tempEvent.isPrimary)) tempEvent.isPrimary = true;
      if (isUndefined(tempEvent.width)) tempEvent.width = 1;
      if (isUndefined(tempEvent.height)) tempEvent.height = 1;
      if (isUndefined(tempEvent.tiltX)) tempEvent.tiltX = 0;
      if (isUndefined(tempEvent.tiltY)) tempEvent.tiltY = 0;
      if (isUndefined(tempEvent.pointerType)) tempEvent.pointerType = 'mouse';
      if (isUndefined(tempEvent.pointerId))
        tempEvent.pointerId = MOUSE_POINTER_ID;
      if (isUndefined(tempEvent.pressure)) tempEvent.pressure = 0.5;
      if (isUndefined(tempEvent.twist)) tempEvent.twist = 0;
      if (isUndefined(tempEvent.tangentialPressure))
        tempEvent.tangentialPressure = 0;
      tempEvent.isNormalized = true;

      normalizedEvents.push(tempEvent);
    } else {
      normalizedEvents.push(event);
    }

    return normalizedEvents as PointerEvent[];
  }

  /**
   * Normalizes the `nativeEvent` into a federateed {@link FederatedPointerEvent}.
   * @param event
   * @param nativeEvent
   */
  private bootstrapEvent(
    event: FederatedPointerEvent,
    nativeEvent: PointerEvent,
  ): FederatedPointerEvent {
    event.originalEvent = null;
    event.nativeEvent = nativeEvent;

    event.pointerId = nativeEvent.pointerId;
    event.width = nativeEvent.width;
    event.height = nativeEvent.height;
    event.isPrimary = nativeEvent.isPrimary;
    event.pointerType = nativeEvent.pointerType;
    event.pressure = nativeEvent.pressure;
    event.tangentialPressure = nativeEvent.tangentialPressure;
    event.tiltX = nativeEvent.tiltX;
    event.tiltY = nativeEvent.tiltY;
    event.twist = nativeEvent.twist;
    this.transferMouseData(event, nativeEvent);

    const { x, y } = this.getViewportXY(nativeEvent);
    event.client.x = x;
    event.client.y = y;
    const { x: canvasX, y: canvasY } = this.#context.api.viewport2Canvas(
      event.client,
    );
    event.screen.x = canvasX;
    event.screen.y = canvasY;
    event.global.copyFrom(event.screen);
    event.offset.copyFrom(event.screen);

    event.isTrusted = nativeEvent.isTrusted;
    if (event.type === 'pointerleave') {
      event.type = 'pointerout';
    }
    if (event.type.startsWith('mouse')) {
      event.type = event.type.replace('mouse', 'pointer');
    }
    if (event.type.startsWith('touch')) {
      event.type = TOUCH_TO_POINTER[event.type] || event.type;
    }

    return event;
  }

  private onPointerMove = (nativeEvent: InteractivePointerEvent) => {
    const normalizedEvents = this.normalizeToPointerEvent(nativeEvent);

    for (const normalizedEvent of normalizedEvents) {
      const event = this.bootstrapEvent(
        this.#rootPointerEvent,
        normalizedEvent,
      );

      this.#rootBoundary.mapEvent(event);
    }

    this.setCursor(this.#rootBoundary.cursor);
  };

  private getViewportXY(nativeEvent: PointerEvent | WheelEvent) {
    let x: number;
    let y: number;
    /**
     * Should account for CSS Transform applied on container.
     * @see https://github.com/antvis/G/issues/1161
     * @see https://developer.mozilla.org/zh-CN/docs/Web/API/MouseEvent/offsetX
     */
    const { offsetX, offsetY, clientX, clientY } = nativeEvent;
    if (!isNil(offsetX) && !isNil(offsetY)) {
      x = offsetX;
      y = offsetY;
    } else {
      const point = this.#context.api.client2Viewport({
        x: clientX,
        y: clientY,
      });
      x = point.x;
      y = point.y;
    }
    return { x, y };
  }
}

interface PixiPointerEvent extends PointerEvent {
  isPrimary: boolean;
  width: number;
  height: number;
  tiltX: number;
  tiltY: number;
  pointerType: string;
  pointerId: number;
  pressure: number;
  twist: number;
  tangentialPressure: number;
  isNormalized: boolean;
  type: string;
}
