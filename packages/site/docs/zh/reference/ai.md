---
outline: deep
publish: false
---

通过实现相关接口提供各种 AI 功能，详见：[课程 28 - 与 AI 结合]。另外，在实际使用时应当将这些功能封装在服务端，以 API 形式提供给应用。

## upload

在调用模型能力时，一些静态资源例如图片必须是模型可访问的形式。该接口可以将本地文件例如 File 上传得到一个公网可访问的 URL：

```ts
upload(file: File): Promise<string> {}
```

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
): Promise<{ images: { url: string }[]; description: string }> {}
```

参数说明如下：

-   `isEdit` 是否是编辑模式
-   `prompt` 生成图片时的描述
-   `image_urls` 参考图列表，可以为空

一个使用 [fal.ai] 的例子如下：

```ts
import { fal } from '@fal-ai/client';

api.createOrEditImage = async (
    isEdit: boolean,
    prompt: string,
    image_urls: string[],
): Promise<{ images: { url: string }[]; description: string }> => {
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

## encodeImage

使用 SAM 对图片进行编码，用于后续的推理：

```ts
import { Tensor } from 'onnxruntime-web';

const { float32Array, shape } = canvasToFloat32Array(
    resizeCanvas(image, imageSize),
);
const imgTensor = new Tensor('float32', float32Array, shape);

await sam.encodeImage(imgTensor);
```

## segmentImage

使用 SAM 分割图片，生成 mask

```ts
segmentImage(params: {
    points: {
        x: number;
        y: number;
        xNormalized: number;
        yNormalized: number;
    }[],
}): Promise<any> {}
```

[课程 28 - 与 AI 结合]: /zh/guide/lesson-028
[fal.ai]: https://fal.ai/
