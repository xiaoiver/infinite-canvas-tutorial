---
outline: deep
publish: false
---

<script setup>
import WebFontLoader from '../../components/WebFontLoader.vue';
import Opentype from '../../components/Opentype.vue';
import Harfbuzz from '../../components/Harfbuzz.vue';
import TeXMath from '../../components/TeXMath.vue';
</script>

# 课程 16 - 文本的高级特性

在上一节课中，我们介绍了基于 SDF 的文本渲染的原理，也尝试使用了 ESDT 和 MSDF 提升渲染质量，另外也提到过 CanvasKit 相比 Canvas 提供的文本高级绘制特性。

在本节课中，我们首先会来看看 SDF 之外的绘制方式，然后将讨论并尝试实现这些特性：装饰线、阴影、文本跟随路径，最后文本不光要能渲染，也要有良好的交互，我们讲讨论输入框、文本选中以及 A11y 这些话题。

首先我们来看看除了 SDF 之外，还有哪些文本渲染方式。

## 使用贝塞尔曲线渲染文本 {#render-text-with-bezier-curve}

使用 Figma 的导出 SVG 功能可以发现，它的文本也是使用 Path 渲染的。如果不考虑渲染性能和 CJK 字符，使用贝塞尔曲线渲染文本确实是不错的选择。为了得到字符的矢量信息，在浏览器环境可以使用：

-   [opentype.js]
-   use-gpu 使用的是基于 [ab-glyph](https://github.com/alexheretic/ab-glyph) 封装的 [use-gpu-text]
-   越来越多的应用使用 [harfbuzzjs]，详见：[State of Text Rendering 2024]。例如 [font-mesh-pipeline] 就是一个简单的示例

下面我们展示使用 opentype.js 和 harfbuzzjs 渲染文本的示例，他们都支持 `ttf` 格式的字体文件。

### opentype.js {#opentypejs}

opentype.js 提供了 `getPath` 方法，给定文本内容、位置和字体大小，就可以完成 Shaping 并获取 SVG commands。

```ts
opentype.load('fonts/Roboto-Black.ttf', function (err, font) {
    const path = font.getPath('Hello, World!', 0, 0, 32); // x, y, fontSize
    // convert to svg path definition
});
```

<Opentype />

### harfbuzzjs {#harfbuzzjs}

```ts
import init from 'harfbuzzjs/hb.wasm?init';
import hbjs, { HBBlob, HBFace, HBFont, HBHandle } from 'harfbuzzjs/hbjs.js';

init().then((instance) => {
    const hb = hbjs(instance);
});
```

<Harfbuzz />

## TeX math rendering {#tex-math-rendering}

我们可以使用 [MathJax] 来渲染 TeX 数学公式，将公式转换为 SVG 后，再使用 Path 渲染。这里我们参考 [LaTeX in motion-canvas] 的做法，得到 SVGElement：

```ts
const JaxDocument = mathjax.document('', {
    InputJax: new TeX({ packages: AllPackages }),
    OutputJax: new SVG({ fontCache: 'local' }),
});

const svg = Adaptor.innerHTML(JaxDocument.convert(formula));
const parser = new DOMParser();
const doc = parser.parseFromString(svg, 'image/svg+xml');
const $svg = doc.documentElement;
```

再使用 [课程 10 - 从 SVGElement 到序列化节点] 中介绍的方法将 SVGElement 转换为图形，添加到画布中。

```ts
const root = await deserializeNode(fromSVGElement($svg));
```

<TeXMath />

## 装饰线 {#text-decoration}

[text-decoration]

## 阴影 {#dropshadow}

[text-decoration]: https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration

Pixi.js 提供了 [DropShadowFilter] 来实现阴影效果。

```glsl
// @see https://github.com/soimy/pixi-msdf-text/blob/master/src/msdf.frag#L49
vec3 shadowSample = texture2D(uSampler, vTextureCoord - shadowOffset).rgb;
float shadowDist = median(shadowSample.r, shadowSample.g, shadowSample.b);
float distAlpha = smoothstep(0.5 - shadowSmoothing, 0.5 + shadowSmoothing, shadowDist);
vec4 shadow = vec4(shadowColor, shadowAlpha * distAlpha);
gl_FragColor = mix(shadow, text, text.a);
```

## 文本跟随路径 {#text-along-path}

在 Figma 社区中，很多用户都在期待这个特性，例如：[Make text follow a path or a circle]

在 SVG 中可以通过 [textPath] 实现，详见：[Curved Text Along a Path]

```html
<path
    id="curve"
    d="M73.2,148.6c4-6.1,65.5-96.8,178.6-95.6c111.3,1.2,170.8,90.3,175.1,97"
/>
<text width="500">
    <textPath xlink:href="#curve"> Dangerous Curves Ahead </textPath>
</text>
```

Skia 提供了 `MakeOnPath` 方法，详见 [Draw text along a path]：

```ts
const textblob = CanvasKit.TextBlob.MakeOnPath(text, skPath, skFont);
canvas.drawTextBlob(textblob, 0, 0, textPaint);
```

在 Mapbox 中沿道路河流放置 label 是很常见的场景，详见 [Map Label Placement in Mapbox GL]

![Map Label Placement in Mapbox GL](https://miro.medium.com/v2/resize:fit:480/format:webp/0*qVAASwC-tjIXnjax.gif)

## 更友好的交互方式 {#more-friendly-interaction}

### 输入框 {#textarea}

目前我们只实现了文本的绘制，实际在应用中，文本输入框是必不可少的。下图来自 Figma

![textarea in figma](/textarea-in-figma.png)

### 文本选中 {#text-selection}

## 特殊效果 {#special-effects}

### 加载 Web 字体 {#load-web-font}

对于使用 Canvas2D API 生成 SDF 的方案，只需要使用 [webfontloader] 先加载字体，再使用 `fontFamily` 指定字体即可。

```ts
import WebFont from 'webfontloader';
WebFont.load({
    google: {
        families: ['Gaegu'], // 指定字体
    },
    active: () => {
        const text = new Text({
            x: 150,
            y: 150,
            content: 'Hello, world',
            fontFamily: 'Gaegu', // 指定字体
            fontSize: 55,
            fill: '#F67676',
        });
    },
});
```

<WebFontLoader />

### Material Design on the GPU {#material-design-on-the-gpu}

[Material Design on the GPU]

## 扩展阅读 {#extended-reading}

-   [Material Design on the GPU]
-   [Make text follow a path or a circle]
-   [Curved Text Along a Path]
-   [Draw text along a path]
-   [textPath]
-   [Map Label Placement in Mapbox GL]

[Material Design on the GPU]: https://mattdesl.svbtle.com/material-design-on-the-gpu
[Make text follow a path or a circle]: https://forum.figma.com/t/make-text-follow-a-path-or-a-circle/23476/34
[Curved Text Along a Path]: https://css-tricks.com/snippets/svg/curved-text-along-path/
[Draw text along a path]: https://fiddle.skia.org/c/@Canvas_drawTextRSXform
[textPath]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/textPath
[Map Label Placement in Mapbox GL]: https://blog.mapbox.com/map-label-placement-in-mapbox-gl-c6f843a7caaa
[font-mesh-pipeline]: https://github.com/beanandbean/font-mesh-pipeline
[opentype.js]: https://github.com/opentypejs/opentype.js
[use-gpu-text]: https://gitlab.com/unconed/use.gpu/-/tree/master/rust/use-gpu-text
[harfbuzzjs]: https://github.com/harfbuzz/harfbuzzjs
[State of Text Rendering 2024]: https://behdad.org/text2024/
[webfontloader]: https://github.com/typekit/webfontloader
[DropShadowFilter]: https://pixijs.io/filters/docs/DropShadowFilter.html
[MathJax]: https://github.com/mathjax/MathJax-src
[LaTeX in motion-canvas]: https://github.com/motion-canvas/motion-canvas/issues/190
[课程 10 - 从 SVGElement 到序列化节点]: /zh/guide/lesson-010#svgelement-to-serialized-node
