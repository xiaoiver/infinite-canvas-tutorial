---
outline: deep
description: '基于瓦片的渲染技术介绍，包含瓦片渲染原理、性能优化策略以及在无限画布中的应用实例。'
publish: false
---

<script setup>
import Vello from '../../components/Vello.vue'
import VelloBlur from '../../components/VelloBlur.vue'
import VelloDropShadow from '../../components/VelloDropShadow.vue'
</script>

# 课程 35 - 基于瓦片的渲染

Google Maps 或者 Mapbox 都提供了 Map tiles API。在不同缩放层级下，屏幕被分割成多个瓦片（Tiles）

![source: https://developers.google.com/maps/documentation/tile](https://developers.google.com/static/maps/documentation/tile/images/roadmap_tile2_720.png)

以 Mapbox 为例，每个矢量瓦片中存储的是编码后的 GeoJSON 数据，详见：[Vector tiles introduction]，相比栅格瓦片可以在任何缩放等级下保持锐利。

之前我们介绍的传统的基于 Mesh 的渲染器，它的复杂度为 `O(pixels × shapes)`

```plaintext
for pixel:
   check all shapes
```

而如果我们将屏幕空间划分成若干个瓦片，就只需要检查每个瓦片中的图形，复杂度为 `O(tiles × shapes_per_tile)`，而 `shapes_per_tile << total_shapes`，这就是基于瓦片渲染在某些场景下更快的原因。

```plaintext
for tile:
   check shapes in tile
```

当然基于瓦片渲染也有 bad case，例如一个巨大的图形覆盖了整个屏幕。

在本节课中，我们将尝试将渲染层替换成一个基于 GPU tile-based 的渲染器 [vello]，它完全基于 Compute Shader 运行，能充分发挥 WebGPU 的优势。

<Vello />

## vello {#vello}

vello 目前实际上有三个并行的实现版本，详见 [Vello Sparse Strips]：

-   vello (GPU) - 纯 GPU 计算着色器实现
-   vello CPU - 纯 CPU 实现，使用多线程和 SIMD 加速
-   vello hybrid - CPU/GPU 混合模式

这三个版本共享核心算法（Sparse Strips/稀疏条带），但在执行后端上有所不同

![source: https://www.datocms-assets.com/98516/1707130683-levien_2023.pdf](/vello-architecture.png)

以 vello cpu 为例，其整体架构如下：

![source: https://ethz.ch/content/dam/ethz/special-interest/infk/inst-pls/plf-dam/documents/StudentProjects/MasterTheses/2025-Laurenz-Thesis.pdf](/vello-overview.png)

### Encoding

当我们调用类似 vello 的绘制命令时，最终被编码成如下格式放入 Buffer 中，用于后续在 compute shader 中操作：

```rust
scene.fill(..., &rect)
scene.stroke(..., &path)
```

<https://github.com/linebender/vello/blob/main/vello_encoding/src/path.rs#L248>

![path encoding](/vello-path-encoding.png)

### Stroke expansion

在 [课程 12 - 绘制折线] 中，我们介绍过对线段进行拉伸后渲染，然后对与 stroke 和 fill 分别使用两个 mesh 进行绘制。vello 中同样需要对有宽度的线段进行拉伸，随后就可以将 stroke 和 fill 统一处理。

![stroke expansion](/vello-stroke-expansion.png)

拉伸时同样需要考虑 linecap 和 linejoin，之前我们是使用了 Analytic Stroke 的思路在 fragment shader 中完成的。

![source: https://dl.acm.org/doi/pdf/10.1145/3675390](/vello-path-style.png)

对于作为中心线的贝塞尔曲线被加粗后，内侧和外侧的边界线（平行曲线）很难计算。[GPU-friendly Stroke Expansion] 一文提出了 GPU 并行算法，使用特殊的几何近似（欧拉螺旋 Euler Spiral）避免迭代计算，欧拉螺旋是曲率随弧长线性变化的曲线，详见：[Euler Spiral / Clothoid - An Illustrated Explanation]。

它的关键性质如下：

-   可以用三次贝塞尔高效近似（只需 1-2 段）
-   天然适合描述平行曲线的几何特性
-   有解析表达式，适合 GPU 计算

vello CPU 会使用 [kurbo] 完成，可以参考：[Stroke expansion]，缺点就是并行性较差，另外由于变换发生在几何空间，当缩放层级较高时就会覆盖几乎全部 tiles。对于 [stroke-alignment]，可以通过 kurbo 的 offset path 实现。另外对于贝塞尔曲线，会先转换成折线再拉伸。

### 展平成线段 {#flattening}

我们之前在曲线上进行采样，将其用折线拟合。vello 中也会将三次贝塞尔曲线、二次贝塞尔曲线、椭圆弧等展平为线段，使用自适应细分算法，根据曲率动态决定细分程度，同时使用 GPU 并行：每个曲线段独立处理。

![flattening](/vello-flattening.png)

而在 compute shader 中会展平成一组欧拉螺旋子曲线用于拟合，充分利用 GPU 的并行性：

![stroke expansion](/vello-stroke-expansion-gpu.png)

```wgsl
// This function flattens a cubic Bézier by first converting it into Euler spiral
// segments, and then computes a near-optimal flattening of the parallel curves of
// the Euler spiral segments.
fn flatten_euler(
    cubic: CubicPoints,
    path_ix: u32,
    local_to_device: Transform,
    offset: f32,
    start_p: vec2f,
    end_p: vec2f,
) {
}
```

可以在这里看到完整代码：<https://github.com/linebender/vello/blob/main/vello_shaders/shader/flatten.wgsl>

![compute shader](/vello-compute-shader.png)

### 生成瓦片 {#tile-generation}

接下来需要将扁平化后的路径分配到水平条带。屏幕会被切成固定大小的小块(4×4)，这里和地图渲染器基于 LOD 的实现思路不同。对每条线段，计算它跨越的所有 4×4 区域，为每个相交区域创建一个 Tile，关联到对应线段。

![tile generation](/vello-tile-generation.png)

生成的 Tiles 必须按行优先顺序（Row-Major Order）排序：先按 Y 坐标排序，相同 Y 的按 X 坐标排序。
为什么需要排序呢？这是为了后续的 Strip Generation 阶段能够高效地水平合并相邻 Tiles。

### Sparse strips

接下来将按行优先排序过的、水平相邻的 Tiles 合并为 Sparse Strips。只在路径实际经过的水平条带（strips）上存储覆盖信息，内存效率极高，它的数据结构如下：

```rust
struct Strip {
    x: u16,          // 起始 X 坐标
    width: u16,      // 宽度（像素数，是4的倍数）
    alpha_idx: u32,  // 指向 alpha 值的索引
    fill_gap: bool,  // 是否与下一个 strip 之间需要填充
}
```

对于每个 4×4 Tile 内的像素，计算覆盖值（Coverage）：

-   使用分析性抗锯齿（Analytic AA）
-   计算每个像素的子像素覆盖（Subpixel Coverage）
-   只存储有变化的边缘像素，内部填充区域隐式表示

内存优化：相比存储完整覆盖掩码（如 8×8 或 16×16），4×4 Tile 配合 Sparse Strips 只存储实际有边缘的区域，内存带宽大幅减少。

[High-performance 2D graphics rendering on the CPU using sparse strips]

![source: https://docs.google.com/presentation/d/1f_vKBJMaD68ifBO2j83lBly9Zdk-2bsvj_DIHXxvcuk/edit?slide=id.g3577762aae3_0_24#slide=id.g3577762aae3_0_24](/vello-sparse-stripes.png)

### 粗光栅化 {#coarse-rasterization}

粗光栅化阶段将画布分割为 256×4 像素的 Wide Tiles。每个 Wide Tile 包含一个命令向量（Command Vector），存储两种命令：

-   Fill Command 用于填充 strips 之间的非抗锯齿区域（纯色填充）
-   AlphaFill Command 用于填充 strips 内的抗锯齿区域（需要应用 Alpha 遮罩）

![coarse rasterization](/vello-coarse-rasterization.png)

### 细光栅化 {#fine-Rasterization}

最终的像素着色器，每个 Workgroup 处理一个 Wide Tile（256×4 像素）。

```wgsl
// https://github.com/linebender/vello/blob/main/vello_shaders/shader/fine.wgsl

// The X size should be 16 / PIXELS_PER_THREAD
@compute @workgroup_size(4, 16)
fn main(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) wg_id: vec3<u32>,
) {
    let tile_ix = wg_id.y * config.width_in_tiles + wg_id.x;

    while true {
        let tag = ptcl[cmd_ix];
        if tag == CMD_END {
            break;
        }
        switch tag {
            case CMD_FILL: { // 处理所有 FillCommands（纯色填充）
                let fill = read_fill(cmd_ix);
                cmd_ix += 4u;
            }
            case CMD_SOLID: {
            }
        }
    }

// 写入最终帧缓冲区（转换为 RGBA8）
    let xy_uint = vec2<u32>(xy);
    for (var i = 0u; i < PIXELS_PER_THREAD; i += 1u) {
        let coords = xy_uint + vec2(i, 0u);
        if coords.x < config.target_width && coords.y < config.target_height {
            let fg = rgba[i];
            // let fg = base_color * (1.0 - foreground.a) + foreground;
            // Max with a small epsilon to avoid NaNs
            let a_inv = 1.0 / max(fg.a, 1e-6);
            let rgba_sep = vec4(fg.rgb * a_inv, fg.a);
            textureStore(output, vec2<i32>(coords), rgba_sep);
        }
    }
}
```

## 基于 ECS 替换渲染层 {#replace-rendering-pipeline}

[vello] 是一个纯粹的 2D 渲染器，类似基于视口的剔除、脏检查、空间索引等功能需要由上层应用实现。例如 Xilem 是一个构建在 vello 之上的 GUI 框架，它就实现了一套基于组件树的 diff 机制。

因此对于我们来说也是一样，只需要替换渲染层，保持其他功能不变。得益于 ECS 架构这很容易实现，我们只需要将 RenderPlugin 中的两个默认 System 替换成基于 vello 实现的即可，详见：[课程 18 - 使用 ECS 重构]。

```ts
import {
    DefaultPlugins,
    DefaultRendererPlugin,
    RendererPlugin,
} from '@infinite-canvas-tutorial/ecs';

const VelloRendererPlugin = RendererPlugin.configure({
    setupDeviceSystemCtor: InitVello,
    rendererSystemCtor: VelloPipeline,
});
DefaultPlugins.splice(
    DefaultPlugins.indexOf(DefaultRendererPlugin),
    1,
    VelloRendererPlugin,
);
```

### 使用 wasm-pack {#use-wasm-pack}

我们使用 [wasm-pack] 构建，运行 `wasm-pack build --target web` 即可在 `/pkg` 下得到构建产物：

```ts
rust
├── Cargo.lock
├── Cargo.toml
├── pkg
│   ├── README.md
│   ├── package.json
│   ├── vello_renderer.d.ts
│   ├── vello_renderer.js
│   ├── vello_renderer_bg.wasm
│   └── vello_renderer_bg.wasm.d.ts
├── src
│   ├── lib.rs // main source file.
│   └── main.rs
```

随后就可以在 JS 侧使用，例如加载 WASM 完成初始化，加载字体文件。

```ts
import init, {
    registerDefaultFont,
    runWithCanvas,
} from '@infinite-canvas-tutorial/vello-renderer';

export class InitVello extends System {
    async prepare() {
        await init();

        const r = await fetch('/NotoSans-Regular.ttf');
        const buf = await r.arrayBuffer();
        registerDefaultFont(buf);
    }
}
```

在渲染时调用对应的图形渲染方法，将属性列表以对象形式传入：

```ts
import { addEllipse } from '@infinite-canvas-tutorial/vello-renderer';

export class VelloPipeline extends System {
    private renderCamera(canvas: Entity, camera: Entity, sort = false) {
        clearShapes(canvasId); // 清空屏幕
        getDescendants(camera) // 遍历场景图
            .filter((e) => !e.has(Culled)) // 被剔除的不需要渲染
            .forEach((entity) => {
                if (entity.has(Circle)) {
                    const { cx, cy, r } = entity.read(Circle);
                    const opts: Record<string, unknown> = {
                        ...baseOpts,
                        cx,
                        cy,
                        rx: r,
                        ry: r,
                    };

                    // 调用封装后的 vello 渲染方法
                    addEllipse(canvasId, opts);
                }
            });
    }
}
```

[wasm-bindgen] 负责处理 JS 和 WASM 间的交互，例如：

-   在 Rust 中操作 JS 的功能。例如获取 `window.devicePixelRatio`

```rust
#[cfg(target_arch = "wasm32")]
fn device_pixel_ratio() -> f64 {
    web_sys::window()
        .map(|w| w.device_pixel_ratio())
        .unwrap_or(1.0)
}
```

-   向 JS 暴露可供调用的方法。例如 `init` `addEllipse` 这些。

```rust
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addEllipse)]
pub fn js_add_ellipse(canvas_id: u32, opts: JsValue) {
    push_shape(canvas_id, JsShape::Ellipse {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        cx: o.cx,
        cy: o.cy,
        rx: o.rx,
        ry: o.ry,
        fill: o.fill,
    });
}

// 使用 vello 绘制椭圆
use vello::kurbo::{Ellipse};
scene.fill(Fill::NonZero, shape_transform, &brush, None, &ellipse);
```

-   生成 TypeScript 类型文件

接下来让我们看看如何在 Rust 生态中使用 vello 实现一些渲染特性，尤其是在 JS 中比较复杂的部分。

### 渐变 {#gradient}

在 [课程 17 - 渐变和重复图案] 中我们介绍了如何使用 `<canvas>` 创建 CSS 语法的渐变。

```rust
if let Some(ref grads) = fill_gradients {
    for g in grads.iter().rev() {
        let brush = vello::peniko::Brush::Gradient(build_gradient_brush(g, fill_mult));
        scene.fill(Fill::NonZero, shape_transform, &brush, None, &geom);
    }
}
```

在 vello 中支持转换成 [peniko] Gradient 后渲染，可以看到语法和 Canvas API 很接近：

```rust
fn build_gradient_brush(spec: &FillGradientSpec, fill_opacity_mult: f32) -> Gradient {
    let stops: Vec<ColorStop> = spec
        .stops
        .iter()
        .map(|(offset, color)| {
            let c = apply_opacity_to_color(*color, fill_opacity_mult, 1.0);
            ColorStop::from((*offset, Color::new(c)))
        })
        .collect();
    let gradient = match spec.kind.as_str() {
        "linear" => Gradient::new_linear((spec.x1, spec.y1), (spec.x2, spec.y2)),
        "radial" => Gradient::new_radial((spec.cx, spec.cy), spec.r as f32),
        "conic" => Gradient::new_sweep(
            (spec.cx, spec.cy),
            spec.start_angle as f32,
            spec.end_angle as f32,
        ),
        _ => Gradient::new_linear((spec.x1, spec.y1), (spec.x2, spec.y2)),
    };
    gradient.with_stops(stops.as_slice())
}
```

### 手绘风格 {#rough}

在 [课程 13 - 绘制 Path & 手绘风格] 中，我们使用 `rough-js` 为图形生成手绘风格的一组 Path 后渲染。我们当然可以把这一组 Path 定义传给 vello 后渲染。但使用 Rust 生态的 [roughr] 可以避免 JS 到 WASM 的数据传递。

```rust
JsShape::RoughRect { x, y, width, height, .. } => {
    let options = Options {
        roughness: Some(roughness),
        bowing: Some(bowing),
        ..Options::default()
    };
    let generator = Generator::default();
    let drawable = generator.rectangle(x as f32, y as f32, width as f32, height as f32, &Some(options));
    render_rough_drawable(scene, shape_transform, &drawable, fill_color, stroke_color);
}
```

### 文本 {#text}

在 [课程 15 - 绘制文本] 中，我们使用 SDF / MSDF 完成文本的渲染，在文本 shaping 和 layout 上花了不少精力，这部分可以使用 [parley] 完成。大致步骤如下：

```plaintext
文本布局 (Parley) ← 使用 HarfRust/Swash 进行 Shaping
    ↓
字体解析 (Skrifa) ← 提取字形轮廓 (BezPath)
    ↓
Vello/Scene ← 渲染路径
    ↓
Peniko (Brush/Color/Gradient/Image)
```

-   FontContext: 注册字体，接收从 JS 侧传入的字体文件数据
-   LayoutContext: 构建文本布局，支持：
    -   字体族、大小、字距 (letter_spacing)
    -   自动换行、对齐
    -   Kerning、Ligatures、Bidi 等复杂排版特性
-   输出 vello 接受的 FontData，这部分由 [peniko] 提供基础图形原语（颜色、画笔、字体数据）
-   使用 vello 渲染 Path 格式的字形，完全不需要使用 SDF

```rust
if let Some((font_data, glyphs, size)) =
    build_text_glyphs(&bytes, &content, font_size_eff as f32, letter_spacing_eff as f32)
{
    let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
    let color = Color::new(fill_color);
    scene
        .draw_glyphs(&font_data)
        .font_size(size)
        .transform(shape_transform)
        .brush(color)
        .draw(Fill::NonZero, glyphs.into_iter());
}
```

| 特性         | SDF 方法                         | Vello 实时矢量                                                |
| ------------ | -------------------------------- | ------------------------------------------------------------- |
| **预计算**   | 需要预生成距离场纹理             | 实时从轮廓计算                                                |
| **内存占用** | 需要图集（Atlas）存储距离场      | 无图集，每帧重新编码轮廓                                      |
| **缩放质量** | 大缩放时拐角变圆，细节丢失       | 任何缩放都保持锐利边缘                                        |
| **可变字体** | 难以支持（需要每帧重新生成 SDF） | 原生支持，可动画化字重/宽度                                   |
| **小字号**   | _hinting_ 困难                   | 支持 hinting [Round vertical hinting offset in Vello Classic] |
| **性能**     | GPU 采样快，但预处理慢           | GPU 计算密集型，但零预处理                                    |

如果需要支持 CJK，需要加载对应字体。但 CJK 字体文件很大（通常 10MB+），导致：

1. 字体注册慢 - 每帧都要处理大字体文件
2. 字形缓存爆炸 - 数千个 CJK 字形占用大量内存

![jank when rendering CJK glyphs in vello](/vello-text-jank.png)

因此我们需要充分利用缓存，避免每帧都对整段文本做一次 parley 排版以及拷贝中文字体数据。
当然也可以考虑字体子集化方案，有趣的在 [课程 10 - 图片导入导出] 中我们介绍过 excalidraw 在将 Web 字体内联到 SVG 时也会做动态裁剪。

虽然不需要使用 SDF 渲染字体，但 vello 也支持非矢量字形：

-   COLR/CPAL 彩色字体：作为图像（Image）渲染，通过 Vello 的图像合成管线
-   位图字形（Emoji）：直接作为纹理 quad 渲染

首先使用 parley 对带有 emoji 的文本整体计算布局，再使用 Canvas API 绘制 emoji 并获取像素数据，随后用 vello 渲染：

```rust
fn get_or_create_emoji_image(emoji: &str, size: u32) -> Option<(Vec<u8>, u32, u32)> {
    let document = web_sys::window()?.document()?;
    let canvas = document.create_element("canvas").ok()?.dyn_into::<web_sys::HtmlCanvasElement>().ok()?;

    let ctx = canvas.get_context("2d").ok()??.dyn_into::<web_sys::CanvasRenderingContext2d>().ok()?;
    ctx.fill_text(emoji, (size / 2) as f64, (size / 2) as f64).ok()?;

    // 获取像素数据
    let image_data = ctx.get_image_data(0.0, 0.0, canvas_size as f64, canvas_size as f64).ok()?;
    let data = image_data.data();
    let rgba: Vec<u8> = data.to_vec();
    let result = (rgba, canvas_size, canvas_size);
}
```

### 后处理 {#post-processing}

我们可以尝试实现一些后处理效果，类似 [课程 30 - 后处理与渲染图]。

#### Blur {#blur}

vello 提供了 [draw_blurred_rounded_rect](https://github.com/linebender/vello/blob/main/vello/src/scene.rs#L253) 方法，只适合圆角矩形，对其他图形不适用。

```rust
scene.draw_blurred_rounded_rect(
    shape_transform,
    base_rect,
    Color::new(fill_color),
    r,
    blur_std_dev
);
```

<VelloBlur />

#### Dropshadow {#dropshadow}

使用 vello 的 Layer 功能

-   将形状绘制到离屏 layer
-   应用模糊效果
-   偏移后绘制到主场景

<VelloDropShadow />

## 其他功能的 Rust 实现 {#other-functions-implemented-with-rust}

### 包围盒计算 {#compute-bounds}

我们可以将文本度量涉及的 BiDi、clusters 等交给 [parley] 处理。另外对于带有描边、`linecap` `linejoin` 等属性的 Polyline 和 Path 的包围盒计算，之前也是用了近似估计的方式，现在我们就可以使用 [kurbo] 提供的 `BezPath::bounding_box()` 方法获得更精确的结果：

```rust
/// 精确包围盒：fill 用 BezPath::bounding_box()，stroke 用 Kurbo 的 stroke 展开成轮廓 path 再取 bbox，两者 union。
/// 参考 Graphite 的实现：把 stroke 几何变成 fill 轮廓再取 bounding_box 是最接近“精确”的做法。
fn path_render_bounds(d: &str, stroke: Option<&StrokeParams>) -> Option<Rect> {
    let bez = BezPath::from_svg(d).ok()?;
    let fill_rect = bez.bounding_box();
    let mut result = fill_rect;

    if let Some(s) = stroke {
        if s.width > 0.0 {
            let kurbo_stroke = s.to_kurbo_stroke();
            let opts = StrokeOpts::default();
            const TOLERANCE: f64 = 0.1;
            let stroke_path = vello::kurbo::stroke(bez.iter(), &kurbo_stroke, &opts, TOLERANCE);
            let stroke_rect = stroke_path.bounding_box();
            result = result.union(stroke_rect);
        }
    }

    Some(result)
}
```

然后在 vello 初始化时动态扩展：

```ts
import {
    Path,
    createGeometryBoundsProviderFromComputePathBounds,
} from '@infinite-canvas-tutorial/ecs';
import { computePathBounds } from '@infinite-canvas-tutorial/vello-renderer';

Path.geometryBoundsProvider =
    createGeometryBoundsProviderFromComputePathBounds(computePathBounds);
```

### 拾取 {#picking}

除了渲染，拾取也可以放在 WASM 中完成。例如在 [Graphite] 中

```rust
// node-graph/gcore/src/vector/click_target.rs
struct ClickTarget {
    bounds: [DVec2; 2],           // 边界盒 [min, max]
    path: Option<BezPath>,        // 精确路径（可选）
    stroke_width: f64,
}

impl ClickTarget {
    // 屏幕坐标拾取检测
    fn intersects(&self, point: DVec2, layer_transform: DAffine2) -> bool {
        // 1. 逆变换到局部坐标
        let local_point = layer_transform.inverse() * point;

        // 2. 边界盒快速排斥
        let target_bounds = [
            self.bounds[0] - DVec2::splat(self.stroke_width / 2.0),
            self.bounds[1] + DVec2::splat(self.stroke_width / 2.0),
        ];

        if !aabb_intersect(target_bounds, [local_point, local_point]) {
            return false;
        }

        // 3. 精确路径检测（射线法）
        if let Some(path) = &self.path {
            path.winding(local_point) != 0
        } else {
            true
        }
    }
}
```

之前我们判断点是否在 Path 内需要使用 Canvas API [isPointInStroke] 和 [isPointInPath]：

```ts
const ctx = DOMAdapter.get().createCanvas(100, 100).getContext('2d');
const { d } = entity.read(Path);
const path = new Path2D(d);
if (hasStroke) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = stroke.linecap;
    ctx.lineJoin = stroke.linejoin;
    ctx.miterLimit = stroke.miterlimit;
    ctx.stroke(path);
    isIntersected = ctx.isPointInStroke(path, x, y);
}
```

现在也可以使用 [kurbo]，将 Path 在一定误差范围内展平成多个子路径，分别进行相交性检测：

```rust
fn is_point_in_path_fill(d: &str, x: f64, y: f64, fill_rule: &str) -> bool {
    let Ok(bez) = BezPath::from_svg(d) else { return false; };
    let subs = flatten_bez_path(&bez, 0.25);
    let p = Point::new(x, y);

    // nonzero：对每个 closed contour 累加 winding（这里用“逐 contour 判断”近似；
    // 对于复杂自交路径仍是近似，但比简单 bbox 更接近 Canvas2D）。
    // 更精确的做法是对所有边统一累计 winding；当前实现已足够用于选择/拾取。
    for sp in subs.iter() {
        if sp.closed && sp.points.len() >= 3 && point_in_polygon_nonzero(p, &sp.points) {
            return true;
        }
    }
    false
}
```

### 布局引擎 {#layout-engine}

在 [课程 33 - 布局引擎] 中，我们使用编译成 WASM 的 Yoga。[taffy] 是 Rust 生态中的布局引擎，除了支持 Flexbox 还支持 Grid 布局。

## 扩展阅读 {#extended-reading}

-   [High-performance 2D graphics rendering on the CPU using sparse strips]
-   [Faster, easier 2D vector rendering - Raph Levien]
-   [Vello Sparse Strips Roadmap 2025-2026]
-   [What does Tile based rendering mean?]
-   [Motiff]
-   [Pushing the limit with tilemap rendering]
-   [tile rendering in path tracer]

[What does Tile based rendering mean?]: https://stackoverflow.com/questions/69956923/what-does-tile-based-rendering-mean
[Motiff]: https://www.motiff.com/blog/performance-magic-behind-motiff
[Pushing the limit with tilemap rendering]: https://www.teamflowhq.com/dev/pushing-the-limit-with-tilemap-rendering
[tile rendering in path tracer]: https://github.com/knightcrawler25/GLSL-PathTracer/blob/291c1fdc3f97b2a2602c946b41cecca9c3092af7/src/shaders/tile.glsl#L43
[Vector tiles introduction]: https://docs.mapbox.com/data/tilesets/guides/vector-tiles-introduction/
[vello]: https://github.com/linebender/vello
[peniko]: https://github.com/linebender/peniko
[kurbo]: https://github.com/linebender/kurbo
[课程 15 - 绘制文本]: /zh/guide/lesson-015
[课程 18 - 使用 ECS 重构]: /zh/guide/lesson-018
[课程 33 - 布局引擎]: zh/guide/lesson-033
[课程 10 - 图片导入导出]: /zh/guide/lesson-010#inlined-web-font
[stroke-alignment]: /zh/guide/lesson-010#stroke-alignment
[课程 13 - 绘制 Path & 手绘风格]: /zh/guide/lesson-013
[课程 17 - 渐变和重复图案]: /zh/guide/lesson-017
[课程 12 - 绘制折线]: zh/guide/lesson-012#extrude-segment
[课程 30 - 后处理与渲染图]: /zh/guide/lesson-030
[roughr]: https://github.com/orhanbalci/rough-rs/tree/main/roughr
[taffy]: https://github.com/DioxusLabs/taffy
[parley]: https://github.com/linebender/parley
[wasm-pack]: https://drager.github.io/wasm-pack/
[wasm-bindgen]: https://wasm-bindgen.github.io/wasm-bindgen/
[Round vertical hinting offset in Vello Classic]: https://github.com/linebender/vello/pull/963
[Faster, easier 2D vector rendering - Raph Levien]: https://youtu.be/_sv8K190Zps
[High-performance 2D graphics rendering on the CPU using sparse strips]: https://ethz.ch/content/dam/ethz/special-interest/infk/inst-pls/plf-dam/documents/StudentProjects/MasterTheses/2025-Laurenz-Thesis.pdf
[Vello Sparse Strips]: https://github.com/linebender/vello/tree/main/sparse_strips
[Vello Sparse Strips Roadmap 2025-2026]: https://docs.google.com/document/d/1ZquH-53j2OedTbgEKCJBKTh4WLE11UveM10mNdnVARY/edit?tab=t.0#heading=h.uxa8f6wsnhj3
[Stroke expansion]: https://github.com/linebender/kurbo/issues/285
[GPU-friendly Stroke Expansion]: https://dl.acm.org/doi/pdf/10.1145/3675390
[Euler Spiral / Clothoid - An Illustrated Explanation]: https://xixixao.github.io/euler-spiral-explanation/
[Graphite]: https://github.com/GraphiteEditor/Graphite
[isPointInStroke]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInStroke
[isPointInPath]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInPath
