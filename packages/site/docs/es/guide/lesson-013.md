---
outline: deep
description: 'Aprende a dibujar trazados complejos e implementar estilos dibujados a mano. Experimenta con SDF para trazados, usa métodos de triangulación para los rellenos y crea efectos de renderizado de boceto con rough.js.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lección 13 - Dibujar trazados y estilo de boceto',
          },
      ]
---
<script setup>
import Holes from '../../components/Holes.vue';
import FillRule from '../../components/FillRule.vue';
import Watercolor from '../../components/Watercolor.vue';
</script>

# Lección 13 - Dibujar trazados y estilo de boceto {#lesson-13-drawing-path-and-sketchy-style}

En la lección anterior presentamos el dibujo de una polilínea. La parte de trazo de un Path se puede convertir, en teoría, en una polilínea mediante muestreo; [p5js - bezierDetail()] hace precisamente eso, pero para un efecto suave necesitas añadir más puntos de muestreo. La parte de relleno, en cambio, todavía hay que implementarla. La trataremos en esta lección:

-   Experimentar con SDF
-   Intentar dibujar rellenos con algunos métodos de triangulación y trazos con polilíneas
-   Dibujar algunas formas a mano

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson13');
});
```

```js eval code=false inspector=false
call(() => {
    const {
        Canvas,
        Path,
        RoughCircle,
        RoughRect,
        deserializeNode,
        fromSVGElement,
        TesselationMethod,
    } = Lesson13;

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

        const circle = new RoughCircle({
            cx: 600,
            cy: 100,
            r: 50,
            fill: 'black',
            strokeWidth: 2,
            stroke: 'red',
            fillStyle: 'zigzag',
        });
        canvas.appendChild(circle);

        const rect = new RoughRect({
            x: 550,
            y: 200,
            fill: 'black',
            strokeWidth: 2,
            stroke: 'red',
            fillStyle: 'dots',
        });
        rect.width = 100;
        rect.height = 50;
        canvas.appendChild(rect);

        fetch(
            '/Ghostscript_Tiger.svg',
            // '/photo-camera.svg',
        ).then(async (res) => {
            const svg = await res.text();
            const $container = document.createElement('div');
            $container.innerHTML = svg;
            const $svg = $container.children[0];
            for (const child of $svg.children) {
                const group = await deserializeNode(fromSVGElement(child));
                group.children.forEach((path) => {
                    path.cullable = false;
                });
                group.position.x = 100;
                group.position.y = 75;
                canvas.appendChild(group);

                const group2 = await deserializeNode(fromSVGElement(child));
                group2.children.forEach((path) => {
                    path.tessellationMethod = TesselationMethod.LIBTESS;
                    path.cullable = false;
                });
                group2.position.x = 300;
                group2.position.y = 75;
                canvas.appendChild(group2);
            }
        });
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## Algunos conceptos básicos {#basic-concepts}

### Diferencias con Polyline {#diff-with-polyline}

Antes de nada, aclaremos la definición de [Trazados] en SVG y, en especial, la diferencia con `<polyline>` según MDN.

> El elemento \<path\> es el elemento más potente de la biblioteca de formas básicas de SVG. Se puede usar para crear líneas, curvas, arcos y más.
>
> Aunque los elementos \<polyline\> y \<path\> pueden crear formas de aspecto parecido, los elementos \<polyline\> necesitan muchas líneas rectas pequeñas para simular curvas y no escalan bien a tamaños mayores.

Por eso, cuando la curva se representa con `<polyline>`, falta suavizado, como se muestra en la figura de abajo: [ISSUE: dibujar arcos, los arcos no son suaves]

![polilínea: arco poco suave](https://user-images.githubusercontent.com/89827437/191234694-5d5637f8-c59a-42a7-84ce-c319c470629f.png)

En cambio, con Path sí se puede representar una línea con algo como `d="M 100 100 L 200 200 L 200 100"`.

### Subruta {#subpath}

Además de trazados sencillos, como una línea o una curva, un único `<path>` también puede contener una serie de líneas o curvas, que se pueden llamar subrutas.

Cada subruta empieza con un comando moveto, normalmente M o m, que indica a la herramienta de dibujo que se desplace a una posición nueva del sistema de coordenadas sin dibujar una línea. A continuación puede venir una serie de comandos de dibujo, como segmentos de línea (L o l), segmentos horizontales (H o h), segmentos verticales (V o v), curvas (C, S, Q, T, etc.) y arcos (A o a).

## Usar SDF {#sdf-path}

Ya hemos usado SDF para dibujar Circle, Ellipse y Rect. ¿Podemos hacer lo mismo con Path?

Parece funcionar con trazados sencillos; por ejemplo, [Bézier cuadrática - distancia 2D] en shadertoy, mencionado en la presentación del autor original en la lección anterior. Sí funciona para curvas de Bézier individuales, pero no para trazados complejos, y el rendimiento puede verse afectado por operaciones matemáticas demasiado complejas en el shader de fragmentos.

![trazado SDF](/sdf-line.png)

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/MlKcDD?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

### Path2D {#path2d}

Otra idea la da [svg-path-sdf] y, curiosamente, es casi idéntica a la idea de dibujar texto que presentaremos más adelante. Hay un ejemplo en línea en Observable: [Puntos SDF con regl]

![svg-path-sdf](https://github.com/dy/svg-path-sdf/raw/master/preview.png?raw=true)

`fill()` y `stroke()` de la API de Canvas2D pueden recibir [Path2D] como argumento, y este se puede crear directamente a partir de definiciones de trazado SVG. Después se usa la API de Canvas2D para generar un SDF que se pasa como textura; consulta [tiny-sdf] para los detalles de cómo hacerlo, y hablaremos más de ello cuando presentemos el dibujo de texto.

```ts
// @see https://github.com/dy/svg-path-sdf/blob/master/index.js#L61C3-L63C31
var path2d = new Path2D(path);
ctx.fill(path2d);
ctx.stroke(path2d);

var data = bitmapSdf(ctx);
```

Por supuesto, Path2D es una API con soporte nativo en entornos de navegador, así que, si quieres usarla para el renderizado en el servidor, necesitarás un polyfill, como se describe con más detalle aquí: [Soporte de la API Path2D].

## Usar malla {#use-mesh}

Así, la forma habitual de triangular un Path, tanto en 2D como en 3D, es el ejemplo siguiente, tomado de: [Cargador de SVG en three.js]. Primero se convierte el texto SVG en un conjunto de `ShapePath` y después se crea un conjunto de `ShapeGeometry` y se renderiza:

```ts
const shapes = SVGLoader.createShapes(path);
for (const shape of shapes) {
    const geometry = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = renderOrder++;

    group.add(mesh);
}
```

Implementemos a continuación nuestra propia versión:

-   Normalizar las definiciones de trazado a comandos absolutos
-   Muestrear las curvas
-   Dibujar los trazos con Polyline
-   Usar la triangulación de earcut y libtess para dibujar los rellenos

### Normalizar a comandos absolutos {#convert-to-absolute-commands}

Los comandos de trazado SVG son absolutos y relativos; por ejemplo, `M 100 100 L 200 100` equivale a `M 100 100 l 100 0`. Para facilitar el procesamiento, convertiremos primero todos los comandos relativos en absolutos. La API de Canvas2D también usa este estilo, parecido a [lineTo]. Nos referimos a la implementación de [ShapePath] de Three.js, que implementa una serie de métodos de [CanvasRenderingContext2D] como `moveTo / lineTo / bezierCurveTo`, etc.

```ts
import { path2Absolute } from '@antv/util';

const path = new ShapePath();
const commands = path2Absolute(d);
commands.forEach((command) => {
    const type = command[0];
    const data = command.slice(1);
    switch (type) {
        case 'M':
            path.moveTo();
        case 'L':
            path.lineTo();
        //...
    }
});
```

Presentemos brevemente los métodos que ofrece [ShapePath], que consta de un conjunto de subPaths correspondientes a varios comandos de la definición del trazado. Tomemos `moveTo` y `lineTo` como ejemplo: el primero crea un subPath nuevo y fija el punto de inicio, y el segundo completa la línea hasta el punto siguiente.

```ts
export class ShapePath {
    currentPath: Path | null;
    subPaths: Path[];

    moveTo(x: number, y: number) {
        this.currentPath = new Path();
        this.subPaths.push(this.currentPath);
        this.currentPath.moveTo(x, y);
        return this;
    }

    lineTo(x: number, y: number) {
        this.currentPath.lineTo(x, y);
        return this;
    }
}
```

Veamos la estructura de cada subPath.

```ts
export class Path extends CurvePath {}
```

### Muestreo en una curva {#sample-on-curve}

Se muestrean líneas rectas y curvas de Bézier con distinta precisión. Es comprensible: en las curvas de Bézier, la única forma de que la línea se vea más suave es añadir más muestras; en las líneas rectas, no hace falta añadir ninguna muestra adicional.

```ts
export class CurvePath extends Curve {
    getPoints(divisions = 12) {
        const resolution =
            curve instanceof EllipseCurve
                ? divisions * 2
                : curve instanceof LineCurve
                ? 1
                : divisions;
        const pts = curve.getPoints(resolution);
    }
}
```

### Precisión adaptativa al hacer zoom {#adaptive-precision}

Las divisiones fijas de arriba explican el algoritmo básico. Los renderizadores de Path actuales de `core` y `ecs`, en cambio, aplanan las Bézier cuadráticas y cúbicas y los arcos de elipse según su tamaño en pantalla. Apuntan a un error de 0,25 píxeles físicos, teniendo en cuenta el zoom de la cámara, la relación de píxeles del dispositivo, las transformaciones del padre y el pase de renderizado usado para la exportación. Los trazos gruesos también limitan los cambios de tangente, incluida la dirección de las terminaciones de los extremos. La cobertura del trazo del Path usa píxeles físicos, de modo que su franja de antialiasing no crece con el zoom.

La precisión se redondea hacia arriba a potencias de dos. Al acercar el zoom, se refina en cuanto el nivel actual es insuficiente; al alejarlo, hay una octava extra de histéresis para evitar reconstruir una y otra vez cerca de un límite. Cada drawcall conserva hasta cuatro conjuntos de puntos muestreados por Path. El paneo y el zoom dentro de un nivel reutilizan la geometría de la GPU. Los cambios en `d` invalidan esas muestras.

Los límites de la geometría salen de los extremos de las curvas originales, con independencia de la precisión de renderizado. `Path.points`, `ComputedPoints` de ECS y los cálculos de longitud de curva y de texto sobre trazado conservan su comportamiento independiente de la vista, así que cambiar el zoom no mueve los límites de selección ni recompone el texto. Los proveedores de límites personalizados de ECS siguen admitidos.

La subdivisión se detiene después de 16 niveles recursivos o de 4096 segmentos por comando SVG. Con un aumento extremo, este límite de trabajo puede relajar el error objetivo. Este cambio cubre los Path ordinarios; los trazados Rough, el muestreo de VectorNetwork y los paquetes históricos de las lecciones conservan sus estrategias de muestreo existentes.

Tomando como ejemplo una curva de Bézier de tercer orden, dado el `t` normalizado, los puntos de muestreo se pueden obtener por su definición: [Curva de Bézier]

```ts
export class CubicBezierCurve extends Curve {
    getPoint(t: number) {
        const point = vec2.create();
        const { v0, v1, v2, v3 } = this;

        vec2.set(
            point,
            CubicBezier(t, v0[0], v1[0], v2[0], v3[0]),
            CubicBezier(t, v0[1], v1[1], v2[1], v3[1]),
        );

        return point;
    }
}
```

Aquí hay un ejemplo de un Path circular con la lista siguiente de vértices muestreados:

```js eval
points = call(() => {
    const { Path } = Lesson13;
    return new Path({
        d: 'M40,0A40,40 0 1,1 0,-40A40,40 0 0,1 40,0Z',
        fill: 'black',
        opacity: 0.5,
    }).points;
});
```

### Dibujar trazos con polilínea {#use-polyline-to-draw-stroke}

Ahora que tenemos todos los puntos muestreados del subPath, podemos dibujar rellenos y trazos por separado. El primero lo veremos en un momento, y el segundo se puede hacer directamente con la Polyline implementada en la lección anterior, [polilínea con varios segmentos], que precisamente admite un rango de subPaths.

```ts
SHAPE_DRAWCALL_CTORS.set(Path, [Mesh, SmoothPolyline]);
```

### Triangulación con earcut {#earcut}

![RTR 3.ª ed. - Teselación](https://picx.zhimg.com/80/v2-f38400d225d0397f99563c96ce45053d_1440w.webp?source=d16d100b)

Entonces, ¿cómo se divide en triángulos? Un método habitual se llama `ear clipping` (recorte de orejas). Un vértice es `ear` si la línea que une dos de sus vértices vecinos no interseca ningún lado del polígono.
Tomemos como ejemplo el lado izquierdo de la figura de abajo. Con este criterio, v2, v4 y v5 son `ear`. Después eliminamos el `ear` encontrado, como v4, y seguimos determinando sus vecinos v5 y v3, donde v5 constituye un `ear`. Al final se eliminan todos los `ear` y el polígono queda dividido en triángulos.

![RTR - 12. Técnicas poligonales - Recorte de orejas](https://picx.zhimg.com/80/v2-7c2a99be56ca9e4af6269e2c070b853b_1440w.webp?source=d16d100b)

El algoritmo detallado se encuentra en el artículo: [Triangulación por recorte de orejas], mientras que [earcut] ofrece una implementación en JS:

```ts
function isEar(ear) {
    var a = ear.prev,
        b = ear,
        c = ear.next;

    if (area(a, b, c) >= 0) return false; // reflex, can't be an ear

    // now make sure we don't have other points inside the potential ear
    var p = ear.next.next;

    while (p !== ear.prev) {
        // If the poing is in triangle, it's not an ear.
        if (
            pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
            area(p.prev, p, p.next) >= 0
        )
            return false;
        p = p.next;
    }

    return true;
}
```

La triangulación se hace con [earcut], que recibe las coordenadas de los puntos de muestreo para obtener un array de índices, e incluso calcula el error. Como verás más adelante al compararlo con otros métodos de triangulación, earcut mejora mucho la velocidad del cálculo, pero pierde algo de precisión:

```ts
import earcut, { flatten, deviation } from 'earcut';

const { d } = path;
const { subPaths } = parsePath(d);
const points = subPaths
    .map((subPath) => subPath.getPoints().map((point) => [point[0], point[1]]))
    .flat(2); // [100, 100, 200, 200, 300, 100, 100, 100]

const { vertices, holes, dimensions } = flatten(points);
const indices = earcut(vertices, holes, dimensions); // [1, 3, 2]
const err = deviation(vertices, holes, dimensions, indices); // 0
```

Después podemos usar `gl.drawElements()` o `passEncoder.drawIndexed()` para dibujar. En la imagen de abajo, el Path de la izquierda se define así. Si lo comparas con el círculo de la derecha, dibujado con SDF, verás que los bordes no son realmente suaves, y esto se nota aún más cuando la cámara hace zoom:

```ts
const path = new Path({
    d: 'M40,0A40,40 0 1,1 0,-40A40,40 0 0,1 40,0Z',
    fill: 'black',
    opacity: 0.5,
});
```

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson13');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Path, Circle } = Lesson13;

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
        canvas.camera.zoom = 2;

        const path = new Path({
            d: 'M40,0A40,40 0 1,1 0,-40A40,40 0 0,1 40,0Z',
            fill: 'black',
            opacity: 0.5,
        });
        path.position.x = 100;
        path.position.y = 100;
        canvas.appendChild(path);

        const circle = new Circle({
            cx: 0,
            cy: 0,
            r: 40,
            fill: 'black',
            opacity: 0.5,
        });
        circle.position.x = 200;
        circle.position.y = 100;
        canvas.appendChild(circle);
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

He comprobado que muchos motores de renderizado 2D, como [vello], usan [Ghostscript Tiger.svg] para probar el renderizado del Path, como puedes ver en el ejemplo del principio de este artículo. Pero si lo comparas con el SVG original (¿recuerdas la función de exportación que implementamos? verás que está en la esquina superior derecha del lienzo), verás que falta algo.

### Otras técnicas de triangulación {#other-tesselation-techniques}

Pixi.js usa [earcut] para la triangulación de polígonos. Otras bibliotecas de triangulación son [cdt2d] y [libtess.js]; esta última es menos potente, pero más precisa, sobre todo para trazados con muchos `holes` y autointersecciones. Como [earcut] menciona en su documentación, consulta: [Posibilidad de sustituir earcut por libtess.js en un objeto Graphics concreto]:

> Si quieres obtener una triangulación correcta incluso con datos muy malos, con muchas autointersecciones, y earcut no es lo bastante preciso, echa un vistazo a libtess.js.

El efecto de earcut y [libtess.js] se compara en [Teselación de polígonos]. A diferencia de earcut, que devuelve un array de índices, libtess.js devuelve un array de vértices, como se muestra en el ejemplo del repositorio. Esto significa que tenemos que generar el array de índices a mano, pero por supuesto es muy sencillo: como no necesitamos pensar en reutilizar vértices, podemos usar simplemente un array incremental que empiece en `0`.

```ts
export function triangulate(contours: [number, number][][]) {
    tessy.gluTessNormal(0, 0, 1);

    const triangleVerts = [];
    tessy.gluTessBeginPolygon(triangleVerts);
    // Omit...
    return triangleVerts;
}

triangulate(points); // [100, 0, 0, 100, 0, 0, 0, 100, 100, 0, 100, 100]
// indices: [0, 1, 2, 3, 4, 5]
```

Puedes volver al ejemplo de los «dos tigres» del principio del artículo y compararlo con el generado con earcut a la izquierda y libtess.js a la derecha. Hemos añadido a Path un atributo `tessellationMethod` para alternar entre los dos métodos de triangulación:

```ts
export enum TesselationMethod {
    EARCUT,
    LIBTESS,
}
export interface PathAttributes extends ShapeAttributes {
    tessellationMethod?: TesselationMethod;
}
```

### Dibujar huecos {#draw-holes}

Con la regla `nonzero` predeterminada de SVG, los huecos se pueden definir con el sentido de giro opuesto al del contorno. Por ejemplo, en el trazado de abajo, el contorno es el sentido horario `M0 0 L100 0 L100 100 L0 100 Z`, y los dos huecos siguientes son antihorarios:

```bash
M0 0 L100 0 L100 100 L0 100 Z M50 50 L50 75 L75 75 L75 50 Z M25 25 L25
```

También puedes invertir el sentido horario en tu definición; por ejemplo: [Dibujar un círculo hueco en SVG]. La clave es que la dirección del hueco sea opuesta a la dirección del contorno.

<Holes />

### Regla de relleno {#fill-rule}

La [fill-rule] de SVG se usa para determinar el área de relleno de un Path. En el ejemplo de abajo, el de la izquierda usa la regla nonzero y el de la derecha usa la regla evenodd.

<FillRule />

Tomando como ejemplo un punto en el área hueca del centro, el rayo interseca la forma un número par de veces, por lo que se determina que está fuera de la forma y no hay que rellenarlo. Consulta los detalles en [¿cómo funciona fill-rule="evenodd" en una estrella SVG?].

![fill-rule evenodd](/fill-rule-evenodd.png)

Como earcut no admite trazados autointersecados, usamos libtess.js para la triangulación del trazado.

```ts
tessy.gluTessProperty(
    libtess.gluEnum.GLU_TESS_WINDING_RULE,
    fillRule === 'evenodd'
        ? libtess.windingRule.GLU_TESS_WINDING_ODD
        : libtess.windingRule.GLU_TESS_WINDING_NONZERO,
);
```

En ECS, `fillRule` también se aplica con el `tessellationMethod: 'earcut'` predeterminado. Los trazados compuestos y los rellenos `evenodd` usan automáticamente libtess para resolver el winding o la paridad en todo el trazado, en lugar de adivinar los huecos a partir del orden de entrada o de la dirección del primer contorno. Los huecos pueden preceder a sus contornos; las islas anidadas, los contornos superpuestos y los contornos duplicados siguen la misma regla que las máscaras nativas de Canvas usadas para los filtros.

Un único contorno `nonzero` conserva el camino rápido de Earcut. Para las autointersecciones generales de un contorno así, elige explícitamente `libtess`. Resolver trazados compuestos puede aumentar el coste de la teselación; las cachés de geometría existentes siguen evitando reconstruir en cada fotograma. Los Path con reglas de relleno u opciones de teselación distintas ya no comparten una malla de relleno. El pintado Rough conserva su ruta de triangulación separada para preservar el alfa de pinceladas superpuestas.

## Caja delimitadora y picking {#bounding-box-picking}

La caja delimitadora se puede estimar del mismo modo que en la lección anterior para la polilínea. Nos centramos en la implementación de cómo determinar si un punto está dentro de un Path.

### Usar métodos nativos {#native-methods}

CanvasRenderingContext2D ofrece dos métodos listos para usar, [isPointInPath] e [isPointInStroke], que se pueden usar con facilidad junto con [Path2D], que presentamos antes.

```ts
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const isPointInPath = ctx.isPointInPath(new Path2D(d), x, y);
```

Presentamos [OffscreenCanvas] antes, y resulta especialmente bueno para cálculos como las decisiones de picking que no están relacionadas con la tarea de renderizado del hilo principal. Hacemos la inicialización en [PickingPlugin] y después pasamos `containsPoint` para llamarlo bajo demanda en gráficos concretos:

```ts
export class Picker implements Plugin {
    private ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

    private hitTest(shape: Shape, wx: number, wy: number): boolean {
        if (shape.hitArea || shape.renderable) {
            shape.worldTransform.applyInverse(
                { x: wx, y: wy },
                tempLocalPosition,
            );
            const { x, y } = tempLocalPosition;

            return shape.containsPoint(x, y); // [!code --]
            return shape.containsPoint(x, y, this.ctx); // [!code ++]
        }

        return false;
    }
}
```

### Método geométrico {#geometry-method}

Cada subPath de un Path puede realizar operaciones geométricas sobre su posición en relación con un punto. Por ejemplo, Pixi.js implementa [GraphicsContext - containsPoint]; puedes leer más al respecto.

## Dibujo con estilo a mano {#hand-drawn-style-drawing}

[excalidraw] usa [rough] para el dibujo con estilo a mano. No necesitamos la funcionalidad de dibujo real basada en Canvas2D o SVG que rough ofrece de forma predeterminada, así que usar [RoughGenerator] es una mejor elección.

![rough.js](https://camo.githubusercontent.com/5d90838c20ae2cab9f295e3dd812800285c42e82d04787883c9d5acecaec85ed/68747470733a2f2f726f7567686a732e636f6d2f696d616765732f6361705f64656d6f2e706e67)

### Generar definiciones de trazado a mano {#generate-rough-path-definitions}

RoughGenerator ofrece métodos de generación para formas habituales. Usamos el rectángulo como ejemplo:

```ts
const generator = rough.generator();
const rect = generator.rectangle(0, 0, 100, 100);
```

Nos genera un conjunto de estructuras parecidas a subPath a partir de los parámetros de entrada, llamado OpSet, que contiene los operadores `move`, `lineTo` y `bcurveTo`. Podemos convertir esto con facilidad en un comando con un trazado absoluto, después muestrearlo y seguir dibujando con Polyline.

```ts
import { AbsoluteArray } from '@antv/util';
import { OpSet } from 'roughjs/bin/core';

export function opSet2Absolute(set: OpSet) {
    const array = [];
    set.ops.forEach(({ op, data }) => {
        if (op === 'move') {
            array.push(['M', data[0], data[1]]);
        } else if (op === 'lineTo') {
            array.push(['L', data[0], data[1]]);
        } else if (op === 'bcurveTo') {
            array.push([
                'C',
                data[0],
                data[1],
                data[2],
                data[3],
                data[4],
                data[5],
            ]);
        }
    });
    return array as AbsoluteArray;
}
```

### Mixin Rough {#rough-mixin-rough-mixin}

Queremos reutilizar la versión que no está dibujada a mano para estas funciones de cálculo de la caja delimitadora y de picking, por las razones siguientes:

-   Este renderizado estilizado solo debe afectar al efecto de renderizado; no cambia sus propiedades físicas.
-   Un gráfico dibujado a mano consta en realidad de varios conjuntos de Paths, así que calcular la caja delimitadora con exactitud es un desperdicio de rendimiento.
-   Al hacer picking, hay que tomarlo como un todo, y juzgar por los Paths da resultados erróneos; por ejemplo, si el ratón está sobre el interior del gráfico, pero en el espacio vacío entre las líneas, y por tanto no está dentro del gráfico.

    Así que creamos un Mixin nuevo con todos los parámetros que admite rough, como `seed`, `roughness`, etc., y lo volvemos a dibujar en cuanto cambian estos parámetros:

```ts
import { Drawable, Options } from 'roughjs/bin/core';
import { GConstructor } from '.';
import { parsePath } from '../../utils';

export interface IRough
    extends Omit<Options, 'stroke' | 'fill' | 'strokeWidth'> {
    /**
     * @see https://github.com/rough-stuff/rough/wiki#roughness
     */
    roughness: Options['roughness'];
}
export function Rough<TBase extends GConstructor>(Base: TBase) {
    abstract class Rough extends Base implements IRough {
        get roughness() {
            return this.#roughness;
        }
        set roughness(roughness: number) {
            if (this.#roughness !== roughness) {
                this.#roughness = roughness;
                this.renderDirtyFlag = true;
                this.generate();
            }
        }
    }
}
```

De este modo podemos obtener efectos dibujados a mano envolviendo en él las formas que ya admitimos. La forma de usarlo es la siguiente. Tomamos RoughRect como ejemplo, que hereda de Rect:

```ts
import { RectWrapper, RectAttributes } from './Rect';

export class RoughRect extends Rough(RectWrapper(Shape)) {}
```

### fillStyle solid {#fill-style-solid}

Para admitir el caso `fillStyle = 'solid'`:

```ts
SHAPE_DRAWCALL_CTORS.set(RoughRect, [
    ShadowRect,
    Mesh, // fillStyle === 'solid' // [!code ++]
    SmoothPolyline, // fill
    SmoothPolyline, // stroke
]);
```

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson13');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, RoughCircle } = Lesson13;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    const circle1 = new RoughCircle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'dots',
    });

    const circle2 = new RoughCircle({
        cx: 200,
        cy: 100,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'hachure',
    });

    const circle3 = new RoughCircle({
        cx: 300,
        cy: 100,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'zigzag',
    });

    const circle4 = new RoughCircle({
        cx: 400,
        cy: 100,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'cross-hatch',
    });

    const circle5 = new RoughCircle({
        cx: 500,
        cy: 100,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'solid',
    });

    const circle6 = new RoughCircle({
        cx: 100,
        cy: 200,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'dashed',
    });

    const circle7 = new RoughCircle({
        cx: 200,
        cy: 200,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'zigzag-line',
    });

    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        canvas.appendChild(circle1);
        canvas.appendChild(circle2);
        canvas.appendChild(circle3);
        canvas.appendChild(circle4);
        canvas.appendChild(circle5);
        canvas.appendChild(circle6);
        canvas.appendChild(circle7);
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### Exportar SVG {#export-svg}

Como puedes ver, los gráficos que genera rough están formados por un conjunto de Paths. Por eso hay que usar `<path>` al exportar a SVG. Puedes probar a exportar en el ejemplo de arriba:

```ts
export function exportRough(
    node: SerializedNode,
    $g: SVGElement,
    doc: Document,
) {
    const {
        attributes: { drawableSets, stroke, fill },
    } = node;

    drawableSets.forEach((drawableSet) => {
        const { type } = drawableSet;
        const commands = opSet2Absolute(drawableSet);
        const d = path2String(commands, 2); // retain two decimal places
        const $path = createSVGElement('path', doc);
        $path.setAttribute('d', d);
        $g.appendChild($path);
        if (type === 'fillSketch') {
            $path.setAttribute('stroke', fill as string);
            $path.setAttribute('fill', 'none');
        }
    });
}
```

## Estilo de acuarela {#watercolor}

Con [watercolorizer], añadimos un `fillStyle: 'watercolor'` nuevo.

En particular, los rectángulos ya no se modelan solo con cuatro vértices. En su lugar usamos `subdivideAxisAlignedRect` para elegir un número de subdivisiones por arista entre 4 y 16 a partir del tamaño (mediante `hypot(w, h) / 40`), de modo que el contorno se comporte más como un polígono con muchos vértices y se reduzca el abombamiento uniforme hacia fuera de un quad desnudo.

<Watercolor />

## Lectura adicional {#extended-reading}

-   [Renderizar trazados SVG en WebGL]
-   [Dar forma a curvas con ecuaciones paramétricas]
-   [Geometría 3D de WebGL - Torno]
-   [Diversión con WebGL 2.0: 027: curvas de Bézier en 3D]
-   [Renderizado de trazados acelerado por GPU]
-   [Hacer un gráfico con estilo de boceto]
-   [Cómo hackear una pintura]
-   [Guía para simular pintura de acuarela con arte generativo]

[Trazados]: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths
[Bézier cuadrática - distancia 2D]: https://www.shadertoy.com/view/MlKcDD
[Path2D]: https://developer.mozilla.org/en-US/docs/Web/API/Path2D
[svg-path-sdf]: https://github.com/dy/svg-path-sdf/
[Puntos SDF con regl]: https://observablehq.com/@rreusser/sdf-points-with-regl
[Geometría 3D de WebGL - Torno]: https://webglfundamentals.org/webgl/lessons/webgl-3d-geometry-lathe.html
[Diversión con WebGL 2.0: 027: curvas de Bézier en 3D]: https://www.youtube.com/watch?v=s3k8Od9lZBE
[Dar forma a curvas con ecuaciones paramétricas]: https://mattdesl.svbtle.com/shaping-curves-with-parametric-equations
[Renderizar trazados SVG en WebGL]: https://css-tricks.com/rendering-svg-paths-in-webgl/
[Renderizado de trazados acelerado por GPU]: https://developer.download.nvidia.com/devzone/devcenter/gamegraphics/files/opengl/gpupathrender.pdf
[p5js - bezierDetail()]: https://p5js.org/reference/p5/bezierDetail/
[rough]: https://github.com/rough-stuff/rough
[excalidraw]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/scene/ShapeCache.ts#L2
[ISSUE: dibujar arcos, los arcos no son suaves]: https://github.com/pixijs/graphics-smooth/issues/23
[Cargador de SVG en three.js]: https://github.com/mrdoob/three.js/blob/dev/examples/webgl_loader_svg.html#L156
[earcut]: https://github.com/mapbox/earcut
[cdt2d]: https://github.com/mikolalysenko/cdt2d
[libtess.js]: https://github.com/brendankenny/libtess.js
[Posibilidad de sustituir earcut por libtess.js en un objeto Graphics concreto]: https://github.com/pixijs/pixijs/issues/4151
[lineTo]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineTo
[Soporte de la API Path2D]: https://github.com/Automattic/node-canvas/issues/1116
[tiny-sdf]: https://github.com/mapbox/tiny-sdf
[ShapePath]: https://github.com/mrdoob/three.js/blob/dev/src/extras/core/ShapePath.js
[CanvasRenderingContext2D]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
[Curva de Bézier]: https://en.wikipedia.org/wiki/B%C3%A9zier_curve
[Ghostscript Tiger.svg]: https://en.m.wikipedia.org/wiki/File:Ghostscript_Tiger.svg
[vello]: https://github.com/linebender/vello
[Teselación de polígonos]: https://andrewmarsh.com/software/tesselation-web/
[polilínea con varios segmentos]: /es/guide/lesson-012#polyline-with-multiple-segments
[RoughGenerator]: https://github.com/rough-stuff/rough/wiki/RoughGenerator
[isPointInPath]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInPath
[isPointInStroke]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInStroke
[GraphicsContext - containsPoint]: https://github.com/pixijs/pixijs/blob/dev/src/scene/graphics/shared/GraphicsContext.ts#L1072
[OffscreenCanvas]: /es/guide/lesson-011#offscreen-canvas
[PickingPlugin]: /es/guide/lesson-006#picking-plugin
[Dibujar un círculo hueco en SVG]: https://stackoverflow.com/questions/8193675/draw-a-hollow-circle-in-svg
[fill-rule]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-rule
[¿cómo funciona fill-rule="evenodd" en una estrella SVG?]: https://stackoverflow.com/a/46145333/4639324
[Triangulación por recorte de orejas]: https://www.geometrictools.com/Documentation/TriangulationByEarClipping.pdf
[Hacer un gráfico con estilo de boceto]: https://observablehq.com/@jwolondon/making-plot-sketchy
[watercolorizer]: https://github.com/32bitkid/watercolorizer
[Cómo hackear una pintura]: https://www.tylerxhobbs.com/words/how-to-hack-a-painting
[Guía para simular pintura de acuarela con arte generativo]: https://www.tylerxhobbs.com/words/a-guide-to-simulating-watercolor-paint-with-generative-art
