---

outline: deep
description: 'タイルベースレンダリングの紹介です。原理、性能最適化の方針、無限キャンバスアプリケーションでの例を扱います。'
head: - ['meta', { property: 'og:title', content: '第 35 課 - タイルベースレンダリング' }]
---<script setup>
import Vello from '../../components/Vello.vue'
import VelloBlur from '../../components/VelloBlur.vue'
import VelloDropShadow from '../../components/VelloDropShadow.vue'
import VelloRough from '../../components/VelloRough.vue'
</script>

# 第 35 課 - タイルベースレンダリング {#lesson-35-tile-based-rendering}

Google Maps と Mapbox は、どちらもマップタイル API を提供しています。ズーム段階が変わると、画面は複数のタイルに分かれます。

![出典: https://developers.google.com/maps/documentation/tile](https://developers.google.com/static/maps/documentation/tile/images/roadmap_tile2_720.png)

Mapbox を例にすると、各ベクタータイルにはエンコードされた GeoJSON データが格納されます。[Vector tiles introduction] を参照してください。ラスタータイルと違い、ベクタータイルはどのズーム段階でもシャープなままです。

以前紹介した従来のメッシュベースレンダラーの計算量は `O(pixels × shapes)` です。

```plaintext
for pixel:
   check all shapes
```

画面空間をタイルに分けると、各タイルの中の図形だけを調べれば済みます。計算量は `O(tiles × shapes_per_tile)` になり、`shapes_per_tile << total_shapes` です。これが、タイルベースレンダリングがある状況でより速くなり得る理由です。

```plaintext
for tile:
   check shapes in tile
```

タイルベースレンダリングにも不利な場合があります。たとえば巨大な図形が画面全体を覆うときです。

この課では、レンダリングレイヤーを GPU のタイルベースレンダラー [vello] に置き換えます。これはすべてコンピュートシェーダーで動作し、WebGPU を十分に活用します。

<Vello />

## vello {#vello}

vello には現在、3 つの並行した実装があります。[Vello Sparse Strips] を参照してください。

-   vello (GPU) — 純粋な GPU コンピュートシェーダー実装
-   vello CPU — マルチスレッドと SIMD を使う CPU のみの実装
-   vello hybrid — CPU/GPU のハイブリッドモード

3 つは同じ中核アルゴリズム（Sparse Strips）を共有し、実行バックエンドが異なります。

![出典: https://www.datocms-assets.com/98516/1707130683-levien_2023.pdf](/vello-architecture.png)

vello CPU の全体像は次のとおりです。

![出典: https://ethz.ch/content/dam/ethz/special-interest/infk/inst-pls/plf-dam/documents/StudentProjects/MasterTheses/2025-Laurenz-Thesis.pdf](/vello-overview.png)

### エンコーディング {#encoding}

vello の描画コマンドを呼ぶと、次の形にエンコードされてバッファへ書き込まれ、その後のコンピュートシェーダー段階で使われます。

```rust
scene.fill(..., &rect)
scene.stroke(..., &path)
```

<https://github.com/linebender/vello/blob/main/vello_encoding/src/path.rs#L248>

![パスエンコーディング](/vello-path-encoding.png)

### ストロークの拡張 {#stroke-expansion}

[第 12 課 - ポリラインを描く] では、線分のストローク拡張を紹介し、ストロークと塗りを別々のメッシュで描画しました。vello も幅のあるストロークを拡張し、その後はストロークと塗りを同じように処理できます。

![ストロークの拡張](/vello-stroke-expansion.png)

![出典: https://dl.acm.org/doi/pdf/10.1145/3675390](/vello-path-style.png)

太くしたベジェの中心線では、内側と外側のオフセット曲線（平行曲線）を頑健に計算するのが難しいです。[GPU-friendly Stroke Expansion] は、反復求解を避けるため、特別な幾何近似としてオイラー螺旋を使う GPU 並列アルゴリズムを提案しています。オイラー螺旋は、曲率が弧長に対して線形に変化する曲線です。[Euler Spiral / Clothoid - An Illustrated Explanation] を参照してください。

重要な性質は次のとおりです。

-   3 次ベジェ区間わずか 1 ～ 2 本で効率よく近似できます。
-   平行曲線の幾何を自然に表現できます。
-   閉形式の式を持ち、GPU 計算に向いています。

拡張のときに linecap と linejoin を扱う必要があります。以前はフラグメントシェーダーで解析的ストロークの方法を使っていました。vello はこれを CPU 上で [kurbo] により行います。[Stroke expansion] を参照してください。欠点は並列性が限られることです。また、拡張が幾何空間で起きるため、ズームが大きいと 1 本の大きなストロークがほぼすべてのタイルを覆うことがあります。[stroke-alignment] には kurbo のオフセットパスを使えます。ベジェ曲線は拡張の前に、まずポリラインへ変換します。

### 平坦化 {#flattening}

以前は曲線をサンプリングし、ポリラインで近似していました。vello も 3 次ベジェ曲線、2 次ベジェ曲線、楕円弧などを線分へ平坦化します。曲率から分割の深さを決める適応的細分割アルゴリズムを使い、各曲線区間を独立に処理して GPU 上で並列に実行します。

![平坦化](/vello-flattening.png)

コンピュートシェーダーでは、平坦化がフィッティング用のオイラー螺旋の部分曲線の集まりを作り、GPU の並列性を十分に使います。

![ストロークの拡張](/vello-stroke-expansion-gpu.png)

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

シェーダーの完全なコードはここで見られます。<https://github.com/linebender/vello/blob/main/vello_shaders/shader/flatten.wgsl>

![コンピュートシェーダー](/vello-compute-shader.png)

### タイル生成 {#tile-generation}

平坦化したパスは、続いて水平ストリップへ割り当てられます。画面は固定サイズの 4×4 タイルに分割されます。地図レンダラーが使う LOD ベースの方式とは異なります。各線分について、その線分が横切るすべての 4×4 領域を計算し、交差する領域ごとに Tile を作ってその線分へ結びます。

![タイル生成](/vello-tile-generation.png)

生成されたタイルは行優先順にソートする必要があります。まず Y でソートし、同じ Y では X でソートします。続く Strip Generation 段階が隣り合う水平タイルを効率よくまとめられるよう、この順序が必要です。

### スパースストリップ {#sparse-strips}

行優先でソートしたあと、水平に隣り合うタイルは Sparse Strips にまとめられます。カバレッジはパスが実際に通る水平ストリップにだけ格納されるため、メモリ効率が非常に高くなります。データ構造は次のとおりです。

```rust
struct Strip {
    x: u16,          // start X coordinate
    width: u16,      // width in pixels (multiple of 4)
    alpha_idx: u32,  // index into alpha values
    fill_gap: bool,  // whether to fill the gap to the next strip
}
```

各 4×4 タイル内のピクセルについて、カバレッジは次で計算します。

-   解析的アンチエイリアス（Analytic AA）
-   ピクセルごとのサブピクセルカバレッジ
-   カバレッジが 0 でない縁のピクセルだけを格納し、内部の塗りは暗黙的に表します。

メモリの最適化: 完全なカバレッジマスク（たとえば 8×8 や 16×16）を格納する場合と比べ、4×4 タイルと Sparse Strips は実際にエッジがある領域だけを格納するので、メモリ帯域を大きく減らします。

[High-performance 2D graphics rendering on the CPU using sparse strips]

![出典: https://docs.google.com/presentation/d/1f_vKBJMaD68ifBO2j83lBly9Zdk-2bsvj_DIHXxvcuk/edit?slide=id.g3577762aae3_0_24#slide=id.g3577762aae3_0_24](/vello-sparse-stripes.png)

### 粗いラスタライズ {#coarse-rasterization}

粗いラスタライズ段階は、キャンバスを 256×4 ピクセルの Wide Tile に分けます。各 Wide Tile は、2 種類のコマンドを持つコマンドベクトルを持ちます。

-   **Fill Command** — ストリップ間のアンチエイリアスのない領域を塗ります（単色の塗り）。
-   **AlphaFill Command** — ストリップ内のアンチエイリアス領域を塗ります（アルファマスクを適用）。

![粗いラスタライズ](/vello-coarse-rasterization.png)

### 細かいラスタライズ {#fine-rasterization}

最終的なピクセルシェーダーです。各ワークグループは Wide Tile 1 つ（256×4 ピクセル）を処理します。

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

## ECS でレンダリングパイプラインを置き換える {#replace-rendering-pipeline}

[vello] は純粋な 2D レンダラーです。ビューポートベースのカリング、ダーティチェック、空間インデックスのような機能はアプリケーション側で実装する必要があります。たとえば Xilem は vello の上に作られた GUI フレームワークで、コンポーネント木の diff システムを実装しています。

私たちも同じです。レンダリングレイヤーだけを置き換え、ほかはそのままにします。ECS アーキテクチャのおかげで素直にできます。RenderPlugin の既定のシステム 2 つを、vello ベースの実装に差し替えます。[第 18 課 - ECS でリファクタリング] を参照してください。

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

### wasm-pack を使う {#use-wasm-pack}

[wasm-pack] でビルドします。`wasm-pack build --target web` を実行すると、`/pkg` 以下に成果物が得られます。

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

その後、JS から使えます。WASM を読み込んで初期化し、フォントファイルを読み込みます。

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

描画時には、対応する図形 API を呼び、属性の一覧をオブジェクトとして渡します。

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

[wasm-bindgen] が JS と WASM のやり取りを扱います。たとえば次のとおりです。

-   Rust から JS を呼びます。たとえば `window.devicePixelRatio` を読みます。

```rust
#[cfg(target_arch = "wasm32")]
fn device_pixel_ratio() -> f64 {
    web_sys::window()
        .map(|w| w.device_pixel_ratio())
        .unwrap_or(1.0)
}
```

-   `init` や `addEllipse` のように、Rust の関数を JS へ公開します。

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

-   TypeScript の型定義を生成します。

次に、Rust/vello スタックでレンダリング機能を実装する方法、特に JS 側で手間がかかる部分を見ます。

### グラデーション {#gradient}

[第 17 課 - グラデーションとパターン] では、`<canvas>` で CSS スタイルのグラデーションを作る方法を示しました。

```rust
if let Some(ref grads) = fill_gradients {
    for g in grads.iter().rev() {
        let brush = vello::peniko::Brush::Gradient(build_gradient_brush(g, fill_mult));
        scene.fill(Fill::NonZero, shape_transform, &brush, None, &geom);
    }
}
```

vello では、グラデーションを [peniko] の `Gradient` に変換してから描画します。API は Canvas のグラデーション API に近いです。

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

### スケッチ / rough スタイル {#rough}

[第 13 課 - パスとスケッチスタイル] では、`rough-js` でスケッチ風のパスの集まりを生成して描画しました。そのパス定義の集まりを vello に渡すこともできます。Rust のクレート [roughr] を使うと、JS から WASM へパスデータを渡さずに済みます。

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

### テキスト {#text}

[第 15 課 - テキストレンダリング] では、テキスト描画に SDF / MSDF を使い、シェイピングとレイアウトに手間をかけました。その作業は [parley] で行えます。流れは次のとおりです。

```plaintext
Layout (Parley) ← Shaping with HarfRust/Swash
    ↓
Outline (Skrifa) ← Convert glyph to BezPath
    ↓
Vello/Scene
    ↓
Peniko (Brush/Color/Gradient/Image)
```

-   FontContext: JS から渡されたフォントデータでフォントを登録します。
-   LayoutContext: テキストレイアウトを構築し、次に対応します。
    -   フォントファミリー、サイズ、字間
    -   折り返し、整列
    -   カーニング、リガチャ、Bidi などのタイポグラフィ機能
-   vello が期待する形式でフォントデータを出力します。[peniko] が基本プリミティブ（色、ブラシ、フォントデータ）を提供します。
-   vello でグリフをパスとして描画します。SDF はまったく使いません。

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

| 機能                   | SDF 方式                                        | Vello リアルタイムベクター                                                |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| **事前計算**           | 事前生成した SDF が必要です                     | アウトラインからリアルタイムに計算します                                  |
| **メモリ**             | SDF テクスチャ用のアトラス                      | アトラスはなく、毎フレームアウトラインを再エンコードします                |
| **拡大**               | 大きく拡大すると角が丸くなります                | どの倍率でもシャープです                                                  |
| **バリアブルフォント** | 難しいです（フレームごとに SDF を焼き直します） | ネイティブに対応し、ウェイトと幅をアニメーションできます                  |
| **小さいサイズ**       | ヒンティングが難しいです                        | ヒンティングに対応します [Round vertical hinting offset in Vello Classic] |
| **性能**               | GPU サンプリングは速いが準備が遅いです          | GPU 計算は重いが事前準備はゼロです                                        |

CJK に対応するには CJK フォントを読み込む必要があります。CJK のフォントファイルは大きく（しばしば 10MB 以上）、次につながります。

1. フォント登録が遅いです。大きなファイルを毎フレーム処理します。
2. グリフキャッシュが膨張します。数千の CJK グリフが多くのメモリを使います。

![vello で CJK グリフを描画したときのカクつき](/vello-text-jank.png)

そのためキャッシュを十分に使い、毎フレーム、テキスト全体に対して parley のレイアウトを走らせたり、大きな CJK フォントデータをコピーしたりするのを避ける必要があります。
フォントのサブセット化も選択肢です。[第 10 課 - 画像の読み込みと書き出し] では、Excalidraw もウェブフォントを SVG にインラインするときに動的なサブセット化を行うと述べました。

ここではフォントに SDF を使いませんが、vello はベクトル以外のグリフにも対応しています。

-   COLR/CPAL カラーフォント: vello の画像合成パイプラインを通じて画像として描画されます。
-   ビットマップグリフ（例: 絵文字）: テクスチャクワッドとして描画されます。

まず parley で絵文字を含むテキストのレイアウトを計算し、次に Canvas API で絵文字を描いてピクセルデータを得て、最後に vello で描画できます。

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

### 画像のポストプロセス {#image-post-processing}

[第 30 課 - ポストプロセスとレンダーパス] と同じように、いくつかのポストプロセス効果を実装できます。

#### ブラー {#blur}

vello はヘルパー [draw_blurred_rounded_rect](https://github.com/linebender/vello/blob/main/vello/src/scene.rs#L253) を提供します。これは角丸矩形にだけ向き、任意の図形には適用されません。

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

#### ドロップシャドウ {#dropshadow}

ドロップシャドウは vello のレイヤー機能で作れます。

-   図形をオフスクリーンレイヤーに描きます。
-   ブラーを適用します。
-   結果をずらしてメインシーンへ描き戻します。

<VelloDropShadow />

## Rust で実装したその他の機能 {#other-features-implemented-in-rust}

### バウンディングボックスの計算 {#compute-bounds}

[parley] で BiDi、クラスタなどのテキストメトリクス機能を扱えます。ストローク、`linecap`、`linejoin` のある Polyline と Path は、以前は近似のバウンディングボックスを使っていました。今は [kurbo] の `BezPath::bounding_box()` で、より正確な結果が得られます。

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

その後、vello の初期化時にこれを組み込みます。

```ts
import {
    Path,
    createGeometryBoundsProviderFromComputePathBounds,
} from '@infinite-canvas-tutorial/ecs';
import { computePathBounds } from '@infinite-canvas-tutorial/vello-renderer';

Path.geometryBoundsProvider =
    createGeometryBoundsProviderFromComputePathBounds(computePathBounds);
```

### ピッキング {#picking}

描画以外に、ピッキングも WASM で行えます。たとえば [Graphite] では次のとおりです。

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

以前は Canvas API の [isPointInStroke] と [isPointInPath] で、点がパスの内側にあるかを調べていました。

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

[kurbo] も使えます。許容誤差の範囲でパスをサブパスへ平坦化し、交差判定を行います。

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

### レイアウトエンジン {#layout-engine}

[第 33 課 - レイアウトエンジン] では WASM にコンパイルした Yoga を使いました。[taffy] は Flexbox と Grid に対応した Rust のレイアウトエンジンです。

## さらに読む {#extended-reading}

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
[stroke-alignment]: /ja/guide/lesson-010#stroke-alignment
[Vello Sparse Strips]: https://github.com/linebender/vello/tree/main/sparse_strips
[第 12 課 - ポリラインを描く]: /ja/guide/lesson-012#extrude-segment
[High-performance 2D graphics rendering on the CPU using sparse strips]: https://ethz.ch/content/dam/ethz/special-interest/infk/inst-pls/plf-dam/documents/StudentProjects/MasterTheses/2025-Laurenz-Thesis.pdf
[Vello Sparse Strips Roadmap 2025-2026]: https://docs.google.com/document/d/1ZquH-53j2OedTbgEKCJBKTh4WLE11UveM10mNdnVARY/edit?tab=t.0#heading=h.uxa8f6wsnhj3
[第 15 課 - テキストレンダリング]: /ja/guide/lesson-015
[第 18 課 - ECS でリファクタリング]: /ja/guide/lesson-018
[第 33 課 - レイアウトエンジン]: /ja/guide/lesson-033
[第 10 課 - 画像の読み込みと書き出し]: /ja/guide/lesson-010#inlined-web-font
[第 13 課 - パスとスケッチスタイル]: /ja/guide/lesson-013
[第 17 課 - グラデーションとパターン]: /ja/guide/lesson-017
[第 30 課 - ポストプロセスとレンダーパス]: /ja/guide/lesson-030
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
