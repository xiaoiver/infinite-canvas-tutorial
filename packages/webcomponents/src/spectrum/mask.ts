import { css, html, LitElement, PropertyValues } from 'lit';
import { customElement } from 'lit/decorators.js';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { consume } from '@lit/context';
import { AppState } from '@infinite-canvas-tutorial/ecs';

@customElement('ic-spectrum-mask')
export class Mask extends LitElement {
  static styles = css`
    .mask {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .loading {
      margin-left: 8px;
      color: white;
      font-size: 16px;
      font-weight: bold;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  binded = false;

  private previousLoading: boolean;
  private previousLoadingMessage: string;

  shouldUpdate(changedProperties: PropertyValues): boolean {
    for (const prop of changedProperties.keys()) {
      if (prop !== 'appState') return true;
    }

    const newLoading = this.appState.loading;
    if (newLoading !== this.previousLoading) {
      this.previousLoading = newLoading;
      return true;
    }

    const newLoadingMessage = this.appState.loadingMessage;
    if (newLoadingMessage !== this.previousLoadingMessage) {
      this.previousLoadingMessage = newLoadingMessage;
      return true;
    }

    return false;
  }

  render() {
    if (!this.api) {
      return;
    }

    const { loading, loadingMessage } = this.appState;

    return html`
      <div class="mask" style=${loading ? 'display: flex;' : 'display: none;'}>
        ${loading
          ? html` <sp-progress-circle
                size="s"
                label="Loading content"
                indeterminate
              ></sp-progress-circle>
              <div class="loading">${loadingMessage}</div>`
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-mask': Mask;
  }
}
