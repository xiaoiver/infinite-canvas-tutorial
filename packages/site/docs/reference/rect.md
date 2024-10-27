---
outline: deep
publish: false
---

# Rect

参考 SVG [rect]。

```ts
const rect = new Rect({ x: 200, y: 100, width: 100, height: 100 });
```

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false
rect = call(() => {
    const { Canvas, Rect } = Core;
    const rect = new Rect({
        x: 400,
        y: 100,
        // width: 100,
        // height: 100,
        fill: 'red',
        dropShadowColor: 'black',
        dropShadowOffsetX: 10,
        dropShadowOffsetY: 10,
        dropShadowBlurRadius: 20,
    });
    rect.width = 100;
    rect.height = 100;
    return rect;
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas } = Core;

    $icCanvas.addEventListener('ic-ready', (e) => {
        const gui = new GUI({
            container: $icCanvas.parentElement,
        });
        const config = {
            x: 400,
            y: 100,
            width: 100,
            height: 100,
            fill: '#ff0000',
            fillOpacity: 1,
            stroke: '#00000',
            strokeWidth: 1,
            strokeOpacity: 1,
            cornerRadius: 0,
            dropShadowColor: '#000000',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            dropShadowBlurRadius: 20,
        };
        gui.add(config, 'x', 100, 400, 1).onChange((x) => {
            rect.x = x;
        });
        gui.add(config, 'y', 100, 300, 1).onChange((y) => {
            rect.y = y;
        });
        gui.add(config, 'width', 50, 300, 1).onChange((width) => {
            rect.width = width;
        });
        gui.add(config, 'height', 50, 300, 1).onChange((height) => {
            rect.height = height;
        });
        gui.add(config, 'cornerRadius', 0, 10, 1).onChange((cornerRadius) => {
            rect.cornerRadius = cornerRadius;
        });
        gui.addColor(config, 'fill').onChange((fill) => {
            rect.fill = fill;
        });
        gui.add(config, 'fillOpacity', 0, 1, 0.1).onChange((fillOpacity) => {
            rect.fillOpacity = fillOpacity;
        });
        gui.addColor(config, 'stroke').onChange((stroke) => {
            rect.stroke = stroke;
        });
        gui.add(config, 'strokeWidth', 0, 20, 1).onChange((strokeWidth) => {
            rect.strokeWidth = strokeWidth;
        });
        gui.add(config, 'strokeOpacity', 0, 1, 0.1).onChange(
            (strokeOpacity) => {
                rect.strokeOpacity = strokeOpacity;
            },
        );
        gui.add(config, 'dropShadowOffsetX', -10, 10, 1).onChange(
            (dropShadowOffsetX) => {
                rect.dropShadowOffsetX = dropShadowOffsetX;
            },
        );
        gui.add(config, 'dropShadowOffsetY', -10, 10, 1).onChange(
            (dropShadowOffsetY) => {
                rect.dropShadowOffsetY = dropShadowOffsetY;
            },
        );
        gui.add(config, 'dropShadowBlurRadius', 1, 40, 1).onChange(
            (dropShadowBlurRadius) => {
                rect.dropShadowBlurRadius = dropShadowBlurRadius;
            },
        );

        $icCanvas.parentElement.style.position = 'relative';

        const canvas = e.detail;
        canvas.appendChild(rect);
    });
});
```

## x

矩形左上角的 X 轴坐标。默认值为 `0`。

## y

矩形左上角的 Y 轴坐标。默认值为 `0`。

## width

宽度。与 SVG 中同名属性不同，暂不支持负值。默认值为 `0`。

## height

高度。与 SVG 中同名属性不同，暂不支持负值。默认值为 `0`。

## cornerRadius

圆角。与 SVG 中通过 [rx] 和 [ry] 指定不同，暂时仅支持使用单一值。默认值为 `0`。

## dropShadowColor

外阴影颜色。参考：[CSS drop-shadow]。默认值为 `black`。

## dropShadowOffsetX

外阴影在 X 轴方向的偏移量。默认值为 `0`。

## dropShadowOffsetY

外阴影在 Y 轴方向的偏移量。默认值为 `0`。

## dropShadowBlurRadius

外阴影模糊半径，它的值越大，阴影就越大并越淡。默认值为 `0`。

## innerShadowColor

内阴影颜色。默认值为 `black`。

## innerShadowOffsetX

内阴影在 X 轴方向的偏移量。默认值为 `0`。

## innerShadowOffsetY

内阴影在 X 轴方向的偏移量。默认值为 `0`。

## innerShadowBlurRadius

内阴影模糊半径，它的值越大，阴影就越大并越淡。默认值为 `0`。

[rect]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/rect
[rx]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/rx
[ry]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/ry
[CSS drop-shadow]: https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
