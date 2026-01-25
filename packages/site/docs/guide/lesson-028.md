---
outline: deep
description: 'Integrating with AI, using chat dialogs with image generation models such as GPT 4o and Nano banana. Use SAM to segment image in WebWorker, use LaMa for inpainting and upscale image with UpscalerJS.'
head:
    - [
          'meta',
          { property: 'og:title', content: 'Lesson 28 - Integrating with AI' },
      ]
---

<script setup>
import WhenCanvasMeetsChat from '../components/WhenCanvasMeetsChat.vue'
</script>

# Lesson 28 - Integrating with AI

Today, GPT 4o (gpt-image-1) and Nano banana (gemini-2.5-flash-image) have significantly lowered the barrier to image editing. From a human-computer interaction perspective, the combination of chat interfaces and canvas is becoming increasingly popular. Chat history with models naturally reflects the modification history of images, while freely draggable canvas makes image selection and parallel processing natural. For more details, see [UI for AI].

The image below shows Lovart's product interface, which uses Konva.js mentioned in our [Lesson 21 - Transformer] as the underlying technology. Although primarily focused on image editing, it doesn't abandon common features from graphic editors, such as the layer list hidden by default in the bottom left corner, and the left toolbar can also insert some basic shapes.

![Lovart](/lovart.png)

Recraft is also testing chat functionality. In my observation, canvas and chat are becoming the two main entry points for this type of editor:

![Recraft chat](/recraft-chat.png)

In this lesson, we'll combine with Nano banana to enrich our image editing functionality.

<WhenCanvasMeetsChat />

## Integrating Models {#client-sdk}

To use Nano banana, I chose [fal.ai] over Google's official [generative-ai]. The reason is that a unified API makes it easier for me to compare the effects of other image generation models, such as [qwen-image-edit] or [FLUX.1 Kontext].

There are many other aggregated SDKs like [OpenRouter]. Taking the image generation interface as an example, you only need to pass in a prompt to receive the URL for the generated image and the original model text response:

```ts
import { fal } from '@fal-ai/client';

const result = await fal.subscribe('fal-ai/gemini-25-flash-image', {
    input: {
        prompt: '',
    },
});
console.log(result.data); // { image: [{ url: 'https://...' }]; description: 'Sure, this is your image:' }
```

The image edit API also accepts a set of image URLs as parameters. Even when passing encoded DataURLs, warnings like “Unable to read image information” may still appear. Therefore, [fal.ai] provides a file upload interface, allowing us to enable uploads when local images are added to the canvas.

### API Design {#api-design}

We require an API responsible for generating and modifying images. In both scenarios, the parameters should be identical: a prompt and a list of reference images.

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

### Chatbox {#chatbox}

The chat box provides another starting point beyond the canvas.

### Remove background {#remove-background}

Double click image to enter edit mode:

```ts
private async removeBackground() {
    this.removingBackground = true;
    const { images } = await createOrEditImage(
        true,
        'Remove background from the image',
        [this.node.fill],
    );
    if (images.length > 0) {
        this.api.runAtNextTick(() => {
        this.api.updateNode(newImage, { fill: images[0].url });

        this.api.record();
        this.removingBackground = false;
        });
    }
}
```

## Inpainting {#inpainting}

Suitable for erasing or modifying selected existing objects in an image while ensuring other parts remain unchanged.

<https://www.recraft.ai/docs#inpaint-image>

> Inpainting replaces or modifies specific parts of an image. It uses a mask to identify the areas to be filled in, where white pixels represent the regions to inpaint, and black pixels indicate the areas to keep intact, i.e. the white pixels are filled based on the input provided in the prompt.

When users draw a closed area using a simple editor, it needs to be converted into a mask parameter to pass to the API. This mask is essentially a grayscale image:

![inpainting in gpt-4o](/inpainting.webp)

This is where the importance of editors becomes apparent. Even simple editing features have value. Recraft mentions three points: <https://www.recraft.ai/blog/inpainting-with-ai-how-to-edit-images-with-precision-using-recraft>

1. Ease of zooming in and out - After all, it's a precision operation, so canvas zooming is crucial.
2. AI inpainting using segmentation models like SAM automatically
3. Creative flexibility

### Create mask {#create-mask}

We offer multiple interactive methods for users to generate masks:

1. [Lesson 26 - Selection tool]
2. [Lesson 25 - Drawing mode and brush]

### Using SAM via WebGPU {#use-sam-via-webgpu}

In addition to allowing users to define the modification area as precisely as possible, it would be even better if area selection could be accomplished through simpler methods, such as clicking to select.

![Smart select in Midjourney](/midjourney-smart-select.jpeg)

In [Lesson 1 - Hardware abstraction layers], we introduced the advantages of WebGPU (Figma also recently upgraded its rendering engine). Beyond rendering, it makes browser-side GPGPU possible with Compute Shader support. ONNX provides a web-based runtime, enabling real-time inference directly in the browser without consuming any tokens. For details, see: [How to add machine learning to your web application with ONNX Runtime].

We refer to this article: [Image Segmentation in the Browser with Segment Anything Model 2] and implemented the following optimizations:

-   Utilized the [ORT model format] to reduce the size of downloaded models during runtime
-   Employed WebGPU for faster inference speeds. For details, see: [Using the WebGPU Execution Provider]
-   Executed within WebWorkers to avoid blocking the main thread

We wrap them up in [SAM plugin]. Here's our example: [Use SAM in WebWorker].

![SAM in WebWorker](/sam.gif)

For other practices and SAM3-related materials, please refer to:

-   [Segment Anything 2, in WebGPU]
-   [Request for Official ONNX Export + TensorRT Conversion Scripts for SAM3]

The mask obtained through SAM can be used as a reference image to feed into the raw image model.

### Using LaMa {#use-lama}

[Client-Side Image Inpainting with ONNX and Next.js] explains how to use the [LaMa] model on the client side.

### Combining Multiple Images {#combine-multiple-images}

Using canvas allows us to obtain additional positional information about images, which is often difficult to describe with language. For example, we can drag a teacup to any position on a desktop and composite an image.

## Outpainting {#outpainting}

This feature doesn't have a corresponding API implementation from OpenAI yet. Let's first see how Recraft does it. <https://www.recraft.ai/blog/ai-outpainting-how-to-expand-images>

> Outpainting allows users to expand an image beyond its original frame — especially useful for completing cropped images or adding more background scenery.

Suitable for keeping selected objects in the image unchanged, such as changing the background:

![Outpainting in Recraft](/outpainting-fixed.webp)

Or expanding outward:

![Outpainting in Recraft](/outpainting.webp)

Currently, GPT 4o only supports three fixed sizes, while Nano banana needs some hack methods to achieve arbitrary image size output, such as passing in a blank image of a specified size as a reference and emphasizing it in the prompt. We can make this very natural through canvas operations: users only need to drag to the appropriate size, and the application automatically generates this blank reference image through the Canvas API.

## Layer separation {#layer-separation}

-   [Editing Text in Images with AI]
-   [Move Anything with Layered Scene Diffusion]

### Raster to vector {#raster-to-vector}

Many online and open-source tools offer solutions based on traditional image processing:

-   Recraft [AI image vectorizer]
-   Lottiefiles [Raster to Vector converter]
-   [vtracer]

However, this approach does not yield satisfactory results for text processing:

![Raster to vector in lottiefiles. source: https://lottiefiles.com/tools/raster-to-vector](/lottiefiles-raster-vector.png)

The reason is that this algorithm is typically divided into the following stages, with the first stage not distinguishing between text and graphics suitable for vectorization:

1. “Path walking” converts pixels into paths
2. Paths are simplified into polygons
3. Attempts are made to smooth the polygons

![source: https://www.visioncortex.org/vtracer-docs#path-walking](https://www.visioncortex.org/public/vtracer/WalkerOptim.svg)

### Split background and text {#split-background-text}

First, use an OCR-like tool to identify text regions and generate a mask. Then, remove the mask and have the model regenerate the image through a standard inpainting process to obtain a background image without text.

[FLUX-Text: A Simple and Advanced Diffusion Transformer Baseline for Scene Text Editing]

![text editing with flux-text](/flux-text.png)

Using the open-source [Qwen-Image-Layered] enables layer decomposition. In the [fal.ai plugin], we achieved the following effect:

![Qwen-Image-Layered](/decompose-layers.gif)

### Font recognition {#font-recognition}

Next, we need to identify the style attributes such as font and font size within the text area.

[TextStyleBrush: Transfer of Text Aesthetics from a Single Example]

Adobe Photoshop provides [Match fonts]:

![Select a font from the list of similar fonts in the Match Fonts dialog box](https://helpx-prod.scene7.com/is/image/HelpxProd/A-sample-document-showing-an-image-with-the-text-s?$pjpeg$&jpegSize=300&wid=1600)

[whatfontis] provides a public API that matches the closest font in its font library to a specified area within an image.

```json
[
    {
        "title": "Abril Fatface",
        "url": "https://www.whatfontis.com/FF_Abril-Fatface.font",
        "image": "https://www.whatfontis.com/img16/A/B/FF_Abril-FatfaceA.png"
    }
]
```

Finally, overlay all the layers.

## Upscale image {#upscale-image}

We can upscale image with model, the following diff picture comes from [Topaz Gigapixel]:

![source: https://www.adobe.com/products/photoshop/image-upscaler.html](https://www.adobe.com/products/photoshop/media_1bef0720b9cf0858149ccc837fa56e1ed726defe6.jpg?width=2000&format=webply&optimize=medium)

We can use [fal-ai/topaz/upscale/image] or [SeedVR2] in fal.ai. In browser side, we can use [UpscalerJS] in webworker, see our [upscaler plugin], which uses `@upscalerjs/esrgan-medium 4x` model by default.

![@upscalerjs/esrgan-medium 4x](/upscaler.png)

### Other browser runtime {#other-browser-runtime}

[UpscalerJS] uses tensorflow.js, you can choose [super-resolution-js] with ONNX runtime, or a new runtime called LiteRT:

![Image upscaler with LiteRT.js](/image-upscaler.jpg)

## [WIP] MCP

[MCP: What It Is and Why It Matters]：

> Instead of only having a GUI or API that humans use, you get an AI interface “for free.” This idea has led to the concept of “MCP-first development”, where you build the MCP server for your app before or alongside the GUI.

### pencil.dev

The bi-directional MCP vector canvas you’ve been dreaming about. see [pencil.dev]

> Pencil doesn’t provide just MCP reading tools, but also full write access + many other handy tools to fully operate the canvas. This is the real magic. You can plug-in the whole world of MCPs, bring in data from other sources like databases, APIs, chart data, Playwright/Puppeteer or plugin other agents easily. You are in charge!

[Figma MCP Server] can manipulate [Figma API].

[Lesson 21 - Transformer]: /guide/lesson-021
[UI for AI]: https://medium.com/ui-for-ai
[Lesson 1 - Hardware abstraction layers]: /guide/lesson-001#hardware-abstraction-layers
[Image Segmentation in the Browser with Segment Anything Model 2]: https://medium.com/@geronimo7/in-browser-image-segmentation-with-segment-anything-model-2-c72680170d92
[fal.ai]: https://fal.ai/
[OpenRouter]: https://openrouter.ai/
[qwen-image-edit]: https://fal.ai/models/fal-ai/qwen-image-edit
[FLUX.1 Kontext]: https://fal.ai/models/fal-ai/flux-pro/kontext
[generative-ai]: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions
[Lesson 26 - Selection tool]: /guide/lesson-026#marquee-selection
[Lesson 25 - Drawing mode and brush]: /guide/lesson-025#brush-mode
[MCP: What It Is and Why It Matters]: https://addyo.substack.com/p/mcp-what-it-is-and-why-it-matters
[Figma MCP Server]: https://github.com/GLips/Figma-Context-MCP
[Figma API]: https://www.figma.com/developers/api
[Editing Text in Images with AI]: https://medium.com/data-science/editing-text-in-images-with-ai-03dee75d8b9c
[whatfontis]: https://www.whatfontis.com/API-identify-fonts-from-image.html#font_Examples_good
[Match fonts]: https://helpx.adobe.com/photoshop/desktop/text-typography/select-manage-fonts/match-fonts.html
[FLUX-Text: A Simple and Advanced Diffusion Transformer Baseline for Scene Text Editing]: https://arxiv.org/pdf/2505.03329
[TextStyleBrush: Transfer of Text Aesthetics from a Single Example]: https://arxiv.org/pdf/2106.08385
[Move Anything with Layered Scene Diffusion]: https://openaccess.thecvf.com/content/CVPR2024/papers/Ren_Move_Anything_with_Layered_Scene_Diffusion_CVPR_2024_paper.pdf
[Raster to Vector converter]: https://lottiefiles.com/tools/raster-to-vector
[AI image vectorizer]: https://www.recraft.ai/ai-image-vectorizer
[vtracer]: https://github.com/visioncortex/vtracer
[Segment Anything 2, in WebGPU]: https://lucasgelfond.online/software/webgpu-sam2/
[LaMa]: https://github.com/advimman/lama
[Client-Side Image Inpainting with ONNX and Next.js]: https://medium.com/@geronimo7/client-side-image-inpainting-with-onnx-and-next-js-3d9508dfd059
[Request for Official ONNX Export + TensorRT Conversion Scripts for SAM3]: https://github.com/facebookresearch/sam3/issues/224
[Use SAM in WebWorker]: /experiment/sam-in-worker
[SAM plugin]: /reference/sam
[fal.ai plugin]: /reference/fal
[upscaler plugin]: /reference/upscaler
[How to add machine learning to your web application with ONNX Runtime]: https://onnxruntime.ai/docs/tutorials/web/
[ORT model format]: https://onnxruntime.ai/docs/performance/model-optimizations/ort-format-models.html
[Using the WebGPU Execution Provider]: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
[Qwen-Image-Layered]: https://arxiv.org/pdf/2512.15603
[SeedVR2]: https://huggingface.co/ByteDance-Seed/SeedVR2-7B
[UpscalerJS]: https://upscalerjs.com/documentation/guides/browser/performance/webworker
[super-resolution-js]: https://github.com/josephrocca/super-resolution-js
[Topaz Gigapixel]: https://www.topazlabs.com/topaz-gigapixel
[fal-ai/topaz/upscale/image]: https://fal.ai/models/fal-ai/topaz/upscale/image/api
[pencil.dev]: https://www.pencil.dev/
