---
outline: deep
---

Use [UpscalerJS] implementing [AI API] `upscaleImage`

-   Running in WebWorker with tensorflow.js runtime
-   Choose [@upscalerjs/esrgan-medium] 4x

```ts
import { UpscalerPlugin } from '@infinite-canvas-tutorial/upscaler';

new App().addPlugins(...DefaultPlugins, UIPlugin, UpscalerPlugin).run();
```

![@upscalerjs/esrgan-medium 4x](/upscaler.png)

[AI API]: /reference/ai
[UpscalerJS]: https://upscalerjs.com/
[@upscalerjs/esrgan-medium]: https://upscalerjs.com/models/available/upscaling/esrgan-medium
