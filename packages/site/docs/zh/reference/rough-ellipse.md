---
outline: deep
publish: false
---

# RoughEllipse

参考 SVG [ellipse]。

```ts
const ellipse = new RoughEllipse({
    cx: 200,
    cy: 100,
    rx: 50,
    ry: 100,
    stroke: 'black',
    strokeWidth: 10,
});
```

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false
ellipse = call(() => {
    const { Canvas, RoughEllipse } = Core;
    const ellipse = new RoughEllipse({
        cx: 400,
        cy: 100,
        rx: 100,
        ry: 50,
        fill: 'red',
        stroke: 'black',
        strokeWidth: 10,
    });
    return ellipse;
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas } = Core;

    $icCanvas.parentElement.style.position = 'relative';

    $icCanvas.addEventListener('ic-ready', (e) => {
        const gui = new GUI({
            container: $icCanvas.parentElement,
        });
        const config = {
            cx: 400,
            cy: 100,
            rx: 100,
            ry: 50,
            fill: '#ff0000',
            fillOpacity: 1,
            stroke: '#00000',
            strokeWidth: 1,
            strokeOpacity: 1,
        };
        gui.add(config, 'cx', 100, 400, 1).onChange((cx) => {
            ellipse.cx = cx;
        });
        gui.add(config, 'cy', 100, 300, 1).onChange((cy) => {
            ellipse.cy = cy;
        });
        gui.add(config, 'rx', 50, 300, 1).onChange((rx) => {
            ellipse.rx = rx;
        });
        gui.add(config, 'ry', 50, 300, 1).onChange((ry) => {
            ellipse.ry = ry;
        });
        gui.addColor(config, 'fill').onChange((fill) => {
            ellipse.fill = fill;
        });
        gui.add(config, 'fillOpacity', 0, 1, 0.1).onChange((fillOpacity) => {
            ellipse.fillOpacity = fillOpacity;
        });
        gui.addColor(config, 'stroke').onChange((stroke) => {
            ellipse.stroke = stroke;
        });
        gui.add(config, 'strokeWidth', 0, 20, 1).onChange((strokeWidth) => {
            ellipse.strokeWidth = strokeWidth;
        });
        gui.add(config, 'strokeOpacity', 0, 1, 0.1).onChange(
            (strokeOpacity) => {
                ellipse.strokeOpacity = strokeOpacity;
            },
        );

        const canvas = e.detail;
        canvas.appendChild(ellipse);
    });
});
```

## cx

圆心在 X 轴上的坐标。默认值为 `0`。

## cy

圆心在 Y 轴上的坐标。默认值为 `0`。

## rx

X 轴半径。默认值为 `0`。

## ry

Y 轴半径。默认值为 `0`。

[ellipse]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/ellipse
