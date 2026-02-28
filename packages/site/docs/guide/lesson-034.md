---
outline: deep
description: 'Frame and clipping: implementing clip/erase with Stencil Buffer, and handling clip-path vs mask when exporting PNG/SVG.'
publish: false
---

<script setup>
import ClipPath from '../components/ClipPath.vue'
import Mask from '../components/Mask.vue'
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
