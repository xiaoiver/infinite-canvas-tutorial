import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { choose } from 'lit/directives/choose.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import {
  SerializedNode,
  ComputedBounds,
  RectSerializedNode,
  PathSerializedNode,
  CircleSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext } from '../context';
import { API } from '../API';
import { consume } from '@lit/context';

const THUMBNAIL_SIZE = 52;
const THUMBNAIL_PADDING = 4;
@customElement('ic-spectrum-layer-thumbnail')
export class LayerThumbnail extends LitElement {
  static styles = css`
    :host {
    }

    svg {
      display: block;
      width: ${THUMBNAIL_SIZE}px;
      height: ${THUMBNAIL_SIZE}px;
      box-sizing: border-box;
      overflow: hidden;
    }

    sp-icon-text {
      display: block;
    }
  `;

  @consume({ context: apiContext, subscribe: true })
  api: API;

  @property()
  node: SerializedNode;

  @property({ type: Boolean })
  selected = false;

  render() {
    const entity = this.api.getEntity(this.node);
    if (!entity.has(ComputedBounds)) {
      return;
    }

    const { minX, minY, maxX, maxY } = entity.read(ComputedBounds).renderBounds;
    const width = maxX - minX;
    const height = maxY - minY;

    const scale = Math.min(
      (THUMBNAIL_SIZE - THUMBNAIL_PADDING * 2) / width,
      (THUMBNAIL_SIZE - THUMBNAIL_PADDING * 2) / height,
    );

    const transform = `translate(${-minX}, ${-minY}) scale(${scale}) translate(${
      (THUMBNAIL_SIZE / scale - width) / 2
    }, ${(THUMBNAIL_SIZE / scale - height) / 2})`;
    const transformOrigin = `${minX + width / 2} ${minY + height / 2}`;

    return html`<sp-thumbnail size="1000" ?focused=${this.selected}>
      ${when(
        this.node.type === 'text',
        () => html`<sp-icon-text></sp-icon-text>`,
        () => html`<svg>
          ${choose(
            this.node.type,
            [
              [
                'circle',
                () => {
                  const { cx, cy, r, fill, stroke, strokeWidth } = this
                    .node as CircleSerializedNode;
                  return unsafeSVG(
                    `<circle cx=${cx} cy=${cy} r=${r} fill=${fill} stroke=${stroke} stroke-width=${strokeWidth} transform="${transform}" transform-origin="${transformOrigin}"/>`,
                  );
                },
              ],
              [
                'rect',
                () => {
                  const {
                    x = 0,
                    y = 0,
                    width,
                    height,
                  } = this.node as RectSerializedNode;
                  return unsafeSVG(
                    `<rect x=${x} y=${y} width=${width} height=${height} fill="red" transform="${transform}" transform-origin="${transformOrigin}"/>`,
                  );
                },
              ],
              [
                'path',
                () => {
                  const { d, fill, stroke, strokeWidth } = this
                    .node as PathSerializedNode;
                  return unsafeSVG(
                    `<path d=${d} fill=${fill} stroke=${stroke} stroke-width=${strokeWidth} transform="${transform}" transform-origin="${transformOrigin}"/>`,
                  );
                },
              ],
            ],
            () => html``,
          )}
        </svg>`,
      )}
    </sp-thumbnail>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layer-thumbnail': LayerThumbnail;
  }
}
