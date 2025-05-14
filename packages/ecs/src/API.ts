import { Entity } from '@lastolivegames/becsy';
import { IPointData } from '@pixi/math';
import { mat3, vec2 } from 'gl-matrix';
import { isNil, path2Absolute, path2String } from '@antv/util';
import {
  CaptureUpdateAction,
  CaptureUpdateActionType,
  Store,
  StoreIncrementEvent,
} from './history/Store';
import { Commands, EntityCommands } from './commands';
import { AppState, getDefaultAppState, Task } from './context';
import {
  CircleSerializedNode,
  EASING_FUNCTION,
  EllipseSerializedNode,
  getScale,
  PathSerializedNode,
  PolylineSerializedNode,
  RectSerializedNode,
  SerializedNode,
  serializedNodesToEntities,
  serializePoints,
  TextSerializedNode,
} from './utils';
import {
  AABB,
  Camera,
  Canvas,
  CheckboardStyle,
  Children,
  ComputedBounds,
  ComputedCamera,
  Cursor,
  Grid,
  Landmark,
  LandmarkAnimationEffectTiming,
  Mat3,
  Parent,
  Pen,
  Polyline,
  RasterScreenshotRequest,
  RBush,
  Selected,
  ToBeDeleted,
  Transform,
  VectorScreenshotRequest,
  ZIndex,
} from './components';

import { History, mutateElement, safeAddComponent } from './history';
import { sortByFractionalIndex, updateMatrix } from './systems';
import { DOMAdapter } from './environment';

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
  /**
   * Animation ID of landmark animation.
   */
  #landmarkAnimationID: number;
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

  getCamera() {
    return this.#camera;
  }

  /**
   * Create a new canvas.
   */
  createCanvas(canvasProps: Partial<Canvas>) {
    this.#canvas = this.commands
      .spawn(
        new Canvas({
          ...canvasProps,
          api: this,
        }),
      )
      .id()
      .hold();

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
   * Should account for CSS Transform applied on container.
   * @see https://github.com/antvis/G/issues/1161
   * @see https://github.com/antvis/G/issues/1677
   * @see https://developer.mozilla.org/zh-CN/docs/Web/API/MouseEvent/offsetX
   */
  client2Viewport({ x, y }: IPointData): IPointData {
    const $el = this.#canvas.read(Canvas).element as HTMLCanvasElement;
    const { scaleX, scaleY, bbox } = getScale($el);
    return {
      x: (x - (bbox?.left || 0)) / scaleX,
      y: (y - (bbox?.top || 0)) / scaleY,
    };
  }

  viewport2Client({ x, y }: IPointData): IPointData {
    const $el = this.#canvas.read(Canvas).element as HTMLCanvasElement;
    const { scaleX, scaleY, bbox } = getScale($el);
    return {
      x: (x + (bbox?.left || 0)) * scaleX,
      y: (y + (bbox?.top || 0)) * scaleY,
    };
  }

  viewport2Canvas(
    { x, y }: IPointData,
    viewProjectionMatrixInv?: mat3,
  ): IPointData {
    const camera = this.#camera;
    const { width, height } = camera.read(Camera).canvas.read(Canvas);

    if (!viewProjectionMatrixInv) {
      viewProjectionMatrixInv = Mat3.toGLMat3(
        camera.read(ComputedCamera).viewProjectionMatrixInv,
      );
    }

    const canvas = vec2.transformMat3(
      vec2.create(),
      [(x / width) * 2 - 1, (1 - y / height) * 2 - 1],
      viewProjectionMatrixInv,
    );
    return { x: canvas[0], y: canvas[1] };
  }

  canvas2Viewport(
    { x, y }: IPointData,
    viewProjectionMatrix?: mat3,
  ): IPointData {
    const { width, height } = this.#camera.read(Camera).canvas.read(Canvas);

    if (!viewProjectionMatrix) {
      viewProjectionMatrix = Mat3.toGLMat3(
        this.#camera.read(ComputedCamera).viewProjectionMatrix,
      );
    }

    const clip = vec2.transformMat3(
      vec2.create(),
      [x, y],
      viewProjectionMatrix,
    );
    return {
      x: ((clip[0] + 1) / 2) * width,
      y: (1 - (clip[1] + 1) / 2) * height,
    };
  }

  /**
   * Search entites within a bounding box. Use rbush under the hood to accelerate the search.
   */
  elementsFromBBox(minX: number, minY: number, maxX: number, maxY: number) {
    const rBush = this.#camera.read(RBush).value;

    // console.log(rBush.all());
    const rBushNodes = rBush.search({
      minX,
      minY,
      maxX,
      maxY,
    });

    // Sort by fractional index
    return rBushNodes
      .map((node) => node.entity)
      .filter((entity) => entity.__valid)
      .sort(sortByFractionalIndex)
      .reverse();
  }

  /**
   * Create a new landmark.
   */
  createLandmark(params: Partial<Landmark> = {}): Partial<Landmark> {
    const { zoom, x, y, rotation } = this.#camera.read(ComputedCamera);

    return {
      zoom,
      x,
      y,
      rotation,
      ...params,
    };
  }

  /**
   * Go to a landmark.
   * @see https://infinitecanvas.cc/guide/lesson-004#camera-animation
   */
  gotoLandmark(
    landmark: Partial<Landmark>,
    options: Partial<LandmarkAnimationEffectTiming> = {},
  ) {
    const {
      easing = 'linear',
      duration = 100,
      onframe = undefined,
      onfinish = undefined,
    } = options;

    const camera = this.#camera;
    const {
      x,
      y,
      zoom,
      rotation,
      viewportX = 0,
      viewportY = 0,
    } = {
      ...camera.read(ComputedCamera),
      ...landmark,
    };
    const useFixedViewport = viewportX || viewportY;

    const endAnimation = () => {
      this.applyLandmark({ x, y, zoom, rotation, viewportX, viewportY });
      if (onfinish) {
        onfinish();
      }
    };

    if (duration === 0) {
      endAnimation();
      return;
    }

    this.cancelLandmarkAnimation();

    let timeStart: number | undefined;
    const destPosition: vec2 = [x, y]; // in world space
    const destZoomRotation: vec2 = [zoom, rotation];
    const EPSILON = 0.0001;

    const animate = (timestamp: number) => {
      if (timeStart === undefined) {
        timeStart = timestamp;
      }
      const elapsed = timestamp - timeStart;

      if (elapsed > duration) {
        endAnimation();
        return;
      }

      const { x, y, zoom, rotation } = this.#camera.read(ComputedCamera);

      // use the same ease function in animation system
      const t = EASING_FUNCTION[easing](elapsed / duration);

      const interPosition = vec2.create();
      const interZoomRotation = vec2.fromValues(1, 0);

      vec2.lerp(interPosition, [x, y], destPosition, t);
      vec2.lerp(interZoomRotation, [zoom, rotation], destZoomRotation, t);

      this.applyLandmark({
        x: interPosition[0],
        y: interPosition[1],
        zoom: interZoomRotation[0],
        rotation: interZoomRotation[1],
        viewportX,
        viewportY,
      });

      if (
        useFixedViewport
          ? vec2.dist(interZoomRotation, destZoomRotation) <= EPSILON
          : vec2.dist(interPosition, destPosition) <= EPSILON
      ) {
        endAnimation();
        return;
      }

      if (elapsed < duration) {
        if (onframe) {
          onframe(t);
        }
        this.#landmarkAnimationID =
          DOMAdapter.get().requestAnimationFrame(animate);
      }
    };

    DOMAdapter.get().requestAnimationFrame(animate);
  }

  private applyLandmark(landmark: Landmark) {
    const transform = this.#camera.write(Transform);
    const { x, y, zoom, rotation, viewportX, viewportY } = landmark;
    const useFixedViewport = viewportX || viewportY;

    let preZoomX = 0;
    let preZoomY = 0;
    if (useFixedViewport) {
      const canvas = this.viewport2Canvas({
        x: viewportX,
        y: viewportY,
      });
      preZoomX = canvas.x;
      preZoomY = canvas.y;
    }

    Object.assign(transform, {
      translation: {
        x,
        y,
      },
      rotation,
      scale: { x: 1 / zoom, y: 1 / zoom },
    });

    if (useFixedViewport) {
      const { projectionMatrix } = this.#camera.read(ComputedCamera);

      const viewMatrix = mat3.create();
      const viewProjectionMatrix = mat3.create();
      const viewProjectionMatrixInv2 = mat3.create();
      const matrix = updateMatrix(x, y, rotation, zoom);
      mat3.invert(viewMatrix, matrix);
      mat3.multiply(
        viewProjectionMatrix,
        Mat3.toGLMat3(projectionMatrix),
        viewMatrix,
      );
      mat3.invert(viewProjectionMatrixInv2, viewProjectionMatrix);

      const { x: postZoomX, y: postZoomY } = this.viewport2Canvas(
        {
          x: viewportX,
          y: viewportY,
        },
        viewProjectionMatrixInv2,
      );

      transform.translation.x += preZoomX - postZoomX;
      transform.translation.y += preZoomY - postZoomY;
    }
  }

  cancelLandmarkAnimation() {
    if (this.#landmarkAnimationID !== undefined) {
      DOMAdapter.get().cancelAnimationFrame(this.#landmarkAnimationID);
    }
  }

  private getSceneGraphBounds() {
    const rbush = this.#camera.read(RBush).value;

    // Get bounds of all renderables.
    const bounds = new AABB();
    rbush.all().forEach((node) => {
      const { minX, minY, maxX, maxY } = node;
      bounds.addFrame(minX, minY, maxX, maxY);
    });

    return bounds;
  }

  zoomTo(zoom: number, effectTiming?: Partial<LandmarkAnimationEffectTiming>) {
    const { width, height } = this.getCanvas().read(Canvas);

    this.gotoLandmark(
      this.createLandmark({
        viewportX: width / 2,
        viewportY: height / 2,
        zoom,
      }),
      effectTiming ?? { duration: 300, easing: 'ease' },
    );
  }

  private zoomToFit(
    zoomCompare: (...values: number[]) => number,
    effectTiming?: Partial<LandmarkAnimationEffectTiming>,
  ) {
    const { minX, minY, maxX, maxY } = this.getSceneGraphBounds();
    const { width, height } = this.#canvas.read(Canvas);

    const scaleX = width / (maxX - minX);
    const scaleY = height / (maxY - minY);

    const newZoom = zoomCompare(scaleX, scaleY);

    // Fit to center
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const { zoom } = this.#camera.read(ComputedCamera);

    this.gotoLandmark(
      this.createLandmark({
        x: centerX - width / 2 / zoom,
        y: centerY - height / 2 / zoom,
      }),
      {
        duration: 0,
        onfinish: () => {
          this.zoomTo(newZoom, effectTiming);
        },
      },
    );
  }

  fitToScreen(effectTiming?: Partial<LandmarkAnimationEffectTiming>) {
    this.zoomToFit(Math.min, effectTiming);
  }

  fillScreen(effectTiming?: Partial<LandmarkAnimationEffectTiming>) {
    this.zoomToFit(Math.max, effectTiming);
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
  selectNodes(selected: SerializedNode[], preserveSelection = false) {
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
        ? [...prevAppState.layersSelected, ...selected.map((node) => node.id)]
        : selected.map((node) => node.id),
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

  getNodeTransform(node: SerializedNode) {
    const { type } = node;
    let width = 0;
    let height = 0;
    let x = 0;
    let y = 0;
    let angle = 0;

    if (type === 'circle') {
      const { r, cx, cy } = node;
      width = r * 2;
      height = r * 2;
      x = cx - r;
      y = cy - r;
      angle = 0;
    } else if (type === 'ellipse') {
      const { rx, ry, cx, cy } = node;
      width = rx * 2;
      height = ry * 2;
      x = cx - rx;
      y = cy - ry;
      angle = 0;
    } else if (type === 'rect') {
      const { width: w, height: h, x: xx, y: yy } = node;
      width = w;
      height = h;
      x = xx;
      y = yy;
      angle = 0;
    } else if (type === 'polyline' || type === 'path' || type === 'text') {
      const { geometryBounds } = this.getEntity(node)?.read(ComputedBounds);
      const { minX, minY, maxX, maxY } = geometryBounds;
      width = maxX - minX;
      height = maxY - minY;
      x = minX;
      y = minY;
      angle = 0;
    }

    return { width, height, x, y, angle };
  }

  updateNodeTransform(
    node: SerializedNode,
    transform: Partial<{
      x: number;
      y: number;
      dx: number;
      dy: number;
      width: number;
      height: number;
      rotation: number;
      lockAspectRatio: boolean;
    }>,
  ) {
    const { type } = node;
    const { x, y, width, height, lockAspectRatio } = transform;
    let { dx, dy } = transform;

    if (type === 'rect') {
      const diff: Partial<RectSerializedNode> = {};
      if (!isNil(x)) {
        diff.x = x;
      }
      if (!isNil(y)) {
        diff.y = y;
      }
      if (!isNil(dx)) {
        diff.x = (node.x || 0) + dx;
      }
      if (!isNil(dy)) {
        diff.y = (node.y || 0) + dy;
      }
      if (!isNil(width)) {
        if (lockAspectRatio) {
          const aspectRatio = node.width / node.height;
          diff.height = width / aspectRatio;
        }
        diff.width = width;
      }
      if (!isNil(height)) {
        if (lockAspectRatio) {
          const aspectRatio = node.width / node.height;
          diff.width = height * aspectRatio;
        }
        diff.height = height;
      }
      this.updateNode(node, diff);
    } else if (type === 'circle') {
      const diff: Partial<CircleSerializedNode> = {};
      const { cx = 0, cy = 0, r = 0 } = node;
      if (!isNil(x)) {
        diff.cx = x + r;
      }
      if (!isNil(y)) {
        diff.cy = y + r;
      }
      if (!isNil(dx)) {
        diff.cx = cx + dx;
      }
      if (!isNil(dy)) {
        diff.cy = cy + dy;
      }
      if (!isNil(width)) {
        diff.r = width / 2;
      }
      if (!isNil(height)) {
        diff.r = height / 2;
      }
      this.updateNode(node, diff);
    } else if (type === 'ellipse') {
      const diff: Partial<EllipseSerializedNode> = {};
      const { cx = 0, cy = 0, rx = 0, ry = 0 } = node;
      if (!isNil(x)) {
        diff.cx = x + rx;
      }
      if (!isNil(y)) {
        diff.cy = y + ry;
      }
      if (!isNil(dx)) {
        diff.cx = cx + dx;
      }
      if (!isNil(dy)) {
        diff.cy = cy + dy;
      }
      if (!isNil(width)) {
        if (lockAspectRatio) {
          const aspectRatio = node.rx / node.ry;
          diff.ry = width / aspectRatio / 2;
        }
        diff.rx = width / 2;
      }
      if (!isNil(height)) {
        if (lockAspectRatio) {
          const aspectRatio = node.rx / node.ry;
          diff.rx = (height * aspectRatio) / 2;
        }
        diff.ry = height / 2;
      }
      this.updateNode(node, diff);
    } else if (type === 'polyline') {
      const { x: prevX, y: prevY } = this.getNodeTransform(node);
      if (isNil(dx)) {
        dx = x - prevX;
      }
      if (isNil(dy)) {
        dy = y - prevY;
      }

      const points = this.getEntity(node)?.read(Polyline).points;
      const diff: Partial<PolylineSerializedNode> = {
        points: serializePoints(
          points.map(([x, y]) => {
            return [x + dx, y + dy];
          }),
        ),
      };
      this.updateNode(node, diff);
    } else if (type === 'path') {
      const { x: prevX, y: prevY } = this.getNodeTransform(node);
      if (!isNil(x) && isNil(dx)) {
        dx = x - prevX;
      }
      if (!isNil(y) && isNil(dy)) {
        dy = y - prevY;
      }

      const hasDx = !isNil(dx);
      const hasDy = !isNil(dy);

      const diff: Partial<PathSerializedNode> = {};
      const { d } = node;
      const absoluteArray = path2Absolute(d);

      absoluteArray.forEach((segment) => {
        const [command] = segment;
        if (command === 'M') {
          if (hasDx) {
            segment[1] += dx;
          }
          if (hasDy) {
            segment[2] += dy;
          }
        } else if (command === 'L') {
          if (hasDx) {
            segment[1] += dx;
          }
          if (hasDy) {
            segment[2] += dy;
          }
        } else if (command === 'H') {
          if (hasDx) {
            segment[1] += dx;
          }
        } else if (command === 'V') {
          if (hasDy) {
            segment[1] += dy;
          }
        } else if (command === 'A') {
          if (hasDx) {
            segment[6] += dx;
          }
          if (hasDy) {
            segment[7] += dy;
          }
        } else if (command === 'T') {
          if (hasDx) {
            segment[1] += dx;
          }
          if (hasDy) {
            segment[2] += dy;
          }
        } else if (command === 'C') {
          if (hasDx) {
            segment[1] += dx;
            segment[3] += dx;
            segment[5] += dx;
          }
          if (hasDy) {
            segment[2] += dy;
            segment[4] += dy;
            segment[6] += dy;
          }
        } else if (command === 'S') {
          if (hasDx) {
            segment[1] += dx;
            segment[3] += dx;
          }
          if (hasDy) {
            segment[2] += dy;
            segment[4] += dy;
          }
        } else if (command === 'Q') {
          if (hasDx) {
            segment[1] += dx;
            segment[3] += dx;
          }
          if (hasDy) {
            segment[2] += dy;
            segment[4] += dy;
          }
        }
      });

      diff.d = path2String(absoluteArray);
      this.updateNode(node, diff);
    } else if (type === 'text') {
      // TODO: Text should account for text align & baseline.
      const diff: Partial<TextSerializedNode> = {};
      if (!isNil(x)) {
        diff.x = x;
      }
      if (!isNil(y)) {
        diff.y = y;
      }
      if (!isNil(dx)) {
        diff.x = (node.x || 0) + dx;
      }
      if (!isNil(dy)) {
        diff.y = (node.y || 0) + dy;
      }
      this.updateNode(node, diff);
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

  private getSiblings(node: SerializedNode) {
    const entity = this.getEntity(node);
    if (!entity.has(Children)) {
      return [];
    }

    // We can't set backrefs manually.
    // @see https://lastolivegames.github.io/becsy/guide/architecture/components#referencing-entities

    const parent = entity.read(Children).parent;
    const children = parent
      .read(Parent)
      .children.filter((child) => !!this.getNodeByEntity(child)); // Filter out entities that are not in the scene graph e.g. Transformer UI.

    return children;
  }

  /**
   * Bring current node to the front in its context.
   * The context is the parent of the node.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/z-index
   */
  bringToFront(node: SerializedNode) {
    const children = this.getSiblings(node);
    const maxZIndex = Math.max(
      ...children.map((child) => child.read(ZIndex).value),
    );

    this.updateNode(node, { zIndex: maxZIndex + 1 });
  }

  bringForward(node: SerializedNode) {
    const children = this.getSiblings(node);
    const zIndexes = children
      .map((child) => child.read(ZIndex).value)
      .sort((a, b) => a - b);
    const index = zIndexes.indexOf(node.zIndex);
    const nextZIndex = zIndexes[index + 1] ?? Infinity;
    const nextNextZIndex = zIndexes[index + 2] ?? Infinity;

    this.updateNode(node, { zIndex: (nextZIndex + nextNextZIndex) / 2 });
  }

  sendBackward(node: SerializedNode) {
    const children = this.getSiblings(node);
    const zIndexes = children
      .map((child) => child.read(ZIndex).value)
      .sort((a, b) => a - b);
    const index = zIndexes.indexOf(node.zIndex);
    const prevZIndex = zIndexes[index - 1] ?? -Infinity;
    const prevPrevZIndex = zIndexes[index - 2] ?? -Infinity;

    this.updateNode(node, { zIndex: (prevZIndex + prevPrevZIndex) / 2 });
  }

  /**
   * Send current node to the back in its context.
   */
  sendToBack(node: SerializedNode) {
    const children = this.getSiblings(node);
    const minZIndex = Math.min(
      ...children.map((child) => child.read(ZIndex).value),
    );

    this.updateNode(node, { zIndex: minZIndex - 1 });
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
