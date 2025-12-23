---
outline: deep
---

使用 [UpscalerJS] 实现 [AI API] 中的 `upscaleImage` 方法：

-   在 WebWorker 中运行不阻塞主线程，使用 tensorflow.js 运行时
-   默认使用 [@upscalerjs/esrgan-medium] 4x

```ts
import { UpscalerPlugin } from '@infinite-canvas-tutorial/upscaler';

new App().addPlugins(...DefaultPlugins, UIPlugin, UpscalerPlugin).run();
```

![@upscalerjs/esrgan-medium 4x](/upscaler.png)

[AI API]: /zh/reference/ai
[UpscalerJS]: https://upscalerjs.com/
[@upscalerjs/esrgan-medium]: https://upscalerjs.com/models/available/upscaling/esrgan-medium
