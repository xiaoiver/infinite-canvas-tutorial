---
outline: deep
description: 'Implement an animation system: declarative animation API design, Web Animations API compatibility, generator-based animation flow, and SVG path animation techniques.'
---

<script setup>
import AnimationController from '../components/AnimationController.vue';
import AnimationEasing from '../components/AnimationEasing.vue';
import AnimationTransformOrigin from '../components/AnimationTransformOrigin.vue';
import AnimationDasharray from '../components/AnimationDasharray.vue';
import AnimationDashoffset from '../components/AnimationDashoffset.vue';
import AnimationMorphing from '../components/AnimationMorphing.vue';
import AnimationLottieBouncyBall from '../components/AnimationLottieBouncyBall.vue';
</script>

# Lesson 36 - Animation

In this lesson you will learn:

-   How to design an animation API
-   How to implement declarative keyframes and controllers aligned with the Web Animations API
-   How to implement path, stroke, and morphing effects
-   How formats like Lottie fit in

## How to design the animation API {#api-design}

Motion is fully compatible with declarative WAAPI-style animation; see [Improvements to Web Animations API]. It calls the browser’s native `element.animate()` for GPU acceleration, an independent compositor thread, and work off the main thread. JavaScript fills in what WAAPI does not provide:

-   Spring physics (WAAPI only supports Bézier easing)
-   Independent `transform` properties (animate `x`, `y`, `scale` separately instead of one combined transform string)
-   `transformOrigin` for scale and rotation centers
-   Timeline helpers such as `sequence()` and `stagger()`

```ts
import { animate, stagger } from 'motion';

// Returns a controller you can pause, play, and reverse
const controls = animate(
    '.box',
    { x: [0, 100], opacity: [0, 1] }, // keyframes
    { duration: 0.5, delay: stagger(0.1), easing: 'spring(1, 100, 10, 0)' },
);

// Serializable control calls
controls.pause();
controls.play();
controls.reverse();
```

Keyframes and options are plain objects and can be JSON-serialized. Runtime state from `animate()`—bindings to the DOM, current time, velocity, etc.—is not serializable.

## Following WAAPI {#waapi}

We can follow the WAAPI polyfill [web-animations-js] and integrate with our ECS.

**Data layer:** WAAPI-like keyframes (serializable)

```ts
interface Keyframe {
    offset?: number; // 0–1, same role as WAAPI offset
    [property: string]: any; // x, y, scale, fill, strokeWidth...
    easing?: string; // "ease-out", "spring(1, 100)"
}

interface AnimationOptions {
    duration: number; // ms
    delay?: number;
    iterations?: number | 'infinite';
    direction?: 'normal' | 'reverse' | 'alternate';
    fill?: 'forwards' | 'backwards' | 'both'; // How the animation appears when not running (before start, after end).
    easing?: string; // Global easing if a keyframe omits its own
}
```

**Control layer:** a WAAPI-like `Animation` controller. Differences from a full WAAPI polyfill:

-   No CSS string parsing. WAAPI allows `{ transform: 'translate(100px)' }`, which is expensive to parse. Prefer `{ x: 100 }` (Motion-style independent transform props).
-   Built-in `ease`, `ease-in`, `ease-out`, `linear`, plus Motion-style `spring(mass, stiffness, damping)`.
-   **Composite** modes. Like WAAPI’s `composite: 'add' | 'replace'`, stack animations on top of base values (e.g. entity position plus an animated offset).
-   **Timeline** support. Like Motion’s `timeline()` or WAAPI’s `GroupEffect`, including stagger across entities.

### Controller {#controller}

```ts
const animation = api.animate(
    node1,
    [
        { x: 100, fill: 'green' },
        { x: 200, fill: 'red' },
    ],
    {
        duration: 1000,
        direction: 'alternate',
        iterations: 'infinite',
        easing: 'ease-in-out',
    },
);
animation.pause();
animation.play();
animation.finish();
```

<AnimationController />

### Interpolation {#interpolation}

Scalars like `x` / `y` / `opacity` interpolate trivially. For `fill` / `stroke`, parse colors with something like `d3-color`, then interpolate each rgba channel.

```ts
function interpolateValue(from: unknown, to: unknown, t: number) {
    if (isFiniteNumber(from) && isFiniteNumber(to)) {
        return interpolateNumber(from, to, t);
    }
    const fromColor = parseColor(from);
    const toColor = parseColor(to);
    if (fromColor && toColor) {
        return colorToRgbaString({
            r: interpolateNumber(fromColor.r, toColor.r, t),
            g: interpolateNumber(fromColor.g, toColor.g, t),
            b: interpolateNumber(fromColor.b, toColor.b, t),
            a: interpolateNumber(fromColor.a, toColor.a, t),
        });
    }
    return t < 1 ? from : to;
}
```

### Easing {#easing-function}

Beyond standard curves, we can support `spring`:

```ts
function evaluateEasing(easing: string, t: number) {
    const p = clamp01(t);
    const bezier = EASING_FUNCTION[easing as keyof typeof EASING_FUNCTION];
    if (bezier) {
        return clamp01(bezier(p));
    }
    if (easing.startsWith('spring(')) {
        return evaluateSpringEasing(p, easing);
    }
    return p;
}
```

<AnimationEasing />

### Transform origin {#transform-origin}

<AnimationTransformOrigin />

## Special animation effects {#special-effects}

### Path animation {#path-animation}

Moving graphics along a path is common; CSS does this with Motion Path.

```css
#motion-demo {
    animation: move 3000ms infinite alternate ease-in-out;
    offset-path: path('M20,20 C20,100 200,0 200,100');
}
@keyframes move {
    0% {
        offset-distance: 0%;
    }
    100% {
        offset-distance: 100%;
    }
}
```

### Stroke animation {#stroke-animation}

We need the path length:

```ts
const length = api.getTotalLength(path);
api.animate(
    path,
    [{ strokeDasharray: [0, length] }, { strokeDasharray: [length, 0] }],
    {
        duration: 3500,
    },
);
```

<AnimationDasharray />

### Dash offset {#dashline-offset}

draw.io uses animation to show connector direction:

![source: https://www.drawio.com/doc/faq/connector-animate](https://www.drawio.com/assets/img/blog/connector-flow-animation.svg)

> Export your diagram to a SVG file to include the connector animation when you publish it in a web page or on a content platform that supports SVG images.

```ts
api.animate(node, [{ strokeDashoffset: -20 }, { strokeDashoffset: 0 }], {
    duration: 500,
    iterations: Infinity,
});
```

<AnimationDashoffset />

### Morphing {#morphing}

Many SVG libraries demonstrate morphing:

-   [Paper.js]
-   [Kute.js] offers Morph and CubicMorph
-   GreenSock’s MorphSVGPlugin can even render in Canvas
-   [vectalign]

Some libraries require matching segment structure before and after the morph, or interpolation fails.

Following Kute.js’s CubicMorph: convert path segments to cubic Béziers, use easy subdivision to normalize both paths to the same segment count, then interpolate control points per segment.

```ts
function mergePaths(
    left: { absolutePath: AbsoluteArray; curve: CurveArray | null },
    right: { absolutePath: AbsoluteArray; curve: CurveArray | null },
): [CurveArray, CurveArray, (b: CurveArray) => CurveArray] {
    let curve1 = left.curve;
    let curve2 = right.curve;
    if (!curve1 || curve1.length === 0) {
        // convert to curves to do morphing & picking later
        // @see http://thednp.github.io/kute.js/svgCubicMorph.html
        curve1 = path2Curve(left.absolutePath, false) as CurveArray;
        left.curve = curve1;
    }
    if (!curve2 || curve2.length === 0) {
        curve2 = path2Curve(right.absolutePath, false) as CurveArray;
        right.curve = curve2;
    }

    let curves = [curve1, curve2];
    if (curve1.length !== curve2.length) {
        curves = equalizeSegments(curve1, curve2);
    }

    const curve0 =
        getDrawDirection(curves[0]) !== getDrawDirection(curves[1])
            ? reverseCurve(curves[0])
            : (clonePath(curves[0]) as CurveArray);

    return [
        curve0,
        getRotatedCurve(curves[1], curve0) as CurveArray,
        (pathArray: CurveArray) => {
            // need converting to path string?
            return pathArray;
        },
    ];
}
```

<AnimationMorphing />

## Lottie

-   [lottie json schema]
-   [Tips for rendering]
-   [lottie-parser] — we mainly follow its parsing logic
-   [velato] — a renderer built on Vello

### Usage {#lottie-usage}

We implemented a plugin that converts Lottie JSON into graphics and keyframes. Highlights:

-   Supports the following elements from Shape layers:
    -   [Rectangle](https://lottiefiles.github.io/lottie-docs/shapes/#rectangle)
    -   [Ellipse](https://lottiefiles.github.io/lottie-docs/shapes/#ellipse)
    -   [Path](https://lottiefiles.github.io/lottie-docs/shapes/#path)
    -   [Group](https://lottiefiles.github.io/lottie-docs/shapes/#group)
    -   [PolyStar](https://lottiefiles.github.io/lottie-docs/shapes/#polystar)
-   In Lottie, `anchorX` / `anchorY` define the scale and rotation center relative to the top-left of the shape’s bounding box—take care when mapping to `transformOrigin`
-   Merge multiple animation tracks into one keyframe set and fill in missing properties

```ts
import { loadAnimation } from '@infinite-canvas-tutorial/lottie';

fetch('/bouncy_ball.json')
    .then((res) => res.json())
    .then((data) => {
        const animation = loadAnimation(data, {
            loop: true,
            autoplay: true,
        });

        api.runAtNextTick(() => {
            animation.render(api);
            animation.play();
        });
    });
```

Below is the official sample running in our setup: [Bouncy Ball]

<AnimationLottieBouncyBall />

### Bézier curves in Lottie {#beziers-in-lottie}

[Beziers in Lottie]

-   `v` is an array of vertices.
-   `i` is an array of “in” tangent points, relative to `v`.
-   `o` is an array of “out” tangent points, relative to `v`.
-   `c` is a boolean determining whether the poly-Bézier is closed. If it is, there is an extra Bézier segment between the last point in `v` and the first.

### Expressions {#expression}

[Expressions]

```json
{
    "ty": "sh",
    "ks": {
        "a": 0,
        "k": {
            "i": [],
            "o": [],
            "v": []
        },
        "x": "var group = thisLayer.content(\"Quadratic Points\");\nvar num_points = 3;\nvar points = [];\nvar ip = [];\nvar op = [];\nfor ( var i = 0; i < num_points; i++ )\n{\n    var pos = group.content(\"p\" + i).position;\n    points.push(pos);\n    ip.push(pos);\n    op.push(pos);\n}\nvar $bm_rt = {\n    v: points,\n    i: ip,\n    o: op\n};\n"
    }
}
```

### Text layer

### Clipping mask

[clipping-masks]

### Layer effects

[Layer Effects]

## Rive

[Rive vs Lottie]

![source: https://rive.app/blog/rive-as-a-lottie-alternative](https://framerusercontent.com/images/gKzhMgEDMMUPLVkhMtTDfQdQrQ.png?width=1920&height=800)

## Manim

<https://github.com/3b1b/manim>

-   [Discussion in HN]

## Animation editors

-   [lottielab]
-   [omnilottie]
-   [thorvg.viewer]

## Further reading

-   [Magic Animator]
-   [A major breakthrough in real-time vector graphics]
-   [Art meets technology: the next step in bringing our characters to life]
-   [Canvas vs WebGL]

[Improvements to Web Animations API]: https://motion.dev/docs/improvements-to-the-web-animations-api-dx
[A major breakthrough in real-time vector graphics]: https://rive.app/renderer
[Art meets technology: the next step in bringing our characters to life]: https://blog.duolingo.com/world-character-visemes/
[Canvas vs WebGL]: https://rive.app/community/doc/canvas-vs-webgl/docanjXoQ1uT
[vectalign]: https://github.com/bonnyfone/vectalign
[Magic Animator]: https://magicanimator.com/
[Discussion in HN]: https://news.ycombinator.com/item?id=44994071
[lottielab]: https://www.lottielab.com/
[omnilottie]: https://fal.ai/models/fal-ai/omnilottie/api
[web-animations-js]: https://github.com/web-animations/web-animations-js
[lottie json schema]: https://lottiefiles.github.io/lottie-docs/schema/
[Paper.js]: http://paperjs.org/
[Kute.js]: https://thednp.github.io/kute.js/
[Tips for rendering]: https://lottiefiles.github.io/lottie-docs/rendering/
[lottie-parser]: https://github.com/pissang/lottie-parser
[velato]: https://github.com/linebender/velato
[Bouncy Ball]: https://lottiefiles.github.io/lottie-docs/breakdown/bouncy_ball/
[Beziers in Lottie]: https://lottiefiles.github.io/lottie-docs/breakdown/bezier/#beziers-in-lottie
[Expressions]: https://lottiefiles.github.io/lottie-docs/expressions/
[clipping-masks]: https://lottie-animation-community.github.io/docs/specs/layers/common/#clipping-masks
[Layer Effects]: https://lottiefiles.github.io/lottie-docs/effects/#layer-effects
[thorvg.viewer]: https://github.com/thorvg/thorvg.viewer
[Rive vs Lottie]: https://rive.app/blog/rive-as-a-lottie-alternative
