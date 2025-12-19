---
outline: deep
---

<script setup>
import WhenCanvasMeetsChat from '../../components/WhenCanvasMeetsChat.vue'
</script>

为画布添加一个对话框组件，详见：[加入聊天框]

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { ChatPlugin } from '@infinite-canvas-tutorial/chat';

const app = new App().addPlugins(...DefaultPlugins, UIPlugin, ChatPlugin);
app.run();
```

## 消息格式 {#message-structure}

我们使用如下消息格式：

```ts
export interface Message {
    role: 'user' | 'assistant';
    content: string;
    images?: {
        // 图片列表，展示在消息下方
        url: string;
    }[];
    suggestions?: {
        // 建议列表，展示在图片列表下方
        text: string;
    }[];
}
```

通过修改全局状态中的 `taskbarChatMessages` 属性可以控制消息列表：

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

[加入聊天框]: /zh/guide/lesson-028#chatbox
