import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  AppState,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { Event } from '../event';
import { msg, str } from '@lit/localize';

@customElement('ic-spectrum-penbar-crop')
export class PenbarCrop extends LitElement {
  static styles = css`
    .wrapper {
      transform: translateX(-50%);
      position: absolute;
      left: -50%;
      bottom: 8px;

      display: flex;
      gap: var(--spectrum-global-dimension-size-100);
      align-items: center;

      background: var(--spectrum-gray-100);
      border-radius: var(--spectrum-corner-radius-200);

      padding: var(--spectrum-global-dimension-size-100);
      padding-top: 0;
      padding-bottom: 0;
      margin: 4px;

      filter: drop-shadow(
        var(--spectrum-drop-shadow-color) 0px var(--spectrum-drop-shadow-y)
          var(--spectrum-drop-shadow-blur)
      );
    }

    .buttons {
      display: flex;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @state()
  private cropRatio = 2;

  get clipNode() {
    const { layersCropping } = this.appState;
    const [croppingNodeId] = layersCropping;
    const node = this.api.getNodeById(croppingNodeId);
    return node;
  }

  get clipChildNode() {
    const node = this.clipNode;
    if (node) {
      return this.api.getNodeByEntity(this.api.getChildren(node)[0]);
    }
    return null;
  }

  private handleApply() {
    this.api.applyCrop();
  }

  private handleCancel() {
    this.api.cancelCrop();
  }

  private handleClipAspectChanged(event: CustomEvent) {
    const value = (event.target as any).value;
    if (value === 'original') {
      const { x: px, y: py } = this.clipNode;
      const { x: cx, y: cy, width: cw, height: ch } = this.clipChildNode;
      // Make clip the same size of the original image
      this.api.updateNode(this.clipNode, {
        x: px + cx,
        y: py + cy,
        width: cw,
        height: ch,
      });
      this.api.updateNode(this.clipChildNode, {
        x: 0,
        y: 0,
      });
    } else if (value === 'square') {
      // 1:1: Use the smaller dimension of the child element as the side length, crop from center
      const { x: px, y: py } = this.clipNode;
      const { x: cx, y: cy, width: cw, height: ch } = this.clipChildNode;
      const side = Math.min(cw, ch);
      const offsetX = (cw - side) / 2;
      const offsetY = (ch - side) / 2;
      this.api.updateNode(this.clipNode, {
        x: px + cx + offsetX,
        y: py + cy + offsetY,
        width: side,
        height: side,
      });
      this.api.updateNode(this.clipChildNode, {
        x: -offsetX,
        y: -offsetY,
      });
    } else if (value.includes(':')) {
      const [w, h] = value.split(':').map(Number);
      const ratio = w / h;
      const { x: px, y: py } = this.clipNode;
      const { x: cx, y: cy, width: cw, height: ch } = this.clipChildNode;
      // Calculate the largest visible rectangle within the child element according to the ratio, centered
      const clipW = Math.min(cw, ratio * ch);
      const clipH = clipW / ratio;
      const offsetX = (cw - clipW) / 2;
      const offsetY = (ch - clipH) / 2;
      this.api.updateNode(this.clipNode, {
        x: px + cx + offsetX,
        y: py + cy + offsetY,
        width: clipW,
        height: clipH,
      });
      this.api.updateNode(this.clipChildNode, {
        x: -offsetX,
        y: -offsetY,
      });
    }
  }

  private handleCropRatioChanged(e: Event & { target: HTMLInputElement }) {
    const value = e.target.value;
    this.cropRatio = parseFloat(value);

    if (this.clipChildNode) {
      const child = this.clipChildNode;
      const width = this.originalClipWidth * this.cropRatio;
      const height = this.originalClipHeight * this.cropRatio;
      // Scale around the geometric center recorded when entering crop mode
      const x = this.originalCenterX - width / 2;
      const y = this.originalCenterY - height / 2;
      this.api.updateNode(child, {
        x,
        y,
        width,
        height,
      });
      this.api.record();
    }
  }

  shouldUpdate(changedProperties: PropertyValues) {
    const newLayersCropping = this.appState.layersCropping;
    if (newLayersCropping.length !== this.previousLayersCropping.length) {
      this.previousLayersCropping = newLayersCropping;

      if (this.clipChildNode) {
        const child = this.clipChildNode;
        this.cropRatio = child.width / this.clipNode.width;
        this.originalClipWidth = this.clipNode.width;
        this.originalClipHeight = this.clipNode.height;
        // Record the geometric center when entering crop mode (in clip coordinates), scale around this center when ratio changes
        this.originalCenterX = child.x + child.width / 2;
        this.originalCenterY = child.y + child.height / 2;
      }
      return true;
    }

    return super.shouldUpdate(changedProperties);
  }

  private previousLayersCropping: string[] = [];
  private originalClipWidth = 0;
  private originalClipHeight = 0;
  /** Geometric center of the child node in clip coordinates when entering crop mode, scale around this point when ratio changes */
  private originalCenterX = 0;
  private originalCenterY = 0;

  render() {
    const { layersCropping } = this.appState;

    if (layersCropping.length === 1) {
      return html`
      <div class="wrapper">
      ${msg(str`Crop`)}
      <sp-divider
        size="s"
        style="align-self: stretch; height: auto;"
        vertical
      ></sp-divider>
      <sp-slider
        size="s"
        quiet
        value=${this.cropRatio}
        min=${1}
        max=${4}
        step=${0.2}
        labelVisibility="none"
        @input=${this.handleCropRatioChanged}
      ></sp-slider>
      <sp-divider
        size="s"
        style="align-self: stretch; height: auto;"
        vertical
      ></sp-divider>
      <sp-action-menu size="s" label=${msg(str`Clip Aspect`)} @change=${this.handleClipAspectChanged}>
        <sp-icon-crop slot="icon"></sp-icon-crop>
        <sp-menu-item value="original">
          ${msg(str`Original`)}
        </sp-menu-item>
        <sp-menu-item value="square">
          ${msg(str`Square`)}
        </sp-menu-item>
        <sp-menu-item>
          ${msg(str`Landscape`)}
          <sp-menu slot="submenu" @change=${this.handleClipAspectChanged}>
            <sp-menu-item
              value="16:9"
            >16:9</sp-menu-item>
            <sp-menu-item
              value="4:3"
            >4:3</sp-menu-item>
            <sp-menu-item
              value="3:2"
            >3:2</sp-menu-item>
          </sp-menu>
        </sp-menu-item>
        <sp-menu-item>
          ${msg(str`Portrait`)}
          <sp-menu slot="submenu" @change=${this.handleClipAspectChanged}>
            <sp-menu-item
              value="9:16"
            >9:16</sp-menu-item>
            <sp-menu-item
              value="3:4"
            >3:4</sp-menu-item>
            <sp-menu-item
              value="2:3"
            >2:3</sp-menu-item>
          </sp-menu>
        </sp-menu-item>
      </sp-action-menu>
      <div class="buttons">
        <sp-action-button quiet size="s" @click=${this.handleCancel}>
          <sp-icon-cancel slot="icon"></sp-icon-cancel>
        </sp-action-button>
        <sp-action-button quiet size="s" @click=${this.handleApply}>
          <sp-icon-checkmark slot="icon"></sp-icon-checkmark>
        </sp-action-button>
      </div>
      </div>
      `;
    }
  }
}