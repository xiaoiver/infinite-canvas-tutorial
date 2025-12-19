# @infinite-canvas-tutorial/chat

[Reference]

## Getting started

Add this plugin with configuration (similar to tiptap's plugin system):

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { ChatPlugin } from '@infinite-canvas-tutorial/chat';

const app = new App().addPlugins(...DefaultPlugins, UIPlugin, ChatPlugin);
app.run();
```

[Reference]: https://infinitecanvas.cc/reference/chat
