---
outline: deep
publish: false
---

# Polyline

See SVG [polyline].

```ts
const polyline = new Polyline({
    points: [
        [300, 100],
        [400, 100],
        [400, 200],
        [500, 100],
    ],
    stroke: 'red',
    strokeWidth: 20,
});
```

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false
polyline = call(() => {
    const { Canvas, Polyline } = Core;
    const polyline = new Polyline({
        points: [
            [300, 100],
            [400, 100],
            [400, 200],
            [500, 100],
        ],
        stroke: 'red',
        strokeWidth: 20,
    });
    return polyline;
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas } = Core;

    const gui = new GUI({
        container: $icCanvas.parentElement,
    });
    const config = {
        strokeLinecap: 'butt',
        strokeLinejoin: 'miter',
        strokeMiterlimit: 4,
        strokeDasharray: 0,
        strokeDashoffset: 0,
        strokeAlignment: 'center',
        stroke: '#ff0000',
        strokeWidth: 20,
        strokeOpacity: 1,
    };
    gui.add(config, 'strokeAlignment', ['center', 'inner', 'outer']).onChange(
        (strokeAlignment) => {
            polyline.strokeAlignment = strokeAlignment;
        },
    );
    gui.add(config, 'strokeLinecap', ['butt', 'square', 'round']).onChange(
        (strokeLinecap) => {
            polyline.strokeLinecap = strokeLinecap;
        },
    );
    gui.add(config, 'strokeLinejoin', ['miter', 'bevel', 'round']).onChange(
        (strokeLinejoin) => {
            polyline.strokeLinejoin = strokeLinejoin;
        },
    );
    gui.add(config, 'strokeMiterlimit', 0, 10, 0.5).onChange(
        (strokeMiterlimit) => {
            polyline.strokeMiterlimit = strokeMiterlimit;
        },
    );
    gui.add(config, 'strokeDasharray', 0, 20, 1).onChange((strokeDasharray) => {
        polyline.strokeDasharray = [strokeDasharray, strokeDasharray];
    });
    gui.add(config, 'strokeDashoffset', 0, 50, 1).onChange(
        (strokeDashoffset) => {
            polyline.strokeDashoffset = strokeDashoffset;
        },
    );
    gui.addColor(config, 'stroke').onChange((stroke) => {
        polyline.stroke = stroke;
    });
    gui.add(config, 'strokeWidth', 0, 20, 1).onChange((strokeWidth) => {
        polyline.strokeWidth = strokeWidth;
    });
    gui.add(config, 'strokeOpacity', 0, 1, 0.1).onChange((strokeOpacity) => {
        polyline.strokeOpacity = strokeOpacity;
    });

    $icCanvas.parentElement.style.position = 'relative';

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        canvas.appendChild(polyline);
    });
});
```

## points

An array of vertex coordinates in the form of `[number, number][]`

[polyline]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/polyline

## strokeAlignment

Unlike SVG, this property has no equivalent. Possible values include `center`, `inner` and `outer`. Default value is `center`.

## strokeLinecap

The style of line endings, refer to [stroke-linecap]. Possible values are `butt`, `square` and `round`. Default value is `butt`.

## strokeLinejoin

The style of corners where lines meet, refer to [stroke-linejoin]. Possible values are `miter`, `bevel` and `round`. Default value is `miter`.

## strokeMiterlimit

Refer to [stroke-miterlimit]

> When two lines meet at a sharp angle and miter joins have been specified for `stroke-linejoin`, the miter length can exceed the `stroke-width` by a large amount. The `stroke-miterlimit` imposes a limit on the ratio of the miter length to the `stroke-width`. When the limit is reached, the join is converted from a miter to a bevel.

Default value is `4`.

## strokeDasharray

Defines the pattern of dashes and gaps used to paint the stroke, refer to [stroke-dasharray]. Currently only supports the format of `[number, number]`. Default value is `[]`.

## strokeDashoffset

Defines the offset from the start of the path for the dash pattern, refer to [stroke-dashoffset]. Default value is `0`.

## [WIP] fill

Refer to: [fill for polyline]

[stroke-linecap]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap
[stroke-linejoin]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linejoin
[stroke-miterlimit]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-miterlimit
[stroke-dashoffset]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dashoffset
[stroke-dasharray]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray
[fill for polyline]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill#polyline
