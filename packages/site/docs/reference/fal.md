---
outline: deep
publish: false
---

Use [fal.ai] to implement [AI API]

-   [upload] Upload File to CDN and return an URL
-   [createOrEditImage] Use Gemini 3 Pro to create or edit image
-   [encodeImage] Do nothing here
-   [segmentImage] Use SAM to segment image

```ts
import { FalAIPlugin } from '@infinite-canvas-tutorial/fal-ai';

new App()
    .addPlugins(
        ...DefaultPlugins,
        UIPlugin,
        FalAIPlugin.configure({
            credentials: 'your-fal-ai-credentials-here',
        }),
    )
    .run();
```

[fal.ai]: https://fal.ai/
[AI API]: /reference/ai
[upload]: /reference/ai#upload
[createOrEditImage]: /reference/ai#createoreditimage
[encodeImage]: /reference/ai#encodeimage
[segmentImage]: /reference/ai#segmentimage
