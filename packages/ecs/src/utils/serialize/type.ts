import {
  Circle,
  DropShadow,
  Ellipse,
  InnerShadow,
  Opacity,
  Path,
  Rect,
  Stroke,
  Text,
  Visibility,
} from '../../components';

// @see https://dev.to/themuneebh/typescript-branded-types-in-depth-overview-and-use-cases-60e
export type FractionalIndex = string & { _brand: 'franctionalIndex' };
export type Ordered<TElement extends SerializedNode> = TElement & {
  index: FractionalIndex;
};
export type OrderedSerializedNode = Ordered<SerializedNode>;

/**
 * Refer SVG attribut
 * @see https://github.com/tldraw/tldraw/blob/main/packages/tlschema/src/shapes/TLBaseShape.ts
 * @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/element/types.ts
 */
export interface BaseSerializeNode<Type extends string>
  extends TransformAttributes,
    VisibilityAttributes,
    NameAttributes {
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
  type: Type;

  /**
   * @see https://github.com/excalidraw/excalidraw/issues/1639
   */
  version?: number;
  versionNonce?: number;
  isDeleted?: boolean;

  /**
   * String in a fractional form defined by https://github.com/rocicorp/fractional-indexing.
   * Used for ordering in multiplayer scenarios, such as during reconciliation or undo / redo.
   * Always kept in sync with the array order by `syncMovedIndices` and `syncInvalidIndices`.
   * Could be null, i.e. for new elements which were not yet assigned to the scene.
   */
  index?: FractionalIndex | null;

  updated?: number;
}

export type SerializedTransform = {
  matrix: {
    a: number;
    b: number;
    c: number;
    d: number;
    tx: number;
    ty: number;
  };
  position: {
    x: number;
    y: number;
  };
  scale: {
    x: number;
    y: number;
  };
  skew: {
    x: number;
    y: number;
  };
  rotation: number;
  pivot: {
    x: number;
    y: number;
  };
};

export interface NameAttributes {
  name: string;
}

export interface TransformAttributes {
  transform: SerializedTransform;
  lockAspectRatio: boolean;
}

export interface VisibilityAttributes {
  visibility: Visibility['value'];
}

export interface FillAttributes {
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

export interface GSerializedNode extends BaseSerializeNode<'g'> {}

export interface CircleSerializedNode
  extends BaseSerializeNode<'circle'>,
    Pick<Circle, 'cx' | 'cy' | 'r'>,
    FillAttributes,
    StrokeAttributes {}

export interface EllipseSerializedNode
  extends BaseSerializeNode<'ellipse'>,
    Pick<Ellipse, 'cx' | 'cy' | 'rx' | 'ry'>,
    FillAttributes,
    StrokeAttributes {}

export interface RectSerializedNode
  extends BaseSerializeNode<'rect'>,
    Pick<Rect, 'x' | 'y' | 'width' | 'height' | 'cornerRadius'>,
    FillAttributes,
    StrokeAttributes,
    InnerShadowAttributes,
    DropShadowAttributes {}

interface PolylineAttributes {
  points: string;
}
export interface PolylineSerializedNode
  extends BaseSerializeNode<'polyline'>,
    PolylineAttributes,
    StrokeAttributes {}

export interface PathSerializedNode
  extends BaseSerializeNode<'path'>,
    Pick<Path, 'd' | 'fillRule' | 'tessellationMethod'>,
    FillAttributes,
    StrokeAttributes {}

export interface TextSerializedNode
  extends BaseSerializeNode<'text'>,
    Pick<
      Text,
      | 'x'
      | 'y'
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
    >,
    FillAttributes,
    StrokeAttributes,
    DropShadowAttributes {}

export type SerializedNode =
  | GSerializedNode
  | CircleSerializedNode
  | EllipseSerializedNode
  | RectSerializedNode
  | PolylineSerializedNode
  | PathSerializedNode
  | TextSerializedNode;
