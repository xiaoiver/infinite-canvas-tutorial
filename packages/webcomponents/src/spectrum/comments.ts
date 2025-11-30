import { css, html, LitElement, PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { consume } from '@lit/context';
import { AppState } from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';
import { Cluster } from '../utils';

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

  @state()
  clusters: any[] = [];

  binded = false;

  private previousCameraZoom?: number;
  private previousCameraX?: number;
  private previousCameraY?: number;

  cluster = new Cluster({
    maxZoom: 16,
  });

  private updateClusters() {
    if (this.cluster.points?.length > 0) {
      const { cameraZoom } = this.api.getAppState();
      const { minX, minY, maxX, maxY } = this.api.getViewportBounds();

      // Convert [0, 4] to [0, 16]
      this.clusters = this.cluster.getClusters(
        [minX, minY, maxX, maxY],
        cameraZoom * 4,
      );
    }
  }

  shouldUpdate(changedProperties: PropertyValues) {
    // allow updates from internal state/properties
    for (const prop of changedProperties.keys()) {
      if (prop !== 'appState') return true;
    }

    // context update: only allow if cameraZoom changed
    const newZoom = this.appState.cameraZoom;
    if (newZoom !== this.previousCameraZoom) {
      this.previousCameraZoom = newZoom;
      this.updateClusters();
      return true;
    }

    const newX = this.appState.cameraX;
    if (newX !== this.previousCameraX) {
      this.previousCameraX = newX;
      this.updateClusters();
      return true;
    }

    const newY = this.appState.cameraY;
    if (newY !== this.previousCameraY) {
      this.previousCameraY = newY;
      this.updateClusters();
      return true;
    }

    return false;
  }

  handleCommentAdded = (e: CustomEvent) => {
    const { canvasX, canvasY } = e.detail;

    const threadId = `${Date.now()}`;
    const commentId = `${Date.now()}`;

    this.api.setThreads([
      ...this.api.getThreads(),
      {
        type: 'thread',
        id: threadId,
        roomId: 'my-room-id',
        createdAt: new Date(),
        comments: [
          {
            type: 'comment',
            threadId,
            id: commentId,
            roomId: 'my-room-id',
            userId: 'alicia@example.com',
            createdAt: new Date(),
            editedAt: new Date(),
            text: 'Hello, world!',
            avatar: 'https://ui-avatars.com/api/?name=Alicia',
          },
        ],
        metadata: {
          x: canvasX,
          y: canvasY,
        },
      },
    ]);

    this.cluster.load(
      this.api
        .getThreads()
        .map(({ metadata, ...rest }) => ({
          x: metadata.x,
          y: metadata.y,
          ...rest,
        })),
    );

    this.updateClusters();
  };

  render() {
    if (!this.api) {
      return;
    }

    if (this.api.element && !this.binded) {
      this.api.element.addEventListener(
        Event.COMMENT_ADDED,
        this.handleCommentAdded,
      );
      this.binded = true;

      this.cluster.load(
        this.api.getThreads().map(({ metadata, ...rest }) => ({
          x: metadata.x,
          y: metadata.y,
          ...rest,
        })),
      );

      this.updateClusters();
    }

    const viewportPositions = this.clusters.map(({ x, y }) => {
      return this.api.canvas2Viewport({ x, y });
    });

    return html`
      ${this.clusters.map(
        (cluster, i) => html`
          <ic-spectrum-thread
            x=${viewportPositions[i].x}
            y=${viewportPositions[i].y}
            .cluster=${cluster}
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
