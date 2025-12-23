# @infinite-canvas-tutorial/sam

Use ONNX WebGPU runtime for SAM to implement [AI API]

## Getting Started

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

The encoder and decoder can be downloaded from:

```ts
const ENCODER_URL =
    'https://huggingface.co/g-ronimo/sam2-tiny/resolve/main/sam2_hiera_tiny_encoder.with_runtime_opt.ort';
const DECODER_URL =
    'https://huggingface.co/g-ronimo/sam2-tiny/resolve/main/sam2_hiera_tiny_decoder_pr1.onnx';
```

## Build

We use the following syntax so that vite will build webworker correctly.

```ts
import workerUrl from './worker.js?worker&url';
```

[AI API]: /reference/ai
[How to add machine learning to your web application with ONNX Runtime]: https://onnxruntime.ai/docs/tutorials/web/
[ORT model format]: https://onnxruntime.ai/docs/performance/model-optimizations/ort-format-models.html
[Using the WebGPU Execution Provider]: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
