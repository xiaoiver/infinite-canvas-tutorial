import { CanvasMode } from '../Canvas';
import { FederatedPointerEvent, CustomEvent } from '../events';
import { Group, Path, Shape } from '../shapes';
import { RectPen } from '../shapes/pen';
import { AbstractPen, PenEvent, PenState } from '../shapes/pen/AbstractPen';
import { Plugin, PluginContext } from './interfaces';

export interface PainterPluginOptions {}

export class Painter implements Plugin {
  #options: PainterPluginOptions;
  #context: PluginContext;

  #pen: AbstractPen;

  /**
   * the topmost operation layer, which will be appended to documentElement directly
   */
  #activePenLayer = new Group({
    zIndex: Number.MAX_SAFE_INTEGER,
    serializable: false,
  });

  #startEvent: CustomEvent;
  #moveEvent: CustomEvent;
  #modifiedEvent: CustomEvent;
  #completeEvent: CustomEvent;
  #cancelEvent: CustomEvent;

  register: () => void;
  unregister: () => void;

  constructor(options: PainterPluginOptions) {
    this.#options = options;
  }

  apply(context: PluginContext) {
    const {
      root,
      api: { getCanvasMode, createCustomEvent },
      hooks,
    } = context;
    this.#context = context;
    root.appendChild(this.#activePenLayer);

    this.#startEvent = createCustomEvent(PenEvent.START);
    this.#moveEvent = createCustomEvent(PenEvent.MOVE);
    this.#modifiedEvent = createCustomEvent(PenEvent.MODIFIED);
    this.#completeEvent = createCustomEvent(PenEvent.COMPLETE);
    this.#cancelEvent = createCustomEvent(PenEvent.CANCEL);

    function inPainterCanvasMode(
      fn: (e: FederatedPointerEvent | KeyboardEvent) => void,
    ) {
      return (e: FederatedPointerEvent) => {
        const mode = getCanvasMode();
        if (mode !== CanvasMode.DRAW_RECT) {
          return;
        }
        fn(e);
      };
    }

    const handleClick = inPainterCanvasMode((e: FederatedPointerEvent) => {
      if (e.detail === 2) {
        if (e.button === 0) {
          this.#pen.onMouseDbClick(e);
        }
      }
    });

    const handlePointerDown = inPainterCanvasMode(
      (e: FederatedPointerEvent) => {
        if (e.button === 0) {
          this.#pen.onMouseDown(e);
        }
      },
    );

    const handlePointerMove = inPainterCanvasMode(
      (e: FederatedPointerEvent) => {
        this.#pen.onMouseMove(e);
      },
    );

    const handlePointerUp = inPainterCanvasMode((e: FederatedPointerEvent) => {
      if (e.button === 0) {
        this.#pen.onMouseUp(e);
      }
    });

    const handleKeyDown = inPainterCanvasMode((e: KeyboardEvent) => {
      this.#pen.onKeyDown(e);
    });

    this.register = () => {
      root.addEventListener('click', handleClick);
      root.addEventListener('pointerdown', handlePointerDown);
      root.addEventListener('pointermove', handlePointerMove);
      root.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('keydown', handleKeyDown);
    };

    this.unregister = () => {
      root.removeEventListener('click', handleClick);
      root.removeEventListener('pointerdown', handlePointerDown);
      root.removeEventListener('pointermove', handlePointerMove);
      root.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };

    hooks.modeChange.tap((prev, next) => {
      if (prev === CanvasMode.DRAW_RECT) {
        this.unregister();
        this.#pen.destroy?.();
        this.#pen = undefined;
      }
      if (next === CanvasMode.DRAW_RECT) {
        this.register();
        this.setPen(next);
      }
    });
  }

  private setPen(mode: CanvasMode) {
    const { root } = this.#context;

    if (mode === CanvasMode.DRAW_RECT) {
      this.#pen = new RectPen(this.#context.api, this.#activePenLayer);
    }

    let toPaint: Shape;

    const onStart = (state: PenState) => {
      this.renderPen(state);
      // @ts-expect-error - CustomEventInit is not defined
      this.#startEvent.detail = state;
      root.dispatchEvent(this.#startEvent);

      if (mode === CanvasMode.DRAW_RECT) {
        toPaint = new Path({
          d: `M${state.points[0].x},${state.points[0].y}L${state.points[1].x},${state.points[1].y}L${state.points[2].x},${state.points[2].y}L${state.points[3].x},${state.points[3].y}Z`,
          fill: 'transparent',
          stroke: 'black',
          selectable: true,
          sizeAttenuation: true,
        });
      }
      root.appendChild(toPaint);
    };

    const onMove = (state: PenState) => {
      this.renderPen(state);
      // @ts-expect-error - CustomEventInit is not defined
      this.#moveEvent.detail = state;
      root.dispatchEvent(this.#moveEvent);
    };

    const onModified = (state: PenState) => {
      this.renderPen(state);
      // @ts-expect-error - CustomEventInit is not defined
      this.#modifiedEvent.detail = state;
      root.dispatchEvent(this.#modifiedEvent);

      if (mode === CanvasMode.DRAW_RECT) {
        (
          toPaint as Path
        ).d = `M${state.points[0].x},${state.points[0].y}L${state.points[1].x},${state.points[1].y}L${state.points[2].x},${state.points[2].y}L${state.points[3].x},${state.points[3].y}Z`;
      }
    };

    const onComplete = (state: PenState) => {
      this.hidePen(state);
      // @ts-expect-error - CustomEventInit is not defined
      this.#completeEvent.detail = state;
      root.dispatchEvent(this.#completeEvent);
    };

    const onCancel = (state: PenState) => {
      this.hidePen(state);
      // @ts-expect-error - CustomEventInit is not defined
      this.#cancelEvent.detail = state;
      root.dispatchEvent(this.#cancelEvent);

      root.removeChild(toPaint);
    };

    this.#pen.on(PenEvent.START, onStart);
    this.#pen.on(PenEvent.MODIFIED, onModified);
    this.#pen.on(PenEvent.MOVE, onMove);
    this.#pen.on(PenEvent.COMPLETE, onComplete);
    this.#pen.on(PenEvent.CANCEL, onCancel);
  }

  private hidePen(state: PenState) {
    this.#pen.hide();
  }

  private renderPen(state: PenState) {
    this.#pen.render(state, {
      fill: 'none',
      stroke: 'black',
      sizeAttenuation: true,
    });
  }
}
