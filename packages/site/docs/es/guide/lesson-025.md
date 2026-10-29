---
outline: deep
description: 'Dibuja rectángulos, elipses, polígonos y los modos borrador, láser y pincel. Implementación de las funciones del pincel, incluidos algoritmos de trazado de líneas para eliminar el temblor y una experiencia de dibujo suave y fluida.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lección 25 - Modo de dibujo y pincel',
          },
      ]
---

<script setup>
import DrawRect from '../../components/DrawRect.vue'
import DrawArrow from '../../components/DrawArrow.vue'
import DrawPolygon from '../../components/DrawPolygon.vue'
import Pencil from '../../components/Pencil.vue'
import PencilFreehand from '../../components/PencilFreehand.vue'
import Brush from '../../components/Brush.vue'
import BrushWithStamp from '../../components/BrushWithStamp.vue'
import LaserPointer from '../../components/LaserPointer.vue'
import Eraser from '../../components/Eraser.vue'
</script>

# Lección 25 - Modo de dibujo y pincel {#lesson-25-drawing-mode-and-brush}

En [Lección 14 - Modo del lienzo e interfaz auxiliar] presentamos los modos mano y de selección. En esta lección presentaremos los modos de dibujo: rectángulos, elipses y flechas, además de los modos de pincel, más libres.

## Modo de dibujo de rectángulos {#draw-rect-mode}

<DrawRect />

Primero añade el modo de lienzo siguiente. La implementación del dibujo de elipses es casi idéntica, así que no repetiré la introducción:

```ts
export enum Pen {
    HAND = 'hand',
    SELECT = 'select',
    DRAW_RECT = 'draw-rect', // [!code ++]
    DRAW_Ellipse = 'draw-ellipse', // [!code ++]
}
```

En [Lección 18 - Refactorizar con ECS] presentamos la arquitectura ECS, en la que se crea un System `DrawRect` y, al entrar en ese modo, el estilo del cursor se establece en `crosshair`:

```ts
import { System } from '@lastolivegames/becsy';

export class DrawRect extends System {
    execute() {
        if (pen !== Pen.DRAW_RECT) {
            return;
        }

        const input = canvas.write(Input);
        const cursor = canvas.write(Cursor);

        cursor.value = 'crosshair';
        //...
    }
}
```

Después, mientras se arrastra el ratón, el rectángulo se vuelve a dibujar de forma continua en el área de destino, de manera parecida al efecto de selección por marco del modo de selección. Cuando se suelta el ratón para terminar de crear el rectángulo, se pasa del modo de dibujo de rectángulos al modo de selección:

```ts
export class DrawRect extends System {
    execute() {
        //...
        // Draw rect brush when dragging
        this.handleBrushing(api, x, y);

        if (input.pointerUpTrigger) {
            // Create rect when pointerup event triggered
            const node: RectSerializedNode = {
                id: uuidv4(),
                type: 'rect', // Change to 'ellipse' in draw-ellipse mode
                x,
                y,
                width,
                height,
            };
            api.setAppState({ penbarSelected: Pen.SELECT }); // Switch canvas mode
            api.updateNode(node);
            api.record(); // Save to history
        }
    }
}
```

A continuación vemos qué ocurre durante el arrastre.

### Volver a dibujar el rectángulo {#redraw-rect}

Igual que en la selección por marco, para evitar que un arrastre muy corto empiece a dibujar, hay que fijar un umbral, calculado en el sistema de coordenadas del viewport:

```ts
handleBrushing(api: API, viewportX: number, viewportY: number) {
    const camera = api.getCamera();
    const {
        pointerDownViewportX,
        pointerDownViewportY,
    } = camera.read(ComputedCameraControl);

    // Use a threshold to avoid showing the selection brush when the pointer is moved a little.
    const shouldShowSelectionBrush =
        distanceBetweenPoints(
            viewportX,
            viewportY,
            pointerDownViewportX,
            pointerDownViewportY,
        ) > 10;
}
```

Las coordenadas `x/y` del rectángulo auxiliar son el lugar donde se disparó `pointerdown`, y las coordenadas del objeto del evento `pointermove` hay que convertirlas al sistema de coordenadas del lienzo para calcular el ancho y el alto:

```ts
const { x: cx, y: cy } = api.viewport2Canvas({
    x: viewportX,
    y: viewportY,
});

let x = pointerDownCanvasX;
let y = pointerDownCanvasY;
let width = cx - x;
let height = cy - y;

api.updateNode(
    selection.brush,
    {
        visibility: 'visible',
        x,
        y,
        width,
        height,
    },
    false,
);
```

Conviene tener en cuenta el arrastre en sentido inverso, en el que el `width/height` calculado puede ser negativo y las `x/y` correspondientes ya no están en la posición del `pointerdown`, así que hay que recalcularlas. Figma hace lo mismo:

```ts
if (width < 0) {
    x += width;
    width = -width;
}
if (height < 0) {
    y += height;
    height = -height;
}
```

### Etiqueta de tamaño {#size-label}

Queremos mostrar las dimensiones del rectángulo en tiempo real durante el dibujo, como hace Figma:

![Etiqueta de tamaño en Figma](/figma-size-label.png)

Del mismo modo, las anotaciones de este tipo de espacio de viewport encajan bien dentro de contenedores SVG, como demuestran el puntero láser y el borrador que se describen más abajo. Las etiquetas rectangulares usan estilos CSS para fijar el color de fondo, el relleno, el centrado y otras propiedades, mientras que el contenido de texto emplea el ancho y el alto de la caja delimitadora:

```ts
label.style.visibility = 'visible';
label.style.top = `${y + height}px`;
label.style.left = `${x + width / 2}px`;
label.innerText = `${Math.round(width)} × ${Math.round(height)}`;
```

Si se dibuja una línea recta, las etiquetas pueden rotar según la dirección de la línea y, al mismo tiempo, el texto sigue orientado hacia delante. Puedes probarlo en el ejemplo de la flecha de la sección siguiente:

```ts
label.style.top = `${y + height / 2}px`;
const rad = Math.atan2(height, width);
let deg = rad * (180 / Math.PI);
if (deg >= 90 && deg <= 180) {
    deg = deg - 180;
} else if (deg <= -90 && deg >= -180) {
    deg = deg + 180;
}
label.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
```

### Dibujar un cuadrado perfecto con Shift {#draw-square-with-shift}

Mantén pulsada <kbd>Shift</kbd> al arrastrar para crear cuadrados, círculos y polígonos perfectos. En ese momento, el valor absoluto mínimo del ancho y del alto se usa como lado del cuadrado.

```ts
if (isSquare) {
    if (Math.abs(width) > Math.abs(height)) {
        width = Math.sign(width) * Math.abs(height);
    } else {
        height = Math.sign(height) * Math.abs(width);
    }
}
```

## Dibujar una flecha {#draw-arrow}

Además de las formas básicas, como rectángulos, elipses y polilíneas, también se usan con frecuencia formas compuestas, como las flechas. Por ahora no trataremos las relaciones de enlace de las flechas (cuando la dirección de la flecha cambia al mover las formas conectadas por su cabeza y su cola); este tema se abordará en un capítulo aparte. Aquí nos centramos solo en cómo se dibujan las flechas.

Las flechas se declaran primero en SVG con un `<marker>`, normalmente un `<path>`, y después se asocian mediante los atributos [marker-start] y [marker-end] del gráfico de destino:

```html
<defs>
    <!-- arrowhead marker definition -->
    <marker
        id="arrow"
        viewBox="0 0 10 10"
        refX="5"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
    >
        <path d="M 0 0 L 10 5 L 0 10 z" />
    </marker>
</defs>
<!-- Coordinate axes with a arrowhead in both direction -->
<polyline
    points="10,10 10,90 90,90"
    fill="none"
    stroke="black"
    marker-start="url(#arrow)"
    marker-end="url(#arrow)"
/>
```

Esta forma de separar los extremos de la flecha del cuerpo es muy flexible. Sin embargo, en un editor gráfico basta con ofrecer algunos estilos comunes predefinidos. Por ejemplo, la flecha de Figma se realiza uniéndola a los dos extremos del Path (`start/end point`), con varios estilos predefinidos como `line/triangle/diamond`; consulta [Cómo curvar una flecha en Figma].

![Flecha en Figma](/arrow-in-figma.png)

drawio también ofrece muchos estilos de flecha listos para usar:

![fuente: https://www.drawio.com/assets/img/blog/style-tab-line-start-line-end.png](https://www.drawio.com/assets/img/blog/style-tab-line-start-line-end.png)

Así, en un uso declarativo, es perfectamente aceptable prescindir de los estilos de flecha personalizados y ofrecer un conjunto de literales de estilo integrados que generan los extremos de la flecha junto con el cuerpo al construir la Polyline o el Path. Esta idea también se ve en [plot - arrow], renderizado con SVG, que no usa `<marker>`, sino una definición completa de `<path>`.

```ts
export interface MarkerAttributes {
    markerStart: Marker['start'];
    markerEnd: Marker['end'];
}
```

A continuación, veamos el proceso de construcción de la geometría.

### Punto inicial y punto final {#start-end-point}

Primero hay que encontrar los puntos inicial y final de las flechas.

Sin embargo, la orientación hay que calcularla a mano, lo cual no es complicado: sigue la línea tangente.

<DrawArrow />

### Exportar la flecha a SVG {#export-arrow-to-svg}

En SVG puedes ajustar la orientación de `<marker>` con el atributo [orient], pero ten en cuenta que este atributo solo tiene dos valores literales: `‘auto’` y `‘auto-start-reverse’`.

```ts
if (isEnd) {
    $marker.setAttribute('orient', 'auto');
} else {
    $marker.setAttribute('orient', 'auto-start-reverse');
}
```

Después se crea un `<path>` según el tipo de marcador, de modo que herede propiedades como `stroke` del gráfico de destino. Puedes encontrar el SVG completo en el caso de prueba [exportar flecha]:

```ts
if (marker === 'line') {
    const points = lineArrow(0, 0, arrowRadius, Math.PI);
    const $path = createSVGElement('path');
    $path.setAttribute('fill', 'none');
    $path.setAttribute('stroke', stroke);
    $path.setAttribute('stroke-width', `${strokeWidth}`);
    $marker.appendChild($path);
}
```

En cambio, los archivos SVG exportados también deben poder volver a importarse en el lienzo.

## Dibujar un polígono {#draw-polygon}

[Herramientas de forma: polígonos]

<DrawPolygon />

Dada una caja delimitadora rectangular, genera por programa un trazado poligonal:

```ts
function regularPolygonPathInRect(
    sides: number,
    width: number,
    height: number,
    rotation = -Math.PI / 2,
): string {
    if (sides < 3 || width <= 0 || height <= 0) {
        return '';
    }

    const cx = width / 2;
    const cy = height / 2;
    const rx = width / 2;
    const ry = height / 2;
    const step = (Math.PI * 2) / sides;
    const points: [number, number][] = [];

    for (let i = 0; i < sides; i++) {
        const angle = rotation + i * step;
        points.push([
            formatNumber(cx + Math.cos(angle) * rx),
            formatNumber(cy + Math.sin(angle) * ry),
        ]);
    }

    return points
        .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
        .join(' ')
        .concat(' Z');
}
```

## Herramienta lápiz {#pencil-tool}

Empecemos por la implementación más sencilla, que muestra una línea quebrada. En Figma se llama Pencil.

Para minimizar el número de vértices generados al arrastrar y, sobre todo, el número de vértices duplicados o muy próximos entre sí, simplificaremos la polilínea con el método descrito en [Lección 12 - Simplificar la polilínea], eligiendo la implementación de [simplify-js]. Conviene señalar la definición del parámetro `tolerance`, que afecta al grado de simplificación:

> Afecta a la cantidad de simplificación (en la misma métrica que las coordenadas de los puntos).

Queremos fijar `tolerance` de forma distinta según el nivel de zoom actual de la cámara; si no, el temblor causado por una simplificación excesiva con un zoom alto se nota con facilidad:

![Polilínea demasiado simplificada con un zoom de 4x](/over-simplified-polyline.gif)

```ts
import simplify from 'simplify-js';

export class DrawPencil extends System {
    private handleBrushing() {
        // choose tolerance based on the camera zoom level
        const tolerance = 1 / zoom;
        selection.points = simplify(selection.pointsBeforeSimplify, tolerance);
    }
}
```

<Pencil />

### Trazo libre perfecto {#perfect-freehand}

Como el ancho de línea es fijo, le falta una sensación de «flexibilidad». Para crear un aspecto dibujado a mano, las líneas pueden variar con la presión. Para ello podemos usar [perfect-freehand]. Conviene señalar que esta función todavía no está integrada en Excalidraw; consulta: [Incidencia de dibujo con Perfect Freehand].
Como el ancho de línea es variable, la forma dibujada al final ya no es una Polyline, sino un Path:

```ts
import { getStroke } from 'perfect-freehand';

const outlinePoints = getStroke(points);
const d = getSvgPathFromStroke(outlinePoints); // 'M 0 0 L...'
```

<PencilFreehand />

De forma predeterminada, [perfect-freehand] simula la velocidad de los trazos calculando anchos de línea variables a partir de la distancia entre puntos adyacentes. Para usar la [pressure] real, como la de un lápiz o un stylus, indica la presión como tercer número de cada punto de entrada:

```ts
export class Input {
    @field.float32 declare pressure: number; // [!code ++]
}
```

Y establece la opción simulatePressure en false.

```ts
const outlinePoints = getStroke(inputPoints, {
    simulatePressure: false,
});
```

## Modo pincel {#brush-mode}

Puedes seleccionar esta subherramienta al entrar en el modo Pintura de Photoshop Web y dibujar trazos arrastrando de forma continua:

![Modo pincel en Photoshop Web](/photoshopweb-brush-mode.png)

En Figma se llama [Dibujar con herramientas de ilustración].

Si observamos de cerca este tipo de trazo, vemos que consta de un conjunto de puntos consecutivos que, si tienen radios distintos, pueden dar un efecto de grosor variable. Esto se puede lograr asignando la presión del pincel al radio:

![fuente: https://shenciao.github.io/brush-rendering-tutorial/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/brushes-9e58d24a7f40847be1ad6c1cb9f1b9dc.jpg)

Aquí nos basamos en el [Tutorial de renderizado de pinceles] para lograr este efecto.

### Implementación básica {#basic-implementation}

La estructura de datos subyacente es la siguiente:

```ts
interface BrushPoint {
    x: number;
    y: number;
    radius: number;
}
```

Los $N$ vértices de una polilínea forman $N-1$ segmentos, cada uno compuesto por dos triángulos y cuatro vértices. En [Lección 12 - Extruir el segmento] presentamos el uso de 9 vértices. Aquí usamos exactamente el mismo método, pero no hace falta tener en cuenta las uniones de los segmentos, así que solo necesitamos 4 vértices y los dibujamos mediante instanciado:

```ts
renderPass.drawIndexed(6, points.length - 1); // indices: [0, 1, 2, 0, 2, 3]
```

Como vimos en [Lección 12 - Extruir el segmento], puedes pasar `a_VertexNum` al vertex shader o usar `gl_VertexID` directamente, como en el [Tutorial de renderizado de pinceles], si no quieres tener en cuenta la compatibilidad con WebGL 1:

```glsl
layout(location = ${Location.POINTA}) in vec3 a_PointA;
layout(location = ${Location.POINTB}) in vec3 a_PointB;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum; // [0, 1, 2, 3]
```

Por cierto, los otros `attributes`, `a_PointA` y `a_PointB`, almacenan radios variables además de las coordenadas de posición de los vértices. De nuevo usamos `vertexBufferOffsets` para multiplexar el mismo búfer, y `a_PointB` lee desde un desplazamiento de `4 * 3`. Así tenemos los números de vértice con los que estirar en el vertex shader:

![fuente: https://shenciao.github.io/brush-rendering-tutorial/Basics/Vanilla/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/coordinate-68714349e3013c769921a0eb25796188.png)

```glsl
vec2 position;
vec2 offsetSign;
float r;
if (vertexNum < 0.5) {
    position = p0;
    r = r0;
    offsetSign = vec2(-1.0, -1.0);
} else if (vertexNum < 1.5) {
    position = p0;
    r = r0;
    offsetSign = vec2(-1.0, 1.0);
}
```

Para admitir anchos variables, la distancia estirada no es siempre igual al radio del punto actual, sino que hay que calcularla a partir de la pendiente del segmento de línea:

![fuente: https://shenciao.github.io/brush-rendering-tutorial/Basics/Vanilla/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/var-parameters-9d4c6d7aa31d0f61fd39ba9f69eaae6d.png)

```glsl
int MAX_i = 128; float currIndex = startIndex;
float A = 0.0;
for(int i = 0; i < MAX_i; i++){
    // Blend opacity
    A = A * (1.0-opacity) + opacity;
}
```

El efecto es el siguiente. Selecciona la herramienta pincel y varía la velocidad de arrastre: ECS usa muestras de ratón o de toque con marca de tiempo para que los trazos rápidos sean más finos y los lentos más gruesos, con transiciones suaves. Un lápiz sensible a la presión usa la presión medida. Los radios resultantes se guardan en el trazo, de modo que deshacer, rehacer y volver a cargar conservan la forma.

<Brush />

### Sello {#stamp}

Esto no funciona del todo como un trazo de pincel real. Añadimos la propiedad `brushStamp` para la URL de la imagen del sello, pero solo controla la opacidad del pincel; `stroke` sigue afectando al color.

```ts
api.updateNodes([
    {
        id: '1',
        type: 'brush',
        brushType: BrushType.STAMP,
        brushStamp: '/stamp.png',
        points: position.map(([x, y], i) => `${x},${y},${radius[i]}`).join(' '),
        stroke: 'grey',
    },
]);
```

<BrushWithStamp />

Ahora mismo, todas las texturas se aplican con una orientación fija. Podemos añadir ángulos de rotación aleatorios a las texturas:

```glsl
float angle = rotationFactor*radians(360.0*fract(sin(currIndex)*1.0));
pToCurrStamp *= rotate(angle);
```

También podemos usar un factor de ruido al mezclar la opacidad:

```glsl
float opacityNoise = noiseFactor*fbm(textureCoordinate*50.0);
```

### [WIP] Exportar SVG {#export-brush-to-svg}

Figma puede exportar el pincel a SVG.

## Puntero láser {#laser-pointer}

Al implementar funciones de presentación en el lienzo, un puntero láser es una función esencial. Excalidraw admite esta capacidad, como se detalla en: [puntero láser]. Podemos usar directamente su módulo encapsulado [@excalidraw/laser-pointer], que genera un trazado de trayectoria a partir de un conjunto de coordenadas de puntos de entrada. Esta funcionalidad también se apoya en [perfect-freehand] en su núcleo.

Esta función se diferencia de las formas dibujadas antes en el lienzo en lo siguiente:

1. El renderizado de la trayectoria del puntero láser ocurre en el sistema de coordenadas del viewport, con independencia del nivel de zoom actual del lienzo. Esto permite implementarlo dentro de un contenedor HTML independiente. Consulta: [Lección 29 - Contenedor HTML]
2. Los trazos se desvanecen solos al cabo de un tiempo establecido
3. Está pensado para escenarios de colaboración entre varias personas. Consulta: [Lección 20 - Awareness y presencia]

<LaserPointer />

## Borrador {#eraser}

Excalidraw admite el [borrador de freedraw]. Tras seleccionar la herramienta borrador, las formas que recorre el cursor del ratón aparecen «desvanecidas», lo que indica que están a punto de borrarse. Soltar el ratón completa el borrado.

En la implementación usamos la técnica Perfect freehand presentada en la sección anterior para dibujar el trazado del arrastre, pero solo almacenamos los 4 puntos más recientes. Al mismo tiempo, detectamos en tiempo real las formas por las que se pasa, fijamos su opacidad (pero recuerda guardar la opacidad original para restaurarla si se cancela) y eliminamos las formas seleccionadas cuando se suelta el ratón:

```ts
export class DrawEraser extends System {
    execute() {
        if (input.pointerUpTrigger) {
            api.runAtNextTick(() => {
                api.updateNode(brush, { visibility: 'hidden' }, false);
                api.setAppState({
                    penbarSelected: Pen.SELECT,
                });
                api.deleteNodesById(
                    Array.from(selected).map((e) => api.getNodeByEntity(e)?.id),
                );
                api.record();
            });
        }
    }
}
```

<Eraser />

### No atómico {#non-atomic}

Borrar formas enteras basta en la mayoría de los casos, pero el borrado no atómico resulta más práctico en el dibujo a mano alzada, por ejemplo al partir una línea recta por la mitad. Excalidraw todavía no tiene esta función; consulta: [borrado no atómico de formas lineales y de freedraw]. FigJam comparte esta limitación. Si el lienzo se renderiza con Canvas o SVG, este efecto de borrado a nivel de píxel es imposible.

Como nuestro lienzo se implementa con WebGL/WebGPU, la técnica más adecuada es el stencil buffer. Primero se dibuja el trazado del borrador en el stencil buffer y después se usa como máscara para volver a dibujar la escena. Tomando OpenGL como ejemplo (WebGL es del todo análogo):

```c++
// 1. Disable color/depth writes, enable stencil, and draw the eraser shape:
//    This writes “1” into the stencil where the eraser stamp is drawn.
glColorMask(false,false,false,false);
glDepthMask(false);
glEnable(GL_STENCIL_TEST);
glStencilFunc(GL_ALWAYS, 1, 0xFF);
glStencilOp(GL_REPLACE, GL_REPLACE, GL_REPLACE);
// draw eraser brush geometry here (e.g. a textured quad or circle)

glColorMask(true,true,true,true);
glDepthMask(true);
// 2. Now render the shapes with stencil test=EQUAL, so only pixels where stencil==1 pass:
glStencilFunc(GL_EQUAL, 1, 0xFF);
glStencilOp(GL_KEEP, GL_KEEP, GL_KEEP);
// draw all scene objects (they will only appear where eraser just wrote 1)
```

Lo presentaremos más adelante en [Lección 34 - Marco y recorte].

## Lectura adicional {#extended-reading}

-   [Dibujar con herramientas de ilustración]
-   [Tutorial de renderizado de pinceles]
-   [p5.brush]
-   [Sistema de pintura en tiempo real con WebGL]
-   [Implementa con sencillez una herramienta de pincel y dibuja curvas suaves]

[Lección 14 - Modo del lienzo e interfaz auxiliar]: /es/guide/lesson-014
[Lección 18 - Refactorizar con ECS]: /es/guide/lesson-018
[Dibujar con herramientas de ilustración]: https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools
[p5.brush]: https://github.com/acamposuribe/p5.brush
[Sistema de pintura en tiempo real con WebGL]: https://chrisarasin.com/paint-system-webgl
[Implementa con sencillez una herramienta de pincel y dibuja curvas suaves]: https://zhuanlan.zhihu.com/p/701668081
[Lección 12 - Simplificar la polilínea]: /es/guide/lesson-012#simplify-polyline
[simplify-js]: https://github.com/mourner/simplify-js
[Tutorial de renderizado de pinceles]: https://shenciao.github.io/brush-rendering-tutorial/
[Lección 12 - Extruir el segmento]: /es/guide/lesson-012#extrude-segment
[Cómo curvar una flecha en Figma]: https://imagy.app/how-to-curve-an-arrow-in-figma/
[marker-start]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-start
[marker-end]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-end
[Herramientas de forma: polígonos]: https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools#polygons
[plot - arrow]: https://github.com/observablehq/plot/blob/main/src/marks/arrow.js
[orient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/orient
[exportar flecha]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/ecs/snapshots/export-arrow.svg
[perfect-freehand]: https://github.com/steveruizok/perfect-freehand
[Incidencia de dibujo con Perfect Freehand]: https://github.com/excalidraw/excalidraw/issues/4802
[pressure]: https://developer.mozilla.org/docs/Web/API/PointerEvent/pressure
[borrador de freedraw]: https://github.com/excalidraw/excalidraw/issues/3682
[borrado no atómico de formas lineales y de freedraw]: https://github.com/excalidraw/excalidraw/issues/4904
[puntero láser]: https://github.com/excalidraw/excalidraw/issues/5351
[@excalidraw/laser-pointer]: https://www.npmjs.com/package/@excalidraw/laser-pointer
[Lección 29 - Contenedor HTML]: /es/guide/lesson-029#create-html-container
[Lección 20 - Awareness y presencia]: /es/guide/lesson-020#awareness-presence
[Lección 34 - Marco y recorte]: /es/guide/lesson-034
