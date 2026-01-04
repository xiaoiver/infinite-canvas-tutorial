---
outline: deep
---

<script setup>
import WhenCanvasMeetsChat from '../components/WhenCanvasMeetsChat.vue'
</script>

see: [Add a chatbox]

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { ChatPlugin } from '@infinite-canvas-tutorial/chat';

const app = new App().addPlugins(...DefaultPlugins, UIPlugin, ChatPlugin);
app.run();
```

Import Spectrum UI like this:

```ts
import '@infinite-canvas-tutorial/chat/spectrum';
```

Use components in HTML with `<slot>`:

```html
<ic-spectrum-canvas>
    <ic-spectrum-taskbar-chat slot="taskbar-item" />
    <ic-spectrum-taskbar-chat-panel slot="taskbar-panel" />
</ic-spectrum-canvas>
```

## Message structure {#message-structure}

```ts
export interface Message {
    role: 'user' | 'assistant';
    content: string;
    images?: {
        // Display under content
        url: string;
    }[];
    suggestions?: {
        // Display under image list
        text: string;
    }[];
}
```

Modify message list via `taskbarChatMessages` in global `appState`:

```ts
api.setAppState({
    taskbarChatMessages: [
        {
            role: 'user',
            content:
                "An action shot of a black lab swimming in an inground suburban swimming pool. The camera is placed meticulously on the water line, dividing the image in half, revealing both the dogs head above water holding a tennis ball in it's mouth, and it's paws paddling underwater.",
        },
        {
            role: 'assistant',
            content: 'Sure! Here is your image:',
            images: [
                {
                    url: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
                },
            ],
            suggestions: [
                {
                    text: 'Replace the puppy with a kitten.',
                },
                {
                    text: 'Remove the background.',
                },
            ],
        },
    ],
});
```

<WhenCanvasMeetsChat />

[Add a chatbox]: /guide/lesson-028#chatbox
