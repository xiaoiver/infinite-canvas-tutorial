import type {
  Screenshot,
  SerializedNode,
  TransformableStatus,
} from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from './API';

export enum Event {
  READY = 'ic-ready',
  DESTROY = 'ic-destroy',
  RESIZED = 'ic-resized',
  CAMERA_ZOOM_CHANGED = 'ic-camera-zoom-changed',
  CAMERA_POSITION_CHANGED = 'ic-camera-position-changed',
  SCREENSHOT_DOWNLOADED = 'ic-screenshot-downloaded',
  // CHECKBOARD_STYLE_CHANGED = 'ic-checkboard-style-changed',
  // PEN_CHANGED = 'ic-pen-changed',
  // TASK_CHANGED = 'ic-task-changed',
  NODES_UPDATED = 'ic-nodes-updated',
  NODE_UPDATED = 'ic-node-updated',
  NODE_DELETED = 'ic-node-deleted',
  VISIBILITY_CHANGED = 'ic-visibility-changed',
  SELECTED_NODES_CHANGED = 'ic-selected-nodes-changed',
  MESH3D_LAYERS_CHANGED = 'ic-mesh3d-layers-changed',
  TRANSFORMABLE_STATUS_CHANGED = 'ic-transformable-status-changed',
  COMMENT_ADDED = 'ic-comment-added',
  RECT_DRAWN = 'ic-rect-drawn',
  PENCIL_DRAWN = 'ic-pencil-drawn',
  LASSO_DRAWN = 'ic-lasso-drawn',
  POINT_DRAWN = 'ic-point-drawn',
}

export interface CanvasEventMap {
  'ic-ready': CustomEvent<ExtendedAPI>;
  'ic-resized': CustomEvent<{ width: number; height: number }>;
  'ic-camera-zoom-changed': CustomEvent<{ zoom: number }>;
  'ic-camera-position-changed': CustomEvent<{ x: number; y: number }>;
  'ic-screenshot-downloaded': CustomEvent<Pick<Screenshot, 'dataURL' | 'svg'>>;
  'ic-nodes-updated': CustomEvent<{ nodes: SerializedNode[] }>;
  'ic-node-deleted': CustomEvent<{ nodes: SerializedNode[] }>;
  'ic-selected-nodes-changed': CustomEvent<{
    selected: SerializedNode[];
    preserveSelection: boolean;
  }>;
  'ic-mesh3d-layers-changed': CustomEvent<void>;
  'ic-transformable-status-changed': CustomEvent<{
    status: TransformableStatus;
  }>;
  'ic-comment-added': CustomEvent<{
    canvasX: number;
    canvasY: number;
    viewportX: number;
    viewportY: number;
  }>;
  'ic-rect-drawn': CustomEvent<{
    node: SerializedNode;
  }>;
  'ic-pencil-drawn': CustomEvent<{
    node: SerializedNode;
  }>;
  'ic-lasso-drawn': CustomEvent<{
    node: SerializedNode;
  }>;
  'ic-point-drawn': CustomEvent<{
    x: number;
    y: number;
  }>;
}

declare global {
  interface HTMLElementEventMap extends CanvasEventMap {}
}
