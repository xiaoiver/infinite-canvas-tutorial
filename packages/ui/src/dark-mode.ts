import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { canvasContext } from './context';
import type { Canvas } from '@infinite-canvas-tutorial/core';

import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';

@customElement('ic-dark-mode')
export class DarkMode extends LitElement {
  static styles = css`
    :host {
      box-shadow: var(--sl-shadow-medium);
      background: var(--sl-panel-background-color);
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    sl-switch {
      margin: 0 8px;
      color: var(--sl-color-neutral-700);
    }
  `;

  @property()
  isDark = false;

  @consume({ context: canvasContext, subscribe: true })
  canvas: Canvas;

  private handleInputChange() {
    this.isDark = !this.isDark;

    const event = new CustomEvent('themechanged', {
      detail: { isDark: this.isDark },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    return html`<sl-switch
      size="small"
      .checked=${this.isDark}
      @sl-input=${this.handleInputChange}
    >
      <slot>
        <sl-icon name="moon" alt="Dark mode"></sl-icon>
      </slot>
    </sl-switch>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-dark-mode': DarkMode;
  }
}
