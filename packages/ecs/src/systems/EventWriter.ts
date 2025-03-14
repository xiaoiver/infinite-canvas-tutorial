import { System } from '@lastolivegames/becsy';
import { CanvasConfig, Event, InteractivePointerEvent } from '../components';
import { getGlobalThis } from '../utils';
import {
  EventBoundary,
  FederatedMouseEvent,
  FederatedPointerEvent,
  FederatedWheelEvent,
} from '../events';
import { isNil } from '@antv/util';
import { IPointData } from '@pixi/math';
import { vec2 } from 'gl-matrix';
import { PrepareViewUniforms } from './PrepareViewUniforms';

export class EventWriter extends System {
  private readonly canvasConfig = this.singleton.read(CanvasConfig);
  private readonly event = this.singleton.write(Event);

  prepareViewUniforms = this.attach(PrepareViewUniforms);

  #autoPreventDefault = true;
  #rootPointerEvent = new FederatedPointerEvent(null);
  #rootWheelEvent = new FederatedWheelEvent(null);
  #onDestroyCallbacks: (() => void)[] = [];

  private write(ev: InteractivePointerEvent | WheelEvent) {
    // console.log('write', ev);
    // this.event.value = ev;
    // yield co.waitForFrames(1);
    // this.event.value = null;
    // yield;
  }

  initialize(): void {
    const { canvas } = this.canvasConfig;

    const rootBoundary = new EventBoundary();
    rootBoundary.setPickHandler((x, y) => {
      // const { picked } = hooks.pickSync.call({
      //   position: { x, y },
      //   picked: [],
      //   topmost: true, // we only concern the topmost element
      // });
      // return picked[0] || null;
      return null;
    });

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
      const wheelEvent = this.normalizeWheelEvent(ev);
      rootBoundary.mapEvent(wheelEvent);
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
    const { x: canvasX, y: canvasY } = this.viewport2Canvas(event.client);
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
      const point = this.client2Viewport({
        x: clientX,
        y: clientY,
      });
      x = point.x;
      y = point.y;
    }
    return { x, y };
  }

  client2Viewport({ x, y }: IPointData): IPointData {
    const { left, top } = (
      this.canvasConfig.canvas as HTMLCanvasElement
    ).getBoundingClientRect();
    return { x: x - left, y: y - top };
  }

  viewport2Canvas({ x, y }: IPointData): IPointData {
    const { width, height } = this.canvasConfig;
    const { viewProjectionMatrixInv } = this.prepareViewUniforms;
    const canvas = vec2.transformMat3(
      vec2.create(),
      [(x / width) * 2 - 1, (1 - y / height) * 2 - 1],
      viewProjectionMatrixInv,
    );
    return { x: canvas[0], y: canvas[1] };
  }
}
