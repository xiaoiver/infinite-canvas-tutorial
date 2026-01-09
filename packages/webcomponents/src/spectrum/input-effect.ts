import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { trigger } from '@spectrum-web-components/overlay';
import { Effect, parseEffect } from '@infinite-canvas-tutorial/ecs';
import { ColorType } from './color-picker';
import { localized, msg, str } from '@lit/localize';

@customElement('ic-spectrum-input-effect')
@localized()
export class InputEffect extends LitElement {
  @property()
  value: string;

  @state()
  effects: Effect[];

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('value')) {
      this.effects = parseEffect(this.value) || [];
    }
  }

  private addEffect() {
    this.effects = [
      ...this.effects,
      {
        type: 'brightness',
        value: 0,
      },
    ];
  }

  render() {
    return html`
      <sp-action-button quiet size="s" @click="${this.addEffect}">
        <sp-tooltip self-managed placement="bottom">
          ${msg(str`Add effect`)}
        </sp-tooltip>
        <sp-icon-add slot="icon"></sp-icon-add>
      </sp-action-button>
      <div class="gradient-list"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-input-effect': InputEffect;
  }
}
