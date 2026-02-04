import {
  Screenshot,
  SerializedNode,
  TransformableStatus,
} from '@infinite-canvas-tutorial/ecs';
import { ExtendedAPI } from './API';

export enum Event {
  READY = 'ic-ready',
  DESTROY = 'ic-destroy',
  RESIZED = 'ic-resized',
  ZOOM_CHANGED = 'ic-zoom-changed',
  SCREENSHOT_DOWNLOADED = 'ic-screenshot-downloaded',
  // CHECKBOARD_STYLE_CHANGED = 'ic-checkboard-style-changed',
  // PEN_CHANGED = 'ic-pen-changed',
  // TASK_CHANGED = 'ic-task-changed',
  NODES_UPDATED = 'ic-nodes-updated',
  NODE_UPDATED = 'ic-node-updated',
  NODE_DELETED = 'ic-node-deleted',
  VISIBILITY_CHANGED = 'ic-visibility-changed',
  SELECTED_NODES_CHANGED = 'ic-selected-nodes-changed',
  TRANSFORMABLE_STATUS_CHANGED = 'ic-transformable-status-changed',
  COMMENT_ADDED = 'ic-comment-added',
  RECT_DRAWN = 'ic-rect-drawn',
}

declare global {
  interface HTMLElementEventMap {
    [Event.READY]: CustomEvent<ExtendedAPI>;
    [Event.RESIZED]: CustomEvent<{ width: number; height: number }>;
    [Event.ZOOM_CHANGED]: CustomEvent<{ zoom: number }>;
    [Event.SCREENSHOT_DOWNLOADED]: CustomEvent<
      Pick<Screenshot, 'dataURL' | 'svg'>
    >;
    [Event.NODES_UPDATED]: CustomEvent<{ nodes: SerializedNode[] }>;
    [Event.NODE_UPDATED]: CustomEvent<{ node: SerializedNode }>;
    [Event.NODE_DELETED]: CustomEvent<{ nodes: SerializedNode[] }>;
    [Event.SELECTED_NODES_CHANGED]: CustomEvent<{
      selected: SerializedNode[];
      preserveSelection: boolean;
    }>;
    [Event.TRANSFORMABLE_STATUS_CHANGED]: CustomEvent<{
      status: TransformableStatus;
    }>;
    [Event.COMMENT_ADDED]: CustomEvent<{
      canvasX: number;
      canvasY: number;
      viewportX: number;
      viewportY: number;
    }>;
    [Event.RECT_DRAWN]: CustomEvent<{
      node: SerializedNode;
    }>;
  }
}
