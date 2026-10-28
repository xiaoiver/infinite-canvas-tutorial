---
outline: deep
description: 'Vincula conectores a las formas para que las aristas sigan a los nodos cuando se mueven, incluidos los enlaces ortogonales, curvos y de flecha.'
---

<script setup>
import Binding from '../../components/Binding.vue'
import BindingWithEllipse from '../../components/BindingWithEllipse.vue'
import BindingOrthogonal from '../../components/BindingOrthogonal.vue'
import BindingConstraint from '../../components/BindingConstraint.vue'
import BindingRouteOrthConnector from '../../components/BindingRouteOrthConnector.vue'
import BindingRounded from '../../components/BindingRounded.vue'
import BindingCurved from '../../components/BindingCurved.vue'
import BindingBezier from '../../components/BindingBezier.vue'
import BindingArrow from '../../components/BindingArrow.vue'
import BindingDangling from '../../components/BindingDangling.vue'
import BindingLoop from '../../components/BindingLoop.vue'
</script>

# Lección 31 - Enlaces entre formas {#lesson-31-bindings-between-shapes}

En [Lección 23 - Mapa mental] solo nos centramos en los algoritmos de disposición de nodos y aristas, sin entrar en interacciones como mover las aristas cuando se mueven los nodos. Del mismo modo, en [Lección 25 - Dibujar flechas], las propiedades de las líneas y las flechas no incluían información de enlace. En esta lección completaremos esta funcionalidad.

## Estructura de datos {#data-structure}

### Elementos lineales en excalidraw {#excalidraw-linear-element}

En Excalidraw, las líneas de conexión (como las flechas) se representan en el modelo de datos como `ExcalidrawLinearElement`, que añade campos relacionados con la conexión:

```ts
export declare type PointBinding = {
    elementId: ExcalidrawBindableElement['id'];
    focus: number;
    gap: number;
};
export declare type ExcalidrawLinearElement = _ExcalidrawElementBase &
    Readonly<{
        type: 'line' | 'arrow';
        points: readonly Point[];
        lastCommittedPoint: Point | null;
        startBinding: PointBinding | null;
        endBinding: PointBinding | null;
        startArrowhead: Arrowhead | null;
        endArrowhead: Arrowhead | null;
    }>;
```

Como se ve arriba, cada flecha tiene campos opcionales `startBinding` y `endBinding`, que están en un nivel semántico distinto de `points`. El primero representa restricciones semánticas, mientras que `points` representa la geometría. Cuando ambos existen a la vez, hay que recalcular `points`. Además, están los estilos de punta inicial y final (`startArrowhead/endArrowhead`). El `elementId` de `PointBinding` apunta a la forma conectada (elementos enlazables como rectángulos, elipses, texto, imágenes, etc.), mientras que `focus` y `gap` sirven para localizar el punto de conexión (un índice en coma flotante y una distancia de separación). Por ejemplo, abajo hay un elemento flecha en JSON:

```ts
{
  "type": "arrow",
  // ... other properties omitted ...
  "startBinding": {
    "elementId": "xw25sQBsbd2mecyjTrYHA",
    "focus": -0.0227,
    "gap": 15.6812
  },
  "endBinding": null,
  "points": [[0,0],[0,109]],
  "startArrowhead": null,
  "endArrowhead": null
}
```

En este ejemplo, el `startBinding` de la flecha apunta a una forma con ID `"xw25sQBsbd2mecyjTrYHA"`, y `focus` y `gap` definen la posición de conexión a partir del límite de esa forma.

Al mismo tiempo, cada forma enlazada (como un rectángulo o una elipse) tiene una lista `boundElements` en su estructura de datos básica, que registra todas las flechas o los elementos de texto conectados a ella. El tipo de este campo suele ser `{ id: ExcalidrawLinearElement["id"]; type: "arrow"|"text"; }[] | null`. En otras palabras, la conexión entre flechas y formas se mantiene en ambos sentidos: las flechas registran el ID del elemento de destino al que se enlazan, y los elementos de destino registran los ID de las flechas que apuntan a ellos.

### Enlaces en tldraw {#tldraw-binding}

En tldraw, las «líneas de conexión» también son formas (por defecto, la forma flecha), y sus relaciones de conexión se representan mediante objetos Binding. Cada registro de enlace existe por separado en el almacenamiento y representa la asociación entre dos formas. Para las conexiones de flecha se usa el tipo `TLArrowBinding`, una especialización de `TLBaseBinding<'arrow',TLArrowBindingProps>`. Un ejemplo típico de registro de enlace de flecha es el siguiente:

```ts
{
  id: 'binding:abc123',
  typeName: 'binding',
  type: 'arrow',           // Binding type is arrow
  fromId: 'shape:arrow1',  // Arrow shape ID (arrow shape departure end)
  toId:   'shape:rect1',   // Target shape ID (shape the arrow points to)
  props: {
    terminal: 'end',       // Which end of the arrow to bind to (start or end)
    normalizedAnchor: { x: 0.5, y: 0.5 }, // Normalized anchor point on target shape
    isExact: false,        // Whether arrow enters inside target shape
    isPrecise: true,       // Whether to use anchor point precisely, otherwise use shape center
    snap: 'edge',          // Snap mode (such as edge snapping)
  },
  meta: {}
}
```

Aquí, los campos `fromId/toId` asocian las flechas con los destinos mediante ID de forma, y `props` guarda los detalles de la conexión (como puntos de anclaje, opciones de alineación, etc.)

### antv/g6 {#antv-g6}

Las relaciones de conexión son lógicas, no geométricas, y las trayectorias se calculan mediante `type` y algoritmos de enrutado de aristas:

```ts
interface EdgeConfig {
    id?: string;
    source: string; // Source node ID
    target: string; // Target node ID

    sourceAnchor?: number; // Source node anchor index
    targetAnchor?: number; // Target node anchor index

    type?: string; // line / polyline / cubic / loop ...
    style?: ShapeStyle;
}
```

Las anclas se declaran en los nodos, con coordenadas normalizadas:

```ts
anchorPoints: [
    [0.5, 0], // top
    [1, 0.5], // right
    [0.5, 1], // bottom
    [0, 0.5], // left
];
```

Los índices de ancla se usan en las aristas, de forma muy parecida al `normalizedAnchor` de tldraw, pero G6 sitúa la autoridad de definición de las anclas en los nodos:

```ts
{
    source: 'nodeA',
    target: 'nodeB',
    sourceAnchor: 1,
    targetAnchor: 3,
}
```

### mxGraph {#mxgraph}

mxGraph tiene un sistema completo de restricciones de conexión, definido sobre las formas de los nodos, que representa los puntos de conexión permitidos:

```ts
class mxConnectionConstraint {
    point: mxPoint | null; // (0.5, 0) = top center (1, 0.5) = right center
    perimeter: boolean; // Indicates projection along shape boundary
}
```

### Especificación JSON Canvas {#json-canvas-spec}

Obsidian publica la [Especificación JSON Canvas], que en su estructura se parece a `antv/g6`: el nivel superior guarda arrays de nodos y aristas:

```json
{
    "nodes": [],
    "edges": []
}
```

Las aristas tienen este aspecto: no llevan geometría, solo la conexión lógica:

```json
{
    "id": "f67890123456789a",
    "fromNode": "6f0ad84f44ce9c17",
    "toNode": "a1b2c3d4e5f67890"
}
```

## Nuestro diseño {#our-design}

En el esquema nos apoyamos más en el enfoque de mxGraph. Las relaciones lógicas de una arista se expresan con `fromId` y `toId`, así que no hacen falta campos geométricos como `x1/y1`. Una flecha que conecta `rect-1` y `rect-2` se declara así:

```ts
const edge1 = {
    id: 'line-1',
    type: 'line',
    fromId: 'rect-1',
    toId: 'rect-2',
    stroke: 'black',
    strokeWidth: 10,
    markerEnd: 'line',
};
```

Las restricciones viven en el nodo, de forma parecida a [mxConnectionConstraint]:

```ts
interface ConstraintAttributes {
    /**
     * Normalized point, relative to bounding box top-left.
     */
    point: [number, number];
    /**
     * Use perimeter.
     */
    perimeter: boolean;
    name?: string;
    dx?: number;
    dy?: number;
}
```

De forma parecida a [Lección 18 - Definir componentes padre-hijo], podemos implementar relaciones de enlace bidireccionales:

```ts
class Binding {
    @field.ref declare from: Entity;
    @field.ref declare to: Entity;
}

class Binded {
    @field.backrefs(Binding, 'from') declare fromBindings: Entity[];
    @field.backrefs(Binding, 'to') declare toBindings: Entity[];
}
```

### Caso especial {#special-case}

En la lección siguiente nos encontraremos un caso especial en el que `fromId/toId` puede ser null, como indican las líneas discontinuas del diagrama de secuencia de abajo, `fromId: 'alice', toId: undefined`

![Diagramas de secuencia en D2](/d2.png)

Introducimos un componente nuevo que registra una relación con un solo nodo asociado:

```ts
/**
 * Edge with only one end attached to a shape; the other end is fixed by `sourcePoint` / `targetPoint`.
 * `attached` is the entity on the connected side; `sourceIsAttached === 1` means the connection is on the source (`fromId`) side.
 */
class PartialBinding {
    @field.ref declare attached: Entity;
    /** 1 = source (from) side attached to node, 0 = target (to) side */
    @field.int32 declare sourceIsAttached: number;
}
```

<BindingDangling />

## Actualización automática {#auto-update}

Cuando cambia la posición de las formas conectadas, hay que recalcular las trayectorias de las aristas enlazadas. Podemos consultar todas las formas que tienen el componente `Binded`, vigilar los cambios de su caja delimitadora y actualizar entonces las aristas enlazadas:

```ts
class RenderBindings extends System {
    private readonly boundeds = this.query(
        (q) => q.with(Binded).changed.with(ComputedBounds).trackWrites,
    );

    execute() {
        const bindingsToUpdate = new Set<Entity>();
        this.boundeds.changed.forEach((entity) => {
            const { fromBindings, toBindings } = entity.read(Binded);
            [...fromBindings, ...toBindings].forEach((binding) => {
                bindingsToUpdate.add(binding);
            });
        });
        // Recalculate paths of bound edges and render
    }
}
```

En el ejemplo de abajo puedes probar a arrastrar los nodos, y las aristas recalcularán las trayectorias y se redibujarán:

<Binding />

Ahora mismo, los puntos inicial y final de las aristas son los centros de la caja delimitadora de las formas conectadas, coherente con el efecto cuando `isPrecise` vale `false` en tldraw, lo que indica un enlace impreciso.
En la mayoría de los casos queremos que las flechas no atraviesen las formas conectadas, sino que se acoplen con elegancia a los bordes de la forma.

## Algoritmo de perímetro {#perimeter}

Para los límites de la forma, drawio ofrece la propiedad `perimeter`; cambiarla afecta a las conexiones. Para más detalles, consulta: [Cambiar el perímetro de la forma]

![Estilos de perímetro y restricciones de puerto](https://drawio-app.com/wp-content/uploads/2019/02/drawio-perimeter-constraint-styles.png)

```ts
// Note: generally next is passed as "the other center point", orthogonal is usually false
var pointA = graph.view.getPerimeterPoint(stateA, centerB, false, 0);
var pointB = graph.view.getPerimeterPoint(stateB, centerA, false, 0);
```

### Algoritmo de perímetro del rectángulo {#rectangle-perimeter}

El algoritmo de perímetro del rectángulo es el más usado. En la implementación siguiente, `vertex` es el nodo de origen y `next` es el centro de la caja delimitadora del nodo de destino.
Primero se traza una línea entre los centros de las cajas delimitadoras del nodo de origen y del de destino, y después se determina a qué lado de la caja delimitadora del nodo de origen está más cerca el punto de destino. Las dos diagonales de la caja delimitadora dividen el plano en cuatro regiones. El rango del límite izquierdo es la región exterior a $[-\pi+t, \pi-t]$ (es decir, la condición `alpha < -pi + t || alpha > pi - t` del código):

```ts
function rectanglePerimeter(
    vertex: SerializedNode,
    next: IPointData,
    orthogonal: boolean,
): IPointData {
    const { x, y, width, height } = vertex;
    const cx = x + width / 2; // Source node center
    const cy = y + height / 2;
    const dx = next.x - cx;
    const dy = next.y - cy;
    const alpha = Math.atan2(dy, dx); // Slope of line from source node center to target node center
    const p: IPointData = { x: 0, y: 0 };
    const pi = Math.PI;
    const pi2 = Math.PI / 2;
    const beta = pi2 - alpha;
    const t = Math.atan2(height, width); // Diagonals divide into four regions
    if (alpha < -pi + t || alpha > pi - t) {
        // Intersects with left edge
        p.x = x;
        p.y = cy - (width * Math.tan(alpha)) / 2; // Calculate intersection point
    }
    // Other three edges omitted
    return p;
}
```

Por último, se calcula el punto de intersección de la línea con ese lado como punto de salida de la línea final. Por ejemplo, cuando determinamos que la línea pasará por el «lado izquierdo»:

1. Determina la coordenada $x$: como es el lado izquierdo, la coordenada $x$ del punto de intersección debe ser igual al valor del límite izquierdo del rectángulo, `vertex.x`.
2. Calcula el desplazamiento en $y$:
    1. La distancia horizontal del centro al lado izquierdo es `width / 2`.
    2. Usa la fórmula de la tangente: $\tan(\alpha) = \frac{\Delta y}{\Delta x}$.
    3. En el lado izquierdo, $\Delta x = -(\text{width} / 2)$.
    4. Así, el desplazamiento vertical $\Delta y = \Delta x \cdot \tan(\alpha) = -\frac{\text{width}}{2} \cdot \tan(\alpha)$.
3. Coordenada final: `p.y = cy + Δy`, que en el código es `cy - (width * Math.tan(alpha)) / 2`.

draw.io también ofrece otra opción, `orthogonal`, que significa que la línea calculada tiene que alinearse de forma ortogonal (es decir, con el eje x o el eje y), y la línea solo considera la extensión horizontal o vertical. En este caso, el otro punto central no se puede usar como referencia:

```ts
if (orthogonal) {
    if (next.x >= x && next.x <= x + width) {
        p.x = next.x;
    } else if (next.y >= y && next.y <= y + height) {
        p.y = next.y;
    }
    if (next.x < x) {
        p.x = x;
    } else if (next.x > x + width) {
        p.x = x + width;
    }
    if (next.y < y) {
        p.y = y;
    } else if (next.y > y + height) {
        p.y = y + height;
    }
}
```

<BindingOrthogonal />

### Algoritmo de perímetro de la elipse {#ellipse-perimeter}

Para los nodos elípticos hay que calcular el punto de intersección de la línea con la elipse:

```ts
const d = dy / dx;
const h = cy - d * cx;
const e = a * a * d * d + b * b;
const f = -2 * cx * e;
const g = a * a * d * d * cx * cx + b * b * cx * cx - a * a * b * b;
const det = Math.sqrt(f * f - 4 * e * g);

const xout1 = (-f + det) / (2 * e);
const xout2 = (-f - det) / (2 * e);
const yout1 = d * xout1 + h;
const yout2 = d * xout2 + h;
const dist1 = Math.sqrt(Math.pow(xout1 - px, 2) + Math.pow(yout1 - py, 2));
const dist2 = Math.sqrt(Math.pow(xout2 - px, 2) + Math.pow(yout2 - py, 2));

let xout = 0;
let yout = 0;
if (dist1 < dist2) {
    xout = xout1;
    yout = yout1;
} else {
    xout = xout2;
    yout = yout2;
}
return { x: xout, y: yout };
```

La línea pasa por el centro $(cx, cy)$ y su ecuación es $y = d \cdot x + h$:

-   Pendiente $d = \frac{dy}{dx}$
-   Ordenada en el origen $h = cy - d \cdot cx$

Sustituye la ecuación de la línea en la ecuación estándar de la elipse:

$$\frac{(x-cx)^2}{a^2} + \frac{(d \cdot x + h - cy)^2}{b^2} = 1$$

Desarrolla y reordena en una ecuación de segundo grado en $x$: $ex^2 + fx + g = 0$. Los e, f, g del código corresponden a:

-   $e$: coeficiente cuadrático
-   $f$: coeficiente lineal
-   $g$: término constante

Fórmula cuadrática: usa el discriminante $det = \sqrt{f^2 - 4eg}$ para calcular los dos puntos de intersección $xout1$ y $xout2$. Elige un punto: un rayo que atraviesa una elipse produce dos puntos de intersección (uno delante y otro detrás). El código calcula las distancias de ambos puntos de intersección al punto de destino `next` (dist1 y dist2) y selecciona el más cercano.

<BindingWithEllipse />

## Restricción {#constraint}

Llegados aquí, hemos implementado conexiones lógicas en las aristas usando solo `fromId` y `toId`. Los puntos de conexión de aristas y nodos son flotantes, y en mxGraph se llaman `FloatingTerminalPoint`. Sin embargo, a veces queremos que las aristas salgan de una posición fija de un nodo y entren por una posición fija de la forma conectada, lo que en mxGraph se llama `FixedTerminalPoint`. En esos casos hay que definir restricciones, y separar el proceso en partes distintas para nodos y aristas.

### Restricción en el nodo {#constraint-on-node}

Las restricciones de nodo definen dónde y cómo se pueden hacer las conexiones. No son «puntos», sino objetos de regla, definidos en mxGraph así:

```ts
class mxConnectionConstraint {
    point: mxPoint | null; // Normalized coordinates (0~1)
    perimeter: boolean; // Whether to project onto the boundary
    name?: string; // Optional port name
}
```

En el editor de draw.io que lo acompaña se ven numerosos «puntos de conexión azules» en el diagrama. Se definen sobrescribiendo las restricciones del diagrama:

```ts
mxRectangleShape.prototype.getConstraints = function (style) {
    return [
        new mxConnectionConstraint(new mxPoint(0.5, 0), true), // top
        new mxConnectionConstraint(new mxPoint(1, 0.5), true), // right
        new mxConnectionConstraint(new mxPoint(0.5, 1), true), // bottom
        new mxConnectionConstraint(new mxPoint(0, 0.5), true), // left
    ];
};
```

Nuestras restricciones se definen así: en un nodo se puede declarar un conjunto de restricciones:

```ts
export interface ConstraintAttributes {
    x?: number;
    y?: number;
    perimeter?: boolean;
    dx?: number;
    dy?: number;
}

export interface BindedAttributes {
    constraints: ConstraintAttributes[];
}
```

Recupera las restricciones candidatas, selecciona la restricción más cercana y convierte la restricción en un punto geométrico. Si hace falta proyectar sobre el límite, continúa con la lógica de cálculo del algoritmo de límite presentada en la sección anterior.

### Restricción en la arista {#constraint-on-edge}

También tienes que definir por qué punto de anclaje del nodo entrará o saldrá la arista. Durante la interacción, esto corresponde a arrastrar el extremo de la arista hasta el punto de anclaje del nodo. En ese momento, `entryX/entryY` debe copiar el campo `x/y` de la restricción del punto de anclaje:

```ts
interface BindingAttributes {
    fromId: string;
    toId: string;
    orthogonal: boolean;
    exitX: number; // [!code ++]
    exitY: number; // [!code ++]
    exitPerimeter: boolean; // [!code ++]
    exitDx: number; // [!code ++]
    exitDy: number; // [!code ++]
    entryX: number; // [!code ++]
    entryY: number; // [!code ++]
    entryPerimeter: boolean; // [!code ++]
    entryDx: number; // [!code ++]
    entryDy: number; // [!code ++]
}
```

En el ejemplo siguiente hemos definido los puntos de anclaje `[1, 0]` y `[0, 1]` en los rectángulos gris y verde, respectivamente.

Las coordenadas de extremo `exitX/exitY` y `entryX/entryY` deben ser números finitos. Si alguna coordenada no es válida, el extremo vuelve al perímetro de la forma, en lugar de producir una trayectoria no finita. Los desplazamientos en píxeles no válidos (`exitDx/exitDy` o `entryDx/entryDy`) se ignoran mientras un ancla válida permanece fija.

Con la herramienta de flecha, haz clic una vez para elegir el origen y mueve el puntero para previsualizar la conexión. La previsualización sigue el movimiento horizontal y vertical, también cuando cualquiera de los extremos está sobre el lienzo vacío. Haz clic otra vez para terminar, o pulsa Escape para cancelar.

<BindingConstraint />

## Reglas de enrutado {#routing rules}

mxGraph usa funciones EdgeStyle para implementar las reglas de enrutado, que se encargan de:

-   Seleccionar de forma automática las direcciones de salida
-   Insertar puntos de paso
-   Evitar las cajas delimitadoras de los nodos
-   Calcular trayectorias ortogonales y en ángulo recto

![Estilos de conector](https://drawio-app.com/wp-content/uploads/2019/02/drawio-connector-styles.png)

| Conector         | Características                                                          | Casos de uso                                                          |
| ---------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| OrthConnector    | Genera de forma automática aristas ortogonales con soporte complejo de restricciones | Diagramas de flujo, organigramas y otros escenarios de disposición automática |
| SegmentConnector | Admite puntos de control definidos por el usuario; flexible e interactivo | Cuando el usuario necesita ajustar a mano las trayectorias ortogonales |
| ElbowConnector   | Un único punto de giro en forma de L                                     | Trayectorias simples de 2 segmentos (por ejemplo, la navegación de migas de pan) |
| SideToSide       | Conexión con prioridad en la dirección horizontal                        | Cuando los nodos de origen y destino están distribuidos en horizontal |
| TopToBottom      | Conexión con prioridad en la dirección vertical                          | Cuando los nodos de origen y destino están distribuidos en vertical   |
| EntityRelation   | Específico de diagramas de relaciones de bases de datos; genera trayectorias flexibles | Diagramas ER de bases de datos y relaciones bidireccionales          |
| Loop             | Implementa conexiones de bucle propio                                    | Relaciones de bucle propio en diagramas de estados o de autómatas     |

### OrthConnector {#orth-connector}

[OrthConnector] es el algoritmo de enrutado más habitual, con el objetivo central de crear una trayectoria entre los nodos de origen y de destino formada solo por segmentos horizontales y verticales, evitando las líneas diagonales. Los pasos concretos son:

1. Determina la dirección de salida y de entrada del origen y del destino
2. Busca patrones de enrutado predefinidos según las combinaciones de dirección
3. Aplica los patrones de enrutado para generar una secuencia de puntos de giro
4. Trata la evasión de obstáculos y la optimización

```ts
┌──────┐        ┌──────┐
│ Node │ ─┐     │ Node │
└──────┘  └────▶└──────┘
```

<BindingRouteOrthConnector />

#### Selección de puertos preferidos {#preferred-port-selections}

Primero, considera el caso sin restricciones de puerto. El paso inicial es determinar el cuadrante del destino respecto al origen. Al comparar los centros geométricos de ambos, obtenemos:

```ts
// 0 | 1
// -----
// 3 | 2

let dx = sourceCenX - targetCenX;
let dy = sourceCenY - targetCenY;
let quad = 0;
if (dx < 0) {
    if (dy < 0) {
        quad = 2;
    } else {
        quad = 1;
    }
}
// Other circumstances omitted.
```

Después viene la parte más compleja: determinar en qué dirección deben salir las aristas del nodo de origen y entrar en el nodo de destino.

Primero, calcula la distancia entre nodos:

```ts
        sourceTopDist
             ↑
    [Source] |
             ↓
        sourceBottomDist
             ↑
             | [Target]

sourceLeftDist ← [Source] → sourceRightDist → [Target]
```

Después determina la dirección preferida con una estrategia que favorece la dirección con más espacio disponible:

-   Si la distancia hacia la izquierda ≥ la distancia hacia la derecha, el nodo de origen prefiere moverse al oeste (izquierda).
-   Si la distancia hacia arriba ≥ la distancia hacia abajo, el nodo de origen prefiere moverse al norte (arriba).
-   La dirección preferida del nodo de destino es la dirección opuesta a la del nodo de origen.

```ts
var dirPref = [];
var horPref = [];
var vertPref = [];

horPref[0] =
    sourceLeftDist >= sourceRightDist
        ? mxConstants.DIRECTION_MASK_WEST
        : mxConstants.DIRECTION_MASK_EAST;
vertPref[0] =
    sourceTopDist >= sourceBottomDist
        ? mxConstants.DIRECTION_MASK_NORTH
        : mxConstants.DIRECTION_MASK_SOUTH;

horPref[1] = mxUtils.reversePortConstraints(horPref[0]);
vertPref[1] = mxUtils.reversePortConstraints(vertPref[0]);

var preferredHorizDist =
    sourceLeftDist >= sourceRightDist ? sourceLeftDist : sourceRightDist;
var preferredVertDist =
    sourceTopDist >= sourceBottomDist ? sourceTopDist : sourceBottomDist;
```

#### Elegir patrones de ruta {#choose-route-patterns}

A partir de los índices direccionales del origen y del destino, selecciona un patrón de ruta de los `routePatterns` predefinidos para asegurar la calidad, codificado con una máscara de bits:

-   4 bits bajos: dirección (1 = oeste, 2 = norte, 4 = este, 8 = sur)
-   Bits 5-8: qué lado de la arista
-   Bit 9: si se usa el punto central
-   Bit 10: si se asocia con el nodo de origen
-   Bit 11: si se asocia con el nodo de destino

```ts
routePatterns: [
    [ [ 513, 2308, 2081, 2562 ], [ 513, 1090, 514, 2184, 2114, 2561 ],
        [ 513, 1090, 514, 2564, 2184, 2562 ],
        [ 513, 2308, 2561, 1090, 514, 2568, 2308 ] ],
    // ... more patterns
],
```

#### Generar puntos de paso {#generate-waypoints}

Recorre los patrones de enrutado y genera los puntos reales de la trayectoria según la dirección.

```ts
for (var i = 0; i < routePattern.length; i++)
{
    var nextDirection = routePattern[i] & 0xF;

    // Rotate the index of this direction by the quad
    var directionIndex = nextDirection == mxConstants.DIRECTION_MASK_EAST ? 3
            : nextDirection;

    directionIndex += quad;

    if (directionIndex > 4)
    {
        directionIndex -= 4;
    }
```

Por último, simplifica los puntos de trayectoria adyacentes que quedan muy cerca entre sí. Para esto seguimos usando [simplify-js], como en [Lección 12 - Simplificar la polilínea].

### SegmentConnector {#segment-connector}

OrthConnector se inclina hacia el enrutado automático. Cuando el usuario indica de forma explícita puntos de control `controlHints`, SegmentConnector convierte esas indicaciones en puntos de paso que hay que atravesar o a los que hay que alinearse, y la polilínea resultante se construye en gran medida alrededor de estas indicaciones, así que resulta más predecible y coherente para la edición interactiva.

### LoopConnector {#loop-connector}

Cuando el inicio y el final coinciden, necesitamos un bucle propio.

<BindingLoop />

## Estilo de línea del conector {#connectors-style}

![fuente: https://www.drawio.com/doc/faq/connector-styles](https://www.drawio.com/assets/img/blog/style-tab-line-style.png)

### Redondeado {#rounded}

Las esquinas redondeadas significan que seguimos usando los puntos de paso de la polilínea calculados antes, pero sustituimos las esquinas agudas por transiciones suaves en las uniones. Los pasos son:

-   Recorre cada codo de la polilínea.
-   A ambos lados de cada esquina, retrocede a lo largo del segmento (como máximo la mitad de la longitud del segmento).
-   Usa `quadTo` (o un comando de curva equivalente) para dibujar un empalme suave en la esquina.

<BindingRounded />

### Bézier cuadrática {#curved}

Usa segmentos de Bézier cuadrática para conectar puntos de control adyacentes:

```ts
const p0 = pts[n - 2];
const p1 = pts[n - 1];
parts.push(
    `Q ${formatNumber(p0.x)} ${formatNumber(p0.y)} ${formatNumber(
        p1.x,
    )} ${formatNumber(p1.y)}`,
);
```

<BindingCurved />

### Bézier cúbica {#bezier}

Cuando hay `3n+1` puntos, interprétalos directamente como puntos de control de Bézier cúbica en la forma `[anchor, cp1, cp2, anchor, ...]`; si no, vuelve a los segmentos de Bézier cuadrática.

```ts
if ((n - 1) % 3 === 0) {
    for (let i = 1; i + 2 < n; i += 3) {
        const cp1 = pts[i];
        const cp2 = pts[i + 1];
        const end = pts[i + 2];
        parts.push(
            `C ${formatNumber(cp1.x)} ${formatNumber(cp1.y)} ` +
                `${formatNumber(cp2.x)} ${formatNumber(cp2.y)} ` +
                `${formatNumber(end.x)} ${formatNumber(end.y)}`,
        );
    }
    return parts.join(' ');
}
```

<BindingBezier />

### Conservar curvas editables {#editable-curves}

Un `path` o `rough-path` de ECS con un único segmento editable `Q` o `C` conserva
sus puntos de control al cargar un documento o al actualizar sus enlaces. Mover un
extremo enlazado también mueve su control cúbico adyacente. Cuando una cuadrática conecta
ambos extremos de forma directa, su control compartido se mueve según la media de sus
desplazamientos. Mover ambos extremos la misma cantidad traslada, por tanto, esa
curva sin cambiar su forma.
Un extremo no enlazado conserva su geometría editada aunque un `sourcePoint` o
`targetPoint` guardado esté obsoleto. La rotación, la reflexión y la escala se incluyen al aplicar
estos cambios. Las rutas con varios segmentos de Bézier siguen usando el enrutador.

### Etiquetas de arista {#edge-labels}

Un nodo hijo `text` puede usar `edgeLabelPosition` para indicar una posición en la
arista padre. Los valores se recortan a `[0, 1]`. `edgeLabelOffset` es una distancia con signo a lo largo
de la normal; los valores positivos colocan la etiqueta debajo de una arista horizontal que va de izquierda a
derecha. Editar cualquiera de las dos propiedades actualiza la etiqueta de inmediato y admite deshacer,
rehacer y recargar el documento. Borrar `edgeLabelOffset` restaura cero; borrar
`edgeLabelPosition` desactiva la colocación automática.

Las etiquetas de trazado interpolan ahora a lo largo de la polilínea de los extremos de los comandos, usando
una cuerda para cada segmento curvo. Los comandos admitidos incluyen `H/V`, `S/T` y
`A`, además de `L`, `Q` y `C`. Es una aproximación de la longitud de la curva, y no
una colocación exacta a lo largo del contorno curvo.

## [WIP] Exportar SVG {#export-svg}

Al exportar ya no basta con guardar solo la información geométrica; también hay que persistir las relaciones lógicas. Por ejemplo, draw.io guarda el contenido mxfile original en el atributo `content` del `<svg>` al exportar (esto no forma parte de ninguna especificación formal):

```html
<svg content='&lt;mxfile host="app.diagrams.net" diagram name="Page-1"'></svg>
```

También podríamos usar:

```html
<line x1="0" y1="0" data-binding="" />
```

## Editor {#editor}

### Resaltar anclas {#highlight-anchors}

-   Cuando se selecciona un nodo, muestra los puntos de anclaje disponibles desde los que se pueden iniciar conexiones.
-   Cuando se selecciona una arista, resalta los puntos de anclaje acoplables durante el arrastre.

<BindingArrow />

[Lección 23 - Mapa mental]: /es/guide/lesson-023
[Lección 25 - Dibujar flechas]: /es/guide/lesson-025#draw-arrow
[Lección 18 - Definir componentes padre-hijo]: /es/guide/lesson-018#define-component
[Cambiar el perímetro de la forma]: https://www.drawio.com/doc/faq/shape-perimeter-change
[Especificación JSON Canvas]: https://jsoncanvas.org/spec/1.0/
[mxConnectionConstraint]: https://github.com/jgraph/drawio/blob/81a267568da862d3c99970758c09a8e768dea973/src/main/webapp/mxgraph/src/view/mxConnectionConstraint.js#L23
[OrthConnector]: https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/view/mxEdgeStyle.js#L1067
[simplify-js]: https://github.com/mourner/simplify-js
[Lección 12 - Simplificar la polilínea]: /es/guide/lesson-012#simplify-polyline
