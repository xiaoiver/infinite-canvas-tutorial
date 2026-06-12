/**
 * Convert Infinite Canvas `SerializedNode[]` into a plain "Figma scene
 * description" JSON that the companion Figma plugin (`figma-plugin/`) replays
 * via the Figma Plugin API to create real Figma nodes.
 *
 * This is the inverse direction of {@link ./figma-to-ic.ts}. Because the Figma
 * REST API cannot write document content, export goes through the in-Figma
 * plugin rather than the network.
 *
 * Only `import type` is used from `@infinite-canvas-tutorial/ecs`.
 */

import type {
  SerializedNode,
  SerializedFillLayerItem,
  ICDocumentV1,
} from '@infinite-canvas-tutorial/ecs';

/** RGBA with channels in the 0–1 range (matches the Figma Plugin API). */
export interface FigmaSceneColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaScenePaint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'IMAGE';
  color?: FigmaSceneColor;
  opacity?: number;
  /** Image URL / data URL for `IMAGE` paints. */
  imageUrl?: string;
}

export type FigmaSceneNodeType =
  | 'FRAME'
  | 'GROUP'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'VECTOR'
  | 'TEXT';

export interface FigmaSceneNode {
  id: string;
  type: FigmaSceneNodeType;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  visible?: boolean;
  cornerRadius?: number;
  fills?: FigmaScenePaint[];
  strokes?: FigmaScenePaint[];
  strokeWeight?: number;
  // Text
  characters?: string;
  fontSize?: number;
  fontFamily?: string;
  // Vector
  vectorPath?: string;
  children?: FigmaSceneNode[];
}

/** Top-level payload consumed by the companion Figma plugin. */
export interface FigmaScene {
  /** Discriminator so the plugin can validate the payload. */
  type: 'infinite-canvas-figma-scene';
  version: 1;
  source?: string;
  nodes: FigmaSceneNode[];
}

const HEX_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_LONG = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i;

/** Parse a `#rgb` / `#rrggbb` / `#rrggbbaa` string into 0–1 RGBA. */
export function hexToFigmaColor(hex: string): FigmaSceneColor | undefined {
  const value = hex.trim();
  const short = value.match(HEX_SHORT);
  if (short) {
    return {
      r: parseInt(short[1] + short[1], 16) / 255,
      g: parseInt(short[2] + short[2], 16) / 255,
      b: parseInt(short[3] + short[3], 16) / 255,
      a: 1,
    };
  }
  const long = value.match(HEX_LONG);
  if (long) {
    return {
      r: parseInt(long[1], 16) / 255,
      g: parseInt(long[2], 16) / 255,
      b: parseInt(long[3], 16) / 255,
      a: long[4] !== undefined ? parseInt(long[4], 16) / 255 : 1,
    };
  }
  return undefined;
}

function fillLayerToPaint(
  layer: SerializedFillLayerItem,
): FigmaScenePaint | undefined {
  if (layer.enabled === false) {
    return undefined;
  }
  const opacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
  if (layer.type === 'solid') {
    const color = hexToFigmaColor(layer.value);
    if (!color) {
      return undefined;
    }
    return { type: 'SOLID', color, opacity };
  }
  if (layer.type === 'image') {
    return { type: 'IMAGE', imageUrl: layer.value, opacity };
  }
  // Gradients/patterns are not converted faithfully; fall back to a solid mid
  // gray so the layer is at least visible in Figma.
  if (layer.type === 'gradient') {
    if (typeof console !== 'undefined') {
      console.warn(
        '[figma] gradient fills are not converted faithfully; falling back to a solid mid-gray paint.',
      );
    }
    return { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, opacity };
  }
  return undefined;
}

function collectPaints(
  fills: SerializedFillLayerItem[] | undefined,
): FigmaScenePaint[] | undefined {
  if (!fills || fills.length === 0) {
    return undefined;
  }
  const paints = fills
    .map(fillLayerToPaint)
    .filter((p): p is FigmaScenePaint => !!p);
  return paints.length > 0 ? paints : undefined;
}

function nodeTypeToScene(node: SerializedNode): FigmaSceneNodeType | undefined {
  switch (node.type) {
    case 'rect':
    case 'rough-rect':
      return 'RECTANGLE';
    case 'ellipse':
    case 'rough-ellipse':
      return 'ELLIPSE';
    case 'text':
      return 'TEXT';
    case 'g':
      return 'FRAME';
    case 'path':
    case 'rough-path':
    case 'polyline':
    case 'line':
    case 'brush':
    case 'vector-network':
      return 'VECTOR';
    default:
      return undefined;
  }
}

function convertOne(
  node: SerializedNode,
  childrenByParent: Map<string, SerializedNode[]>,
): FigmaSceneNode | undefined {
  const type = nodeTypeToScene(node);
  if (!type) {
    return undefined;
  }
  const anyNode = node as unknown as Record<string, unknown>;
  const scene: FigmaSceneNode = {
    id: node.id,
    type,
    x: (anyNode.x as number) ?? 0,
    y: (anyNode.y as number) ?? 0,
    width: (anyNode.width as number) ?? 0,
    height: (anyNode.height as number) ?? 0,
  };
  if (typeof anyNode.name === 'string') {
    scene.name = anyNode.name;
  }
  if (typeof anyNode.rotation === 'number' && anyNode.rotation !== 0) {
    scene.rotation = anyNode.rotation as number;
  }
  if (typeof anyNode.opacity === 'number' && anyNode.opacity !== 1) {
    scene.opacity = anyNode.opacity as number;
  }
  if (anyNode.visibility === 'hidden') {
    scene.visible = false;
  }
  if (typeof anyNode.cornerRadius === 'number') {
    scene.cornerRadius = anyNode.cornerRadius as number;
  }

  const fills = collectPaints(anyNode.fills as SerializedFillLayerItem[]);
  if (fills) {
    scene.fills = fills;
  }
  const strokes = collectPaints(anyNode.strokes as SerializedFillLayerItem[]);
  if (strokes) {
    scene.strokes = strokes;
  }
  if (typeof anyNode.strokeWidth === 'number') {
    scene.strokeWeight = anyNode.strokeWidth as number;
  }

  if (type === 'TEXT') {
    scene.characters = (anyNode.content as string) ?? '';
    if (typeof anyNode.fontSize === 'number') {
      scene.fontSize = anyNode.fontSize as number;
    }
    if (typeof anyNode.fontFamily === 'string') {
      scene.fontFamily = anyNode.fontFamily as string;
    }
  }
  if (type === 'VECTOR' && typeof anyNode.d === 'string') {
    scene.vectorPath = anyNode.d as string;
  }

  const children = childrenByParent.get(node.id);
  if (children && children.length > 0) {
    const sceneChildren = children
      .map((c) => convertOne(c, childrenByParent))
      .filter((c): c is FigmaSceneNode => !!c);
    if (sceneChildren.length > 0) {
      scene.children = sceneChildren;
    }
  }

  return scene;
}

/**
 * Convert a flat `SerializedNode[]` (with `parentId` links) into a nested
 * {@link FigmaScene} payload for the companion plugin.
 */
export function serializedNodesToFigmaScene(
  nodes: SerializedNode[],
  source?: string,
): FigmaScene {
  const childrenByParent = new Map<string, SerializedNode[]>();
  const roots: SerializedNode[] = [];
  for (const node of nodes) {
    const parentId = (node as unknown as { parentId?: string }).parentId;
    if (parentId) {
      const list = childrenByParent.get(parentId);
      if (list) {
        list.push(node);
      } else {
        childrenByParent.set(parentId, [node]);
      }
    } else {
      roots.push(node);
    }
  }

  const sceneNodes = roots
    .map((n) => convertOne(n, childrenByParent))
    .filter((n): n is FigmaSceneNode => !!n);

  return {
    type: 'infinite-canvas-figma-scene',
    version: 1,
    ...(source ? { source } : {}),
    nodes: sceneNodes,
  };
}

/** Convenience: build a {@link FigmaScene} from a full `.ic` document. */
export function icDocumentToFigmaScene(doc: ICDocumentV1): FigmaScene {
  return serializedNodesToFigmaScene(doc.elements, doc.source);
}
