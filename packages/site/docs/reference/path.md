---
outline: deep
publish: false
---

# Path

See SVG [path].

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

Refer to SVG [d] attribute, which is a string containing a sequence of path commands that define the path to be drawn.

## tessellationMethod {#tessellation-method}

Tessellation method, default value is `TesselationMethod.EARCUT`.

```ts
export enum TesselationMethod {
    EARCUT,
    LIBTESS,
}
```

While `TesselationMethod.LIBTESS` has lower performance, it provides better accuracy. See [Lesson 013](/guide/lesson-013#other-tesselation-techniques) for details.

## fillRule {#fill-rule}

The SVG [fill-rule] determines the fill area of the Path, with a default value of `"nonzero"`.

```ts
type CanvasFillRule = 'evenodd' | 'nonzero';
```

In the example below, the left side uses `nonzero` and the right side uses `evenodd`. Additionally, since earcut doesn't support self-intersecting paths, we use `TesselationMethod.LIBTESS` for path triangulation.

<FillRule />

## How to Define Holes {#holes}

In SVG, holes can be defined by using the opposite winding direction compared to the outline. For example, in the path below, the outline is clockwise `M0 0 L100 0 L100 100 L0 100 Z`, while the two subsequent holes are counterclockwise:

```bash
M0 0 L100 0 L100 100 L0 100 Z M50 50 L50 75 L75 75 L75 50 Z M25 25 L25
```

Alternatively, the winding direction can be reversed, such as in [Draw a hollow circle in SVG], as long as the winding direction of the hole is opposite to that of the outline.

<Holes />

[path]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/path
[d]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute/d
[fill-rule]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-rule
[Draw a hollow circle in SVG]: https://stackoverflow.com/questions/8193675/draw-a-hollow-circle-in-svg
