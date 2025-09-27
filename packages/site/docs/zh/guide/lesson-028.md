---
outline: deep
description: ''
---

# 课程 28 - 图像处理

如今 GPT 4o（gpt-image-1）和 Nano banana（gemini-2.5-flash-image）大幅降低了图片编辑的门槛。从人机交互上看，聊天框和画布结合的形式正变得越来越流行，和模型的聊天记录天然体现了图片的修改历史，而可自由拖拽的画布让选择图片与并行处理变得自然，详见 [UI for AI]。

下图为 Lovart 的产品界面，底层使用了我们在 [课程 21 - Transformer] 中提及的 Konva.js。虽然以图片编辑为主，但并没有放弃图形编辑器中的常用功能，例如左下角默认隐藏了图层列表，左侧工具栏也可以插入一些基础图形。

![Lovart](/lovart.png)

Recraft 也正在测试聊天框功能。以我的观察，画布与聊天框正在成为这类编辑器的两大入口：

![Recraft chat](/recraft-chat.png)

本节课中我们会先回顾下传统基于 Shader 后处理的图像处理手段，再结合 Nano banana 丰富我们的图片编辑功能。

## 基于后处理的效果 {#post-processing}

基于 Shader 可以实现常见的图像处理效果，例如高斯模糊、Perlin 噪音、Glitch 等，当然还有最近火热的“液态玻璃”：

![source: https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers](/figma-liquid-glass.png)

## 接入模型 {#client-sdk}

这里我们选择 [fal.ai]，这样的聚合类 SDK 还有很多例如 [OpenRouter]

```ts
import { fal } from '@fal-ai/client';

const result = await fal.subscribe('fal-ai/gemini-25-flash-image', {
    input: {
        prompt: '',
    },
});
console.log(result.data); // { image: []; description: '' }
```

## Inpainting {#inpainting}

适合对画面中选定的已有对象进行擦除、修改，同时保证其他部分不变。

https://www.recraft.ai/docs#inpaint-image

> Inpainting replaces or modifies specific parts of an image. It uses a mask to identify the areas to be filled in, where white pixels represent the regions to inpaint, and black pixels indicate the areas to keep intact, i.e. the white pixels are filled based on the input provided in the prompt.

当用户使用简单的编辑器绘制了一个闭合区域后，需要转换成 mask 参数传给 API。这个 mask 其实就是一张灰度图：

![inpainting in gpt-4o](https://cdn.gooo.ai/user-files/96bcc6bd74625b98424cbe309142542986173c3e14440bb8281aca455bdf2c55@large)

这里就体现出编辑器的重要性了，即便是简单的一些编辑功能也有价值，Recraft 提了三点：https://www.recraft.ai/blog/inpainting-with-ai-how-to-edit-images-with-precision-using-recraft

1. Ease of zooming in and out 毕竟是精细操作，画布的放大缩小很关键。
2. AI inpainting 利用 SAM 这样的分割模型自动
3. Creative flexibility

### 通过 WebGPU 使用 SAM {#use-sam-via-webgpu}

![Smart select in Midjourney](/midjourney-smart-select.jpeg)

在 [课程 1 - 硬件抽象层] 中我们就介绍过 WebGPU 的优势（Figma 也在近日升级了渲染引擎），除了渲染更是在 Compute Shader 的支持上让浏览器端 GPGPU 成为可能。

[Image Segmentation in the Browser with Segment Anything Model 2]

### 合并多张图片 {#combine-multiple-images}

使用画布能够额外获取图片的位置信息，通常很难用语言描述，例如我们可以将一个茶杯拖拽到桌面的任意位置并合成一张图片。

## Outpainting {#outpainting}

这个功能 OpenAI 暂时没有对应的 API 实现。先来看看 Recraft 是如何做的。https://www.recraft.ai/blog/ai-outpainting-how-to-expand-images

> Outpainting allows users to expand an image beyond its original frame — especially useful for completing cropped images or adding more background scenery.

适合保持画面中选中对象不变，例如更换背景：

![outpainting](https://cdn.gooo.ai/user-files/71f8b12a2d4e320394bf079f783a718d3d5df4591e337248628f868109da8cc6@large)

或者向外扩展：

![outpainting](https://cdn.gooo.ai/user-files/2972baf8ec8790ec5bfc764b51edb3ca0e7a8be67186136007dd171957f1f631@large)

目前 gpt-image-1 仅支持三种固定尺寸，而 nano banana 想实现任意图片尺寸输出需要借助一些 hack 手段，例如传入一张指定尺寸的空白图作为参考图并在 prompt 中强调。

而在画布操作中会变的十分自然，用户只需要拖拽到合适的尺寸即可，应用会自动生成这个空白的参考图。

[课程 21 - Transformer]: /zh/guide/lesson-021
[UI for AI]: https://medium.com/ui-for-ai
[课程 1 - 硬件抽象层]: /zh/guide/lesson-001#hardware-abstraction-layers
[Image Segmentation in the Browser with Segment Anything Model 2]: https://medium.com/@geronimo7/in-browser-image-segmentation-with-segment-anything-model-2-c72680170d92
[fal.ai]: https://fal.ai/
[OpenRouter]: https://openrouter.ai/
