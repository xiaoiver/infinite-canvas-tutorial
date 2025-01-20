---
outline: deep
publish: false
---

# Path

参考 SVG [path].

```ts
const path = new Path({
    d: 'M 100 100 L 200 200 L 300 100 Z',
    stroke: 'red',
    strokeWidth: 20,
    fill: 'blue',
});
```

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false
path = call(() => {
    const { Canvas, Path } = Core;
    const path = new Path({
        d: 'M 100 100 L 200 200 L 300 100 Z',
        stroke: 'red',
        strokeWidth: 20,
        fill: 'blue',
    });
    path.position.x = 250;
    return path;
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
        fill: '#0000ff',
    };
    gui.add(config, 'strokeAlignment', ['center', 'inner', 'outer']).onChange(
        (strokeAlignment) => {
            path.strokeAlignment = strokeAlignment;
        },
    );
    gui.add(config, 'strokeLinecap', ['butt', 'square', 'round']).onChange(
        (strokeLinecap) => {
            path.strokeLinecap = strokeLinecap;
        },
    );
    gui.add(config, 'strokeLinejoin', ['miter', 'bevel', 'round']).onChange(
        (strokeLinejoin) => {
            path.strokeLinejoin = strokeLinejoin;
        },
    );
    gui.add(config, 'strokeMiterlimit', 0, 10, 0.5).onChange(
        (strokeMiterlimit) => {
            path.strokeMiterlimit = strokeMiterlimit;
        },
    );
    gui.add(config, 'strokeDasharray', 0, 20, 1).onChange((strokeDasharray) => {
        path.strokeDasharray = [strokeDasharray, strokeDasharray];
    });
    gui.add(config, 'strokeDashoffset', 0, 50, 1).onChange(
        (strokeDashoffset) => {
            path.strokeDashoffset = strokeDashoffset;
        },
    );
    gui.addColor(config, 'stroke').onChange((stroke) => {
        path.stroke = stroke;
    });
    gui.add(config, 'strokeWidth', 0, 20, 1).onChange((strokeWidth) => {
        path.strokeWidth = strokeWidth;
    });
    gui.add(config, 'strokeOpacity', 0, 1, 0.1).onChange((strokeOpacity) => {
        path.strokeOpacity = strokeOpacity;
    });
    gui.addColor(config, 'fill').onChange((fill) => {
        path.fill = fill;
    });

    $icCanvas.parentElement.style.position = 'relative';

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        canvas.appendChild(path);
    });
});
```

## d {#d}

参考 SVG [d] 属性，它是一个包含一组路径命令的字符串，用于定义要绘制的路径。

## tessellationMethod {#tessellation-method}

三角化方法，默认值为 `TesselationMethod.EARCUT`。

```ts
export enum TesselationMethod {
    EARCUT,
    LIBTESS,
}
```

`TesselationMethod.LIBTESS` 虽然性能不佳，但精确性更高，详见 [Lesson 013](/zh/guide/lesson-013#other-tesselation-techniques)。

[path]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/path
[d]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute/d
