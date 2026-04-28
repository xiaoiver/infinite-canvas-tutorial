import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { isDataUrl, isUrl } from '@infinite-canvas-tutorial/ecs';
import { localized, msg, str } from '@lit/localize';
import { fileOpen, getDataURL } from '../utils';

import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-image.js';

@customElement('ic-spectrum-input-image')
@localized()
export class InputImage extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--spectrum-global-dimension-size-100);
      min-width: 0;
    }

    .preview {
      width: 100%;
      min-height: 120px;
      max-height: 220px;
      box-sizing: border-box;
      border: 1px solid var(--spectrum-gray-300);
      border-radius: var(--spectrum-corner-radius-100);
      overflow: hidden;
      /* 与 Spectrum 填充预览类似的浅色棋盘，便于看透明图 */
      background-color: var(--spectrum-gray-75, #f5f5f5);
      background-image: linear-gradient(
          45deg,
          var(--spectrum-gray-200, #e0e0e0) 25%,
          transparent 25%
        ),
        linear-gradient(-45deg, var(--spectrum-gray-200, #e0e0e0) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, var(--spectrum-gray-200, #e0e0e0) 75%),
        linear-gradient(-45deg, transparent 75%, var(--spectrum-gray-200, #e0e0e0) 75%);
      background-size: 12px 12px;
      background-position: 0 0, 0 6px, 6px -6px, -6px 0;
    }

    .preview-inner {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 120px;
      box-sizing: border-box;
      padding: var(--spectrum-global-dimension-size-75);
    }

    img {
      max-width: 100%;
      max-height: 200px;
      object-fit: contain;
      display: block;
    }

    .empty,
    .variable-hint {
      font-size: var(--spectrum-font-size-75);
      color: var(--spectrum-gray-700);
      text-align: center;
      margin: 0;
    }

    .actions {
      display: flex;
      justify-content: flex-start;
    }
  `;

  @property()
  value: string | undefined;

  private get canShowImage(): boolean {
    const v = this.value?.trim();
    if (!v) {
      return false;
    }
    if (v.startsWith('$') || v.startsWith('var(')) {
      return false;
    }
    return isDataUrl(v) || isUrl(v);
  }

  private async handleReplace() {
    try {
      const file = await fileOpen({
        extensions: ['jpg', 'png', 'svg', 'webp', 'heic', 'heif'],
        description: 'Image to upload',
      });
      if (!file) {
        return;
      }
      const dataUrl = await getDataURL(file);
      this.dispatchEvent(
        new CustomEvent('color-change', {
          detail: {
            type: 'image',
            value: dataUrl,
          },
          bubbles: true,
          composed: true,
        }),
      );
    } catch {
      /* 用户取消 file dialog */
    }
  }

  render() {
    return html`
      <div class="preview">
        <div class="preview-inner">
          ${when(
      this.canShowImage,
      () =>
        html`<img
                part="preview"
                src=${this.value!}
                alt=""
              />`,
      () =>
        html`<p class="empty">
                    ${msg(str`No image`)}
                  </p>`,
    )}
        </div>
      </div>
      <div class="actions">
        <sp-action-button size="m" @click=${this.handleReplace}>
          <sp-icon-image slot="icon"></sp-icon-image>
          ${msg(str`Upload`)}
        </sp-action-button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-input-image': InputImage;
  }
}
