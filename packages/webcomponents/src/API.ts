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
  Name,
  EntityCommands,
} from '@infinite-canvas-tutorial/ecs';
import { type LitElement } from 'lit';
import { Event } from './event';
import { Container } from './components';
import {
  AppStateChange,
  ElementsChange,
  History,
  Store,
  StoreIncrementEvent,
} from './history';
import { AppState, getDefaultAppState, Task } from './context';
import { arrayToMap } from './utils';

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
  #idEntityMap: Map<string, EntityCommands>;
  #history = new History();
  #store = new Store();

  appState: AppState;
  nodes: SerializedNode[];

  /**
   * Injected from the LitElement's context provider.
   */
  getAppState: () => AppState;
  setAppState: (appState: AppState) => void;
  getNodes: () => SerializedNode[];
  setNodes: (nodes: SerializedNode[]) => void;

  constructor(
    private readonly element: LitElement,
    private readonly commands: Commands,
  ) {
    this.appState = getDefaultAppState();

    this.#store.onStoreIncrementEmitter.on(StoreIncrementEvent, (event) => {
      debugger;
      this.#history.record(event.elementsChange, event.appStateChange);
    });
  }

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

  /**
   * ZoomLevel system will handle the zoom level.
   */
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
    Object.assign(this.#canvasEntity.write(Canvas), {
      width,
      height,
    });

    this.element.dispatchEvent(
      new CustomEvent(Event.RESIZED, {
        detail: { width, height },
      }),
    );
  }

  setPen(pen: Pen) {
    Object.assign(this.#canvasEntity.write(Canvas), {
      pen,
    });

    const prevAppState = this.getAppState();
    this.setAppState({
      ...prevAppState,
      penbarSelected: [pen],
    });

    this.#store.shouldCaptureIncrement();
    this.#store.commit(arrayToMap(this.getNodes()), this.getAppState());

    this.element.dispatchEvent(
      new CustomEvent(Event.PEN_CHANGED, {
        detail: { selected: [pen] },
      }),
    );
  }

  setTaskbars(selected: Task[]) {
    const prevAppState = this.getAppState();
    this.setAppState({
      ...prevAppState,
      taskbarSelected: selected,
    });

    this.element.dispatchEvent(
      new CustomEvent(Event.TASK_CHANGED, {
        detail: { selected },
      }),
    );
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

  /**
   * Select nodes.
   */
  selectNodes(selected: SerializedNode['id'][], preserveSelection = false) {
    // TODO: select nodes in the canvas.
    const prevAppState = this.getAppState();

    this.setAppState({
      ...prevAppState,
      layersSelected: preserveSelection
        ? [...prevAppState.layersSelected, ...selected]
        : selected,
    });

    this.element.dispatchEvent(
      new CustomEvent(Event.SELECTED_NODES_CHANGED, {
        detail: { selected, preserveSelection },
      }),
    );
  }

  /**
   * If diff is provided, no need to calculate diffs.
   */
  updateNode(node: SerializedNode, diff?: Partial<SerializedNode>) {
    const entity = this.#idEntityMap.get(node.id).id();

    let updated = node;
    if (diff) {
      const { name, visibility } = diff;

      if (name) {
        entity.write(Name).value = name;
      }
      if (visibility) {
        entity.write(Visibility).value = visibility;
      }

      updated = {
        ...node,
        ...diff,
      } as SerializedNode;
    }

    const nodes = this.getNodes();
    const index = nodes.findIndex((n) => n.id === updated.id);
    if (index !== -1) {
      nodes[index] = updated;
      this.setNodes(nodes);
    }

    this.#store.shouldCaptureIncrement();
    this.#store.commit(arrayToMap(this.getNodes()), this.getAppState());

    this.element.dispatchEvent(
      new CustomEvent(Event.NODE_UPDATED, {
        detail: {
          node: updated,
        },
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
    this.nodes = nodes;

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
    this.setNodes(nodes);

    this.#store.shouldUpdateSnapshot();
    this.#store.commit(arrayToMap(this.getNodes()), this.getAppState());

    this.element.dispatchEvent(
      new CustomEvent(Event.NODES_UPDATED, {
        detail: {
          nodes,
        },
      }),
    );
  }

  undo() {
    this.#history.undo(
      arrayToMap(this.getNodes()),
      this.getAppState(),
      this.#store.snapshot,
    );
  }

  redo() {
    this.#history.redo(
      arrayToMap(this.getNodes()),
      this.getAppState(),
      this.#store.snapshot,
    );
  }
}
