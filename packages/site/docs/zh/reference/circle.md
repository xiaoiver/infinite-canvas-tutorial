---
outline: deep
publish: false
---

# Circle

参考 SVG [circle]。

```ts
const circle = new Circle({
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
    const { Canvas, Circle } = Core;
    const circle = new Circle({
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
    const { Canvas, Circle } = Core;

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

圆心在 X 轴上的坐标。默认值为 `0`。

## cy

圆心在 Y 轴上的坐标。默认值为 `0`。

## r

半径。默认值为 `0`。

## strokeAlignment

SVG 并不不存在同名属性，可选值包括 `center` `inner` 和 `outer`。默认值为 `center`。

## strokeDasharray

定义了描边的虚线段和间隙的排列形式，参考：[stroke-dasharray]，但暂时只支持包含两个值 `[number, number]` 的形式。默认值为 `[]`。

## strokeDashoffset

定义了虚线与路径起点之间的偏移量，参考：[stroke-dashoffset]。默认值为 `0`。

[circle]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle
[stroke-dashoffset]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute/stroke-dashoffset
[stroke-dasharray]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute/stroke-dasharray
