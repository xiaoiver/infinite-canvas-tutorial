import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
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
  exportMarker,
  LineSerializedNode,
  IconFontSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { consume } from '@lit/context';
import rough from 'roughjs';
import { RoughSVG } from 'roughjs/bin/svg';
import { apiContext } from '../context';
import 'iconify-icon';

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

    sp-icon-text, sp-icon-code, sp-icon-crop, sp-icon-group {
      display: block;
    }

    iconify-icon {
      display: inline-block;
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: currentColor;
    }
  `;

  @consume({ context: apiContext, subscribe: true })
  api: API;

  @property()
  node: SerializedNode;

  @property({ type: Boolean })
  selected = false;

  #roughSvg: RoughSVG;

  /** 缓存图片 fill 的 defs HTML，因为 exportFillImage 是异步的 */
  #imageDefsCache = new Map<string, string>();

  connectedCallback(): void {
    super.connectedCallback();

    this.#roughSvg = rough.svg(createSVGElement('svg') as SVGSVGElement);
  }

  #normalizeIconifyName(node: IconFontSerializedNode): string | null {
    const rawName = node.iconFontName?.toString().trim();
    if (!rawName) {
      return null;
    }

    if (rawName.includes(':')) {
      return rawName;
    }

    const family = (node.iconFontFamily?.toString().trim() || 'lucide').toLowerCase();
    const normalizedName = rawName
      .replace(/Icon$/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .toLowerCase();

    return `${family}:${normalizedName}`;
  }

  render() {
    const entity = this.api.getEntity(this.node);
    if (!entity.has(ComputedBounds)) {
      return html`<sp-thumbnail size="1000" ?focused=${this.selected}>
        <sp-icon-group></sp-icon-group>
      </sp-thumbnail>`;
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
    } else if (type === 'line') {
      $el = createSVGElement('line') as SVGElement;
      $el.setAttribute('x1', `${(this.node as LineSerializedNode).x1}`);
      $el.setAttribute('y1', `${(this.node as LineSerializedNode).y1}`);
      $el.setAttribute('x2', `${(this.node as LineSerializedNode).x2}`);
      $el.setAttribute('y2', `${(this.node as LineSerializedNode).y2}`);
    } else if (type === 'rough-rect') {
      const options = getRoughOptions(this.node);
      $el = this.#roughSvg.rectangle(minX, minY, width, height, {
        ...options,
      });
    } else if (type === 'rough-ellipse') {
      const options = getRoughOptions(this.node);
      $el = this.#roughSvg.ellipse(
        minX + width / 2,
        minY + height / 2,
        width,
        height,
        {
          ...options,
        },
      );
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
      const cacheKey = `${this.node.id}:${fill}`;
      const cached = this.#imageDefsCache.get(cacheKey);
      if (cached !== undefined) {
        defsHTML = cached;
        $el.setAttribute('fill', `url(#image-fill_${this.node.id})`);
      } else {
        const $g = createSVGElement('g') as SVGElement;
        exportFillImage(this.node, $el, $g).then(() => {
          const html = $g.children[0]?.innerHTML ?? '';
          this.#imageDefsCache.set(cacheKey, html);
          this.requestUpdate();
        });
        defsHTML = '';
      }
    } else if (markerStart || markerEnd) {
      const $g = createSVGElement('g') as SVGElement;
      exportMarker(this.node, $el, $g);
      defsHTML = $g.children[0].innerHTML;
    }

    const padding = Math.max(width, height) * THUMBNAIL_PADDING_RATIO;
    const paddedWidth = width + padding * 2;
    const paddedHeight = height + padding * 2;

    let thumbnail;
    if (this.node.type === 'text') {
      thumbnail = html`<sp-icon-text></sp-icon-text>`;
    } else if (this.node.type === 'iconfont') {
      const iconName = this.#normalizeIconifyName(this.node as IconFontSerializedNode);
      thumbnail = iconName
        ? html`<iconify-icon icon=${iconName}></iconify-icon>`
        : html`<sp-icon-group></sp-icon-group>`;
    } else if (this.node.type === 'embed' || this.node.type === 'html') {
      thumbnail = html`<sp-icon-code></sp-icon-code>`;
    } else if (this.node.type === 'brush') {
      thumbnail = html`<img src="${this.node.brushStamp}" />`;
    } else if (this.node.clipMode) {
      thumbnail = html`<sp-icon-crop></sp-icon-crop>`;
    } else {
      thumbnail = $el && html`<svg
        viewBox="${-paddedWidth / 2} ${-paddedHeight /
        2} ${paddedWidth} ${paddedHeight}"
      >
        ${unsafeSVG(defsHTML)} ${unsafeSVG($el.outerHTML)}
      </svg>`;
    }

    return html`<sp-thumbnail size="1000" ?focused=${this.selected}>
      ${thumbnail}
    </sp-thumbnail>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-layer-thumbnail': LayerThumbnail;
  }
}
