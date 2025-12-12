---
outline: deep
publish: false
---

Various AI functionalities are provided by implementing relevant interfaces. For details, see: [Lesson 28 - Integration with AI]. In practice, these functionalities should be encapsulated on the server side and provided to applications via API.

## upload

When calling model capabilities, some static resources such as images must be in a form accessible to the model. This interface can upload local files such as File to obtain a publicly accessible URL:

```ts
upload(file: File): Promise<string> {}
```

### fal.ai

A demonstration-only example using [fal.ai] is shown below, as it requires placing the KEY on the frontend:

```ts
import { fal } from '@fal-ai/client';

// Dangerous operation!
fal.config({
    credentials: '5e973660...',
});

api.upload = async (file: File) => {
    return await fal.storage.upload(file);
};
```

### AWS S3

A more reasonable example using AWS S3 is shown below. Place the KEY on the server side:

```ts
// backend-api.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Initialize S3 Client (backend environment typically reads credentials from environment variables)
const s3Client = new S3Client({
    region: 'us-east-1', // Your bucket region
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
```

After obtaining the signed upload URL on the frontend, upload the File directly to S3:

```ts
// 1. Request backend to get Presigned URL
const response = await fetch('/api/get-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
    }),
});

const { uploadUrl, key } = await response.json();

// 2. Upload file directly to S3 (Key point: Content-Type must match)
await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
        'Content-Type': file.type,
    },
    body: file,
});

// 3. Construct final access URL (assuming Bucket is publicly readable)
const finalUrl = `https://your-bucket-name.s3.us-east-1.amazonaws.com/${key}`;
```

## createOrEditImage

Provides the ability to generate or edit images. During editing, images will have a generating state:

```ts
createOrEditImage(
    isEdit: boolean,
    prompt: string,
    image_urls: string[],
): Promise<{ images: { url: string }[]; description: string }> {}
```

Parameter descriptions:

-   `isEdit` Whether it is in edit mode
-   `prompt` Description when generating images
-   `image_urls` Reference image list, can be empty

### fal.ai

An example using [fal.ai] is shown below:

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

## segmentImage

Segment images using SAM to generate masks

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
    image: HTMLCanvasElement;
}> {}
```

Parameter descriptions are as follows:

-   `image_url` Original image URL
-   `prompt`: Text prompt
-   `point_prompts`: List of target points
-   `box_prompts`: List of target bounding boxes

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

Decode in WebWorker:

```ts
// WebWorker
decodingResults = await sam.decode(points); // Tensor [B=1, Masks, W, H]
```

Use segment result in main thread:

```ts
const maskTensors = data.masks;
const [bs, noMasks, width, height] = maskTensors.dims;
const maskScores = data.iou_predictions.cpuData;
const bestMaskIdx = maskScores.indexOf(Math.max(...maskScores));
const bestMaskArray = sliceTensor(maskTensors, bestMaskIdx);
let bestMaskCanvas = float32ArrayToCanvas(bestMaskArray, width, height);
```

## encodeImage

Encoding images prior to edge-side inference can also be performed in a WebWorker.

```ts
encodeImage(image: string): Promise<void> {}
```

### ONNX

Encode images using SAM for subsequent inference:

```ts
import { Tensor } from 'onnxruntime-web';

const { float32Array, shape } = canvasToFloat32Array(
    resizeCanvas(image, imageSize),
);
const imgTensor = new Tensor('float32', float32Array, shape);

await sam.encodeImage(imgTensor);
```

[Lesson 28 - Integration with AI]: /guide/lesson-028
[fal.ai]: https://fal.ai/
