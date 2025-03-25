import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { query } from 'lit/decorators/query.js';
import { when } from 'lit/directives/when.js';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';

import '@spectrum-web-components/thumbnail/sp-thumbnail.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-text.js';

@customElement('ic-spectrum-layer-thumbnail')
export class LayerThumbnail extends LitElement {
  static styles = css`
    :host {
    }

    canvas {
      display: block;
      width: 52px;
      height: 52px;
      border: var(--spectrum-border-width-200) solid var(--spectrum-gray-50);
      border-radius: var(--spectrum-corner-radius-300);
      box-sizing: border-box;
      overflow: hidden;
    }

    sp-icon-text {
      display: block;
    }
  `;

  @property()
  node: SerializedNode;

  @query('canvas')
  canvas: HTMLCanvasElement;

  firstUpdated() {
    const { type, attributes } = this.node;
    if (type === 'text') {
      return;
    }

    this.canvas.width = 52 * window.devicePixelRatio;
    this.canvas.height = 52 * window.devicePixelRatio;

    const context = this.canvas?.getContext('2d');

    context.scale(0.2, 0.2);

    if (type === 'rect') {
      const { x, y, width, height, fill, stroke, strokeWidth } = attributes;

      context.fillStyle = fill;
      context.fillRect(x, y, width, height);

      context.strokeStyle = stroke;
      context.lineWidth = strokeWidth;
      context.strokeRect(x, y, width, height);
    } else if (type === 'circle') {
      const { cx, cy, r, fill, stroke, strokeWidth } = attributes;

      context.fillStyle = fill;
      context.beginPath();
      context.arc(cx, cy, r, 0, 2 * Math.PI);
      context.fill();

      context.strokeStyle = stroke;
      context.lineWidth = strokeWidth;
      context.stroke();
    } else if (type === 'ellipse') {
      const { cx, cy, rx, ry, fill, stroke, strokeWidth } = attributes;

      context.fillStyle = fill;
      context.beginPath();
      context.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      context.fill();

      context.strokeStyle = stroke;
      context.lineWidth = strokeWidth;
      context.stroke();
    } else if (type === 'path') {
      const { d, fill, stroke, strokeWidth } = attributes;

      context.fillStyle = fill;
      context.fill(new Path2D(d));

      context.strokeStyle = stroke;
      context.lineWidth = strokeWidth;
      context.stroke(new Path2D(d));
    }
  }

  render() {
    return html`<sp-thumbnail size="1000">
      ${when(
        this.node.type === 'text',
        () => html`<sp-icon-text></sp-icon-text>`,
        () => html`<canvas></canvas>`,
      )}
    </sp-thumbnail>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layer-thumbnail': LayerThumbnail;
  }
}
