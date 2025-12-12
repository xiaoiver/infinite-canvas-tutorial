# @infinite-canvas-tutorial/fal-ai

Use [fal.ai] to implement AI interfaces like `createOrEditImage`. [Reference]

> Notice: This package will expose your fal public key on the client side.

## Getting started

Add this plugin with configuration (similar to tiptap's plugin system):

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { FalAIPlugin } from '@infinite-canvas-tutorial/fal-ai';

const app = new App().addPlugins(
    ...DefaultPlugins,
    UIPlugin,
    FalAIPlugin.configure({
        credentials: 'your-fal-ai-credentials-here',
    }),
);
app.run();
```

The plugin accepts configuration options through the `configure` method, allowing you to pass initialization parameters like your fal.ai credentials.

[fal.ai]: https://fal.ai/
[Reference]: https://infinitecanvas.cc/reference/sam
