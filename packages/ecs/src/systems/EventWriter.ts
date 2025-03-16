import { co, System } from '@lastolivegames/becsy';
import { IPointData } from '@pixi/math';
import { CanvasConfig, Input } from '../components';
import { getGlobalThis } from '../utils';

export class EventWriter extends System {
  private readonly canvasConfig = this.singleton.read(CanvasConfig);
  private readonly input = this.singleton.write(Input);

  private readonly pointerIds = new Set<number>();

  #onDestroyCallbacks: (() => void)[] = [];

  @co private *setInputTrigger(triggerKey: string): Generator {
    if (!(triggerKey in this.input)) return;

    Object.assign(this.input, { [triggerKey]: true });

    yield co.waitForFrames(1);

    Object.assign(this.input, { [triggerKey]: false });

    yield;
  }

  initialize(): void {
    const { canvas } = this.canvasConfig;

    const globalThis = getGlobalThis();
    const supportsPointerEvents = !!globalThis.PointerEvent;
    const supportsTouchEvents = 'ontouchstart' in globalThis;

    const onPointerMove = (e: PointerEvent) => {
      // @see https://stackoverflow.com/questions/49500339/cant-prevent-touchmove-from-scrolling-window-on-ios
      // ev.preventDefault();

      if (this.pointerIds.size > 1 || !this.pointerIds.has(e.pointerId)) return;
      const pointerWorld = this.client2Viewport({
        x: e.offsetX,
        y: e.offsetY,
      });
      this.input.pointerWorld = [pointerWorld.x, pointerWorld.y];
    };

    const onPointerUp = (e: PointerEvent) => {
      this.setInputTrigger('pointerUpTrigger');
      this.pointerIds.delete(e.pointerId);
      this.input.pointerDown = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      const mouseButtons = [0, 1, 2];

      if (e.pointerType === 'mouse' && !mouseButtons.includes(e.button)) return;

      this.pointerIds.add(e.pointerId);

      if (this.pointerIds.size > 1) {
        this.input.pointerDown = false;
        return;
      }

      this.input.pointerDown = true;
      this.setInputTrigger('pointerDownTrigger');

      if (this.pointerIds.size === 1) {
        const pointerWorld = this.client2Viewport({
          x: e.offsetX,
          y: e.offsetY,
        });
        this.input.pointerWorld = [pointerWorld.x, pointerWorld.y];
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      this.pointerIds.delete(e.pointerId);
      this.input.pointerDown = false;
    };

    const onPointerWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.input.wheelTrigger = true;
      this.input.deltaX = e.deltaX;
      this.input.deltaY = e.deltaY;
      if (e.ctrlKey) {
        this.input.ctrlKey = true;
      }
      if (e.shiftKey) {
        this.input.shiftKey = true;
      }
      if (e.metaKey) {
        this.input.metaKey = true;
      }

      const pointerWorld = this.client2Viewport({
        x: e.offsetX,
        y: e.offsetY,
      });
      this.input.pointerWorld = [pointerWorld.x, pointerWorld.y];
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        this.input.ctrlKey = true;
      }

      if (e.key === 'Shift') {
        this.input.shiftKey = true;
      }

      if (e.key === 'Meta') {
        this.input.metaKey = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        this.input.ctrlKey = false;
      }

      if (e.key === 'Shift') {
        this.input.shiftKey = false;
      }

      if (e.key === 'Meta') {
        this.input.metaKey = false;
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

      globalThis.addEventListener('keydown', onKeyDown, true);
      globalThis.addEventListener('keyup', onKeyUp, true);
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
        globalThis.removeEventListener('keydown', onKeyDown, true);
        globalThis.removeEventListener('keyup', onKeyUp, true);
      });
    }
  }

  finalize(): void {
    this.#onDestroyCallbacks.forEach((callback) => callback());
  }

  client2Viewport({ x, y }: IPointData): IPointData {
    const { left, top } = (
      this.canvasConfig.canvas as HTMLCanvasElement
    ).getBoundingClientRect();
    return { x: x - left, y: y - top };
  }
}
