import { css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { consume } from '@lit/context';
import {
  AppState,
  createPasteEvent,
  parseClipboard,
  readSystemClipboard,
  svgElementsToSerializedNodes,
  isSupportedImageFileType,
  UI,
  ZIndex,
  SerializedNode,
  DOMAdapter,
  MIME_TYPES,
  ExportFormat,
  isUrl,
} from '@infinite-canvas-tutorial/ecs';
import { html, render } from '@spectrum-web-components/base';
import { VirtualTrigger, openOverlay } from '@spectrum-web-components/overlay';
import { v4 as uuidv4 } from 'uuid';
import { load } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { extractExternalUrlMetadata } from '../utils/url';

const ZINDEX_OFFSET = 0.0001;

export function executeCopy(
  api: ExtendedAPI,
  appState: AppState,
  event?: ClipboardEvent,
) {
  api.copyToClipboard(
    appState.layersSelected.map((id) => api.getNodeById(id)),
    event,
  );
}

export function executeCut(
  api: ExtendedAPI,
  appState: AppState,
  event?: ClipboardEvent,
) {
  executeCopy(api, appState, event);
  // delete nodes
  api.deleteNodesById(appState.layersSelected);
  api.record();
}

function updateAndSelectNodes(
  api: ExtendedAPI,
  appState: AppState,
  nodes: SerializedNode[],
) {
  api.runAtNextTick(() => {
    api.updateNodes(nodes);
    api.record();

    setTimeout(() => {
      api.unhighlightNodes(
        appState.layersHighlighted.map((id) => api.getNodeById(id)),
      );
      api.selectNodes([nodes[0]]);
    }, 100);
  });
}

async function getDataURL(file: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result as string;
      resolve(dataURL);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export async function createImage(
  api: ExtendedAPI,
  appState: AppState,
  file: File,
  position?: { x: number; y: number },
) {
  const size = {
    width: api.element.clientWidth,
    height: api.element.clientHeight,
    zoom: appState.cameraZoom,
  };

  const [image, dataURL] = await Promise.all([
    load(file, ImageLoader),
    getDataURL(file),
  ]);

  // Heuristic to calculate the size of the image.
  // @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L10059
  const minHeight = Math.max(size.height - 120, 160);
  // max 65% of canvas height, clamped to <300px, vh - 120px>
  const maxHeight = Math.min(
    minHeight,
    Math.floor(size.height * 0.5) / size.zoom,
  );
  const height = Math.min(image.height, maxHeight);
  const width = height * (image.width / image.height);

  updateAndSelectNodes(api, appState, [
    {
      id: uuidv4(),
      type: 'rect',
      x: (position?.x ?? 0) - width / 2,
      y: (position?.y ?? 0) - height / 2,
      width,
      height,
      fill: dataURL,
      lockAspectRatio: true,
    },
  ]);
}

function createSVG(
  api: ExtendedAPI,
  appState: AppState,
  svg: string,
  position?: { x: number; y: number },
) {
  // TODO: Extract semantic groups inside comments
  const doc = DOMAdapter.get()
    .getDOMParser()
    .parseFromString(svg, 'image/svg+xml');
  const $svg = doc.documentElement;

  // This method also works, but it may lose the namespace of the SVG element.
  // const $container = document.createElement('div');
  // $container.innerHTML = string;
  // const $svg = $container.children[0] as SVGSVGElement;
  const nodes = svgElementsToSerializedNodes(
    Array.from($svg.children) as SVGElement[],
  );
  if (position) {
    // nodes.forEach((node) => {
    //   node.x += position.x;
    //   node.y += position.y;
    // });
  }

  updateAndSelectNodes(api, appState, nodes);
}

function createText(
  api: ExtendedAPI,
  appState: AppState,
  text: string,
  position?: { x: number; y: number },
) {
  updateAndSelectNodes(api, appState, [
    {
      id: uuidv4(),
      type: 'text',
      anchorX: position?.x ?? 0,
      anchorY: position?.y ?? 0,
      content: text,
      fontSize: 16,
      fontFamily: 'system-ui',
      fill: 'black',
    },
  ]);
}

export async function executePaste(
  api: ExtendedAPI,
  appState: AppState,
  event?: ClipboardEvent,
  position?: { x: number; y: number },
) {
  // FIXME: Paste text inside a textfield
  if (!document.hasFocus()) {
    return;
  }

  if (!event) {
    let types;
    try {
      types = await readSystemClipboard();
    } catch (error: any) {}
    event = createPasteEvent({ types });
  }

  let canvasPosition: { x: number; y: number } | null = null;
  if (position) {
    canvasPosition = api.viewport2Canvas(api.client2Viewport(position));
  }

  const isPlainPaste = false;

  // must be called in the same frame (thus before any awaits) as the paste
  // event else some browsers (FF...) will clear the clipboardData
  // (something something security)
  const file = event?.clipboardData?.files[0];
  const data = await parseClipboard(event, isPlainPaste);

  if (!file && !isPlainPaste) {
    if (data.mixedContent) {
      // return this.addElementsFromMixedContentPaste(data.mixedContent, {
      //   isPlainPaste,
      //   sceneX,
      //   sceneY,
      // });
    } else if (data.text) {
      const string = data.text.trim();
      if (string.startsWith('<svg') && string.endsWith('</svg>')) {
        createSVG(api, appState, string, canvasPosition);
        return;
      }
    }
  }

  if (isSupportedImageFileType(file?.type)) {
    createImage(api, appState, file, canvasPosition);
    return;
  }

  if (data.elements) {
    const nodes = data.elements.map((node) => {
      node.id = uuidv4();
      if (node.zIndex) {
        node.zIndex += ZINDEX_OFFSET;
      }

      if (canvasPosition) {
        node.x = canvasPosition.x;
        node.y = canvasPosition.y;
      } else {
        node.x += 10;
        node.y += 10;
      }
      return node;
    });

    updateAndSelectNodes(api, appState, nodes);
  } else if (data.text) {
    if (isUrl(data.text)) {
      // TODO: youtube, figma, google maps, etc.

      // Plain url, extract metadata
      const meta = await extractExternalUrlMetadata(data.text);
      console.log(meta);

      // TODO: create bookmark asset
    } else {
      // const nonEmptyLines = data.text
      // .replace(/\r?\n|\r/g, '\n')
      // .split(/\n+/)
      // .map((s) => s.trim())
      // .filter(Boolean);
      createText(api, appState, data.text, canvasPosition);
    }
  }
}

/**
 * @see https://opensource.adobe.com/spectrum-web-components/components/imperative-api/#using-a-virtual-trigger
 */
@customElement('ic-spectrum-context-menu')
export class ContextMenu extends LitElement {
  static styles = css`
    sp-popover {
      padding: 0;
    }

    kbd {
      font-family: var(--spectrum-alias-body-text-font-family);
      letter-spacing: 0.1em;
      white-space: nowrap;
      border: none;
      padding: none;
      padding: 0;
      line-height: normal;
    }

    h4 {
      margin: 0;
      padding: 8px;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @state()
  private isClipboardEmpty = true;

  private binded = false;
  private lastContextMenuPosition: { x: number; y: number } | null = null;
  private lastPointerMovePosition: { x: number; y: number } | null = null;

  private handleExecuteAction = (event: CustomEvent) => {
    const value = (event.target as any).value;
    if (value === 'copy') {
      executeCopy(this.api, this.appState);
    } else if (value === 'paste') {
      executePaste(
        this.api,
        this.appState,
        undefined,
        this.lastContextMenuPosition,
      );
    } else if (value === 'cut') {
      executeCut(this.api, this.appState);
    } else if (value === 'bring-to-front') {
      this.executeBringToFront();
    } else if (value === 'bring-forward') {
      this.executeBringForward();
    } else if (value === 'send-backward') {
      this.executeSendBackward();
    } else if (value === 'send-to-back') {
      this.executeSendToBack();
    }
  };

  private handleExport = (event: CustomEvent) => {
    const format = (event.target as any).value as ExportFormat;
    const nodes = this.api
      .getAppState()
      .layersSelected.map((id) => this.api.getNodeById(id));
    this.api.export(format, true, nodes);
  };

  private contextMenuTemplate() {
    const { layersSelected, contextMenuVisible } = this.appState;

    if (document.hasFocus()) {
      // check if clipboard is empty
      readSystemClipboard().then((clipboard) => {
        this.isClipboardEmpty = Object.keys(clipboard).length === 0;
      });
    }

    const isSelectedEmpty = layersSelected.length === 0;
    let bringForwardDisabled = false;
    let sendBackwardDisabled = false;

    if (layersSelected.length === 1) {
      const node = this.api.getNodeById(layersSelected[0]);
      const children = this.api
        .getSiblings(node)
        .filter((child) => !child.has(UI));
      const maxZIndex = Math.max(
        ...children.map((child) => child.read(ZIndex).value),
      );
      const minZIndex = Math.min(
        ...children.map((child) => child.read(ZIndex).value),
      );

      if (node.zIndex === maxZIndex) {
        bringForwardDisabled = true;
      }
      if (node.zIndex === minZIndex) {
        sendBackwardDisabled = true;
      }
    }

    return html`${when(
      contextMenuVisible,
      () =>
        html`<sp-popover
          style="width:200px;"
          @change=${(event) => {
            event.target.dispatchEvent(new Event('close', { bubbles: true }));
          }}
        >
          <h4>Actions</h4>
          <sp-menu @change=${this.handleExecuteAction}>
            <sp-menu-item ?disabled=${isSelectedEmpty} value="copy">
              <sp-icon-copy slot="icon"></sp-icon-copy>
              Copy
              <kbd slot="value">⌘C</kbd>
            </sp-menu-item>
            <sp-menu-item ?disabled=${this.isClipboardEmpty} value="paste">
              <sp-icon-paste slot="icon"></sp-icon-paste>
              Paste
              <kbd slot="value">⌘V</kbd>
            </sp-menu-item>
            <sp-menu-item ?disabled=${isSelectedEmpty} value="cut">
              <sp-icon-cut slot="icon"></sp-icon-cut>
              Cut
              <kbd slot="value">⌘X</kbd>
            </sp-menu-item>
            <sp-menu-divider></sp-menu-divider>
            <sp-menu-item
              ?disabled=${isSelectedEmpty || bringForwardDisabled}
              value="bring-to-front"
            >
              <sp-icon-layers-bring-to-front
                slot="icon"
              ></sp-icon-layers-bring-to-front>
              Bring to front
              <kbd slot="value">⌥⌘]</kbd>
            </sp-menu-item>
            <sp-menu-item
              ?disabled=${isSelectedEmpty || bringForwardDisabled}
              value="bring-forward"
            >
              <sp-icon-layers-forward slot="icon"></sp-icon-layers-forward>
              Bring forward
              <kbd slot="value">⌘]</kbd>
            </sp-menu-item>
            <sp-menu-item
              ?disabled=${isSelectedEmpty || sendBackwardDisabled}
              value="send-backward"
            >
              <sp-icon-layers-backward slot="icon"></sp-icon-layers-backward>
              Send backward
              <kbd slot="value">⌘[</kbd>
            </sp-menu-item>
            <sp-menu-item
              ?disabled=${isSelectedEmpty || sendBackwardDisabled}
              value="send-to-back"
            >
              <sp-icon-layers-send-to-back
                slot="icon"
              ></sp-icon-layers-send-to-back>
              Send to back
              <kbd slot="value">⌥⌘[</kbd>
            </sp-menu-item>
            <sp-menu-divider></sp-menu-divider>
            <sp-menu-item>
              Export as...
              <sp-menu slot="submenu" @change=${this.handleExport}>
                <sp-menu-item
                  value=${ExportFormat.SVG}
                  ?disabled=${isSelectedEmpty}
                  >SVG</sp-menu-item
                >
                <sp-menu-item
                  value=${ExportFormat.PNG}
                  ?disabled=${isSelectedEmpty}
                  >PNG</sp-menu-item
                >
                <sp-menu-item
                  value=${ExportFormat.JPEG}
                  ?disabled=${isSelectedEmpty}
                  >JPEG</sp-menu-item
                >
              </sp-menu>
            </sp-menu-item>
          </sp-menu>
        </sp-popover>`,
    )}`;
  }

  private handleContextMenu = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    this.lastContextMenuPosition = { x: event.clientX, y: event.clientY };

    const trigger = event.target as LitElement;
    const virtualTrigger = new VirtualTrigger(
      this.lastContextMenuPosition.x,
      this.lastContextMenuPosition.y,
    );
    const fragment = document.createDocumentFragment();
    render(this.contextMenuTemplate(), fragment);
    const popover = fragment.querySelector('sp-popover') as HTMLElement;

    const overlay = await openOverlay(popover, {
      trigger: virtualTrigger,
      placement: 'right-start',
      offset: 0,
      notImmediatelyClosable: true,
      type: 'auto',
    });
    trigger.insertAdjacentElement('afterend', overlay as unknown as Element);

    this.renderRoot.appendChild(overlay as unknown as Element);
  };

  private handleCopy = (event: ClipboardEvent) => {
    const { layersSelected } = this.appState;
    if (
      document.activeElement !== this.api.element ||
      layersSelected.length === 0
    ) {
      return;
    }

    executeCopy(this.api, this.appState, event);

    event.preventDefault();
    event.stopPropagation();
  };

  private handleCut = (event: ClipboardEvent) => {
    const { layersSelected } = this.appState;
    if (
      document.activeElement !== this.api.element ||
      layersSelected.length === 0
    ) {
      return;
    }

    executeCut(this.api, this.appState, event);

    event.preventDefault();
    event.stopPropagation();
  };

  private handlePaste = (event: ClipboardEvent) => {
    if (document.activeElement !== this.api.element) {
      return;
    }

    executePaste(this.api, this.appState, event, this.lastPointerMovePosition);

    event.preventDefault();
    event.stopPropagation();
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (document.activeElement !== this.api.element) {
      return;
    }

    // bring to front ⌥⌘]
    if (event.key === ']' && event.metaKey && event.ctrlKey) {
      this.executeBringToFront();

      event.preventDefault();
      event.stopPropagation();
    } else if (event.key === '[' && event.metaKey && event.ctrlKey) {
      this.executeSendToBack();

      event.preventDefault();
      event.stopPropagation();
    } else if (event.key === ']' && event.metaKey) {
      this.executeBringForward();

      event.preventDefault();
      event.stopPropagation();
    } else if (event.key === '[' && event.metaKey) {
      this.executeSendBackward();

      event.preventDefault();
      event.stopPropagation();
    }

    const { layersSelected } = this.api.getAppState();
    if (layersSelected.length === 0) {
      return;
    }

    const selected = this.api.getNodeById(layersSelected[0]);
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.api.updateNodeOBB(selected, { y: selected.y - 10 });
      this.api.record();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.api.updateNodeOBB(selected, { y: selected.y + 10 });
      this.api.record();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.api.updateNodeOBB(selected, { x: selected.x - 10 });
      this.api.record();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.api.updateNodeOBB(selected, { x: selected.x + 10 });
      this.api.record();
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.api.deleteNodesById([selected.id]);
      this.api.record();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.api.selectNodes([]);
      this.api.record();
    }
  };

  private handlePointerMove = (event: PointerEvent) => {
    this.lastPointerMovePosition = { x: event.clientX, y: event.clientY };
  };

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop#prevent_the_browsers_default_drag_behavior
   */
  private handleDragOver = (event: DragEvent) => {
    event.preventDefault();
  };

  /**
   * @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L10242
   */
  private handleDrop = async (event: DragEvent) => {
    event.preventDefault();

    const canvasPosition = this.api.viewport2Canvas(
      this.api.client2Viewport({
        x: event.clientX,
        y: event.clientY,
      }),
    );

    const url = event.dataTransfer.getData('text/uri-list');
    if (url) {
      try {
        const file = await fetch(url).then((res) => res.blob());
        createImage(this.api, this.appState, file as File, canvasPosition);
        return;
      } catch (error) {
        console.error(error);
      }
    }
    const text = event.dataTransfer.getData('text/plain');
    if (text) {
      createText(this.api, this.appState, text, canvasPosition);
      return;
    }

    for (const file of Array.from(event.dataTransfer.files)) {
      if (isSupportedImageFileType(file.type)) {
        if (file.type === MIME_TYPES.svg) {
          const svg = await file.text();
          createSVG(this.api, this.appState, svg, canvasPosition);
        } else {
          createImage(this.api, this.appState, file, canvasPosition);
        }
      }
    }
  };

  private executeBringToFront() {
    const node = this.api.getNodeById(this.appState.layersSelected[0]);
    if (node) {
      this.api.bringToFront(node);
      this.api.record();
    }
  }

  private executeBringForward() {
    const node = this.api.getNodeById(this.appState.layersSelected[0]);
    if (node) {
      this.api.bringForward(node);
      this.api.record();
    }
  }

  private executeSendBackward() {
    const node = this.api.getNodeById(this.appState.layersSelected[0]);
    if (node) {
      this.api.sendBackward(node);
      this.api.record();
    }
  }

  private executeSendToBack() {
    const node = this.api.getNodeById(this.appState.layersSelected[0]);
    if (node) {
      this.api.sendToBack(node);
      this.api.record();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.api?.element?.removeEventListener(
      'contextmenu',
      this.handleContextMenu,
    );
    this.api?.element?.removeEventListener(
      'pointermove',
      this.handlePointerMove,
    );
    this.api?.element?.removeEventListener('drop', this.handleDrop);
    document.removeEventListener('copy', this.handleCopy);
    document.removeEventListener('cut', this.handleCut);
    document.removeEventListener('paste', this.handlePaste);
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  render() {
    // FIXME: wait for the element to be ready.
    if (this.api?.element && !this.binded) {
      this.api.element.addEventListener('contextmenu', this.handleContextMenu);
      this.api.element.addEventListener('pointermove', this.handlePointerMove);
      this.api.element.addEventListener('dragover', this.handleDragOver);
      this.api.element.addEventListener('drop', this.handleDrop);
      document.addEventListener('copy', this.handleCopy, { passive: false });
      document.addEventListener('cut', this.handleCut, { passive: false });
      document.addEventListener('paste', this.handlePaste, { passive: false });
      document.addEventListener('keydown', this.handleKeyDown);
    }

    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-context-menu': ContextMenu;
  }
}
