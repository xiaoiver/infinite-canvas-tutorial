import { CanvasMode } from '../Canvas';
import { FederatedPointerEvent } from '../events';
import { Group } from '../shapes';
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
  });

  constructor(options: PainterPluginOptions) {
    this.#options = options;
  }

  apply(context: PluginContext) {
    const {
      root,
      api: { getCanvasMode },
      hooks,
    } = context;
    this.#context = context;
    root.appendChild(this.#activePenLayer);

    function inPainterCanvasMode(fn: (e: FederatedPointerEvent) => void) {
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

    hooks.init.tap(() => {
      root.addEventListener('click', handleClick);
      root.addEventListener('pointerdown', handlePointerDown);
      root.addEventListener('pointermove', handlePointerMove);
      root.addEventListener('pointerup', handlePointerUp);

      // canvas.document.addEventListener('pointerenter', handleCanvasEnter);
      // canvas.document.addEventListener('pointerleave', handleCanvasLeave);
      // window.addEventListener('keydown', handleKeyDown);
    });

    hooks.destroy.tap(() => {
      root.removeEventListener('click', handleClick);
      root.removeEventListener('pointerdown', handlePointerDown);
      root.removeEventListener('pointermove', handlePointerMove);
      root.removeEventListener('pointerup', handlePointerUp);

      // canvas.document.removeEventListener('pointerenter', handleCanvasEnter);
      // canvas.document.removeEventListener('pointerleave', handleCanvasLeave);
      // window.removeEventListener('keydown', handleKeyDown);
    });
  }

  setPen(mode: CanvasMode) {
    if (this.#pen) {
      this.#pen.destroy();
    }

    if (mode === CanvasMode.DRAW_RECT) {
      this.#pen = new RectPen(this.#context.api, this.#activePenLayer);
    }

    const onStart = (state: PenState) => {
      this.renderPen(state);
    };

    const onMove = (state: PenState) => {
      this.renderPen(state);
    };

    const onModify = (state: PenState) => {
      this.renderPen(state);
    };

    const onComplete = (state: PenState) => {
      this.hidePen(state);
    };

    const onCancel = (state: PenState) => {
      this.hidePen(state);
    };

    this.#pen.on(PenEvent.START, onStart);
    this.#pen.on(PenEvent.MODIFIED, onModify);
    this.#pen.on(PenEvent.MOVE, onMove);
    this.#pen.on(PenEvent.COMPLETE, onComplete);
    this.#pen.on(PenEvent.CANCEL, onCancel);

    this.#context.api.setCursor('crosshair');
  }

  clearPen() {
    this.#pen = undefined;
    this.#context.api.setCursor('default');
  }

  private hidePen(state: PenState) {
    this.#pen.hide();
  }

  private renderPen(state: PenState) {
    this.#pen.render(state, {
      fill: 'black',
      stroke: 'black',
      fillOpacity: 0.5,
    });
  }
}
