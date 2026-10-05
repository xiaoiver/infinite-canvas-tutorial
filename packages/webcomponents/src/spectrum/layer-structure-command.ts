import {
  API,
  sortByFractionalIndex,
  SIBLINGS_MAX_Z_INDEX,
  SIBLINGS_MIN_Z_INDEX,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';

// Preparation must validate everything before returning the synchronous writes.
export async function editLayerStructure(
  api: API,
  prepare: (editor: API) => (() => void) | undefined,
) {
  const controller = new AbortController();
  const dispose = api.onDestroy(() => controller.abort());
  try {
    return await api.edit(
      (editor) => {
        const apply = prepare(editor);
        if (!apply) controller.abort();
        else apply();
      },
      { signal: controller.signal },
    );
  } catch (error) {
    if (!controller.signal.aborted) console.error(error);
    return false;
  } finally {
    dispose();
  }
}

function captureTargets(api: API, ids: readonly string[]) {
  return [...new Set(ids)].flatMap((id) => {
    const node = api.getNodeById(id);
    return node && !node.isDeleted ? [{ id, type: node.type }] : [];
  });
}

function resolveTargets(api: API, targets: ReturnType<typeof captureTargets>) {
  return targets.flatMap(({ id, type }) => {
    const node = api.getNodeById(id);
    return node &&
      !node.isDeleted &&
      !node.locked &&
      node.type === type &&
      api.getEntity(node)
      ? [node]
      : [];
  });
}

/** Traverse document parent IDs, including children not yet linked in the ECS. */
export function layerSubtree(api: API, ids: readonly string[]) {
  const nodes = api.getNodes().filter((node) => !node.isDeleted);
  const children = new Map<string, string[]>();
  nodes.forEach((node) => {
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node.id);
    children.set(node.parentId, siblings);
  });
  const visited = new Set<string>();
  const pending = [...ids];
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    pending.push(...(children.get(id) ?? []));
  }
  return nodes.filter((node) => visited.has(node.id));
}

export function deleteLayers(
  api: API,
  ids: readonly string[],
  selectNext = false,
) {
  const targets = captureTargets(api, ids);
  return editLayerStructure(api, (editor) => {
    const nodes = resolveTargets(editor, targets);
    if (!nodes.length) return;
    const deletedIds = new Set(
      layerSubtree(
        editor,
        nodes.map((node) => node.id),
      ).map((node) => node.id),
    );
    const selected = editor.getAppState().layersSelected;
    const pickNext =
      selectNext &&
      selected.length > 0 &&
      selected.every((id) => deletedIds.has(id));
    return () => {
      editor.deleteNodesById(nodes.map((node) => node.id));
      if (pickNext) {
        const next = editor
          .getNodes()
          .find(
            (node) =>
              !node.isDeleted &&
              !node.locked &&
              node.visibility !== 'hidden' &&
              editor.getEntity(node),
          );
        if (next) editor.selectNodes([next]);
      }
    };
  });
}

function coordinate(value: number | string | undefined) {
  return value == null
    ? 0
    : typeof value === 'string' && !value.trim()
    ? NaN
    : Number(value);
}

export function nudgeLayers(
  api: API,
  ids: readonly string[],
  axis: 'x' | 'y',
  delta: number,
) {
  const targets = captureTargets(api, ids);
  return editLayerStructure(api, (editor) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    const changes = resolveTargets(editor, targets).flatMap((node) => {
      const position = coordinate(node[axis]) + delta;
      return Number.isFinite(position) ? [{ node, position }] : [];
    });
    if (!changes.length) return;
    return () =>
      changes.forEach(({ node, position }) =>
        editor.updateNodeOBB(node, { [axis]: position }),
      );
  });
}

/** Preserve the existing translation-stack semantics of layer-panel reparenting. */
function worldTranslation(
  api: API,
  node: SerializedNode | undefined,
  forbiddenId?: string,
) {
  let x = 0;
  let y = 0;
  const visited = new Set<string>();
  while (node) {
    if (
      node.id === forbiddenId ||
      visited.has(node.id) ||
      node.isDeleted ||
      !api.getEntity(node)
    )
      return;
    visited.add(node.id);
    x += coordinate(node.x);
    y += coordinate(node.y);
    if (node.parentId == null) break;
    node = api.getNodeById(node.parentId);
    if (!node) return;
  }
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
}

export function moveLayer(
  api: API,
  id: string,
  fromParentId: string | undefined,
  toParentId: string | undefined,
  order: readonly string[],
) {
  const type = api.getNodeById(id)?.type;
  const orderedIds = [...order];
  return editLayerStructure(api, (editor) => {
    const node = editor.getNodeById(id);
    if (
      !node ||
      node.isDeleted ||
      node.locked ||
      node.type !== type ||
      !editor.getEntity(node) ||
      (node.parentId ?? undefined) !== fromParentId
    )
      return;
    if (
      new Set(orderedIds).size !== orderedIds.length ||
      !orderedIds.includes(id)
    )
      return;
    const parent =
      toParentId === undefined ? undefined : editor.getNodeById(toParentId);
    if (
      toParentId !== undefined &&
      (!parent ||
        parent.isDeleted ||
        parent.locked ||
        !editor.getEntity(parent))
    )
      return;
    const origin = worldTranslation(editor, parent, id);
    const world = worldTranslation(editor, node);
    if (!origin || !world) return;
    const siblings = editor
      .getNodes()
      .filter(
        (sibling) =>
          !sibling.isDeleted &&
          (sibling.parentId ?? undefined) === toParentId &&
          sibling.id !== id,
      );
    const expectedIds = new Set([...siblings.map((sibling) => sibling.id), id]);
    if (
      expectedIds.size !== orderedIds.length ||
      orderedIds.some((siblingId) => !expectedIds.has(siblingId))
    )
      return;
    const nodes = orderedIds.map((siblingId) => editor.getNodeById(siblingId));
    if (nodes.some((sibling) => !sibling || !editor.getEntity(sibling))) return;
    const reparent = fromParentId !== toParentId;
    // A drop back into its original order must not renumber or record siblings.
    const currentOrder = [...nodes]
      .sort(
        (a, b) =>
          a.zIndex - b.zIndex ||
          sortByFractionalIndex(editor.getEntity(a), editor.getEntity(b)),
      )
      .map((sibling) => sibling.id);
    if (
      !reparent &&
      orderedIds.every((siblingId, index) => currentOrder[index] === siblingId)
    )
      return;
    const span = SIBLINGS_MAX_Z_INDEX - SIBLINGS_MIN_Z_INDEX;
    const patches = nodes.map((sibling, index) => ({
      node: sibling,
      patch: {
        ...(reparent && sibling.id === id
          ? {
              parentId: toParentId,
              x: world.x - origin.x,
              y: world.y - origin.y,
            }
          : {}),
        ...(nodes.length >= 2
          ? {
              zIndex:
                SIBLINGS_MIN_Z_INDEX +
                ((index + 1) / (nodes.length + 1)) * span,
            }
          : {}),
      },
    }));
    return () =>
      patches.forEach(({ node: sibling, patch }) =>
        editor.updateNode(sibling, patch),
      );
  });
}
