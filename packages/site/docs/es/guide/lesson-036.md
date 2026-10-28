---
outline: deep
description: 'Implementa un sistema de animación: diseño de una API de animación declarativa, compatibilidad con la Web Animations API, flujo de animación basado en generadores y técnicas de animación de trazados SVG.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 36 - Animación' }]
---

<script setup>
import AnimationController from '../../components/AnimationController.vue';
import AnimationEasing from '../../components/AnimationEasing.vue';
import AnimationTransformOrigin from '../../components/AnimationTransformOrigin.vue';
import AnimationDasharray from '../../components/AnimationDasharray.vue';
import AnimationDashoffset from '../../components/AnimationDashoffset.vue';
import AnimationMorphing from '../../components/AnimationMorphing.vue';
import AnimationLottieBouncyBall from '../../components/AnimationLottieBouncyBall.vue';
import AnimationLottiePolyStar from '../../components/AnimationLottiePolyStar.vue';
import AnimationLottieRepeater from '../../components/AnimationLottieRepeater.vue';
import AnimationTimeline from '../../components/AnimationTimeline.vue';
</script>

# Lección 36 - Animación {#lesson-36-animation}

En esta lección aprenderás:

-   Cómo diseñar una API de animación
-   Cómo implementar fotogramas clave declarativos y controladores alineados con la Web Animations API
-   Cómo implementar efectos de trazado, de trazo y de morphing
-   Cómo encajan formatos como Lottie

## Cómo diseñar la API de animación {#api-design}

Motion es totalmente compatible con la animación declarativa al estilo de WAAPI; consulta [Mejoras de la Web Animations API]. Llama al `element.animate()` nativo del navegador para obtener aceleración por GPU, un hilo compositor independiente y trabajo fuera del hilo principal. JavaScript cubre lo que queda fuera de WAAPI:

-   Física de muelle (WAAPI solo admite easing de Bézier)
-   Propiedades `transform` independientes (anima `x`, `y` y `scale` por separado, en lugar de una única cadena de transform combinada)
-   `transformOrigin` para los centros de escala y rotación
-   Ayudas de línea de tiempo como `sequence()` y `stagger()`

```ts
import { animate, stagger } from 'motion';

// Returns a controller you can pause, play, and reverse
const controls = animate(
    '.box',
    { x: [0, 100], opacity: [0, 1] }, // keyframes
    { duration: 0.5, delay: stagger(0.1), easing: 'spring(1, 100, 10, 0)' },
);

// Serializable control calls
controls.pause();
controls.play();
controls.reverse();
```

Los fotogramas clave y las opciones son objetos planos y se pueden serializar a JSON. El estado de ejecución de `animate()` —enlaces con el DOM, tiempo actual, velocidad, etc.— no se puede serializar.

## Seguir la WAAPI {#waapi}

Podemos seguir el polyfill de WAAPI [web-animations-js] e integrarlo con nuestro ECS.

**Capa de datos:** fotogramas clave al estilo de WAAPI (serializables)

```ts
interface Keyframe {
    offset?: number; // 0–1, same role as WAAPI offset
    [property: string]: any; // x, y, scale, fill, strokeWidth...
    easing?: string; // "ease-out", "spring(1, 100)"
}

interface AnimationOptions {
    duration: number; // ms
    delay?: number;
    iterations?: number | 'infinite';
    direction?: 'normal' | 'reverse' | 'alternate';
    fill?: 'forwards' | 'backwards' | 'both'; // How the animation appears when not running (before start, after end).
    easing?: string; // Global easing if a keyframe omits its own
}
```

**Capa de control:** un controlador `Animation` al estilo de WAAPI. Diferencias respecto a un polyfill completo de WAAPI:

-   Sin análisis de cadenas CSS. WAAPI permite `{ transform: 'translate(100px)' }`, y analizarlo es costoso. Es preferible `{ x: 100 }` (propiedades de transform independientes, al estilo de Motion).
-   `ease`, `ease-in`, `ease-out` y `linear` integrados, además de `spring(mass, stiffness, damping)` al estilo de Motion.
-   Modos **Composite**. Como el `composite: 'add' | 'replace'` de WAAPI, apila animaciones sobre los valores base (por ejemplo, la posición de la entidad más un desplazamiento animado).
-   Soporte de **línea de tiempo**. Como `timeline()` de Motion o `GroupEffect` de WAAPI, incluido el stagger entre entidades.

### Controlador {#controller}

```ts
const animation = api.animate(
    node1,
    [
        { x: 100, fill: 'green' },
        { x: 200, fill: 'red' },
    ],
    {
        duration: 1000,
        direction: 'alternate',
        iterations: 'infinite',
        easing: 'ease-in-out',
    },
);
animation.pause();
animation.play();
animation.finish();
```

<AnimationController />

### Interpolación {#interpolation}

Los escalares como `x` / `y` / `opacity` se interpolan de forma trivial. Para `fill` / `stroke`, analiza los colores con algo como `d3-color` y después interpola cada canal rgba.

En los degradados lineales, si el número de paradas coincide, se interpolan la posición y el color de cada parada. Si el número de paradas es distinto, se usan las posiciones de parada combinadas de los dos degradados y se conservan las posiciones repetidas que representan transiciones de color duras. Así se preserva el espaciado no uniforme cuando los dos fotogramas clave contienen el mismo degradado.

En ECS, `fill` / `fillOpacity` y `stroke` / `strokeOpacity` actualizan juntas la primera capa de pintura activada. Las demás capas y su estado de activación se conservan. Si no hay ninguna capa activada, animar una pintura añade una; animar solo la opacidad no crea una capa nueva.

```ts
function interpolateValue(from: unknown, to: unknown, t: number) {
    if (isFiniteNumber(from) && isFiniteNumber(to)) {
        return interpolateNumber(from, to, t);
    }
    const fromColor = parseColor(from);
    const toColor = parseColor(to);
    if (fromColor && toColor) {
        return colorToRgbaString({
            r: interpolateNumber(fromColor.r, toColor.r, t),
            g: interpolateNumber(fromColor.g, toColor.g, t),
            b: interpolateNumber(fromColor.b, toColor.b, t),
            a: interpolateNumber(fromColor.a, toColor.a, t),
        });
    }
    return t < 1 ? from : to;
}
```

### Easing {#easing-function}

Además de las curvas habituales, podemos admitir `spring`:

```ts
function evaluateEasing(easing: string, t: number) {
    const p = clamp01(t);
    const bezier = EASING_FUNCTION[easing as keyof typeof EASING_FUNCTION];
    if (bezier) {
        return clamp01(bezier(p));
    }
    if (easing.startsWith('spring(')) {
        return evaluateSpringEasing(p, easing);
    }
    return p;
}
```

<AnimationEasing />

### Origen de la transformación {#transform-origin}

<AnimationTransformOrigin />

## Efectos de animación especiales {#special-effects}

### Animación de trazado {#path-animation}

Mover gráficos a lo largo de un trazado es habitual; CSS lo hace con Motion Path.

```css
#motion-demo {
    animation: move 3000ms infinite alternate ease-in-out;
    offset-path: path('M20,20 C20,100 200,0 200,100');
}
@keyframes move {
    0% {
        offset-distance: 0%;
    }
    100% {
        offset-distance: 100%;
    }
}
```

### Animación del trazo {#stroke-animation}

Hace falta la longitud del trazado:

```ts
const length = api.getTotalLength(path);
api.animate(
    path,
    [{ strokeDasharray: [0, length] }, { strokeDasharray: [length, 0] }],
    {
        duration: 3500,
    },
);
```

<AnimationDasharray />

### Desfase del trazo discontinuo {#dashline-offset}

draw.io usa la animación para mostrar la dirección del conector:

![fuente: https://www.drawio.com/doc/faq/connector-animate](https://www.drawio.com/assets/img/blog/connector-flow-animation.svg)

> Exporta el diagrama a un archivo SVG para incluir la animación del conector cuando lo publiques en una página web o en una plataforma de contenido que admita imágenes SVG.

```ts
api.animate(node, [{ strokeDashoffset: -20 }, { strokeDashoffset: 0 }], {
    duration: 500,
    iterations: Infinity,
});
```

<AnimationDashoffset />

### Morphing {#morphing}

Muchas bibliotecas de SVG muestran el morphing:

-   [Paper.js]
-   [Kute.js] ofrece Morph y CubicMorph
-   El MorphSVGPlugin de GreenSock incluso puede renderizar en Canvas
-   [vectalign]

Algunas bibliotecas exigen que la estructura de segmentos coincida antes y después del morph; si no, la interpolación falla.

Siguiendo el CubicMorph de Kute.js: convierte los segmentos del trazado en Bézier cúbicas, usa una subdivisión sencilla para normalizar los dos trazados al mismo número de segmentos y después interpola los puntos de control de cada segmento.

El sentido de recorrido y la alineación del punto inicial solo se aplican cuando los dos trazados contienen un único contorno cerrado. Los trazados abiertos conservan el orden de sus extremos, así que trasladar una curva no intercambia sus extremos ni colapsa la curva a mitad de la animación.

```ts
function mergePaths(
    left: { absolutePath: AbsoluteArray; curve: CurveArray | null },
    right: { absolutePath: AbsoluteArray; curve: CurveArray | null },
): [CurveArray, CurveArray, (b: CurveArray) => CurveArray] {
    let curve1 = left.curve;
    let curve2 = right.curve;
    if (!curve1 || curve1.length === 0) {
        // convert to curves to do morphing & picking later
        // @see http://thednp.github.io/kute.js/svgCubicMorph.html
        curve1 = path2Curve(left.absolutePath, false) as CurveArray;
        left.curve = curve1;
    }
    if (!curve2 || curve2.length === 0) {
        curve2 = path2Curve(right.absolutePath, false) as CurveArray;
        right.curve = curve2;
    }

    let curves = [curve1, curve2];
    if (curve1.length !== curve2.length) {
        curves = equalizeSegments(curve1, curve2);
    }

    const closed = [left.absolutePath, right.absolutePath].every(
        (path) =>
            path[path.length - 1]?.[0] === 'Z' &&
            path.filter(([command]) => command === 'M').length === 1,
    );
    const curve0 =
        closed && getDrawDirection(curves[0]) !== getDrawDirection(curves[1])
            ? reverseCurve(curves[0])
            : (clonePath(curves[0]) as CurveArray);

    return [
        curve0,
        closed ? (getRotatedCurve(curves[1], curve0) as CurveArray) : curves[1],
        (pathArray: CurveArray) => pathArray,
    ];
}
```

<AnimationMorphing />

## Lottie {#lottie}

-   [esquema JSON de Lottie]
-   [Consejos de renderizado]
-   [lottie-parser]: seguimos sobre todo su lógica de análisis
-   [velato]: un renderizador construido sobre Vello

### Uso {#lottie-usage}

Implementamos un complemento que convierte el JSON de Lottie en gráficos y fotogramas clave. Aspectos destacados:

-   Admite los elementos siguientes de las capas Shape:
    -   [Rectangle](https://lottiefiles.github.io/lottie-docs/shapes/#rectangle)
    -   [Ellipse](https://lottiefiles.github.io/lottie-docs/shapes/#ellipse)
    -   [PolyStar](https://lottiefiles.github.io/lottie-docs/shapes/#polystar)
    -   [Path](https://lottiefiles.github.io/lottie-docs/shapes/#path)
    -   [Group](https://lottiefiles.github.io/lottie-docs/shapes/#group)
-   En Lottie, `anchorX` / `anchorY` definen el centro de escala y rotación respecto a la esquina superior izquierda de la caja delimitadora de la forma. Ten cuidado al asignarlos a `transformOrigin`
-   Fusiona varias pistas de animación en un solo conjunto de fotogramas clave y rellena las propiedades que faltan

```ts
import { loadAnimation } from '@infinite-canvas-tutorial/lottie';

const response = await fetch('/bouncy_ball.json');
const animation = loadAnimation(await response.json(), {
    loop: true,
    autoplay: true,
    onDiagnostic: ({ code, path, message }) =>
        console.info(code, path, message),
});

await api.edit(() => animation.render(api), { capture: 'NEVER' });

// On component unmount (also automatically cleaned up on canvas destruction):
// await animation.destroy();
```

Abajo está la muestra oficial en marcha en nuestra configuración: [Bouncy Ball]

<AnimationLottieBouncyBall />

### Compatibilidad {#lottie-compatibility}

Este importador convierte Lottie en nodos y fotogramas clave de ECS; no es un renderizador completo de Lottie. Analizar un campo no implica implementar su efecto visual.

| Característica | Comportamiento actual |
| --- | --- |
| Rectángulos, elipses, trazados, grupos; relleno y trazo básicos | Geometría estática básica, morphing de trazados y posición, rotación y escala 2D; la animación del tamaño y de las esquinas de las primitivas sigue siendo limitada |
| PolyStar | Estrellas y polígonos, ambos sentidos de recorrido, número de puntas, posición, rotación, radio interior y exterior y redondez; fotogramas clave numéricos con easing temporal y holds |
| Repeater | Copias de las formas o grupos precedentes; cantidad, desplazamiento, ancla, traslación, escala, rotación, opacidad inicial y final y orden de composición, incluidos los fotogramas clave numéricos |
| Solid, Null, parenting, Precomp | Soporte básico; la visibilidad de entrada y salida de la capa, el estiramiento del tiempo y el remapeo están incompletos |
| Degradados y varias pinturas | Degradados básicos; la geometría animada del degradado, los brillos radiales y el orden de varias pinturas u operadores siguen siendo limitados |
| Trim Paths | Aproximación con stroke-dash, con la cobertura llena o vacía corregida, la ordenación de extremos y los desfases; la geometría rellena, los modos de varios trazados, los patrones de guion ya existentes, las tapas redondas animadas de longitud cero, la dirección y el orden de los modificadores siguen siendo limitados |
| Movimiento de Bézier espacial, Skew | Incompleto; se informa durante la inspección |
| Merge Paths, Round Corners y otros modificadores | No se renderizan |
| Imagen | Parcial; los directorios de recursos y la precarga no están implementados |
| Texto, máscaras, Track Mattes, efectos, modos de fusión, 3D | No implementado, o no renderizado de forma fiable; las capacidades de ECS no implican soporte de importación de Lottie |
| Expresiones | Se hornean en la importación; de forma predeterminada se usa el ExpressionManager incluido de lottie-web, con un entorno limitado de capas de forma, no la semántica completa de AE |

`inspectLottie(data)` comprueba los huecos conocidos sin mutar el JSON ni evaluar expresiones. `animation.getDiagnostics()` y `onDiagnostic` aportan un `code` estable, `severity` (`partial` / `unsupported`), un `path` de JSON Pointer y un mensaje. La importación continúa con diagnósticos; una lista vacía no certifica la compatibilidad con AE. Despliega **Notas de compatibilidad** en los ejemplos para inspeccionar sus huecos.

La reproducción usa un único reloj de composición. `goTo(value, true)` busca fotogramas relativos a la composición; la unidad predeterminada son los segundos, y se conserva el estado de reproducción o pausa. `stop()` pausa en el fotograma cero. `setSpeed()` toma un multiplicador positivo; `setDirection(-1)` invierte desde la posición actual y conserva la velocidad. `playSegments([start, end])` respeta ambos extremos; si los extremos van en orden descendente, la reproducción va hacia atrás. Un `loop` numérico cuenta las repeticiones extra. El reproductor muestrea los controladores de ECS que devuelve `getAnimations()`; controla el tiempo mediante la API del reproductor.

Un `render(api)` repetido sobre la misma instancia es idempotente; otro lienzo necesita una instancia aparte. `destroy()` es idempotente, cancela la reproducción y elimina el árbol de nodos importado en una edición segura. Los componentes también deben cancelar las peticiones pendientes y las ediciones en cola al desmontarse. Las regresiones del navegador comparan fotogramas fijos con una versión fijada de lottie-web en cuanto a posición, Trim Paths con trazo de un solo trazado, geometría de PolyStar y grupos de Repeater, en fotogramas enteros y fraccionarios; no establecen la paridad de todo el formato.

### Estrellas y polígonos {#lottie-polystar}

PolyStar (`ty: "sr"`) genera un trazado de Bézier cerrado: `sy: 1` selecciona una estrella y `sy: 2` un polígono. El número de puntas (`pt`), la posición (`p`), la rotación (`r`), el radio (`or` / `ir`) y la redondez (`os` / `is`) pueden animarse de forma independiente. Las propiedades interiores solo se aplican a las estrellas. `d: 3` invierte el sentido de recorrido. Los números de puntas fraccionarios se truncan hacia abajo, igual que en lottie-web 5.13; esto no es un morph continuo entre números de puntas.

El ejemplo anima las dos formas. Pausa, invierte o arrastra **Buscar fotograma** para inspeccionar la geometría intermedia. Los parámetros se interpolan antes de construir el trazado, así que la rotación conserva el radio y los cambios del número de puntas surten efecto en el instante correcto.

<AnimationLottiePolyStar />

La geometría animada de PolyStar la muestrea un controlador del complemento en el reloj de composición. Conserva el JSON original de Lottie para volver a cargarlo: la serialización plana de fotogramas clave de ECS y el editor de animación todavía no conservan ni editan estas pistas de parámetros procedurales. Siguen vigentes las tangentes de posición espacial, las combinaciones de modificadores (incluidos los Trim Paths sobre geometría que cambia), las expresiones y las demás limitaciones de la matriz. Los trazos curvos también heredan las costuras de transparencia que el renderizador de ECS ya tiene en algunas uniones teseladas; sus pruebas de referencia verifican la silueta y el color, no la paridad del alfa.

### Curvas de Bézier en Lottie {#beziers-in-lottie}

[Curvas de Bézier en Lottie]

-   `v` es un array de vértices.
-   `i` es un array de puntos de tangente de entrada («in»), relativos a `v`.
-   `o` es un array de puntos de tangente de salida («out»), relativos a `v`.
-   `c` es un booleano que determina si la poli-Bézier está cerrada. Si lo está, hay un segmento de Bézier adicional entre el último punto de `v` y el primero.

### Repeater {#repeater}

Repeater (`ty: "rp"`) duplica los operadores que lo preceden en el grupo de formas actual. Mantén el relleno y el trazo **dentro del grupo repetido** para pintar cada copia por separado. Se pueden repetir los grupos de formas anidados y la geometría animada de PolyStar. Los Repeater anidados o apilados usan ahora una duplicación recursiva y emiten `shape.repeater.nested`; el orden compuesto y las copias de origen que se conservan pueden diferir de lottie-web.

Las copias (`c`) se redondean hacia arriba; cero oculta todas las copias. El desplazamiento (`o`) acepta valores fraccionarios y negativos. La transformación (`tr`) incluye el ancla (`a`), la traslación (`p`), la escala no uniforme (`s`), la rotación (`r`) y la opacidad inicial y final (`so` / `eo`). El modo de composición (`m`) cambia el apilado de las copias. Las pistas numéricas admiten easing temporal y holds. Las transformaciones siguen lottie-web 5.13, incluido su comportamiento al cruzar la identidad con desplazamientos enteros negativos.

<AnimationLottieRepeater />

El importador reserva un grupo de copias a partir del límite superior de la pista de cantidad, incluido el exceso del easing. La reproducción y la búsqueda reutilizan este grupo. Las cantidades grandes y los repeaters anidados multiplican el número de nodos importados. Igual que con PolyStar, conserva el JSON original de Lottie: la serialización plana de fotogramas clave de ECS y el editor de animación no conservan estas pistas procedurales.

Los operadores de pintura **después** del Repeater tienen soporte parcial y emiten `shape.repeater.paint-scope`: la herencia de pintura por copia no reproduce la cobertura ni la opacidad del relleno compuesto compartido de lottie-web. El orden de los modificadores, el skew, el movimiento espacial y la temporización de las capas siguen sujetos a la matriz de compatibilidad. Las escalas inversas singulares (por ejemplo, escala cero con un desplazamiento negativo) ocultan las copias afectadas, en lugar de enviar transformaciones no válidas.

### Expresiones {#expression}

[Expresiones]

```json
{
    "ty": "sh",
    "ks": {
        "a": 0,
        "k": {
            "i": [],
            "o": [],
            "v": []
        },
        "x": "var group = thisLayer.content(\"Quadratic Points\");\nvar num_points = 3;\nvar points = [];\nvar ip = [];\nvar op = [];\nfor ( var i = 0; i < num_points; i++ )\n{\n    var pos = group.content(\"p\" + i).position;\n    points.push(pos);\n    ip.push(pos);\n    op.push(pos);\n}\nvar $bm_rt = {\n    v: points,\n    i: ip,\n    o: op\n};\n"
    }
}
```

### Capa de texto {#text-layer}

Las capas de texto y los animadores de texto todavía no se importan.

### Máscara de recorte {#clipping-mask}

Los modos de máscara, la inversión, la animación y los track mattes no se renderizan de forma fiable.

[máscaras de recorte]

### Efectos de capa {#layer-effects}

Los efectos de Lottie todavía no se corresponden con ECS.

[Efectos de capa]

## Rive {#rive}

[Rive frente a Lottie]

![fuente: https://rive.app/blog/rive-as-a-lottie-alternative](https://framerusercontent.com/images/gKzhMgEDMMUPLVkhMtTDfQdQrQ.png?width=1920&height=800)

## Manim {#manim}

<https://github.com/3b1b/manim>

-   [Debate en HN]

## Editor de animación {#animation-editor}

Inspirados por productos como [lottielab] y [Jitter], construimos un editor de animación ligero en la capa de Web Components: el **panel de animación** de la derecha edita los fotogramas clave del elemento seleccionado, y el **panel de línea de tiempo** de la parte inferior muestra la línea de tiempo de toda la escena y mueve el cabezal de reproducción de ese lienzo. Los dos comparten los mismos datos de fotogramas clave serializables y el reloj de escena de `AppState`.

![fuente: https://jitter.video/](/jitter.png)

### Disposición {#animation-editor-layout}

La barra de tareas expone dos interruptores independientes:

-   `SHOW_ANIMATION_PANEL` → `ic-spectrum-animation-panel` (lado derecho, junto al panel de propiedades)
-   `SHOW_TIMELINE_PANEL` → `ic-spectrum-timeline-panel` (acoplado inferior, a todo el ancho del lienzo)

Flujo habitual:

1. Selecciona un único elemento y añade una animación, o edita las pistas de propiedades en el panel de animación.
2. Abre la línea de tiempo para ver cada capa animada de la escena y su intervalo de tiempo.
3. Desplaza el cabezal o pulsa Reproducir para previsualizar toda la escena en un mismo instante.
4. Al seleccionar una pista en la línea de tiempo también se selecciona su elemento; el panel de animación de la derecha muestra los fotogramas clave de ese elemento.

### Reloj de la escena y modo de edición {#animation-scene-clock}

La línea de tiempo mueve el **cabezal de reproducción del lienzo en `AppState`**, desacoplado de cada `AnimationController`. Los lienzos que comparten un mundo ECS conservan cabezales, estado de reproducción y duraciones de escena independientes:

| Campo | Significado |
| --- | --- |
| `animationEditing` | Con `true`, entra en el **modo de recorrido determinista**: todos los controladores de este lienzo se muestrean en el mismo `animationCurrentTime`, en lugar de avanzar libres por su cuenta |
| `animationCurrentTime` | Posición del cabezal de reproducción de este lienzo (milisegundos) |
| `animationPlaying` | Si el cabezal avanza de forma automática |
| `animationLoop` | Si la reproducción vuelve a 0 al final de la escena |

Cuando `animationEditing === true`, `AnimationSystem` muestrea solo las entidades que pertenecen a ese lienzo. En pausa, los controladores quedan fijos en `animationCurrentTime`; durante la reproducción, el cabezal avanza con los deltas de `performance.now()`. El tiempo de reloj de pared en pausa se excluye al reanudar la reproducción, y la duración de la escena la determinan las pistas de ese lienzo.

Al salir del modo de edición, los controladores que el editor puso en pausa reanudan la reproducción automática desde la posición actual. Los controladores que el llamador ya había pausado siguen en pausa, y los controladores cancelados no se reinician.

Abrir la línea de tiempo llama automáticamente a `setAnimationEditing(true)`, de modo que el desplazamiento y la previsualización se mantienen coherentes.

### Diseño del panel de línea de tiempo {#animation-timeline}

<AnimationTimeline />

#### Datos de las pistas {#track-data}

La línea de tiempo no lee el JSON del nodo directamente; agrega los datos mediante `api.getAnimatedTracks()`:

```ts
interface Track {
    id: string; // node id
    name: string; // layer name; falls back to id
    properties: string[]; // e.g. ['opacity', 'x']
    delay: number; // ms
    duration: number; // active animation length (total − delay)
    totalDuration: number;
}
```

La duración de la escena es el `totalDuration` máximo de todas las pistas. `left` y `width` de la barra se calculan como `delay * PX_PER_MS` y `duration * PX_PER_MS`.

#### Interacciones {#interactions}

| Acción | Comportamiento |
| --- | --- |
| Clic en la etiqueta de la pista | `layersSelected = [track.id]`, resalta la pista y dirige el panel de animación |
| Arrastrar el carril o la regla | Desplaza el cabezal de reproducción; el lienzo previsualiza ese fotograma en vivo |
| Reproducir / Pausar | `toggleAnimationPlaying()` hace avanzar el reloj global en el modo de edición |
| Bucle | `setAnimationLoop()` controla si la escena vuelve al inicio al terminar |

### Panel de animación (funciona con la línea de tiempo) {#animation-panel}

Componente: `packages/webcomponents/src/spectrum/animation-panel.ts`.

-   Solo se puede editar con una selección **única**; la selección múltiple o la ausencia de selección muestran un marcador de posición.
-   Opciones globales: `duration`, `delay`, `easing` predeterminado, `iterations` (interruptor de bucle).
-   Fotogramas clave agrupados por **pista de propiedad**; cada fila tiene `offset` (0–1), el valor, `easing` y un botón de eliminar.
-   **Añadir fotograma clave en el cabezal**: lee `animationCurrentTime`, lo convierte en un offset normalizado y muestrea los valores actuales de la propiedad mediante `controller.getCurrentValues()`. Abre la línea de tiempo y desplázate hasta el instante deseado antes de insertar un fotograma clave.
-   `fill` / `stroke` usan un popover y `ic-spectrum-color-picker`; las demás propiedades numéricas usan `sp-number-field`.
-   El ancho y el alto del panel se pueden redimensionar; los tamaños persisten en `localStorage` (la misma interacción de asa que el panel de propiedades).

Todas las ediciones pasan por `setNodeAnimation` / `updateNodeAnimationKeyframe` y participan en el historial de deshacer y en la serialización del documento.

### Diferencias respecto a los editores al estilo de Lottie {#animation-editor-vs-lottie}

La implementación actual se mantiene simple a propósito, en comparación con herramientas DCC completas como [lottielab]:

-   La línea de tiempo usa **una pista por nodo**. La disposición de Lottie, con varias pistas de capa y de propiedad, queda fuera de este modelo; los nombres de propiedad aparecen como sufijo de la etiqueta (`Rect · opacity, x`).
-   Los fotogramas clave y la temporización de las barras todavía no se pueden arrastrar en la línea de tiempo; la temporización se edita mediante `offset` en el panel de animación.
-   Las expresiones usan un horneado limitado en el momento de la importación. Este editor no crea ni admite de forma fiable las capas de texto ni las máscaras de recorte.

Ampliaciones posibles: subpistas de propiedades, marcadores de rombo en los fotogramas clave, arrastrar los bordes de la barra para cambiar el retardo y la duración, y otras.

### Referencias externas {#external-references}

-   [lottielab]
-   [omnilottie]
-   [thorvg.viewer]
-   [Jitter]

## Lectura adicional {#further-reading}

-   [Magic Animator]
-   [Un gran avance en los gráficos vectoriales en tiempo real]
-   [Cuando el arte se encuentra con la tecnología: el paso siguiente para dar vida a nuestros personajes]
-   [Canvas y WebGL]

[Mejoras de la Web Animations API]: https://motion.dev/docs/improvements-to-the-web-animations-api-dx
[Un gran avance en los gráficos vectoriales en tiempo real]: https://rive.app/renderer
[Cuando el arte se encuentra con la tecnología: el paso siguiente para dar vida a nuestros personajes]: https://blog.duolingo.com/world-character-visemes/
[Canvas y WebGL]: https://rive.app/community/doc/canvas-vs-webgl/docanjXoQ1uT
[vectalign]: https://github.com/bonnyfone/vectalign
[Magic Animator]: https://magicanimator.com/
[Debate en HN]: https://news.ycombinator.com/item?id=44994071
[lottielab]: https://www.lottielab.com/
[Jitter]: https://jitter.video/
[omnilottie]: https://fal.ai/models/fal-ai/omnilottie/api
[web-animations-js]: https://github.com/web-animations/web-animations-js
[esquema JSON de Lottie]: https://lottiefiles.github.io/lottie-docs/schema/
[Paper.js]: http://paperjs.org/
[Kute.js]: https://thednp.github.io/kute.js/
[Consejos de renderizado]: https://lottiefiles.github.io/lottie-docs/rendering/
[lottie-parser]: https://github.com/pissang/lottie-parser
[velato]: https://github.com/linebender/velato
[Bouncy Ball]: https://lottiefiles.github.io/lottie-docs/breakdown/bouncy_ball/
[Curvas de Bézier en Lottie]: https://lottiefiles.github.io/lottie-docs/breakdown/bezier/#beziers-in-lottie
[Expresiones]: https://lottiefiles.github.io/lottie-docs/expressions/
[máscaras de recorte]: https://lottie-animation-community.github.io/docs/specs/layers/common/#clipping-masks
[Efectos de capa]: https://lottiefiles.github.io/lottie-docs/effects/#layer-effects
[thorvg.viewer]: https://github.com/thorvg/thorvg.viewer
[Rive frente a Lottie]: https://rive.app/blog/rive-as-a-lottie-alternative
