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
  Stroke,
  Text,
  TextDecoration,
  VectorNetwork,
  Visibility,
} from '../../components';

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

export interface GSerializedNode extends BaseSerializeNode<'g'> {}

export interface EllipseSerializedNode
  extends BaseSerializeNode<'ellipse'>,
    Partial<Pick<Ellipse, 'rx' | 'ry' | 'cx' | 'cy'>>,
    Partial<FillAttributes>,
    Partial<StrokeAttributes>,
    Partial<AttenuationAttributes>,
    Partial<WireframeAttributes>,
    Partial<FilterAttributes> {}

export interface RectSerializedNode
  extends BaseSerializeNode<'rect'>,
    Partial<Pick<Rect, 'width' | 'height' | 'cornerRadius'>>,
    Partial<FillAttributes>,
    Partial<StrokeAttributes>,
    Partial<InnerShadowAttributes>,
    Partial<DropShadowAttributes>,
    Partial<AttenuationAttributes>,
    Partial<WireframeAttributes>,
    Partial<FilterAttributes> {}

export interface RoughRectSerializedNode
  extends BaseSerializeNode<'rough-rect'>,
    Partial<Pick<Rect, 'width' | 'height' | 'cornerRadius'>>,
    Partial<FillAttributes>,
    Partial<StrokeAttributes>,
    Partial<RoughAttributes> {}

export interface RoughEllipseSerializedNode
  extends BaseSerializeNode<'rough-ellipse'>,
    Partial<Pick<Ellipse, 'rx' | 'ry' | 'cx' | 'cy'>>,
    Partial<FillAttributes>,
    Partial<StrokeAttributes>,
    Partial<RoughAttributes> {}

export interface RoughLineSerializedNode
  extends BaseSerializeNode<'rough-line'>,
    Partial<Pick<Line, 'x1' | 'y1' | 'x2' | 'y2'>>,
    Partial<StrokeAttributes>,
    Partial<Pick<AttenuationAttributes, 'strokeAttenuation'>> {}
export interface RoughPolylineSerializedNode
  extends BaseSerializeNode<'rough-polyline'>,
    Partial<PolylineAttributes>,
    Partial<StrokeAttributes>,
    Partial<RoughAttributes> {}
export interface LineSerializedNode
  extends BaseSerializeNode<'line'>,
    Partial<Pick<Line, 'x1' | 'y1' | 'x2' | 'y2'>>,
    Partial<StrokeAttributes>,
    Partial<Pick<AttenuationAttributes, 'strokeAttenuation'>> {}

interface PolylineAttributes {
  points: string;
}
export interface PolylineSerializedNode
  extends BaseSerializeNode<'polyline'>,
    Partial<PolylineAttributes>,
    Partial<StrokeAttributes>,
    Partial<Pick<AttenuationAttributes, 'strokeAttenuation'>>,
    Partial<WireframeAttributes>,
    Partial<MarkerAttributes> {}

export interface BrushAttributes {
  points: string;
  brushType: BrushType;
  brushStamp: string;
  stroke: Stroke['color'];
  strokeOpacity: Opacity['strokeOpacity'];
}
export interface BrushSerializedNode
  extends BaseSerializeNode<'brush'>,
    Partial<BrushAttributes>,
    Partial<WireframeAttributes> {}
export interface PathSerializedNode
  extends BaseSerializeNode<'path'>,
    Partial<Pick<Path, 'd' | 'fillRule' | 'tessellationMethod'>>,
    Partial<FillAttributes>,
    Partial<StrokeAttributes>,
    Partial<AttenuationAttributes>,
    Partial<WireframeAttributes>,
    Partial<MarkerAttributes>,
    Partial<FilterAttributes> {}

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
  > {}

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
    Partial<WireframeAttributes> {}

export interface VectorNetworkAttributes {
  vertices: VectorNetwork['vertices'];
  segments: VectorNetwork['segments'];
  regions: VectorNetwork['regions'];
}
export interface VectorNetworkSerializedNode
  extends BaseSerializeNode<'vector-network'>,
    Partial<VectorNetworkAttributes> {}

export interface HtmlAttributes {
  html: string;
}
export interface HtmlSerializedNode
  extends BaseSerializeNode<'html'>,
    Partial<HtmlAttributes> {}

export interface EmbedAttributes {
  url: string;
}
export interface EmbedSerializedNode
  extends BaseSerializeNode<'embed'>,
    Partial<EmbedAttributes> {}

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
  VectorNetworkSerializedNode &
  HtmlSerializedNode &
  EmbedSerializedNode;
