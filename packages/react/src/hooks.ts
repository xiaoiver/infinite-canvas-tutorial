'use client';

import type {
  CanvasHistoryState,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { useCanvasSelector } from './CanvasProvider';
import type { CanvasState } from './store';

export type { CanvasHistoryState } from '@infinite-canvas-tutorial/ecs';

export interface CanvasCameraState {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  /** Rotation in radians. */
  readonly rotation: number;
}

/** Current camera; unrelated document/history changes retain the same object. */
export function useCanvasCamera(): CanvasCameraState {
  return useCanvasSelector(
    ({ appState }) => ({
      x: appState?.cameraX ?? 0,
      y: appState?.cameraY ?? 0,
      zoom: appState?.cameraZoom ?? 1,
      rotation: appState?.cameraRotation ?? 0,
    }),
    (a, b) =>
      a.x === b.x &&
      a.y === b.y &&
      a.zoom === b.zoom &&
      a.rotation === b.rotation,
  );
}

/** Initialization status, including async preparation and the initial commit. */
export function useCanvasStatus(): Pick<CanvasState, 'status' | 'error'> {
  return useCanvasSelector(
    ({ status, error }) => ({ status, error }),
    (a, b) => a.status === b.status && a.error === b.error,
  );
}

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
