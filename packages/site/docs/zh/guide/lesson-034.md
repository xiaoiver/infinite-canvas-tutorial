---
outline: deep
description: '介绍 Frame 与裁切：使用 Stencil Buffer 实现 clip/erase，以及导出 PNG/SVG 时 clip-path 与 mask 的处理。'
publish: false
---

<script setup>
import ClipPath from '../../components/ClipPath.vue'
import Mask from '../../components/Mask.vue'
</script>

# 课程 34 - Frame 与裁切

目前我们的 `Group / g` 是一种逻辑分组，它没有几何边界，例如 `x/y/width/height`，因此也不会对子元素应用裁剪。tldraw 就提供了 Group 和 Frame 这两种 [Structural shapes]。

## StencilBuffer {#stencil-buffer}

在 tldraw 中，裁剪是通过 CSS [clip-path] 实现的，在父元素上通过重载 `getClipPath` 定义，内置的 Frame 就是这样实现的。在 Figma 中该属性称作 `clip content`，详见 [Frame properties in Figma]。

考虑通用性，我们希望每个图形都可以成为裁剪父容器，超出容器范围的子元素都会被裁切，同时这个父元素也可以正常渲染，`fill/stroke` 这些属性都可以正常应用。属性声明如下：

```ts
{
    clipChildren: true;
}
```

下面我们来看在 WebGL / WebGPU 中如何实现裁剪效果。

![learnopengl stencil buffer](https://maxammann.org/posts/2022/01/wgpu-stencil-testing/learnopengl-stencil_buffer.png)

成为裁剪容器之后，在 RenderPass 中我们需要同时渲染到 stencil buffer，它的默认值为 `0`：

```ts
{
    stencilWrite: true, // 开启写入 stencil buffer
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

然后向 stencil buffer 写入参考值，用于后续子元素渲染时与它进行比较，这个值可以是 `[0-255]` 间的值，例如上图中使用的是 `1`：

```ts
renderPass.setStencilReference(STENCIL_CLIP_REF);
```

被裁剪的子元素在渲染时，会判断 buffer 中的值是否等于之前的约定值，因此为 `0` 的部分就不会被渲染，实现了裁剪效果：

```ts
{
    stencilFront: {
        compare: CompareFunction.EQUAL,
        passOp: StencilOp.KEEP,
    }
}
```

<ClipPath />

## 橡皮擦效果 {#non-atomic-eraser}

现在我们可以来实现 [课程 25 - 非原子化橡皮擦] 中遗留的部分了。橡皮擦效果和之前的裁剪效果完全相反，CSS 的 [clip-path] 本质是定义“可见区域”，SVG 中对应的 [\<clipPath\>] 元素同理，它们是无法定义“不可见区域”的。

但 SVG 的 `<mask>` 可以做到，详见：[Clipping and masking in SVG]。在 WebGL / WebGPU 中我们只需要反转一下判定条件即可：

```ts
{
    stencilFront: {
        compare: CompareFunction.EQUAL, // [!code --]
        compare: CompareFunction.NOTEQUAL, // [!code ++]
        passOp: StencilOp.KEEP,
    }
}
```

这样我们的属性也需要作出更改，能够区分 `clip` 和 `erase` 这两种模式：

```ts
{
    clipChildren: true,  // [!code --]
    clipMode: 'erase', // 'clip' | 'erase' // [!code ++]
}
```

另外在 Fragment Shader 中，在开启 stencil buffer 时需要跳过原有的根据 alpha 通道的丢弃像素逻辑，详见：[课程 2 - SDF]。否则当 `fill='none'` 时就无法得到正确的渲染结果：

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

## 导出成图片 {#export-as-image}

在导出被裁剪的单个元素为图片时，需要计算自身包围盒与父包围盒的交集，作为渲染到 OffscreenCanvas 的尺寸，或者在导出 SVG 时设置为 `viewbox` 的大小：

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

### 导出 PNG {#export-as-png}

唯一需要考虑的是，即使只选择导出被裁剪的子元素，也需要先渲染父元素。

### 导出 SVG {#export-as-svg}

先来看 `clipMode='clip'` 的状况。

作为裁剪的父元素有对应的 `<g>` 元素，设置它的 `clip-path` 引用自身对应的图形，要注意 [\<clipPath\>] 本身是不会被渲染的。

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

再来看 `clipMode='erase'` 的状况，SVG 的 mask 规则是：

-   白色（luminance 1）被遮元素显示
-   黑色（luminance 0）被遮元素不显示

先绘制一个足够大的白色矩形，再用黑色绘制负责擦除的元素：

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

最终 SVG 结构如下：

```html
<defs xmlns="http://www.w3.org/2000/svg">
    <mask id="mask-frame-1">
        <rect x="-10000" y="-10000" width="20000" height="20000" fill="white" />
        <rect fill="black" width="100" height="100" stroke="black" />
    </mask>
</defs>
```

## 扩展阅读 {#extended-reading}

-   [Shape clipping in tldraw]
-   [Frame properties in Figma]
-   [Stencil Testing in WebGPU and wgpu]
-   [Clipping and masking in SVG]

[Structural shapes]: https://tldraw.dev/sdk-features/default-shapes#Structural-shapes
[Shape clipping in tldraw]: https://tldraw.dev/sdk-features/shape-clipping
[Frame properties in Figma]: https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design#:~:text=Clip%20Content%3A%20Hide%20any%20objects%20within%20the%20frame%20that%20extend%20beyond%20the%20frame%27s%20bounds
[Stencil Testing in WebGPU and wgpu]: https://maxammann.org/posts/2022/01/wgpu-stencil-testing/
[课程 25 - 非原子化橡皮擦]: /zh/guide/lesson-025
[clip-path]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/clip-path
[\<clipPath\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/clipPath
[Clipping and masking in SVG]: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Clipping_and_masking
[课程 2 - SDF]: /zh/guide/lesson-002#sdf
