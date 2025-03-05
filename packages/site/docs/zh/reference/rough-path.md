---
outline: deep
publish: false
---

<script setup>
import Holes from '../../components/Holes.vue';
import FillRule from '../../components/FillRule.vue';
</script>

# RoughPath

参考 SVG [path].

```ts
const path = new RoughPath({
    d: 'M 100 100 L 200 200 L 300 100 Z',
    stroke: 'red',
    strokeWidth: 10,
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
    const { Canvas, RoughPath } = Core;
    const path = new RoughPath({
        d: 'M 100 100 L 200 200 L 300 100 Z',
        stroke: 'red',
        strokeWidth: 10,
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
        strokeWidth: 10,
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

## fillRule {#fill-rule}

SVG 中的 [fill-rule] 用来判定 Path 的填充区域，默认值为 `"nonzero"`。

```ts
type CanvasFillRule = 'evenodd' | 'nonzero';
```

下面的例子中左边是 `nonzero`，右边是 `evenodd`。另外由于 earcut 不支持自相交路径，我们使用 `TesselationMethod.LIBTESS` 来三角化路径。

<FillRule />

## 如何表示孔洞 {#holes}

在 SVG 中可以这样定义孔洞，与轮廓的时针方向不同。比如下面路径中的轮廓为顺时针 `M0 0 L100 0 L100 100 L0 100 Z`，后续的两个孔洞就是逆时针方向：

```bash
M0 0 L100 0 L100 100 L0 100 Z M50 50 L50 75 L75 75 L75 50 Z M25 25 L25
```

当然也可以将时针方向反过来定义，例如：[Draw a hollow circle in SVG]，总之孔洞的时针方向与轮廓相反即可。

<Holes />

[path]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/path
[d]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute/d
[fill-rule]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-rule
[Draw a hollow circle in SVG]: https://stackoverflow.com/questions/8193675/draw-a-hollow-circle-in-svg
