# @infinite-canvas-tutorial/fal-ai

Use [fal.ai] to implement AI interfaces like `createOrEditImage`

## Getting started

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { FalAIPlugin } from '@infinite-canvas-tutorial/fal-ai';

const app = new App().addPlugins(...DefaultPlugins, UIPlugin, FalAIPlugin);
app.run();
```

[fal.ai]: https://fal.ai/
