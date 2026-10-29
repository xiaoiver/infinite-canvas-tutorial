---
outline: deep
description: 'Implementa un Transformer de formas con redimensionado y rotación. Aprende las anclas, la conversión de sistemas de coordenadas, la personalización del cursor CSS y la ampliación del área de detección para una edición de formas intuitiva.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 21 - Transformer' }]
---

<script setup>
import TransformerRect from '../../components/TransformerRect.vue'
import TransformerRectRotated from '../../components/TransformerRectRotated.vue'
import TransformerLine from '../../components/TransformerLine.vue'
import TransformerPolyline from '../../components/TransformerPolyline.vue'
import TransformerPath from '../../components/TransformerPath.vue'
</script>

# Lección 21 - Transformer {#lesson-21-transformer}

En la [Lección 14] presentamos brevemente el «modo de selección» del modo de lienzo. En este modo, después de seleccionar una forma, se superpone una capa de operaciones que permite moverla arrastrando. En esta lección añadiremos más capacidades de edición de formas, entre ellas el redimensionado y la rotación.

En Konva, la capa de operaciones sobre las formas seleccionadas se llama [Transformer] y ofrece estos ejemplos:

-   [Seleccionar, redimensionar y rotar formas en un lienzo HTML5]
-   [Limitar el arrastre y el redimensionado]

También elegimos el nombre Transformer. Se parece mucho al AABB de la forma. En realidad es un OBB (oriented bounding box, caja delimitadora orientada): un rectángulo con un ángulo de rotación en las coordenadas mundiales.

<TransformerRect />

## Serializar la matriz de transformación y la información de dimensiones {#serialize-transform-dimension}

En Figma, la matriz de transformación local y la información de dimensiones de las formas son las siguientes. Sabemos que, en las formas 2D, la matriz de transformación mat3 se puede descomponer en traslación, escala y rotación. X/Y corresponde a la traslación, y la escala se presenta en la sección [voltear](#flip). [fig-file-parser]

![fuente: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions](https://help.figma.com/hc/article_attachments/29799649003671)

Por eso modificamos la estructura [SerializedNode] para que describa tantas formas como sea posible, y quitamos algunos atributos de posición, como `cx/cy` del círculo, porque `cx/cy` se puede calcular a partir de `x/y` y `width/height`.

```ts
export interface TransformAttributes {
    // Transform
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    // Dimension
    width: number;
    height: number;
}
```

`<circle cx="100" cy="100" r="50" />` se serializa así. Se usa `ellipse` para poder redimensionarlo con más flexibilidad más adelante:

```js eval code=false
call(() => {
    const { createSVGElement, svgElementsToSerializedNodes } = ECS;
    const $circle = createSVGElement('circle');
    $circle.setAttribute('cx', '100');
    $circle.setAttribute('cy', '100');
    $circle.setAttribute('r', '50');
    const nodes = svgElementsToSerializedNodes([$circle]);
    return nodes[0];
});
```

En formas como Polyline y Path, definidas mediante los atributos `point` y `d`, no se pueden eliminar esos atributos. Hay que calcular su AABB y volver a calcularlos. Tomemos como ejemplo `<polyline points="50,50 100,100, 100,50" />`:

```js eval code=false
call(() => {
    const { createSVGElement, svgElementsToSerializedNodes } = ECS;
    const $polyline = createSVGElement('polyline');
    $polyline.setAttribute('points', '50,50 100,100, 100,50');
    const nodes = svgElementsToSerializedNodes([$polyline]);
    return nodes[0];
});
```

## Anclas {#anchors}

Las anclas del Transformer se dividen en dos categorías, redimensionado y rotación, y hay dos combinaciones habituales según el número.

Una la adoptan Excalidraw y Konva: 8 anclas alrededor del perímetro para el redimensionado, más un ancla de rotación independiente:

![Fuente: https://csswolf.com/the-ultimate-excalidraw-tutorial-for-beginners/](https://sp-ao.shortpixel.ai/client/to_auto,q_lossy,ret_img,w_1148/https://csswolf.com/wp-content/uploads/2023/11/image-9.png)

La otra la adoptan tldraw y Figma, con 4 anclas. Al acercarse a esas 4 anclas desde fuera, la interacción pasa a ser rotación, y el redimensionado horizontal y vertical se consigue arrastrando los cuatro bordes:

![Fuente: https://wpdean.com/how-to-rotate-in-figma/](https://wpdean.com/wp-content/uploads/2024/12/how-to-rotate-in-figma.jpg)

Elegimos esta solución, en apariencia más concisa: una máscara `Rect` como nodo padre y cuatro nodos hijo `Circle` como anclas:

```ts
const mask = this.commands.spawn(
    new UI(UIType.TRANSFORMER_MASK),
    new Transform(),
    new Renderable(),
    new Rect(), // Using Rect component
);
const tlAnchor = this.createAnchor(0, 0, AnchorName.TOP_LEFT); // Using Circle component
const trAnchor = this.createAnchor(width, 0, AnchorName.TOP_RIGHT);
const blAnchor = this.createAnchor(0, height, AnchorName.BOTTOM_LEFT);
const brAnchor = this.createAnchor(width, height, AnchorName.BOTTOM_RIGHT);

this.commands
    .entity(mask)
    .appendChild(this.commands.entity(tlAnchor))
    .appendChild(this.commands.entity(trAnchor))
    .appendChild(this.commands.entity(blAnchor))
    .appendChild(this.commands.entity(brAnchor));
```

### Sistema de coordenadas del Transformer {#transformer-coordinates}

En [Lección 6 - Conversión del sistema de coordenadas] implementamos la conversión entre los sistemas de coordenadas Viewport, Canvas y Client. Aquí hace falta un sistema nuevo: el sistema de coordenadas local de la máscara. Por ejemplo, cuando la máscara tiene transformaciones (como una rotación), las anclas, que son nodos hijo, necesitan conocer su posición en el sistema de coordenadas mundial. Añadimos este conjunto de métodos de conversión:

```ts
transformer2Canvas(camera: Entity, point: IPointData) {
    const { mask } = camera.read(Transformable);
    const matrix = Mat3.toGLMat3(mask.read(GlobalTransform).matrix);
    const [x, y] = vec2.transformMat3(
      vec2.create(),
      [point.x, point.y],
      matrix,
    );
    return {
      x,
      y,
    };
}
canvas2Transformer(camera: Entity, point: IPointData) {}
```

### Mostrar el cursor CSS {#display-css-cursor}

Al pasar el cursor sobre un ancla, el estilo del ratón tiene que mostrar de forma intuitiva la función correspondiente. En la web se hace modificando el estilo de `<canvas>`. El [cursor de CSS] predeterminado admite pocos iconos: por ejemplo, no hay un icono con semántica de rotación y, en Excalidraw y Konva, solo se puede usar `grab` en su lugar. Otro ejemplo: sí hay 8 iconos de redimensionado, pero, como las formas pueden rotar, cuando el ángulo no es un múltiplo entero de 45, aunque calculemos y elijamos el icono adecuado como hace Konva, no podemos representarlo con precisión:

```ts
function getCursor(anchorName: string, rad: number) {
    rad += DEG_TO_RAD * (ANGLES[anchorName] || 0);
    const angle = (((RAD_TO_DEG * rad) % 360) + 360) % 360;

    if (inRange(angle, 315 + 22.5, 360) || inRange(angle, 0, 22.5)) {
        return 'ns-resize';
    }
}
```

Por eso necesitamos estilos de ratón personalizados que se puedan ajustar de forma dinámica según el ángulo de rotación. [Cómo rotar un cursor de CSS] propone una vía con SVG, y tldraw añade sobre esa base la lógica de cálculo dinámico del ángulo; consulta [useCursor]. Tomemos como ejemplo el ancla superior derecha:

![Ancla de rotación](/transformer-anchor-rotate.png)

Se aplica la transformación de rotación al icono SVG para obtener el valor de Cursor en ese momento:

```ts
// SVG angles are in degrees; both reflections are in the object's local axes.
const sx = scaleX < 0 ? -1 : 1;
const sy = scaleY < 0 ? -1 : 1;
const r = (rotation - cameraRotation) * RAD_TO_DEG;
const transform = `translate(16 16) rotate(${r}) scale(${sx} ${sy}) rotate(${tr}) translate(-16 -16)`;
```

Conserva el signo de cada eje de escala. SVG aplica las transformaciones de derecha a izquierda: orienta el gráfico para el control, lo refleja en los ejes locales del objeto y después lo rota hacia el viewport. El determinante por sí solo no distingue el reflejo horizontal, el vertical y el doble, y reflejar después de rotar apunta el cursor en la dirección equivocada.

Cuando el ratón se acerca más al ancla, la interacción pasa de rotación a redimensionado:

![Ancla de redimensionado](/transformer-anchor-resize.png)

¿Cómo se activa el picking al acercarse al ancla desde lejos?

### Ampliar el área de detección {#hit-area}

Primero pensamos en permitir que las formas amplíen, o incluso personalicen, el área de detección. Por ejemplo, Pixi.js ofrece [hitArea]. También podemos añadir este campo al componente Renderable:

```ts
export class Renderable {
    @field({ type: Type.object, default: null }) declare hitArea: Circle | Rect;
}
```

Hay que tener en cuenta esta propiedad al calcular los límites en el sistema ComputeBounds, de modo que se pueda definir un área de detección circular mayor que el ancla:

```ts
if (hitArea instanceof Circle) {
    renderBounds = Circle.getRenderBounds(hitArea);
}
```

Este enfoque tiene un problema evidente: aunque fijemos el área de detección en 5 veces el tamaño del ancla, al hacer zoom con la cámara sigue siendo necesario pasar el cursor sobre el ancla para activar el picking. Por eso hay que considerar el picking fuera del sistema de coordenadas mundial del lienzo.

### Picking en coordenadas del viewport {#picking-in-viewport-coordinates}

Hay que hacer la detección de picking en el sistema de coordenadas del viewport, para poder ignorar el zoom de la cámara.

Primero calculamos las posiciones de las cuatro anclas en el sistema de coordenadas mundial del lienzo, en lugar de usar directamente el `cx/cy` de las anclas. Si no, falla cuando el propio Transformer tiene rotación (lo veremos enseguida):

```ts
hitTest(api: API, { x, y }: IPointData) {
    const { tlAnchor, trAnchor, blAnchor, brAnchor } = camera.read(Transformable);

    const { x: tlX, y: tlY } = api.canvas2Viewport(
        // Need to consider Transformer's own transformation, such as rotation
        api.transformer2Canvas(camera, {
            x: tlAnchor.read(Circle).cx,
            y: tlAnchor.read(Circle).cy,
        }),
    );
    // Omit calculation of other anchor positions

    const distanceToTL = distanceBetweenPoints(x, y, tlX, tlY);
}
```

Después se comprueba primero si la distancia mínima a las cuatro anclas cumple el umbral de la interacción de redimensionado. Si lo cumple, se devuelve el nombre del icono de estilo de ratón correspondiente y se añade el ángulo de rotación para obtener el SVG rotado:

```ts
if (minDistanceToAnchors <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
    if (minDistanceToAnchors === distanceToTL) {
        return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-resize',
        };
    }
}
```

A continuación entra la detección de la interacción de rotación. En ese momento el punto de detección no puede estar dentro del Transformer. Puedes usar el método presentado en [Comprobar si un punto está dentro de un polígono]:

```ts
else if (
    !isInside &&
    minDistanceToAnchors <= TRANSFORMER_ANCHOR_ROTATE_RADIUS
) {
    if (minDistanceToAnchors === distanceToTL) {
        return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-rotate',
        };
    }
}
```

Por último llega la detección de redimensionado de los cuatro bordes del Transformer. Aquí hay que calcular la distancia del punto de detección al segmento; consulta [Gist: punto a segmento 2D]:

```ts
import distanceBetweenPointAndLineSegment from 'point-to-segment-2d';

const distanceToTopEdge = distanceBetweenPointAndLineSegment(
    point,
    [tlX, tlY],
    [trX, trY],
);
// Omit calculation of distance to other 3 edges

if (minDistanceToEdges <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
    if (minDistanceToEdges === distanceToTopEdge) {
        return {
            anchor: AnchorName.TOP_CENTER,
            cursor: 'ns-resize',
        };
    }
}
```

## Redimensionar una sola forma {#resize-single-shape}

En Figma / FigJam, además de poder cambiar el tamaño con libertad arrastrando las cuatro anclas de las esquinas y los cuatro bordes, también puedes:

-   Pulsar <kbd>Option</kbd> o <kbd>Alt</kbd> mientras arrastras para escalar desde el centro geométrico
-   Pulsar <kbd>Shift</kbd> mientras arrastras para fijar la esquina o el borde opuestos y escalar de forma proporcional en horizontal y en vertical
-   Combinar estas teclas

El efecto es el siguiente, tomado de [Redimensionar, rotar y voltear objetos en FigJam]:

![Redimensionado en FigJam](https://help.figma.com/hc/article_attachments/1500011223302)

Veamos primero cómo implementar el cambio de tamaño libre. Tomando como ejemplo el ancla superior izquierda, al arrastrar el ancla inferior derecha permanece fija:

```ts
private handleSelectedResizing(
    api: API,
    canvasX: number,
    canvasY: number,
    anchorName: AnchorName,
) {
    const { x, y } = api.canvas2Transformer({
      x: canvasX,
      y: canvasY,
    });
    if (anchorName === AnchorName.TOP_LEFT) {
        // Set top-left anchor point position
        Object.assign(tlAnchor.write(Circle), {
            cx: x,
            cy: y,
        });
    }
    // Omit other anchor point handling logic
    {
        const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
        const { cx: brCx, cy: brCy } = brAnchor.read(Circle);
        const width = brCx - tlCx;
        const height = brCy - tlCy;
        const { x, y } = api.transformer2Canvas({ x: tlCx, y: tlCy });
        // Recalculate selected shape position and size
        this.fitSelected(api, {
            x,
            y,
            width,
            height,
            rotation: this.#rotation,
        });
    }
}
```

Por último, se transforma la forma seleccionada a partir de las anclas superior izquierda e inferior derecha.

### Transformar la forma {#transform-shape}

Cuando ya se conocen las propiedades antes y después del redimensionado (la información de transformación y de dimensiones), es fácil calcular la matriz de transición entre esos dos estados:

```plaintext
// @see https://github.com/konvajs/konva/blob/master/src/shapes/Transformer.ts#L1106

[delta transform] = [new transform] * [old transform inverted]
```

```ts
const baseSize = 10000000;
const oldTr = mat3.create();
mat3.translate(oldTr, oldTr, [oldAttrs.x, oldAttrs.y]);
mat3.rotate(oldTr, oldTr, oldAttrs.rotation);
mat3.scale(oldTr, oldTr, [
    oldAttrs.width / baseSize,
    oldAttrs.height / baseSize,
]);
const newTr = mat3.create();
mat3.translate(newTr, newTr, [newAttrs.x, newAttrs.y]);
mat3.rotate(newTr, newTr, newAttrs.rotation);
mat3.scale(newTr, newTr, [
    newAttrs.width / baseSize,
    newAttrs.height / baseSize,
]);

const delta = mat3.multiply(newTr, newTr, mat3.invert(mat3.create(), oldTr));
```

Pero no se puede aplicar esta matriz directamente a la forma seleccionada. También hay que tener en cuenta la transformación del nodo padre del grafo de escena en el sistema de coordenadas mundial:

```plaintext
[delta transform] * [parent transform] * [old local transform] = [parent transform] * [new local transform]
```

La transformación nueva de la forma seleccionada en el sistema de coordenadas local se obtiene multiplicando por la izquierda la transformación mundial de su padre:

```plaintext
[new local] = [parent inverted] * [delta] * [parent] * [old local]
```

Por último, la matriz nueva en el sistema de coordenadas local se aplica a la forma seleccionada.

### Bloquear la relación de aspecto {#lock-aspect-ratio}

Seguimos con el ancla superior izquierda como ejemplo. Al bloquear la relación de aspecto no se puede fijar su posición directamente. Hay que volver a calcular la posición del ancla superior izquierda a partir de la relación de aspecto de la forma al empezar el arrastre, y mantener sin cambios la posición del ancla inferior derecha.

Primero se registran el OBB de la forma seleccionada y la relación de aspecto al empezar a arrastrar el ancla, equivalente a la pendiente de la diagonal:

```ts
if (input.pointerDownTrigger) {
    if (type === UIType.TRANSFORMER_ANCHOR) {
        this.#obb = this.getSelectedOBB();
        const { width, height } = this.#obb;
        const hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
        this.#sin = Math.abs(height / hypotenuse);
        this.#cos = Math.abs(width / hypotenuse);
    }
}
```

Durante el arrastre:

1. Mantén sin cambios la posición del ancla inferior derecha
2. Calcula la distancia diagonal de la superior izquierda a la inferior derecha en ese momento
3. Vuelve a calcular la posición del ancla superior izquierda a partir de la relación de aspecto guardada

```ts
if (lockAspectRatio) {
    // 1.
    const comparePoint = {
        x: brAnchor.read(Circle).cx,
        y: brAnchor.read(Circle).cy,
    };
    // 2.
    newHypotenuse = Math.sqrt(
        Math.pow(comparePoint.x - x, 2) + Math.pow(comparePoint.y - y, 2),
    );
    const { cx, cy } = tlAnchor.read(Circle);
    const reverseX = cx > comparePoint.x ? -1 : 1;
    const reverseY = cy > comparePoint.y ? -1 : 1;
    // 3.
    Object.assign(tlAnchor.write(Circle), {
        cx: comparePoint.x - newHypotenuse * this.#cos * reverseX,
        cy: comparePoint.y - newHypotenuse * this.#sin * reverseY,
    });
}
```

Hay que señalar que Konva.js no admite arrastrar los cuatro bordes conservando la relación de aspecto. En ese caso hay que desactivar esas cuatro anclas. Los detalles están en [¿Hay forma de conservar la relación de aspecto de la imagen al transformar?].

Nosotros sí podemos lograrlo con facilidad. Tomemos como ejemplo el arrastre del ancla del borde derecho:

1. Primero, fija la coordenada X del ancla inferior derecha
2. Como la coordenada X del ancla superior izquierda no cambia, se puede calcular la anchura transformada
3. Con la relación de aspecto bloqueada, la altura transformada también queda determinada, y se puede calcular
4. A partir de la diferencia de altura antes y después de la transformación, fija las coordenadas Y de las anclas superior izquierda e inferior derecha

```ts
if (anchorName === AnchorName.MIDDLE_RIGHT) {
    // 1.
    brAnchor.write(Circle).cx = x;

    if (lockAspectRatio) {
        // 2.
        const newWidth = brAnchor.read(Circle).cx - tlAnchor.read(Circle).cx;
        const tan = sin / cos;
        const newHeight = newWidth * tan; // 3.
        const deltaY = newHeight - (prevBrAnchorY - prevTlAnchorY);
        // 4.
        brAnchor.write(Circle).cy = brAnchor.read(Circle).cy + deltaY / 2;
        tlAnchor.write(Circle).cy = tlAnchor.read(Circle).cy - deltaY / 2;
    }
}
```

Durante el arrastre podemos mostrar la diagonal en tiempo real para dar una pista clara (normalmente una línea discontinua).

### Escalado centrado {#centered-scaling}

Seguimos con el ancla superior izquierda. En este caso el punto de referencia fijo pasa del ancla inferior derecha al centro geométrico, que también se registra al empezar el arrastre:

```ts
const comparePoint = centeredScaling
    ? {
          x: this.#obb.width / 2, // [!code ++]
          y: this.#obb.height / 2, // [!code ++]
      }
    : {
          x: brAnchor.read(Circle).cx,
          y: brAnchor.read(Circle).cy,
      };
```

Después se vuelve a calcular la posición del ancla inferior derecha, simétrica al ancla superior izquierda respecto del centro:

```ts
if (centeredScaling) {
    const tlOffsetX = tlAnchor.read(Circle).cx - prevTlAnchorX;
    const tlOffsetY = tlAnchor.read(Circle).cy - prevTlAnchorY;
    Object.assign(brAnchor.write(Circle), {
        cx: brAnchor.read(Circle).cx - tlOffsetX,
        cy: brAnchor.read(Circle).cy - tlOffsetY,
    });
}
```

### Voltear {#flip}

Al arrastrar un ancla o un borde hacia el lado opuesto se produce un volteo. Este es el efecto en Figma; observa el cambio de Rotation:

![Rotación de 180° al voltear](/resize-flip.gif)

Usamos un fondo degradado para mostrar este volteo con más claridad:

![Voltear un rectángulo con relleno degradado](/rotate-when-flipped.png)

El volteo al cruzar un borde está desactivado de forma predeterminada. El ejemplo interactivo de la parte superior de esta página lo activa y usa un degradado de naranja a azul para que el reflejo se vea:

```ts
api.setAppState({ flipEnabled: true });
```

Mantén fijos, durante todo el gesto, el marco de selección del momento en que se pulsa el puntero, las transformaciones de los nodos y la identidad de las anclas. Convierte el puntero a ese marco original y calcula las dimensiones con signo respecto de la esquina o el borde opuestos (el centro si mantienes pulsado Alt / Option). Una dimensión negativa significa reflejo. Si intercambias las anclas y tomas las dimensiones absolutas demasiado pronto, se pierde ese reflejo o el borde fijo se mueve en el fotograma siguiente. Cuando el tamaño es exactamente cero, usa una dimensión pequeña distinta de cero y continúa calculando las muestras siguientes a partir del marco original.

Después de aplicar la transformación, mantén positivos el `width` y el `height` del nodo, y obtén `rotation` y `scaleX` / `scaleY` de la misma descomposición de la matriz. Combinar la rotación descompuesta con los signos de escala anteriores es incorrecto. Al integrar en la geometría un trazado, una polilínea o una red vectorial, elimina la rotación y el reflejo que ya conserva Transform, para que la geometría no se refleje dos veces.

Una matriz reflejada puede tener descomposiciones equivalentes de rotación y escala. Comprueba la forma reflejada y el degradado, el borde fijo y las posiciones de las anclas, en lugar de exigir que Rotation cambie 180°. Shift conserva la relación de aspecto y Alt / Option conserva el centro; el marco al soltar, el gesto siguiente y deshacer/rehacer deben seguir siendo coherentes.

## Rotación {#rotation}

La rotación en Figma:

> Pasa el cursor justo por fuera de los límites de la capa hasta que aparezca el icono.
> Haz clic y arrastra para rotar la selección:
> Arrastra en el sentido de las agujas del reloj para crear un ángulo negativo (hacia -180°).
> Arrastra en sentido contrario a las agujas del reloj para crear un ángulo positivo (hacia 180°).
> Mantén pulsado Shift para ajustar los valores de rotación a incrementos de 15.

1. Al pulsar el puntero, guarda el OBB y los pivotes local y mundial. Usa el centro geométrico cuando no hay un pivote personalizado.
2. Sigue el ángulo anterior del puntero en coordenadas del lienzo. Acumula los deltas adyacentes de `atan2`, normalizados con `atan2(sin, cos)`, para que el ángulo siga siendo continuo al cruzar ±π.
3. Calcula el nuevo origen y la rotación a partir de ese pivote fijo y del OBB inicial, y actualiza los nodos mediante `Select.fitSelected`. Durante la rotación de una selección múltiple, muestra el mismo marco inicial rotado; al soltar, restaura la unión alineada con los ejes mundiales.

El módulo de ECS `systems/select/rotate-gesture.ts` se encarga del inicio del gesto, el muestreo, la finalización y la limpieza. `Select` conserva el despacho de la entrada, las actualizaciones de los nodos y el historial. `resize-gesture.ts` se encarga de las restricciones de redimensionado, el ajuste, el arrastre de extremos y los desplazamientos táctiles.

```ts
// Pointer down, after converting to canvas coordinates and pixel snapping:
beginRotateGesture(api, selection, { x: canvasX, y: canvasY });

// Pointer move:
updateRotateGesture(api, selection, { x: canvasX, y: canvasY }, (obb) => {
    this.fitSelected(api, obb, selection);
});

// Pointer up; Select records the resulting document once afterwards:
finishRotateGesture(api, selection);
```

<TransformerRectRotated />

### Cambiar el origen de rotación {#change-the-rotation-origin}

Este es el efecto de [Cambiar el origen de rotación] de Figma:

![Cambiar el origen de rotación](https://help.figma.com/hc/article_attachments/31937330391447)

Notas de implementación:

1. Añade un ancla central (`AnchorName.CENTER`) a la máscara del Transformer. Esta ancla se puede arrastrar.
2. Guarda el origen de rotación personalizado en coordenadas locales del Transformer (`rotatePivotX/Y`) e indica si el usuario lo ha fijado (`rotatePivotPinned`).
3. Al mover el puntero mientras se arrastra el ancla central, convierte las coordenadas del lienzo en coordenadas locales del Transformer:

```ts
const { x, y } = api.canvas2Transformer({ x: canvasX, y: canvasY }, mask);
tf.rotatePivotX = x;
tf.rotatePivotY = y;
tf.rotatePivotPinned = true;
```

4. Durante la rotación, usa este pivote (si no está definido, vuelve al centro geométrico) y mantén fija la posición mundial del pivote al calcular el origen nuevo del OBB:

```ts
const {
    obb,
    pivotWorld: [px, py],
    pivotLocal: [lx, ly],
} = gesture;
const rotation = obb.rotation + gesture.accumulated;
const c = Math.cos(rotation);
const s = Math.sin(rotation);
const newAttrs = {
    ...obb,
    x: px - lx * obb.scaleX * c + ly * obb.scaleY * s,
    y: py - lx * obb.scaleX * s - ly * obb.scaleY * c,
    rotation,
};
```

5. Restablece el pivote al centro cuando cambia el conjunto de nodos seleccionados.

## Mover formas con las teclas de flecha {#nudge-the-position}

Figma ofrece la función [Desplazar capas], que permite mover formas con las teclas de flecha arriba, abajo, izquierda y derecha, y también usar <kbd>Shift</kbd> para desplazamientos mayores. En nuestra implementación usaremos distancias fijas:

```ts
if (e.key === 'ArrowUp') {
    e.preventDefault();
    this.api.updateNodeOBB(selected, { y: selected.y - 10 });
    this.api.record();
}
```

## Alinear y distribuir una selección {#align-distribute}

La API de ECS ofrece seis modos de alineación: `left`, `right`, `top`, `bottom`, `centerH` y `centerV`. Usan los límites geométricos en el espacio mundial, sin incluir el grosor del trazo. Solo cambia la posición: la rotación, el reflejo, las dimensiones, los datos del trazado, las métricas del texto y las preferencias de tamaño de Flex permanecen intactos, también con padres rotados o escalados.

```ts
const ids = [...api.getAppState().layersSelected];
await api.edit((editor) => {
    editor.alignSelectedNodes('left', ids);
});
// Run a separate edit so derived geometry is refreshed between operations.
await api.edit((editor) => {
    editor.distributeSelectedNodesSpacing('horizontal', ids);
});
```

El espaciado acepta `horizontal` o `vertical`, ordena los nodos a lo largo de ese eje mundial y calcula huecos iguales de borde a borde a partir de la extensión de la selección. Los huecos pueden ser negativos si las formas se solapan. Se omiten los identificadores duplicados, los nodos eliminados, ausentes o bloqueados y las transformaciones de padre no invertibles. Un descendiente seleccionado se desplaza con su ancestro seleccionado, en lugar de moverse dos veces; hacen falta al menos dos nodos de nivel superior válidos. Los métodos indican si algún nodo se movió y no registran por sí mismos una disposición que no haya cambiado.

El panel de propiedades envía estas operaciones mediante `api.edit()`. Conserva el lienzo y los identificadores aceptados por el clic, resuelve los nodos activos en la fase de escritura y confirma un único paso de deshacer. Si un borrado o un bloqueo deja la operación sin cambios, la operación en cola se cancela sin capturar ediciones pendientes que no estén relacionadas. Quien llama a la API también puede pasar un `AbortSignal` a `edit()` para cancelar antes de la mutación.

## Transformer para otras formas {#transformer-for-other-shapes}

El Transformer que hemos implementado hasta ahora sirve para formas como círculos, elipses y rectángulos, pero no para líneas rectas, segmentos de polilínea ni curvas por tramos, que necesitan más puntos de control.

### Transformer para una línea {#transformer-for-line}

Por último, una línea recta solo necesita dos anclas, lo que simplifica mucho la serie de operaciones basadas en el rectángulo delimitador que presentamos antes.

```ts
export class Transformable {
    @field.ref declare lineMask: Entity;
    @field.ref declare x1y1Anchor: Entity;
    @field.ref declare x2y2Anchor: Entity;
}
```

![Transformer de una línea](/line-transformer.gif)

<TransformerLine />

### Transformer para una polilínea {#transformer-for-polyline}

En una polilínea, cada punto de conexión tiene un punto de control correspondiente, y entre cada par de puntos de control adyacentes se inserta un punto adicional para generar un segmento nuevo:

```ts
export class Transformable {
    @field.ref declare polylineMask: Entity;
    @field.object declare controlPoints: Entity[];
    @field.object declare segmentMidpoints: Entity[];
}
```

La interacción correspondiente es que, al pasar el cursor sobre un punto de control, puedes pulsar la tecla <kbd>Delete</kbd> para eliminarlo. Para combinar el redimensionado y la rotación del Transformer rectangular con la edición de vértices, también se puede hacer doble clic para entrar en el modo de edición de puntos de control.

<TransformerPolyline />

### Trazado {#transformer-for-path}

tldraw ofrece un ejemplo: [cubic-bezier-shape]. Para la edición interactiva hay que resolver dos problemas:

1. **Puntos editables estables**: cada ancla y cada punto de control de Bézier se pueden seleccionar y arrastrar, y los cambios se escriben de vuelta en `d`.
2. **Ida y vuelta sin perder la semántica**: usar, cuando sea posible, un conjunto pequeño y predecible de tipos de comando, y evitar escribir a mano un analizador completo de trazados en el editor.

Así que normalizamos `d` a un vocabulario reducido de comandos (por ejemplo, convertir los comandos relativos en absolutos) y usamos el **índice del comando + el desplazamiento de la coordenada en el array** como identidad de cada control. Durante el arrastre solo cambian las coordenadas numéricas; al final `path2String` vuelve a serializar a una cadena.

| Comando | Controles generados | Significado de `meta`                                                                                        |
| ------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| M / L   | Un vértice          | `coordOffset: 1` → ese punto `(x, y)`                                                                       |
| Q       | Control + extremo   | desplazamientos `1` y `3`                                                                                    |
| C       | cp1, cp2, extremo   | desplazamientos `1`, `3` y `5`                                                                               |
| A       | Solo el punto final | desplazamiento `6` (los arcos no tienen controles de Bézier en este editor; solo se expone el punto final) |

```ts
interface PathControlHandleMeta {
    commandIndex: number; // Index in the normalized command array.
    coordOffset: number; // Start index of this handle’s coordinates (1-based, since `command[0]` is the command letter).
}

type HandlePoint = {
    x: number;
    y: number;
    meta: PathControlHandleMeta;
};
```

Del mismo modo, un doble clic entra en el modo de edición de puntos de control.

<TransformerPath />

## Lectura adicional {#extended-reading}

-   [Desarrollo de un editor gráfico: cursor personalizado]

[Lección 14]: /es/guide/lesson-014
[Limitar el arrastre y el redimensionado]: https://konvajs.org/docs/sandbox/Limited_Drag_And_Resize.html
[Seleccionar, redimensionar y rotar formas en un lienzo HTML5]: https://konvajs.org/docs/select_and_transform/Basic_demo.html
[Transformer]: https://konvajs.org/api/Konva.Transformer.html
[Cambiar el origen de rotación]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01JTK11ERHCSVFRSE9F4125HAZ
[Redimensionar, rotar y voltear objetos en FigJam]: https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam
[Desplazar capas]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01HNBH5565CW1S5FTNP6RZF00C
[Cómo rotar un cursor de CSS]: https://stackoverflow.com/questions/44817022/how-can-i-rotate-a-css-cursor
[Desarrollo de un editor gráfico: cursor personalizado]: https://zhuanlan.zhihu.com/p/667709457
[useCursor]: https://github.com/tldraw/tldraw/blob/324a049abe8f414f96fdcbca68bb95396b6c1a46/packages/editor/src/lib/hooks/useCursor.ts#L12
[cursor de CSS]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
[hitArea]: https://pixijs.com/8.x/examples/events/custom-hitarea
[Comprobar si un punto está dentro de un polígono]: https://stackoverflow.com/questions/22521982/check-if-point-is-inside-a-polygon
[Gist: punto a segmento 2D]: https://gist.github.com/mattdesl/47412d930dcd8cd765c871a65532ffac
[Lección 6 - Conversión del sistema de coordenadas]: /es/guide/lesson-006#coordinates
[SerializedNode]: /es/guide/lesson-010#shape-to-serialized-node
[fig-file-parser]: https://madebyevan.com/figma/fig-file-parser
[¿Hay forma de conservar la relación de aspecto de la imagen al transformar?]: https://github.com/konvajs/react-konva/issues/407
[cubic-bezier-shape]: https://examples.tldraw.com/cubic-bezier-shape
