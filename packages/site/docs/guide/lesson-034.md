---
outline: deep
description: 'Frame and clipping: implementing clip/erase with Stencil Buffer, and handling clip-path vs mask when exporting PNG/SVG.'
publish: false
---

<script setup>
import ClipPath from '../components/ClipPath.vue'
import Mask from '../components/Mask.vue'
import ClipPathSoft from '../components/ClipPathSoft.vue'
import Cropping from '../components/Cropping.vue'
import BrushWithEraser from '../components/BrushWithEraser.vue'
</script>

# Lesson 34 - Frame and Clipping

Currently our `Group / g` is a logical grouping without geometric bounds (e.g. `x/y/width/height`), so it does not apply clipping to children. tldraw provides both Group and Frame as [Structural shapes].

## Stencil Buffer {#stencil-buffer}

In tldraw, clipping is done via CSS [clip-path], defined on the parent by overriding `getClipPath`; the built-in Frame is implemented this way. In Figma this property is called `clip content`; see [Frame properties in Figma].

For generality, we want any shape to be able to act as a clipping parent: children outside the shape are clipped, while the parent itself still renders normally with `fill`/`stroke` applied. The property is declared as:

```ts
{
    clipChildren: true;
}
```

Next we look at how to implement this clipping in WebGL / WebGPU.

![learnopengl stencil buffer](https://maxammann.org/posts/2022/01/wgpu-stencil-testing/learnopengl-stencil_buffer.png)

Once a shape is a clipping container, we need to render to the stencil buffer in the RenderPass as well; its default value is `0`:

```ts
{
    stencilWrite: true, // enable writing to stencil buffer
    stencilFront: {
        compare: CompareFunction.ALWAYS,
        passOp: StencilOp.REPLACE,
    },
    stencilBack: {
        compare: CompareFunction.ALWAYS,
        passOp: StencilOp.REPLACE,
    }
}
```

We then write a reference value into the stencil buffer for later comparison when rendering children; this value can be in `[0-255]`, e.g. `1` in the diagram above:

```ts
renderPass.setStencilReference(STENCIL_CLIP_REF);
```

When rendering clipped children, we check whether the buffer value equals this reference; regions with value `0` are not drawn, achieving the clip:

```ts
{
    stencilFront: {
        compare: CompareFunction.EQUAL,
        passOp: StencilOp.KEEP,
    }
}
```

<ClipPath />

## Eraser effect {#non-atomic-eraser}

We can now implement the remaining part of [Lesson 25 - Non-atomic eraser]. The eraser effect is the opposite of clipping: CSS [clip-path] defines the “visible” region, and SVG’s [\<clipPath\>] does the same—neither can define an “invisible” region.

SVG’s `<mask>` can; see [Clipping and masking in SVG]. In WebGL / WebGPU we only need to invert the comparison:

```ts
{
    stencilFront: {
        compare: CompareFunction.EQUAL, // [!code --]
        compare: CompareFunction.NOTEQUAL, // [!code ++]
        passOp: StencilOp.KEEP,
    }
}
```

So we also need a property that distinguishes `clip` and `erase` modes:

```ts
{
    clipChildren: true,  // [!code --]
    clipMode: 'erase', // 'clip' | 'erase' // [!code ++]
}
```

In the Fragment Shader, when using the stencil buffer we must skip the usual alpha-based discard logic; see [Lesson 2 - SDF]. Otherwise with `fill='none'` we would not get correct rendering:

```glsl
// sdf.glsl
#ifdef USE_STENCIL
  // Stencil pass: discard by geometry (SDF distance), not alpha. Include the same
  // anti-alias band as the normal pass (fwidth(distance)) so the stencil boundary
  // matches the visible shape and avoids edge holes.
  float outerBoundary = (strokeAlignment < 1.5) ? 0.0 : strokeWidth;
  if (distance > outerBoundary)
    discard;
#else
  if (outputColor.a < epsilon)
    discard;
#endif
```

<Mask />

<BrushWithEraser />

## Export as image {#export-as-image}

When exporting a single clipped element as an image, we need the intersection of its bounds with the parent’s bounds as the size for rendering to OffscreenCanvas, or as the `viewBox` size when exporting SVG:

```ts
const { minX, minY, maxX, maxY } =
    entity.read(ComputedBounds).renderWorldBounds;
const {
    minX: parentMinX,
    minY: parentMinY,
    maxX: parentMaxX,
    maxY: parentMaxY,
} = parentEntity.read(ComputedBounds).renderWorldBounds;
const isectMinX = Math.max(minX, parentMinX);
const isectMinY = Math.max(minY, parentMinY);
const isectMaxX = Math.min(maxX, parentMaxX);
const isectMaxY = Math.min(maxY, parentMaxY);
bounds.addFrame(isectMinX, isectMinY, isectMaxX, isectMaxY);
```

### Export PNG {#export-as-png}

The only caveat is that even when exporting only the clipped child, we must render the parent first.

### Export SVG {#export-as-svg}

First, the `clipMode='clip'` case.

The clipping parent has a corresponding `<g>`. Set its `clip-path` to reference the shape’s own definition; note that [\<clipPath\>] itself is not rendered.

```html
<g clip-path="url(#clip-path-frame-1)" transform="matrix(1,0,0,1,100,100)">
    <defs>
        <clipPath id="clip-path-frame-1">
            <ellipse
                id="node-frame-1"
                fill="green"
                cx="100"
                cy="100"
                rx="100"
                ry="100"
            />
        </clipPath>
    </defs>
    <ellipse
        id="node-frame-1"
        fill="green"
        cx="100"
        cy="100"
        rx="100"
        ry="100"
    />
    <rect
        id="node-rect-1"
        fill="red"
        width="100"
        height="100"
        transform="matrix(1,0,0,1,-50,-50)"
    />
</g>
```

For `clipMode='erase'`, SVG mask rules are:

-   White (luminance 1): masked content is visible
-   Black (luminance 0): masked content is hidden

Draw a large white rectangle first, then draw the erasing shape in black:

```ts
const $whiteRect = createSVGElement('rect');
$whiteRect.setAttribute('x', '-10000');
$whiteRect.setAttribute('y', '-10000');
$whiteRect.setAttribute('width', '20000');
$whiteRect.setAttribute('height', '20000');
$whiteRect.setAttribute('fill', 'white');
$clipPath.appendChild($whiteRect);

$parentNode.setAttribute('fill', 'black');
$parentNode.setAttribute('stroke', 'black');
```

The resulting SVG structure:

```html
<defs xmlns="http://www.w3.org/2000/svg">
    <mask id="mask-frame-1">
        <rect x="-10000" y="-10000" width="20000" height="20000" fill="white" />
        <rect fill="black" width="100" height="100" stroke="black" />
    </mask>
</defs>
```

## Crop an image {#crop-an-image}

Cropping is most commonly used for images. See [Crop an image] and [image cropping in excalidraw] for more details.

![crop an image in Figma](https://help.figma.com/hc/article_attachments/34351829050391)

It's worth noting that in editors, cropping usually preserves the original image, so the cropped area is only hidden visually, making it easy to readjust the crop region:

> Cropping is a non-destructive action, meaning that the cropped area does not get deleted. This allows you to make changes to the cropped area, if needed.

### Semi-transparent effect for cropped area {#use-soft-clip-outside}

After entering crop mode, the original image content still needs to be displayed, with the cropped area indicated by transparency. We add another mode `'soft'` to `clipMode` to achieve this effect:

<ClipPathSoft />

The implementation principle is as follows: we actually render the clipped shape twice. The first pass (`compare: CompareFunction.EQUAL`) renders the normally clipped part as described before, and the second pass (`compare: CompareFunction.NOTEQUAL`) applies a fixed transparency:

```glsl
#ifdef USE_SOFT_CLIP_OUTSIDE
  outputColor *= 0.15;
#endif
```

### Adding interaction {#interaction}

Next, we add interaction to make the crop region editable. After entering crop mode, there are two interactive parts:

-   Fix the crop region and drag the cropped graphic
-   Adjust the crop region size

<Cropping />

Referencing Figma's interaction design, after selecting a shape, you can enter crop mode through the context menu. At this point, a clipping parent element is created for the selected elements:

```ts
const children = layersSelected.map((id) => this.api.getNodeById(id));
const bounds = this.api.getBounds(children);
const { minX, minY, maxX, maxY } = bounds;
// create a clip parent for all the selected nodes
const clipParent: RectSerializedNode = {
    id: uuidv4(),
    type: 'rect',
    clipMode: 'clip',
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
};

this.api.runAtNextTick(() => {
    this.api.updateNodes([clipParent]);
    // clipParent -> children
    children.forEach((child) => {
        this.api.reparentNode(child, clipParent);
    });
    this.api.setAppState({
        layersCropping: [clipParent.id],
        penbarSelected: Pen.SELECT,
    });
    this.api.record();
});
```

## Extended reading {#extended-reading}

-   [Shape clipping in tldraw]
-   [Frame properties in Figma]
-   [Stencil Testing in WebGPU and wgpu]
-   [Clipping and masking in SVG]

[Structural shapes]: https://tldraw.dev/sdk-features/default-shapes#Structural-shapes
[Shape clipping in tldraw]: https://tldraw.dev/sdk-features/shape-clipping
[Frame properties in Figma]: https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design#:~:text=Clip%20Content%3A%20Hide%20any%20objects%20within%20the%20frame%20that%20extend%20beyond%20the%20frame%27s%20bounds
[Stencil Testing in WebGPU and wgpu]: https://maxammann.org/posts/2022/01/wgpu-stencil-testing/
[Lesson 25 - Non-atomic eraser]: /guide/lesson-025
[clip-path]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/clip-path
[\<clipPath\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/clipPath
[Clipping and masking in SVG]: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Clipping_and_masking
[Lesson 2 - SDF]: /guide/lesson-002#sdf
[Crop an image]: https://help.figma.com/hc/en-us/articles/360040675194-Crop-an-image
[image cropping in excalidraw]: https://github.com/excalidraw/excalidraw/pull/8613
