import {
  SerializedNode,
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

function getMaxZIndex(api: ExtendedAPI) {
  return api.getNodes().reduce((max, node) => Math.max(max, node.zIndex ?? 0), 0);
}

function layoutMermaidPasteNodes(
  api: ExtendedAPI,
  nodes: SerializedNode[],
  canvasPosition: { x: number; y: number } | null,
) {
  const root = nodes[0];
  root.x = canvasPosition?.x ?? 0;
  root.y = canvasPosition?.y ?? 0;

  const baseZ = getMaxZIndex(api) + 1;
  nodes.forEach((n, i) => {
    n.zIndex = baseZ + i * ZINDEX_OFFSET;
  });
}

/**
 * Parse clipboard Mermaid source into nodes, optionally apply a styler
 * registered via {@link ExtendedAPI.registerMermaidPasteStyler}, then insert like other paste paths.
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
    const nodes = await parseMermaidToSerializedNodes(definition);
    api.applyMermaidPasteStyler(nodes);
    layoutMermaidPasteNodes(api, nodes, canvasPosition);
    updateAndSelectNodes(api, appState, nodes);
    return true;
  } catch {
    return false;
  }
}
