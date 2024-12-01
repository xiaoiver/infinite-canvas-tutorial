import { CanvasMode } from '../Canvas';
import { CustomEvent, FederatedPointerEvent } from '../events';
import {
  Circle,
  Ellipse,
  Group,
  RoughCircle,
  RoughEllipse,
  Shape,
} from '../shapes';
import {
  AbstractSelectable,
  SelectableEvent,
  SelectableRect,
} from '../shapes/selectable';
import { Plugin, PluginContext } from './interfaces';

export class Selector implements Plugin {
  #selected: Shape[] = [];
  #selectableMap: Record<string, AbstractSelectable> = {};
  #context: PluginContext;

  /**
   * the topmost operation layer, which will be appended to documentElement directly
   */
  #activeSelectableLayer = new Group({
    zIndex: Number.MAX_SAFE_INTEGER,
  });

  movingEvent: CustomEvent;
  movedEvent: CustomEvent;

  apply(context: PluginContext) {
    const {
      root,
      api: { getCanvasMode, createCustomEvent },
    } = context;

    this.#context = context;

    this.movingEvent = createCustomEvent(SelectableEvent.MOVING);
    this.movedEvent = createCustomEvent(SelectableEvent.MOVED);

    const handleClick = (e: FederatedPointerEvent) => {
      const mode = getCanvasMode();
      if (mode !== CanvasMode.SELECT) {
        return;
      }

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
    };

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

    const handleResizedTarget = (e: CustomEvent) => {
      // const target = e.target as Shape;
    };

    root.addEventListener('click', handleClick);
    root.addEventListener(SelectableEvent.MOVING, handleMovingTarget);
    root.addEventListener(SelectableEvent.MOVED, handleMovedTarget);
    root.addEventListener(SelectableEvent.RESIZED, handleResizedTarget);

    root.appendChild(this.#activeSelectableLayer);
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
    }

    const {
      root,
      api: { createCustomEvent },
    } = this.#context;

    root.dispatchEvent(createCustomEvent('selected', shape));
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
