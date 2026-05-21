import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { isDataUrl, isUrl } from '@infinite-canvas-tutorial/ecs';
import { localized, msg, str } from '@lit/localize';
import { fileOpen, getDataURL } from '../utils';
import {
  IMAGE_OBJECT_FIT_VALUES,
  type ImageObjectFit,
} from './image-fill-fields.js';

import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/field-label/sp-field-label.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-image.js';
import '@spectrum-web-components/menu/sp-menu-item.js';
import '@spectrum-web-components/picker/sp-picker.js';
import '@spectrum-web-components/textfield/sp-textfield.js';

function objectFitLabel(mode: ImageObjectFit): string {
  switch (mode) {
    case 'fill':
      return msg(str`Fill (stretch)`);
    case 'contain':
      return msg(str`Contain`);
    case 'cover':
      return msg(str`Cover`);
    case 'none':
      return msg(str`None`);
    case 'scale-down':
      return msg(str`Scale down`);
    default:
      return mode;
  }
}

@customElement('ic-spectrum-input-image')
@localized()
export class InputImage extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--spectrum-global-dimension-size-50);
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

    .empty {
      font-size: var(--spectrum-font-size-75);
      color: var(--spectrum-gray-700);
      text-align: center;
      margin: 0;
    }

    .actions {
      display: flex;
      justify-content: flex-start;
    }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
  `;

  @property()
  value: string | undefined;

  @property({ attribute: 'object-fit' })
  objectFit: ImageObjectFit = 'fill';

  @property({ attribute: 'object-position' })
  objectPosition = '';

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

  private emitImageChange(
    overrides: {
      value?: string;
      objectFit?: ImageObjectFit;
      objectPosition?: string;
    } = {},
  ) {
    this.dispatchEvent(
      new CustomEvent('color-change', {
        detail: {
          type: 'image',
          value: overrides.value ?? this.value ?? '',
          objectFit: overrides.objectFit ?? this.objectFit,
          objectPosition:
            overrides.objectPosition !== undefined
              ? overrides.objectPosition
              : this.objectPosition,
        },
        bubbles: true,
        composed: true,
      }),
    );
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
      this.emitImageChange({ value: dataUrl });
    } catch {
      /* 用户取消 file dialog */
    }
  }

  private handleObjectFitChange(e: Event) {
    const picker = e.currentTarget as HTMLElement & { value: string };
    const next = picker.value as ImageObjectFit;
    if (!IMAGE_OBJECT_FIT_VALUES.includes(next)) {
      return;
    }
    this.objectFit = next;
    this.emitImageChange({ objectFit: next });
  }

  private handleObjectPositionChange(e: Event) {
    const field = e.currentTarget as HTMLInputElement;
    this.objectPosition = field.value;
    this.emitImageChange({ objectPosition: field.value });
  }

  render() {
    const fitId = 'ic-input-image-object-fit';
    const posId = 'ic-input-image-object-position';
    return html`
    <div class="row">
        <sp-field-label for=${fitId} size="s">
          ${msg(str`Object fit`)}
        </sp-field-label>
        <sp-picker
          id=${fitId}
          size="s"
          label=${msg(str`Object fit`)}
          .value=${this.objectFit}
          @change=${this.handleObjectFitChange}
          style="width: 100px;"
        >
          ${IMAGE_OBJECT_FIT_VALUES.map(
      (mode) =>
        html`<sp-menu-item value=${mode}
              >${objectFitLabel(mode)}</sp-menu-item
            >`,
    )}
        </sp-picker>
      </div>
    <div class="row">
        <sp-field-label for=${posId} size="s">
          ${msg(str`Object position`)}
        </sp-field-label>
        <sp-textfield
          id=${posId}
          size="s"
          placeholder=${msg(str`e.g. center or top left`)}
          .value=${this.objectPosition}
          @change=${this.handleObjectPositionChange}
          style="width: 100px;"
        ></sp-textfield>
      </div>
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
        <sp-action-button size="s" style="width: 100%;" @click=${this.handleReplace}>
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
