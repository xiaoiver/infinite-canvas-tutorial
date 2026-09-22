import type { SerializedNode } from './types/serialized-node';

/** Equality for JSON document values, independent of object key order. */
export function documentValueEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        documentValueEqual(a[key], b[key]),
    )
  );
}

/** Validate before any ECS or state mutation; snapshots must include their parents. */
export function validateDocument(nodes: readonly SerializedNode[]) {
  const byId = new Map<string, SerializedNode>();
  for (const node of nodes) {
    if (!node.id || byId.has(node.id))
      throw new Error(`Duplicate or missing node id: ${node.id}`);
    byId.set(node.id, node);
  }
  const visited = new Set<string>();
  for (const node of nodes) {
    const path = new Set<string>();
    let current = node;
    while (current && !visited.has(current.id)) {
      if (path.has(current.id))
        throw new Error(`Cyclic node hierarchy: ${current.id}`);
      path.add(current.id);
      if (current.parentId != null && !byId.has(current.parentId)) {
        throw new Error(
          `Missing parent ${current.parentId} for node ${current.id}`,
        );
      }
      current = byId.get(current.parentId);
    }
    path.forEach((id) => visited.add(id));
  }
}
