---
outline: deep
publish: false
---

# 课程 15 - 文本渲染

文本渲染是一个非常复杂的过程，[State of Text Rendering 2024] 中给出了非常详细的介绍，强烈推荐你阅读这篇综述文章。

在这节课中你将学习到以下内容：

-   什么是 TextMetrics，如何在服务端和浏览器端获取
-   什么是 Shaping
-   分段与自动换行、BiDi 和 cluster
-   如何生成 SDF atlas 并使用它绘制
-   如何处理 emoji

对于习惯了使用浏览器提供的 Canvas 2D [Drawing text] 或 SVG 的开发者来说，文本渲染的复杂性可能超出了你的想象。下图来自 [Modern text rendering with Linux: Overview]，它展示了文本渲染的数据流，从文本到字形，再到光栅化，最后绘制到屏幕上。其中涉及到的 [HarfBuzz]、[FreeType]、Bidi 我们后续会简单介绍，而 OpenType 是目前最流行的字体格式，有趣的是 HarfBuzz 就是 "open type" 的波斯语名。

![The data flow of text rendering](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/overview.svg)

基于我之前在 Web 端可视化项目中的经验，[Text rendering in mapbox] 可能更具有实操层面的指导意义，毕竟我们不会直接接触上述工具链中的绝大部分。但尽可能多了解上述流程，有助于你理解文本渲染的本质。

## Shaping

首先来看我们的输入，给定一段文本和字体，这个字体以 `fontstack` 形式给出，因此是一个数组：

```json
{
    "text-field": "Hey",
    "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"]
}
```

::: info fontstack
A fontstack is an ordered list consisting of a primary font and optional fallback font(s).
<https://docs.mapbox.com/help/troubleshooting/manage-fontstacks/>
:::

什么是 Shaping 呢？下图来自 [Text rendering in mapbox]，简而言之就是依次放置一个个字符的位置，当然过程中需要考虑很多情况，例如遇到换行符等：

![shaping](https://cloud.githubusercontent.com/assets/375121/22094138/068c663a-ddc0-11e6-8b70-3866cb8af02a.gif)

下图来自 [Modern text rendering with Linux: Overview]

![HarfBuzz](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/harfbuzz.svg)

要想正确放置字符的位置，我们就需要获取 TextMetrics，就算采用最简单的并排放置，也至少得知道每个字符的宽度。下面我们主要关注在浏览器端如何获取。

### TextMetrics

HTML 规范给出了 [TextMetrics] 的定义，分成水平和垂直两组：

```ts
// @see https://html.spec.whatwg.org/multipage/canvas.html#textmetrics
interface TextMetrics {
  // x-direction
  readonly attribute double width; // advance width
  readonly attribute double actualBoundingBoxLeft;
  readonly attribute double actualBoundingBoxRight;

  // y-direction
  readonly attribute double fontBoundingBoxAscent;
  readonly attribute double fontBoundingBoxDescent;
  readonly attribute double actualBoundingBoxAscent;
  readonly attribute double actualBoundingBoxDescent;
  readonly attribute double emHeightAscent;
  readonly attribute double emHeightDescent;
  readonly attribute double hangingBaseline;
  readonly attribute double alphabeticBaseline;
  readonly attribute double ideographicBaseline;
};
```

我们先关注水平方向上的三个属性。下图来自 [Differences between width and actualBoundingBoxLeft(Right)]，可以看到 `width` 和 `actualBoundingBoxLeft/Right` 的差异，简而言之后者代表了字符的最大边界（在垂直方向上 `actualBoundingBoxAscent/Descent` 同理），而前者（蓝色）完全有可能小于后者之和（红色+绿色），例如下图中右侧的斜体 `f`，考虑到 font-kerning，假如下一个字符仍是 `f`，那么这两个 `f` 可以并排穿插在一起。

![width and actualBoundingBoxLeft(Right)](/text-metrics.png)

再来看垂直方向的属性。下图来自 [Meaning of top, ascent, baseline, descent, bottom, and leading in Android's FontMetrics]。首先找到 `text-baseline`，`Ascent/Descent` 结尾的属性都是以它为基准的：

![Android's FontMetrics](/text-metrics2.png)

`text-baseline` 的取值可以参考 [text-baseline]，如下图所示。例如取 `hanging` 值时，`hangingBaseline` 的值就是 `0`，`alphabeticBaseline` 的值就是 `alphabetic` 到 `hanging` 的距离。

![text-baseline](/text-baseline.png)

最后 `fontBoundingBoxAscent/Descent` 是字体本身的最大边界，`actualBoundingBoxAscent/Descent` 是实际绘制时字体的最大边界，因此前者适合用来绘制一致的文本的背景，不会随内容变化而显得高低不平。

### measureText

如何获取 [TextMetrics] 呢？Canvas 2D API 提供了 [measureText]，但实际使用时需要考虑到只有 `width` 可用的情况。以 [PIXI.TextMetrics] 为例，在实现时就考虑到了这一点，如果 `actualBoundingBoxLeft/Right` 都为 `0`，则使用 `width`：

```ts
let textMetrics = PIXI.TextMetrics.measureText('Your text', style);

// @see https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/CanvasTextMetrics.ts#L334
const metrics = context.measureText(text);
let metricWidth = metrics.width;
const actualBoundingBoxLeft = -metrics.actualBoundingBoxLeft;
const actualBoundingBoxRight = metrics.actualBoundingBoxRight;
let boundsWidth = actualBoundingBoxRight - actualBoundingBoxLeft;
return Math.max(metricWidth, boundsWidth);
```

而对于字体相关的属性，选取了几个具有代表性的字符，确保能度量到 `Ascent/Descent`，实在获取不到则使用用户手动传入的 `fontSize` 值。

```ts
// @see https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/CanvasTextMetrics.ts#L779
context.font = font;
const metrics = context.measureText(
    CanvasTextMetrics.METRICS_STRING + // |ÉqÅ
        CanvasTextMetrics.BASELINE_SYMBOL, // M
);

const properties = {
    ascent: metrics.actualBoundingBoxAscent,
    descent: metrics.actualBoundingBoxDescent,
    fontSize:
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
};

if (fontProperties.fontSize === 0) {
    fontProperties.fontSize = style.fontSize as number;
    fontProperties.ascent = style.fontSize as number;
}
```

除了使用 Canvas 2D API，在浏览器端还有以下选择：

-   [opentype.js]
-   use-gpu 使用的是基于 [ab-glyph](https://github.com/alexheretic/ab-glyph) 封装的 [use-gpu-text]
-   越来越多的应用使用 [harfbuzzjs]，详见：[State of Text Rendering 2024]

> Using HarfBuzz on the web has been on the rise, first transpiled to JavaScript, and more recently cross-compiled to WebAssembly, through harfbuzzjs. Apps like Photopea, an online photo editor, use it that way. Crowbar by Simon Cozens is an OpenType shaping debugger web-app built using the HarfBuzz buffer-messaging API. Sploot is another web-app by Simon, a font inspector. Prezi and [Figma](https://www.figma.com/) also use HarfBuzz in their web-apps.

正如 [What HarfBuzz doesn't do] 中所说，仅仅解决单个字符的度量问题还远远不够，接下来我们先考虑 `letterSpacing`。

> HarfBuzz can tell you how wide a shaped piece of text is, which is useful input to a justification algorithm, but it knows nothing about paragraphs, lines or line lengths. Nor will it **adjust the space between words** to fit them proportionally into a line.

### letterSpacing

Canvas 2D API 提供了 [letterSpacing]，可以用来调整字符之间的间距。在度量文本前我们设置它：

```ts
measureText(
    text: string,
    letterSpacing: number, // [!code ++]
    context: ICanvasRenderingContext2D
) {
    context.letterSpacing = `${letterSpacing}px`; // [!code ++]
    // 省略度量过程
}
```

### font-kerning

[font-kerning]

![font-kerning](https://developer.mozilla.org/en-US/docs/Web/CSS/font-kerning/font-kerning.png)

<https://github.com/mapbox/tiny-sdf/issues/6#issuecomment-1532395796>

```ts
const unkernedWidth =
    tinySdf.ctx.measureText('A').width + tinySdf.ctx.measureText('V').width;
const kernedWidth = tinySdf.ctx.measureText('AV').width;
const kerning = kernedWidth - unkernedWidth; // a negative value indicates you should adjust the SDFs closer together by that much
```

## Paragraph layout

单个字符组合在一起形成了句子，句子又组成了段落。下图来自 [Text layout is a loose hierarchy of segmentation]，自底向上展示了文本布局的层次结构。

![layout pyramid](https://raphlinus.github.io/assets/layout_pyramid.svg)

Canvas 2D API 在文本绘制上并没有提供 paragraph 相关的能力，只有最基础的 [Drawing text] 功能。基于 Skia 实现的 CanvasKit 在此基础上进行了扩展，额外提供了 `drawParagraph` 方法，详见：[CanvasKit Text Shaping]

> One of the biggest features that CanvasKit offers over the HTML Canvas API is **paragraph shaping**.

```ts
const paragraph = builder.build();
paragraph.layout(290); // width in pixels to use when wrapping text
canvas.drawParagraph(paragraph, 10, 10);
```

我们先从分段开始实现。

### 分段 {#paragraph-segmentation}

最简单的分段依据就是显式换行符。

```ts
const newlines: number[] = [
    0x000a, // line feed
    0x000d, // carriage return
];
```

另外也需要考虑自动换行的情况。同时让每一行尽可能保持接近的长度，详见：[Beautifying map labels with better line breaking]

```ts
const breakingSpaces: number[] = [
    0x0009, // character tabulation
    0x0020, // space
    0x2000, // en quad
    0x2001, // em quad
    0x2002, // en space
    0x2003, // em space
    0x2004, // three-per-em space
    0x2005, // four-per-em space
    0x2006, // six-per-em space
    0x2008, // punctuation space
    0x2009, // thin space
    0x200a, // hair space
    0x205f, // medium mathematical space
    0x3000, // ideographic space
];
```

### BiDi

::: info Bidi
support for handling text containing a mixture of left to right (English) and right to left (Arabic or Hebrew) data.
:::

[Improving Arabic and Hebrew text in map labels]

[What HarfBuzz doesn't do]

> HarfBuzz won't help you with bidirectionality.

[Text layout is a loose hierarchy of segmentation]

> At this point, we have a run of constant style, font, direction, and script. It is ready for shaping. Shaping is a complicated process that converts a string (sequence of Unicode code points) into positioned glyphs. For the purpose of this blog post, we can generally treat it as a black box. Fortunately, a very high quality open source implementation exists, in the form of [Harfbuzz].

[bidi-js]

[mapbox-gl-rtl-text]

### cluster

[grapheme-splitter]

```ts
var splitter = new GraphemeSplitter();
// plain latin alphabet - nothing spectacular
splitter.splitGraphemes('abcd'); // returns ["a", "b", "c", "d"]
// two-char emojis and six-char combined emoji
splitter.splitGraphemes('🌷🎁💩😜👍🏳️‍🌈'); // returns ["🌷","🎁","💩","😜","👍","🏳️‍🌈"]
```

### text-align

[text-align]

![text-align](/text-align.png)

## 绘制 {#rendering}

下图是 [FreeType] 字体渲染引擎在流程中的位置：

![FreeType](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/freetype.svg)

让我们聚焦到具体的文本绘制技术。对于拉丁文字这种字符集有限的情况，完全可以离线生成一个 glyph atlas，运行时上传到 GPU 上，[freetype-gl] 就是这么实现的。

> The glyph atlas is a single image that will be uploaded as a texture to the GPU along with the rest of the data for the tile. Here’s a visual representation of a glyph atlas:

下图来自：[Drawing Text with Signed Distance Fields in Mapbox GL]

![glyph atlas](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*POsS7DlWOnqaJXI_.jpg)

但这种非矢量方式的问题是放大后字符会很模糊。目前主流基于 SDF 方案的思路来自 Valve 的论文，在缩放后依然保持清晰，但存在的问题是边缘处不够锐利，不过在可视化场景下容忍度较高，并且也可以通过 msdf 等方法进行一些优化。另外 SDF 也无法支持 [font hinting]。先来看单个字符的 SDF 生成情况。

### SDF 生成 {#generate-sdf}

下图来自 [msdf-atlas-gen]，我们重点关注 SDF 和 MSDF 这两种 atlas：

|                | Hard mask                                                                                                          | Soft mask                                                                                                          | SDF                                                                                                          | PSDF                                                                                                          | MSDF                                                                                                          | MTSDF                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
|                | ![Hard mask](https://user-images.githubusercontent.com/18639794/76163903-9eec9380-614a-11ea-92cb-d49485bbad31.png) | ![Soft mask](https://user-images.githubusercontent.com/18639794/76163904-a1e78400-614a-11ea-912a-b220fed081cb.png) | ![SDF](https://user-images.githubusercontent.com/18639794/76163905-a4e27480-614a-11ea-93eb-c80819a44e6e.png) | ![PSDF](https://user-images.githubusercontent.com/18639794/76163907-a6ac3800-614a-11ea-8d97-dafc1db6711d.png) | ![MSDF](https://user-images.githubusercontent.com/18639794/76163909-a9a72880-614a-11ea-9726-e825ee0dde94.png) | ![MTSDF](https://user-images.githubusercontent.com/18639794/76163910-ac098280-614a-11ea-8b6b-811d864cd584.png) |
| Channels:      | 1 (1-bit)                                                                                                          | 1                                                                                                                  | 1                                                                                                            | 1                                                                                                             | 3                                                                                                             | 4                                                                                                              |
| Anti-aliasing: | -                                                                                                                  | Yes                                                                                                                | Yes                                                                                                          | Yes                                                                                                           | Yes                                                                                                           | Yes                                                                                                            |
| Scalability:   | -                                                                                                                  | -                                                                                                                  | Yes                                                                                                          | Yes                                                                                                           | Yes                                                                                                           | Yes                                                                                                            |
| Sharp corners: | -                                                                                                                  | -                                                                                                                  | -                                                                                                            | -                                                                                                             | Yes                                                                                                           | Yes                                                                                                            |
| Soft effects:  | -                                                                                                                  | -                                                                                                                  | Yes                                                                                                          | -                                                                                                             | -                                                                                                             | Yes                                                                                                            |
| Hard effects:  | -                                                                                                                  | -                                                                                                                  | -                                                                                                            | Yes                                                                                                           | Yes                                                                                                           | Yes                                                                                                            |

如果允许离线生成，可以使用 [msdf-atlas-gen] 或者 [node-fontnik]（mapbox 使用它在服务端生成 protocol buffer 编码后的 SDF）。但考虑到 CJK 字符，在运行时生成可以用 [tinysdf](https://github.com/mapbox/tiny-sdf) ，使用方式如下，将字体相关的属性传入，得到。

```ts
const tinySdf = new TinySDF({
    fontSize: 24,
    fontFamily: 'sans-serif',
});
const glyph = tinySdf.draw('泽'); //
```

它使用浏览器 Canvas2D API 获取像素数据后生成，

### Glyph atlas

单个 SDF 需要合并成一个大图后续以纹理形式传入，合并算法使用 [potpack] 尽可能得到近似方形的结果。

![sdf texture](https://miro.medium.com/v2/resize:fit:1024/format:webp/0*YcJm5NJXJCIO20ds.png)

需要注意，这个 Atlas 包含了场景中使用的所有字体下的所有文本，因此当 `fontFamily/Weight` 改变、旧文本变更、新文本加入时都需要重新生成，但字号改变不应该重新生成。因此为了避免重新生成过于频繁，对于每一种字体，默认为 32-128 的常用字符生成。该纹理只需要使用一个通道即可，使用 `gl.ALPHA` 格式。在 Shader 中从 alpha 通道取有向距离：

```glsl
uniform sampler2D u_SDFMap; // atlas
varying vec2 v_UV; // 纹理映射

float dist = texture2D(u_SDFMap, v_UV).a;
```

### Generate quads

> The process of going from a shaping to GL buffers is pretty straightforward. It’s just a matter of taking each rectangular glyph from the shaping and turning it into two triangles (called a “quad”). We apply transforms like text rotation here, but essentially the way to think of it is just a translation between different in memory-representations of the same data.

## emoji

[EmojiEngine]

[mapbox-gl-js shaping.ts]

```ts
export type Shaping = {
    positionedLines: Array<PositionedLine>;
    top: number;
    bottom: number;
    left: number;
    right: number;
    writingMode: 1 | 2;
    text: string;
    iconsInText: boolean;
    verticalizable: boolean;
    hasBaseline: boolean;
};

export type PositionedLine = {
    positionedGlyphs: Array<PositionedGlyph>;
    lineOffset: number;
};

export type PositionedGlyph = {
    glyph: number;
    imageName: string | null;
    x: number;
    y: number;
    vertical: boolean;
    scale: number;
    fontStack: string;
    sectionIndex: number;
    metrics: GlyphMetrics;
    rect: GlyphRect | null;
    localGlyph?: boolean;
};
```

## 扩展阅读 {#extended-reading}

-   [State of Text Rendering 2024]
-   [Approaches to robust realtime text rendering in threejs (and WebGL in general)]
-   [Easy Scalable Text Rendering on the GPU]
-   [Text Visualization Browser]
-   [Rive Text Overview]
-   [Material Design on the GPU]
-   [Texture-less Text Rendering]
-   [Text layout is a loose hierarchy of segmentation]
-   [End-To-End Tour of Text Layout/Rendering]
-   [Text rendering in mapbox]
-   [Texture-less Text Rendering]

[Drawing text]: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_text
[FreeType]: https://freetype.org/
[freetype-gl]: https://github.com/rougier/freetype-gl
[Easy Scalable Text Rendering on the GPU]: https://medium.com/@evanwallace/easy-scalable-text-rendering-on-the-gpu-c3f4d782c5ac
[use-gpu-text]: https://gitlab.com/unconed/use.gpu/-/tree/master/rust/use-gpu-text
[Text Visualization Browser]: https://textvis.lnu.se
[State of Text Rendering 2024]: https://behdad.org/text2024/
[Rive Text Overview]: https://rive.app/community/doc/text-overview/docSfhykWoWu
[Material Design on the GPU]: https://mattdesl.svbtle.com/material-design-on-the-gpu
[Texture-less Text Rendering]: https://poniesandlight.co.uk/reflect/debug_print_text/
[Text layout is a loose hierarchy of segmentation]: https://raphlinus.github.io/text/2020/10/26/text-layout.html
[End-To-End Tour of Text Layout/Rendering]: https://litherum.blogspot.com/2015/02/end-to-end-tour-of-text-rendering.html
[Text rendering in mapbox]: https://github.com/mapbox/mapbox-gl-native/wiki/Text-Rendering
[HarfBuzz]: https://harfbuzz.github.io/what-is-harfbuzz.html
[harfbuzzjs]: https://github.com/harfbuzz/harfbuzzjs
[EmojiEngine]: https://github.com/trishume/EmojiEngine
[What HarfBuzz doesn't do]: https://harfbuzz.github.io/what-harfbuzz-doesnt-do.html
[Modern text rendering with Linux: Overview]: https://mrandri19.github.io/2019/07/24/modern-text-rendering-linux-overview.html
[Beautifying map labels with better line breaking]: https://blog.mapbox.com/beautifying-map-labels-with-better-line-breaking-2a6ce3ed432
[Improving Arabic and Hebrew text in map labels]: https://blog.mapbox.com/improving-arabic-and-hebrew-text-in-map-labels-fd184cf5ebd1
[mapbox-gl-js shaping.ts]: https://github.com/mapbox/mapbox-gl-js/blob/main/src/symbol/shaping.ts
[Drawing Text with Signed Distance Fields in Mapbox GL]: https://blog.mapbox.com/drawing-text-with-signed-distance-fields-in-mapbox-gl-b0933af6f817
[font hinting]: http://en.wikipedia.org/wiki/Font_hinting
[potpack]: https://github.com/mapbox/potpack
[bidi-js]: https://github.com/lojjic/bidi-js
[mapbox-gl-rtl-text]: https://github.com/mapbox/mapbox-gl-rtl-text
[Approaches to robust realtime text rendering in threejs (and WebGL in general)]: https://github.com/harfbuzz/harfbuzzjs/discussions/30
[TextMetrics]: https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics
[Differences between width and actualBoundingBoxLeft(Right)]: https://stackoverflow.com/a/66846914/4639324
[Meaning of top, ascent, baseline, descent, bottom, and leading in Android's FontMetrics]: https://stackoverflow.com/questions/27631736/meaning-of-top-ascent-baseline-descent-bottom-and-leading-in-androids-font
[node-fontnik]: https://github.com/mapbox/node-fontnik
[opentype.js]: https://github.com/opentypejs/opentype.js
[msdf-atlas-gen]: https://github.com/Chlumsky/msdf-atlas-gen?tab=readme-ov-file#atlas-types
[measureText]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText
[font-kerning]: https://developer.mozilla.org/en-US/docs/Web/CSS/font-kerning
[text-baseline]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
[text-align]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textAlign
[PIXI.TextMetrics]: https://api.pixijs.io/@pixi/text/PIXI/TextMetrics.html
[letterSpacing]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/letterSpacing
[grapheme-splitter]: https://github.com/orling/grapheme-splitter
[CanvasKit Text Shaping]: https://skia.org/docs/user/modules/quickstart/#text-shaping
