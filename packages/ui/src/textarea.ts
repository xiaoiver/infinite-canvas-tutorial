import { html, css, LitElement } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { canvasContext } from './context';
import type { Canvas } from '@infinite-canvas-tutorial/core';

@customElement('ic-textarea')
export class Textarea extends LitElement {
  static styles = css`
    :host {
      box-shadow: var(--sl-shadow-medium);
      background: white;
    }
  `;

  @query('textarea')
  editable: HTMLTextAreaElement;

  @consume({ context: canvasContext, subscribe: true })
  canvas: Canvas;

  connectedCallback() {
    super.connectedCallback();
  }

  firstUpdated() {
    const editable = this.editable;

    // @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/element/textWysiwyg.tsx#L287C2-L292C48
    editable.dir = 'auto';
    editable.tabIndex = 0;
    editable.dataset.type = 'wysiwyg';
    // prevent line wrapping on Safari
    editable.wrap = 'off';
    editable.classList.add('ic-wysiwyg');

    const whiteSpace = 'pre';
    const wordBreak = 'normal';

    Object.assign(editable.style, {
      position: 'absolute',
      display: 'inline-block',
      minHeight: '1em',
      backfaceVisibility: 'hidden',
      margin: 0,
      padding: 0,
      border: 0,
      outline: 0,
      resize: 'none',
      background: 'transparent',
      overflow: 'hidden',
      // must be specified because in dark mode canvas creates a stacking context
      zIndex: 'var(--zIndex-wysiwyg)',
      wordBreak,
      // prevent line wrapping (`whitespace: nowrap` doesn't work on FF)
      whiteSpace,
      overflowWrap: 'break-word',
      boxSizing: 'content-box',
    });

    // editable.value = element.originalText;
    // updateWysiwygStyle();
  }

  render() {
    return html`<textarea></textarea>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-textarea': Textarea;
  }
}
