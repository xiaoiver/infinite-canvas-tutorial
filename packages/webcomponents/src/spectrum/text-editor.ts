import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  AppState,
  Canvas,
  computeBidi,
  ComputeBounds,
  ComputedBounds,
  ComputedCamera,
  measureText,
  SerializedNode,
  Text,
  TextSerializedNode,
  UI,
} from '@infinite-canvas-tutorial/ecs';
import { v4 as uuidv4 } from 'uuid';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';

@customElement('ic-spectrum-text-editor')
export class TextEditor extends LitElement {
  // @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx#L309
  static styles = css`
    :host {
      position: absolute;
    }

    textarea {
      position: absolute;
      display: none;
      min-height: 1em;
      backface-visibility: hidden;
      margin: 0;
      padding: 0;
      border: 0;
      outline: 0;
      resize: none;
      background: transparent;
      overflow: hidden;
      overflow-wrap: break-word;
      box-sizing: content-box;
      font-size: 16px;
      font-family: system-ui;
      font-weight: normal;
      font-style: normal;
      font-variant: normal;
      letter-spacing: 0;
      width: auto;
      min-width: 1em;
    }

    textarea.wheel-transparent {
      pointer-events: none;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @query('textarea')
  editable: HTMLTextAreaElement;

  @state()
  private node: TextSerializedNode;

  private binded = false;
  private prevCameraZoom: number;
  private prevCameraX: number;
  private prevCameraY: number;

  private handleBlur = (event: FocusEvent) => {
    const target = event.target as HTMLTextAreaElement;
    const content = target.value;

    if (content.trim() !== '' && content.trim() !== this.node.content) {
      this.api.runAtNextTick(() => {
        this.api.updateNode({
          ...this.node,
          content,
          visibility: 'visible',
        });
        this.api.record();
      });
    } else {
      this.api.runAtNextTick(() => {
        this.api.updateNode({
          ...this.node,
          visibility: 'visible',
        });
      });
    }

    this.editable.style.display = 'none';
    this.editable.value = '';
  };

  private handleDblclick = (event: MouseEvent) => {
    const { x: vx, y: vy } = this.api.client2Viewport({
      x: event.clientX,
      y: event.clientY,
    });
    const { x: wx, y: wy } = this.api.viewport2Canvas({
      x: vx,
      y: vy,
    });

    const entities = this.api.elementsFromBBox(wx, wy, wx, wy);
    const entity = entities.find((e) => !e.has(UI));

    this.node = undefined;

    // Create a new text node if blank area is clicked.
    if (!entity) {
      return;

      this.node = {
        id: uuidv4(),
        type: 'text',
        content: '',
        anchorX: wx,
        anchorY: wy,
        x: wx,
        y: wy - 16,
        width: 0,
        height: 0,
        fontSize: 16,
        fontFamily: 'system-ui',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        fill: 'black',
      };
    } else if (entity.has(Text)) {
      // Edit the existing text node.
      const node = this.api.getNodeByEntity(entity) as TextSerializedNode;

      const { obb } = entity.read(ComputedBounds);
      this.node = node;

      this.editable.value = node.content;
      this.editable.style.fontFamily = node.fontFamily;
      this.editable.style.fontWeight =
        node.fontWeight && node.fontWeight.toString();
      this.editable.style.fontSize = `${node.fontSize}px`;
      this.editable.style.fontStyle = node.fontStyle;
      this.editable.style.fontVariant = node.fontVariant;
      this.editable.style.color = node.fill;
      this.editable.style.opacity = node.opacity && node.opacity.toString();
      this.editable.style.textAlign = node.textAlign;
      this.editable.style.width = `${obb.width}px`;
      this.editable.style.height = `${obb.height}px`;
      // TODO: support textBaseline.
      // this.editable.style.textBaseline = node.textBaseline;
      this.editable.style.letterSpacing =
        node.letterSpacing && node.letterSpacing.toString();

      this.api.deselectNodes([node]);
      this.api.unhighlightNodes([node]);
      // Hide original text node for now.
      this.api.updateNode({
        id: node.id,
        visibility: 'hidden',
      });
    }

    if (!this.node) {
      return;
    }

    this.updatePositionWithCamera();

    this.editable.style.display = 'inline-block';

    this.editable.style.transformOrigin = `left top`;
    this.editable.focus();
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    // Prevent triggering arrow keys.
    event.stopPropagation();

    if (event.key === 'Escape') {
      this.editable.blur();
      // } else if (
      //   event.key === KEYS.TAB ||
      //   (event[KEYS.CTRL_OR_CMD] &&
      //     (event.code === CODES.BRACKET_LEFT ||
      //       event.code === CODES.BRACKET_RIGHT))
      // ) {
      //   event.preventDefault();
      //   if (event.isComposing) {
      //     // input keyboard
      //     return;
      //   } else if (event.shiftKey || event.code === CODES.BRACKET_LEFT) {
      //     outdent();
      //   } else {
      //     indent();
      //   }
      //   // We must send an input event to resize the element
    }
  };

  private handleInput = (event: Event) => {
    const target = event.target as HTMLTextAreaElement;
    const content = target.value;

    const attributes = {
      ...this.node,
      content,
    };
    computeBidi(content);
    const metrics = measureText(attributes);

    const { minX, minY, maxX, maxY } = Text.getGeometryBounds(
      attributes,
      metrics,
    );
    const width = maxX - minX;
    const height = maxY - minY;

    this.editable.style.width = `${width}px`;
    this.editable.style.height = `${height}px`;
  };

  private handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const $canvas = this.api.getCanvas().read(Canvas).element;
    if ($canvas) {
      const newWheelEvent = new WheelEvent('wheel', {
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaZ: event.deltaZ,
        deltaMode: event.deltaMode,
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        bubbles: true,
        cancelable: true,
      });
      $canvas.dispatchEvent(newWheelEvent);
    }
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.api && this.api.getCanvas().has(Canvas)) {
      const $canvas = this.api.getCanvas().read(Canvas).element;
      $canvas?.removeEventListener('dblclick', this.handleDblclick);
    }
  }

  private updatePositionWithCamera() {
    if (this.node) {
      const camera = this.api.getCamera();
      const { zoom } = camera.read(ComputedCamera);

      const { x, y } = this.api.canvas2Viewport({
        x: this.node.x,
        y: this.node.y,
      });

      this.editable.style.left = `${x}px`;
      this.editable.style.top = `${y}px`;
      this.editable.style.transform = `scale(${zoom})`;
    }
  }

  render() {
    // FIXME: wait for the element to be ready.
    if (this.api?.element && !this.binded) {
      const $canvas = this.api.getCanvas().read(Canvas).element;
      $canvas?.addEventListener('dblclick', this.handleDblclick);
      this.binded = true;
    }

    if (
      this.prevCameraZoom !== this.appState.cameraZoom ||
      this.prevCameraX !== this.appState.cameraX ||
      this.prevCameraY !== this.appState.cameraY
    ) {
      this.updatePositionWithCamera();
      this.prevCameraZoom = this.appState.cameraZoom;
      this.prevCameraX = this.appState.cameraX;
      this.prevCameraY = this.appState.cameraY;
    }

    return html`<textarea
      dir="auto"
      tabindex="0"
      wrap="off"
      @blur=${this.handleBlur}
      @input=${this.handleInput}
      @keydown=${this.handleKeyDown}
      @wheel=${this.handleWheel}
    ></textarea>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-text-editor': TextEditor;
  }
}
