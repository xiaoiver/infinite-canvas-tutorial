---
outline: deep
description: 'Configura un conjunto completo de pruebas con Jest, que incluye pruebas unitarias, pruebas de regresión visual, renderizado en el servidor con headless-gl, pruebas E2E con Playwright y pruebas de compatibilidad de navegadores.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lección 11 - Pruebas y renderizado en el servidor',
          },
      ]
---
# Lección 11 - Pruebas y renderizado en el servidor {#lesson-11-test-and-server-side-rendering}

La funcionalidad del lienzo se vuelve cada vez más compleja, así que ha llegado el momento de introducir pruebas para mejorar la calidad del proyecto. En esta lección aprenderás lo siguiente:

-   Configuración de un entorno de pruebas basado en Jest, incluidos los entornos local y de CI
-   Usar pruebas unitarias para mejorar la cobertura de código
-   Pruebas de regresión visual
    -   Renderizado en el servidor basado en headless-gl, con WebGL1 como objetivo
    -   Pruebas E2E basadas en Playwright, con WebGL2 y WebGPU como objetivo
-   Pruebas de UI E2E
-   Prueba de compatibilidad de navegadores basada en BrowserStack
-   Renderizado en WebWorker

Todo el código del proyecto relacionado con lo anterior se encuentra en la carpeta [\_\_tests\_\_] de nuestro proyecto.

## Entorno de pruebas {#test-environment}

Elegimos Jest como framework de pruebas y añadimos comandos de prueba en `package.json` para calcular la cobertura de código:

```json
"scripts": {
    "cov": "jest --coverage"
}
```

Ejecuta el comando de prueba `pnpm cov` en el workflow de GitHub, precedido por el comando `xvfb-run` cuando se introduce el renderizado en el servidor:

```yaml
- name: Cov
run: |
    xvfb-run -s "-ac -screen 0 1280x1024x16" pnpm cov
env:
    CI: true
- name: Coveralls
uses: coverallsapp/github-action@master
with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

Con `d3-color` nos encontramos con un problema habitual. Como D3 solo ofrece salida ESM de forma predeterminada, no podemos ejecutarlo directamente en Node.js. Tenemos dos opciones.

1. Jest ofrece la configuración [transformIgnorePatterns], que permite añadir `d3-color` e incluso las dependencias relacionadas con D3 y compilarlas a CJS.
2. Usar la biblioteca sustituta de D3 [victory-vendor], que es funcionalmente idéntica pero ofrece además salida CJS; consulta [problema de d3-color en recharts].

Elegimos el primer enfoque:

```js
const esm = ['d3-*'].map((d) => `_${d}|${d}`).join('|');
module.exports = {
    transformIgnorePatterns: [`<rootDir>/node_modules/(?!(?:.pnpm/)?(${esm}))`],
};
```

El entorno de pruebas está listo y ya puedes empezar a escribir tu primer caso de prueba.

## Prueba unitaria {#unit-test}

Empecemos por las pruebas unitarias, que son las más fáciles de implementar y sirven para probar funcionalidad no relacionada con el renderizado, como establecer propiedades gráficas, calcular el tamaño de la caja delimitadora, las determinaciones de picking, diversos métodos utilitarios, etc.

```ts
// __tests__/unit/circle.spec.ts
import { Circle } from '../../packages/core/src';

describe('Circle', () => {
    it('should get/set attributes correctly.', () => {
        const circle = new Circle({
            cx: 50,
            cy: 50,
            r: 50,
            fill: '#F67676',
        });
        expect(circle.cx).toBe(50);
    });
});
```

Tiene buena pinta. Hemos aumentado la cobertura de pruebas de Circle al 100 %.

```bash
------------------------------|---------|----------|---------|---------|-----------------------
File                          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------------|---------|----------|---------|---------|-----------------------
All files                     |   14.21 |    10.44 |    8.18 |   14.29 |
 src/shapes                   |   26.81 |    22.64 |   21.62 |   28.15 |
  Circle.ts                   |     100 |      100 |     100 |     100 |
```

Pero las pruebas unitarias tienen sus limitaciones. Al fin y al cabo, solo cubren una pequeña parte del código y no pueden garantizar que el sistema en conjunto funcione correctamente. Por ejemplo, quizá podamos saber si un círculo se dibuja bien, pero ¿qué pasa si hay 100? Escribir aserciones de prueba llevaría mucho más tiempo y sería más difícil.

## Pruebas de regresión visual {#visual-regression-testing}

En el mundo de las pruebas, «golden image» es un término que describe una imagen estándar o de referencia dentro de un conjunto de casos de prueba. El término se usa a menudo en las pruebas de regresión visual (Visual Regression Testing), una metodología de pruebas automatizadas que detecta cambios visuales comparando capturas de pantalla de una aplicación o un sitio web con un conjunto de imágenes de referencia definidas de antemano.

En los motores de renderizado es más fácil verificar la corrección de los resultados de renderizado que con pruebas unitarias, y se puede reducir mucho la necesidad de escribir aserciones a mano. [pixelmatch] facilita comparar imágenes y resaltar las diferencias:

![pixelmatch](/pixelmatch.png)

Hay dos formas de plantear cómo obtener capturas de pantalla en Node.js:

1. Renderizado en el servidor. Según la técnica de renderizado, puedes elegir la implementación de Node.js:

    - [node-canvas], implementación de Canvas basada en Cairo
    - [jsdom], implementación en JS puro de DOM y HTML.
    - [headless-gl] permite crear un contexto WebGL, pero solo admite WebGL1.

2. Navegadores headless. Entre los ejemplos están los primeros puppeteer y electron, o el más reciente Playwright.

Es interesante ver qué usan actualmente los motores de renderizado más populares:

-   [Three.js Puppeteer]
-   Babylon.js usó Jest + Puppeteer en su momento, pero ahora usa Playwright; consulta [Mover las pruebas de visualización a Playwright]
-   luma.gl usa [headless-gl]; consulta [Registrar dispositivos]
-   plot usa [mocha + JSDOM]

Exploremos las dos opciones por separado.

### Renderizado en el servidor {#server-side-rendering}

Aunque el renderizado en el servidor basado en la implementación de headless-gl solo admite WebGL1, hay situaciones en las que el renderizado en el servidor resulta adecuado:

-   Situaciones con poca o ninguna interacción
-   Escenas de interacción débil o incluso sin interacción, que no exigen un alto rendimiento en tiempo real y pueden generarse sin conexión, sin problemas de rendimiento en tiempo de ejecución.
-   La salida es una imagen de píxeles o vectorial que puede mostrarse en varios entornos.

Para admitir el renderizado en el servidor, tenemos que asegurarnos de que el código se ejecute en un entorno Node.js. Entonces, ¿cómo debemos tratar las llamadas a la DOM API en el código? La primera idea es decidir según el entorno; por ejemplo, registrar escuchadores de eventos solo en el entorno del navegador y llamar al método `addEventListener()`:

```ts{2}
const plugins = [
    isBrowser ? new DOMEventListener() : undefined,
    //...
];
```

Otra forma de pensarlo se encuentra en [d3-selector]: observamos que no da por sentada la existencia de la variable global `document`, sino que elige obtenerla del contexto, de modo que las capas superiores tengan la oportunidad de pasar una implementación en JS puro de la DOM API como `jsdom`, que también funcionará en el servidor.

```ts{3}
function creatorInherit(name) {
  return function() {
    var document = this.ownerDocument,
        uri = this.namespaceURI;
    return uri === xhtml && document.documentElement.namespaceURI === xhtml
        ? document.createElement(name)
        : document.createElementNS(uri, name);
  };
}
```

La misma idea se ve en [react-reconciler], donde entornos distintos como el DOM, Canvas, la consola, etc. solo tienen que implementar las interfaces acordadas en la configuración:

> Una «host config» es un objeto que tienes que proporcionar y que describe cómo hacer que ocurra algo en el entorno «host» (por ejemplo, el DOM, el lienzo, la consola o cualquier otro destino de renderizado). Tiene este aspecto:

```ts
const HostConfig = {
    createInstance(type, props) {
        // e.g. DOM renderer returns a DOM node
    },
    // ...
    appendChild(parent, child) {
        // e.g. DOM renderer would call .appendChild() here
    },
    // ...
};
```

La [Environment API] de Vite intenta resolver un problema parecido:

> Los cambios iniciados por la Runtime API llevan ahora a revisar por completo la forma en que Vite trata los entornos (cliente, SSR, workerd, etc.).

Volviendo a nuestro caso, hay que proporcionar los siguientes elementos de configuración para el entorno Node.js:

```ts
export interface CanvasConfig {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
     */
    devicePixelRatio?: number;
    /**
     * There is no `style.cursor = 'pointer'` in WebWorker.
     */
    setCursor?: (cursor: Cursor | string) => void;
}
```

#### Generar PNG {#ssr-png}

Con [headless-gl] puedes crear un WebGLRenderingContext y encapsularlo en un objeto de la clase HTMLCanvasElement. Después puedes usarlo para crear un lienzo con normalidad:

```ts
export function getCanvas(width = 100, height = 100) {
    let gl = _gl(width, height, {
        antialias: false,
        preserveDrawingBuffer: true,
        stencil: true,
    });

    const mockedCanvas: HTMLCanvasElement = {
        width,
        height,
        getContext: () => {
            gl.canvas = mockedCanvas;
            return gl;
        },
        addEventListener: () => {},
    };

    return mockedCanvas;
}
```

Una vez que tienes el WebGLRenderingContext, puedes llamar a [readPixels] para obtener los valores de los píxeles del área indicada y, después, escribirlos en el PNG para obtener la imagen base.

```ts
async function writePNG(gl: WebGLRenderingContext, path: string) {
    const width = gl.canvas.width;
    const height = gl.canvas.height;

    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    await createPNGFromRawdata(path, width, height, pixels);
}
```

Cada vez que ejecutas una prueba, puedes comparar la imagen de referencia con la imagen generada por esa prueba mediante [pixelmatch] y escribir las diferencias en un archivo para verlas con facilidad. Esto se hace con una extensión de aserción personalizada que ofrece Jest:

```ts
// useSnapshotMatchers.ts
// @see https://jestjs.io/docs/26.x/expect#expectextendmatchers
expect.extend({
    toMatchWebGLSnapshot,
    toMatchSVGSnapshot,
});

// Diff with golden image in test case.
expect($canvas.getContext()).toMatchWebGLSnapshot(dir, 'rect');
```

El código completo está detallado en [toMatchWebGLSnapshot.ts]

#### Generar SVG {#ssr-svg}

Para probar nuestra funcionalidad de exportación de imágenes, tenemos que proporcionar [jsdom] y [xmlserializer] como alternativas al entorno del navegador para ImageExporter. El primero sirve para crear un SVGElement en el entorno Node.js y el segundo para serializarlo en una cadena:

```ts{6,7}
import xmlserializer from 'xmlserializer';
import { JSDOM } from 'jsdom';

const exporter = new ImageExporter({
    canvas,
    document: new JSDOM().window._document,
    xmlserializer,
});
```

Cuando ya tienes la cadena del SVGElement, puedes escribirla en un archivo y, antes de hacerlo, puedes formatearla con prettier para que sea más fácil de leer:

```ts{11}
import xmlserializer from 'xmlserializer';
import { format } from 'prettier';

export function toMatchSVGSnapshot(
    dom: SVGElement | null,
    dir: string,
    name: string,
    options: ToMatchSVGSnapshotOptions = {},
) {
    let actual = dom
      ? format(xmlserializer.serializeToString(dom), {
          parser: 'babel',
        })
}
```

El código completo está detallado en [toMatchSVGSnapshot.ts]

#### Cómo simular eventos de interacción {#how-to-mock-event}

Con JSDOM puedes simular eventos de interacción como `MouseEvent` y disparar el Hook correspondiente directamente después de crearlos, evitando así la limitación de tener que escuchar eventos mediante la DOM API:

```ts
const window = new JSDOM().window;

const pointerdownEvent = new window.MouseEvent('pointerdown', {
    clientX: 100,
    clientY: 100,
});
canvas.pluginContext.hooks.pointerDown.call(pointerdownEvent);
```

Esto también facilita simular una combinación de eventos como arrastrar y soltar. El caso de prueba siguiente muestra la prueba del umbral de decisión del [Plugin de arrastrar y soltar]. Simulamos un conjunto de eventos consecutivos `pointerdown`, `pointermove` y `pointerup`, pero el evento `dragstart` no se disparará por el intervalo corto y la proximidad de los eventos vecinos:

```ts
const dragstartHandler = jest.fn();

canvas.root.addEventListener('dragstart', dragstartHandler);
canvas.pluginContext.hooks.pointerDown.call(
    createMouseEvent('pointerdown', { clientX: 100, clientY: 100 }),
);
canvas.pluginContext.hooks.pointerMove.call(
    createMouseEvent('pointermove', { clientX: 101, clientY: 101 }),
);
canvas.pluginContext.hooks.pointerUp.call(
    createMouseEvent('pointerup', { clientX: 101, clientY: 101 }),
);
expect(dragstartHandler).not.toBeCalled();
```

#### SSR en CI {#ssr-ci}

[¿Cómo puedo usar headless-gl con un servicio de integración continua?]

```yaml
- name: Install headless-gl dependencies
    run: |
        sudo apt-get update
        sudo apt-get install -y mesa-utils xvfb libgl1-mesa-dri libglapi-mesa libosmesa6

- name: Cov
    run: |
        xvfb-run -s "-ac -screen 0 1280x1024x16" pnpm cov
```

El código completo está detallado en [workflows de GitHub - test]

### Navegador headless {#headless-browser}

Por muy bueno que sea el renderizado en el servidor, las soluciones de navegador headless tienen ventajas propias e insustituibles en las pruebas. Tomando Playwright como ejemplo:

-   Compatibilidad con WebGL 1/2 e incluso WebGPU con el Chrome más reciente.
-   Se ofrecen directamente aserciones oficiales como toHaveScreenshot, las comparaciones a nivel de píxel vienen integradas y, cuando fallan, las diferencias se muestran en el informe; consulta [Comparaciones visuales] para más detalles.
-   El soporte de [sharding] permite el paralelismo entre varias máquinas en CI.

#### Ejecutar el servidor de desarrollo {#run-webserver}

El navegador de Playwright necesita acceder a los casos de prueba desplegados en el servidor de desarrollo, y elegimos Vite como servidor de pruebas:

```ts{6}
import { devices, defineConfig } from '@playwright/test';

export default defineConfig({
    // Run your local dev server before starting the tests
    webServer: {
        command: 'npm run dev:e2e', // vite dev
        url: 'http://localhost:8080',
        reuseExistingServer: !process.env.CI,
        stdout: 'ignore',
        stderr: 'pipe',
    },
});
```

#### Examinar el caso de prueba {#browse-testcase}

Accede a la URL correspondiente al caso de prueba después de iniciar el servidor:

```ts
test(name, async ({ page, context }) => {
    const url = `./infinitecanvas/?name=${name}`;
    await page.goto(url);
    await readyPromise;

    await expect(page.locator('canvas')).toHaveScreenshot(`${name}.png`);
});
```

La comparación entre este resultado y la imagen de referencia se visualiza en el informe de pruebas generado:

![Diferencia de imagen de Playwright](/playwright-image-diff.png)

En la práctica, he comprobado que las capturas generadas en local suelen diferir ligeramente del entorno de CI. Por ejemplo, en el lado izquierdo de la imagen de abajo hay una captura generada por mi entorno local, mientras que en el lado derecho hay una captura generada por el entorno de CI, con algunos rectángulos que tienen rayas raras.
En este caso, puedes usar el entorno de CI en lugar de la imagen de referencia generada en local para garantizar la coherencia. Puedes subir los artefactos del workflow de GitHub para obtener una captura de tu entorno de CI y descargarla en local como imagen de referencia.

![Diferencia entre los entornos local y de CI](/playwright-local-vs-ci.png)

#### WebGL2 y WebGPU {#webgl2-webgpu}

La mayor ventaja de una solución de pruebas de extremo a extremo frente al renderizado en el servidor con [headless-gl] es que admite tanto WebGL2 como WebGPU, lo que nos permite escribir un solo conjunto de casos de prueba, crear un lienzo a partir de las configuraciones de renderizador de las URL y generar las imágenes de referencia de WebGL2 y WebGPU, respectivamente.

```ts
['webgl', 'webgpu'].forEach((renderer) => {
    test(`${name} with ${renderer}`, async ({ page, context }) => {
        const url = `./infinitecanvas/?name=${name}`; // [!code --]
        const url = `./infinitecanvas/?name=${name}&renderer=${renderer}`; // [!code ++]
        await page.goto(url);
        await expect(page.locator('canvas')).toHaveScreenshot([
            renderer,
            `${name}.png`,
        ]);
    });
});
```

#### Configuración de CI {#e2e-ci}

Como mencioné antes, [sharding] admite el paralelismo de varias máquinas en CI, y cada máquina puede tener varios hilos activados. Por ejemplo, usemos 4 máquinas, cada una con 10 workers en paralelo, y fusionemos los informes en uno solo al final.

```yaml
jobs:
    e2e:
        timeout-minutes: 60
        runs-on: ubuntu-latest
        strategy:
            fail-fast: false
            matrix:
                shard: [1/4, 2/4, 3/4, 4/4]
```

Se ejecuta de la forma siguiente; para más detalles: [Acción E2E]

![Fragmentación de Playwright](/playwright-sharding.png)

#### Función de AWS Lambda {#aws-lambda-function}

Ahora tenemos que crear una función Lambda en AWS que haga el renderizado en el servidor usando una Layer personalizada que contenga `headless-gl`.

![aws-lambda-layer](/aws-lambda-layer.png)

Construyamos la Layer en local con la imagen de Amazon Linux 2023, ya que nuestro entorno de ejecución de destino es Node.js 20.x:

```bash
# Lambda runtime compatible base
FROM amazonlinux:2023

# Enable Node.js 20 and essential build tools
RUN yum update -y && \
    yum install -y \
      gcc \
      gcc-c++ \
      make \
      python3 \
      pkgconf-pkg-config \
      mesa-libGL-devel \
      mesa-libEGL-devel \
      mesa-libGLU-devel \
      mesa-libOSMesa-devel \
      libXi-devel \
      libXext-devel \
      libX11-devel \
      libxcb-devel \
      libXau-devel \
      libXdmcp-devel && \
    ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /build

# Create nodejs directory (Lambda Layer structure)
RUN mkdir -p nodejs

# Install Node.js (Amazon Linux 2023 default no Node)
RUN curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && \
    yum install -y nodejs

# Install headless-gl and dependencies
RUN npm install --prefix ./nodejs gl --build-from-source

# Copy mesa libraries (optional but helps ensure runtime success)
RUN mkdir -p lib64 && \
    cp /usr/lib64/libGL.so.* lib64/ && \
    cp /usr/lib64/libGLU.so.* lib64/ && \
    cp /usr/lib64/libOSMesa.so.* lib64/ && \
    cp /usr/lib64/libX11.so.* lib64/ && \
    cp /usr/lib64/libXau.so.* lib64/ && \
    cp /usr/lib64/libXi.so.* lib64/ && \
    cp /usr/lib64/libxcb.so.* lib64/ && \
    cp /usr/lib64/libXdmcp.so.* lib64/ && \
    cp /usr/lib64/libXext.so.* lib64/ || true

# Package final layer zip (AWS expects nodejs/ at root)
RUN zip -r9 /opt/headless-gl-layer.zip nodejs lib64

CMD ["bash"]
```

Después súbela a S3 para completar la creación de la layer:

```bash
aws lambda publish-layer-version \
  --layer-name headless-gl-layer \
  --description "Headless GL for Node.js on AL2 arm64" \
  --compatible-runtimes nodejs20.x \
  --compatible-architectures arm64 \
  --content S3Bucket=<your-bucket>,S3Key=headless-gl-layer.zip
```

Ya puedes seleccionar esta Layer en la consola de AWS para añadirla a tu función.

## Prueba E2E {#e2e-test}

[Componentes de Playwright (experimental)] admite pruebas a nivel de componente de frameworks de UI como React, Svelte, Vue y otros. En comparación con escribir casos de prueba usando `@playwright/test`, se ha añadido un método `mount` al objeto de parámetros:

```ts{3}
import { test, expect } from '@playwright/experimental-ct-react';

test('should work', async ({ mount }) => {
  const component = await mount(<HelloWorld msg="greetings" />);
  await expect(component).toContainText('Greetings');
});
```

El framework de pruebas recomendado en [Lit Testing] no incluye Playwright, pero podemos probar nuestros [Web Components] usando las [pruebas de Web Components con Playwright] de la comunidad.

```ts
import { defineConfig } from '@playwright/test'; // [!code --]
import { defineConfig } from '@sand4rt/experimental-ct-web'; // [!code ++]

export default defineConfig({});
```

Ahora toca escribir pruebas para nuestro componente Web Component.

### Probar el Web Component {#webcomponent-test}

Tomando como ejemplo el componente de barra de herramientas de zoom de la cámara, podemos comprobar si la propiedad `zoom` se muestra correctamente:

```ts
import { test, expect } from '@sand4rt/experimental-ct-web';
import { ZoomToolbar } from '../../packages/ui/src';

test('should display zoom correctly.', async ({ mount }) => {
    const component = await mount(ZoomToolbar, {
        props: {
            zoom: 100,
        },
    });
    await expect(component).toContainText('100%');
});
```

## Prueba de compatibilidad de navegadores {#browser-compatibility-test}

BrowserStack es una plataforma de pruebas en la nube que ofrece una serie de herramientas y servicios para probar aplicaciones web y móviles en distintos navegadores, sistemas operativos, dispositivos y entornos reales. BrowserStack permite a los equipos de desarrollo y de QA (aseguramiento de la calidad) probar sus aplicaciones en diversas configuraciones para garantizar la compatibilidad, el rendimiento y la experiencia de uso.

Babylon.js usa [browserstack-local] para las pruebas de compatibilidad.

## Renderizado en WebWorker {#rendering-in-webworker}

Además del servidor, WebWorker también se considera un entorno de ejecución especial. Ejecutar el código de renderizado en un WebWorker evita bloquear el hilo principal y mejora el rendimiento. Los motores de renderizado conocidos ofrecen casos de uso:

-   [Three.js OffscreenCanvas]
-   [Babylon.js OffscreenCanvas]

En nuestro [ejemplo de WebWorker], el hilo principal no está ocupado y, por tanto, no se aprecian sus ventajas. Aun así, es posible experimentar interacciones del lienzo como ampliar, desplazar y rotar la cámara, hacer picking de figuras, etc.

### Crear OffscreenCanvas {#offscreen-canvas}

Primero tienes que asegurarte de que tu entorno de ejecución admite OffscreenCanvas; consulta [¿Puedo usar OffscreenCanvas?]:

```ts
if ('OffscreenCanvas' in window && 'transferControlToOffscreen' in mainCanvas) {
    // Ok to use offscreen canvas
}
```

Después tenemos que hacer que nuestro lienzo admita la creación a partir de OffscreenCanvas:

```ts
export interface CanvasConfig {
    canvas: HTMLCanvasElement; // [!code --]
    canvas: HTMLCanvasElement | OffscreenCanvas; // [!code ++]
}
```

El código del hilo principal es el siguiente:

1. Primero transfiere el control del lienzo principal al OffscreenCanvas mediante [transferControlToOffscreen]
2. Crea un WebWorker con el método que ofrece Vite. Este escucha los mensajes que se le pasan, como establecer el estilo del ratón.
3. Normalmente pasaríamos el primer parámetro de [postMessage] al WebWorker, pero como OffscreenCanvas es [Transferable], aquí tenemos que usar el segundo parámetro.

```ts
// @see https://vitejs.dev/guide/features.html#import-with-query-suffixes
import Worker from './worker.js?worker&inline';

// 1.
const offscreenCanvas = mainCanvas.transferControlToOffscreen();

// 2.
worker = new Worker();
worker.onmessage = function (event) {
    // TODO: Handle message from WebWorker later.
};

// 3.
worker.postMessage(
    {
        type: 'init',
        offscreenCanvas,
        devicePixelRatio,
        boundingClientRect: mainCanvas.getBoundingClientRect(),
    },
    [offscreenCanvas],
);
```

El código del WebWorker es el siguiente:

1. Obtén el OffscreenCanvas pasado desde el hilo principal en el objeto de evento.
2. Crea un lienzo con el OffscreenCanvas y establece el devicePixelRatio.
3. Crea un [bucle de renderizado] que cree los gráficos y los añada al lienzo con normalidad.

```ts
// worker.js
self.onmessage = function (event) {
    const { type } = event.data;
    if (type === 'init') {
        // 1.
        const { offscreenCanvas, devicePixelRatio } = event.data;

        (async () => {
            // 2.
            const canvas = await new Canvas({
                canvas: offscreenCanvas,
                devicePixelRatio,
            }).initialized;

            // 3.
            const animate = () => {
                canvas.render();
                self.requestAnimationFrame(animate);
            };
            animate();
        })();
    }
    // ...Handle other messages.
};
```

En la práctica, es inevitable tener que gestionar a mano la comunicación entre el hilo principal y el WebWorker. Por ejemplo:

1. Eventos de interacción. El [sistema de eventos] depende de la DOM API, pero esta no está disponible en el WebWorker, así que tienes que escuchar los eventos de interacción del lienzo del hilo principal y avisar al WebWorker.
2. Cambio de tamaño del lienzo. Igual que lo anterior.
3. Establecer el estilo del ratón del lienzo principal.

### Eventos en el WebWorker {#events-in-webworker}

Tomando como ejemplo el evento `pointerdown`, lo escuchamos en el lienzo principal y, como el Event nativo no es [Transferable], tenemos que serializarlo y pasarlo al WebWorker:

```ts
mainCanvas.addEventListener(
    'pointerdown',
    (e) => {
        worker.postMessage({
            type: 'event',
            name: 'pointerdown',
            event: clonePointerEvent(e), // Simple copy of common properties on event objects
        });
    },
    true,
);
```

El Hook correspondiente se dispara directamente cuando el WebWorker recibe un mensaje de este tipo:

```ts
self.onmessage = function (event) {
    const { type } = event.data;
    if (type === 'event') {
        const { name, event: ev } = event.data;
        if (name === 'pointerdown') {
            canvas.pluginContext.hooks.pointerDown.call(ev);
        }
    }
};
```

Gestionar el evento de cambio de tamaño del lienzo es igual que lo anterior, así que lo omitimos.

### Establecer el estilo del cursor {#set-cursor}

El WebWorker también tiene que pasar mensajes al hilo principal durante el renderizado, por ejemplo:

-   Avisar al hilo principal en cada fotograma de que el renderizado ha terminado, pasando estadísticas como los gráficos realmente renderizados, el número de gráficos rechazados, etc.
-   Establecer el estilo del ratón cuando se hace picking del gráfico

```ts
setCursor: (cursor) => {
    self.postMessage({ type: 'cursor', cursor });
},
```

El hilo principal recibe el mensaje y establece el estilo del ratón del lienzo:

```ts
worker.onmessage = function (event) {
    if (event.data.type === 'cursor') {
        mainCanvas.style.cursor = event.data.cursor;
    }
};
```

En cualquier caso, renderizar el lienzo en un WebWorker exige un tratamiento adicional de la comunicación con el hilo principal: los eventos de interacción, los estilos y los componentes de UI tienen que diseñarse con los eventos correspondientes. Supongo que esta es la razón por la que la mayoría de los motores de renderizado 3D para la web solo ofrecen ejemplos o guías sencillos.

## Lectura adicional {#extended-reading}

-   [¿Cómo puedo usar headless-gl con un servicio de integración continua?]
-   [Componentes de Playwright (experimental)]
-   [Canvas Lambda Layer]

[node-canvas]: https://github.com/Automattic/node-canvas
[headless-gl]: https://github.com/stackgl/headless-gl
[jsdom]: https://github.com/jsdom/jsdom
[Lit Testing]: https://lit.dev/docs/tools/testing/
[transformIgnorePatterns]: https://jestjs.io/docs/configuration#transformignorepatterns-arraystring
[problema de d3-color en recharts]: https://github.com/recharts/recharts/commit/bcb199c0d60b79fa09704413ed9a440cc0a7b1c9
[victory-vendor]: https://www.npmjs.com/package/victory-vendor
[Three.js Puppeteer]: https://github.com/mrdoob/three.js/blob/dev/test/e2e/puppeteer.js
[Mover las pruebas de visualización a Playwright]: https://github.com/BabylonJS/Babylon.js/pull/15149
[Registrar dispositivos]: https://github.com/visgl/luma.gl/blob/master/modules/test-utils/src/register-devices.ts#L7
[pixelmatch]: https://github.com/mapbox/pixelmatch
[sharding]: https://playwright.dev/docs/test-sharding
[d3-selector]: https://github.com/d3/d3-selection/blob/main/src/creator.js#L6
[mocha + JSDOM]: https://github.com/observablehq/plot/blob/main/test/jsdom.js
[¿Puedo usar OffscreenCanvas?]: https://caniuse.com/#feat=offscreencanvas
[react-reconciler]: https://www.npmjs.com/package/react-reconciler
[Environment API]: https://github.com/vitejs/vite/discussions/16358
[Transferable]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
[postMessage]: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
[Three.js OffscreenCanvas]: https://threejs.org/examples/webgl_worker_offscreencanvas.html
[Babylon.js OffscreenCanvas]: https://doc.babylonjs.com/features/featuresDeepDive/scene/offscreenCanvas
[transferControlToOffscreen]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen
[bucle de renderizado]: /es/guide/lesson-001#design-the-canvas-api
[sistema de eventos]: /es/guide/lesson-006
[ejemplo de WebWorker]: /example/webworker
[readPixels]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/readPixels
[toMatchWebGLSnapshot.ts]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/toMatchWebGLSnapshot.ts
[toMatchSVGSnapshot.ts]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/toMatchSVGSnapshot.ts
[xmlserializer]: https://www.npmjs.com/package/xmlserializer
[workflows de GitHub - test]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/.github/workflows/test.yml
[¿Cómo puedo usar headless-gl con un servicio de integración continua?]: https://github.com/stackgl/headless-gl?tab=readme-ov-file#how-can-i-use-headless-gl-with-a-continuous-integration-service
[Plugin de arrastrar y soltar]: /es/guide/lesson-006#dragndrop-plugin
[Acción E2E]: https://github.com/xiaoiver/infinite-canvas-tutorial/actions/runs/10282078732
[\_\_tests\_\_]: https://github.com/xiaoiver/infinite-canvas-tutorial/tree/master/__tests__
[Comparaciones visuales]: https://playwright.dev/docs/test-snapshots
[pruebas de Web Components con Playwright]: https://github.com/sand4rt/playwright-ct-web
[Componentes de Playwright (experimental)]: https://playwright.dev/docs/test-components
[Web Components]: /es/guide/lesson-007
[browserstack-local]: https://github.com/browserstack/browserstack-local-nodejs
[Canvas Lambda Layer]: https://github.com/ShivamJoker/Canvas-Lambda-Layer
