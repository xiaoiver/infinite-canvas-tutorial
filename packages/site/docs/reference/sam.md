---
outline: deep
publish: false
---

Use SAM to implement [AI API]

```ts
import { SAMPlugin } from '@infinite-canvas-tutorial/sam';

new App().addPlugins(...DefaultPlugins, UIPlugin, SAMPlugin).run();
```

ONNX provides a web-based runtime, enabling real-time inference directly in the browser without consuming any tokens. For details, see:
[How to add machine learning to your web application with ONNX Runtime]

We have implemented the following optimizations:

-   Utilized the [ORT model format] to reduce the size of downloaded models during runtime
-   Employed WebGPU for faster inference speeds. For details, see: [Using the WebGPU Execution Provider]
-   Executed within WebWorkers to avoid blocking the main thread

Since we use `import.meta` to import worker code, which is a feature of ESModule, so we need to use the following config in `tsconfig.json`:

```json
"compilerOptions": {
    "module": "ESNext"
}
```

[AI API]: /reference/ai
[How to add machine learning to your web application with ONNX Runtime]: https://onnxruntime.ai/docs/tutorials/web/
[ORT model format]: https://onnxruntime.ai/docs/performance/model-optimizations/ort-format-models.html
[Using the WebGPU Execution Provider]: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
