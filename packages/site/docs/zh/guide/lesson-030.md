---
outline: deep
description: '使用后处理对图片进行处理。使用 Render Graph 优化渲染管线。'
head:
    - ['meta', { property: 'og:title', content: '课程 30 - 后处理与渲染图' }]
---

<script setup>
import ImageProcessing from '../../components/ImageProcessing.vue'
import HalftoneDots from '../../components/HalftoneDots.vue'
import Pixelate from '../../components/Pixelate.vue'
import CRT from '../../components/CRT.vue'
import Glitch from '../../components/Glitch.vue'
import LiquidGlass from '../../components/LiquidGlass.vue'
import LiquidMetal from '../../components/LiquidMetal.vue'
import Heatmap from '../../components/Heatmap.vue'
import GenSmoke from '../../components/GenSmoke.vue'
import Ascii from '../../components/Ascii.vue'
import Burn from '../../components/Burn.vue'
import GlobalEffects from '../../components/GlobalEffects.vue'
</script>

# 课程 30 - 后处理与渲染图

本节课中我们会回顾传统基于 Shader 的后处理图像手段（全屏 Pass、采样与常见效果），并在此基础上介绍如何用渲染图（Render Graph）组织多 Pass、管理渲染目标与同步，以优化整条后处理管线。

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

### 亮度和对比度 {#brightness-contrast}

我们可以使用 [CSS filter] 语法，例如 `filter: brightness(0.4);`

在实现上用一个 Shader 就可以解决，参考 [brightnesscontrast.js]

```glsl
uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_BrightnessContrast;
};

out vec4 outputColor;

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  float brightness = u_BrightnessContrast.x;
  float contrast = u_BrightnessContrast.y;

  if (color.a > 0.0) {
    color.rgb /= color.a;
    color.rgb += brightness;
    if (contrast > 0.0) {
      color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;
    } else {
      color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;
    }
    color.rgb *= color.a;
  }

  outputColor = color;
}
```

<ImageProcessing />

### Noise {#noise}

Noise（噪点）在后处理里通常按屏幕 UV 生成伪随机数，再叠加到 RGB 上，用于模拟胶片颗粒、信号干扰等。本教程中的实现参考 [glfx.js 的 noise 滤镜][glfx-noise]，用均匀随机与强度系数 `u_Noise` 控制扰动幅度；写入前会对颜色做非预乘处理，再乘回 alpha，避免透明边缘发灰。

在 `filter` 字符串中可以写作 `noise(0.1)`，括号内为强度（约 0 ～ 1）。若从设计工具出发，也可对照 [Spline 的 Noise Layer][Spline - Noise Layer]：同样是把程序化噪声叠在材质/填充上，只是我们这里是在已光栅化的纹理上做全屏 Pass。

### Halftone {#halftone}

半色调（Halftone）用规则图案调制明暗，模拟印刷网点。

-   **Dot（网点屏）**：参考 [Pixi `dot.frag`][dot.frag]，在旋转后的坐标上对 `sin(x)·sin(y)` 采样，得到黑白网点；可配合灰度化，适合老印刷、漫画网点效果。`filter` 示例：`dot(1, 5, 1)`（scale、angle、是否灰度）。
-   **Color halftone（彩色半色调）**：参考 [glfx `colorhalftone.js`][colorhalftone.js]，把 RGB 转成 CMY/K 思路，用四套不同相位的正弦栅格分别调制青、品、黄与黑版，得到彩色印刷感。简写为 `color-halftone(6)`（仅网点直径），或 `color-halftone(6, 0.5)`（直径与弧度角），完整四参数可指定图案中心与角度。

```glsl
float halftonePattern(float rotAngle) {
// 连续正弦屏，没有点型、颗粒、六角格等参数
  float s = sin(rotAngle), c = cos(rotAngle);
  vec2 tex = v_Uv * u_CH1.xy - u_CH0.xy;
  vec2 point = vec2(
    c * tex.x - s * tex.y,
    s * tex.x + c * tex.y
  ) * u_CH0.w;
  return (sin(point.x) * sin(point.y)) * 4.0;
}

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  // ...
  vec3 cmy = 1.0 - color.rgb; // CMYK 分离
  float k = min(cmy.x, min(cmy.y, cmy.z));
  // ...
  cmy = clamp(
    cmy * 10.0 - 3.0 + vec3(
      halftonePattern(baseAngle + 0.26179),
      halftonePattern(baseAngle + 1.30899),
      halftonePattern(baseAngle)
    ),
    0.0,
    1.0
  );
  k = clamp(k * 10.0 - 5.0 + halftonePattern(baseAngle + 0.78539), 0.0, 1.0);
  vec3 rgb = 1.0 - cmy - vec3(k);
  // ...
}
```

[Paper Shaders] 的实现使用了另一种思路，支持报纸大图网点、点大小跟明暗走、可换点型/六角格/颗粒等特性。

<HalftoneDots />

### Pixelate {#pixelate}

按像素块取样放大马赛克，见 [Pixi `pixelate.frag`][pixelate.frag]，例如 `pixelate(12px)`。也可以对叠加了噪声的渐变效果应用。

<Pixelate />

### CRT & vignette {#crt-vignette}

模仿老电视机的效果，加上暗角：

<CRT />

### Glitch {#glitch}

-   [CSSGlitchEffect]
-   [unityglitch]

<Glitch />

### Ascii {#ascii}

先把画面按 uSize 分格并算灰度，用灰度选一个 位图常数 n，再在格内每个像素用 n 的 bit 决定亮/暗，乘到颜色上。这是典型的 bitmap font / ASCII art 做法，不是矢量字或纹理字。

```glsl
float n = 65536.0;
if (gray > 0.2) n = 65600.0; // .
if (gray > 0.3) n = 332772.0; // :
if (gray > 0.4) n = 15255086.0; // *
if (gray > 0.5) n = 23385164.0; // o
```

<Ascii />

### 液态玻璃 {#liquid-glass}

<LiquidGlass />

### 灼烧 {#burn}

<Burn />

### 液态金属 {#liquid-metal}

<LiquidMetal />

### 热力图 {#heatmap}

<Heatmap />

### 烟雾 {#gen-smoke}

<GenSmoke />

### 时间动画 {#time-animation}

一些后处理效果可以应用动画，通常会传入一个每一帧更新的时间变量（例如 shadertoy 中的 `u_Time`）

```ts
export class PostEffectTime extends System {
    execute() {
        setPostEffectEngineTimeSeconds(perf.now() / 1000);
    }
}
```

[课程 10 - 导出 GIF]

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
-   [reveals.cool]
-   [Liquid Metal Logo]

[Paper Shaders]: https://shaders.paper.design/
[Pixi.js filters]: https://github.com/pixijs/filters
[CSS filter]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter
[Image Processing]: https://luma.gl/docs/api-reference/shadertools/shader-passes/image-processing
[glfx.js]: https://github.com/evanw/glfx.js
[brightnesscontrast.js]: https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/brightnesscontrast.js
[FrameGraph: Extensible Rendering Architecture in Frostbite]: https://www.gdcvault.com/play/1024612/FrameGraph-Extensible-Rendering-Architecture-in
[Why Talking About Render Graphs]: https://logins.github.io/graphics/2021/05/31/RenderGraphs.html
[Render graph in bevy]: https://github.com/bevyengine/bevy/discussions/2524
[noclip]: https://github.com/magcius/noclip.website
[课程 2]: /zh/guide/lesson-002
[Spline - Noise Layer]: https://docs.spline.design/materials-shading/noise-layer
[glfx-noise]: https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/noise.js
[dot.frag]: https://github.com/pixijs/filters/blob/main/src/dot/dot.frag
[colorhalftone.js]: https://github.com/evanw/glfx.js/blob/master/src/filters/fun/colorhalftone.js
[pixelate.frag]: https://github.com/pixijs/filters/blob/main/src/pixelate/pixelate.frag
[Blob Tracking]: https://www.shadertoy.com/view/3fBXDD
[Optimizing Triangles for a Full-screen Pass]: https://wallisc.github.io/rendering/2021/04/18/Fullscreen-Pass.html
[CSSGlitchEffect]: https://tympanus.net/Tutorials/CSSGlitchEffect/
[unityglitch]: https://github.com/staffantan/unityglitch/blob/master/GlitchShader.shader
[reveals.cool]: https://reveals.cool/
[Liquid Metal Logo]: https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/liquid-metal.ts
[课程 10 - 导出 GIF]: /zh/guide/lesson-010#to-gif
