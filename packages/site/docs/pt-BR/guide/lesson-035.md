---
outline: deep
description: 'Introdução à renderização baseada em tiles: princípios, estratégias de otimização de desempenho e exemplos em aplicativos de tela.'
---
<script setup>
import Vello from '../../components/Vello.vue'
import VelloBlur from '../../components/VelloBlur.vue'
import VelloDropShadow from '../../components/VelloDropShadow.vue'
import VelloRough from '../../components/VelloRough.vue'
</script>

# Lição 35 - Renderização baseada em tiles {#lesson-35-tile-based-rendering}

O Google Maps e o Mapbox oferecem APIs de tiles de mapa. Em níveis de zoom diferentes, a tela é dividida em vários tiles.

![fonte: https://developers.google.com/maps/documentation/tile](https://developers.google.com/static/maps/documentation/tile/images/roadmap_tile2_720.png)

Tomando o Mapbox como exemplo, cada tile vetorial guarda dados GeoJSON codificados. Veja: [Vector tiles introduction]. Em comparação com tiles raster, os tiles vetoriais continuam nítidos em qualquer nível de zoom.

O renderizador tradicional baseado em malha que apresentamos antes tem complexidade `O(pixels × shapes)`:

```plaintext
for pixel:
   check all shapes
```

Se particionarmos o espaço da tela em tiles, só precisamos testar as formas dentro de cada tile. A complexidade passa a ser `O(tiles × shapes_per_tile)`, em que `shapes_per_tile << total_shapes`. Por isso a renderização baseada em tiles pode ser mais rápida em alguns cenários.

```plaintext
for tile:
   check shapes in tile
```

A renderização baseada em tiles também tem casos ruins, por exemplo quando uma forma enorme cobre a tela inteira.

Nesta lição, substituímos a camada de renderização por um renderizador de GPU baseado em tiles, o [vello], que roda inteiramente em compute shaders e aproveita ao máximo o WebGPU.

<Vello />

## vello {#vello}

O vello hoje tem três implementações em paralelo. Veja [Vello Sparse Strips]:

-   vello (GPU) — implementação pura em compute shader na GPU
-   vello CPU — implementação só em CPU, com multithreading e SIMD
-   vello hybrid — modo híbrido CPU/GPU

As três compartilham o mesmo algoritmo central (Sparse Strips), mas diferem no backend de execução.

![fonte: https://www.datocms-assets.com/98516/1707130683-levien_2023.pdf](/vello-architecture.png)

No vello CPU, a arquitetura geral fica assim:

![fonte: https://ethz.ch/content/dam/ethz/special-interest/infk/inst-pls/plf-dam/documents/StudentProjects/MasterTheses/2025-Laurenz-Thesis.pdf](/vello-overview.png)

### Codificação {#encoding}

Quando chamamos os comandos de desenho do vello, eles são codificados na forma a seguir e gravados num buffer, para uso nos estágios seguintes de compute shader:

```rust
scene.fill(..., &rect)
scene.stroke(..., &path)
```

<https://github.com/linebender/vello/blob/main/vello_encoding/src/path.rs#L248>

![codificação do caminho](/vello-path-encoding.png)

### Expansão do traço {#stroke-expansion}

Em [Lição 12 - Desenhar polilinha] apresentamos a expansão de traço para segmentos de reta, renderizando traço e preenchimento com malhas separadas. O vello também expande traços com largura; depois disso, traço e preenchimento podem ser processados de forma uniforme.

![expansão do traço](/vello-stroke-expansion.png)

![fonte: https://dl.acm.org/doi/pdf/10.1145/3675390](/vello-path-style.png)

Para linhas de centro de Bézier engrossadas, as curvas de deslocamento interna e externa (curvas paralelas) são difíceis de calcular com robustez. [GPU-friendly Stroke Expansion] propõe um algoritmo paralelo na GPU que usa uma aproximação geométrica especial, as espirais de Euler, para evitar resoluções iterativas. Uma espiral de Euler é uma curva cuja curvatura varia de forma linear com o comprimento de arco. Veja: [Euler Spiral / Clothoid - An Illustrated Explanation].

As propriedades principais:

-   Pode ser aproximada com eficiência com apenas 1–2 segmentos de Bézier cúbica
-   Expressa naturalmente a geometria das curvas paralelas
-   Tem expressões de forma fechada, o que a torna adequada ao cálculo na GPU

Linecap e linejoin precisam ser tratados durante a expansão. Antes, usávamos uma abordagem de traço analítico no fragment shader. O vello faz isso na CPU com o [kurbo]; veja [Stroke expansion]. Uma desvantagem é o paralelismo limitado; além disso, como a expansão acontece no espaço geométrico, um único traço grande pode cobrir quase todos os tiles num zoom alto. Para [stroke-alignment], o caminho de offset do kurbo pode ser usado. As curvas de Bézier são convertidas em polilinhas antes da expansão.

### Achatamento {#flattening}

Antes, amostrávamos curvas e as aproximávamos com polilinhas. O vello também achata curvas de Bézier cúbicas, curvas de Bézier quadráticas, arcos elípticos e outras em segmentos de reta, com um algoritmo de subdivisão adaptativa que escolhe a profundidade da subdivisão a partir da curvatura, e roda em paralelo na GPU, com cada segmento de curva processado de forma independente.

![achatamento](/vello-flattening.png)

No compute shader, o achatamento produz um conjunto de subcurvas em espiral de Euler para o ajuste, aproveitando ao máximo o paralelismo da GPU:

![expansão do traço](/vello-stroke-expansion-gpu.png)

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

Você encontra o código completo do shader aqui: <https://github.com/linebender/vello/blob/main/vello_shaders/shader/flatten.wgsl>

![compute shader](/vello-compute-shader.png)

### Geração de tiles {#tile-generation}

Os caminhos achatados são então atribuídos a faixas horizontais. A tela é dividida em tiles de tamanho fixo 4×4, diferente da abordagem baseada em LOD usada pelos renderizadores de mapa. Para cada segmento de reta, todas as regiões 4×4 que ele cruza são calculadas; um Tile é criado para cada região de interseção e ligado a esse segmento.

![geração de tiles](/vello-tile-generation.png)

Os tiles gerados precisam ser ordenados em ordem row-major: primeiro por Y e, para o mesmo Y, por X. Essa ordem é necessária para que o estágio seguinte, Strip Generation, una com eficiência os tiles horizontais adjacentes.

### Faixas esparsas {#sparse-strips}

Tiles horizontais adjacentes (depois da ordenação row-major) são unidos em Sparse Strips. A cobertura fica armazenada só nas faixas horizontais de fato percorridas pelos caminhos, o que dá uma eficiência de memória muito alta. A estrutura de dados fica assim:

```rust
struct Strip {
    x: u16,          // start X coordinate
    width: u16,      // width in pixels (multiple of 4)
    alpha_idx: u32,  // index into alpha values
    fill_gap: bool,  // whether to fill the gap to the next strip
}
```

Para os pixels de cada tile 4×4, a cobertura é calculada com:

-   Antialiasing analítico (Analytic AA)
-   Cobertura de subpixel por pixel
-   Só os pixels de borda com cobertura diferente de zero são armazenados; o preenchimento interior fica implícito

Otimização de memória: em comparação com armazenar máscaras de cobertura completas (por exemplo 8×8 ou 16×16), tiles 4×4 com Sparse Strips guardam só as regiões que de fato têm bordas, e a largura de banda de memória cai bastante.

[High-performance 2D graphics rendering on the CPU using sparse strips]

![fonte: https://docs.google.com/presentation/d/1f_vKBJMaD68ifBO2j83lBly9Zdk-2bsvj_DIHXxvcuk/edit?slide=id.g3577762aae3_0_24#slide=id.g3577762aae3_0_24](/vello-sparse-stripes.png)

### Rasterização grosseira {#coarse-rasterization}

O estágio de rasterização grosseira divide a tela em Wide Tiles de 256×4 pixels. Cada Wide Tile guarda um vetor de comandos com dois tipos:

-   **Fill Command** — preenche as regiões sem antialiasing entre as faixas (preenchimento sólido)
-   **AlphaFill Command** — preenche as regiões com antialiasing dentro das faixas (aplica a máscara de alfa)

![rasterização grosseira](/vello-coarse-rasterization.png)

### Rasterização fina {#fine-rasterization}

O pixel shader final: cada workgroup processa um Wide Tile (256×4 pixels).

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

## Substituir o pipeline de renderização pelo ECS {#replace-rendering-pipeline}

O [vello] é um renderizador 2D puro. Recursos como culling baseado no viewport, verificação de sujeira e indexação espacial precisam ser implementados pelo aplicativo. Por exemplo, o Xilem é um framework de GUI construído sobre o vello e implementa um sistema de diff da árvore de componentes.

No nosso caso, acontece o mesmo: só substituímos a camada de renderização e mantemos o resto. Graças à arquitetura ECS, isso é direto: trocamos os dois systems padrão do RenderPlugin por implementações baseadas no vello. Veja: [Lição 18 - Refatorar com ECS].

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

### Usar o wasm-pack {#use-wasm-pack}

Compilamos com o [wasm-pack]. Rode `wasm-pack build --target web` para obter a saída em `/pkg`:

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

Depois você pode usá-lo a partir do JS: inicialize depois de carregar o WASM e carregue os arquivos de fonte.

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

Na hora de renderizar, chame as APIs de forma correspondentes e passe as listas de atributos como objetos:

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

O [wasm-bindgen] cuida da interação JS–WASM, por exemplo:

-   Chamar JS a partir de Rust, por exemplo lendo `window.devicePixelRatio`:

```rust
#[cfg(target_arch = "wasm32")]
fn device_pixel_ratio() -> f64 {
    web_sys::window()
        .map(|w| w.device_pixel_ratio())
        .unwrap_or(1.0)
}
```

-   Expor funções Rust ao JS, como `init` e `addEllipse`:

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

-   Gerar definições de tipo TypeScript

Em seguida, vemos como implementar recursos de renderização na pilha Rust/vello, sobretudo as partes que exigem mais trabalho do lado do JS.

### Gradientes {#gradient}

Em [Lição 17 - Gradiente e padrão] mostramos como criar gradientes no estilo CSS com `<canvas>`.

```rust
if let Some(ref grads) = fill_gradients {
    for g in grads.iter().rev() {
        let brush = vello::peniko::Brush::Gradient(build_gradient_brush(g, fill_mult));
        scene.fill(Fill::NonZero, shape_transform, &brush, None, &geom);
    }
}
```

No vello, os gradientes são convertidos em `Gradient` do [peniko] e então renderizados. A API fica próxima da API de gradiente do Canvas:

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

### Estilo de esboço / rough {#rough}

Em [Lição 13 - Desenhar caminho e estilo de esboço] usamos o `rough-js` para gerar um conjunto de caminhos com visual de esboço e depois os renderizamos. Dá para passar esse conjunto de definições de caminho ao vello. Usar o crate Rust [roughr] evita passar dados de caminho do JS para o WASM.

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

### Texto {#text}

Em [Lição 15 - Renderização de texto] usamos SDF / MSDF para a renderização de texto e dedicamos esforço a shaping e layout. Isso pode ser feito com o [parley]. O fluxo é:

```plaintext
Layout (Parley) ← Shaping with HarfRust/Swash
    ↓
Outline (Skrifa) ← Convert glyph to BezPath
    ↓
Vello/Scene
    ↓
Peniko (Brush/Color/Gradient/Image)
```

-   FontContext: registra fontes, usando os dados de fonte passados pelo JS
-   LayoutContext: monta o layout do texto, com suporte a:
    -   família da fonte, tamanho, espaçamento entre letras
    -   quebra de linha, alinhamento
    -   kerning, ligaturas, Bidi e outros recursos tipográficos
-   Saída dos dados de fonte no formato que o vello espera; o [peniko] oferece as primitivas básicas (cor, brush, dados de fonte)
-   Renderizar os glifos como caminhos com o vello, sem SDF nenhum

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

| Recurso            | Abordagem SDF                      | Vetores em tempo real do Vello                                     |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------ |
| **Pré-cálculo**    | Precisa de SDF gerado antes        | Calculado a partir dos contornos em tempo real                     |
| **Memória**        | Atlas para texturas SDF            | Sem atlas; os contornos são recodificados a cada quadro            |
| **Escala**         | Os cantos amaciam em escala grande | Nítido em qualquer escala                                          |
| **Fontes variáveis** | Difícil (gerar o SDF de novo a cada quadro) | Nativo; peso e largura podem ser animados                 |
| **Tamanho pequeno** | O hinting é difícil               | Hinting com suporte [Round vertical hinting offset in Vello Classic] |
| **Desempenho**     | Amostragem rápida na GPU, preparação lenta | Compute pesado na GPU, sem preparação                     |

Para suporte a CJK, você precisa carregar fontes CJK. Os arquivos de fonte CJK são grandes (muitas vezes 10MB ou mais), o que leva a:

1. Registro de fonte lento: processar um arquivo grande a cada quadro
2. Explosão do cache de glifos: milhares de glifos CJK usam muita memória

![travamento ao renderizar glifos CJK no vello](/vello-text-jank.png)

Por isso precisamos aproveitar ao máximo o cache e evitar rodar o layout do parley e copiar dados grandes de fonte CJK do texto inteiro a cada quadro.
O subsetting de fontes é outra opção. Em [Lição 10 - Importar e exportar imagens] mencionamos que o Excalidraw também faz subsetting dinâmico ao embutir fontes web no SVG.

Embora aqui não usemos SDF para fontes, o vello também aceita glifos não vetoriais:

-   Fontes coloridas COLR/CPAL: renderizadas como imagens pelo pipeline de composição de imagem do vello
-   Glifos bitmap (por exemplo emoji): renderizados como quads de textura

Podemos primeiro usar o parley para calcular o layout de um texto que contenha emoji, depois desenhar o emoji pela API Canvas para obter os dados de pixel e, por fim, renderizá-lo com o vello:

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

### Pós-processamento de imagem {#image-post-processing}

Dá para implementar alguns efeitos de pós-processamento, no mesmo espírito de [Lição 30 - Pós-processamento e passes de renderização].

#### Desfoque {#blur}

O vello oferece o auxiliar [draw_blurred_rounded_rect](https://github.com/linebender/vello/blob/main/vello/src/scene.rs#L253), que serve só para retângulos arredondados e não se aplica a formas arbitrárias.

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

#### Sombra projetada {#dropshadow}

Sombras projetadas podem ser montadas com a funcionalidade de camada do vello:

-   Desenhar a forma numa camada fora da tela
-   Aplicar um desfoque
-   Deslocar o resultado e desenhá-lo de volta na cena principal

<VelloDropShadow />

## Outros recursos implementados em Rust {#other-features-implemented-in-rust}

### Calcular os limites {#compute-bounds}

Podemos usar o [parley] para tratar BiDi, clusters e outros recursos de métrica de texto. Para Polyline e Path com traço, `linecap` e `linejoin`, antes usávamos limites aproximados; agora podemos usar `BezPath::bounding_box()` do [kurbo] para um resultado mais preciso:

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

Depois, na inicialização do vello, encaixamos isso:

```ts
import {
    Path,
    createGeometryBoundsProviderFromComputePathBounds,
} from '@infinite-canvas-tutorial/ecs';
import { computePathBounds } from '@infinite-canvas-tutorial/vello-renderer';

Path.geometryBoundsProvider =
    createGeometryBoundsProviderFromComputePathBounds(computePathBounds);
```

### Picking {#picking}

Além da renderização, o picking pode ser feito em WASM. Por exemplo no [Graphite]:

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

Antes, testávamos se um ponto estava dentro de um caminho com a API Canvas [isPointInStroke] e [isPointInPath]:

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

Também podemos usar o [kurbo]: achatar o caminho em subcaminhos dentro de uma tolerância e executar testes de interseção:

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

### Motor de layout {#layout-engine}

Em [Lição 33 - Motor de layout] usamos o Yoga compilado para WASM. O [taffy] é um motor de layout em Rust com suporte a Flexbox e Grid.

## Leitura adicional {#extended-reading}

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
[stroke-alignment]: /pt-BR/guide/lesson-010#stroke-alignment
[Vello Sparse Strips]: https://github.com/linebender/vello/tree/main/sparse_strips
[Lição 12 - Desenhar polilinha]: /pt-BR/guide/lesson-012#extrude-segment
[High-performance 2D graphics rendering on the CPU using sparse strips]: https://ethz.ch/content/dam/ethz/special-interest/infk/inst-pls/plf-dam/documents/StudentProjects/MasterTheses/2025-Laurenz-Thesis.pdf
[Vello Sparse Strips Roadmap 2025-2026]: https://docs.google.com/document/d/1ZquH-53j2OedTbgEKCJBKTh4WLE11UveM10mNdnVARY/edit?tab=t.0#heading=h.uxa8f6wsnhj3
[Lição 15 - Renderização de texto]: /pt-BR/guide/lesson-015
[Lição 18 - Refatorar com ECS]: /pt-BR/guide/lesson-018
[Lição 33 - Motor de layout]: /pt-BR/guide/lesson-033
[Lição 10 - Importar e exportar imagens]: /pt-BR/guide/lesson-010#inlined-web-font
[Lição 13 - Desenhar caminho e estilo de esboço]: /pt-BR/guide/lesson-013
[Lição 17 - Gradiente e padrão]: /pt-BR/guide/lesson-017
[Lição 30 - Pós-processamento e passes de renderização]: /pt-BR/guide/lesson-030
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
