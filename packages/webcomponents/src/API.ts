import {
  Canvas,
  ComputedCamera,
  Pen,
  SerializedNode,
  CheckboardStyle,
  API,
  Task,
  StateManagement,
  Commands,
} from '@infinite-canvas-tutorial/ecs';
import { type LitElement } from 'lit';
import { Event } from './event';

/**
 * Since the canvas is created in the system, we need to store them here for later use.
 */
export const pendingCanvases: {
  container: LitElement;
  canvas: Partial<Canvas>;
  camera: Partial<ComputedCamera>;
}[] = [];

/**
 * Emit CustomEvents for the canvas.
 */
export class ExtendedAPI extends API {
  constructor(
    stateManagement: StateManagement,
    commands: Commands,
    public element: LitElement,
  ) {
    super(stateManagement, commands);
  }

  resizeCanvas(width: number, height: number) {
    super.resizeCanvas(width, height);

    this.element.dispatchEvent(
      new CustomEvent(Event.RESIZED, { detail: { width, height } }),
    );
  }

  setCheckboardStyle(checkboardStyle: CheckboardStyle) {
    super.setCheckboardStyle(checkboardStyle);

    this.element.dispatchEvent(
      new CustomEvent(Event.CHECKBOARD_STYLE_CHANGED, {
        detail: { checkboardStyle },
      }),
    );
  }

  setPen(pen: Pen) {
    super.setPen(pen);

    this.element.dispatchEvent(
      new CustomEvent(Event.PEN_CHANGED, {
        detail: { selected: [pen] },
      }),
    );
  }

  setTaskbars(selected: Task[]) {
    super.setTaskbars(selected);

    this.element.dispatchEvent(
      new CustomEvent(Event.TASK_CHANGED, { detail: { selected } }),
    );
  }

  selectNodes(
    selected: SerializedNode[],
    preserveSelection = false,
    updateAppState = true,
  ) {
    super.selectNodes(selected, preserveSelection, updateAppState);

    this.element.dispatchEvent(
      new CustomEvent(Event.SELECTED_NODES_CHANGED, {
        detail: { selected, preserveSelection },
      }),
    );
  }

  updateNode(node: SerializedNode, diff?: Partial<SerializedNode>) {
    super.updateNode(node, diff);

    this.element.dispatchEvent(
      new CustomEvent(Event.NODE_UPDATED, { detail: { node } }),
    );
  }

  updateNodes(nodes: SerializedNode[]) {
    super.updateNodes(nodes);

    this.element.dispatchEvent(
      new CustomEvent(Event.NODES_UPDATED, {
        detail: {
          nodes,
        },
      }),
    );
  }

  deleteNodesById(ids: SerializedNode['id'][]) {
    const nodes = super.deleteNodesById(ids);

    this.element.dispatchEvent(
      new CustomEvent(Event.NODE_DELETED, {
        detail: {
          nodes,
        },
      }),
    );

    return nodes;
  }

  /**
   * Delete Canvas component
   */
  destroy() {
    super.destroy();
    this.element.dispatchEvent(new CustomEvent(Event.DESTROY));
  }
}
