import { html, css, LitElement, type TemplateResult } from 'lit';
import { consume } from '@lit/context';
import { customElement, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { SerializedNode, Task, AppState, cssColorToHex, isGradient, isUrl, isDataUrl } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext, nodesContext } from '../context';
import { type ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import { ColorType, type ColorPickerChangeDetail } from './color-picker.js';
import { normalizeSolidCssValue } from './normalize-solid-css.js';
import './color-picker.js';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/number-field/sp-number-field.js';
import '@spectrum-web-components/field-label/sp-field-label.js';
import '@spectrum-web-components/picker/sp-picker.js';
import '@spectrum-web-components/menu/sp-menu-item.js';
import '@spectrum-web-components/switch/sp-switch.js';
import '@spectrum-web-components/tooltip/sp-tooltip.js';
import '@spectrum-web-components/overlay/sp-overlay.js';
import '@spectrum-web-components/popover/sp-popover.js';
import '@spectrum-web-components/swatch/sp-swatch.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-close.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-add.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-delete.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-image.js';

const PANEL_HEIGHT_STORAGE_KEY = 'ic-spectrum-animation-panel-body-height';
const PANEL_WIDTH_STORAGE_KEY = 'ic-spectrum-animation-panel-width';
const DEFAULT_PANEL_BODY_HEIGHT = 400;
const DEFAULT_PANEL_WIDTH_PX = 320;
const MIN_PANEL_BODY_HEIGHT = 120;
const MAX_PANEL_BODY_HEIGHT = 900;
const MIN_PANEL_WIDTH_PX = 260;
const MAX_PANEL_WIDTH_PX = 720;

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

    .panel-root {
      display: flex;
      flex-direction: row;
      align-items: stretch;
      box-sizing: border-box;
      min-width: ${MIN_PANEL_WIDTH_PX}px;
      max-width: 100%;
    }

    .width-resize-handle,
    .height-resize-handle {
      flex-shrink: 0;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--spectrum-corner-radius-100);
    }

    .width-resize-handle {
      width: 10px;
      margin: 4px 0 4px 0;
      cursor: ew-resize;
    }

    .height-resize-handle {
      height: 10px;
      margin: 4px 0 4px 0;
      cursor: ns-resize;
    }

    .width-resize-handle:hover,
    .width-resize-handle:focus-visible,
    .height-resize-handle:hover,
    .height-resize-handle:focus-visible {
      background: var(--spectrum-gray-300);
    }

    .width-resize-handle::after,
    .height-resize-handle::after {
      content: '';
      border-radius: 2px;
      background: var(--spectrum-gray-500);
    }

    .width-resize-handle::after {
      width: 3px;
      height: 36px;
    }

    .height-resize-handle::after {
      width: 36px;
      height: 3px;
    }

    .panel-column {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    section {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      box-sizing: border-box;
      min-height: 0;
      background: var(--spectrum-gray-100);
      border-radius: var(--spectrum-corner-radius-200) var(--spectrum-corner-radius-200) 0
        0;
      margin: 4px 4px 0 4px;
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
        var(--spectrum-global-dimension-size-100);
      font-size: var(--spectrum-global-dimension-font-size-100);
      color: canvastext;
    }

    .panel-body {
      box-sizing: border-box;
      min-height: 0;
      overflow: auto;
      padding: var(--spectrum-global-dimension-size-100);
      padding-top: 0;
    }

    .empty {
      text-align: center;
    }

    .options-grid {
      display: flex;
      flex-direction: column;
      gap: var(--spectrum-global-dimension-size-50);
      margin-bottom: var(--spectrum-global-dimension-size-100);
    }

    .option-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spectrum-global-dimension-size-100);
    }

    .option-row sp-field-label {
      flex-shrink: 0;
    }

    .property-track {
      border-top: 1px solid var(--spectrum-gray-300);
      padding: var(--spectrum-global-dimension-size-50) 0;
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
      display: flex;
      gap: var(--spectrum-global-dimension-size-75);
      align-items: center;
      margin-bottom: var(--spectrum-global-dimension-size-50);
    }

    .keyframe-row sp-action-button:last-child {
      margin-left: auto;
      flex-shrink: 0;
    }

    .keyframe-color-wrap {
      flex: 0 0 auto;
    }

    .keyframe-color-trigger {
      flex: 0 0 auto;
    }

    sp-popover {
      padding: 0;
    }

    .add-property {
      display: flex;
      align-items: center;
      gap: var(--spectrum-global-dimension-size-100);
      border-top: 1px solid var(--spectrum-gray-300);
      padding-top: var(--spectrum-global-dimension-size-100);
    }

    .remove-animation {
      padding-top: var(--spectrum-global-dimension-size-50);
    }

    sp-picker {
      width: 70px;
    }
    sp-number-field {
      width: 70px;
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

  @state()
  private panelBodyHeight = DEFAULT_PANEL_BODY_HEIGHT;

  @state()
  private panelWidth = DEFAULT_PANEL_WIDTH_PX;

  private resizePointerId: number | null = null;

  private resizeStartY = 0;

  private resizeStartHeight = 0;

  private widthResizePointerId: number | null = null;

  private widthResizeStartX = 0;

  private widthResizeStartW = 0;

  connectedCallback(): void {
    super.connectedCallback();
    if (typeof localStorage === 'undefined') {
      return;
    }
    const storedH = localStorage.getItem(PANEL_HEIGHT_STORAGE_KEY);
    if (storedH) {
      const n = parseInt(storedH, 10);
      if (!Number.isNaN(n)) {
        this.panelBodyHeight = this.clampPanelHeight(n);
      }
    }
    const storedW = localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    if (storedW) {
      const n = parseInt(storedW, 10);
      if (!Number.isNaN(n)) {
        this.panelWidth = this.clampPanelWidth(n);
      }
    }
  }

  private clampPanelHeight(h: number): number {
    const max = Math.min(
      MAX_PANEL_BODY_HEIGHT,
      typeof window !== 'undefined'
        ? Math.floor(window.innerHeight * 0.85)
        : MAX_PANEL_BODY_HEIGHT,
    );
    return Math.min(max, Math.max(MIN_PANEL_BODY_HEIGHT, Math.round(h)));
  }

  private clampPanelWidth(w: number): number {
    const max = Math.min(
      MAX_PANEL_WIDTH_PX,
      typeof window !== 'undefined'
        ? Math.max(
          MIN_PANEL_WIDTH_PX,
          Math.floor(window.innerWidth - 80),
        )
        : MAX_PANEL_WIDTH_PX,
    );
    return Math.min(max, Math.max(MIN_PANEL_WIDTH_PX, Math.round(w)));
  }

  private handleResizePointerDown(e: PointerEvent) {
    e.preventDefault();
    this.resizePointerId = e.pointerId;
    this.resizeStartY = e.clientY;
    this.resizeStartHeight = this.panelBodyHeight;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  private handleResizePointerMove(e: PointerEvent) {
    if (this.resizePointerId !== e.pointerId) {
      return;
    }
    const dy = e.clientY - this.resizeStartY;
    const next = this.clampPanelHeight(this.resizeStartHeight + dy);
    if (next !== this.panelBodyHeight) {
      this.panelBodyHeight = next;
    }
  }

  private endResize(e: PointerEvent) {
    if (this.resizePointerId !== e.pointerId) {
      return;
    }
    this.resizePointerId = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        PANEL_HEIGHT_STORAGE_KEY,
        String(this.panelBodyHeight),
      );
    }
  }

  private handleWidthResizePointerDown(e: PointerEvent) {
    e.preventDefault();
    this.widthResizePointerId = e.pointerId;
    this.widthResizeStartX = e.clientX;
    this.widthResizeStartW = this.panelWidth;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  private handleWidthResizePointerMove(e: PointerEvent) {
    if (this.widthResizePointerId !== e.pointerId) {
      return;
    }
    const dx = e.clientX - this.widthResizeStartX;
    const next = this.clampPanelWidth(this.widthResizeStartW - dx);
    if (next !== this.panelWidth) {
      this.panelWidth = next;
    }
  }

  private endWidthResize(e: PointerEvent) {
    if (this.widthResizePointerId !== e.pointerId) {
      return;
    }
    this.widthResizePointerId = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(this.panelWidth));
    }
  }

  private get maxPanelWidthResolved(): number {
    return typeof window !== 'undefined'
      ? Math.max(
        MIN_PANEL_WIDTH_PX,
        Math.min(MAX_PANEL_WIDTH_PX, window.innerWidth - 80),
      )
      : MAX_PANEL_WIDTH_PX;
  }

  private panelBodyStyle(): string {
    return `height:${this.panelBodyHeight}px; overflow: auto;`;
  }

  private renderWidthResizeHandle() {
    return html`<div
      class="width-resize-handle"
      tabindex="0"
      role="separator"
      aria-orientation="vertical"
      aria-label=${msg(str`Resize panel width`)}
      aria-valuenow=${this.panelWidth}
      aria-valuemin=${MIN_PANEL_WIDTH_PX}
      aria-valuemax=${this.maxPanelWidthResolved}
      @pointerdown=${this.handleWidthResizePointerDown}
      @pointermove=${this.handleWidthResizePointerMove}
      @pointerup=${this.endWidthResize}
      @pointercancel=${this.endWidthResize}
    ></div>`;
  }

  private renderResizeHandle() {
    return html`<div
      class="height-resize-handle"
      tabindex="0"
      role="separator"
      aria-orientation="horizontal"
      aria-label=${msg(str`Resize panel height`)}
      aria-valuenow=${this.panelBodyHeight}
      aria-valuemin=${MIN_PANEL_BODY_HEIGHT}
      aria-valuemax=${MAX_PANEL_BODY_HEIGHT}
      @pointerdown=${this.handleResizePointerDown}
      @pointermove=${this.handleResizePointerMove}
      @pointerup=${this.endResize}
      @pointercancel=${this.endResize}
    ></div>`;
  }

  private renderPanelRoot(inner: TemplateResult) {
    return html`
      <div
        class="panel-root"
        style=${`width: ${this.panelWidth}px; max-width: 100%;`}
      >
        ${this.renderWidthResizeHandle()}
        <div class="panel-column">
          ${inner}
          ${this.renderResizeHandle()}
        </div>
      </div>
    `;
  }

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

  private keyframeColorTriggerId(
    nodeId: string,
    property: string,
    index: number,
  ): string {
    return `kf-color-${nodeId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${property}-${index}`;
  }

  private handleKeyframeColorChange(
    id: string,
    index: number,
    property: string,
    e: CustomEvent<ColorPickerChangeDetail>,
  ) {
    const { type, value } = e.detail;
    const wire =
      type === ColorType.Solid ? normalizeSolidCssValue(value) : value;
    this.handleKeyframeChange(id, index, { [property]: wire });
  }

  private renderKeyframeColorTriggerIcon(wire: string) {
    if (wire === 'none') {
      return html`<sp-swatch nothing slot="icon"></sp-swatch>`;
    }
    if (isGradient(wire)) {
      return html`<sp-swatch color=${wire} slot="icon"></sp-swatch>`;
    }
    if (isUrl(wire) || isDataUrl(wire)) {
      return html`<sp-icon-image slot="icon"></sp-icon-image>`;
    }
    return html`<sp-swatch
      color=${cssColorToHex(wire)}
      slot="icon"
    ></sp-swatch>`;
  }

  private renderKeyframeColorPicker(
    id: string,
    index: number,
    property: string,
    value: unknown,
  ): TemplateResult {
    const wire = value == null ? '#000000' : String(value);
    const triggerId = this.keyframeColorTriggerId(id, property, index);
    return html`<div class="keyframe-color-wrap">
      <sp-action-button
        class="keyframe-color-trigger"
        quiet
        size="s"
        id=${triggerId}
        label=${msg(str`Edit color`)}
      >
        ${this.renderKeyframeColorTriggerIcon(wire)}
      </sp-action-button>
      <sp-overlay
        trigger=${`${triggerId}@click`}
        placement="bottom"
        type="auto"
      >
        <sp-popover dialog>
          <ic-spectrum-color-picker
            value=${wire}
            @color-change=${(e: CustomEvent<ColorPickerChangeDetail>) =>
        this.handleKeyframeColorChange(id, index, property, e)}
          ></ic-spectrum-color-picker>
        </sp-popover>
      </sp-overlay>
    </div>`;
  }

  private renderKeyframeValue(
    id: string,
    index: number,
    property: string,
    value: unknown,
  ): TemplateResult {
    const def = ANIMATABLE_PROPERTIES.find((p) => p.key === property);
    if (def?.kind === 'color') {
      return this.renderKeyframeColorPicker(id, index, property, value);
    }
    return html`<sp-number-field
      size="s"
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
        <sp-action-button size="s" style="width: 100%;" @click=${() => this.handleAddAnimation(id)}>
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

    return html`
      <div class="options-grid">
        <div class="option-row">
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
        </div>
        <div class="option-row">
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
        </div>
        <div class="option-row">
          <sp-field-label>${msg(str`Easing`)}</sp-field-label>
          ${this.renderEasingPicker(options.easing ?? 'linear', (next) =>
          this.handleOptionChange(id, { easing: next }),
        )}
        </div>
        <div class="option-row">
          <sp-field-label>${msg(str`Loop`)}</sp-field-label>
          <sp-switch
            size="s"
            ?checked=${options.iterations === 'infinite'}
            @change=${(e: Event) =>
        this.handleOptionChange(id, {
          iterations: (e.target as HTMLInputElement).checked
            ? 'infinite'
            : 1,
        })}
          ></sp-switch>
        </div>
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
            style="width: 100%;"
            ?disabled=${!this.addPropertyKey}
            @click=${() => this.handleAddProperty(id)}
          >
            ${msg(str`Add animation property`)}
          </sp-action-button>
        </div>`,
        )}

      <div class="remove-animation">
        <sp-action-button
          size="s"
          style="width: 100%;"
          @click=${() => this.handleRemoveAnimation(id)}
        >
          ${msg(str`Remove animation`)}
        </sp-action-button>
      </div>
    `;
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

    return this.renderPanelRoot(html`<section>
      <h4>
        ${msg(str`Animation`)}
        <sp-action-button quiet size="s" @click=${this.handleClose}>
          <sp-icon-close slot="icon"></sp-icon-close>
        </sp-action-button>
      </h4>
      <div class="panel-body" style=${this.panelBodyStyle()}>
        ${id
        ? this.renderContent(id)
        : html`<div class="empty">
            ${msg(str`Select a single element to edit its animation.`)}
          </div>`}
      </div>
    </section>`);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-animation-panel': AnimationPanel;
  }
}
