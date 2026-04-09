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

<AnimationMorphing />

## Lottie

[lottie json schema]

## Rive

## Manim

<https://github.com/3b1b/manim>

-   [Discussion in HN]

## Animation editors

-   [lottielab]
-   [omnilottie]

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
