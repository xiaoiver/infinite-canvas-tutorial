---
outline: deep
publish: false
---

# RoughPolyline

参考 SVG [polyline]。

```ts
const polyline = new RoughPolyline({
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
    const { Canvas, RoughPolyline } = Core;
    const polyline = new RoughPolyline({
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

一组顶点坐标，形如 `[number, number][]`

[polyline]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/polyline

## strokeAlignment

SVG 并不不存在同名属性，可选值包括 `center` `inner` 和 `outer`。默认值为 `center`。

## strokeLinecap

描边端点样式，参考：[stroke-linecap]，可选值为 `butt` `square` 和 `round`。默认值为 `butt`。

## strokeLinejoin

描边接头样式，参考：[stroke-linejoin]，可选值为 `miter` `bevel` 和 `round`。默认值为 `miter`。

## strokeMiterlimit

参考：[stroke-miterlimit]

> 如果两条线交汇在一起形成一个尖角，而且属性 `stroke-linejoin` 指定了 `miter`，斜接有可能扩展到远远超过出路径轮廓线的线宽。属性 `stroke-miterlimit` 对斜接长度和 `stroke-width` 的比率强加了一个极限。当极限到达时，交汇处由斜接变成倒角。

默认值为 `4`。

## strokeDasharray

定义了描边的虚线段和间隙的排列形式，参考：[stroke-dasharray]，但暂时只支持包含两个值 `[number, number]` 的形式。默认值为 `[]`。

## strokeDashoffset

定义了虚线与路径起点之间的偏移量，参考：[stroke-dashoffset]。默认值为 `0`。

## [WIP] fill

参考：[fill for polyline]

## [WIP] sizeAttenuation

[stroke-linecap]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap
[stroke-linejoin]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linejoin
[stroke-miterlimit]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-miterlimit
[stroke-dashoffset]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute/stroke-dashoffset
[stroke-dasharray]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute/stroke-dasharray
[fill for polyline]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill#polyline
