import { Entity } from '@lastolivegames/becsy';
import {
  CaptureUpdateAction,
  CaptureUpdateActionType,
  Store,
  StoreIncrementEvent,
} from './history/Store';
import { Commands, EntityCommands } from './commands';
import { AppState, getDefaultAppState, Task } from './context';
import { SerializedNode, serializedNodesToEntities } from './utils';
import {
  Camera,
  Canvas,
  CheckboardStyle,
  Children,
  ComputedCamera,
  Cursor,
  Grid,
  Pen,
  RasterScreenshotRequest,
  Selected,
  ToBeDeleted,
  Transform,
  VectorScreenshotRequest,
} from './components';
import { History, mutateElement, safeAddComponent } from './history';

export interface StateManagement {
  getAppState: () => AppState;
  setAppState: (appState: AppState) => void;
  getNodes: () => SerializedNode[];
  setNodes: (nodes: SerializedNode[]) => void;
  onChange: (snapshot: { appState: AppState; nodes: SerializedNode[] }) => void;
}

export enum ExportFormat {
  SVG = 'svg',
  PNG = 'png',
  JPEG = 'jpeg',
}

export class DefaultStateManagement implements StateManagement {
  #appState = getDefaultAppState();
  #nodes: SerializedNode[] = [];

  getAppState() {
    return this.#appState;
  }

  setAppState(appState: AppState) {
    this.#appState = appState;
  }

  getNodes() {
    return this.#nodes;
  }

  setNodes(nodes: SerializedNode[]) {
    this.#nodes = nodes;
  }

  onChange(snapshot: { appState: AppState; nodes: SerializedNode[] }) {}
}

export const mapToArray = <T extends { id: string } | string>(
  map: Map<string, T>,
) => Array.from(map.values());

/**
 * Transforms array of objects containing `id` attribute,
 * or array of ids (strings), into a Map, keyd by `id`.
 */
export const arrayToMap = <T extends { id: string } | string>(
  items: readonly T[] | Map<string, T>,
) => {
  if (items instanceof Map) {
    return items;
  }
  return items.reduce((acc: Map<string, T>, element) => {
    acc.set(typeof element === 'string' ? element : element.id, element);
    return acc;
  }, new Map());
};

/**
 * Expose the API to the outside world.
 *
 * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api
 */
export class API {
  #canvas: Entity;
  #camera: Entity;
  #idEntityMap: Map<string, EntityCommands> = new Map();
  #history = new History();
  #store = new Store(this);

  constructor(
    private readonly stateManagement: StateManagement,
    private readonly commands: Commands,
  ) {
    this.#store.onStoreIncrementEmitter.on(StoreIncrementEvent, (event) => {
      this.#history.record(event.elementsChange, event.appStateChange);

      this.stateManagement.onChange?.({
        appState: this.getAppState(),
        nodes: this.getNodes(),
      });
    });
  }

  getAppState() {
    return this.stateManagement.getAppState();
  }

  setAppState(appState: AppState) {
    this.stateManagement.setAppState(appState);
  }

  getNodes() {
    return this.stateManagement.getNodes();
  }

  setNodes(nodes: SerializedNode[]) {
    this.stateManagement.setNodes(JSON.parse(JSON.stringify(nodes)));
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

  getNodeByEntity(entity: Entity) {
    for (const [id, entityCommands] of this.#idEntityMap.entries()) {
      if (entityCommands.id() === entity) {
        return this.getNodeById(id);
      }
    }
  }

  getCanvas() {
    return this.#canvas;
  }

  /**
   * Create a new canvas.
   */
  createCanvas(canvasProps: Partial<Canvas>) {
    this.#canvas = this.commands.spawn(new Canvas(canvasProps)).id().hold();

    this.commands.execute();

    return this.#canvas;
  }

  /**
   * Create a new camera.
   */
  createCamera(cameraProps: Partial<ComputedCamera>) {
    const { zoom } = cameraProps;
    this.#camera = this.commands
      .spawn(
        new Camera({
          canvas: this.#canvas,
        }),
        new Transform({
          scale: {
            x: 1 / zoom,
            y: 1 / zoom,
          },
        }),
      )
      .id()
      .hold();

    this.commands.execute();

    return this.#camera;
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
    // TODO: Implement zoom to.
  }

  /**
   * Resize the canvas.
   * @see https://infinitecanvas.cc/guide/lesson-001
   */
  resizeCanvas(width: number, height: number) {
    Object.assign(this.#canvas.write(Canvas), {
      width,
      height,
    });
  }

  /**
   * Set the checkboard style.
   * @see https://infinitecanvas.cc/guide/lesson-005
   */
  setCheckboardStyle(checkboardStyle: CheckboardStyle) {
    Object.assign(this.#canvas.write(Grid), {
      checkboardStyle,
    });

    const prevAppState = this.getAppState();
    this.setAppState({
      ...prevAppState,
      checkboardStyle,
    });
  }

  setPen(pen: Pen) {
    Object.assign(this.#canvas.write(Canvas), {
      pen,
    });

    const prevAppState = this.getAppState();
    this.setAppState({
      ...prevAppState,
      penbarSelected: [pen],
    });
  }

  setTaskbars(selected: Task[]) {
    const prevAppState = this.getAppState();
    this.setAppState({
      ...prevAppState,
      taskbarSelected: selected,
    });
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
    if (!this.#canvas.has(Cursor)) {
      this.#canvas.add(Cursor);
    }

    Object.assign(this.#canvas.write(Cursor), {
      value: cursor,
    });
  }

  /**
   * Select nodes.
   */
  selectNodes(selected: SerializedNode['id'][], preserveSelection = false) {
    if (!preserveSelection) {
      this.getAppState().layersSelected.forEach((id) => {
        const entity = this.#idEntityMap.get(id)?.id();
        if (entity) {
          entity.remove(Selected);
        }
      });
    }

    const prevAppState = this.getAppState();
    this.setAppState({
      ...prevAppState,
      layersSelected: preserveSelection
        ? [...prevAppState.layersSelected, ...selected]
        : selected,
    });

    // Select nodes in the canvas.
    this.getAppState().layersSelected.forEach((id) => {
      const entity = this.#idEntityMap.get(id)?.id();
      if (entity && !entity.has(Selected)) {
        entity.add(Selected);
      }
    });
  }

  /**
   * If diff is provided, no need to calculate diffs.
   */
  updateNode(node: SerializedNode, diff?: Partial<SerializedNode>) {
    const entity = this.#idEntityMap.get(node.id)?.id();
    const nodes = this.getNodes();

    if (!entity) {
      const cameraEntityCommands = this.commands.entity(this.#camera);

      // TODO: Calculate diffs and only update the changed nodes.
      const { entities, idEntityMap } = serializedNodesToEntities(
        [node],
        this.commands,
      );
      this.#idEntityMap.set(node.id, idEntityMap.get(node.id));

      this.commands.execute();

      entities.forEach((entity) => {
        // Append roots to the camera.
        if (!entity.has(Children)) {
          cameraEntityCommands.appendChild(this.commands.entity(entity));
        }
      });

      this.commands.execute();

      this.setNodes([...nodes, node]);
    } else {
      const updated = mutateElement(entity, node, diff ?? node);
      const index = nodes.findIndex((n) => n.id === updated.id);

      this.commands.execute();

      if (index !== -1) {
        nodes[index] = updated;
        this.setNodes(nodes);
      }
    }
  }

  /**
   * Update the scene with new nodes.
   * It will calculate diffs and only update the changed nodes.
   *
   * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#updatescene
   */
  updateNodes(nodes: SerializedNode[]) {
    const existentNodes = nodes.filter((node) =>
      this.#idEntityMap.has(node.id),
    );
    const nonExistentNodes = nodes.filter(
      (node) => !this.#idEntityMap.has(node.id),
    );

    if (nonExistentNodes.length > 0) {
      const cameraEntityCommands = this.commands.entity(this.#camera);

      // TODO: Calculate diffs and only update the changed nodes.
      const { entities, idEntityMap } = serializedNodesToEntities(
        nonExistentNodes,
        this.commands,
      );
      nonExistentNodes.forEach((node) => {
        this.#idEntityMap.set(node.id, idEntityMap.get(node.id));
      });

      this.commands.execute();

      entities.forEach((entity) => {
        // Append roots to the camera.
        if (!entity.has(Children)) {
          cameraEntityCommands.appendChild(this.commands.entity(entity));
        }
      });

      this.commands.execute();

      this.setNodes([...this.getNodes(), ...nonExistentNodes]);
    }

    if (existentNodes.length > 0) {
      existentNodes.forEach((node) => {
        this.updateNode(node);
      });
    }
  }

  deleteNodesById(ids: SerializedNode['id'][]) {
    const nodes = this.getNodes();
    const deletedNodes: SerializedNode[] = [];
    ids.forEach((id) => {
      const index = nodes.findIndex((n) => id === n.id);
      if (index !== -1) {
        deletedNodes.push(...nodes.splice(index, 1));
      }

      const entity = this.#idEntityMap.get(id);
      if (entity) {
        entity.id().add(ToBeDeleted);
      }
      this.#idEntityMap.delete(id);
    });

    this.setNodes(nodes);

    return deletedNodes;
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

  export(format: ExportFormat) {
    if (format === ExportFormat.SVG) {
      safeAddComponent(this.#canvas, VectorScreenshotRequest, {
        canvas: this.#canvas,
      });
    } else if (format === ExportFormat.PNG || format === ExportFormat.JPEG) {
      safeAddComponent(this.#canvas, RasterScreenshotRequest, {
        canvas: this.#canvas,
        type: `image/${format}`,
      });
    }

    this.commands.execute();
  }

  /**
   * Delete Canvas component
   */
  destroy() {
    this.#canvas.delete();
  }
}
