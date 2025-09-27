import { html, css, LitElement } from 'lit';
import { consume } from '@lit/context';
import { when } from 'lit/directives/when.js';
import { customElement, state } from 'lit/decorators.js';
import {
  Task,
  AppState,
  API,
  RectSerializedNode,
  toSVGDataURL,
  toSVGElement,
} from '@infinite-canvas-tutorial/ecs';
import { apiContext, appStateContext } from '../context';
import { v4 as uuidv4 } from 'uuid';
import { load } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';
import { createOrEditImage } from '../providers/fal';
import { fal } from '@fal-ai/client';

@customElement('ic-spectrum-chat-panel')
export class ChatPanel extends LitElement {
  static styles = css`
    :host {
      color: canvastext;
    }

    section {
      display: flex;
      flex-direction: column;
      background: var(--spectrum-gray-100);
      border-radius: var(--spectrum-corner-radius-200);

      margin: 4px;

      filter: drop-shadow(
        var(--spectrum-drop-shadow-color) 0px var(--spectrum-drop-shadow-y)
          var(--spectrum-drop-shadow-blur)
      );
    }

    h4 {
      padding: var(--spectrum-global-dimension-size-100);
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0;
      color: canvastext;
    }

    .messages {
      width: 320px;
      padding: var(--spectrum-global-dimension-size-100);
      min-height: 100px;
      max-height: 300px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--spectrum-global-dimension-size-100);

      .user-message {
        display: flex;
        justify-content: flex-end;

        .user-message-content {
          width: fit-content;
          box-sizing: border-box;
          max-width: 100%;
          overflow-wrap: break-word;
          background: var(--spectrum-gray-200);
          padding: var(--spectrum-global-dimension-size-100);
          border-radius: var(--spectrum-corner-radius-200);
        }
      }

      .user-message-references {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        gap: var(--spectrum-global-dimension-size-50);
      }

      .assistant-message {
        display: flex;
        flex-direction: column;
        gap: var(--spectrum-global-dimension-size-100);

        .assistant-message-content {
          width: fit-content;
          box-sizing: border-box;
          max-width: 100%;
          overflow-wrap: break-word;
        }

        .assistant-message-images {
          display: flex;
          flex-direction: row;
          gap: var(--spectrum-global-dimension-size-100);
        }

        .assistant-message-suggestions {
          display: flex;
          flex-direction: column;
          gap: var(--spectrum-global-dimension-size-50);
        }
      }
    }

    .input-container {
      position: relative;
      padding: var(--spectrum-global-dimension-size-100);

      sp-textfield {
        width: 100%;
      }

      sp-action-button {
        position: absolute;
        right: var(--spectrum-global-dimension-size-200);
        bottom: var(--spectrum-global-dimension-size-200);
      }
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: API;

  @state()
  userMessageSending = false;

  @state()
  private inputValue = '';

  // 防止聊天面板的粘贴事件传播到画布
  private handlePaste(e: ClipboardEvent) {
    // 阻止事件传播，确保粘贴的文本只到 textfield
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  // 防止聊天面板的输入事件传播到画布
  private handleInput(e: Event) {
    // 更新内部状态以跟踪输入值
    const target = e.target as any;
    this.inputValue = target.value || '';
  }

  connectedCallback() {
    super.connectedCallback();
    // 当组件连接时，确保阻止默认的键盘事件
    this.addEventListener('paste', this.handlePaste, true);
    this.addEventListener('input', this.handleInput, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // 清理事件监听器
    this.removeEventListener('paste', this.handlePaste, true);
    this.removeEventListener('input', this.handleInput, true);
  }

  private handleClose() {
    this.api.setAppState({
      taskbarSelected: this.appState.taskbarSelected.filter(
        (task) => task !== Task.SHOW_CHAT_PANEL,
      ),
    });
  }

  private handleKeydown(event: KeyboardEvent) {
    // 阻止事件传播到画布，确保键盘输入只在聊天面板中处理
    event.stopPropagation();

    // 如果按下 Ctrl+Enter 或 Cmd+Enter，发送消息
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.handleSendMessage();
    }
  }

  private async sendMessage(messageContent: string) {
    if (!messageContent) {
      return;
    }

    this.userMessageSending = true;
    this.appState.taskbarChatMessages.push({
      role: 'user',
      content: messageContent,
      references: this.appState.layersSelected.map((id) => ({
        id,
      })),
    });

    const isEdit = this.appState.layersSelected.length > 0;
    const selectedNodes = this.appState.layersSelected.map((id) =>
      this.api.getNodeById(id),
    );
    const bounds = isEdit ? this.api.getBounds(selectedNodes) : undefined;
    const image_urls = isEdit
      ? await Promise.all(
          selectedNodes
            .map(async (node) => {
              if (node.type === 'rect') {
                return node.fill;
              } else {
                const dataURL = toSVGDataURL(toSVGElement(this.api, [node]));
                const pngDataURL = await svgToPng(
                  dataURL,
                  node.width,
                  node.height,
                );
                const res = await fetch(pngDataURL);
                const blob = await res.blob();
                const file = new File([blob], `${node.id}.png`, {
                  type: blob.type,
                });
                const url = await fal.storage.upload(file);
                return url;
              }
            })
            .filter((url) => !!url),
        )
      : undefined;
    const { images, description } = await createOrEditImage(
      isEdit,
      messageContent,
      image_urls,
    );

    // const { images, description } = await new Promise((resolve) =>
    //   setTimeout(
    //     () =>
    //       resolve({
    //         images: [
    //           {
    //             url: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
    //           },
    //         ],
    //         description: 'A beautiful image',
    //       }),
    //     1000,
    //   ),
    // );

    this.appState.taskbarChatMessages.push({
      role: 'assistant',
      content: description,
      images,
    });
    this.userMessageSending = false;

    // Scroll down to the new message
    const messagesContainer = this.shadowRoot?.querySelector(
      '.messages',
    ) as any;
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 300);

    // Insert images into canvas
    if (images.length > 0) {
      const loadedImages = await Promise.all(
        images.map((image) =>
          load(image.url, ImageLoader, {
            fetch: {
              mode: 'cors',
              credentials: 'omit',
            },
          }),
        ),
      );
      this.api.runAtNextTick(() => {
        const newImages: RectSerializedNode[] = [];
        const { minX, minY, maxX, maxY } = bounds ?? {
          minX: 0,
          minY: 0,
          maxX: 0,
          maxY: 0,
        };
        images.forEach((image, index) => {
          // Create a new image below the original one
          const newImage: RectSerializedNode = {
            id: uuidv4(),
            type: 'rect',
            fill: image.url,
            lockAspectRatio: true,
            x: minX,
            y: maxY + 30,
            width: loadedImages[index].width,
            height: loadedImages[index].height,
          };
          newImages.push(newImage);
        });

        this.api.updateNodes(newImages);
        this.api.selectNodes(newImages);
        this.api.record();
      });
    }
  }

  private async handleSendMessage() {
    const messageContent = this.inputValue.trim();
    const textfield = this.shadowRoot?.querySelector('sp-textfield') as any;
    if (textfield) {
      textfield.value = '';
    }
    this.inputValue = '';
    await this.sendMessage(messageContent);
  }

  private handleSuggestionClick(suggestion: string) {
    this.sendMessage(suggestion);
  }

  render() {
    const { taskbarSelected } = this.appState;
    const enabled = taskbarSelected.includes(Task.SHOW_CHAT_PANEL);

    if (!enabled) {
      return null;
    }

    return html`<section
      @paste.stop
      @input.stop
      @keydown.stop
      @pointerdown.stop
    >
      <h4>
        Chat
        <sp-action-button quiet size="s" @click=${this.handleClose}>
          <sp-icon-close slot="icon"></sp-icon-close>
        </sp-action-button>
      </h4>
      <div class="messages">
        ${this.appState.taskbarChatMessages.map(
          (message) =>
            html`${when(
              message.role === 'user',
              () => html`<div class="user-message">
                  <div class="user-message-content">${message.content}</div>
                </div>
                <div class="user-message-references">
                  ${message.references?.map(
                    (reference) => html`<ic-spectrum-layer-thumbnail
                      .node=${this.api.getNodeById(reference.id)}
                    ></ic-spectrum-layer-thumbnail>`,
                  )}
                </div>`,
              () =>
                html`<div class="assistant-message">
                  <div class="assistant-message-content">
                    ${message.content}
                  </div>
                  <div class="assistant-message-images">
                    ${message.images?.map(
                      (image) => html`<sp-thumbnail
                        size="1000"
                        ?focused=${this.appState.layersSelected
                          .map((id) => this.api.getNodeById(id))
                          .filter((node) => node.type === 'rect')
                          .map((node) => node.fill)
                          .includes(image.url)}
                      >
                        <img src="${image.url}" alt="Demo Image" />
                      </sp-thumbnail>`,
                    )}
                  </div>
                  <div class="assistant-message-suggestions">
                    ${message.suggestions?.map(
                      (suggestion) =>
                        html`<sp-action-button
                          size="s"
                          .disabled=${this.userMessageSending}
                          @click=${() =>
                            this.handleSuggestionClick(suggestion.text)}
                        >
                          ${suggestion.text}</sp-action-button
                        >`,
                    )}
                  </div>
                </div>`,
            )}`,
        )}
        ${when(
          this.userMessageSending,
          () =>
            html`<sp-progress-circle
              label="Generating content"
              indeterminate
              size="s"
            ></sp-progress-circle>`,
        )}
      </div>
      <div class="input-container">
        <sp-textfield
          label="prompt"
          multiline
          @keydown=${this.handleKeydown}
          @paste=${this.handlePaste}
          @input=${this.handleInput}
        ></sp-textfield>
        <sp-action-button
          emphasized
          size="m"
          @click=${this.handleSendMessage}
          .disabled=${this.userMessageSending}
        >
          <sp-icon-send slot="icon"></sp-icon-send>
        </sp-action-button>
      </div>
    </section>`;
  }
}

async function svgToPng(
  svgDataUrl: string,
  width?: number,
  height?: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // 避免 CORS 问题
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width || img.width;
      canvas.height = height || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 导出 PNG DataURL
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = svgDataUrl;
  });
}
