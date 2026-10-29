---
outline: deep
description: 'Introducción al renderizado basado en teselas: principios, estrategias de optimización del rendimiento y ejemplos en aplicaciones de lienzo.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 35 - Renderizado basado en teselas' }]
---

<script setup>
import Vello from '../../components/Vello.vue'
import VelloBlur from '../../components/VelloBlur.vue'
import VelloDropShadow from '../../components/VelloDropShadow.vue'
import VelloRough from '../../components/VelloRough.vue'
</script>

# Lección 35 - Renderizado basado en teselas {#lesson-35-tile-based-rendering}

Google Maps y Mapbox ofrecen API de teselas de mapa. En los distintos niveles de zoom, la pantalla se divide en varias teselas.

![fuente: https://developers.google.com/maps/documentation/tile](https://developers.google.com/static/maps/documentation/tile/images/roadmap_tile2_720.png)

Tomando Mapbox como ejemplo, cada tesela vectorial almacena datos GeoJSON codificados. Consulta: [Introducción a las teselas vectoriales]. Frente a las teselas ráster, las teselas vectoriales se mantienen nítidas en cualquier nivel de zoom.

El renderizador tradicional basado en mallas que presentamos antes tiene una complejidad `O(pixels × shapes)`:

```plaintext
for pixel:
   check all shapes
```

Si partimos el espacio de la pantalla en teselas, solo hace falta comprobar las formas que hay dentro de cada tesela. La complejidad pasa a ser `O(tiles × shapes_per_tile)`, donde `shapes_per_tile << total_shapes`. Por eso el renderizado basado en teselas puede ser más rápido en ciertos escenarios.

```plaintext
for tile:
   check shapes in tile
```

El renderizado basado en teselas también tiene casos desfavorables, por ejemplo cuando una forma enorme cubre toda la pantalla.

En esta lección sustituimos la capa de renderizado por un renderizador de GPU basado en teselas, [vello], que se ejecuta por completo en compute shaders y aprovecha WebGPU al máximo.

<Vello />

## vello {#vello}

vello tiene ahora tres implementaciones en paralelo. Consulta [Tiras dispersas de Vello]:

-   vello (GPU): implementación pura en compute shader de GPU
-   vello CPU: implementación solo en CPU, con multihilo y SIMD
-   vello hybrid: modo híbrido de CPU y GPU

Las tres comparten el mismo algoritmo central (Sparse Strips) y se distinguen por el backend de ejecución.

![fuente: https://www.datocms-assets.com/98516/1707130683-levien_2023.pdf](/vello-architecture.png)

En vello CPU, la arquitectura general tiene este aspecto:

![fuente: https://ethz.ch/content/dam/ethz/special-interest/infk/inst-pls/plf-dam/documents/StudentProjects/MasterTheses/2025-Laurenz-Thesis.pdf](/vello-overview.png)

### Codificación {#encoding}

Cuando llamamos a los comandos de dibujo de vello, se codifican de la forma siguiente y se escriben en un búfer para usarlos en las etapas posteriores del compute shader:

```rust
scene.fill(..., &rect)
scene.stroke(..., &path)
```

<https://github.com/linebender/vello/blob/main/vello_encoding/src/path.rs#L248>

![codificación del trazado](/vello-path-encoding.png)

### Expansión del trazo {#stroke-expansion}

En [Lección 12 - Dibujar una polilínea] presentamos la expansión del trazo de los segmentos de línea, y el renderizado del trazo y del relleno con mallas separadas. vello también expande los trazos con ancho; después, el trazo y el relleno se pueden procesar de manera uniforme.

![expansión del trazo](/vello-stroke-expansion.png)

![fuente: https://dl.acm.org/doi/pdf/10.1145/3675390](/vello-path-style.png)

En las líneas centrales de Bézier engrosadas, las curvas de desplazamiento interior y exterior (curvas paralelas) son difíciles de calcular con robustez. [Expansión de trazo apta para GPU] propone un algoritmo paralelo en GPU que usa una aproximación geométrica especial, las espirales de Euler, para evitar resoluciones iterativas. Una espiral de Euler es una curva cuya curvatura varía de forma lineal con la longitud de arco. Consulta: [Espiral de Euler / clotoide: una explicación ilustrada].

Sus propiedades clave:

-   Se puede aproximar con eficiencia con solo 1 o 2 segmentos de Bézier cúbicos
-   Expresa de forma natural la geometría de las curvas paralelas
-   Tiene expresiones de forma cerrada, así que encaja bien en el cálculo en GPU

Durante la expansión hay que tratar linecap y linejoin. Antes usábamos un enfoque de trazo analítico en el fragment shader. vello lo hace en la CPU con [kurbo]; consulta [Expansión del trazo]. Un inconveniente es el paralelismo limitado; además, como la expansión ocurre en el espacio geométrico, un único trazo grande puede cubrir casi todas las teselas con un zoom alto. Para la [alineación del trazo] se puede usar el trazado desplazado de kurbo. Las curvas de Bézier se convierten primero en polilíneas, antes de la expansión.

### Aplanado {#flattening}

Antes muestrebamos las curvas y las aproximábamos con polilíneas. vello también aplana curvas de Bézier cúbicas, curvas de Bézier cuadráticas, arcos elípticos, etc., y los convierte en segmentos de línea mediante un algoritmo de subdivisión adaptativa que elige la profundidad de subdivisión a partir de la curvatura, y se ejecuta en paralelo en la GPU, con cada segmento de curva procesado de forma independiente.

![aplanado](/vello-flattening.png)

En el compute shader, el aplanado produce un conjunto de subcurvas de espiral de Euler para el ajuste, y así aprovecha al máximo el paralelismo de la GPU:

![expansión del trazo](/vello-stroke-expansion-gpu.png)

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

El código completo del shader está aquí: <https://github.com/linebender/vello/blob/main/vello_shaders/shader/flatten.wgsl>

![shader de cómputo](/vello-compute-shader.png)

### Generación de teselas {#tile-generation}

Los trazados aplanados se asignan después a tiras horizontales. La pantalla se divide en teselas fijas de 4×4, a diferencia del enfoque basado en LOD que usan los renderizadores de mapas. Para cada segmento de línea se calculan todas las regiones de 4×4 que atraviesa; se crea una tesela por cada región de intersección y se enlaza con ese segmento.

![generación de teselas](/vello-tile-generation.png)

Las teselas generadas deben ordenarse en orden por filas: primero por Y y, para la misma Y, por X. Este orden hace falta para que la etapa posterior de generación de tiras pueda fusionar con eficiencia las teselas horizontales adyacentes.

### Tiras dispersas {#sparse-strips}

Las teselas horizontales adyacentes (después de ordenarlas por filas) se fusionan en Sparse Strips. La cobertura se almacena solo en las tiras horizontales que los trazados recorren de verdad, y eso da una eficiencia de memoria muy alta. La estructura de datos tiene este aspecto:

```rust
struct Strip {
    x: u16,          // start X coordinate
    width: u16,      // width in pixels (multiple of 4)
    alpha_idx: u32,  // index into alpha values
    fill_gap: bool,  // whether to fill the gap to the next strip
}
```

Para los píxeles de cada tesela de 4×4, la cobertura se calcula con:

-   Antialiasing analítico (Analytic AA)
-   Cobertura de subpíxel por cada píxel
-   Solo se almacenan los píxeles de borde con cobertura distinta de cero; el relleno interior es implícito

Optimización de memoria: frente a almacenar máscaras de cobertura completas (por ejemplo 8×8 o 16×16), las teselas de 4×4 con Sparse Strips almacenan solo las regiones que de verdad tienen bordes, y así reducen mucho el ancho de banda de memoria.

[Renderizado 2D de alto rendimiento en la CPU mediante tiras dispersas]

![fuente: https://docs.google.com/presentation/d/1f_vKBJMaD68ifBO2j83lBly9Zdk-2bsvj_DIHXxvcuk/edit?slide=id.g3577762aae3_0_24#slide=id.g3577762aae3_0_24](/vello-sparse-stripes.png)

### Rasterización gruesa {#coarse-rasterization}

La etapa de rasterización gruesa divide el lienzo en Wide Tiles de 256×4 píxeles. Cada Wide Tile contiene un vector de comandos con dos tipos:

-   **Comando Fill**: rellena las regiones sin antialiasing entre tiras (relleno sólido)
-   **Comando AlphaFill**: rellena las regiones con antialiasing dentro de las tiras (aplica la máscara alfa)

![rasterización gruesa](/vello-coarse-rasterization.png)

### Rasterización fina {#fine-rasterization}

El pixel shader final: cada workgroup procesa una Wide Tile (256×4 píxeles).

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

## Sustituir el pipeline de renderizado por ECS {#replace-rendering-pipeline}

[vello] es un renderizador 2D puro. Funciones como el culling basado en el viewport, la comprobación de modificado y la indexación espacial las tiene que implementar la aplicación. Por ejemplo, Xilem es un framework de GUI construido sobre vello e implementa un sistema de diff del árbol de componentes.

Para nosotros es igual: solo sustituimos la capa de renderizado y conservamos todo lo demás. Gracias a la arquitectura ECS, esto es directo: cambiamos los dos sistemas predeterminados de RenderPlugin por implementaciones basadas en vello. Consulta: [Lección 18 - Refactorizar con ECS].

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

### Usar wasm-pack {#use-wasm-pack}

Compilamos con [wasm-pack]. Ejecuta `wasm-pack build --target web` para obtener la salida en `/pkg`:

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

Después puedes usarlo desde JS: inicializa tras cargar el WASM y carga los archivos de fuentes.

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

En el momento de renderizar, llama a las API de forma correspondientes y pasa las listas de atributos como objetos:

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

[wasm-bindgen] se encarga de la interacción entre JS y WASM, por ejemplo:

-   Llamar a JS desde Rust, por ejemplo para leer `window.devicePixelRatio`:

```rust
#[cfg(target_arch = "wasm32")]
fn device_pixel_ratio() -> f64 {
    web_sys::window()
        .map(|w| w.device_pixel_ratio())
        .unwrap_or(1.0)
}
```

-   Exponer funciones de Rust a JS, como `init` y `addEllipse`:

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

-   Generar definiciones de tipos de TypeScript

A continuación vemos cómo implementar funciones de renderizado en la pila de Rust/vello, sobre todo las partes que resultan más laboriosas en el lado de JS.

### Degradados {#gradient}

En [Lección 17 - Degradado y patrón] mostramos cómo crear degradados al estilo de CSS con `<canvas>`.

```rust
if let Some(ref grads) = fill_gradients {
    for g in grads.iter().rev() {
        let brush = vello::peniko::Brush::Gradient(build_gradient_brush(g, fill_mult));
        scene.fill(Fill::NonZero, shape_transform, &brush, None, &geom);
    }
}
```

En vello, los degradados se convierten en un `Gradient` de [peniko] y después se renderizan. La API se parece a la API de degradados de Canvas:

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

### Estilo de boceto / rough {#rough}

En [Lección 13 - Dibujar trazados y estilo de boceto] usamos `rough-js` para generar un conjunto de trazados con aspecto de boceto y después los renderizamos. Podríamos pasar ese conjunto de definiciones de trazado a vello. Usar el crate de Rust [roughr] evita pasar los datos del trazado de JS a WASM.

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

En [Lección 15 - Renderizado de texto] usamos SDF / MSDF para el renderizado de texto y dedicamos esfuerzo al shaping y a la maquetación. Eso se puede hacer con [parley]. El flujo es:

```plaintext
Layout (Parley) ← Shaping with HarfRust/Swash
    ↓
Outline (Skrifa) ← Convert glyph to BezPath
    ↓
Vello/Scene
    ↓
Peniko (Brush/Color/Gradient/Image)
```

-   FontContext: registra fuentes, con los datos de fuente que llegan desde JS
-   LayoutContext: construye la maquetación del texto, con soporte de:
    -   familia tipográfica, tamaño, espaciado entre letras
    -   ajuste de línea, alineación
    -   kerning, ligaduras, Bidi y otras funciones tipográficas
-   Salida de los datos de fuente en el formato que espera vello; [peniko] aporta las primitivas básicas (color, pincel, datos de fuente)
-   Renderizar los glifos como trazados con vello, sin SDF en absoluto

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

| Característica     | Enfoque SDF                         | Vectores en tiempo real de Vello                                            |
| ------------------ | ----------------------------------- | --------------------------------------------------------------------------- |
| **Cálculo previo** | Necesita un SDF generado de antemano | Se calcula a partir de los contornos en tiempo real                         |
| **Memoria**        | Atlas para las texturas SDF         | Sin atlas; los contornos se vuelven a codificar en cada fotograma           |
| **Escala**         | Las esquinas se suavizan a gran escala | Nítido a cualquier escala                                                |
| **Fuentes variables** | Difícil (hay que regenerar el SDF en cada fotograma) | Nativo; el peso y el ancho se pueden animar              |
| **Tamaño pequeño** | El hinting es difícil               | El hinting está soportado [Redondeo del desplazamiento de hinting vertical en Vello Classic] |
| **Rendimiento**    | Muestreo rápido en GPU, preparación lenta | Mucho cómputo en GPU, preparación nula                             |

Para el soporte de CJK tienes que cargar fuentes CJK. Los archivos de fuentes CJK son grandes (a menudo más de 10 MB), lo que lleva a:

1. Un registro de fuentes lento: se procesa un archivo grande en cada fotograma
2. El caché de glifos se dispara: miles de glifos CJK consumen mucha memoria

![tirones al renderizar glifos CJK en vello](/vello-text-jank.png)

Por eso hay que aprovechar al máximo la caché y evitar ejecutar la maquetación de parley y copiar los datos grandes de la fuente CJK de todo el texto en cada fotograma.
El subconjunto de fuentes es otra opción. En [Lección 10 - Importar y exportar imágenes] mencionamos que Excalidraw también hace un subconjunto dinámico al incrustar fuentes web en el SVG.

Aunque aquí no usamos SDF para las fuentes, vello también admite glifos que no son vectoriales:

-   Fuentes de color COLR/CPAL: se renderizan como imágenes mediante el pipeline de composición de imágenes de vello
-   Glifos de mapa de bits (por ejemplo, emoji): se renderizan como quads de textura

Podemos usar primero parley para calcular la maquetación del texto que contiene emoji, después dibujar el emoji mediante la API Canvas para obtener los datos de píxeles y, por último, renderizarlo con vello:

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

### Posprocesado de imagen {#image-post-processing}

Podemos implementar algunos efectos de posprocesado, de forma parecida a [Lección 30 - Posprocesado y pases de renderizado].

#### Desenfoque {#blur}

vello ofrece un ayudante [draw_blurred_rounded_rect](https://github.com/linebender/vello/blob/main/vello/src/scene.rs#L253), que solo sirve para rectángulos redondeados y no se aplica a formas arbitrarias.

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

#### Sombra paralela {#dropshadow}

Las sombras paralelas se pueden construir con la funcionalidad de capas de vello:

-   Dibuja la forma en una capa fuera de pantalla
-   Aplica un desenfoque
-   Desplaza el resultado y vuelve a dibujarlo en la escena principal

<VelloDropShadow />

## Otras funciones implementadas en Rust {#other-features-implemented-in-rust}

### Calcular los límites {#compute-bounds}

Podemos usar [parley] para tratar BiDi, los clústeres y otras funciones de métricas de texto. Para Polyline y Path con trazo, `linecap` y `linejoin`, antes usábamos límites aproximados; ahora podemos usar `BezPath::bounding_box()` de [kurbo] para obtener resultados más precisos:

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

Después, al inicializar vello, lo conectamos:

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

Además del renderizado, el picking se puede hacer en WASM. Por ejemplo en [Graphite]:

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

Antes comprobábamos si un punto estaba dentro de un trazado con la API Canvas [isPointInStroke] y [isPointInPath]:

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

También podemos usar [kurbo]: aplanar el trazado en subtrazados dentro de una tolerancia y ejecutar pruebas de intersección:

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

### Motor de maquetación {#layout-engine}

En [Lección 33 - Motor de maquetación] usamos Yoga compilado a WASM. [taffy] es un motor de maquetación en Rust que admite Flexbox y Grid.

## Lectura adicional {#extended-reading}

-   [Renderizado 2D de alto rendimiento en la CPU mediante tiras dispersas]
-   [Expansión de trazo apta para GPU]
-   [Renderizado vectorial 2D más rápido y sencillo - Raph Levien]
-   [Hoja de ruta de Vello Sparse Strips 2025-2026]
-   [¿Qué significa el renderizado basado en teselas?]
-   [Motiff]
-   [Llevar al límite el renderizado de tilemaps]
-   [renderizado por teselas en un trazador de rayos]

[¿Qué significa el renderizado basado en teselas?]: https://stackoverflow.com/questions/69956923/what-does-tile-based-rendering-mean
[Motiff]: https://www.motiff.com/blog/performance-magic-behind-motiff
[Llevar al límite el renderizado de tilemaps]: https://www.teamflowhq.com/dev/pushing-the-limit-with-tilemap-rendering
[renderizado por teselas en un trazador de rayos]: https://github.com/knightcrawler25/GLSL-PathTracer/blob/291c1fdc3f97b2a2602c946b41cecca9c3092af7/src/shaders/tile.glsl#L43
[Introducción a las teselas vectoriales]: https://docs.mapbox.com/data/tilesets/guides/vector-tiles-introduction/
[vello]: https://github.com/linebender/vello
[peniko]: https://github.com/linebender/peniko
[kurbo]: https://github.com/linebender/kurbo
[Expansión del trazo]: https://github.com/linebender/kurbo/issues/285
[alineación del trazo]: /es/guide/lesson-010#stroke-alignment
[Tiras dispersas de Vello]: https://github.com/linebender/vello/tree/main/sparse_strips
[Lección 12 - Dibujar una polilínea]: /es/guide/lesson-012#extrude-segment
[Renderizado 2D de alto rendimiento en la CPU mediante tiras dispersas]: https://ethz.ch/content/dam/ethz/special-interest/infk/inst-pls/plf-dam/documents/StudentProjects/MasterTheses/2025-Laurenz-Thesis.pdf
[Hoja de ruta de Vello Sparse Strips 2025-2026]: https://docs.google.com/document/d/1ZquH-53j2OedTbgEKCJBKTh4WLE11UveM10mNdnVARY/edit?tab=t.0#heading=h.uxa8f6wsnhj3
[Lección 15 - Renderizado de texto]: /es/guide/lesson-015
[Lección 18 - Refactorizar con ECS]: /es/guide/lesson-018
[Lección 33 - Motor de maquetación]: /es/guide/lesson-033
[Lección 10 - Importar y exportar imágenes]: /es/guide/lesson-010#inlined-web-font
[Lección 13 - Dibujar trazados y estilo de boceto]: /es/guide/lesson-013
[Lección 17 - Degradado y patrón]: /es/guide/lesson-017
[Lección 30 - Posprocesado y pases de renderizado]: /es/guide/lesson-030
[roughr]: https://github.com/orhanbalci/rough-rs/tree/main/roughr
[taffy]: https://github.com/DioxusLabs/taffy
[parley]: https://github.com/linebender/parley
[wasm-pack]: https://drager.github.io/wasm-pack/
[wasm-bindgen]: https://wasm-bindgen.github.io/wasm-bindgen/
[Redondeo del desplazamiento de hinting vertical en Vello Classic]: https://github.com/linebender/vello/pull/963
[Renderizado vectorial 2D más rápido y sencillo - Raph Levien]: https://youtu.be/_sv8K190Zps
[Expansión de trazo apta para GPU]: https://dl.acm.org/doi/pdf/10.1145/3675390
[Graphite]: https://github.com/GraphiteEditor/Graphite
[isPointInStroke]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInStroke
[isPointInPath]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInPath
[Espiral de Euler / clotoide: una explicación ilustrada]: https://xixixao.github.io/euler-spiral-explanation/