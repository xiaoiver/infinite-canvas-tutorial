---
outline: deep
publish: false
---

<script setup>
import Gradient from '../components/Gradient.vue';
import MeshGradient from '../components/MeshGradient.vue';
import DeclarativeGradient from '../components/DeclarativeGradient.vue';
</script>

# Lesson 18 - Gradient and Pattern

In this lesson, we'll explore how to implement gradients and repeating patterns.

## Use CanvasGradient {#canvas-gradient}

We can use the [CanvasGradient] API to create various gradient effects, which can then be consumed as textures. We'll introduce both imperative and declarative implementations.

### Creating Gradient Textures Imperatively {#create-gradient-texture}

Taking linear gradient as an example, after creating a `<canvas>` and getting its context, [createLinearGradient] requires start and end points that define the gradient's direction. Then add multiple color stops, draw to the `<canvas>`, and use it as a source for creating textures:

```ts
const gradient = ctx.createLinearGradient(0, 0, 1, 0); // x1, y1, x2, y2

gradient.addColorStop(0, 'red');
gradient.addColorStop(1, 'blue');

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 256, 1);
```

Create a texture object using the [Device] API, and finally pass it to the shape's `fill` property to complete the drawing.

```ts
// 0. Create gradient data
const ramp = generateColorRamp({
    colors: [
        '#FF4818',
        '#F7B74A',
        '#FFF598',
        '#91EABC',
        '#2EA9A1',
        '#206C7C',
    ].reverse(),
    positions: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
});

// 1. Get canvas device
const device = canvas.getDevice();

// 2. Create texture object
const texture = device.createTexture({
    format: Format.U8_RGBA_NORM,
    width: ramp.width,
    height: ramp.height,
    usage: TextureUsage.SAMPLED,
});
texture.setImageData([ramp.data]); // Pass the previously created <canvas> data to texture

// 3. Pass the texture object to the shape's `fill` property
rect.fill = texture;
```

<Gradient />

However, we want to support declarative syntax to improve usability and facilitate serialization.

### Declarative CSS Gradient Syntax {#css-gradient-syntax}

Following CSS gradient syntax, we can use [gradient-parser] to obtain structured results, which can then be used to call APIs like [createLinearGradient]:

```ts
rect.fill = 'linear-gradient(0deg, blue, green 40%, red)';
rect.fill = 'radial-gradient(circle at center, red, blue, green 100%)';
```

The parsing results are as follows:

```js eval code=false
linearGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient('linear-gradient(0deg, blue, green 40%, red)');
});
```

```js eval code=false
radialGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient(
        'radial-gradient(circle at center, red, blue, green 100%)',
    );
});
```

There are several common gradient types, and we currently support the first three:

-   [linear-gradient] Supported by CSS and Canvas
-   [radial-gradient] Supported by CSS and Canvas
-   [conic-gradient] Supported by CSS and Canvas
-   [repeating-linear-gradient] Supported by CSS, can be hacked with Canvas, see [How to make a repeating CanvasGradient]
-   [repeating-radial-gradient] Supported by CSS
-   [sweep-gradient] Supported in CanvasKit / Skia

<DeclarativeGradient />

Additionally, we support overlaying multiple gradients, for example:

```ts
rect.fill = `linear-gradient(217deg, rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%),
    linear-gradient(127deg, rgba(0,255,0,.8), rgba(0,255,0,0) 70.71%),
    linear-gradient(336deg, rgba(0,0,255,.8), rgba(0,0,255,0) 70.71%)`;
```

### Gradient Editor Panel {#gradient-editor}

Inspired by Figma's gradient editing panel, we've implemented a similar editor. You can trigger the editing panel by selecting a shape in the example above.

![Figma gradient panel](/figma-gradient-panel.png)

## Implementing Gradients with Mesh {#mesh-gradient}

The gradients implemented based on Canvas and SVG have limited expressiveness and cannot display complex effects. Some design tools like Sketch / Figma have many Mesh-based implementations in their communities, such as:

-   [Mesh gradients plugin for Sketch]
-   [Mesh Gradient plugin for Figma]
-   [Photo gradient plugin for Figma]

We referenced some open-source implementations, some implemented in Vertex Shader, others in Fragment Shader. We chose the latter:

-   [meshgradient]
-   [Mesh gradient generator]
-   [react-mesh-gradient]

<MeshGradient />

Due to WebGL1 GLSL100 syntax compatibility, we need to avoid using `switch`, otherwise we'll get errors like:

> [!CAUTION]
> ERROR: 0:78: 'switch' : Illegal use of reserved word

Also, in `for` loops, we cannot use Uniform as the termination condition for `index`:

> [!CAUTION]
> ERROR: 0:87: 'i' : Loop index cannot be compared with non-constant expression

Therefore, we can only use constant `MAX_POINTS` to limit loop iterations, similar to Three.js chunks handling light sources:

```glsl
#define MAX_POINTS 10

for (int i = 0; i < MAX_POINTS; i++) {
    if (i < int(u_PointsNum)) {
        // ...
    }
}
```

### Warping {#warping}

-   [Inigo Quilez's Domain Warping]
-   [Mike Bostock's Domain Warping]

## Exporting Gradients to SVG {#export-gradient-to-svg}

### Linear Gradient {#linear-gradient}

SVG provides [linearGradient] and [radialGradient], but their supported attributes are quite different from [CanvasGradient]. Taking the former as an example:

```ts
function computeLinearGradient(
    min: [number, number],
    width: number,
    height: number,
    angle: number,
) {
    const rad = DEG_TO_RAD * angle;
    const rx = 0;
    const ry = 0;
    const rcx = rx + width / 2;
    const rcy = ry + height / 2;
    // get the length of gradient line
    // @see https://observablehq.com/@danburzo/css-gradient-line
    const length =
        Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad));
    const x1 = min[0] + rcx - (Math.cos(rad) * length) / 2;
    const y1 = min[1] + rcy - (Math.sin(rad) * length) / 2;
    const x2 = min[0] + rcx + (Math.cos(rad) * length) / 2;
    const y2 = min[1] + rcy + (Math.sin(rad) * length) / 2;

    return { x1, y1, x2, y2 };
}
```

### Conic Gradient {#conic-gradient}

Refer to [SVG angular gradient] for an approximate implementation. The [CSS conic-gradient() polyfill] approach is to render using Canvas and export as dataURL, then reference it with `<image>`.

### Multiple Gradient Overlay {#multiple-gradient-overlay}

For multiple gradient overlays, in Canvas API, you can set `fillStyle` multiple times for overlaying. In declarative SVG, you can use multiple `<feBlend>` to achieve this.

## Implementing Patterns {#pattern}

<https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createPattern#%E5%8F%82%E6%95%B0>

[CanvasImageSource](https://developer.mozilla.org/en-US/docs/Web/API/CanvasImageSource) supports following data types:

-   [HTMLImageElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement)
-   [HTMLVideoElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement)
-   [HTMLCanvasElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement)
-   [CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D),
-   [ImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap),
-   [ImageData](https://developer.mozilla.org/en-US/docs/Web/API/ImageData),
-   [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob).

```js
circle.style.fill = {
    image: [],
    repetition: 'repeat',
};
```

Pattern in ECharts: <https://echarts.apache.org/en/option.html#color>

```js
{
  image: imageDom, // supported as HTMLImageElement, HTMLCanvasElement, but not path string of SVG
  repeat: 'repeat' // whether to tile, can be 'repeat-x', 'repeat-y', 'no-repeat'
}
```

[CanvasGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasGradient
[Device]: /reference/canvas#getdevice
[linear-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient
[radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/radial-gradient
[repeating-linear-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-linear-gradient
[repeating-radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-radial-gradient
[conic-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/conic-gradient
[sweep-gradient]: https://stackoverflow.com/questions/44912075/sweep-gradient-what-it-is-and-its-examples
[gradient-parser]: https://github.com/rafaelcaricio/gradient-parser
[Mesh gradients plugin for Sketch]: https://www.meshgradients.com/
[Mesh Gradient plugin for Figma]: https://www.figma.com/community/plugin/958202093377483021/mesh-gradient
[Photo gradient plugin for Figma]: https://www.figma.com/community/plugin/1438020299097238961/photo-gradient
[meshgradient]: https://meshgradient.com/
[Mesh gradient generator]: https://kevingrajeda.github.io/meshGradient/
[react-mesh-gradient]: https://github.com/JohnnyLeek1/React-Mesh-Gradient
[Inigo Quilez's Domain Warping]: https://iquilezles.org/articles/warp/
[Mike Bostock's Domain Warping]: https://observablehq.com/@mbostock/domain-warping
[linearGradient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/linearGradient
[radialGradient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/radialGradient
[createLinearGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient
[SVG angular gradient]: https://stackoverflow.com/questions/2465405/svg-angular-gradient
[How to make a repeating CanvasGradient]: https://stackoverflow.com/questions/56398519/how-to-make-a-repeating-canvasgradient
[CSS conic-gradient() polyfill]: https://projects.verou.me/conic-gradient/
