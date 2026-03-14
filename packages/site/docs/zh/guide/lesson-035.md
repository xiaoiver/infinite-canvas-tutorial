---
outline: deep
description: '基于瓦片的渲染技术介绍，包含瓦片渲染原理、性能优化策略以及在无限画布中的应用实例。'
publish: false
---

<script setup>
import Vello from '../../components/Vello.vue'
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

## vello {#vello}

vello 的整体架构如下：

![source: https://www.datocms-assets.com/98516/1707130683-levien_2023.pdf](/vello-architecture.png)

屏幕会被切成固定大小的小块，这里和地图渲染器基于 LOD 的实现思路不同：

```plaintext
+----+----+----+----+
| T0 | T1 | T2 | T3 |
+----+----+----+----+
| T4 | T5 | T6 | T7 |
+----+----+----+----+
```

每个 tile 会维护一个 primitive list：

```plaintext
Tile 12
 ├─ path 5
 ├─ rect 8
 ├─ stroke 11
 └─ clip 3
```

![source: https://docs.google.com/presentation/d/1f_vKBJMaD68ifBO2j83lBly9Zdk-2bsvj_DIHXxvcuk/edit?slide=id.g3577762aae3_0_24#slide=id.g3577762aae3_0_24](/vello-sparse-stripes.png)

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

<Vello />

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

因此可以使用字体子集化方案。有趣的在 [课程 10 - 图片导入导出] 中我们介绍过 excalidraw 在将 Web 字体内联到 SVG 时也会做动态裁剪。

虽然不需要使用 SDF 渲染字体，但 vello 也支持非矢量字形：

-   COLR/CPAL 彩色字体：作为图像（Image）渲染，通过 Vello 的图像合成管线
-   位图字形（Emoji）：直接作为纹理 quad 渲染

### 图像处理 {#image-post-processing}

## 其他功能的 Rust 实现 {#}

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

### 布局引擎 {#layout-engine}

在 [课程 33 - 布局引擎] 中，我们使用编译成 WASM 的 Yoga。[taffy] 是 Rust 生态中的布局引擎，除了支持 Flexbox 还支持 Grid 布局。

## 扩展阅读 {#extended-reading}

-   [Faster, easier 2D vector rendering - Raph Levien]
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
[课程 15 - 绘制文本]: /zh/guide/lesson-015
[课程 18 - 使用 ECS 重构]: /zh/guide/lesson-018
[课程 33 - 布局引擎]: zh/guide/lesson-033
[课程 10 - 图片导入导出]: /zh/guide/lesson-010#inlined-web-font
[课程 13 - 绘制 Path & 手绘风格]: /zh/guide/lesson-013
[课程 17 - 渐变和重复图案]: /zh/guide/lesson-017
[roughr]: https://github.com/orhanbalci/rough-rs/tree/main/roughr
[taffy]: https://github.com/DioxusLabs/taffy
[parley]: https://github.com/linebender/parley
[wasm-pack]: https://drager.github.io/wasm-pack/
[wasm-bindgen]: https://wasm-bindgen.github.io/wasm-bindgen/
[Round vertical hinting offset in Vello Classic]: https://github.com/linebender/vello/pull/963
[Faster, easier 2D vector rendering - Raph Levien]: https://youtu.be/_sv8K190Zps
