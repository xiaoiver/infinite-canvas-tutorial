import type { RefDescendantPatch, RefSerializedNode, SerializedNode } from '../../types/serialized-node';

const REF_SEP = '__';

/**
 * 合并 Pencil 式 `descendants` 补丁，禁止覆盖会破坏实例子树的结构字段。
 */
function applyRefDescendantPatch(
  target: SerializedNode,
  patch: RefDescendantPatch | undefined,
): void {
  if (patch == null || typeof patch !== 'object') {
    return;
  }
  const rest = { ...(patch as object) } as Record<string, unknown>;
  delete rest.id;
  delete rest.type;
  delete rest.parentId;
  delete rest.ref;
  delete rest.reusable;
  delete rest.descendants;
  Object.assign(target, rest);
}

/**
 * 合并 `lookup` 与 `batch`（后写覆盖前），供解析 `ref` 时查找可复用模板。
 */
export function mergeSerializedNodesForRefLookup(
  batch: readonly SerializedNode[],
  lookup: readonly SerializedNode[] | undefined,
): SerializedNode[] {
  const m = new Map<string, SerializedNode>();
  for (const n of lookup ?? []) {
    m.set(n.id, n);
  }
  for (const n of batch) {
    m.set(n.id, n);
  }
  return [...m.values()];
}

function collectSubtreeNodeIds(rootId: string, all: readonly SerializedNode[]): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of all) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        changed = true;
      }
    }
  }
  return ids;
}

function mapTemplateId(
  rootTemplateId: string,
  instanceRootId: string,
  id: string,
): string {
  return id === rootTemplateId ? instanceRootId : `${instanceRootId}${REF_SEP}${id}`;
}

/**
 * 将 `type: 'ref'` 的节点按 {@link https://docs.pencil.dev/for-developers/the-pen-format#components-and-instances Pencil}
 * 式组件实例化：以 `ref` 为模板根 id 深拷被子树，根 id 为实例 id，子节点 `id`/`parentId` 重映射，并将实例 wire 上除 `type`/`ref` 外字段与模板根合并（覆盖位姿等）。
 * 不删除或隐藏 `reusable: true` 的模板节点；实例根会去掉 `reusable` 标记。
 *
 * 若实例上提供 `descendants[templateId]`，在克隆对应模板子节点（或根）时做属性覆盖；键为模板图上的 id，而非实例子 id 前缀。
 *
 * 当前仅支持模板根为非 `ref` 节点；不处理模板内的嵌套 `ref`。
 */
export function expandRefSerializedNodes(
  batch: readonly SerializedNode[],
  graph: readonly SerializedNode[],
): SerializedNode[] {
  const byId = new Map(graph.map((n) => [n.id, n] as const));
  const out: SerializedNode[] = [];

  for (const node of batch) {
    if (node.type !== 'ref') {
      // 必须为入参引用本身：{@link serializedNodesToEntities} 会在展开结果上调用
      // `inferXYWidthHeight` 等就地写 wire 几何；浅拷贝会使 state 中的节点与 ECS 不一致。
      out.push(node);
      continue;
    }
    const refn = node as RefSerializedNode;
    const refKey = refn.ref;
    if (refKey == null || refKey === '') {
      throw new Error(`ref node "${refn.id}" must set "ref" to a template id`);
    }
    if (refKey === refn.id) {
      throw new Error(`ref node "${refn.id}" cannot reference itself`);
    }
    const template = byId.get(refKey);
    if (!template?.type) {
      throw new Error(
        `ref node "${refn.id}": template id "${refKey}" not found in the graph`,
      );
    }
    if (template.type === 'ref') {
      throw new Error(
        `ref node "${refn.id}": template "${refKey}" is also a ref; nested ref expansion is not supported yet`,
      );
    }

    const instanceId = refn.id;
    const subtree = collectSubtreeNodeIds(refKey, graph);
    const { type: _ignoreType, ref: _ignoreRef, descendants, ...instanceOverrides } =
      refn as RefSerializedNode;

    for (const sid of subtree) {
      const src = byId.get(sid);
      if (!src) {
        continue;
      }
      const clone = { ...src } as SerializedNode;
      const newId = mapTemplateId(refKey, instanceId, sid);
      clone.id = newId;
      if (src.parentId != null && subtree.has(src.parentId)) {
        clone.parentId = mapTemplateId(refKey, instanceId, src.parentId);
      }

      if (sid === refKey) {
        Object.assign(clone, instanceOverrides, {
          id: instanceId,
          type: template.type,
          parentId: refn.parentId,
        } as Partial<SerializedNode>);
        (clone as { ref?: string }).ref = undefined;
        if ('reusable' in clone) {
          delete (clone as { reusable?: boolean }).reusable;
        }
        if (descendants) {
          applyRefDescendantPatch(
            clone,
            descendants[refKey] as RefDescendantPatch | undefined,
          );
        }
        delete (clone as { descendants?: unknown }).descendants;
      } else if (descendants) {
        applyRefDescendantPatch(
          clone,
          descendants[sid] as RefDescendantPatch | undefined,
        );
      }

      out.push(clone);
    }
  }

  return out;
}

/**
 * 在 `serializeNodesToSVGElements` 之前调用：将 `type: 'ref'` 展开为与 {@link serializedNodesToEntities} 相同语义的具体图元。
 *
 * @param batch 要写入 SVG 的节点，顺序保留（宜为 {@link API.readLayoutFromECS} 等之后的列表）。
 * @param fullScene 全场景节点表，供解析 `ref` 所指向的模板；**仅导出选区**时务必传入如 `api.getNodes()`，否则可能找不到 `reusable` 模板。
 */
export function expandSerializedNodesForSvgExport(
  batch: readonly SerializedNode[],
  fullScene: readonly SerializedNode[] | undefined,
): SerializedNode[] {
  const graph = mergeSerializedNodesForRefLookup(batch, fullScene);
  return expandRefSerializedNodes(batch, graph);
}
