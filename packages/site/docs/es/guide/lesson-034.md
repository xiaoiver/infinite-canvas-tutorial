---
outline: deep
description: 'Frame y recorte: implementación de clip/erase con el búfer de stencil, y tratamiento de clip-path y mask al exportar PNG/SVG.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 34 - Group, Frame y recorte' }]
---

<script setup>
import ClipPath from '../../components/ClipPath.vue'
import Mask from '../../components/Mask.vue'
import ClipPathSoft from '../../components/ClipPathSoft.vue'
import Cropping from '../../components/Cropping.vue'
import BrushWithEraser from '../../components/BrushWithEraser.vue'
import TransformerGroup from '../../components/TransformerGroup.vue'
</script>

# Lección 34 - Group, Frame y recorte {#lesson-34-group-frame-and-clip}

Actualmente nuestro `Group / g` es una agrupación lógica sin límites geométricos (por ejemplo `x/y/width/height`), así que no aplica recorte a los hijos. tldraw ofrece tanto Group como Frame como [Formas estructurales].

## Group {#group}

En Figma, un Group actúa en esencia como un «contenedor», parecido a una carpeta. Para más detalles, consulta: [La diferencia entre frames y groups]

-   Trata varios elementos como una sola unidad en las operaciones (mover, escalar, etc.)
-   Al hacer clic se selecciona todo el Group de forma predeterminada; el tamaño del Group lo determinan automáticamente sus elementos hijo
-   Con un doble clic entras en el Group y editas los elementos por separado
-   Agrupar y desagrupar
    -   Usa los menús contextuales y los atajos de teclado
    -   Arrastra y suelta en el panel de capas

<TransformerGroup />

### Group con arrastrar y soltar {#group-ungroup-with-dnd}

Antes de implementar la agrupación por arrastrar y soltar, podemos usar [sortablejs] para activar primero la ordenación por arrastrar y soltar de los elementos dentro de la lista del mismo nivel.

```ts
import Sortable from 'sortablejs';

const lists = root.querySelectorAll<HTMLElement>('.layer-siblings');
lists.forEach((el) => {
    const parentId = el.dataset.layerParentId ?? '';
    const sortable = Sortable.create(el, {
        animation: 150,
        draggable: '.layer-branch',
        filter: '.layer-branch--locked', // 锁定图层无法拖拽
        preventOnFilter: false,
        group: {
            name: `layers-${parentId || 'root'}`,
            pull: true,
            put: true,
        },
        onEnd: (evt) => {
            if (evt.oldIndex === evt.newIndex) {
                return;
            }
            const to = evt.to as HTMLElement;
            const orderedIds = Array.from(to.children)
                .filter((c): c is HTMLElement =>
                    c.classList.contains('layer-branch'),
                )
                .map((c) => c.dataset.nodeId)
                .filter((id): id is string => !!id);
            // 所有兄弟节点重新排序，依次设置 zIndex
            this.applyLayerSiblingOrder(
                to.dataset.layerParentId ?? '',
                orderedIds,
            );
        },
    });
    this.sortableInstances.push(sortable);
});
```

Arrastrar para agrupar, o desagrupar, exige operaciones entre grupos.

## Búfer de stencil {#stencil-buffer}

En tldraw, el recorte se hace con el [clip-path] de CSS, definido en el padre al sobrescribir `getClipPath`; el Frame integrado se implementa así. En Figma esta propiedad se llama `clip content`; consulta [Propiedades de Frame en Figma].

En [pencil.dev], el Frame se define así: es un rectángulo que puede contener elementos hijo y tiene capacidad de recorte:

```ts
/** A frame is a rectangle that can have children. */
export interface Frame extends Rectangleish, CanHaveChildren, Layout {
    type: 'frame';
    /** Visually clip content that overflows the frame bounds. Default is false. */
    clip?: BooleanOrVariable;
    placeholder?: boolean;
    /** The presence of this property indicates that this frame is a "slot" - which means that it is intended be customized with children in instances of the parent component. Each element of the array is an ID of a "recommended" reusable component, one which fits semantically as a child here (e.g. inside a menu bar, the content slot would recommend IDs of various menu item components). */
    slot?: string[];
}
```

Por generalidad, queremos que cualquier forma pueda actuar como padre de recorte: los hijos que quedan fuera de la forma se recortan, y el propio padre se sigue renderizando con normalidad, con `fill` y `stroke` aplicados. La propiedad se declara así:

```ts
{
    clipChildren: true;
}
```

A continuación vemos cómo implementar este recorte en WebGL / WebGPU.

![búfer de stencil de learnopengl](https://maxammann.org/posts/2022/01/wgpu-stencil-testing/learnopengl-stencil_buffer.png)

Cuando una forma es un contenedor de recorte, también hay que renderizar al búfer de stencil en el RenderPass; su valor predeterminado es `0`:

```ts
{
    stencilWrite: true, // enable writing to stencil buffer
    stencilFront: {
        compare: CompareFunction.ALWAYS,
        passOp: StencilOp.REPLACE,
    },
    stencilBack: {
        compare: CompareFunction.ALWAYS,
        passOp: StencilOp.REPLACE,
    }
}
```

Después escribimos un valor de referencia en el búfer de stencil para compararlo más tarde al renderizar los hijos; este valor puede estar en `[0-255]`, por ejemplo `1` en el diagrama de arriba:

```ts
renderPass.setStencilReference(STENCIL_CLIP_REF);
```

Al renderizar los hijos recortados, comprobamos si el valor del búfer es igual a esta referencia; las regiones con valor `0` no se dibujan, y así se consigue el recorte:

```ts
{
    stencilFront: {
        compare: CompareFunction.EQUAL,
        passOp: StencilOp.KEEP,
    }
}
```

<ClipPath />

## Efecto de borrador {#non-atomic-eraser}

Ahora podemos implementar la parte que faltaba de [Lección 25 - Borrador no atómico]. El efecto de borrador es lo contrario del recorte: el [clip-path] de CSS define la región «visible», y el [\<clipPath\>] de SVG hace lo mismo. Ninguno de los dos puede definir una región «invisible».

El `<mask>` de SVG sí puede; consulta [Recorte y enmascarado en SVG]. En WebGL / WebGPU solo hace falta invertir la comparación:

```ts
{
    stencilFront: {
        compare: CompareFunction.EQUAL, // [!code --]
        compare: CompareFunction.NOTEQUAL, // [!code ++]
        passOp: StencilOp.KEEP,
    }
}
```

Así que también hace falta una propiedad que distinga los modos `clip` y `erase`:

```ts
{
    clipChildren: true,  // [!code --]
    clipMode: 'erase', // 'clip' | 'erase' // [!code ++]
}
```

En el fragment shader, al usar el búfer de stencil, hay que omitir la lógica habitual de descarte basada en el alfa; consulta [Lección 2 - SDF]. Con `fill='none'`, si no se omite, el renderizado no sale bien:

```glsl
// sdf.glsl
#ifdef USE_STENCIL
  // Stencil pass: discard by geometry (SDF distance), not alpha. Include the same
  // anti-alias band as the normal pass (fwidth(distance)) so the stencil boundary
  // matches the visible shape and avoids edge holes.
  float outerBoundary = (strokeAlignment < 1.5) ? 0.0 : strokeWidth;
  if (distance > outerBoundary)
    discard;
#else
  if (outputColor.a < epsilon)
    discard;
#endif
```

<Mask />

<BrushWithEraser />

## Exportar como imagen {#export-as-image}

Al exportar como imagen un único elemento recortado, necesitamos la intersección de sus límites con los del padre como tamaño para renderizar en OffscreenCanvas, o como tamaño del `viewBox` al exportar SVG:

```ts
const { minX, minY, maxX, maxY } =
    entity.read(ComputedBounds).renderWorldBounds;
const {
    minX: parentMinX,
    minY: parentMinY,
    maxX: parentMaxX,
    maxY: parentMaxY,
} = parentEntity.read(ComputedBounds).renderWorldBounds;
const isectMinX = Math.max(minX, parentMinX);
const isectMinY = Math.max(minY, parentMinY);
const isectMaxX = Math.min(maxX, parentMaxX);
const isectMaxY = Math.min(maxY, parentMaxY);
bounds.addFrame(isectMinX, isectMinY, isectMaxX, isectMaxY);
```

### Exportar PNG {#export-as-png}

El único cuidado es que, aunque exportes solo el hijo recortado, tienes que renderizar primero el padre.

### Exportar SVG {#export-as-svg}

Primero, el caso `clipMode='clip'`.

El padre de recorte tiene un `<g>` correspondiente. Asigna su `clip-path` para que referencie la definición de la propia forma; ten en cuenta que [\<clipPath\>] en sí no se renderiza.

```html
<g clip-path="url(#clip-path-frame-1)" transform="matrix(1,0,0,1,100,100)">
    <defs>
        <clipPath id="clip-path-frame-1">
            <ellipse
                id="node-frame-1"
                fill="green"
                cx="100"
                cy="100"
                rx="100"
                ry="100"
            />
        </clipPath>
    </defs>
    <ellipse
        id="node-frame-1"
        fill="green"
        cx="100"
        cy="100"
        rx="100"
        ry="100"
    />
    <rect
        id="node-rect-1"
        fill="red"
        width="100"
        height="100"
        transform="matrix(1,0,0,1,-50,-50)"
    />
</g>
```

Para `clipMode='erase'`, las reglas de la máscara SVG son:

-   Blanco (luminancia 1): el contenido enmascarado es visible
-   Negro (luminancia 0): el contenido enmascarado queda oculto

Dibuja primero un rectángulo blanco grande y, después, la forma que borra, en negro:

```ts
const $whiteRect = createSVGElement('rect');
$whiteRect.setAttribute('x', '-10000');
$whiteRect.setAttribute('y', '-10000');
$whiteRect.setAttribute('width', '20000');
$whiteRect.setAttribute('height', '20000');
$whiteRect.setAttribute('fill', 'white');
$clipPath.appendChild($whiteRect);

$parentNode.setAttribute('fill', 'black');
$parentNode.setAttribute('stroke', 'black');
```

La estructura SVG resultante:

```html
<defs xmlns="http://www.w3.org/2000/svg">
    <mask id="mask-frame-1">
        <rect x="-10000" y="-10000" width="20000" height="20000" fill="white" />
        <rect fill="black" width="100" height="100" stroke="black" />
    </mask>
</defs>
```

## Recortar una imagen {#crop-an-image}

El recorte se usa sobre todo con imágenes. Consulta [Recortar una imagen] y [recorte de imagen en excalidraw] para más detalles.

![recortar una imagen en Figma](https://help.figma.com/hc/article_attachments/34351829050391)

Conviene señalar que, en los editores, recortar suele conservar la imagen original, así que el área recortada solo se oculta de forma visual y resulta fácil reajustar la región de recorte:

> Recortar es una acción no destructiva, lo que significa que el área recortada no se elimina. Así puedes hacer cambios en el área recortada, si hace falta.

### Efecto semitransparente del área recortada {#use-soft-clip-outside}

Tras entrar en el modo de recorte, el contenido original de la imagen tiene que seguir mostrándose, y el área recortada se indica con transparencia. Añadimos otro modo, `'soft'`, a `clipMode` para conseguir este efecto:

<ClipPathSoft />

El principio de la implementación es el siguiente: en realidad renderizamos la forma recortada dos veces. La primera pasada (`compare: CompareFunction.EQUAL`) renderiza la parte recortada con normalidad, como se describió antes, y la segunda pasada (`compare: CompareFunction.NOTEQUAL`) aplica una transparencia fija:

```glsl
#ifdef USE_SOFT_CLIP_OUTSIDE
  outputColor *= 0.15;
#endif
```

### Añadir interacción {#interaction}

A continuación añadimos interacción para que la región de recorte se pueda editar. Tras entrar en el modo de recorte hay dos partes interactivas:

-   Fijar la región de recorte y arrastrar el gráfico recortado
-   Ajustar el tamaño de la región de recorte

<Cropping />

Siguiendo el diseño de interacción de Figma, después de seleccionar una forma puedes entrar en el modo de recorte desde el menú contextual. En ese momento se crea un elemento padre de recorte para los elementos seleccionados:

```ts
const children = layersSelected.map((id) => this.api.getNodeById(id));
const bounds = this.api.getBounds(children);
const { minX, minY, maxX, maxY } = bounds;
// create a clip parent for all the selected nodes
const clipParent: RectSerializedNode = {
    id: uuidv4(),
    type: 'rect',
    clipMode: 'clip',
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
};

this.api.runAtNextTick(() => {
    this.api.updateNodes([clipParent]);
    // clipParent -> children
    children.forEach((child) => {
        this.api.reparentNode(child, clipParent);
    });
    this.api.setAppState({
        layersCropping: [clipParent.id],
        penbarSelected: Pen.SELECT,
    });
    this.api.record();
});
```

## Lectura adicional {#extended-reading}

-   [Recorte de formas en tldraw]
-   [Propiedades de Frame en Figma]
-   [Pruebas de stencil en WebGPU y wgpu]
-   [Recorte y enmascarado en SVG]

[Formas estructurales]: https://tldraw.dev/sdk-features/default-shapes#Structural-shapes
[Recorte de formas en tldraw]: https://tldraw.dev/sdk-features/shape-clipping
[Propiedades de Frame en Figma]: https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design#:~:text=Clip%20Content%3A%20Hide%20any%20objects%20within%20the%20frame%20that%20extend%20beyond%20the%20frame%27s%20bounds
[Pruebas de stencil en WebGPU y wgpu]: https://maxammann.org/posts/2022/01/wgpu-stencil-testing/
[Lección 25 - Borrador no atómico]: /es/guide/lesson-025
[clip-path]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/clip-path
[\<clipPath\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/clipPath
[Recorte y enmascarado en SVG]: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Clipping_and_masking
[Lección 2 - SDF]: /es/guide/lesson-002#sdf
[Recortar una imagen]: https://help.figma.com/hc/en-us/articles/360040675194-Crop-an-image
[recorte de imagen en excalidraw]: https://github.com/excalidraw/excalidraw/pull/8613
[pencil.dev]: https://docs.pencil.dev/for-developers/the-pen-format#typescript-schema
[La diferencia entre frames y groups]: https://help.figma.com/hc/en-us/articles/360039832054-The-difference-between-frames-and-groups?utm_source=chatgpt.com
[sortablejs]: https://github.com/sortablejs/Sortable
