---
outline: deep
description: 'Implementa el menú contextual y el portapapeles. Ajusta el z-index con traer adelante y enviar atrás. Escribe y lee el contenido del portapapeles, y admite pegar gráficos serializados, imágenes no vectoriales, SVG y texto sin formato. Importa archivos de imagen arrastrándolos desde el sistema de archivos y desde páginas.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lección 24 - Menú contextual y portapapeles',
          },
      ]
---

<script setup>
import ZIndex from '../../components/ZIndex.vue';
import DragNDropImage from '../../components/DragNDropImage.vue';
</script>

# Lección 24 - Menú contextual y portapapeles {#lesson-24-context-menu-and-clipboard}

En esta lección presentaremos los contenidos siguientes:

-   Cómo implementar el menú contextual
-   Ajustar el z-index con traer adelante y enviar atrás
-   Escribir y leer el contenido del portapapeles, y admitir pegar gráficos serializados, imágenes no vectoriales, SVG y texto sin formato
-   Importar archivos de imagen arrastrándolos desde el sistema de archivos y desde páginas

<img src="/context-menu.png" alt="menú contextual" style="max-width: 300px;"/>

## Implementar el menú contextual {#context-menu}

Los menús contextuales suelen abrirse con el clic derecho o con una pulsación larga. Los navegadores implementan de forma predeterminada el contenido del menú; por ejemplo, al abrirlo sobre `<canvas>` aparecen «Guardar como» y otras opciones.
Por tanto, el primer paso es escuchar el evento [contextmenu] e impedir el comportamiento predeterminado del navegador. Referencia: [radix - Menú contextual].

```ts
private handleContextMenu = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // ...show Overlay
};

this.api.element.addEventListener('contextmenu', this.handleContextMenu);
```

A continuación hay que mostrar el componente de interfaz del menú en la posición indicada. En [Lección 18 - Implementar la interfaz con Spectrum] usamos la API imperativa de Overlay, combinada con [Usar un disparador virtual]:

```ts
import { html, render } from '@spectrum-web-components/base';
import { VirtualTrigger, openOverlay } from '@spectrum-web-components/overlay';

private handleContextMenu = async (event: MouseEvent) => {
    // ...prevent browser default behavior

    // Trigger at current position
    const trigger = event.target as LitElement;
    const virtualTrigger = new VirtualTrigger(event.clientX, event.clientY);

    // Render Lit template
    const fragment = document.createDocumentFragment();
    render(this.contextMenuTemplate(), fragment);

    // Show Overlay
    const popover = fragment.querySelector('sp-popover') as HTMLElement;
    const overlay = await openOverlay(popover, {
        trigger: virtualTrigger,
        placement: 'right-start',
        offset: 0,
        notImmediatelyClosable: true,
        type: 'auto',
    });
    trigger.insertAdjacentElement('afterend', overlay);
    this.renderRoot.appendChild(overlay);
}
```

En el ejemplo de abajo, después de abrir el menú contextual sobre una forma seleccionada, puedes ajustar el `z-index`. También puedes usar atajos de teclado. En Figma son <kbd>[</kbd> y <kbd>]</kbd>. Aquí he tomado como referencia Photoshop Web y he usado <kbd>⌘[</kbd> y <kbd>⌘]</kbd>.

<ZIndex />

## Escribir en el portapapeles {#clipboard-write-text}

Nuestro objetivo es escribir en el portapapeles una lista serializada de formas. El usuario puede activar este comportamiento de dos maneras: mediante el evento [copy] (por ejemplo, <kbd>Ctrl+C</kbd>) y mediante el menú contextual. Veamos primero el primer caso, escuchando el evento [copy]. La opción [passive] puede informar al navegador de que quizá llamemos a `preventDefault` en el manejador del evento:

```ts
document.addEventListener('copy', this.handleCopy, { passive: false });
```

En ese momento hay que asegurarse de que el lienzo está en el estado activo mediante `activeElement`, después desactivar el comportamiento predeterminado del navegador e impedir que el evento se propague:

```ts
private handleCopy = (event: ClipboardEvent) => {
    const { layersSelected } = this.appState;
    if (
        document.activeElement !== this.api.element ||
        layersSelected.length === 0
    ) {
        return;
    }

    this.executeCopy(event); // Pass ClipboardEvent

    event.preventDefault();
    event.stopPropagation();
};
```

En los casos que se activan desde el menú contextual no hay [ClipboardEvent]. Tomando como referencia la implementación del [portapapeles de Excalidraw] y de [actionClipboard], se prueban las API del navegador de la más reciente a la más antigua:

```ts
export async function copyTextToClipboard(
    text: string,
    clipboardEvent?: ClipboardEvent,
) {
    // 1.
    await navigator.clipboard.writeText(text);
    // 2.
    if (clipboardEvent) {
        clipboardEvent.clipboardData?.setData(MIME_TYPES.text, text);
    }
    // 3.
    document.execCommand('copy');
}
```

## Leer del portapapeles {#clipboard-read}

La implementación de la lectura del portapapeles determina qué tipos de archivo habituales admitimos. Según los tipos MIME, esto incluye imágenes y texto. El texto puede contener formas serializadas, SVG, URL o incluso sintaxis de mermaid, entre otros. Empezaremos por el caso más sencillo: aceptar el texto de la lista de formas serializadas de la sección anterior.

```ts
document.addEventListener('paste', this.handlePaste, { passive: false });
```

Igual que al escribir en el portapapeles, primero se prueba el método [read], que solo funciona bajo HTTPS y, en teoría, admite todo tipo de datos, no solo texto sin formato. Casi todos los navegadores modernos admiten este método, aunque tienen limitaciones en los tipos de datos, que suelen incluir texto, HTML e imágenes. Si este método no está disponible o rechaza la petición, se recurre a [readText].

```ts
export const readSystemClipboard = async () => {
    const types: { [key in AllowedPasteMimeTypes]?: string | File } = {};
    try {
        // Prefer read() so HTML and images remain available.
        if (navigator.clipboard?.read) {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                for (const type of item.types) {
                    try {
                        if (
                            type === MIME_TYPES.text ||
                            type === MIME_TYPES.html
                        ) {
                            types[type] = await (
                                await item.getType(type)
                            ).text();
                        }
                        // Supported image types are converted to File objects.
                    } catch {
                        // Another clipboard item may still be readable.
                    }
                }
            }
            return types;
        }
    } catch (error) {
        // read() may fail even when readText() is permitted.
        if (!navigator.clipboard?.readText) throw error;
    }
    const text = await navigator.clipboard?.readText?.();
    return text ? { [MIME_TYPES.text]: text } : types;
};
```

También se puede usar este método para saber si el portapapeles está vacío en ese momento y desactivar el elemento de menú `Paste` si lo está. Lo último que hay que tener en cuenta es que el método de lectura del portapapeles necesita que el documento tenga el foco. Si, al activarlo, el foco está en la barra de direcciones del navegador o en las herramientas de desarrollo, se informa del error siguiente. Por eso puedes usar `document.hasFocus()` para comprobar el éxito antes de leer:

> [!CAUTION]
> Uncaught (in promise) NotAllowedError: Failed to execute 'read' on 'Clipboard': Document is not focused

### Deserializar formas {#deserialize}

Después de deserializar, solo hace falta regenerar el `id`:

```ts
if (data.elements) {
    const nodes = data.elements.map((node) => {
        node.id = uuidv4();
        return node;
    });

    this.api.runAtNextTick(() => {
        this.api.updateNodes(nodes);
        this.api.record();
    });
}
```

Sin embargo, así las formas copiadas se solapan. Podemos adoptar estas dos estrategias:

1. Crearlas siguiendo la posición del ratón, lo que exige registrar la posición del movimiento más reciente del ratón
2. Añadir un desplazamiento a la posición original de la forma

La segunda es más sencilla:

```ts
const nodes = data.elements.map((node) => {
    node.id = uuidv4();
    node.x += 10; // [!code ++]
    node.y += 10; // [!code ++]
    return node;
});
```

Y la primera necesita registrar la posición del menú contextual cuando se abre, o el movimiento más reciente del ratón:

```ts
private handleContextMenu = async (event: MouseEvent) => {
    this.lastContextMenuPosition = { x: event.clientX, y: event.clientY }; // [!code ++]
}
private handlePointerMove = (event: PointerEvent) => {
    this.lastPointerMovePosition = { x: event.clientX, y: event.clientY }; // [!code ++]
};
```

Ya tratamos [Lección 6 - Coordenadas], la conversión de las coordenadas Client al sistema de coordenadas del lienzo:

```ts
if (position) {
    const { x, y } = api.viewport2Canvas(api.client2Viewport(position)); // [!code ++]
    node.x = x; // [!code ++]
    node.y = y; // [!code ++]
} else {
    node.x += 10;
    node.y += 10;
}
```

### Imagen no vectorial {#non-vector-image}

Veamos primero cómo copiar imágenes no vectoriales. Como ya vimos en [Lección 10 - Renderizar imagen], con `@loaders.gl` se puede cargar un archivo de imagen desde el portapapeles, obtener después la anchura y la altura originales y el `dataURL`, pasar por una serie de ajustes para obtener la anchura y la altura finales y, por último, crear un rectángulo y asignar su `fill` al `dataURL`:

```ts
import { load } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';

async function createImage(api: ExtendedAPI, appState: AppState, file: File) {
    const [image, dataURL] = await Promise.all([
        load(file, ImageLoader),
        getDataURL(file),
    ]);

    // 省略计算宽高

    updateAndSelectNodes(api, appState, [
        {
            id: uuidv4(),
            type: 'rect',
            x: position?.x ?? 0,
            y: position?.y ?? 0,
            width,
            height,
            fill: dataURL,
            lockAspectRatio: true,
        },
    ]);
}
```

¿Por qué no podemos usar sin más la anchura y la altura de la imagen original? La anchura y la altura del rectángulo creado están en el sistema de coordenadas mundial y deben verse afectadas por el tamaño del lienzo, el nivel de zoom actual de la cámara y el tamaño de la imagen original. Excalidraw usa un algoritmo heurístico:

```ts
// Heuristic to calculate the size of the image.
// @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L10059
const minHeight = Math.max(canvas.height - 120, 160);
// max 65% of canvas height, clamped to <300px, vh - 120px>
const maxHeight = Math.min(
    minHeight,
    Math.floor(canvas.height * 0.5) / canvas.zoom,
);
const height = Math.min(image.height, maxHeight);
const width = height * (image.width / image.height);
```

### SVG {#svg}

Al pegar imágenes, Excalidraw no hace un tratamiento especial de las imágenes de tipo SVG, lo que hace perder la posibilidad de seguir editando sus elementos internos.

Figma puede convertir elementos SVG en gráficos del lienzo y hacer que los elementos sean editables; consulta [Convertir SVG en marcos]. Lo tratamos en [Lección 10 - De SVGElement a nodo serializado], pero antes hay que usar `DOMParser` para convertir una cadena en un SVGElement:

```ts
import {
    DOMAdapter,
    svgElementsToSerializedNodes,
} from '@infinite-canvas-tutorial/ecs';

if (data.text) {
    const string = data.text.trim();
    if (string.startsWith('<svg') && string.endsWith('</svg>')) {
        const doc = DOMAdapter.get()
            .getDOMParser()
            .parseFromString(string, 'image/svg+xml');
        const $svg = doc.documentElement;
        const nodes = svgElementsToSerializedNodes(
            Array.from($svg.children) as SVGElement[],
        );

        this.updateAndSelectNodes(nodes);
        return;
    }
}
```

Por supuesto, también puedes usar el enfoque de `innerHTML`, pero no se recomienda para SVG complejos (puedes perder el espacio de nombres):

```ts
const container = document.createElement('div');
container.innerHTML = svgString.trim();
const svgElement = container.firstChild;
```

El último caso también es el más sencillo: si en ese momento el contenido del portapapeles es texto sin formato, creamos el `text` correspondiente. Cabe mencionar que en Excalidraw se usan la fuente, el color y otros atributos configurados por el usuario actual:

```ts
function createText(
    api: ExtendedAPI,
    appState: AppState,
    text: string,
    position?: { x: number; y: number },
) {
    updateAndSelectNodes(api, appState, [
        {
            id: uuidv4(),
            type: 'text',
            anchorX: position?.x ?? 0,
            anchorY: position?.y ?? 0,
            content: text,
            fontSize: 16,
            fontFamily: 'system-ui',
            fill: 'black',
        },
    ]);
}
```

## Arrastrar y soltar para importar imágenes {#drag-n-drop}

Muchos componentes de carga de archivos admiten arrastrar y soltar archivos desde un administrador de archivos u otro lugar hasta una zona indicada para completar la carga, como [react-dropzone]. Excalidraw también admite [handleAppOnDrop], lo que hace muy fácil arrastrar y soltar imágenes, productos de exportación e incluso vídeos en el lienzo para completar la importación:

```tsx
<div onDrop={this.handleAppOnDrop} />
```

Para que el evento `drop` se dispare correctamente en `<canvas>`, también hay que escuchar `dragover` y desactivar el comportamiento predeterminado del navegador; consulta [¿El evento onDrop de HTML5/Canvas no se dispara?] y [Evitar el comportamiento de arrastre predeterminado del navegador].

```ts
this.api.element.addEventListener('dragover', this.handleDragOver);
this.api.element.addEventListener('drop', this.handleDrop);
```

Después se pueden intentar leer los archivos arrastrados desde el sistema de archivos a partir de [files]:

```ts
private handleDrop = async (event: DragEvent) => {
    for (const file of Array.from(event.dataTransfer.files)) {}
}
```

También podemos admitir texto e imágenes arrastrados desde la página. El texto se puede leer directamente de `dataTransfer`. Para las imágenes, consulta [Arrastrar imágenes]: se recomienda escribir la URL de la imagen en `dataTransfer`. En el ejemplo siguiente lo hacemos en el `dragstart` de la imagen:

```ts
const text = event.dataTransfer.getData('text/plain');
if (text) {
    createText(this.api, this.appState, text, canvasPosition);
}

img.addEventListener('dragstart', (ev) => {
    const dt = ev.dataTransfer;
    dt?.setData('text/uri-list', img.src);
    dt?.setData('text/plain', img.src);
});
```

En el ejemplo siguiente puedes arrastrar y soltar la imagen de la derecha, o el texto de esta página, directamente en el lienzo.

<DragNDropImage />

## Cargar desde el sistema de archivos {#upload-from-filesystem}

Por supuesto, también está la forma más tradicional de cargar desde el sistema de archivos: el `<input type="file">` más habitual en el front-end. Aquí tomamos como referencia la implementación de [filesystem] de Excalidraw y usamos [browser-fs-access] para intentar usar la [File System API], más imperativa, que se degrada de forma automática si el navegador no la admite.

```ts
if (pen === Pen.IMAGE) {
    try {
        const file = await fileOpen({
            extensions: ['jpg', 'png', 'svg'],
            description: 'Image to upload',
        });
        if (file) {
            createImage(this.api, this.appState, file);
            this.api.setAppState({ penbarSelected: Pen.SELECT });
            this.api.record();
        }
    } catch (e) {
        // User cancels upload and returns to selection mode
        this.api.setAppState({ penbarSelected: Pen.SELECT });
    }
}
```

Puedes probar esta función haciendo clic en el botón «Image» de la barra de herramientas de la izquierda.

## Exportar las formas seleccionadas {#export-selected-shapes}

Más allá de [Lección 10 - Exportar el contenido del lienzo a una imagen], la función de exportación que más se usa se dirige a los gráficos seleccionados. Seguimos usando la [File System API] para exportar los gráficos seleccionados como imágenes SVG y PNG y guardarlos en local.

### Exportar a SVG {#export-selected-shapes-to-svg}

A diferencia de exportar todo el lienzo, hay que calcular la caja delimitadora de las formas seleccionadas. Ajustando el viewport del SVG a un tamaño adecuado mediante `viewBox`, nos aseguramos de que todas las formas seleccionadas queden contenidas dentro del viewport.

```ts
import { serializeNodesToSVGElements } from '@infinite-canvas-tutorial/ecs';
import { fileSave } from './filesystem';

// 1. Calculate bounds of SVG
const bounds = api.getBounds(nodes);
const width = bounds.maxX - bounds.minX;
const height = bounds.maxY - bounds.minY;
const $svg = createSVGElement('svg');
$svg.setAttribute('width', `${width}`);
$svg.setAttribute('height', `${height}`);
$svg.setAttribute(
    'viewBox',
    `${bounds.minX - padding} ${bounds.minY - padding} ${width + padding * 2} ${
        height + padding * 2 // add padding with viewBox
    }`,
);

// 2. SerializedNodes -> SVGElement[]
serializeNodesToSVGElements(nodes).forEach((element) => {
    $svg.appendChild(element);
});

// 3. Create blob and save to filesystem
fileSave(
    new Blob([toSVG($svg)], {
        type: MIME_TYPES.svg,
    }),
);
```

### Exportar a PNG {#export-selected-shapes-to-png}

Para exportar gráficos no vectoriales seguimos usando `HTMLCanvasElement.toDataURL()`, pero el dibujo debe hacerse en un elemento `<canvas>` temporal.

### Incrustar los metadatos de la escena {#embed-scene-metadata}

Además de la información gráfica, los metadatos de la escena también se pueden incrustar en el resultado exportado. La imagen de abajo procede de Excalidraw.

![Exportar imagen en excalidraw](/export-image-in-excalidraw.png)

```ts
// https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/index.ts#L176-L178
encodePngMetadata({
    blob,
    metadata: serializeAsJSON(elements, appState, files, 'local'),
});
```

## Lectura adicional {#extended-reading}

-   [Interactuar con el portapapeles]
-   [Evitar el comportamiento de arrastre predeterminado del navegador]

[contextmenu]: https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
[radix - Menú contextual]: https://www.radix-ui.com/primitives/docs/components/context-menu
[Lección 18 - Implementar la interfaz con Spectrum]: /es/guide/lesson-018
[Usar un disparador virtual]: https://opensource.adobe.com/spectrum-web-components/components/imperative-api/#using-a-virtual-trigger
[copy]: https://developer.mozilla.org/en-US/docs/Web/API/Element/copy_event
[Interactuar con el portapapeles]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard
[portapapeles de Excalidraw]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/clipboard.ts
[actionClipboard]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/actions/actionClipboard.tsx#L62
[ClipboardEvent]: https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent
[passive]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#passive
[read]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/read
[readText]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText
[Convertir SVG en marcos]: https://forum.figma.com/ask-the-community-7/convert-svg-to-frames-18578
[Lección 6 - Coordenadas]: /es/guide/lesson-006#coordinates
[Lección 10 - Renderizar imagen]: /es/guide/lesson-010#render-image
[Lección 10 - De SVGElement a nodo serializado]: /es/guide/lesson-010#svgelement-to-serialized-node
[react-dropzone]: https://github.com/react-dropzone/react-dropzone
[handleAppOnDrop]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L1560C9-L1560C38
[¿El evento onDrop de HTML5/Canvas no se dispara?]: https://stackoverflow.com/questions/7699987/html5-canvas-ondrop-event-isnt-firing
[files]: https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files
[Arrastrar imágenes]: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#dragging_images
[Evitar el comportamiento de arrastre predeterminado del navegador]: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop#prevent_the_browsers_default_drag_behavior
[filesystem]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/filesystem.ts
[browser-fs-access]: https://www.npmjs.com/package/browser-fs-access
[File System API]: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
[Lección 10 - Exportar el contenido del lienzo a una imagen]: /es/guide/lesson-010#export-canvas-to-image
