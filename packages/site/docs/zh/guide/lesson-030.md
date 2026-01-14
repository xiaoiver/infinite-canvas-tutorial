---
outline: deep
description: '使用后处理对图片进行处理。使用 Render Graph 优化渲染管线。'
head:
    - ['meta', { property: 'og:title', content: '课程 30 - 后处理与渲染图' }]
---

<script setup>
import ImageProcessing from '../../components/ImageProcessing.vue'
import GlobalEffects from '../../components/GlobalEffects.vue'
</script>

# 课程 30 - 后处理与渲染图

本节课中我们会回顾下传统基于 Shader 后处理的图像处理手段。

## 基于后处理的效果 {#post-processing}

基于 Shader 可以实现常见的图像处理效果，例如高斯模糊、Perlin 噪音、Glitch 等，当然还有最近火热的“液态玻璃”：

![source: https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers](/figma-liquid-glass.png)

![Adjust in Photoshop Web](/adjust-ps-web.png)

更多效果详见

-   [Image Processing]
-   [glfx.js]
-   [Paper Shaders]

在实现中，[Pixi.js filters] 会根据对象的包围盒计算应用区域，将对象渲染到一个临时的渲染纹理（render texture）上，然后再对该纹理应用着色器效果。

### 渲染到 RenderTarget 中 {#render-to-render-target}

在 Pixi.js 中

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

### 采样 {#sample}

接下来需要从整个画布的纹理中，对目标图形所在的区域进行采样：

```glsl
void main() {
  v_Uv = a_Position * (u_OutputFrame.zw / u_InputSize.xy) + u_OutputFrame.xy / u_InputSize.xy;

  gl_Position = vec4((a_Position * 2.0 - 1.0) * u_OutputTexture.xy / u_OutputFrame.zw * u_OutputTexture.z, 0.0, 1.0);
}
```

### 全屏三角形 {#big-triangle}

这里就可以使用全屏三角形了，相比 Quad 可以减少一个顶点，详见：[Optimizing Triangles for a Full-screen Pass]

![The blue rectangle represents the viewport. Red is the bounds of the geometry](https://wallisc.github.io/assets/FullscreenPass/1tri.jpg)

```ts
this.#bigTriangleVertexBuffer = this.device.createBuffer({
    viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
    usage: BufferUsage.VERTEX,
    hint: BufferFrequencyHint.DYNAMIC,
});
```

Vertex shader 非常简单，只需要正确映射 `v_Uv` 纹理坐标即可：

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

我们可以使用 [CSS filter] 语法，例如 `filter: brightness(0.4);`

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

### Noise {#noise}

[Spline - Noise Layer]

## 渲染图 {#render-graph}

Render Graph（有时称为 FrameGraph）是一种将渲染过程抽象为有向无环图（DAG）的现代渲染架构。在这一架构下，每个渲染 Pass 以及它们使用的资源都被视为图节点与边，通过图结构自动管理资源状态转换、同步和生命周期。

-   [FrameGraph: Extensible Rendering Architecture in Frostbite]
-   [Why Talking About Render Graphs]

![Frame graph example](/frame-graph.png)

在 [Render graph in bevy] 中用法如下：

```rs
// @see https://docs.rs/bevy/latest/bevy/render/render_graph/struct.RenderGraph.html
let mut graph = RenderGraph::default();
graph.add_node(Labels::A, MyNode);
graph.add_node(Labels::B, MyNode);
graph.add_node_edge(Labels::B, Labels::A);
```

### 设计思路 {#design-concept}

我们参考 [noclip] 的渲染图实现，它采用了三阶段设计：

1. 构建阶段（Graph Building）：声明式定义渲染流程。我们在下一小节使用方式会看到它。
2. 调度阶段（Scheduling）：自动分配和复用资源。其中又可以分解成一下阶段：

    - 统计阶段：遍历所有 Pass，统计每个 RenderTarget 和 ResolveTexture 的引用次数
    - 分配阶段：按需分配资源。首次使用时从对象池获取或创建，相同规格的资源可复用，引用计数归零时回收到对象池
    - 释放阶段：引用计数归零时回收到对象池

3. 执行阶段（Execution）：按顺序执行渲染通道

图数据结构如下。存储渲染图的声明式描述，不包含实际资源，只记录 Pass 和 RenderTarget 的 ID 关系：

```ts
class GraphImpl {
    renderTargetDescriptions: Readonly<RGRenderTargetDescription>[] = [];
    resolveTextureRenderTargetIDs: number[] = [];
    passes: RenderGraphPass[] = [];
}
```

### 使用方式 {#usage}

在每一次需要重绘时，创建一个新的 RenderGraphBuilder 用于构建 DAG，目前这个简单的 DAG 中包括一个主流程渲染 Pass，它将渲染结果输出到一个 ColorRT 和 DepthRT 中。后续我们会通过 `pushPass` 增加其他 Pass，可以将 ColorRT 作为输入进一步消费，最终这个 ColorRT 将被渲染到屏幕上。主要的渲染逻辑写在 `pass.exec` 的回调函数中，这个函数接收一个 `RenderPass` 对象，详见：[课程 2]。

```ts
const builder = renderGraph.newGraphBuilder();
builder.pushPass((pass) => {
    pass.setDebugName('Main Render Pass');
    pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);
    pass.attachRenderTargetID(RGAttachmentSlot.DepthStencil, mainDepthTargetID);
    pass.exec((renderPass) => {
        // 渲染网格
        // 渲染场景中的各种图形
    });
});
builder.resolveRenderTargetToExternalTexture(
    mainColorTargetID,
    onscreenTexture,
);
renderGraph.execute();
```

### FXAA {#fxaa}

现在我们在主渲染流程（Main Render Pass）之外新建一个 FXAA Pass 用于快速抗锯齿。与基于几何采样的 MSAA 等传统方法不同，FXAA 无需额外采样或知道场景几何信息，而是直接对最终像素进行处理，因此性能开销很低。该方法会使用 NTSC 权重 `0.299R + 0.587G + 0.114B` 将 RGB 转为灰度，用于边缘检测：

```glsl
float MonochromeNTSC(vec3 t_Color) {
  // NTSC primaries.
  return dot(t_Color.rgb, vec3(0.299, 0.587, 0.114));
}
```

回到渲染图的声明式语法。首先拿到上一步的 ColorRT

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

我们为整个画布应用了以下三个后处理效果：

```ts
api.setAppState({
    filter: 'fxaa() brightness(0.8) noise(0.1)',
});
```

<GlobalEffects />

## 扩展阅读 {#extended-reading}

-   [Blob Tracking]

[Paper Shaders]: https://shaders.paper.design/
[Pixi.js filters]: https://github.com/pixijs/filters
[CSS filter]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter
[Image Processing]: https://luma.gl/docs/api-reference/shadertools/shader-passes/image-processing
[glfx.js]: https://github.com/evanw/glfx.js
[FrameGraph: Extensible Rendering Architecture in Frostbite]: https://www.gdcvault.com/play/1024612/FrameGraph-Extensible-Rendering-Architecture-in
[Why Talking About Render Graphs]: https://logins.github.io/graphics/2021/05/31/RenderGraphs.html
[Render graph in bevy]: https://github.com/bevyengine/bevy/discussions/2524
[noclip]: https://github.com/magcius/noclip.website
[课程 2]: /zh/guide/lesson-002
[Spline - Noise Layer]: https://docs.spline.design/materials-shading/noise-layer
[Blob Tracking]: https://www.shadertoy.com/view/3fBXDD
[Optimizing Triangles for a Full-screen Pass]: https://wallisc.github.io/rendering/2021/04/18/Fullscreen-Pass.html
