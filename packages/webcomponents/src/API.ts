import { v4 as uuidv4 } from 'uuid';
import {
  Canvas,
  ComputedCamera,
  SerializedNode,
  API,
  StateManagement,
  Commands,
  ThemeMode,
  DOMAdapter,
} from '@infinite-canvas-tutorial/ecs';
import { type LitElement } from 'lit';
import { Event } from './event';
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';
import { getDataURL, updateAndSelectNodes } from './utils';
import { isString } from '@antv/util';

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

  async createImageFromFile(file: File | string, {
    position,
    heuristicResize,
  }: Partial<{
    position: { x: number; y: number };
    heuristicResize: boolean;
  }> = {}) {
    const size = {
      width: this.element.clientWidth,
      height: this.element.clientHeight,
      zoom: this.getAppState().cameraZoom,
    };

    const [image, dataURL] = await Promise.all([
      load(file, ImageLoader),
      isString(file) ? Promise.resolve(file) : getDataURL(file),
    ]);

    let cdnUrl = dataURL;
    if (!isString(file) && this.upload) {
      cdnUrl = await this.upload(file);
    }

    let height = image.height;
    let width = image.width;
    if (heuristicResize) {
      // Heuristic to calculate the size of the image.
      // @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L10059
      const minHeight = Math.max(size.height - 120, 160);
      // max 65% of canvas height, clamped to <300px, vh - 120px>
      const maxHeight = Math.min(
        minHeight,
        Math.floor(size.height * 0.5) / size.zoom,
      );
      height = Math.min(image.height, maxHeight);
      width = height * (image.width / image.height);
    }

    updateAndSelectNodes(this, this.getAppState(), [
      {
        id: uuidv4(),
        type: 'rect',
        x: (position?.x ?? 0) - width / 2,
        y: (position?.y ?? 0) - height / 2,
        width,
        height,
        fill: cdnUrl,
        lockAspectRatio: true,
      },
    ]);
  }

  /**
   * Used by image model to edit with.
   */
  createMask(nodes: SerializedNode[], relativeTo: { x: number; y: number; width: number; height: number }): HTMLCanvasElement {
    const canvas = DOMAdapter.get().createCanvas(relativeTo.width, relativeTo.height) as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    // 在图像处理和 AI 掩码（Mask）中，数值通常映射在 0 到 1 之间：
    // 白色 (White, 值为 1 或 255)： 代表“激活”或“满分”。模型会识别这个区域，并在这里进行扩散生成。
    // 黑色 (Black, 值为 0)： 代表“屏蔽”或“零分”。模型会忽略这个区域，或者说将其锁定，保持原图不动。
    ctx.clearRect(0, 0, relativeTo.width, relativeTo.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, relativeTo.width, relativeTo.height);
    ctx.fillStyle = 'white';
    nodes.forEach(node => {
      if (node.type === 'rect') {
        const { x, y, width, height } = node;
        ctx.fillRect(x as number, y as number, width as number, height as number);
      }
    });

    return canvas;
  }
}
