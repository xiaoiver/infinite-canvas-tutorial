import { co, Entity, System } from '@lastolivegames/becsy';
import { IPointData } from '@pixi/math';
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
    const canvas = entity.read(Canvas).element as HTMLCanvasElement;

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
      const viewport = this.client2Viewport(
        {
          x: e.clientX,
          y: e.clientY,
        },
        canvas,
      );

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
        const viewport = this.client2Viewport(
          {
            x: e.clientX,
            y: e.clientY,
          },
          canvas,
        );
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

      const viewport = this.client2Viewport(
        {
          x: e.clientX,
          y: e.clientY,
        },
        canvas,
      );
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
      this.#onDestroyCallbacks.set(canvas as HTMLCanvasElement, [
        () => {
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
        },
      ]);
    }
  }

  /**
   * Should account for CSS Transform applied on container.
   * @see https://github.com/antvis/G/issues/1161
   * @see https://github.com/antvis/G/issues/1677
   * @see https://developer.mozilla.org/zh-CN/docs/Web/API/MouseEvent/offsetX
   */
  client2Viewport({ x, y }: IPointData, $el: HTMLCanvasElement): IPointData {
    const { scaleX, scaleY, bbox } = this.getScale($el);
    return {
      x: (x - (bbox?.left || 0)) / scaleX,
      y: (y - (bbox?.top || 0)) / scaleY,
    };
  }

  viewport2Client({ x, y }: IPointData, $el: HTMLCanvasElement): IPointData {
    const { scaleX, scaleY, bbox } = this.getScale($el);
    return {
      x: (x + (bbox?.left || 0)) * scaleX,
      y: (y + (bbox?.top || 0)) * scaleY,
    };
  }

  private getScale($el: HTMLCanvasElement) {
    const bbox = $el.getBoundingClientRect();
    let scaleX = 1;
    let scaleY = 1;

    if ($el && bbox) {
      const { offsetWidth, offsetHeight } = $el;
      if (offsetWidth && offsetHeight) {
        scaleX = bbox.width / offsetWidth;
        scaleY = bbox.height / offsetHeight;
      }
    }
    return {
      scaleX,
      scaleY,
      bbox,
    };
  }
}
