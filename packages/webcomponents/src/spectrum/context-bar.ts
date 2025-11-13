import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { consume } from '@lit/context';
import {
  AppState,
  Canvas,
  ComputedBounds,
  TransformableStatus,
  SerializedNode,
  isDataUrl,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { TOP_NAVBAR_HEIGHT } from './infinite-canvas';
import { Event } from '../event';

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
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  private binded = false;

  private calculatePosition(node: SerializedNode): [number, number] {
    if (!node) {
      return [0, 0];
    }

    const { width, height } = this.api.getCanvas().read(Canvas);
    const { topbarVisible } = this.appState;

    const entity = this.api.getEntity(node);
    if (!entity.has(ComputedBounds)) {
      return [0, 0];
    }

    const { renderWorldBounds } = entity.read(ComputedBounds);
    const { minX, minY, maxX, maxY } = renderWorldBounds;
    const tl = this.api.canvas2Viewport({ x: minX, y: minY });
    const br = this.api.canvas2Viewport({ x: maxX, y: maxY });

    return [
      Math.min(width, Math.max(0, tl.x + (br.x - tl.x) / 2)),
      Math.min(
        height,
        Math.max(
          0,
          tl.y +
            (br.y - tl.y) +
            (topbarVisible ? TOP_NAVBAR_HEIGHT : 0) +
            CONTEXT_BAR_MARGIN_BOTTOM,
        ),
      ),
    ];
  }

  private handleTransformableStatusChanged = (
    event: CustomEvent<{
      status: TransformableStatus;
    }>,
  ) => {
    const { status } = event.detail;
    if (
      status === TransformableStatus.MOVING ||
      status === TransformableStatus.RESIZING ||
      status === TransformableStatus.ROTATING
    ) {
      this.style.display = 'none';
    } else {
      this.style.display = 'block';
    }
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    this.api?.element?.removeEventListener(
      Event.TRANSFORMABLE_STATUS_CHANGED,
      this.handleTransformableStatusChanged,
    );
  }

  render() {
    // FIXME: wait for the element to be ready.
    if (this.api?.element && !this.binded) {
      this.api.element.addEventListener(
        Event.TRANSFORMABLE_STATUS_CHANGED,
        this.handleTransformableStatusChanged,
      );
    }

    const { layersSelected, contextBarVisible } = this.appState;

    return html`${when(contextBarVisible && layersSelected.length > 0, () => {
      // Only single selection need context bar for now.
      if (layersSelected.length === 1) {
        const node =
          layersSelected[0] && this.api.getNodeById(layersSelected[0]);

        const isImage =
          node.type === 'rect' &&
          (node.fill.endsWith('.jpg') ||
            node.fill.endsWith('.jpeg') ||
            node.fill.endsWith('.png') ||
            isDataUrl(node.fill));

        const isHTML = node.type === 'html';
        const isEmbed = node.type === 'embed';
        if (isHTML || isEmbed) {
          return html``;
        }

        const [left, top] = this.calculatePosition(node);

        return html`<div
          class="wrapper"
          style="left: ${left}px; top: ${top}px;"
        >
          <div class="bar">
            ${when(
              isImage,
              () => html`<ic-spectrum-context-image-edit-bar .node=${node} />`,
              () => html`<ic-spectrum-context-common-bar .node=${node} />`,
            )}
          </div>
        </div>`;
      } else {
        // Image edit bar
        // if (layersSelected.some(id => this.api.getNodeById(id)?.type === 'image')) {

        return html``;
      }
    })}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-context-bar': ContextBar;
  }
}
