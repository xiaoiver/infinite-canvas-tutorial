import type {
  API,
  AppState,
  CanvasEditOptions,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';

/**
 * Insert and select the first node in one edit. The legacy appState argument is
 * retained for compatibility; selection/highlights are read when the edit runs.
 * Resolves after commit (not rendering), or false for an empty/cancelled edit.
 */
export async function updateAndSelectNodes(
  api: API,
  _appState: AppState,
  nodes: readonly SerializedNode[],
  options: CanvasEditOptions = {},
): Promise<boolean> {
  if (!nodes.length || options.signal?.aborted) return false;
  const received = structuredClone(nodes);
  return api.edit((editor) => {
    editor.updateNodes([...received]);
    const ids = editor.getAppState().layersHighlighted;
    const highlighted = ids
      .map((id) => editor.getNodeById(id))
      .filter(
        (node): node is SerializedNode => !!node && !!editor.getEntity(node),
      );
    editor.unhighlightNodes(highlighted);
    // A highlighted node may have been removed while this edit was queued.
    if (highlighted.length !== ids.length) {
      editor.setAppState({ layersHighlighted: [] });
    }
    const first = editor.getNodeById(received[0].id);
    if (first && !first.isDeleted) editor.selectNodes([first]);
  }, options);
}
