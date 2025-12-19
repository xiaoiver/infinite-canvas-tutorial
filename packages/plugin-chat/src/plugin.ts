import { Plugin, Task } from '@infinite-canvas-tutorial/ecs';
import { registerTask } from '@infinite-canvas-tutorial/webcomponents';
import { html } from 'lit';

export const ChatPlugin: Plugin = () => {
  registerTask(
    Task.SHOW_CHAT_PANEL,
    html`<sp-icon-chat slot="icon"></sp-icon-chat>`,
    'Show chat panel',
    html`<ic-spectrum-chat-panel></ic-spectrum-chat-panel>`,
  );
};
