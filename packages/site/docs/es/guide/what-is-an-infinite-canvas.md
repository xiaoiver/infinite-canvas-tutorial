---
description: 'Introducción a los conceptos del lienzo infinito, como la alta escalabilidad, la capacidad de zoom y la manipulación directa. Visión general de las tecnologías de renderizado modernas y de la hoja de ruta para construir un lienzo infinito acelerado por GPU.'
head:
    - ['meta', { property: 'og:title', content: '¿Qué es un lienzo infinito?' }]
---
# ¿Qué es un lienzo infinito? {#what-is-an-infinite-canvas}

En [infinitecanvas], el término «infinito» se describe así:

-   Alta escalabilidad. Los usuarios pueden organizar con libertad las estructuras de contenido de forma no lineal.
-   Zoom. Imita el «acercar» para obtener una visión de conjunto y el «alejar» para observar los detalles, como en el mundo real.
-   Manipulación directa. Ofrece capacidades de edición intuitivas para las formas básicas, como mover, agrupar y modificar estilos.

[infinitecanvas] muestra numerosos ejemplos que van desde herramientas de diseño hasta tableros creativos, incluidos algunos productos muy conocidos, como [Figma], [Modyfi], [rnote], [tldraw], [excalidraw] y otros.

Como desarrollador de front-end, me interesan mucho las tecnologías de renderizado que intervienen. Aunque tldraw, excalidraw y otros suelen usar tecnologías más fáciles de usar, como Canvas2D/SVG, en los ecosistemas de JS y de Rust también hay muchos editores y herramientas de diseño que usan tecnologías de renderizado de más bajo nivel para gráficos 2D con aceleración por GPU, a fin de lograr un mejor rendimiento y una mejor experiencia:

-   [Figma] usa un motor de renderizado basado en teselas escrito en C++, compilado a WASM, y después llama a WebGL y WebGPU para renderizar.
-   [Modyfi] usa [wgpu], del ecosistema de Rust, también compilado a WASM, y después llama a WebGL2 para renderizar.
-   [Zed] usa GPUI para renderizar rectángulos, sombras, texto, imágenes y otros elementos de la interfaz.
-   [Vello] y [xilem] usan de forma experimental Compute Shader para el renderizado 2D.

Por eso, en este tutorial espero implementar las funciones siguientes:

-   Usar [@antv/g-device-api] como capa de abstracción de hardware, con soporte de WebGL1/2 y WebGPU.
-   Tomando como referencia [mapbox] y [Figma], intentar usar renderizado basado en teselas.
-   Usar renderizado SDF (campo de distancia con signo) para círculos, elipses, rectángulos, etc.
-   Renderizado de texto y de curvas de Bézier acelerado por GPU.
-   Usar [rough.js] para admitir estilos dibujados a mano.
-   Usar CRDT (tipo de dato replicado libre de conflictos) para admitir [Yjs] colaborativo.

Espero reescribir en el futuro la parte de renderizado del lienzo con Rust, pero el grado de finalización del proyecto actual sigue siendo relativamente bajo:

-   [wgpu] es una capa de abstracción de hardware muy fiable, que incluso puede implementar el backend de [piet].
-   Los shaders se pueden reutilizar en esencia.
-   Los estilos dibujados a mano pueden usar [rough-rs].
-   [y-crdt] es la implementación en Rust de [Yjs].

![pila de Rust](/rust.png)

Ya he implementado en Rust, con [vello], el renderizado de formas básicas, el estilo de boceto y funciones relacionadas, invocado a través de WASM.

¡Empecemos!

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
