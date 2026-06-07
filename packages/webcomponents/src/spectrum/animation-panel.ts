import { html, css, LitElement, type TemplateResult } from 'lit';
import { consume } from '@lit/context';
import { customElement, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { SerializedNode, Task, AppState } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext, nodesContext } from '../context';
import { type ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/number-field/sp-number-field.js';
import '@spectrum-web-components/textfield/sp-textfield.js';
import '@spectrum-web-components/field-label/sp-field-label.js';
import '@spectrum-web-components/picker/sp-picker.js';
import '@spectrum-web-components/menu/sp-menu-item.js';
import '@spectrum-web-components/switch/sp-switch.js';
import '@spectrum-web-components/tooltip/sp-tooltip.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-close.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-add.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-delete.js';

const PANEL_WIDTH_PX = 320;

/** Easing keys accepted by the ECS {@link AnimationController}; spring is parametric. */
const EASING_OPTIONS = [
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
] as const;

/**
 * Properties the {@link AnimationSystem} already knows how to apply. Used both to
 * label keyframe rows and to offer "add property track" choices for a node.
 */
const ANIMATABLE_PROPERTIES: { key: string; label: string; kind: 'number' | 'color' }[] = [
  { key: 'opacity', label: 'Opacity', kind: 'number' },
  { key: 'x', label: 'X', kind: 'number' },
  { key: 'y', label: 'Y', kind: 'number' },
  { key: 'rotation', label: 'Rotation', kind: 'number' },
  { key: 'scale', label: 'Scale', kind: 'number' },
  { key: 'scaleX', label: 'Scale X', kind: 'number' },
  { key: 'scaleY', label: 'Scale Y', kind: 'number' },
  { key: 'fill', label: 'Fill', kind: 'color' },
  { key: 'stroke', label: 'Stroke', kind: 'color' },
  { key: 'strokeWidth', label: 'Stroke width', kind: 'number' },
  { key: 'strokeOpacity', label: 'Stroke opacity', kind: 'number' },
  { key: 'fillOpacity', label: 'Fill opacity', kind: 'number' },
];

interface Keyframe {
  offset?: number;
  easing?: string;
  [property: string]: unknown;
}

/**
 * Right-side Animation panel (à la Jitter / Lottie creator). Displays the
 * animatable properties + keyframes of the currently selected element and lets
 * the user edit options, keyframes, and easing. Edits go through the ECS API so
 * they participate in history and serialization.
 */
@customElement('ic-spectrum-animation-panel')
@localized()
export class AnimationPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 100%;
    }

    section {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      width: ${PANEL_WIDTH_PX}px;
      max-width: 100%;
      background: var(--spectrum-gray-100);
      border-radius: var(--spectrum-corner-radius-200);
      margin: 4px;
      filter: drop-shadow(
        var(--spectrum-drop-shadow-color) 0px var(--spectrum-drop-shadow-y)
          var(--spectrum-drop-shadow-blur)
      );
    }

    h4 {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0;
      padding: var(--spectrum-global-dimension-size-100)
        var(--spectrum-global-dimension-size-150);
      font-size: var(--spectrum-global-dimension-font-size-100);
    }

    .panel-body {
      max-height: 520px;
      overflow: auto;
      padding: 0 var(--spectrum-global-dimension-size-150)
        var(--spectrum-global-dimension-size-150);
    }

    .empty {
      padding: var(--spectrum-global-dimension-size-200);
      text-align: center;
      color: var(--spectrum-gray-700);
    }

    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spectrum-global-dimension-size-100);
      margin-bottom: var(--spectrum-global-dimension-size-150);
    }

    .property-track {
      border-top: 1px solid var(--spectrum-gray-300);
      padding: var(--spectrum-global-dimension-size-100) 0;
    }

    .property-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 700;
      font-size: var(--spectrum-global-dimension-font-size-75);
      margin-bottom: var(--spectrum-global-dimension-size-75);
    }

    .keyframe-row {
      display: grid;
      grid-template-columns: 64px 1fr 96px 28px;
      gap: var(--spectrum-global-dimension-size-75);
      align-items: center;
      margin-bottom: var(--spectrum-global-dimension-size-65);
    }

    .add-property {
      display: flex;
      align-items: center;
      gap: var(--spectrum-global-dimension-size-100);
      border-top: 1px solid var(--spectrum-gray-300);
      padding-top: var(--spectrum-global-dimension-size-100);
      margin-top: var(--spectrum-global-dimension-size-100);
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: nodesContext, subscribe: true })
  nodes: SerializedNode[];

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @state()
  private addPropertyKey = '';

  private get selectedId(): string | undefined {
    const { layersSelected } = this.appState;
    return layersSelected.length === 1 ? layersSelected[0] : undefined;
  }

  private handleClose() {
    this.api.setAppState({
      taskbarSelected: this.appState.taskbarSelected.filter(
        (task) => task !== Task.SHOW_ANIMATION_PANEL,
      ),
    });
  }

  /** Create a default opacity 0→1 animation and switch into editing mode. */
  private handleAddAnimation(id: string) {
    this.api.setNodeAnimation(id, {
      keyframes: [
        { offset: 0, opacity: 0 },
        { offset: 1, opacity: 1 },
      ],
      options: { duration: 1000, easing: 'ease-in-out' },
    });
    this.api.setAnimationEditing(true);
  }

  private handleRemoveAnimation(id: string) {
    this.api.removeNodeAnimation(id);
  }

  private handleOptionChange(id: string, patch: Record<string, unknown>) {
    this.api.updateNodeAnimationOptions(id, patch);
  }

  private handleKeyframeChange(
    id: string,
    index: number,
    patch: Record<string, unknown>,
  ) {
    this.api.updateNodeAnimationKeyframe(id, index, patch);
  }

  private handleRemoveKeyframe(id: string, index: number) {
    this.api.removeNodeAnimationKeyframe(id, index);
  }

  /** Insert a keyframe for `property` at the current playhead, sampling its value. */
  private handleAddKeyframe(id: string, property: string) {
    const anim = this.api.getNodeAnimation(id);
    if (!anim) {
      return;
    }
    const duration = anim.options.duration || 1;
    const delay = anim.options.delay ?? 0;
    const offset = Math.max(
      0,
      Math.min(1, (this.appState.animationCurrentTime - delay) / duration),
    );
    const controller = this.api.getNodeAnimationController(id);
    const sampled = controller?.getCurrentValues();
    const value =
      sampled && property in sampled ? sampled[property] : 0;
    this.api.addNodeAnimationKeyframe(id, { offset, [property]: value });
  }

  private handleAddProperty(id: string) {
    const key = this.addPropertyKey;
    if (!key) {
      return;
    }
    const anim = this.api.getNodeAnimation(id);
    if (!anim) {
      return;
    }
    const def = ANIMATABLE_PROPERTIES.find((p) => p.key === key);
    const start = def?.kind === 'color' ? '#000000' : 0;
    const end = def?.kind === 'color' ? '#ffffff' : 1;
    const keyframes = anim.keyframes.map((kf) => ({ ...kf }));
    if (keyframes.length === 0) {
      keyframes.push({ offset: 0 }, { offset: 1 });
    }
    keyframes[0][key] = start;
    keyframes[keyframes.length - 1][key] = end;
    this.api.setNodeAnimationKeyframes(id, keyframes as Keyframe[]);
    this.addPropertyKey = '';
  }

  private renderKeyframeValue(
    id: string,
    index: number,
    property: string,
    value: unknown,
  ): TemplateResult {
    const isColor =
      typeof value === 'string' || property === 'fill' || property === 'stroke';
    if (isColor) {
      return html`<sp-textfield
        size="s"
        quiet
        .value=${value == null ? '' : String(value)}
        @change=${(e: Event) =>
          this.handleKeyframeChange(id, index, {
            [property]: (e.target as HTMLInputElement).value,
          })}
      ></sp-textfield>`;
    }
    return html`<sp-number-field
      size="s"
      quiet
      .value=${typeof value === 'number' ? value : Number(value) || 0}
      @change=${(e: Event) =>
        this.handleKeyframeChange(id, index, {
          [property]: (e.target as unknown as { value: number }).value,
        })}
    ></sp-number-field>`;
  }

  private renderEasingPicker(
    value: string,
    onChange: (next: string) => void,
  ): TemplateResult {
    return html`<sp-picker
      size="s"
      quiet
      .value=${value}
      @change=${(e: Event) => onChange((e.target as unknown as { value: string }).value)}
    >
      ${map(
        EASING_OPTIONS,
        (opt) => html`<sp-menu-item value=${opt}>${opt}</sp-menu-item>`,
      )}
    </sp-picker>`;
  }

  private renderPropertyTrack(
    id: string,
    property: string,
    keyframes: Keyframe[],
  ): TemplateResult {
    const def = ANIMATABLE_PROPERTIES.find((p) => p.key === property);
    const label = def?.label ?? property;
    return html`<div class="property-track">
      <div class="property-header">
        <span>${label}</span>
        <sp-action-button
          quiet
          size="s"
          label=${msg(str`Add keyframe at playhead`)}
          @click=${() => this.handleAddKeyframe(id, property)}
        >
          <sp-icon-add slot="icon"></sp-icon-add>
          <sp-tooltip self-managed placement="left">
            ${msg(str`Add keyframe at playhead`)}
          </sp-tooltip>
        </sp-action-button>
      </div>
      ${map(keyframes, (kf, i) =>
        property in kf
          ? html`<div class="keyframe-row">
              <sp-number-field
                size="s"
                quiet
                min="0"
                max="1"
                step="0.01"
                .value=${kf.offset ?? 0}
                @change=${(e: Event) =>
                  this.handleKeyframeChange(id, i, {
                    offset: (e.target as unknown as { value: number }).value,
                  })}
              ></sp-number-field>
              ${this.renderKeyframeValue(id, i, property, kf[property])}
              ${this.renderEasingPicker(kf.easing ?? 'linear', (next) =>
                this.handleKeyframeChange(id, i, { easing: next }),
              )}
              <sp-action-button
                quiet
                size="s"
                label=${msg(str`Remove keyframe`)}
                @click=${() => this.handleRemoveKeyframe(id, i)}
              >
                <sp-icon-delete slot="icon"></sp-icon-delete>
              </sp-action-button>
            </div>`
          : null,
      )}
    </div>`;
  }

  private renderContent(id: string): TemplateResult {
    const anim = this.api.getNodeAnimation(id);
    if (!anim) {
      return html`<div class="empty">
        <p>${msg(str`This element has no animation yet.`)}</p>
        <sp-action-button size="s" @click=${() => this.handleAddAnimation(id)}>
          <sp-icon-add slot="icon"></sp-icon-add>
          ${msg(str`Add animation`)}
        </sp-action-button>
      </div>`;
    }

    const { keyframes, options } = anim;
    const controller = this.api.getNodeAnimationController(id);
    const properties = controller?.getAnimatedProperties() ?? [];
    const remaining = ANIMATABLE_PROPERTIES.filter(
      (p) => !properties.includes(p.key),
    );

    return html`<div class="panel-body">
      <div class="options-grid">
        <sp-field-label>${msg(str`Duration (ms)`)}</sp-field-label>
        <sp-number-field
          size="s"
          min="0"
          .value=${options.duration}
          @change=${(e: Event) =>
            this.handleOptionChange(id, {
              duration: (e.target as unknown as { value: number }).value,
            })}
        ></sp-number-field>
        <sp-field-label>${msg(str`Delay (ms)`)}</sp-field-label>
        <sp-number-field
          size="s"
          min="0"
          .value=${options.delay ?? 0}
          @change=${(e: Event) =>
            this.handleOptionChange(id, {
              delay: (e.target as unknown as { value: number }).value,
            })}
        ></sp-number-field>
        <sp-field-label>${msg(str`Easing`)}</sp-field-label>
        ${this.renderEasingPicker(options.easing ?? 'linear', (next) =>
          this.handleOptionChange(id, { easing: next }),
        )}
        <sp-field-label>${msg(str`Loop`)}</sp-field-label>
        <sp-switch
          ?checked=${options.iterations === 'infinite'}
          @change=${(e: Event) =>
            this.handleOptionChange(id, {
              iterations: (e.target as HTMLInputElement).checked
                ? 'infinite'
                : 1,
            })}
        ></sp-switch>
      </div>

      ${map(properties, (property) =>
        this.renderPropertyTrack(id, property, keyframes),
      )}

      ${when(
        remaining.length > 0,
        () => html`<div class="add-property">
          <sp-picker
            size="s"
            label=${msg(str`Add property`)}
            .value=${this.addPropertyKey}
            @change=${(e: Event) => {
              this.addPropertyKey = (e.target as unknown as { value: string }).value;
            }}
          >
            ${map(
              remaining,
              (p) => html`<sp-menu-item value=${p.key}>${p.label}</sp-menu-item>`,
            )}
          </sp-picker>
          <sp-action-button
            size="s"
            ?disabled=${!this.addPropertyKey}
            @click=${() => this.handleAddProperty(id)}
          >
            ${msg(str`Add`)}
          </sp-action-button>
        </div>`,
      )}

      <div class="add-property">
        <sp-action-button
          quiet
          size="s"
          @click=${() => this.handleRemoveAnimation(id)}
        >
          <sp-icon-delete slot="icon"></sp-icon-delete>
          ${msg(str`Remove animation`)}
        </sp-action-button>
      </div>
    </div>`;
  }

  render() {
    if (!this.api) {
      return null;
    }
    const { taskbarSelected } = this.appState;
    if (!taskbarSelected.includes(Task.SHOW_ANIMATION_PANEL)) {
      return null;
    }

    const id = this.selectedId;

    return html`<section>
      <h4>
        ${msg(str`Animation`)}
        <sp-action-button quiet size="s" @click=${this.handleClose}>
          <sp-icon-close slot="icon"></sp-icon-close>
        </sp-action-button>
      </h4>
      ${id
        ? this.renderContent(id)
        : html`<div class="empty">
            ${msg(str`Select a single element to edit its animation.`)}
          </div>`}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-animation-panel': AnimationPanel;
  }
}
