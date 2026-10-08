import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { localized, msg, str } from '@lit/localize';
import { when } from 'lit/directives/when.js';
import { AppState, Pen } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { fileOpen } from '../utils';

const DRAW_PENS = [
  Pen.DRAW_RECT,
  Pen.DRAW_TRIANGLE,
  Pen.DRAW_PENTAGON,
  Pen.DRAW_HEXAGON,
  Pen.DRAW_ELLIPSE,
  Pen.DRAW_LINE,
  Pen.DRAW_ROUGH_RECT,
  Pen.DRAW_ROUGH_ELLIPSE,
  Pen.DRAW_ROUGH_LINE,
  Pen.DRAW_ICONFONT,
] as const;
type DrawPen = (typeof DRAW_PENS)[number];
const isDrawPen = (pen: Pen): pen is DrawPen =>
  (DRAW_PENS as readonly Pen[]).includes(pen);

type ImageRequest = {
  api: ExtendedAPI;
  controller: AbortController;
  pen: Pen.IMAGE | Pen.SELECT;
};

@customElement('ic-spectrum-penbar')
@localized()
export class Penbar extends LitElement {
  static styles = css`
    .penbar {
      display: flex;
      justify-content: center;

      background: var(--spectrum-gray-100);
      border-radius: var(--spectrum-corner-radius-200);

      padding: var(--spectrum-global-dimension-size-100);
      margin: 4px;

      filter: drop-shadow(
        var(--spectrum-drop-shadow-color) 0px var(--spectrum-drop-shadow-y)
          var(--spectrum-drop-shadow-blur)
      );
    }

    kbd {
      font-family: var(--spectrum-alias-body-text-font-family);
      letter-spacing: 0.1em;
      white-space: nowrap;
      border: none;
      padding: none;
      padding: 0;
      line-height: normal;
    }
  `;

  private appStateValue: AppState;

  @consume({ context: appStateContext, subscribe: true })
  get appState() {
    return this.appStateValue;
  }
  set appState(value: AppState) {
    this.appStateValue = value;
    // Context changes are synchronous. Waiting for updated() would let a later
    // image edit in the same ECS frame commit after a queued tool change.
    if (this.imageRequest && !this.isCurrentImageRequest(this.imageRequest)) {
      this.cancelImageRequest();
    }
    this.requestUpdate();
  }

  private apiValue: ExtendedAPI;

  @consume({ context: apiContext, subscribe: true })
  get api() {
    return this.apiValue;
  }
  set api(value: ExtendedAPI) {
    if (this.apiValue === value) return;
    this.releaseBinding();
    this.apiValue = value;
    this.requestUpdate();
  }

  /**
   * Record the last draw pen, so that when the penbar is changed, the last draw pen will be selected.
   */
  @state()
  lastDrawPen: DrawPen = Pen.DRAW_RECT;

  private boundApi?: ExtendedAPI;
  private boundCanvas?: HTMLCanvasElement;
  private disposeBinding?: () => void;
  private imageRequest?: ImageRequest;
  private drawPens = new WeakMap<ExtendedAPI, DrawPen>();

  private previousPen: Pen;
  private previousPenbarVisible: boolean;

  shouldUpdate(changedProperties: PropertyValues) {
    const newPen = this.appState?.penbarSelected;
    if (newPen !== this.previousPen) {
      this.previousPen = newPen;
      return true;
    }

    const newPenbarVisible = this.appState?.penbarVisible;
    if (newPenbarVisible !== this.previousPenbarVisible) {
      this.previousPenbarVisible = newPenbarVisible;
      return true;
    }

    return super.shouldUpdate(changedProperties);
  }

  private refreshTool(api: ExtendedAPI) {
    if (this.isConnected && this.api === api) {
      this.appState = api.getAppState();
      this.requestUpdate();
    }
  }

  private cancelImageRequest(restoreTool = false) {
    const request = this.imageRequest;
    this.imageRequest = undefined;
    if (!request) return;
    request.controller.abort();
    if (
      restoreTool &&
      this.boundCanvas &&
      this.boundApi === request.api &&
      request.api.getAppState().penbarSelected === Pen.IMAGE
    ) {
      try {
        request.api.setAppState({ penbarSelected: Pen.SELECT });
        this.refreshTool(request.api);
      } catch (error) {
        console.error('Failed to restore image tool', error);
      }
    }
  }

  /** Tool preferences never advance the document's undo baseline. */
  private selectPen(pen: Pen) {
    this.bindCanvas();
    const api = this.boundApi;
    if (!this.isConnected || !api || !this.boundCanvas || this.api !== api)
      return;
    try {
      if (!api.getAppState().penbarAll.includes(pen)) return;
      this.cancelImageRequest();
      if (api.getAppState().penbarSelected !== pen) {
        api.setAppState({ penbarSelected: pen });
      }
      if (isDrawPen(pen)) {
        this.lastDrawPen = pen;
        this.drawPens.set(api, pen);
      }
      return api;
    } catch (error) {
      console.error('Failed to select drawing tool', error);
    } finally {
      this.refreshTool(api);
    }
  }

  private async handlePenChanged(event: CustomEvent) {
    event.stopPropagation();
    const pen = (event.currentTarget as HTMLElement & { selected: Pen[] })
      .selected?.[0];
    const api = this.selectPen(pen);
    if (!api || pen !== Pen.IMAGE) return;

    const request: ImageRequest = {
      api,
      controller: new AbortController(),
      pen: Pen.IMAGE,
    };
    this.imageRequest = request;
    const { signal } = request.controller;
    try {
      // Keep the invocation's canvas and position even while the picker is open.
      const position = api.viewport2Canvas({
        x: api.element.clientWidth / 2,
        y: api.element.clientHeight / 2,
      });
      const file = await fileOpen({
        extensions: ['jpg', 'png', 'svg', 'webp', 'heic', 'heif'],
        description: 'Image to upload',
      });
      if (!file || !this.isCurrentImageRequest(request)) return;
      // Select runs after edits in the ECS frame and clears selection for IMAGE.
      // Restore the tool before queuing insertion so it keeps the new selection.
      request.pen = Pen.SELECT;
      api.setAppState({ penbarSelected: Pen.SELECT });
      this.refreshTool(api);
      await api.createImageFromFile(file, { position, signal });
    } catch (error) {
      if (!signal.aborted && error && (error as Error).name !== 'AbortError') {
        console.error('Failed to insert image', error);
      }
    } finally {
      if (this.imageRequest === request) {
        this.cancelImageRequest(true);
      }
    }
  }

  private isCurrentImageRequest(request: ImageRequest) {
    return (
      this.isConnected &&
      this.api === request.api &&
      this.boundApi === request.api &&
      !!this.boundCanvas &&
      this.imageRequest === request &&
      !request.controller.signal.aborted &&
      request.api.getAppState().penbarSelected === request.pen
    );
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    const api = this.boundApi;
    if (
      !this.isConnected ||
      !this.boundCanvas ||
      this.api !== api ||
      document.activeElement !== api?.element ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    const pens: Record<string, Pen> = {
      R: Pen.DRAW_RECT,
      T: Pen.DRAW_TRIANGLE,
      '5': Pen.DRAW_PENTAGON,
      '6': Pen.DRAW_HEXAGON,
      L: event.shiftKey ? Pen.DRAW_ARROW : Pen.DRAW_LINE,
      O: Pen.DRAW_ELLIPSE,
    };
    const pen = pens[event.key.toUpperCase()];
    if (!pen || !api.getAppState().penbarAll.includes(pen)) return;
    event.preventDefault();
    event.stopPropagation();
    this.selectPen(pen);
  };

  private releaseBinding() {
    this.cancelImageRequest(true);
    this.boundCanvas?.removeEventListener('keydown', this.handleKeyDown);
    this.boundCanvas = undefined;
    this.disposeBinding?.();
    this.disposeBinding = undefined;
    this.boundApi = undefined;
  }

  private bindCanvas() {
    if (!this.isConnected || this.boundApi === this.api) return;
    this.releaseBinding();
    const api = this.api;
    if (!api?.element) return;
    this.boundApi = api;
    let destroyed = false;
    this.disposeBinding = api.onDestroy(() => {
      destroyed = true;
      this.cancelImageRequest();
      this.boundCanvas?.removeEventListener('keydown', this.handleKeyDown);
      this.boundCanvas = undefined;
    });
    if (destroyed) return;
    this.boundCanvas = api.getCanvasElement();
    this.boundCanvas.addEventListener('keydown', this.handleKeyDown);
    const pen = api.getAppState().penbarSelected;
    this.lastDrawPen = isDrawPen(pen)
      ? pen
      : this.drawPens.get(api) ?? Pen.DRAW_RECT;
    this.drawPens.set(api, this.lastDrawPen);
  }

  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.releaseBinding();
  }

  protected updated() {
    this.bindCanvas();
    if (this.imageRequest && !this.isCurrentImageRequest(this.imageRequest)) {
      this.cancelImageRequest();
    }
  }
  render() {
    if (!this.api) return;

    const { penbarAll, penbarSelected, penbarVisible } = this.api.getAppState();
    return when(
      penbarVisible,
      () => html`
        <sp-action-group
          class="penbar"
          vertical
          selects="single"
          .selected=${[penbarSelected]}
          @change=${this.handlePenChanged}
          emphasized
          quiet
        >
          ${when(
        penbarAll.includes(Pen.HAND),
        () => html`
              <sp-action-button value="${Pen.HAND}">
                <sp-icon-hand slot="icon"></sp-icon-hand>
                <sp-tooltip self-managed placement="right">
                  ${msg(str`Hand (Panning tool)`)}
                </sp-tooltip>
              </sp-action-button>
            `,
      )}
          ${when(
        penbarAll.includes(Pen.SELECT),
        () => html`
              <sp-action-button value="${Pen.SELECT}">
                <sp-icon-select slot="icon"></sp-icon-select>
                <sp-tooltip self-managed placement="right">
                  ${msg(str`Select`)}
                </sp-tooltip>
              </sp-action-button>
            `,
      )}
          ${when(
        penbarAll.includes(Pen.DRAW_RECT) ||
        penbarAll.includes(Pen.DRAW_TRIANGLE) ||
        penbarAll.includes(Pen.DRAW_PENTAGON) ||
        penbarAll.includes(Pen.DRAW_HEXAGON) ||
        penbarAll.includes(Pen.DRAW_ELLIPSE) ||
        penbarAll.includes(Pen.DRAW_LINE) ||
        penbarAll.includes(Pen.DRAW_ROUGH_RECT) ||
        penbarAll.includes(Pen.DRAW_ROUGH_ELLIPSE) ||
        penbarAll.includes(Pen.DRAW_ROUGH_LINE) ||
        penbarAll.includes(Pen.DRAW_ICONFONT),
        () => html`
              <overlay-trigger placement="right">
                <sp-action-button
                  value=${this.lastDrawPen}
                  hold-affordance
                  slot="trigger"
                >
                  ${when(
          this.lastDrawPen === Pen.DRAW_RECT,
          () =>
            html`<sp-icon-rectangle slot="icon"></sp-icon-rectangle>`,
        )}
                  ${when(
          this.lastDrawPen === Pen.DRAW_TRIANGLE,
          () => html`<sp-icon-triangle slot="icon"></sp-icon-triangle>`,
        )}
                  ${when(
          this.lastDrawPen === Pen.DRAW_PENTAGON,
          () => html`<sp-icon-pentagon slot="icon"></sp-icon-pentagon>`,
        )}
                  ${when(
          this.lastDrawPen === Pen.DRAW_HEXAGON,
          () => html`<sp-icon-polygon slot="icon"></sp-icon-polygon>`,
        )}
                  ${when(
          this.lastDrawPen === Pen.DRAW_ELLIPSE,
          () => html`<sp-icon-ellipse slot="icon"></sp-icon-ellipse>`,
        )}
                  ${when(
          this.lastDrawPen === Pen.DRAW_LINE,
          () => html`<sp-icon-line slot="icon"></sp-icon-line>`,
        )}
                  ${when(
          this.lastDrawPen === Pen.DRAW_ROUGH_RECT,
          () =>
            html`<sp-icon-rect-select
                        slot="icon"
                      ></sp-icon-rect-select>`,
        )}
                  ${when(
          this.lastDrawPen === Pen.DRAW_ROUGH_ELLIPSE,
          () => html`<sp-icon-ellipse slot="icon"></sp-icon-ellipse>`,
        )}
                  ${when(
          this.lastDrawPen === Pen.DRAW_ROUGH_LINE,
          () => html`<sp-icon-line slot="icon"></sp-icon-line>`,
        )}
                  ${when(
          this.lastDrawPen === Pen.DRAW_ICONFONT,
          () => html`<sp-icon-asterisk slot="icon"></sp-icon-asterisk>`,
        )}
                </sp-action-button>
                <sp-popover
                  slot="hover-content"
                  style="padding: 8px; min-width: min(100vw - 32px, 360px); max-width: min(100vw - 32px, 420px); box-sizing: border-box;"
                >
                  <ic-spectrum-penbar-draw-settings
                    .pen=${this.lastDrawPen}
                  ></ic-spectrum-penbar-draw-settings>
                </sp-popover>
                <sp-popover slot="click-content">
                  <sp-menu
                    @change=${this.handlePenChanged}
                    selects="single"
                    .selected=${[penbarSelected]}
                  >
                    ${when(
          penbarAll.includes(Pen.DRAW_RECT),
          () => html` <sp-menu-item value="${Pen.DRAW_RECT}">
                        <sp-icon-rectangle slot="icon"></sp-icon-rectangle>
                        ${msg(str`Rectangle`)}
                        <kbd slot="value">R</kbd>
                      </sp-menu-item>`,
        )}
                    ${when(
          penbarAll.includes(Pen.DRAW_TRIANGLE),
          () => html` <sp-menu-item value="${Pen.DRAW_TRIANGLE}">
                        <sp-icon-triangle slot="icon"></sp-icon-triangle>
                        ${msg(str`Triangle`)}
                        <kbd slot="value">T</kbd>
                      </sp-menu-item>`,
        )}
                    ${when(
          penbarAll.includes(Pen.DRAW_PENTAGON),
          () => html` <sp-menu-item value="${Pen.DRAW_PENTAGON}">
                        <sp-icon-pentagon slot="icon"></sp-icon-pentagon>
                        ${msg(str`Pentagon`)}
                        <kbd slot="value">5</kbd>
                      </sp-menu-item>`,
        )}
                    ${when(
          penbarAll.includes(Pen.DRAW_HEXAGON),
          () => html` <sp-menu-item value="${Pen.DRAW_HEXAGON}">
                        <sp-icon-polygon slot="icon"></sp-icon-polygon>
                        ${msg(str`Hexagon`)}
                        <kbd slot="value">6</kbd>
                      </sp-menu-item>`,
        )}
                    ${when(
          penbarAll.includes(Pen.DRAW_ELLIPSE),
          () => html` <sp-menu-item value="${Pen.DRAW_ELLIPSE}">
                        <sp-icon-ellipse slot="icon"></sp-icon-ellipse>
                        ${msg(str`Ellipse`)}
                        <kbd slot="value">O</kbd>
                      </sp-menu-item>`,
        )}
                    ${when(
          penbarAll.includes(Pen.DRAW_LINE),
          () => html` <sp-menu-item value="${Pen.DRAW_LINE}">
                        <sp-icon-line slot="icon"></sp-icon-line>
                        ${msg(str`Line`)}
                        <kbd slot="value">L</kbd>
                      </sp-menu-item>`,
        )}
                    ${when(
          penbarAll.includes(Pen.DRAW_ROUGH_RECT),
          () => html` <sp-menu-item value="${Pen.DRAW_ROUGH_RECT}">
                        <sp-icon-rect-select slot="icon"></sp-icon-rect-select>
                        ${msg(str`Rough Rectangle`)}
                      </sp-menu-item>`,
        )}
                    ${when(
          penbarAll.includes(Pen.DRAW_ROUGH_ELLIPSE),
          () => html` <sp-menu-item
                        value="${Pen.DRAW_ROUGH_ELLIPSE}"
                      >
                        <sp-icon-ellipse slot="icon"></sp-icon-ellipse>
                        ${msg(str`Rough Ellipse`)}
                      </sp-menu-item>`,
        )}
                    ${when(
          penbarAll.includes(Pen.DRAW_ROUGH_LINE),
          () => html` <sp-menu-item value="${Pen.DRAW_ROUGH_LINE}">
                        <sp-icon-line slot="icon"></sp-icon-line>
                        ${msg(str`Rough Line`)}
                      </sp-menu-item>`,
        )}
                      ${when(
          penbarAll.includes(Pen.DRAW_ICONFONT),
          () => html` <sp-menu-item value="${Pen.DRAW_ICONFONT}">
                        <sp-icon-asterisk slot="icon"></sp-icon-asterisk>
                        ${msg(str`Iconfont`)}
                      </sp-menu-item>`,
        )}
                  </sp-menu>
                </sp-popover>
              </overlay-trigger>
            `,
      )}
          ${when(
        penbarAll.includes(Pen.DRAW_ARROW),
        () => html`
              <overlay-trigger placement="right">
                <sp-action-button value="${Pen.DRAW_ARROW}" slot="trigger">
                  <sp-icon-arrow-up-right
                    slot="icon"
                  ></sp-icon-arrow-up-right>
                  <sp-tooltip self-managed placement="right">
                    ${msg(str`Arrow (⇧L)`)}
                  </sp-tooltip>
                </sp-action-button>
                <sp-popover slot="hover-content" style="padding: 8px;">
                  <ic-spectrum-penbar-draw-settings
                    .pen=${Pen.DRAW_ARROW}
                  ></ic-spectrum-penbar-draw-settings>
                </sp-popover>
              </overlay-trigger>
            `,
      )}
          ${when(
        penbarAll.includes(Pen.IMAGE),
        () => html`
              <sp-action-button value="${Pen.IMAGE}">
                <sp-icon-image slot="icon"></sp-icon-image>
                <sp-tooltip self-managed placement="right">
                  ${msg(str`Image`)}
                </sp-tooltip>
              </sp-action-button>
            `,
      )}
          ${when(
        penbarAll.includes(Pen.TEXT),
        () => html`
              <overlay-trigger placement="right">
                <sp-action-button value="${Pen.TEXT}" slot="trigger">
                  <sp-icon-text slot="icon"></sp-icon-text>
                  <sp-tooltip self-managed placement="right">
                    ${msg(str`Text`)}
                  </sp-tooltip>
                </sp-action-button>
                <sp-popover slot="hover-content" style="padding: 8px;">
                  <ic-spectrum-penbar-text-settings></ic-spectrum-penbar-text-settings>
                </sp-popover>
              </overlay-trigger>
            `,
      )}
          ${when(
        penbarAll.includes(Pen.PENCIL),
        () => html`
              <overlay-trigger placement="right">
                <sp-action-button value="${Pen.PENCIL}" slot="trigger">
                  <sp-icon-draw slot="icon"></sp-icon-draw>
                  <sp-tooltip self-managed placement="right">
                    ${msg(str`Pencil`)}
                  </sp-tooltip>
                </sp-action-button>
                <sp-popover slot="hover-content" style="padding: 8px;">
                  <ic-spectrum-penbar-pencil-settings></ic-spectrum-penbar-pencil-settings>
                </sp-popover>
              </overlay-trigger>
            `,
      )}
          ${when(
        penbarAll.includes(Pen.VECTOR_NETWORK),
        () => html`
              <sp-action-button value="${Pen.VECTOR_NETWORK}">
                <sp-icon-annotate-pen slot="icon"></sp-icon-annotate-pen>
                <sp-tooltip self-managed placement="right">
                  ${msg(str`Vector pen`)}
                </sp-tooltip>
              </sp-action-button>
            `,
      )}
          ${when(
        penbarAll.includes(Pen.BRUSH),
        () => html`
              <overlay-trigger placement="right">
                <sp-action-button value="${Pen.BRUSH}" slot="trigger">
                  <sp-icon-brush slot="icon"></sp-icon-brush>
                  <sp-tooltip self-managed placement="right">
                    ${msg(str`Brush`)}
                  </sp-tooltip>
                </sp-action-button>
                <sp-popover slot="hover-content" style="padding: 8px;">
                  <ic-spectrum-penbar-brush-settings></ic-spectrum-penbar-brush-settings>
                </sp-popover>
              </overlay-trigger>
            `,
      )}
          <slot name="penbar-item"></slot>
        </sp-action-group>
      `,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-penbar': Penbar;
  }
}
