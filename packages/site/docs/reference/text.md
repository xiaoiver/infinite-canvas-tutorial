---
outline: deep
publish: false
---

# Text

See SVG [text], supporting features like Bitmap Font, MSDF, Emoji, and bidirectional text.

-   [Drawing Text with Bitmap Font](/example/bitmap-font)
-   [Drawing Text with MSDF](/example/msdf-text)
-   [Drawing Emoji](/example/emoji)
-   [Drawing Bidirectional Text](/example/bidi)
-   [Drawing with HarfBuzz](/example/harfbuzz)
-   [Drawing with Opentype.js](/example/opentype)

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

The X-axis coordinate of the text, refer to [x].

## y {#y}

The Y-axis coordinate of the text, refer to [y].

## content {#content}

Text content, equivalent to the `textContent` property of the `<text>` element in SVG.

## fontFamily {#font-family}

Text font family, refer to [fontFamily].

## fontSize {#font-size}

Text font size, refer to [fontSize].

## fontWeight {#font-weight}

Text font weight, refer to [fontWeight].

## fontStyle {#font-style}

Text font style, refer to [fontStyle].

## fontVariant {#font-variant}

Text font variant, refer to [fontVariant].

## letterSpacing {#letter-spacing}

Text letter spacing, refer to [letterSpacing].

## textAlign {#text-align}

Text alignment, refer to [textAlign].

```ts
type CanvasTextAlign = 'center' | 'end' | 'left' | 'right' | 'start';
```

## textBaseline {#text-baseline}

Text baseline, refer to [textBaseline].

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

Text line height, refer to [lineHeight].

## leading {#leading}

Text leading (space between lines), refer to [leading].

## bitmapFont {#bitmap-font}

Text bitmap font. Examples:

-   [Drawing Text with Bitmap Font](/example/bitmap-font)
-   [Drawing Text with MSDF](/example/msdf-text)

## bitmapFontKerning {#bitmap-font-kerning}

Whether to enable kerning for bitmap fonts.

## esdt {#esdt}

Whether to enable ESDT generation for text, otherwise use EDT. The former has less artificial artifacts, while the latter has better performance.

## bidiChars {#bidi-chars}

Get the processed bidirectional text, readonly. Example: [Drawing Bidirectional Text](/example/bidi)

## dropShadowColor

Drop shadow color. Reference: [CSS drop-shadow]. Default value is `black`.

## dropShadowOffsetX

Drop shadow offset along the X-axis. Default value is `0`.

## dropShadowOffsetY

Drop shadow offset along the Y-axis. Default value is `0`.

## dropShadowBlurRadius

Drop shadow blur radius. The larger the value, the bigger and more diffused the shadow becomes. Default value is `0`.

[text]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/text
[x]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/x
[y]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/y
[fontFamily]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/font-family
[fontSize]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/font-size
[fontWeight]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/font-weight
[fontStyle]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/font-style
[fontVariant]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/font-variant
[letterSpacing]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/letter-spacing
[lineHeight]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/line-height
[textAlign]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/text-align
[textBaseline]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/text-baseline
[leading]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/leading
[CSS drop-shadow]: https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
