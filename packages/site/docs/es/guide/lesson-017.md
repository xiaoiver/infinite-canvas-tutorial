---
outline: deep
description: 'Implementa degradados y patrones con la API CanvasGradient, crea degradados de malla con shaders que incluyen efectos de ruido y construye paneles de edición de degradados. Admite la sintaxis de degradados de CSS y los patrones que se repiten.'
head:
    - [
          'meta',
          { property: 'og:title', content: 'Lección 17 - Degradado y patrón' },
      ]
---

<script setup>
import Gradient from '../../components/Gradient.vue';
import MeshGradient from '../../components/MeshGradient.vue';
import DeclarativeGradient from '../../components/DeclarativeGradient.vue';
import Pattern from '../../components/Pattern.vue';
import Voronoi from '../../components/Voronoi.vue';
import FractalBrownianMotion from '../../components/FractalBrownianMotion.vue';
import DomainWarping from '../../components/DomainWarping.vue';
</script>

# Lección 17 - Degradado y patrón {#lesson-17-gradient-and-pattern}

En esta lección veremos cómo implementar degradados y patrones que se repiten.

-   Usar CanvasGradient para implementar degradados
    -   Imperativo. Crear texturas con la API Device
    -   Declarativo. Admite la sintaxis de degradados de CSS: `linear-gradient`, `radial-gradient`, `conic-gradient`
    -   Usar Shoelace para implementar el panel de configuración del degradado
-   Usar un shader para implementar el degradado de malla
    -   Simular el azar
    -   Ruido de valor y ruido de gradiente
    -   Voronoi, FBM y Domain Warping
-   Exportar a SVG
-   Usar CanvasPattern para implementar patrones que se repiten

## Usar CanvasGradient {#canvas-gradient}

Podemos usar la API [CanvasGradient] para crear distintos efectos de degradado, que después se consumen como texturas. Presentaremos tanto la implementación imperativa como la declarativa.

### Crear texturas de degradado de forma imperativa {#create-gradient-texture}

Tomando el degradado lineal como ejemplo, después de crear un `<canvas>` y obtener su contexto, [createLinearGradient] necesita los puntos inicial y final que definen la dirección del degradado. Después se añaden varias paradas de color, se dibuja en el `<canvas>` y se usa como origen para crear texturas:

```ts
const gradient = ctx.createLinearGradient(0, 0, 1, 0); // x1, y1, x2, y2

gradient.addColorStop(0, 'red');
gradient.addColorStop(1, 'blue');

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 256, 1);
```

Crea un objeto de textura con la API [Device] y, por último, pásalo a la propiedad `fill` de la forma para completar el dibujo.

```ts
// 0. Create gradient data
const ramp = generateColorRamp({
    colors: [
        '#FF4818',
        '#F7B74A',
        '#FFF598',
        '#91EABC',
        '#2EA9A1',
        '#206C7C',
    ].reverse(),
    positions: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
});

// 1. Get canvas device
const device = canvas.getDevice();

// 2. Create texture object
const texture = device.createTexture({
    format: Format.U8_RGBA_NORM,
    width: ramp.width,
    height: ramp.height,
    usage: TextureUsage.SAMPLED,
});
texture.setImageData([ramp.data]); // Pass the previously created <canvas> data to texture

// 3. Pass the texture object to the shape's `fill` property
rect.fill = { texture };
```

<Gradient />

Sin embargo, queremos admitir una sintaxis declarativa para mejorar la facilidad de uso y facilitar la serialización.

### Sintaxis declarativa de degradados CSS {#css-gradient-syntax}

Siguiendo la sintaxis de degradados de CSS, podemos usar [gradient-parser] para obtener resultados estructurados, que después sirven para llamar a API como [createLinearGradient]:

```ts
rect.fill = 'linear-gradient(0deg, blue, green 40%, red)';
rect.fill = 'radial-gradient(circle at center, red, blue, green 100%)';
```

En ECS, los nombres de las funciones de degradado y las palabras clave de dirección, forma, tamaño y posición no distinguen mayúsculas de minúsculas. La detección comprueba el nombre de la función, así que una URL de imagen que contenga `linear` o `radial` no se trata como un degradado. Las posiciones de dos palabras clave, como `top center` y `bottom center`, conservan el eje vertical. Los degradados radiales circulares también admiten centros fuera de los límites: `closest-side` usa la distancia al lado más cercano, que sigue siendo no negativa.

El analizador admite degradados radiales circulares; los degradados elípticos y los que se repiten aún no se renderizan. Las cadenas cónicas usan por ahora el ángulo predeterminado y la sintaxis de posición ya existente `circle at …`; la sintaxis CSS `from … at …` no está implementada. Los valores estructurados de `ConicGradient.angle` están en grados, con la misma orientación en los rellenos normales y en las entradas de filtro.

Los resultados del análisis son los siguientes:

```js eval code=false
linearGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient('linear-gradient(0deg, blue, green 40%, red)');
});
```

```js eval code=false
radialGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient(
        'radial-gradient(circle at center, red, blue, green 100%)',
    );
});
```

Hay varios tipos habituales de degradado, y por ahora admitimos los tres primeros:

-   [linear-gradient] Admitido por CSS y Canvas
-   [radial-gradient] Admitido por CSS y Canvas
-   [conic-gradient] Admitido por CSS y Canvas
-   [repeating-linear-gradient] Admitido por CSS; se puede simular con Canvas, consulta [Cómo hacer un CanvasGradient que se repite]
-   [repeating-radial-gradient] Admitido por CSS
-   [sweep-gradient] Admitido en CanvasKit / Skia

<DeclarativeGradient />

Además, admitimos superponer varios degradados, por ejemplo:

```ts
rect.fill = `linear-gradient(217deg, rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%),
    linear-gradient(127deg, rgba(0,255,0,.8), rgba(0,255,0,0) 70.71%),
    linear-gradient(336deg, rgba(0,0,255,.8), rgba(0,0,255,0) 70.71%)`;
```

### Panel de edición de degradados {#gradient-editor}

Inspirados en el panel de edición de degradados de Figma, hemos implementado un editor parecido. Puedes abrir el panel de edición seleccionando una forma en el ejemplo de arriba.

![Panel de degradado de Figma](/figma-gradient-panel.png)

## Aplicar degradados al relleno y al trazo {#applying-gradients-to-fill-and-stroke}

Los degradados de relleno los consumen llamadas de dibujo como `SDF` y `Mesh`, mientras que los degradados de trazo los consume `SmoothPolyline`. Una vez que el degradado se ha rasterizado en una textura, la pregunta que queda es cómo calcular las UV en el shader de vértices.

En los rellenos de malla, el shader de vértices usa **`u_FillUVRect`** (`minX`, `minY`, `1/width`, `1/height`) para transformar las **coordenadas locales de la geometría** al espacio de la textura.

En los trazos, el shader de vértices ya tiene **`pos`** en el **espacio de mundo** después de la matriz de modelo: el punto expandido sobre la cinta del trazo. Para alinearlo con **`ComputedBounds.geometryBounds`**, volvemos al **espacio local**, restamos `min` y multiplicamos por la extensión inversa:

`local = inverse(model) * vec3(pos, 1.0)`, y después `v_StrokeUv = (local.xy - u_StrokeUVRect.xy) * u_StrokeUVRect.zw`.

En la ruta de **WebGPU**, cuando GLSL se rebaja a WGSL a través de **naga**, **`inverse(mat3)` no se admite**, así que la implementación usa un **`inverseMat3`** escrito a mano (adjunta / determinante) en lugar del `inverse` integrado.

## Implementar degradados con malla {#mesh-gradient}

El analizador de degradado de malla de ECS conserva las posiciones explícitas de los puntos. Los controles opcionales de tipo, warp y tiempo se pueden serializar y volver a analizar. En los modos que usan un número variable de puntos, `points(10)` conserva la décima ranura del shader; el modo de malla fija (`gtype(2)`) sigue usando su cuadrícula de 3×3. Los datos uniform empaquetados usan 92 floats en un búfer de 96 floats, incluido el relleno de alineación.

Los degradados implementados a partir de Canvas y SVG tienen una expresividad limitada y no pueden mostrar efectos complejos. Algunas herramientas de diseño, como Sketch / Figma, tienen muchas implementaciones basadas en mallas en sus comunidades, por ejemplo:

-   [Complemento de degradados de malla para Sketch]
-   [Complemento Mesh Gradient para Figma]
-   [Complemento de degradado fotográfico para Figma]
-   [Complemento de ruido y textura para Figma]

Nos basamos en algunas implementaciones de código abierto, unas hechas en el shader de vértices y otras en el shader de fragmentos. Elegimos estas últimas:

-   [meshgradient]
-   [Generador de degradado de malla]
-   [react-mesh-gradient]

<MeshGradient />

Por la compatibilidad con la sintaxis GLSL 100 de WebGL1, hay que evitar `switch`; si no, aparecen errores como este:

> [!CAUTION]
> ERROR: 0:78: 'switch' : Illegal use of reserved word

Además, en los bucles `for` no se puede usar un uniform como condición de terminación de `index`:

> [!CAUTION]
> ERROR: 0:87: 'i' : Loop index cannot be compared with non-constant expression

Por eso solo podemos usar la constante `MAX_POINTS` para limitar las iteraciones del bucle, de forma parecida a cómo los chunks de Three.js tratan las fuentes de luz:

```glsl
#define MAX_POINTS 10

for (int i = 0; i < MAX_POINTS; i++) {
    if (i < int(u_PointsNum)) {
        // ...
    }
}
```

Ahora entremos en los detalles de los shaders. Puedes consultar [The Book of Shaders: diseño generativo] para conocer más detalles.

### Aleatorio {#random}

Para implementar efectos de ruido necesitamos una función aleatoria. Sin embargo, GLSL no tiene una función `random` integrada, así que hay que simular ese comportamiento. Como es una simulación, para el mismo `random(x)` siempre se obtiene el mismo valor de retorno: es un número pseudoaleatorio.

Si queremos una función `random` que devuelva un valor entre 0 y 1, podemos usar `y = fract(sin(x)*1.0);`, que solo conserva la parte decimal.

![y = fract(sin(x)*1.0)](https://xiaoiver.github.io/assets/img/resized/480/tbs-rand1.png)

Al observar esta función, se ve que, si reducimos el periodo hasta hacerlo extremadamente corto, los valores que corresponden a una misma x pueden considerarse aproximadamente aleatorios (pseudoaleatorios). El método concreto consiste en aumentar el coeficiente, por ejemplo `y = fract(sin(x)*10.0);`.

![y = fract(sin(x)*10.0)](https://xiaoiver.github.io/assets/img/resized/480/tbs-rand2.png)

Si se sube aún más, hasta 100000, ya no se distingue la forma de onda de `sin`. Conviene insistir en que, a diferencia de `Math.random()` en JS, este método es un aleatorio determinista y, en esencia, es una función hash.

Hay que aplicar la función `random` a una escena 2D, donde la entrada pasa de una sola `x` a una coordenada `xy`. Hay que transformar el vector 2D en un único valor. The Book of Shaders usa la función integrada `dot` para multiplicar un vector concreto, pero no explica por qué.

```glsl
float random (vec2 st) {
    return fract(sin(
        dot(st.xy,vec2(12.9898,78.233)))*
        43758.5453123);
}
```

Tras buscar en internet, encontramos esta respuesta: [¿Cuál es el origen de este rand() de una línea en GLSL?]. Se dice que proviene originalmente de un artículo, y no hay explicación de por qué se eligieron los tres números mágicos. En cualquier caso, el efecto generado es bueno, parecido a la «nieve» de un televisor en blanco y negro. Puedes ver este efecto aumentando el `NoiseRatio` en el ejemplo de arriba.

### Ruido de valor {#value-noise}

Con la función `random` que definimos y con `floor` se puede obtener una función en escalones.

```glsl
float i = floor(x);
y = random(i);
```

![escalón](https://xiaoiver.github.io/assets/img/webgl/tbs-noise1.png)

Si queremos interpolar entre «escalones» adyacentes, podemos usar una función lineal o la función de interpolación suave `smoothstep`:

```glsl
float i = floor(x);
float f = fract(x);
y = mix(rand(i), rand(i + 1.0), f);
// y = mix(rand(i), rand(i + 1.0), smoothstep(0.,1.,f));
```

![smoothstep](https://xiaoiver.github.io/assets/img/webgl/tbs-noise2.png)

En una dimensión elegimos `i+1` y, en dos dimensiones, podemos elegir los 4 puntos adyacentes. La función de mezcla correspondiente también hay que modificarla. La función de mezcla del texto original es la forma expandida, un poco difícil de entender, pero tiene la ventaja de llamar a `mix` dos veces menos.

```glsl
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = smoothstep(0.,1.,f);

    // Mix 4 coorners percentages
    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;

    // It's actually the expanded form below
    return mix( mix( a, b , u.x),
                mix( c, d, u.x), u.y);
}
```

El método anterior de generar ruido es una interpolación entre valores aleatorios, por eso se llama «ruido de valor». Si se observa con atención, se ve que este método genera resultados con rastros de bloques evidentes, como la parte izquierda del ejemplo de abajo.

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/lsf3WH?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

### Ruido de gradiente {#gradient-noise}

> En 1985, Ken Perlin desarrolló otro algoritmo de ruido llamado ruido de gradiente (Gradient Noise). Ken resolvió cómo insertar degradados aleatorios (gradientes, gradientes) en lugar de un valor fijo. Esos valores de gradiente proceden de una función aleatoria bidimensional, que devuelve una dirección (un vector en formato vec2) en lugar de un único valor (formato float).

El algoritmo concreto es el siguiente, y la mayor diferencia con el ruido de valor es el uso de `dot` para interpolar las cuatro direcciones:

```glsl
float noise( in vec2 st ) {
    vec2 i = floor(st);
    vec2 f = fract(st);

 vec2 u = smoothstep(0., 1., f);

    return mix( mix( dot( random( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ),
                     dot( random( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                mix( dot( random( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ),
                     dot( random( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
}
```

> Para Ken Perlin, el éxito de su algoritmo no era suficiente. Sentía que podía ser mejor. En el Siggraph de 2001 presentó el «ruido simplex».

La implementación concreta se encuentra en [2d-snoise-clear], y también hay una versión 3D.

### Ruido de Voronoi {#voronoi-noise}

Ya vimos cómo dividir el espacio en pequeñas áreas de cuadrícula en la sección «Dibujar un patrón». Se puede generar un punto característico aleatorio para cada cuadrícula y, para un fragmento dentro de una cuadrícula, solo hace falta calcular la distancia mínima a los puntos característicos de las 8 cuadrículas adyacentes, lo que reduce mucho la cantidad de cálculo. Esta es la idea principal del artículo de Steven Worley.

Los puntos característicos aleatorios usan el método `random` que vimos antes; como es un aleatorio determinista, los puntos característicos de cada cuadrícula son fijos.

```glsl
// Divide the grid
vec2 i_st = floor(st);
vec2 f_st = fract(st);
float m_dist = 1.;
// 8 directions
for (int y= -1; y <= 1; y++) {
    for (int x= -1; x <= 1; x++) {
        // Current adjacent grid
        vec2 neighbor = vec2(float(x),float(y));
        // Feature point in adjacent grid
        vec2 point = random2(i_st + neighbor);
        // Distance from fragment to feature point
        vec2 diff = neighbor + point - f_st;
        float dist = length(diff);
        // Save the minimum value
        m_dist = min(m_dist, dist);
    }
}
color += m_dist;
```

<Voronoi />

La implementación del ruido de Voronoi basada en esta idea se encuentra en [lygia/generative].

### fBM {#fbm}

Consulta [fBM de Inigo Quilez]; el `noise` puede ser ruido de valor o ruido de gradiente:

> Así que vamos a usar un fBM (movimiento browniano fraccionario, Fractional Brownian Motion) estándar, que es una suma sencilla de ondas de ruido con frecuencias crecientes y amplitudes decrecientes.

El texto original también explica con detalle por qué se usa `gain = 0.5`, que corresponde a `H = 1`. `H` refleja la «autosimilitud» de la curva y se usa en la generación procedural para simular formas naturales como nubes, montañas y océanos:

$$ G=2^{-H} $$

```glsl
const int octaves = 6;
float lacunarity = 2.0;
float gain = 0.5;

float amplitude = 0.5;
float frequency = 1.;

for (int i = 0; i < octaves; i++) {
 y += amplitude * noise(frequency*x);
 frequency *= lacunarity;
 amplitude *= gain;
}
```

<FractalBrownianMotion />

Consulta [Domain Warping de Inigo Quilez] y [Domain Warping de Mike Bostock]. Se llama a `fbm` de forma recursiva:

```glsl
f(p) = fbm( p )
f(p) = fbm( p + fbm( p ) )
f(p) = fbm( p + fbm( p + fbm( p )) )
```

<DomainWarping />

## Implementar patrones {#pattern}

Podemos usar [createPattern] de la API Canvas para crear patrones, con la sintaxis siguiente:

```ts
export interface Pattern {
    image: string | CanvasImageSource;
    repetition?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
    transform?: string;
}

rect.fill = {
    image,
    repetition: 'repeat',
};
```

La cadena `transform` hay que analizarla y convertirla en `mat3`, y después pasarla a [setTransform].

<Pattern />

## Exportar degradados a SVG {#export-gradient-to-svg}

### Degradado lineal {#linear-gradient}

SVG ofrece [linearGradient] y [radialGradient], pero los atributos que admiten son bastante distintos de [CanvasGradient].

### Degradado cónico {#conic-gradient}

Consulta [Degradado angular en SVG] para una implementación aproximada. El enfoque del [Polyfill de conic-gradient() de CSS] consiste en renderizar con Canvas y exportar como dataURL, y después referenciarlo con `<image>`.

### Superposición de varios degradados {#multiple-gradient-overlay}

Para superponer varios degradados, en la API Canvas puedes asignar `fillStyle` varias veces. En SVG declarativo puedes usar varios `<feBlend>` para conseguirlo.

## Lectura adicional {#extended-reading}

-   [Un degradado WebGL fluido, desmontado]
-   [Degradado de malla estático]

[CanvasGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasGradient
[Device]: /reference/canvas#getdevice
[linear-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient
[radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/radial-gradient
[repeating-linear-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-linear-gradient
[repeating-radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-radial-gradient
[conic-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/conic-gradient
[sweep-gradient]: https://stackoverflow.com/questions/44912075/sweep-gradient-what-it-is-and-its-examples
[gradient-parser]: https://github.com/rafaelcaricio/gradient-parser
[Complemento de degradados de malla para Sketch]: https://www.meshgradients.com/
[Complemento Mesh Gradient para Figma]: https://www.figma.com/community/plugin/958202093377483021/mesh-gradient
[Complemento de degradado fotográfico para Figma]: https://www.figma.com/community/plugin/1438020299097238961/photo-gradient
[Complemento de ruido y textura para Figma]: https://www.figma.com/community/plugin/1138854718618193875
[meshgradient]: https://meshgradient.com/
[Generador de degradado de malla]: https://kevingrajeda.github.io/meshGradient/
[react-mesh-gradient]: https://github.com/JohnnyLeek1/React-Mesh-Gradient
[fBM de Inigo Quilez]: https://iquilezles.org/articles/fbm/
[Domain Warping de Inigo Quilez]: https://iquilezles.org/articles/warp/
[Domain Warping de Mike Bostock]: https://observablehq.com/@mbostock/domain-warping
[linearGradient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/linearGradient
[radialGradient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/radialGradient
[createLinearGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient
[Degradado angular en SVG]: https://stackoverflow.com/questions/2465405/svg-angular-gradient
[Cómo hacer un CanvasGradient que se repite]: https://stackoverflow.com/questions/56398519/how-to-make-a-repeating-canvasgradient
[Polyfill de conic-gradient() de CSS]: https://projects.verou.me/conic-gradient/
[createPattern]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createPattern
[setTransform]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasPattern/setTransform
[¿Cuál es el origen de este rand() de una línea en GLSL?]: https://stackoverflow.com/questions/12964279/whats-the-origin-of-this-glsl-rand-one-liner
[The Book of Shaders: diseño generativo]: https://thebookofshaders.com/10/
[2d-snoise-clear]: https://thebookofshaders.com/edit.php#11/2d-snoise-clear.frag
[lygia/generative]: https://lygia.xyz/generative
[Un degradado WebGL fluido, desmontado]: https://alexharri.com/blog/webgl-gradients
[Degradado de malla estático]: https://shaders.paper.design/static-mesh-gradient
