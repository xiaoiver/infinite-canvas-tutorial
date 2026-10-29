---
outline: deep
description: 'Sistema de maquetación Flex integrado, con soporte del motor de maquetación Yoga. Desarrollo de un motor de maquetación en el entorno WebGL para conseguir un diseño de interfaz adaptable.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 33 - Motor de maquetación' }]
---

<script setup>
import YogaGap from '../../components/YogaGap.vue'
import YogaFlexBasisGrowShrink from '../../components/YogaFlexBasisGrowShrink.vue'
import YogaAlignItemsJustifyContent from '../../components/YogaAlignItemsJustifyContent.vue'
import YogaButton from '../../components/YogaButton.vue'
import YogaMinMaxWidthHeight from '../../components/YogaMinMaxWidthHeight.vue'
</script>

# Lección 33 - Motor de maquetación {#lesson-33-layout-engine}

Los navegadores implementan varios sistemas de maquetación, como Flexbox, Grid y Block, y así es fácil conseguir efectos como el «centrado» sin calcular a mano la posición de los nodos.

En las aplicaciones de tipo lienzo, que funcionan fuera del DOM, tienes que implementar la lógica de tu propio motor de maquetación. Figma ha implementado Auto Layout, donde `Grid` está ahora en beta, mientras que `Vertical` y `Horizontal` corresponden a la propiedad `flex-direction` de CSS. Para más detalles, consulta: [Figma - Guía de Auto Layout]

![fuente: https://www.figma.com/community/file/1284819663700490015](/figma-flexbox.png)

Las herramientas centradas en pasar del diseño al código suelen ofrecer esta capacidad. Para más detalles, consulta:
[Maquetación en pencil.dev]

> Un objeto padre puede hacerse cargo del tamaño y de la posición de sus hijos con un sistema de maquetación al estilo de flexbox, mediante propiedades como layout, justifyContent y alignItems.

```ts
export interface Layout {
    /** Enable flex layout. None means all children are absolutely positioned and will not be affected by layout properties. Frames default to horizontal, groups default to none. */
    layout?: 'none' | 'vertical' | 'horizontal';
    /** The gap between children in the main axis direction. Defaults to 0. */
    gap?: NumberOrVariable;
    layoutIncludeStroke?: boolean;
    /** The Inside padding along the edge of the container */
    padding?:
        | /** The inside padding to all sides */ NumberOrVariable
        | /** The inside horizontal and vertical padding */ [
              NumberOrVariable,
              NumberOrVariable,
          ]
        | /** Top, Right, Bottom, Left padding */ [
              NumberOrVariable,
              NumberOrVariable,
              NumberOrVariable,
              NumberOrVariable,
          ];
    /** Control the justify alignment of the children along the main axis. Defaults to 'start'. */
    justifyContent?:
        | 'start'
        | 'center'
        | 'end'
        | 'space_between'
        | 'space_around';
    /** Control the alignment of children along the cross axis. Defaults to 'start'. */
    alignItems?: 'start' | 'center' | 'end';
}
```

![fuente: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Basic_concepts](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Basic_concepts/basics1.svg)

En esta lección implementaremos maquetaciones Flexbox y admitiremos en los nodos propiedades CSS con los mismos nombres:

```ts
const parent = {
    id: 'parent',
    type: 'rect',
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};
const child = {
    id: 'child',
    parentId: 'parent',
    type: 'rect',
    width: 50,
    height: 50,
};
```

## Yoga {#yoga}

Usar el motor de maquetación [Yoga] en el frontend solo es posible mediante WASM. Ahora mismo hay varias implementaciones disponibles:

-   [yoga-layout-prebuilt] Hace mucho tiempo que no se actualiza.
-   [yoga-wasm-web] Las primeras versiones de [satori] lo usaban para convertir HTML en SVG y calcular la maquetación. [taffy] también tiene un [ejemplo](https://github.com/DioxusLabs/taffy/pull/394#issuecomment-1476430705) relacionado
-   [yoga-layout] Recomendamos usarlo, y nuestra implementación también se basa en él. [react-pdf/yoga] también lo usa.

Conviene señalar que Yoga también se aplica al espacio 3D, siempre que se especifique un plano. Para más detalles, consulta: [react-three-flex]

> Otra diferencia importante respecto al Flexbox del DOM es que tienes que especificar el plano del contenedor en 3D. Los elementos se colocan en el plano 2D definido por los dos ejes, con el ancho y el alto calculados a lo largo de esos dos ejes.

![orientación de los ejes](https://github.com/pmndrs/react-three-flex/raw/master/docs/axes_orientation.png)

### pixijs/layout {#pixijs-layout}

[pixijs/layout] también está implementado con Yoga. Entre las implementaciones parecidas está [pixi-flex-layout]

```ts
const container = new Container({
    layout: {
        width: '80%',
        height: '80%',
        gap: 4,
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignContent: 'center',
    },
});
```

### troika-flex-layout {#troika-flex-layout}

[troika-flex-layout], calculado en un WebWorker con [yoga-layout-prebuilt]:

```ts
import { requestFlexLayout } from 'troika-flex-layout';

// Describe your layout style tree, with a unique id for each node:
const styleTree = {
    id: 'root',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    children: [
        {
            id: 'child',
            width: '50%',
            height: '50%',
        },
    ],
};

// Initiate a layout request with a callback function:
requestFlexLayout(styleTree, (results) => {
    // The results are a mapping of node ids to layout boxes:
    // {
    //   root: { left: 0, top: 0, width: 100, height: 100 },
    //   child: { left: 25, top: 25, width: 50, height: 50 }
    // }
});
```

## Alternativas a Yoga {#alternatives-to-yoga}

Implementaciones en JS puro:

-   [Motion Canvas Layouts] Implementación nativa de Flexbox en el navegador, sin necesidad de reimplementar algoritmos de maquetación complejos
-   [Simplificar WebGL: construir un motor de maquetación eficaz]

Implementaciones en Rust:

-   [stretch] implementa Flexbox y ofrece un enlace WASM `stretch-layout`, pero lleva mucho tiempo sin mantenimiento.
-   [taffy] Biblioteca de maquetación de interfaces de alto rendimiento escrita en Rust. Actualmente implementa varios algoritmos de maquetación de CSS, incluidos Flexbox, Grid y Block. Los enlaces WASM todavía no están disponibles. Para más detalles, consulta: [enlaces WASM de taffy]

## Nuestra implementación {#our-implementation}

Elegimos el [yoga-layout] oficial. Además del Flexbox habitual, también ofrece propiedades básicas de maquetación como Margin y Padding.

```ts
import { loadYoga } from 'yoga-layout/load';

class YogaSystem extends System {
    async prepare() {
        Yoga = await loadYoga();
    }
}
```

Hay que construir un árbol de maquetación paralelo al grafo de escena.

Primero hay que construir un árbol de maquetación paralelo al grafo de escena. La estructura de sus nodos es la siguiente:

```ts
interface StyleTreeNode {
    id: string;
    top?: number | string;
    left?: number | string;
    width?: number | string;
    height?: number | string;
    children: StyleTreeNode[];
    padding?: number | number[];
    margin?: number | number[];
    gap?: number;
    rowGap?: number;
    columnGap?: number;
}
```

Después, en el momento adecuado, se convierte el árbol de maquetación en un árbol de Yoga, se ejecuta el cálculo de la maquetación y se aplican los resultados a los nodos del grafo de escena:

```ts
const root = Yoga.Node.createWithConfig(yogaConfig);
populateNode(root, styleTree);

root.calculateLayout();
const results = Object.create(null);
walkStyleTree(styleTree, (styleNode) => {
    const { id, yogaNode } = styleNode;
    results[id] = {
        x: yogaNode.getComputedLeft(),
        y: yogaNode.getComputedTop(),
        width: yogaNode.getComputedWidth(),
        height: yogaNode.getComputedHeight(),
    };
});
root.freeRecursive();
```

### Cuándo hacer la maquetación {#when-to-do-layout}

Cuando cambia el tamaño del propio contenedor Flexbox, hay que volver a calcular la maquetación y aplicarla a la posición y al tamaño de sus hijos. Lo mismo ocurre cuando se añaden hijos nuevos al contenedor.

```ts
class YogaSystem extends System {
    private readonly bounds = this.query((q) =>
        q.addedOrChanged.and.removed
            .with(ComputedBounds)
            .trackWrites.and.with(Flex),
    );

    execute() {
        this.bounds.addedOrChanged.forEach((entity) => {
            // relayout
        });
    }
}
```

### AlignItems y JustifyContent {#align-items-justify-content}

El uso más habitual es centrar el contenido con estas dos propiedades:

<YogaAlignItemsJustifyContent />

Para implementar botones con el texto centrado:

La etiqueta usa su ancho intrínseco (`wordWrap: false`), y Yoga centra dentro del botón la caja de texto medida. Un `wordWrapWidth` fijo con `maxLines: 1` y `textOverflow: 'ellipsis'` puede truncar la etiqueta aunque el botón tenga espacio de sobra. Reserva esas opciones para las etiquetas que necesiten truncarse a propósito.

<YogaButton />

### Espaciado {#gap}

El ejemplo siguiente muestra el efecto de `padding` y `gap`:

```ts
const parent = {
    id: 'yoga-gap-parent',
    type: 'rect',
    x: 100,
    y: 100,
    width: 200,
    height: 250,
    fill: 'grey',
    display: 'flex',
    padding: 10,
    flexWrap: 'wrap',
    gap: 10,
    zIndex: 0,
};
```

<YogaGap />

### Base, crecimiento y contracción flex {#flex-basis-grow-shrink}

[Base, crecimiento y contracción flex]

> Flex grow acepta cualquier valor de coma flotante >= 0, y 0 es el valor predeterminado. Un contenedor reparte el espacio sobrante entre sus hijos, ponderado por el valor de flex grow de cada hijo.

<YogaFlexBasisGrowShrink />

### Ancho y alto mínimos y máximos {#min-max-width-height}

[Ancho y alto mínimos y máximos]

<YogaMinMaxWidthHeight />

## Exportar SVG {#export-svg}

El Flexbox de CSS admite elementos HTML como contenedores. Los elementos SVG quedan fuera de ese modelo, así que al exportar a SVG hay que seguir usando las posiciones absolutas que resultan de la maquetación.

```ts
const layoutNodes = api.readLayoutFromECS(nodes);

(await serializeNodesToSVGElements(layoutNodes)).forEach((element) => {
    $namespace.appendChild(element);
});
```

## Lectura adicional {#extended-reading}

-   [Simplificar WebGL: construir un motor de maquetación eficaz]
-   [clay]
-   [react-three-flex]
-   [Figma - Guía de Auto Layout]
-   [Maquetación en Rive]

[Yoga]: https://yogalayout.com/
[yoga-layout-prebuilt]: https://github.com/vadimdemedes/yoga-layout-prebuilt
[yoga-wasm-web]: https://github.com/shuding/yoga-wasm-web
[yoga-layout]: https://www.yogalayout.dev/
[taffy]: https://github.com/DioxusLabs/taffy
[Simplificar WebGL: construir un motor de maquetación eficaz]: https://blog.certa.dev/building-a-layout-engine-for-webgl
[troika-flex-layout]: https://github.com/protectwise/troika/blob/main/packages/troika-flex-layout/
[clay]: https://github.com/nicbarker/clay
[Motion Canvas Layouts]: https://motioncanvas.io/docs/layouts
[pixijs/layout]: https://github.com/pixijs/layout
[pixi-flex-layout]: https://github.com/fireveined/pixi-flex-layout/
[react-three-flex]: https://github.com/pmndrs/react-three-flex/
[satori]: https://github.com/vercel/satori
[stretch]: https://github.com/vislyhq/stretch
[enlaces WASM de taffy]: https://github.com/DioxusLabs/taffy/pull/394
[Figma - Guía de Auto Layout]: https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout
[react-pdf/yoga]: https://github.com/diegomura/react-pdf/blob/master/packages/layout/src/yoga/index.ts
[Base, crecimiento y contracción flex]: https://www.yogalayout.dev/docs/styling/flex-basis-grow-shrink
[Ancho y alto mínimos y máximos]: https://www.yogalayout.dev/docs/styling/min-max-width-height
[Maquetación en pencil.dev]: https://docs.pencil.dev/for-developers/the-pen-format#layout
[Maquetación en Rive]: https://rive.app/docs/editor/layouts/layouts-overview
