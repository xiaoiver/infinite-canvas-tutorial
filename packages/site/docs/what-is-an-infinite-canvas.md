# What is an Infinite Canvas?

The term "infinite" in [infinitecanvas] is described as follows:

-   High scalability. Users can freely organize content structures in a non-linear fashion.
-   Zooming. Emulates the "zoom in" to get an overview and "zoom out" to observe details as in the real world.
-   Direct manipulation. Provides intuitive editing capabilities for basic shapes, including moving, grouping, and modifying styles.

The [infinitecanvas] showcases numerous examples ranging from design tools to creative boards, including some well-known products such as: [Figma], [Modyfi], [rnote], [tldraw], [excalidraw] and so on.

As a front-end developer, I am very interested in the rendering technologies involved. Although tldraw, excalidraw, and others generally use more user-friendly technologies like Canvas2D/SVG, there are also many editors and design tools in the JS and Rust ecosystems that use more low-level rendering technologies for 2D graphics with GPU acceleration to achieve better performance and experience:

-   [Figma] uses a tile-based rendering engine written in C++, compiled into WASM and then calls WebGL for rendering.
-   [Modyfi] uses [wgpu] from the Rust ecosystem, also compiled into WASM and then calls WebGL2 for rendering.
-   [Zed] uses GPUI to render rectangles, shadows, text, images, and other UI elements.
-   [Vello] and [xilem] experimentally use Compute Shader for 2D rendering.

Therefore, in this tutorial, I hope to implement the following features:

-   Use [@antv/g-device-api] as a hardware abstraction layer, supporting WebGL1/2 and WebGPU.
-   Referencing [mapbox] and [Figma], attempt to use tile-based rendering.
-   Use SDF (Signed Distance Field) rendering for circles, ellipses, rectangles, etc.
-   GPU-accelerated text and Bezier curve rendering.
-   Use [rough.js] to support hand-drawn styles.
-   Use CRDT (Conflict-free Replicated Data Type) to support collaborative [Yjs].

I hope to rewrite the rendering part of the canvas with Rust in the future, but the current project completion is still relatively low:

-   [wgpu] is a very reliable hardware abstraction layer, which can even implement the backend for [piet].
-   Shaders can basically be reused.
-   Hand-drawn styles can use [rough-rs].
-   [y-crdt] is the Rust implementation of [Yjs].

![rust stack](/rust.png)

Let's get started!

[infinitecanvas]: https://infinitecanvas.tools/
[Figma]: https://madebyevan.com/figma/building-a-professional-design-tool-on-the-web/
[Modyfi]: https://digest.browsertech.com/archive/browsertech-digest-how-modyfi-is-building-with/
[rnote]: https://github.com/flxzt/rnote
[tldraw]: https://github.com/tldraw/tldraw
[excalidraw]: https://github.com/excalidraw/excalidraw
[rough.js]: https://github.com/rough-stuff/rough
[rough-rs]: https://github.com/orhanbalci/rough-rs
[zed]: https://zed.dev/blog/videogame
[wgpu]: https://wgpu.rs/
[vello]: https://github.com/linebender/vello
[xilem]: https://github.com/linebender/xilem
[piet]: https://github.com/linebender/piet
[@antv/g-device-api]: https://github.com/antvis/g-device-api
[mapbox]: https://blog.mapbox.com/rendering-big-geodata-on-the-fly-with-geojson-vt-4e4d2a5dd1f2?gi=e5acafcf219d
[Yjs]: https://yjs.dev/
[y-crdt]: https://github.com/y-crdt/y-crdt
