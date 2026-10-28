---
outline: deep
description: 'Aprende a inicializar un lienzo con capas de abstracción de hardware basadas en WebGL/WebGPU, a diseñar la Canvas API, a implementar una arquitectura basada en complementos y a crear un complemento de renderizado. Construye un marco de lienzo extensible que admita varios renderizadores.'
head:
    - [
          'meta',
          { property: 'og:title', content: 'Lección 1 - Inicializar el lienzo' },
      ]
---
# Lección 1 - Inicializar el lienzo {#lesson-1-initialize-canvas}

En esta lección aprenderás lo siguiente:

-   Capas de abstracción de hardware (HAL) basadas en WebGL1/2 y WebGPU
-   Diseñar nuestra Canvas API
-   Implementar un sistema de complementos sencillo
-   Implementar un complemento de renderizado basado en la HAL

::: warning Nota de seguridad: @antv/g-device-api

[GHSA-hqjp-pg4j-q8g2](https://github.com/advisories/GHSA-hqjp-pg4j-q8g2) identifica las versiones de npm **1.7.13 y 1.8.13** como publicaciones maliciosas que contienen un script `preinstall` que roba credenciales. **No instales estas versiones.** A 13 de octubre de 2026, el aviso no indica ninguna versión corregida.

La URL del WASM del compilador de shaders que aparece más abajo está fijada en **1.6.13**, la última versión disponible en npm y UNPKG en esa fecha, coincidente con el paquete de JavaScript del `pnpm-lock.yaml` de este repositorio. Su WASM es idéntico byte a byte al artefacto **1.6.8** usado anteriormente y al compilador incluido en este repositorio; este cambio alinea los números de versión sin cambiar la funcionalidad del compilador. La versión 1.6.13 no figura como afectada, y obtener el WASM en un navegador no ejecuta los scripts de instalación de npm. Ninguno de estos hechos constituye una auditoría de seguridad del artefacto.

Cuando sigas la lección desde este repositorio, conserva el archivo de bloqueo con `pnpm install --frozen-lockfile`. Evita las instalaciones sin versión o con `latest`, y revisa la procedencia de cualquier actualización de dependencias. Un compilador de sustitución debe verificarse antes de poder recomendarse aquí. En los proyectos ECS actuales que usan `@infinite-canvas-tutorial/device-api`, prefiere su [recurso WASM incluido](/reference/create-app#shader-compiler) para mantener juntas las vinculaciones de JavaScript y el compilador, y evitar una petición a una CDN en tiempo de ejecución.

:::

Cuando inicies el proyecto verás un lienzo vacío y podrás cambiar el aspecto o alternar entre los renderizadores WebGL y WebGPU.

```js eval code=false
width = Inputs.range([50, 300], { label: 'width', value: 100, step: 1 });
```

```js eval code=false
height = Inputs.range([50, 300], { label: 'height', value: 100, step: 1 });
```

```js eval code=false
renderer = Inputs.select(['webgl', 'webgpu'], { label: 'renderer' });
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson1;

    const $canvas = document.createElement('canvas');
    $canvas.style.outline = 'none';
    $canvas.style.padding = '0px';
    $canvas.style.margin = '0px';
    $canvas.style.border = '1px solid black';

    const canvas = await new Canvas({
        canvas: $canvas,
        renderer,
        shaderCompilerPath:
            'https://unpkg.com/@antv/g-device-api@1.6.13/dist/pkg/glsl_wgsl_compiler_bg.wasm',
    }).initialized;

    const resize = (width, height) => {
        const scale = window.devicePixelRatio;
        $canvas.width = Math.floor(width * scale);
        $canvas.height = Math.floor(height * scale);
        $canvas.style.width = `${width}px`;
        $canvas.style.height = `${height}px`;
        canvas.resize(width, height);
    };
    resize(width, height);

    const animate = () => {
        canvas.render();
        requestAnimationFrame(animate);
    };
    animate();
    return $canvas;
})();
```

## Capas de abstracción de hardware {#hardware-abstraction-layers}

Quiero que el lienzo use APIs de renderizado de más bajo nivel, como WebGL y WebGPU, el sucesor de WebGL, que tiene muchas mejoras de funcionalidad; consulta [De WebGL a WebGPU]:

-   La base se apoya en una nueva generación de APIs de GPU nativas, como Direct3D12 / Metal / Vulkan y otras.
-   API sin estado, sin un estado global inmanejable.
-   Soporte de Compute Shader.
-   Ya no hay un límite en el número de contextos creados por cada `<canvas>`.
-   Mejoras en la experiencia de desarrollo. Incluyen mensajes de error más claros y etiquetas personalizadas para los objetos de la GPU.

El ecosistema de WebGPU se extiende ahora a JavaScript, C++ y Rust, y varios motores de renderizado del lado web (por ejemplo, Three.js y Babylon.js) están en proceso de acceder a él, o ya lo han hecho. Merece una mención especial [wgpu], que, además del motor de juegos [bevy], también ha sido usado en producción por herramientas de diseño creativo basadas en la web como [Modyfi], y se ha comportado muy bien. La imagen siguiente procede de: [Ecosistema de WebGPU]

![Ecosistema de WebGPU en 2023](https://developer.chrome.com/static/blog/webgpu-ecosystem/image/diagram-the-webgpu-ecosy-384594168a61_1920.png)

Por supuesto, dada la compatibilidad con los navegadores, todavía tenemos que ser lo más compatibles posible con WebGL1/2. En el motor de renderizado, la capa de abstracción de hardware (HAL) abstrae los detalles del hardware de la GPU y permite que las capas superiores sean independientes de la implementación concreta del hardware.

Esperamos ofrecer, en la medida de lo posible, un conjunto unificado de APIs basado en WebGL1/2 y WebGPU, junto con traducción y modularización de shaders. Esta lección usa [@antv/g-device-api], cuya implementación toma como referencia [noclip] y añade compatibilidad con WebGL1. Consulta la nota de seguridad anterior antes de instalar la dependencia.

Como WebGL y WebGPU usan lenguajes de shaders distintos, y no queremos mantener dos conjuntos de código, GLSL y WGSL, optamos por traducir el shader en tiempo de ejecución:

![Transpilación del shader en tiempo de ejecución](/shader-transpile.png)

En el proyecto solo hace falta mantener un conjunto de shaders con sintaxis GLSL 300, sustituir palabras clave al degradar a WebGL1 y convertirlo a GLSL 440 antes de entregarlo a un [compilador](https://github.com/antvis/g-device-api/tree/master/rust) en formato WASM (que usa naga y naga-oil) para obtener WGSL. No es casualidad que [Three.js Shading Language] también use un nivel de abstracción más alto y un compilador para emitir el código de shader de la plataforma de ejecución de destino.

A continuación se muestran las declaraciones de atributos que se usan habitualmente en el vertex shader. Es un caso muy sencillo, y la sintaxis varía mucho cuando se llega a la parte de muestreo de texturas.

```glsl
// GLSL 300
layout(location = 0) in vec4 a_Position;

// compiled GLSL 100
attribute vec4 a_Position;

// compiled GLSL 440
layout(location = 0) in vec4 a_Position;

// compiled WGSL
var<private> a_Position_1: vec4<f32>;
@vertex
fn main(@location(0) a_Position: vec4<f32>) -> VertexOutput {
    a_Position_1 = a_Position;
}
```

Hace poco me encontré con este artículo: [Renderizado de Figma: impulsado por WebGPU], y descubrí que Figma también ha adoptado un enfoque de implementación similar para completar su paso a WebGPU:

> Mantenemos nuestros shaders GLSL existentes, escritos en un formato compatible con WebGL 1. El procesador de shaders se encarga entonces de traducirlos automáticamente a WGSL. Esto implica analizar los shaders, hacer las traducciones necesarias para convertirlos a una versión más reciente de GLSL y, después, ejecutar la herramienta de código abierto naga para convertirlos a WGSL.

Bueno, basta ya de la capa de abstracción de hardware; si te interesan los detalles de la implementación, puedes consultar directamente el código fuente de [@antv/g-device-api]. Usaremos parte de esta API en la última subsección de esta lección.

## Diseñar la Canvas API {#design-the-canvas-api}

Por fin llegamos a la parte de diseño de nuestra API del lienzo. El uso sencillo que esperamos es el siguiente:

-   Pasar un HTMLCanvasElement `<canvas>` para crear e inicializar el lienzo, incluida la creación del Device (una instancia abstracta de la GPU) mediante la capa de abstracción de hardware.
-   Crear un bucle de renderizado que llame continuamente a los métodos de renderizado del lienzo.
-   Soporte para cambiar el tamaño del lienzo, por ejemplo en respuesta al evento `resize`.
-   Destruirse en el momento adecuado.

```ts
const canvas = new Canvas({
    canvas: $canvas,
});

const animate = () => {
    requestAnimationFrame(animate);
    canvas.render();
};
animate();

canvas.resize(500, 500);
canvas.destroy();
```

El uso de bucles de renderizado es muy habitual en motores de renderizado como [Renderizado de la escena] en Three.js y [Bucle de dibujo básico] en CanvasKit. Consulta [Bucles de juego eficientes en JavaScript] para saber más sobre por qué se usa `requestAnimationFrame` en lugar de `setTimeout`.

Parece una definición de interfaz muy sencilla, pero no nos precipitemos a implementarla, porque aquí hay un problema de inicialización asíncrona.

```ts
interface Canvas {
    constructor(config: { canvas: HTMLCanvasElement });
    render(): void;
    destroy(): void;
    resize(width: number, height: number): void;
}
```

### Inicialización asíncrona {#asynchronous-initialization}

Esta es también una diferencia importante entre WebGPU y WebGL. En WebGL, obtener el contexto es un proceso síncrono, mientras que obtener un Device en WebGPU es asíncrono:

```ts
// create a context in WebGL
const gl = $canvas.getContext('webgl');

// obtaining a device in WebGPU
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
```

Por tanto, al usar la capa de abstracción de hardware de la que hablamos en la sección anterior, también hay que usar un enfoque asíncrono. Esto supone un cambio incompatible para todos los motores de renderizado que quieran pasar de WebGL a WebGPU, como Babylon.js: [La creación del motor de WebGPU es asíncrona]:

```ts
import {
    WebGLDeviceContribution,
    WebGPUDeviceContribution,
} from '@antv/g-device-api';

// create a device in WebGL
const deviceContribution = new WebGLDeviceContribution({
    targets: ['webgl2', 'webgl1'],
});
// create a device in WebGPU
const deviceContribution = new WebGPUDeviceContribution({
    shaderCompilerPath: '/glsl_wgsl_compiler_bg.wasm',
});
// here's the asynchronous process
const swapChain = await deviceContribution.createSwapChain($canvas);
const device = swapChain.getDevice();
// create GPU objects with Device API
```

Como los constructores de JavaScript no admiten operaciones asíncronas, se añade al lienzo un método init asíncrono para inicializarlo, y el método de renderizado se llama cuando la inicialización ha terminado:

```ts
const canvas = new Canvas();
await canvas.init();
canvas.render();
```

Pero no me parece un buen enfoque. En primer lugar, la palabra clave `new` ya implica la inicialización. En segundo lugar, el método init parece que se puede llamar varias veces, pero en realidad no es así. Inspirado por el [Patrón de constructor asíncrono en JavaScript], personalmente prefiero la sintaxis siguiente:

```ts
const canvas = await new Canvas().initialized;
```

De hecho, este patrón de diseño también lo usa, por ejemplo, la [Animation: propiedad ready] de la Web Animations API:

```ts
animation.ready.then(() => {});
```

### Implementación {#implementation}

En la implementación usamos una variable privada para guardar la Promise, y el getter también garantiza que sea de solo lectura:

```ts
export class Canvas {
    #instancePromise: Promise<this>;
    get initialized() {
        return this.#instancePromise.then(() => this);
    }
}
```

Dentro del constructor usamos una expresión de función asíncrona de invocación inmediata (IIAFE) para realizar la inicialización:

```ts
constructor() {
  this.#instancePromise = (async () => {
    // Omit the specific implementation...
    return this;
  })();
}
```

Sigamos optimizando el diseño actual.

## Arquitectura basada en complementos {#plugin-based-architecture}

Por supuesto, podríamos colocar el código que llama a la capa de abstracción de hardware dentro del constructor de Canvas y destruirlo todo junto en el método `destroy`. Sin embargo, a medida que añadimos más tareas durante las fases de inicialización, renderizado y destrucción, la lógica de Canvas seguirá creciendo. Es difícil prever desde el principio todas las funcionalidades que hay que soportar; por eso queremos que el lienzo sea extensible.

```ts
destroy() {
  this.device.destroy();
  this.eventManager.destroy();
  // Omit other tasks...
}
```

La arquitectura basada en complementos es un patrón de diseño habitual que se ve en webpack, VS Code e incluso Chrome. Tiene las características siguientes:

-   Modularidad. Cada complemento se encarga de una parte independiente, con menos acoplamiento entre ellos, lo que facilita el mantenimiento.
-   Extensibilidad. Los complementos se pueden cargar y descargar dinámicamente en tiempo de ejecución sin afectar a la estructura del módulo central, y así se consigue ampliar la aplicación de forma dinámica.

Esta arquitectura suele constar de las partes siguientes:

-   La aplicación principal. Ofrece la funcionalidad para registrar complementos, llama a los complementos para que se ejecuten en la fase adecuada y proporciona el contexto necesario para su ejecución.
-   La interfaz del complemento. Sirve de puente entre la aplicación principal y los complementos.
-   La colección de complementos. Un conjunto de módulos que se pueden ejecutar de forma independiente; cada complemento sigue el principio de separación de responsabilidades y contiene solo la funcionalidad mínima necesaria.

¿Cómo invoca la aplicación principal la ejecución de los complementos? Veamos primero el enfoque de webpack:

-   En la aplicación principal se define una serie de hooks. Estos hooks pueden ser síncronos o asíncronos, y en serie o en paralelo. Si son síncronos y en serie, se parecen a los escuchadores de eventos habituales que ya conocemos. En el ejemplo siguiente, `run` es un hook síncrono en serie.
-   Cada complemento, al registrarse, escucha los eventos del ciclo de vida que le interesan. En el ejemplo siguiente, `apply` se llama durante el registro.
-   La aplicación principal dispara los hooks.

```ts
class ConsoleLogOnBuildWebpackPlugin {
    apply(compiler) {
        compiler.hooks.run.tap(pluginName, (compilation) => {
            console.log('webpack starting...');
        });
    }
}
```

webpack implementa el conjunto de herramientas [tapable] para ofrecer estas capacidades, y también usa `new Function` para mejorar el rendimiento en escenarios de llamadas masivas, como se comenta en [¿El rendimiento de new Function es realmente bueno?]. Pero podemos implementarlo de forma sencilla en la misma línea; por ejemplo, los hooks de ejecución síncrona en serie usan un array de `callbacks`, y no hay magia negra:

```ts
export class SyncHook<T> {
    #callbacks: ((...args: AsArray<T>) => void)[] = [];

    tap(fn: (...args: AsArray<T>) => void) {
        this.#callbacks.push(fn);
    }

    call(...argsArr: AsArray<T>): void {
        this.#callbacks.forEach(function (callback) {
            /* eslint-disable-next-line prefer-spread */
            callback.apply(void 0, argsArr);
        });
    }
}
```

Definimos los hooks siguientes, con nombres que reflejan visualmente en qué fase de la aplicación principal se llamarán:

```ts
export interface Hooks {
    init: SyncHook<[]>;
    initAsync: AsyncParallelHook<[]>;
    destroy: SyncHook<[]>;
    resize: SyncHook<[number, number]>; // When height or width changed.
    beginFrame: SyncHook<[]>;
    endFrame: SyncHook<[]>;
}
```

El contexto del complemento que contiene estos hooks se pasa durante la fase de registro del complemento, y seguiremos ampliando el contexto del complemento más adelante:

```ts
export interface PluginContext {
    hooks: Hooks;
    canvas: HTMLCanvasElement;
}
export interface Plugin {
    apply: (context: PluginContext) => void;
}
```

Llamar al método `apply` en la inicialización del lienzo y pasar el contexto completa el registro del complemento y dispara la inicialización de los hooks síncronos y asíncronos, y el complemento de renderizado que implementamos en la sección siguiente completa la inicialización asíncrona:

```ts{8}
import { Renderer } from './plugins';

this.#instancePromise = (async () => {
  const { hooks } = this.#pluginContext;
  [new Renderer()].forEach((plugin) => {
    plugin.apply(this.#pluginContext);
  });
  hooks.init.call();
  await hooks.initAsync.promise();
  return this;
})();
```

Ahora tenemos todo lo necesario para implementar el primer complemento.

## Complemento de renderizado {#renderer-plugin}

Queremos admitir WebGL y WebGPU, así que permitimos la configuración mediante el parámetro `renderer` en el constructor del lienzo, que después se pasa al contexto del complemento:

```ts{3}
constructor(config: {
  canvas: HTMLCanvasElement;
  renderer?: 'webgl' | 'webgpu';
}) {}

this.#pluginContext = {
  canvas,
  renderer,
};
```

A continuación describimos cómo usar la capa de abstracción de hardware en el complemento de renderizado.

### SwapChain {#swapchain}

En OpenGL / WebGL, el [Framebuffer predeterminado] es distinto del objeto framebuffer (FBO) habitual, y se crea automáticamente al inicializar el contexto. Si no indicas un FBO al llamar al comando de dibujo, OpenGL escribe automáticamente el resultado del renderizado en el framebuffer predeterminado, cuyo color buffer acaba mostrándose en la pantalla.

En Vulkan no ocurre así; en su lugar tenemos [SwapChain]. La imagen siguiente, de [Contexto de Canvas y cadena de intercambio], muestra cómo funciona: la GPU escribe el resultado renderizado en el backbuffer, el frontbuffer se usa para mostrarlo en la pantalla y ambos se pueden intercambiar.

![Doble búfer](https://res.cloudinary.com/dx1kpewvo/image/upload/v1670938992/2022-12-19/webgpu_swap_1_nnce5v.png)

Sin este mecanismo de doble búfer, es muy probable que la GPU escriba los resultados renderizados al mismo tiempo que la pantalla se actualiza, lo que puede provocar desgarro. Por eso también hace falta usar la sincronización vertical para obligar a la pantalla a no permitir actualizaciones, y la figura siguiente, de [Contexto de Canvas y cadena de intercambio], muestra la temporización de este proceso.

![Doble búfer y V-Sync](https://res.cloudinary.com/dx1kpewvo/image/upload/v1671030455/2022-12-19/webgpu_swap_5_asrq42.png)

En WebGPU el usuario normalmente no accede de forma directa a la SwapChain, que está integrada en [GPUCanvasContext]. [wgpu], que también sigue el diseño de WebGPU, combina la SwapChain en [Surface], a la que el usuario tampoco accede de forma directa. Sin embargo, nuestra capa de abstracción de hardware sigue usando este concepto para la encapsulación. Esto permite crear la SwapChain y el Device durante la inicialización del complemento según el parámetro `renderer`:

```ts{13}
import {
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@antv/g-device-api';
import type { SwapChain, DeviceContribution, Device } from '@antv/g-device-api';

export class Renderer implements Plugin {
  apply(context: PluginContext) {
    const { hooks, canvas, renderer } = context;

    hooks.initAsync.tapPromise(async () => {
      let deviceContribution: DeviceContribution;
      if (renderer === 'webgl') {
        deviceContribution = new WebGLDeviceContribution();
      } else {
        deviceContribution = new WebGPUDeviceContribution();
      }
      const { width, height } = canvas;
      const swapChain = await deviceContribution.createSwapChain(canvas);
      swapChain.configureSwapChain(width, height);

      this.#swapChain = swapChain;
      this.#device = swapChain.getDevice();
    });
  }
}
```

### devicePixelRatio {#devicepixelratio}

[devicePixelRatio] describe cuántos píxeles reales de la pantalla deben usarse para dibujar un solo píxel CSS. Normalmente configuramos `<canvas>` con el código siguiente:

```ts
const $canvas = document.getElementById('canvas');
$canvas.style.width = `${width}px`; // CSS Pixels
$canvas.style.height = `${height}px`;

const scale = window.devicePixelRatio;
$canvas.width = Math.floor(width * scale); // Screen Pixels
$canvas.height = Math.floor(height * scale);
```

Usamos píxeles CSS al describir el ancho y el alto del lienzo y el tamaño de la figura, y los píxeles reales de la pantalla al crear la SwapChain. El ancho y el alto que se pasan a `resize` también usan píxeles CSS, así que hay que convertirlos:

```ts{3}
hooks.resize.tap((width, height) => {
  this.#swapChain.configureSwapChain(
    width * devicePixelRatio,
    height * devicePixelRatio,
  );
});
```

Entonces, ¿cómo obtenemos [devicePixelRatio]? Por supuesto podemos usar `window.devicePixelRatio` para obtenerlo, y en la mayoría de los casos está bien. Pero ¿qué ocurre si en el entorno de ejecución no hay un objeto `window`? Por ejemplo:

-   Renderizado en el servidor con Node.js. Por ejemplo, usando [headless-gl]
-   Renderizado en un WebWorker, usando [OffscreenCanvas].
-   Entornos de navegador no estándar, como los applets

Así que es mejor permitir pasarlo al crear el lienzo e intentar obtenerlo de [globalThis] cuando no se pase. Modificamos los parámetros del constructor de Canvas de la siguiente manera:

```ts{2}
export interface CanvasConfig {
  devicePixelRatio?: number;
}

const { devicePixelRatio } = config;
const globalThis = getGlobalThis();
this.#pluginContext = {
  devicePixelRatio: devicePixelRatio ?? globalThis.devicePixelRatio,
};
```

Los demás hooks se implementan así:

```ts
hooks.destroy.tap(() => {
    this.#device.destroy();
});

hooks.beginFrame.tap(() => {
    this.#device.beginFrame();
});

hooks.endFrame.tap(() => {
    this.#device.endFrame();
});
```

Por último, añade el complemento a la lista de complementos del lienzo:

```ts{1}
[new Renderer(), ...plugins].forEach((plugin) => {
  plugin.apply(this.#pluginContext);
});
```

## Demostración {#demo}

Como todavía no hemos dibujado ningún gráfico y el lienzo está en blanco, ¿cómo sabemos a qué comandos subyacentes de WebGL / WebGPU se está llamando? La depuración en la web se puede hacer con los complementos de Chrome: [Spector.js] y [WebGPU Inspector].

La imagen siguiente muestra el comando del primer fotograma capturado con Spector.js, y se ve que hemos creado una serie de objetos de la GPU, como FrameBuffer, Texture, etc.:

![Instantánea de Spector.js](/spectorjs.png)

Después de cambiar al renderizado con WebGPU:

```ts{3}
const canvas = await new Canvas({
  canvas: $canvas,
  renderer: 'webgpu',
}).initialized;
```

Abre WebGPU Inspector para ver los objetos de la GPU que hemos creado y los comandos que se llaman en cada fotograma:

![Instantánea de WebGPU Inspector](/webgpu-inspector.png)

## Lectura adicional {#extended-reading}

Si no tienes ningún conocimiento básico de WebGL, puedes intentar aprenderlo antes:

-   [Fundamentos de WebGL]
-   [Fundamentos de WebGPU]

Más información sobre el patrón de diseño de complementos:

-   [Introducción a la programación orientada a complementos]
-   [Presentación: el sistema de complementos de Penpot]
-   [Extensiones en Tiptap]

[Ecosistema de WebGPU]: https://developer.chrome.com/blog/webgpu-ecosystem/
[De WebGL a WebGPU]: https://developer.chrome.com/blog/from-webgl-to-webgpu
[@antv/g-device-api]: https://github.com/antvis/g-device-api
[Introducción a la programación orientada a complementos]: https://pop-book.readthedocs.io/en/latest/index.html
[wgpu]: https://wgpu.rs/
[bevy]: https://bevyengine.org/
[noclip]: https://github.com/magcius/noclip.website
[Modyfi]: https://digest.browsertech.com/archive/browsertech-digest-how-modyfi-is-building-with/
[Patrón de constructor asíncrono en JavaScript]: https://qwtel.com/posts/software/async-constructor-pattern/
[Animation: propiedad ready]: https://developer.mozilla.org/en-US/docs/Web/API/Animation/ready
[Renderizado de la escena]: https://threejs.org/docs/index.html#manual/en/introduction/Creating-a-scene
[La creación del motor de WebGPU es asíncrona]: https://doc.babylonjs.com/setup/support/WebGPU/webGPUBreakingChanges#creation-of-the-webgpu-engine-is-asynchronous
[Spector.js]: https://spector.babylonjs.com/
[WebGPU Inspector]: https://github.com/brendan-duncan/webgpu_inspector
[tapable]: https://github.com/webpack/tapable
[¿El rendimiento de new Function es realmente bueno?]: https://github.com/webpack/tapable/issues/162
[Fundamentos de WebGL]: https://webglfundamentals.org/
[Fundamentos de WebGPU]: https://webgpufundamentals.org/
[devicePixelRatio]: https://developer.mozilla.org/zh-CN/docs/Web/API/Window/devicePixelRatio
[headless-gl]: https://github.com/stackgl/headless-gl
[OffscreenCanvas]: https://developer.mozilla.org/zh-CN/docs/Web/API/OffscreenCanvas
[SwapChain]: https://vulkan-tutorial.com/Drawing_a_triangle/Presentation/Swap_chain
[Framebuffer predeterminado]: https://www.khronos.org/opengl/wiki/Default_Framebuffer
[globalThis]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
[Surface]: https://docs.rs/wgpu/latest/wgpu/struct.Surface.html
[GPUCanvasContext]: https://gpuweb.github.io/gpuweb/#canvas-context
[Contexto de Canvas y cadena de intercambio]: https://carmencincotti.com/2022-12-19/how-to-render-a-webgpu-triangle-series-part-three-video/#bonus-content-swap-chain
[Presentación: el sistema de complementos de Penpot]: https://www.smashingmagazine.com/2024/11/open-source-meets-design-tooling-penpot/
[Bucles de juego eficientes en JavaScript]: https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/
[Extensiones en Tiptap]: https://tiptap.dev/docs/editor/core-concepts/extensions#what-are-extensions
[Bucle de dibujo básico]: https://skia.org/docs/user/modules/quickstart/#basic-draw-loop
[Three.js Shading Language]: https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language
[Renderizado de Figma: impulsado por WebGPU]: https://www.figma.com/blog/figma-rendering-powered-by-webgpu/
