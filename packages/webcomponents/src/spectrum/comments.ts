import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { consume } from '@lit/context';
import { AppState } from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';

interface Comment {
  type: 'comment';
  threadId: string;
  id: string;
  roomId: string;
  userId: string;
  createdAt: Date;
  editedAt: Date;
  text: string;
}

interface Thread {
  type: 'thread';
  id: string;
  roomId: string;
  createdAt: Date;
  comments: Comment[];
  metadata: {
    x: number;
    y: number;
  };
}

@customElement('ic-spectrum-comments')
export class Comments extends LitElement {
  static styles = css`
    :host {
      position: absolute;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  binded = false;

  /**
   * @see https://liveblocks.io/docs/ready-made-features/comments/concepts#Threads
   */
  threads: Thread[] = [];

  handleCommentAdded = (e: CustomEvent) => {
    const { canvasX, canvasY } = e.detail;

    this.threads.push({
      type: 'thread',
      id: '1',
      roomId: 'my-room-id',
      createdAt: new Date(),
      comments: [
        {
          type: 'comment',
          threadId: '1',
          id: '1',
          roomId: 'my-room-id',
          userId: 'alicia@example.com',
          createdAt: new Date(),
          editedAt: new Date(),
          text: 'Hello, world!',
        },
      ],
      metadata: {
        x: canvasX,
        y: canvasY,
      },
    });
  };

  render() {
    if (this.api?.element && !this.binded) {
      this.api?.element?.addEventListener(
        Event.COMMENT_ADDED,
        this.handleCommentAdded,
      );
      this.binded = true;
    }

    const viewportPositions = this.threads.map(({ metadata }) => {
      const { x, y } = metadata;
      return this.api.canvas2Viewport({ x, y });
    });

    return html`
      ${this.threads.map(
        (thread, i) => html`
          <ic-spectrum-thread
            x=${viewportPositions[i].x}
            y=${viewportPositions[i].y}
          ></ic-spectrum-thread>
        `,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-comments': Comments;
  }
}
