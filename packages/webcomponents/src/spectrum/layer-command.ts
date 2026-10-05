import { API, UI, ZIndex } from '@infinite-canvas-tutorial/ecs';

type LayerCommand =
  | 'toggleVisibility'
  | 'toggleLocked'
  | 'rename'
  | 'bringToFront'
  | 'bringForward'
  | 'sendBackward'
  | 'sendToBack';

/** Bind a submitted command to its canvas and layer, then resolve live state. */
export async function editLayer(
  api: API,
  id: string | undefined,
  command: LayerCommand,
  name?: string,
) {
  const source = id && api.getNodeById(id);
  if (!source || source.isDeleted) return false;
  const { type } = source;
  const controller = new AbortController();
  const dispose = api.onDestroy(() => controller.abort());
  try {
    return await api.edit(
      (editor) => {
        const node = editor.getNodeById(id);
        if (
          !node ||
          node.isDeleted ||
          node.type !== type ||
          !editor.getEntity(node)
        ) {
          controller.abort();
          return;
        }
        if (command === 'toggleVisibility') {
          editor.updateNode(node, {
            visibility: node.visibility === 'hidden' ? 'visible' : 'hidden',
          });
        } else if (command === 'toggleLocked') {
          editor.updateNode(node, { locked: !node.locked });
        } else if (command === 'rename') {
          if (node.locked || name === undefined || node.name === name) {
            controller.abort();
            return;
          }
          editor.updateNode(node, { name });
        } else {
          const indexes = editor
            .getSiblings(node)
            .filter((child) => !child.has(UI))
            .map((child) => child.read(ZIndex).value);
          const forward =
            command === 'bringToFront' || command === 'bringForward';
          if (
            !Number.isFinite(node.zIndex) ||
            !indexes.length ||
            !indexes.every(Number.isFinite) ||
            !indexes.includes(node.zIndex) ||
            node.zIndex ===
              (forward ? Math.max(...indexes) : Math.min(...indexes))
          ) {
            // Abort before writing: an empty record can capture unrelated edits.
            controller.abort();
            return;
          }
          editor[command](node);
        }
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
