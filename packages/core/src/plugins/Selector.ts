import { CanvasMode } from '../Canvas';
import { CustomEvent, FederatedPointerEvent } from '../events';
import {
  Circle,
  Ellipse,
  Group,
  Rect,
  RoughCircle,
  RoughEllipse,
  RoughRect,
  Shape,
} from '../shapes';
import {
  getBBoxFromState,
  PenEvent,
  PenState,
} from '../shapes/pen/AbstractPen';
import { RectPen, RectPenStyle } from '../shapes/pen/RectPen';
import {
  AbstractSelectable,
  SelectableEvent,
  SelectableRect,
} from '../shapes/selectable';
import { Plugin, PluginContext } from './interfaces';

export interface SelectorPluginOptions {
  /**
   * How to sort selected shapes.
   * - `directional` – Sort by direction
   * - `behavior` – Sort by behavior
   */
  selectionBrushSortMode: 'directional' | 'behavior';

  /**
   * Style of the selection brush. Any style except `d` that can be applied to a Path.
   */
  selectionBrushStyle: RectPenStyle;
}

export class Selector implements Plugin {
  #options: SelectorPluginOptions;

  #selected: Shape[] = [];
  #selectableMap: Record<string, AbstractSelectable> = {};
  #context: PluginContext;

  /**
   * Brush for multi-selection.
   */
  #selectionBrush: RectPen;

  /**
   * the topmost operation layer, which will be appended to documentElement directly
   */
  #activeSelectableLayer = new Group({
    zIndex: Number.MAX_SAFE_INTEGER,
    serializable: false,
  });

  movingEvent: CustomEvent;
  movedEvent: CustomEvent;
  resizingEvent: CustomEvent;
  resizedEvent: CustomEvent;

  register: () => void;
  unregister: () => void;

  constructor(options: SelectorPluginOptions) {
    this.#options = options;
  }

  apply(context: PluginContext) {
    const {
      root,
      api: { createCustomEvent, getCanvasMode },
      hooks,
    } = context;

    function inSelectCanvasMode(fn: (e: FederatedPointerEvent) => void) {
      return (e: FederatedPointerEvent) => {
        const mode = getCanvasMode();
        if (mode !== CanvasMode.SELECT) {
          return;
        }
        fn(e);
      };
    }

    this.#context = context;
    this.#selectionBrush = new RectPen(
      context.api,
      this.#activeSelectableLayer,
    );
    this.movingEvent = createCustomEvent(SelectableEvent.MOVING);
    this.movedEvent = createCustomEvent(SelectableEvent.MOVED);
    this.resizingEvent = createCustomEvent(SelectableEvent.RESIZING);
    this.resizedEvent = createCustomEvent(SelectableEvent.RESIZED);
    root.appendChild(this.#activeSelectableLayer);

    this.register = () => {
      const unbindSelectableEvents =
        this.bindSelectableEvents(inSelectCanvasMode);
      const unbindSelectionBrush = this.bindSelectionBrush(inSelectCanvasMode);

      this.unregister = () => {
        unbindSelectableEvents();
        unbindSelectionBrush();
        this.deselectAllShapes();
        this.#selected = [];
        this.#selectableMap = {};
      };
    };

    hooks.modeChange.tap((prev, next) => {
      if (prev === CanvasMode.SELECT) {
        this.unregister();
      }
      if (next === CanvasMode.SELECT) {
        this.register();
      }
    });
  }

  private bindSelectableEvents(
    inSelectCanvasMode: (
      fn: (e: FederatedPointerEvent) => void,
    ) => (e: FederatedPointerEvent) => void,
  ) {
    const { root } = this.#context;

    const handleClick = inSelectCanvasMode((e: FederatedPointerEvent) => {
      const selected = e.target as Shape;

      if (selected === root) {
        if (!e.shiftKey) {
          this.deselectAllShapes();
          this.#selected = [];
        }
      } else if (selected.selectable) {
        if (!e.shiftKey) {
          this.deselectAllShapes();
        }

        this.selectShape(selected);
      } else if (e.shiftKey) {
        // const selectable = e
        //   .composedPath()
        //   .find((el) => el instanceof AbstractSelectable);
        // if (selectable) {
        //   const { target } = selectable.style;
        //   // if already selected, deselect it
        //   if (this.selected.indexOf(target) > -1) {
        //     this.deselectDisplayObject(target);
        //   }
        // }
      }
    });

    const handleMovingTarget = (e: CustomEvent) => {
      const target = e.target as Shape;
      // @ts-expect-error - CustomEventInit is not defined
      const { dx, dy } = e.detail;
      target.position.x += dx;
      target.position.y += dy;
    };

    const handleMovedTarget = (e: CustomEvent) => {
      const target = e.target as Shape;
      if (
        target instanceof Circle ||
        target instanceof Ellipse ||
        target instanceof RoughCircle ||
        target instanceof RoughEllipse
      ) {
        const { x: cx, y: cy } = target.worldTransform.apply({
          x: target.cx,
          y: target.cy,
        });

        target.cx = cx;
        target.cy = cy;
        target.position.x = 0;
        target.position.y = 0;
      }
    };

    const handleResizingTarget = (e: CustomEvent) => {
      const target = e.target as Shape;
      // @ts-expect-error - CustomEventInit is not defined
      const { tlX, tlY, brX, brY } = e.detail;
      const width = brX - tlX;
      const height = brY - tlY;

      if (target instanceof Circle || target instanceof RoughCircle) {
        target.cx = tlX + width / 2;
        target.cy = tlY + height / 2;
        target.r = width / 2;
      } else if (target instanceof Ellipse || target instanceof RoughEllipse) {
        target.cx = tlX + width / 2;
        target.cy = tlY + height / 2;
        target.rx = width / 2;
        target.ry = height / 2;
      } else if (target instanceof Rect || target instanceof RoughRect) {
        target.x = tlX;
        target.y = tlY;
        target.width = width;
        target.height = height;
      }
    };

    const handleResizedTarget = (e: CustomEvent) => {
      const target = e.target as Shape;
      // @ts-expect-error - CustomEventInit is not defined
      const { tlX, tlY, brX, brY } = e.detail;
      const width = brX - tlX;
      const height = brY - tlY;

      if (target instanceof Circle || target instanceof RoughCircle) {
        target.cx = tlX + width / 2;
        target.cy = tlY + height / 2;
        target.r = width / 2;
      } else if (target instanceof Ellipse || target instanceof RoughEllipse) {
        target.cx = tlX + width / 2;
        target.cy = tlY + height / 2;
        target.rx = width / 2;
        target.ry = height / 2;
      } else if (target instanceof Rect || target instanceof RoughRect) {
        target.x = tlX;
        target.y = tlY;
        target.width = width;
        target.height = height;
      }
    };

    root.addEventListener('pointerdown', handleClick);
    root.addEventListener(SelectableEvent.MOVING, handleMovingTarget);
    root.addEventListener(SelectableEvent.MOVED, handleMovedTarget);
    root.addEventListener(SelectableEvent.RESIZING, handleResizingTarget);
    root.addEventListener(SelectableEvent.RESIZED, handleResizedTarget);

    return () => {
      root.removeEventListener('pointerdown', handleClick);
      root.removeEventListener(SelectableEvent.MOVING, handleMovingTarget);
      root.removeEventListener(SelectableEvent.MOVED, handleMovedTarget);
      root.removeEventListener(SelectableEvent.RESIZING, handleResizingTarget);
      root.removeEventListener(SelectableEvent.RESIZED, handleResizedTarget);
    };
  }

  private bindSelectionBrush(
    inSelectCanvasMode: (
      fn: (e: FederatedPointerEvent) => void,
    ) => (e: FederatedPointerEvent) => void,
  ) {
    const { root, api, themeColors } = this.#context;
    const { selectionBrushSortMode, selectionBrushStyle } = this.#options;
    let selectedStack: Shape[][] = [];

    const regionQuery = (region: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    }) => {
      return api
        .elementsFromBBox(region.minX, region.minY, region.maxX, region.maxY)
        .filter((intersection) => {
          if (!intersection.selectable) {
            return false;
          }
          const { minX, minY, maxX, maxY } = intersection.getBounds();
          const isTotallyContains =
            region.minX < minX &&
            region.minY < minY &&
            region.maxX > maxX &&
            region.maxY > maxY;

          return isTotallyContains;
        });
    };

    const isSameStackItem = (a: Shape[], b: Shape[]) => {
      if (a.length === 0 && b.length === 0) {
        return true;
      }

      if (a.length !== b.length) {
        return false;
      }

      return a.every((o, i) => o === b[i]);
    };

    const sortSelectedStack = (stack: Shape[][]) => {
      for (let i = 0; i < stack.length; i++) {
        const prev = stack[i - 1];
        if (prev) {
          stack[i].sort((a, b) => {
            const indexA = prev.indexOf(a);
            const indexB = prev.indexOf(b);
            return (
              (indexA === -1 ? Infinity : indexA) -
              (indexB === -1 ? Infinity : indexB)
            );
          });
        }
      }
    };

    const handleMouseDown = inSelectCanvasMode((e: FederatedPointerEvent) => {
      if (e.button === 0 && this.selected.length === 0) {
        this.#selectionBrush?.onMouseDown(e);
      }
    });
    const handleMouseMove = inSelectCanvasMode((e: FederatedPointerEvent) => {
      this.#selectionBrush?.onMouseMove(e);
    });
    const handleMouseUp = inSelectCanvasMode((e: FederatedPointerEvent) => {
      if (e.button === 0 && this.selected.length === 0) {
        this.#selectionBrush?.onMouseUp(e);
      }
    });

    root.addEventListener('pointerdown', handleMouseDown);
    root.addEventListener('pointermove', handleMouseMove);
    root.addEventListener('pointerup', handleMouseUp);

    const onStart = (state: PenState) => {
      selectedStack = [];
      const { selectionBrushFill, selectionBrushStroke } =
        themeColors[api.getTheme()];
      this.#selectionBrush.render(state, {
        ...selectionBrushStyle,
        fill: selectionBrushFill,
        stroke: selectionBrushStroke,
        fillOpacity: 0.5,
      });
    };

    const onMove = (state: PenState) => {
      const { selectionBrushFill, selectionBrushStroke } =
        themeColors[api.getTheme()];
      this.#selectionBrush.render(state, {
        ...selectionBrushStyle,
        fill: selectionBrushFill,
        stroke: selectionBrushStroke,
        fillOpacity: 0.5,
      });
    };

    const onModify = (state: PenState) => {
      if (selectionBrushSortMode === 'behavior') {
        const region = getBBoxFromState(state);
        const selected = regionQuery(region);
        const last = selectedStack[selectedStack.length - 1];
        if (!last || !isSameStackItem(selected, last)) {
          selectedStack.push(selected);
        }
      }
      const { selectionBrushFill, selectionBrushStroke } =
        themeColors[api.getTheme()];
      this.#selectionBrush.render(state, {
        ...selectionBrushStyle,
        fill: selectionBrushFill,
        stroke: selectionBrushStroke,
        fillOpacity: 0.5,
      });
    };

    const onComplete = (state: PenState) => {
      this.#selectionBrush.hide();

      if (selectionBrushSortMode === 'behavior') {
        sortSelectedStack(selectedStack);
        selectedStack[selectedStack.length - 1].forEach((selected) => {
          this.selectShape(selected);
        });
      } else if (selectionBrushSortMode === 'directional') {
        const region = getBBoxFromState(state);

        const { start, end } = this.#selectionBrush;

        // Direction of region, horizontal or vertical?
        const direction =
          region.maxX - region.minX > region.maxY - region.minY ? 'h' : 'v';
        let sortDirection: 'lr' | 'rl' | 'tb' | 'bt';
        if (start.canvas.x < end.canvas.x && start.canvas.y < end.canvas.y) {
          if (direction === 'h') {
            sortDirection = 'lr';
          } else {
            sortDirection = 'tb';
          }
        } else if (
          start.canvas.x > end.canvas.x &&
          start.canvas.y > end.canvas.y
        ) {
          if (direction === 'h') {
            sortDirection = 'rl';
          } else {
            sortDirection = 'bt';
          }
        } else if (
          start.canvas.x < end.canvas.x &&
          start.canvas.y > end.canvas.y
        ) {
          if (direction === 'h') {
            sortDirection = 'lr';
          } else {
            sortDirection = 'bt';
          }
        } else if (
          start.canvas.x > end.canvas.x &&
          start.canvas.y < end.canvas.y
        ) {
          if (direction === 'h') {
            sortDirection = 'rl';
          } else {
            sortDirection = 'tb';
          }
        }

        regionQuery(region)
          .sort((a, b) => {
            const bboxA = a.getBounds();
            const bboxB = b.getBounds();
            if (sortDirection === 'lr') {
              return bboxA.minX - bboxB.minX;
            }
            if (sortDirection === 'rl') {
              return bboxB.maxX - bboxA.maxX;
            }
            if (sortDirection === 'tb') {
              return bboxA.minY - bboxB.minY;
            }
            if (sortDirection === 'bt') {
              return bboxB.maxY - bboxA.maxY;
            }

            return null;
          })
          .filter((item) => item !== null)
          .forEach((selected) => {
            this.selectShape(selected);
          });
      }
    };

    const onCancel = () => {
      this.#selectionBrush.hide();
    };

    this.#selectionBrush.on(PenEvent.START, onStart);
    this.#selectionBrush.on(PenEvent.MODIFIED, onModify);
    this.#selectionBrush.on(PenEvent.MOVE, onMove);
    this.#selectionBrush.on(PenEvent.COMPLETE, onComplete);
    this.#selectionBrush.on(PenEvent.CANCEL, onCancel);

    return () => {
      this.#selectionBrush.off(PenEvent.START, onStart);
      this.#selectionBrush.off(PenEvent.MODIFIED, onModify);
      this.#selectionBrush.off(PenEvent.MOVE, onMove);
      this.#selectionBrush.off(PenEvent.COMPLETE, onComplete);
      this.#selectionBrush.off(PenEvent.CANCEL, onCancel);

      root.removeEventListener('pointerdown', handleMouseDown);
      root.removeEventListener('pointermove', handleMouseMove);
      root.removeEventListener('pointerup', handleMouseUp);
    };
  }

  get selected() {
    return this.#selected;
  }

  getOrCreateSelectable(shape: Shape): AbstractSelectable {
    if (!this.#selectableMap[shape.uid]) {
      const created = new SelectableRect({
        target: shape,
      });

      if (created) {
        created.plugin = this;
        this.#selectableMap[shape.uid] = created;
        this.#activeSelectableLayer.appendChild(created);
      }
    }

    // const selectable = this.#selectableMap[shape.uid] as AbstractSelectable;
    // this.updateMidAnchorsVisibility(selectable);
    // this.updateRotateAnchorVisibility(selectable);

    return this.#selectableMap[shape.uid];
  }

  selectShape(shape: Shape) {
    const selectable = this.getOrCreateSelectable(shape);
    if (selectable && this.#selected.indexOf(shape) === -1) {
      selectable.visible = true;
      this.#selected.push(shape);

      const {
        root,
        api: { createCustomEvent },
      } = this.#context;
      root.dispatchEvent(createCustomEvent('selected', shape));
    }
  }

  deselectShape(shape: Shape) {
    const index = this.#selected.indexOf(shape);
    if (index > -1) {
      const selectable = this.getOrCreateSelectable(
        shape,
      ) as AbstractSelectable;
      if (selectable) {
        // deselect all anchors
        // selectable.selectedAnchors.forEach((anchor) => {
        //   selectable.deselectAnchor(anchor);
        // });

        selectable.visible = false;
      }
      this.#selected.splice(index, 1);

      const {
        root,
        api: { createCustomEvent },
      } = this.#context;
      root.dispatchEvent(createCustomEvent('deselected', shape));
    }
  }

  deselectAllShapes() {
    [...this.#selected].forEach((target) => {
      this.deselectShape(target);
    });
  }
}
