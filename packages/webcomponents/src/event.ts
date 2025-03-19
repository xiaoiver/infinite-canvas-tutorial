import { App } from '@infinite-canvas-tutorial/ecs';

export enum Event {
  READY = 'ic-ready',
  RESIZED = 'ic-resized',
  ZOOM_TO = 'ic-zoom-to',
  ZOOM_CHANGED = 'ic-zoom-changed',
  SCREENSHOT_REQUESTED = 'ic-screenshot-requested',
  SCREENSHOT_DOWNLOADED = 'ic-screenshot-downloaded',
  PEN_CHANGED = 'ic-pen-changed',
}

declare global {
  interface HTMLElementEventMap {
    [Event.READY]: CustomEvent<App>;
    [Event.RESIZED]: CustomEvent<{ width: number; height: number }>;
  }
}
