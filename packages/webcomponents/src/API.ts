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

  zoomTo(zoom: number) {
    this.element.dispatchEvent(
      new CustomEvent(Event.ZOOM_TO, {
        detail: {
          zoom,
        },
      }),
    );
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

  selectNodes(selected: SerializedNode['id'][], preserveSelection = false) {
    super.selectNodes(selected, preserveSelection);

    this.element.dispatchEvent(
      new CustomEvent(Event.SELECTED_NODES_CHANGED, {
        detail: { selected, preserveSelection },
      }),
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

  //   /**
  //    * If diff is provided, no need to calculate diffs.
  //    */
  //   updateNode(node: SerializedNode, diff?: Partial<SerializedNode>) {
  //     const entity = this.#idEntityMap.get(node.id)?.id();
  //     const nodes = this.getNodes();

  //     if (!entity) {
  //       const { cameras } = this.#canvasEntity.read(Canvas);
  //       if (cameras.length === 0) {
  //         throw new Error('No camera found');
  //       }

  //       // TODO: Support multiple cameras.
  //       const camera = cameras[0];
  //       const cameraEntityCommands = this.commands.entity(camera);

  //       // TODO: Calculate diffs and only update the changed nodes.
  //       const { entities, idEntityMap } = serializedNodesToEntities(
  //         [node],
  //         this.commands,
  //       );
  //       this.#idEntityMap.set(node.id, idEntityMap.get(node.id));

  //       this.commands.execute();

  //       entities.forEach((entity) => {
  //         // Append roots to the camera.
  //         if (!entity.has(Children)) {
  //           cameraEntityCommands.appendChild(this.commands.entity(entity));
  //         }
  //       });

  //       this.commands.execute();

  //       this.setNodes([...nodes, node]);

  //       this.element.dispatchEvent(
  //         new CustomEvent(Event.NODE_UPDATED, {
  //           detail: {
  //             node,
  //           },
  //         }),
  //       );
  //     } else {
  //       const updated = mutateElement(entity, node, diff);
  //       const index = nodes.findIndex((n) => n.id === updated.id);

  //       if (index !== -1) {
  //         nodes[index] = updated;
  //         this.setNodes(nodes);
  //       }

  //       this.element.dispatchEvent(
  //         new CustomEvent(Event.NODE_UPDATED, {
  //           detail: {
  //             node: updated,
  //           },
  //         }),
  //       );
  //     }
  //   }
}
