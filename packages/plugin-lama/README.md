# @infinite-canvas-tutorial/lama

[Client-Side Image Inpainting with ONNX and Next.js]

## Getting Started

```ts
import { LaMaPlugin } from '@infinite-canvas-tutorial/lama';

new App().addPlugins(...DefaultPlugins, UIPlugin, LaMaPlugin).run();
```

ONNX provides a web-based runtime, enabling real-time inference directly in the browser without consuming any tokens. For details, see:
[How to add machine learning to your web application with ONNX Runtime]

## Build

We use the following syntax so that vite will build webworker correctly.

```ts
import workerUrl from './sam-worker.js?worker&url';
```

[AI API]: /reference/ai
[How to add machine learning to your web application with ONNX Runtime]: https://onnxruntime.ai/docs/tutorials/web/
[Client-Side Image Inpainting with ONNX and Next.js]: https://medium.com/@geronimo7/client-side-image-inpainting-with-onnx-and-next-js-3d9508dfd059
[ORT model format]: https://onnxruntime.ai/docs/performance/model-optimizations/ort-format-models.html
[Using the WebGPU Execution Provider]: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
