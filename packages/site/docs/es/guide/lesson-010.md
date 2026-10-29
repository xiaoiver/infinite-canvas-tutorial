---
outline: deep
description: 'Aprende a exportar el contenido del lienzo a los formatos PNG, JPEG y SVG. Implementa el renderizado de imágenes en el lienzo y amplía las capacidades de SVG con funciones como stroke-alignment para herramientas de diseño más completas.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lección 10 - Importar y exportar imágenes',
          },
      ]
---

<script setup>
import ObjectFit from '../../components/ObjectFit.vue';
</script>

# Lección 10 - Importar y exportar imágenes {#lesson-10-importing-and-exporting-images}

Importar y exportar imágenes es una función muy importante del lienzo infinito y, a través de la imagen exportada, se puede conectar con otras herramientas. Así que, aunque las capacidades de dibujo de nuestro lienzo son limitadas por ahora, conviene pensar con antelación en las cuestiones relacionadas con las imágenes. En esta lección aprenderás lo siguiente:

-   Exportar el contenido del lienzo a PNG, JPEG y SVG, y exportar los efectos basados en el tiempo a GIF
-   Renderizar imágenes en el lienzo, incluido `object-fit` / `object-position` en los rellenos de imagen
-   Ampliar las capacidades de SVG, usando `stroke-alignment` como ejemplo.

## Exportar el contenido del lienzo a una imagen {#export-canvas-to-image}

Primero, veamos cómo exportar el contenido de un lienzo a una imagen. El artículo [Exportar desde Figma] describe cómo exportar un lienzo a varios formatos, incluido PNG, usando la herramienta Slice de Figma.

![exportar desde Figma](https://help.figma.com/hc/article_attachments/24423129974679)

Algunas bibliotecas de gráficos basadas en implementaciones de Canvas2D también ofrecen la posibilidad de guardar el contenido en una imagen. La imagen siguiente es de Highcharts, y puedes ver que también permite exportar imágenes en varios formatos, lo que dispara de inmediato el comportamiento de descarga del navegador al hacer clic:

<img alt="exportador en Highcharts" src="https://user-images.githubusercontent.com/3608471/174998577-df1c54e9-d981-4d82-a4aa-7f0bedfb11a1.png" width="300" />

Queremos implementar la funcionalidad de exportación siguiente:

-   Soporte de varios formatos de imagen: PNG, JPEG y SVG.
-   Soporte para especificar el área de recorte
-   Soporte para elegir si se incluye una cuadrícula o no

Para ello hemos diseñado el exportador de imágenes para usarlo de la forma siguiente:

```ts
const exporter = new ImageExporter({
    canvas,
});

const canvas = await exporter.toCanvas(); // HTMLCanvasElement
const dataURL = canvas.toDataURL(); // data:...

exporter.downloadImage({
    dataURL,
    name: 'my-file',
});
```

Sin embargo, hay una diferencia «leve» según el formato de la imagen; a continuación presentamos primero la forma de exportar imágenes en formato PNG / JPEG.

### Exportar PNG / JPEG {#to-raster-image}

[HTMLCanvasElement.toDataURL()] permite obtener el [DataURI] de la imagen correspondiente al contenido del lienzo. Con el parámetro `type` puedes especificar el formato de la imagen; admite PNG, JPEG y WebP.

```js
var canvas = document.getElementById('canvas');
var dataURL = canvas.toDataURL(); // 默认为 PNG
console.log(dataURL);
// "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNby
// blAAAADElEQVQImWNgoBMAAABpAAFEI8ARAAAAAElFTkSuQmCC"
```

Así que añadimos un método `toCanvas` al exportador de imágenes. Este método sirve para dibujar el contenido del lienzo del área indicada en un HTMLCanvasElement adicional, que después se puede manipular según haga falta, por ejemplo añadiendo un color de fondo, una marca de agua, etc. La firma completa del método está abajo. Conviene señalar que este método es asíncrono, y más adelante explicaremos por qué:

```ts
toCanvas(options: Partial<CanvasOptions> = {}): Promise<HTMLCanvasElement>;

interface CanvasOptions {
  grid: boolean;
  clippingRegion: Rectangle;
  beforeDrawImage: (context: CanvasRenderingContext2D) => void;
  afterDrawImage: (context: CanvasRenderingContext2D) => void;
}
```

El significado de cada elemento de configuración es el siguiente:

-   `grid` Si se incluye una cuadrícula
-   `clippingRegion` La región de recorte del lienzo, representada por un rectángulo.
-   `beforeDrawImage` Se llama antes de dibujar el contenido del lienzo; sirve para dibujar el color de fondo.
-   `afterDrawImage` Se llama después de dibujar el contenido del lienzo; sirve para dibujar marcas de agua.

El ejemplo de uso completo es el siguiente:

```ts
const canvas = await exporter.toCanvas({
    clippingRegion: new Rectangle(
        clippingRegionX,
        clippingRegionY,
        clippingRegionWidth,
        clippingRegionHeight,
    ),
    beforeDrawImage: (context) => {
        // Customize background-color
        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, clippingRegionWidth, clippingRegionHeight);
    },
    afterDrawImage: (context) => {
        // Watermark
        context.font = '24px Times New Roman';
        context.fillStyle = '#FFC82C';
        context.fillText('Watermark', 20, 20);
    },
});
```

Hemos colocado el menú desplegable Exportar imagen en la esquina superior derecha del lienzo; si te interesan los componentes, puedes consultar [Web UI con Lit y Shoelace].

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

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
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;
            const circle = new Circle({
                cx: Math.random() * 600,
                cy: Math.random() * 400,
                r: Math.random() * 40,
                fill,
            });
            canvas.appendChild(circle);

            circle.addEventListener('pointerenter', () => {
                circle.fill = 'red';
            });
            circle.addEventListener('pointerleave', () => {
                circle.fill = fill;
            });
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

Ahora respondamos por qué el método `toCanvas` se diseña como asíncrono. Como WebGL / WebGPU usa el mecanismo de doble búfer de [SwapChain], y el valor predeterminado de [preserveDrawingBuffer] es `false` al crear el contexto, tienes que asegurarte de que el renderizado no se haya limpiado (por ejemplo, llamando a `gl.clear()`) cuando se llama a `toDataURL`; si no, obtendrás una imagen en blanco. Añadimos la lógica siguiente al hook `endFrame` de la [Arquitectura basada en complementos] para guardar el contenido del lienzo en cuanto se recibe la orden de exportación, antes de que termine el fotograma actual, por si se limpia cuando llegue el fotograma siguiente, lo que haría que el comportamiento pasara a ser asíncrono.

```ts
hooks.endFrame.tap(() => {
    this.#device.endFrame();

    // capture here since we don't preserve drawing buffer
    if (this.#enableCapture && this.#resolveCapturePromise) {
        const { type, encoderOptions } = this.#captureOptions;
        const dataURL = (
            this.#swapChain.getCanvas() as HTMLCanvasElement
        ).toDataURL(type, encoderOptions);
        this.#resolveCapturePromise(dataURL);
        this.#enableCapture = false;
        this.#captureOptions = undefined;
        this.#resolveCapturePromise = undefined;
    }
});
```

Además, puedes elegir si la imagen exportada incluye la [Cuadrícula]. De momento no usamos las funciones de recorte y de marca de agua para el procesamiento posterior. Como la implementación de una función de «slicing» similar a la de Figma requiere una interacción de selección rectangular, se presentará en una implementación posterior. Ahora volvamos a otro formato de imagen especial.

### Exportar SVG {#to-vector-image}

Las ventajas de los gráficos vectoriales frente a los mapas de bits son:

-   Escalado infinito sin distorsión. Esto significa que se pueden ampliar o reducir de forma indefinida sin perder nitidez, lo que los hace ideales para situaciones en las que se necesitan varias resoluciones.
-   Editabilidad: los SVG son archivos de texto que se pueden editar con cualquier editor de texto, lo que facilita modificar los atributos y el estilo del gráfico.
-   Los SVG son archivos de texto que se pueden editar con cualquier editor de texto, lo que facilita modificar los atributos y los estilos de los gráficos.

Por tanto, las herramientas de diseño deben ofrecer soporte para la conversión a este formato. Para nuestro lienzo infinito, podemos convertir el problema en: **cómo serializar el grafo de escena**, incluidos los atributos de dibujo de cada nodo, las transformaciones, etc. En cuanto al formato de la serialización, además de JSON, como el diseño de las propiedades de dibujo de nuestros gráficos 2D toma mucho de las implementaciones de SVG, es natural exportar a SVG.

Curiosamente, Three.js también ofrece [toJSON] para guardar el estado actual de la escena (incluidos objetos, transformaciones, materiales, etc.) como [JSON-Object-Scene-format-4]. Incluso incluye un [SVGRenderer] para renderizar gráficos 3D lo mejor posible en condiciones limitadas (sin sombreado complejo ni sombras).

#### De Shape a SerializedNode {#shape-to-serialized-node}

Muchas herramientas de pizarra también ofrecen formatos propios de serialización de gráficos, como [Objetos JSON en tldraw] y [Esquema JSON en excalidraw].

Se recorre desde el nodo raíz del grafo de escena y se llama de forma recursiva sobre los elementos hijos. Los atributos como `transform`, con valores de estructura compleja (`position/scale/rotation`), requieren un procesamiento adicional:

```ts
function serializeNode(node: Shape): SerializedNode {
    const [type, attributes] = typeofShape(node);
    const data: SerializedNode = {
        type,
        attributes,
    };
    data.attributes.transform = serializeTransform(node.transform);
    data.children = node.children.map(serializeNode);
    return data;
}
```

Tomemos el Circle siguiente como ejemplo; obtenemos su objeto serializado:

```js eval code=true
serializedCircle = call(() => {
    const { Circle, serializeNode } = Lesson10;
    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
    });
    circle.transform.position.x = 100;
    return serializeNode(circle);
});
```

Se puede importar en el lienzo mediante el método de deserialización; `deserializeNode` crea el gráfico correspondiente según el atributo `type` del nodo serializado y asigna valores a los atributos de dibujo:

```js eval code=false inspector=false
canvas2 = (async () => {
    const { Canvas } = Lesson10;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

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

    return canvas;
})();
```

```js eval code=true
call(async () => {
    const { deserializeNode } = Lesson10;
    const circle = await deserializeNode(serializedCircle);
    canvas2.root.appendChild(circle);
    return canvas2.getDOM();
});
```

Los métodos de serialización y deserialización de todo el lienzo se pueden aplicar simplemente al nodo raíz, pero, por supuesto, los detectores de eventos no se pueden serializar:

```ts
const json = JSON.stringify(serializeNode(canvas.root)); // {}
canvas.root = (await deserializeNode(JSON.parse(json))) as Group;
```

#### De SerializedNode a SVGElement {#serialized-node-to-svgelement}

Llegados a este punto, es fácil convertir el nodo serializado en un [Elemento SVG]. Añadimos el método de utilidad siguiente:

```ts
export function toSVGElement(node: SerializedNode): SVGElement;
```

La mayoría de los atributos, como `fill / stroke / opacity`, son atributos SVG con el mismo nombre, así que se pueden asignar directamente con [setAttribute], pero hay algunos atributos especiales que hay que tratar de una forma especial, por ejemplo:

-   `transform` Usamos el objeto `Transform` de `@pixi/math`, y necesitamos convertir su `position / rotation / scale` a `matrix()`.
-   `transform-origin` corresponde al atributo `pivot` de `transform`.
-   `innerShadow` no tiene la propiedad SVG del mismo nombre; hay que implementarla con un filtro.
-   `outerShadow` Igual que el anterior

El ejemplo siguiente muestra el efecto de un círculo serializado convertido en un `<circle>`, que hay que incrustar en [\<svg\>] para mostrarlo en una página HTML, con las mismas dimensiones que el lienzo:

```js eval code=true
call(() => {
    const { toSVGElement } = Lesson10;

    const $circle = toSVGElement(serializedCircle);
    const $svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    $svg.setAttribute('width', '200');
    $svg.setAttribute('height', '200');
    $svg.appendChild($circle);

    return $svg;
});
```

#### De SVGElement a SerializedNode {#svgelement-to-serialized-node}

Naturalmente, también necesitamos un método de conversión de SVGElement a SerializedNode:

```ts
export function fromSVGElement(element: SVGElement): SerializedNode;
```

Ten en cuenta que esta conversión no es del todo reversible; por ejemplo, en la [implementación de StrokeAlignment](#stroke-alignment-export-svg) que veremos más adelante, un Circle corresponde a dos `<circle>`. Lo mismo ocurre en Figma, donde la imagen siguiente muestra la importación de un efecto de Ellipse exportado antes, y puedes ver que las dos formas no son idénticas.

![importar en Figma una elipse exportada](/import-exported-ellipse.png)

[@pixi-essentials/svg] también quiere convertir SVGElement en formas de Pixi.js; consulta [Renderizado vectorial de contenido SVG con PixiJS].

#### Grafo de escena en SVG {#scene-graph-in-svg}

Otra cosa que hay que tener en cuenta es que, aunque cualquier gráfico de nuestro grafo de escena puede tener nodos hijos, en SVG solo `<g>` puede tener hijos y, por lo demás, por ejemplo, `<circle>` no puede tenerlos. La solución es sencilla: para los elementos que no son Group y tienen hijos, genera el SVG con un `<g>` por fuera y aplica el `transform` que se le habría aplicado. Suponiendo que en el futuro tengamos soporte para renderizar texto, el SVG de un Circle con hijos de texto se vería así:

```html
<g transform="matrix(1,0,0,0,1,0)">
    <circle cx="100" cy="100" r="100" fill="red" />
    <text />
</g>
```

#### Exportar inner y outerShadow {#export-inner-outer-shadow}

Tomando como referencia [Añadir sombras a iconos SVG con CSS y filtros SVG], usamos una [primitiva de filtro] para realizar sombras interiores y exteriores. Ejemplo de sombras exteriores:

```ts
const $feDropShadow = createSVGElement('feDropShadow', doc);
$feDropShadow.setAttribute('dx', `${(dropShadowOffsetX || 0) / 2}`);
$feDropShadow.setAttribute('dy', `${(dropShadowOffsetY || 0) / 2}`);
$feDropShadow.setAttribute(
    'stdDeviation',
    `${(dropShadowBlurRadius || 0) / 4}`,
);
$feDropShadow.setAttribute('flood-color', dropShadowColor);
$filter.appendChild($feDropShadow);
```

Las sombras interiores son un poco más complicadas, así que no lo desarrollaré aquí por cuestiones de espacio. Puedes descargar el SVG para verlo en el ejemplo siguiente:

```js eval code=false
$icCanvas4 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas4.parentElement.style.position = 'relative';
    $icCanvas4.parentElement.appendChild($stats);

    $icCanvas4.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const rect = new Rect({
            x: 50,
            y: 50,
            fill: 'green',
            cornerRadius: 50,
            batchable: false,
            innerShadowColor: 'black',
            innerShadowOffsetX: 10,
            innerShadowOffsetY: 10,
            innerShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            dropShadowBlurRadius: 10,
        });
        rect.width = 400;
        rect.height = 100;
        canvas.appendChild(rect);
    });

    $icCanvas4.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

#### Exportar la imagen como valor de fill {#export-image-as-fill-value}

Aunque todavía no hemos cubierto la implementación de la imagen de relleno, serializar directamente el valor Image de la propiedad `fill` daría el resultado siguiente:

```html
<circle fill="[object ImageBitmap]" />
```

Esto, evidentemente, no se mostrará bien; necesitamos serializar el objeto Image a un DataURL: basta con dibujar la imagen en un `<canvas>` y usar el método `toDataURL` que presentamos en la sección anterior. Tomando como referencia [Convertir ImageBitmap en Blob], primero probé [ImageBitmapRenderingContext]. ImageBitmap puede decodificar la imagen de forma asíncrona sin bloquear el hilo principal, lo que ayuda a mejorar el rendimiento y la capacidad de respuesta de la aplicación.

```ts
async function imageBitmapToURL(bmp: ImageBitmap) {
    const canvas = document.createElement('canvas');
    // resize it to the size of our ImageBitmap
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    // get a bitmaprenderer context
    const ctx = canvas.getContext('bitmaprenderer');
    ctx.transferFromImageBitmap(bmp);
    const blob = await new Promise<Blob>((res) => canvas.toBlob(res));
    return canvas.toDataURL();
}
```

Por desgracia obtenemos el error siguiente. El motivo es que ya hemos creado una textura con este ImageBitmap y no podemos transferir su control al nuevo `<canvas>`.

> [!CAUTION]
> El ImageBitmap de entrada se ha desvinculado

Así que solo podemos usar el método habitual `drawImage` para dibujar la imagen en el `<canvas>`.

#### Exportación de pintura ECS y geometría rough {#ecs-export-paints}

El exportador ECS lee la primera capa habilitada de `fills` y `strokes`. Un relleno `image` se estira hasta los límites de la forma. Una capa `pattern`, en cambio, incrusta la imagen decodificada en sus dimensiones naturales y conserva `repeat`, `repeat-x`, `repeat-y` o `no-repeat`. Su `<pattern>` de SVG usa coordenadas locales, y la transformación del nodo se aplica una sola vez al grupo que lo envuelve. Las definiciones de patrón tienen identificadores distintos cuando los nodos necesitan extensiones de repetición diferentes.

```ts
const elements = await serializeNodesToSVGElements([
    {
        id: 'tile',
        type: 'rect',
        zIndex: 0,
        x: 40,
        y: 30,
        width: 200,
        height: 100,
        fills: [
            { type: 'pattern', value: imageDataURL, repetition: 'repeat-x' },
        ],
    },
]);
```

La decodificación de imágenes es asíncrona. Espera a `serializeNodesToSVGElements`, o a `exportFillGradientOrPattern` / `exportStrokeGradientOrPattern` cuando uses esos ayudantes de nivel inferior directamente. Si falla la decodificación de una imagen, la exportación se rechaza. Los rellenos de degradado, imagen y patrón del texto conservan sus definiciones junto al elemento `<text>`, de modo que escribir su contenido no elimina sus recursos de pintura.

Las formas rough exportan la geometría local como trazados SVG. La opacidad del grupo, la opacidad de la capa de relleno y la opacidad de la capa de trazo siguen siendo independientes, incluida la opacidad cero. Los trazos de hachure usan `roughFillWeight` (la mitad del ancho del contorno cuando se omite o es `-1`). Las elipses obtienen su centro local y sus radios a partir de `width` y `height`. Volver a importar estos trazados SVG conserva la geometría renderizada, pero no restaura los parámetros rough editables. La importación de patrones no está cubierta por este soporte de exportación.

Para quien necesite un resultado de Canvas2D, `API.renderToCanvas(node, { width, height })` dibuja ese nodo y sus hijos en un solo canvas. Admite rellenos y trazos sólidos en rectángulos, elipses, trazados, polilíneas y líneas, además de rectángulos rellenos con imagen. Cada forma empieza su propio trazado; los comandos de trazado SVG, incluidos los arcos, y la regla de relleno `evenodd` se convierten para Canvas2D. Se conservan las posiciones locales, las esquinas redondeadas y la opacidad del nodo y de la capa. Las imágenes hijas terminan de decodificarse antes de dibujar el hermano siguiente, así que su orden se mantiene estable. El método se rechaza si una imagen no se puede decodificar, y deja el canvas proporcionado listo para otro dibujo.

#### Cuadrícula en SVG {#export-grid}

Por último, veamos cómo implementar una cuadrícula con SVG. Tomando como referencia [Cómo dibujar una cuadrícula con HTML5 y canvas o SVG], usamos el mosaico de `<pattern>`: para la cuadrícula de líneas usamos dos grupos, uno grande y uno pequeño; para la cuadrícula de puntos colocamos un círculo en cada una de las cuatro esquinas de la «tesela»:

<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="small-grid" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(221,221,221,1)" stroke-width="1"/>
    </pattern>
    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#small-grid)"/>
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(221,221,221,1)" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
</svg>

<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <circle id="dot-tl" cx="0" cy="0" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-br" cx="20" cy="20" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-bl" cx="0" cy="20" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-tr" cx="20" cy="0" r="2" fill="rgba(221,221,221,1)" />
  </defs>
  <pattern id="dots-grid" patternUnits="userSpaceOnUse" width="20" height="20">
    <use xlink:href="#dot-tl" />
    <use xlink:href="#dot-tr" />
    <use xlink:href="#dot-bl" />
    <use xlink:href="#dot-br" />
  </pattern>
  <rect width="100%" height="100%" fill="url(#dots-grid)" />
</svg>

Otra implementación interesante es mediante el `stroke-dasharray` de `<line>`, que usa menos elementos SVG que el `<circle>` repetido de forma masiva; consulta [Cuadrícula de puntos con pattern].

Después se añade un juicio en la lógica de dibujo de la cuadrícula: se mantiene igual en el modo que no es de captura de pantalla, y en el modo de captura de pantalla solo se dibuja cuando la opción de incluir la cuadrícula está activada:

```ts
hooks.beginFrame.tap(() => {
    if (
        !this.#enableCapture ||
        (this.#enableCapture && this.#captureOptions.grid)
    ) {
        this.#grid.render(this.#device, this.#renderPass, this.#uniformBuffer);
    }
});
```

#### Reflejar los parámetros de la cámara con viewBox {#use-viewbox}

Podemos colocar el ancho y el alto del lienzo en el elemento `<svg>`, pero ¿cómo deben reflejarse en el elemento SVG resultante los parámetros de transformación de la cámara, como la traslación `x/y` y el `zoom` (todavía no admitimos la exportación de la rotación de la cámara)?

Aquí puedes usar [viewBox]:

```ts
const { x, y, rotation, zoom } = cameras[0].read(ComputedCamera);
$namespace.setAttribute(
    'viewBox',
    `${x} ${y} ${width / zoom} ${height / zoom}`,
);
```

#### Optimizador de SVG {#svg-optimizer}

Si observas con atención los productos SVG actuales, verás que hay algunos atributos redundantes, como `opacity=“1”`, que es un valor predeterminado y no necesita estar presente de forma explícita en el producto. De hecho, esta es una de las herramientas que usan los optimizadores de SVG como [svgo]:

> Los archivos SVG, sobre todo los exportados desde editores vectoriales, suelen contener mucha información redundante. Esto incluye metadatos del editor, comentarios, elementos ocultos, **valores predeterminados o subóptimos** y otras cosas que se pueden eliminar o convertir con seguridad sin afectar al renderizado.

Así que necesitamos mantener un conjunto de tablas de correspondencia para los valores predeterminados de los atributos y, si el valor del atributo resulta ser igual al valor predeterminado, no hace falta llamar a `setAttribute` para asignarlo:

```ts
const defaultValues = {
    opacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
    fill: 'black',
    stroke: 'none',
};

Object.entries(rest).forEach(([key, value]) => {
    if (`${value}` !== '' && `${defaultValues[key]}` !== `${value}`) {
        element.setAttribute(camelToKebabCase(key), `${value}`);
    }
});
```

#### [WIP] Fuente web incrustada {#inlined-web-font}

Al exportar a SVG, si se usan fuentes web, buscamos incrustarlas dentro del archivo. Naturalmente, por las restricciones de tamaño de los archivos de fuentes, hace falta cierto recorte bajo demanda durante la ejecución. Abajo está el flujo de procesamiento de Excalidraw, detallado en [Subconjunto de fuentes en excalidraw].

![fuente: https://link.excalidraw.com/readonly/MbbnWPSWXgadXdtmzgeO](https://github.com/user-attachments/assets/e255df0a-13de-4cb6-ae2e-9e885b643c63)

### Exportar GIF {#to-gif}

En una [Lección 30 - Animación basada en el tiempo] posterior tratamos efectos impulsados por el posprocesado y un uniform de tiempo. Para **exportar** ese movimiento necesitas formatos como GIF o WebM; aquí esbozamos el primero.

1. La ruta de renderizado debe aceptar el **índice de fotograma** actual (o el tiempo del motor) para que cada paso muestre el momento correcto del efecto.
2. **Capturar el lienzo como imagen ráster**, por ejemplo PNG: la sección anterior ya lo cubrió.
3. **Leer los píxeles y cuantizarlos** a una paleta (por ejemplo, 256 colores por fotograma). Si puedes aceptar una pequeña pérdida de calidad, 128 o 64 colores suelen reducir mucho el archivo; los degradados y el contenido fotográfico mostrarán más bandas o ruido.
4. **Paletas por fotograma:** el enfoque directo es un `quantize` por fotograma y una `palette` por `writeFrame`, lo que funciona bien para una UI plana. Para bucles cortos con pocos cambios entre fotogramas, una **única paleta global** o **menos fotogramas clave** pueden ahorrar más espacio, con un coste de implementación notablemente mayor.

```ts
import { GIFEncoder, applyPalette, quantize } from 'gifenc';

const gif = GIFEncoder();
for (let i = 0; i < frameCount; i++) {
    renderFrame(i); // (1) drive time / frame
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const dataUrl = el.toDataURL('image/png', pngQuality); // (2) raster snapshot
    const imageData = await imageDataFromPngDataUrl(dataUrl, w, h, ctx!);
    const palette = quantize(imageData.data, 256); // (3) build palette
    const index = applyPalette(imageData.data, palette); // (4) map to indices
    gif.writeFrame(index, w, h, { palette, delay });
}
gif.finish();
return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' });
```

ECS espera una retrollamada de fotograma del navegador después de renderizar cada fotograma antes de leer su instantánea PNG, y exige un tamaño de lienzo fijo durante todas las exportaciones GIF y WebM. Un lienzo vacío, un cambio de tamaño, un error de decodificación PNG o una excepción de dibujo rechazan la exportación, en lugar de devolver un archivo vacío o una animación parcial. Los lienzos temporales se liberan tanto si hay éxito como si hay fallo. WebM también detiene la grabadora y cada pista de captura, cancela las retrollamadas de fotograma pendientes y desconecta los manejadores de imagen para que una exportación fallida se pueda reintentar. El lienzo de origen de quien llama sigue disponible.

Las marcas de tiempo de WebM siguen el reloj de captura en tiempo real de `MediaRecorder`. Los FPS elegidos hacen avanzar el tiempo del efecto, pero no garantizan una tasa de fotogramas ni una duración exactas de WebM. GIF escribe retardos por fotograma, almacenados en unidades de 10 milisegundos; los navegadores también pueden limitar las duraciones de visualización cortas.

### Exportar PDF {#to-pdf}

Ahora que los píxeles y los vectores están disponibles, si aún quieres exportar a PDF puedes usar [jsPDF], que ofrece una API para añadir imágenes y que no trataré aquí por falta de espacio.

Veamos otro tema: cómo renderizar una imagen en el lienzo.

## Renderizar imagen {#render-image}

En WebGL / WebGPU a menudo hace falta cargar imágenes y usarlas como texturas. Como cargar distintos tipos de recursos es un proceso asíncrono complejo, la mayoría de los motores de renderizado ofrecen un cargador de recursos. A menudo también hay soporte para otros tipos de datos, además de los distintos tipos de imágenes, como audio, JSON, glTF, etc. Abajo hay un ejemplo de cómo se usa [PIXI Assets]:

```ts
import { Sprite, Assets } from 'pixi.js';
// load the texture we need
const texture = await Assets.load('bunny.png');

// This creates a texture from a 'bunny.png' image
const bunny = new Sprite(texture);
```

¿Cómo implementas un cargador de recursos?

### Cargador de imágenes {#image-loader}

[loaders.gl] ofrece una gama de loaders para distintos tipos de recursos, como:

-   JSON, CSV, GeoJSON, GeoTiles, etc., habituales en aplicaciones de visualización.
-   Formatos de modelos 3D como glTF
-   Varios formatos de textura comprimida, que se cargan y se analizan en un WebWorker mediante [CompressedTextureLoader].

Estos loaders aportan una gran comodidad al desarrollo de aplicaciones de nivel superior; podemos usar directamente [ImageLoader], que admite estos formatos de imagen: PNG, JPEG, GIF, WEBP, AVIF, BMP, SVG, y similares. `@loaders.gl/core` garantiza la uniformidad de las llamadas a la API y la extensibilidad para distintos tipos de loaders:

```ts
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';

const image = await load(url, ImageLoader, options);
```

Además de asignar el atributo `fill` directamente, también necesitas restaurar el DataURL a un objeto Image durante la deserialización:

```ts
async function deserializeNode(data: SerializedNode) {
    // data:image/png:base64...
    if (fill && isString(fill) && isDataUrl(fill)) {
        shape.fill = (await load(fill, ImageLoader)) as ImageBitmap;
    }
}
```

### Diseño de la API {#image-api}

Volviendo al diseño de nuestra API, por supuesto podemos añadir un gráfico nuevo para la imagen, tomando como modelo Circle / Ellipse / Rect, que corresponde a [\<image\>] en SVG:

```ts
const image = new Image({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    src: 'data:image...',
});
```

Pero, si lo piensas, un Image debería tener todas las capacidades de un Rect, como trazos, esquinas redondeadas, sombras, etc. Curiosamente, en Figma, si elegimos insertar una imagen de 1920 \* 1920 en el lienzo y exportarla como SVG, obtenemos un elemento `<rect>` con la estructura siguiente (se omiten algunos valores de atributos), y el atributo `fill` referencia un [\<pattern\>], que usa de forma indirecta el relleno en mosaico de la imagen:

```html
<svg>
    <rect width="500" height="500" fill="url(#pattern0_2442_3)" />
    <defs>
        <pattern id="pattern0_2442_3">
            <use xlink:href="#image0_2442_3"
            <!-- 0.000520833 = 1 / 1920 -->
            transform="matrix(0.000520833 0 0 0.000527058 0 -0.0059761)" />
        </pattern>
        <image
            id="image0_2442_3"
            width="1920"
            height="1920"
            xlink:href="data:image/png;base64,iVBO..."
        />
    </defs>
</svg>
```

Esto nos da una idea: las imágenes no necesitan existir como formas separadas, siempre que el atributo `fill` de otras formas admita la correspondencia, de modo que Circle / Rect, etc. puedan usar imágenes como relleno. Imagina que necesitamos implementar un icono circular con trazo: el diseño original exigiría un gráfico Image con algo como [\<clipPath\>], pero ahora basta con rellenar el gráfico Circle existente con una imagen:

```ts
circle.fill = image;
circle.stroke = 'black';
```

### Implementación {#implementation}

Así que, como primer paso, ampliamos los tipos que admite `fill`, de cadenas de color a más fuentes de textura:

```ts
export interface IRenderable {
    fill: string; // [!code --]
    fill: string | TexImageSource; // [!code ++]
}

type TexImageSource =
    | ImageBitmap
    | ImageData
    | HTMLImageElement
    | HTMLCanvasElement
    | HTMLVideoElement
    | OffscreenCanvas
    | VideoFrame;
```

Hace falta un campo en los datos de vértices para indicar si se usa una textura y, si es así, muestrearla. `SAMPLER_2D()` no es la sintaxis GLSL estándar, sino nuestro marcado personalizado para sustituirlo, en la fase de compilación del shader, por la sintaxis de muestreo de GLSL100 / GLSL300 / WGSL. Además, las texturas son por ahora imágenes cargadas, y más adelante se admitirán los degradados creados con la API de Canvas2D, como [createLinearGradient]:

```glsl
// vert
out vec2 v_Uv;
v_Uv = (a_FragCoord * radius / size + 1.0) / 2.0;

// frag
in vec2 v_Uv;
uniform sampler2D u_Texture;

if (useFillImage) {
    fillColor = texture(SAMPLER_2D(u_Texture), v_Uv);
}
```

El uso de `uniform` rompe nuestra lógica anterior de renderizado por lotes. El artículo [Dentro de PixiJS: el sistema de renderizado por lotes] describe la lógica de la implementación de BatchRenderer de Pixi.js y, como puedes ver en la plantilla de shader compilada en tiempo de ejecución de abajo, el número máximo de samplers que se pueden admitir a la vez es un conjunto de `%count%` samplers, y cada instancia elige uno de ese conjunto mediante el dato de vértice `aTextureId`.

```glsl
// Shader template in Pixi.js BatchRenderer
// vert
attribute int aTextureId;
varying int vTextureId;
vTextureId = aTextureId;

// frag
uniform sampler2D uSamplers[%count%];
varying int vTextureId;
```

Para simplificar, simplifiquemos la lógica de fusión de la forma siguiente:

1. Un `fill` con una cadena de color no se puede combinar con un Image.
2. Un `fill` con un valor de Image distinto no se puede combinar.

Así, los tres círculos siguientes se dibujarán en el mismo lote.

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    $icCanvas3.addEventListener('ic-ready', async (e) => {
        const image = await Utils.loadImage('/canvas.png');

        const canvas = e.detail;

        const circle1 = new Circle({
            cx: 200,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle1);

        const circle2 = new Circle({
            cx: 320,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
        });
        canvas.appendChild(circle2);

        const circle3 = new Circle({
            cx: 460,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'outer',
        });
        canvas.appendChild(circle3);
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### Caché de renderizado {#render-cache}

Antes no habíamos considerado cachear objetos de la GPU como Program, Bindings, Sampler, etc. Por eso añadimos un gestor de caché de recursos para permitir la reutilización, e implementamos la lógica de acierto según el tipo de recurso. Tomemos Sampler como ejemplo: si las propiedades de `SamplerDescriptor` son idénticas, hay acierto en la caché, y la lógica de comparación está en `samplerDescriptorEquals`.

```ts
import { samplerDescriptorEquals } from '@antv/g-device-api';

export class RenderCache {
    device: Device;
    private samplerCache = new HashMap<SamplerDescriptor, Sampler>(
        samplerDescriptorEquals,
        nullHashFunc,
    );

    createSampler(descriptor: SamplerDescriptor): Sampler {
        // 优先从缓存中取
        let sampler = this.samplerCache.get(descriptor);
        if (sampler === null) {
            // 未命中，创建并添加缓存
            sampler = this.device.createSampler(descriptor);
            this.samplerCache.add(descriptor, sampler);
        }
        return sampler;
    }
}
```

### Object fit (object-fit) {#object-fit}

La geometría de un rectángulo a menudo no coincide con la relación de aspecto intrínseca de la imagen. Dibujar en todas partes con `drawImage(0, 0, width, height)` estira iconos y fotos. Las herramientas de diseño suelen ofrecer modos de ajuste / relleno / recorte; seguimos los CSS [object-fit] y [object-position] en las entradas de `FillLayers` con `type: 'image'`:

```ts
fills: [
    {
        type: 'image',
        value: '/canvas.png',
        objectFit: 'contain',
        objectPosition: 'top left',
    },
];
```

| `objectFit`           | Comportamiento                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `fill`                | Estira hasta llenar la geometría (**predeterminado**, igual que el comportamiento ráster inicial) |
| `contain`             | Escala de forma uniforme; muestra la imagen completa; pueden aparecer bandas                   |
| `cover`               | Escala de forma uniforme; llena la geometría; recorta el sobrante                               |
| `none` / `scale-down` | La misma semántica que en CSS                                                                   |

Consulta el [Ejemplo de object-fit](/example/object-fit) para ver cómo esto se corresponde con el escalado de imagen de Figma y con el `mode` de Pencil (`stretch` / `fill` / `fit`).

En la CPU rasterizamos la imagen en una textura: calculamos el rectángulo de dibujo a partir de `objectFit` y pintamos en un canvas. Para `contain` / `cover`, el tamaño de la textura es **geometría × device pixel ratio**, no `max(source width, geometry width)`; si no, la imagen completa llena el mapa de bits y, al mapearla a la forma, sigue pareciendo un `fill` estirado.

<ObjectFit />

### Live Photo de iOS {#ios-live-photo}

A nivel de archivo, un Live Photo de iOS suele ser una imagen fija HEIC más un MOV acompañante. El soporte nativo de HEIC varía entre navegadores; el cargador de imágenes de ECS usa heic-to para ofrecer una ruta de conversión.

Buscamos tratarlo como una imagen normal: decodificar un único fotograma fijo a un mapa de bits y después subirlo a una textura. Reproducir el vídeo incrustado del Live Photo en el lienzo sería un paso posterior, con un componente dedicado (por ejemplo, tocar para reproducir) construido aparte.

`loadImageBitmapUniversal` acepta una URL, un Blob o un File. Reconoce HEIC/HEIF a partir del MIME, la extensión del archivo o la firma del archivo, y carga heic-to solo cuando hace falta, de modo que las importaciones de módulos sigan siendo seguras durante el SSR. Convierte el primer fotograma fijo a PNG, con un reintento en JPEG si falla la conversión o la decodificación del mapa de bits. Las imágenes que no son HEIC siguen por loaders.gl.

Los errores HTTP se rechazan antes de la conversión. Si una imagen ordinaria no se puede decodificar y la sonda diagnóstica de HEIC también falla, se conserva el error original. Cada llamada puede reintentarse de forma independiente; un mapa de bits devuelto pertenece a quien llama y debe cerrarse después de usarlo. Una object URL de entrada también sigue siendo propiedad de quien llama.

```ts
import { loadImageBitmapUniversal } from '@infinite-canvas-tutorial/ecs';

async function drawStill(
    context: CanvasRenderingContext2D,
    source: string | Blob,
) {
    const bitmap = await loadImageBitmapUniversal(source);
    try {
        context.drawImage(bitmap, 0, 0);
    } finally {
        bitmap.close?.();
    }
}
```

El decodificador usa heic-to 1.6.6 (libheif 1.23.6), y corrige el desplazamiento de color y la transparencia perdida del decodificador anterior en las muestras SDR de rango completo. Las regresiones del navegador se comparan con los colores de origen y cubren los niveles de gris, la transparencia PNG, el primer fotograma fijo de un contenedor de varias imágenes, la decodificación concurrente y la recuperación tras una entrada corrupta. El respaldo JPEG sigue teniendo pérdidas y no puede conservar el alfa. Estas comprobaciones no cubren perfiles ICC arbitrarios, color de gama amplia, HDR ni la reproducción de vídeo de Live Photo.

## SVG mejorado: alineación del trazo {#stroke-alignment}

Por último, presentemos un tema interesante. Podemos implementar funciones que la especificación de SVG no admite actualmente.

Empecemos por la diferencia entre `opacity`, `stroke-opacity` y `fill-opacity` en SVG. El círculo de la izquierda tiene `opacity=“0.5”` y el círculo de la derecha tiene `fill-opacity=“0.5” stroke-opacity=“0.5”`. Puedes ver que el trazo queda mitad dentro del círculo y mitad fuera:

<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="red" stroke="black" stroke-width="20" opacity="0.5" />
  <circle cx="150" cy="50" r="40" fill="red" stroke="black" stroke-width="20" fill-opacity="0.5" stroke-opacity="0.5" />
</svg>

La posición de Stroke correspondiente en Figma es `Center`, y otras opciones incluyen `Inside` y `Outside`, cada una de las cuales se muestra abajo. En SVG esto se llama `stroke-alignment`, pero actualmente está en forma de borrador; consulta [Especificar la alineación del trazo]. Pixi.js también ofrece [PIXI.LineStyle alignment] en modo WebGL.

![Alineación del trazo en Figma](/figma-stroke-align.png)

Añadimos la propiedad `strokeAlignment` a todas las formas:

```ts
export interface IRenderable {
    strokeAlignment: 'center' | 'inner' | 'outer'; // [!code ++]
}
```

### Alineación del trazo en el shader {#stroke-alignment-rendering}

La implementación en la sección del shader solo necesita distinguir estos tres valores y mezclar los colores de relleno y de trazo de formas distintas:

```glsl
if (strokeAlignment < 0.5) { // center
    d1 = distance + strokeWidth;
    d2 = distance + strokeWidth / 2.0;
    color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
    color = mix_border_inside(strokeColor, color, d2);
} else if (strokeAlignment < 1.5) { // inner
    d1 = distance + strokeWidth;
    d2 = distance;
    color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
    color = mix_border_inside(strokeColor, color, d2);
} else if (strokeAlignment < 2.5) { // outer
    d2 = distance + strokeWidth;
    color = mix_border_inside(strokeColor, color, d2); // No need to use fillColor at all
}
```

Aquí está nuestra implementación; puedes ver que el renderizado coincide con Figma:

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

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

        const circle1 = new Circle({
            cx: 200,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle1);

        const circle2 = new Circle({
            cx: 320,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
        });
        canvas.appendChild(circle2);

        const circle3 = new Circle({
            cx: 460,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'outer',
        });
        canvas.appendChild(circle3);
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

Esta propiedad también hay que tenerla en cuenta al calcular la caja delimitadora de renderizado y la determinación del picking. La función de abajo refleja cuánto debe extenderse el trazo hacia fuera del propio gráfico para los distintos valores.

```ts
function strokeOffset(
    strokeAlignment: 'center' | 'inner' | 'outer',
    strokeWidth: number,
) {
    if (strokeAlignment === 'center') {
        return strokeWidth / 2;
    } else if (strokeAlignment === 'inner') {
        return 0;
    } else if (strokeAlignment === 'outer') {
        return strokeWidth;
    }
}
```

### Exportar SVG {#stroke-alignment-export-svg}

Como se mencionó antes, SVG no admite actualmente `stroke-alignment`, así que de momento solo se puede simular con un apaño. Si el dibujo es sencillo, es posible dibujar el relleno y el trazo en dos pasadas. Aquí está la exportación de Figma de `stroke-alignment: 'inner'`, que también usa este enfoque:

```html
<circle cx="200" cy="200" r="200" fill="#F67676" />
<circle
    cx="200"
    cy="200"
    r="160"
    stroke="black"
    stroke-opacity="0.5"
    stroke-width="100"
/>
```

<div style="display:flex;justify-content:center;align-items:center;">
    <svg width="100" height="100" viewBox="0 0 443 443" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="221.5" cy="221.5" r="221.5" fill="#F67676"/>
    <circle cx="221.5" cy="221.5" r="171.5" stroke="black" stroke-opacity="0.5" stroke-width="100"/>
    </svg>
    <svg width="120" height="120" viewBox="0 0 643 643" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="321.5" cy="321.5" r="221.5" fill="#F67676"/>
    <circle cx="321.5" cy="321.5" r="271.5" stroke="black" stroke-opacity="0.5" stroke-width="100"/>
    </svg>
</div>

Además de esto, la documentación de Figma en [StrokeAlign en el widget de Figma] da otra idea, que no requiere crear dos elementos parecidos. [Cómo simular stroke-align (stroke-alignment) en SVG] prueba esta idea ampliando el ancho del trazo al doble de su ancho original y eliminando el exceso con clipPath y mask:

> El trazo interior y el exterior se implementan en realidad duplicando el grosor del trazo y enmascarando el trazo con el relleno. Esto significa que el trazo alineado al interior nunca dibujará trazos fuera del relleno y el trazo alineado al exterior nunca dibujará trazos dentro del relleno.

Por simplicidad de implementación, elegimos el primer enfoque: crear dos elementos parecidos para dibujar el relleno y el trazo respectivamente, y se puede probar a exportar el SVG en el ejemplo de arriba.

Con la riqueza de la funcionalidad del lienzo, hace falta introducir pruebas para comprobar que la funcionalidad de importación y exportación funciona correctamente, que el renderizado es correcto y que los componentes de UI son interactivos. Lo presentaremos en la sección siguiente.

## Lectura adicional {#extended-reading}

-   [Exportar desde Figma]
-   [Especificar la alineación del trazo]
-   [Cómo simular stroke-align (stroke-alignment) en SVG]
-   [Renderizado vectorial de contenido SVG con PixiJS]

[Exportar desde Figma]: https://help.figma.com/hc/en-us/articles/360040028114-Export-from-Figma#h_01GWB002EPWMFSXKAEC62GS605
[Cómo simular stroke-align (stroke-alignment) en SVG]: https://stackoverflow.com/questions/74958705/how-to-simulate-stroke-align-stroke-alignment-in-svg
[HTMLCanvasElement.toDataURL()]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
[preserveDrawingBuffer]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext#preservedrawingbuffer
[DataURI]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
[SwapChain]: /es/guide/lesson-001#swapchain
[Web UI con Lit y Shoelace]: /es/guide/lesson-007
[Arquitectura basada en complementos]: /es/guide/lesson-001#plugin-based-architecture
[SVGRenderer]: https://threejs.org/docs/#examples/en/renderers/SVGRenderer
[toJSON]: https://threejs.org/docs/#api/en/core/Object3D.toJSON
[JSON-Object-Scene-format-4]: https://github.com/mrdoob/three.js/wiki/JSON-Object-Scene-format-4
[Cuadrícula]: /es/guide/lesson-005
[Elemento SVG]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element
[\<svg\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/svg
[setAttribute]: https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute
[jsPDF]: https://github.com/parallax/jsPDF
[loaders.gl]: https://github.com/visgl/loaders.gl
[ImageLoader]: https://loaders.gl/docs/modules/images/api-reference/image-loader
[CompressedTextureLoader]: https://loaders.gl/docs/modules/textures/api-reference/compressed-texture-loader
[PIXI Assets]: https://pixijs.download/release/docs/assets.html
[Especificar la alineación del trazo]: https://www.w3.org/TR/svg-strokes/#SpecifyingStrokeAlignment
[StrokeAlign en el widget de Figma]: https://www.figma.com/widget-docs/api/component-SVG/#strokealign
[Cómo dibujar una cuadrícula con HTML5 y canvas o SVG]: https://stackoverflow.com/questions/14208673/how-to-draw-grid-using-html5-and-canvas-or-svg
[Convertir ImageBitmap en Blob]: https://stackoverflow.com/questions/52959839/convert-imagebitmap-to-blob
[ImageBitmapRenderingContext]: https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmapRenderingContext
[@pixi-essentials/svg]: https://github.com/ShukantPal/pixi-essentials/tree/master/packages/svg
[Renderizado vectorial de contenido SVG con PixiJS]: https://medium.com/javascript-in-plain-english/vector-rendering-of-svg-content-with-pixijs-6f26c91f09ee
[svgo]: https://github.com/svg/svgo
[Cuadrícula de puntos con pattern]: https://www.smashingmagazine.com/2024/09/svg-coding-examples-recipes-writing-vectors-by-hand/#dot-grid-with-pattern
[Añadir sombras a iconos SVG con CSS y filtros SVG]: https://css-tricks.com/adding-shadows-to-svg-icons-with-css-and-svg-filters/
[primitiva de filtro]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element#filter_primitive_elements
[Objetos JSON en tldraw]: https://tldraw.dev/docs/shapes#The-shape-object
[Esquema JSON en excalidraw]: https://docs.excalidraw.com/docs/codebase/json-schema
[viewBox]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox
[Subconjunto de fuentes en excalidraw]: https://github.com/excalidraw/excalidraw/issues/1972#issuecomment-2417744618
[Lección 30 - Animación basada en el tiempo]: /es/guide/lesson-030#time-animation
