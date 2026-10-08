import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { AppState, type SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext, nodesContext } from '../context';
import { ExtendedAPI } from '../API';
import { live } from 'lit/directives/live.js';
import { CropSession, type CropCommand } from './crop-command';
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

  private appStateValue: AppState;
  private apiValue: ExtendedAPI;
  private nodesValue: SerializedNode[];
  private session?: CropSession;

  @consume({ context: appStateContext, subscribe: true })
  get appState() {
    return this.appStateValue;
  }
  set appState(value: AppState) {
    this.appStateValue = value;
    // Invalidate synchronously, including exit/re-entry in one ECS frame.
    if (this.session && !this.session.resolve()) this.releaseSession();
    this.requestUpdate();
  }

  @consume({ context: apiContext, subscribe: true })
  get api() {
    return this.apiValue;
  }
  set api(value: ExtendedAPI) {
    if (value === this.apiValue) return;
    this.releaseSession();
    this.apiValue = value;
    this.requestUpdate();
  }

  @consume({ context: nodesContext, subscribe: true })
  get nodes() {
    return this.nodesValue;
  }
  set nodes(value: SerializedNode[]) {
    this.nodesValue = value;
    if (this.session && !this.session.resolve()) this.releaseSession();
    this.requestUpdate();
  }

  @state()
  private cropRatio = 1;

  get clipNode() {
    return this.session?.resolve()?.clip;
  }
  get clipChildNode() {
    return this.session?.resolve()?.children[0];
  }

  private releaseSession() {
    this.session?.dispose();
    this.session = undefined;
  }

  private syncSession() {
    if (!this.isConnected || !this.api) return;
    if (this.session && !this.session.resolve()) this.releaseSession();
    if (!this.session) {
      const session = new CropSession(this.api);
      if (session.resolve()) this.session = session;
      else session.dispose();
    }
    this.cropRatio = this.session?.ratio ?? 1;
  }

  protected willUpdate() {
    this.syncSession();
  }

  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.releaseSession();
  }

  private async submit(event: Event, command: CropCommand) {
    event.stopPropagation();
    const control = event.currentTarget as HTMLElement;
    if (
      !this.isConnected ||
      !control?.isConnected ||
      !this.renderRoot.contains(control)
    )
      return;
    this.syncSession();
    const session = this.session;
    if (!session) return;
    await session.edit(command);
    if (this.session === session && this.isConnected) {
      this.cropRatio = session.ratio;
      this.requestUpdate();
    }
  }

  private handleApply(event: Event) {
    void this.submit(event, { kind: 'apply' });
  }
  private handleCancel(event: Event) {
    void this.submit(event, { kind: 'cancel' });
  }

  private handleClipAspectChanged(event: Event) {
    const value = (event.currentTarget as HTMLElement & { value: string })
      .value;
    void this.submit(event, { kind: 'aspect', value });
  }

  private handleCropRatioChanged(event: Event) {
    const value = (event.currentTarget as HTMLElement & { value: number })
      .value;
    void this.submit(event, { kind: 'scale', value });
  }

  render() {
    if (this.session?.resolve()) {
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
            .value=${live(this.cropRatio)}
            label=${msg(str`Image scale`)}
            ?disabled=${!this.session.geometry}
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
          <sp-action-menu
            size="s"
            ?disabled=${!this.session.geometry}
            label=${msg(str`Clip Aspect`)}
            @change=${this.handleClipAspectChanged}
          >
            <sp-icon-crop slot="icon"></sp-icon-crop>
            <sp-menu-item value="original">
              ${msg(str`Original`)}
            </sp-menu-item>
            <sp-menu-item value="square"> ${msg(str`Square`)} </sp-menu-item>
            <sp-menu-item>
              ${msg(str`Landscape`)}
              <sp-menu slot="submenu" @change=${this.handleClipAspectChanged}>
                <sp-menu-item value="16:9">16:9</sp-menu-item>
                <sp-menu-item value="4:3">4:3</sp-menu-item>
                <sp-menu-item value="3:2">3:2</sp-menu-item>
              </sp-menu>
            </sp-menu-item>
            <sp-menu-item>
              ${msg(str`Portrait`)}
              <sp-menu slot="submenu" @change=${this.handleClipAspectChanged}>
                <sp-menu-item value="9:16">9:16</sp-menu-item>
                <sp-menu-item value="3:4">3:4</sp-menu-item>
                <sp-menu-item value="2:3">2:3</sp-menu-item>
              </sp-menu>
            </sp-menu-item>
          </sp-action-menu>
          <div class="buttons">
            <sp-action-button
              quiet
              size="s"
              aria-label=${msg(str`Exit crop`)}
              @click=${this.handleCancel}
            >
              <sp-icon-cancel slot="icon"></sp-icon-cancel>
            </sp-action-button>
            <sp-action-button
              quiet
              size="s"
              aria-label=${msg(str`Apply crop`)}
              @click=${this.handleApply}
            >
              <sp-icon-checkmark slot="icon"></sp-icon-checkmark>
            </sp-action-button>
          </div>
        </div>
      `;
    }
  }
}
