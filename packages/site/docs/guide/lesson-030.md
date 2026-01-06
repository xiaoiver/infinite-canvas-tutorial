---
outline: deep
description: 'Use post-processing to process image. Use render graph to optimize pipeline.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lesson 30 - Post-processing and render graph',
          },
      ]
---

<script setup>
import ImageProcessing from '../components/ImageProcessing.vue'
</script>

# Lesson 30 - Post-processing and render graph

## Post-processing Effects {#post-processing}

Based on Shaders, common image processing effects can be achieved, such as Gaussian blur, Perlin noise, Glitch, and of course, the recently popular "liquid glass":

![source: https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers](/figma-liquid-glass.png)

![Adjust in Photoshop Web](/adjust-ps-web.png)

For more effects, see:

-   [Image Processing]
-   [glfx.js]
-   [Paper Shaders]

In implementation, [Pixi.js filters] calculate the application area based on the object's bounding box, render the object onto a temporary render texture, and then apply shader effects to that texture.

### RenderTarget {#render-to-render-target}

```ts
// src/filters/FilterSystem.ts
const quadGeometry = new Geometry({
    attributes: {
        aPosition: {
            buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
            format: 'float32x2',
            stride: 2 * 4,
            offset: 0,
        },
    },
    indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
});
```

### Sample {#sample}

Next, we need to sample the area where the target shape is located from the texture of the entire canvas:

```glsl
void main() {
  v_Uv = a_Position * (u_OutputFrame.zw / u_InputSize.xy) + u_OutputFrame.xy / u_InputSize.xy;

  gl_Position = vec4((a_Position * 2.0 - 1.0) * u_OutputTexture.xy / u_OutputFrame.zw * u_OutputTexture.z, 0.0, 1.0);
}
```

### Big triangle {#big-triangle}

Here we can use a full-screen triangle, which reduces one vertex compared to a Quad:

```ts
this.#bigTriangleVertexBuffer = this.device.createBuffer({
    viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
    usage: BufferUsage.VERTEX,
    hint: BufferFrequencyHint.DYNAMIC,
});
```

The vertex shader is very simple; it only needs to correctly map the `v_Uv` texture coordinates:

```glsl
void main() {
  v_Uv = 0.5 * (a_Position + 1.0);
  gl_Position = vec4(a_Position, 0.0, 1.0);

  #ifdef VIEWPORT_ORIGIN_TL
    v_Uv.y = 1.0 - v_Uv.y;
  #endif
}
```

### Brightness {#brightness}

We can use the [CSS filter] syntax, for example `filter: brightness(0.4);`

```glsl
uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  float u_Brightness;
};

out vec4 outputColor;

void main() {
  outputColor = texture(SAMPLER_2D(u_Texture), v_Uv);

  outputColor.rgb *= u_Brightness;
}
```

<ImageProcessing />

## Render graph {#render-graph}

Render Graph（有时称为 FrameGraph）是一种将渲染过程抽象为有向无环图（DAG）的现代渲染架构。在这一架构下，每个渲染 Pass 以及它们使用的资源都被视为图节点与边，通过图结构自动管理资源状态转换、同步和生命周期。

-   [FrameGraph: Extensible Rendering Architecture in Frostbite]
-   [Why Talking About Render Graphs]

![Frame graph example](/frame-graph.png)

[Render graph in bevy]

```rs
// @see https://docs.rs/bevy/latest/bevy/render/render_graph/struct.RenderGraph.html
let mut graph = RenderGraph::default();
graph.add_node(Labels::A, MyNode);
graph.add_node(Labels::B, MyNode);
graph.add_node_edge(Labels::B, Labels::A);
```

### Design concept {#design-concept}

We reference the render graph implementation from [noclip], which employs a three-phase design:

1.  Graph Building Phase: Declaratively defines the rendering pipeline. We'll see how it's used in the next subsection.
2.  Scheduling Phase: Automatically allocates and reuses resources. This can be further broken down into:

-   Statistics Phase: Traverse all passes to count references for each RenderTarget and ResolveTexture
-   Allocation Phase: Allocate resources on demand. Retrieve from the object pool or create on first use. Reuse resources with identical specifications. Return to the object pool when reference count reaches zero.
-   Release Phase: Return to the object pool when reference count reaches zero.

3. Execution Phase: Execute rendering passes sequentially.

The data structure for the render graph is as follows. It stores a declarative description of the render graph, containing no actual resources. It only records the ID relationships between Passes and Render Targets.

```ts
class GraphImpl {
    renderTargetDescriptions: Readonly<RGRenderTargetDescription>[] = [];
    resolveTextureRenderTargetIDs: number[] = [];
    passes: RenderGraphPass[] = [];
}
```

### Usage {#usage}

Each time a repaint is required, a new RenderGraphBuilder is created to construct the DAG. Currently, this simple DAG includes a main rendering pass that outputs results to a ColorRT and DepthRT. Subsequently, we will add additional passes using `pushPass`. The ColorRT can be consumed as input, and ultimately this ColorRT will be rendered to the screen. The main rendering logic is written in the callback function of `pass.exec`, which receives a `RenderPass` object. For details, see: [Lesson 2].

```ts
const builder = renderGraph.newGraphBuilder();
builder.pushPass((pass) => {
    pass.setDebugName('Main Render Pass');
    pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);
    pass.attachRenderTargetID(RGAttachmentSlot.DepthStencil, mainDepthTargetID);
    pass.exec((renderPass) => {
        // Render grid
        // Render shapes in current scene
    });
});
builder.resolveRenderTargetToExternalTexture(
    mainColorTargetID,
    onscreenTexture,
);
renderGraph.execute();
```

### FXAA {#fxaa}

We now create a separate FXAA pass outside the main render pass for fast anti-aliasing. It detects edge directions, performs multi-sample blending along edge directions, and applies brightness range validation to prevent excessive blurring. Compared to MSAA, it is lighter and better suited for real-time rendering.

This method converts RGB to grayscale using NTSC weights `0.299R + 0.587G + 0.114B` for edge detection.

```glsl
float MonochromeNTSC(vec3 t_Color) {
  // NTSC primaries.
  return dot(t_Color.rgb, vec3(0.299, 0.587, 0.114));
}
```

Returning to the declarative syntax of the render graph. First, obtain the ColorRT from the previous step.

```ts
builder.pushPass((pass) => {
    pass.setDebugName('FXAA');
    pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);

    const mainColorResolveTextureID =
        builder.resolveRenderTarget(mainColorTargetID);
    pass.attachResolveTexture(mainColorResolveTextureID);

    pass.exec((passRenderer, scope) => {
        postProcessingRenderer.render(
            passRenderer,
            scope.getResolveTextureForID(mainColorResolveTextureID),
        );
    });
});
```

[Paper Shaders]: https://shaders.paper.design/
[Pixi.js filters]: https://github.com/pixijs/filters
[CSS filter]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter
[Image Processing]: https://luma.gl/docs/api-reference/shadertools/shader-passes/image-processing
[glfx.js]: https://github.com/evanw/glfx.js
[FrameGraph: Extensible Rendering Architecture in Frostbite]: https://www.gdcvault.com/play/1024612/FrameGraph-Extensible-Rendering-Architecture-in
[Why Talking About Render Graphs]: https://logins.github.io/graphics/2021/05/31/RenderGraphs.html
[Render graph in bevy]: https://github.com/bevyengine/bevy/discussions/2524
[noclip]: https://github.com/magcius/noclip.website
[Lesson 2]: /guide/lesson-002
