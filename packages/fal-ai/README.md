# @infinite-canvas-tutorial/fal-ai

Use [fal.ai] to implement AI interfaces like `createOrEditImage`. [Reference]

## Getting started

Add this plugin first

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { FalAIPlugin } from '@infinite-canvas-tutorial/fal-ai';

const app = new App().addPlugins(...DefaultPlugins, UIPlugin, FalAIPlugin);
app.run();
```

Add your public key on client side like this:

```ts
// FIXME: Dangerous !!!
// use https://developers.cloudflare.com/workers/configuration/environment-variables/
fal.config({
    credentials: '5e973660...',
});
```

[fal.ai]: https://fal.ai/
[Reference]: https://infinitecanvas.cc/reference/sam
