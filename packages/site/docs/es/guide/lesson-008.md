---
outline: deep
description: 'Optimiza el rendimiento del renderizado al comprender los draw calls e implementar el culling del viewport, el batching de draw calls, la indexación espacial para el picking y las técnicas de picking por color en la GPU.'
head:
    - [
          'meta',
          { property: 'og:title', content: 'Lección 8 - Optimizar el rendimiento' },
      ]
---
# Lección 8 - Optimizar el rendimiento {#lesson-8-optimize-performance}

En esta lección aprenderás lo siguiente:

-   Qué es un draw call
-   Reducir los draw calls con culling
-   Reducir los draw calls al combinar lotes
-   Usar la indexación espacial para mejorar la eficiencia del picking
-   Picking por color en la GPU

La optimización del rendimiento es una tarea compleja y de largo plazo, y suelo centrarme en ella pronto en un proyecto. Antes aprendimos a dibujar círculos con SDF; ahora hagamos una prueba de rendimiento y dibujemos 1000 círculos, con un FPS de unos 35:

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson7');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson7;

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

        for (let i = 0; i < 100; i++) {
            const circle = new Circle({
                cx: Math.random() * 400,
                cy: Math.random() * 200,
                r: Math.random() * 20,
                fill: 'red',
            });
            canvas.appendChild(circle);
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

Usamos [stats.js] para medir los FPS y creamos paneles que se colocan en la esquina superior izquierda del lienzo; por ahora, evidentemente, no es fluido:

```ts
const stats = new Stats();
stats.showPanel(0); // Only show FPS panel

const animate = () => {
    // Trigger updating
    if (stats) {
        stats.update();
    }
    canvas.render();
    requestAnimationFrame(animate);
};
```

Con [Spector.js], que se presentó en la primera lección, puedes ver que hay una gran cantidad de comandos de dibujo. He filtrado hasta dejar el comando `drawElements` y, de hecho, cada círculo corresponde a varios comandos de WebGL (incluida la creación de buffers, etc.).

![draw calls en Spector.js](/draw-calls.png)

## Qué es un draw call {#draw-call}

Estos comandos de dibujo se llaman draw calls, y la figura siguiente, de [Los draw calls en pocas palabras], explica por qué un aumento del número de draw calls afecta al rendimiento. Todos los draw calls se inician desde la CPU y, a medida que aumentan, la CPU tarda más en prepararlos. La GPU, aunque renderiza más rápido, tiene que esperar y pasa mucho tiempo inactiva, así que el cuello de botella está en la CPU.

![draw calls de CPU y GPU](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*EEqn28cbO11QXkyqcoaO7g.jpeg)

¿Cómo reducir los draw calls? Normalmente hay dos formas de pensarlo:

-   Culling del viewport.
-   Batching de draw calls.

## Culling del viewport {#culling}

Los gráficos que quedan fuera del viewport no hace falta renderizarlos. La imagen siguiente, de Unreal [Cómo funciona el culling], muestra desde una perspectiva de Dios los objetos rojos descartados fuera del cono de visión de la cámara, y puedes ver que esto reduce mucho el número de draw calls innecesarios.

![culling del frustum de vista](https://d1iv7db44yhgxn.cloudfront.net/documentation/images/6f2a0e24-c0e0-4fc0-b637-29c792739474/sceneview_viewfrustumculled.png)

En las escenas 3D hay muchas optimizaciones basadas en el algoritmo de culling del cono de visión de la cámara, como se describe en [Culling eficiente del frustum de vista]. Por ejemplo, se puede usar la información del grafo de escena para que, si un gráfico ya está por completo dentro del cono de visión, no haga falta detectar sus nodos hijos.

Los motores de renderizado ofrecen funciones correspondientes, por ejemplo:

-   Cesium [Culling jerárquico rápido]
-   Babylon.js [Cambiar la estrategia de culling de mallas]
-   [pixi-cull]

Comparado con una escena 3D, nuestro lienzo 2D es mucho más sencillo de implementar. ¿Cómo determinas si una figura está en el viewport? Aquí entra el concepto de caja delimitadora. Por supuesto, no tienes que usar una caja delimitadora: en una escena 3D puedes usar una esfera delimitadora.

### Caja delimitadora alineada con los ejes {#aabb}

Una caja delimitadora alineada con los ejes, o AABB, es una caja delimitadora sencilla, habitual en los gráficos 3D, paralela a los ejes del sistema de coordenadas de mundo. En otras palabras, sus lados se orientan en la misma dirección que los ejes de coordenadas. Una caja delimitadora alineada con los ejes suele ser rectangular, y su propósito es representar el área del espacio que ocupa un objeto o un grupo de objetos mediante una caja simplificada. En nuestra escena 2D es un rectángulo, y solo necesitamos almacenar las coordenadas superior izquierda `minX/Y` e inferior derecha `maxX/Y`:

```ts
export class AABB {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    matrix: Matrix;

    isEmpty() {
        return this.minX > this.maxX || this.minY > this.maxY;
    }
}
```

A continuación se añade una forma de obtener la caja envolvente del gráfico. Tomemos un círculo como ejemplo y tengamos en cuenta el centro, el radio y el ancho de línea. Aquí también se usa la [Marca de modificado], de modo que el recálculo solo se hace cuando cambian los atributos relevantes:

```ts
export class Circle extends Shape {
    getRenderBounds() {
        if (this.renderBoundsDirtyFlag) {
            const halfLineWidth = this.#strokeWidth / 2;
            this.renderBoundsDirtyFlag = false;
            this.renderBounds = new AABB(
                this.#cx - this.#r - halfLineWidth,
                this.#cy - this.#r - halfLineWidth,
                this.#cx + this.#r + halfLineWidth,
                this.#cy + this.#r + halfLineWidth,
            );
        }
        return this.renderBounds;
    }
}
```

### Añadir un plugin de culling {#culling-plugin}

Añade un plugin de culling que guarda la caja envolvente correspondiente al viewport y, después, la interseca con la caja envolvente de cada gráfico. Teniendo en cuenta la transformación de la cámara, obtenemos las coordenadas de los cuatro vértices del viewport en el sistema de coordenadas de mundo y las enmarcamos con una caja delimitadora. La caja delimitadora se actualiza cada vez que cambia la cámara.

```ts
export class Culling implements Plugin {
    #viewport: AABB = new AABB();

    private updateViewport() {
        const {
            camera,
            api: { viewport2Canvas },
        } = this.#context;
        const { width, height } = camera;

        // tl, tr, br, bl
        const tl = viewport2Canvas({
            x: 0,
            y: 0,
        });

        this.#viewport.minX = Math.min(tl.x, tr.x, br.x, bl.x);
        this.#viewport.minY = Math.min(tl.y, tr.y, br.y, bl.y);
        this.#viewport.maxX = Math.max(tl.x, tr.x, br.x, bl.x);
        this.#viewport.maxY = Math.max(tl.y, tr.y, br.y, bl.y);
    }
}
```

Al inicio de cada fotograma se recorre el grafo de escena para determinar si la caja envolvente del gráfico interseca el viewport y, si no lo hace, se asigna `true` a `culled` para poder omitirlo durante el renderizado:

```ts
hooks.beginFrame.tap(() => {
    const { minX, minY, maxX, maxY } = this.#viewport;

    traverse(root, (shape) => {
        if (shape.renderable && shape.cullable) {
            const bounds = shape.getBounds();
            shape.culled =
                bounds.minX >= maxX ||
                bounds.minY >= maxY ||
                bounds.maxX <= minX ||
                bounds.maxY <= minY;
        }

        return shape.culled;
    });
});
```

Para ver el efecto, el número de gráficos descartados cambia al acercar y alejar el zoom, y cuantos más gráficos se descartan, más alto es el FPS:

```js eval code=false
$total = call(() => {
    return document.createElement('div');
});
```

```js eval code=false
$culled = call(() => {
    return document.createElement('div');
});
```

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson8');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson8;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas2.parentElement.style.position = 'relative';
    $icCanvas2.parentElement.appendChild($stats);

    const circles = [];
    $icCanvas2.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 500; i++) {
            const circle = new Circle({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                r: Math.random() * 20,
                fill: `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                    Math.random() * 255,
                )},${Math.floor(Math.random() * 255)})`,
                batchable: false,
                // cullable: false,
            });
            canvas.appendChild(circle);
            circles.push(circle);
        }
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
        const total = circles.length;
        const culled = circles.filter((circle) => circle.culled).length;

        $total.innerHTML = `total: ${total}`;
        $culled.innerHTML = `culled: ${culled}`;
    });
});
```

Cuando el viewport contiene todas las figuras, no hay forma de eliminar ninguna, así que hay que usar otros medios para reducir los draw calls.

## Renderizado por lotes {#batch-rendering}

Los draw calls que se pueden fusionar deben cumplir ciertas condiciones, como tener una Geometry parecida, el mismo Shader, etc. [Batching de draw calls - Unity] ofrece dos formas de hacerlo:

-   [Batching estático] Para objetos estáticos, transfórmalos al sistema de coordenadas de mundo usando un array de vértices compartido. Una vez hecho, no se pueden aplicar transformaciones a objetos individuales.
-   [Batching dinámico] Para objetos en movimiento. Transforma los vértices al sistema de coordenadas de mundo en el lado de la CPU, pero la propia transformación tiene un coste.

Pixi.js también tiene un sistema de renderizado por lotes integrado, que se ha usado hasta la versión V8 actualmente en desarrollo: [Dentro de PixiJS: el sistema de renderizado por lotes].

Primero separamos la lógica de renderizado de los gráficos; tiene sentido: el gráfico no debería ocuparse de cómo se renderiza:

```ts
class Circle {
    render(device: Device, renderPass: RenderPass, uniformBuffer: Buffer) {} // [!code --]
}
```

Antes, al recorrer el grafo de escena, se disparaba de inmediato la lógica de renderizado de los gráficos, pero ahora los gráficos se añaden a la cola de renderizado pendiente y esperan a fusionarse y emitirse juntos:

```ts
hooks.render.tap((shape) => {
    shape.render(); // [!code --]
    if (shape.renderable) {
        this.#batchManager.add(shape); // [!code ++]
    }
});
```

Después abstraemos la clase Drawcall y hacemos que el SDF implementado antes herede de ella. Contiene el ciclo de vida siguiente:

```ts
export abstract class Drawcall {
    abstract createGeometry(): void;
    abstract createMaterial(uniformBuffer: Buffer): void;
    abstract render(renderPass: RenderPass): void;
    abstract destroy(): void;
}

export class SDF extends Drawcall {}
```

### Instanciado {#instanced}

Para un gran número de figuras parecidas, [Optimización de WebGL2 - dibujo instanciado] puede reducir de forma notable el número de draw calls. En Three.js esto se llama [InstancedMesh]. Babylon.js también ofrece [Instances], donde los atributos específicos de cada instancia, como las matrices de transformación, los colores, etc., se pueden pasar como arrays de vértices:

![nodo de instancias](https://doc.babylonjs.com/img/how_to/instances-node.png)

```glsl
#ifdef INSTANCES
  attribute vec4 world0;
  attribute vec4 world1;
  attribute vec4 world2;
  attribute vec4 world3;

  finalWorld = mat4(world0, world1, world2, world3);
#endif
```

Como solo consideramos escenas 2D, la matriz de transformación solo necesita almacenar 6 componentes:

```glsl
#ifdef USE_INSTANCES
  layout(location = 14) in vec4 a_Abcd;
  layout(location = 15) in vec2 a_Txty;

  model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
#endif
```

Cabe mencionar que las matrices de transformación de las instancias individuales se pueden almacenar en la textura de datos, además de almacenarse directamente en los datos de vértices, y referenciarse mediante índices en el array de vértices:
[Dibujar muchos modelos distintos en un solo draw call]

Añadimos una marca `instanced` a Drawcall:

```ts
export abstract class Drawcall {
    constructor(protected device: Device, protected instanced: boolean) {}
}
```

Se añade una directiva de precompilación `define` a la cabecera del shader según esta marca:

```ts{5}
export class SDF extends Drawcall {
  createMaterial(uniformBuffer: Buffer): void {
    let defines = '';
    if (this.instanced) {
      defines += '#define USE_INSTANCES\n';
    }
  }
}
```

Así, la matriz de transformación del modelo se puede calcular a partir del attribute o del uniform:

```glsl
void main() {
  mat3 model;
  #ifdef USE_INSTANCES
    model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
  #else
    model = u_ModelMatrix;
  #endif
}
```

En este punto puedes usar [Spector.js] para ver que, aunque haya 1000 círculos en el viewport, se puede hacer con un solo draw call:

![draw calls instanciados en Spector.js](/instanced-spector.png)

También podemos limitar el número máximo de instancias de un Drawcall comprobándolo antes de cada creación y volviéndolo a crear si se supera:

```ts
export abstract class Drawcall {
    protected maxInstances = Infinity;
    validate() {
        return this.count() <= this.maxInstances - 1;
    }
}
```

### Orden de renderizado {#rendering-order}

Como dibujamos varias figuras con un solo draw call, hay que prestar atención al orden de dibujo. La posición de cada elemento en el array de instancias no equivale necesariamente al orden de dibujo final, así que necesitamos asignar un valor a cada figura antes de dibujarla de verdad, normalizar ese valor a `[0, 1]` y pasarlo al shader como valor de profundidad:

```ts{4}
export class Renderer implements Plugin {
  apply(context: PluginContext) {
    hooks.render.tap((shape) => {
      shape.globalRenderOrder = this.#zIndexCounter++;
    });

    hooks.beginFrame.tap(() => {
      this.#zIndexCounter = 0;
    });
  }
}
```

Después activamos la [Prueba de profundidad], y el método de prueba pasa a ser el siguiente: se escriben los valores de profundidad mayores que el valor almacenado en el Depth buffer actual (en el rango `[0, 1]`) (WebGL usa `gl.LESS` de forma predeterminada). En nuestro escenario, los gráficos con un ZIndex mayor sobrescriben a los menores.

```ts
export class SDF extends Drawcall {
    createMaterial(uniformBuffer: Buffer): void {
        this.#pipeline = this.device.createRenderPipeline({
            megaStateDescriptor: {
                depthWrite: true, // [!code ++]
                depthCompare: CompareFunction.GREATER, // [!code ++]
            },
        });
    }
}
```

Por último, se crea un Depth RenderTarget adicional cuando se crea el RenderPass:

```ts
this.#renderPass = this.#device.createRenderPass({
    colorAttachment: [this.#renderTarget],
    colorResolveTo: [onscreenTexture],
    colorClearColor: [TransparentWhite],
    depthStencilAttachment: this.#depthRenderTarget, // [!code ++]
    depthClearValue: 1, // [!code ++]
});
```

Mira cómo funciona, dibujando 5000 círculos con el culling y la optimización por lotes activados a la vez:

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson8');
});
```

```js eval code=false
$total2 = call(() => {
    return document.createElement('div');
});
```

```js eval code=false
$culled2 = call(() => {
    return document.createElement('div');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson8;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    const circles = [];
    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 5000; i++) {
            const circle = new Circle({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                r: Math.random() * 20,
                fill: `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                    Math.random() * 255,
                )},${Math.floor(Math.random() * 255)})`,
                batchable: true,
                cullable: true,
            });
            canvas.appendChild(circle);
            circles.push(circle);
        }
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
        const total = circles.length;
        const culled = circles.filter((circle) => circle.culled).length;

        $total2.innerHTML = `total: ${total}`;
        $culled2.innerHTML = `culled: ${culled}`;
    });
});
```

### Desactivar el culling {#disable-culling}

Activar el culling puede, en ciertos escenarios, aumentar el coste de rendimiento.

[Mapa de datos de Wikipedia]

## Optimizar el rendimiento del picking {#optimizing-picking-perf}

A continuación mediremos el rendimiento del picking añadiendo un detector de eventos pointerenter/leave a cada Circle:

```ts
circle.addEventListener('pointerenter', () => {
    circle.fill = 'red';
});
circle.addEventListener('pointerleave', () => {
    circle.fill = fill;
});
```

El picking de 20000 Circle tardó el tiempo siguiente:

![rendimiento del picking](/pick-perf.png)

La AABB de los gráficos se puede usar para el culling basado en el viewport, lo que permite juicios aproximados más rápidos que los métodos matemáticos.

### Usar indexación espacial {#using-spatial-indexing}

Un índice espacial es una estructura de datos que se usa para manejar con eficiencia datos espaciales y operaciones de consulta, sobre todo en sistemas de información geográfica (GIS), gráficos por computadora, desarrollo de juegos 3D y tecnología de bases de datos. El propósito principal de la indexación espacial es reducir la cantidad de cálculo y el tiempo necesarios para buscar objetos espaciales concretos en grandes volúmenes de datos. Hay varias estructuras de datos para la indexación espacial, como Quadtree, Octree, R-tree, K-d tree, etc. Cada estructura tiene sus escenarios de aplicación y sus ventajas.

En el ecosistema de PIXI.js hay bibliotecas como [pixi-spatial-hash] que crean índices espaciales nuevos en cada fotograma. Sin embargo, ahora mismo parece que les falta mantenimiento.

Usamos [rbush], que admite la inserción por lotes, normalmente entre 2 y 3 veces más rápida que insertar fotograma a fotograma, y que también se usa en Mapbox.

```ts
import RBush from 'rbush';
const rBushRoot = new RBush<RBushNodeAABB>();

export interface RBushNodeAABB {
    shape: Shape;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
```

### Búsqueda con RBush {#rbush-search}

RBush ofrece una función de consulta por región, [search], a la que se le pasa una caja de consulta para que devuelva una lista de gráficos alcanzados:

```ts
export class Canvas {
    elementsFromBBox(
        minX: number,
        minY: number,
        maxX: number,
        maxY: number,
    ): Shape[] {
        const { rBushRoot } = this.#pluginContext;
        const rBushNodes = rBushRoot.search({ minX, minY, maxX, maxY });

        const hitTestList: Shape[] = [];
        rBushNodes.forEach(({ shape }) => {
            // Omit the process of handling the visibility and pointerEvents properties of shape.
        });
        // Sort by global render order.
        hitTestList.sort((a, b) => a.globalRenderOrder - b.globalRenderOrder);

        return hitTestList;
    }
}
```

En el [Plugin de picking] usamos el método de búsqueda por región anterior, aunque, por supuesto, se pasa un punto en lugar de una AABB:

```ts{9}
export class Picker implements Plugin {
  apply(context: PluginContext) {
    hooks.pickSync.tap((result: PickingResult) => {
      const {
        position: { x, y },
      } = result;

      const picked: Shape[] = [root];
      elementsFromBBox(x, y, x, y).forEach((shape) => {
        if (this.hitTest(shape, x, y)) {
          picked.unshift(shape);
        }
      });
      result.picked = picked;
      return result;
    });
  }
}
```

Volvamos a medirlo: el tiempo de picking de 20 000 Circle pasa a ser de 0.088 ms, una mejora de unas 20 veces.

![rendimiento del picking con rbush](/pick-rbush-perf.png)

### Picking por color en la GPU {#color-picking}

En la sección anterior, [Picking], mencionamos una alternativa al picking basado en métodos matemáticos: el picking por color en la GPU. En deck.gl se llama [Picking por color].

## Lectura adicional {#extended-reading}

-   [Dentro de PixiJS: el sistema de renderizado por lotes]
-   [Prueba de profundidad]
-   [La textura de profundidad | WebGPU]
-   Three.js [BatchedMesh: propuesta]

[stats.js]: https://github.com/mrdoob/stats.js
[Spector.js]: https://spector.babylonjs.com/
[Los draw calls en pocas palabras]: https://toncijukic.medium.com/draw-calls-in-a-nutshell-597330a85381
[Batching de draw calls - Unity]: https://docs.unity3d.com/Manual/DrawCallBatching.html
[Batching estático]: https://docs.unity3d.com/Manual/static-batching.html
[Batching dinámico]: https://docs.unity3d.com/Manual/dynamic-batching.html
[pixi-cull]: https://github.com/davidfig/pixi-cull
[pixi-spatial-hash]: https://github.com/ShukantPal/pixi-spatial-hash
[rbush]: https://github.com/mourner/rbush
[Cómo funciona el culling]: https://dev.epicgames.com/documentation/en-us/unreal-engine/visibility-and-occlusion-culling-in-unreal-engine#howcullingworks
[Culling eficiente del frustum de vista]: https://old.cescg.org/CESCG-2002/DSykoraJJelinek/
[Culling jerárquico rápido]: https://cesium.com/blog/2015/08/04/fast-hierarchical-culling/
[Cambiar la estrategia de culling de mallas]: https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene#changing-mesh-culling-strategy
[Dentro de PixiJS: el sistema de renderizado por lotes]: https://medium.com/swlh/inside-pixijs-batch-rendering-system-fad1b466c420
[BatchedMesh: propuesta]: https://github.com/mrdoob/three.js/issues/22376
[InstancedMesh]: https://threejs.org/docs/?q=instanced#api/en/objects/InstancedMesh
[Optimización de WebGL2 - dibujo instanciado]: https://webgl2fundamentals.org/webgl/lessons/webgl-instanced-drawing.html
[Dibujar muchos modelos distintos en un solo draw call]: https://webglfundamentals.org/webgl/lessons/webgl-qna-drawing-many-different-models-in-a-single-draw-call.html
[Instances]: https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances
[Marca de modificado]: /es/guide/lesson-002#dirty-flag
[Prueba de profundidad]: https://learnopengl.com/Advanced-OpenGL/Depth-testing
[La textura de profundidad | WebGPU]: https://carmencincotti.com/2022-06-13/webgpu-the-depth-texture/
[Plugin de picking]: /es/guide/lesson-006#picking-plugin
[search]: https://github.com/mourner/rbush?tab=readme-ov-file#search
[Picking]: /es/guide/lesson-006#picking
[Picking por color]: https://deck.gl/docs/developer-guide/custom-layers/picking
[Mapa de datos de Wikipedia]: /example/wikipedia-datamap
