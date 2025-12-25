---
outline: deep
publish: false
---

通过实现相关接口提供各种 AI 功能，详见：[课程 28 - 与 AI 结合]。另外，在实际使用时应当将这些功能封装在服务端，以 API 形式提供给应用。

## upload

在调用模型能力时，一些静态资源例如图片必须是模型可访问的形式。该接口可以将本地文件例如 File 上传得到一个公网可访问的 URL：

```ts
upload(file: File): Promise<string>;
```

### fal.ai

一个仅用于演示的、使用 [fal.ai] 的例子如下，因为它需要将 KEY 放在前端：

```ts
import { fal } from '@fal-ai/client';

// 危险操作！
fal.config({
    credentials: '5e973660...',
});

api.upload = async (file: File) => {
    return await fal.storage.upload(file);
};
```

### AWS S3

一个更合理的、使用 AWS S3 的例子如下。将 KEY 放在服务端：

```ts
// backend-api.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// 初始化 S3 Client (后端环境通常通过环境变量读取 credentials)
const s3Client = new S3Client({
    region: 'us-east-1', // 你的 bucket 区域
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
```

在前端获取加签后的上传地址后，将 File 直接上传到 S3：

```ts
// 1. 请求后端获取 Presigned URL
const response = await fetch('/api/get-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
    }),
});

const { uploadUrl, key } = await response.json();

// 2. 直接上传文件到 S3 (关键点：Content-Type 必须匹配)
await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
        'Content-Type': file.type,
    },
    body: file,
});

// 3. 拼接最终访问 URL (假设 Bucket 是公开读取的)
const finalUrl = `https://your-bucket-name.s3.us-east-1.amazonaws.com/${key}`;
```

## createOrEditImage

提供生成或者编辑图片的能力，在编辑过程中图片会有生成中状态：

```ts
createOrEditImage(
    isEdit: boolean,
    prompt: string,
    image_urls: string[],
): Promise<{ images: Image[]; description: string }>;
```

参数说明如下：

-   `isEdit` 是否是编辑模式
-   `prompt` 生成图片时的描述
-   `image_urls` 参考图列表，可以为空

```ts
interface Image {
    url?: string;
    canvas?: HTMLCanvasElement;
}
```

### fal.ai

一个使用 [fal.ai] 的例子如下：

```ts
import { fal } from '@fal-ai/client';

api.createOrEditImage = async (
    isEdit: boolean,
    prompt: string,
    image_urls: string[],
): Promise<{ images: Image[]; description: string }> => {
    const result = await fal.subscribe(
        isEdit
            ? 'fal-ai/gemini-25-flash-image/edit'
            : 'fal-ai/gemini-25-flash-image',
        {
            input: {
                prompt,
                image_urls,
            },
        },
    );
    return result.data;
};
```

## segmentImage

使用 SAM 分割图片，生成 mask

```ts
segmentImage(
    input: Partial<{
        image_url: string;
        prompt: string;
        point_prompts: PointPrompt[];
        box_prompts: BoxPrompt[];
    }>,
): Promise<{
    /**
     * Primary segmented mask preview
     */
    image: Image;
}>;
```

参数说明如下：

-   `image_url` 原始图片地址
-   `prompt` 文本 prompt
-   `point_prompts` 目标点列表
-   `box_prompts` 目标包围盒列表

```ts
interface PointPrompt {
    x: number;
    y: number;
    /**
     * 1 for foreground, 0 for background
     */
    label: number;
}

interface BoxPrompt {
    x_min: number;
    y_min: number;
    x_max: number;
    y_max: number;
}
```

### fal.ai

```ts
const result = await fal.subscribe('fal-ai/sam-3/image', {
    input: {
        image_url:
            'https://raw.githubusercontent.com/facebookresearch/segment-anything-2/main/notebooks/images/truck.jpg',
    },
});
```

### ONNX

为了不阻塞主线程，可以放在 WebWorker 中执行，详见 [SAM 插件]。

```ts
// WebWorker
decodingResults = await sam.decode(points); // Tensor [B=1, Masks, W, H]
```

在主线程接收分割结果：

```ts
const maskTensors = data.masks;
const [bs, noMasks, width, height] = maskTensors.dims;
const maskScores = data.iou_predictions.cpuData;
const bestMaskIdx = maskScores.indexOf(Math.max(...maskScores));
const bestMaskArray = sliceTensor(maskTensors, bestMaskIdx);
let bestMaskCanvas = float32ArrayToCanvas(bestMaskArray, width, height);
```

## encodeImage

在端侧推理前对图片进行编码，同样可以在 WebWorker 中进行。

```ts
encodeImage(image_url: string): Promise<void>;
```

### ONNX

使用 SAM 对图片进行编码，用于后续的推理，详见 [SAM 插件]：

```ts
import { Tensor } from 'onnxruntime-web';

const { float32Array, shape } = canvasToFloat32Array(
    resizeCanvas(image, imageSize),
);
const imgTensor = new Tensor('float32', float32Array, shape);

await sam.encodeImage(imgTensor);
```

## decomposeImage

将图片按语义分解成多个图层：

```ts
decomposeImage(input: {
    image_url: string;
    num_layers?: number;
}): Promise<{
    images: Image[];
}>;
```

### fal.ai

使用 Qwen-Image-Layered 将图片分解成多个图层：

```ts
const result = await fal.subscribe('fal-ai/qwen-image-layered', {
    input: {
        image_url,
        num_layers,
    },
});
```

## upscaleImage

```ts
 upscaleImage(input: {
    image_url: string;
    scale_factor?: number;
}): Promise<Image>;
```

### Tensorflow

使用 [upscalerjs] 实现，基于 tensorflow.js，详见：[Upscaler 插件]

## removeByMask

擦除 Mask 区域的内容

```ts
removeByMask(input: {
    image_url: string;
    mask: HTMLCanvasElement;
}): Promise<Image>;
```

### ONNX

使用 LaMa 进行擦除，详见：[LaMa 插件]

[课程 28 - 与 AI 结合]: /zh/guide/lesson-028
[fal.ai]: https://fal.ai/
[SAM 插件]: /zh/reference/sam
[LaMa 插件]: /zh/reference/lama
[Upscaler 插件]: /zh/reference/upscaler
[upscalerjs]: https://upscalerjs.com/
