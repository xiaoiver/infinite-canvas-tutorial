import {
  Canvas,
  ComputedCamera,
  SerializedNode,
  API,
  StateManagement,
  Commands,
  ThemeMode,
} from '@infinite-canvas-tutorial/ecs';
import { type LitElement } from 'lit';
import { Event } from './event';

export interface Comment {
  type: 'comment';
  threadId: string;
  id: string;
  roomId: string;
  userId: string;
  createdAt: Date;
  editedAt: Date;
  text: string;
  avatar: string;
}

export interface Thread {
  type: 'thread';
  id: string;
  roomId: string;
  createdAt: Date;
  comments: Comment[];
  metadata: {
    x: number;
    y: number;
  };
}

/**
 * Since the canvas is created in the system, we need to store them here for later use.
 */
export const pendingCanvases: {
  container: LitElement;
  canvas: Partial<Canvas>;
  camera: Partial<ComputedCamera>;
}[] = [];

// const PenMap = {
//   [Pen.BRUSH]: {
//     icon: html`<sp-icon-brush slot="icon"></sp-icon-brush>`,
//     label: msg(str`Brush`),
//   },
//   [Pen.VECTOR_NETWORK]: {
//     icon: html`<sp-icon-vector-draw slot="icon"></sp-icon-vector-draw>`,
//     label: msg(str`Vector Network`),
//   },
//   [Pen.COMMENT]: {
//     icon: html`<sp-icon-comment slot="icon"></sp-icon-comment>`,
//     label: msg(str`Comment`),
//   },
// };

/**
 * Emit CustomEvents for the canvas.
 */
export class ExtendedAPI extends API {
  constructor(
    stateManagement: StateManagement,
    commands: Commands,
    public element: LitElement,
  ) {
    super(stateManagement, commands);
  }

  resizeCanvas(width: number, height: number) {
    super.resizeCanvas(width, height);

    this.element.dispatchEvent(
      new CustomEvent(Event.RESIZED, { detail: { width, height } }),
    );
  }

  selectNodes(
    selected: SerializedNode[],
    preserveSelection = false,
    updateAppState = true,
  ) {
    super.selectNodes(selected, preserveSelection, updateAppState);

    this.element.dispatchEvent(
      new CustomEvent(Event.SELECTED_NODES_CHANGED, {
        detail: { selected, preserveSelection },
      }),
    );
  }

  updateNode(
    node: SerializedNode,
    diff?: Partial<SerializedNode>,
    updateAppState = true,
    skipOverrideKeys: string[] = [],
  ) {
    super.updateNode(node, diff, updateAppState, skipOverrideKeys);

    if (updateAppState) {
      this.element.dispatchEvent(
        new CustomEvent(Event.NODE_UPDATED, { detail: { node } }),
      );
    }
  }

  updateNodes(nodes: SerializedNode[], updateAppState = true) {
    super.updateNodes(nodes, updateAppState);

    if (updateAppState) {
      this.element.dispatchEvent(
        new CustomEvent(Event.NODES_UPDATED, {
          detail: {
            nodes,
          },
        }),
      );
    }
  }

  deleteNodesById(ids: SerializedNode['id'][]) {
    const nodes = super.deleteNodesById(ids);

    this.element.dispatchEvent(
      new CustomEvent(Event.NODE_DELETED, {
        detail: {
          nodes,
        },
      }),
    );

    return nodes;
  }

  /**
   * Delete Canvas component
   */
  destroy() {
    super.destroy();
    this.element.dispatchEvent(new CustomEvent(Event.DESTROY));
  }

  /**
   * Threads and comments
   * @see https://liveblocks.io/docs/ready-made-features/comments
   */

  #threads: Thread[] = [];
  setThreads(threads: Thread[]) {
    this.#threads = threads;
  }
  getThreads() {
    return this.#threads;
  }

  /**
   * I18n
   */
  setLocale(locale: string) {
    throw new Error('Method not implemented.');
  }
  getLocale() {
    throw new Error('Method not implemented.');
  }

  setThemeMode(themeMode: ThemeMode) {
    this.element.dispatchEvent(
      new CustomEvent('theme-change', {
        detail: {
          themeMode,
        },
        bubbles: true,
        composed: true,
      }),
    );

    this.setAppState({
      themeMode,
    });
  }
}
