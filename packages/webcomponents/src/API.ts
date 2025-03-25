import {
  Camera,
  Canvas,
  Children,
  Commands,
  ComputedCamera,
  Cursor,
  Entity,
  Pen,
  SerializedNode,
  serializedNodesToEntities,
  Transform,
  Visibility,
  EntityCommands,
} from '@infinite-canvas-tutorial/ecs';
import { type LitElement } from 'lit';
import { Event } from './event';
import { Container } from './components';

/**
 * Since the canvas is created in the system, we need to store them here for later use.
 */
export const pendingCanvases: {
  container: LitElement;
  canvas: Partial<Canvas>;
  camera: Partial<ComputedCamera>;
}[] = [];

/**
 * Expose the API to the outside world.
 *
 * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api
 */
export class API {
  #canvasEntity: Entity;
  #idEntityMap: Map<number, EntityCommands>;

  constructor(
    private readonly element: LitElement,
    private readonly commands: Commands,
  ) {}

  /**
   * Create a new canvas.
   */
  createCanvas(canvasProps: Partial<Canvas>) {
    const canvas = this.commands.spawn(new Canvas(canvasProps)).id();
    canvas.add(Container, { element: this.element });

    this.#canvasEntity = canvas.hold();
  }

  /**
   * Create a new camera.
   */
  createCamera(cameraProps: Partial<ComputedCamera>) {
    const { zoom } = cameraProps;
    this.commands.spawn(
      new Camera({
        canvas: this.#canvasEntity,
      }),
      new Transform({
        scale: {
          x: 1 / zoom,
          y: 1 / zoom,
        },
      }),
    );
  }

  /**
   * Create a new landmark.
   */
  createLandmark() {}

  /**
   * Go to a landmark.
   */
  gotoLandmark() {}

  resizeCanvas(width: number, height: number) {
    Object.assign(this.#canvasEntity.write(Canvas), {
      width,
      height,
    });

    this.element.dispatchEvent(
      new CustomEvent(Event.RESIZED, {
        detail: { width, height },
        bubbles: true,
        composed: true,
      }),
    );
  }

  setPen(pen: Pen) {
    Object.assign(this.#canvasEntity.write(Canvas), {
      pen,
    });
  }

  /**
   * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#setcursor
   */
  setCursor(cursor: string) {
    if (!this.#canvasEntity.has(Cursor)) {
      this.#canvasEntity.add(Cursor);
    }

    Object.assign(this.#canvasEntity.write(Cursor), {
      value: cursor,
    });
  }

  /**
   * Delete Canvas component
   */
  destroy() {
    this.#canvasEntity.delete();
    this.element.dispatchEvent(new CustomEvent(Event.DESTROY));
  }

  toggleVisibility(nodeId: SerializedNode['id']) {
    const entity = this.#idEntityMap.get(nodeId).id();

    const visibility = entity.write(Visibility);

    visibility.value = visibility.value === 'visible' ? 'hidden' : 'visible';

    // this.element.dispatchEvent(
    //   new CustomEvent(Event.VISIBILITY_CHANGED, {
    //     detail: {
    //       // visible: !this.node.visible,
    //     },
    //     bubbles: true,
    //     composed: true,
    //     cancelable: true,
    //   }),
    // );
  }

  /**
   * Select nodes.
   */
  selectNodes(nodeIds: SerializedNode['id'][], preserveSelection = false) {
    // TODO: select nodes in the canvas.

    this.element.dispatchEvent(
      new CustomEvent(Event.SELECTED_NODES_CHANGED, {
        detail: { selected: nodeIds, preserveSelection },
      }),
    );
  }

  /**
   * Update the scene with new nodes.
   * It will calculate diffs and only update the changed nodes.
   *
   * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#updatescene
   */
  updateNodes(nodes: SerializedNode[]) {
    const { cameras } = this.#canvasEntity.read(Canvas);
    if (cameras.length === 0) {
      throw new Error('No camera found');
    }

    // TODO: Support multiple cameras.
    const camera = cameras[0];
    const cameraEntityCommands = this.commands.entity(camera);

    // TODO: Calculate diffs and only update the changed nodes.
    const { entities, idEntityMap } = serializedNodesToEntities(
      nodes,
      this.commands,
    );
    this.#idEntityMap = idEntityMap;

    this.commands.execute();

    entities.forEach((entity) => {
      // Append roots to the camera.
      if (!entity.has(Children)) {
        cameraEntityCommands.appendChild(this.commands.entity(entity));
      }
    });

    this.commands.execute();

    this.element.dispatchEvent(
      new CustomEvent(Event.NODES_UPDATED, {
        detail: {
          nodes,
        },
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
  }
}
