---
outline: deep
publish: false
---

使用 [fal.ai] 实现 [AI 相关 API]，包括：

-   [upload] 上传本地文件
-   [createOrEditImage] 使用 Gemini 3 Pro 生成或编辑图片
-   [segmentImage] 使用 SAM 分割图片

```ts
import { FalAIPlugin } from '@infinite-canvas-tutorial/fal-ai';

new App().addPlugins(...DefaultPlugins, UIPlugin, FalAIPlugin).run();
```

[fal.ai]: https://fal.ai/
[AI 相关 API]: /zh/reference/ai
[upload]: /zh/reference/ai#upload
[createOrEditImage]: /zh/reference/ai#createoreditimage
[segmentImage]: /zh/reference/ai#segmentimage
