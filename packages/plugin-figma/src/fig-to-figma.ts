/**
 * Convert an {@link openfig-core} `FigDocument` (from a local `.fig` ZIP) into
 * the {@link FigmaFileResponse} tree consumed by {@link ./figma-to-ic.ts}.
 *
 * Pipeline: `parseFig(bytes)` → {@link figDocumentToFigmaFileResponse} →
 * {@link parseFigmaFileToSerializedNodes} (see {@link ./parse-fig-file.ts}).
 *
 * Mapping highlights:
 * - Node types: `ROUNDED_RECTANGLE` → `RECTANGLE`, `SYMBOL` → `COMPONENT`, etc.
 * - `fillPaints` / stroke paints → REST-shaped `fills` / `strokes` (gradients map
 *   `stops` → `gradientStops`; paint `transform` → `gradientHandlePositions` via
 *   openfig {@link resolveGradientGeometry} with node `size`).
 * - `.fig` lists paints top-to-bottom (Figma UI); REST / `.ic` stack bottom-to-top,
 *   so {@link resolveFillPaints} reverses before mapping.
 * - Embedded `images/*` hashes → data URLs via {@link buildImageRefUrlsFromFigDocument}.
 * - `VECTOR` paths resolved with openfig {@link resolveVectorNodePaths}.
 */

import type { FigDocument, FigNode, FigPaint } from 'openfig-core';
import {
  nodeId,
  resolveGradientGeometry,
  resolveVectorNodePaths,
} from 'openfig-core';

import type {
  FigmaBlendMode,
  FigmaEffect,
  FigmaFileResponse,
  FigmaNode,
  FigmaPaint,
} from './figma-types';
import { mapFigAutoLayoutToFigmaNode } from './figma-layout';

function mapNodeType(node: FigNode): string {
  switch (node.type) {
    case 'ROUNDED_RECTANGLE':
      return 'RECTANGLE';
    case 'SYMBOL':
      return 'COMPONENT';
    case 'BOOLEAN_GROUP':
      return 'BOOLEAN_OPERATION';
    case 'POLYGON':
      return 'REGULAR_POLYGON';
    default:
      return node.type;
  }
}

function extractImageRef(paint: FigPaint): string | undefined {
  const img = paint.image;
  if (!img) {
    return undefined;
  }
  if (typeof img.name === 'string' && img.name) {
    return img.name;
  }
  if (img.hash instanceof Uint8Array) {
    return Array.from(img.hash)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  if (typeof img.hash === 'string') {
    return img.hash;
  }
  return undefined;
}

function gradientHandlesFromFigPaint(
  paint: FigPaint,
  size: { x: number; y: number } | undefined,
): { x: number; y: number }[] | undefined {
  if (!paint.transform || !size || size.x <= 0 || size.y <= 0) {
    return undefined;
  }
  const isRadial =
    paint.type === 'GRADIENT_RADIAL' || paint.type === 'GRADIENT_DIAMOND';
  const geometry = resolveGradientGeometry(
    {
      type: isRadial ? 'radial' : 'linear',
      transform: paint.transform,
    },
    size.x,
    size.y,
  );
  if (!geometry) {
    return undefined;
  }
  const w = size.x;
  const h = size.y;
  if (geometry.type === 'linear') {
    return [
      { x: geometry.start.x / w, y: geometry.start.y / h },
      { x: geometry.end.x / w, y: geometry.end.y / h },
      {
        x: (geometry.start.x + geometry.end.x) / 2 / w,
        y: (geometry.start.y + geometry.end.y) / 2 / h,
      },
    ];
  }
  return [
    { x: geometry.center.x / w, y: geometry.center.y / h },
    { x: (geometry.center.x + geometry.radiusX) / w, y: geometry.center.y / h },
    {
      x: geometry.center.x / w,
      y: (geometry.center.y + geometry.radiusY) / h,
    },
  ];
}

function mapPaint(
  paint: FigPaint,
  size?: { x: number; y: number },
): FigmaPaint {
  const mapped: FigmaPaint = {
    type: paint.type as FigmaPaint['type'],
    visible: paint.visible,
    opacity: paint.opacity,
    blendMode: paint.blendMode as FigmaBlendMode | undefined,
    color: paint.color,
  };
  if (
    paint.type === 'GRADIENT_LINEAR' ||
    paint.type === 'GRADIENT_RADIAL' ||
    paint.type === 'GRADIENT_ANGULAR' ||
    paint.type === 'GRADIENT_DIAMOND'
  ) {
    if (paint.stops?.length) {
      mapped.gradientStops = paint.stops.map((stop) => ({
        position: stop.position,
        color: stop.color!,
      }));
    }
    const handles = gradientHandlesFromFigPaint(paint, size);
    if (handles) {
      mapped.gradientHandlePositions = handles;
    }
  }
  if (paint.type === 'IMAGE') {
    const ref = extractImageRef(paint);
    if (ref) {
      mapped.imageRef = ref;
    }
    const scaleMode = (paint as { imageScaleMode?: string }).imageScaleMode;
    if (scaleMode) {
      mapped.scaleMode = scaleMode as FigmaPaint['scaleMode'];
    }
  }
  return mapped;
}

function mapEffect(effect: NonNullable<FigNode['effects']>[number]): FigmaEffect {
  const type =
    effect.type === 'FOREGROUND_BLUR' ? 'LAYER_BLUR' : effect.type;
  return {
    type: type as FigmaEffect['type'],
    visible: effect.visible,
    radius: effect.radius,
    color: effect.color,
    offset: effect.offset,
    spread: effect.spread,
  };
}

function resolveFillPaints(node: FigNode): FigmaPaint[] {
  const size = node.size;
  if (
    node.type === 'SHAPE_WITH_TEXT' &&
    node.nodeGenerationData?.overrides?.[0]?.fillPaints
  ) {
    // `.fig` lists paints top-to-bottom (Figma UI order); REST / `.ic` use bottom-to-top.
    return [...node.nodeGenerationData.overrides[0].fillPaints]
      .reverse()
      .map((paint) => mapPaint(paint, size));
  }
  if (node.fillPaints?.length) {
    return [...node.fillPaints].reverse().map((paint) => mapPaint(paint, size));
  }
  return [];
}

function mapVectorGeometry(
  doc: FigDocument,
  node: FigNode,
  target: FigmaNode,
): void {
  try {
    const resolved = resolveVectorNodePaths(doc, node);
    const fillGeometry = resolved.fill.map((g) => ({
      path: g.svgPath,
      windingRule: (g.windingRule ?? 'NONZERO') as 'NONZERO' | 'EVENODD',
    }));
    const strokeGeometry = resolved.stroke.map((g) => ({
      path: g.svgPath,
      windingRule: (g.windingRule ?? 'NONZERO') as 'NONZERO' | 'EVENODD',
    }));
    if (fillGeometry.length > 0) {
      target.fillGeometry = fillGeometry;
    }
    if (strokeGeometry.length > 0) {
      target.strokeGeometry = strokeGeometry;
    }
  } catch {
    // Vector path resolution is best-effort.
  }
}

function getSortedChildren(doc: FigDocument, parentId: string): FigNode[] {
  const children = doc.childrenMap.get(parentId) ?? [];
  return children
    .filter((child) => child.phase !== 'REMOVED')
    .sort((a, b) =>
      (a.parentIndex?.position ?? '').localeCompare(
        b.parentIndex?.position ?? '',
      ),
    );
}

function mapCommonFields(
  doc: FigDocument,
  node: FigNode,
  target: FigmaNode,
): void {
  if (node.visible === false) {
    target.visible = false;
  }
  if (typeof node.opacity === 'number') {
    target.opacity = node.opacity;
  }

  const { transform, size } = node;
  if (transform && size) {
    const width = size.x;
    const height = size.y;
    target.absoluteBoundingBox = {
      x: transform.m02,
      y: transform.m12,
      width,
      height,
    };
    target.size = { x: width, y: height };
    target.relativeTransform = [
      [transform.m00, transform.m01, transform.m02],
      [transform.m10, transform.m11, transform.m12],
    ];
  } else if (size) {
    target.size = { x: size.x, y: size.y };
    target.absoluteBoundingBox = {
      x: 0,
      y: 0,
      width: size.x,
      height: size.y,
    };
  }

  const fills = resolveFillPaints(node);
  if (fills.length > 0) {
    target.fills = fills;
  }
  if (node.strokePaints?.length) {
    target.strokes = node.strokePaints.map((paint) => mapPaint(paint, size));
  }
  if (typeof node.strokeWeight === 'number') {
    target.strokeWeight = node.strokeWeight;
  }
  if (node.strokeAlign) {
    target.strokeAlign = node.strokeAlign;
  }
  if (node.effects?.length) {
    target.effects = node.effects.map(mapEffect);
  }
  if (typeof node.cornerRadius === 'number') {
    target.cornerRadius = node.cornerRadius;
  }

  if (
    node.type === 'FRAME' ||
    node.type === 'GROUP' ||
    node.type === 'SECTION'
  ) {
    target.clipsContent = node.frameMaskDisabled !== true;
  }

  mapFigAutoLayoutToFigmaNode(node, target);

  if (node.type === 'INSTANCE' && node.symbolData?.symbolID) {
    const symbolId = node.symbolData.symbolID;
    target.componentId = `${symbolId.sessionID}:${symbolId.localID}`;
  }

  if (node.type === 'TEXT' || node.textData) {
    target.characters = node.textData?.characters ?? '';
    target.style = {
      fontFamily: node.fontName?.family,
      fontPostScriptName: node.fontName?.postScriptName,
      fontSize: node.fontSize,
      textAlignHorizontal: node.textAlignHorizontal,
    };
  }

  if (
    node.type === 'VECTOR' ||
    node.fillGeometry ||
    node.strokeGeometry
  ) {
    mapVectorGeometry(doc, node, target);
  }
}

function convertNodeTree(doc: FigDocument, node: FigNode): FigmaNode {
  const id = nodeId(node) ?? 'unknown';
  const figmaNode: FigmaNode = {
    id,
    type: mapNodeType(node),
    name: node.name,
  };
  mapCommonFields(doc, node, figmaNode);

  const children = getSortedChildren(doc, id);
  if (children.length > 0) {
    figmaNode.children = children.map((child) => convertNodeTree(doc, child));
  }

  return figmaNode;
}

/**
 * Build a {@link FigmaFileResponse} tree from a parsed `.fig` document.
 *
 * Converts openfig {@link FigNode} records into REST-compatible {@link FigmaNode}
 * trees (type aliases, paint stacks, transforms, vector geometry). Fill paints
 * are reversed so stack order matches Figma REST / `.ic` (bottom-to-top).
 */
export function figDocumentToFigmaFileResponse(doc: FigDocument): FigmaFileResponse {
  const documentNode =
    doc.nodeMap.get('0:0') ??
    doc.nodes.find((node) => node.type === 'DOCUMENT');
  if (!documentNode) {
    throw new Error('No DOCUMENT node in .fig file');
  }

  const meta = doc.meta as { file_name?: string; name?: string } | undefined;
  return {
    name: meta?.file_name ?? meta?.name,
    document: convertNodeTree(doc, documentNode),
  };
}

function detectImageMime(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 2 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return 'image/png';
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46
  ) {
    return 'image/gif';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return 'image/webp';
  }
  return undefined;
}

function bytesToDataUrl(bytes: Uint8Array): string {
  const mime = detectImageMime(bytes) ?? 'image/png';
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Resolve embedded `images/*` assets to data URLs keyed by SHA-1 hash.
 */
export function buildImageRefUrlsFromFigDocument(
  doc: FigDocument,
): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const [hash, bytes] of doc.images) {
    urls[hash] = bytesToDataUrl(bytes);
  }
  return urls;
}
