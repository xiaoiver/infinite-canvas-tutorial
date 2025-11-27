import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ic-spectrum-thread')
export class Thread extends LitElement {
  static styles = css`
    .thread {
      display: flex;
      position: absolute;
      left: 0px;
      bottom: 0px;
      min-width: 26px;
      align-self: flex-start;
      justify-self: flex-start;
      flex-direction: row;
      max-width: 240px;
      box-sizing: border-box;
      padding: 3px 3px;
      font-size: 11px;
      line-height: 16px;
      color: black;
      background-color: white;
      border-radius: 16px 16px 16px 0px;
      box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);

      user-select: none;
      -webkit-user-select: none;
      overflow: hidden;
      pointer-events: none;
    }

    .avatar {
      display: flex;
      flex-direction: row-reverse;
      justify-content: center;
      align-items: center;
      min-width: 26px;
      min-height: 26px;

      img {
        width: 24px;
        height: 24px;
        border-radius: 100%;
        border: 1px solid var(--color-bg);
        background: linear-gradient(
            136.68deg,
            rgba(0, 0, 0, 0.05) 11.37%,
            rgba(255, 255, 255, 0.039) 82.26%
          ),
          #f0f0f0;
      }
    }
  `;

  @property()
  x: number;

  @property()
  y: number;

  render() {
    return html`
      <div
        class="thread"
        style="position: absolute; left: ${this.x}px; top: ${this.y}px;"
      >
        <div class="avatar">
          <img src="https://ui-avatars.com/api/?name=Alicia" alt="Avatar" />
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-thread': Thread;
  }
}
