import { AppState, SerializedNode } from "@infinite-canvas-tutorial/ecs";
import { ExtendedAPI } from "../API";

export function updateAndSelectNodes(
  api: ExtendedAPI,
  appState: AppState,
  nodes: SerializedNode[],
) {
  api.runAtNextTick(() => {
    api.updateNodes(nodes);
    api.record();

    setTimeout(() => {
      api.unhighlightNodes(
        appState.layersHighlighted.map((id) => api.getNodeById(id)),
      );
      api.selectNodes([nodes[0]]);
    }, 100);
  });
}