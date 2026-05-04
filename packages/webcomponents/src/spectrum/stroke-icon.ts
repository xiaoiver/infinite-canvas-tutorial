import {
  createSVGElement,
  exportFillGradientOrPattern,
  isGradient,
  isPattern,
  resolveDesignVariableValue,
  type AppState,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { when } from 'lit/directives/when.js';
import { appStateContext } from '../context';

@customElement('ic-spectrum-stroke-icon')
export class StrokeIcon extends LitElement {
  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  /** 与 {@link ic-spectrum-fill-icon} 一致：用于渐变/图案 defs 的导出上下文。 */
  @property()
  node: SerializedNode;

  @property()
  value: string;

  render() {
    const variables = this.appState?.variables;
    const resolved = resolveDesignVariableValue(
      this.value,
      variables,
      this.appState?.themeMode,
    );
    const displayValue =
      typeof resolved === 'string' ? resolved : String(resolved ?? 'none');

    const $path = createSVGElement('path') as SVGPathElement;
    $path.setAttribute(
      'd',
      'M 50, 50 m 0, -48 a 48, 48, 0, 1, 0, 1, 0 Z m 0 24 a 24, 24, 0, 1, 1, -1, 0 Z',
    );
    $path.setAttribute('fill', displayValue);
    $path.classList.add('picker');

    const isGradientOrPattern =
      isGradient(displayValue) || isPattern(displayValue);
    let defsHTML = '';
    if (isGradientOrPattern) {
      const base =
        this.node ??
        ({
          type: 'ellipse',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        } as SerializedNode);
      const $g = createSVGElement('g') as SVGElement;
      exportFillGradientOrPattern(
        {
          ...base,
          fill: displayValue,
        } as SerializedNode,
        $path,
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
        ${unsafeSVG($path.outerHTML)}
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-stroke-icon': StrokeIcon;
  }
}
