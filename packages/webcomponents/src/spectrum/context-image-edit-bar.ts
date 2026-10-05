import { v4 as uuidv4 } from 'uuid';
import { consume } from '@lit/context';
import {
  AppState,
  FillAttributes,
  getPrimaryFillValue,
  imageToCanvas,
  RectSerializedNode,
  type Image,
} from '@infinite-canvas-tutorial/ecs';
import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';

enum ImageEditMode {
  IDLE = 'idle',
  POINT_SEGMENT = 'point-segment',
}

interface SmartSelection {
  api: ExtendedAPI;
  nodeId: string;
  imageUrl: string;
  revision: number;
  points?: [number, number][];
  dispose: () => void;
}

@customElement('ic-spectrum-context-image-edit-bar')
export class ContextImageEditBar extends LitElement {
  static styles = css`
    :host {
      display: flex;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property()
  node: RectSerializedNode;

  @state()
  removingBackground: boolean;

  @state()
  encodingImage: boolean;

  @state()
  removingByMask: boolean;

  @state()
  decomposingImage: boolean;

  @state()
  upscalingImage: boolean;

  @state()
  maskCanvas: HTMLCanvasElement;

  @state()
  private mode: ImageEditMode = ImageEditMode.IDLE;

  private smartSelection?: SmartSelection;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.endSmartSelection();
  }

  protected updated() {
    const session = this.smartSelection;
    if (!session) return;
    if (!this.isCurrentSelection(session)) {
      this.endSmartSelection();
      return;
    }

    const points = session.api.getAppState().editingPoints;
    if (
      this.mode === ImageEditMode.POINT_SEGMENT &&
      points !== session.points
    ) {
      session.points = points;
      void this.segmentWithPoints(session, points);
    }
  }

  private isCurrentSelection(session: SmartSelection) {
    if (
      this.smartSelection !== session ||
      !this.isConnected ||
      this.api !== session.api ||
      this.node?.id !== session.nodeId
    )
      return false;
    const node = session.api.getNodeById(session.nodeId);
    const selected = session.api.getAppState().layersSelected;
    return !!(
      node &&
      !node.isDeleted &&
      node.isEditing &&
      session.api.getEntity(node) &&
      selected.length === 1 &&
      selected[0] === session.nodeId &&
      getPrimaryFillValue(node as FillAttributes) === session.imageUrl
    );
  }

  private clearMask() {
    this.maskCanvas?.remove();
    this.maskCanvas = undefined;
  }

  private endSmartSelection() {
    const session = this.smartSelection;
    this.smartSelection = undefined;
    this.mode = ImageEditMode.IDLE;
    this.encodingImage = false;
    this.clearMask();
    session?.dispose();
  }

  private copyMask(source: HTMLCanvasElement) {
    const mask = document.createElement('canvas');
    mask.width = source.width;
    mask.height = source.height;
    mask.getContext('2d')!.drawImage(source, 0, 0);
    return mask;
  }

  private async runImageEdit(
    loading:
      | 'removingBackground'
      | 'decomposingImage'
      | 'upscalingImage'
      | 'removingByMask',
    prepare: (api: ExtendedAPI, imageUrl: string) => Promise<Image[]>,
    isCurrent = () => true,
  ) {
    if (this[loading] || !this.api || !this.node) return;
    this[loading] = true;
    const controller = new AbortController();
    let dispose = () => {};
    try {
      // A toolbar can be reused for another selection while a provider is busy.
      // Own the input and retain the originating canvas throughout preparation.
      const api = this.api;
      const source = structuredClone(this.node);
      const imageUrl = getPrimaryFillValue(source);
      if (!imageUrl) return;
      dispose = api.onDestroy(() => controller.abort());
      if (controller.signal.aborted) return;

      const images = await prepare(api, imageUrl);
      if (controller.signal.aborted || !isCurrent()) return;
      const urls = images
        .map((image) => image.url ?? image.canvas?.toDataURL())
        .filter((url): url is string => !!url);
      if (urls.length === 0) return;

      return await api.edit(
        (editor) => {
          const current = editor.getNodeById(source.id);
          // A late response must not resurrect a deleted or replaced source image.
          if (
            !isCurrent() ||
            !current ||
            current.isDeleted ||
            !editor.getEntity(current) ||
            getPrimaryFillValue(current as FillAttributes) !== imageUrl
          ) {
            // Cancel before mutating, so an empty edit cannot record unrelated
            // transient changes accumulated during image preparation.
            controller.abort();
            return;
          }

          editor.updateNodes(
            urls.map(
              (url, index): RectSerializedNode => ({
                id: uuidv4(),
                type: 'rect',
                fills: [{ type: 'image', value: url, opacity: 1 }],
                lockAspectRatio: true,
                x: (source.x as number) + (source.width as number) + 50,
                y: source.y,
                width: source.width,
                height: source.height,
                zIndex: index,
              }),
            ),
          );
        },
        { signal: controller.signal },
      );
    } catch (error) {
      if (!controller.signal.aborted && isCurrent()) console.error(error);
    } finally {
      dispose();
      this[loading] = false;
    }
  }

  private removeBackground() {
    return this.runImageEdit('removingBackground', async (api, imageUrl) => {
      const { images } = await api.createOrEditImage(
        true,
        'Remove background from the image',
        [imageUrl],
      );
      return images.slice(0, 1);
    });
  }

  private async startSmartSelect() {
    if (this.smartSelection || !this.api || !this.node || !this.isConnected)
      return;
    const imageUrl = getPrimaryFillValue(this.node);
    if (!imageUrl) return;
    const session: SmartSelection = {
      api: this.api,
      nodeId: this.node.id,
      imageUrl,
      revision: 0,
      points: this.api.getAppState().editingPoints,
      dispose: () => {},
    };
    this.smartSelection = session;
    const unsubscribe = session.api.subscribe(() => {
      if (
        this.smartSelection === session &&
        !this.isCurrentSelection(session)
      ) {
        this.endSmartSelection();
      } else {
        this.requestUpdate();
      }
    });
    const dispose = session.api.onDestroy(() => {
      if (this.smartSelection === session) this.endSmartSelection();
    });
    session.dispose = () => {
      unsubscribe();
      dispose();
    };
    if (!this.isCurrentSelection(session)) {
      this.endSmartSelection();
      return;
    }
    this.encodingImage = true;
    try {
      await session.api.encodeImage(imageUrl);
      if (this.isCurrentSelection(session))
        this.mode = ImageEditMode.POINT_SEGMENT;
    } catch (error) {
      if (this.isCurrentSelection(session)) {
        console.error(error);
        this.endSmartSelection();
      }
    } finally {
      if (this.smartSelection === session) this.encodingImage = false;
    }
  }

  private async segmentWithPoints(
    session: SmartSelection,
    points: [number, number][],
  ) {
    const revision = ++session.revision;
    this.clearMask();
    if (points.length === 0) return;
    const isCurrent = () =>
      this.isCurrentSelection(session) &&
      session.revision === revision &&
      session.api.getAppState().editingPoints === points;
    try {
      const { api } = session;
      const selectedNode = api.getNodeById(session.nodeId);
      const { x, y } = api.viewport2Canvas({
        x: points[0][0],
        y: points[0][1],
      });
      const { image } = await api.segmentImage({
        image_url: session.imageUrl,
        point_prompts: [
          {
            x: x - (selectedNode.x as number),
            y: y - (selectedNode.y as number),
            label: 1,
          },
        ],
      });
      if (!isCurrent()) return;
      const source =
        image.canvas ??
        (image.url ? await imageToCanvas(image.url) : undefined);
      if (!source || !source.width || !source.height || !isCurrent()) return;
      // Own the preview, rather than attaching a provider's reusable canvas.
      const mask = this.copyMask(source);
      mask.style.position = 'absolute';
      mask.style.left = `${selectedNode.x}px`;
      mask.style.top = `${selectedNode.y}px`;
      mask.style.width = `${selectedNode.width}px`;
      mask.style.height = `${selectedNode.height}px`;
      mask.style.pointerEvents = 'none';
      api.getHtmlLayer().appendChild(mask);
      this.maskCanvas = mask;
    } catch (error) {
      if (isCurrent()) console.error(error);
    }
  }

  private async removeByMask() {
    const session = this.smartSelection;
    const preview = this.maskCanvas;
    if (
      !session ||
      !preview ||
      !this.isCurrentSelection(session) ||
      this.removingByMask
    )
      return;
    const committed = await this.runImageEdit(
      'removingByMask',
      async (api, imageUrl) => {
        // Providers may read the mask after awaiting image/model loading.
        const mask = this.copyMask(preview);
        return [await api.removeByMask({ image_url: imageUrl, mask })];
      },
      () => this.isCurrentSelection(session),
    );
    if (committed && this.maskCanvas === preview) this.clearMask();
  }

  private decomposeImage() {
    return this.runImageEdit('decomposingImage', async (api, imageUrl) => {
      const { images } = await api.decomposeImage({ image_url: imageUrl });
      return images;
    });
  }

  private upscaleImage() {
    return this.runImageEdit('upscalingImage', async (api, imageUrl) => [
      await api.upscaleImage({ image_url: imageUrl }),
    ]);
  }

  render() {
    if (!this.api) {
      return;
    }

    if (this.mode === ImageEditMode.POINT_SEGMENT) {
      return html`<sp-action-button
        quiet
        size="m"
        ?disabled="${!this.maskCanvas || this.removingByMask}"
        ?loading="${this.removingByMask}"
        @click="${this.removeByMask}"
      >
        <sp-tooltip self-managed placement="bottom">Remove</sp-tooltip>
        <sp-icon-delete slot="icon"></sp-icon-delete>
      </sp-action-button>`;
    }

    return html`<sp-action-button
        quiet
        size="m"
        ?disabled="${this.removingBackground}"
        @click="${this.removeBackground}"
      >
        <sp-tooltip self-managed placement="bottom">
          Remove background
        </sp-tooltip>
        <sp-icon>
          <svg
            role="img"
            fill="currentColor"
            viewBox="0 0 20 20"
            id="-icon"
            width="16"
            height="16"
            aria-hidden="true"
            aria-label=""
            focusable="false"
          >
            <rect x="2" y="4" width="4" height="4" opacity=".35"></rect>
            <polygon
              points="10 12 9.30741 12 6 9 6 8 10 8 10 12"
              opacity=".35"
            ></polygon>
            <rect x="10" y="4" width="4" height="4" opacity=".35"></rect>
            <rect x="14" y="8" width="4" height="4" opacity=".35"></rect>
            <polygon
              points="14 12.28454 10 13.45999 10 12 14 12 14 12.28454"
              opacity=".35"
            ></polygon>
            <path
              d="m14.5,7.52114c0,.82843-.67157,1.5-1.5,1.5-.82843,0-1.5-.67157-1.5-1.5,0-.82843.67157-1.5,1.5-1.5s1.5.67157,1.5,1.5h0"
            ></path>
            <path
              d="m16.75,3H3.25c-1.24072,0-2.25,1.00977-2.25,2.25v9.5c0,1.24023,1.00928,2.25,2.25,2.25h13.5c1.24072,0,2.25-1.00977,2.25-2.25V5.25c0-1.24023-1.00928-2.25-2.25-2.25Zm-13.5,1.5h13.5c.41357,0,.75.33691.75.75v8.21069l-1.90869-1.90894c-.84961-.84961-2.3335-.84961-3.18213,0l-1.23193,1.23145c-.09717.09766-.25684.09668-.354.00098l-3.23193-3.23242c-.84961-.84961-2.3335-.84961-3.18213,0l-1.90918,1.90918v-6.21094c0-.41309.33643-.75.75-.75Zm0,11c-.41357,0-.75-.33691-.75-.75v-1.16797l2.97021-2.96973c.28223-.2832.77686-.2832,1.06006,0l3.23291,3.2334c.68164.67969,1.7915.68262,2.47412-.00098l1.23291-1.23242c.28223-.2832.77686-.2832,1.06006,0l2.70074,2.70068c-.1311.11206-.29553.18701-.48102.18701H3.25Z"
            ></path>
          </svg>
        </sp-icon>
      </sp-action-button>
      <sp-action-button
        quiet
        size="m"
        ?disabled="${this.encodingImage}"
        @click="${this.startSmartSelect}"
      >
        <sp-tooltip self-managed placement="bottom"> Smart select </sp-tooltip>
        <sp-icon-polygon-select slot="icon"></sp-icon-polygon-select>
      </sp-action-button>
      <sp-action-button
        quiet
        size="m"
        ?disabled="${this.decomposingImage}"
        @click="${this.decomposeImage}"
      >
        <sp-tooltip self-managed placement="bottom"> Decompose </sp-tooltip>
        <sp-icon-layers slot="icon"></sp-icon-layers>
      </sp-action-button>
      <sp-action-button
        quiet
        size="m"
        ?disabled="${this.upscalingImage}"
        @click="${this.upscaleImage}"
      >
        <sp-tooltip self-managed placement="bottom"> Upscale </sp-tooltip>
        <sp-icon-image-auto-mode slot="icon"></sp-icon-image-auto-mode>
      </sp-action-button> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-context-image-edit-bar': ContextImageEditBar;
  }
}
