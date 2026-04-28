import {
  BrushType,
  ClipModeValue,
  DropShadow,
  Ellipse,
  InnerShadow,
  Line,
  Marker,
  Opacity,
  Path,
  Rect,
  Rough,
  StampMode,
  Stroke,
  Text,
  TextDecoration,
  VectorNetwork,
  Visibility,
} from '../components';
import { EdgeStyle } from '../utils/binding';
import { DIRECTION_EAST, DIRECTION_NORTH, DIRECTION_SOUTH, DIRECTION_WEST } from '../utils/binding/constants';

/**
 * Refer SVG attributes
 * @see https://github.com/tldraw/tldraw/blob/main/packages/tlschema/src/shapes/TLBaseShape.ts
 * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton
 */
export interface BaseSerializeNode<Type extends string>
  extends Partial<TransformAttributes>,
  Partial<VisibilityAttributes>,
  Partial<NameAttributes>,
  ZIndexAttributes,
  Partial<EditableAttributes>,
  Partial<FlexboxLayoutAttributes> {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * 可复用组件根（与 Pencil `reusable` 一致）；实例由 `type: 'ref'` 节点引用该 id（见 `RefSerializedNode`）。
   * @see https://docs.pencil.dev/for-developers/the-pen-format#components-and-instances
   */
  reusable?: boolean;

  /**
   * Parent unique identifier
   */
  parentId?: string;

  /**
   * Clip children
   */
  clipMode?: ClipModeValue;

  /**
   * Shape type
   */
  type?: Type;

  /**
   * @see https://github.com/excalidraw/excalidraw/issues/1639
   */
  version?: number;
  versionNonce?: number;
  isDeleted?: boolean;

  updated?: number;

  /**
   * Lock aspect ratio like image.
   */
  lockAspectRatio?: boolean;

  /**
   * Locked layer cannot be interactive.
   */
  locked?: boolean;

  /**
   * Extra `data-*` attributes written on the exported SVG wrapper (`<g>` or primitive element).
   * Keys without a `data-` prefix become `data-` + kebab-case (e.g. `myKey` → `data-my-key`).
   * Keys that already start with `data-` are used as-is.
   */
  svgDataAttributes?: Record<string, string>;
}

export interface EditableAttributes {
  editable?: boolean;
  isEditing?: boolean;
}

export interface ZIndexAttributes {
  /**
   * Z index
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/z-index
   */
  zIndex: number;

  fractionalIndex?: string;
}
export interface NameAttributes {
  name: string;
}

/**
 * Friendly to transformer.
 * Resolved transform: after parsing/loading, x/y/width/height are always numbers.
 * @see TransformAttributesInput for the wire format (number | string for percentage support).
 */
export interface TransformAttributes {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Wire/input format: allows percentage strings (e.g. '50%') for x/y/width/height.
 * Use resolveSerializedNodes() to convert to SerializedNode (number only) at load boundary.
 */
export interface TransformAttributesInput {
  x: number | string;
  y: number | string;
  width: number | string;
  height: number | string;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface VisibilityAttributes {
  visibility: Visibility['value'];
}

export interface FillAttributes {
  /**
   * Solid color, gradient, stringified pattern, image data-uri, etc.
   */
  fill: string;
  fillOpacity: Opacity['fillOpacity'];
  opacity: Opacity['opacity'];
}

export interface StrokeAttributes {
  stroke: Stroke['color'];
  strokeWidth: Stroke['width'];
  strokeAlignment: Stroke['alignment'];
  strokeLinecap: Stroke['linecap'];
  strokeLinejoin: Stroke['linejoin'];
  strokeMiterlimit: Stroke['miterlimit'];
  strokeDasharray: string;
  strokeDashoffset: Stroke['dashoffset'];
  strokeOpacity: Opacity['strokeOpacity'];
}

/** Wider hit target for thin stroked lines / paths (Konva `hitStrokeWidth`). */
export interface HitStrokeInteractionAttributes {
  hitStrokeWidth?: number;
}

export interface FlexboxLayoutAttributes {
  display: 'flex';
  alignItems: 'center' | 'flex-start' | 'flex-end' | 'stretch' | 'baseline';
  /** 覆盖父容器 align-items，作为 flex 子项时生效 */
  alignSelf?:
  | 'auto'
  | 'center'
  | 'flex-start'
  | 'flex-end'
  | 'stretch'
  | 'baseline';
  justifyContent: 'center' | 'flex-start' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  flexWrap: 'nowrap' | 'wrap' | 'wrap-reverse';
  flexGrow: number;
  flexShrink: number;
  flexBasis: number;
  flex: number;
  /** 数字为四边同值；`[vertical, horizontal]` 或 `[top, right, bottom, left]` 与 Yoga 一致 */
  padding: number | number[];
  margin: number | number[];
  gap: number;
  rowGap: number;
  columnGap: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  /**
   * `true`：主尺寸由子项在 Yoga 中决定（布局后回写 width）；
   * `false`：该轴为固定，使用 `width`；
   * 未设置：无正数 `width` 时随内容，有则固定。由布局在 hug 时写回为 `true`；用户变换框改宽时置为 `false`。
   */
  flexHugWidth?: boolean;
  /**
   * 与 `flexHugWidth` 相同语义，对应 `height`。
   */
  flexHugHeight?: boolean;
}

export interface ConstraintAttributes {
  /**
   * Normalized point, relative to bounding box top-left.
   */
  x?: number;
  y?: number;
  perimeter?: boolean;
  name?: string;
  dx?: number;
  dy?: number;
}

export interface BindedAttributes {
  constraints: ConstraintAttributes[];
  /**
   * Variable: STYLE_PORT_CONSTRAINT
   * 
   * Defines the direction(s) that edges are allowed to connect to cells in.
   * Possible values are "DIRECTION_NORTH, DIRECTION_SOUTH, 
   * DIRECTION_EAST" and "DIRECTION_WEST". Value is
   * "portConstraint".
   * 
   * e.g. "north,south"
   */
  portConstraint: string;
}

export interface BindingAttributes {
  fromId: string;
  toId: string;
  /**
   * 画布坐标系下的端点（与节点 `x`/`y` 同空间）。当对应侧未连接节点（无 `fromId` / `toId` 或解析不到节点）时使用，对应 mxGraph `mxGeometry` 的 `sourcePoint` / `targetPoint`。
   */
  sourcePoint?: { x: number; y: number };
  targetPoint?: { x: number; y: number };
  orthogonal: boolean;
  exitX: number;
  exitY: number;
  exitPerimeter: boolean;
  exitDx: number;
  exitDy: number;
  entryX: number;
  entryY: number;
  entryPerimeter: boolean;
  entryDx: number;
  entryDy: number;
  /**
   * Affect the routing rules. e.g. orth connector.
   * 
   * @example
   * ┌──────┐        ┌──────┐
   * │ Node │ ─┐     │ Node │
   * └──────┘  └────▶└──────┘
   */
  edgeStyle: EdgeStyle;
  sourceJettySize: number;
  targetJettySize: number;
  jettySize: number;

  sourcePortConstraint: typeof DIRECTION_NORTH | typeof DIRECTION_SOUTH | typeof DIRECTION_EAST | typeof DIRECTION_WEST;
  targetPortConstraint: typeof DIRECTION_NORTH | typeof DIRECTION_SOUTH | typeof DIRECTION_EAST | typeof DIRECTION_WEST;

  /**
   * This determines whether or not joins between edges segments are smoothed to a rounded finish
   */
  rounded: boolean;
  curved: boolean;
  bezier: boolean;
}

export interface MarkerAttributes {
  markerStart: Marker['start'];
  markerEnd: Marker['end'];
  markerFactor: Marker['factor'];
}

export interface InnerShadowAttributes {
  innerShadowColor: InnerShadow['color'];
  innerShadowOffsetX: InnerShadow['offsetX'];
  innerShadowOffsetY: InnerShadow['offsetY'];
  innerShadowBlurRadius: InnerShadow['blurRadius'];
}

export interface DropShadowAttributes {
  dropShadowColor: DropShadow['color'];
  dropShadowOffsetX: DropShadow['offsetX'];
  dropShadowOffsetY: DropShadow['offsetY'];
  dropShadowBlurRadius: DropShadow['blurRadius'];
}

export interface AttenuationAttributes {
  strokeAttenuation: boolean;
  sizeAttenuation: boolean;
}

export interface TextDecorationAttributes {
  decorationColor: TextDecoration['color'];
  decorationLine: TextDecoration['line'];
  decorationStyle: TextDecoration['style'];
  decorationThickness: TextDecoration['thickness'];
}

export interface WireframeAttributes {
  wireframe: boolean;
}

export interface RoughAttributes {
  roughSeed: Rough['seed'];
  roughRoughness: Rough['roughness'];
  roughBowing: Rough['bowing'];
  roughFillStyle: Rough['fillStyle'];
  roughFillWeight: Rough['fillWeight'];
  roughHachureAngle: Rough['hachureAngle'];
  roughHachureGap: Rough['hachureGap'];
  roughCurveStepCount: Rough['curveStepCount'];
  roughCurveFitting: Rough['curveFitting'];
  roughFillLineDash: Rough['fillLineDash'];
  roughFillLineDashOffset: Rough['fillLineDashOffset'];
  roughDisableMultiStroke: Rough['disableMultiStroke'];
  roughDisableMultiStrokeFill: Rough['disableMultiStrokeFill'];
  roughSimplification: Rough['simplification'];
  roughDashOffset: Rough['dashOffset'];
  roughDashGap: Rough['dashGap'];
  roughZigzagOffset: Rough['zigzagOffset'];
  roughPreserveVertices: Rough['preserveVertices'];
}

export interface FilterAttributes {
  /**
   * The filter CSS property applies graphical effects like blur or color shift to an element. Filters are commonly used to adjust the rendering of images.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter
   */
  filter: string;
}

export interface GSerializedNode
  extends BaseSerializeNode<'g'>,
  Partial<FillAttributes>,
  Partial<StrokeAttributes> { }

export interface EllipseSerializedNode
  extends BaseSerializeNode<'ellipse'>,
  Partial<Pick<Ellipse, 'rx' | 'ry' | 'cx' | 'cy'>>,
  Partial<FillAttributes>,
  Partial<StrokeAttributes>,
  Partial<AttenuationAttributes>,
  Partial<WireframeAttributes>,
  Partial<FilterAttributes>,
  Partial<BindedAttributes> { }

export interface RectSerializedNode
  extends BaseSerializeNode<'rect'>,
  Partial<Pick<Rect, 'cornerRadius'>>,
  Partial<FillAttributes>,
  Partial<StrokeAttributes>,
  Partial<InnerShadowAttributes>,
  Partial<DropShadowAttributes>,
  Partial<AttenuationAttributes>,
  Partial<WireframeAttributes>,
  Partial<FilterAttributes>,
  Partial<BindedAttributes> { }

export interface RoughRectSerializedNode
  extends BaseSerializeNode<'rough-rect'>,
  Partial<Pick<Rect, 'cornerRadius'>>,
  Partial<FillAttributes>,
  Partial<StrokeAttributes>,
  Partial<RoughAttributes>,
  Partial<BindedAttributes> { }

export interface RoughEllipseSerializedNode
  extends BaseSerializeNode<'rough-ellipse'>,
  Partial<Pick<Ellipse, 'rx' | 'ry' | 'cx' | 'cy'>>,
  Partial<FillAttributes>,
  Partial<StrokeAttributes>,
  Partial<RoughAttributes>,
  Partial<BindedAttributes> { }

export interface RoughLineSerializedNode
  extends BaseSerializeNode<'rough-line'>,
  Partial<Pick<Line, 'x1' | 'y1' | 'x2' | 'y2'>>,
  Partial<StrokeAttributes>,
  Partial<HitStrokeInteractionAttributes>,
  Partial<Pick<AttenuationAttributes, 'strokeAttenuation'>>,
  Partial<MarkerAttributes>,
  Partial<BindingAttributes> { }
export interface RoughPolylineSerializedNode
  extends BaseSerializeNode<'rough-polyline'>,
  Partial<PolylineAttributes>,
  Partial<StrokeAttributes>,
  Partial<HitStrokeInteractionAttributes>,
  Partial<RoughAttributes>,
  Partial<MarkerAttributes>,
  Partial<BindingAttributes> { }

export interface RoughPathSerializedNode
  extends BaseSerializeNode<'rough-path'>,
  Partial<PathAttributes>,
  Partial<FillAttributes>,
  Partial<StrokeAttributes>,
  Partial<HitStrokeInteractionAttributes>,
  Partial<RoughAttributes>,
  Partial<MarkerAttributes>,
  Partial<BindingAttributes>,
  Partial<BindedAttributes> { }
export interface LineSerializedNode
  extends BaseSerializeNode<'line'>,
  Partial<Pick<Line, 'x1' | 'y1' | 'x2' | 'y2'>>,
  Partial<StrokeAttributes>,
  Partial<HitStrokeInteractionAttributes>,
  Partial<Pick<AttenuationAttributes, 'strokeAttenuation'>>,
  Partial<MarkerAttributes>,
  Partial<BindingAttributes> { }

export interface PolylineAttributes {
  points: string;
}
export interface PolylineSerializedNode
  extends BaseSerializeNode<'polyline'>,
  Partial<PolylineAttributes>,
  Partial<StrokeAttributes>,
  Partial<HitStrokeInteractionAttributes>,
  Partial<Pick<AttenuationAttributes, 'strokeAttenuation'>>,
  Partial<WireframeAttributes>,
  Partial<MarkerAttributes>,
  Partial<BindingAttributes> { }

export interface BrushAttributes {
  points: string;
  brushType: BrushType;
  brushStamp: string;
  stampInterval: number;
  stampMode: StampMode;
  stampNoiseFactor: number;
  stampRotationFactor: number;
  stroke: Stroke['color'];
  strokeOpacity: Opacity['strokeOpacity'];
}
export interface BrushSerializedNode
  extends BaseSerializeNode<'brush'>,
  Partial<StrokeAttributes>,
  Partial<BrushAttributes>,
  Partial<WireframeAttributes>,
  Partial<BindedAttributes> { }

export interface PathAttributes {
  d: string;
  fillRule: Path['fillRule'];
  tessellationMethod: Path['tessellationMethod'];
}
export interface PathSerializedNode
  extends BaseSerializeNode<'path'>,
  Partial<PathAttributes>,
  Partial<FillAttributes>,
  Partial<StrokeAttributes>,
  Partial<HitStrokeInteractionAttributes>,
  Partial<AttenuationAttributes>,
  Partial<WireframeAttributes>,
  Partial<MarkerAttributes>,
  Partial<FilterAttributes>,
  Partial<BindingAttributes>,
  Partial<BindedAttributes> { }

export interface TextAttributes
  extends Partial<
    Pick<
      Text,
      | 'anchorX'
      | 'anchorY'
      | 'content'
      | 'fontFamily'
      | 'fontSize'
      | 'fontWeight'
      | 'fontStyle'
      | 'fontVariant'
      | 'fontKerning'
      | 'letterSpacing'
      | 'lineHeight'
      | 'whiteSpace'
      | 'wordWrap'
      | 'wordWrapWidth'
      | 'textOverflow'
      | 'maxLines'
      | 'textAlign'
      | 'textBaseline'
      | 'leading'
      | 'bitmapFont'
      | 'bitmapFontKerning'
      | 'physical'
      | 'esdt'
    >
  > { }

export interface TextSerializedNode
  extends BaseSerializeNode<'text'>,
  Partial<TextAttributes>,
  Partial<{
    fontBoundingBoxAscent: number;
    fontBoundingBoxDescent: number;
    hangingBaseline: number;
    ideographicBaseline: number;
    /**
     * When set, this text is an edge label: parent should be a bound polyline/line.
     * Value is 0–1 along total edge length (arc-length parameter).
     */
    edgeLabelPosition: number;
    /**
     * Signed offset in parent-local pixels along edge normal at `edgeLabelPosition`.
     * Positive value moves to the "bottom" side of a left-to-right segment.
     */
    edgeLabelOffset: number;
  }>,
  Partial<FillAttributes>,
  Partial<StrokeAttributes>,
  Partial<DropShadowAttributes>,
  Partial<TextDecorationAttributes>,
  Partial<AttenuationAttributes>,
  Partial<WireframeAttributes>,
  Partial<BindedAttributes> { }

export interface VectorNetworkAttributes {
  vertices: VectorNetwork['vertices'];
  segments: VectorNetwork['segments'];
  regions: VectorNetwork['regions'];
}
export interface VectorNetworkSerializedNode
  extends BaseSerializeNode<'vector-network'>,
  Partial<FillAttributes>,
  Partial<StrokeAttributes>,
  Partial<VectorNetworkAttributes> { }

export interface HtmlAttributes {
  html: string;
}
export interface HtmlSerializedNode
  extends BaseSerializeNode<'html'>,
  Partial<HtmlAttributes>,
  Partial<BindedAttributes> { }

export interface EmbedAttributes {
  url: string;
}
export interface EmbedSerializedNode
  extends BaseSerializeNode<'embed'>,
  Partial<EmbedAttributes>,
  Partial<BindedAttributes> { }

/**
 * 与 Pencil 对齐：wire 上为 string/number，可写设计变量引用（如 `$token`）。
 * @see https://docs.pencil.dev/for-developers/the-pen-format
 */
export type StringOrVariable = string;
export type NumberOrVariable = number;

export interface IconFontAttributes {
  /** 图标在字体族中的名称 */
  iconFontName?: StringOrVariable;
  /**
   * 字体族。例如：'lucide'、'feather'、'Material Symbols Outlined'、'phosphor' 等。
   */
  iconFontFamily?: StringOrVariable;
}

/**
 * 图标字体节点（与 Pencil `IconFont` 一致，type 为 snake_case `iconfont`）
 */
export interface IconFontSerializedNode
  extends BaseSerializeNode<'iconfont'>,
  Partial<IconFontAttributes>,
  Partial<FillAttributes>,
  Partial<StrokeAttributes>,
  Partial<InnerShadowAttributes>,
  Partial<DropShadowAttributes>,
  Partial<FilterAttributes>,
  Partial<AttenuationAttributes>,
  Partial<WireframeAttributes>,
  Partial<BindedAttributes> { }

export interface RefAttributes {
  /** The `ref` property must be another object's ID. */
  ref: string;
}

/**
 * 引用（`type: 'ref'`）实例上可写任意形状的可选覆盖项，与 {@link SerializedNode} 中各具体 type 的字段并集一致（`ref` 与 `reusable` 根语义除外）。
 */
export interface RefSerializedNode
  extends BaseSerializeNode<'ref'>,
  RefAttributes,
  Partial<FillAttributes>,
  Partial<StrokeAttributes>,
  Partial<InnerShadowAttributes>,
  Partial<DropShadowAttributes>,
  Partial<FilterAttributes>,
  Partial<AttenuationAttributes>,
  Partial<WireframeAttributes>,
  Partial<BindedAttributes>,
  Partial<Pick<Ellipse, 'rx' | 'ry' | 'cx' | 'cy'>>,
  Partial<Pick<Rect, 'cornerRadius'>>,
  Partial<Pick<Line, 'x1' | 'y1' | 'x2' | 'y2'>>,
  Partial<PolylineAttributes>,
  Partial<PathAttributes>,
  Partial<BrushAttributes>,
  Partial<RoughAttributes>,
  Partial<TextAttributes>,
  Partial<Pick<
    TextSerializedNode,
    | 'fontBoundingBoxAscent'
    | 'fontBoundingBoxDescent'
    | 'hangingBaseline'
    | 'ideographicBaseline'
    | 'edgeLabelPosition'
    | 'edgeLabelOffset'
  >>,
  Partial<VectorNetworkAttributes>,
  Partial<HtmlAttributes>,
  Partial<EmbedAttributes>,
  Partial<IconFontAttributes>,
  Partial<MarkerAttributes>,
  Partial<BindingAttributes>,
  Partial<TextDecorationAttributes>,
  Partial<HitStrokeInteractionAttributes> { }

export type NodeSerializedNode =
  | EllipseSerializedNode
  | RectSerializedNode
  | PathSerializedNode
  | TextSerializedNode
  | BrushSerializedNode
  | RoughRectSerializedNode
  | RoughEllipseSerializedNode
  | RoughPathSerializedNode
  | HtmlSerializedNode
  | EmbedSerializedNode
  | IconFontSerializedNode
  | RefSerializedNode;
export type EdgeSerializedNode = LineSerializedNode | PolylineSerializedNode | RoughLineSerializedNode | RoughPolylineSerializedNode | PathSerializedNode | RoughPathSerializedNode;

export type SerializedNode =
  | GSerializedNode
  | EllipseSerializedNode
  | RectSerializedNode
  | LineSerializedNode
  | PolylineSerializedNode
  | PathSerializedNode
  | TextSerializedNode
  | BrushSerializedNode
  | RoughRectSerializedNode
  | RoughEllipseSerializedNode
  | RoughLineSerializedNode
  | RoughPolylineSerializedNode
  | RoughPathSerializedNode
  | VectorNetworkSerializedNode
  | HtmlSerializedNode
  | EmbedSerializedNode
  | IconFontSerializedNode
  | RefSerializedNode;

export type SerializedNodeAttributes = GSerializedNode &
  EllipseSerializedNode &
  RectSerializedNode &
  LineSerializedNode &
  PolylineSerializedNode &
  PathSerializedNode &
  TextSerializedNode &
  BrushSerializedNode &
  RoughRectSerializedNode &
  RoughEllipseSerializedNode &
  RoughLineSerializedNode &
  RoughPolylineSerializedNode &
  RoughPathSerializedNode &
  VectorNetworkSerializedNode &
  HtmlSerializedNode &
  EmbedSerializedNode &
  IconFontSerializedNode &
  RefSerializedNode;
