'use client';

import type {
  CanvasHistoryState,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { useCanvasSelector } from './CanvasProvider';

export type { CanvasHistoryState } from '@infinite-canvas-tutorial/ecs';

/** A read-only copy, or null for an absent/deleted ID or an empty Provider. */
export function useCanvasNode(
  id?: string | null,
): Readonly<SerializedNode> | null {
  return useCanvasSelector(
    (state) =>
      state.nodes.find((node) => node.id === id && !node.isDeleted) ?? null,
  );
}

/** Read-only node copies in selection order, excluding missing/deleted IDs. */
export function useCanvasSelection(): readonly Readonly<SerializedNode>[] {
  return useCanvasSelector(
    (state) => {
      const ids = state.appState?.layersSelected ?? [];
      if (!ids.length) return [];
      const byId = new Map(state.nodes.map((node) => [node.id, node]));
      return ids
        .map((id) => byId.get(id))
        .filter((node): node is SerializedNode => !!node && !node.isDeleted);
    },
    (a, b) => a.length === b.length && a.every((node, i) => node === b[i]),
  );
}

/** Stable history availability; useCanvasActions supplies navigation commands. */
export function useCanvasHistory(): Readonly<CanvasHistoryState> {
  return useCanvasSelector(
    ({ canUndo, canRedo }) => ({ canUndo, canRedo }),
    (a, b) => a.canUndo === b.canUndo && a.canRedo === b.canRedo,
  );
}
