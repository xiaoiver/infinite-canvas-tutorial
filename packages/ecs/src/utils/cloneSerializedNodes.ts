import { v4 as uuidv4 } from 'uuid';
import type { SerializedNode } from '../types/serialized-node';

/**
 * 克隆一组序列化节点：为每个节点生成新 id，并在本批次内重写 parentId，保持原有父子关系。
 * 不修改入参。若某节点的父 id 不在 `nodes` 中，则其 `parentId` 置为 undefined。
 */
export function cloneSerializedNodes(
  nodes: readonly SerializedNode[],
): SerializedNode[] {
  const idMap = new Map<string, string>();
  for (const node of nodes) {
    idMap.set(node.id, uuidv4());
  }

  return nodes.map((node) => {
    const oldParentId = node.parentId;
    const newParentId =
      oldParentId && idMap.has(oldParentId)
        ? idMap.get(oldParentId)!
        : undefined;

    return {
      ...node,
      id: idMap.get(node.id)!,
      parentId: newParentId,
    } as SerializedNode;
  });
}
