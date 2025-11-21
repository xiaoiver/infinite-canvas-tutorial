---
outline: deep
description: '与 AI 结合，使用聊天对话框配合生图模型，例如 gpt 4o 和 nano banana'
head:
    - ['meta', { property: 'og:title', content: '课程 28 - 与 AI 结合' }]
---

<script setup>
import WhenCanvasMeetsChat from '../../components/WhenCanvasMeetsChat.vue'
</script>

# 课程 28 - 与 AI 结合

如今 GPT 4o（gpt-image-1）和 Nano banana（gemini-2.5-flash-image）大幅降低了图片编辑的门槛。从人机交互上看，聊天框和画布结合的形式正变得越来越流行，和模型的聊天记录天然体现了图片的修改历史，而可自由拖拽的画布让选择图片与并行处理变得自然，详见 [UI for AI]。

下图为 Lovart 的产品界面，底层使用了我们在 [课程 21 - Transformer] 中提及的 Konva.js。虽然以图片编辑为主，但并没有放弃图形编辑器中的常用功能，例如左下角默认隐藏了图层列表，左侧工具栏也可以插入一些基础图形。

![Lovart](/lovart.png)

Recraft 也正在测试聊天框功能。以我的观察，画布与聊天框正在成为这类编辑器的两大入口：

![Recraft chat](/recraft-chat.png)

本节课中我们会先回顾下传统基于 Shader 后处理的图像处理手段，再结合 Nano banana 丰富我们的图片编辑功能。

<WhenCanvasMeetsChat />

## 基于后处理的效果 {#post-processing}

基于 Shader 可以实现常见的图像处理效果，例如高斯模糊、Perlin 噪音、Glitch 等，当然还有最近火热的“液态玻璃”：

![source: https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers](/figma-liquid-glass.png)

![Adjust in Photoshop Web](/adjust-ps-web.png)

更多效果详见：[Paper Shaders]

### Brightness {#brightness}

## 接入模型 {#client-sdk}

为了使用 Nano banana，我选择了 [fal.ai]，而没有选择 Google 官方的 [generative-ai]。理由是统一的 API 更便于我对比其他生图模型的效果，例如 [qwen-image-edit] 或者 [FLUX.1 Kontext]。

这样的聚合类 SDK 还有很多例如 [OpenRouter]，以生图接口为例，只需要传入 prompt 就可以得到生成图片的 URL 和原始的模型文本响应：

```ts
import { fal } from '@fal-ai/client';

const result = await fal.subscribe('fal-ai/gemini-25-flash-image', {
    input: {
        prompt: '',
    },
});
console.log(result.data); // { image: [{ url: 'https://...' }]; description: 'Sure, this is your image:' }
```

图片修改接口接受的参数也是一组图片的 URL，即使传递了编码后的 DataURL 也会收到类似 “无法读取图片信息” 的警告。因此 [fal.ai] 提供了文件上传接口，我们可以选择当本地图片被添加到画布中时开启上传。

### API 设计 {#api-design}

### 加入聊天框 {#chatbox}

聊天框提供了画布之外的另一个起始点。

## Inpainting {#inpainting}

适合对画面中选定的已有对象进行擦除、修改，同时保证其他部分不变。

<https://www.recraft.ai/docs#inpaint-image>

> Inpainting replaces or modifies specific parts of an image. It uses a mask to identify the areas to be filled in, where white pixels represent the regions to inpaint, and black pixels indicate the areas to keep intact, i.e. the white pixels are filled based on the input provided in the prompt.

当用户使用简单的编辑器绘制了一个闭合区域后，需要转换成 mask 参数传给 API。这个 mask 其实就是一张灰度图：

![inpainting in gpt-4o](/inpainting.webp)

这里就体现出编辑器的重要性了，即便是简单的一些编辑功能也有价值，Recraft 提了三点：<https://www.recraft.ai/blog/inpainting-with-ai-how-to-edit-images-with-precision-using-recraft>

1. Ease of zooming in and out 毕竟是精细操作，画布的放大缩小很关键。
2. AI inpainting 利用 SAM 这样的分割模型自动
3. Creative flexibility

### 生成 mask {#create-mask}

我们可以提供多种交互方式让用户生成 mask：

1. [课程 26 - 选择工具] 中介绍的框选
2. [课程 25 - 绘制模式与笔刷] 中介绍的笔刷工具

### 通过 WebGPU 使用 SAM {#use-sam-via-webgpu}

除了让用户尽可能精细地表达修改区域，如果能通过更简单的方式，例如点选就完成区域的选择就更好了。

![Smart select in Midjourney](/midjourney-smart-select.jpeg)

在 [课程 1 - 硬件抽象层] 中我们就介绍过 WebGPU 的优势（Figma 也在近日升级了渲染引擎），除了渲染更是在 Compute Shader 的支持上让浏览器端 GPGPU 成为可能。

[Image Segmentation in the Browser with Segment Anything Model 2]

### 合并多张图片 {#combine-multiple-images}

使用画布能够额外获取图片的位置信息，通常很难用语言描述，例如我们可以将一个茶杯拖拽到桌面的任意位置并合成一张图片。

## Outpainting {#outpainting}

这个功能 OpenAI 暂时没有对应的 API 实现。先来看看 Recraft 是如何做的。<https://www.recraft.ai/blog/ai-outpainting-how-to-expand-images>

> Outpainting allows users to expand an image beyond its original frame — especially useful for completing cropped images or adding more background scenery.

适合保持画面中选中对象不变，例如更换背景：

![Outpainting in Recraft](/outpainting-fixed.webp)

或者向外扩展：

![Outpainting in Recraft](/outpainting.webp)

目前 GPT 4o 仅支持三种固定尺寸，而 Nano banana 想实现任意图片尺寸输出需要借助一些 hack 手段，例如传入一张指定尺寸的空白图作为参考图并在 prompt 中强调。我们可以通过画布操作让它变的十分自然：用户只需要拖拽到合适的尺寸即可，应用通过 Canvas API 自动生成这个空白的参考图。

## 自动分层 {#layer-separation}

[Editing Text in Images with AI]: https://medium.com/data-science/editing-text-in-images-with-ai-03dee75d8b9c

## MCP

来自 [MCP: What It Is and Why It Matters]：

> Instead of only having a GUI or API that humans use, you get an AI interface “for free.” This idea has led to the concept of “MCP-first development”, where you build the MCP server for your app before or alongside the GUI.

[Figma MCP Server] 可以操作 [Figma API]

[课程 21 - Transformer]: /zh/guide/lesson-021
[UI for AI]: https://medium.com/ui-for-ai
[课程 1 - 硬件抽象层]: /zh/guide/lesson-001#hardware-abstraction-layers
[Image Segmentation in the Browser with Segment Anything Model 2]: https://medium.com/@geronimo7/in-browser-image-segmentation-with-segment-anything-model-2-c72680170d92
[fal.ai]: https://fal.ai/
[OpenRouter]: https://openrouter.ai/
[qwen-image-edit]: https://fal.ai/models/fal-ai/qwen-image-edit
[FLUX.1 Kontext]: https://fal.ai/models/fal-ai/flux-pro/kontext
[generative-ai]: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions
[课程 26 - 选择工具]: /zh/guide/lesson-026#marquee-selection
[课程 25 - 绘制模式与笔刷]: /zh/guide/lesson-025#brush-mode
[Paper Shaders]: https://shaders.paper.design/
[MCP: What It Is and Why It Matters]: https://addyo.substack.com/p/mcp-what-it-is-and-why-it-matters
[Figma MCP Server]: https://github.com/GLips/Figma-Context-MCP
[Figma API]: https://www.figma.com/developers/api
[Editing Text in Images with AI]: https://medium.com/data-science/editing-text-in-images-with-ai-03dee75d8b9c
