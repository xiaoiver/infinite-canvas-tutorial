import { v4 as uuidv4 } from 'uuid';
import {
  deserializePoints,
  serializePoints,
  SerializedNode,
  LineSerializedNode,
  PolylineSerializedNode,
  AppState,
} from '@infinite-canvas-tutorial/ecs';
import { ExtendedAPI } from '../API';
import { updateAndSelectNodes } from '../utils/common';

/** Same rules as `@infinite-canvas-tutorial/mermaid` `isLikelyMermaidSyntax` (kept local to avoid stale build artifacts). */
export function isLikelyMermaidSyntax(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('<')) {
    return false;
  }

  for (const raw of trimmed.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) {
      continue;
    }

    return (
      /^(flowchart|graph)\s+/i.test(line) ||
      /^sequenceDiagram\b/i.test(line) ||
      /^stateDiagram(-v2)?\b/i.test(line) ||
      /^classDiagram\b/i.test(line) ||
      /^erDiagram\b/i.test(line) ||
      /^gantt\b/i.test(line) ||
      /^pie\b/i.test(line) ||
      /^journey\b/i.test(line) ||
      /^gitgraph\b/i.test(line) ||
      /^mindmap\b/i.test(line) ||
      /^timeline\b/i.test(line) ||
      /^block(-beta)?\b/i.test(line)
    );
  }

  return false;
}

const ZINDEX_OFFSET = 0.0001;

export type MermaidPasteStyleFn = (nodes: SerializedNode[]) => void;

const pasteStylersByApi = new WeakMap<ExtendedAPI, MermaidPasteStyleFn>();

export function registerMermaidPasteStyler(
  api: ExtendedAPI,
  fn: MermaidPasteStyleFn,
) {
  pasteStylersByApi.set(api, fn);
}

export function unregisterMermaidPasteStyler(api: ExtendedAPI) {
  pasteStylersByApi.delete(api);
}

function getMaxZIndex(api: ExtendedAPI) {
  return api.getNodes().reduce((max, node) => Math.max(max, node.zIndex ?? 0), 0);
}

function remapMermaidPasteNodeIds(nodes: SerializedNode[]): SerializedNode[] {
  const cloned = structuredClone(nodes) as SerializedNode[];
  const idMap = new Map<string, string>();
  for (const n of cloned) {
    idMap.set(n.id, uuidv4());
  }
  for (const n of cloned) {
    n.id = idMap.get(n.id)!;
    if (n.parentId) {
      n.parentId = idMap.get(n.parentId) ?? n.parentId;
    }
    if (n.type === 'polyline' || n.type === 'line') {
      const edge = n as PolylineSerializedNode;
      if (edge.fromId) {
        edge.fromId = idMap.get(edge.fromId) ?? edge.fromId;
      }
      if (edge.toId) {
        edge.toId = idMap.get(edge.toId) ?? edge.toId;
      }
    }
  }
  return cloned;
}

function computeMermaidNodesBBox(
  nodes: SerializedNode[],
): { minX: number; minY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;

  const expand = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    any = true;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const n of nodes) {
    if (n.parentId) {
      continue;
    }

    if (n.type === 'rect' || n.type === 'ellipse') {
      const x = (n as { x?: number }).x;
      const y = (n as { y?: number }).y;
      const w = (n as { width?: number }).width;
      const h = (n as { height?: number }).height;
      if ([x, y, w, h].every(Number.isFinite)) {
        expand(x!, y!);
        expand(x! + w!, y! + h!);
      }
    } else if (n.type === 'path') {
      const x = (n as { x?: number }).x ?? 0;
      const y = (n as { y?: number }).y ?? 0;
      const w = (n as { width?: number }).width;
      const h = (n as { height?: number }).height;
      if ([x, y, w, h].every(Number.isFinite)) {
        expand(x, y);
        expand(x + w!, y + h!);
      }
    } else if (n.type === 'line') {
      const ln = n as LineSerializedNode;
      if (Number.isFinite(ln.x1) && Number.isFinite(ln.y1)) {
        expand(ln.x1!, ln.y1!);
      }
      if (Number.isFinite(ln.x2) && Number.isFinite(ln.y2)) {
        expand(ln.x2!, ln.y2!);
      }
    } else if (n.type === 'polyline') {
      const ptsStr = (n as PolylineSerializedNode).points;
      if (ptsStr) {
        const pts = deserializePoints(ptsStr);
        for (const [px, py] of pts) {
          expand(px, py);
        }
      }
    }
  }

  return any ? { minX, minY } : null;
}

function translateSerializedNodes(nodes: SerializedNode[], dx: number, dy: number) {
  for (const n of nodes) {
    const o = n as { x?: number; y?: number; sourcePoint?: { x: number; y: number }; targetPoint?: { x: number; y: number } };
    if (typeof o.x === 'number') {
      o.x += dx;
    }
    if (typeof o.y === 'number') {
      o.y += dy;
    }
    if (o.sourcePoint) {
      o.sourcePoint.x += dx;
      o.sourcePoint.y += dy;
    }
    if (o.targetPoint) {
      o.targetPoint.x += dx;
      o.targetPoint.y += dy;
    }

    if (n.type === 'line') {
      const ln = n as LineSerializedNode;
      if (typeof ln.x1 === 'number') {
        ln.x1 += dx;
      }
      if (typeof ln.y1 === 'number') {
        ln.y1 += dy;
      }
      if (typeof ln.x2 === 'number') {
        ln.x2 += dx;
      }
      if (typeof ln.y2 === 'number') {
        ln.y2 += dy;
      }
    }

    if (n.type === 'polyline') {
      const poly = n as PolylineSerializedNode;
      if (poly.points) {
        const pts = deserializePoints(poly.points);
        const shifted = pts.map(
          ([px, py]) => [px + dx, py + dy] as [number, number],
        );
        poly.points = serializePoints(shifted);
      }
    }
  }
}

function layoutMermaidPasteNodes(
  api: ExtendedAPI,
  nodes: SerializedNode[],
  canvasPosition: { x: number; y: number } | null,
) {
  const bbox = computeMermaidNodesBBox(nodes);
  if (!bbox) {
    return;
  }

  let dx = -bbox.minX;
  let dy = -bbox.minY;
  if (canvasPosition) {
    dx += canvasPosition.x;
    dy += canvasPosition.y;
  } else {
    dx += 10;
    dy += 10;
  }

  translateSerializedNodes(nodes, dx, dy);

  const baseZ = getMaxZIndex(api) + 1;
  nodes.forEach((n, i) => {
    n.zIndex = baseZ + i * ZINDEX_OFFSET;
  });
}

/**
 * Parse clipboard Mermaid source into nodes, optionally apply a demo-specific styler
 * registered via {@link registerMermaidPasteStyler}, then insert like other paste paths.
 */
export async function tryPasteMermaid(
  api: ExtendedAPI,
  appState: AppState,
  definition: string,
  canvasPosition: { x: number; y: number } | null,
): Promise<boolean> {
  try {
    const { parseMermaidToSerializedNodes } = await import(
      '@infinite-canvas-tutorial/mermaid'
    );
    let nodes = await parseMermaidToSerializedNodes(definition);
    nodes = remapMermaidPasteNodeIds(nodes);
    pasteStylersByApi.get(api)?.(nodes);
    layoutMermaidPasteNodes(api, nodes, canvasPosition);
    updateAndSelectNodes(api, appState, nodes);
    return true;
  } catch {
    return false;
  }
}
