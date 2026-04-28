import { Entity } from '@lastolivegames/becsy';
import { IPointData } from '@pixi/math';
import { mat3, vec2 } from 'gl-matrix';
import { updateGlobalTransform } from './systems/Transform';
import { updateComputedPoints } from './systems/ComputePoints';
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
  prepareSerializedNodesForSvgExport,
  type DesignVariablesSvgExportMode,
  decompose,
  transformPath,
  mat3WithoutTranslation,
  buildDesignVariableRefreshPatch,
  expandSerializedNodesForSvgExport,
} from './utils';
import type { AnimationGifQuality } from './utils/animationExportCodec';
export type { AnimationGifQuality } from './utils/animationExportCodec';
import {
  getRegisteredIconifyIconFamilies as getRegisteredIconifyIconFamiliesList,
} from './utils/icon-font';
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
  RasterAnimationExportRequest,
  RasterScreenshotRequest,
  RBush,
  Rect,
  Selected,
  Stroke,
  Text,
  Theme,
  ThemeMode,
  mergeThemeState,
  resolveThemeModeFromPreference,
  ToBeDeleted,
  Transform,
  UI,
  VectorNetwork,
  AnimationPlayer,
  VectorScreenshotRequest,
  ZIndex,
} from './components';
import { AnimationController, AnimationOptions, Keyframe } from './animation';
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

/** 多选时按选区几何包络（世界坐标系）对齐，与 {@link API.alignSelectedNodes} 一致。 */
export type NodeAlignment =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'centerH'
  | 'centerV';

/** 多选时按几何包络在水平或竖直方向作等间距分布。 */
export type DistributeSpacingAxis = 'horizontal' | 'vertical';

export enum ExportFormat {
  SVG = 'svg',
  PNG = 'png',
  JPEG = 'jpeg',
  /** WebM（VP8/VP9），适合带引擎时间动画的滤镜 */
  WEBM = 'webm',
  GIF = 'gif',
}

/** {@link API.export} 的选项：格式、下载行为、目标节点、栅格倍率等。 */
export interface ExportOptions {
  format: ExportFormat;
  /** 为 `true` 时触发下载；默认 `true`。 */
  download?: boolean;
  /** 要导出的节点；空数组表示整幅画布。默认 `[]`。 */
  nodes?: SerializedNode[];
  /**
   * 局部栅格导出的边长倍率（相对逻辑选区），仅对 PNG / JPEG 等有效；默认 `1`。
   * @see RasterScreenshotRequest.scale
   */
  scale?: number;
  /**
   * 动画导出时长（秒），仅 WEBM / GIF；默认 `3`，上限约 `15`。
   */
  durationSec?: number;
  /**
   * 动画导出帧率，仅 WEBM / GIF；默认 `24`，上限约 `30`。
   */
  fps?: number;
  /**
   * 第一帧引擎时间（秒），仅 WEBM / GIF；默认 `0`。
   * @see RasterAnimationExportRequest.timeStart
   */
  timeStart?: number;
  /**
   * GIF 导出质量（每帧 palette 色数档）：仅 `ExportFormat.GIF`；默认 `high`（256 色）。
   * @see RasterAnimationExportRequest.gifQuality
   */
  gifQuality?: AnimationGifQuality;
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

  /** 当前已注册的 icon 集合 id（`registerIconifyIcons` 的 `family` 参数）。 */
  getRegisteredIconifyIconFamilies(): string[] {
    return getRegisteredIconifyIconFamiliesList();
  }

  setAppState(
    appState: Partial<AppState>,
    options?: {
      recordDesignVariableUndo?: boolean;
      /** 为 true 时 `variables` 整表替换（用于删除键等），默认与旧键合并 */
      replaceVariables?: boolean;
    },
  ) {
    const patch: Partial<AppState> = { ...appState };
    if (
      Object.prototype.hasOwnProperty.call(patch, 'themePreference') &&
      patch.themePreference !== undefined &&
      !Object.prototype.hasOwnProperty.call(patch, 'themeMode')
    ) {
      patch.themeMode = resolveThemeModeFromPreference(patch.themePreference);
    }

    const oldAppState = this.getAppState();
    const { cameraZoom, cameraX, cameraY, cameraRotation } = patch;

    if (
      Object.prototype.hasOwnProperty.call(patch, 'checkboardStyle') &&
      patch.checkboardStyle !== oldAppState.checkboardStyle
    ) {
      safeAddComponent(this.#canvas, Grid, {
        checkboardStyle: patch.checkboardStyle as CheckboardStyle,
      });
    }

    let themeAppStatePatch: Partial<AppState> = {};

    if (
      Object.prototype.hasOwnProperty.call(patch, 'theme') ||
      Object.prototype.hasOwnProperty.call(patch, 'themeMode') ||
      Object.prototype.hasOwnProperty.call(patch, 'themePreference')
    ) {
      const nextThemeMode =
        patch.themeMode !== undefined
          ? patch.themeMode
          : oldAppState.themeMode;
      const mergedTheme = mergeThemeState(
        { ...oldAppState.theme, mode: oldAppState.themeMode },
        {
          ...(patch.theme ?? {}),
          mode: nextThemeMode,
        },
      );
      themeAppStatePatch = {
        themeMode: nextThemeMode,
        theme: {
          mode: mergedTheme.mode,
          colors: mergedTheme.colors,
        },
      };
      if (this.#canvas?.has(Theme)) {
        safeAddComponent(this.#canvas, Theme, {
          mode: mergedTheme.mode,
          colors: mergedTheme.colors,
        });
      }
    }

    let propertiesPanelSectionsOpenPatch: Partial<AppState> = {};
    if (
      Object.prototype.hasOwnProperty.call(patch, 'propertiesPanelSectionsOpen')
    ) {
      propertiesPanelSectionsOpenPatch = {
        propertiesPanelSectionsOpen: {
          ...oldAppState.propertiesPanelSectionsOpen,
          ...patch.propertiesPanelSectionsOpen,
        },
      };
    }

    let variablesPatch: Partial<AppState> = {};
    const prevVariables = oldAppState.variables ?? {};
    if (Object.prototype.hasOwnProperty.call(patch, 'variables')) {
      const mergedVariables = options?.replaceVariables
        ? (patch.variables as NonNullable<AppState['variables']>)
        : {
          ...prevVariables,
          ...patch.variables,
        };
      variablesPatch = { variables: mergedVariables };
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

    const nextAppState = {
      ...oldAppState,
      ...patch,
      ...themeAppStatePatch,
      ...propertiesPanelSectionsOpenPatch,
      ...variablesPatch,
    };
    const themeModeChanged = nextAppState.themeMode !== oldAppState.themeMode;

    this.stateManagement.setAppState(nextAppState);

    const variablesActuallyChanged =
      Object.prototype.hasOwnProperty.call(patch, 'variables') &&
      JSON.stringify((variablesPatch as { variables?: object }).variables) !==
      JSON.stringify(prevVariables);

    const shouldRefreshDesignVariableBindings =
      variablesActuallyChanged ||
      (themeModeChanged && Object.keys(nextAppState.variables ?? {}).length > 0);

    if (shouldRefreshDesignVariableBindings) {
      this.runAtNextTick(() => {
        for (const node of this.getNodes()) {
          if (this.#idEntityMap.has(node.id)) {
            const varPatch = buildDesignVariableRefreshPatch(node);
            if (Object.keys(varPatch).length > 0) {
              this.updateNode(node, varPatch, false);
            }
          }
        }
        // 撤销/重做应用 AppState 时不要再次 record（见 {@link AppStateChange.applyTo}）
        if (options?.recordDesignVariableUndo !== false) {
          this.record();
        }
      });
    }
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

  /**
   * 与反序列化相同：`spawn` 出子实体。供 `mutateElement` 中 iconfont 子 path 数量增加时补全。
   */
  spawnEntityCommands(): EntityCommands {
    return this.commands.spawn();
  }

  appendEntityChild(parent: Entity, child: EntityCommands) {
    this.commands.entity(parent).appendChild(child);
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

  /**
   * 浅拷贝节点列表，并用 ECS 当前几何覆盖 x/y/width/height/rotation/scale（如 Flex/Yoga 仅写 ECS、序列化节点未同步时，导出 SVG 前调用）。
   * 对带 {@link Rect} 的 `rect` / `rough-rect` 同时覆盖 `cornerRadius`，保证导出与运行时一致。
   */
  readLayoutFromECS(nodes: SerializedNode[]): SerializedNode[] {
    return nodes.map((node) => {
      const g = this.getAbsoluteTransformAndSize(node);
      const out: SerializedNode = {
        ...node,
        x: g.x,
        y: g.y,
        width: g.width,
        height: g.height,
        rotation: g.rotation,
        scaleX: g.scaleX,
        scaleY: g.scaleY,
      };
      const entity = this.getEntity(node);
      if (
        entity &&
        entity.has(Rect) &&
        (node.type === 'rect' || node.type === 'rough-rect')
      ) {
        (out as { cornerRadius?: number }).cornerRadius = entity.read(
          Rect,
        ).cornerRadius;
      }
      return out;
    });
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
      const fillSolid = entity.has(FillSolid) ? entity.read(FillSolid).value : '';
      const hasFill =
        (entity.has(FillSolid) &&
          fillSolid !== 'none' &&
          fillSolid !== '') ||
        entity.has(FillGradient) ||
        entity.has(FillImage) ||
        entity.has(FillPattern);
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

  animate(
    target: Entity | SerializedNode | SerializedNode['id'],
    keyframes: Keyframe[],
    options: AnimationOptions,
  ) {
    let entity: Entity | undefined;
    if (typeof target === 'string') {
      const node = this.getNodeById(target);
      entity = node ? this.getEntity(node) : undefined;
    } else if (isEntity(target)) {
      entity = target;
    } else {
      entity = this.getEntity(target);
    }

    if (!entity) {
      return undefined;
    }

    const controller = new AnimationController(keyframes, options);
    if (entity.has(AnimationPlayer)) {
      entity.write(AnimationPlayer).controller = controller;
    } else {
      entity.add(AnimationPlayer, new AnimationPlayer({ controller }));
    }
    this.commands.execute();
    return controller;
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
    const prevAppState = this.getAppState();
    const prevSelectedIds = prevAppState.layersSelected;

    if (!preserveSelection) {
      prevSelectedIds.forEach((id) => {
        const entity = this.#idEntityMap.get(id)?.id();
        if (entity && entity.has(Selected)) {
          entity.remove(Selected);
        }
        // 与 handleSelectedMoved 等路径写入的 Highlighted 同步清理，否则取消选中后仍残留描边高亮
        if (entity) {
          safeRemoveComponent(entity, Highlighted);
        }
      });
    }

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
      const layersHighlighted = preserveSelection
        ? prevAppState.layersHighlighted
        : prevAppState.layersHighlighted.filter(
          (id) =>
            !prevSelectedIds.includes(id) || layersSelected.includes(id),
        );
      this.setAppState({
        ...prevAppState,
        layersSelected,
        layersHighlighted,
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
    const deselectIds = nodes.map((node) => node.id);
    nodes.forEach((node) => {
      const entity = this.#idEntityMap.get(node.id)?.id();
      if (entity && entity.has(Selected)) {
        entity.remove(Selected);
      }
      if (entity) {
        safeRemoveComponent(entity, Highlighted);
      }
    });

    const prevAppState = this.getAppState();
    this.setAppState({
      ...prevAppState,
      layersSelected: prevAppState.layersSelected.filter(
        (id) => !deselectIds.includes(id),
      ),
      layersHighlighted: prevAppState.layersHighlighted.filter(
        (id) => !deselectIds.includes(id),
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
        {
          lookupNodes: this.#mergeSceneWithBatchForEdgeLookup([node]),
          variables: this.getAppState().variables,
          themeMode: this.getAppState().themeMode,
        },
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
          variables: this.getAppState().variables,
          themeMode: this.getAppState().themeMode,
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

    if ((node as { display?: string }).display === 'flex') {
      if (!isNil(width)) (diff as { flexHugWidth?: boolean }).flexHugWidth = false;
      if (!isNil(height)) (diff as { flexHugHeight?: boolean }).flexHugHeight = false;
    }

    if (delta) {
      const geomDelta = mat3WithoutTranslation(delta);
      if (node.type === 'polyline' || node.type === 'rough-polyline') {
        const { strokeAlignment = 'center', strokeWidth = 1 } = node;
        const shiftedPoints = maybeShiftPoints(
          deserializePoints((oldNode as PolylineSerializedNode)?.points).map(
            (point) => {
              const [x, y] = point;
              const [newX, newY] = vec2.transformMat3(
                vec2.create(),
                [x, y],
                geomDelta,
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
        const d = transformPath((oldNode as PathSerializedNode).d, geomDelta);
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
        const [newX1, newY1] = vec2.transformMat3(
          vec2.create(),
          [x1, y1],
          geomDelta,
        );
        const [newX2, newY2] = vec2.transformMat3(
          vec2.create(),
          [x2, y2],
          geomDelta,
        );
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

  /**
   * 将选中的多个节点在**世界空间**中按各节点 {@link ComputedBounds.geometryWorldBounds} 的并集对齐
   *（与变换器多选选区同语义）。跳过 {@link SerializedNode.locked|locked} 的节点；至少两个未锁定。
   */
  alignSelectedNodes(alignment: NodeAlignment, nodeIds?: string[]) {
    const ids = nodeIds ?? this.getAppState().layersSelected;
    if (ids.length < 2) {
      return;
    }
    const nodes = ids
      .map((id) => this.getNodeById(id))
      .filter(
        (n): n is SerializedNode => !!n && n.locked !== true,
      );
    if (nodes.length < 2) {
      return;
    }
    const union = this.getGeometryBounds(nodes);
    if (
      !Number.isFinite(union.minX) ||
      !Number.isFinite(union.maxX) ||
      !Number.isFinite(union.minY) ||
      !Number.isFinite(union.maxY) ||
      union.minX > union.maxX ||
      union.minY > union.maxY
    ) {
      return;
    }

    for (const node of nodes) {
      const entity = this.getEntity(node);
      if (!entity?.has(ComputedBounds)) {
        continue;
      }
      const g = entity.read(ComputedBounds).geometryWorldBounds;
      if (
        !Number.isFinite(g.minX) ||
        !Number.isFinite(g.maxX) ||
        !Number.isFinite(g.minY) ||
        !Number.isFinite(g.maxY) ||
        g.minX > g.maxX ||
        g.minY > g.maxY
      ) {
        continue;
      }
      let dx = 0;
      let dy = 0;
      if (alignment === 'left') {
        dx = union.minX - g.minX;
      } else if (alignment === 'right') {
        dx = union.maxX - g.maxX;
      } else if (alignment === 'top') {
        dy = union.minY - g.minY;
      } else if (alignment === 'bottom') {
        dy = union.maxY - g.maxY;
      } else if (alignment === 'centerH') {
        const gc = (g.minX + g.maxX) * 0.5;
        const uc = (union.minX + union.maxX) * 0.5;
        dx = uc - gc;
      } else {
        const gc = (g.minY + g.maxY) * 0.5;
        const uc = (union.minY + union.maxY) * 0.5;
        dy = uc - gc;
      }
      this.#applyNodeWorldDelta(node, dx, dy);
    }

    this.record();
  }

  /**
   * 将多个选中节点在**世界空间**中沿水平或竖直方向做**等间距**分布：固定整体首尾（沿该轴的 min/max
   * 几何包络），在相邻两物体之间使用相同间隔；基于 {@link ComputedBounds.geometryWorldBounds} 与
   * {@link alignSelectedNodes} 相同的 OBB 更新。跳过 `locked` 的节点，至少两个未锁。
   */
  distributeSelectedNodesSpacing(
    axis: DistributeSpacingAxis,
    nodeIds?: string[],
  ) {
    const ids = nodeIds ?? this.getAppState().layersSelected;
    if (ids.length < 2) {
      return;
    }
    const nodes = ids
      .map((id) => this.getNodeById(id))
      .filter(
        (n): n is SerializedNode => !!n && n.locked !== true,
      );
    if (nodes.length < 2) {
      return;
    }
    const entries: {
      node: SerializedNode;
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      w: number;
      h: number;
    }[] = [];
    for (const node of nodes) {
      const entity = this.getEntity(node);
      if (!entity?.has(ComputedBounds)) {
        continue;
      }
      const g = entity.read(ComputedBounds).geometryWorldBounds;
      if (
        !Number.isFinite(g.minX) ||
        !Number.isFinite(g.maxX) ||
        !Number.isFinite(g.minY) ||
        !Number.isFinite(g.maxY) ||
        g.minX > g.maxX ||
        g.minY > g.maxY
      ) {
        continue;
      }
      entries.push({
        node,
        minX: g.minX,
        maxX: g.maxX,
        minY: g.minY,
        maxY: g.maxY,
        w: g.maxX - g.minX,
        h: g.maxY - g.minY,
      });
    }
    if (entries.length < 2) {
      return;
    }
    if (axis === 'horizontal') {
      entries.sort((a, b) => a.minX - b.minX);
    } else {
      entries.sort((a, b) => a.minY - b.minY);
    }
    const n = entries.length;
    if (axis === 'horizontal') {
      const sumW = entries.reduce((s, e) => s + e.w, 0);
      const span = entries[n - 1]!.maxX - entries[0]!.minX;
      const gGap = (span - sumW) / (n - 1);
      if (!Number.isFinite(gGap)) {
        return;
      }
      const targetMinX: number[] = new Array(n);
      targetMinX[0] = entries[0]!.minX;
      for (let i = 1; i < n; i++) {
        targetMinX[i] = targetMinX[i - 1]! + entries[i - 1]!.w + gGap;
      }
      for (let i = 0; i < n; i++) {
        this.#applyNodeWorldDelta(
          entries[i]!.node,
          targetMinX[i]! - entries[i]!.minX,
          0,
        );
      }
    } else {
      const sumH = entries.reduce((s, e) => s + e.h, 0);
      const span = entries[n - 1]!.maxY - entries[0]!.minY;
      const gGap = (span - sumH) / (n - 1);
      if (!Number.isFinite(gGap)) {
        return;
      }
      const targetMinY: number[] = new Array(n);
      targetMinY[0] = entries[0]!.minY;
      for (let i = 1; i < n; i++) {
        targetMinY[i] = targetMinY[i - 1]! + entries[i - 1]!.h + gGap;
      }
      for (let i = 0; i < n; i++) {
        this.#applyNodeWorldDelta(
          entries[i]!.node,
          0,
          targetMinY[i]! - entries[i]!.minY,
        );
      }
    }
    this.record();
  }

  #applyNodeWorldDelta(node: SerializedNode, dx: number, dy: number) {
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
      return;
    }
    const entity = this.getEntity(node);
    if (!entity) {
      return;
    }
    const epsilon = 0.01;
    const oldNode = { ...node, ...this.getAbsoluteTransformAndSize(node) };
    const oldAttrs = {
      x: oldNode.x ?? 0,
      y: oldNode.y ?? 0,
      width: oldNode.width ?? 0,
      height: oldNode.height ?? 0,
      rotation: oldNode.rotation ?? 0,
      scaleX: oldNode.scaleX ?? 1,
      scaleY: oldNode.scaleY ?? 1,
    };
    const wSign = oldAttrs.width;
    const hSign = oldAttrs.height;
    const delta = mat3.create();
    mat3.fromTranslation(delta, [dx, dy]);
    const parentTransform = this.getParentTransform(entity);
    const localTransform = this.getTransform(oldNode);
    const newLocalTransform = mat3.create();
    mat3.multiply(newLocalTransform, parentTransform, localTransform);
    mat3.multiply(newLocalTransform, delta, newLocalTransform);
    mat3.multiply(
      newLocalTransform,
      mat3.invert(mat3.create(), parentTransform),
      newLocalTransform,
    );
    const { rotation, translation, scale } = decompose(newLocalTransform);
    const obb = {
      x: translation[0],
      y: translation[1],
      width: Math.max(
        Math.abs((oldNode.width ?? 0) * scale[0]),
        epsilon,
      ),
      height: Math.max(
        Math.abs((oldNode.height ?? 0) * scale[1]),
        epsilon,
      ),
      rotation,
      scaleX: oldAttrs.scaleX * (Math.sign(wSign) || 1),
      scaleY: oldAttrs.scaleY * (Math.sign(hSign) || 1),
    };
    if (entity.hasSomeOf(Polyline, Path, Line)) {
      const signW = Math.sign(wSign) || 1;
      const signH = Math.sign(hSign) || 1;
      obb.scaleX = Math.sign(oldAttrs.scaleX || 1) * signW;
      obb.scaleY = Math.sign(oldAttrs.scaleY || 1) * signH;
    }
    this.updateNodeOBB(
      node,
      obb,
      node.lockAspectRatio,
      undefined,
      oldNode,
    );
    updateGlobalTransform(entity);
    updateComputedPoints(entity);
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

  export(options: ExportOptions) {
    const {
      format,
      download = true,
      nodes = [],
    } = options;
    if (format === ExportFormat.SVG) {
      safeAddComponent(this.#canvas, VectorScreenshotRequest, {
        canvas: this.#canvas,
        download,
        nodes,
      });
    } else if (format === ExportFormat.PNG || format === ExportFormat.JPEG) {
      const scale =
        options.scale != null && Number.isFinite(options.scale)
          ? Math.max(0.25, Math.min(8, options.scale))
          : 1;
      safeAddComponent(this.#canvas, RasterScreenshotRequest, {
        canvas: this.#canvas,
        type: `image/${format}`,
        download,
        nodes,
        scale,
      });
    } else if (format === ExportFormat.WEBM || format === ExportFormat.GIF) {
      const scale =
        options.scale != null && Number.isFinite(options.scale)
          ? Math.max(0.25, Math.min(8, options.scale))
          : 1;
      const durationRaw = options.durationSec;
      const durationSec = Math.max(
        0.2,
        Math.min(
          15,
          durationRaw != null && Number.isFinite(durationRaw) ? durationRaw : 3,
        ),
      );
      const fpsRaw = options.fps;
      const fps = Math.max(
        1,
        Math.min(30, fpsRaw != null && Number.isFinite(fpsRaw) ? fpsRaw : 24),
      );
      const timeStartRaw = options.timeStart;
      const timeStart =
        timeStartRaw != null && Number.isFinite(timeStartRaw) ? timeStartRaw : 0;
      const gq = options.gifQuality;
      const gifQuality: AnimationGifQuality =
        gq === 'medium' || gq === 'low' || gq === 'high' ? gq : 'high';
      safeAddComponent(this.#canvas, RasterAnimationExportRequest, {
        canvas: this.#canvas,
        download,
        format: format === ExportFormat.WEBM ? 'webm' : 'gif',
        durationSec,
        fps,
        grid: false,
        nodes,
        scale,
        timeStart,
        gifQuality: format === ExportFormat.GIF ? gifQuality : 'high',
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
    /** 默认 `resolved`；`css-var` 会注入 `:root` 变量并输出 `var(--token)` */
    designVariablesExport?: DesignVariablesSvgExportMode;
  }> = {}) {
    const canvas = this.#canvas;
    const {
      grid: gridEnabled,
      padding = 0,
      designVariablesExport = 'resolved',
    } = options;
    const { cameras, api } = canvas.read(Canvas);
    const { width, height } = canvas.read(Canvas);
    const { mode, colors } = canvas.read(Theme);
    const { checkboardStyle } = canvas.read(Grid);
    const { grid: gridColor, background: backgroundColor } = colors[mode];
    const hasNodes = nodes && nodes.length;

    if (hasNodes) {
      return toSVGElement(api, nodes, padding, { designVariablesExport });
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

    const prep = prepareSerializedNodesForSvgExport(
      api.readLayoutFromECS(api.getNodes()),
      api.getAppState().variables,
      designVariablesExport,
      api.getAppState().themeMode,
    );
    const exportNodes = expandSerializedNodesForSvgExport(
      prep.nodes,
      api.getNodes(),
    );
    if (prep.cssRootStyle) {
      const $defs = createSVGElement('defs');
      const $style = DOMAdapter.get()
        .getDocument()
        .createElementNS('http://www.w3.org/2000/svg', 'style');
      $style.textContent = prep.cssRootStyle;
      $defs.appendChild($style);
      $namespace.insertBefore($defs, $namespace.firstChild);
    }
    (await serializeNodesToSVGElements(exportNodes)).forEach((element) => {
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
