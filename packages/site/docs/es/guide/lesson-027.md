---
outline: deep
description: 'Ajuste y alineación'
head:
    - ['meta', { property: 'og:title', content: 'Lección 27 - Ajuste y alineación' }]
---

<script setup>
import SnapToPixelGrid from '../../components/SnapToPixelGrid.vue'
import SnapToObjects from '../../components/SnapToObjects.vue'
</script>

# Lección 27 - Ajuste y alineación {#lesson-27-snap-and-align}

El ajuste es una función habitual en las aplicaciones de edición gráfica. La idea central es alinear de forma automática los límites de los elementos o los puntos de anclaje con las líneas más cercanas de la cuadrícula de píxeles, o con otros gráficos, al mover, dibujar o escalar elementos. En esta lección presentaremos su implementación.

## Ajuste a la cuadrícula de píxeles {#snap-to-pixel-grid}

En [Lección 5 - Dibujar cuadrículas] presentamos cómo dibujar con eficiencia cuadrículas de líneas rectas. En algunas interacciones de arrastre, como mover y dibujar, ajustarse a la unidad mínima de la cuadrícula garantiza que la posición o la información geométrica de los gráficos sean enteros. En Figma esta función se llama «Snap to pixel grid» y se puede activar en «User Preferences».

![Ajuste a la cuadrícula de píxeles](https://user-images.githubusercontent.com/490574/85198268-4ff5f300-b322-11ea-897e-602ef5936995.gif)

Fuente: [Ajuste a la cuadrícula en Excalidraw].

```ts
export interface AppState {
    snapToPixelGridEnabled: boolean; // [!code ++]
    snapToPixelGridSize: number; // [!code ++]
}
```

Para implementar esta función, primero hay que calcular las coordenadas de los puntos en el sistema de coordenadas del mundo. Cuando alguien arrastra, escala o dibuja gráficos, obtenemos las coordenadas actuales (como x, y) y después redondeamos esas coordenadas al entero más cercano (punto de píxel) o al espaciado de cuadrícula indicado:

```ts
// Snap to custom grid (e.g. 10px)
function snapToGrid(value, gridSize = 10) {
    return Math.round(value / gridSize) * gridSize;
}
```

Después aplica esta función de procesamiento en todos los Systems que necesiten calcular coordenadas de puntos en el sistema de coordenadas del mundo (como Select y DrawRect):

```ts
let { x: sx, y: sy } = api.viewport2Canvas({
    x: prevX,
    y: prevY,
});
let { x: ex, y: ey } = api.viewport2Canvas({
    x,
    y,
});
const { snapToPixelGridEnabled, snapToPixelGridSize } = api.getAppState(); // [!code ++]
// [!code ++]
if (snapToPixelGridEnabled) {
    // [!code ++]
    sx = snapToGrid(sx, snapToPixelGridSize);
    // [!code ++]
    sy = snapToGrid(sy, snapToPixelGridSize);
    // [!code ++]
    ex = snapToGrid(ex, snapToPixelGridSize);
    // [!code ++]
    ey = snapToGrid(ey, snapToPixelGridSize);
    // [!code ++]
}
```

En el ejemplo de abajo fijamos `snapToPixelGridSize` en 10. Puedes probar el efecto arrastrando, moviendo y dibujando:

<SnapToPixelGrid />

## Ajuste a nivel de objeto {#snap-to-objects}

La implementación de la función de ajuste en Excalidraw se divide en los pasos clave siguientes:

-   Comprobar si la operación actual permite el ajuste ([isSnappingEnabled]).
-   Calcular todos los puntos y huecos a los que se puede ajustar ([getPointSnaps]).
-   Cálculo en tiempo real de los desplazamientos de ajuste y de las líneas guía durante las operaciones de arrastre y de escala ([snapDraggedElements] / [snapResizingElements]).
-   Pasar snapLines a la capa de UI y renderizar las líneas guía en el lienzo ([renderSnaps]).

A continuación implementaremos esto siguiendo los pasos descritos arriba.

El ajuste a objetos funciona con independencia de la cuadrícula de píxeles. `snapToObjectsDistance` es un radio en píxeles CSS, así que el zoom no cambia la distancia de atracción percibida. Durante el movimiento, calcula el candidato a partir de la geometría del pointerdown y del desplazamiento bruto del puntero; aplica el ajuste solo a la posición mostrada. Si se introduce la posición ya ajustada en la muestra siguiente, el objeto seguiría siendo atraído hacia la guía.

El movimiento admite la alineación de los bordes y del centro de la caja delimitadora, y las guías de huecos iguales. Al redimensionar, el borde o la esquina que se mueve se ajusta a los bordes y a los centros de otros objetos, y se conservan el borde opuesto, las restricciones de relación de aspecto y el escalado centrado. En los objetos rotados, el manejador que se mueve se alinea en coordenadas del mundo. Las referencias excluyen los objetos ocultos o fuera de la pantalla, y los ancestros y descendientes de la selección. Estos son los comportamientos implementados; la distribución de huecos al redimensionar, la coincidencia de tamaños iguales y el ajuste durante el dibujo quedan como trabajo posterior, así que todavía no hay paridad completa con Figma.

### Si el ajuste está activado {#is-snapping-enabled}

Hemos añadido las opciones de configuración siguientes a los ajustes de la aplicación, que también se pueden activar en el «menú de preferencias»:

```ts
export interface AppState {
    snapToObjectsEnabled: boolean; // [!code ++]
}
```

Se dispara al mover o redimensionar las formas seleccionadas:

![fuente: https://github.com/excalidraw/excalidraw/issues/263#issuecomment-577605528](https://user-images.githubusercontent.com/5153846/72973602-d804ba80-3dcd-11ea-9717-05448160044c.gif)

### Obtener los ajustes de puntos {#get-point-snaps}

Los puntos de ajuste se dividen en dos categorías: formas seleccionadas y otras formas. Para una o varias formas seleccionadas, los puntos de ajuste habituales incluyen las cuatro esquinas y el centro de la caja delimitadora:

```ts
const { minX, minY, maxX, maxY } = api.getGeometryBounds(
    elements.map((id) => api.getNodeById(id)),
);
const boundsWidth = maxX - minX;
const boundsHeight = maxY - minY;
return [
    [minX, minY], // corners
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
    [minX + boundsWidth / 2, minY + boundsHeight / 2], // center
] as [number, number][];
```

Por rendimiento, debemos minimizar el número de veces que detectamos los puntos de anclaje de la forma seleccionada respecto a todas las demás formas. Ya tratamos problemas parecidos en [Lección 8 - Usar indexación espacial], donde solo recuperamos las formas que están dentro del viewport.

```ts
const unculledAndUnselected = api
    .getNodes()
    .map((node) => api.getEntity(node))
    .filter((entity) => !entity.has(Culled) && !entity.has(Selected));
```

Del mismo modo, calcula los puntos de referencia de estas formas:

```ts
const referenceSnapPoints: [number, number][] = unculledAndUnselected
    .map((entity) => getElementsCorners(api, [api.getNodeByEntity(entity).id]))
    .flat();
```

A continuación, compara uno a uno los puntos de ajuste de la forma seleccionada con los de las demás formas. Identifica el par de puntos más cercanos en horizontal o en vertical y registra la diferencia de distancia entre ellos como la distancia de ajuste posterior:

```ts
nearestSnapsX.push({
    type: 'point',
    points: [thisSnapPoint, otherSnapPoint],
    offset: offsetX,
});
minOffset[0] = Math.abs(offsetX);
```

Una vez calculados todos los puntos de ajuste, esta distancia mínima puede usarse como distancia de ajuste. Es importante señalar que, en esta fase, el gráfico todavía no se ha movido según la distancia de ajuste. Por tanto, hay que suponer que el gráfico ya se ha movido a su posición final y hacer otra ronda de cálculos:

```ts
// 1st round
getPointSnaps();
const snapOffset: [number, number] = [
    nearestSnapsX[0]?.offset ?? 0,
    nearestSnapsY[0]?.offset ?? 0,
];

// Clear the min offset
minOffset[0] = 0;
minOffset[1] = 0;
nearestSnapsX.length = 0;
nearestSnapsY.length = 0;
const newDragOffset: [number, number] = [
    round(dragOffset[0] + snapOffset[0]),
    round(dragOffset[1] + snapOffset[1]),
];

// 2nd round, a new offset must be considered.
getPointSnaps(newDragOffset);

// Render snap lines
```

### Obtener los ajustes de hueco {#get-gap-snaps}

Además de la forma seleccionada en el lienzo, otras formas pueden formar pares con huecos entre ellas. El diagrama del código de Excalidraw lo ilustra bien; tomemos `horizontalGap` como ejemplo:

```ts
// https://github.com/excalidraw/excalidraw/blob/f55ecb96cc8db9a2417d48cd8077833c3822d64e/packages/excalidraw/snapping.ts#L65C1-L81C3
export type Gap = {
    //  start side ↓     length
    // ┌───────────┐◄───────────────►
    // │           │-----------------┌───────────┐
    // │  start    │       ↑         │           │
    // │  element  │    overlap      │  end      │
    // │           │       ↓         │  element  │
    // └───────────┘-----------------│           │
    //                               └───────────┘
    //                               ↑ end side
    startBounds: Bounds;
    endBounds: Bounds;
    startSide: [GlobalPoint, GlobalPoint];
    endSide: [GlobalPoint, GlobalPoint];
    overlap: InclusiveRange;
    length: number;
};
```

Si la caja delimitadora de la forma seleccionada no se solapa con el hueco, omite la detección.

```ts
for (const gap of horizontalGaps) {
    if (!rangesOverlap([minY, maxY], gap.overlap)) {
        continue;
    }
}
```

Detecta en secuencia el punto central, el borde derecho y el borde izquierdo:

```ts
// center
if (gapIsLargerThanSelection && Math.abs(centerOffset) <= minOffset[0]) {
}
// side right
if (Math.abs(sideOffsetRight) <= minOffset[0]) {
}
// side left
if (Math.abs(sideOffsetLeft) <= minOffset[0]) {
}
```

Si se cumple la condición, regístralo. Durante el proceso, registra de forma continua la distancia mínima:

```ts
const snap: GapSnap = {
    type: 'gap',
    direction: 'center_horizontal',
    gap,
    offset: centerOffset,
};
nearestSnapsX.push(snap);
```

### Renderizar las líneas de ajuste {#render-snap-lines}

Renderiza las líneas de ajuste en el contenedor SVG; consulta: [Lección 26 - Selección con lazo].

Los puntos de ajuste suelen representarse con una «cruz», y las líneas que conectan estos puntos se pueden renderizar con `<line>`.

```ts
renderSnapLines(
    api: API,
    snapLines: { type: string; points: [number, number][] }[],
) {
    const { svgSVGElement } = this.selections.get(api.getCamera().__id);
    this.clearSnapLines(api);

    snapLines.forEach(({ type, points }) => {
        if (type === 'points') {
            const pointsInViewport = points.map((p) =>
                api.canvas2Viewport({ x: p[0], y: p[1] }),
            );
            const line = createSVGElement('polyline') as SVGPolylineElement;
            svgSVGElement.appendChild(line);
        }
    });
}
```

En cuanto a la visualización de las líneas de ajuste de hueco, la documentación de Excalidraw es muy ilustrativa. A partir de ella, podemos añadir etiquetas de texto que indiquen la distancia debajo de las líneas auxiliares (dirección horizontal) o a su derecha (dirección vertical), de forma parecida a como lo hace Figma:

```ts
// a horizontal gap snap line
// |–––––––||–––––––|
// ^    ^   ^       ^
// \    \   \       \
// (1)  (2) (3)     (4)
```

![Mostrar las líneas de ajuste de hueco y las etiquetas de distancia](/snap-to-objects.gif)

Mueve o redimensiona el rectángulo central de abajo. Usa los controles independientes para comparar el ajuste a objetos y el ajuste a la cuadrícula de píxeles:

<SnapToObjects />

## Lectura adicional {#extended-reading}

-   [¿Cómo ajustar las posiciones de las formas al arrastrar con Konva?]
-   [Ajuste personalizado en tldraw]

[Lección 5 - Dibujar cuadrículas]: /es/guide/lesson-005
[¿Cómo ajustar las posiciones de las formas al arrastrar con Konva?]: https://konvajs.org/docs/sandbox/Objects_Snapping.html
[Ajuste a la cuadrícula en Excalidraw]: https://github.com/excalidraw/excalidraw/issues/521
[Ajuste personalizado en tldraw]: https://tldraw.dev/examples/bounds-snapping-shape
[isSnappingEnabled]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L162C14-L162C31
[getPointSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L636
[snapDraggedElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L692
[snapResizingElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L1108C14-L1108C34
[renderSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/renderer/renderSnaps.ts
[Lección 8 - Usar indexación espacial]: /es/guide/lesson-008#using-spatial-indexing
[Lección 26 - Selección con lazo]: /es/guide/lesson-026#lasso-selection
