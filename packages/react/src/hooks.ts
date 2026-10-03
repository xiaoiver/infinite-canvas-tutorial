'use client';

import type {
  CanvasHistoryState,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { useCanvasSelector } from './CanvasProvider';

export type { CanvasHistoryState } from '@infinite-canvas-tutorial/ecs';

// Serialized nodes contain document values. Keep this comparison browser-safe:
// importing the engine at runtime would eagerly load it during SSR.
function equalValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        equalValue(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    )
  );
}

/** A read-only copy, or null for an absent/deleted ID or an empty Provider. */
export function useCanvasNode(
  id?: string | null,
): Readonly<SerializedNode> | null {
  return useCanvasSelector((state) => {
    const node = state.nodes.find((node) => node.id === id && !node.isDeleted);
    // API.updateNode mutates in place. A copy preserves the previous selection
    // so equality can detect property changes even when the source is reused.
    return node ? structuredClone(node) : null;
  }, equalValue);
}

/** Read-only node copies in selection order, excluding missing/deleted IDs. */
export function useCanvasSelection(): readonly Readonly<SerializedNode>[] {
  return useCanvasSelector((state) => {
    const ids = state.appState?.layersSelected ?? [];
    if (!ids.length) return [];
    const byId = new Map(state.nodes.map((node) => [node.id, node]));
    return ids
      .map((id) => byId.get(id))
      .filter((node): node is SerializedNode => !!node && !node.isDeleted)
      .map((node) => structuredClone(node));
  }, equalValue);
}

/** Stable history availability; useCanvasActions supplies navigation commands. */
export function useCanvasHistory(): Readonly<CanvasHistoryState> {
  return useCanvasSelector(
    ({ canUndo, canRedo }) => ({ canUndo, canRedo }),
    (a, b) => a.canUndo === b.canUndo && a.canRedo === b.canRedo,
  );
}
