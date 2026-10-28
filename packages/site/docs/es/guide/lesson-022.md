---
outline: deep
description: 'Explora VectorNetwork como alternativa avanzada a los trazados SVG. Aprende las definiciones topológicas, los vértices y las aristas compartidos, los algoritmos de relleno y los operadores topológicos para editar gráficos vectoriales complejos.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 22 - VectorNetwork' }]
---

<script setup>
import VectorNetwork from '../../components/VectorNetwork.vue';
import VectorNetworkCube from '../../components/VectorNetworkCube.vue';
import VectorNetworkFaceCut from '../../components/VectorNetworkFaceCut.vue';
</script>

# Lección 22 - VectorNetwork {#lesson-22-vectornetwork}

En esta lección aprenderás lo siguiente:

-   Limitaciones del trazado SVG
-   ¿Qué es VectorNetwork?
-   Usar la herramienta Pluma para modificar un Path
-   Hacer doble clic para entrar en el modo de edición vectorial y las herramientas Mover / Curvar / Cortar / Rellenar
-   Operadores topológicos: dividir un segmento, eliminar un vértice y Cortar para abrir un bucle cerrado

## Limitaciones del trazado SVG {#limitations-of-svg-path}

En [Lección 13 - Dibujar trazados y estilo de boceto] vimos cómo dibujar trazados. Figma también ofrece la [VectorPath API], que admite un subconjunto de los comandos de trazado SVG (consulta [VectorPath-data]) y [fillRule] (llamada windingRule en Figma).

```ts
node.vectorPaths = [
    {
        windingRule: 'EVENODD',
        data: 'M 0 100 L 100 100 L 50 0 Z',
    },
];
```

Entonces, ¿por qué introducir la [VectorNetwork API]? La razón es que el trazado SVG tiene algunas limitaciones inherentes. El artículo [La ingeniería detrás de las redes vectoriales de Figma] lo muestra de forma muy clara. La forma siguiente no se puede describir con un solo Path:

![Trazados no válidos](https://alexharri.com/images/posts/vector-networks/3.svg)

Solo se puede describir dividiéndola en varios Path. Aunque eso es posible, ciertas operaciones intuitivas no se pueden conseguir en los escenarios de edición. Por ejemplo, al arrastrar el vértice central de la parte inferior izquierda, solo un vértice lo sigue, porque está formada por dos Path independientes:

![Se usan varios trazados para crear formas más complejas](https://alexharri.com/images/posts/vector-networks/4.svg)

Además de que los vértices no pueden tener más de 2 aristas, las aristas tampoco se pueden compartir. El artículo original y la presentación de [Complejos de gráficos vectoriales] comparan SVG y los mapas planos, y ninguno de los dos puede admitir el solapamiento, los vértices compartidos y las aristas, lo que lleva a una representación geométrica nueva (en adelante, VGC):

![Comparación entre SVG y los mapas planos](/svg-path-vector-network-comparison.jpeg)

[vpaint] está implementado sobre VGC. Se puede ver lo naturales que resultan los efectos interactivos durante la edición después de fusionar puntos y aristas:

![vpaint](https://camo.githubusercontent.com/42f888c041ecc6799e9fe2bd3c895fcd8037417188a0d1db840e0ce0701a5201/68747470733a2f2f7777772e7667632e696f2f696d616765732f676c75652d30312d332d32346670732e676966)

O usando el ejemplo de arrastrar una arista de un cubo de [La ingeniería detrás de las redes vectoriales de Figma]:

![Arrastrar una arista de un cubo](https://alexharri.com/images/posts/vector-networks/31.svg)

Haz doble clic para entrar en el modo de edición y, después, arrastra cualquier arista del cubo:

<VectorNetworkCube />

Cabe mencionar que el [Debate en HN] señala el parecido notable entre VGC y el VectorNetwork de Figma. Teniendo en cuenta que ambos empezaron a explorarlo más o menos al mismo tiempo, llegaron a soluciones parecidas por caminos distintos; por eso, en el texto siguiente usaremos el término VectorNetwork.

> Aquí el CEO de Figma. La mayoría de las ideas originales sobre las redes vectoriales surgieron en 2013, aunque seguimos puliendo la implementación con el tiempo. No salimos del modo oculto ni publicamos la beta cerrada de Figma hasta diciembre de 2015, y por eso no hay contenido de blog anterior a esa fecha.
> A primera vista, esta tesis parece excelente. Me entusiasma revisarla. No creo haberla visto antes, lo que sorprende dado el solapamiento.

Veamos cómo se define VectorNetwork.

## Definición topológica de VectorNetwork {#topology-of-vector-network}

La definición de VectorNetwork/VGC es mucho más compleja que la de Path. Su estructura de datos es un grafo formado por vértices, aristas y caras (regiones rellenas). La imagen siguiente procede del artículo original [Complejos de gráficos vectoriales].

![Topología de VGC](/vgc-topology.png)

Aquí solo tratamos la definición topológica. Los demás atributos de dibujo pueden seguir siendo coherentes con Path:

> Sobre esta estructura central se pueden añadir más atributos de dibujo para un control fino del renderizado. Por ejemplo, añadimos el radio del vértice, el ancho variable de la arista, el color de la celda (posiblemente transparente) y el estilo de las uniones de aristas (unión en inglete o en bisel).

Los vértices son fáciles de entender. En VGC, las aristas constan de un par de índices de vértice `start` y `end`, y forman un bucle propio cuando coinciden.

![Nodos y aristas en VGC](/vgc-node-edge.png)

Las regiones rellenas se definen mediante bucles cerrados de vértices. En VGC se definen con un conjunto de semiaristas:

![Caras en VGC](/vgc-face.png)

El ejemplo del triángulo siguiente procede de la [VectorNetwork API]. Se ve que es básicamente coherente con VGC, salvo que las regiones rellenas se definen mediante índices de vértice y fillRule. Otros atributos no geométricos, como `strokeCap`, siguen siendo coherentes con Path:

```ts
node.vectorNetwork = {
    // The vertices of the triangle
    vertices: [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        { x: 50, y: 0 },
    ],

    // The edges of the triangle. 'start' and 'end' refer to indices in the vertices array.
    segments: [
        {
            start: 0,
            tangentStart: { x: 0, y: 0 }, // optional
            end: 1,
            tangentEnd: { x: 0, y: 0 }, // optional
        },
        {
            start: 1,
            end: 2,
        },
        {
            start: 2,
            end: 0,
        },
    ],

    // The loop that forms the triangle. Each loop is a
    // sequence of indices into the segments array.
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }],
};
```

Siguiendo la convención de Figma para las cúbicas: *P*₀ es el ancla inicial, *P*₃ el ancla final, *P*₁ = *P*₀ + `tangentStart`, *P*₂ = *P*₃ + `tangentEnd`. Cuando ambos controles coinciden con sus anclas (línea recta), usa dos puntos; si no, muestrea con `CubicBezierCurve.getPoints`, eligiendo un número de segmentos a partir de la longitud de cuerda y de la envolvente de control (aproximadamente de 8 a 64).

En los escenarios de edición, los vértices y las aristas los define el usuario, mientras que las regiones rellenas las tiene que calcular de forma automática el sistema. Entonces, ¿cómo encontramos esas regiones rellenas?

### Rellenado {#filling}

En operaciones como `click to fill` hay que encontrar el bucle mínimo formado por los vértices.

![Fuente: https://www.figma.com/blog/introducing-vector-networks/](https://alexharri.com/images/posts/vector-networks/40.gif)

Tratamos el VectorNetwork como un grafo plano y dividimos cada segmento en dos semiaristas dirigidas. En cada vértice ordenamos las aristas salientes por ángulo polar; recorrer la «semiarista siguiente» (la arista saliente más en el sentido de las agujas del reloj respecto de la arista inversa entrante) enumera cada cara mínima. La cara más pequeña que encierra la posición del clic es la región objetivo, y escribir su bucle ordenado de índices de segmento en `VectorRegion.loops` reutiliza la teselación de relleno de arriba.

```ts
export function findRegionLoopAtPoint(
    vertices: VectorVertexLike[],
    segments: VectorSegmentLike[],
    point: [number, number],
): number[] | null;
```

> Robustez numérica: las aristas colineales, los vértices coincidentes y los bucles propios necesitan una tolerancia EPS y un tratamiento de los casos degenerados; la cara exterior no acotada tiene un área con signo positivo en este recorrido y hay que omitirla.

### Convertir a VectorNetwork {#convert-to-vector-network}

Siguiendo [figma-fill-rule-editor], usamos estas definiciones de tipo:

```ts
export class VectorNetwork {
    @field.object declare vertices: VectorVertex[];
    @field.object declare segments: VectorSegment[];
    @field.object declare regions?: VectorRegion[];
}

interface VectorVertex {
    x: number;
    y: number;
    strokeLinecap?: Stroke['linecap'];
    strokeLinejoin?: Stroke['linejoin'];
    cornerRadius?: number;
    handleMirroring?: HandleMirroring;
}

interface VectorSegment {
    start: number;
    end: number;
    tangentStart?: VectorVertex;
    tangentEnd?: VectorVertex;
}

interface VectorRegion {
    fillRule: CanvasFillRule;
    loops: ReadonlyArray<ReadonlyArray<number>>;
}
```

[Polyline] es la geometría más fácil de convertir en un VectorNetwork:

```ts
class VectorNetwork {
    static fromEntity(entity: Entity): VectorNetwork {
        if (entity.has(Polyline)) {
            const { points } = entity.read(Polyline);
            const vertices: VectorVertex[] = points.map(([x, y]) => ({ x, y }));
            const segments: VectorSegment[] = points.slice(1).map((_, i) => ({
                start: i,
                end: i + 1,
            }));

            return { vertices, segments };
        }
    }
}
```

Convertir un [Path] es más laborioso: después de normalizar los comandos del trazado SVG (`path2Absolute`), cada comando se analiza por turno. `M/L/H/V` emiten segmentos rectos; `C/S/Q/T` emiten cúbicas (`Q/T` se elevan primero a cúbica), convirtiendo los puntos de control absolutos en tangentes relativas al estilo de Figma, `tangentStart = P1 - P0` y `tangentEnd = P2 - P3`; `S/T` siguen el punto de control anterior para el reflejo; en `Z`, si el último punto coincide con el inicio, se reutiliza el vértice inicial para evitar duplicados, y un subtrazado cerrado emite un bucle de región. Esto vive en la función pura `pathToVectorNetwork(d, fillRule)`, a la que `fromEntity` llama cuando `entity.has(Path)`.

## Teselación {#tessellatation}

### Trazo {#stroke}

Convertimos el grafo en polilíneas y las renderizamos con el enfoque de [Lección 12 - Dibujar una polilínea].

-   Mantén la adyacencia de cada vértice.
-   Recorre las aristas no usadas: extiende hacia delante y hacia atrás desde una arista inicial, y continúa solo cuando el vértice actual tiene exactamente una arista no usada, de modo que las uniones de grado 2 se convierten en una polilínea (unión en lugar de extremo).
-   Detente en las ramificaciones (grado ≥ 3); separa los subtrazados con `NaN`.

Para cada arista recorrida:

-   Usa la cúbica de Figma: *P*₀ y *P*₃ son anclas, *P*₁ = *P*₀ + `tangentStart`, *P*₂ = *P*₃ + `tangentEnd`.
-   Las aristas rectas (controles en las anclas) usan dos puntos.
-   En los demás casos usa `CubicBezierCurve.getPoints` con un número de segmentos derivado de la longitud de cuerda y de la envolvente de control.

```ts
function tessellateVectorSegment(
    vertices: VectorVertexLike[],
    seg: VectorSegmentLike,
): number[] {
    const a = vertices[seg.start];
    const b = vertices[seg.end];
    const p0 = vec2.fromValues(a.x, a.y);
    const p3 = vec2.fromValues(b.x, b.y);

    const ts = seg.tangentStart;
    const te = seg.tangentEnd;
    const p1 = vec2.create();
    const p2 = vec2.create();
    vec2.add(p1, p0, vec2.fromValues(ts?.x ?? 0, ts?.y ?? 0));
    vec2.add(p2, p3, vec2.fromValues(te?.x ?? 0, te?.y ?? 0));
}
```

<VectorNetwork />

### Relleno {#fill}

Recorre cada entrada `loops` de Figma (índices de segmento ordenados), tesela cada arista —incluidas las cúbicas— con el mismo `tessellateVectorSegment`, únelas en el orden de recorrido, descarta los puntos duplicados y cierra el anillo.

-   Para cada región y cada bucle, construye un contorno cerrado.
-   **nonzero** (o `windingRule: 'NONZERO'` de Figma): usa `triangulate` (libtess) con winding nonzero en todos los contornos, admitiendo islas desconectadas y huecos anidados con independencia del orden de los contornos.
-   **evenodd** (o `EVENODD`): `triangulate` (libtess).
-   Las regiones múltiples se triangulan en secuencia; los vértices y los índices se concatenan en una sola malla con un desplazamiento de vértices acumulado.

### Hacer clic para rellenar una región {#click-to-fill}

Haz doble clic en un VectorNetwork y elige **Rellenar**. Al pasar el cursor se previsualiza la cara cerrada más pequeña; un clic la rellena y otro clic la vacía. Cada clic es un paso de deshacer. Los arrastres, los punteros cancelados y el zoom multitáctil no confirman un relleno. Cambiar de herramienta, pulsar Esc, hacer clic en el lienzo vacío fuera de la forma o destruir el lienzo borra la previsualización.

Prueba el cubo de abajo, que empieza en el modo **Rellenar**. Pasa el cursor sobre su cara frontal, superior o derecha para previsualizarla y después haz clic para rellenarla. Rellena dos caras vecinas y vuelve a hacer clic en una de ellas: solo se vacía esa cara. Usa los botones **Deshacer / Rehacer** del lienzo para recorrer tus cambios.

<VectorNetworkCube fill />

En el modo **Rellenar**, haz clic en la muestra de color junto a los botones de herramienta para abrir el selector de color. Elige un color o introduce un valor de color antes de hacer clic en una cara. Cambiar el color también actualiza todas las caras ya rellenas de esta red; los cambios de color se pueden deshacer. Por ahora las caras comparten un único estilo de relleno.

`findVectorNetworkFaces` recorre semiaristas dirigidas y adjunta como huecos los límites exteriores de los componentes desconectados que quedan encerrados. Las previsualizaciones y las regiones recién creadas usan `evenodd`, así que los huecos no dependen de la dirección de almacenamiento de las aristas. Los rellenos `nonzero` / `evenodd` existentes se resuelven en caras mínimas según su cobertura; vaciar una cara conserva los rellenos vecinos.

Las caras comparten los `fills` del nodo. El primer relleno de una red que solo tiene trazo usa el relleno visible configurado en la pluma y, si no hay, el azul. Las previsualizaciones viven en una superposición SVG transitoria y nunca entran en el documento, las exportaciones ni el historial. El picking usa coordenadas locales y admite rotación, reflejo y escalado.

El relleno divide los cruces en vértices compartidos dentro de una geometría temporal antes de encontrar las caras. Pasar el cursor no cambia el documento: el primer clic de relleno confirma a la vez la topología y la pintura, y un deshacer restaura ambas. La pintura independiente por cara sigue siendo una extensión aparte.

## Dibujar con la pluma {#drawing-with-pen}

Elige la pluma de **Vector Network**. Haz clic para colocar anclas de esquina; arrastra para colocar anclas suaves. La primera ancla sigue siendo una previsualización transitoria hasta que se confirma la primera arista, así que abandonar un único punto no crea un nodo de documento vacío.

Un arrastre define el control saliente del ancla nueva. Su control entrante es el vector opuesto, y el vector saliente se convierte en el `tangentStart` de la arista siguiente. Tanto la previsualización elástica como la geometría confirmada usan estos mismos controles cúbicos, incluido un arrastre sobre la primera ancla. La previsualización también muestra la línea del control.

Haz clic en un ancla existente a menos de 10 píxeles del viewport para cerrar la red y volver a Select. El ajuste usa la posición de la pulsación, así que arrastrar el control de cierre hacia fuera no crea un vértice extra. Las caras cerradas se detectan de forma automática y se renderizan con el relleno configurado en la pluma; el estilo predeterminado de solo trazo permanece sin relleno hasta que se usa **Rellenar**. Haz clic en el ancla activa, o pulsa **Enter / Esc**, para terminar un trazado abierto. Un arrastre no terminado se descarta.

Cada arista confirmada es un paso de deshacer. Cancelar el puntero, salir del lienzo y cambiar de herramienta descartan el gesto pendiente; las aristas confirmadas permanecen. Deshacer, o una edición externa de la geometría, borra el punto de continuación, así que el trazo siguiente no puede unirse a un vértice obsoleto. Las previsualizaciones pertenecen a la superposición SVG de su lienzo y quedan excluidas de los nodos guardados, del historial y de las exportaciones; destruir el lienzo las elimina.

### Continuar una red existente {#resume-with-pen}

Selecciona un VectorNetwork y cambia a la pluma. Pasa el cursor cerca de un vértice existente para ver su indicador de ajuste, haz clic en él para empezar y después haz clic o arrastra el ancla siguiente para añadir una arista a la misma red. Esto prolonga los extremos y crea ramificaciones en los vértices compartidos. Elegir la primera ancla no cambia el documento; cada arista confirmada es un paso de deshacer. Empezar lejos de un vértice crea una red aparte.

La continuación admite rotación, escalado no uniforme y reflejo, y usa los mismos controles cúbicos para la previsualización y la confirmación. Se conservan los controles de las aristas existentes, los rellenos y los huecos; usa Rellenar para pintar las caras recién encerradas. Conectar con un vértice existente termina el trazo, y volver a trazar una arista idéntica no crea un duplicado. Los nodos bloqueados, ocultos o no invertibles no se pueden continuar. La cancelación, el cambio de herramienta o deshacer durante el dibujo descartan la arista pendiente y conservan las ediciones completadas.

## Curvar {#bending}

En **Curvar**, arrastra directamente un punto interior de una arista. Sus anclas permanecen fijas mientras el punto de la curva que has agarrado sigue al puntero. Las aristas rectas se convierten en Bézier cúbicas. Cada actualización parte de la instantánea del momento en que se pulsa el puntero, lo que evita un desplazamiento acumulado de los controles. El picking usa coordenadas de pantalla, incluida la rotación, el reflejo y el escalado no uniforme.

En el parámetro `t`, los dos pesos de control son `a = 3(1-t)²t` y `b = 3(1-t)t²`. Para un desplazamiento del puntero `Δ`, los controles se mueven `aΔ/(a²+b²)` y `bΔ/(a²+b²)`. Esto minimiza el desplazamiento cuadrático de los controles y mantiene el punto agarrado bajo el puntero. Curvar la arista de forma directa suelta el acoplamiento de controles en sus extremos; las demás aristas conservan sus controles. Cerca de los extremos, las interacciones de ancla y de control tienen prioridad.

Haz doble clic en una red vectorial, elige **Curvar** y después selecciona un ancla para mostrar sus controles. En las anclas con exactamente dos extremos de arista incidentes, el **Acoplamiento de controles** ofrece tres modos:

-   **Independiente**: mueve uno de los controles sin cambiar el otro.
-   **Alinear ángulos**: mantén los controles en rayos opuestos y conserva la longitud del otro control.
-   **Reflejar ángulo y longitud**: mantén los controles opuestos y de la misma longitud.

Cambiar de modo alinea la pareja de inmediato, usando como referencia el primer control distinto de cero. Mantén pulsado **Alt** mientras arrastras para romper el acoplamiento; el ancla permanece independiente a partir de entonces. Los vértices de ramificación con tres o más extremos de arista incidentes conservan controles independientes. Un bucle propio aporta dos extremos. Un control colapsado no tiene dirección, así que el acoplamiento solo de ángulo conserva el otro control hasta que el control arrastrado vuelve a tener una dirección.

Las aristas rectas muestran posiciones temporales de control que apuntan hacia el otro extremo; arrastrar uno crea su control de Bézier. Estas guías no cambian la geometría guardada hasta que se arrastran. Cada arrastre completado o cada cambio de acoplamiento es un paso de deshacer. **Esc**, la cancelación del puntero, salir del lienzo o cambiar de herramienta cancela un arrastre pendiente y restaura su geometría original. Cambiar los límites de la curva conserva las posiciones de las anclas bajo rotación, reflejo y escalado.

Lo siguiente procede de [Presentación de las redes vectoriales - Curvar]. En la edición de curvas de Bézier es habitual tanto en Path como en VectorNetwork:

> Los gráficos vectoriales de hoy se basan en splines de Bézier cúbicas, que son curvas con dos puntos extra, llamados controles, situados fuera de la propia curva y que controlan cuánto se curva, un poco como un imán podría doblar un alambre hacia él. Cambiar la forma de una curva consiste en arrastrar un control por el espacio, en lugar de arrastrar la curva directamente.

![Puntos de control en la arista](https://alexharri.com/images/posts/vector-networks/39.svg)

En la definición de arista de VectorNetwork, `tangentStart` y `tangentEnd` pueden definir los dos puntos de control de una curva de Bézier cúbica. Cuando ambos son `[0, 0]`, degenera en una línea recta.

También puedes probar el ejemplo de Konva [¿Cómo modificar los puntos de una línea con anclas?] o [bezierjs].

El modo de edición con doble clic, la barra de herramientas Mover / Curvar / Cortar / Rellenar y la inserción en el punto medio se tratan abajo, en [Entrar en el modo de edición y la barra de herramientas](#vector-edit-mode).

![Modo de edición vectorial en Figma](/figma-vectornetwork-mode.png)

```ts
export enum Pen {
    SELECT = 'select',
    HAND = 'hand',
    VECTOR_NETWORK = 'vector-network', // [!code ++]
}
```

A diferencia del enfoque basado en OBB de [Lección 21 - Transformer]:

-   En el modo de edición, arrastrar un `VectorSegment` mueve ambos extremos; las aristas adyacentes que comparten esos vértices los siguen de forma natural.
-   Arrastrar un `VectorVertex` mueve solo ese vértice; cada segmento que lo comparte lo sigue de forma automática: esta es la ventaja central de una Vector Network frente a un Path. Las coordenadas nuevas se escriben de vuelta a través de un único punto de entrada, `API.updateNodeVectorNetwork(node, vectorNetwork)`, que actualiza el componente `VectorNetwork` de la entidad y dispara una nueva teselación más el historial (deshacer/rehacer).

```ts
// packages/ecs/src/systems/Select.ts
// In handleControlPointMoving, for a vector-network node:
// 1. Read the VectorNetwork component and map the pointer back to local
//    space via the inverse of GlobalTransform.
// 2. Update vertices[activeIndex].x/y.
// 3. Call api.updateNodeVectorNetwork to write back.
```

Al escribir de vuelta, `VectorNetwork.getGeometryBounds` vuelve a calcular los límites de la geometría y desplaza todos los vértices en `-minX/-minY`, normalizando la esquina superior izquierda a `(0, 0)` local. Antes de añadir el desplazamiento de compensación a `node.x/y`, aplica la escala y la rotación del nodo para expresar el desplazamiento en el sistema de coordenadas del padre. Por tanto, el reajuste conserva las posiciones de las anclas en el espacio mundial. Las tangentes son relativas a sus anclas y no necesitan traslación.

### Entrar en el modo de edición y la barra de herramientas {#vector-edit-mode}

Siguiendo [Editar capas vectoriales] de Figma, haz doble clic en un nodo `vector-network` para entrar en el modo de edición de vértices: pon `Editable.isEditing = true` en la entidad y muestra una barra de herramientas **Mover / Curvar / Cortar / Rellenar** centrada en la parte inferior (`VectorNetworkEditMode`; consulta `context-vector-network-edit-bar.ts`). Salir de la edición (botón de cerrar de la barra, Esc o clic en el lienzo vacío) escribe `isEditing: false`; `RenderTransformer` oculta todas las anclas de edición (vértices, puntos medios de segmento y controles de tangente).

| Modo         | Interacción                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Mover**    | Arrastra vértices; pasa el cursor sobre un segmento para mostrar su punto medio y haz clic para insertar un vértice nuevo               |
| **Curvar**   | Arrastra una arista para curvarla directamente, o edita sus controles con tres modos de acoplamiento                                     |
| **Cortar**   | La misma inserción en el punto medio que Mover; **haz clic en un vértice** para romper la topología en el punto de corte y pasar automáticamente a Mover para separarlos arrastrando |
| **Rellenar** | Pasa el cursor para previsualizar una cara cerrada; haz clic para alternar su relleno conservando los huecos y las caras vecinas        |

El **resaltado al pasar el cursor** y la **selección** son independientes en las anclas: `Transformable.hoveredControlPointIndex` se borra cuando el puntero sale; `selectedControlPointIndex` persiste después de un clic hasta que haces clic en el espacio vacío o dentro de la forma.

### Mover: insertar un vértice en el punto medio del segmento {#insert-at-midpoint}

Al pasar el cursor sobre un segmento, se renderiza un ancla de punto medio en el punto medio de la curva (`t = 0.5`; en las aristas cúbicas, el punto sobre la curva). Un clic llama a `splitSegmentAt` (consulta [Creación y eliminación](#creation--delete)) para dividir la arista y escribir de vuelta la red. Consulta `Select.insertControlPointFromMidpoint` y `RenderTransformer.findHoveredVectorNetworkSegmentIndex` (distancia de la curva de viewport a local).

Mover arrastra un solo vértice o una arista entera, moviendo ambos extremos y conservando las tangentes. Los nodos rotados, escalados y reflejados usan el sistema de coordenadas capturado al pulsar, lo que evita la deriva cuando cambian los límites. Un vértice se ajusta cerca de otro vértice y se fusiona al soltar. Esc, la cancelación del puntero o el cambio de herramienta restauran el gesto completo, incluido un punto medio recién insertado. Cortar se confirma al hacer clic y permanece desconectado al soltar. Eliminar actúa sobre el vértice seleccionado incluso después de que el puntero se haya alejado.

Los cambios de geometría durante un arrastre permanecen sin confirmar. Deshacer y rehacer restauran primero la geometría inicial del gesto y después aplican el historial, manteniendo los límites y los vértices de la misma edición. Si una actualización externa ha sustituido la geometría o las transformaciones, el gesto antiguo se descarta: un movimiento posterior, soltar o Escape no pueden restaurar su instantánea obsoleta. Los cambios que solo afectan al estilo no interrumpen el arrastre, y cancelar la geometría conserva la pintura nueva. Eliminar durante un arrastre cancela primero el movimiento no terminado y después elimina el vértice original seleccionado; en un punto medio recién insertado, solo cancela esa inserción.

## Operadores topológicos {#topological-operators}

### División automática de intersecciones {#automatic-intersections}

Confirmar una arista de la pluma, o terminar un arrastre de Mover o Curvar, conecta los cruces transversales y las uniones en T dentro de esa red. Esto admite líneas, Bézier cúbicas, varios cruces y la autointersección de una cúbica. La subdivisión de De Casteljau conserva la forma de la curva; los recorridos de región y de hueco se reescriben en el orden de recorrido. Los índices de vértice existentes se mantienen estables, así que la continuación de la pluma sigue empezando en el extremo en el que se hizo clic.

La topología no cambia durante un arrastre. La división se confirma con la edición de la forma al soltar; la cancelación no deja uniones, y deshacer/rehacer cubre toda la operación. Llama a `splitVectorNetworkIntersections(network)` para normalizar de forma explícita la geometría importada. La detección usa subdivisión adaptativa y refinamiento numérico; no se admiten los contactos tangentes, la fusión booleana de tramos solapados ni las conexiones entre nodos separados. Los contactos solo de extremo siguen separados para conservar los resultados de Cortar.

Figma admite [Operaciones booleanas], por ejemplo la unión.

![fuente: https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations](https://help.figma.com/hc/article_attachments/30101990451607)

Paper.js puede ser una referencia útil para las implementaciones.

### Creación y eliminación {#creation--delete}

[Eliminar y reparar en las redes vectoriales]

Añadir un vértice: divide un segmento en el parámetro `t` en dos segmentos e inserta el vértice nuevo (las aristas cúbicas se subdividen con De Casteljau para conservar la curva), en lugar de un empalme simple en un array de puntos:

```ts
export function splitSegmentAt(
    network: VectorNetworkData,
    segIdx: number,
    t: number,
): number; // Mutates network and returns the new vertex index.
```

Eliminar un vértice: después de quitar el vértice y sus aristas incidentes, un vecino de grado 2 se «repara» fusionando sus dos aristas en una, de modo que el trazado sigue conectado (igual que Eliminar y reparar de Figma). Se activa con **Delete / Backspace** en el modo de edición:

```ts
export function deleteVertex(
    network: VectorNetworkData,
    vertexIdx: number,
): VectorNetworkData;
```

> Eliminar, romper y fusionar devuelven una red nueva; `splitSegmentAt` muta la copia de red que se le pasa y devuelve el índice del vértice insertado. Los operadores de `packages/ecs/src/utils/vector-network-topology.ts` están desacoplados del renderizado y se pueden probar por separado; el sistema de edición devuelve su resultado a través de `API.updateNodeVectorNetwork`.

En las curvas, Reparar intenta primero recuperar una cúbica subdividida original. Si no, ajusta una cúbica con una cota de error comprobada, de forma predeterminada el 5 % de la extensión de la caja delimitadora de los puntos de control; `maxError` fija una tolerancia en unidades locales. Si no se puede cumplir la tolerancia, se conserva la red original. **Shift + Delete / Backspace** quita el vértice y las aristas incidentes sin reparar. Dividir y editar reasignan los índices de límite en el orden de recorrido y conservan las regiones válidas.

### Unir y separar {#glue-unglue}

![Operador de unir y separar](/vgc-operator-glue-unglue.png)

En **Mover**, selecciona un vértice y después haz clic en **Unir / Separar** (el icono de la cadena). El panel etiqueta los vértices como **V1, V2, …** y las aristas incidentes como **E1, E2, …** en el lienzo.

-   **Unir**: elige un vértice de destino y confirma. El vértice seleccionado se mueve al destino y sus conexiones se combinan. Se conservan las curvas distintas y los bucles propios curvos; las aristas idénticas se fusionan.
-   **Separar**: marca los extremos de arista que quieres desprender y confirma. Se crea un vértice nuevo en la misma posición, conectado solo a esos extremos. Queda seleccionado para que puedas arrastrarlo de inmediato. Deja al menos un extremo unido al vértice original. El inicio y el final de un bucle propio se pueden elegir por separado.

Prueba a seleccionar la unión frontal superior derecha del cubo, abre **Unir / Separar** y desprende **E7 · Inicio**. Arrastra la copia seleccionada hacia fuera y después usa **Unir** con **V3** como destino para volver a unirla.

<VectorNetworkCube topology />

La previsualización no modifica el documento. Cancelar la cierra sin cambiar la geometría; una actualización externa de la geometría, deshacer o salir del modo de edición invalidan la operación pendiente. Cada operación confirmada es un paso de deshacer. Separar conserva la geometría de las curvas y las regiones que siguen cerradas; abrir un límite exterior o un hueco elimina toda la región de relleno afectada. Unir restaura la conectividad, pero no restaura de forma automática los rellenos eliminados: usa Rellenar otra vez, o Deshacer, para restaurar el estado anterior completo.

`glueVertices(network, source, target)` y `unglueVertex(network, vertex, endpoints)` devuelven un `VectorTopologyResult`: o un motivo de fallo, o la red nueva, los mapas de índices de vértice y de segmento y el índice del vértice seleccionado. Los extremos usan `{ segmentIndex, end: 'start' | 'end' }`; los índices de la API empiezan en cero. Las entradas no se mutan. Esta primera etapa opera sobre vértices dentro de una sola red; las operaciones de arista compartida y de cara se describen abajo.

#### Unir / separar una arista compartida {#shared-edge-glue-unglue}

En **Mover**, selecciona un extremo y abre **Unir / Separar**, y después pon **Destino de topología** en **Aristas**. Elige una **Arista de origen** para etiquetar sus regiones rellenas incidentes como **R1, R2, …**. Las regiones marcadas se resaltan. Los usos de límite se etiquetan como **R (región) · L (bucle) · posición dentro del bucle**, todos empezando en uno.

El cubo de abajo tiene tres caras rellenas. Selecciona el vértice frontal superior derecho **V3**, elige **Separar arista → E7**, marca **R2 · L1 · 4** (la cara superior) y confirma. La cara superior pasa a usar la copia **E10**, mientras que la cara derecha sigue usando **E7**. Separar entra en **Curvar** de forma automática: arrastra el centro de la diagonal para curvar solo la copia y el límite de la cara superior. Ambos extremos siguen compartidos. Para editar en su lugar el original solapado, vuelve a Mover, elige E7 en el panel de aristas y haz clic en **Curvar la arista seleccionada**.

<VectorNetworkCube edges />

Deshaz la curva para que las curvas vuelvan a coincidir, cambia otra vez a Mover y selecciona V3. En el panel de aristas, elige **Unir aristas** para fusionar **E10** en **E7**. Unir admite la dirección de almacenamiento invertida y suelda vértices extremos coincidentes con índices distintos. Solo se elimina la arista de origen solicitada; los duplicados no relacionados permanecen. Se rechazan las curvas o los puntos de control que no coinciden, los extremos incompatibles, dos aristas usadas en el mismo bucle de límite y las inversiones parciales de winding que podrían cambiar los rellenos nonzero.

Separar conserva la geometría de la curva, los extremos y todas las regiones, incluidos los huecos, y mueve a la copia solo los usos de límite seleccionados. Al menos un uso debe permanecer en el original. Las regiones almacenan por ahora límites rellenos: una arista necesita al menos dos usos de ese tipo, así que rellena primero las caras adyacentes si hace falta. Rellenar puede normalizar las regiones amplias importadas en caras separadas. Mientras las copias sigan solapadas, usa Curvar o Unir; Rellenar y Cortar / Descortar caras siguen suponiendo un embebido plano. Cada Unir / Separar es un paso de deshacer. La previsualización y **Curvar la arista seleccionada** no crean una entrada de historial.

La función pura `vectorEdgeUses(network, edge)` devuelve entradas `{ regionIndex, loopIndex, offset }`. `unglueVectorNetworkEdge(network, edge, uses)` y `glueVectorNetworkEdges(network, source, target)` devuelven `VectorEdgeTopologyResult`: la red nueva, los mapas de índices de vértice y de arista y la arista seleccionada, o un motivo de fallo. Los índices de la API empiezan en cero; las entradas no se mutan.

### Cortar y descortar {#cut-uncut}

![Operador de cortar y descortar](/vgc-operator-cut-uncut.png)

#### Dividir y fusionar caras {#split-and-merge-faces}

En **Mover**, selecciona un vértice y haz clic en **Cortar / Descortar caras** (el icono del trazado dividido). **Cortar cara** conecta vértices del límite de la misma cara con una costura recta, incluidas las conexiones hacia huecos o entre huecos. **Descortar arista** quita una arista compartida entre caras adyacentes o una costura que une componentes del límite. Las posiciones de los vértices y los puntos de control de curva existentes no cambian. Ambas operaciones admiten Deshacer / Rehacer en un paso.

Prueba la cara frontal rellena de abajo: selecciona su **vértice inferior izquierdo V1**, elige **Cortar cara → V3** y confirma. La diagonal nueva **E10** divide la cara azul en dos triángulos rellenos. Vuelve a abrir el panel, elige **Descortar arista → E10** y confirma para fusionarlos otra vez. Puedes usar Rellenar para vaciar un triángulo; Descortar explica entonces que ambos lados deben tener el mismo estado de relleno, en lugar de cambiar de forma inesperada el área pintada.

<VectorNetworkCube faces />

Los cortes deben permanecer dentro de una cara plana: se rechaza cruzar o tocar otra arista, solaparse con una arista o atravesar un hueco. Se conservan los límites curvos existentes y los huecos de ambos lados. Por ahora los cortes usan costuras rectas, no curvas dibujadas de forma arbitraria. Cuando Descortar fusiona dos caras acotadas, ambas deben estar rellenas o ambas sin relleno. Quitar una costura que une límites de hueco conserva el relleno original. Los trazos colgantes no se eliminan como costuras que unen límites. La previsualización es temporal; Cancelar, Deshacer, cambiar el vértice seleccionado o las actualizaciones externas de geometría la descartan. Una operación rechazada explica el motivo y no crea una entrada de historial.

Las funciones puras `cutVectorNetworkFace(network, from, to)` y `uncutVectorNetworkEdge(network, edgeIndex)` devuelven `VectorFaceTopologyResult`, incluidos los motivos de fallo o la red nueva, los mapas de índices de vértice y de arista y el vértice seleccionado. Los índices empiezan en cero. Las regiones rellenas se normalizan en caras planas mínimas, conservando el área pintada visible y los huecos. Esta operación de cara es independiente de la herramienta Cortar existente, que abre un vértice y se describe abajo.

#### Conectar los límites de un hueco {#connecting-hole-boundaries}

El anillo de abajo tiene un hueco sin relleno. En Mover, selecciona la esquina exterior superior izquierda **V1**, abre **Cortar / Descortar caras** y elige **Cortar cara → V5**. La **E9** nueva une el límite exterior con el hueco. El área azul sigue siendo una sola cara, el hueco permanece transparente y el límite recorre E9 una vez en cada dirección.

A continuación selecciona la esquina exterior superior derecha **V2** y elige **Cortar cara → V6**. La **E10** nueva divide el anillo en dos caras que Rellenar puede alternar de forma independiente. Sin cambiar los rellenos, selecciona V2 y **Descortar arista → E10**, y después selecciona V1 y **Descortar arista → E9**, para restaurar el anillo con dos bucles de límite separados. Cada paso admite deshacer y rehacer.

<VectorNetworkFaceCut />

También se pueden conectar dos huecos cuando toda la costura queda dentro de la misma cara sin tocar otros límites. Unir límites distintos elimina un bucle de límite sin añadir una cara; cortar dentro de un mismo límite añade una cara. Los límites curvos existentes no cambian, y los rellenos se normalizan en regiones de cara `evenodd` conservando su cobertura.

#### Abrir un vértice {#open-a-vertex}

Cortar **rompe la topología en el vértice seleccionado**. Duplica ese vértice, conserva su primer extremo incidente y mueve los extremos restantes a la copia. Los bucles cerrados y las cadenas abiertas usan la misma regla. Para el triángulo `0—1—2—0` con un corte en el vértice `1`:

```plaintext
Before:  0 — 1 — 2 — 0 (closed)
After:   1 — 0 — 2 — 3 (3 coincident with 1, open polyline)
segments: [0,1], [3,2], [2,0]
```

En una polilínea abierta, **duplica el vértice de corte** y reasigna a la copia todas las aristas incidentes salvo la primera, para que las dos cadenas se puedan separar en el modo Mover. Consulta `breakVertex`:

```ts
export function breakVertex(
    network: VectorNetworkData,
    vertexIndex: number,
): VectorNetworkData | null;
```

Hacer clic en un vértice en el modo Cortar llama a `breakVectorNetworkAtVertex` (`Select.ts`), escribe de vuelta la red, registra el historial y `setAppState({ vectorNetworkEditMode: MOVE })` para que puedas arrastrar de inmediato. Se conservan las regiones cuyos límites siguen cerrados. Un límite no válido elimina la región que lo contiene, también cuando se rompe un hueco, para evitar rellenar ese hueco por accidente. El vaciado usa un `regions: []` explícito para que la entidad y el historial de deshacer sigan sincronizados. Un bucle propio cúbico de un solo vértice también se puede cortar.

## Lectura adicional {#extended-reading}

-   [Presentación de las redes vectoriales]
-   [La ingeniería detrás de las redes vectoriales de Figma]
-   [Complejos de gráficos vectoriales]
-   [Desarrollo de un editor gráfico: implementación de la herramienta pluma]
-   [vpaint]
-   [penpot]

[Presentación de las redes vectoriales]: https://www.figma.com/blog/introducing-vector-networks/
[Presentación de las redes vectoriales - Curvar]: https://www.figma.com/blog/introducing-vector-networks/#bending
[Eliminar y reparar en las redes vectoriales]: https://www.figma.com/blog/delete-and-heal-for-vector-networks/
[VectorNetwork API]: https://www.figma.com/plugin-docs/api/VectorNetwork/
[VectorPath API]: https://www.figma.com/plugin-docs/api/VectorPath/
[VectorPath-data]: https://www.figma.com/plugin-docs/api/properties/VectorPath-data/
[Complejos de gráficos vectoriales]: https://www.borisdalstein.com/research/vgc/
[La ingeniería detrás de las redes vectoriales de Figma]: https://alexharri.com/blog/vector-networks
[Debate en HN]: https://news.ycombinator.com/item?id=39241825
[vpaint]: https://github.com/dalboris/vpaint
[penpot]: https://github.com/penpot/penpot
[Desarrollo de un editor gráfico: implementación de la herramienta pluma]: https://zhuanlan.zhihu.com/p/694407842
[Lección 12 - Dibujar una polilínea]: /es/guide/lesson-012
[Lección 13 - Dibujar trazados y estilo de boceto]: /es/guide/lesson-013
[fillRule]: /es/guide/lesson-013#fill-rule
[¿Cómo modificar los puntos de una línea con anclas?]: https://konvajs.org/docs/sandbox/Modify_Curves_with_Anchor_Points.html
[bezierjs]: http://pomax.github.io/bezierjs
[figma-fill-rule-editor]: https://github.com/evanw/figma-fill-rule-editor
[Polyline]: /es/guide/lesson-012
[Lección 21 - Transformer]: /es/guide/lesson-021
[Editar capas vectoriales]: https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers#h_01JYM29VEN8ABWTDXJR529446R
[Operaciones booleanas]: https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations
