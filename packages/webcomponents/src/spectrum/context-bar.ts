import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { consume } from '@lit/context';
import {
  AppState,
  Canvas,
  ComputedBounds,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';

const CONTEXT_BAR_HEIGHT = 48;
const CONTEXT_BAR_MARGIN_BOTTOM = 16;

@customElement('ic-spectrum-context-bar')
export class ContextBar extends LitElement {
  static styles = css`
    .wrapper {
      position: absolute;
      top: 0;
      left: 0;
    }

    .bar {
      transform: translateX(-50%);
      position: absolute;
      left: -50%;

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

    sp-popover {
      padding: 0;
    }

    h4 {
      margin: 0;
      padding: 8px;
      padding-bottom: 0;
    }

    ic-spectrum-stroke-content {
      padding: 8px;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const { layersSelected } = this.appState;

    // Canvas is focused
    if (
      document.activeElement !== this.api.element ||
      layersSelected.length === 0
    ) {
      return;
    }

    const selected = this.api.getNodeById(layersSelected[0]);

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.api.updateNodeOBB(selected, { y: selected.y - 10 });
      this.api.record();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.api.updateNodeOBB(selected, { y: selected.y + 10 });
      this.api.record();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.api.updateNodeOBB(selected, { x: selected.x - 10 });
      this.api.record();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.api.updateNodeOBB(selected, { x: selected.x + 10 });
      this.api.record();
    }
  };

  private calculatePosition(node: SerializedNode): [number, number] {
    const { width, height } = this.api.getCanvas().read(Canvas);

    const entity = this.api.getEntity(node);
    if (!entity.has(ComputedBounds)) {
      return [0, 0];
    }

    const { bounds } = entity.read(ComputedBounds);
    const { minX, minY, maxX, maxY } = bounds;
    const tl = this.api.canvas2Viewport({ x: minX, y: minY });
    const br = this.api.canvas2Viewport({ x: maxX, y: maxY });

    return [
      Math.min(width, Math.max(0, tl.x + (br.x - tl.x) / 2)),
      Math.min(
        height,
        Math.max(
          0,
          tl.y + (br.y - tl.y) + CONTEXT_BAR_HEIGHT + CONTEXT_BAR_MARGIN_BOTTOM,
        ),
      ),
    ];
  }

  render() {
    const { layersSelected } = this.appState;
    const node = layersSelected[0] && this.api.getNodeById(layersSelected[0]);
    const isText = node?.type === 'text';

    return html`${when(layersSelected.length > 0, () => {
      const [left, top] = this.calculatePosition(node);

      return html` <div class="wrapper" style="left: ${left}px; top: ${top}px;">
        <div class="bar">
          <ic-spectrum-fill-action-button
            .node=${node}
          ></ic-spectrum-fill-action-button>
          ${when(
            !isText,
            () => html`<ic-spectrum-stroke-action-button
                .node=${node}
              ></ic-spectrum-stroke-action-button>
              <sp-action-button quiet size="m" id="stroke-options">
                <sp-tooltip self-managed placement="bottom">
                  Stroke options
                </sp-tooltip>
                <sp-icon-stroke-width slot="icon"></sp-icon-stroke-width>
              </sp-action-button>
              <sp-overlay
                trigger="stroke-options@click"
                placement="bottom"
                type="auto"
              >
                <sp-popover dialog>
                  <h4>Stroke options</h4>
                  <ic-spectrum-stroke-content
                    .node=${node}
                  ></ic-spectrum-stroke-content>
                </sp-popover>
              </sp-overlay>`,
          )}
        </div>
      </div>`;
    })}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-context-bar': ContextBar;
  }
}
