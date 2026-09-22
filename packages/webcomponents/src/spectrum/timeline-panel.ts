import { html, css, LitElement, type TemplateResult, type PropertyValues } from 'lit';
import { consume } from '@lit/context';
import { customElement, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { classMap } from 'lit/directives/class-map.js';
import { SerializedNode, Task, AppState } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext, nodesContext } from '../context';
import { type ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/tooltip/sp-tooltip.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-play.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-pause.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-refresh.js';

const TIMELINE_HEIGHT_STORAGE_KEY = 'ic-spectrum-timeline-panel-height';
const DEFAULT_TIMELINE_HEIGHT = 220;
const MIN_TIMELINE_HEIGHT = 120;
const MAX_TIMELINE_HEIGHT = 560;
const LABEL_COLUMN_WIDTH = 200;
/** Horizontal scale: pixels per millisecond (100px per second). */
const PX_PER_MS = 0.1;
/** Minimum drawable timeline span so an empty/short scene still shows a ruler. */
const MIN_SPAN_MS = 3000;

interface Track {
  id: string;
  name: string;
  properties: string[];
  delay: number;
  duration: number;
  totalDuration: number;
}

/**
 * Bottom Timeline panel (à la Jitter / Lottie creator). Shows every animated
 * track in the scene, a time ruler, and a draggable red playhead that scrubs the
 * shared scene clock. Selecting a track selects its element (driving the
 * right-side Animation panel).
 */
@customElement('ic-spectrum-timeline-panel')
@localized()
export class TimelinePanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .root {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      width: 100%;
      background: var(--spectrum-gray-100);
      border-top: 1px solid var(--spectrum-gray-300);
      filter: drop-shadow(
        var(--spectrum-drop-shadow-color) 0px calc(-1 * var(--spectrum-drop-shadow-y))
          var(--spectrum-drop-shadow-blur)
      );
    }

    .height-resize-handle {
      height: 8px;
      flex-shrink: 0;
      cursor: ns-resize;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .height-resize-handle::after {
      content: '';
      width: 36px;
      height: 3px;
      border-radius: 2px;
      background: var(--spectrum-gray-500);
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: var(--spectrum-global-dimension-size-100);
      padding: var(--spectrum-global-dimension-size-65)
        var(--spectrum-global-dimension-size-150);
      border-bottom: 1px solid var(--spectrum-gray-300);
    }

    .toolbar .title {
      margin-left: auto;
      font-size: var(--spectrum-global-dimension-font-size-75);
      color: var(--spectrum-gray-700);
    }

    .body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .labels {
      width: ${LABEL_COLUMN_WIDTH}px;
      flex-shrink: 0;
      border-right: 1px solid var(--spectrum-gray-300);
      overflow: hidden;
    }

    .lanes {
      position: relative;
      flex: 1;
      overflow: auto;
    }

    .ruler {
      position: sticky;
      top: 0;
      height: 24px;
      z-index: 2;
      background: var(--spectrum-gray-100);
      border-bottom: 1px solid var(--spectrum-gray-300);
    }
    .ruler-row {
      display: flex;
    }
    .ruler-spacer {
      width: ${LABEL_COLUMN_WIDTH}px;
      flex-shrink: 0;
      height: 24px;
      border-bottom: 1px solid var(--spectrum-gray-300);
      background: var(--spectrum-gray-100);
    }

    .tick {
      position: absolute;
      top: 0;
      height: 24px;
      border-left: 1px solid var(--spectrum-gray-300);
      font-size: 10px;
      color: var(--spectrum-gray-600);
      padding-left: 3px;
      box-sizing: border-box;
    }

    .label-row,
    .lane-row {
      height: 32px;
      display: flex;
      align-items: center;
      box-sizing: border-box;
      border-bottom: 1px solid var(--spectrum-gray-200);
    }
    .label-row {
      padding: 0 var(--spectrum-global-dimension-size-150);
      gap: var(--spectrum-global-dimension-size-100);
      font-size: var(--spectrum-global-dimension-font-size-75);
      cursor: pointer;
      min-width: 0;
    }
    .track-name {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .track-properties {
      flex-shrink: 0;
      color: var(--spectrum-gray-600);
    }
    .label-row.selected {
      background: var(--spectrum-accent-color-100, #d9d2ff);
      color: var(--spectrum-accent-color-1000, #5151d3);
      font-weight: 700;
    }

    .lane-row {
      position: relative;
    }
    .lane-row.selected {
      background: var(--spectrum-accent-color-100, #d9d2ff);
    }

    .bar {
      position: absolute;
      height: 16px;
      border-radius: 8px;
      background: var(--spectrum-gray-400);
      top: 8px;
    }
    .lane-row.selected .bar {
      background: var(--spectrum-accent-color-900, #6767ec);
    }

    .lanes-inner {
      position: relative;
    }

    .playhead {
      position: absolute;
      top: 0;
      width: 0;
      border-left: 2px solid #e34850;
      z-index: 3;
      pointer-events: none;
    }
    .playhead-bubble {
      position: absolute;
      top: 2px;
      transform: translateX(-50%);
      background: #e34850;
      color: white;
      font-size: 10px;
      border-radius: 8px;
      padding: 1px 6px;
      white-space: nowrap;
    }

    .empty {
      padding: var(--spectrum-global-dimension-size-200);
      color: var(--spectrum-gray-700);
      font-size: var(--spectrum-global-dimension-font-size-75);
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: nodesContext, subscribe: true })
  nodes: SerializedNode[];

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @state()
  private panelHeight = DEFAULT_TIMELINE_HEIGHT;

  private resizePointerId: number | null = null;
  private resizeStartY = 0;
  private resizeStartHeight = 0;
  private scrubPointerId: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(TIMELINE_HEIGHT_STORAGE_KEY);
      if (stored) {
        const n = parseInt(stored, 10);
        if (!Number.isNaN(n)) {
          this.panelHeight = this.clampHeight(n);
        }
      }
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    // Entering the timeline implies the deterministic scrub mode; leaving it
    // restores normal autoplay (handled by AnimationSystem on the next frame).
    const visible = this.appState?.taskbarSelected?.includes(
      Task.SHOW_TIMELINE_PANEL,
    );
    if (visible && this.api && !this.appState.animationEditing) {
      this.api.setAnimationEditing(true);
    }
  }

  private clampHeight(n: number) {
    return Math.max(MIN_TIMELINE_HEIGHT, Math.min(MAX_TIMELINE_HEIGHT, n));
  }

  private handleResizeDown(e: PointerEvent) {
    e.preventDefault();
    this.resizePointerId = e.pointerId;
    this.resizeStartY = e.clientY;
    this.resizeStartHeight = this.panelHeight;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  private handleResizeMove(e: PointerEvent) {
    if (this.resizePointerId !== e.pointerId) {
      return;
    }
    // Dragging up (negative dy) should grow the bottom panel.
    const dy = this.resizeStartY - e.clientY;
    this.panelHeight = this.clampHeight(this.resizeStartHeight + dy);
  }
  private handleResizeUp(e: PointerEvent) {
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
      localStorage.setItem(TIMELINE_HEIGHT_STORAGE_KEY, String(this.panelHeight));
    }
  }

  private getTracks(): Track[] {
    return this.api?.getAnimatedTracks?.() ?? [];
  }

  private getSpan(tracks: Track[]) {
    const sceneDuration = tracks.reduce((m, t) => Math.max(m, t.totalDuration), 0);
    return Math.max(MIN_SPAN_MS, sceneDuration);
  }

  private handleClose() {
    this.api.setAppState({
      taskbarSelected: this.appState.taskbarSelected.filter(
        (task) => task !== Task.SHOW_TIMELINE_PANEL,
      ),
    });
    this.api.setAnimationEditing(false);
  }

  private handleSelectTrack(id: string) {
    this.api.setAppState({ layersSelected: [id], layersHighlighted: [] });
  }

  private timeFromPointer(e: PointerEvent): number {
    const lanes = this.renderRoot.querySelector('.lanes') as HTMLElement | null;
    if (!lanes) {
      return 0;
    }
    const rect = lanes.getBoundingClientRect();
    const x = e.clientX - rect.left + lanes.scrollLeft;
    return Math.max(0, x / PX_PER_MS);
  }

  private handleScrubDown(e: PointerEvent) {
    // Only start scrubbing on empty lane space / ruler, not on a clickable label.
    this.scrubPointerId = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.api.setAnimationCurrentTime(this.timeFromPointer(e));
  }
  private handleScrubMove(e: PointerEvent) {
    if (this.scrubPointerId !== e.pointerId) {
      return;
    }
    this.api.setAnimationCurrentTime(this.timeFromPointer(e));
  }
  private handleScrubUp(e: PointerEvent) {
    if (this.scrubPointerId !== e.pointerId) {
      return;
    }
    this.scrubPointerId = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }

  private renderTicks(span: number): TemplateResult[] {
    const ticks: TemplateResult[] = [];
    const totalSeconds = Math.ceil(span / 1000);
    for (let s = 0; s <= totalSeconds; s++) {
      const left = s * 1000 * PX_PER_MS;
      ticks.push(
        html`<div class="tick" style=${`left:${left}px;`}>${s}s</div>`,
      );
    }
    return ticks;
  }

  render() {
    if (!this.api) {
      return null;
    }
    const { taskbarSelected, animationPlaying, animationLoop, animationCurrentTime } =
      this.appState;
    if (!taskbarSelected.includes(Task.SHOW_TIMELINE_PANEL)) {
      return null;
    }

    const tracks = this.getTracks();
    const span = this.getSpan(tracks);
    const laneWidth = span * PX_PER_MS;
    const selectedId =
      this.appState.layersSelected.length === 1
        ? this.appState.layersSelected[0]
        : undefined;
    const playheadLeft = Math.max(0, animationCurrentTime) * PX_PER_MS;
    const bodyHeight = this.panelHeight - 8 /* handle */ - 33 /* toolbar */;

    return html`<div class="root" style=${`height:${this.panelHeight}px;`}>
      <div
        class="height-resize-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label=${msg(str`Resize timeline height`)}
        @pointerdown=${this.handleResizeDown}
        @pointermove=${this.handleResizeMove}
        @pointerup=${this.handleResizeUp}
        @pointercancel=${this.handleResizeUp}
      ></div>

      <div class="toolbar">
        <sp-action-button
          quiet
          size="s"
          label=${animationPlaying ? msg(str`Pause`) : msg(str`Play`)}
          @click=${() => this.api.toggleAnimationPlaying()}
        >
          ${animationPlaying
            ? html`<sp-icon-pause slot="icon"></sp-icon-pause>`
            : html`<sp-icon-play slot="icon"></sp-icon-play>`}
        </sp-action-button>
        <sp-action-button
          quiet
          size="s"
          ?selected=${animationLoop}
          label=${msg(str`Loop`)}
          @click=${() => this.api.setAnimationLoop(!animationLoop)}
        >
          <sp-icon-refresh slot="icon"></sp-icon-refresh>
        </sp-action-button>
        <span class="title">${msg(str`Timeline`)}</span>
        <sp-action-button quiet size="s" @click=${this.handleClose}>
          ${msg(str`Close`)}
        </sp-action-button>
      </div>

      ${tracks.length === 0
        ? html`<div class="empty">
            ${msg(str`No animations in this scene yet. Select an element and add an animation.`)}
          </div>`
        : html`<div class="body" style=${`height:${bodyHeight}px;`}>
            <div class="labels">
              <div class="ruler-spacer"></div>
              ${map(
                tracks,
                (t) => html`<div
                  class=${classMap({
                    'label-row': true,
                    selected: t.id === selectedId,
                  })}
                  @click=${() => this.handleSelectTrack(t.id)}
                >
                  <span class="track-name" title=${t.name}>${t.name}</span>
                  <span class="track-properties"
                    >· ${t.properties.join(', ')}</span
                  >
                </div>`,
              )}
            </div>
            <div
              class="lanes"
              @pointerdown=${this.handleScrubDown}
              @pointermove=${this.handleScrubMove}
              @pointerup=${this.handleScrubUp}
              @pointercancel=${this.handleScrubUp}
            >
              <div class="lanes-inner" style=${`width:${laneWidth}px;`}>
                <div class="ruler">${this.renderTicks(span)}</div>
                ${map(
                  tracks,
                  (t) => html`<div
                    class=${classMap({
                      'lane-row': true,
                      selected: t.id === selectedId,
                    })}
                  >
                    <div
                      class="bar"
                      style=${`left:${t.delay * PX_PER_MS}px; width:${Math.max(
                        4,
                        t.duration * PX_PER_MS,
                      )}px;`}
                    ></div>
                  </div>`,
                )}
                <div
                  class="playhead"
                  style=${`left:${playheadLeft}px; height:${
                    tracks.length * 32 + 24
                  }px;`}
                >
                  <div class="playhead-bubble">
                    ${(animationCurrentTime / 1000).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-timeline-panel': TimelinePanel;
  }
}
