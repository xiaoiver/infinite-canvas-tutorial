/**
 * Convert a Figma document tree (as returned by the Figma REST API
 * `GET /v1/files/:key`) into Infinite Canvas `SerializedNode[]` and an
 * `.ic` document.
 *
 * The `.ic` `SerializedNode` model is intentionally Figma-shaped (multi-layer
 * `fills`/`strokes` as a `Paint` subset, layer `blendMode`, `opacity`,
 * inner/drop shadow, `filter`, constraints, and components/instances via
 * `reusable` + `type: 'ref'`), so this is a node-tree mapping rather than a
 * data-model translation.
 *
 * Only `import type` is used from `@infinite-canvas-tutorial/ecs`, so this
 * module has no runtime dependency on ecs and can be unit-tested in isolation.
 *
 * Documented gaps (unsupported on first pass): grid auto-layout, prototyping /
 * interactions, masks, and boolean operations beyond their flattened geometry.
 */

import type {
  SerializedNode,
  RectSerializedNode,
  EllipseSerializedNode,
  PathSerializedNode,
  TextSerializedNode,
  GSerializedNode,
  RefSerializedNode,
  SerializedFillLayerItem,
  SerializedStrokeLayerItem,
  FillLayerBlendMode,
  DesignVariablesMap,
  ICDocumentV1,
} from '@infinite-canvas-tutorial/ecs';

import { IC_DOCUMENT_TYPE, IC_SCHEMA_VERSION } from './constants';
import type {
  FigmaColor,
  FigmaFileResponse,
  FigmaNode,
  FigmaPaint,
  FigmaBlendMode,
} from './figma-types';
import {
  applyAutoLayoutChildAttributes,
  applyAutoLayoutContainerAttributes,
} from './figma-layout';

export interface FigmaToIcOptions {
  /**
   * Resolved image-fill URLs keyed by Figma `imageRef`. Obtain via
   * {@link ./rest-client.ts}'s `getImageFills`; image fills whose ref is not
   * present here fall back to a transparent solid fill.
   */
  imageRefUrls?: Record<string, string>;
  /** Document `source` written into the produced `.ic` document. */
  source?: string;
}

const TWO_PI = Math.PI * 2;

/** Figma layer blend mode → `.ic` {@link FillLayerBlendMode}. */
const BLEND_MODE_MAP: Record<FigmaBlendMode, FillLayerBlendMode | undefined> = {
  PASS_THROUGH: 'normal',
  NORMAL: 'normal',
  DARKEN: 'darken',
  MULTIPLY: 'multiply',
  LINEAR_BURN: 'linearBurn',
  COLOR_BURN: 'colorBurn',
  LIGHTEN: 'light',
  SCREEN: 'screen',
  LINEAR_DODGE: 'linearDodge',
  COLOR_DODGE: 'colorDodge',
  OVERLAY: 'overlay',
  SOFT_LIGHT: 'softLight',
  HARD_LIGHT: 'hardLight',
  DIFFERENCE: 'difference',
  EXCLUSION: 'exclusion',
  HUE: 'hue',
  SATURATION: 'saturation',
  COLOR: 'color',
  LUMINOSITY: 'luminosity',
};

function mapBlendMode(
  mode: FigmaBlendMode | undefined,
): FillLayerBlendMode | undefined {
  if (!mode) {
    return undefined;
  }
  const mapped = BLEND_MODE_MAP[mode];
  return mapped && mapped !== 'normal' ? mapped : undefined;
}

function channelToHex(c: number): string {
  const v = Math.max(0, Math.min(255, Math.round(c * 255)));
  return v.toString(16).padStart(2, '0');
}

/** Figma `Color` (0–1 channels) → `#rrggbb` (alpha returned separately). */
export function figmaColorToHex(color: FigmaColor): string {
  return `#${channelToHex(color.r)}${channelToHex(color.g)}${channelToHex(
    color.b,
  )}`;
}

function paintToFillLayer(
  paint: FigmaPaint,
  imageRefUrls?: Record<string, string>,
): SerializedFillLayerItem | undefined {
  const enabled = paint.visible !== false;
  const blendMode = mapBlendMode(paint.blendMode);
  switch (paint.type) {
    case 'SOLID': {
      if (!paint.color) {
        return undefined;
      }
      // Figma encodes paint alpha both via `color.a` and `opacity`.
      const opacity = (paint.opacity ?? 1) * (paint.color.a ?? 1);
      return {
        type: 'solid',
        value: figmaColorToHex(paint.color),
        opacity,
        enabled,
        ...(blendMode ? { blendMode } : {}),
      };
    }
    case 'GRADIENT_LINEAR':
    case 'GRADIENT_RADIAL':
    case 'GRADIENT_ANGULAR':
    case 'GRADIENT_DIAMOND': {
      const value = gradientToCss(paint);
      if (!value) {
        return undefined;
      }
      return {
        type: 'gradient',
        value,
        opacity: paint.opacity ?? 1,
        enabled,
        ...(blendMode ? { blendMode } : {}),
      };
    }
    case 'IMAGE': {
      const url = paint.imageRef
        ? imageRefUrls?.[paint.imageRef]
        : undefined;
      if (!url) {
        return undefined;
      }
      return {
        type: 'image',
        value: url,
        objectFit: paint.scaleMode === 'FIT' ? 'contain' : 'cover',
        opacity: paint.opacity ?? 1,
        enabled,
        ...(blendMode ? { blendMode } : {}),
      };
    }
    default:
      return undefined;
  }
}

function gradientToCss(paint: FigmaPaint): string | undefined {
  const stops = paint.gradientStops;
  if (!stops || stops.length === 0) {
    return undefined;
  }
  const stopStr = stops
    .map(
      (s) =>
        `${figmaColorToHex(s.color)} ${Math.round(s.position * 100)}%`,
    )
    .join(', ');
  // Figma gradient handle positions describe direction; approximate as a
  // top-to-bottom linear gradient for linear, radial otherwise.
  if (paint.type === 'GRADIENT_RADIAL' || paint.type === 'GRADIENT_DIAMOND') {
    return `radial-gradient(${stopStr})`;
  }
  const handles = paint.gradientHandlePositions;
  let angleDeg = 90;
  if (handles && handles.length >= 2) {
    const dx = handles[1].x - handles[0].x;
    const dy = handles[1].y - handles[0].y;
    // ECS `parseGradient` treats the angle as math degrees on the shape
    // (0° = east, 90° = south), not the CSS "to top" keyword convention.
    angleDeg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
  }
  return `linear-gradient(${angleDeg}deg, ${stopStr})`;
}

function collectFills(
  node: FigmaNode,
  imageRefUrls?: Record<string, string>,
): SerializedFillLayerItem[] | undefined {
  if (!node.fills) {
    return undefined;
  }
  const fills = node.fills
    .map((p) => paintToFillLayer(p, imageRefUrls))
    .filter((f): f is SerializedFillLayerItem => !!f);
  return fills.length > 0 ? fills : [];
}

function collectStrokes(
  node: FigmaNode,
  imageRefUrls?: Record<string, string>,
): SerializedStrokeLayerItem[] | undefined {
  if (!node.strokes || node.strokes.length === 0) {
    return undefined;
  }
  const strokes = node.strokes
    .map((p) => paintToFillLayer(p, imageRefUrls))
    .filter((f): f is SerializedStrokeLayerItem => !!f);
  return strokes.length > 0 ? strokes : undefined;
}

function applyStrokeAttributes(
  target: Record<string, unknown>,
  node: FigmaNode,
  imageRefUrls?: Record<string, string>,
): void {
  const strokes = collectStrokes(node, imageRefUrls);
  if (strokes) {
    target.strokes = strokes;
  }
  if (typeof node.strokeWeight === 'number') {
    target.strokeWidth = node.strokeWeight;
  }
  if (node.strokeAlign) {
    // Figma uses INSIDE/OUTSIDE/CENTER; `.ic` Stroke uses inner/outer/center.
    const align = node.strokeAlign.toUpperCase();
    target.strokeAlignment =
      align === 'INSIDE'
        ? 'inner'
        : align === 'OUTSIDE'
          ? 'outer'
          : 'center';
  }
  if (node.strokeCap && node.strokeCap !== 'NONE') {
    const cap = node.strokeCap.toLowerCase();
    if (cap === 'round' || cap === 'square') {
      target.strokeLinecap = cap;
    }
  }
  if (node.strokeJoin) {
    target.strokeLinejoin = node.strokeJoin.toLowerCase();
  }
  if (node.strokeDashes && node.strokeDashes.length > 0) {
    target.strokeDasharray = node.strokeDashes.join(' ');
  }
}

function applyEffects(
  target: Record<string, unknown>,
  node: FigmaNode,
): void {
  if (!node.effects) {
    return;
  }
  const blurs: string[] = [];
  for (const effect of node.effects) {
    if (effect.visible === false) {
      continue;
    }
    switch (effect.type) {
      case 'DROP_SHADOW':
        if (effect.color) {
          target.dropShadowColor = figmaColorToHex(effect.color);
          target.dropShadowOffsetX = effect.offset?.x ?? 0;
          target.dropShadowOffsetY = effect.offset?.y ?? 0;
          target.dropShadowBlurRadius = effect.radius ?? 0;
        }
        break;
      case 'INNER_SHADOW':
        if (effect.color) {
          target.innerShadowColor = figmaColorToHex(effect.color);
          target.innerShadowOffsetX = effect.offset?.x ?? 0;
          target.innerShadowOffsetY = effect.offset?.y ?? 0;
          target.innerShadowBlurRadius = effect.radius ?? 0;
        }
        break;
      case 'LAYER_BLUR':
      case 'BACKGROUND_BLUR':
        if (effect.radius) {
          blurs.push(`blur(${effect.radius}px)`);
        }
        break;
      default:
        break;
    }
  }
  if (blurs.length > 0) {
    target.filter = blurs.join(' ');
  }
}

interface ResolvedTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

function resolveTransform(node: FigmaNode): ResolvedTransform {
  const box = node.absoluteBoundingBox;
  const width = node.size?.x ?? box?.width ?? 0;
  const height = node.size?.y ?? box?.height ?? 0;
  let rotation = 0;
  if (node.relativeTransform) {
    const [[a], [b]] = node.relativeTransform;
    rotation = Math.atan2(b, a);
    // Normalize to (-PI, PI].
    rotation = ((rotation % TWO_PI) + TWO_PI) % TWO_PI;
    if (rotation > Math.PI) {
      rotation -= TWO_PI;
    }
  }
  return {
    x: box?.x ?? 0,
    y: box?.y ?? 0,
    width,
    height,
    rotation,
  };
}

function applyCommonNodeAttributes(
  target: Record<string, unknown>,
  node: FigmaNode,
): void {
  const { x, y, width, height, rotation } = resolveTransform(node);
  target.x = x;
  target.y = y;
  target.width = width;
  target.height = height;
  if (rotation !== 0) {
    target.rotation = rotation;
  }
  if (node.name) {
    target.name = node.name;
  }
  if (node.visible === false) {
    target.visibility = 'hidden';
  }
  if (typeof node.opacity === 'number' && node.opacity !== 1) {
    target.opacity = node.opacity;
  }
  const blendMode = mapBlendMode(node.blendMode);
  if (blendMode) {
    target.blendMode = blendMode;
  }
  // Figma layout constraints have no first-class `.ic` equivalent (the `.ic`
  // `ConstraintAttributes` model is mxGraph port constraints, not resize
  // anchoring). Preserve them losslessly as `data-*` attributes so they
  // survive a round-trip and can drive responsive layout in the future.
  if (node.constraints) {
    const dataAttrs: Record<string, string> = {};
    if (node.constraints.horizontal) {
      dataAttrs['figma-constraint-h'] =
        node.constraints.horizontal.toLowerCase();
    }
    if (node.constraints.vertical) {
      dataAttrs['figma-constraint-v'] =
        node.constraints.vertical.toLowerCase();
    }
    if (Object.keys(dataAttrs).length > 0) {
      target.svgDataAttributes = dataAttrs;
    }
  }

  applyAutoLayoutChildAttributes(target, node);
}

function applyFrameContainerAttributes(
  target: Record<string, unknown>,
  node: FigmaNode,
  imageRefUrls: Record<string, string> | undefined,
): void {
  const fills = collectFills(node, imageRefUrls);
  if (fills && fills.length > 0) {
    target.fills = fills;
  }
  const radius =
    node.cornerRadius ??
    (node.rectangleCornerRadii ? node.rectangleCornerRadii[0] : undefined);
  if (typeof radius === 'number' && radius > 0) {
    target.cornerRadius = radius;
  }
  if (node.clipsContent) {
    target.clipMode = 'clip';
  }
  applyAutoLayoutContainerAttributes(target, node);
}

function geometryToPathD(node: FigmaNode): string | undefined {
  const geom = node.fillGeometry ?? node.strokeGeometry;
  if (!geom || geom.length === 0) {
    return undefined;
  }
  return geom.map((g) => g.path).join(' ');
}

interface ConversionState {
  options: FigmaToIcOptions;
  fallbackIdCounter: number;
}

function ensureId(node: FigmaNode, state: ConversionState): string {
  if (node.id) {
    return node.id;
  }
  state.fallbackIdCounter += 1;
  return `figma-${state.fallbackIdCounter}`;
}

/**
 * Convert a single Figma node (and its subtree) into one or more
 * `SerializedNode`s. Pushes converted nodes into `out`. Returns the id of the
 * node that was produced for `node`, or `undefined` when the node type is
 * skipped.
 */
function convertNode(
  node: FigmaNode,
  parentId: string | undefined,
  zIndex: number,
  out: SerializedNode[],
  state: ConversionState,
): string | undefined {
  const id = ensureId(node, state);
  const imageRefUrls = state.options.imageRefUrls;

  const base: Record<string, unknown> = {
    id,
    zIndex,
    ...(parentId ? { parentId } : {}),
  };
  applyCommonNodeAttributes(base, node);

  let produced: SerializedNode | undefined;
  let recurseAsChildren = true;

  switch (node.type) {
    case 'FRAME':
    case 'SECTION':
    case 'COMPONENT':
    case 'COMPONENT_SET': {
      const frame = base as unknown as RectSerializedNode;
      frame.type = 'rect';
      applyFrameContainerAttributes(base, node, imageRefUrls);
      if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
        base.reusable = true;
      }
      produced = frame;
      break;
    }
    case 'GROUP': {
      const g = base as unknown as GSerializedNode;
      g.type = 'g';
      const fills = collectFills(node, imageRefUrls);
      if (fills && fills.length > 0) {
        g.fills = fills;
      }
      if (node.clipsContent) {
        (base as Record<string, unknown>).clipMode = 'clip';
      }
      applyAutoLayoutContainerAttributes(base, node);
      produced = g;
      break;
    }
    case 'INSTANCE': {
      const ref = base as unknown as RefSerializedNode;
      ref.type = 'ref';
      ref.ref = (node.componentId as string) ?? '';
      produced = ref;
      // Instances render their own children snapshot; do not duplicate them.
      recurseAsChildren = false;
      break;
    }
    case 'RECTANGLE': {
      const rect = base as unknown as RectSerializedNode;
      rect.type = 'rect';
      const radius =
        node.cornerRadius ??
        (node.rectangleCornerRadii ? node.rectangleCornerRadii[0] : undefined);
      if (typeof radius === 'number' && radius > 0) {
        rect.cornerRadius = radius;
      }
      const fills = collectFills(node, imageRefUrls);
      if (fills) {
        rect.fills = fills;
      }
      applyStrokeAttributes(base, node, imageRefUrls);
      applyEffects(base, node);
      produced = rect;
      break;
    }
    case 'ELLIPSE': {
      const ellipse = base as unknown as EllipseSerializedNode;
      ellipse.type = 'ellipse';
      const { width, height } = resolveTransform(node);
      ellipse.cx = width / 2;
      ellipse.cy = height / 2;
      ellipse.rx = width / 2;
      ellipse.ry = height / 2;
      const fills = collectFills(node, imageRefUrls);
      if (fills) {
        ellipse.fills = fills;
      }
      applyStrokeAttributes(base, node, imageRefUrls);
      applyEffects(base, node);
      produced = ellipse;
      break;
    }
    case 'TEXT': {
      const text = base as unknown as TextSerializedNode;
      text.type = 'text';
      text.content = node.characters ?? '';
      const style = node.style;
      if (style) {
        if (style.fontFamily) {
          text.fontFamily = style.fontFamily;
        }
        if (typeof style.fontSize === 'number') {
          text.fontSize = style.fontSize;
        }
        if (typeof style.fontWeight === 'number') {
          text.fontWeight = style.fontWeight;
        }
        if (style.italic) {
          text.fontStyle = 'italic';
        }
        if (typeof style.letterSpacing === 'number') {
          text.letterSpacing = style.letterSpacing;
        }
        if (typeof style.lineHeightPx === 'number') {
          text.lineHeight = style.lineHeightPx;
        }
        if (style.textAlignHorizontal) {
          text.textAlign = style.textAlignHorizontal.toLowerCase() as never;
        }
        if (style.textDecoration === 'UNDERLINE') {
          text.decorationLine = 'underline';
        } else if (style.textDecoration === 'STRIKETHROUGH') {
          text.decorationLine = 'line-through';
        }
      }
      const fills = collectFills(node, imageRefUrls);
      if (fills) {
        text.fills = fills;
      }
      applyEffects(base, node);
      produced = text;
      break;
    }
    case 'VECTOR':
    case 'STAR':
    case 'LINE':
    case 'REGULAR_POLYGON':
    case 'BOOLEAN_OPERATION': {
      const path = base as unknown as PathSerializedNode;
      path.type = 'path';
      const d = geometryToPathD(node);
      if (d) {
        path.d = d;
      }
      const fills = collectFills(node, imageRefUrls);
      if (fills) {
        path.fills = fills;
      }
      applyStrokeAttributes(base, node, imageRefUrls);
      applyEffects(base, node);
      produced = path;
      break;
    }
    default:
      // Unsupported leaf type (e.g. SLICE): skip but still recurse children.
      produced = undefined;
      break;
  }

  if (produced) {
    out.push(produced);
  }

  const childParentId = produced ? id : parentId;
  if (recurseAsChildren && node.children) {
    node.children.forEach((child, index) => {
      convertNode(child, childParentId, index, out, state);
    });
  }

  return produced ? id : undefined;
}

/**
 * Flatten a Figma document tree into `SerializedNode[]`. Walks
 * `DOCUMENT → CANVAS → …`, emitting every supported descendant. Pages
 * (`CANVAS`) are flattened — each page's top-level children become scene roots.
 */
export function figmaDocumentToSerializedNodes(
  file: FigmaFileResponse,
  options: FigmaToIcOptions = {},
): SerializedNode[] {
  const out: SerializedNode[] = [];
  const document = file.document;
  if (!document) {
    return out;
  }
  const state: ConversionState = { options, fallbackIdCounter: 0 };
  const pages = document.children ?? [];
  let zIndex = 0;
  for (const page of pages) {
    const roots = page.children ?? [];
    for (const root of roots) {
      convertNode(root, undefined, zIndex, out, state);
      zIndex += 1;
    }
  }
  return out;
}

/**
 * Build a complete `.ic` document (`ICDocumentV1`) from a Figma file response,
 * ready to feed into `API.importIcDocument`.
 */
export function parseFigmaFileToSerializedNodes(
  file: FigmaFileResponse,
  options: FigmaToIcOptions = {},
): ICDocumentV1 {
  const elements = figmaDocumentToSerializedNodes(file, options);
  const variables: DesignVariablesMap = {};
  return {
    type: IC_DOCUMENT_TYPE,
    version: IC_SCHEMA_VERSION,
    source: options.source ?? 'https://www.figma.com',
    variables,
    themes: {},
    elements,
    appState: {},
  };
}
