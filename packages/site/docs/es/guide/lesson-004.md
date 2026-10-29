---
outline: deep
description: 'Comprende los conceptos de la cámara, las transformaciones de proyección y las transformaciones de cámara. Implementa animaciones de cámara con transiciones mediante Landmark y controles interactivos para el paneo, la rotación y el zoom.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 4 - Cámara' }]
---
# Lección 4 - Cámara {#lesson-4-camera}

En esta lección aprenderás lo siguiente:

-   ¿Qué es una cámara?
-   Transformación de proyección.
-   Transformación de cámara.
-   Animación de cámara. Transición mediante Landmark entre distintos estados de la cámara.

Podemos cambiar el contenido que se muestra en el lienzo controlando la cámara. Al hacer clic y arrastrar el ratón se puede hacer un paneo; si mantienes pulsada <kbd>Shift</kbd> y arrastras, giras alrededor de un punto indicado; con la rueda del ratón acercas y alejas respecto a un punto indicado. Al pulsar el botón se vuelve al estado inicial con una transición suave.

```js eval code=false
$button = call(() => {
    const $button = document.createElement('button');
    $button.textContent = 'FlyTo origin';
    return $button;
});
```

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson4;
    const canvas = await Utils.createCanvas(Canvas, 400, 400);

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
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

## ¿Qué es una cámara? {#what-is-a-camera}

La cámara describe el ángulo desde el que vemos el mundo. Tanto el punto focal como la posición de la cámara afectan a la imagen final. Se aplica a escenas 2D y 3D. Al controlar la cámara podemos realizar con facilidad ciertas operaciones que antes exigían mover todo el lienzo, e incluso lograr animaciones de cámara. El diagrama siguiente, tomado de [WebGL 3D - Cámaras], muestra el contenido del plano XZ en vista de pájaro. Si quieres conseguir el mismo efecto visual, mover la cámara (imagen de la izquierda), en lugar de rotar todos los objetos de todo el lienzo (imagen de la derecha), resulta más intuitivo y rinde mejor en la implementación. Pronto veremos este punto:

![Mover la cámara frente a mover los objetos](/camera.png)

Nuestro lienzo se sitúa en el plano XY y la cámara lo observa desde fuera de la pantalla, hacia dentro. La imagen siguiente procede de [Cómo crear un lienzo infinito al estilo de Figma en WebGL]. Cuando queremos desplazar el lienzo hacia la izquierda, el movimiento correspondiente de la cámara es un paneo hacia la derecha:

![La proyección de la cámara de una región del lienzo](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*59IngIJ4xqwC629qD89APA.png)

Repasemos las distintas etapas para transformar un objeto desde el espacio del modelo hasta el espacio de pantalla. En la lección anterior presentamos las transformaciones de modelo. En esta lección trataremos las transformaciones de proyección y las transformaciones de cámara.

![coordenadas](/coordinates.png)

## Transformación de proyección {#projection-transformation}

Repasemos primero la transformación del espacio de píxeles al espacio de clip que vimos antes:

```glsl
// Pixel space to [0, 1] (Screen space)
vec2 zeroToOne = position / u_Resolution;

// Convert from [0, 1] to [0, 2]
vec2 zeroToTwo = zeroToOne * 2.0;

// Convert from [0, 2] to [-1, 1] (NDC/clip space)
vec2 clipSpace = zeroToTwo - 1.0;

// Flip Y axis
gl_Position = vec4(clipSpace * vec2(1, -1), 0.0, 1.0);
```

Si podemos completarla con una única transformación de proyección, el código queda mucho más sencillo. Por ejemplo, podríamos multiplicar directamente, a la izquierda, por la matriz de transformación del modelo:

```glsl
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
};

gl_Position = vec4((u_ProjectionMatrix
    * u_ModelMatrix
    * vec3(position, 1)).xy, 0, 1);
```

La transformación de proyección 2D es muy fácil de implementar; solo necesitas proporcionar `width` y `height`. La división por `u_Resolution` en el shader corresponde aquí a `/ width` y `/ height`:

```ts
[2 / width, 0, 0, 0, -2 / height, 0, -1, 1, 1];
```

Usamos directamente el método `projection` que ofrece [gl-matrix]. Si te interesa, puedes consultar su código fuente, ya que la implementación es exactamente la misma. Este método también hay que volver a llamarlo para recalcular cuando se redimensiona el lienzo.

```ts
export class Camera {
    #projectionMatrix = mat3.create();

    get projectionMatrix() {
        return this.#projectionMatrix;
    }

    projection(width: number, height: number) {
        mat3.projection(this.#projectionMatrix, width, height);
    }
}
```

Sin embargo, no podemos pasar `projectionMatrix` directamente por el [problema de alineación] que mencionamos en la lección anterior. Hay que añadir padding al `mat3` antes de pasarlo al shader:

```ts
export function paddingMat3(matrix: mat3) {
    return [
        matrix[0],
        matrix[1],
        matrix[2],
        0,
        matrix[3],
        matrix[4],
        matrix[5],
        0,
        matrix[6],
        matrix[7],
        matrix[8],
        0,
    ];
}
```

Por último, creamos la cámara al mismo tiempo que se inicializa el lienzo. Después podemos acceder a ella mediante `canvas.camera`:

```ts
export class Canvas {
    #camera: Camera;
    get camera() {
        return this.#camera;
    }

    constructor() {
        const camera = new Camera(width / dpr, height / dpr);
        this.#camera = camera;
    }
}
```

Ahora consideremos la cuestión de las transformaciones de cámara, como la traslación.

## Transformación de cámara {#camera-transformation}

Las transformaciones de cámara también pueden representarse con matrices. Tras completar las transformaciones, podemos usarlas en el shader de la siguiente manera. Frente a calcular y actualizar la matriz de transformación del modelo `u_ModelMatrix` de cada figura, una única actualización global de la matriz de transformación de la cámara es más eficiente:

```glsl{3}
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
};

gl_Position = vec4((u_ProjectionMatrix
    * u_ViewMatrix
    * u_ModelMatrix
    * vec3(position, 1)).xy, 0, 1);
```

La matriz de transformación de la cámara debe ser la inversa de la transformación de la cámara en el sistema de coordenadas mundial. Como se dijo en el ejemplo del principio, cuando la cámara se mueve hacia la derecha, eso corresponde a que la escena se mueve hacia la izquierda. Aquí usamos el método `invert` que ofrece [gl-matrix] para calcular la matriz inversa. Al mismo tiempo, añadimos otros getters, como `projectionMatrix * viewMatrix`, para usarlos más adelante:

```ts{4}
export class Camera {
  #matrix = mat3.create();
  private updateMatrix() {
    mat3.invert(this.#viewMatrix, this.#matrix);
    this.updateViewProjectionMatrix();
  }

  get viewMatrix() {
    return this.#viewMatrix;
  }

  get viewProjectionMatrix() {
    return this.#viewProjectionMatrix;
  }

  get viewProjectionMatrixInv() {
    return this.#viewProjectionMatrixInv;
  }
}
```

### Traslación {#translation}

En la definición de un lienzo infinito de [infinitecanvas], la «extensibilidad» se manifiesta mediante la traslación a nivel del lienzo:

![lienzo expansivo](https://infinitecanvas.tools/images/illustrations/expansive.svg)

Ahora implementemos la funcionalidad básica de la cámara. Comparada con una cámara 3D, es mucho más sencilla: admite la traslación `x/y`, la rotación `rotation` y la escala `zoom`. El motivo de no usar `scaling` como nombre es que `zoom` se usa con más frecuencia (por ejemplo, [OrthographicCamera.zoom] en Three.js):

```ts
export class Camera {
    #zoom = 1;
    #x = 0;
    #y = 0;
    #rotation = 0;

    private updateMatrix() {
        const zoomScale = 1 / this.#zoom;
        mat3.identity(this.#matrix);
        mat3.translate(this.#matrix, this.#matrix, [this.#x, this.#y]);
        mat3.rotate(this.#matrix, this.#matrix, this.#rotation);
        mat3.scale(this.#matrix, this.#matrix, [zoomScale, zoomScale]);
        mat3.invert(this.#viewMatrix, this.#matrix);
        this.updateViewProjectionMatrix();
    }
}
```

Cuando trasladamos la cámara con `camera.x += 100;`, hay que recalcular la matriz de la cámara:

```ts
export class Camera {
    set x(x: number) {
        if (this.#x !== x) {
            this.#x = x;
            this.updateMatrix();
        }
    }
}
```

Pruébalo arrastrando el control deslizante para mover la cámara:

```js eval code=false inspector=false
canvas = call(() => {
    const { Canvas } = Lesson4;
    return Utils.createCanvas(Canvas, 400, 400);
});
```

```js eval code=false
positionX = Inputs.range([0, 100], { label: 'camera.x', value: 0, step: 1 });
```

```js eval code=false
positionY = Inputs.range([0, 100], { label: 'camera.y', value: 0, step: 1 });
```

```js eval code=false inspector=false
call(() => {
    const camera = canvas.camera;
    camera.x = positionX;
    camera.y = positionY;
});
```

```js eval code=false
(async () => {
    const { Circle, Group } = Lesson4;
    canvas.getDOM().style.pointerEvents = 'none';

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
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
    return canvas.getDOM();
})();
```

Se ve bien. Sería aún más intuitivo si pudieras interactuar arrastrando con el ratón.

### Implementar un plugin {#implement-a-plugin}

Decidimos implementar esta función mediante un plugin:

```ts{3}
export class CameraControl implements Plugin {}

[new CameraControl(), new Renderer()].forEach((plugin) => {
  plugin.apply(this.#pluginContext);
});
```

Tomando como referencia [Cómo implementar el zoom con el ratón en WebGL 2D], convertimos las coordenadas del objeto de evento del ratón desde coordenadas del lienzo a coordenadas del espacio de clip:

```ts
function getClipSpaceMousePosition(e: MouseEvent): vec2 {
    // CSS space
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    // Normalize to [0, 1]
    const normalizedX = cssX / canvas.clientWidth;
    const normalizedY = cssY / canvas.clientHeight;

    // Convert to clipspace
    const clipX = normalizedX * 2 - 1;
    const clipY = normalizedY * -2 + 1;

    return [clipX, clipY];
}
```

A continuación escuchamos el evento `mousedown` y gestionamos los eventos posteriores `mousemove` y `mouseup`, que no son globales.

```ts
canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // the invert matrix of vp matrix
    mat3.copy(startInvertViewProjectionMatrix, camera.viewProjectionMatrixInv);
    // camera postion in world space
    startCameraX = camera.x;
    startCameraY = camera.y;
    // convert mouse position to world space
    startPos = vec2.transformMat3(
        startPos,
        getClipSpaceMousePosition(e),
        startInvViewProjMatrix,
    );
});
```

Tenemos que registrar las siguientes variables:

-   `startInvViewProjMatrix` - la matriz inversa de la matriz de proyección de la cámara
-   `startCameraX` - la coordenada X de la cámara en el espacio mundial
-   `startCameraY` - la coordenada Y de la cámara en el espacio mundial
-   `startPos` - la posición actual del ratón en el espacio mundial, que se obtiene al transformar las coordenadas del espacio NDC (coordenadas de dispositivo normalizadas) con la inversa de la matriz de proyección de la cámara

Cuando se suelta el ratón, se desvinculan los detectores de eventos, y así termina la interacción de arrastre.

```ts
function handleMouseUp(e) {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
}
```

Cuando el ratón se mueve, la cámara también se mueve. Del mismo modo, hay que convertir a coordenadas del espacio mundial. Después, a la posición del ratón guardada durante el `mousedown` anterior se le resta la posición actual del ratón, y se obtiene la distancia recorrida.

```ts
function handleMouseMove(e: MouseEvent) {
    moveCamera(e);
}

function moveCamera(e: MouseEvent) {
    const pos = vec2.transformMat3(
        vec2.create(),
        getClipSpaceMousePosition(e),
        startInvertViewProjectionMatrix,
    );

    camera.x = startCameraX + startPos[0] - pos[0];
    camera.y = startCameraY + startPos[1] - pos[1];
}
```

Puedes probar a arrastrar el lienzo en el ejemplo de la parte superior de esta página.

El lienzo de ECS también hace paneo con la rueda del ratón o con un gesto táctil de dos dedos. Estos deltas se miden en píxeles del viewport: rótalos para llevarlos al espacio mundial y divídelos por el zoom actual antes de cambiar la posición de la cámara. El movimiento táctil usa el delta de cámara opuesto para que el lienzo siga a los dedos. Si un pellizco cambia el zoom en el mismo fotograma, aplica el paneo a la transformación de cámara ya actualizada.

### Rotación {#rotation}

La rotación no es una función esencial del lienzo, pero un usuario de FigJam preguntó una vez en los foros si se admitía: [Rotar el lienzo], porque una ligera rotación del lienzo encaja mejor con sus hábitos de uso.

Pretendemos facilitar la rotación del lienzo manteniendo pulsada la tecla <kbd>Shift</kbd> mientras se arrastra el ratón. En el detector del evento `mousedown` podemos decidir si entramos en el modo de rotación comprobando [KeyboardEvent: shiftKey]:

```ts{2}
canvas.addEventListener('mousedown', (e) => {
  rotate = e.shiftKey;
});

function handleMouseMove(e: MouseEvent) {
  if (rotate) {
    rotateCamera(e);
  } else {
    moveCamera(e);
  }
}
```

En el modo de rotación de la cámara, la distancia que recorre el ratón se toma como el ángulo de rotación. A continuación construimos una matriz de transformación para rotar alrededor de un punto indicado del sistema de coordenadas mundial; puedes consultar [transform-origin]. Después se aplica esta transformación a la matriz de la cámara y, por último, se extraen de la matriz los distintos parámetros:

Guarda las coordenadas de pointer-down como un valor independiente; conservar un vector de entrada de ECS que siga vivo entre fotogramas puede invalidar el gesto de rotación.

```ts
function rotateCamera(e: MouseEvent) {
    // convert moved distance to rotation
    const delta = (e.clientX - startMousePos[0]) / 100;

    // create matrix with pivot
    const camMat = mat3.create();
    mat3.translate(camMat, camMat, [startPos[0], startPos[1]]);
    mat3.rotate(camMat, camMat, delta);
    mat3.translate(camMat, camMat, [-startPos[0], -startPos[1]]);

    // apply transformation
    camera.x = startCameraX;
    camera.y = startCameraY;
    camera.rotation = startCameraRotation;
    mat3.multiply(camMat, camMat, camera.matrix);

    // Reset camera params
    camera.x = camMat[6];
    camera.y = camMat[7];
    camera.rotation = startCameraRotation + delta;
}
```

Puedes volver al ejemplo de la parte superior de la página y probar a mantener pulsada <kbd>Shift</kbd> mientras arrastras el lienzo.

### Rotar alrededor del pivote {#rotate-around-pivot}

En un lienzo infinito, además del paneo, el zoom también es una operación muy habitual, sobre todo el zoom alrededor de un punto concreto:

![zoom en un lienzo infinito](https://infinitecanvas.tools/images/illustrations/zoom.svg)

Escucha el evento `wheel` y registra primero la posición del ratón antes del zoom. Tras hacer zoom y actualizar la matriz de la cámara, calcula la diferencia entre las posiciones. Esa diferencia es la distancia que debe moverse la cámara:

```ts
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const position = getClipSpaceMousePosition(e);

    // mouse position in world space before zooming
    const [preZoomX, preZoomY] = vec2.transformMat3(
        vec2.create(),
        position,
        camera.viewProjectionMatrixInv,
    );

    // calculate zoom factor
    const newZoom = camera.zoom * Math.pow(2, e.deltaY * -0.01);
    camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

    // mouse position in world space after zooming
    const [postZoomX, postZoomY] = vec2.transformMat3(
        vec2.create(),
        position,
        camera.viewProjectionMatrixInv,
    );

    // move camera
    camera.x += preZoomX - postZoomX;
    camera.y += preZoomY - postZoomY;
});
```

### PointerEvent {#pointerevent}

Hasta ahora hemos escuchado [MouseEvent]. Más adelante, cuando implementemos el sistema de eventos, introduciremos [PointerEvent]. Entonces volveremos y modificaremos el código de la parte de detectores de eventos del plugin `CameraControl` para que admita dispositivos de entrada como las pantallas táctiles, etc.

![PointerEvent](https://gw.alipayobjects.com/mdn/rms_6ae20b/afts/img/A*FtyaTL5gzv4AAAAAAAAAAAAAARQnAQ)

Pasemos ahora al tema siguiente: cómo hacer que el movimiento de la cámara resulte más natural.

## Animación de cámara {#camera-animation}

Mapbox ofrece el método [flyTo - Mapbox], que puede desplazarse entre distintas ubicaciones con suavidad. Nos basaremos en [WebGL Insights - 23. Diseño de cámaras para aplicaciones WebGL] para implementar animaciones de cámara que permitan transiciones suaves entre cualquier estado de la cámara.

![Landmark](https://xiaoiver.github.io/assets/img/webgl/landmark.png)

El uso esperado de la API relacionada es el siguiente:

1. Crear un `Landmark`, que puede representar el estado actual de la cámara y también permite fijar parámetros como la posición, el ángulo de rotación y la escala.
2. Hacer que la cámara pase de su estado actual a un `Landmark` indicado, incluido un efecto de transición suave durante el proceso.

```ts
const landmark = camera.createLandmark({ zoom: 2 });
camera.gotoLandmark(landmark, { duration: 300 });
```

### Crear un Landmark {#create-landmark}

`Landmark` tiene que almacenar los estados de la cámara:

```ts
export interface Landmark {
    zoom: number;
    x: number;
    y: number;
    rotation: number;
}
```

Crear un `Landmark` consiste, en esencia, en guardar simplemente los parámetros de la cámara, que se sobrescriben si el usuario los proporciona:

```ts
export class Camera {
    createLandmark(params: Partial<Landmark>): Landmark {
        return {
            zoom: this.#zoom,
            x: this.#x,
            y: this.#y,
            rotation: this.#rotation,
            ...params,
        };
    }
}
```

### Efectos de animación {#animation-effects}

Usamos [bezier-easing] para implementar las [funciones de aceleración de Bézier cúbicas]:

```ts
import BezierEasing from 'bezier-easing';
export const EASING_FUNCTION = {
    linear: BezierEasing(0, 0, 1, 1),
    ease: BezierEasing(0.25, 0.1, 0.25, 1),
    'ease-in': BezierEasing(0.42, 0, 1, 1),
    'ease-out': BezierEasing(0, 0, 0.58, 1),
    'ease-in-out': BezierEasing(0.42, 0, 0.58, 1),
};
```

Ahora diseñemos la API para cambiar a un `Landmark`. Tomando como referencia la [Web Animations API], admitimos los siguientes parámetros:

-   `easing` Admite `ease` y `linear`, igual que CSS
-   `duration` Pasar `0` omite la animación.
-   `onframe` Callback en cada fotograma durante la animación
-   `onfinish` Callback cuando termina la animación

```ts
export class Camera {
    gotoLandmark(
        landmark: Landmark,
        options: Partial<{
            easing: string;
            duration: number;
            onframe: (t: number) => void;
            onfinish: () => void;
        }> = {},
    ) {}
}
```

Si se pasa `duration` como `0`, no hay efecto de animación; los parámetros de la cámara contenidos en el `Landmark` se usan para actualizar directamente y se dispara el callback de finalización:

```ts{14}
const { zoom, x, y, rotation } = landmark;

const endAnimation = () => {
  this.#zoom = zoom;
  this.#x = x;
  this.#y = y;
  this.#rotation = rotation;
  this.updateMatrix();
  if (onfinish) {
    onfinish();
  }
};

if (duration === 0) {
  endAnimation();
  return;
}
```

Hay que detener cualquier animación en curso antes de iniciar una nueva (si la hay). A continuación implementamos la lógica de cada fotograma durante el proceso de animación. Si se supera `duration`, la animación debe terminar de inmediato:

```ts{11}
this.cancelLandmarkAnimation();

let timeStart: number | undefined;
const startPosition: vec2 = [this.#x, this.#y];
const startZoomRotation: vec2 = [this.zoom, this.#rotation];
const destPosition: vec2 = [x, y];
const destZoomRotation: vec2 = [zoom, rotation];
const animate = (timestamp: number) => {
  if (timeStart === undefined) {
    timeStart = timestamp;
  }
  const elapsed = timestamp - timeStart;
  if (elapsed > duration) {
    endAnimation();
    return;
  }

  // Omit calculation for now.

  if (elapsed < duration) {
    if (onframe) {
      onframe(t);
    }
    this.#landmarkAnimationID = requestAnimationFrame(animate);
  }
};
requestAnimationFrame(animate);
```

Con la función de aceleración definida antes obtenemos el valor de tiempo y, después, usamos `vec2.lerp` para interpolar y obtener los parámetros actuales de la cámara, que por último se aplican para actualizar la matriz de la cámara:

```ts
// use the same ease function in animation system
const t = EASING_FUNCTION[easing](elapsed / duration);

const interPosition = vec2.create();
const interZoomRotation = vec2.fromValues(1, 0);

vec2.lerp(interPosition, startPosition, destPosition, t);
vec2.lerp(interZoomRotation, startZoomRotation, destZoomRotation, t);

this.#x = interPosition[0];
this.#y = interPosition[1];
this.#zoom = interZoomRotation[0];
this.#rotation = interZoomRotation[1];
this.updateMatrix();
```

Captura el estado inicial una sola vez cuando empieza la animación. Interpolar desde el estado de la cámara ya actualizado en cada fotograma cambia la curva de aceleración y hace que el resultado dependa de la tasa de fotogramas. Una animación solo puede terminar antes de tiempo cuando tanto la posición como el zoom y la rotación han llegado a su destino; comprobar solo la posición omitiría una animación que únicamente cambia el zoom:

```ts
if (
  vec2.dist(interPosition, destPosition) <= EPSILON &&
  vec2.dist(interZoomRotation, destZoomRotation) <= EPSILON
) {
    endAnimation();
    return;
}
```

Vuelve al ejemplo de la parte superior de la página y pruébalo. Haz clic en el botón para devolver la cámara a su estado inicial.

## Lectura adicional {#extended-reading}

-   [WebGL Insights - 23. Diseño de cámaras para aplicaciones WebGL]
-   [LearnWebGL - Introducción a las cámaras]
-   [WebGL 3D - Cámaras]

[LearnWebGL - Introducción a las cámaras]: https://learnwebgl.brown37.net/07_cameras/camera_introduction.html#a-camera-definition
[Cómo crear un lienzo infinito al estilo de Figma en WebGL]: https://betterprogramming.pub/how-to-create-a-figma-like-infinite-canvas-in-webgl-8be94f65674f
[WebGL Insights - 23. Diseño de cámaras para aplicaciones WebGL]: https://github.com/lnickers2004/WebGL-Insights
[WebGL 3D - Cámaras]: https://webglfundamentals.org/webgl/lessons/webgl-3d-camera.html
[Cómo implementar el zoom con el ratón en WebGL 2D]: https://webglfundamentals.org/webgl/lessons/webgl-qna-how-to-implement-zoom-from-mouse-in-2d-webgl.html
[gl-matrix]: https://github.com/toji/gl-matrix
[problema de alineación]: /es/guide/lesson-003.html#alignment
[OrthographicCamera.zoom]: https://threejs.org/docs/#api/en/cameras/OrthographicCamera.zoom
[Rotar el lienzo]: https://forum.figma.com/t/rotate-canvas/42818
[infinitecanvas]: https://infinitecanvas.tools
[KeyboardEvent: shiftKey]: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/shiftKey
[MouseEvent]: https://developer.mozilla.org/zh-CN/docs/Web/API/MouseEvent
[PointerEvent]: https://developer.mozilla.org/zh-CN/docs/Web/API/PointerEvent
[transform-origin]: https://developer.mozilla.org/en-US/docs/Web/CSS/transform-origin
[flyTo - Mapbox]: https://docs.mapbox.com/mapbox-gl-js/example/flyto/
[bezier-easing]: https://github.com/gre/bezier-easing
[funciones de aceleración de Bézier cúbicas]: https://www.w3.org/TR/css-easing-1/#cubic-bezier-easing-functions
[Web Animations API]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API
