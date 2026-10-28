---
outline: deep
description: 'Implementa transformaciones (traslación, escala, rotación y sesgo) y la arquitectura de grafo de escena. Construye un modelo sencillo del sistema solar que muestre transformaciones jerárquicas y sistemas de coordenadas.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lección 3 - Grafo de escena y transformación',
          },
      ]
---
# Lección 3 - Grafo de escena y transformación {#lesson-3-scene-graph-and-transform}

En la lección anterior dibujamos un círculo; en esta lección aprenderás lo siguiente:

-   Transformaciones. Haz que las formas admitan transformaciones de paneo, zoom, rotación y sesgo.
-   Grafo de escena.

Por último, usaremos las funciones anteriores para realizar un modelo sencillo del sistema solar.

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson3;
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
    return canvas.getDOM();
})();
```

## Transformación {#transform}

[Transformación CSS] ofrece estas transformaciones: `translate` `scale` `rotate` y `skew`.
Las matrices que hay detrás de estas transformaciones se encuentran en [Transformaciones - LearnOpenGL]. Como nuestra escena solo contiene gráficos 2D, solo necesitamos una matriz de 3×3 y, como la última fila `[0, 0, 1]` es fija, en realidad solo tenemos que almacenar 6 elementos de la matriz:

```bash
| a | c | tx|
| b | d | ty|
| 0 | 0 | 1 |
```

Añadimos un atributo `transform` a nuestra clase base de figuras usando directamente [@pixi/math] o, por supuesto, [gl-matrix].

```ts
import { Transform } from '@pixi/math';

export abstract class Shape {
    transform = new Transform();
}
```

Antes de añadir más métodos, introduzcamos un concepto importante.

### Coordenadas locales y de mundo {#local-and-world-coordinates}

Los sistemas de coordenadas sirven para describir la posición, la rotación y la escala de los objetos de una escena; el sistema de coordenadas más conocido es el euclidiano. En gráficos también usamos el sistema de coordenadas del centro de gravedad. El espacio euclidiano puede tener hasta N dimensiones; aquí solo usaremos dos.

Cuando decimos «la Luna gira alrededor de la Tierra», en realidad estamos ignorando los objetos distintos de la Tierra. En el sistema de coordenadas local de la Luna, esta simplemente gira alrededor de un punto, aunque en el sistema de coordenadas de mundo de todo el sistema solar la Tierra sigue girando alrededor del Sol, y la Luna acaba siguiendo la trayectoria compleja descrita arriba.

Los conceptos de sistemas de coordenadas local y de mundo se pueden usar tanto en mundos 2D como 3D. La imagen siguiente, de [playcanvas], muestra a la izquierda el sistema de coordenadas de mundo, y se ve que los ejes son siempre los mismos. A la derecha se muestra el sistema de coordenadas local del cubo, cuyos ejes cambian cuando el objeto se transforma (en este caso, al rotar); así, si en ese momento este objeto rotado sufre una traslación en la dirección positiva del eje X (en rojo), puede salirse del suelo.

![espacio de mundo (izquierda) y espacio local (derecha)](https://gw.alipayobjects.com/mdn/rms_6ae20b/afts/img/A*kgaHRIYex8MAAAAAAAAAAAAAARQnAQ)

El sistema de coordenadas de mundo lo comparten todos los nodos del grafo de escena, así que tiene un origen fijo `(0, 0)`, y la orientación de los ejes XYZ (ejes XY en la escena 2D) es fija; aunque la caja de la escena rote sobre sí misma, el sistema de coordenadas de mundo no cambia para ella. Pero, en su propio sistema de coordenadas local, su origen ya no es `(0, 0)`, sino la posición del propio objeto, y los ejes cambian de forma natural; como indica el nombre, está asociado al propio objeto.

Imagina que la caja se mueve «10 unidades a lo largo del eje X (rojo)», lo que tiene un significado completamente distinto en otro sistema de coordenadas. Por tanto, cuando queremos transformar un objeto, primero tenemos que especificar el sistema de coordenadas en el que se encuentra.

Además, el sistema de coordenadas local también se llama **sistema de coordenadas del modelo**, y resulta más cómodo al describir la transformación del propio modelo. Si queremos que cada soldado gire la cabeza, es evidente que resulta más fácil hacerlo en el sistema de coordenadas local, porque la transformación «girar» es relativa a la cabeza de cada modelo.
![espacio local y espacio de mundo](https://gw.alipayobjects.com/mdn/rms_6ae20b/afts/img/A*9B4FRo4UbNsAAAAAAAAAAAAAARQnAQ)

Añadimos a la clase base de figuras métodos para las transformaciones en los sistemas de coordenadas local y de mundo, proporcionados en [@pixi/math]:

```ts
export abstract class Shape {
    get localTransform(): Matrix {
        return this.transform.localTransform;
    }
    get worldTransform(): Matrix {
        return this.transform.worldTransform;
    }
}
```

La figura siguiente, de [Fundamentos de gráficos por computadora, 4.ª edición], muestra el sistema de coordenadas local (del objeto) transformado por una transformación de modelo al sistema de coordenadas de mundo, después por una transformación de cámara al sistema de coordenadas de la cámara, después por una transformación de proyección al sistema de coordenadas de recorte (clip space/NDC) y, por último, por una transformación de viewport al sistema de coordenadas de pantalla (espacio de pantalla/píxel). Presentaremos la cámara más adelante; por ahora solo nos importa la transformación del modelo.

![coordenadas](/coordinates.png)

A continuación tenemos que pasar la matriz de transformación del modelo al shader para transformar las posiciones de los vértices.

### Alineación {#alignment}

En el vertex shader, la matriz de transformación del modelo se pasa mediante un uniform y después se multiplica por la izquierda con el vector de posición:

```glsl
layout(std140) uniform ShapeUniforms {
  mat3 u_ModelMatrix;
};

vec2 position = (u_ModelMatrix * vec3(a_Position + a_Size * a_FragCoord, 1)).xy;
```

Naturalmente, creamos directamente un `Float32Array` de longitud 9 (una matriz de 3 \* 3):

```ts
this.#uniformBuffer = device.createBuffer({
    viewOrSize: Float32Array.BYTES_PER_ELEMENT * 9, // mat3
    usage: BufferUsage.UNIFORM,
    hint: BufferFrequencyHint.DYNAMIC,
});
```

Pero entonces la consola informará de un error: el uniform buffer que hemos creado no es lo bastante largo. ¿Qué ocurre?

```bash
[.WebGL-0x10800c78f00] GL_INVALID_OPERATION: It is undefined behaviour to use a uniform buffer that is too small.
```

Aquí hay que introducir el concepto de [Disposición en memoria]. El uniform block admite las reglas de disposición `packed` `shared` `std140` `std430`. Cada regla de disposición lleva a una forma distinta de almacenar y leer los datos del buffer. La ventaja de elegir `std140` es que no hay diferencias de disposición entre programas (frente a `packed`) ni diferencias entre implementaciones de OpenGL (frente a `shared`), pero la desventaja es que hay que ocuparse de la alineación manualmente, y la documentación del sitio oficial da una advertencia al respecto, recordándonos que debemos intentar evitar `vec3` para eludir la alineación:

> Advertencia: a veces las implementaciones calculan mal la disposición std140 de los componentes vec3. Se te recomienda rellenar manualmente tus estructuras y arrays, y evitar por completo el uso de vec3.

Entonces, ¿qué es la alineación? Tomemos `vec3` como ejemplo: ocupa `4 * 3` bytes, pero en realidad usa 16. En la práctica las reglas de alineación son muy complejas, y aquí `mat3` ocupa en realidad `4 * 12` bytes de almacenamiento:

```ts
this.#uniformBuffer = device.createBuffer({
    viewOrSize: Float32Array.BYTES_PER_ELEMENT * 12, // mat3
    usage: BufferUsage.UNIFORM,
});
```

[wgsl-offset-computer] es una herramienta en línea excelente para entender las reglas de alineación mediante visualización:

![estructura: ShapeUniforms](/wgsl-offset-computer.png)

Tenemos que añadir relleno manualmente al escribir los datos:

```bash
| a | c | tx|
| b | d | ty|
| 0 | 0 | 1 |
| padding | padding | padding |
```

```ts
const PADDING = 0;
const { a, b, c, d, tx, ty } = this.worldTransform;
this.#uniformBuffer.setSubData(
    0,
    new Uint8Array(
        new Float32Array([
            a,
            b,
            0,
            PADDING,
            c,
            d,
            0,
            PADDING,
            tx,
            ty,
            1,
            PADDING,
        ]).buffer,
    ),
);
```

Conviene señalar que en WGSL existe la misma [Alineación de los búferes uniform y storage], y en el ecosistema de Rust está [bytemuck] para ayudar a automatizar la alineación. El ejemplo siguiente procede de [bevy]:

```rust
use bytemuck::{Pod, Zeroable};

#[repr(C)]
#[derive(Copy, Clone, Pod, Zeroable)]
pub struct UiMaterialVertex {
    pub position: [f32; 3],
    pub uv: [f32; 2],
    pub border_widths: [f32; 4],
}
```

Añadamos a las figuras APIs de transformación como traslación, rotación y zoom.

### Traslación {#translation}

[Traslación 2D en WebGL]

```ts
export abstract class Shape {
    get position(): ObservablePoint {
        return this.transform.position;
    }
    set position(value: IPointData) {
        this.transform.position.copyFrom(value);
    }

    get x(): number {
        return this.position.x;
    }
    set x(value: number) {
        this.transform.position.x = value;
    }

    get y(): number {
        return this.position.y;
    }
    set y(value: number) {
        this.transform.position.y = value;
    }
}
```

El uso coincide con PIXI.js:

```js eval code=false
circle = call(() => {
    const { Circle } = Lesson3;
    return new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
    });
});
```

```js eval code=false
positionX = Inputs.range([0, 100], { label: 'position.x', value: 0, step: 1 });
```

```js eval code=false
positionY = Inputs.range([0, 100], { label: 'position.y', value: 0, step: 1 });
```

```js eval
call(() => {
    circle.position.x = positionX;
    circle.position.y = positionY;
});
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson3;
    const canvas = await Utils.createCanvas(Canvas, 200, 200);
    canvas.appendChild(circle);

    let id;
    const animate = () => {
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

### Pivote {#pivot}

La rotación, el escalado y el sesgo exigen especificar el centro de la transformación. En Pixi.js lo llamamos `pivot`. No es lo mismo que `transform-origin` en CSS; consulta: [Posicionamiento en PixiJS].

<img src="https://aphgames.io/img/docs/tutorials/02-pixi/pos_single_rot_1.svg" alt="la rotación se hace alrededor del origen/pivote, que de forma predeterminada está en la esquina superior izquierda" width="100%"/>

`pivot` también afecta al desplazamiento de la posición del objeto.

<img src="https://aphgames.io/img/docs/tutorials/02-pixi/pos_single_2.svg" alt="el pivote también afecta al desplazamiento de la posición del objeto" width="100%"/>

```ts
export abstract class Shape {
    get pivot(): ObservablePoint {
        return this.transform.pivot;
    }
    set pivot(value: IPointData) {
        this.transform.pivot.copyFrom(value);
    }
}
```

### Rotación {#rotation}

```ts
export abstract class Shape {
    get rotation(): number {
        return this.transform.rotation;
    }
    set rotation(value: number) {
        this.transform.rotation = value;
    }
}
```

```js eval code=false
circle2 = call(() => {
    const { Circle } = Lesson3;
    const circle = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'red',
    });
    circle.position = { x: 100, y: 100 };
    return circle;
});
```

```js eval code=false
pivotX = Inputs.range([0, 100], { label: 'pivot.x', value: 0, step: 1 });
```

```js eval code=false
pivotY = Inputs.range([0, 100], { label: 'pivot.y', value: 0, step: 1 });
```

```js eval
call(() => {
    circle2.pivot.x = pivotX;
    circle2.pivot.y = pivotY;
});
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson3;
    const canvas = await Utils.createCanvas(Canvas, 200, 200);
    canvas.appendChild(circle2);

    let id;
    const animate = () => {
        circle2.rotation += 0.01;
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

### Escalado {#scaling}

```ts
export abstract class Shape {
    get scale(): ObservablePoint {
        return this.transform.scale;
    }
    set scale(value: IPointData) {
        this.transform.scale.copyFrom(value);
    }
}
```

```js eval code=false
circle3 = call(() => {
    const { Circle } = Lesson3;
    return new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'red',
    });
});
```

```js eval code=false
pivotX2 = Inputs.range([0, 100], { label: 'pivot.x', value: 0, step: 1 });
```

```js eval code=false
pivotY2 = Inputs.range([0, 100], { label: 'pivot.y', value: 0, step: 1 });
```

```js eval code=false
scaleX = Inputs.range([0, 5], { label: 'scale.x', value: 1, step: 0.1 });
```

```js eval code=false
scaleY = Inputs.range([0, 5], { label: 'scale.y', value: 1, step: 0.1 });
```

```js eval
call(() => {
    circle3.pivot.x = pivotX2;
    circle3.pivot.y = pivotY2;
    circle3.scale.x = scaleX;
    circle3.scale.y = scaleY;
    circle3.position.x = 100;
    circle3.position.y = 100;
});
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson3;
    const canvas = await Utils.createCanvas(Canvas, 200, 200);
    canvas.appendChild(circle3);

    let id;
    const animate = () => {
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

### Sesgo {#skew}

```ts
export abstract class Shape {
    get skew(): ObservablePoint {
        return this.transform.skew;
    }
    set skew(value: IPointData) {
        this.transform.skew.copyFrom(value);
    }
}
```

## Grafo de escena {#scenegraph}

Un [Grafo de escena] es una estructura de datos para organizar y gestionar escenas virtuales 2D/3D, y es un grafo acíclico dirigido. El grafo de escena ofrece dos capacidades principales:

1. describir las relaciones padre-hijo
2. automatizar algunos cálculos en cascada complejos a partir de las relaciones padre-hijo.

El panel izquierdo de Figma muestra el grafo de escena:

![grafo de escena en Figma](/scenegraph-figma.png)

Imagina que necesitamos construir un escenario sencillo del sistema solar con las relaciones jerárquicas siguientes:

```bash
solarSystem
   |    |
   |   sun
   |
 earthOrbit
   |    |
   |  earth
   |
 moonOrbit
      |
     moon
```

Usa esta descripción de la API, en la que `Group` se limita a heredar la clase base de las figuras y no necesita redefinir los métodos de renderizado:

```ts
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
```

### Relaciones padre-hijo {#parent-child-relationships}

Añade las propiedades `parent` y `children` a las figuras:

```ts
export abstract class Shape {
    parent: Shape;
    readonly children: Shape[] = [];
}
```

Después añadimos el método de nodo `append/removeChild`. Si el nodo hijo ya tenía un nodo padre, primero se quita. Aquí, asignar `_parentID` está relacionado con la implementación de [@pixi/math], que se trata en la última subsección:

```ts{7}
export abstract class Shape {
  appendChild(child: Shape) {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    child.transform._parentID = -1;
    this.children.push(child);

    return child;
  }
}
```

### Recorrer el grafo de escena {#traverse-scene-graph}

Con la jerarquía ya definida, podemos recorrer todo el grafo de escena mediante recursión. Añadimos aquí un método de utilidad:

```ts
export function traverse(shape: Shape, callback: (shape: Shape) => void) {
    callback(shape);
    shape.children.forEach((child) => {
        traverse(child, callback);
    });
}
```

Durante el renderizado del lienzo, usa los métodos de utilidad anteriores para renderizar cada figura por turno:

```ts{6}
export class Canvas {
  render() {
    const { hooks } = this.#pluginContext;
    hooks.beginFrame.call();
    this.#shapes.forEach((shape) => {
      traverse(shape, (s) => {
        hooks.render.call(s);
      });
    });
    hooks.endFrame.call();
  }
}
```

### Actualizar la transformación {#update-transform}

En el grafo de escena, la matriz de transformación de un nodo hijo en el sistema de coordenadas de mundo se calcula de la siguiente manera:

```bash
child's WorldTransform = parent's WorldTransform
    * child's LocalTransform
```

Completamos la actualización de la matriz de transformación antes de renderizar cada fotograma:

```ts{2}
hooks.render.tap((shape) => {
  shape.transform.updateTransform(
    shape.parent ? shape.parent.transform : IDENTITY_TRANSFORM,
  );
  shape.render(this.#device, this.#renderPass, this.#uniformBuffer);
});
```

Puede que te preocupe que, si la figura no se transforma, siga haciendo falta actualizarla en cada fotograma. Al fin y al cabo, todo el grafo de escena tiene que operar sobre cada figura, y eso supone bastante coste. Presentamos este patrón de diseño en [Lección 2 - Marca de modificado](/es/guide/lesson-002.html#dirty-flag), pero ahora analicemos la implementación de [@pixi/math].

Cada vez que ocurre una transformación, la de traslación, por ejemplo, solo incrementa el número de versión `_localID`:

```ts
this.position = new ObservablePoint(this.onChange, this, 0, 0);

protected onChange(): void {
    this._localID++;
}
```

Al actualizar la matriz de transformación local, el número de versión se usa para determinar si la transformación no ha ocurrido desde la vez anterior; si no, se realizan las operaciones matriciales reales. Al terminar, se actualiza el número de versión y se fuerza la actualización de la matriz de transformación de mundo, lo que se hace restableciendo `_parentID`:

```ts{3}
updateTransform(parentTransform: Transform): void {
    const lt = this.localTransform;
    if (this._localID !== this._currentLocalID) {
        // Perform actual matrix operations
        lt.a = this._cx * this.scale.x;
        // ...
        this._currentLocalID = this._localID;
        this._parentID = -1;
    }
    if (this._parentID !== parentTransform._worldID) {
        this._parentID = parentTransform._worldID;
        this._worldID++;
    }
}
```

¿Recuerdas el método `appendChild` que añadimos antes? Como el padre ha cambiado, hay que restablecer `_parentID` para que la matriz en el sistema de coordenadas de mundo se recalcule en la siguiente actualización:

```ts{2}
appendChild(child: Shape) {
    child.transform._parentID = -1;
}
```

PIXI.js también usa este patrón en operaciones de alto coste, como calcular la caja envolvente.

## Lectura adicional {#extended-reading}

-   [Grafo de escena en Pixi.js]
-   [Grafo de escena - LearnOpenGL]
-   [Dentro de PixiJS: objetos de visualización y su jerarquía]
-   [Comprender las transformaciones de matrices 3D]

[Transformación CSS]: https://developer.mozilla.org/en-US/docs/Web/CSS/transform
[Transformaciones - LearnOpenGL]: https://learnopengl.com/Getting-started/Transformations
[@pixi/math]: https://www.npmjs.com/package/@pixi/math
[gl-matrix]: https://github.com/toji/gl-matrix
[Fundamentos de gráficos por computadora, 4.ª edición]: https://www.amazon.com/Fundamentals-Computer-Graphics-Steve-Marschner/dp/1482229390
[Grafo de escena]: https://zh.wikipedia.org/zh-cn/%E5%9C%BA%E6%99%AF%E5%9B%BE
[Grafo de escena - LearnOpenGL]: https://learnopengl.com/Guest-Articles/2021/Scene/Scene-Graph
[playcanvas]: https://developer.playcanvas.com/en/tutorials/manipulating-entities/
[Traslación 2D en WebGL]: https://webglfundamentals.org/webgl/lessons/webgl-2d-translation.html
[Disposición en memoria]: https://www.khronos.org/opengl/wiki/Interface_Block_(GLSL)#Memory_layout
[Alineación de los búferes uniform y storage]: https://sotrh.github.io/learn-wgpu/showcase/alignment/#alignment-of-uniform-and-storage-buffers
[bytemuck]: https://docs.rs/bytemuck/
[bevy]: https://bevyengine.org/
[Dentro de PixiJS: objetos de visualización y su jerarquía]: https://medium.com/swlh/inside-pixijs-display-objects-and-their-hierarchy-2deef1c01b6e
[Comprender las transformaciones de matrices 3D]: https://medium.com/swlh/understanding-3d-matrix-transforms-with-pixijs-c76da3f8bd8
[Posicionamiento en PixiJS]: https://aphgames.io/docs/learning/tutorials/pixi_positions
[wgsl-offset-computer]: https://webgpufundamentals.org/webgpu/lessons/resources/wgsl-offset-computer.html#x=5d00000100b900000000000000003d888b0237284d3025f2381bcb288a92bedb79fca10c66815376fc2bf5fb30136b32803636d8a0cd1920b3c155315e5767b430151489cee2b64fbf433be601ac37b5c8a93419775b8ee51571e13b44c1d867e61e8a28bd0e628b80f99570f9d3feafad585f4517807268a20c783cb178401ab49f2e3742419fe1157f8f92396145394a631090a0189fffdc5e4000
[Grafo de escena en Pixi.js]: https://pixijs.com/8.x/guides/basics/scene-graph
