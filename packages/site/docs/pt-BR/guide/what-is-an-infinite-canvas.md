---
description: 'Introdução aos conceitos de tela infinita, incluindo alta escalabilidade, recursos de zoom e manipulação direta. Visão geral das tecnologias modernas de renderização e do roteiro para construir uma tela infinita acelerada por GPU.'
head:
    - ['meta', { property: 'og:title', content: 'O que é uma tela infinita?' }]
---
# O que é uma tela infinita? {#what-is-an-infinite-canvas}

O termo "infinita" em [infinitecanvas] é descrito da seguinte forma:

-   Alta escalabilidade. Os usuários podem organizar livremente as estruturas de conteúdo de forma não linear.
-   Zoom. Emula o "zoom in" para obter uma visão geral e o "zoom out" para observar detalhes, como no mundo real.
-   Manipulação direta. Oferece recursos intuitivos de edição para formas básicas, incluindo mover, agrupar e modificar estilos.

O [infinitecanvas] apresenta numerosos exemplos que vão de ferramentas de design a quadros criativos, incluindo alguns produtos bem conhecidos, como: [Figma], [Modyfi], [rnote], [tldraw], [excalidraw] e outros.

Como desenvolvedor front-end, tenho muito interesse nas tecnologias de renderização envolvidas. Embora o tldraw, o excalidraw e outros geralmente usem tecnologias mais acessíveis, como Canvas2D/SVG, também há muitos editores e ferramentas de design nos ecossistemas de JS e Rust que usam tecnologias de renderização de mais baixo nível para gráficos 2D com aceleração por GPU, a fim de obter melhor desempenho e experiência:

-   O [Figma] usa um motor de renderização baseado em tiles, escrito em C++, compilado para WASM e, em seguida, chama WebGL e WebGPU para renderizar.
-   O [Modyfi] usa o [wgpu] do ecossistema Rust, também compilado para WASM e, em seguida, chama WebGL2 para renderizar.
-   O [Zed] usa o GPUI para renderizar retângulos, sombras, texto, imagens e outros elementos de UI.
-   O [Vello] e o [xilem] usam, de forma experimental, Compute Shader para renderização 2D.

Portanto, neste tutorial, espero implementar os seguintes recursos:

-   Usar o [@antv/g-device-api] como camada de abstração de hardware, com suporte a WebGL1/2 e WebGPU.
-   Com referência ao [mapbox] e ao [Figma], tentar usar renderização baseada em tiles.
-   Usar renderização SDF (campo de distância com sinal) para círculos, elipses, retângulos etc.
-   Renderização de texto e de curvas de Bézier acelerada por GPU.
-   Usar o [rough.js] para dar suporte a estilos desenhados à mão.
-   Usar CRDT (tipo de dado replicado sem conflitos) para dar suporte ao [Yjs] colaborativo.

Espero reescrever a parte de renderização da tela em Rust no futuro, mas a conclusão atual do projeto ainda é relativamente baixa:

-   O [wgpu] é uma camada de abstração de hardware muito confiável, capaz até de implementar o backend do [piet].
-   Os shaders podem, basicamente, ser reutilizados.
-   Estilos desenhados à mão podem usar o [rough-rs].
-   O [y-crdt] é a implementação em Rust do [Yjs].

![pilha Rust](/rust.png)

Já implementei a renderização de formas básicas, estilo de esboço e recursos relacionados em Rust usando o [vello], invocado via WASM.

Vamos começar!

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
