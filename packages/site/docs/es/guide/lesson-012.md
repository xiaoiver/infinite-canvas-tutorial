---
outline: deep
description: 'Implementa polilíneas con funciones avanzadas, como anchos de línea arbitrarios, uniones y extremos del trazo, líneas discontinuas y antialiasing. Aprende a construir la malla en la CPU o en la GPU y a calcular la caja delimitadora.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 12 - Polilíneas' }]
---

<script setup>
import Wireframe from '../../components/Wireframe.vue';
</script>

# Lección 12 - Dibujar una polilínea {#lesson-12-draw-polyline}

Sigamos añadiendo figuras básicas: las polilíneas. En esta lección aprenderás lo siguiente:

-   ¿Por qué no usar `gl.LINES` directamente?
-   Construir la malla en la CPU o en el shader
-   Analizar los detalles del shader, entre ellos:
    -   Estirar vértices y uniones
    -   Antialiasing
    -   Dibujar líneas discontinuas
-   ¿Cómo calcular la caja delimitadora de una polilínea?

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline, Rect } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const polyline1 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            fill: 'none',
        });
        canvas.appendChild(polyline1);

        const polyline2 = new Polyline({
            points: [
                [220, 100],
                [220, 200],
                [320, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'bevel',
            fill: 'none',
        });
        canvas.appendChild(polyline2);

        const polyline3 = new Polyline({
            points: [
                [340, 100],
                [340, 200],
                [440, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'round',
            strokeLinecap: 'round',
            fill: 'none',
        });
        canvas.appendChild(polyline3);

        const polyline4 = new Polyline({
            points: [
                [100, 300],
                [200, 300],
                [300, 210],
                [400, 300],
                [500, 300],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'round',
            strokeLinecap: 'round',
            strokeDasharray: [10, 5],
            fill: 'none',
        });
        canvas.appendChild(polyline4);

        const rect2 = new Rect({
            x: 500,
            y: 100,
            fill: 'black',
            fillOpacity: 0.5,
            stroke: 'red',
            strokeWidth: 10,
            dropShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            strokeDasharray: [5, 5],
        });
        rect2.width = 100;
        rect2.height = 100;
        canvas.appendChild(rect2);
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## Limitaciones de gl.LINES {#limitation-of-gl-lines}

Los `gl.LINES` y `gl.LINE_STRIP` que ofrece WebGL a menudo no resultan muy prácticos en situaciones reales:

-   No admiten el ancho. Si intentamos usar [lineWidth], navegadores habituales como Chrome lanzan una advertencia:

> [!WARNING]
> A enero de 2017, la mayoría de las implementaciones de WebGL solo admiten un mínimo de 1 y un máximo de 1, porque la tecnología en la que se basan tiene esos mismos límites.

-   No se puede definir la forma de conexión entre segmentos de línea adyacentes [lineJoin] ni la forma de los extremos [lineCap]
-   La implementación predeterminada tiene dientes de sierra notables y exige antialiasing adicional

Hay que señalar que la solución de [Lección 5 - Cuadrícula de líneas] no sirve para dibujar segmentos de línea arbitrarios; ni siquiera puede definir de forma arbitraria los dos extremos de un segmento. Además, la mayor diferencia entre los segmentos de línea y las polilíneas es el tratamiento de las uniones, para lo que deck.gl ofrece [LineLayer] y [PathLayer] respectivamente.

Aclaremos ahora las funciones que queremos implementar para las polilíneas:

-   Soporte de anchos de línea arbitrarios
-   Soporte para definir un número arbitrario de puntos. Parecido al atributo SVG [points].
-   Soporte de formas de conexión entre segmentos de línea adyacentes [stroke-linejoin] y formas de los extremos [stroke-linecap]
-   Soporte de líneas discontinuas. [stroke-dashoffset] y [stroke-dasharray]
-   Buen efecto de antialiasing
-   Soporte de dibujo instanciado; consulta el [dibujo instanciado] presentado antes

Nuestra API diseñada es la siguiente:

```ts
const line = new Polyline({
  points: [
    [0, 0],
    [100, 100]
  ],
  strokeWidth: 100,
  strokeLinejoin: 'round'
  strokeLinecap: 'round',
  strokeMiterlimit: 4,
  strokeDasharray: [4, 1],
  strokeDashoffset: 10
});
```

Veamos primero la primera pregunta: cómo implementar valores arbitrarios de `strokeWidth`.

## Construcción de la malla {#construct-mesh}

La imagen siguiente procede del encuentro de WebGL compartido por Pixi.js: [Cómo dibujar líneas en WebGL]. Este artículo se apoyará mucho en capturas de esa presentación, y marcaré los números de página de la PPT. Como los métodos nativos no están disponibles, solo podemos volver al esquema tradicional de dibujo que consiste en construir una malla.

![Cómo dibujar una línea en WebGL - página 5](/how-to-draw-line-in-webgl.png)

La práctica habitual es estirar y triangular en la dirección de la normal del segmento de línea. La imagen siguiente procede de [Dibujar líneas con antialiasing en OpenGL]. Los dos extremos del segmento se estiran hacia ambos lados a lo largo de la normal de la línea discontinua roja, formando 4 vértices, triangulados en 2 triángulos, de modo que `strokeWidth` puede ser cualquier valor.

![extruir la línea](/extrude-line.png)

### Construcción en la CPU {#construct-mesh-on-cpu}

El estiramiento del segmento de línea y la construcción de la malla de `strokeLinejoin` y `strokeLinecap` pueden hacerse en la CPU o en el shader. Entre las implementaciones que siguen el primer enfoque están:

-   [Renderizado de líneas instanciadas, parte I]
-   [Renderizado de líneas instanciadas, parte II]
-   [regl-gpu-lines]

![malla de instancia del segmento](https://wwwtyro.net/media/instanced-lines/segment-instance.svg)

![instancia del segmento, mallas de lineCap y lineJoin](https://rreusser.github.io/regl-gpu-lines/docs/debug.png)

Se puede ver que, cuando `strokeLinejoin` y `strokeLinecap` toman el valor `round`, para que las esquinas redondeadas se vean suaves, la construcción de la malla necesita el mayor número de vértices. En [regl-gpu-lines], cada segmento necesita hasta `32 * 4 + 6 = 134` vértices:

```ts
// @see https://github.com/rreusser/regl-gpu-lines/blob/main/src/index.js#L81
cache.indexBuffer = regl.buffer(
    new Uint8Array([...Array(MAX_ROUND_JOIN_RESOLUTION * 4 + 6).keys()]), // MAX_ROUND_JOIN_RESOLUTION = 32
);
```

`strokeLinecap` y los segmentos de línea tienen que dibujarse en draw calls distintos. Siguiendo con el [ejemplo instanciado] de [regl-gpu-lines], hace falta compilar dos Programs y usar 3 draw calls para dibujar, entre los cuales:

-   Los dos extremos usan el mismo Program, pero el Uniform `orientation` es distinto. El número de vértices es `cap + join`
-   Todos los segmentos de línea intermedios se dibujan con un draw call; el número de vértices es `join + join` y el número de instancias es el número de segmentos de línea

```ts
const computeCount = isEndpoints
    ? // Draw a cap
      (props) => [props.capRes2, props.joinRes2]
    : // Draw two joins
      (props) => [props.joinRes2, props.joinRes2];
```

Si hay varias polilíneas, las condiciones para fusionarlas son los mismos valores de `strokeLinecap` y `strokeLinejoin` y el número de segmentos de línea. La figura siguiente muestra la situación de dibujar 5 polilíneas, en las que la parte del segmento intermedio de cada polilínea contiene 8 `instance`, así que el número total de `instance` es 40:

![draw calls de linecap y segmentos](/regl-gpu-lines.png)

### Construcción en el shader {#construct-mesh-on-shader}

Del encuentro de WebGL compartido por Pixi.js, construir la malla en el shader:

-   [Cómo dibujar líneas en WebGL]
-   [pixijs/graphics-smooth]

En comparación con construir en la CPU, sus ventajas incluyen:

-   Solo hace falta un draw call para dibujar `strokeLinecap`, `strokeLineJoin` y el segmento intermedio
-   Los vértices están fijos en 9: los vértices 1234 forman dos triángulos para dibujar la parte del segmento de línea, y los vértices 56789 forman tres triángulos para dibujar la parte de la unión
-   Cuando `strokeLinecap` y `strokeLinejoin` toman el valor `round`, queda más suave porque en el shader de fragmentos se usa un método parecido al de dibujar círculos con SDF
-   Buen efecto de antialiasing

![empaquetar uniones en instancias - página 15](/pack-joints-into-instances.png)

```glsl
layout(location = ${Location.PREV}) in vec2 a_Prev;
layout(location = ${Location.POINTA}) in vec2 a_PointA;
layout(location = ${Location.POINTB}) in vec2 a_PointB;
layout(location = ${Location.NEXT}) in vec2 a_Next;
layout(location = ${Location.VERTEX_JOINT}) in float a_VertexJoint;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum;
```

La disposición del búfer es la siguiente, y el tamaño de cada stride es `4 * 3`. En el búfer, los mismos datos continuos, como `x1 y1 t1`, se leen como `A_0` en la primera instancia y como `Prev_1` en la segunda. Esta disposición entrelazada ahorra la mayor cantidad posible de tamaño de búfer:

```ts
const vertexBufferDescriptors: InputLayoutBufferDescriptor[] = [
    {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
            {
                format: Format.F32_RG,
                offset: 4 * 0,
                shaderLocation: Location.PREV,
            },
            {
                format: Format.F32_RG,
                offset: 4 * 3,
                shaderLocation: Location.POINTA,
            },
            {
                format: Format.F32_R,
                offset: 4 * 5,
                shaderLocation: Location.VERTEX_JOINT,
            },
            {
                format: Format.F32_RG,
                offset: 4 * 6,
                shaderLocation: Location.POINTB,
            },
            {
                format: Format.F32_RG,
                offset: 4 * 9,
                shaderLocation: Location.NEXT,
            },
        ],
    },
];
```

Por desgracia, si cambiamos al renderizador WebGPU, obtendremos el error siguiente:

> [!WARNING]
> El desplazamiento del atributo (12) con el formato VertexFormat::Float32x2 (tamaño: 8) no cabe en el stride del búfer de vértices (12).

La razón es que WebGPU tiene la regla de verificación siguiente para VertexBufferLayout, y nuestro arrayStride es `4 * 3`. [Problema de instanciado en WebGPU] y [especificación: es útil permitir que GPUVertexBufferLayout.arrayStride sea menor que offset + sizeof(attrib.format)] también lo mencionan.

> attrib.offset + byteSize(attrib.format) ≤ descriptor.arrayStride.
>
> 4 _3 + 4_ 2 ≤ 4 \* 3 // Oops!

Por tanto, tenemos que cambiar la disposición del búfer. Primero, en el Layout, pasamos de un búfer que contiene varios atributos a varios búferes, cada uno con un solo atributo:

```ts
const vertexBufferDescriptors: InputLayoutBufferDescriptor[] = [
    {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
            {
                format: Format.F32_RG,
                offset: 4 * 0,
                shaderLocation: Location.PREV,
            },
        ],
    },
    {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
            {
                format: Format.F32_RG,
                offset: 4 * 0,
                shaderLocation: Location.POINTA,
            },
        ],
    },
    // Omit VERTEX_JOINT
    // Omit POINTB
    // Omit NEXT
];
```

Aunque se divide en varias declaraciones de BufferLayout, la referencia real es al mismo búfer: el atributo correspondiente solo se lee mediante `offset`. Consulta los detalles: [Desplazamiento en bytes dentro del búfer donde empiezan los datos de vértices].

```ts
const buffers = [
    {
        buffer: this.#segmentsBuffer, // PREV
    },
    {
        buffer: this.#segmentsBuffer, // POINTA
        offset: 4 * 3,
    },
    {
        buffer: this.#segmentsBuffer, // VERTEX_JOINT
        offset: 4 * 5,
    },
    {
        buffer: this.#segmentsBuffer, // POINTB
        offset: 4 * 6,
    },
    {
        buffer: this.#segmentsBuffer, // NEXT
        offset: 4 * 9,
    },
];
renderPass.setVertexInput(this.#inputLayout, buffers, {
    buffer: this.#indexBuffer,
});
```

El resto de funciones también se implementará más adelante a partir de este esquema.

<Wireframe />

## Análisis de la implementación del shader {#shader-implementation}

Primero veamos cómo estirar los vértices en el cuerpo principal y en las uniones del segmento de línea.

### Extruir el segmento {#extrude-segment}

Centrémonos en los vértices 1 a 4, es decir, la parte principal del segmento de línea. Si se tiene en cuenta el ángulo que forman el segmento y sus segmentos adyacentes, hay estas cuatro formas: `/-\` `\-/` `/-/` y `\-\`:

![extruir a lo largo del segmento de línea - página 16](/line-vertex-shader.png)

Antes de calcular el vector normal unitario, convierte la posición de cada vértice al sistema de coordenadas del modelo:

```glsl
vec2 pointA = (model * vec3(a_PointA, 1.0)).xy;
vec2 pointB = (model * vec3(a_PointB, 1.0)).xy;

vec2 xBasis = pointB - pointA;
float len = length(xBasis);
vec2 forward = xBasis / len;
vec2 norm = vec2(forward.y, -forward.x);

xBasis2 = next - base;
float len2 = length(xBasis2);
vec2 norm2 = vec2(xBasis2.y, -xBasis2.x) / len2;
float D = norm.x * norm2.y - norm.y * norm2.x;
```

En la primera forma, por ejemplo, los vértices 1 y 2 se estiran hacia fuera a lo largo de la normal, y los vértices 3 y 4 se estiran hacia dentro a lo largo de las bisectrices (`doBisect()`) de las uniones:

```glsl
if (vertexNum < 3.5) { // Vertex #1 ~ 4
    if (abs(D) < 0.01) {
        pos = dy * norm;
    } else {
        if (flag < 0.5 && inner < 0.5) { // Vertex #1, 2
            pos = dy * norm;
        } else { // Vertex #3, 4
            pos = doBisect(norm, len, norm2, len2, dy, inner);
        }
    }
}
```

### Extruir la unión {#extrude-linejoin}

A continuación nos centramos en los vértices 5~9 de la unión. La dirección y la distancia del estiramiento varían según la forma de la unión. La implementación del autor original es muy compleja: `bevel` y `round` comparten el mismo método de estiramiento, y el segundo completa las esquinas redondeadas en el shader de fragmentos mediante SDF.

![extruir a lo largo del segmento de línea - página 16](/line-vertex-shader2.png)

Empecemos el análisis por el `miter` más sencillo, que por definición se convierte en `bevel` si se supera `strokeMiterlimit`.

```glsl
if (length(pos) > abs(dy) * strokeMiterlimit) {
    type = BEVEL;
} else {
    if (vertexNum < 4.5) {
        dy = -dy;
        pos = doBisect(norm, len, norm2, len2, dy, 1.0);
    } else if (vertexNum < 5.5) {
        pos = dy * norm;
    } else if (vertexNum > 6.5) {
        pos = dy * norm2;
    }
    v_Type = 1.0;
    dy = -sign * dot(pos, norm);
    dy2 = -sign * dot(pos, norm2);
    hit = 1.0;
}
```

Vale la pena mencionar que, en Cairo, hay que decidir si se usan uniones round o bevel según la `arc height`. La figura siguiente procede de: [Cairo: corrección de las uniones redondeadas]

![Cairo: corrección de las uniones redondeadas](https://gitlab.freedesktop.org/-/project/956/uploads/b53d20cf0156e48b4a9766f6c5ff5cff/round_join.png)

### Antialiasing {#anti-aliasing}

Por último, veamos cómo aplicar antialiasing a los bordes del segmento de línea. Ya presentamos el [Antialiasing en SDF], y aquí usamos un enfoque parecido:

1. Calcula el vector unitario vertical desde el vértice hasta el segmento de línea en el shader de vértices y pásalo al shader de fragmentos mediante `varying` para que se interpole automáticamente
2. El vector interpolado ya no es un vector unitario. Calcula su longitud, que es la distancia perpendicular desde el píxel actual hasta el segmento de línea, dentro del rango `[0, 1]`
3. Usa este valor para calcular la transparencia final del píxel y completar el antialiasing. `smoothstep` ocurre en el borde del segmento de línea, es decir, dentro del intervalo `[linewidth - feather, linewidth + feather]`. La figura siguiente procede de [Dibujar líneas con antialiasing en OpenGL], y la lógica de cálculo concreta se presentará más adelante.

![feather](https://miro.medium.com/v2/resize:fit:818/format:webp/0*EV5FGcUOHAbFFPjy.jpg)

¿Cuánto debe medir este «feather»? En [Dibujar la sombra exterior del rectángulo] expandimos el tamaño original del rectángulo en `3 * dropShadowBlurRadius`. La figura siguiente sigue procediendo de [Cómo dibujar líneas en WebGL]: expandir un píxel hacia fuera (de `w` a `w+1`) es suficiente. En el otro lado, la distancia de los dos vértices (vértices n.º 3 y n.º 4) es negativa:

```glsl
const float expand = 1.0;
lineWidth *= 0.5;

float dy = lineWidth + expand; // w + 1
if (vertexNum >= 1.5) { // Vertex #3 & #4
  dy = -dy; // -w - 1
}
```

En la figura inferior derecha también se ve que, cuando ampliamos para mirar cada píxel en el shader de fragmentos, con esta distancia dirigida `d` podemos calcular la cobertura del segmento de línea y del píxel actual (el área del triángulo de la figura siguiente) y conseguir un efecto de antialiasing.

![ampliar 1 píxel hacia fuera](/line-segment-antialias.png)

¿Cómo usar esta distancia para calcular la cobertura? Hay que dividirlo en el cuerpo principal del segmento de línea y en la situación de la unión.

Primero veamos la situación del cuerpo principal del segmento de línea, que puede simplificarse aún más al caso de un segmento vertical. El autor original también ofreció un método de cálculo que tiene en cuenta la rotación, y no se diferencia mucho de la versión de estimación simplificada. Usa `clamp` para calcular la cobertura de un lado y ten en cuenta también el caso de un ancho de línea muy fino: resta el lado izquierdo del derecho para obtener la cobertura final, como coeficiente de transparencia del color final.

![calcular la cobertura según la distancia con signo](/line-segment-antialias2.png)

Por supuesto, calcular el área de intersección entre la parte del segmento de línea y la recta es el caso más sencillo. El tratamiento de las uniones y de los extremos será muy complejo. Tomando como ejemplo la unión Miter, sigue ignorando la rotación y considera solo el caso en el que los segmentos adyacentes son perpendiculares (fíjate en el área del recuadro rojo del lado derecho de la figura siguiente). A diferencia del segmento de arriba, que solo tiene una distancia dirigida `d`, aquí hay dos distancias dirigidas, `d1` y `d2`, que representan los dos segmentos anterior y posterior de la unión. Del mismo modo, si se considera una línea muy fina dentro del área de un píxel, el área de cobertura es la diferencia de área entre los dos cuadrados (`a2 * b2 - a1 * b1`):

![calcular la cobertura en la unión miter](/line-segment-antialias3.png)

El método de cálculo de la unión Bevel es más o menos el mismo que el de Miter (la situación del centro en la figura siguiente). `d3` representa la distancia desde el centro del píxel hasta la «línea de bisel», y puede usarse para calcular la cobertura del lado derecho de la figura siguiente. Puedes tomar el mínimo de estas dos situaciones para obtener un resultado de cálculo aproximado.

![calcular la cobertura en la unión bevel](/line-segment-antialias5.png)

![calcular la cobertura en la unión bevel](/line-segment-antialias4.png)

Por último, llegamos al caso de las uniones redondeadas. Exige una distancia adicional `d3` desde el centro del círculo hasta el píxel (parecida a dibujar círculos con SDF), pasada desde el shader de vértices.

![calcular la cobertura en la unión round](/line-segment-antialias6.png)

![calcular la cobertura en la unión round](/line-segment-antialias7.png)

El autor original también ofreció una versión exacta de la implementación de `pixelLine`, que no se desarrolla aquí por limitaciones de espacio.

### Soporte de la alineación del trazo {#stroke-alignment}

Antes implementamos [SVG mejorado: alineación del trazo] en Circle, Ellipse y Rect dibujados con SDF. Ahora añadamos este atributo a las polilíneas. La figura siguiente procede del efecto `lineStyle.alignment` de Pixi.js, donde la línea roja representa la posición geométrica de la polilínea y se desplaza arriba y abajo según los distintos valores:

![alineación del trazo - p27](/line-stroke-alignment.png)

En las polilíneas de ECS, la alineación del trazo también afecta a los límites geométricos calculados. Cambiar `strokeWidth` o `strokeAlignment`, eliminar la geometría del trazo y deshacer o rehacer esas ediciones actualizan los puntos desplazados y sus límites. Una polilínea sin trazo conserva sus puntos originales. Las muestras duplicadas consecutivas comparten el desplazamiento de su vértice común; una polilínea formada por completo por muestras coincidentes se mantiene finita. El orden y el número originales de los puntos se conservan para la exportación a SVG.

En el shader, reflejamos este atributo en el desplazamiento a lo largo del estiramiento de la normal. Si `strokeAlignment` toma el valor `center`, el desplazamiento es `0`:

```glsl
float shift = strokeWidth * strokeAlignment;
pointA += norm * shift;
pointB += norm * shift;
```

De izquierda a derecha están los efectos de `outer`, `center` e `inner`:

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas2.parentElement.style.position = 'relative';
    $icCanvas2.parentElement.appendChild($stats);

    $icCanvas2.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const polyline1 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 200],
                [200, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeAlignment: 'outer',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);
        const polyline4 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 200],
                [200, 100],
            ],
            stroke: 'red',
            strokeWidth: 2,
            // strokeAlignment: 'outer',
            fill: 'none',
        });
        canvas.appendChild(polyline4);

        const polyline2 = new Polyline({
            points: [
                [220, 100],
                [220, 200],
                [320, 200],
                [320, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            cursor: 'pointer',
            fill: 'none',
        });
        canvas.appendChild(polyline2);
        const polyline5 = new Polyline({
            points: [
                [220, 100],
                [220, 200],
                [320, 200],
                [320, 100],
            ],
            stroke: 'red',
            strokeWidth: 2,
            fill: 'none',
        });
        canvas.appendChild(polyline5);

        const polyline3 = new Polyline({
            points: [
                [360, 100],
                [360, 200],
                [460, 200],
                [460, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeAlignment: 'inner',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
        const polyline6 = new Polyline({
            points: [
                [360, 100],
                [360, 200],
                [460, 200],
                [460, 100],
            ],
            stroke: 'red',
            strokeWidth: 2,
            fill: 'none',
        });
        canvas.appendChild(polyline6);

        polyline1.addEventListener('pointerenter', () => {
            polyline1.stroke = 'green';
        });
        polyline1.addEventListener('pointerleave', () => {
            polyline1.stroke = 'black';
        });
        polyline2.addEventListener('pointerenter', () => {
            polyline2.stroke = 'green';
        });
        polyline2.addEventListener('pointerleave', () => {
            polyline2.stroke = 'black';
        });
        polyline3.addEventListener('pointerenter', () => {
            polyline3.stroke = 'green';
        });
        polyline3.addEventListener('pointerleave', () => {
            polyline3.stroke = 'black';
        });
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

Por último, hay dos puntos que conviene tener en cuenta:

1. Como `stroke-alignment` no es un atributo SVG estándar, hay que volver a calcular `points` al exportar a SVG, lo que coincide con la lógica de estirar a lo largo de la normal y de la bisectriz en el shader, y no se desarrolla aquí por limitaciones de espacio
2. El método de determinación del picking, es decir, `containsPoint`, también tiene que calcularse a partir de los vértices desplazados de `points`. Puedes probar a cambiar el color de la polilínea moviendo el ratón dentro y fuera del ejemplo de arriba

### Líneas discontinuas {#dash}

Un trazo discontinuo tiene sus propios dos extremos. Aplicar una máscara de alfa periódica a un trazo sólido puede producir cortes planos en los segmentos rectos, pero no puede crear extremos redondeados, y proyectar una esquina solo sobre el segmento entrante produce cuñas mal colocadas.

Primero, asocia las distancias acumuladas de la **línea central** con las instancias de segmento correctas. Para `[[0, 0], [100, 0], [200, 0]]`, las instancias son el extremo inicial opcional y dos segmentos, con distancias de inicio `[0, 0, 100]`. Cada instancia también lleva la distancia de inicio del segmento anterior y del siguiente; `-1` significa que ese vecino no existe:

```glsl
layout(location = ${Location.TRAVEL}) in vec3 a_Travel;
// x: current segment start; y: previous start; z: next start
```

En el shader de fragmentos, usa `period = dash + gap` para localizar los intervalos pintados más cercanos y, después, recorta esos intervalos a su segmento de la línea central. La longitud pintada es **dash**, no gap. Este capítulo sigue admitiendo un patrón de dos números; cualquier periodo positivo es válido, incluidos los valores inferiores a un píxel. Un hueco de cero produce un trazo sólido.

Para `strokeLinecap: 'round'`, cada intervalo pintado es una cápsula. Aquí `p.x` es la distancia a lo largo de ese intervalo en unidades de mundo, `p.y` es la distancia perpendicular desde su línea central y `dashLength` es su longitud recortada en las mismas unidades:

```glsl
float radius = strokeWidth * 0.5;
float alongOutside = max(max(-p.x, p.x - dashLength), 0.0);
float distance = length(vec2(alongOutside, p.y)) - radius;
float coverage = clamp(
    0.5 - distance / max(fwidth(distance), 0.0001),
    0.0, 1.0
);
```

Usa el semiancho completo para el radio; mezclarlo con una distancia perpendicular ya escalada hace que los extremos y el cuerpo queden demasiado estrechos. `butt` usa un rectángulo; `square` alarga el rectángulo en el semiancho por cada extremo. Los extremos round y square se extienden hacia el hueco nominal, así que un hueco más estrecho que el ancho del trazo puede hacer que los trazos discontinuos vecinos se toquen.

Las esquinas necesitan las dos direcciones de segmento:

1. Evalúa los intervalos de trazo visibles del segmento actual, del anterior y del siguiente, y toma su unión. También se comprueban las celdas de periodo vecinas, de modo que funcionen los trazos parciales de los extremos y los desplazamientos negativos.
2. Si un trazo continúa a través de un vértice, suprime los extremos artificiales en ese límite de segmento y usa `strokeLinejoin` para la esquina exterior.
3. Si el trazo se detiene ahí o el vértice queda en un hueco, no añadas una cuña de unión sólida. Los extremos reales del trazo discontinuo pueden seguir solapando la esquina; no los recortes con la unión round o bevel del trazo sólido.
4. Los trazados cerrados conectan sus segmentos primero y último con sus distancias acumuladas reales. Los subtrazados independientes vuelven a empezar en cero.

La geometría permanece fija cuando cambia `strokeDashoffset`; solo cambia su uniform. El denominador del antialiasing por distancia con signo está acotado lejos de cero, también en los fragmentos de cobertura constante.

También podemos cambiar (incrementar) `stroke-dashoffset` en tiempo real para conseguir un efecto de línea de hormigas. Esos efectos de animación suelen implementarse mediante el atributo SVG del mismo nombre; consulta: [¿Cómo animar a lo largo de un path SVG al mismo tiempo que el path se anima?]

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    let polyline1;
    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        polyline1 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 200],
                [200, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeDasharray: [10, 10],
            strokeDashoffset: 0,
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);

        const polyline2 = new Polyline({
            points: [
                [300, 100],
                [300, 200],
                [500, 200],
                [500, 100],
            ],
            stroke: 'black',
            strokeWidth: 10,
            strokeDasharray: [20, 20],
            strokeDashoffset: 0,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);

        polyline1.addEventListener('pointerenter', () => {
            polyline1.stroke = 'green';
        });
        polyline1.addEventListener('pointerleave', () => {
            polyline1.stroke = 'black';
        });
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
        polyline1.strokeDashoffset += 0.1;
    });
});
```

Otro método de implementación usa `fract()`; consulta: [Línea discontinua en WebGL puro].

Según la especificación SVG, los atributos `stroke-dasharray` y `stroke-dashoffset` también pueden aplicarse a otras figuras, como Circle / Ellipse / Rect. Por tanto, cuando estos dos atributos tienen valores razonables, el contorno que originalmente se dibujaba con SDF tiene que pasar a una implementación de Polyline. Tomando Rect como ejemplo, pueden hacer falta hasta 3 draw calls para dibujar la sombra exterior, el cuerpo principal del rectángulo y el contorno discontinuo:

```ts
SHAPE_DRAWCALL_CTORS.set(Rect, [ShadowRect, SDF, SmoothPolyline]);
```

Para Rect, construye cinco puntos: las cuatro esquinas y el primer punto repetido. Al preparar las instancias de la GPU, conecta el punto anterior del primer segmento con el último segmento, y el punto siguiente del último segmento con el primero. Así se cierra la unión sin un segmento extra de longitud épsilon ni caps en los extremos. Circle y Ellipse usan el mismo cierre con más muestras (aquí `64`):

```ts
if (object instanceof Polyline) {
    points = object.points.reduce((prev, cur) => {
        prev.push(cur[0], cur[1]);
        return prev;
    }, [] as number[]);
} else if (object instanceof Rect) {
    const { x, y, width, height } = object;
    points = [x, y, x + width, y, x + width, y + height, x, y + height, x, y];
}
```

```js eval code=false
$icCanvas5 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect, Circle, Ellipse } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas5.parentElement.style.position = 'relative';
    $icCanvas5.parentElement.appendChild($stats);

    $icCanvas5.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const rect = new Rect({
            x: 50,
            y: 50,
            fill: 'black',
            fillOpacity: 0.5,
            dropShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            stroke: 'red',
            strokeWidth: 10,
        });
        rect.width = 100;
        rect.height = 100;
        canvas.appendChild(rect);

        const rect2 = new Rect({
            x: 200,
            y: 50,
            fill: 'black',
            fillOpacity: 0.5,
            stroke: 'red',
            strokeWidth: 10,
            dropShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            strokeDasharray: [5, 5],
        });
        rect2.width = 100;
        rect2.height = 100;
        canvas.appendChild(rect2);

        const circle = new Circle({
            cx: 400,
            cy: 100,
            r: 50,
            fill: 'black',
            stroke: 'red',
            strokeWidth: 20,
            strokeDasharray: [5, 5],
        });
        canvas.appendChild(circle);

        const circle2 = new Circle({
            cx: 550,
            cy: 100,
            r: 50,
            fill: 'black',
            stroke: 'red',
            strokeWidth: 20,
            strokeDasharray: [5, 20],
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle2);

        const ellipse = new Ellipse({
            cx: 150,
            cy: 250,
            rx: 100,
            ry: 50,
            fill: 'black',
            stroke: 'red',
            strokeWidth: 20,
            strokeDasharray: [5, 5],
        });
        canvas.appendChild(ellipse);
    });

    $icCanvas5.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## Cálculo de la caja delimitadora {#geometry-bounds}

Salgamos un momento del renderizado y hagamos algunos cálculos geométricos. Como se presentó en lecciones anteriores, las cajas delimitadoras hay que calcularlas tanto en el picking como en el culling.

Si se ignoran atributos de dibujo como el ancho de línea, el cálculo de la caja delimitadora geométrica es muy sencillo. Basta con encontrar las coordenadas mínima y máxima de todos los vértices de la polilínea:

```ts
const minX = Math.min(...points.map((point) => point[0]));
const maxX = Math.max(...points.map((point) => point[0]));
const minY = Math.min(...points.map((point) => point[1]));
const maxY = Math.max(...points.map((point) => point[1]));

return new AABB(minX, minY, maxX, maxY);
```

Cuando intervienen el ancho de línea, los extremos y las uniones, calcular la caja delimitadora de una polilínea se vuelve más complejo. Si no hace falta un resultado preciso, puedes simplemente extender hacia fuera la caja delimitadora anterior en la mitad del ancho de línea. [Calcular la caja delimitadora de una línea con grosor] usa el método [cairo-stroke-extents] que ofrece Cairo. Si el ancho de línea es `0`, se degrada a [cairo-path-extents]:

> Calcula una caja delimitadora en coordenadas de usuario que cubre el área que se vería afectada (el área «entintada»)

Si seguimos el código fuente de Cairo, se ve que, para las cajas delimitadoras del trazo, también ofrece dos métodos (aquí se omite un gran número de parámetros). El primero usa un método de estimación y por eso es más rápido, mientras que el segundo tiene en cuenta las formas concretas de los extremos y de las uniones para un cálculo preciso:

```c
cairo_private void
_cairo_path_fixed_approximate_stroke_extents ();

cairo_private cairo_status_t
_cairo_path_fixed_stroke_extents ();
```

### Estimación rápida {#approximate-stroke-extents}

Esta estimación consiste en expandir una cierta distancia hacia fuera, en las direcciones horizontal y vertical, a partir de la caja delimitadora geométrica: `style_expansion * strokeWidth`.

```c
/*
 * For a stroke in the given style, compute the maximum distance
 * from the path that vertices could be generated.  In the case
 * of rotation in the ctm, the distance will not be exact.
 */
void
_cairo_stroke_style_max_distance_from_path (const cairo_stroke_style_t *style,
         const cairo_path_fixed_t *path,
                                            const cairo_matrix_t *ctm,
                                            double *dx, double *dy)
{
    double style_expansion = 0.5;

    if (style->line_cap == CAIRO_LINE_CAP_SQUARE)
 style_expansion = M_SQRT1_2;

    if (style->line_join == CAIRO_LINE_JOIN_MITER &&
 ! path->stroke_is_rectilinear &&
 style_expansion < M_SQRT2 * style->miter_limit)
    {
 style_expansion = M_SQRT2 * style->miter_limit;
    }

    style_expansion *= style->line_width;
}
```

Considerando el caso de `stroke-linecap="square"`, la figura siguiente muestra que, en la situación más ideal, `style_expansion` es igual a `0.5`, es decir, se extiende `0.5 * strokeWidth` desde el cuerpo rojo, y el área negra es la caja delimitadora de `<polyline>`.

<svg xmlns="http://www.w3.org/2000/svg" width="400" height="30">
  <g>
    <polyline
      fill="none"
      stroke="black"
      stroke-width="20"
      stroke-linecap="square"
      points="10,10 300,10"
    />
    <polyline
      fill="none"
      stroke="red"
      stroke-width="2"
      points="10,10 300,10"
    />
  </g>
</svg>

Pero si la polilínea está ligeramente inclinada 45 grados, la distancia extendida hacia fuera en ese momento es `sqrt(2) / 2 * strokeWidth`:

<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
  <g>
    <polyline
      fill="none"
      stroke="black"
      stroke-width="20"
      stroke-linecap="square"
      points="30,30 200,200"
    />
    <polyline
      fill="none"
      stroke="red"
      stroke-width="2"
      points="30,30 200,200"
    />
    <polygon
      fill="none"
      stroke="red"
      stroke-width="2"
      points="15,15 215,15 215,215 15,215"
    />
  </g>
</svg>

Del mismo modo, también hay que considerar el caso de `stroke-linejoin="miter"`. Se puede ver que este método de estimación no considera con precisión cada vértice y cada unión, sino que solo hace la estimación más optimista para garantizar que la caja delimitadora pueda contener la polilínea.

Abajo dibujamos en tiempo real la caja delimitadora de la polilínea, mostrando de izquierda a derecha los distintos valores de `strokeLinecap`:

```js eval code=false
$icCanvas6 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline, Rect } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas6.parentElement.style.position = 'relative';
    $icCanvas6.parentElement.appendChild($stats);

    function drawBounds(canvas, polyline) {
        const { minX, minY, maxX, maxY } = polyline.getBounds();
        const bounds = new Rect({
            x: minX,
            y: minY,
            stroke: 'red',
            fill: 'none',
        });
        bounds.width = maxX - minX;
        bounds.height = maxY - minY;
        canvas.appendChild(bounds);
    }

    $icCanvas6.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        const polyline1 = new Polyline({
            points: [
                [100, 100],
                [200, 200],
            ],
            stroke: 'black',
            strokeWidth: 20,
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);
        drawBounds(canvas, polyline1);

        const polyline2 = new Polyline({
            points: [
                [300, 100],
                [400, 200],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeLinecap: 'round',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);
        drawBounds(canvas, polyline2);

        const polyline3 = new Polyline({
            points: [
                [500, 100],
                [600, 200],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeLinecap: 'square',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
        drawBounds(canvas, polyline3);
    });

    $icCanvas6.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### Cálculo preciso {#stroke-extents}

¿Y si de verdad quieres calcular con precisión? La idea de Cairo es convertirlo primero en un Polygon y después calcular su caja delimitadora:

![extensión del trazo](/polyline-extents.png)

```c
cairo_status_t
_cairo_path_fixed_stroke_extents (const cairo_path_fixed_t *path,
      const cairo_stroke_style_t *stroke_style,
      const cairo_matrix_t  *ctm,
      const cairo_matrix_t  *ctm_inverse,
      double    tolerance,
      cairo_rectangle_int_t  *extents)
{
    cairo_polygon_t polygon;
    cairo_status_t status;
    cairo_stroke_style_t style;

    _cairo_polygon_init (&polygon, NULL, 0);
    status = _cairo_path_fixed_stroke_to_polygon (path,
        stroke_style,
        ctm, ctm_inverse,
        tolerance,
        &polygon);
    _cairo_box_round_to_rectangle (&polygon.extents, extents);
    _cairo_polygon_fini (&polygon);

    return status;
}
```

## Pruebas de rendimiento {#perf}

Probemos el rendimiento, mostrando varias polilíneas que contienen cada una 20.000 puntos:

```js eval code=false
$icCanvas4 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas4.parentElement.style.position = 'relative';
    $icCanvas4.parentElement.appendChild($stats);

    let polyline1;
    $icCanvas4.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        const data = new Array(20000)
            .fill(undefined)
            .map((_, i) => [i, Math.random() * 50]);
        polyline1 = new Polyline({
            points: data,
            stroke: 'black',
            strokeWidth: 2,
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);

        const data2 = new Array(20000)
            .fill(undefined)
            .map((_, i) => [i, Math.random() * 50 + 100]);
        polyline2 = new Polyline({
            points: data2,
            stroke: 'black',
            strokeWidth: 2,
            strokeLinejoin: 'round',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);

        const data3 = new Array(20000)
            .fill(undefined)
            .map((_, i) => [i, Math.random() * 50 + 200]);
        polyline3 = new Polyline({
            points: data3,
            stroke: 'black',
            strokeWidth: 2,
            strokeDasharray: [4, 4],
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
    });

    $icCanvas4.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

No parece mal, pero, pensándolo con cuidado, siguen quedando los problemas siguientes, que pueden considerarse direcciones de mejora futuras:

-   Como cada Instance usa 15 vértices y el búfer tiene un límite de tamaño, el número real de vértices que contiene una sola polilínea está limitado
-   Actualmente, una polilínea corresponde a un draw call. ¿Qué pasa si hay una gran cantidad de polilíneas parecidas y repetidas? [regl-gpu-lines] ofrece dos ideas:
    -   Un draw call también puede dibujar varias polilíneas, usando `[NaN, NaN]` para indicar los puntos de corte; ejemplo: [Varias líneas]
    -   Si los datos de vértices de varias polilíneas son los mismos y solo cambia el desplazamiento, cada polilínea puede considerarse una Instance. Por supuesto, los vértices del interior de cada polilínea tienen que expandirse; ejemplo: [Instanciado simulado]
-   Simplificar vértices según el nivel de zoom actual de la cámara

A continuación seguimos optimizando en esa misma línea.

### Polilínea con varios segmentos {#polyline-with-multiple-segments}

Siguiendo la línea de la optimización anterior para reducir el número de draw calls, podemos empalmar varias polilíneas, aunque por supuesto tenemos que usar algún tipo de separador. Como en [regl-gpu-lines], usamos `[NaN, NaN]`. Y pronto lo usaremos al dibujar paths: ¡un path puede contener varios subtrazados!

```bash
Polyline1: [[0, 0], [100, 100]]
Polyline2: [[100, 0], [200, 100]]
MultiPolyline: [[0, 0], [100, 100], [NaN, NaN], [100, 0], [200, 100]]
```

Después de dividir por el separador, el arreglo de vértices de cada segmento se sigue construyendo del mismo modo que arriba:

```ts
const subPaths = [];
let lastNaNIndex = 0;
for (let i = 0; i < points.length; i += stridePoints) {
    if (isNaN(points[i]) || isNaN(points[i + 1])) {
        subPaths.push(points.slice(lastNaNIndex, i));
        lastNaNIndex = i + 2;
    }
}
subPaths.push(points.slice(lastNaNIndex));
subPaths.forEach((points) => {
    // Omit constructing each segments
});
```

El efecto es el siguiente, con estas notas:

-   Como las distintas líneas quebradas se fusionan en una, el picking también sigue al conjunto. Prueba a pasar el ratón por encima de los tres conjuntos de líneas de abajo.
-   Al exportar a SVG, ya no es posible exportar directamente al elemento `<polyline>` correspondiente.

```js eval code=false
$icCanvas7 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas7.parentElement.style.position = 'relative';
    $icCanvas7.parentElement.appendChild($stats);

    $icCanvas7.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        const data = new Array(200).fill(undefined).map((_, i) => [
            [Math.random() * 200, Math.random() * 200],
            [Math.random() * 200, Math.random() * 200],
            [NaN, NaN],
        ]);
        const polyline = new Polyline({
            points: data.flat(1),
            stroke: 'black',
            strokeWidth: 2,
            strokeLinecap: 'round',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline);
        polyline.addEventListener(
            'pointerenter',
            () => (polyline.stroke = 'red'),
        );
        polyline.addEventListener(
            'pointerleave',
            () => (polyline.stroke = 'black'),
        );

        const data2 = new Array(200).fill(undefined).map((_, i) => [
            [Math.random() * 200 + 200, Math.random() * 200],
            [Math.random() * 200 + 200, Math.random() * 200],
            [NaN, NaN],
        ]);
        const polyline2 = new Polyline({
            points: data2.flat(1),
            stroke: 'black',
            strokeWidth: 2,
            strokeLinecap: 'round',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);
        polyline2.addEventListener(
            'pointerenter',
            () => (polyline2.stroke = 'green'),
        );
        polyline2.addEventListener(
            'pointerleave',
            () => (polyline2.stroke = 'black'),
        );

        const data3 = new Array(200).fill(undefined).map((_, i) => [
            [Math.random() * 200 + 400, Math.random() * 200],
            [Math.random() * 200 + 400, Math.random() * 200],
            [NaN, NaN],
        ]);
        const polyline3 = new Polyline({
            points: data3.flat(1),
            stroke: 'black',
            strokeWidth: 2,
            strokeLinecap: 'round',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
        polyline3.addEventListener(
            'pointerenter',
            () => (polyline3.stroke = 'blue'),
        );
        polyline3.addEventListener(
            'pointerleave',
            () => (polyline3.stroke = 'black'),
        );
    });

    $icCanvas7.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### [WIP] Fusionar polilíneas parecidas {#merge-similar-polylines}

### Simplificar la polilínea {#simplify-polyline}

Para las polilíneas (y, más adelante, los Path y los Polygon) que contienen un gran número de vértices, una optimización importante es simplificarlas según el nivel de zoom actual, reduciendo todo lo posible la cantidad de datos renderizados. La base de la simplificación es doble:

1. Se pueden filtrar los segmentos demasiado cortos y los polígonos demasiado pequeños.
2. Se pueden filtrar los vértices de una polilínea que apenas afectan a la forma global.

El algoritmo básico para simplificar los vértices de un segmento es el [Algoritmo de Ramer–Douglas–Peucker], que funciona así:

1. Primero conserva el primer y el último vértice de la polilínea y conéctalos.
2. Entre los vértices restantes, encuentra el más alejado del segmento y conserva esa distancia.
3. Si la distancia es menor que un umbral, descártalo.
4. Si la distancia es mayor que el umbral, consérvalo. Si la distancia es menor que el umbral, descártalo. Si la distancia es mayor que el umbral, consérvalo.
5. El método de partición trata los dos subsegmentos y vuelve al paso 1.

El diagrama de abajo (de la wiki) muestra el proceso: los puntos rojos se descartan y los puntos verdes se conservan.

![Simplificación de una curva lineal a trozos con el algoritmo de Douglas–Peucker.](https://upload.wikimedia.org/wikipedia/commons/3/30/Douglas-Peucker_animated.gif)

Es evidente que, cuanto mayor es el umbral (ε) elegido, menor es el número de vértices (n) que quedan tras la simplificación final, y menos suave será la polilínea:

![El efecto de variar épsilon en una implementación paramétrica de RDP](https://upload.wikimedia.org/wikipedia/commons/6/69/RDP%2C_varying_epsilon.gif)

Hay muchas implementaciones en JS basadas en este algoritmo: [simplify-js], [turf-simplify], [geojson-vt], etc. Tomemos como ejemplo la implementación de geojson-vt:

```ts
export default function simplify(coords, first, last, sqTolerance) {
    let maxSqDist = sqTolerance;
    const mid = (last - first) >> 1;
    let minPosToMid = last - first;
    let index; // index of maximum distance

    const ax = coords[first];
    const ay = coords[first + 1];
    const bx = coords[last];
    const by = coords[last + 1];

    // Find the point with the greatest distance from the line segment
    for (let i = first + 3; i < last; i += 3) {
        const d = getSqSegDist(coords[i], coords[i + 1], ax, ay, bx, by);
        if (d > maxSqDist) {
            index = i;
            maxSqDist = d;
        }
    }

    if (maxSqDist > sqTolerance) {
        // Recursively process the first half of the line segment
        if (index - first > 3) simplify(coords, first, index, sqTolerance);
        // Preserving the maximum distance indicates that this vertex needs to be preserved
        coords[index + 2] = maxSqDist;
        // Half of the line segments after recursive processing
        if (last - index > 3) simplify(coords, index, last, sqTolerance);
    }
}
```

Usaremos este método más adelante en [Lección 25 - Usar la polilínea en modo pincel].

## Otras cuestiones {#followup-issues}

Hasta aquí hemos completado el trabajo básico de dibujo de las polilíneas. Por último, veamos otras cuestiones relacionadas. Por limitaciones de espacio, algunas se detallarán en lecciones futuras.

### SizeAttenuation {#size-attenuation}

En algunas situaciones no queremos que los gráficos cambien de tamaño con el zoom de la cámara, como la malla de alambre de la caja delimitadora y las etiquetas de tamaño que hay debajo al seleccionar una figura en Figma:

![atenuación del tamaño en Figma](/size-attenuation.gif)

Esto se llama `sizeAttenuation` en Three.js. En el modo de proyección en perspectiva, los Sprites se vuelven más pequeños a medida que aumenta la profundidad de la cámara. Lo implementaremos más adelante, cuando implementemos la UI de selección.

### Línea, path y polígono {#line-path-polygon}

En SVG siguen quedando tres elementos: `<line>`, `<path>` y `<polygon>`, entre los cuales:

-   `<line>` no necesita considerar `strokeLinejoin`, así que se puede simplificar el número de vértices usados
-   La parte de relleno de `<polygon>` puede dibujarse después de triangular con algunos algoritmos como earcut, y la parte del contorno es exactamente igual que la polilínea
-   `<path>` también puede muestrearse sobre el trazado de una forma parecida a `<rect>` y `<circle>`, y dibujarse al final con polilíneas, pero aparece este problema: [Dibujar arcos: los arcos no son suaves (ISSUE)]

Presentaremos en detalle cómo dibujarlos en la lección siguiente.

## Lectura adicional {#extended-reading}

-   [Cómo dibujar líneas en WebGL]
-   [regl-gpu-lines]
-   [Dibujar líneas instanciadas con regl]
-   [Renderizado de líneas instanciadas, parte I]
-   [Renderizado de líneas instanciadas, parte II]
-   [pixijs/graphics-smooth]
-   [Polar Stroking: nueva teoría y métodos para trazar paths]

[Lección 5 - Cuadrícula de líneas]: /es/guide/lesson-005#lines-grid
[lineJoin]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineJoin
[lineCap]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineCap
[lineWidth]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/lineWidth
[points]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/points
[stroke-linejoin]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linejoin
[stroke-linecap]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap
[stroke-dashoffset]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dashoffset
[stroke-dasharray]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray
[Renderizado de líneas instanciadas, parte I]: https://wwwtyro.net/2019/11/18/instanced-lines.html
[Renderizado de líneas instanciadas, parte II]: https://wwwtyro.net/2021/10/01/instanced-lines-part-2.html
[LineLayer]: https://deck.gl/docs/api-reference/layers/line-layer
[PathLayer]: https://deck.gl/docs/api-reference/layers/path-layer
[Dibujar líneas con antialiasing en OpenGL]: https://blog.mapbox.com/drawing-antialiased-lines-with-opengl-8766f34192dc
[regl-gpu-lines]: https://github.com/rreusser/regl-gpu-lines
[ejemplo instanciado]: https://rreusser.github.io/regl-gpu-lines/docs/instanced.html
[Dibujar líneas instanciadas con regl]: https://observablehq.com/@rreusser/drawing-instanced-lines-with-regl
[pixijs/graphics-smooth]: https://github.com/pixijs/graphics-smooth
[Cómo dibujar líneas en WebGL]: https://www.khronos.org/assets/uploads/developers/presentations/Crazy_Panda_How_to_draw_lines_in_WebGL.pdf
[dibujo instanciado]: /es/guide/lesson-008#instanced
[Antialiasing en SDF]: /es/guide/lesson-002#antialiasing
[Dibujar la sombra exterior del rectángulo]: /es/guide/lesson-009#drop-shadow
[Problema de instanciado en WebGPU]: https://github.com/pixijs/pixijs/issues/7511#issuecomment-2247464973
[especificación: es útil permitir que GPUVertexBufferLayout.arrayStride sea menor que offset + sizeof(attrib.format)]: https://github.com/gpuweb/gpuweb/issues/2349
[Dibujar arcos: los arcos no son suaves (ISSUE)]: https://github.com/pixijs/graphics-smooth/issues/23
[SVG mejorado: alineación del trazo]: /es/guide/lesson-010#stroke-alignment
[Calcular la caja delimitadora de una línea con grosor]: https://stackoverflow.com/questions/51210467/calculate-bounding-box-of-line-with-thickness
[cairo-stroke-extents]: https://cairographics.org/manual/cairo-cairo-t.html#cairo-stroke-extents
[cairo-path-extents]: https://cairographics.org/manual/cairo-Paths.html#cairo-path-extents
[Cairo: corrección de las uniones redondeadas]: https://gitlab.freedesktop.org/cairo/cairo/-/merge_requests/372#note_1698225
[Línea discontinua en WebGL puro]: https://webgl2fundamentals.org/webgl/lessons/webgl-qna-pure-webgl-dashed-line.html
[¿Cómo animar a lo largo de un path SVG al mismo tiempo que el path se anima?]: https://benfrain.com/how-to-animate-along-an-svg-path-at-the-same-time-the-path-animates/
[Instanciado simulado]: https://rreusser.github.io/regl-gpu-lines/docs/instanced.html
[Varias líneas]: https://rreusser.github.io/regl-gpu-lines/docs/multiple.html
[Desplazamiento en bytes dentro del búfer donde empiezan los datos de vértices]: https://www.w3.org/TR/webgpu/#dom-gpurendercommandsmixin-setvertexbuffer-slot-buffer-offset-size-offset
[simplify-js]: https://github.com/mourner/simplify-js
[geojson-vt]: https://github.com/mapbox/geojson-vt
[turf-simplify]: https://github.com/Turfjs/turf/tree/master/packages/turf-simplify
[Algoritmo de Ramer–Douglas–Peucker]: https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
[Lección 25 - Usar la polilínea en modo pincel]: /es/guide/lesson-025#use-polyline
[Polar Stroking: nueva teoría y métodos para trazar paths]: https://developer.download.nvidia.com/video/siggraph/2020/presentations/sig03-polar-stroking-new-theory-and-methods-for-stroking-paths.pdf
