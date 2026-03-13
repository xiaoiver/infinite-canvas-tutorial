---
outline: deep
description: '基于瓦片的渲染技术介绍，包含瓦片渲染原理、性能优化策略以及在无限画布中的应用实例。'
publish: false
---

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

![source: https://www.datocms-assets.com/98516/1707130683-levien_2023.pdf](/vello-architecture.png)

屏幕会被切成固定大小的小块：

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

## 基于 ECS 替换渲染层 {#replace-rendering-pipeline}

[vello] 是一个纯粹的 2D 渲染器，类似脏检查、空间索引等功能需要由上层应用实现，例如 Xilem 是一个构建在 vello 之上的 GUI 框架，它就实现了一套基于组件树的 diff 机制。

对于我们来说也是一样，只需要替换渲染层，保持其他功能不变。得益于 ECS 架构，这很容易实现，详见：[课程 18 - 使用 ECS 重构]。

### 编译成 WASM {#wasm-pack}

我们使用 wasm-pack 构建：

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
│   ├── lib.rs
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
        const { api, element } = canvas.read(Canvas);
        const canvasId = this.initVello.canvasIds.get(
            element as HTMLCanvasElement,
        );
        if (canvasId === undefined) {
            return;
        }

        // 清空屏幕
        clearShapes(canvasId);
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

wasm_bindgen 会负责序列化：

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

### 渐变 {#gradient}

在 vello 中实现

### 手绘风格 {#rough}

使用 [roughr]

### 文本 {#text}

在 [课程 15 - 绘制文本] 中，我们使用 SDF / MSDF 完成文本的渲染，在文本 shaping 和 layout 上花了不少精力。

## 其他 Rust 实现

除了渲染

### 拾取 {#picking}

除了渲染，拾取也可以放在 WASM 中完成。

### 布局引擎 {#layout-engine}

在 [课程 33 - 布局引擎] 中，我们使用编译成 WASM 的 Yoga。[taffy] 是 Rust 生态中的布局引擎。

## 扩展阅读 {#extended-reading}

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
[课程 15 - 绘制文本]: /zh/guide/lesson-015
[课程 18 - 使用 ECS 重构]: /zh/guide/lesson-018
[课程 33 - 布局引擎]: zh/guide/lesson-033
[roughr]: https://github.com/orhanbalci/rough-rs/tree/main/roughr
[taffy]: https://github.com/DioxusLabs/taffy
