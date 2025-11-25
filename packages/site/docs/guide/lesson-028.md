---
outline: deep
description: 'Integrating with AI, using chat dialogs with image generation models such as GPT 4o and Nano banana'
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

In this lesson, we'll first review traditional image processing methods based on Shader post-processing, then combine with Nano banana to enrich our image editing functionality.

<WhenCanvasMeetsChat />

## Post-processing Effects {#post-processing}

Based on Shaders, common image processing effects can be achieved, such as Gaussian blur, Perlin noise, Glitch, and of course, the recently popular "liquid glass":

![source: https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers](/figma-liquid-glass.png)

![Adjust in Photoshop Web](/adjust-ps-web.png)

For more effects, see: [Paper Shaders].

In implementation, [Pixi.js filters] calculate the application area based on the object's bounding box, render the object onto a temporary render texture, and then apply shader effects to that texture.

### Brightness {#brightness}

We can use the [CSS filter] syntax, for example `filter: brightness(0.4);`

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

In [Lesson 1 - Hardware abstraction layers], we introduced the advantages of WebGPU (Figma also recently upgraded its rendering engine). Beyond rendering, it makes browser-side GPGPU possible with Compute Shader support.

[Image Segmentation in the Browser with Segment Anything Model 2]

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

[Editing Text in Images with AI]

### Font recognition {#font-recognition}

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

## MCP

[MCP: What It Is and Why It Matters]：

> Instead of only having a GUI or API that humans use, you get an AI interface “for free.” This idea has led to the concept of “MCP-first development”, where you build the MCP server for your app before or alongside the GUI.

[Figma MCP Server] 可以操作 [Figma API]

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
[Paper Shaders]: https://shaders.paper.design/
[MCP: What It Is and Why It Matters]: https://addyo.substack.com/p/mcp-what-it-is-and-why-it-matters
[Figma MCP Server]: https://github.com/GLips/Figma-Context-MCP
[Figma API]: https://www.figma.com/developers/api
[Editing Text in Images with AI]: https://medium.com/data-science/editing-text-in-images-with-ai-03dee75d8b9c
[CSS filter]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter
[Pixi.js filters]: https://github.com/pixijs/filters
[whatfontis]: https://www.whatfontis.com/API-identify-fonts-from-image.html#font_Examples_good
[Match fonts]: https://helpx.adobe.com/photoshop/desktop/text-typography/select-manage-fonts/match-fonts.html
