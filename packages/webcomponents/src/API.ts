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
  EntityCommands,
  Grid,
  CheckboardStyle,
  ToBeDeleted,
} from '@infinite-canvas-tutorial/ecs';
import { type LitElement } from 'lit';
import { Event } from './event';
import { Container } from './components';
import {
  History,
  mutateElement,
  Store,
  StoreIncrementEvent,
  CaptureUpdateAction,
  CaptureUpdateActionType,
  Snapshot,
} from './history';
import { AppState, Task } from './context';
import { arrayToMap, mapToArray } from './utils';

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
  #store = new Store(this);

  /**
   * Injected from the LitElement's context provider.
   */
  getAppState: () => AppState;
  setAppState: (appState: AppState) => void;
  getNodes: () => SerializedNode[];
  setNodes: (nodes: SerializedNode[]) => void;

  onchange: (snapshot: Snapshot) => void;

  constructor(
    private readonly element: LitElement,
    private readonly commands: Commands,
  ) {
    this.#store.onStoreIncrementEmitter.on(StoreIncrementEvent, (event) => {
      this.#history.record(event.elementsChange, event.appStateChange);

      this.onchange?.(this.#store.snapshot);
    });
  }

  getElement() {
    return this.element;
  }

  getEntityCommands() {
    return this.#idEntityMap;
  }

  getEntity(node: SerializedNode) {
    return this.#idEntityMap.get(node.id).id();
  }

  getNodeById(id: string) {
    return this.getNodes().find((node) => node.id === id);
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
   * @see https://infinitecanvas.cc/guide/lesson-004
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

  /**
   * Resize the canvas.
   * @see https://infinitecanvas.cc/guide/lesson-001
   */
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

  /**
   * Set the checkboard style.
   * @see https://infinitecanvas.cc/guide/lesson-005
   */
  setCheckboardStyle(checkboardStyle: CheckboardStyle) {
    Object.assign(this.#canvasEntity.write(Grid), {
      checkboardStyle,
    });

    const prevAppState = this.getAppState();
    this.setAppState({
      ...prevAppState,
      checkboardStyle,
    });

    this.element.dispatchEvent(
      new CustomEvent(Event.CHECKBOARD_STYLE_CHANGED, {
        detail: { checkboardStyle },
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

  setPropertiesOpened(propertiesOpened: SerializedNode['id'][]) {
    const prevAppState = this.getAppState();
    this.setAppState({
      ...prevAppState,
      propertiesOpened,
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

    const updated = mutateElement(entity, node, diff);

    const nodes = this.getNodes();
    const index = nodes.findIndex((n) => n.id === updated.id);

    if (index !== -1) {
      nodes[index] = updated;
      this.setNodes(nodes);
    }

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

    this.element.dispatchEvent(
      new CustomEvent(Event.NODES_UPDATED, {
        detail: {
          nodes,
        },
      }),
    );
  }

  deleteNodesById(ids: SerializedNode['id'][]) {
    const nodes = this.getNodes();
    const index = nodes.findIndex((n) => ids.includes(n.id));
    if (index !== -1) {
      nodes.splice(index, 1);
    }

    ids.forEach((id) => {
      const entity = this.#idEntityMap.get(id);
      if (entity) {
        // entity.id().delete();
        entity.id().add(ToBeDeleted);
      }
      this.#idEntityMap.delete(id);
    });

    this.setNodes(nodes);

    this.element.dispatchEvent(
      new CustomEvent(Event.NODE_DELETED, {
        detail: {
          nodes,
        },
      }),
    );
  }

  /**
   * Record the current state of the canvas.
   * @param captureUpdateAction Record the changes immediately or never.
   */
  record(
    captureUpdateAction: CaptureUpdateActionType = CaptureUpdateAction.IMMEDIATELY,
  ) {
    if (
      captureUpdateAction === CaptureUpdateAction.NEVER ||
      this.#store.snapshot.isEmpty()
    ) {
      this.#store.shouldUpdateSnapshot();
    } else {
      this.#store.shouldCaptureIncrement();
    }
    this.#store.commit(arrayToMap(this.getNodes()), this.getAppState());
  }

  undo() {
    const result = this.#history.undo(
      arrayToMap(this.getNodes()),
      this.getAppState(),
      this.#store.snapshot,
    );

    if (result) {
      const [elements, appState] = result;
      this.setNodes(mapToArray(elements));
      this.setAppState(appState);
    }
  }

  redo() {
    const result = this.#history.redo(
      arrayToMap(this.getNodes()),
      this.getAppState(),
      this.#store.snapshot,
    );

    if (result) {
      const [elements, appState] = result;
      this.setNodes(mapToArray(elements));
      this.setAppState(appState);
    }
  }

  isUndoStackEmpty() {
    return this.#history.isUndoStackEmpty;
  }

  isRedoStackEmpty() {
    return this.#history.isRedoStackEmpty;
  }

  clearHistory() {
    this.#history.clear();
  }
}
