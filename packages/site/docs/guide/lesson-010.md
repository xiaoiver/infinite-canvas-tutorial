---
outline: deep
---

# Lesson 10 - Importing and Exporting Images

Image import and export is a very important feature in Infinite Canvas, and through the exported image it can be interfaced with other tools. So while our canvas drawing capabilities are currently limited, it's good to think ahead about issues related to images. In this lesson you will learn the following:

-   Exporting canvas content to PNG, JPEG and SVG formats
-   Rendering images in the canvas
-   Extending the capabilities of SVG, using `stroke-alignment` as an example.

## Exporting canvas contents to image {#export-canvas-to-image}

First, let's look at how to export the contents of a canvas to an image. The article [Export from Figma] describes how to export a canvas to various formats including PNG using the slice tool in Figma.

![export from figma](https://help.figma.com/hc/article_attachments/24423129974679)

Some charting libraries based on Canvas2D implementations also provide the ability to save content to an image. The image below is from Highcharts, and you can see that it also provides the ability to export images in a variety of formats, which triggers the browser's download behavior immediately after clicking:

<img alt="exporter in highcharts" src="https://user-images.githubusercontent.com/3608471/174998577-df1c54e9-d981-4d82-a4aa-7f0bedfb11a1.png" width="300" />

We would like to implement the following export functionality:

-   Support for multiple image formats: PNG, JPEG and SVG.
-   Support for specifying the cropping area
-   Support for selecting whether to include a grid or not

To do this we have designed the image exporter to be used in the following way:

```ts
const exporter = new ImageExporter({
    canvas,
});

const canvas = await exporter.toCanvas(); // HTMLCanvasElement
const dataURL = canvas.toDataURL(); // data:...

exporter.downloadImage({
    dataURL,
    name: 'my-file',
});
```

However, there is a “slight” difference for different formats of images, below we first introduce the way of exporting PNG / JPEG format images.

### Export PNG / JPEG {#to-raster-image}

[HTMLCanvasElement.toDataURL()] 可以获取画布内容对应的图片 [DataURI]，通过 `type` 参数可以指定图片格式，支持 PNG / JPEG 和 WebP。

```js
var canvas = document.getElementById('canvas');
var dataURL = canvas.toDataURL(); // 默认为 PNG
console.log(dataURL);
// "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNby
// blAAAADElEQVQImWNgoBMAAABpAAFEI8ARAAAAAElFTkSuQmCC"
```

So we add a `toCanvas` method to the image exporter. This method is used to draw the canvas content of the specified area into an additional HTMLCanvasElement, which can then be further manipulated as needed, e.g. by adding a background color, a watermark, etc. The full method signature is below. It's worth noting that this method is asynchronous, and we'll explain why later:

```ts
toCanvas(options: Partial<CanvasOptions> = {}): Promise<HTMLCanvasElement>;

interface CanvasOptions {
  grid: boolean;
  clippingRegion: Rectangle;
  beforeDrawImage: (context: CanvasRenderingContext2D) => void;
  afterDrawImage: (context: CanvasRenderingContext2D) => void;
}
```

The meaning of each configuration item is as follows:

-   `grid` Whether to include a grid
-   `clippingRegion` The canvas clipping region, represented by a rectangle.
-   `beforeDrawImage` Called before drawing the content of the canvas, suitable for drawing the background color.
-   `afterDrawImage` Called after drawing the content of the canvas, suitable for drawing watermarks.

The complete usage example is as follows:

```ts
const canvas = await exporter.toCanvas({
    clippingRegion: new Rectangle(
        clippingRegionX,
        clippingRegionY,
        clippingRegionWidth,
        clippingRegionHeight,
    ),
    beforeDrawImage: (context) => {
        // Customize background-color
        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, clippingRegionWidth, clippingRegionHeight);
    },
    afterDrawImage: (context) => {
        // Watermark
        context.font = '24px Times New Roman';
        context.fillStyle = '#FFC82C';
        context.fillText('Watermark', 20, 20);
    },
});
```

We have placed the Export Image dropdown in the top right corner of the canvas, if interested in components you can refer to: [Web UI with Lit and Shoelace].

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 100; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;
            const circle = new Circle({
                cx: Math.random() * 600,
                cy: Math.random() * 400,
                r: Math.random() * 40,
                fill,
            });
            canvas.appendChild(circle);

            circle.addEventListener('pointerenter', () => {
                circle.fill = 'red';
            });
            circle.addEventListener('pointerleave', () => {
                circle.fill = fill;
            });
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

Now let's answer why the `toCanvas` method is designed to be asynchronous. Since WebGL / WebGPU uses the [SwapChain] double buffering mechanism, and the default value of [preserveDrawingBuffer] is `false` when creating the context, you need to make sure that the rendering is not cleared (e.g., by calling `gl.clear()`) when calling `toDataURL`, otherwise you will get a blank image. We add the following logic to the `endFrame` hook in [Plugin-based architecture] to save the contents of the canvas as soon as the export command is received, before the end of the current frame, in case it is cleared when the next frame arrives, which would cause the behavior to become asynchronous.

```ts
hooks.endFrame.tap(() => {
    this.#device.endFrame();

    // capture here since we don't preserve drawing buffer
    if (this.#enableCapture && this.#resolveCapturePromise) {
        const { type, encoderOptions } = this.#captureOptions;
        const dataURL = (
            this.#swapChain.getCanvas() as HTMLCanvasElement
        ).toDataURL(type, encoderOptions);
        this.#resolveCapturePromise(dataURL);
        this.#enableCapture = false;
        this.#captureOptions = undefined;
        this.#resolveCapturePromise = undefined;
    }
});
```

In addition, you can choose whether or not to include [Grid] in the exported image. For the time being, we don't use the cropping and watermarking functions for subsequent processing. Since the implementation of a Figma-like “slicing” feature requires a box-select interaction, it will be introduced in a later implementation. Now let's go back to another special image format.

### Export SVG {#to-vector-image}

The advantages of vector graphics over bitmaps are:

-   Infinite scaling without distortion. This means that they can be scaled up or down indefinitely without losing clarity, making them ideal for situations where multiple resolutions are required.
-   Editability: SVGs are text files that can be edited with any text editor, making it easy to modify the attributes and style of the graphic.
-   SVGs are text files that can be edited with any text editor, making it easy to modify the attributes and styles of graphics.

Therefore, design tools must provide support for conversion to this format. For our infinite canvas, we can convert the problem to: **How to serialize the scene graph**, including the drawing attributes of each node, transformations and so on. As for the format of the serialization, besides JSON, since the design of the drawing properties of our 2D graphs itself heavily references SVG implementations, it's only natural to export to SVG.

Interestingly, Three.js also provides [toJSON] to save the current state of the scene (including objects, transforms, materials, etc.) as [JSON-Object-Scene-format-4]. It even includes a [SVGRenderer] to render 3D graphics as best as possible under limited conditions (no complex shading, shadows).

#### Shape to SerializedNode {#shape-to-serialized-node}

Traversed from the root node of the scene graph, recursively called on child elements. Attributes such as `transform` with complex structural values (`position/scale/rotation`) require further processing:

```ts
function serializeNode(node: Shape): SerializedNode {
    const [type, attributes] = typeofShape(node);
    const data: SerializedNode = {
        type,
        attributes,
    };
    data.attributes.transform = serializeTransform(node.transform);
    data.children = node.children.map(serializeNode);
    return data;
}
```

Take the Circle below as an example, we get its serialized object:

```js eval code=true
serializedCircle = call(() => {
    const { Circle, serializeNode } = Lesson10;
    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
    });
    circle.transform.position.x = 100;
    return serializeNode(circle);
});
```

It can be imported into the canvas via the deserialize method, `deserializeNode` creates the corresponding graph based on the `type` attribute of the serialized node, assigning values to the drawing attributes:

```js eval code=false inspector=false
canvas2 = (async () => {
    const { Canvas } = Lesson10;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    return canvas;
})();
```

```js eval code=true
call(async () => {
    const { deserializeNode } = Lesson10;
    const circle = await deserializeNode(serializedCircle);
    canvas2.root.appendChild(circle);
    return canvas2.getDOM();
});
```

The serialization and deserialization methods for the entire canvas can just be applied to the root node, but of course event listeners cannot be serialized:

```ts
const json = JSON.stringify(serializeNode(canvas.root)); // {}
canvas.root = (await deserializeNode(JSON.parse(json))) as Group;
```

#### From SerializedNode to SVGElement {#serialized-node-to-svgelement}

At this point it is easy to convert the serialized node to [SVG Element]. We add the following tool method:

```ts
export function toSVGElement(node: SerializedNode): SVGElement;
```

Most of the attributes such as `fill / stroke / opacity` are SVG attributes with the same name, so they can be assigned directly using [setAttribute], but there are some special attributes that need to be handled in a special way, for example:

-   `transform` We use the `Transform` object in `@pixi/math`, and we need its `position / rotation / scale` to be converted to `matrix()`.
-   `transform-origin` corresponds to the `pivot` attribute in `transform`.
-   `innerShadow` does not have the SVG property of the same name, it needs to be implemented using a filter.
-   `outerShadow` Same as above

The following example shows the effect of a serialized circle converted to a `<circle>`, which needs to be embedded in [\<svg\>] in order to be displayed on an HTML page, with the same dimensions as the canvas:

```js eval code=true
call(() => {
    const { toSVGElement } = Lesson10;

    const $circle = toSVGElement(serializedCircle);
    const $svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    $svg.setAttribute('width', '200');
    $svg.setAttribute('height', '200');
    $svg.appendChild($circle);

    return $svg;
});
```

#### From SVGElement to SerializedNode {#svgelement-to-serialized-node}

Naturally, we also need a conversion method from SVGElement to SerializedNode:

```ts
export function fromSVGElement(element: SVGElement): SerializedNode;
```

Note that this conversion is not fully reversible, for example, in the [StrokeAlignment implementation](#stroke-alignment-export-svg) we'll cover later, one Circle corresponds to two `<circle>`s. The same is true in Figma, where the following image shows the import of a previously exported Ellipse effect, and you can see that the two shapes are not identical.

![import an exported ellipse in Figma](/import-exported-ellipse.png)

[@pixi-essentials/svg] also wants to convert SVGElement to shapes in Pixi.js, see [Vector rendering of SVG content with PixiJS].

#### SceneGraph in SVG {#scene-graph-in-svg}

Another thing to note is that while any graph in our scene graph can have child nodes, only `<g>` can have children in SVG, and other than that, e.g. `<circle>` cannot have children. The solution is simple: for non-Group elements that have children, generate the SVG with a `<g>` outside it, and apply the `transform` that would have been applied to it. Assuming we have support for rendering text in the future, the SVG for a Circle with text children would look like this:

```html
<g transform="matrix(1,0,0,0,1,0)">
    <circle cx="100" cy="100" r="100" fill="red" />
    <text />
</g>
```

#### inner & outerShadow {#export-inner-outer-shadow}

[Creating inner shadow in svg]

#### Export image as value of fill {#export-image-as-fill-value}

Although we haven't covered the implementation of the fill image yet, directly serializing the Image value of the `fill` property would result in the following:

```html
<circle fill="[object ImageBitmap]" />
```

This obviously won't display properly, we need to serialize the Image object to a DataURL, just draw the image into `<canvas>` and use the `toDataURL` method we introduced in the previous section. Referring to [Convert ImageBitmap to Blob], I first tried [ImageBitmapRenderingContext], ImageBitmap can asynchronously decode the image without blocking the main thread, which helps to improve the performance and responsiveness of the application.

```ts
async function imageBitmapToURL(bmp: ImageBitmap) {
    const canvas = document.createElement('canvas');
    // resize it to the size of our ImageBitmap
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    // get a bitmaprenderer context
    const ctx = canvas.getContext('bitmaprenderer');
    ctx.transferFromImageBitmap(bmp);
    const blob = await new Promise<Blob>((res) => canvas.toBlob(res));
    return canvas.toDataURL();
}
```

Unfortunately we get the following error. The reason for this is that we have already created a texture using this ImageBitmap and we can't transfer control of it to the new `<canvas>`.

> [!CAUTION]
> The input ImageBitmap has been detached

So we can only use the regular `drawImage` method to draw the image into the `<canvas>`.

#### Grid in SVG {#export-grid}

Finally, let's look at how to implement a grid using SVG. Referring to [How to draw grid using HTML5 and canvas or SVG], we use `<pattern>` tiling: for the straight grid, we use two sets of one and one set of two; for the dot grid, we place a circle in each of the four corners of the “tile”:

<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="small-grid" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(221,221,221,1)" stroke-width="1"/>
    </pattern>
    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#small-grid)"/>
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(221,221,221,1)" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
</svg>

<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <circle id="dot-tl" cx="0" cy="0" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-br" cx="20" cy="20" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-bl" cx="0" cy="20" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-tr" cx="20" cy="0" r="2" fill="rgba(221,221,221,1)" />
  </defs>
  <pattern id="dots-grid" patternUnits="userSpaceOnUse" width="20" height="20">
    <use xlink:href="#dot-tl" />
    <use xlink:href="#dot-tr" />
    <use xlink:href="#dot-bl" />
    <use xlink:href="#dot-br" />
  </pattern>
  <rect width="100%" height="100%" fill="url(#dots-grid)" />
</svg>

Another interesting implementation is through the `stroke-dasharray` of `<line>`, which uses fewer SVG elements than the massively repeated `<circle>`, see [Dot Grid With pattern].

Then add a judgment at the draw grid logic: it stays the same in non-screenshot mode, and draws in screenshot mode only when the include grid option is turned on:

```ts
hooks.beginFrame.tap(() => {
    if (
        !this.#enableCapture ||
        (this.#enableCapture && this.#captureOptions.grid)
    ) {
        this.#grid.render(this.#device, this.#renderPass, this.#uniformBuffer);
    }
});
```

#### SVG Optimizer {#svg-optimizer}

If you look closely at current SVG products, you'll see that there are some redundant attributes, such as `opacity=“1”`, which is a default value and doesn't need to be explicitly present in the product. In fact, this is one of the tools used by SVG optimization tools such as [svgo]:

> SVG files, especially those exported from vector editors, usually contain a lot of redundant information. This includes editor metadata, comments, hidden elements, **default or suboptimal values**, and other stuff that can be safely removed or converted without impacting rendering.

So we need to maintain a set of mapping tables for default attribute values, and if the attribute value happens to be equal to the default value, we don't need to call `setAttribute` to set it:

```ts
const defaultValues = {
    opacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
    fill: 'black',
    stroke: 'none',
};

Object.entries(rest).forEach(([key, value]) => {
    if (`${value}` !== '' && `${defaultValues[key]}` !== `${value}`) {
        element.setAttribute(camelToKebabCase(key), `${value}`);
    }
});
```

### Export PDF {#to-pdf}

Now that pixels and vectors are available, if you still want to export to PDF you can use [jsPDF], which provides an API for adding images, which I won't cover here for lack of space.

Let's look at another topic, how to render an image in the canvas.

## Render Image {#render-image}

In WebGL / WebGPU it is often necessary to load images and use them as textures. Since loading different types of resources is a complex asynchronous process, most rendering engines provide a resource loader. Often there is also support for other data types besides the different types of images, such as audio, JSON, glTF, etc. Below is an example of how [PIXI Assets] is used:

```ts
import { Sprite, Assets } from 'pixi.js';
// load the texture we need
const texture = await Assets.load('bunny.png');

// This creates a texture from a 'bunny.png' image
const bunny = new Sprite(texture);
```

So how to implement a resource loader?

### Image loader {#image-loader}

[loaders.gl] provides a range of loaders for different types of resources, such as:

-   JSON, CSV, GeoJSON, GeoTiles, etc. commonly used in visualization applications.
-   3D model formats such as glTF
-   Various compressed texture formats, which are loaded and parsed in WebWorker using [CompressedTextureLoader].

These loaders provide great convenience for the development of upper layer applications, we can directly use [ImageLoader], which supports these image formats: PNG, JPEG, GIF, WEBP, AVIF, BMP, SVG, and so on. core` ensures uniformity in API calls and extensibility for different types of loaders:

```ts
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';

const image = await load(url, ImageLoader, options);
```

In addition to setting the `fill` attribute directly, you also need to restore the DataURL to an Image object during deserialization:

```ts
async function deserializeNode(data: SerializedNode) {
    // data:image/png:base64...
    if (fill && isString(fill) && isDataUrl(fill)) {
        shape.fill = (await load(fill, ImageLoader)) as ImageBitmap;
    }
}
```

### API Design {#image-api}

Going back to the design of our API, we can of course add a new graphic to the image, modeled after Circle / Ellipse / Rect, which corresponds to [\<image\>] in SVG:

```ts
const image = new Image({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    src: 'data:image...',
});
```

But if you think about it, an Image should have all the capabilities of a Rect, such as strokes, rounded corners, shadows and so on. Interestingly in Figma if we choose to insert a 1920 \* 1920 image into the canvas and export it as an SVG, we get a `<rect>` element with the following structure (some attribute values are omitted), and the `fill` attribute references a [\<pattern\>], which is indirectly using the image tiling fill:

```html
<svg>
    <rect width="500" height="500" fill="url(#pattern0_2442_3)" />
    <defs>
        <pattern id="pattern0_2442_3">
            <use xlink:href="#image0_2442_3"
            <!-- 0.000520833 = 1 / 1920 -->
            transform="matrix(0.000520833 0 0 0.000527058 0 -0.0059761)" />
        </pattern>
        <image
            id="image0_2442_3"
            width="1920"
            height="1920"
            xlink:href="data:image/png;base64,iVBO..."
        />
    </defs>
</svg>
```

This gives us a bit of an idea that images don't need to exist as separate shapes, as long as the `fill` attribute of other shapes supports mapping, so that Circle / Rect etc. can use images as fill. Imagine we need to implement a circle icon with a stroke, the original design would require an Image graphic with something like [\<clipPath\>], but now we just need to fill the existing Circle graphic with an image:

```ts
circle.fill = image;
circle.stroke = 'black';
```

### Implementation {#implementation}

So as a first step we extend the types supported by `fill` from color strings to more texture sources:

```ts
export interface IRenderable {
    fill: string; // [!code --]
    fill: string | TexImageSource; // [!code ++]
}

type TexImageSource =
    | ImageBitmap
    | ImageData
    | HTMLImageElement
    | HTMLCanvasElement
    | HTMLVideoElement
    | OffscreenCanvas
    | VideoFrame;
```

A field in the vertex data is needed to indicate if a texture is used, and if so to sample the texture, where `SAMPLER_2D()` is not the standard GLSL syntax, but our customized markup for replacing it with the GLSL100 / GLSL300 / WGSL sampling syntax at the Shader compilation stage. Also, textures are currently uploaded images, and gradients created using the Canvas2D API such as [createLinearGradient] will be supported later:

```glsl
// vert
out vec2 v_Uv;
v_Uv = (a_FragCoord * radius / size + 1.0) / 2.0;

// frag
in vec2 v_Uv;
uniform sampler2D u_Texture;

if (useFillImage) {
    fillColor = texture(SAMPLER_2D(u_Texture), v_Uv);
}
```

The use of `uniform` breaks our previous batch rendering logic. The [Inside PixiJS: Batch Rendering System] article describes the logic of the BatchRenderer implementation of Pixi.js, and as you can see from the runtime-compiled Shader template below, the maximum number of samplers that can be supported at the same time is a set of `%count%` samplers, where each instance selects from the set of samplers using the vertex data `aTextureId` is used by each instance to select from the set of samplers.

```glsl
// Shader template in Pixi.js BatchRenderer
// vert
attribute int aTextureId;
varying int vTextureId;
vTextureId = aTextureId;

// frag
uniform sampler2D uSamplers[%count%];
varying int vTextureId;
```

For simplicity, let's simplify the merge logic as follows:

1. `fill` with a color string that cannot be combined with an Image.
2. `fill` with a different Image value cannot be combined.

So the following three circles will be drawn in the same batch.

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    $icCanvas3.addEventListener('ic-ready', async (e) => {
        const image = await Utils.loadImage(
            'https://infinitecanvas.cc/canvas.png',
        );

        const canvas = e.detail;

        const circle1 = new Circle({
            cx: 200,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle1);

        const circle2 = new Circle({
            cx: 320,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
        });
        canvas.appendChild(circle2);

        const circle3 = new Circle({
            cx: 460,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'outer',
        });
        canvas.appendChild(circle3);
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### Render cache {#render-cache}

We haven't considered caching GPU objects like Program, Bindings, Sampler, etc. before. For this reason, we add a resource cache manager to enable reuse, and implement hit logic according to the resource type. Take Sampler as an example, if the properties in `SamplerDescriptor` are identical, the cache will be hit, and the comparison logic is in `samplerDescriptorEquals`.

```ts
import { samplerDescriptorEquals } from '@antv/g-device-api';

export class RenderCache {
    device: Device;
    private samplerCache = new HashMap<SamplerDescriptor, Sampler>(
        samplerDescriptorEquals,
        nullHashFunc,
    );

    createSampler(descriptor: SamplerDescriptor): Sampler {
        // 优先从缓存中取
        let sampler = this.samplerCache.get(descriptor);
        if (sampler === null) {
            // 未命中，创建并添加缓存
            sampler = this.device.createSampler(descriptor);
            this.samplerCache.add(descriptor, sampler);
        }
        return sampler;
    }
}
```

## Enhanced SVG: Stroke alignment {#stroke-alignment}

Finally, let's introduce an interesting topic. We can implement features that are not currently supported by the SVG specification.

Let's start with the difference between `opacity` `stroke-opacity` and `fill-opacity` in SVG. The circle on the left has `opacity=“0.5”` and the circle on the right has `fill-opacity=“0.5” stroke-opacity=“0.5”`. You can see that the stroke stroke is half inside the circle and half outside:

<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="red" stroke="black" stroke-width="20" opacity="0.5" />
  <circle cx="150" cy="50" r="40" fill="red" stroke="black" stroke-width="20" fill-opacity="0.5" stroke-opacity="0.5" />
</svg>

The corresponding Stroke position in Figma is `Center`, and other options include `Inside` and `Outside`, each of which is shown below. In SVG, this is called `stroke-alignment`, but it is currently in draft form, see [Specifying stroke alignment]. Pixi.js also provide [PIXI.LineStyle alignment] in WebGL mode.

![Stroke align in Figma](/figma-stroke-align.png)

We add the `strokeAlignment` property to all shapes:

```ts
export interface IRenderable {
    strokeAlignment: 'center' | 'inner' | 'outer'; // [!code ++]
}
```

### Stroke alignment in Shader {#stroke-alignment-rendering}

The implementation in the Shader section only needs to distinguish between these three values and mix the fill and stroke colors in different ways:

```glsl
if (strokeAlignment < 0.5) { // center
    d1 = distance + strokeWidth;
    d2 = distance + strokeWidth / 2.0;
    color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
    color = mix_border_inside(strokeColor, color, d2);
} else if (strokeAlignment < 1.5) { // inner
    d1 = distance + strokeWidth;
    d2 = distance;
    color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
    color = mix_border_inside(strokeColor, color, d2);
} else if (strokeAlignment < 2.5) { // outer
    d2 = distance + strokeWidth;
    color = mix_border_inside(strokeColor, color, d2); // No need to use fillColor at all
}
```

Here is our implementation, you can see that the rendering is consistent with Figma:

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas2.parentElement.style.position = 'relative';
    $icCanvas2.parentElement.appendChild($stats);

    $icCanvas2.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const circle1 = new Circle({
            cx: 200,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle1);

        const circle2 = new Circle({
            cx: 320,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
        });
        canvas.appendChild(circle2);

        const circle3 = new Circle({
            cx: 460,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'outer',
        });
        canvas.appendChild(circle3);
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

This property also needs to be taken into account when calculating the rendering bounding box and pickup determination. The function below reflects how far out from the graphic itself the stroke should extend for different values.

```ts
function strokeOffset(
    strokeAlignment: 'center' | 'inner' | 'outer',
    strokeWidth: number,
) {
    if (strokeAlignment === 'center') {
        return strokeWidth / 2;
    } else if (strokeAlignment === 'inner') {
        return 0;
    } else if (strokeAlignment === 'outer') {
        return strokeWidth;
    }
}
```

### Export SVG {#stroke-alignment-export-svg}

As mentioned earlier, SVG does not currently support `stroke-alignment`, so it can only be simulated by hacking at the moment. If the drawing is simple, it is possible to draw the fill and stroke in two passes. Here is Figma's export of `stroke-alignment: 'inner'`, which also uses this approach:

```html
<circle cx="200" cy="200" r="200" fill="#F67676" />
<circle
    cx="200"
    cy="200"
    r="160"
    stroke="black"
    stroke-opacity="0.5"
    stroke-width="100"
/>
```

<div style="display:flex;justify-content:center;align-items:center;">
    <svg width="100" height="100" viewBox="0 0 443 443" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="221.5" cy="221.5" r="221.5" fill="#F67676"/>
    <circle cx="221.5" cy="221.5" r="171.5" stroke="black" stroke-opacity="0.5" stroke-width="100"/>
    </svg>
    <svg width="120" height="120" viewBox="0 0 643 643" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="321.5" cy="321.5" r="221.5" fill="#F67676"/>
    <circle cx="321.5" cy="321.5" r="271.5" stroke="black" stroke-opacity="0.5" stroke-width="100"/>
    </svg>
</div>

In addition to this, the Figma documentation in [StrokeAlign in Figma widget] gives another idea, which does not require creating two similar elements. [How to simulate stroke-align (stroke-alignment) in SVG] tries this idea by enlarging the stroke width to twice its original width and eliminating the excess with clipPath and mask:

> Inside and outside stroke are actually implemented by doubling the stroke weight and masking the stroke by the fill. This means inside-aligned stroke will never draw strokes outside the fill and outside-aligned stroke will never draw strokes inside the fill.

For simplicity of implementation, we choose the first approach, creating two similar elements to draw the fill and stroke respectively, which can be tried to export SVG in the above example.

With the richness of the canvas functionality, it is necessary to introduce tests to verify that the import/export functionality works properly, that the rendering is correct, and that the UI components are interactive. We will introduce it in the next section.

## Extended reading {#extended-reading}

-   [Export from Figma]
-   [Specifying stroke alignment]
-   [How to simulate stroke-align (stroke-alignment) in SVG]
-   [Creating inner shadow in svg]
-   [Vector rendering of SVG content with PixiJS]

[Export from Figma]: https://help.figma.com/hc/en-us/articles/360040028114-Export-from-Figma#h_01GWB002EPWMFSXKAEC62GS605
[How to simulate stroke-align (stroke-alignment) in SVG]: https://stackoverflow.com/questions/74958705/how-to-simulate-stroke-align-stroke-alignment-in-svg
[HTMLCanvasElement.toDataURL()]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
[preserveDrawingBuffer]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext#preservedrawingbuffer
[DataURI]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
[SwapChain]: /guide/lesson-001#swapchain
[Web UI with Lit and Shoelace]: /guide/lesson-007
[Plugin-based architecture]: /guide/lesson-001#plugin-based-architecture
[SVGRenderer]: https://threejs.org/docs/#examples/en/renderers/SVGRenderer
[toJSON]: https://threejs.org/docs/#api/en/core/Object3D.toJSON
[JSON-Object-Scene-format-4]: https://github.com/mrdoob/three.js/wiki/JSON-Object-Scene-format-4
[Grid]: /guide/lesson-005
[SVG Element]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element
[\<svg\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/svg
[setAttribute]: https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute
[Creating inner shadow in svg]: https://stackoverflow.com/questions/69799051/creating-inner-shadow-in-svg
[jsPDF]: https://github.com/parallax/jsPDF
[loaders.gl]: https://github.com/visgl/loaders.gl
[ImageLoader]: https://loaders.gl/docs/modules/images/api-reference/image-loader
[CompressedTextureLoader]: https://loaders.gl/docs/modules/textures/api-reference/compressed-texture-loader
[PIXI Assets]: https://pixijs.download/release/docs/assets.html
[Specifying stroke alignment]: https://www.w3.org/TR/svg-strokes/#SpecifyingStrokeAlignment
[StrokeAlign in Figma widget]: https://www.figma.com/widget-docs/api/component-SVG/#strokealign
[How to draw grid using HTML5 and canvas or SVG]: https://stackoverflow.com/questions/14208673/how-to-draw-grid-using-html5-and-canvas-or-svg
[Convert ImageBitmap to Blob]: https://stackoverflow.com/questions/52959839/convert-imagebitmap-to-blob
[ImageBitmapRenderingContext]: https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmapRenderingContext
[@pixi-essentials/svg]: https://github.com/ShukantPal/pixi-essentials/tree/master/packages/svg
[Vector rendering of SVG content with PixiJS]: https://medium.com/javascript-in-plain-english/vector-rendering-of-svg-content-with-pixijs-6f26c91f09ee
[svgo]: https://github.com/svg/svgo
[Dot Grid With pattern]: https://www.smashingmagazine.com/2024/09/svg-coding-examples-recipes-writing-vectors-by-hand/#dot-grid-with-pattern
