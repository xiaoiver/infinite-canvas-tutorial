---
outline: deep
publish: false
---

使用 SAM 实现 [AI 相关 API] 中的分割图片部分

```ts
import { SAMPlugin } from '@infinite-canvas-tutorial/sam';

new App().addPlugins(...DefaultPlugins, UIPlugin, SAMPlugin).run();
```

ONNX 提供了 Web 端的运行时，这样就可以在浏览器端进行实时推理，不需要消耗任何 token。详见：[How to add machine learning to your web application with ONNX Runtime]

我们做了以下优化：

-   为了减小运行时的下载模型大小，使用了 [ORT model format]
-   使用 WebGPU 获得更快的推理速度，详见：[Using the WebGPU Execution Provider]
-   在 WebWorker 中运行，不阻塞主线程

另外由于使用了 `import.meta` 这样的 ESModule 特性，因此在 `tsconfig.json` 中需要指定：

```json
"compilerOptions": {
    "module": "ESNext"
}
```

[AI 相关 API]: /zh/reference/ai
[How to add machine learning to your web application with ONNX Runtime]: https://onnxruntime.ai/docs/tutorials/web/
[ORT model format]: https://onnxruntime.ai/docs/performance/model-optimizations/ort-format-models.html
[Using the WebGPU Execution Provider]: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
