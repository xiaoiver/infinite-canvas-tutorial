/**
 * Minimal type definitions for the subset of the
 * [Figma REST API](https://www.figma.com/developers/api) that the importer
 * consumes. These intentionally cover only the fields used by
 * {@link ./figma-to-ic.ts}; unknown fields are tolerated via index signatures.
 *
 * @see https://www.figma.com/developers/api#files-endpoints
 */

/** RGBA color, each channel in the 0–1 range (Figma `Color`). */
export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** 2x3 affine matrix `[[a, c, tx], [b, d, ty]]` (Figma `Transform`). */
export type FigmaTransform = [[number, number, number], [number, number, number]];

export interface FigmaRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FigmaBlendMode =
  | 'PASS_THROUGH'
  | 'NORMAL'
  | 'DARKEN'
  | 'MULTIPLY'
  | 'LINEAR_BURN'
  | 'COLOR_BURN'
  | 'LIGHTEN'
  | 'SCREEN'
  | 'LINEAR_DODGE'
  | 'COLOR_DODGE'
  | 'OVERLAY'
  | 'SOFT_LIGHT'
  | 'HARD_LIGHT'
  | 'DIFFERENCE'
  | 'EXCLUSION'
  | 'HUE'
  | 'SATURATION'
  | 'COLOR'
  | 'LUMINOSITY';

export interface FigmaColorStop {
  position: number;
  color: FigmaColor;
}

export interface FigmaPaint {
  type:
    | 'SOLID'
    | 'GRADIENT_LINEAR'
    | 'GRADIENT_RADIAL'
    | 'GRADIENT_ANGULAR'
    | 'GRADIENT_DIAMOND'
    | 'IMAGE'
    | 'EMOJI'
    | 'VIDEO';
  visible?: boolean;
  opacity?: number;
  blendMode?: FigmaBlendMode;
  color?: FigmaColor;
  gradientHandlePositions?: { x: number; y: number }[];
  gradientStops?: FigmaColorStop[];
  scaleMode?: 'FILL' | 'FIT' | 'TILE' | 'STRETCH' | 'CROP';
  imageRef?: string;
}

export interface FigmaEffect {
  type: 'INNER_SHADOW' | 'DROP_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible?: boolean;
  radius?: number;
  color?: FigmaColor;
  offset?: { x: number; y: number };
  spread?: number;
}

export interface FigmaTypeStyle {
  fontFamily?: string;
  fontPostScriptName?: string | null;
  fontWeight?: number;
  fontSize?: number;
  italic?: boolean;
  letterSpacing?: number;
  lineHeightPx?: number;
  textAlignHorizontal?: 'LEFT' | 'RIGHT' | 'CENTER' | 'JUSTIFIED';
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
}

export interface FigmaLayoutConstraint {
  vertical?: 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE';
  horizontal?: 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE';
}

export interface FigmaPathGeometry {
  path: string;
  windingRule?: 'NONZERO' | 'EVENODD' | 'NONE';
}

export type FigmaNodeType =
  | 'DOCUMENT'
  | 'CANVAS'
  | 'FRAME'
  | 'GROUP'
  | 'SECTION'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'INSTANCE'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'LINE'
  | 'REGULAR_POLYGON'
  | 'STAR'
  | 'VECTOR'
  | 'BOOLEAN_OPERATION'
  | 'TEXT'
  | 'SLICE';

export interface FigmaNode {
  id: string;
  name?: string;
  type: FigmaNodeType | string;
  visible?: boolean;
  children?: FigmaNode[];

  // Geometry
  absoluteBoundingBox?: FigmaRectangle | null;
  relativeTransform?: FigmaTransform;
  size?: { x: number; y: number };
  rotation?: number;

  // Paints
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
  strokeCap?: 'NONE' | 'ROUND' | 'SQUARE' | 'LINE_ARROW' | 'TRIANGLE_ARROW';
  strokeJoin?: 'MITER' | 'BEVEL' | 'ROUND';
  strokeDashes?: number[];
  strokeMiterAngle?: number;

  // Effects / compositing
  effects?: FigmaEffect[];
  blendMode?: FigmaBlendMode;
  opacity?: number;
  constraints?: FigmaLayoutConstraint;

  // Rect-specific
  cornerRadius?: number;
  rectangleCornerRadii?: [number, number, number, number];

  // Frame clipping
  clipsContent?: boolean;

  // Vector geometry
  fillGeometry?: FigmaPathGeometry[];
  strokeGeometry?: FigmaPathGeometry[];

  // Text
  characters?: string;
  style?: FigmaTypeStyle;

  // Component / instance linkage
  componentId?: string;

  [key: string]: unknown;
}

/** Response body of `GET /v1/files/:key`. */
export interface FigmaFileResponse {
  name?: string;
  lastModified?: string;
  version?: string;
  document: FigmaNode;
  components?: Record<string, { name?: string; description?: string }>;
  componentSets?: Record<string, { name?: string; description?: string }>;
  styles?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Response body of `GET /v1/images/:key`. */
export interface FigmaImagesResponse {
  err?: string | null;
  images: Record<string, string | null>;
}

/** Response body of `GET /v1/files/:key/images` (image fill ref → URL). */
export interface FigmaImageFillsResponse {
  error?: boolean;
  status?: number;
  meta?: { images: Record<string, string> };
}
