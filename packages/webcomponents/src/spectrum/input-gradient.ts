import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { Gradient, parseGradient } from '@infinite-canvas-tutorial/ecs';

@customElement('ic-spectrum-input-gradient')
export class InputGradient extends LitElement {
  static styles = css`
    .gradient-actions {
      display: flex;
      align-items: center;
      justify-content: end;
      gap: 8px;
    }
    .gradient-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .gradient-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: var(--sl-font-size-small);

      > div {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
    .gradient-preview {
      width: 24px;
      height: 24px;
    }
  `;

  @property()
  value: string;

  @property()
  opacity: number;

  @state()
  gradients: Gradient[];

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('value')) {
      this.gradients = parseGradient(this.value) || [];
    }
  }

  private triggerGradientChangeEvent() {
    const event = new CustomEvent('gradientchanged', {
      detail: {
        gradient: convertGradientsToCSSValue(this.gradients),
        opacity: this.opacity,
      },
    });
    this.dispatchEvent(event);
  }

  private addGradient() {
    this.gradients = [
      ...this.gradients,
      {
        type: 'linear-gradient',
        angle: 0,
        steps: [
          {
            offset: {
              type: '%',
              value: 0,
            },
            color: 'white',
          },
          {
            offset: {
              type: '%',
              value: 100,
            },
            color: 'black',
          },
        ],
      },
    ];

    this.triggerGradientChangeEvent();
  }

  private removeGradient(index: number) {
    this.gradients = this.gradients.filter((_, i) => i !== index);

    this.triggerGradientChangeEvent();
  }

  private addStop(index: number) {
    this.gradients[index].steps.push({
      offset: {
        type: '%',
        value: 0,
      },
      color: 'white',
    });
    this.requestUpdate();
    this.triggerGradientChangeEvent();
  }

  private removeStop(index: number, stopIndex: number) {
    this.gradients[index].steps = this.gradients[index].steps.filter(
      (_, i) => i !== stopIndex,
    );
    this.requestUpdate();
    this.triggerGradientChangeEvent();
  }

  private handleOpacityChange(e: CustomEvent) {
    const opacity = (e.target as any).value;
    this.opacity = opacity;
    this.triggerGradientChangeEvent();
  }

  private handleAngleChange(index: number, e: CustomEvent) {
    const angle = (e.target as any).value;
    if (this.gradients[index].type === 'linear-gradient') {
      (this.gradients[index] as any).angle = angle;
      this.requestUpdate();
      this.triggerGradientChangeEvent();
    }
  }

  private handleGradientTypeChange(index: number, e: CustomEvent) {
    const type = (e.target as any).value;
    this.gradients[index].type = type;
    this.requestUpdate();
    this.triggerGradientChangeEvent();
  }

  private handleColorChange(index: number, stopIndex: number, e: CustomEvent) {
    const color = (e.target as any).value;
    this.gradients[index].steps[stopIndex].color = color;
    this.requestUpdate();
    this.triggerGradientChangeEvent();
  }

  private handleOffsetChange(index: number, stopIndex: number, e: CustomEvent) {
    const offset = (e.target as any).value;
    this.gradients[index].steps[stopIndex].offset.value = offset;
    this.requestUpdate();
    this.triggerGradientChangeEvent();
  }

  render() {
    return html`
      <sp-action-button quiet size="s" @click="${this.addGradient}">
        <sp-tooltip self-managed placement="bottom"> Add gradient </sp-tooltip>
        <sp-icon-add slot="icon"></sp-icon-add>
      </sp-action-button>
      <div class="gradient-list">
        ${map(this.gradients, (gradient, index) => {
          return html`<div class="gradient-item">
            <div>
              <div
                class="gradient-preview"
                style="background-image: ${convertGradientsToCSSValue([
                  gradient,
                ])}; transform: rotate(90deg);"
              ></div>
            </div>
          </div>`;
        })}
      </div>
    `;
  }
}

function convertGradientsToCSSValue(gradients: Gradient[]) {
  return gradients
    .map((gradient) => {
      if (gradient.type === 'linear-gradient') {
        return `linear-gradient(${gradient.angle || 0}deg, ${gradient.steps
          .map((step) => `${step.color} ${step.offset.value}%`)
          .join(', ')})`;
      } else if (gradient.type === 'radial-gradient') {
        return `radial-gradient(${gradient.steps
          .map((step) => `${step.color} ${step.offset.value}%`)
          .join(', ')})`;
      } else if (gradient.type === 'conic-gradient') {
        return `conic-gradient(${gradient.steps
          .map((step) => `${step.color} ${step.offset.value}%`)
          .join(', ')})`;
      }
      return '';
    })
    .join(', ');
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-input-gradient': InputGradient;
  }
}
