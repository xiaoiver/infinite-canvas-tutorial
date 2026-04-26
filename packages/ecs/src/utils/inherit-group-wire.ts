import type { SerializedNode } from '../types/serialized-node';

/**
 * 与 `g` 与 `Group` 线宽展示一致。仅 `type === 'g'` 的节点作为**继承源**向子代
 * 提供这些键；非 `g` 的父级（如 rect、path）自身 wire 不向下传递，子代只承接更上层 `g` 链已合并的结果。
 *（原始 wire，尚未做设计变量求值。）
 */
export const INHERITABLE_GROUP_WIRE_KEYS = [
  'fill',
  'stroke',
  'strokeWidth',
  'fillRule',
  'opacity',
  'fillOpacity',
  'strokeOpacity',
  'strokeLinecap',
  'strokeLinejoin',
] as const;

export function explicitInheritableGroupWireKey(
  node: object,
  key: (typeof INHERITABLE_GROUP_WIRE_KEYS)[number],
): boolean {
  if (!Object.prototype.hasOwnProperty.call(node, key)) {
    return false;
  }
  return (node as Record<string, unknown>)[key] !== undefined;
}

export function mergeInheritGroupWire(
  parentComputed: Record<string, unknown>,
  node: object,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...parentComputed };
  for (const key of INHERITABLE_GROUP_WIRE_KEYS) {
    if (explicitInheritableGroupWireKey(node, key)) {
      out[key] = (node as Record<string, unknown>)[key];
    }
  }
  return out;
}

/**
 * 对 `scene` 中每个 id 求「沿仅含 `g` 作为继承源」合并后的与 {@link INHERITABLE_GROUP_WIRE_KEYS} 一致的线框展示。
 * `scene` 应包含到根为止的父链（例如 API 的 mergeSceneWithBatch）。
 */
export function getComputedInheritGroupWireMap(
  scene: SerializedNode[],
): Map<string, Record<string, unknown>> {
  const idToNode = new Map<string, SerializedNode>();
  for (const n of scene) {
    idToNode.set(n.id, n);
  }
  const memo = new Map<string, Record<string, unknown>>();
  const gChainMemo = new Map<string, Record<string, unknown>>();
  const gInStack = new Set<string>();
  const inStack = new Set<string>();

  /**
   * 站在「要继承 paint 的节点」的**父**为 `pId` 时，自根方向仅经 `g` 合并得到的、进入该子代前的线框
   *（`p` 为 `g` 时合入其显式键，否则跳过 `p` 自身 wire 继续向上）。
   */
  const gChainInheritForParent = (pId: string | undefined): Record<string, unknown> => {
    if (!pId || !idToNode.has(pId)) {
      return {};
    }
    if (gChainMemo.has(pId)) {
      return gChainMemo.get(pId)!;
    }
    if (gInStack.has(pId)) {
      return {};
    }
    gInStack.add(pId);
    const p = idToNode.get(pId)!;
    if (p.type === 'g') {
      const fromAbove =
        p.parentId && idToNode.has(p.parentId)
          ? gChainInheritForParent(p.parentId)
          : {};
      const m = mergeInheritGroupWire(fromAbove, p);
      gInStack.delete(pId);
      gChainMemo.set(pId, m);
      return m;
    }
    const m =
      p.parentId && idToNode.has(p.parentId)
        ? gChainInheritForParent(p.parentId)
        : {};
    gInStack.delete(pId);
    gChainMemo.set(pId, m);
    return m;
  };

  const compute = (id: string): Record<string, unknown> => {
    if (memo.has(id)) {
      return memo.get(id)!;
    }
    if (inStack.has(id)) {
      return {};
    }
    inStack.add(id);
    const node = idToNode.get(id);
    if (!node) {
      inStack.delete(id);
      const e: Record<string, unknown> = {};
      memo.set(id, e);
      return e;
    }
    const parentBase: Record<string, unknown> = node.parentId
      ? gChainInheritForParent(node.parentId)
      : {};
    const merged = mergeInheritGroupWire(parentBase, node);
    inStack.delete(id);
    memo.set(id, merged);
    return merged;
  };

  for (const n of scene) {
    compute(n.id);
  }
  return memo;
}

/**
 * 单点查询（如 {@link mutateElement} 中 patch 当前 element 后重算）；
 * 若会多次查询同一 `scene` 的多个 id，优先用 {@link getComputedInheritGroupWireMap}。
 */
export function getComputedInheritGroupWireForId(
  id: string,
  scene: SerializedNode[],
): Record<string, unknown> {
  return getComputedInheritGroupWireMap(scene).get(id) ?? {};
}
