---
outline: deep
description: 'Implementa un sistema de eventos compatible con el DOM, con picking de figuras, arrastrar y soltar y soporte de gestos. Aprende a gestionar eventos de puntero, de ratón y táctiles para aplicaciones interactivas en el lienzo.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 6 - Sistema de eventos' }]
---
# Lección 6 - Sistema de eventos {#lesson-6-event-system}

En esta lección aprenderás lo siguiente:

-   Implementar un sistema de eventos compatible con la DOM Event API
-   Cómo hacer picking de un círculo
-   Implementar un plugin de arrastrar y soltar basado en nuestro sistema de eventos
-   Soporte para gestos de zoom con pellizco

```js eval code=false
$button = call(() => {
    const $button = document.createElement('button');
    $button.textContent = 'FlyTo origin';
    return $button;
});
```

```js eval code=false inspector=false
canvas = call(() => {
    const { Canvas } = Lesson6;
    return Utils.createCanvas(Canvas, 400, 400);
});
```

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson6;

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
        cursor: 'pointer',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    sun.addEventListener('pointerenter', () => {
        sun.fill = 'green';
    });
    sun.addEventListener('pointerleave', () => {
        sun.fill = 'red';
    });

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    const landmark = canvas.camera.createLandmark({
        x: 0,
        y: 0,
        zoom: 1,
        rotation: 0,
    });
    $button.onclick = () => {
        canvas.camera.gotoLandmark(landmark, {
            duration: 1000,
            easing: 'ease',
        });
    };

    return canvas.getDOM();
})();
```

Por ahora, las interacciones que admitimos están a nivel del lienzo. Sin embargo, en el futuro sin duda necesitaremos admitir funciones de edición de figuras individuales. Por ejemplo, al usar el ratón para seleccionar figuras, ¿cómo sabemos qué figura se ha seleccionado después de detectar un evento de clic en el lienzo? Queremos cambiar el color de un círculo rojo cuando el ratón entra en él o sale de él, como muestra el código siguiente:

```ts
sun.addEventListener('pointerenter', () => {
    sun.fill = 'green';
});
sun.addEventListener('pointerleave', () => {
    sun.fill = 'red';
});
```

Esto exige implementar un sistema de eventos completo.

## Diseñar un sistema de eventos {#design-a-event-system}

Al diseñar el sistema de eventos queremos seguir estos principios:

-   Mantenernos lo más cerca posible de la DOM Event API, no solo para reducir la curva de aprendizaje, sino también para integrarnos con el ecosistema existente (como las bibliotecas de gestos).
-   Ofrecer solo eventos estándar. Los eventos avanzados, como arrastrar y soltar y los gestos, deben definirse mediante extensiones.

La implementación que presentamos a continuación se basa por completo en los [documentos de diseño de eventos de PIXI.js], que PIXI.js v8 sigue usando. Si quieres profundizar en los detalles, te animamos a leer su código fuente.

### PointerEvent {#pointerevent}

El soporte de los navegadores para los eventos interactivos ha pasado por las etapas siguientes; para más detalles, consulta [Breve historia de PointerEvent]:

-   Al principio se ofrecía soporte para los eventos de ratón.
-   Cuando los dispositivos móviles se popularizaron, aparecieron los eventos táctiles, que además disparaban eventos de ratón.
-   Más tarde se introdujeron nuevos dispositivos de entrada, como los lápices, y eso dio lugar a una variedad de estructuras de eventos que hacía bastante penoso gestionarlos. Por ejemplo, consulta [gestión de compatibilidad de hammer.js para distintos eventos].
-   Se propuso un estándar nuevo, [PointerEvent], con el objetivo de cubrir todos los dispositivos de entrada anteriores.

![eventos de ratón, de puntero y táctiles](/mouse-pointer-touch-events.png)

Como resultado, [PointerEvent] de nivel 2 ya es compatible con todos los navegadores principales. Hammer.js lo admite desde 2016: [incidencia de hammer.js].

![¿puedo usar eventos de puntero?](/can-i-use-pointer-events.png)

Así que queremos normalizar Mouse / Touch / PointerEvent. El uso esperado es el siguiente:

```ts
circle.addEventListener('pointerdown', (e) => {
    e.target; // circle
    e.preventDefault();
    e.stopPropagation();
});
```

### DOMEventListener {#domeventlistener}

Primero tenemos que escuchar una serie de eventos interactivos en el lienzo, de nuevo mediante la implementación de un plugin:

```ts
export class DOMEventListener implements Plugin {}
```

Para detectar si el entorno actual admite eventos Pointer y Touch:

```ts
const supportsPointerEvents = !!globalThis.PointerEvent;
const supportsTouchEvents = 'ontouchstart' in globalThis;
```

Una vez que el entorno actual admite PointerEvent, podemos empezar a escuchar. Es importante tener en cuenta que no todos los eventos pueden escucharse en el `HTMLCanvasElement`. Por ejemplo, el detector del evento `pointermove` debe enlazarse a `window` o a `document`. De lo contrario, si un evento se dispara fuera del elemento DOM del lienzo, no se detectaría.

```ts
const addPointerEventListener = ($el: HTMLCanvasElement) => {
    globalThis.document.addEventListener('pointermove', onPointerMove, true);
    $el.addEventListener('pointerdown', onPointerDown, true);
    $el.addEventListener('pointerleave', onPointerOut, true);
    $el.addEventListener('pointerover', onPointerOver, true);
    globalThis.addEventListener('pointerup', onPointerUp, true);
    globalThis.addEventListener('pointercancel', onPointerCancel, true);
};
```

Si PointerEvent no está admitido, se pasa a escuchar MouseEvent, pero se llamará a funciones de procesamiento como `onPointerDown`, que internamente disparan las funciones hook correspondientes:

```ts
const addMouseEventListener = ($el: HTMLCanvasElement) => {
    globalThis.document.addEventListener('mousemove', onPointerMove, true);
    $el.addEventListener('mousedown', onPointerDown, true);
    $el.addEventListener('mouseout', onPointerOut, true);
    $el.addEventListener('mouseover', onPointerOver, true);
    globalThis.addEventListener('mouseup', onPointerUp, true);
};
const onPointerMove = (ev: InteractivePointerEvent) => {
    hooks.pointerMove.call(ev);
};
const onPointerUp = (ev: InteractivePointerEvent) => {
    hooks.pointerUp.call(ev);
};
```

Añadimos más hooks al lienzo, pendientes de que los plugins los disparen, y los plugins posteriores de procesamiento del sistema de eventos responderán a ellos:

```ts
export interface Hooks {
    pointerDown: SyncHook<[InteractivePointerEvent]>;
    pointerUp: SyncHook<[InteractivePointerEvent]>;
    pointerMove: SyncHook<[InteractivePointerEvent]>;
    pointerOut: SyncHook<[InteractivePointerEvent]>;
    pointerOver: SyncHook<[InteractivePointerEvent]>;
    pointerWheel: SyncHook<[InteractivePointerEvent]>;
    pointerCancel: SyncHook<[InteractivePointerEvent]>;
}
```

### Añadir detectores a la figura {#add-listeners-to-shape}

Nuestra clase base de figura debe extender `EventEmitter`, que ofrece los métodos `on`, `once` y `off`:

```ts
import EventEmitter from 'eventemitter3';
export abstract class Shape
    extends EventEmitter
    implements FederatedEventTarget {}
```

Tomando [addEventListener] como ejemplo, tenemos que implementarlo según el estándar de la DOM API con los métodos que ya existen. Por ejemplo, para los detectores de eventos que deben dispararse una sola vez, se indica en el momento del registro con el parámetro [once]:

```ts{10}
export abstract class Shape {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    const once = isObject(options) && options.once;
    const listenerFn = isFunction(listener) ? listener : listener.handleEvent;

    if (once) {
      this.once(type, listenerFn, context);
    } else {
      this.on(type, listenerFn, context);
    }
  }
}
```

Por limitaciones de espacio, los demás métodos no se desarrollan aquí. Las implementaciones detalladas pueden consultarse en el código fuente de PIXI.js:

-   `removeEventListener` para quitar detectores de eventos
-   `removeAllListeners` para quitar todos los detectores de eventos
-   `dispatchEvent` para despachar eventos personalizados

Con esto podemos usar la API siguiente para escuchar eventos y, a continuación, tendremos que implementar el objeto de evento `e` que se pasa al detector:

```ts
circle.addEventListener('pointerenter', (e) => {
    circle.fill = 'green';
});
```

### Objeto de evento {#event-object}

Para cumplir por completo con la DOM Event API, PIXI.js usa `FederatedEvent` para reflejar su carácter universal, lo que le permite implementar la interfaz [UIEvent]. Algunos métodos pueden invocar directamente eventos nativos, por ejemplo `preventDefault`.

```ts
export class FederatedEvent<N extends UIEvent | PixiTouch = UIEvent | PixiTouch>
    implements UIEvent
{
    preventDefault(): void {
        if (this.nativeEvent instanceof Event && this.nativeEvent.cancelable) {
            this.nativeEvent.preventDefault();
        }

        this.defaultPrevented = true;
    }
}
```

¿Cómo se convierte un objeto de evento nativo en `FederatedEvent`? PIXI.js primero los formatea como `PointerEvent`. En especial, para los puntos multitáctiles de `TouchEvent`, cada objeto Touch de `changedTouches` se formatea como un `PointerEvent` independiente.

```ts
function normalizeToPointerEvent(
    event: InteractivePointerEvent,
): PointerEvent[] {
    if (supportsTouchEvents && event instanceof TouchEvent) {
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i] as PixiTouch;
        }
    }
}
```

A continuación tenemos que convertir `PointerEvent` en `FederatedPointerEvent`.

```ts
function bootstrapEvent(
    event: FederatedPointerEvent,
    nativeEvent: PointerEvent,
): FederatedPointerEvent {}
```

La mayoría de los atributos pueden copiarse directamente del evento nativo, pero hay dos tipos de propiedades que necesitan un tratamiento especial:

-   La posición del evento dentro del sistema de coordenadas del lienzo.
-   [target] El objeto de destino del despacho del evento, es decir, en qué objeto gráfico del lienzo ocurre el evento.

Veamos primero el primer tipo de propiedad.

### Coordenadas {#coordinates}

Cuando hablamos de «posición», siempre es respecto a un sistema de coordenadas. Client, Screen y Page son sistemas de coordenadas que el navegador admite de forma nativa. Hemos añadido dos sistemas de coordenadas nuevos: el del lienzo y el del viewport.

El sistema de coordenadas del lienzo puede compararse con el sistema de coordenadas Screen del navegador, también conocido como sistema de coordenadas mundial. Las posiciones que indicamos al crear gráficos son todas relativas a este sistema de coordenadas. Usa como origen la esquina superior izquierda del elemento DOM del lienzo, con el eje X hacia la derecha de la pantalla y el eje Y hacia la parte inferior de la pantalla. También se llama «sistema de coordenadas mundial» y, en cuanto a la rotación, fijamos la dirección de rotación en el sentido de las agujas del reloj a lo largo de la dirección positiva del eje de coordenadas.

El sistema de coordenadas del viewport puede compararse con el sistema de coordenadas Client del navegador. La cámara determina el ángulo desde el que observamos el mundo. Si la cámara no se ha movido, el sistema de coordenadas del viewport y el sistema de coordenadas del lienzo coinciden por completo. Por tanto, dentro de nuestro rango visible, las coordenadas de la esquina superior izquierda del viewport son las mismas que el origen del sistema de coordenadas del lienzo: ambas son `[0, 0]`. Pero si la cámara se ha movido, rotado o ha hecho zoom, el viewport cambia en consecuencia y, en ese momento, la esquina superior izquierda `[0, 0]` del viewport corresponde a una posición del sistema de coordenadas del lienzo distinta de `[0, 0]`.

Ofrecemos métodos para convertirlos y los incorporamos al contexto del plugin:

```ts
interface PluginContext {
    api: {
        client2Viewport({ x, y }: IPointData): IPointData;
        viewport2Client({ x, y }: IPointData): IPointData;
        viewport2Canvas({ x, y }: IPointData): IPointData;
        canvas2Viewport({ x, y }: IPointData): IPointData;
    };
}
```

Antes de seguir con el procesamiento posterior del evento, convertimos las coordenadas del evento nativo al sistema de coordenadas del viewport y, después, al sistema de coordenadas mundial. Esto se hace dentro del plugin `Event`:

```ts
export class Event implements Plugin {
    private bootstrapEvent(
        event: FederatedPointerEvent,
        nativeEvent: PointerEvent,
    ): FederatedPointerEvent {
        const { x, y } = this.getViewportXY(nativeEvent);
        event.client.x = x;
        event.client.y = y;
        const { x: canvasX, y: canvasY } = this.viewport2Canvas(event.client);
        event.screen.x = canvasX;
        event.screen.y = canvasY;
    }
}
```

Con esto quedan establecidas las coordenadas del objeto de evento. Dejando de momento a un lado la cuestión de «en qué objeto gráfico ocurre el evento», veamos primero cómo implementar un proceso completo de propagación de eventos.

### Proceso de propagación de eventos {#event-propagation-process}

Quien conozca el flujo de eventos del DOM reconocerá sin duda los conceptos siguientes:

-   La propiedad `target` del objeto de evento apunta al elemento de destino, que en el contexto de la DOM API es, naturalmente, un elemento DOM, mientras que en nuestro lienzo es un objeto gráfico concreto. Lo presentaremos en la sección siguiente.
-   El flujo de eventos incluye las fases de captura y de burbujeo, y ciertos métodos del objeto de evento permiten intervenir en esas fases.
-   Se puede añadir uno o varios detectores para un evento concreto, y se disparan en el orden en que se registraron.

[Burbujeo y captura] muestran las tres etapas de la propagación de eventos: durante la fase de captura, los detectores se disparan de arriba abajo, llegan al nodo de destino y después burbujean hacia arriba. Dentro del detector se puede usar `eventPhase` para obtener la fase actual.

![flujo de eventos](https://javascript.info/article/bubbling-and-capturing/eventflow.svg)

PIXI.js implementa esto en `EventBoundary`.

```ts
propagate(e: FederatedEvent, type?: string): void {
  const composedPath = e.composedPath();

  // Capturing phase
  e.eventPhase = e.CAPTURING_PHASE;
  for (let i = 0, j = composedPath.length - 1; i < j; i++) {
    e.currentTarget = composedPath[i];
    this.notifyTarget(e, type);
    if (e.propagationStopped || e.propagationImmediatelyStopped) return;
  }

  // At target phase
  e.eventPhase = e.AT_TARGET;
  e.currentTarget = e.target;
  this.notifyTarget(e, type);
  if (e.propagationStopped || e.propagationImmediatelyStopped) return;

  // Bubbling phase
  e.eventPhase = e.BUBBLING_PHASE;
  for (let i = composedPath.length - 2; i >= 0; i--) {
    e.currentTarget = composedPath[i];
    this.notifyTarget(e, type);
    if (e.propagationStopped || e.propagationImmediatelyStopped) return;
  }
}
```

## Picking {#picking}

Determinar en qué objeto gráfico ocurre un evento se consigue con la función de picking. La DOM API ofrece el método [elementsFromPoint], que devuelve una lista de elementos correspondientes a un punto indicado en el sistema de coordenadas del viewport. Sin embargo, como no usamos un renderizador SVG, este método no nos sirve. Tenemos estas dos opciones:

-   Método geométrico. Por ejemplo, determinar si un punto está dentro de un círculo.
-   Método basado en la codificación de color en la GPU. Esto se detallará más adelante.

Desde el punto de vista de los criterios de picking, se pueden tener en cuenta aspectos como la visibilidad del gráfico, el trazo y el relleno, de forma parecida a cómo CSS ofrece la propiedad [pointer-events]. También añadimos una propiedad `pointerEvents` a la clase base del gráfico:

```ts{2}
export abstract class Shape {
  pointerEvents: PointerEvents = 'auto';
}

type PointerEvents =
  | 'none'
  | 'auto'
  | 'stroke'
  | 'fill'
  | 'painted'
  | 'visible'
  | 'visiblestroke'
  | 'visiblefill'
  | 'visiblepainted'
  | 'all'
  | 'non-transparent-pixel';
```

### Plugin de picking {#picking-plugin}

Crea un plugin de picking que recorra el grafo de escena desde el nodo raíz y determine, en secuencia, si el punto en el sistema de coordenadas mundial está dentro de un objeto gráfico. Es importante tener en cuenta que, cuando hay un acierto, el elemento debe añadirse al principio de la lista, porque los elementos que se renderizan más tarde aparecen en una capa superior debido a su orden de renderizado. Por supuesto, más adelante introduciremos un atributo `zIndex` para ajustar el orden de renderizado.

```ts{10}
export class Picker implements Plugin {
  private pick(result: PickingResult, root: Group) {
    const {
      position: { x, y },
    } = result;

    const picked: Shape[] = [];
    traverse(root, (shape: Shape) => {
      if (this.hitTest(shape, x, y)) {
        picked.unshift(shape);
      }
    });

    result.picked = picked;
    return result;
  }
}
```

Durante la detección, el primer paso es transformar el punto de destino del sistema de coordenadas mundial al sistema de coordenadas del modelo, lo que se consigue con la inversa de la matriz de transformación del modelo. Transformar al sistema de coordenadas del modelo simplifica al máximo los métodos geométricos de determinación posteriores:

```ts
export class Picker implements Plugin {
    private hitTest(shape: Shape, wx: number, wy: number): boolean {
        // skip testing
        if (shape.pointerEvents === 'none') {
            return false;
        }

        shape.worldTransform.applyInverse({ x: wx, y: wy }, tempLocalMapping);
        const { x, y } = tempLocalMapping;
        return shape.containsPoint(x, y);
    }
}
```

Ahora implementemos el método `containsPoint`.

### Método geométrico {#geometric-method}

Para determinar si un punto está dentro de un círculo podemos usar el conocido método del campo de distancia con signo (SDF), pero esta vez también tenemos en cuenta los atributos `strokeWidth` y `pointerEvents`:

```ts
class Circle {
    containsPoint(x: number, y: number) {
        const halfLineWidth = this.#strokeWidth / 2;
        const absDistance = vec2.length([this.#cx - x, this.#cy - y]);

        const [hasFill, hasStroke] = isFillOrStrokeAffected(
            this.pointerEvents,
            this.#fill,
            this.#stroke,
        );
        if (hasFill) {
            return absDistance <= this.#r;
        }
        if (hasStroke) {
            return (
                absDistance >= this.#r - halfLineWidth &&
                absDistance <= this.#r + halfLineWidth
            );
        }
        return false;
    }
}
```

Se ve bien, pero exige empezar el recorrido desde el nodo raíz del grafo de escena cada vez. Si en la escena hay muchos objetos gráficos, el coste es importante cuando los eventos se disparan con frecuencia. En la lección siguiente presentaremos métodos de optimización relacionados.

### hitArea {#hitarea}

A veces queremos cambiar el área interactiva de un gráfico, por ejemplo ampliarla un poco para que sea más fácil hacer clic cuando el gráfico es pequeño, o añadir áreas interactivas a un `Group` que no tiene una entidad tangible.

```ts
export interface FederatedEventTarget {
    hitArea?: Rectangle;
}
```

Podemos modificar el plugin `CameraControl` que creamos antes añadiendo primero un área interactiva infinitamente grande al nodo raíz. Aquí no podemos asignar directamente la coordenada superior izquierda del rectángulo a `[-Infinity, -Infinity]`, porque eso haría que el cálculo del ancho y del alto diera `NaN`, lo que impediría las detecciones posteriores:

```ts
root.hitArea = new Rectangle(
    -Number.MAX_VALUE,
    -Number.MAX_VALUE,
    Infinity,
    Infinity,
);
```

Escuchamos `FederatedPointerEvent` en lugar del MouseEvent nativo.

```ts
canvas.addEventListener('mousedown', (e: MouseEvent) => {}); // [!code --]
root.addEventListener('pointerdown', (e: FederatedPointerEvent) => {}); // [!code ++]
```

### hitStrokeWidth {#hit-stroke-width}

Para `Line`, `Polyline` y `Path`, un `strokeWidth` demasiado pequeño dificulta la interacción. Konva ofrece `hitStrokeWidth` para ampliar el área interactiva; consulta [¿Qué es hitStrokeWidth?].

Nosotros también usamos este nombre de propiedad.

### Picking con API {#picking-with-api}

La funcionalidad de picking no solo puede lograrse mediante eventos interactivos: también puede exponerse como una API para llamadas explícitas, de forma similar a [elementsFromPoint]. Se utilizará cuando implementemos el plugin de arrastrar y soltar en la sección siguiente.

```ts
class Canvas {
    elementsFromPoint(x: number, y: number): Shape[] {}
    elementFromPoint(x: number, y: number): Shape {}
}
```

## Plugin de arrastrar y soltar {#dragndrop-plugin}

Podemos implementar un plugin de arrastrar y soltar según [Arrastrar y soltar con eventos de ratón], con PointerEvent.

```ts
export class Dragndrop implements Plugin {}
```

Para determinar las condiciones con las que se inicia un «inicio de arrastre», se ofrecen las opciones de configuración siguientes, basadas respectivamente en la distancia y en el tiempo de arrastre. Solo cuando estas condiciones se cumplen por completo se dispara una serie de eventos de arrastrar y soltar como `dragstart`.

-   `dragstartDistanceThreshold`: esta opción de configuración sirve para fijar el umbral de detección de la distancia de arrastre, en píxeles. Solo las distancias mayores que este valor se consideran un inicio válido. El valor predeterminado es `0`.
-   `dragstartTimeThreshold`: esta opción de configuración sirve para fijar el umbral de detección del tiempo de arrastre, en milisegundos. Solo los tiempos mayores que este umbral se consideran un inicio válido. El valor predeterminado es `0`.

En la implementación de la HTML Drag and Drop API se dispara o bien un evento `click`, o bien un evento `drag`, pero nunca ambos para la misma acción. Este comportamiento se aprecia en el [ejemplo](https://plnkr.co/edit/5mdl7oTg0dPWXIip) que se ofrece.

Conservar este ajuste en tu implementación, de modo que un evento `click` no se dispare después de un evento `dragend`, encaja con cómo las personas suelen entender los elementos arrastrables e interactuar con ellos. Este enfoque garantiza un comportamiento coherente y predecible que mejora la experiencia de uso al distinguir con claridad entre arrastrar y hacer clic.

```ts
if (!e.detail.preventClick) {
    this.dispatchEvent(clickEvent, 'click');
}
```

## Modificar el plugin CameraControl {#modify-cameracontrol-plugin}

Para implementar el plugin `CameraControl` con funcionalidad de arrastre, empezarás por hacer arrastrable el nodo raíz y después pasarás de escuchar `pointerdown` y eventos similares a escuchar eventos relacionados con el arrastre.

```ts
root.draggable = true;
root.addEventListener('dragstart', (e: FederatedPointerEvent) => {});
root.addEventListener('drag', (e: FederatedPointerEvent) => {});
root.addEventListener('dragend', (e: FederatedPointerEvent) => {});
```

Por ahora, nuestra cámara no admite operaciones gestuales. Además de hacer zoom en el lienzo con la rueda del ratón, queremos añadir el gesto habitual `pinch` para interacciones con dos dedos, de forma similar a [pixi-viewport].

### Soporte del gesto de pellizco {#support-pinch-gesture}

Para simular eventos de gestos durante el desarrollo en PC podemos usar [hammer-touchemulator], que forma parte del ecosistema de [hammer.js]. Al usar el ratón junto con la tecla <kbd>Shift</kbd> es posible emular el disparo de varios PointerEvents. Por supuesto, también puedes usar el simulador de iOS de Xcode, que permite probar la interacción gestual, como el zoom con pellizco de dos dedos. [Interactuar con tu app en el simulador de iOS y iPadOS]

> Pellizco, zoom o rotación con dos dedos: haz clic y arrastra mientras mantienes pulsada la tecla Option.

Guarda la posición de cada objeto táctil al escuchar el evento `pointerdown`.

```ts
this.#touches[event.pointerId] = { last: null };
```

Al escuchar el evento `pointermove`, registra la distancia entre los dos puntos táctiles y compárala con la distancia anterior. Cuando los dos puntos se acercan, corresponde a alejar, y cuando se separan, corresponde a acercar.

```ts
zoomByPoint(point.x, point.y, (last / dist - 1) * PINCH_FACTOR);
```

Este es el efecto en el simulador de iOS.

![Pellizco en el simulador de iOS](/pinch-ios-simulator.gif)

### use-gesture {#use-gesture}

También podemos usar bibliotecas de gestos listas para usar, como [@use-gesture/vanilla]. El zoom con pellizco de dos dedos corresponde al acercar y alejar de la cámara, y el deslizamiento con dos dedos corresponde al paneo de la cámara.

```ts
import { Gesture } from '@use-gesture/vanilla';

const gesture = new Gesture(element as HTMLCanvasElement, {
    // camera zoom in/out
    onPinch: ({ event, first, last, da, origin }) => {},
});
```

## Lectura adicional {#extended-reading}

-   [Breve historia de PointerEvent]
-   [Burbujeo y captura]
-   [Arrastrar y soltar con eventos de ratón]:

[Breve historia de PointerEvent]: https://javascript.info/pointer-events#the-brief-history
[gestión de compatibilidad de hammer.js para distintos eventos]: https://github.com/hammerjs/hammer.js/tree/master/src/input
[incidencia de hammer.js]: https://github.com/hammerjs/hammer.js/issues/946
[PointerEvent]: https://www.w3.org/TR/pointerevents2/
[documentos de diseño de eventos de PIXI.js]: https://docs.google.com/document/d/1RyXrhrcZly2oPHPApKahE8pC7mEIDvuCPbE9VeYvmZw/edit
[addEventListener]: https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener
[pointer-events]: https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
[elementsFromPoint]: https://developer.mozilla.org/en-US/docs/Web/API/Document/elementsFromPoint
[Interactuar con tu app en el simulador de iOS y iPadOS]: https://developer.apple.com/documentation/xcode/interacting-with-your-app-in-the-ios-or-ipados-simulator#Interact-with-your-interface
[pixi-viewport]: https://github.com/davidfig/pixi-viewport
[hammer-touchemulator]: https://github.com/hammerjs/touchemulator
[hammer.js]: https://hammerjs.github.io/
[UIEvent]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/UIEvent
[once]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#once
[target]: https://developer.mozilla.org/en-US/docs/Web/API/Event/target
[Burbujeo y captura]: https://javascript.info/bubbling-and-capturing#capturing
[Arrastrar y soltar con eventos de ratón]: https://javascript.info/mouse-drag-and-drop
[¿Qué es hitStrokeWidth?]: https://konvajs.org/docs/events/Custom_Hit_Region.html#2-what-is-hitstrokewidth
[@use-gesture/vanilla]: https://github.com/pmndrs/use-gesture
