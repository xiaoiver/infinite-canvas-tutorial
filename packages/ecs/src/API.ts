import { Entity } from '@lastolivegames/becsy';
import { IPointData } from '@pixi/math';
import { mat3, vec2 } from 'gl-matrix';
import { isNil, path2Absolute } from '@antv/util';
import {
  CaptureUpdateAction,
  CaptureUpdateActionType,
  Store,
  StoreIncrementEvent,
} from './history/Store';
import { Commands, EntityCommands } from './commands';
import { AppState, getDefaultAppState } from './context';
import {
  BitmapFont,
  copyTextToClipboard,
  createSVGElement,
  deserializeBrushPoints,
  deserializePoints,
  distanceBetweenPoints,
  EASING_FUNCTION,
  getScale,
  inLine,
  inPolyline,
  isDataUrl,
  isEntity,
  isPointInEllipse,
  isUrl,
  parsePath,
  serializeBrushPoints,
  serializedNodesToEntities,
  serializeNodesToSVGElements,
  serializePoints,
  shiftPath,
  strokeOffset,
  strokeWidthForHitTest,
  cloneStrokeWithHitTestWidth,
  cloneSerializedNodes,
  decompose,
  transformPath,
} from './utils';
import type {
  BrushSerializedNode,
  GSerializedNode,
  LineSerializedNode,
  PathSerializedNode,
  PolylineSerializedNode,
  SerializedNode,
  TextSerializedNode,
} from './types/serialized-node';
import { v4 as uuidv4 } from 'uuid';
import {
  AABB,
  Brush,
  Camera,
  Canvas,
  CheckboardStyle,
  Children,
  Circle,
  ComputedBounds,
  ComputedCamera,
  ComputedPoints,
  Cursor,
  Ellipse,
  FillGradient,
  FillImage,
  FillPattern,
  FillSolid,
  Font,
  GlobalTransform,
  Grid,
  Group,
  Highlighted,
  Landmark,
  LandmarkAnimationEffectTiming,
  Line,
  Locked,
  Mat3,
  OBB,
  Parent,
  Path,
  Polyline,
  RasterScreenshotRequest,
  RBush,
  Rect,
  Selected,
  Stroke,
  Text,
  Theme,
  ThemeMode,
  ToBeDeleted,
  Transform,
  UI,
  VectorNetwork,
  VectorScreenshotRequest,
  ZIndex,
} from './components';
import { History, mutateElement, safeAddComponent, safeRemoveComponent } from './history';
import {
  drawDotsGrid,
  drawLinesGrid,
  maybeShiftPoints,
  sortByFractionalIndex,
  toSVGElement,
  measureText,
  updateMatrix,
} from './systems';
import { DOMAdapter } from './environment';
import { SIBLINGS_MAX_Z_INDEX, SIBLINGS_MIN_Z_INDEX } from './context';

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

  onChange(snapshot: { appState: AppState; nodes: SerializedNode[] }) { }
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

export const pendingAPICallings: (() => any)[] = [];

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

  onchange: (snapshot: { appState: AppState; nodes: SerializedNode[] }) => void;
  onNodesChange: (nodes: SerializedNode[]) => void;
  onAppStateChange: (appState: AppState) => void;

  constructor(
    private readonly stateManagement: StateManagement,
    private readonly commands: Commands,
  ) {
    this.#store.onStoreIncrementEmitter.on(StoreIncrementEvent, (event) => {
      this.#history.record(event.elementsChange, event.appStateChange);

      const snapshot = {
        appState: this.stateManagement.getAppState(),
        nodes: this.stateManagement.getNodes(),
      };
      this.stateManagement.onChange?.(snapshot);

      // 分别触发 nodes 和 appState 的变化回调
      if (!event.elementsChange.isEmpty() && this.onNodesChange) {
        this.onNodesChange(snapshot.nodes);
      }

      if (!event.appStateChange.isEmpty() && this.onAppStateChange) {
        this.onAppStateChange(snapshot.appState);
      }

      // 保持向后兼容：如果设置了 onchange，当有任何变化时都会触发
      if (this.onchange && (!event.elementsChange.isEmpty() || !event.appStateChange.isEmpty())) {
        this.onchange(snapshot);
      }
    });
  }

  getAppState() {
    return this.stateManagement.getAppState();
  }

  setAppState(appState: Partial<AppState>) {
    const oldAppState = this.getAppState();
    const { cameraZoom, cameraX, cameraY, cameraRotation } = appState;

    if (
      Object.prototype.hasOwnProperty.call(appState, 'checkboardStyle') &&
      appState.checkboardStyle !== oldAppState.checkboardStyle
    ) {
      safeAddComponent(this.#canvas, Grid, {
        checkboardStyle: appState.checkboardStyle as CheckboardStyle,
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(appState, 'themeMode') &&
      appState.themeMode !== undefined &&
      appState.themeMode !== oldAppState.themeMode
    ) {
      safeAddComponent(this.#canvas, Theme, {
        mode: appState.themeMode as ThemeMode,
      });
    }

    if (
      (cameraZoom && cameraZoom !== oldAppState.cameraZoom) ||
      (cameraX && cameraX !== oldAppState.cameraX) ||
      (cameraY && cameraY !== oldAppState.cameraY) ||
      (cameraRotation && cameraRotation !== oldAppState.cameraRotation)
    ) {
      if (this.#camera.has(ComputedCamera)) {
        this.gotoLandmark(
          {
            zoom: cameraZoom ?? 1,
            x: cameraX ?? 0,
            y: cameraY ?? 0,
            rotation: cameraRotation ?? 0,
          },
          { duration: 0 },
        );
      } else {
        this.runAtNextTick(() => {
          this.gotoLandmark(
            {
              zoom: cameraZoom ?? 1,
              x: cameraX ?? 0,
              y: cameraY ?? 0,
              rotation: cameraRotation ?? 0,
            },
            { duration: 0 },
          );
        });
      }
    }

    this.stateManagement.setAppState({
      ...oldAppState,
      ...appState,
    });
  }

  getNodes() {
    return this.stateManagement.getNodes();
  }

  /**
   * 增量 {@link updateNode} / {@link updateNodes} 只传入「本批」节点时，边的 `fromId`/`toId` 仍需从完整场景解析。
   */
  #mergeSceneWithBatchForEdgeLookup(batch: SerializedNode[]): SerializedNode[] {
    const merged = new Map<string, SerializedNode>();
    for (const n of this.getNodes()) {
      merged.set(n.id, n);
    }
    for (const n of batch) {
      merged.set(n.id, n);
    }
    return [...merged.values()];
  }

  setNodes(nodes: SerializedNode[]) {
    this.stateManagement.setNodes(nodes.slice());
  }

  getEntityCommands() {
    return this.#idEntityMap;
  }

  getEntity(node: SerializedNode) {
    return this.#idEntityMap.get(node.id)?.id();
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

  getParentTransform(entity: Entity) {
    if (entity.has(Children) && !entity.read(Children).parent.has(Camera)) {
      return Mat3.toGLMat3(
        entity.read(Children).parent.read(GlobalTransform).matrix,
      );
    }

    return mat3.create();
  }

  getTransform(entity: Entity | SerializedNode) {
    if (isEntity(entity)) {
      return Mat3.toGLMat3(Mat3.fromTransform(entity.read(Transform)));
    }

    return Mat3.toGLMat3(
      Mat3.from_scale_angle_translation(
        {
          x: entity.scaleX,
          y: entity.scaleY,
        },
        entity.rotation,
        {
          x: entity.x ?? 0,
          y: entity.y ?? 0,
        },
      ),
    );
  }

  getAbsoluteTransformAndSize(node: SerializedNode) {
    const entity = this.getEntity(node);
    if (entity.has(ComputedBounds)) {
      const { translation, rotation, scale } = entity.read(Transform);
      const { width, height } = entity.read(ComputedBounds).transformOBB;
      return {
        id: node.id,
        x: translation.x,
        y: translation.y,
        width,
        height,
        rotation,
        scaleX: scale[0],
        scaleY: scale[1],
      };
    } else {
      return {
        id: node.id,
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: node.width ?? 0,
        height: node.height ?? 0,
        rotation: node.rotation ?? 0,
        scaleX: node.scaleX ?? 1,
        scaleY: node.scaleY ?? 1,
      };
    }
  }

  getCanvas() {
    return this.#canvas;
  }

  getCamera() {
    return this.#camera;
  }

  getCanvasElement() {
    return this.#canvas.read(Canvas).element as HTMLCanvasElement;
  }

  getHtmlLayer() {
    return this.#canvas.read(Canvas).htmlLayer as HTMLDivElement;
  }

  getSvgLayer() {
    return this.#canvas.read(Canvas).svgLayer as HTMLDivElement;
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
    const { zoom, x, y } = cameraProps;
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
          translation: {
            x,
            y,
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
    const { scaleX, scaleY, bbox } = getScale(this.getCanvasElement());
    return {
      x: (x - (bbox?.left || 0)) / scaleX,
      y: (y - (bbox?.top || 0)) / scaleY,
    };
  }

  viewport2Client({ x, y }: IPointData): IPointData {
    const { scaleX, scaleY, bbox } = getScale(this.getCanvasElement());
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
   * Calculate anchor's position in canvas coordinate, account for transformer's transform.
   */
  transformer2Canvas(point: IPointData, mask: Entity) {
    const matrix = Mat3.toGLMat3(mask.read(GlobalTransform).matrix);
    const [x, y] = vec2.transformMat3(
      vec2.create(),
      [point.x, point.y],
      matrix,
    );
    return {
      x,
      y,
    };
  }

  canvas2Transformer(point: IPointData, mask: Entity) {
    const matrix = Mat3.toGLMat3(mask.read(GlobalTransform).matrix);
    const invMatrix = mat3.invert(mat3.create(), matrix);
    const [x, y] = vec2.transformMat3(
      vec2.create(),
      [point.x, point.y],
      invMatrix,
    );
    return { x, y };
  }

  /**
   * Search entites within a bounding box. Use rbush under the hood to accelerate the search.
   */
  elementsFromBBox(minX: number, minY: number, maxX: number, maxY: number, shouldFilterLocked = true) {
    if (!this.#camera.has(RBush)) {
      return [];
    }

    const rBush = this.#camera.read(RBush).value;
    const rBushNodes = rBush.search({
      minX,
      minY,
      maxX,
      maxY,
    });

    // Sort by fractional index
    return rBushNodes
      .map((node) => node.entity)
      .filter((entity) => entity.__valid && (!shouldFilterLocked || !entity.has(Locked)))
      .sort(sortByFractionalIndex)
      .reverse();
  }

  elementsFromPoint(point: IPointData, shouldFilterLocked = true) {
    const entities = this.elementsFromBBox(point.x, point.y, point.x, point.y, shouldFilterLocked);

    const results: Entity[] = [];
    entities.forEach((entity) => {
      if (!entity.has(GlobalTransform)) {
        console.warn('entity has no GlobalTransform', entity.__id);
        return;
      }

      const matrix = Mat3.toGLMat3(entity.read(GlobalTransform).matrix);
      const invMatrix = mat3.invert(mat3.create(), matrix);
      const [x, y] = vec2.transformMat3(vec2.create(), [point.x, point.y], invMatrix);

      let isIntersected = false;
      const hasFill = (entity.has(FillSolid) && entity.read(FillSolid).value !== 'none') || entity.has(FillGradient) || entity.has(FillImage) || entity.has(FillPattern);
      const fill = hasFill ? 'black' : undefined;
      const hasStroke = entity.has(Stroke);
      const stroke = hasStroke ? entity.read(Stroke) : undefined;
      const halfStrokeWidth = hasStroke ? stroke.width / 2 : 0;
      const lineHitStrokeWidth = hasStroke
        ? strokeWidthForHitTest(entity, stroke)
        : 0;
      const offset = strokeOffset(stroke);

      if (entity.has(Circle)) {
        const { cx, cy, r } = entity.read(Circle);
        const distance = distanceBetweenPoints(x, y, cx, cy)
        if (hasFill && hasStroke) {
          isIntersected = distance <= r + offset;
        } else if (hasFill) {
          isIntersected = distance <= r;
        } else if (hasStroke) {
          isIntersected = (
            distance >= r + offset - halfStrokeWidth && distance <= r + offset + halfStrokeWidth
          );
        }
      } else if (entity.has(Ellipse)) {
        const { cx, cy, rx, ry } = entity.read(Ellipse);
        if (hasFill && hasStroke) {
          isIntersected = isPointInEllipse(x, y, cx, cy, rx + offset, ry + offset);
        } else if (hasFill) {
          isIntersected = isPointInEllipse(x, y, cx, cy, rx, ry);
        } else if (hasStroke) {
          isIntersected = (
            !isPointInEllipse(
              x,
              y,
              cx,
              cy,
              rx + offset - halfStrokeWidth * 2,
              ry + offset - halfStrokeWidth * 2,
            ) && isPointInEllipse(x, y, cx, cy, rx + offset, ry + offset)
          );
        }
      } else if (entity.has(Line)) {
        if (Line.hitTestProvider && hasStroke) {
          const { x1, y1, x2, y2 } = entity.read(Line);
          const strokeForHit = cloneStrokeWithHitTestWidth(entity, stroke);
          isIntersected = Line.hitTestProvider({
            x1,
            y1,
            x2,
            y2,
            x,
            y,
            stroke: strokeForHit,
          });
        } else if (hasStroke) {
          const { x1, y1, x2, y2 } = entity.read(Line);
          isIntersected = inLine(x1, y1, x2, y2, lineHitStrokeWidth, x, y);
        }
      } else if (entity.has(Polyline)) {
        if (Polyline.hitTestProvider && hasStroke) {
          const { points } = entity.read(Polyline);
          const strokeForHit = cloneStrokeWithHitTestWidth(entity, stroke);
          isIntersected = Polyline.hitTestProvider({
            points,
            x,
            y,
            stroke: strokeForHit,
          });
        } else if (hasStroke) {
          const { shiftedPoints } = entity.read(ComputedPoints);
          isIntersected = inPolyline(shiftedPoints, lineHitStrokeWidth, x, y);
        }
      } else if (entity.has(Path)) {
        const { d, fillRule } = entity.read(Path);
        if (Path.hitTestProvider) {
          const strokeForHit = hasStroke
            ? cloneStrokeWithHitTestWidth(entity, stroke)
            : undefined;
          isIntersected = Path.hitTestProvider({
            d,
            x,
            y,
            fill: hasFill,
            fillRule: fillRule ?? 'nonzero',
            stroke: strokeForHit,
          });
        } else {
          const ctx = DOMAdapter.get().createCanvas(100, 100).getContext('2d');
          const path = new Path2D(d);
          if (hasStroke) {
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = lineHitStrokeWidth;
            ctx.lineCap = stroke.linecap;
            ctx.lineJoin = stroke.linejoin;
            ctx.miterLimit = stroke.miterlimit;
            ctx.stroke(path);
          }
          if (hasFill) {
            ctx.fillStyle = fill;
            ctx.fill(path, fillRule);
          }
          if (hasStroke && !hasFill) {
            isIntersected = ctx.isPointInStroke(path, x, y);
          } else if (hasFill) {
            isIntersected = ctx.isPointInPath(path, x, y);
          }
        }
      } else {
        isIntersected = true;
      }

      if (isIntersected) {
        results.push(entity);
      }
    });
    return results;
  }

  getViewportBounds() {
    const { width, height } = this.#canvas.read(Canvas);
    // tl, tr, br, bl
    const tl = this.viewport2Canvas({
      x: 0,
      y: 0,
    });
    const tr = this.viewport2Canvas({
      x: width,
      y: 0,
    });
    const br = this.viewport2Canvas({
      x: width,
      y: height,
    });
    const bl = this.viewport2Canvas({
      x: 0,
      y: height,
    });

    return {
      minX: Math.min(tl.x, tr.x, br.x, bl.x),
      minY: Math.min(tl.y, tr.y, br.y, bl.y),
      maxX: Math.max(tl.x, tr.x, br.x, bl.x),
      maxY: Math.max(tl.y, tr.y, br.y, bl.y),
    };
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

    // If the bounds are invalid, do nothing, e.g. when there are no elements in the canvas.
    if (minX > maxX || minY > maxY) {
      return;
    }

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
  selectNodes(
    nodes: SerializedNode[],
    preserveSelection = false,
    updateAppState = true,
  ) {
    if (!preserveSelection) {
      this.getAppState().layersSelected.forEach((id) => {
        const entity = this.#idEntityMap.get(id)?.id();
        if (entity && entity.has(Selected)) {
          entity.remove(Selected);
        }
      });
    }

    const prevAppState = this.getAppState();
    // remove duplicates
    const layersSelected = preserveSelection
      ? [
        ...prevAppState.layersSelected,
        ...nodes.map((node) => node.id),
      ].filter((id, index, self) => self.indexOf(id) === index)
      : nodes
        .map((node) => node.id)
        .filter((id, index, self) => self.indexOf(id) === index);
    if (updateAppState) {
      this.setAppState({
        ...prevAppState,
        layersSelected,
      });
    }

    // Select nodes in the canvas.
    layersSelected.forEach((id) => {
      const entity = this.#idEntityMap.get(id)?.id();
      if (entity && !entity.has(Selected)) {
        entity.add(Selected, { camera: this.#camera });
      }
    });
  }

  deselectNodes(nodes: SerializedNode[]) {
    nodes.forEach((node) => {
      const entity = this.#idEntityMap.get(node.id)?.id();
      if (entity && entity.has(Selected)) {
        entity.remove(Selected);
      }
    });

    const prevAppState = this.getAppState();
    this.setAppState({
      ...prevAppState,
      layersSelected: prevAppState.layersSelected.filter(
        (id) => !nodes.map((node) => node.id).includes(id),
      ),
    });
  }

  highlightNodes(
    nodes: SerializedNode[],
    preserveSelection = false,
    updateAppState = true,
  ) {
    if (!preserveSelection) {
      this.getAppState().layersHighlighted.forEach((id) => {
        const entity = this.#idEntityMap.get(id)?.id();
        safeRemoveComponent(entity, Highlighted);
      });
    }

    const prevAppState = this.getAppState();
    // remove duplicates
    const layersHighlighted = preserveSelection
      ? [
        ...prevAppState.layersHighlighted,
        ...nodes.map((node) => node.id),
      ].filter((id, index, self) => self.indexOf(id) === index)
      : nodes
        .map((node) => node.id)
        .filter((id, index, self) => self.indexOf(id) === index);
    if (updateAppState) {
      this.setAppState({
        ...prevAppState,
        layersHighlighted,
      });
    }

    layersHighlighted.forEach((id) => {
      const entity = this.#idEntityMap.get(id)?.id();
      safeAddComponent(entity, Highlighted);
    });
  }

  unhighlightNodes(nodes: SerializedNode[]) {
    nodes.forEach((node) => {
      const entity = this.#idEntityMap.get(node.id)?.id();
      safeRemoveComponent(entity, Highlighted);
    });

    const prevAppState = this.getAppState();
    this.setAppState({
      ...prevAppState,
      layersHighlighted: prevAppState.layersHighlighted.filter(
        (id) => !nodes.map((node) => node.id).includes(id),
      ),
    });
  }

  applyCrop() {
    const [croppingNodeId] = this.getAppState().layersCropping;
    const node = this.getNodeById(croppingNodeId);
    if (node && node.clipMode === 'soft') {
      this.updateNode(node, { clipMode: 'clip', locked: false });
    }
    // Lock all children
    const children = this.getChildren(node);
    children.forEach((child) => {
      this.updateNode(this.getNodeByEntity(child), { locked: true });
    });
    this.setAppState({
      layersCropping: [],
    });
    this.selectNodes([node]);
    this.record();
  }

  cancelCrop() {
    const [croppingNodeId] = this.getAppState().layersCropping;
    const node = this.getNodeById(croppingNodeId);
    if (node && node.clipMode === 'soft') {
      this.updateNode(node, { clipMode: 'clip', locked: false });
    }
    // Lock all children
    const children = this.getChildren(node);
    children.forEach((child) => {
      this.updateNode(this.getNodeByEntity(child), { locked: true });
    });
    this.setAppState({
      layersCropping: [],
    });
    this.selectNodes([node]);
    this.record();
  }

  cancelLasso() {
    const [lassoingNodeId] = this.getAppState().layersLassoing;
    const node = this.getNodeById(lassoingNodeId);
    // Delete all children
    const children = this.getChildren(node);
    this.deleteNodesById(children.map((child) => this.getNodeByEntity(child).id));
    this.setAppState({
      layersLassoing: [],
      penbarLasso: {
        ...this.getAppState().penbarLasso,
        mode: undefined,
      }
    });
    this.selectNodes([node]);
    this.record();
  }

  /**
   * If diff is provided, no need to calculate diffs.
   */
  updateNode(
    node: SerializedNode,
    diff?: Partial<SerializedNode>,
    updateAppState = true,
    skipOverrideKeys: string[] = [],
  ) {
    const entity = this.#idEntityMap.get(node.id)?.id();
    const nodes = this.getNodes();

    if (!entity) {
      const cameraEntityCommands = this.commands.entity(this.#camera);

      // TODO: Calculate diffs and only update the changed nodes.
      const { entities, idEntityMap } = serializedNodesToEntities(
        [node],
        this.#canvas.read(Canvas).fonts,
        this.commands,
        this.#idEntityMap,
        { lookupNodes: this.#mergeSceneWithBatchForEdgeLookup([node]) },
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

      if (updateAppState) {
        this.setNodes([...nodes, node]);
      }
    } else {
      const updated = mutateElement(entity, node, diff ?? node, skipOverrideKeys, this);
      const index = nodes.findIndex((n) => n.id === updated.id);

      this.commands.execute();

      if (updateAppState) {
        if (index !== -1) {
          nodes[index] = updated;
          this.setNodes(nodes);
        }
      }
    }
  }

  /**
   * Update the scene with new nodes.
   * It will calculate diffs and only update the changed nodes.
   *
   * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#updatescene
   */
  updateNodes(nodes: SerializedNode[], updateAppState = true) {
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
        this.#canvas.read(Canvas).fonts,
        this.commands,
        this.#idEntityMap,
        {
          lookupNodes:
            this.#mergeSceneWithBatchForEdgeLookup(nonExistentNodes),
        },
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

      if (updateAppState) {
        this.setNodes([...this.getNodes(), ...nonExistentNodes]);
      }
    }

    if (existentNodes.length > 0) {
      existentNodes.forEach((node) => {
        this.updateNode(node, undefined, updateAppState);
      });
    }
  }

  updateNodeVectorNetwork(node: SerializedNode, vectorNetwork: VectorNetwork) { }

  updateNodeOBB(
    node: SerializedNode,
    obb: Partial<OBB>,
    lockAspectRatio = false,
    delta?: mat3,
    oldNode?: SerializedNode,
  ) {
    const { x, y, width, height, rotation, scaleX, scaleY } = obb;

    const diff: Partial<SerializedNode> = {};
    if (!isNil(x)) {
      diff.x = x;
    }
    if (!isNil(y)) {
      diff.y = y;
    }
    if (!isNil(rotation)) {
      diff.rotation = rotation;
    }
    if (!isNil(scaleX)) {
      diff.scaleX = scaleX;
    }
    if (!isNil(scaleY)) {
      diff.scaleY = scaleY;
    }
    if (!isNil(width)) {
      if (lockAspectRatio) {
        const aspectRatio = (node.width ?? 0) / (node.height ?? 1);
        diff.height = width / aspectRatio;
      }
      diff.width = width;
    }
    if (!isNil(height)) {
      if (lockAspectRatio) {
        const aspectRatio = (node.width ?? 0) / (node.height ?? 1);
        diff.width = height * aspectRatio;
      }
      diff.height = height;
    }

    if (delta) {
      if (node.type === 'polyline' || node.type === 'rough-polyline') {
        const { strokeAlignment = 'center', strokeWidth = 1 } = node;
        const shiftedPoints = maybeShiftPoints(
          deserializePoints((oldNode as PolylineSerializedNode)?.points).map(
            (point) => {
              const [x, y] = point;
              const [newX, newY] = vec2.transformMat3(
                vec2.create(),
                [x, y],
                delta,
              );
              return [newX, newY] as [number, number];
            },
          ),
          strokeAlignment,
          strokeWidth,
        );

        const { minX, minY } = Polyline.getGeometryBounds({
          points: shiftedPoints,
        });

        (diff as PolylineSerializedNode).points = serializePoints(
          shiftedPoints.map((point) => [point[0] - minX, point[1] - minY]),
        );
      } else if (node.type === 'path' || node.type === 'rough-path') {
        const d = transformPath((oldNode as PathSerializedNode).d, delta);
        const { subPaths } = parsePath(d);
        const points = subPaths.map((subPath) =>
          subPath
            .getPoints()
            .map((point) => [point[0], point[1]] as [number, number]),
        );
        // @ts-ignore
        const { minX, minY } = Path.getGeometryBounds({ d }, { points });
        (diff as PathSerializedNode).d = shiftPath(d, -minX, -minY);
      } else if (node.type === 'line' || node.type === 'rough-line') {
        const { x1, y1, x2, y2 } = oldNode as LineSerializedNode;
        const [newX1, newY1] = vec2.transformMat3(vec2.create(), [x1, y1], delta);
        const [newX2, newY2] = vec2.transformMat3(vec2.create(), [x2, y2], delta);
        const { minX, minY } = Line.getGeometryBounds({ x1: newX1, y1: newY1, x2: newX2, y2: newY2 });
        (diff as LineSerializedNode).x1 = newX1 - minX;
        (diff as LineSerializedNode).y1 = newY1 - minY;
        (diff as LineSerializedNode).x2 = newX2 - minX;
        (diff as LineSerializedNode).y2 = newY2 - minY;
      } else if (node.type === 'brush') {
        const shiftedPoints = deserializeBrushPoints(
          (oldNode as BrushSerializedNode)?.points,
        ).map((point) => {
          const { x, y, radius } = point;
          const [newX, newY] = vec2.transformMat3(vec2.create(), [x, y], delta);
          return { x: newX, y: newY, radius };
        });

        const { minX, minY } = Brush.getGeometryBounds({
          points: shiftedPoints,
        });

        (diff as BrushSerializedNode).points = serializeBrushPoints(
          shiftedPoints.map((point) => ({
            x: point.x - minX,
            y: point.y - minY,
            radius: point.radius,
          })),
        );
      } else if (node.type === 'text') {
        const textOld = (oldNode ?? node) as TextSerializedNode;
        const metrics = measureText(textOld);
        const { minX, minY, maxX, maxY } = Text.getGeometryBounds(
          textOld,
          metrics,
        );

        const corners: [number, number][] = [
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
        ];
        let nxMin = Infinity;
        let nyMin = Infinity;
        let nxMax = -Infinity;
        let nyMax = -Infinity;
        for (const [px, py] of corners) {
          const [nx, ny] = vec2.transformMat3(vec2.create(), [px, py], delta);
          nxMin = Math.min(nxMin, nx);
          nyMin = Math.min(nyMin, ny);
          nxMax = Math.max(nxMax, nx);
          nyMax = Math.max(nyMax, ny);
        }
        const [naX, naY] = vec2.transformMat3(
          vec2.create(),
          [textOld.anchorX ?? 0, textOld.anchorY ?? 0],
          delta,
        );
        (diff as TextSerializedNode).anchorX = naX - nxMin;
        (diff as TextSerializedNode).anchorY = naY - nyMin;

        const { scale } = decompose(delta);
        const sX = Math.abs(scale[0]);
        const sY = Math.abs(scale[1]);
        const fs = textOld.fontSize;
        const oldFontSize =
          typeof fs === 'number'
            ? fs
            : typeof fs === 'string'
              ? parseFloat(fs) || 12
              : 12;
        (diff as TextSerializedNode).fontSize = oldFontSize * sY;

        const ww = textOld.wordWrapWidth ?? 0;
        if (ww > 0) {
          (diff as TextSerializedNode).wordWrapWidth = ww * sX;
        }
      }
    }

    this.updateNode(node, diff);
  }

  /**
   * Get the bounds of the nodes.
   */
  getBounds(nodes: SerializedNode[]) {
    const bounds = new AABB();
    nodes.forEach((node) => {
      const entity = this.#idEntityMap.get(node.id)?.id();
      if (entity && entity.has(ComputedBounds)) {
        // Account for parent's clip
        const parentEntity = this.getParent(node);
        const parent = this.getNodeByEntity(parentEntity);
        if (parent && parent.clipMode && parent.clipMode === 'clip') {
          // Union node's bounds with parent's clip bounds
          const { minX, minY, maxX, maxY } = entity.read(ComputedBounds).renderWorldBounds;
          const { minX: parentMinX, minY: parentMinY, maxX: parentMaxX, maxY: parentMaxY } = parentEntity.read(ComputedBounds).renderWorldBounds;
          const isectMinX = Math.max(minX, parentMinX);
          const isectMinY = Math.max(minY, parentMinY);
          const isectMaxX = Math.min(maxX, parentMaxX);
          const isectMaxY = Math.min(maxY, parentMaxY);
          bounds.addFrame(isectMinX, isectMinY, isectMaxX, isectMaxY);
        } else {
          bounds.addBounds(entity.read(ComputedBounds).renderWorldBounds);
        }
      }
    });
    return bounds;
  }

  getGeometryBounds(nodes: SerializedNode[]) {
    const bounds = new AABB();
    nodes.forEach((node) => {
      const entity = this.#idEntityMap.get(node.id)?.id();
      if (entity && entity.has(ComputedBounds)) {
        bounds.addBounds(entity.read(ComputedBounds).geometryWorldBounds);
      }
    });
    return bounds;
  }

  deleteNodesById(ids: SerializedNode['id'][]) {
    const nodes = this.getNodes();
    const deletedNodes: SerializedNode[] = [];

    // 递归收集所有子节点及其后代
    const collectChildrenRecursively = (node: SerializedNode) => {
      deletedNodes.push(node);
      nodes.splice(nodes.indexOf(node), 1);

      this.getChildren(node).forEach((child) => {
        const childNode = this.getNodeByEntity(child);
        if (childNode) {
          collectChildrenRecursively(childNode);
        }
      });
    };

    ids.forEach((id) => {
      const index = nodes.findIndex((n) => id === n.id);
      if (index !== -1) {
        const node = nodes[index];
        collectChildrenRecursively(node);
      }
    });

    this.deselectNodes(deletedNodes);
    this.unhighlightNodes(deletedNodes);

    deletedNodes.forEach((node) => {
      const entity = this.#idEntityMap.get(node.id);
      if (entity) {
        entity.id().add(ToBeDeleted);
      }
      this.#idEntityMap.delete(node.id);
    });

    this.setNodes(nodes);

    return deletedNodes;
  }

  getSiblings(node: SerializedNode) {
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

  getParent(node: SerializedNode) {
    const entity = this.getEntity(node);
    if (!entity.has(Children)) {
      return undefined;
    }

    return entity.read(Children).parent;
  }

  getChildren(node: SerializedNode) {
    const entity = this.getEntity(node);
    if (!entity.has(Parent)) {
      return [];
    }

    return entity.read(Parent).children;
  }

  getChildrenRecursively(node: SerializedNode): SerializedNode[] {
    const children = this.getChildren(node);
    return children.flatMap((child) => {
      const childNode = this.getNodeByEntity(child);
      if (!childNode) {
        return [];
      }
      return [childNode, ...this.getChildrenRecursively(childNode)];
    });
  }

  reparentNode(node: SerializedNode, parent: SerializedNode) {
    // Modify x,y to be relative to the parent
    this.updateNode(node, { parentId: parent.id, x: (node.x ?? 0) - (parent.x ?? 0), y: (node.y ?? 0) - (parent.y ?? 0) });
  }

  /**
   * Bring current node to the front in its context.
   * The context is the parent of the node.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/z-index
   */
  bringToFront(node: SerializedNode) {
    const children = this.getSiblings(node).filter((child) => !child.has(UI));
    const maxZIndex = Math.max(
      ...children.map((child) => child.read(ZIndex).value),
    );

    if (node.zIndex === maxZIndex) {
      return;
    }

    this.updateNode(node, { zIndex: maxZIndex + 1 });
  }

  bringForward(node: SerializedNode) {
    const children = this.getSiblings(node).filter((child) => !child.has(UI));
    const zIndexes = children
      .map((child) => child.read(ZIndex).value)
      .sort((a, b) => a - b);
    const index = zIndexes.indexOf(node.zIndex);

    if (index === zIndexes.length - 1) {
      return;
    }

    const nextZIndex = zIndexes[index + 1] ?? SIBLINGS_MAX_Z_INDEX;
    const nextNextZIndex = zIndexes[index + 2] ?? SIBLINGS_MAX_Z_INDEX;

    this.updateNode(node, { zIndex: (nextZIndex + nextNextZIndex) / 2 });
  }

  sendBackward(node: SerializedNode) {
    const children = this.getSiblings(node).filter((child) => !child.has(UI));
    const zIndexes = children
      .map((child) => child.read(ZIndex).value)
      .sort((a, b) => a - b);
    const index = zIndexes.indexOf(node.zIndex);

    if (index === 0) {
      return;
    }

    const prevZIndex = zIndexes[index - 1] ?? SIBLINGS_MIN_Z_INDEX;
    const prevPrevZIndex = zIndexes[index - 2] ?? SIBLINGS_MIN_Z_INDEX;

    this.updateNode(node, { zIndex: (prevZIndex + prevPrevZIndex) / 2 });
  }

  /**
   * Send current node to the back in its context.
   */
  sendToBack(node: SerializedNode) {
    const children = this.getSiblings(node).filter((child) => !child.has(UI));
    const minZIndex = Math.min(
      ...children.map((child) => child.read(ZIndex).value),
    );

    if (node.zIndex === minZIndex) {
      return;
    }

    this.updateNode(node, { zIndex: minZIndex - 1 });
  }

  group(nodes: SerializedNode[]) {
    const targets = [...new Map(nodes.map((n) => [n.id, n])).values()].filter(
      Boolean,
    );
    if (targets.length === 0) {
      return;
    }

    const bounds = this.getGeometryBounds(targets);
    if (
      !Number.isFinite(bounds.minX) ||
      !Number.isFinite(bounds.minY) ||
      !Number.isFinite(bounds.maxX) ||
      !Number.isFinite(bounds.maxY)
    ) {
      return;
    }

    const parentIds = new Set(targets.map((n) => n.parentId ?? '__ROOT__'));
    const commonParentId =
      parentIds.size === 1 ? (targets[0].parentId ?? undefined) : undefined;

    const zIndex = Math.max(...targets.map((n) => n.zIndex ?? 0), 0);
    const groupNode: GSerializedNode = {
      id: uuidv4(),
      type: 'g',
      parentId: commonParentId,
      zIndex,
    };

    this.updateNode(groupNode);

    targets.forEach((node) => {
      if (node.id === groupNode.id) {
        return;
      }
      this.reparentNode(node, groupNode);
    });

    this.selectNodes([groupNode]);
  }

  ungroup(node: SerializedNode) {
    if (node.type !== 'g') {
      return;
    }

    const parentId = node.parentId;
    const groupX = node.x ?? 0;
    const groupY = node.y ?? 0;
    const groupZ = node.zIndex ?? 0;

    const children = this.getChildren(node)
      .map((child) => this.getNodeByEntity(child))
      .filter(Boolean);
    if (children.length === 0) {
      this.deleteNodesById([node.id]);
      return;
    }

    children.forEach((child, index) => {
      this.updateNode(child, {
        parentId,
        x: (child.x ?? 0) + groupX,
        y: (child.y ?? 0) + groupY,
        zIndex: groupZ + index * 0.001,
      });
    });

    this.deleteNodesById([node.id]);
    this.selectNodes(children);
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
    this.runAtNextTick(() => {
      this.#history.undo(
        arrayToMap(this.getNodes()),
        this.getAppState(),
        this.#store.snapshot,
      );
    });
  }

  redo() {
    this.runAtNextTick(() => {
      this.#history.redo(
        arrayToMap(this.getNodes()),
        this.getAppState(),
        this.#store.snapshot,
      );
    });
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

  export(format: ExportFormat, download = true, nodes: SerializedNode[] = []) {
    if (format === ExportFormat.SVG) {
      safeAddComponent(this.#canvas, VectorScreenshotRequest, {
        canvas: this.#canvas,
        download,
        nodes,
      });
    } else if (format === ExportFormat.PNG || format === ExportFormat.JPEG) {
      safeAddComponent(this.#canvas, RasterScreenshotRequest, {
        canvas: this.#canvas,
        type: `image/${format}`,
        download,
        nodes,
      });
    }

    this.commands.execute();
  }

  /**
   * Render nodes or the whole scene to SVG.
   */
  async renderToSVG(nodes: SerializedNode[], options: Partial<{
    grid: boolean;
    padding?: number;
  }> = {}) {
    const canvas = this.#canvas;
    const { grid: gridEnabled, padding = 0 } = options;
    const { cameras, api } = canvas.read(Canvas);
    const { width, height } = canvas.read(Canvas);
    const { mode, colors } = canvas.read(Theme);
    const { checkboardStyle } = canvas.read(Grid);
    const { grid: gridColor, background: backgroundColor } = colors[mode];
    const hasNodes = nodes && nodes.length;

    if (hasNodes) {
      return toSVGElement(api, nodes, padding);
    }

    const $namespace = createSVGElement('svg');
    $namespace.setAttribute('width', `${width}`);
    $namespace.setAttribute('height', `${height}`);

    if (checkboardStyle !== CheckboardStyle.NONE) {
      // @see https://www.geeksforgeeks.org/how-to-set-the-svg-background-color/
      $namespace.setAttribute('style', `background-color: ${backgroundColor}`);
    }

    {
      // Calculate viewBox according to the camera's transform.
      const { x, y, zoom } = cameras[0].read(ComputedCamera);
      $namespace.setAttribute(
        'viewBox',
        `${x} ${y} ${width / zoom} ${height / zoom}`,
      );
    }

    if (gridEnabled) {
      if (checkboardStyle === CheckboardStyle.GRID) {
        drawLinesGrid($namespace, gridColor);
      } else if (checkboardStyle === CheckboardStyle.DOTS) {
        drawDotsGrid($namespace, gridColor);
      }
    }

    (await serializeNodesToSVGElements(
      api.getNodes()
    )).forEach((element) => {
      $namespace.appendChild(element);
    });
    return $namespace;
  }

  async renderToCanvas(node: SerializedNode, options: { canvas?: HTMLCanvasElement, width?: number, height?: number } = {}): Promise<HTMLCanvasElement> {
    let { canvas, width = node.width ?? 0, height = node.height ?? 0 } = options;
    if (!canvas) {
      canvas = DOMAdapter.get().createCanvas(width, height) as HTMLCanvasElement;
    }

    const ctx = canvas.getContext('2d')!;
    const opacity = (node as { opacity?: number }).opacity ?? 1;
    const fillOpacity = (node as { fillOpacity?: number }).fillOpacity ?? 1;
    const strokeOpacity = (node as { strokeOpacity?: number }).strokeOpacity ?? 1;

    if (node.type === 'rect' || node.type === 'rough-rect') {
      const { x, y, width, height, strokeWidth, strokeLinecap, strokeLinejoin, fill, stroke } = node;
      ctx.save();
      if (isDataUrl(fill) || isUrl(fill)) {
        ctx.globalAlpha = opacity * fillOpacity;
        const image = await DOMAdapter.get().createImage(fill) as ImageBitmap;
        ctx.drawImage(image, x ?? 0, y ?? 0, width ?? 0, height ?? 0);
      } else {
        ctx.globalAlpha = opacity * fillOpacity;
        ctx.fillStyle = fill;
        ctx.fillRect(x ?? 0, y ?? 0, width ?? 0, height ?? 0);
      }
      ctx.globalAlpha = opacity * strokeOpacity;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = strokeLinecap;
      ctx.lineJoin = strokeLinejoin;
      ctx.stroke();
      ctx.restore();
    } else if (node.type === 'ellipse' || node.type === 'rough-ellipse') {
      const { x, y, width, height, strokeWidth, strokeLinecap, strokeLinejoin, fill, stroke } = node;
      ctx.save();
      ctx.globalAlpha = opacity * fillOpacity;
      ctx.fillStyle = fill;
      ctx.ellipse((x ?? 0) + (width ?? 0) / 2, (y ?? 0) + (height ?? 0) / 2, (width ?? 0) / 2, (height ?? 0) / 2, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = opacity * strokeOpacity;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = strokeLinecap;
      ctx.lineJoin = strokeLinejoin;
      ctx.stroke();
      ctx.restore();
    } else if (node.type === 'path' || node.type === 'rough-path') {
      const { d, fill, stroke, strokeWidth } = node;
      ctx.save();
      ctx.globalAlpha = opacity * fillOpacity;
      ctx.fillStyle = fill;
      ctx.beginPath();
      path2Absolute(d).forEach(([command, ...data]) => {
        if (command === 'M') {
          ctx.moveTo(data[0], data[1]);
        } else if (command === 'L') {
          ctx.lineTo(data[0], data[1]);
        } else if (command === 'C') {
          ctx.bezierCurveTo(data[0], data[1], data[2], data[3], data[4], data[5]);
        }
      });
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = opacity * strokeOpacity;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
      ctx.restore();
    } else if (node.type === 'polyline' || node.type === 'rough-polyline') {
      const { points, strokeWidth, strokeLinecap, strokeLinejoin, x, y, stroke } = node;
      ctx.save();
      ctx.globalAlpha = opacity * strokeOpacity;
      ctx.strokeStyle = stroke;
      deserializePoints(points).forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point[0] + (x ?? 0), point[1] + (y ?? 0));
        } else {
          ctx.lineTo(point[0] + (x ?? 0), point[1] + (y ?? 0));
        }
      });
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = strokeLinecap;
      ctx.lineJoin = strokeLinejoin;
      ctx.stroke();
      ctx.restore();
    } else if (node.type === 'line' || node.type === 'rough-line') {
      const { x1, y1, x2, y2, strokeWidth, strokeLinecap, strokeLinejoin, stroke } = node;
      ctx.save();
      ctx.globalAlpha = opacity * strokeOpacity;
      ctx.strokeStyle = stroke;
      ctx.moveTo(x1 ?? 0, y1 ?? 0);
      ctx.lineTo(x2 ?? 0, y2 ?? 0);
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = strokeLinecap;
      ctx.lineJoin = strokeLinejoin;
      ctx.stroke();
      ctx.restore();
    }

    await Promise.all(this.getChildren(node).map(child => this.renderToCanvas(this.getNodeByEntity(child), { canvas })).filter(Boolean));

    return canvas;
  }

  /**
   * Delete Canvas component
   */
  destroy() {
    this.#canvas.delete();
  }

  loadBitmapFont(bitmapFont: BitmapFont) {
    this.commands.spawn(
      new Font({
        canvas: this.#canvas,
        type: 'bitmap',
        bitmapFont,
      }),
    );
    this.commands.execute();
  }

  /**
   * 克隆一组序列化节点：为每个节点生成新 id，并在本批次内重写 parentId，保持原有父子关系。
   * 不修改入参。若某节点的父 id 不在 `nodes` 中，则其 `parentId` 置为 undefined。
   */
  cloneNodes(nodes: readonly SerializedNode[]): SerializedNode[] {
    return cloneSerializedNodes(nodes);
  }

  async copyToClipboard(
    selectedNodes: SerializedNode[],
    clipboardEvent?: ClipboardEvent,
  ) {
    const text = JSON.stringify(selectedNodes);
    await copyTextToClipboard(text, clipboardEvent);
  }

  runAtNextTick(fn: () => any) {
    pendingAPICallings.push(fn);
  }

  // AI APIs

  /**
   * Create or edit an image with a prompt.
   */
  async createOrEditImage(
    isEdit: boolean,
    prompt: string,
    image_urls: string[],
  ): Promise<{ images: Image[]; description: string }> {
    throw new Error('Not implemented');
  }

  /**
   * Upload the file to CDN and return an URL.
   */
  upload: (file: File) => Promise<string>;

  /**
   * Encode image before segmenting.
   */
  async encodeImage(image_url: string): Promise<void> {
    throw new Error('Not implemented');
  }

  /**
   * Segment the image into a mask.
   */
  async segmentImage(input: {
    image_url: string;
    prompt?: string;
    point_prompts?: PointPrompt[];
    box_prompts?: BoxPrompt[];
  }): Promise<{
    /**
     * Primary segmented mask preview
     */
    image: Image;
  }> {
    throw new Error('Not implemented');
  }

  /**
   * Split the image into multiple layers.
   */
  async decomposeImage(input: {
    image_url: string;
    num_layers?: number;
  }): Promise<{
    images: Image[];
  }> {
    throw new Error('Not implemented');
  }

  /**
   * Upscale the image.
   */
  async upscaleImage(input: {
    image_url: string;
    scale_factor?: number;
  }): Promise<Image> {
    throw new Error('Not implemented');
  }

  async removeByMask(input: {
    image_url: string;
    mask: HTMLCanvasElement;
  }): Promise<Image> {
    throw new Error('Not implemented');
  }
}

export interface Image {
  /**
   * The URL where the file can be downloaded from.
   */
  url?: string;

  /**
   * HTMLCanvasElement object.
   */
  canvas?: HTMLCanvasElement;
}

export interface PointPrompt {
  x: number;
  y: number;
  /**
   * 1 for foreground, 0 for background
   */
  label: number;
}

export interface BoxPrompt {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}
