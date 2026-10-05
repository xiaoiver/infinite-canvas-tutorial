import { html, css, LitElement } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  AppState,
  ComputedBounds,
  ComputedCamera,
  GlobalTransform,
  Pen,
  Text,
  TextSerializedNode,
  UI,
  getPrimaryFillValue,
  inferXYWidthHeight,
} from '@infinite-canvas-tutorial/ecs';
import { v4 as uuidv4 } from 'uuid';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';

interface TextEditingSession {
  api: ExtendedAPI;
  source: TextSerializedNode;
  isNew: boolean;
}

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
      line-height: 1;
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

  private session?: TextEditingSession;
  private boundApi?: ExtendedAPI;
  private disposeBinding?: () => void;
  private prevCameraZoom: number;
  private prevCameraX: number;
  private prevCameraY: number;

  private closeEditing(restore = true) {
    const session = this.session;
    this.session = undefined;
    this.node = undefined;
    if (this.editable) {
      this.editable.style.display = 'none';
      this.editable.value = '';
      this.editable.blur();
    }
    if (restore && session && !session.isNew) {
      const { api, source } = session;
      const current = api.getNodeById(source.id);
      if (
        current?.type === 'text' &&
        !current.isDeleted &&
        api.getEntity(current)
      ) {
        // Visibility belongs to the renderer while the textarea is open. Do not
        // change the document or capture unrelated edits just to restore it.
        api.updateNode(
          current,
          { visibility: current.visibility ?? 'inherited' },
          false,
          ['visibility'],
        );
      }
    }
  }

  private async commitText(session: TextEditingSession, content: string) {
    const { api, source, isNew } = session;
    const controller = new AbortController();
    const dispose = api.onDestroy(() => controller.abort());
    try {
      await api.edit(
        (editor) => {
          const current = editor.getNodeById(source.id);
          if (isNew) {
            if (current || editor.getEntity(source)) {
              controller.abort();
              return;
            }
            editor.updateNode({ ...source, content });
          } else {
            if (
              current?.type !== 'text' ||
              current.isDeleted ||
              !editor.getEntity(current) ||
              current.content === content
            ) {
              // Cancel before mutating; an empty commit could record unrelated
              // transient changes accumulated since this command was queued.
              controller.abort();
              return;
            }
            editor.updateNode(current, { content });
          }
        },
        { signal: controller.signal },
      );
    } catch (error) {
      if (!controller.signal.aborted) console.error(error);
    } finally {
      dispose();
    }
  }

  private finishEditing(content = this.editable?.value ?? '') {
    const session = this.session;
    if (!session) return;
    this.closeEditing();
    if (session.api.getAppState().penbarSelected !== Pen.SELECT) {
      session.api.setAppState({ penbarSelected: Pen.SELECT });
    }
    // Keep the existing blank-text policy: discard a blank draft, and retain
    // the original contents when an existing text field is emptied.
    if (content.trim() !== '' && content !== session.source.content) {
      void this.commitText(session, content);
    }
  }

  private handleBlur = (event: FocusEvent) => {
    const session = this.session;
    if (!session) return;
    const content = (event.target as HTMLTextAreaElement).value;
    // Removing a focused custom element can blur its textarea before the
    // disconnected callback runs. Let teardown discard the draft first.
    queueMicrotask(() => {
      if (this.session !== session) return;
      if (!this.isConnected) this.closeEditing();
      else this.finishEditing(content);
    });
  };

  private handleDblclick = (event: MouseEvent) => {
    const api = this.boundApi;
    if (!api || !this.isConnected) return;
    this.finishEditing();
    const appState = api.getAppState();
    const isPenSelect = appState.penbarSelected === Pen.SELECT;
    const isPenText = appState.penbarSelected === Pen.TEXT;

    if (!isPenSelect && !isPenText) {
      return;
    }

    const { x: vx, y: vy } = api.client2Viewport({
      x: event.clientX,
      y: event.clientY,
    });
    const { x: wx, y: wy } = api.viewport2Canvas({
      x: vx,
      y: vy,
    });

    const entities = api.elementsFromBBox(wx, wy, wx, wy);
    const entity = entities.find((e) => !e.has(UI));

    this.node = undefined;

    if (isPenSelect && entity && entity.has(Text)) {
      // Edit the existing text node.
      const node = api.getNodeByEntity(entity) as TextSerializedNode;

      const { geometryBounds } = entity.read(ComputedBounds);
      const textW = geometryBounds.maxX - geometryBounds.minX;
      const textH = geometryBounds.maxY - geometryBounds.minY;
      this.node = structuredClone(node);
      this.session = { api, source: this.node, isNew: false };

      this.editable.value = node.content;
      this.updateTextareaStyle(node);

      this.editable.style.width = `${textW}px`;
      // TODO: Should account for text overflow like ellipsis or clip.
      // if (node.wordWrap && node.wordWrapWidth && node.maxLines) {
      //   this.editable.style.height = `${node.maxLines * node.lineHeight}px`;
      // } else {
      this.editable.style.height = `${textH}px`;
      // }

      api.deselectNodes([node]);
      // Hide original text node for now.
      api.updateNode(
        node,
        {
          visibility: 'hidden',
        },
        false,
        ['visibility'],
      );
    }

    if (isPenText) {
      // Create a new text node if blank area is clicked.
      this.node = structuredClone({
        id: uuidv4(),
        type: 'text',
        content: '',
        anchorX: wx,
        anchorY: wy,
        zIndex: 0,
        ...appState.penbarText,
      });
      inferXYWidthHeight(this.node);
      this.session = { api, source: this.node, isNew: true };

      this.updateTextareaStyle(appState.penbarText);
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
    if (!this.node) return;
    const target = event.target as HTMLTextAreaElement;
    const content = target.value;

    const attributes = {
      ...this.node,
      content,
    };
    const { minX, minY, maxX, maxY } = Text.getGeometryBounds(attributes);
    const width = maxX - minX;
    const height = maxY - minY;

    this.editable.style.width = `${width}px`;
    this.editable.style.height = `${height}px`;
  };

  private handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const $canvas = this.api.getCanvasElement();
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

  private releaseBinding() {
    try {
      this.closeEditing();
    } catch (error) {
      console.error(error);
    }
    this.disposeBinding?.();
    this.disposeBinding = undefined;
    this.boundApi = undefined;
  }

  private bindCanvas() {
    if (!this.isConnected || !this.api?.element || this.boundApi === this.api)
      return;
    this.releaseBinding();
    const api = this.api;
    this.boundApi = api;
    let canvas: HTMLCanvasElement | undefined;
    let destroyed = false;
    this.disposeBinding = api.onDestroy(() => {
      destroyed = true;
      this.closeEditing(false);
      canvas?.removeEventListener('dblclick', this.handleDblclick);
    });
    if (destroyed) return;
    canvas = api.getCanvasElement();
    canvas.addEventListener('dblclick', this.handleDblclick);
  }

  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.releaseBinding();
  }

  protected updated() {
    this.bindCanvas();
    if (
      this.appState &&
      (this.prevCameraZoom !== this.appState.cameraZoom ||
        this.prevCameraX !== this.appState.cameraX ||
        this.prevCameraY !== this.appState.cameraY)
    ) {
      this.updatePositionWithCamera();
      this.prevCameraZoom = this.appState.cameraZoom;
      this.prevCameraX = this.appState.cameraX;
      this.prevCameraY = this.appState.cameraY;
    }
  }

  private updatePositionWithCamera() {
    if (this.node) {
      const api = this.session.api;
      const camera = api.getCamera();
      const { zoom } = camera.read(ComputedCamera);

      // 文本实体局部 (0,0) → 画布；父×(x,y) 会漏子项旋转/缩放。
      let canvasX = this.node.x;
      let canvasY = this.node.y;
      const textEntity = api.getEntity(this.node);
      if (textEntity?.has(GlobalTransform)) {
        const p = api.transformer2Canvas({ x: 0, y: 0 }, textEntity);
        canvasX = p.x;
        canvasY = p.y;
      }

      const { x, y } = api.canvas2Viewport({
        x: canvasX,
        y: canvasY,
      });

      this.editable.style.left = `${x}px`;
      this.editable.style.top = `${y}px`;
      this.editable.style.transform = `scale(${zoom})`;
    }
  }

  private updateTextareaStyle(node: Partial<TextSerializedNode>) {
    const {
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      fontVariant,
      opacity,
      textAlign,
      textBaseline,
      letterSpacing,
      lineHeight,
    } = node;
    const fill = getPrimaryFillValue(node);

    if (fontFamily) {
      this.editable.style.fontFamily = fontFamily;
    } else {
      this.editable.style.removeProperty('font-family');
    }
    if (fontSize) {
      this.editable.style.fontSize = `${fontSize}px`;
    } else {
      this.editable.style.removeProperty('font-size');
    }
    if (fontWeight) {
      this.editable.style.fontWeight = fontWeight.toString();
    } else {
      this.editable.style.removeProperty('font-weight');
    }
    if (fontStyle) {
      this.editable.style.fontStyle = fontStyle;
    } else {
      this.editable.style.removeProperty('font-style');
    }
    if (fontVariant) {
      this.editable.style.fontVariant = fontVariant;
    } else {
      this.editable.style.removeProperty('font-variant');
    }
    if (fill) {
      this.editable.style.color = fill;
    } else {
      this.editable.style.removeProperty('color');
    }
    if (opacity) {
      this.editable.style.opacity = opacity.toString();
    } else {
      this.editable.style.removeProperty('opacity');
    }
    if (textAlign) {
      this.editable.style.textAlign = textAlign;
    } else {
      this.editable.style.removeProperty('text-align');
    }
    if (textBaseline) {
      // this.editable.style.textBaseline = textBaseline;
    }
    if (letterSpacing) {
      this.editable.style.letterSpacing = letterSpacing.toString();
    } else {
      this.editable.style.removeProperty('letter-spacing');
    }
    if (lineHeight) {
      this.editable.style.lineHeight = `${lineHeight}px`;
    } else {
      this.editable.style.lineHeight = '1';
    }
  }

  render() {
    return html`<textarea
      dir="auto"
      tabindex="0"
      wrap="on"
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
