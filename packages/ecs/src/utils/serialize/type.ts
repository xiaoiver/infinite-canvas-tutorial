import {
  BrushType,
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
} from '../../components';
import { EdgeStyle } from '../binding';
import { DIRECTION_EAST, DIRECTION_NORTH, DIRECTION_SOUTH, DIRECTION_WEST } from '../binding/constants';

// @see https://dev.to/themuneebh/typescript-branded-types-in-depth-overview-and-use-cases-60e
export type FractionalIndex = string & { _brand: 'franctionalIndex' };
export type Ordered<TElement extends SerializedNode> = TElement & {
  index: FractionalIndex;
};
export type OrderedSerializedNode = Ordered<SerializedNode>;

/**
 * Refer SVG attributes
 * @see https://github.com/tldraw/tldraw/blob/main/packages/tlschema/src/shapes/TLBaseShape.ts
 * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton
 */
export interface BaseSerializeNode<Type extends string>
  extends Partial<TransformAttributes>,
  Partial<VisibilityAttributes>,
  Partial<NameAttributes>,
  Partial<ZIndexAttributes>,
  Partial<EditableAttributes> {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Parent unique identifier
   */
  parentId?: string;

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
  zIndex?: number;

  fractionalIndex?: string;
}

export interface NameAttributes {
  name: string;
}

/**
 * Friendly to transformer.
 * Allow percentage values for x/y, width/height.
 */
export interface TransformAttributes {
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

export interface FlexboxLayoutAttributes {
  display: 'flex';
  alignItems: 'center' | 'flex-start' | 'flex-end' | 'stretch' | 'baseline';
  justifyContent: 'center' | 'flex-start' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  flexWrap: 'nowrap' | 'wrap' | 'wrap-reverse';
  flexGrow: number;
  flexShrink: number;
  flexBasis: number;
  flex: number;
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

export interface GSerializedNode extends BaseSerializeNode<'g'> { }

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
  Partial<{ x: number | string; y: number | string; width: number | string; height: number | string }>,
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
  Partial<{ x: number | string; y: number | string; width: number | string; height: number | string }>,
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
  Partial<Pick<AttenuationAttributes, 'strokeAttenuation'>>,
  Partial<MarkerAttributes>,
  Partial<BindingAttributes> { }
export interface RoughPolylineSerializedNode
  extends BaseSerializeNode<'rough-polyline'>,
  Partial<PolylineAttributes>,
  Partial<StrokeAttributes>,
  Partial<RoughAttributes>,
  Partial<MarkerAttributes>,
  Partial<BindingAttributes> { }

export interface RoughPathSerializedNode
  extends BaseSerializeNode<'rough-path'>,
  Partial<PathAttributes>,
  Partial<FillAttributes>,
  Partial<StrokeAttributes>,
  Partial<RoughAttributes>,
  Partial<MarkerAttributes>,
  Partial<BindingAttributes>,
  Partial<BindedAttributes> { }
export interface LineSerializedNode
  extends BaseSerializeNode<'line'>,
  Partial<Pick<Line, 'x1' | 'y1' | 'x2' | 'y2'>>,
  Partial<StrokeAttributes>,
  Partial<Pick<AttenuationAttributes, 'strokeAttenuation'>>,
  Partial<MarkerAttributes>,
  Partial<BindingAttributes> { }

interface PolylineAttributes {
  points: string;
}
export interface PolylineSerializedNode
  extends BaseSerializeNode<'polyline'>,
  Partial<PolylineAttributes>,
  Partial<StrokeAttributes>,
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
  Partial<BrushAttributes>,
  Partial<WireframeAttributes>,
  Partial<BindedAttributes> { }

interface PathAttributes {
  d: string;
  fillRule: Path['fillRule'];
  tessellationMethod: Path['tessellationMethod'];
}
export interface PathSerializedNode
  extends BaseSerializeNode<'path'>,
  Partial<PathAttributes>,
  Partial<FillAttributes>,
  Partial<StrokeAttributes>,
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

export type NodeSerializedNode = EllipseSerializedNode | RectSerializedNode | PathSerializedNode | TextSerializedNode | BrushSerializedNode | RoughRectSerializedNode | RoughEllipseSerializedNode | RoughPathSerializedNode | HtmlSerializedNode | EmbedSerializedNode;
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
  | EmbedSerializedNode;

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
  EmbedSerializedNode;
