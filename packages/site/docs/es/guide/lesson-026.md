---
outline: deep
description: 'Implementa las herramientas de selección.'
---

<script setup>
import MultiSelection from '../../components/MultiSelection.vue'
import Lasso from '../../components/Lasso.vue'
</script>

# Lección 26 - Herramienta de selección {#lesson-26-selection-tool}

En [Lección 14 - Modo de selección] solo implementamos la selección sencilla con clic de formas individuales. En esta lección seguiremos mejorando la herramienta de selección y añadiremos la selección múltiple, la selección de marco y el lazo.

## Selección múltiple {#multi-selection}

A partir de la selección con un clic, mantener pulsada <kbd>Shift</kbd> permite añadir o quitar formas adicionales de la selección actual.

![Mantén pulsada <kbd>Shift</kbd> para seleccionar varias capas en Figma](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042572c7d3a0cb93253d5/file-TQrRIcwMNR.gif)

En el modo de selección, decidimos si se conserva la selección actual según el estado de `input.shiftKey` (si <kbd>Shift</kbd> está pulsada): si no está pulsada, se pasa a la selección simple; si está pulsada, se añade la forma de destino a la selección existente:

```ts
if (selection.mode === SelectionMode.SELECT) {
    if (layersSelected.length > 1 && layersSelected.includes(selected.id)) {
        // deselect if already selected in a group
        api.deselectNodes([selected]);
    } else {
        api.selectNodes([selected], input.shiftKey); // whether to add to existed selection
    }
}
```

En [Lección 21 - Transformer] implementamos la selección de una sola forma. A continuación hay que añadir una visualización de Group para varias formas seleccionadas. A diferencia del Transformer de selección simple, el Group de selección múltiple no necesita tener en cuenta `rotation` ni `scale`.

```ts
export class RenderTransformer extends System {
    getOBB(camera: Entity): OBB {
        const { selecteds } = camera.read(Transformable);

        // Single selected, keep the original OBB include rotation & scale.
        if (selecteds.length === 1 && selecteds[0].has(ComputedBounds)) {
            const { obb } = selecteds[0].read(ComputedBounds);
            return obb;
        }

        // [!code ++]
        if (selecteds.length > 1) {
            // [!code ++]
        }
    }
}
```

El efecto es el siguiente. La lógica para transformar todas las formas seleccionadas al cambiar el tamaño ya se presentó en [Lección 21 - Transformar formas], así que no la repetiremos aquí:

<MultiSelection />

## Selección de marco {#marquee-selection}

La imagen siguiente procede de [Seleccionar capas y objetos en Figma]

![Marco de selección en Figma](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042ec04286350d088ba04/file-tAFIn9Cimd.gif)

Esta herramienta de selección de marco se llama «marquee»; consulta: [Hacer selecciones con la herramienta Marco rectangular]. Al área rectangular formada la llamamos Brush.

Cuando termina la selección de marco (al soltar el ratón), primero hay que ocultar el rectángulo Brush (veremos su implementación en la sección siguiente) y después usar el método de picking rápido presentado en [Lección 8 - Usar indexación espacial para acelerar]. Conviene señalar que, como el ancho y el alto del rectángulo pueden ser negativos (según la dirección del arrastre), hay que hacer algunos cálculos para que la BBox sea válida:

```ts
if (input.pointerUpTrigger) {
    if (selection.mode === SelectionMode.BRUSH) {
        // Hide Brush...

        if (selection.brush) {
            const { x, y, width, height } = selection.brush.read(Rect);
            // Make a valid BBox
            const minX = Math.min(x, x + width);
            const minY = Math.min(y, y + height);
            const maxX = Math.max(x, x + width);
            const maxY = Math.max(y, y + height);
            const selecteds = api
                .elementsFromBBox(minX, minY, maxX, maxY) // Use space index
                .filter((e) => !e.has(UI))
                .map((e) => api.getNodeByEntity(e));
            api.selectNodes(selecteds); // Finish selection
        }
    }
}
```

Durante la selección de marco también queremos mostrar el estado de selección en tiempo real mediante el resaltado y el Transformer. A partir de la lógica de picking y selección anterior, añadimos el resaltado:

![Resaltado al arrastrar el marco](/brush.gif)

```ts
api.selectNodes(selecteds);
// [!code ++]
if (needHighlight) {
    api.highlightNodes(selecteds); // [!code ++]
}
```

Por supuesto, para los componentes dentro del espacio del viewport también podemos implementarlos con SVG, como veremos en la herramienta Lazo posterior.

## Deseleccionar con Esc {#deselect-with-esc}

Pulsar <kbd>Esc</kbd> en el estado seleccionado cancela la selección. Además, durante la selección de marco hay que ocultar el Brush:

```ts
if (input.key === 'Escape') {
    api.selectNodes([]);
    if (selection.mode === SelectionMode.BRUSH) {
        this.hideBrush(selection);
    }
}
```

## Bloquear y desbloquear capas {#lock-and-unlock-layers}

Las capas bloqueadas no se pueden seleccionar. Para más detalles, consulta: [Bloquear y desbloquear capas]

## Selección con lazo {#lasso-selection}

En comparación con la herramienta Marco rectangular, la herramienta Lazo permite selecciones más precisas al crear polígonos irregulares.

-   [Solicitud de función: selección con lazo (selección libre) en Excalidraw]
-   [lasso-tool-figma]

En la edición de imágenes basada en IA, la herramienta lazo también puede crear máscaras con mayor precisión para hacer inpainting. La imagen siguiente muestra el efecto en Figma, donde las áreas seleccionadas se pueden borrar o separar en capas:

![fuente: https://help.figma.com/hc/en-us/articles/24004542669463-Make-or-edit-an-image-with-AI#h_01KBJQAF0G6X98H5JJ8GBAPTGP](https://help.figma.com/hc/article_attachments/36912285044247)

### Dibujar el lazo {#draw-lasso}

En [Lección 25 - Herramienta lápiz] vimos cómo dibujar libremente trazados de polilínea. Seguimos dibujando los trazados del lazo dentro del contenedor SVG, normalmente representados por líneas discontinuas con animación (hormigas en marcha).

```html
<path d="...">
    <animate
        attribute-name="stroke-dashoffset"
        stroke-dasharray="7 7"
        stroke-dashoffset="10"
        from="0"
        to="-14"
        dur="0.3s"
    />
</path>
```

Primero se convierten las coordenadas de los puntos del sistema de coordenadas del viewport al sistema de coordenadas del lienzo. Después se simplifica el trazado según el nivel de zoom actual de la cámara: con un zoom alto hace falta una granularidad de selección más fina, y con un zoom bajo, menos. Además, menos vértices mejoran tanto el rendimiento del renderizado como la eficiencia de la detección de intersecciones posterior:

```ts
import simplify from 'simplify-js';

const lassoPath = super
    .getCurrentTrail()
    ?.originalPoints?.map(([x, y]) => this.api.viewport2Canvas({ x, y }));

const simplifyDistance = 5 / this.api.getAppState().cameraZoom;
const points = simplify(lassoPath, simplifyDistance).map((p) => [p.x, p.y]);
// Hit-test the current path as it changes for preview, and again on pointerup
// before clearing the trail to commit the final selection.
const selected = selectByLassoPath(this.api, points);
```

<Lasso />

Arrastra alrededor de las formas para previsualizar los aciertos de inmediato: los contornos aparecen o desaparecen a medida que cambia el lazo. El lazo sin terminar se cierra solo hasta su punto de inicio para la prueba de impacto. Suelta para confirmar la selección final en un solo paso de deshacer. Pulsa Escape, cancela el gesto táctil, empieza un pellizco o cambia de herramienta para limpiar la previsualización sin seleccionar. Los toques y los movimientos minúsculos no seleccionan nada. Elige de nuevo la herramienta lazo para otra selección. El modo de dibujo de máscara crea su trazado solo al soltar y no previsualiza la selección de formas.

La prueba de impacto usa coordenadas del mundo, incluidas las transformaciones del padre de cada forma, la rotación y los volteos. Las polilíneas abiertas se comprueban segmento a segmento, sin una arista de cierre implícita. Quedan excluidas las formas bloqueadas y ocultas.

### Detección de intersección de polígonos {#polygon-intersection}

Ahora que hemos creado un Path, necesitamos recuperar la geometría que lo interseca en la escena. Como antes, empezaremos usando [Lección 8 - Usar indexación espacial para acelerar].

```ts
function selectByLassoPath(api: API, lassoPath: [number, number][]) {
    const lassoBounds = lassoPath.reduce(
        (acc, item) => {
            return [
                Math.min(acc[0], item[0]),
                Math.min(acc[1], item[1]),
                Math.max(acc[2], item[0]),
                Math.max(acc[3], item[1]),
            ];
        },
        [Infinity, Infinity, -Infinity, -Infinity],
    ) as [number, number, number, number];

    // Hit-test with rbush
    const elements = api.elementsFromBBox(
        lassoBounds[0],
        lassoBounds[1],
        lassoBounds[2],
        lassoBounds[3],
    );

    // elementsFromBBox excludes locked elements; also filter UI and hidden nodes.
}
```

Tras superar la detección rápida de la caja delimitadora, hay que tratar dos situaciones: el lazo está por completo dentro del gráfico, o el lazo interseca el gráfico.

```ts
function isPolygonsIntersect(points1: number[][], points2: number[][]) {
    let isIn = false;
    // Determine whether a point lies inside a polygon. If any point is inside another polygon, return true.
    points2.forEach((point) => {
        if (isPointInPolygon(points1, point[0], point[1])) {
            isIn = true;
            return false;
        }
    });
    if (isIn) {
        return true;
    }
}
```

## Lectura adicional {#extended-reading}

-   [¿Cómo determino si dos polígonos convexos se intersecan?]

[Lección 14 - Modo de selección]: /es/guide/lesson-014#select-mode
[Lección 21 - Transformer]: /es/guide/lesson-021
[Lección 21 - Transformar formas]: /es/guide/lesson-021#transform-shape
[Seleccionar capas y objetos en Figma]: https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
[Hacer selecciones con la herramienta Marco rectangular]: https://helpx.adobe.com/photoshop/using/tool-techniques/rectangular-marquee-tool.html
[Lección 8 - Usar indexación espacial para acelerar]: /es/guide/lesson-008#using-spatial-indexing
[lasso-tool-figma]: https://github.com/kernel-picnic/lasso-tool-figma
[Solicitud de función: selección con lazo (selección libre) en Excalidraw]: https://github.com/excalidraw/excalidraw/issues/6350
[Lección 25 - Herramienta lápiz]: /es/guide/lesson-025#pencil-tool
[¿Cómo determino si dos polígonos convexos se intersecan?]: https://stackoverflow.com/questions/753140/how-do-i-determine-if-two-convex-polygons-intersect
[Bloquear y desbloquear capas]: https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers
