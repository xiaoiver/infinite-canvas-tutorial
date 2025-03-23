import {
  App,
  Pen,
  RasterScreenshotRequest,
  Screenshot,
  VectorScreenshotRequest,
} from '@infinite-canvas-tutorial/ecs';
import { Task } from './context';

export enum Event {
  READY = 'ic-ready',
  DESTROY = 'ic-destroy',
  RESIZED = 'ic-resized',
  ZOOM_TO = 'ic-zoom-to',
  ZOOM_IN = 'ic-zoom-in',
  ZOOM_OUT = 'ic-zoom-out',
  ZOOM_CHANGED = 'ic-zoom-changed',
  SCREENSHOT_REQUESTED = 'ic-screenshot-requested',
  SCREENSHOT_DOWNLOADED = 'ic-screenshot-downloaded',
  PEN_CHANGED = 'ic-pen-changed',
  TASK_CHANGED = 'ic-task-changed',
}

declare global {
  interface HTMLElementEventMap {
    [Event.READY]: CustomEvent<App>;
    [Event.RESIZED]: CustomEvent<{ width: number; height: number }>;
    [Event.ZOOM_TO]: CustomEvent<{ zoom: number }>;
    [Event.ZOOM_IN]: CustomEvent<{ zoom: number }>;
    [Event.ZOOM_OUT]: CustomEvent<{ zoom: number }>;
    [Event.ZOOM_CHANGED]: CustomEvent<{ zoom: number }>;
    [Event.PEN_CHANGED]: CustomEvent<{ selected: Pen[] }>;
    [Event.TASK_CHANGED]: CustomEvent<{ selected: Task[] }>;
    [Event.SCREENSHOT_REQUESTED]: CustomEvent<
      RasterScreenshotRequest | VectorScreenshotRequest
    >;
    [Event.SCREENSHOT_DOWNLOADED]: CustomEvent<Screenshot>;
  }
}
