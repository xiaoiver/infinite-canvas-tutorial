---
outline: deep
publish: false
---

# Text

参考 SVG [text]，支持 Bitmap Font、MSDF、Emoji、双向文本等特性。

-   [使用 Bitmap Font 绘制文本](/zh/example/bitmap-font)
-   [使用 MSDF 绘制文本](/zh/example/msdf-text)
-   [绘制 Emoji](/zh/example/emoji)
-   [绘制双向文字](/zh/example/bidi)
-   [使用 HarfBuzz 绘制](/zh/example/harfbuzz)
-   [使用 Opentype.js 绘制](/zh/example/opentype)
-   [Physical Text](/zh/example/physical-text)

```ts
const text = new Text({
    x: 100,
    y: 100,
    content: 'Hello, World!',
    fontFamily: 'Arial',
    fontSize: 20,
    fontWeight: 'normal',
});
```

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false
text = call(() => {
    const { Canvas, Text } = Core;
    const text = new Text({
        x: 300,
        y: 100,
        content: 'Hello, World!\n你好，世界！🌞🌛',
        fontFamily: 'Arial',
        fontSize: 20,
        fontWeight: 'normal',
    });
    return text;
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas } = Core;
    $icCanvas.parentElement.style.position = 'relative';

    const gui = new GUI({
        container: $icCanvas.parentElement,
    });
    const config = {
        fill: '#000000',
        fontSize: 20,
        fontWeight: 'normal',
        fontStyle: 'normal',
        fontVariant: 'normal',
        letterSpacing: 0,
        textAlign: 'left',
        textBaseline: 'alphabetic',
    };
    gui.addColor(config, 'fill').onChange((fill) => {
        text.fill = fill;
    });
    gui.add(config, 'fontSize', 0, 80, 1).onChange((fontSize) => {
        text.fontSize = fontSize;
    });
    gui.add(config, 'fontWeight', ['normal', 'bold']).onChange((fontWeight) => {
        text.fontWeight = fontWeight;
    });
    gui.add(config, 'fontStyle', ['normal', 'italic']).onChange((fontStyle) => {
        text.fontStyle = fontStyle;
    });
    gui.add(config, 'fontVariant', ['normal', 'small-caps']).onChange(
        (fontVariant) => {
            text.fontVariant = fontVariant;
        },
    );
    gui.add(config, 'letterSpacing', -10, 10, 0.1).onChange((letterSpacing) => {
        text.letterSpacing = letterSpacing;
    });
    gui.add(config, 'textAlign', [
        'left',
        'center',
        'right',
        'start',
        'end',
    ]).onChange((textAlign) => {
        text.textAlign = textAlign;
    });
    gui.add(config, 'textBaseline', [
        'alphabetic',
        'hanging',
        'middle',
        'ideographic',
        'bottom',
        'top',
    ]).onChange((textBaseline) => {
        text.textBaseline = textBaseline;
    });
    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        canvas.appendChild(text);
    });
});
```

## x {#x}

文本的 X 轴坐标，参考 [x]。

## y {#y}

文本的 Y 轴坐标，参考 [y]。

## content {#content}

文本内容，SVG 中作为 `<text>` 元素的 `textContent` 属性。

## fontFamily {#font-family}

文本字体，参考 [fontFamily]。

## fontSize {#font-size}

文本字体大小，参考 [fontSize]。

## fontWeight {#font-weight}

文本字体粗细，参考 [fontWeight]。

## fontStyle {#font-style}

文本字体样式，参考 [fontStyle]。

## fontVariant {#font-variant}

文本字体变体，参考 [fontVariant]。

## letterSpacing {#letter-spacing}

文本字间距，参考 [letterSpacing]。

## textAlign {#text-align}

文本对齐方式，参考 [textAlign]。

```ts
type CanvasTextAlign = 'center' | 'end' | 'left' | 'right' | 'start';
```

## textBaseline {#text-baseline}

文本基线，参考 [textBaseline]。

```ts
type CanvasTextBaseline =
    | 'alphabetic'
    | 'bottom'
    | 'hanging'
    | 'ideographic'
    | 'middle'
    | 'top';
```

## lineHeight {#line-height}

文本行高，参考 [lineHeight]。

## leading {#leading}

文本行间距，参考 [leading]。

## bitmapFont {#bitmap-font}

文本位图字体。示例：

-   [使用 Bitmap Font 绘制文本](/zh/example/bitmap-font)
-   [使用 MSDF 绘制文本](/zh/example/msdf-text)

## bitmapFontKerning {#bitmap-font-kerning}

文本位图字体是否启用字间距。

## esdt {#esdt}

文本是否启用 ESDT 生成，否则使用 EDT。前者人工痕迹更少，后者性能更高。

## bidiChars {#bidi-chars}

获取处理后的双向文本，只读。示例：[绘制双向文字](/zh/example/bidi)

## dropShadowColor

外阴影颜色。参考：[CSS drop-shadow]。默认值为 `black`。

## dropShadowOffsetX

外阴影在 X 轴方向的偏移量。默认值为 `0`。

## dropShadowOffsetY

外阴影在 Y 轴方向的偏移量。默认值为 `0`。

## dropShadowBlurRadius

外阴影模糊半径，它的值越大，阴影就越大并越淡。默认值为 `0`。

## physical

是否启用物理文本，参考 [Physical Text](/example/physical-text)。

[text]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/text
[x]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute/x
[y]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute/y
[fontFamily]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute/font-family
[fontSize]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute/font-size
[fontWeight]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/font-weight
[fontStyle]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/font-style
[fontVariant]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/font-variant
[letterSpacing]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/letter-spacing
[lineHeight]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute/line-height
[textAlign]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/text-align
[textBaseline]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/text-baseline
[leading]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/leading
[CSS drop-shadow]: https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
