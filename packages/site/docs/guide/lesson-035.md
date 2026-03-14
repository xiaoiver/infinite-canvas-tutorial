---
outline: deep
description: 'Introduction to tile-based rendering: principles, performance optimization strategies, and examples in infinite canvas applications.'
publish: false
---

<script setup>
import Vello from '../components/Vello.vue'
</script>

# Lesson 35 - Tile-based Rendering

Google Maps and Mapbox both provide Map tiles APIs. At different zoom levels, the screen is divided into multiple tiles.

![source: https://developers.google.com/maps/documentation/tile](https://developers.google.com/static/maps/documentation/tile/images/roadmap_tile2_720.png)

Taking Mapbox as an example, each vector tile stores encoded GeoJSON data. See: [Vector tiles introduction]. Compared to raster tiles, vector tiles stay sharp at any zoom level.

The traditional mesh-based renderer we introduced earlier has complexity `O(pixels × shapes)`:

```plaintext
for pixel:
   check all shapes
```

If we partition screen space into tiles, we only need to check shapes within each tile. The complexity becomes `O(tiles × shapes_per_tile)`, where `shapes_per_tile << total_shapes`. That is why tile-based rendering can be faster in certain scenarios.

```plaintext
for tile:
   check shapes in tile
```

Tile-based rendering also has bad cases, for example when a huge shape covers the entire screen.

In this lesson we replace the rendering layer with a GPU tile-based renderer [vello], which runs entirely on compute shaders and takes full advantage of WebGPU.

## vello {#vello}

vello’s overall architecture looks like this:

![source: https://www.datocms-assets.com/98516/1707130683-levien_2023.pdf](/vello-architecture.png)

The screen is split into fixed-size tiles. This differs from the LOD-based approach used by map renderers:

```plaintext
+----+----+----+----+
| T0 | T1 | T2 | T3 |
+----+----+----+----+
| T4 | T5 | T6 | T7 |
+----+----+----+----+
```

Each tile maintains a primitive list:

```plaintext
Tile 12
 ├─ path 5
 ├─ rect 8
 ├─ stroke 11
 └─ clip 3
```

![source: https://docs.google.com/presentation/d/1f_vKBJMaD68ifBO2j83lBly9Zdk-2bsvj_DIHXxvcuk/edit?slide=id.g3577762aae3_0_24#slide=id.g3577762aae3_0_24](/vello-sparse-stripes.png)

## Replacing the Rendering Pipeline with ECS {#replace-rendering-pipeline}

[vello] is a pure 2D renderer. Features like viewport-based culling, dirty checking, and spatial indexing must be implemented by the application. For example, Xilem is a GUI framework built on vello and implements a component-tree diff system.

For us it is the same: we only replace the rendering layer and keep everything else. Thanks to the ECS architecture this is straightforward: we swap the two default systems in RenderPlugin for vello-based implementations. See: [Lesson 18 - Refactoring with ECS].

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

### Using wasm-pack {#use-wasm-pack}

We build with [wasm-pack]. Run `wasm-pack build --target web` to get the output under `/pkg`:

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

Then you can use it from JS: initialize after loading WASM and load font files.

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

At render time, call the corresponding shape APIs and pass attribute lists as objects:

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

[wasm-bindgen] handles JS–WASM interaction, for example:

-   Calling JS from Rust, e.g. reading `window.devicePixelRatio`:

```rust
#[cfg(target_arch = "wasm32")]
fn device_pixel_ratio() -> f64 {
    web_sys::window()
        .map(|w| w.device_pixel_ratio())
        .unwrap_or(1.0)
}
```

-   Exposing Rust functions to JS, such as `init` and `addEllipse`:

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

-   Generating TypeScript type definitions

Next we look at how to implement rendering features in the Rust/vello stack, especially the parts that are more involved on the JS side.

### Gradients {#gradient}

In [Lesson 17 - Gradients and repeating patterns] we showed how to create CSS-style gradients with `<canvas>`.

```rust
if let Some(ref grads) = fill_gradients {
    for g in grads.iter().rev() {
        let brush = vello::peniko::Brush::Gradient(build_gradient_brush(g, fill_mult));
        scene.fill(Fill::NonZero, shape_transform, &brush, None, &geom);
    }
}
```

In vello, gradients are converted to [peniko] `Gradient` and then rendered. The API is close to the Canvas gradient API:

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

### Sketch / rough style {#rough}

In [Lesson 13 - Drawing paths & sketch style] we used `rough-js` to generate a set of paths for a sketchy look and then rendered them. We could pass that set of path definitions to vello. Using the Rust crate [roughr] avoids passing path data from JS to WASM.

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

### Text {#text}

In [Lesson 15 - Drawing text] we used SDF / MSDF for text rendering and spent effort on shaping and layout. That can be done with [parley]. The flow is:

-   FontContext: register fonts, using font data passed from JS
-   LayoutContext: build text layout, with support for:
    -   font family, size, letter spacing
    -   line wrapping, alignment
    -   kerning, ligatures, Bidi, and other typography features
-   Output font data in the format vello expects; [peniko] provides the basic primitives (color, brush, font data)
-   Render glyphs as paths with vello—no SDF at all

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

| Feature            | SDF approach                  | Vello real-time vectors                                            |
| ------------------ | ----------------------------- | ------------------------------------------------------------------ |
| **Precompute**     | Needs pre-generated SDF       | Computed from outlines in real time                                |
| **Memory**         | Atlas for SDF textures        | No atlas; outlines re-encoded per frame                            |
| **Scale**          | Corners soften at large scale | Sharp at any scale                                                 |
| **Variable fonts** | Hard (re-bake SDF per frame)  | Native; animatable weight/width                                    |
| **Small size**     | Hinting difficult             | Hinting supported [Round vertical hinting offset in Vello Classic] |
| **Performance**    | Fast GPU sampling, slow prep  | GPU compute heavy, zero prep                                       |

For CJK support you need to load CJK fonts. CJK font files are large (often 10MB+), which leads to:

1. Slow font registration—processing a large file every frame
2. Glyph cache blow-up—thousands of CJK glyphs use a lot of memory

![jank when rendering CJK glyphs in vello](/vello-text-jank.png)

Font subsetting can help. In [Lesson 10 - Image import/export] we mentioned that Excalidraw also does dynamic subsetting when inlining web fonts into SVG.

Although we do not use SDF for fonts here, vello also supports non-vector glyphs:

-   COLR/CPAL color fonts: rendered as images via vello’s image compositing pipeline
-   Bitmap glyphs (e.g. emoji): rendered as texture quads

## Other features implemented in Rust {#}

### Picking {#picking}

Besides rendering, picking can be done in WASM. For example in [Graphite]:

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

### Layout engine {#layout-engine}

In [Lesson 33 - Layout engine] we used Yoga compiled to WASM. [taffy] is a Rust layout engine that supports Flexbox and Grid.

## Further reading {#extended-reading}

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
[Lesson 15 - Drawing text]: /guide/lesson-015
[Lesson 18 - Refactoring with ECS]: /guide/lesson-018
[Lesson 33 - Layout engine]: /guide/lesson-033
[Lesson 10 - Image import/export]: /guide/lesson-010#inlined-web-font
[Lesson 13 - Drawing paths & sketch style]: /guide/lesson-013
[Lesson 17 - Gradients and repeating patterns]: /guide/lesson-017
[roughr]: https://github.com/orhanbalci/rough-rs/tree/main/roughr
[taffy]: https://github.com/DioxusLabs/taffy
[parley]: https://github.com/linebender/parley
[wasm-pack]: https://drager.github.io/wasm-pack/
[wasm-bindgen]: https://wasm-bindgen.github.io/wasm-bindgen/
[Round vertical hinting offset in Vello Classic]: https://github.com/linebender/vello/pull/963
[Faster, easier 2D vector rendering - Raph Levien]: https://youtu.be/_sv8K190Zps
