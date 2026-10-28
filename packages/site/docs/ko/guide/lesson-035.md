---

outline: deep
description: '타일 기반 렌더링을 소개합니다. 원리, 성능 최적화 전략, 무한 캔버스 애플리케이션에서의 사례를 다룹니다.'
head: - ['meta', { property: 'og:title', content: '35강 - 타일 기반 렌더링' }]
---<script setup>
import Vello from '../../components/Vello.vue'
import VelloBlur from '../../components/VelloBlur.vue'
import VelloDropShadow from '../../components/VelloDropShadow.vue'
import VelloRough from '../../components/VelloRough.vue'
</script>

# 35강 - 타일 기반 렌더링 {#lesson-35-tile-based-rendering}

Google Maps와 Mapbox는 모두 맵 타일 API를 제공합니다. 확대 단계가 달라지면 화면은 여러 타일로 나뉩니다.

![출처: https://developers.google.com/maps/documentation/tile](https://developers.google.com/static/maps/documentation/tile/images/roadmap_tile2_720.png)

Mapbox를 예로 들면, 각 벡터 타일에는 인코딩된 GeoJSON 데이터가 들어 있습니다. [Vector tiles introduction]을 참고하세요. 래스터 타일과 달리 벡터 타일은 어떤 확대 단계에서도 선명합니다.

앞에서 소개한 전통적인 메시 기반 렌더러의 복잡도는 `O(pixels × shapes)`입니다.

```plaintext
for pixel:
   check all shapes
```

화면 공간을 타일로 나누면 각 타일 안의 도형만 검사하면 됩니다. 복잡도는 `O(tiles × shapes_per_tile)`이 되고, `shapes_per_tile << total_shapes`입니다. 그래서 타일 기반 렌더링이 어떤 상황에서는 더 빠를 수 있습니다.

```plaintext
for tile:
   check shapes in tile
```

타일 기반 렌더링에도 불리한 경우가 있습니다. 예를 들어 거대한 도형이 화면 전체를 덮을 때입니다.

이번 강의에서는 렌더링 레이어를 GPU 타일 기반 렌더러 [vello]로 바꿉니다. 이것은 전부 컴퓨트 셰이더에서 동작하며 WebGPU를 충분히 활용합니다.

<Vello />

## vello {#vello}

vello에는 현재 세 가지 병렬 구현이 있습니다. [Vello Sparse Strips]를 참고하세요.

-   vello (GPU) — 순수 GPU 컴퓨트 셰이더 구현
-   vello CPU — 멀티스레딩과 SIMD를 쓰는 CPU 전용 구현
-   vello hybrid — CPU/GPU 혼합 모드

세 구현은 같은 핵심 알고리즘(Sparse Strips)을 공유하고, 실행 백엔드만 다릅니다.

![출처: https://www.datocms-assets.com/98516/1707130683-levien_2023.pdf](/vello-architecture.png)

vello CPU의 전체 구조는 다음과 같습니다.

![출처: https://ethz.ch/content/dam/ethz/special-interest/infk/inst-pls/plf-dam/documents/StudentProjects/MasterTheses/2025-Laurenz-Thesis.pdf](/vello-overview.png)

### 인코딩 {#encoding}

vello 그리기 명령을 호출하면 다음 형태로 인코딩되어 버퍼에 기록되고, 이후 컴퓨트 셰이더 단계에서 사용됩니다.

```rust
scene.fill(..., &rect)
scene.stroke(..., &path)
```

<https://github.com/linebender/vello/blob/main/vello_encoding/src/path.rs#L248>

![경로 인코딩](/vello-path-encoding.png)

### 스트로크 확장 {#stroke-expansion}

[12강 - 폴리라인 그리기]에서 선분의 스트로크 확장을 소개했고, 스트로크와 채우기를 서로 다른 메시로 렌더링했습니다. vello도 너비가 있는 스트로크를 확장하며, 그 뒤에는 스트로크와 채우기를 같은 방식으로 처리할 수 있습니다.

![스트로크 확장](/vello-stroke-expansion.png)

![출처: https://dl.acm.org/doi/pdf/10.1145/3675390](/vello-path-style.png)

굵어진 베지어 중심선에서는 안쪽과 바깥쪽 오프셋 곡선(평행 곡선)을 안정적으로 계산하기 어렵습니다. [GPU-friendly Stroke Expansion]은 반복 풀이를 피하려고 특별한 기하 근사인 오일러 나선을 쓰는 GPU 병렬 알고리즘을 제안합니다. 오일러 나선은 곡률이 호 길이에 따라 선형으로 변하는 곡선입니다. [Euler Spiral / Clothoid - An Illustrated Explanation]을 참고하세요.

핵심 성질은 다음과 같습니다.

-   3차 베지어 구간 1–2개만으로 효율적으로 근사할 수 있습니다.
-   평행 곡선의 기하를 자연스럽게 표현합니다.
-   닫힌 형식의 식이 있어 GPU 계산에 잘 맞습니다.

확장할 때 linecap과 linejoin을 처리해야 합니다. 이전에는 프래그먼트 셰이더에서 해석적 스트로크 방식을 사용했습니다. vello는 이것을 CPU에서 [kurbo]로 처리합니다. [Stroke expansion]을 참고하세요. 단점은 병렬성이 제한된다는 점입니다. 또한 확장이 기하 공간에서 일어나므로, 줌이 클 때 커다란 스트로크 하나가 거의 모든 타일을 덮을 수 있습니다. [stroke-alignment]에는 kurbo의 오프셋 패스를 쓸 수 있습니다. 베지어 곡선은 확장 전에 먼저 폴리라인으로 바꿉니다.

### 평탄화 {#flattening}

이전에는 곡선을 샘플링해 폴리라인으로 근사했습니다. vello도 3차 베지어 곡선, 2차 베지어 곡선, 타원 호 등을 선분으로 평탄화합니다. 곡률에 따라 분할 깊이를 정하는 적응형 세분 알고리즘을 사용하며, 각 곡선 구간을 독립적으로 처리하면서 GPU에서 병렬로 실행합니다.

![평탄화](/vello-flattening.png)

컴퓨트 셰이더에서 평탄화는 피팅을 위한 오일러 나선 부분 곡선 묶음을 만들며, GPU 병렬성을 충분히 씁니다.

![스트로크 확장](/vello-stroke-expansion-gpu.png)

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

전체 셰이더 코드는 여기서 볼 수 있습니다. <https://github.com/linebender/vello/blob/main/vello_shaders/shader/flatten.wgsl>

![컴퓨트 셰이더](/vello-compute-shader.png)

### 타일 생성 {#tile-generation}

평탄화된 패스는 이어서 가로 스트립에 배정됩니다. 화면은 고정 크기인 4×4 타일로 나뉩니다. 지도 렌더러가 쓰는 LOD 기반 방식과는 다릅니다. 각 선분에 대해 그 선분이 지나는 모든 4×4 영역을 계산하고, 교차하는 영역마다 Tile을 만들어 그 선분에 연결합니다.

![타일 생성](/vello-tile-generation.png)

생성된 타일은 행 우선 순서로 정렬해야 합니다. 먼저 Y로 정렬하고, 같은 Y에서는 X로 정렬합니다. 이후 Strip Generation 단계에서 인접한 가로 타일을 효율적으로 합치려면 이 순서가 필요합니다.

### 스파스 스트립 {#sparse-strips}

행 우선 정렬 뒤 서로 맞닿은 가로 타일은 Sparse Strips로 합쳐집니다. 커버리지는 경로가 실제로 지나는 가로 스트립에만 저장되므로 메모리 효율이 매우 높습니다. 데이터 구조는 다음과 같습니다.

```rust
struct Strip {
    x: u16,          // start X coordinate
    width: u16,      // width in pixels (multiple of 4)
    alpha_idx: u32,  // index into alpha values
    fill_gap: bool,  // whether to fill the gap to the next strip
}
```

각 4×4 타일 안의 픽셀에 대해 커버리지는 다음으로 계산합니다.

-   해석적 안티앨리어싱(Analytic AA)
-   픽셀마다의 서브픽셀 커버리지
-   커버리지가 0이 아닌 가장자리 픽셀만 저장하고, 내부 채우기는 암시적으로 표현합니다.

메모리 최적화: 전체 커버리지 마스크(예를 들어 8×8이나 16×16)를 저장하는 것과 비교하면, 4×4 타일과 Sparse Strips는 실제로 가장자리가 있는 영역만 저장하므로 메모리 대역폭을 크게 줄입니다.

[High-performance 2D graphics rendering on the CPU using sparse strips]

![출처: https://docs.google.com/presentation/d/1f_vKBJMaD68ifBO2j83lBly9Zdk-2bsvj_DIHXxvcuk/edit?slide=id.g3577762aae3_0_24#slide=id.g3577762aae3_0_24](/vello-sparse-stripes.png)

### 거친 래스터화 {#coarse-rasterization}

거친 래스터화 단계는 캔버스를 256×4 픽셀의 Wide Tile로 나눕니다. 각 Wide Tile은 두 종류의 명령이 들어 있는 명령 벡터를 갖습니다.

-   **Fill Command** — 스트립 사이의 안티앨리어싱이 없는 영역을 채웁니다(단색 채우기).
-   **AlphaFill Command** — 스트립 안의 안티앨리어싱 영역을 채웁니다(알파 마스크를 적용).

![거친 래스터화](/vello-coarse-rasterization.png)

### 미세 래스터화 {#fine-rasterization}

마지막 픽셀 셰이더입니다. 각 워크그룹은 Wide Tile 하나(256×4 픽셀)를 처리합니다.

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

## ECS로 렌더링 파이프라인 교체 {#replace-rendering-pipeline}

[vello]는 순수한 2D 렌더러입니다. 뷰포트 기반 컬링, 더티 검사, 공간 인덱싱 같은 기능은 애플리케이션이 구현해야 합니다. 예를 들어 Xilem은 vello 위에 만든 GUI 프레임워크이며, 컴포넌트 트리 diff 시스템을 구현합니다.

우리도 같습니다. 렌더링 레이어만 바꾸고 나머지는 유지합니다. ECS 아키텍처 덕분에 간단합니다. RenderPlugin의 기본 시스템 두 개를 vello 기반 구현으로 바꿉니다. [18강 - ECS로 리팩터링]를 참고하세요.

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

### wasm-pack 사용 {#use-wasm-pack}

[wasm-pack]으로 빌드합니다. `wasm-pack build --target web`을 실행하면 `/pkg` 아래에 산출물이 나옵니다.

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

그런 다음 JS에서 사용할 수 있습니다. WASM을 불러온 뒤 초기화하고 폰트 파일을 로드합니다.

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

렌더링 시점에는 해당하는 도형 API를 호출하고, 속성 목록을 객체로 넘깁니다.

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

[wasm-bindgen]이 JS와 WASM의 상호작용을 처리합니다. 예를 들면 다음과 같습니다.

-   Rust에서 JS를 호출합니다. 예를 들어 `window.devicePixelRatio`를 읽습니다.

```rust
#[cfg(target_arch = "wasm32")]
fn device_pixel_ratio() -> f64 {
    web_sys::window()
        .map(|w| w.device_pixel_ratio())
        .unwrap_or(1.0)
}
```

-   `init`와 `addEllipse`처럼 Rust 함수를 JS에 노출합니다.

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

-   TypeScript 타입 정의를 생성합니다.

다음으로 Rust/vello 스택에서 렌더링 기능을 구현하는 방법, 특히 JS 쪽에서 더 복잡한 부분을 살펴봅니다.

### 그라데이션 {#gradient}

[17강 - 그라디언트와 패턴]에서 `<canvas>`로 CSS 스타일 그라데이션을 만드는 방법을 보았습니다.

```rust
if let Some(ref grads) = fill_gradients {
    for g in grads.iter().rev() {
        let brush = vello::peniko::Brush::Gradient(build_gradient_brush(g, fill_mult));
        scene.fill(Fill::NonZero, shape_transform, &brush, None, &geom);
    }
}
```

vello에서는 그라데이션을 [peniko]의 `Gradient`로 바꾼 뒤 렌더링합니다. API는 Canvas 그라데이션 API와 가깝습니다.

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

### 스케치 / rough 스타일 {#rough}

[13강 - 패스 그리기와 스케치 스타일]에서 `rough-js`로 스케치풍 패스 묶음을 만들어 렌더링했습니다. 그 패스 정의 묶음을 vello에 넘길 수도 있습니다. Rust 크레이트 [roughr]를 쓰면 JS에서 WASM으로 패스 데이터를 넘기지 않아도 됩니다.

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

### 텍스트 {#text}

[15강 - 텍스트 렌더링]에서 텍스트 렌더링에 SDF / MSDF를 사용했고, 셰이핑과 레이아웃에 공을 들였습니다. 그 작업은 [parley]로 할 수 있습니다. 흐름은 다음과 같습니다.

```plaintext
Layout (Parley) ← Shaping with HarfRust/Swash
    ↓
Outline (Skrifa) ← Convert glyph to BezPath
    ↓
Vello/Scene
    ↓
Peniko (Brush/Color/Gradient/Image)
```

-   FontContext: JS에서 넘긴 폰트 데이터로 폰트를 등록합니다.
-   LayoutContext: 텍스트 레이아웃을 만들며, 다음을 지원합니다.
    -   폰트 패밀리, 크기, 자간
    -   줄바꿈, 정렬
    -   커닝, 리가처, Bidi 등 타이포그래피 기능
-   vello가 기대하는 형식으로 폰트 데이터를 출력합니다. [peniko]가 기본 프리미티브(색, 브러시, 폰트 데이터)를 제공합니다.
-   vello로 글리프를 패스로 렌더링합니다. SDF는 전혀 쓰지 않습니다.

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

| 기능          | SDF 방식                                    | Vello 실시간 벡터                                                  |
| ------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| **사전 계산** | 미리 생성한 SDF가 필요합니다                | 외곽선에서 실시간으로 계산합니다                                   |
| **메모리**    | SDF 텍스처용 아틀라스                       | 아틀라스가 없고, 매 프레임 외곽선을 다시 인코딩합니다              |
| **배율**      | 크게 확대하면 모서리가 부드러워집니다       | 어떤 배율에서도 선명합니다                                         |
| **가변 폰트** | 어렵습니다(프레임마다 SDF를 다시 구워야 함) | 기본 지원하며, 굵기와 너비를 애니메이션할 수 있습니다              |
| **작은 크기** | 힌팅이 어렵습니다                           | 힌팅을 지원합니다 [Round vertical hinting offset in Vello Classic] |
| **성능**      | GPU 샘플링은 빠르고 준비는 느립니다         | GPU 연산량이 많고 사전 준비는 없습니다                             |

CJK를 지원하려면 CJK 폰트를 불러야 합니다. CJK 폰트 파일은 큰 편이며(흔히 10MB 이상), 그래서 다음이 생깁니다.

1. 폰트 등록이 느립니다. 큰 파일을 매 프레임 처리합니다.
2. 글리프 캐시가 폭증합니다. 수천 개의 CJK 글리프가 메모리를 많이 씁니다.

![vello에서 CJK 글리프를 렌더링할 때의 끊김](/vello-text-jank.png)

그래서 캐시를 충분히 쓰고, 매 프레임 전체 텍스트에 대해 parley 레이아웃을 실행하거나 큰 CJK 폰트 데이터를 복사하는 일을 피해야 합니다.
폰트 서브셋팅도 한 방법입니다. [10강 - 이미지 가져오기와 내보내기]에서 Excalidraw도 웹 폰트를 SVG에 인라인할 때 동적으로 서브셋팅한다고 언급했습니다.

여기서는 폰트에 SDF를 쓰지 않지만, vello는 벡터가 아닌 글리프도 지원합니다.

-   COLR/CPAL 색상 폰트: vello의 이미지 합성 파이프라인을 통해 이미지로 렌더링됩니다.
-   비트맵 글리프(예: 이모지): 텍스처 쿼드로 렌더링됩니다.

먼저 parley로 이모지가 포함된 텍스트의 레이아웃을 계산하고, Canvas API로 이모지를 그려 픽셀 데이터를 얻은 다음, vello로 렌더링할 수 있습니다.

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

### 이미지 후처리 {#image-post-processing}

[30강 - 후처리와 렌더 패스]와 비슷하게 몇 가지 후처리 효과를 구현할 수 있습니다.

#### 블러 {#blur}

vello는 [draw_blurred_rounded_rect](https://github.com/linebender/vello/blob/main/vello/src/scene.rs#L253) 헬퍼를 제공합니다. 이것은 둥근 사각형에만 적합하고 임의의 도형에는 적용되지 않습니다.

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

#### 드롭 섀도 {#dropshadow}

드롭 섀도는 vello의 레이어 기능으로 만들 수 있습니다.

-   도형을 오프스크린 레이어에 그립니다.
-   블러를 적용합니다.
-   결과를 이동해 메인 씬에 다시 그립니다.

<VelloDropShadow />

## Rust로 구현한 다른 기능 {#other-features-implemented-in-rust}

### 바운딩 박스 계산 {#compute-bounds}

[parley]로 BiDi, 클러스터 등 텍스트 메트릭 기능을 처리할 수 있습니다. 스트로크, `linecap`, `linejoin`이 있는 Polyline과 Path는 이전에는 근사 바운딩 박스를 썼습니다. 이제는 [kurbo]의 `BezPath::bounding_box()`로 더 정확한 결과를 얻을 수 있습니다.

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

그런 다음 vello를 초기화할 때 이것을 연결합니다.

```ts
import {
    Path,
    createGeometryBoundsProviderFromComputePathBounds,
} from '@infinite-canvas-tutorial/ecs';
import { computePathBounds } from '@infinite-canvas-tutorial/vello-renderer';

Path.geometryBoundsProvider =
    createGeometryBoundsProviderFromComputePathBounds(computePathBounds);
```

### 피킹 {#picking}

렌더링 외에도 피킹을 WASM에서 할 수 있습니다. 예를 들어 [Graphite]에서는 다음과 같습니다.

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

이전에는 Canvas API인 [isPointInStroke]와 [isPointInPath]로 점이 패스 안에 있는지 검사했습니다.

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

[kurbo]를 쓸 수도 있습니다. 허용 오차 안에서 패스를 서브패스로 평탄화한 뒤 교차 검사를 수행합니다.

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

### 레이아웃 엔진 {#layout-engine}

[33강 - 레이아웃 엔진]에서는 WASM으로 컴파일한 Yoga를 사용했습니다. [taffy]는 Flexbox와 Grid를 지원하는 Rust 레이아웃 엔진입니다.

## 더 읽어보기 {#extended-reading}

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
[stroke-alignment]: /ko/guide/lesson-010#stroke-alignment
[Vello Sparse Strips]: https://github.com/linebender/vello/tree/main/sparse_strips
[12강 - 폴리라인 그리기]: /ko/guide/lesson-012#extrude-segment
[High-performance 2D graphics rendering on the CPU using sparse strips]: https://ethz.ch/content/dam/ethz/special-interest/infk/inst-pls/plf-dam/documents/StudentProjects/MasterTheses/2025-Laurenz-Thesis.pdf
[Vello Sparse Strips Roadmap 2025-2026]: https://docs.google.com/document/d/1ZquH-53j2OedTbgEKCJBKTh4WLE11UveM10mNdnVARY/edit?tab=t.0#heading=h.uxa8f6wsnhj3
[15강 - 텍스트 렌더링]: /ko/guide/lesson-015
[18강 - ECS로 리팩터링]: /ko/guide/lesson-018
[33강 - 레이아웃 엔진]: /ko/guide/lesson-033
[10강 - 이미지 가져오기와 내보내기]: /ko/guide/lesson-010#inlined-web-font
[13강 - 패스 그리기와 스케치 스타일]: /ko/guide/lesson-013
[17강 - 그라디언트와 패턴]: /ko/guide/lesson-017
[30강 - 후처리와 렌더 패스]: /ko/guide/lesson-030
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
