import type { API } from '@infinite-canvas-tutorial/ecs';
import { editLayerStructure } from './layer-structure-command';

/** Capture the requested layer, but compose Shift selection with live queued state. */
export function selectLayer(api: API, id: string, preserveSelection = false) {
  const source = api.getNodeById(id);
  if (!source || source.isDeleted) return Promise.resolve(false);
  const { type } = source;
  return editLayerStructure(api, (editor) => {
    const node = editor.getNodeById(id);
    if (
      !node ||
      node.isDeleted ||
      node.locked ||
      node.type !== type ||
      !editor.getEntity(node)
    )
      return;
    const selected = editor.getAppState().layersSelected;
    if (
      preserveSelection
        ? selected.includes(id)
        : selected.length === 1 && selected[0] === id
    )
      return;
    return () => editor.selectNodes([node], preserveSelection);
  });
}

/** Resolve after earlier selections, including ones submitted in the same frame. */
export function clearLayerSelection(api: API) {
  return editLayerStructure(api, (editor) => {
    if (!editor.getAppState().layersSelected.length) return;
    return () => {
      editor.selectNodes([]);
      editor.highlightNodes([]);
    };
  });
}
