import { css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { consume } from '@lit/context';
import { AppState } from '@infinite-canvas-tutorial/ecs';
import { html, render } from '@spectrum-web-components/base';
import { VirtualTrigger, openOverlay } from '@spectrum-web-components/overlay';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';

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

  private handleExecuteAction(event: CustomEvent) {
    const value = (event.target as any).value;
    if (value === 'copy') {
      // write into clipboard
      // this.api.copy();
    } else if (value === 'paste') {
      // this.api.paste();
    } else if (value === 'cut') {
      // this.api.cut();
    } else if (value === 'bring-to-front') {
      // this.api.bringToFront();
    } else if (value === 'bring-forward') {
      // this.api.bringForward();
    } else if (value === 'send-backward') {
      // this.api.sendBackward();
    } else if (value === 'send-to-back') {
    }
  }

  private contextMenuTemplate() {
    const { layersSelected, contextMenuVisible } = this.appState;
    // const node = layersSelected[0] && this.api.getNodeById(layersSelected[0]);

    const disabled = layersSelected.length === 0;

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
            <sp-menu-item .disabled=${disabled}>
              <sp-icon-copy slot="icon"></sp-icon-copy>
              Copy
              <kbd slot="value">⌘C</kbd>
            </sp-menu-item>
            <sp-menu-item .disabled=${disabled}>
              <sp-icon-paste slot="icon"></sp-icon-paste>
              Paste
              <kbd slot="value">⌘V</kbd>
            </sp-menu-item>
            <sp-menu-item .disabled=${disabled}>
              <sp-icon-cut slot="icon"></sp-icon-cut>
              Cut
              <kbd slot="value">⌘X</kbd>
            </sp-menu-item>
            <sp-menu-divider></sp-menu-divider>
            <sp-menu-item .disabled=${disabled}>
              <sp-icon-layers-bring-to-front
                slot="icon"
              ></sp-icon-layers-bring-to-front>
              Bring to front
              <kbd slot="value">⌥⌘]</kbd>
            </sp-menu-item>
            <sp-menu-item .disabled=${disabled}>
              <sp-icon-layers-forward slot="icon"></sp-icon-layers-forward>
              Bring forward
              <kbd slot="value">⌘]</kbd>
            </sp-menu-item>
            <sp-menu-item .disabled=${disabled}>
              <sp-icon-layers-backward slot="icon"></sp-icon-layers-backward>
              Send backward
              <kbd slot="value">⌘[</kbd>
            </sp-menu-item>
            <sp-menu-item .disabled=${disabled}>
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

  disconnectedCallback() {
    super.disconnectedCallback();
    this.api.element.removeEventListener('contextmenu', this.handleContextMenu);
  }

  render() {
    // FIXME: wait for the element to be ready.
    if (this.api?.element && !this.binded) {
      this.api.element.addEventListener('contextmenu', this.handleContextMenu);
    }

    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-context-menu': ContextMenu;
  }
}
