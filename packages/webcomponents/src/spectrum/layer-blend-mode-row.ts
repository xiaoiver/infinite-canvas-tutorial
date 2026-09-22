import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  AppState,
  SerializedNode,
  type FillLayerBlendMode,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/field-label/sp-field-label.js';
import '@spectrum-web-components/picker/sp-picker.js';
import '@spectrum-web-components/menu/sp-menu-item.js';

const LAYER_BLEND_MODE_OPTIONS: FillLayerBlendMode[] = [
  'normal',
  'darken',
  'multiply',
  'linearBurn',
  'colorBurn',
  'light',
  'screen',
  'linearDodge',
  'colorDodge',
  'overlay',
  'softLight',
  'hardLight',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
];

function layerBlendModeLabel(mode: FillLayerBlendMode): string {
  switch (mode) {
    case 'normal':
      return msg(str`Normal`);
    case 'darken':
      return msg(str`Darken`);
    case 'multiply':
      return msg(str`Multiply`);
    case 'linearBurn':
      return msg(str`Linear burn`);
    case 'colorBurn':
      return msg(str`Color burn`);
    case 'light':
      return msg(str`Lighten`);
    case 'screen':
      return msg(str`Screen`);
    case 'linearDodge':
      return msg(str`Linear dodge`);
    case 'colorDodge':
      return msg(str`Color dodge`);
    case 'overlay':
      return msg(str`Overlay`);
    case 'softLight':
      return msg(str`Soft light`);
    case 'hardLight':
      return msg(str`Hard light`);
    case 'difference':
      return msg(str`Difference`);
    case 'exclusion':
      return msg(str`Exclusion`);
    case 'hue':
      return msg(str`Hue`);
    case 'saturation':
      return msg(str`Saturation`);
    case 'color':
      return msg(str`Color`);
    case 'luminosity':
      return msg(str`Luminosity`);
    default:
      return mode;
  }
}

@customElement('ic-spectrum-layer-blend-mode-row')
@localized()
export class LayerBlendModeRow extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin-bottom: var(--spectrum-global-dimension-size-100);
    }

    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
    }

    sp-field-label {
      width: 100px;
      flex-shrink: 0;
    }

    .controls {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: flex-end;
      min-width: 0;
    }

    sp-picker {
      width: 100%;
      max-width: 70px;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState!: AppState;

  @consume({ context: apiContext, subscribe: true })
  api!: ExtendedAPI;

  @property({ type: Object })
  node!: SerializedNode;

  private handleBlendModeChanged(e: Event & { target: HTMLInputElement }) {
    const value = (e.target as HTMLInputElement & { value?: string }).value;
    if (!value) {
      return;
    }
    const blendMode = value as FillLayerBlendMode;
    this.api.updateNode(this.node, {
      blendMode: blendMode === 'normal' ? undefined : blendMode,
    });
    this.api.record();
  }

  render() {
    if (!this.node) {
      return html``;
    }

    const blendMode = this.node.blendMode ?? 'normal';

    return html`
      <div class="line">
        <sp-field-label for="layer-blend-mode" side-aligned="start"
          >${msg(str`Blend mode`)}</sp-field-label
        >
        <div class="controls">
          <sp-picker
            id="layer-blend-mode"
            size="s"
            label=${msg(str`Blend mode`)}
            .value=${blendMode}
            @change=${this.handleBlendModeChanged}
          >
            ${LAYER_BLEND_MODE_OPTIONS.map(
      (mode) => html`
                <sp-menu-item value=${mode}
                  >${layerBlendModeLabel(mode)}</sp-menu-item
                >
              `,
    )}
          </sp-picker>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layer-blend-mode-row': LayerBlendModeRow;
  }
}
