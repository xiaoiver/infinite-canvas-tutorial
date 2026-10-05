'use client';

import { useContext, useMemo } from 'react';
import { CanvasContext } from './CanvasProvider';

/** CSS pixels for client/viewport coordinates; world units for canvas points. */
export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

export interface CanvasCoordinates {
  clientToCanvas(point: CanvasPoint): CanvasPoint | null;
  canvasToClient(point: CanvasPoint): CanvasPoint | null;
  viewportToCanvas(point: CanvasPoint): CanvasPoint | null;
  canvasToViewport(point: CanvasPoint): CanvasPoint | null;
}

/** Stable, on-demand conversions using the Provider's current API and geometry. */
export function useCanvasCoordinates(): CanvasCoordinates {
  const store = useContext(CanvasContext);
  if (!store)
    throw new Error('Canvas hooks must be used inside CanvasProvider.');
  return useMemo(
    () => ({
      clientToCanvas(point: CanvasPoint) {
        const api = store.getSnapshot().api;
        return api ? api.viewport2Canvas(api.client2Viewport(point)) : null;
      },
      canvasToClient(point: CanvasPoint) {
        const api = store.getSnapshot().api;
        return api ? api.viewport2Client(api.canvas2Viewport(point)) : null;
      },
      viewportToCanvas(point: CanvasPoint) {
        const api = store.getSnapshot().api;
        return api ? api.viewport2Canvas(point) : null;
      },
      canvasToViewport(point: CanvasPoint) {
        const api = store.getSnapshot().api;
        return api ? api.canvas2Viewport(point) : null;
      },
    }),
    [store],
  );
}
