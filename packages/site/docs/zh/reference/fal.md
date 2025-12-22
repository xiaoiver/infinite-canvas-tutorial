---
outline: deep
publish: false
---

使用 [fal.ai] 实现 [AI 相关 API]，包括：

-   [upload] 上传本地文件
-   [createOrEditImage] 使用 Gemini 3 Pro 生成或编辑图片
-   [encodeImage] 无需实现
-   [segmentImage] 使用 SAM 分割图片
-   [decomposeImage] 使用 Qwen-Image-Layered 将图片分解成多个图层

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
[AI 相关 API]: /zh/reference/ai
[upload]: /zh/reference/ai#upload
[createOrEditImage]: /zh/reference/ai#createoreditimage
[encodeImage]: /reference/ai#encodeimage
[segmentImage]: /zh/reference/ai#segmentimage
[decomposeImage]: /zh/reference/ai#decomposeimage
