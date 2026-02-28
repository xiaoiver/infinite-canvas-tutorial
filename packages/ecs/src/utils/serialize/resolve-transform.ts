import type { SerializedNode, SerializedNodeInput } from '../../types/serialized-node';

/**
 * Resolves a single length value (number or string like '50%') to a number.
 * @param value - number, string (e.g. '100', '50%'), or undefined
 * @param context - when value is percentage (e.g. '50%'), use this as 100% (e.g. parent width); if omitted, '50%' is treated as 50
 */
export function resolveLength(
  value: number | string | undefined,
  context?: number,
): number {
  if (value === undefined || value === null) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  const s = String(value).trim();
  if (s === '') {
    return 0;
  }
  if (s.endsWith('%')) {
    const n = parseFloat(s);
    if (Number.isNaN(n)) {
      return 0;
    }
    return context !== undefined ? (context * n) / 100 : n;
  }
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Resolves x/y/width/height from number | string to number for a list of nodes.
 * Mutates nodes in place and returns them as SerializedNode[].
 * Call this when loading from JSON (or any SerializedNodeInput[]) before using nodes in the app.
 *
 * @param nodes - nodes that may have string x/y/width/height (e.g. '50%')
 * @param parentSizeById - optional map nodeId -> { width, height } for resolving percentages relative to parent
 */
export function resolveSerializedNodes(
  nodes: SerializedNodeInput[],
  parentSizeById?: Map<string, { width: number; height: number }>,
): SerializedNode[] {
  for (const node of nodes) {
    const parentId = node.parentId;
    const parentSize = parentId ? parentSizeById?.get(parentId) : undefined;

    const w = resolveLength(node.width, parentSize?.width);
    const h = resolveLength(node.height, parentSize?.height);
    const x = resolveLength(node.x, parentSize?.width);
    const y = resolveLength(node.y, parentSize?.height);

    (node as SerializedNode).x = x;
    (node as SerializedNode).y = y;
    (node as SerializedNode).width = w;
    (node as SerializedNode).height = h;
  }

  return nodes as SerializedNode[];
}
