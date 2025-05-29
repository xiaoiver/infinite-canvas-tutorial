import {
  isGradient,
  exportFillGradientOrPattern,
  SerializedNode,
  createSVGElement,
  isPattern,
} from '@infinite-canvas-tutorial/ecs';
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { when } from 'lit/directives/when.js';

@customElement('ic-spectrum-fill-icon')
export class FillIcon extends LitElement {
  @property()
  node: SerializedNode;

  @property()
  value: string;

  render() {
    const $circle = createSVGElement('circle') as SVGCircleElement;
    $circle.setAttribute('cx', '50');
    $circle.setAttribute('cy', '50');
    $circle.setAttribute('r', '48');
    $circle.setAttribute('fill', this.value);
    $circle.classList.add('picker');

    const isGradientOrPattern = isGradient(this.value) || isPattern(this.value);
    let defsHTML = '';
    if (isGradientOrPattern) {
      const $g = createSVGElement('g') as SVGElement;
      exportFillGradientOrPattern(
        {
          ...this.node,
          type: 'ellipse',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        } as SerializedNode,
        $circle,
        $g,
      );
      defsHTML = $g.children[0].innerHTML;
    }

    return html`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
      >
        <defs>
          <style>
            .picker {
              stroke: var(--spectrum-gray-800);
              stroke-width: var(--spectrum-border-width-100);
            }
          </style>
          ${when(isGradientOrPattern, () => unsafeSVG(defsHTML))}
        </defs>
        ${unsafeSVG($circle.outerHTML)}
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-fill-icon': FillIcon;
  }
}
