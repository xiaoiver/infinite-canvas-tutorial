import { css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { consume } from '@lit/context';
import {
  AppState,
  createPasteEvent,
  parseClipboard,
  readSystemClipboard,
  svgElementsToSerializedNodes,
  SVGStringToFile,
  svgSvgElementToComputedCamera,
  UI,
  ZIndex,
} from '@infinite-canvas-tutorial/ecs';
import { html, render } from '@spectrum-web-components/base';
import { VirtualTrigger, openOverlay } from '@spectrum-web-components/overlay';
import { v4 as uuidv4 } from 'uuid';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';

const ZINDEX_OFFSET = 0.0001;

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

  private binded = false;

  private handleExecuteAction = (event: CustomEvent) => {
    const value = (event.target as any).value;
    if (value === 'copy') {
      this.executeCopy();
    } else if (value === 'paste') {
      this.executePaste();
    } else if (value === 'cut') {
      this.executeCut();
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

  // TODO: shortcut keys

  private contextMenuTemplate() {
    const { layersSelected, contextMenuVisible } = this.appState;
    // const node = layersSelected[0] && this.api.getNodeById(layersSelected[0]);

    const disabled = layersSelected.length === 0;
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
            <sp-menu-item .disabled=${disabled} value="copy">
              <sp-icon-copy slot="icon"></sp-icon-copy>
              Copy
              <kbd slot="value">⌘C</kbd>
            </sp-menu-item>
            <sp-menu-item .disabled=${disabled} value="paste">
              <sp-icon-paste slot="icon"></sp-icon-paste>
              Paste
              <kbd slot="value">⌘V</kbd>
            </sp-menu-item>
            <sp-menu-item .disabled=${disabled} value="cut">
              <sp-icon-cut slot="icon"></sp-icon-cut>
              Cut
              <kbd slot="value">⌘X</kbd>
            </sp-menu-item>
            <sp-menu-divider></sp-menu-divider>
            <sp-menu-item
              .disabled=${disabled || bringForwardDisabled}
              value="bring-to-front"
            >
              <sp-icon-layers-bring-to-front
                slot="icon"
              ></sp-icon-layers-bring-to-front>
              Bring to front
              <kbd slot="value">⌥⌘]</kbd>
            </sp-menu-item>
            <sp-menu-item
              .disabled=${disabled || bringForwardDisabled}
              value="bring-forward"
            >
              <sp-icon-layers-forward slot="icon"></sp-icon-layers-forward>
              Bring forward
              <kbd slot="value">⌘]</kbd>
            </sp-menu-item>
            <sp-menu-item
              .disabled=${disabled || sendBackwardDisabled}
              value="send-backward"
            >
              <sp-icon-layers-backward slot="icon"></sp-icon-layers-backward>
              Send backward
              <kbd slot="value">⌘[</kbd>
            </sp-menu-item>
            <sp-menu-item
              .disabled=${disabled || sendBackwardDisabled}
              value="send-to-back"
            >
              <sp-icon-layers-send-to-back
                slot="icon"
              ></sp-icon-layers-send-to-back>
              Send to back
              <kbd slot="value">⌥⌘[</kbd>
            </sp-menu-item>
          </sp-menu>
        </sp-popover>`,
    )}`;
  }

  private handleContextMenu = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const trigger = event.target as LitElement;
    const virtualTrigger = new VirtualTrigger(event.clientX, event.clientY);
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
    trigger.insertAdjacentElement('afterend', overlay);

    this.renderRoot.appendChild(overlay);
  };

  private handleCopy = (event: ClipboardEvent) => {
    const { layersSelected } = this.appState;
    if (
      document.activeElement !== this.api.element ||
      layersSelected.length === 0
    ) {
      return;
    }

    this.executeCopy(event);

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

    this.executeCut(event);

    event.preventDefault();
    event.stopPropagation();
  };

  private handlePaste = (event: ClipboardEvent) => {
    if (document.activeElement !== this.api.element) {
      return;
    }

    this.executePaste(event);

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
    } else if (event.key === ']' && event.metaKey) {
      this.executeBringForward();
    } else if (event.key === '[' && event.metaKey) {
      this.executeSendBackward();
    } else if (event.key === '[' && event.metaKey && event.ctrlKey) {
      this.executeSendToBack();
    }

    event.preventDefault();
    event.stopPropagation();
  };

  private executeCopy(event?: ClipboardEvent) {
    this.api.copyToClipboard(
      this.appState.layersSelected.map((id) => this.api.getNodeById(id)),
      event,
    );
  }

  private executeCut(event?: ClipboardEvent) {
    this.executeCopy(event);
    // delete nodes
    this.api.deleteNodesById(this.appState.layersSelected);
    this.api.record();
  }

  private async executePaste(event?: ClipboardEvent) {
    if (!event) {
      let types;
      try {
        types = await readSystemClipboard();
      } catch (error: any) {}

      event = createPasteEvent({ types });
    }

    const isPlainPaste = false;

    // must be called in the same frame (thus before any awaits) as the paste
    // event else some browsers (FF...) will clear the clipboardData
    // (something something security)
    let file = event?.clipboardData?.files[0];
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
          // TODO: extract semantic groups inside comments
          // const $container = document.createElement('div');
          // $container.innerHTML = string;
          // const $svg = $container.children[0] as SVGSVGElement;
          // const camera = svgSvgElementToComputedCamera($svg);
          // const nodes = svgElementsToSerializedNodes(
          //   Array.from($svg.children) as SVGElement[],
          // );
          file = SVGStringToFile(string);
        }
      }
    }

    // prefer spreadsheet data over image file (MS Office/Libre Office)
    // if (isSupportedImageFile(file)) {
    //   this.createImageElement({ sceneX, sceneY, imageFile: file });
    //   return;
    // }

    if (data.elements) {
      const nodes = data.elements.map((node) => {
        node.id = uuidv4();
        if (node.zIndex) {
          node.zIndex += ZINDEX_OFFSET;
        }
        node.x += 10;
        node.y += 10;
        // TODO: move to the mouse position
        return node;
      });

      this.api.runAtNextTick(() => {
        this.api.updateNodes(nodes);
        this.api.record();

        setTimeout(() => {
          this.api.unhighlightNodes(
            this.appState.layersHighlighted.map((id) =>
              this.api.getNodeById(id),
            ),
          );
          this.api.selectNodes([nodes[0]], false);
        }, 100);
      });
    } else if (data.text) {
      // const nonEmptyLines = normalizeEOL(data.text)
      //   .split(/\n+/)
      //   .map((s) => s.trim())
      //   .filter(Boolean);
      // this.addTextFromPaste(data.text, isPlainPaste);
    }
  }

  private executeBringToFront() {
    const node = this.api.getNodeById(this.appState.layersSelected[0]);
    if (node) {
      this.api.bringToFront(node);
    }
  }

  private executeBringForward() {
    const node = this.api.getNodeById(this.appState.layersSelected[0]);
    if (node) {
      this.api.bringForward(node);
    }
  }

  private executeSendBackward() {
    const node = this.api.getNodeById(this.appState.layersSelected[0]);
    if (node) {
      this.api.sendBackward(node);
    }
  }

  private executeSendToBack() {
    const node = this.api.getNodeById(this.appState.layersSelected[0]);
    if (node) {
      this.api.sendToBack(node);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.api.element.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('copy', this.handleCopy);
    document.removeEventListener('cut', this.handleCut);
    document.removeEventListener('paste', this.handlePaste);
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  render() {
    // FIXME: wait for the element to be ready.
    if (this.api?.element && !this.binded) {
      this.api.element.addEventListener('contextmenu', this.handleContextMenu);
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
