---
outline: deep
publish: false
---

# RoughRect

See SVG [rect].

```ts
const rect = new RoughRect({
    x: 200,
    y: 100,
    width: 100,
    height: 100,
    stroke: 'black',
    strokeWidth: 1,
});
```

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false
rect = call(() => {
    const { Canvas, RoughRect } = Core;
    const rect = new RoughRect({
        x: 400,
        y: 100,
        // width: 100,
        // height: 100,
        fill: 'red',
        stroke: 'black',
        strokeWidth: 1,
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
            // width: 100,
            // height: 100,
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
        // gui.add(config, 'width', 50, 300, 1).onChange((width) => {
        //     rect.width = width;
        // });
        // gui.add(config, 'height', 50, 300, 1).onChange((height) => {
        //     rect.height = height;
        // });
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

The X-axis coordinate of the rectangle's top-left corner. Default value is `0`.

## y

The Y-axis coordinate of the rectangle's top-left corner. Default value is `0`.

## width

Width. Unlike the same-named attribute in SVG, negative values are not supported yet. Default value is `0`.

## height

Height. Unlike the same-named attribute in SVG, negative values are not supported yet. Default value is `0`.

## cornerRadius

Corner radius. Unlike SVG where [rx] and [ry] are specified separately, currently only supports a single value. Default value is `0`.

## dropShadowColor

Drop shadow color. Reference: [CSS drop-shadow]. Default value is `black`.

## dropShadowOffsetX

Drop shadow offset along the X-axis. Default value is `0`.

## dropShadowOffsetY

Drop shadow offset along the Y-axis. Default value is `0`.

## dropShadowBlurRadius

Drop shadow blur radius. The larger the value, the bigger and more diffused the shadow becomes. Default value is `0`.

[rect]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/rect
[rx]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/rx
[ry]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/ry
[CSS drop-shadow]: https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
