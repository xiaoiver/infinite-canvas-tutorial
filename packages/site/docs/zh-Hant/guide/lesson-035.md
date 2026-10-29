---
outline: deep
description: '圖塊式渲染簡介：原理、效能最佳化策略，以及在無限畫布應用中的實例。'
head:
    - [
          'meta',
          { property: 'og:title', content: '第 35 課 - 圖塊式渲染' },
      ]
---

<script setup>
import Vello from '../../components/Vello.vue'
import VelloBlur from '../../components/VelloBlur.vue'
import VelloDropShadow from '../../components/VelloDropShadow.vue'
import VelloRough from '../../components/VelloRough.vue'
</script>

# 第 35 課 - 圖塊式渲染 {#lesson-35-tile-based-rendering}

Google Maps 與 Mapbox 都提供 Map tiles API。在不同縮放層級下，螢幕會被分成多個圖塊。

![來源: https://developers.google.com/maps/documentation/tile](https://developers.google.com/static/maps/documentation/tile/images/roadmap_tile2_720.png)

以 Mapbox 為例，每個向量圖塊儲存的是編碼後的 GeoJSON 資料。見：[Vector tiles introduction]。與點陣圖塊相比，向量圖塊在任何縮放層級都保持銳利。

先前提過的傳統網格渲染器，複雜度是 `O(pixels × shapes)`：

```plaintext
for pixel:
   check all shapes
```

若把螢幕空間劃成圖塊，每個圖塊只需要檢查落在其中的圖形。複雜度變成 `O(tiles × shapes_per_tile)`，其中 `shapes_per_tile << total_shapes`。因此在某些情況下，圖塊式渲染可以更快。

```plaintext
for tile:
   check shapes in tile
```

圖塊式渲染也有表現不佳的情況，例如一個巨大的圖形蓋住整個螢幕。

這一課會把渲染層換成 GPU 圖塊式渲染器 [vello]。它完全在計算著色器上執行，並充分運用 WebGPU。

<Vello />

## vello {#vello}

vello 目前有三套並行的實作。見 [Vello Sparse Strips]：

-   vello (GPU) — 純 GPU 計算著色器實作
-   vello CPU — 只在 CPU 上執行，使用多執行緒與 SIMD
-   vello hybrid — CPU／GPU 混合模式

三者共用同一套核心演算法（Sparse Strips），差別在執行後端。

![來源: https://www.datocms-assets.com/98516/1707130683-levien_2023.pdf](/vello-architecture.png)

vello CPU 的整體架構如下：

![來源: https://ethz.ch/content/dam/ethz/special-interest/infk/inst-pls/plf-dam/documents/StudentProjects/MasterTheses/2025-Laurenz-Thesis.pdf](/vello-overview.png)

### 編碼 {#encoding}

呼叫 vello 的繪製命令時，它們會被編碼成下面的形式，寫入緩衝區，供後續的計算著色器階段使用：

```rust
scene.fill(..., &rect)
scene.stroke(..., &path)
```

<https://github.com/linebender/vello/blob/main/vello_encoding/src/path.rs#L248>

![路徑編碼](/vello-path-encoding.png)

### 描邊擴展 {#stroke-expansion}

在 [第 12 課 - 繪製折線] 中，我們介紹過線段的描邊擴展，並用不同的網格分別渲染描邊與填色。vello 也會把有寬度的描邊展開，之後描邊與填色就能以同一套流程處理。

![描邊擴展](/vello-stroke-expansion.png)

![來源: https://dl.acm.org/doi/pdf/10.1145/3675390](/vello-path-style.png)

加粗後的貝茲中心線，其內側與外側偏移曲線（平行曲線）很難穩定地算出來。[GPU-friendly Stroke Expansion] 提出一種 GPU 平行演算法，用一種特殊的幾何近似——歐拉螺線——來避免迭代求解。歐拉螺線是曲率隨弧長線性變化的曲線。見：[Euler Spiral / Clothoid - An Illustrated Explanation]。

它的關鍵性質：

-   只要 1 到 2 段三次貝茲，就能有效近似
-   能自然表達平行曲線的幾何
-   具有閉式表達式，很適合在 GPU 上計算

擴展時必須處理 linecap 與 linejoin。先前我們在片段著色器裡使用解析描邊。vello 則在 CPU 上用 [kurbo] 完成，見 [Stroke expansion]。缺點是平行度有限；另外，因為擴展發生在幾何空間，高縮放時單一一條很大的描邊幾乎可以蓋住所有圖塊。至於 [stroke-alignment]，可以使用 kurbo 的偏移路徑。貝茲曲線會先轉成折線，再做擴展。

### 平坦化 {#flattening}

先前我們對曲線取樣，再用折線近似。vello 也會把三次貝茲曲線、二次貝茲曲線、橢圓弧等，用自適應細分演算法平坦化成線段：依曲率決定細分深度，並在 GPU 上平行執行，每段曲線各自處理。

![平坦化](/vello-flattening.png)

在計算著色器裡，平坦化會產生一組用來擬合的歐拉螺線子曲線，充分利用 GPU 的平行能力：

![描邊擴展](/vello-stroke-expansion-gpu.png)

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

完整的著色器程式在這裡：<https://github.com/linebender/vello/blob/main/vello_shaders/shader/flatten.wgsl>

![計算著色器](/vello-compute-shader.png)

### 圖塊產生 {#tile-generation}

平坦化後的路徑接著被分配到水平條帶。螢幕被切成固定大小的 4×4 圖塊，這和地圖渲染器使用的 LOD 做法不同。對每條線段，計算它穿越的所有 4×4 區域；每個相交區域都會建立一個 Tile，並連結到該線段。

![圖塊產生](/vello-tile-generation.png)

產生的圖塊必須以列主序排序：先依 Y，Y 相同再依 X。後續的 Strip Generation 階段需要這個順序，才能有效率地合併相鄰的水平圖塊。

### 稀疏條帶 {#sparse-strips}

列主序排序之後，相鄰的水平圖塊會合併成 Sparse Strips。覆蓋率只存在路徑實際經過的水平條帶裡，記憶體效率很高。資料結構如下：

```rust
struct Strip {
    x: u16,          // start X coordinate
    width: u16,      // width in pixels (multiple of 4)
    alpha_idx: u32,  // index into alpha values
    fill_gap: bool,  // whether to fill the gap to the next strip
}
```

每個 4×4 圖塊內的像素，覆蓋率用下列方式計算：

-   解析反鋸齒（Analytic AA）
-   每個像素的次像素覆蓋
-   只儲存覆蓋率不為零的邊緣像素；內部填色是隱含的

記憶體最佳化：相較於儲存完整的覆蓋遮罩（例如 8×8 或 16×16），4×4 圖塊配合 Sparse Strips 只儲存真正有邊緣的區域，大幅降低記憶體頻寬。

[High-performance 2D graphics rendering on the CPU using sparse strips]

![來源: https://docs.google.com/presentation/d/1f_vKBJMaD68ifBO2j83lBly9Zdk-2bsvj_DIHXxvcuk/edit?slide=id.g3577762aae3_0_24#slide=id.g3577762aae3_0_24](/vello-sparse-stripes.png)

### 粗略點陣化 {#coarse-rasterization}

粗略點陣化階段把畫布切成 256×4 像素的寬圖塊（Wide Tile）。每個 Wide Tile 持有一個命令向量，其中有兩種命令：

-   **Fill Command** — 填滿條帶之間沒有反鋸齒的區域（實心填色）
-   **AlphaFill Command** — 填滿條帶內有反鋸齒的區域（套用 alpha 遮罩）

![粗略點陣化](/vello-coarse-rasterization.png)

### 精細點陣化 {#fine-rasterization}

最後的像素著色器：每個工作群組處理一個 Wide Tile（256×4 像素）。

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
            case CMD_FILL: { // process all FillCommands (solid fill)
                let fill = read_fill(cmd_ix);
                cmd_ix += 4u;
            }
            case CMD_SOLID: {
            }
        }
    }

// write to final framebuffer (convert to RGBA8)
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

## 用 ECS 替換渲染管線 {#replace-rendering-pipeline}

[vello] 是純 2D 渲染器。依視埠剔除、髒檢查、空間索引這類功能必須由應用程式自己實作。例如 Xilem 是建立在 vello 上的 GUI 框架，並實作了元件樹的差異比對。

我們也一樣：只替換渲染層，其餘都保留。多虧 ECS 架構，這件事很直接：把 RenderPlugin 裡的兩個預設 System 換成以 vello 為基礎的實作。見：[第 18 課 - 以 ECS 重構]。

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

我們用 [wasm-pack] 建置。執行 `wasm-pack build --target web`，輸出會在 `/pkg`：

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

然後就可以從 JS 使用：載入 WASM 之後初始化，並載入字型檔。

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

渲染時呼叫對應的圖形 API，並以物件傳入屬性清單：

```ts
import { addEllipse } from '@infinite-canvas-tutorial/vello-renderer';

export class VelloPipeline extends System {
    private renderCamera(canvas: Entity, camera: Entity, sort = false) {
        clearShapes(canvasId); // clear screen
        getDescendants(camera) // traverse scene graph
            .filter((e) => !e.has(Culled)) // skip culled entities
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

                    // call wrapped vello render API
                    addEllipse(canvasId, opts);
                }
            });
    }
}
```

[wasm-bindgen] 負責 JS 與 WASM 的互動，例如：

-   從 Rust 呼叫 JS，例如讀取 `window.devicePixelRatio`：

```rust
#[cfg(target_arch = "wasm32")]
fn device_pixel_ratio() -> f64 {
    web_sys::window()
        .map(|w| w.device_pixel_ratio())
        .unwrap_or(1.0)
}
```

-   把 Rust 函式暴露給 JS，例如 `init` 與 `addEllipse`：

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

// draw ellipse with vello
use vello::kurbo::{Ellipse};
scene.fill(Fill::NonZero, shape_transform, &brush, None, &ellipse);
```

-   產生 TypeScript 型別定義

接下來看看如何在 Rust／vello 這套堆疊裡實作渲染功能，尤其是在 JS 端比較費工的部分。

### 漸層 {#gradient}

在 [第 17 課 - 漸層與圖案] 中，我們說明如何用 `<canvas>` 建立 CSS 風格的漸層。

```rust
if let Some(ref grads) = fill_gradients {
    for g in grads.iter().rev() {
        let brush = vello::peniko::Brush::Gradient(build_gradient_brush(g, fill_mult));
        scene.fill(Fill::NonZero, shape_transform, &brush, None, &geom);
    }
}
```

在 vello 裡，漸層會轉成 [peniko] 的 `Gradient` 再渲染。API 接近 Canvas 的漸層 API：

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

### 手繪／rough 風格 {#rough}

在 [第 13 課 - 繪製路徑與手繪風格] 中，我們用 `rough-js` 產生一組路徑來做出手繪感，再加以渲染。可以把那組路徑定義傳給 vello。使用 Rust crate [roughr]，就不必把路徑資料從 JS 傳到 WASM。

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

<VelloRough />

### 文字 {#text}

在 [第 15 課 - 文字渲染] 中，我們用 SDF／MSDF 渲染文字，並在塑形與排版上花了不少工夫。這些可以用 [parley] 完成。流程是：

```plaintext
Layout (Parley) ← Shaping with HarfRust/Swash
    ↓
Outline (Skrifa) ← Convert glyph to BezPath
    ↓
Vello/Scene
    ↓
Peniko (Brush/Color/Gradient/Image)
```

-   FontContext：註冊字型，使用從 JS 傳入的字型資料
-   LayoutContext：建立文字排版，並支援：
    -   字型家族、大小、字距
    -   換行、對齊
    -   字距調整、連字、Bidi，以及其他排版功能
-   以 vello 期望的格式輸出字型資料；[peniko] 提供基本元件（顏色、筆刷、字型資料）
-   用 vello 把字形當成路徑渲染，完全不使用 SDF

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

| 特性               | SDF 做法                      | Vello 即時向量                                                     |
| ------------------ | ----------------------------- | ------------------------------------------------------------------ |
| **預先計算**       | 需要預先產生的 SDF            | 由輪廓即時計算                                                     |
| **記憶體**         | SDF 紋理圖集                  | 沒有圖集；每幀重新編碼輪廓                                         |
| **縮放**           | 放大時角落會變軟              | 任何縮放都保持銳利                                                 |
| **可變字體**       | 困難（每幀重新烘焙 SDF）      | 原生支援；字重／字寬可以動畫                                       |
| **小尺寸**         | hinting 困難                  | 支援 hinting [Round vertical hinting offset in Vello Classic]     |
| **效能**           | GPU 取樣快，準備慢            | GPU 計算量大，無需準備                                             |

要支援 CJK，必須載入 CJK 字型。CJK 字型檔很大（常常超過 10MB），因此會導致：

1. 字型註冊變慢——每一幀都要處理一個很大的檔案
2. 字形快取暴增——數千個 CJK 字形會佔用大量記憶體

![在 vello 中渲染 CJK 字形時的卡頓](/vello-text-jank.png)

因此必須充分利用快取，避免每一幀都對整段文字執行 parley 排版，並複製大量 CJK 字型資料。字型子集化是另一個選項。在 [第 10 課 - 匯入與匯出圖片] 中我們提過，Excalidraw 在把網頁字型內嵌進 SVG 時，也會動態做子集化。

這裡雖然不用 SDF 渲染字型，vello 也支援非向量字形：

-   COLR／CPAL 彩色字型：透過 vello 的影像合成管線，以影像方式渲染
-   點陣字形（例如表情符號）：以紋理四邊形渲染

可以先用 parley 計算包含表情符號的文字排版，再用 Canvas API 畫出表情符號以取得像素資料，最後交給 vello 渲染：

```rust
fn get_or_create_emoji_image(emoji: &str, size: u32) -> Option<(Vec<u8>, u32, u32)> {
    let document = web_sys::window()?.document()?;
    let canvas = document
        .create_element("canvas")
        .ok()?
        .dyn_into::<web_sys::HtmlCanvasElement>()
        .ok()?;

    let ctx = canvas
        .get_context("2d")
        .ok()??
        .dyn_into::<web_sys::CanvasRenderingContext2d>()
        .ok()?;

    ctx.fill_text(emoji, (size / 2) as f64, (size / 2) as f64).ok()?;

    // Read back pixel data
    let image_data = ctx
        .get_image_data(0.0, 0.0, size as f64, size as f64)
        .ok()?;
    let data = image_data.data();
    let rgba: Vec<u8> = data.to_vec();
    Some((rgba, size, size))
}
```

### 影像後處理 {#image-post-processing}

我們可以實作一些後處理效果，類似 [第 30 課 - 後處理與渲染通道]。

#### 模糊 {#blur}

vello 提供輔助函式 [draw_blurred_rounded_rect](https://github.com/linebender/vello/blob/main/vello/src/scene.rs#L253)，它只適用於圓角矩形，不能用在任意圖形。

```rust
scene.draw_blurred_rounded_rect(
    shape_transform,
    base_rect,
    Color::new(fill_color),
    r,
    blur_std_dev,
);
```

<VelloBlur />

#### 投影 {#dropshadow}

投影可以用 vello 的圖層功能來做：

-   把圖形畫到螢幕外的圖層
-   套用模糊
-   把結果偏移後畫回主場景

<VelloDropShadow />

## Rust 中實作的其他功能 {#other-features-implemented-in-rust}

### 計算包圍盒 {#compute-bounds}

可以用 [parley] 處理 BiDi、cluster 以及其他文字度量。對於帶有描邊、`linecap` 與 `linejoin` 的折線和路徑，先前我們使用近似的包圍盒；現在可以用 [kurbo] 的 `BezPath::bounding_box()` 得到更精確的結果：

```rust
/// Precise bounds: use BezPath::bounding_box() for fill; for stroke use Kurbo's stroke
/// expansion to a path then take bbox; union both. See Graphite's approach: turning
/// stroke geometry into fill outline then taking bounding_box is the closest to "exact".
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

然後在 vello 初始化時把它接上：

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

除了渲染，拾取也可以在 WASM 中完成。例如 [Graphite]：

```rust
// node-graph/gcore/src/vector/click_target.rs
struct ClickTarget {
    bounds: [DVec2; 2],           // bounding box [min, max]
    path: Option<BezPath>,       // exact path (optional)
    stroke_width: f64,
}

impl ClickTarget {
    // screen-space pick test
    fn intersects(&self, point: DVec2, layer_transform: DAffine2) -> bool {
        // 1. transform to local space
        let local_point = layer_transform.inverse() * point;

        // 2. AABB quick reject
        let target_bounds = [
            self.bounds[0] - DVec2::splat(self.stroke_width / 2.0),
            self.bounds[1] + DVec2::splat(self.stroke_width / 2.0),
        ];

        if !aabb_intersect(target_bounds, [local_point, local_point]) {
            return false;
        }

        // 3. exact path test (winding)
        if let Some(path) = &self.path {
            path.winding(local_point) != 0
        } else {
            true
        }
    }
}
```

先前我們用 Canvas API 的 [isPointInStroke] 與 [isPointInPath]，判斷一個點是否在路徑內：

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

也可以使用 [kurbo]：在容差內把路徑平坦化成子路徑，再做相交測試：

```rust
fn is_point_in_path_fill(d: &str, x: f64, y: f64, fill_rule: &str) -> bool {
    let Ok(bez) = BezPath::from_svg(d) else { return false; };
    let subs = flatten_bez_path(&bez, 0.25);
    let p = Point::new(x, y);

    // nonzero: for each closed contour accumulate winding (here we approximate with
    // per-contour test; for complex self-intersecting paths this is still approximate,
    // but closer to Canvas2D than a simple bbox). A more precise approach would
    // accumulate winding over all edges; the current implementation is enough for
    // selection/picking.
    for sp in subs.iter() {
        if sp.closed && sp.points.len() >= 3 && point_in_polygon_nonzero(p, &sp.points) {
            return true;
        }
    }
    false
}
```

### 版面引擎 {#layout-engine}

在 [第 33 課 - 版面引擎] 中，我們使用編譯成 WASM 的 Yoga。[taffy] 是支援 Flexbox 與 Grid 的 Rust 版面引擎。

## 延伸閱讀 {#extended-reading}

-   [High-performance 2D graphics rendering on the CPU using sparse strips]
-   [GPU-friendly Stroke Expansion]
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
[Stroke expansion]: https://github.com/linebender/kurbo/issues/285
[stroke-alignment]: /zh-Hant/guide/lesson-010#stroke-alignment
[Vello Sparse Strips]: https://github.com/linebender/vello/tree/main/sparse_strips
[第 12 課 - 繪製折線]: /zh-Hant/guide/lesson-012#extrude-segment
[High-performance 2D graphics rendering on the CPU using sparse strips]: https://ethz.ch/content/dam/ethz/special-interest/infk/inst-pls/plf-dam/documents/StudentProjects/MasterTheses/2025-Laurenz-Thesis.pdf
[Vello Sparse Strips Roadmap 2025-2026]: https://docs.google.com/document/d/1ZquH-53j2OedTbgEKCJBKTh4WLE11UveM10mNdnVARY/edit?tab=t.0#heading=h.uxa8f6wsnhj3
[第 15 課 - 文字渲染]: /zh-Hant/guide/lesson-015
[第 18 課 - 以 ECS 重構]: /zh-Hant/guide/lesson-018
[第 33 課 - 版面引擎]: /zh-Hant/guide/lesson-033
[第 10 課 - 匯入與匯出圖片]: /zh-Hant/guide/lesson-010#inlined-web-font
[第 13 課 - 繪製路徑與手繪風格]: /zh-Hant/guide/lesson-013
[第 17 課 - 漸層與圖案]: /zh-Hant/guide/lesson-017
[第 30 課 - 後處理與渲染通道]: /zh-Hant/guide/lesson-030
[roughr]: https://github.com/orhanbalci/rough-rs/tree/main/roughr
[taffy]: https://github.com/DioxusLabs/taffy
[parley]: https://github.com/linebender/parley
[wasm-pack]: https://drager.github.io/wasm-pack/
[wasm-bindgen]: https://wasm-bindgen.github.io/wasm-bindgen/
[Round vertical hinting offset in Vello Classic]: https://github.com/linebender/vello/pull/963
[Faster, easier 2D vector rendering - Raph Levien]: https://youtu.be/_sv8K190Zps
[GPU-friendly Stroke Expansion]: https://dl.acm.org/doi/pdf/10.1145/3675390
[Graphite]: https://github.com/GraphiteEditor/Graphite
[isPointInStroke]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInStroke
[isPointInPath]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInPath
