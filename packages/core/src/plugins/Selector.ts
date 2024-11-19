import { CanvasMode } from '../Canvas';
import { FederatedPointerEvent } from '../events';
import { Group, Shape } from '../shapes';
import { AbstractSelectable, SelectableRect } from '../shapes/selectable';
import { Plugin, PluginContext } from './interfaces';

export class Selector implements Plugin {
  #selected: Shape[] = [];
  #selectableMap: Record<string, AbstractSelectable> = {};
  #enableContinuousBrush = true;

  /**
   * the topmost operation layer, which will be appended to documentElement directly
   */
  #activeSelectableLayer = new Group({
    zIndex: Number.MAX_SAFE_INTEGER,
  });

  apply(context: PluginContext) {
    const {
      root,
      api: { getCanvasMode },
    } = context;

    const handleClick = (e: FederatedPointerEvent) => {
      const mode = getCanvasMode();
      if (mode !== CanvasMode.SELECT) {
        return;
      }

      const selected = e.target as Shape;

      if (selected === root) {
        if (!e.shiftKey || (e.shiftKey && !this.#enableContinuousBrush)) {
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

    root.addEventListener('click', handleClick);

    root.appendChild(this.#activeSelectableLayer);
  }

  private getOrCreateSelectable(shape: Shape): AbstractSelectable {
    if (!this.#selectableMap[shape.uid]) {
      const created = new SelectableRect({
        target: shape,
      });

      if (created) {
        // created.plugin = this;
        this.#selectableMap[shape.uid] = created;
        this.#activeSelectableLayer.appendChild(created);
      }
    }

    // const selectable = this.#selectableMap[shape.uid] as AbstractSelectable;
    // this.updateMidAnchorsVisibility(selectable);
    // this.updateRotateAnchorVisibility(selectable);

    return this.#selectableMap[shape.uid];
  }

  private selectShape(shape: Shape) {
    const selectable = this.getOrCreateSelectable(shape);
    if (selectable && this.#selected.indexOf(shape) === -1) {
      selectable.visible = true;
      this.#selected.push(shape);
    }
  }

  private deselectShape(shape: Shape) {
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
    }
  }

  private deselectAllShapes() {
    [...this.#selected].forEach((target) => {
      this.deselectShape(target);
    });
  }
}
