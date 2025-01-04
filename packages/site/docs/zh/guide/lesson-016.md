---
outline: deep
publish: false
---

# 课程 16 - 文本的高级特性

在上一节课中，我们介绍了文本渲染的原理，其中提到过 CanvasKit 相比 Canvas 提供了文本的一些高级绘制特性。本节课我们就将讨论这些特性：

-   装饰线
-   阴影
-   文本选中
-   文本跟随路径

## 装饰线 {#text-decoration}

[text-decoration]

## 阴影 {#dropshadow}

[text-decoration]: https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration

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

## font-kerning

如果我们想获取 [font-kerning]，可以参考 <https://github.com/mapbox/tiny-sdf/issues/6#issuecomment-1532395796> 给出的方式：

![font-kerning](https://developer.mozilla.org/en-US/docs/Web/CSS/font-kerning/font-kerning.png)

```ts
const unkernedWidth =
    tinySdf.ctx.measureText('A').width + tinySdf.ctx.measureText('V').width;
const kernedWidth = tinySdf.ctx.measureText('AV').width;
const kerning = kernedWidth - unkernedWidth; // a negative value indicates you should adjust the SDFs closer together by that much
```

## 文本选中 {#text-selection}

## 加载字体 {#load-font}

## 扩展阅读 {#extended-reading}

[font-kerning]: https://developer.mozilla.org/en-US/docs/Web/CSS/font-kerning
[Make text follow a path or a circle]: https://forum.figma.com/t/make-text-follow-a-path-or-a-circle/23476/34
[Curved Text Along a Path]: https://css-tricks.com/snippets/svg/curved-text-along-path/
[Draw text along a path]: https://fiddle.skia.org/c/@Canvas_drawTextRSXform
[textPath]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/textPath
[Map Label Placement in Mapbox GL]: https://blog.mapbox.com/map-label-placement-in-mapbox-gl-c6f843a7caaa
