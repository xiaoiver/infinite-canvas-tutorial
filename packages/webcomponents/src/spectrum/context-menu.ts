import { localized, msg, str } from '@lit/localize';
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
  DOMAdapter,
  MIME_TYPES,
  ExportFormat,
  isUrl,
  Pen,
  RectSerializedNode,
  GSerializedNode,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { html, render } from '@spectrum-web-components/base';
import { VirtualTrigger, openOverlay } from '@spectrum-web-components/overlay';
import { v4 as uuidv4 } from 'uuid';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { editLayer } from './layer-command';
import {
  deleteLayers,
  editLayerStructure,
  layerSubtree,
  nudgeLayers,
} from './layer-structure-command';
import { extractExternalUrlMetadata } from '../utils/url';
import { measureHTML } from '../utils';
import { updateAndSelectNodes } from '../utils/common';
import { isLikelyMermaidSyntax, tryPasteMermaid } from './mermaid-paste';

const ZINDEX_OFFSET = 0.0001;

export function executeCopy(
  api: ExtendedAPI,
  appState: AppState,
  event?: ClipboardEvent,
) {

  const nodes = appState.layersSelected.map((selectedId) => {
    const node = api.getNodeById(selectedId);
    if (node) {
      return [node, ...api.getChildrenRecursively(node)];
    }
    return [];
  }).flat();

  api.copyToClipboard(
    nodes,
    event,
  );
}

export async function executeCut(
  api: ExtendedAPI,
  appState: AppState,
  event?: ClipboardEvent,
) {
  const ids = [...new Set(appState.layersSelected)].filter((id) => {
    const node = api.getNodeById(id);
    return node && !node.isDeleted && !node.locked && api.getEntity(node);
  });
  if (!ids.length) return false;
  const controller = new AbortController();
  const dispose = api.onDestroy(() => controller.abort());
  try {
    const snapshot = JSON.stringify(layerSubtree(api, ids));
    // ClipboardEvent data is writable only during dispatch. Populate it before
    // awaiting; menu commands instead wait for the system clipboard to succeed.
    let copied = false;
    if (event?.clipboardData) {
      event.clipboardData.setData(MIME_TYPES.text, snapshot);
      copied = event.clipboardData.getData(MIME_TYPES.text) === snapshot;
    }
    if (!copied) await api.copyToClipboard(JSON.parse(snapshot));
    if (controller.signal.aborted) return false;
    return await editLayerStructure(api, (editor) => {
      // Do not delete newer edits or newly added descendants after a slow copy.
      if (
        controller.signal.aborted ||
        JSON.stringify(layerSubtree(editor, ids)) !== snapshot
      )
        return;
      return () => editor.deleteNodesById(ids);
    });
  } catch (error) {
    if (!controller.signal.aborted) console.error(error);
    return false;
  } finally {
    dispose();
  }
}

function getMaxZIndex(api: ExtendedAPI) {
  return api.getNodes().reduce((max, node) => Math.max(max, node.zIndex ?? 0), 0);
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
  const $svg = doc.documentElement as unknown as SVGSVGElement;

  // This method also works, but it may lose the namespace of the SVG element.
  // const $container = document.createElement('div');
  // $container.innerHTML = string;
  // const $svg = $container.children[0] as SVGSVGElement;

  const root: GSerializedNode = {
    id: uuidv4(),
    type: 'g',
    zIndex: getMaxZIndex(api) + 1,
    x: position?.x ?? 0,
    y: position?.y ?? 0,
  };

  const nodes = svgElementsToSerializedNodes(
    Array.from($svg.children) as SVGElement[],
  );
  nodes.forEach((node) => {
    node.parentId = root.id;
    node.locked = true;
  });

  return updateAndSelectNodes(api, appState, [root, ...nodes]);
}

function createText(
  api: ExtendedAPI,
  appState: AppState,
  text: string,
  position?: { x: number; y: number },
) {
  return updateAndSelectNodes(api, appState, [
    {
      id: uuidv4(),
      type: 'text',
      anchorX: position?.x ?? 0,
      anchorY: position?.y ?? 0,
      content: text,
      fontSize: 16,
      fontFamily: 'system-ui',
      fills: [{ type: 'solid', value: 'black', opacity: 1 }],
      zIndex: getMaxZIndex(api) + 1,
    },
  ]);
}

function createHTML(
  api: ExtendedAPI,
  appState: AppState,
  html: string,
  position?: { x: number; y: number },
) {
  const { width, height } = measureHTML(html);

  return updateAndSelectNodes(api, appState, [
    {
      id: uuidv4(),
      type: 'html',
      x: position?.x ?? 0,
      y: position?.y ?? 0,
      width,
      height,
      html,
      zIndex: getMaxZIndex(api) + 1,
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
    } catch (error: any) { }
    event = createPasteEvent({ types });
  }

  let canvasPosition: { x: number; y: number } | null = null;
  if (position) {
    canvasPosition = api.viewport2Canvas(api.client2Viewport(position));
  }

  // must be called in the same frame (thus before any awaits) as the paste
  // event else some browsers (FF...) will clear the clipboardData
  // (something something security)
  const file = event?.clipboardData?.files[0];
  const data = await parseClipboard(event, false);

  if (!file) {
    if (data.html) {
      await createHTML(api, appState, data.html, canvasPosition);
      // return this.addElementsFromMixedContentPaste(data.mixedContent, {
      //   isPlainPaste,
      //   sceneX,
      //   sceneY,
      // });
    } else if (data.text) {
      const string = data.text.trim();
      if (isUrl(data.text)) {
        // TODO: youtube, figma, google maps, etc.

        // Plain url, extract metadata
        await extractExternalUrlMetadata(data.text);
        // console.log(meta);

        // TODO: create bookmark asset
      } else if (string.startsWith('<svg') && string.endsWith('</svg>')) {
        await createSVG(api, appState, string, canvasPosition);
      } else if (isLikelyMermaidSyntax(string)) {
        const pasted = await tryPasteMermaid(
          api,
          appState,
          string,
          canvasPosition,
        );
        if (!pasted) {
          await createText(api, appState, data.text, canvasPosition);
        }
      } else {
        // const nonEmptyLines = data.text
        // .replace(/\r?\n|\r/g, '\n')
        // .split(/\n+/)
        // .map((s) => s.trim())
        // .filter(Boolean);
        await createText(api, appState, data.text, canvasPosition);
      }
    } else if (data.elements) {
      const nodes = api.cloneNodes(data.elements);

      // 仅对粘贴树中的根节点做位移与 zIndex，子节点保持相对父级的变换
      for (const node of nodes) {
        if (!node.parentId) {
          if (node.zIndex) {
            node.zIndex += ZINDEX_OFFSET;
          }

          if (canvasPosition) {
            node.x = canvasPosition.x;
            node.y = canvasPosition.y;
          } else {
            node.x = (node.x as number) + 10;
            node.y = (node.y as number) + 10;
          }
        }
      }

      await updateAndSelectNodes(api, appState, nodes);
    }
  } else if (isSupportedImageFileType(file?.type)) {
    await api.createImageFromFile(file, { position: canvasPosition });
  }
}

/**
 * @see https://opensource.adobe.com/spectrum-web-components/components/imperative-api/#using-a-virtual-trigger
 */
@customElement('ic-spectrum-context-menu')
@localized()
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
  /** Cached on bind so disconnect does not read a deleted canvas entity. */
  private boundCanvas: HTMLCanvasElement | null = null;
  private lastContextMenuPosition: { x: number; y: number } | null = null;
  private lastPointerMovePosition: { x: number; y: number } | null = null;

  private handleExecuteAction = (event: CustomEvent) => {
    const value = (event.target as any).value;
    if (value === 'copy') {
      executeCopy(this.api, this.appState);
    } else if (value === 'paste') {
      void executePaste(
        this.api,
        this.appState,
        undefined,
        this.lastContextMenuPosition,
      ).catch((error: unknown) => console.error(error));
    } else if (value === 'cut') {
      void executeCut(this.api, this.api.getAppState());
    } else if (value === 'bring-to-front') {
      this.executeBringToFront();
    } else if (value === 'bring-forward') {
      this.executeBringForward();
    } else if (value === 'send-backward') {
      this.executeSendBackward();
    } else if (value === 'send-to-back') {
      this.executeSendToBack();
    } else if (value === 'toggle-visibility') {
      this.executeToggleVisibility();
    } else if (value === 'toggle-lock') {
      this.executeToggleLock();
    } else if (value === 'crop') {
      this.executeCrop();
    } else if (value === 'group') {
      this.executeGroup();
    } else if (value === 'ungroup') {
      this.executeUngroup();
    }
  };

  private handleExport = (event: CustomEvent) => {
    const format = (event.target as any).value as ExportFormat;
    const nodes = this.api
      .getAppState()
      .layersSelected.map((id) => this.api.getNodeById(id));

    // Should export children recursively
    const allNodes = nodes.flatMap((node) => {
      return [node, ...this.api.getChildrenRecursively(node)];
    });
    this.api.export({ format, nodes: allNodes });
  };

  private contextMenuTemplate() {
    const { layersSelected, contextMenuVisible } = this.appState;

    if (document.hasFocus()) {
      // check if clipboard is empty
      readSystemClipboard().then((clipboard) => {
        this.isClipboardEmpty = Object.keys(clipboard).length === 0;
      });
    }

    // Locked element or unselected element should also be included in the context menu
    // const { x, y } = this.lastContextMenuPosition;
    // const canvasPosition = this.api.viewport2Canvas({ x, y });
    // const [topmost] = this.api.elementsFromBBox(canvasPosition.x, canvasPosition.y, canvasPosition.x, canvasPosition.y, false);

    const isSelectedEmpty = layersSelected.length === 0;
    let bringForwardDisabled = false;
    let sendBackwardDisabled = false;
    let isLocked = false;
    let isVisible = true;
    let isGrouped = false;

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
      isLocked = node.locked;
      isVisible = node.visibility !== 'hidden';
      isGrouped = node.type === 'g';
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
          <h4>${msg(str`Actions`)}</h4>
          <sp-menu @change=${this.handleExecuteAction}>
            <sp-menu-item ?disabled=${isSelectedEmpty} value="copy">
              <sp-icon-copy slot="icon"></sp-icon-copy>
              ${msg(str`Copy`)}
              <kbd slot="value">⌘C</kbd>
            </sp-menu-item>
            <sp-menu-item ?disabled=${this.isClipboardEmpty} value="paste">
              <sp-icon-paste slot="icon"></sp-icon-paste>
              ${msg(str`Paste`)}
              <kbd slot="value">⌘V</kbd>
            </sp-menu-item>
            <sp-menu-item ?disabled=${isSelectedEmpty} value="cut">
              <sp-icon-cut slot="icon"></sp-icon-cut>
              ${msg(str`Cut`)}
              <kbd slot="value">⌘X</kbd>
            </sp-menu-item>
            <sp-menu-divider></sp-menu-divider>
            <sp-menu-item ?disabled=${isSelectedEmpty} value="toggle-visibility">
              ${when(isVisible, () => html`<sp-icon-visibility slot="icon"></sp-icon-visibility>`, () => html`<sp-icon-visibility-off slot="icon"></sp-icon-visibility-off>`)}
              ${isVisible ? msg(str`Hide layer`) : msg(str`Show layer`)}
              <kbd slot="value">⌘H</kbd>
            </sp-menu-item>
            <sp-menu-item ?disabled=${isSelectedEmpty} value="toggle-lock">
              ${when(isLocked, () => html`<sp-icon-lock-closed slot="icon"></sp-icon-lock-closed>`, () => html`<sp-icon-lock-open slot="icon"></sp-icon-lock-open>`)}
              ${isLocked ? msg(str`Unlock layer`) : msg(str`Lock layer`)}
              <kbd slot="value">⌘L</kbd>
            </sp-menu-item>
            <sp-menu-divider></sp-menu-divider>
            <sp-menu-item
              ?disabled=${isSelectedEmpty || bringForwardDisabled}
              value="bring-to-front"
            >
              <sp-icon-layers-bring-to-front
                slot="icon"
              ></sp-icon-layers-bring-to-front>
              ${msg(str`Bring to front`)}
              <kbd slot="value">⌥⌘]</kbd>
            </sp-menu-item>
            <sp-menu-item
              ?disabled=${isSelectedEmpty || bringForwardDisabled}
              value="bring-forward"
            >
              <sp-icon-layers-forward slot="icon"></sp-icon-layers-forward>
              ${msg(str`Bring forward`)}
              <kbd slot="value">⌘]</kbd>
            </sp-menu-item>
            <sp-menu-item
              ?disabled=${isSelectedEmpty || sendBackwardDisabled}
              value="send-backward"
            >
              <sp-icon-layers-backward slot="icon"></sp-icon-layers-backward>
              ${msg(str`Send backward`)}
              <kbd slot="value">⌘[</kbd>
            </sp-menu-item>
            <sp-menu-item
              ?disabled=${isSelectedEmpty || sendBackwardDisabled}
              value="send-to-back"
            >
              <sp-icon-layers-send-to-back
                slot="icon"
              ></sp-icon-layers-send-to-back>
              ${msg(str`Send to back`)}
              <kbd slot="value">⌥⌘[</kbd>
            </sp-menu-item>
            <sp-menu-divider></sp-menu-divider>
            <sp-menu-item ?disabled=${isSelectedEmpty || isGrouped || layersSelected.length < 2} value="group">
              <sp-icon-group slot="icon"></sp-icon-group>
              ${msg(str`Group`)}
              <kbd slot="value">⌘G</kbd>
            </sp-menu-item>
            <sp-menu-item ?disabled=${isSelectedEmpty || !isGrouped} value="ungroup">
              <sp-icon-ungroup slot="icon"></sp-icon-ungroup>
              ${msg(str`Ungroup`)}
              <kbd slot="value">⌘⇧G</kbd>
            </sp-menu-item>
            <sp-menu-divider></sp-menu-divider>
            <sp-menu-item ?disabled=${isSelectedEmpty} value="crop">
              <sp-icon-crop slot="icon"></sp-icon-crop>
              ${msg(str`Crop`)}
              <kbd slot="value">⌘K</kbd>
            </sp-menu-item>
            <sp-menu-item>
              ${msg(str`Export as...`)}
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
                <sp-menu-item
                  value=${ExportFormat.WEBM}
                  ?disabled=${isSelectedEmpty}
                  >WebM</sp-menu-item
                >
                <sp-menu-item
                  value=${ExportFormat.GIF}
                  ?disabled=${isSelectedEmpty}
                  >GIF</sp-menu-item
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

    // Select the node first.
    const { x: vx, y: vy } = this.api.client2Viewport(this.lastContextMenuPosition);
    const { x: cx, y: cy } = this.api.viewport2Canvas({ x: vx, y: vy });
    const nodes = this.api.elementsFromBBox(cx, cy, cx, cy, false).filter((node) => !node.has(UI));
    if (nodes.length > 0) {
      const node = this.api.getNodeByEntity(nodes[0]);
      if (node) {
        this.api.selectNodes([node]);
        this.api.highlightNodes([node]);
      }
    }

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
      type: 'modal',
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
    const { layersSelected } = this.api.getAppState();
    if (
      document.activeElement !== this.api.element ||
      layersSelected.length === 0
    ) {
      return;
    }

    void executeCut(this.api, this.api.getAppState(), event);

    event.preventDefault();
    event.stopPropagation();
  };

  private handlePaste = (event: ClipboardEvent) => {
    if (document.activeElement !== this.api.element) {
      return;
    }

    void executePaste(
      this.api,
      this.appState,
      event,
      this.lastPointerMovePosition,
    ).catch((error: unknown) => console.error(error));

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

    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
    ) {
      event.preventDefault();
      const axis =
        event.key === 'ArrowUp' || event.key === 'ArrowDown' ? 'y' : 'x';
      const delta =
        event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -10 : 10;
      void nudgeLayers(this.api, layersSelected, axis, delta);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      void deleteLayers(this.api, layersSelected);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.api.selectNodes([]);
      this.api.record();
    } else if (event.key === 'g' && event.metaKey && event.shiftKey) {
      this.executeUngroup();
      event.preventDefault();
      event.stopPropagation();
    } else if (event.key === 'g' && event.metaKey) {
      this.executeGroup();
      event.preventDefault();
      event.stopPropagation();
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
  private handleDrop = (event: DragEvent) => {
    event.preventDefault();
    void this.drop(event).catch((error: unknown) => console.error(error));
  };

  private async drop(event: DragEvent) {
    // Keep async preparation bound to the canvas that received this drop.
    const api = this.api;
    const appState = api.getAppState();

    const canvasPosition = api.viewport2Canvas(
      api.client2Viewport({
        x: event.clientX,
        y: event.clientY,
      }),
    );

    // Capture protected drag data before image/SVG/Mermaid preparation awaits.
    const url = event.dataTransfer.getData('text/uri-list');
    const text = event.dataTransfer.getData('text/plain');
    const files = Array.from(event.dataTransfer.files);
    if (url) {
      try {
        await api.createImageFromFile(url, { position: canvasPosition });
        return;
      } catch (error) {
        console.error(error);
      }
    }
    if (text) {
      const trimmed = text.trim();
      if (
        isLikelyMermaidSyntax(trimmed) &&
        (await tryPasteMermaid(
          api,
          appState,
          trimmed,
          canvasPosition,
        ))
      ) {
        return;
      }
      await createText(api, appState, text, canvasPosition);
      return;
    }

    for (const file of files) {
      if (isSupportedImageFileType(file.type)) {
        if (file.type === MIME_TYPES.svg) {
          const svg = await file.text();
          await createSVG(api, appState, svg, canvasPosition);
        } else {
          await api.createImageFromFile(file, { position: canvasPosition });
        }
      }
    }
  }

  private executeBringToFront() {
    return editLayer(
      this.api,
      this.api.getAppState().layersSelected[0],
      'bringToFront',
    );
  }

  private executeBringForward() {
    return editLayer(
      this.api,
      this.api.getAppState().layersSelected[0],
      'bringForward',
    );
  }

  private executeSendBackward() {
    return editLayer(
      this.api,
      this.api.getAppState().layersSelected[0],
      'sendBackward',
    );
  }

  private executeSendToBack() {
    return editLayer(
      this.api,
      this.api.getAppState().layersSelected[0],
      'sendToBack',
    );
  }

  private executeToggleVisibility() {
    return editLayer(
      this.api,
      this.api.getAppState().layersSelected[0],
      'toggleVisibility',
    );
  }

  private executeToggleLock() {
    return editLayer(
      this.api,
      this.api.getAppState().layersSelected[0],
      'toggleLocked',
    );
  }

  private editSelectedNodes(
    update: (api: ExtendedAPI, nodes: SerializedNode[]) => void,
  ) {
    // Keep the command bound to its original canvas and targets, while resolving
    // live nodes at the write boundary (a queued edit may have deleted them).
    const api = this.api;
    const ids = [...api.getAppState().layersSelected];
    if (ids.length === 0) return;

    void api.edit((editor) => {
      const nodes = ids
        .map((id) => editor.getNodeById(id))
        .filter(
          (node): node is SerializedNode =>
            !!node && !node.isDeleted && !!editor.getEntity(node),
        );
      if (nodes.length > 0) update(editor, nodes);
    }).catch((error: unknown) => console.error(error));
  }

  private executeCrop() {
    this.editSelectedNodes((api, children) => {
      if (children.length === 1 && children[0].clipMode) {
        api.setAppState({
          layersCropping: [children[0].id],
          penbarSelected: Pen.SELECT,
        });
        return;
      }

      const { minX, minY, maxX, maxY } = api.getBounds(children);
      if (![minX, minY, maxX, maxY].every(Number.isFinite)) return;

      const clipParent: RectSerializedNode = {
        id: uuidv4(),
        type: 'rect',
        clipMode: 'clip',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        zIndex: 0,
      };
      api.updateNodes([clipParent]);
      children.forEach((child) => api.reparentNode(child, clipParent));
      api.setAppState({
        layersCropping: [clipParent.id],
        penbarSelected: Pen.SELECT,
      });
    });
  }

  private executeGroup() {
    this.editSelectedNodes((api, nodes) => {
      if (nodes.length >= 2) api.group(nodes);
    });
  }

  private executeUngroup() {
    this.editSelectedNodes((api, nodes) => {
      if (nodes.length === 1 && nodes[0].type === 'g') api.ungroup(nodes[0]);
    });
  }

  private tryBindListeners() {
    if (!this.api?.element || this.binded) {
      return;
    }

    const $canvas = this.api.getCanvasElement();
    this.boundCanvas = $canvas;
    $canvas.addEventListener('contextmenu', this.handleContextMenu);
    $canvas.addEventListener('pointermove', this.handlePointerMove);
    $canvas.addEventListener('dragover', this.handleDragOver);
    $canvas.addEventListener('drop', this.handleDrop);
    $canvas.addEventListener('paste', this.handlePaste);
    $canvas.addEventListener('copy', this.handleCopy, { passive: false });
    $canvas.addEventListener('cut', this.handleCut, { passive: false });
    $canvas.addEventListener('keydown', this.handleKeyDown);

    this.binded = true;
  }

  connectedCallback() {
    super.connectedCallback();
    this.tryBindListeners();
  }

  protected updated() {
    this.tryBindListeners();
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    const $canvas = this.boundCanvas;
    if (!$canvas || !this.binded) {
      return;
    }

    $canvas.removeEventListener(
      'contextmenu',
      this.handleContextMenu,
    );
    $canvas.removeEventListener(
      'pointermove',
      this.handlePointerMove,
    );
    $canvas.removeEventListener('dragover', this.handleDragOver);
    $canvas.removeEventListener('drop', this.handleDrop);
    $canvas.removeEventListener('paste', this.handlePaste);
    $canvas.removeEventListener('copy', this.handleCopy);
    $canvas.removeEventListener('cut', this.handleCut);
    $canvas.removeEventListener('keydown', this.handleKeyDown);

    this.boundCanvas = null;
    this.binded = false;
  }

  render() {
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-context-menu': ContextMenu;
  }
}
