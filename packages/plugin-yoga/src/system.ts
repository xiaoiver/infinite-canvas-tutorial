import {
  System,
  Camera,
  Canvas,
  Children,
  ComputedBounds,
  FractionalIndex,
  GlobalTransform,
  Parent,
  Transform,
  Transformable,
  UI,
  ZIndex,
  getSceneRoot,
  Entity,
  API,
  safeRemoveComponent,
  Rect,
  ComputedCamera,
  Flex,
  FlexLayoutDirty,
  Ellipse,
  Polyline,
  Path,
  Text,
  HTML,
  Embed,
  FillGradient,
  FillSolid,
  measureText,
  type SerializedNode,
  GeometryDirty,
  Stroke,
  MaterialDirty,
  Group,
  FillImage,
  FillPattern,
} from '@infinite-canvas-tutorial/ecs';
import { YogaLayoutApplied } from './YogaLayoutApplied';
// @ts-expect-error - import.meta is only available in ES modules, but this code will run in ES module environments
import { loadYoga } from 'yoga-layout/load';

let Yoga;

interface StyleTreeNode {
  id: string;
  top?: number | string;
  left?: number | string;
  width?: number | string;
  height?: number | string;
  children: StyleTreeNode[];
  /** 内边距：数字为四边同值，[v,h] 为上下/左右，[t,r,b,l] 为四边 */
  padding?: number | number[];
  /** 外边距，同上 */
  margin?: number | number[];
  /** 子项之间的间距（Yoga 2.0+），同 CSS gap */
  gap?: number;
  /** 行间距 */
  rowGap?: number;
  /** 列间距 */
  columnGap?: number;
}

/** Yoga 算出的布局结果：节点 id -> 位置与尺寸 */
interface LayoutResults {
  [nodeId: string]: { x: number; y: number; width: number; height: number };
}

/** 节点该轴是否在数据/几何上显式指定了正尺寸（与「由子级撑开」相对） */
function hasExplicitSizeOnAxis(
  node: SerializedNode | undefined,
  entity: Entity,
  axis: 'width' | 'height',
): boolean {
  const v = node?.[axis];
  if (typeof v === 'number' && v > 0) return true;
  if (entity.has(Rect)) {
    const r = entity.read(Rect);
    const rv = r[axis];
    if (typeof rv === 'number' && rv > 0) return true;
  }
  return false;
}

/** 是否在该轴上让 Yoga 用子项算根盒并回写；由 flexHug* 与显式尺寸共同决定 */
function shouldHugAxis(
  node: SerializedNode | undefined,
  entity: Entity,
  axis: 'width' | 'height',
): boolean {
  if (!node) {
    return !hasExplicitSizeOnAxis(undefined, entity, axis);
  }
  const key = axis === 'width' ? 'flexHugWidth' : 'flexHugHeight';
  const flag = (node as unknown as Record<string, boolean | undefined>)[key];
  if (flag === true) return true;
  if (flag === false) return false;
  return !hasExplicitSizeOnAxis(node, entity, axis);
}

export class YogaSystem extends System {
  private readonly cameras = this.query((q) => q.added.with(Camera));
  private readonly cameraEntities = this.query((q) => q.current.with(Camera));

  private readonly bounds = this.query((q) =>
    q.addedOrChanged.and.removed
      .with(ComputedBounds)
      .trackWrites.and.with(Flex),
  );

  private readonly yogaLayoutApplied = this.query((q) =>
    q.current.with(YogaLayoutApplied),
  );

  private readonly flexLayoutDirty = this.query((q) =>
    q.added.with(FlexLayoutDirty),
  );

  /**
   * Each camera has a style tree.
   */
  private styleTrees: Map<number, StyleTreeNode> = new Map();

  /**
   * 缓存上一帧用于判断「位移 vs 尺寸」变化。
   * minX/minY 取世界 AABB 角点（便于跟平移一致）；width/height 取局部几何×scale（与旋转解耦，避免世界盒随转角变化误触 relayout）。
   */
  private previousBoundsByEntity: Map<
    number,
    { minX: number; minY: number; width: number; height: number }
  > = new Map();

  constructor() {
    super();

    this.query(
      (q) =>
        q
          .using(
            ComputedBounds,
            ComputedCamera,
            Camera,
            Canvas,
            FractionalIndex,
            Parent,
            Children,
            UI,
            FillGradient,
            FillSolid,
            FillImage,
            FillPattern,
            ZIndex,
          )
          .read.and.using(
            GlobalTransform,
            Transform,
            Transformable,
            Rect,
            Ellipse,
            Polyline,
            Path,
            Text,
            HTML,
            Embed,
            Group,
            YogaLayoutApplied,
            FlexLayoutDirty,
            GeometryDirty,
            MaterialDirty,
            Stroke,
          ).write,
    );
  }

  async prepare() {
    Yoga = await loadYoga();
    registerGapSetters();
  }

  execute() {
    this.flexLayoutDirty.added.forEach((entity) => {
      safeRemoveComponent(entity, FlexLayoutDirty);
      if (!entity.has(Flex)) {
        return;
      }
      const camera = getSceneRoot(entity);
      const { api } = camera.read(Camera).canvas.read(Canvas);
      const built = this.buildSubtreeForFlex(api, entity);
      if (built) {
        const { subtreeRoot, hugWidth, hugHeight } = built;
        process(Yoga, subtreeRoot, (results) => {
          this.updateCameraLayout(camera.__id, results, subtreeRoot.id, {
            width: hugWidth,
            height: hugHeight,
          });
        });
      }
    });

    this.cameras.added.forEach((camera) => {
      const cameraId = camera.__id;
      if (!this.styleTrees.has(cameraId)) {
        this.styleTrees.set(cameraId, {
          id: 'root',
          top: -Infinity,
          left: -Infinity,
          width: Infinity,
          height: Infinity,
          children: [],
        });
      }

      const { api } = camera.read(Camera).canvas.read(Canvas);
      const styleTree = this.styleTrees.get(cameraId);

      if (camera.has(Parent)) {
        camera
          .read(Parent)
          .children.filter((child) => !child.has(UI))
          .forEach((child) => {
            addFlexSubtrees(api, child, styleTree);
          });

        process(Yoga, styleTree, (results) => {
          this.updateCameraLayout(cameraId, results);
        });
      }
    });

    const cameras = new Set<Entity>();
    this.bounds.addedOrChanged.forEach((entity) => {
      if (entity.has(YogaLayoutApplied)) return;
      const { positionChanged, sizeChanged } =
        this.detectBoundsChangeKind(entity);
      if (sizeChanged) {
        const camera = getSceneRoot(entity);
        cameras.add(camera);
        const { api } = camera.read(Camera).canvas.read(Canvas);
        const built = this.buildSubtreeForFlex(api, entity);
        if (built) {
          const { subtreeRoot, hugWidth, hugHeight } = built;
          process(Yoga, subtreeRoot, (results) => {
            this.updateCameraLayout(camera.__id, results, subtreeRoot.id, {
              width: hugWidth,
              height: hugHeight,
            });
          });
        }
      }
    });

    this.bounds.removed.forEach((entity) => {
      this.previousBoundsByEntity.delete(entity.__id);
    });

    this.yogaLayoutApplied.current.forEach((entity) => {
      entity.remove(YogaLayoutApplied);
    });
  }

  /**
   * 以当前 Flex 节点为根，构建包含其所有子节点的 style 子树，并设好根节点的宽高供 Yoga 计算。
   * 某轴未在节点/Rect 上显式指定正尺寸时视为「hug」：不从 OBB 写死该轴，由 Yoga 依子项算根盒，见 updateCameraLayout 写回。
   */
  private buildSubtreeForFlex(
    api: API,
    flexEntity: Entity,
  ): {
    subtreeRoot: StyleTreeNode;
    hugWidth: boolean;
    hugHeight: boolean;
  } | null {
    const parentTree: StyleTreeNode = { id: '_', children: [] };
    constructStyleTree(api, flexEntity, parentTree, false);
    if (parentTree.children.length === 0) return null;
    const subtreeRoot = parentTree.children[0];
    const node = api.getNodeByEntity(flexEntity);
    const hugWidth = shouldHugAxis(node, flexEntity, 'width');
    const hugHeight = shouldHugAxis(node, flexEntity, 'height');

    const obb = flexEntity.read(ComputedBounds).transformOBB;
    let w = Math.abs(obb.width * obb.scaleX);
    let h = Math.abs(obb.height * obb.scaleY);
    if (w <= 0 || h <= 0) {
      if (node) {
        const nw = node.width;
        const nh = node.height;
        if (typeof nw === 'number' && nw > 0) w = nw;
        if (typeof nh === 'number' && nh > 0) h = nh;
      }
      if (flexEntity.has(Rect)) {
        const r = flexEntity.read(Rect);
        if (w <= 0 && typeof r.width === 'number' && r.width > 0) w = r.width;
        if (h <= 0 && typeof r.height === 'number' && r.height > 0)
          h = r.height;
      }
    }
    if (hugWidth) {
      delete subtreeRoot.width;
    } else {
      subtreeRoot.width = w;
    }
    if (hugHeight) {
      delete subtreeRoot.height;
    } else {
      subtreeRoot.height = h;
    }
    return { subtreeRoot, hugWidth, hugHeight };
  }

  /**
   * 判断当前帧 bounds 相对上一帧是位置变了还是尺寸变了。
   * - added：没有上一帧，返回 { positionChanged: true, sizeChanged: true }（可按业务改为 false）
   * - changed：与缓存的上一帧比较 minX/minY 为位置，width/height 为尺寸
   */
  private detectBoundsChangeKind(entity: Entity): {
    positionChanged: boolean;
    sizeChanged: boolean;
  } {
    const id = entity.__id;
    const cb = entity.read(ComputedBounds);
    const obb = cb.transformOBB;
    const width = Math.abs(obb.width * obb.scaleX);
    const height = Math.abs(obb.height * obb.scaleY);
    const current = { minX: obb.x, minY: obb.y, width, height };

    const prev = this.previousBoundsByEntity.get(id);
    this.previousBoundsByEntity.set(id, current);

    if (!prev) {
      return { positionChanged: true, sizeChanged: true };
    }

    const positionChanged =
      prev.minX !== current.minX || prev.minY !== current.minY;
    const sizeChanged =
      prev.width !== current.width || prev.height !== current.height;
    return { positionChanged, sizeChanged };
  }

  finalize(): void {
    // if (this.worker) {
    //   this.worker.terminate();
    //   this.worker = null;
    // }
  }

  private updateCameraLayout(
    cameraId: number,
    results: LayoutResults,
    skipRootId?: string,
    applyIntrinsicRootSize?: { width: boolean; height: boolean },
  ): void {
    this.cameraEntities.current.forEach((camera) => {
      if (camera.__id === cameraId) {
        const { api } = camera.read(Camera).canvas.read(Canvas);
        Object.keys(results).forEach((key) => {
          if (skipRootId != null && key === skipRootId) {
            const apply =
              applyIntrinsicRootSize &&
              (applyIntrinsicRootSize.width || applyIntrinsicRootSize.height);
            if (apply) {
              const node = api.getNodeById(key);
              if (node) {
                const box = results[key];
                const diff: Partial<SerializedNode> = {};
                if (applyIntrinsicRootSize!.width) {
                  diff.width = box.width;
                  (diff as { flexHugWidth?: boolean }).flexHugWidth = true;
                }
                if (applyIntrinsicRootSize!.height) {
                  diff.height = box.height;
                  (diff as { flexHugHeight?: boolean }).flexHugHeight = true;
                }
                if (Object.keys(diff).length > 0) {
                  api.updateNode(node, diff, false, []);
                  const ent = api.getEntity(node);
                  if (ent && !ent.has(YogaLayoutApplied))
                    ent.add(YogaLayoutApplied);
                }
              }
            }
            return;
          }
          const node = api.getNodeById(key);
          if (node) {
            const { x, y, width, height } = results[key];
            const entity = api.getEntity(node);
            const diff: Partial<SerializedNode> = { x, y, width, height };
            if (entity && (node as { display?: string }).display === 'flex') {
              const flexFlags = node as {
                flexHugWidth?: boolean;
                flexHugHeight?: boolean;
              };
              if (
                flexFlags.flexHugWidth == null &&
                !hasExplicitSizeOnAxis(node, entity, 'width')
              ) {
                (diff as { flexHugWidth?: boolean }).flexHugWidth = true;
              }
              if (
                flexFlags.flexHugHeight == null &&
                !hasExplicitSizeOnAxis(node, entity, 'height')
              ) {
                (diff as { flexHugHeight?: boolean }).flexHugHeight = true;
              }
            }
            api.updateNode(node, diff, false, ['x', 'y', 'width', 'height']);
            if (entity && !entity.has(YogaLayoutApplied))
              entity.add(YogaLayoutApplied);
          }
        });
      }
    });
  }
}

/** 只将 Flex 容器及其子树加入 style tree，非 Flex 节点不参与 Yoga 布局 */
function addFlexSubtrees(api: API, entity: Entity, tree: StyleTreeNode): void {
  if (entity.has(Flex)) {
    constructStyleTree(api, entity, tree, false);
    return;
  }
  if (entity.has(Parent)) {
    entity.read(Parent).children.forEach((child) => {
      addFlexSubtrees(api, child, tree);
    });
  }
}

/**
 * @param isFlexItem 当前节点是否为其父 flex 容器的直接子项；为 true 时，流式子项不传入 node 上的 left/top，避免旧坐标干扰 Yoga，由一次 calculateLayout 后写回。
 */
export function constructStyleTree(
  api: API,
  entity: Entity,
  tree: StyleTreeNode,
  isFlexItem = false,
): void {
  const node = api.getNodeByEntity(entity);
  if (!node) {
    return;
  }
  const treeNode: StyleTreeNode = {
    ...node,
    top: node.y,
    left: node.x,
    children: [],
  };
  tree.children.push(treeNode);

  if (treeNode.width === 0) {
    delete treeNode.width;
  }
  if (treeNode.height === 0) {
    delete treeNode.height;
  }

  const isAbsolute = (node as { position?: string }).position === 'absolute';
  if (isFlexItem && !isAbsolute) {
    delete treeNode.left;
    delete treeNode.top;
  }

  if (
    (node as SerializedNode).type === 'text' &&
    (treeNode.width == null || treeNode.height == null)
  ) {
    const m = measureText(node as Parameters<typeof measureText>[0]);
    if (treeNode.width == null && typeof m.width === 'number' && m.width > 0) {
      treeNode.width = m.width;
    }
    if (
      treeNode.height == null &&
      typeof m.height === 'number' &&
      m.height > 0
    ) {
      treeNode.height = m.height;
    }
  }

  /**
   * iconfont：未给宽高或为 0 时上面已删为 undefined；Yoga 需要可参与计算的正尺寸。
   * 与序列化默认、Iconify 视口一致，缺省为 24×24（仍优先用 node 上已设的正数）。
   */
  const nType = (node as SerializedNode).type;
  if (
    nType === 'iconfont' &&
    (treeNode.width == null || treeNode.height == null)
  ) {
    const nw = (node as { width?: number }).width;
    const nh = (node as { height?: number }).height;
    if (treeNode.width == null) {
      treeNode.width =
        typeof nw === 'number' && Number.isFinite(nw) && nw > 0 ? nw : 24;
    }
    if (treeNode.height == null) {
      treeNode.height =
        typeof nh === 'number' && Number.isFinite(nh) && nh > 0 ? nh : 24;
    }
  }

  // 只有 display: flex 的容器才参与子元素的 Yoga 布局
  if (entity.has(Flex) && entity.has(Parent)) {
    entity.read(Parent).children.forEach((child) => {
      constructStyleTree(api, child, treeNode, true);
    });
  }
}

const YOGA_VALUE_MAPPINGS = {
  align: {
    auto: 'ALIGN_AUTO',
    baseline: 'ALIGN_BASELINE',
    center: 'ALIGN_CENTER',
    'flex-end': 'ALIGN_FLEX_END',
    'flex-start': 'ALIGN_FLEX_START',
    stretch: 'ALIGN_STRETCH',
  },
  direction: {
    column: 'FLEX_DIRECTION_COLUMN',
    'column-reverse': 'FLEX_DIRECTION_COLUMN_REVERSE',
    row: 'FLEX_DIRECTION_ROW',
    'row-reverse': 'FLEX_DIRECTION_ROW_REVERSE',
  },
  edge: {
    top: 'EDGE_TOP',
    right: 'EDGE_RIGHT',
    bottom: 'EDGE_BOTTOM',
    left: 'EDGE_LEFT',
  },
  justify: {
    center: 'JUSTIFY_CENTER',
    'flex-end': 'JUSTIFY_FLEX_END',
    'flex-start': 'JUSTIFY_FLEX_START',
    'space-around': 'JUSTIFY_SPACE_AROUND',
    'space-between': 'JUSTIFY_SPACE_BETWEEN',
  },
  position: {
    absolute: 'POSITION_TYPE_ABSOLUTE',
    relative: 'POSITION_TYPE_RELATIVE',
  },
  wrap: {
    nowrap: 'WRAP_NO_WRAP',
    wrap: 'WRAP_WRAP',
  },
};

const sides = ['Top', 'Right', 'Bottom', 'Left'];

// Create functions for setting each supported style property on a Yoga node
const YOGA_SETTERS = Object.create(null);
// Simple properties
[
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'aspectRatio',
  ['flexDirection', YOGA_VALUE_MAPPINGS.direction],
  'flex',
  ['flexWrap', YOGA_VALUE_MAPPINGS.wrap],
  'flexBasis',
  'flexGrow',
  'flexShrink',
  ['alignContent', YOGA_VALUE_MAPPINGS.align],
  ['alignItems', YOGA_VALUE_MAPPINGS.align],
  ['alignSelf', YOGA_VALUE_MAPPINGS.align],
  ['justifyContent', YOGA_VALUE_MAPPINGS.justify],
].forEach((styleProp) => {
  let mapping = null;
  if (Array.isArray(styleProp)) {
    mapping = styleProp[1];
    // @ts-expect-error
    styleProp = styleProp[0];
  }
  // @ts-expect-error
  const setter = `set${styleProp.charAt(0).toUpperCase()}${styleProp.substr(
    1,
  )}`;
  // @ts-expect-error
  YOGA_SETTERS[styleProp] = mapping
    ? (yogaNode, value) => {
      if (mapping.hasOwnProperty(value)) {
        value = Yoga[mapping[value]];
        yogaNode[setter](value);
      }
    }
    : (yogaNode, value) => {
      yogaNode[setter](value);
    };
});

// Position-related properties
YOGA_SETTERS.position = (yogaNode, value) => {
  yogaNode.setPositionType(Yoga[YOGA_VALUE_MAPPINGS.position[value]]);
};
sides.forEach((side) => {
  const edgeConst = YOGA_VALUE_MAPPINGS.edge[side.toLowerCase()];
  YOGA_SETTERS[side.toLowerCase()] = (yogaNode, value) => {
    yogaNode.setPosition(Yoga[edgeConst], value);
  };
});

// Multi-side properties
['margin', 'padding', 'border'].forEach((styleProp) => {
  sides.forEach((side) => {
    const edgeConst = YOGA_VALUE_MAPPINGS.edge[side.toLowerCase()];
    const setter = `set${styleProp.charAt(0).toUpperCase()}${styleProp.substr(
      1,
    )}`;
    YOGA_SETTERS[`${styleProp}${side}`] = (yogaNode, value) => {
      yogaNode[setter](Yoga[edgeConst], value);
    };
  });
});

// 简写：padding / margin 单值或数组，同 CSS
const setPaddingOrMargin = (styleProp: 'padding' | 'margin') => {
  const setter = styleProp === 'padding' ? 'setPadding' : 'setMargin';
  const edgeKeys = ['top', 'right', 'bottom', 'left'];
  YOGA_SETTERS[styleProp] = (yogaNode: unknown, value: number | number[]) => {
    const vals = Array.isArray(value)
      ? value.length === 1
        ? [value[0], value[0], value[0], value[0]]
        : value.length === 2
          ? [value[0], value[1], value[0], value[1]]
          : value.length === 4
            ? value
            : [value[0], value[0], value[0], value[0]]
      : [value, value, value, value];
    edgeKeys.forEach((key, i) => {
      const edgeConst = YOGA_VALUE_MAPPINGS.edge[key];
      yogaNode[setter](Yoga[edgeConst], vals[i]);
    });
  };
};
setPaddingOrMargin('padding');
setPaddingOrMargin('margin');

// Gap（Yoga 2.0+）：flex 子项之间的行/列间距，需在 Yoga 加载后注册
function registerGapSetters() {
  // GUTTER_ALL : 2, GUTTER_COLUMN: 0, GUTTER_ROW: 1
  YOGA_SETTERS.gap = (yogaNode: unknown, value: number) => {
    (yogaNode as { setGap: (g: number, v: number) => void }).setGap(
      Yoga.GUTTER_ROW,
      value,
    );
    (yogaNode as { setGap: (g: number, v: number) => void }).setGap(
      Yoga.GUTTER_COLUMN,
      value,
    );
  };
  YOGA_SETTERS.rowGap = (yogaNode: unknown, value: number) => {
    (yogaNode as { setGap: (g: number, v: number) => void }).setGap(
      Yoga.GUTTER_ROW,
      value,
    );
  };
  YOGA_SETTERS.columnGap = (yogaNode: unknown, value: number) => {
    (yogaNode as { setGap: (g: number, v: number) => void }).setGap(
      Yoga.GUTTER_COLUMN,
      value,
    );
  };
}

function walkStyleTree(styleTree, callback) {
  callback(styleTree);
  if (styleTree.children) {
    for (let i = 0, len = styleTree.children.length; i < len; i++) {
      walkStyleTree(styleTree.children[i], callback);
    }
  }
}

function process(
  Yoga,
  styleTree: StyleTreeNode,
  callback: (results: LayoutResults) => void,
) {
  // Init common node config
  const yogaConfig = Yoga.Config.create();
  yogaConfig.setPointScaleFactor(0); //disable value rounding
  yogaConfig.setUseWebDefaults(false); // 与 Web/CSS flex 一致：默认 row、flex-shrink 等

  function populateNode(yogaNode, styleNode) {
    if (!styleNode) {
      throw new Error('Style node with no id');
    }

    for (let prop in styleNode) {
      if (styleNode.hasOwnProperty(prop)) {
        // Look for a style setter, and invoke it
        const setter = YOGA_SETTERS[prop];
        if (setter) {
          setter(yogaNode, styleNode[prop]);
        }
      }
    }

    // Recurse to children
    if (styleNode.children) {
      for (let i = 0, len = styleNode.children.length; i < len; i++) {
        const childYogaNode = Yoga.Node.createWithConfig(yogaConfig);
        populateNode(childYogaNode, styleNode.children[i]);
        yogaNode.insertChild(childYogaNode, i);
      }
    }

    // Store the Yoga node on the style object, so we can access each Yoga node's original
    // context when traversing post-layout
    styleNode.yogaNode = yogaNode;
  }

  const root = Yoga.Node.createWithConfig(yogaConfig);
  populateNode(root, styleTree);

  // Perform the layout and collect the results as a flat id-to-computed-layout map
  root.calculateLayout(undefined, undefined);
  const results = Object.create(null);
  walkStyleTree(styleTree, (styleNode) => {
    const { id, yogaNode } = styleNode;
    results[id] = {
      x: yogaNode.getComputedLeft(),
      y: yogaNode.getComputedTop(),
      width: yogaNode.getComputedWidth(),
      height: yogaNode.getComputedHeight(),
    };
  });
  root.freeRecursive();

  callback(results);
}
