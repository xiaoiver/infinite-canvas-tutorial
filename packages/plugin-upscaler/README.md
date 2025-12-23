# @infinite-canvas-tutorial/upscaler

Use [upscalerjs] to implement `upscaleImage` in [AI API]

-   Running in WebWorker with tensorflow.js
-   Choose @upscalerjs/esrgan-medium 4x by default

## Getting Started

```ts
import { UpscalerPlugin } from '@infinite-canvas-tutorial/upscaler';

new App().addPlugins(...DefaultPlugins, UIPlugin, UpscalerPlugin).run();
```

## Build

We use the following syntax so that vite will build webworker correctly.

```ts
import workerUrl from './worker.js?worker&url';
```

[AI API]: /reference/ai
[upscalerjs]: https://upscalerjs.com/
