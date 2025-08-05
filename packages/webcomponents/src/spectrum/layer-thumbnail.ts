import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import {
  SerializedNode,
  ComputedBounds,
  PathSerializedNode,
  exportFillGradientOrPattern,
  exportFillImage,
  isGradient,
  isPattern,
  isDataUrl,
  isUrl,
  createSVGElement,
  PolylineSerializedNode,
  API,
  getRoughOptions,
} from '@infinite-canvas-tutorial/ecs';
import { consume } from '@lit/context';
import rough from 'roughjs';
import { RoughSVG } from 'roughjs/bin/svg';
import { apiContext } from '../context';

const THUMBNAIL_SIZE = 52;
const THUMBNAIL_PADDING_RATIO = 0.1;
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

  #roughSvg: RoughSVG;

  connectedCallback(): void {
    super.connectedCallback();

    this.#roughSvg = rough.svg(createSVGElement('svg') as SVGSVGElement);
  }

  render() {
    const entity = this.api.getEntity(this.node);
    if (!entity.has(ComputedBounds)) {
      return;
    }

    const { minX, minY, maxX, maxY } = entity.read(ComputedBounds).renderBounds;
    const width = maxX - minX;
    const height = maxY - minY;

    const transform = `translate(${-minX - width / 2}, ${-minY - height / 2})`;

    let $el: SVGElement;

    const { type } = this.node;
    if (type === 'ellipse') {
      $el = createSVGElement('ellipse') as SVGElement;
      $el.setAttribute('cx', `${minX + width / 2}`);
      $el.setAttribute('cy', `${minY + height / 2}`);
      $el.setAttribute('rx', `${width / 2}`);
      $el.setAttribute('ry', `${height / 2}`);
    } else if (type === 'rect') {
      $el = createSVGElement('rect') as SVGElement;
      $el.setAttribute('x', `${minX}`);
      $el.setAttribute('y', `${minY}`);
      $el.setAttribute('width', `${width}`);
      $el.setAttribute('height', `${height}`);
    } else if (type === 'path') {
      $el = createSVGElement('path') as SVGElement;
      $el.setAttribute('d', (this.node as PathSerializedNode).d);
    } else if (type === 'polyline') {
      $el = createSVGElement('polyline') as SVGElement;
      $el.setAttribute('points', (this.node as PolylineSerializedNode).points);
      $el.setAttribute('fill', 'none');
    } else if (type === 'rough-rect') {
      const options = getRoughOptions(this.api.getEntity(this.node));
      $el = this.#roughSvg.rectangle(minX, minY, width, height, {
        ...options,
      });
    }

    const {
      fill,
      fillOpacity,
      stroke,
      strokeOpacity,
      strokeWidth,
      strokeLinecap,
      strokeLinejoin,
      strokeMiterlimit,
      strokeDasharray,
      strokeDashoffset,
      opacity,
      markerStart,
      markerEnd,
    } = this.node as PathSerializedNode;

    if ($el) {
      $el.setAttribute('transform', transform);
      if (opacity) {
        $el.setAttribute('opacity', opacity.toString());
      }
      if (fill) {
        $el.setAttribute('fill', fill);
      } else {
        $el.setAttribute('fill', 'none');
      }
      if (fillOpacity) {
        $el.setAttribute('fill-opacity', fillOpacity.toString());
      }
      if (stroke) {
        $el.setAttribute('stroke', stroke);
      }
      if (strokeOpacity) {
        $el.setAttribute('stroke-opacity', strokeOpacity.toString());
      }
      if (strokeWidth) {
        $el.setAttribute('stroke-width', Math.max(strokeWidth, 4).toString());
      }
      if (strokeLinecap) {
        $el.setAttribute('stroke-linecap', strokeLinecap);
      }
      if (strokeLinejoin) {
        $el.setAttribute('stroke-linejoin', strokeLinejoin);
      }
      if (strokeMiterlimit) {
        $el.setAttribute('stroke-miterlimit', strokeMiterlimit.toString());
      }
      if (strokeDasharray) {
        $el.setAttribute('stroke-dasharray', strokeDasharray);
      }
      if (strokeDashoffset) {
        $el.setAttribute('stroke-dashoffset', strokeDashoffset.toString());
      }
    }

    const isGradientOrPattern = isGradient(fill) || isPattern(fill);
    const isImage = isDataUrl(fill) || isUrl(fill);
    let defsHTML = '';
    if (isGradientOrPattern) {
      const $g = createSVGElement('g') as SVGElement;
      exportFillGradientOrPattern(
        {
          ...this.node,
        } as SerializedNode,
        $el,
        $g,
      );
      defsHTML = $g.children[0].innerHTML;
    } else if (isImage) {
      const $g = createSVGElement('g') as SVGElement;
      exportFillImage(this.node, $el, $g);
      defsHTML = $g.children[0].innerHTML;
    }

    const padding = Math.max(width, height) * THUMBNAIL_PADDING_RATIO;
    const paddedWidth = width + padding * 2;
    const paddedHeight = height + padding * 2;

    return html`<sp-thumbnail size="1000" ?focused=${this.selected}>
      ${when(
        this.node.type === 'text',
        () => html`<sp-icon-text></sp-icon-text>`,
        () =>
          $el &&
          html`<svg
            viewBox="${-paddedWidth / 2} ${-paddedHeight /
            2} ${paddedWidth} ${paddedHeight}"
          >
            ${unsafeSVG(defsHTML)} ${unsafeSVG($el.outerHTML)}
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
