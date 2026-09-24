import type { API } from '../API';
import type { VectorNetworkSerializedNode } from '../types/serialized-node';

// A short-lived picking preference, never persisted in the document or undo history.
// Any node replacement (including geometry, style, history and edit-mode updates)
// invalidates it. Weak ownership requires no destroy subscription.
const preferred = new WeakMap<
  API,
  { node: VectorNetworkSerializedNode; index: number }
>();
export function preferVectorNetworkEdge(
  api: API,
  node: VectorNetworkSerializedNode,
  index: number,
) {
  if (Number.isInteger(index) && node.segments?.[index])
    preferred.set(api, { node, index });
}
export function preferredVectorNetworkEdge(api: API, nodeId: string): number {
  const value = preferred.get(api);
  if (!value) return -1;
  if (
    value.node.id !== nodeId ||
    api.getNodeById(nodeId) !== value.node ||
    !value.node.isEditing
  ) {
    preferred.delete(api);
    return -1;
  }
  return value.index;
}
