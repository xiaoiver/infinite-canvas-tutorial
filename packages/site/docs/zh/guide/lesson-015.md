---
outline: deep
publish: false
---

# 课程 15 - 文本渲染

文本渲染是一个非常复杂的过程，[State of Text Rendering 2024] 中给出了非常详细的介绍，强烈推荐你阅读这篇综述文章。

在这节课中你将学习到以下内容：

-   什么是文本度量 FontMetrics
-   使用 SDF 绘制

对于习惯了使用浏览器提供的 Canvas 2D [Drawing text] 或 SVG 的开发者来说，文本渲染的复杂性可能超出了你的想象。下图来自 [Modern text rendering with Linux: Overview]，它展示了文本渲染的数据流，从文本到字形，再到光栅化，最后绘制到屏幕上。其中 OpenType 是目前最流行的字体格式。

![The data flow of text rendering](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/overview.svg)

基于我之前在 Web 端可视化项目中的经验，[Text rendering in mapbox] 可能更具有实操层面的指导意义，毕竟我们不会直接接触上述工具链中的绝大部分。但尽可能多了解上述流程，有助于你理解文本渲染的本质。

## Shaping

什么是 Shaping 呢？下图来自 [Text rendering in mapbox]，简而言之就是放置一个个字符的位置，当然过程中需要考虑很多情况，例如遇到换行符：

![shaping](https://cloud.githubusercontent.com/assets/375121/22094138/068c663a-ddc0-11e6-8b70-3866cb8af02a.gif)

下图来自 [Modern text rendering with Linux: Overview]

![HarfBuzz](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/harfbuzz.svg)

越来越多的应用选择在 Web 端使用 [harfbuzzjs]，详见：[State of Text Rendering 2024]

> Using HarfBuzz on the web has been on the rise, first transpiled to JavaScript, and more recently cross-compiled to WebAssembly, through harfbuzzjs. Apps like Photopea, an online photo editor, use it that way. Crowbar by Simon Cozens is an OpenType shaping debugger web-app built using the HarfBuzz buffer-messaging API. Sploot is another web-app by Simon, a font inspector. Prezi and [Figma](https://www.figma.com/) also use HarfBuzz in their web-apps.

### Line breaking

换行需要考虑很多情况，例如：

-   遇到了显式换行符
-   自动换行，同时让每一行尽可能保持接近的长度，详见：[Beautifying map labels with better line breaking]

[mapbox-gl-js shaping.ts]

### BiDi

下图来自 [Text layout is a loose hierarchy of segmentation]

![layout pyramid](https://raphlinus.github.io/assets/layout_pyramid.svg)

[Improving Arabic and Hebrew text in map labels]

[What HarfBuzz doesn't do]

> HarfBuzz won't help you with bidirectionality.

[Text layout is a loose hierarchy of segmentation]

> At this point, we have a run of constant style, font, direction, and script. It is ready for shaping. Shaping is a complicated process that converts a string (sequence of Unicode code points) into positioned glyphs. For the purpose of this blog post, we can generally treat it as a black box. Fortunately, a very high quality open source implementation exists, in the form of [Harfbuzz].

[What HarfBuzz doesn't do]

> HarfBuzz can tell you how wide a shaped piece of text is, which is useful input to a justification algorithm, but it knows nothing about paragraphs, lines or line lengths. Nor will it adjust the space between words to fit them proportionally into a line.

## 使用 SDF 绘制 {#sdf}

[FreeType] 是字体渲染引擎

![FreeType](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/freetype.svg)

我们需要支持 CJK 这样的大文本量字符集，因此需要实时而非离线生成 SDF，详见：[Text rendering in mapbox]

## emoji

[EmojiEngine]

## 扩展阅读 {#extended-reading}

-   [State of Text Rendering 2024]
-   [use.gpu glyph]
-   [Easy Scalable Text Rendering on the GPU]
-   [Text Visualization Browser]
-   [Rive Text Overview]
-   [Material Design on the GPU]
-   [Texture-less Text Rendering]
-   [Text layout is a loose hierarchy of segmentation]
-   [End-To-End Tour of Text Layout/Rendering]
-   [Text rendering in mapbox]

[Drawing text]: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_text
[FreeType]: https://freetype.org/
[Easy Scalable Text Rendering on the GPU]: https://medium.com/@evanwallace/easy-scalable-text-rendering-on-the-gpu-c3f4d782c5ac
[use.gpu glyph]: https://gitlab.com/unconed/use.gpu/-/tree/master/packages/glyph
[Text Visualization Browser]: https://textvis.lnu.se
[State of Text Rendering 2024]: https://behdad.org/text2024/
[Rive Text Overview]: https://rive.app/community/doc/text-overview/docSfhykWoWu
[Material Design on the GPU]: https://mattdesl.svbtle.com/material-design-on-the-gpu
[Texture-less Text Rendering]: https://poniesandlight.co.uk/reflect/debug_print_text/
[Text layout is a loose hierarchy of segmentation]: https://raphlinus.github.io/text/2020/10/26/text-layout.html
[End-To-End Tour of Text Layout/Rendering]: https://litherum.blogspot.com/2015/02/end-to-end-tour-of-text-rendering.html
[Text rendering in mapbox]: https://github.com/mapbox/mapbox-gl-native/wiki/Text-Rendering
[Harfbuzz]: https://harfbuzz.github.io/what-is-harfbuzz.html
[harfbuzzjs]: https://github.com/harfbuzz/harfbuzzjs
[EmojiEngine]: https://github.com/trishume/EmojiEngine
[What HarfBuzz doesn't do]: https://harfbuzz.github.io/what-harfbuzz-doesnt-do.html
[Modern text rendering with Linux: Overview]: https://mrandri19.github.io/2019/07/24/modern-text-rendering-linux-overview.html
[Beautifying map labels with better line breaking]: https://blog.mapbox.com/beautifying-map-labels-with-better-line-breaking-2a6ce3ed432
[Improving Arabic and Hebrew text in map labels]: https://blog.mapbox.com/improving-arabic-and-hebrew-text-in-map-labels-fd184cf5ebd1
[mapbox-gl-js shaping.ts]: https://github.com/mapbox/mapbox-gl-js/blob/main/src/symbol/shaping.ts
