---
outline: deep
publish: false
---

# RoughCircle

See SVG [circle].

```ts
const circle = new RoughCircle({
    cx: 400,
    cy: 150,
    r: 100,
    fill: 'red',
    strokeWidth: 10,
});
```

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false
circle = call(() => {
    const { Canvas, RoughCircle } = Core;
    const circle = new RoughCircle({
        cx: 400,
        cy: 150,
        r: 100,
        fill: 'red',
        stroke: 'black',
        strokeWidth: 10,
    });
    return circle;
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, RoughCircle } = Core;

    $icCanvas.parentElement.style.position = 'relative';

    $icCanvas.addEventListener('ic-ready', (e) => {
        const gui = new GUI({
            container: $icCanvas.parentElement,
        });
        const config = {
            cx: 400,
            cy: 150,
            r: 100,
            fill: '#ff0000',
            fillOpacity: 1,
            stroke: '#00000',
            strokeWidth: 10,
            strokeOpacity: 1,
            strokeAlignment: 'center',
            strokeDasharray: 0,
            strokeDashoffset: 0,
        };
        gui.add(config, 'cx', 100, 400, 1).onChange((cx) => {
            circle.cx = cx;
        });
        gui.add(config, 'cy', 100, 300, 1).onChange((cy) => {
            circle.cy = cy;
        });
        gui.add(config, 'r', 50, 300, 1).onChange((r) => {
            circle.r = r;
        });
        gui.addColor(config, 'fill').onChange((fill) => {
            circle.fill = fill;
        });
        gui.add(config, 'fillOpacity', 0, 1, 0.1).onChange((fillOpacity) => {
            circle.fillOpacity = fillOpacity;
        });
        gui.addColor(config, 'stroke').onChange((stroke) => {
            circle.stroke = stroke;
        });
        gui.add(config, 'strokeWidth', 0, 20, 1).onChange((strokeWidth) => {
            circle.strokeWidth = strokeWidth;
        });
        gui.add(config, 'strokeOpacity', 0, 1, 0.1).onChange(
            (strokeOpacity) => {
                circle.strokeOpacity = strokeOpacity;
            },
        );
        gui.add(config, 'strokeAlignment', [
            'center',
            'inner',
            'outer',
        ]).onChange((strokeAlignment) => {
            circle.strokeAlignment = strokeAlignment;
        });
        gui.add(config, 'strokeDasharray', 0, 20, 1).onChange(
            (strokeDasharray) => {
                circle.strokeDasharray = [strokeDasharray, strokeDasharray];
            },
        );
        gui.add(config, 'strokeDashoffset', 0, 50, 1).onChange(
            (strokeDashoffset) => {
                circle.strokeDashoffset = strokeDashoffset;
            },
        );

        const canvas = e.detail;
        canvas.appendChild(circle);
    });
});
```

## cx

The X-axis coordinate of the circle's center. Default value is `0`.

## cy

The Y-axis coordinate of the circle's center. Default value is `0`.

## r

Radius. Default value is `0`.

## strokeAlignment

Unlike SVG, this property has no equivalent. Possible values include `center`, `inner` and `outer`. Default value is `center`.

## strokeDasharray

Defines the pattern of dashes and gaps used to paint the stroke, refer to [stroke-dasharray]. Currently only supports the format of `[number, number]`. Default value is `[]`.

## strokeDashoffset

Defines the offset from the start of the path for the dash pattern, refer to [stroke-dashoffset]. Default value is `0`.

[circle]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle
[stroke-dashoffset]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dashoffset
[stroke-dasharray]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray
