import {
  CheckboardStyle,
  Pen,
  Screenshot,
  SerializedNode,
  Task,
  API,
} from '@infinite-canvas-tutorial/ecs';

export enum Event {
  READY = 'ic-ready',
  DESTROY = 'ic-destroy',
  RESIZED = 'ic-resized',
  ZOOM_CHANGED = 'ic-zoom-changed',
  SCREENSHOT_DOWNLOADED = 'ic-screenshot-downloaded',
  CHECKBOARD_STYLE_CHANGED = 'ic-checkboard-style-changed',
  PEN_CHANGED = 'ic-pen-changed',
  TASK_CHANGED = 'ic-task-changed',
  NODES_UPDATED = 'ic-nodes-updated',
  NODE_UPDATED = 'ic-node-updated',
  NODE_DELETED = 'ic-node-deleted',
  VISIBILITY_CHANGED = 'ic-visibility-changed',
  SELECTED_NODES_CHANGED = 'ic-selected-nodes-changed',
}

declare global {
  interface HTMLElementEventMap {
    [Event.READY]: CustomEvent<API>;
    [Event.RESIZED]: CustomEvent<{ width: number; height: number }>;
    [Event.ZOOM_CHANGED]: CustomEvent<{ zoom: number }>;
    [Event.PEN_CHANGED]: CustomEvent<{ selected: Pen[] }>;
    [Event.CHECKBOARD_STYLE_CHANGED]: CustomEvent<{
      checkboardStyle: CheckboardStyle;
    }>;
    [Event.TASK_CHANGED]: CustomEvent<{ selected: Task[] }>;
    [Event.SCREENSHOT_DOWNLOADED]: CustomEvent<Pick<Screenshot, 'dataURL'>>;
    [Event.NODES_UPDATED]: CustomEvent<{ nodes: SerializedNode[] }>;
    [Event.NODE_UPDATED]: CustomEvent<{ node: SerializedNode }>;
    [Event.NODE_DELETED]: CustomEvent<{ nodes: SerializedNode[] }>;
    [Event.SELECTED_NODES_CHANGED]: CustomEvent<{
      selected: SerializedNode[];
      preserveSelection: boolean;
    }>;
  }
}
