---
outline: deep
description: 'Incrusta HTML e iframes, como bloques de código, vídeo y ShaderToy, para que hagan paneo y zoom con la cámara.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lección 29 - Incrustar contenido HTML',
          },
      ]
---

<script setup>
import HTML from '../../components/HTML.vue'
import Iframe from '../../components/Iframe.vue'
</script>

# Lección 29 - Incrustar contenido HTML {#lesson-29-embedding-html-content}

A veces queremos incrustar contenido HTML en el lienzo, como un reproductor de YouTube, un componente de CodeSandbox, ShaderToy, etc.

## Crear un contenedor HTML {#create-html-container}

Excalidraw no admite incrustar contenido HTML en el lienzo, pero tldraw sí admite [TLEmbedShape]. Muestra un contenedor HTML (con un iframe u otros elementos) junto al elemento `<svg>` del lienzo o superpuesto sobre él en la página, en lugar de estar «del todo» dentro de un único lienzo.

![Contenido HTML externo en tldraw](/html-in-tldraw.png)

El contenedor se divide en dos capas:

-   La capa HTML existe junto al `<canvas>` como nodo hermano, contiene todos los contenedores HTML y se encarga de la sincronización de la cámara.
-   El contenedor HTML sirve de contenedor para cada forma `html` / `embed` y se encarga del posicionamiento de cada forma.

### Sincronización de la cámara {#sync-camera}

En [Lección 4 - Cámara] presentamos una serie de parámetros importantes de la cámara: traslación, rotación y zoom. Ahora hay que mapear los parámetros de la cámara al transform CSS del contenedor HTML para que el lienzo y el contenedor HTML permanezcan sincronizados.

```ts
const { cameraZoom, cameraX, cameraY } = this.appStateProvider.value;

$htmlLayer.style.transform = `scale(${toDomPrecision(
    cameraZoom,
)}) translate(${toDomPrecision(-cameraX)}px, ${toDomPrecision(-cameraY)}px)`;
```

Usa `position: absolute;` en la capa HTML, relativa al elemento raíz:

```ts
$htmlLayer.style.position = 'absolute';
$htmlLayer.style.top = topbarVisible ? `${TOP_NAVBAR_HEIGHT}px` : '0px';
$htmlLayer.style.left = '0px';
```

### Forma HTML {#html-shape}

En el ejemplo [Fuentes de contenido externo] se ve cómo tldraw admite contenido HTML:

```ts
class DangerousHtmlExample extends BaseBoxShapeUtil<IDangerousHtmlShape> {
    static override type = 'html' as const;

    override getDefaultProps() {
        return {
            type: 'html',
            w: 500,
            h: 300,
            html: '<div>hello</div>',
        };
    }
}
```

También añadimos una forma serializable. Además de las propiedades habituales `x/y/width/height`, el atributo más importante es el contenido `innerHTML`:

```ts
export interface HtmlAttributes {
    html: string;
}
export interface HtmlSerializedNode
    extends BaseSerializeNode<'html'>,
        Partial<HtmlAttributes> {}
```

Cuando cambia la posición, hay que sincronizarla mediante un transform CSS:

```ts
const { matrix } = entity.read(GlobalTransform);

$child.style.transform = `matrix(${toDomPrecision(
    matrix.m00,
)}, ${toDomPrecision(matrix.m01)}, ${toDomPrecision(
    matrix.m10,
)}, ${toDomPrecision(matrix.m11)}, ${toDomPrecision(
    matrix.m20,
)}, ${toDomPrecision(matrix.m21)})`;
$child.style.width = `${toDomPrecision(width)}px`;
$child.style.height = `${toDomPrecision(height)}px`;
```

### Culling {#culling}

En [Lección 8 - Culling] vimos que el contenido HTML que queda por completo fuera del viewport debe ocultarse, lo que se puede conseguir con `display: none;`. Usamos el método presentado en [Lección 18 - ECS] para seguir todas las entidades que contienen componentes HTML cuyo componente Culled ha cambiado, mediante la consulta del System.

```ts
export class RenderHTML extends System {
    private readonly culled = this.query(
        (q) => q.with(HTML).addedChangedOrRemoved.with(Culled).trackWrites,
    );

    execute() {
        this.culled.addedChangedOrRemoved.forEach((entity) => {
            entity.read(HTMLContainer).element.style.display = entity.has(
                Culled,
            )
                ? 'none'
                : 'block';
        });
    }
}
```

Pero ¿qué ocurre si solo una parte queda fuera del lienzo? Conviene señalar que tldraw asigna las siguientes propiedades CSS al contenedor `.tl-canvas`:

```css
.tl-canvas {
    overflow: clip;
    content-visibility: auto;
    touch-action: none;
    contain: strict;
}
```

| Propiedad CSS                | Problema que resuelve                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **overflow: clip**           | Desactiva el desplazamiento para mantener estable el sistema de coordenadas e impedir que el desfase del scroll corrompa el renderizado. |
| **content-visibility: auto** | Optimiza el rendimiento de los elementos DOM que quedan fuera del viewport (como selecciones, cursores remotos, etc.) |
| **touch-action: none**       | Toma por completo el control de las operaciones táctiles para evitar la interferencia de los gestos predeterminados del navegador. |
| **contain: strict**          | Trata el lienzo como una isla de renderizado independiente para reducir el coste de reflow y repaint.       |

Veamos cómo mostrar contenido HTML.

## Pegar una URL {#paste-url}

En [Lección 24 - Leer del portapapeles] vimos cómo tratar las imágenes y el texto del portapapeles.

Las URL son un texto especial. En tldraw:

-   Cuando la URL se reconoce como un enlace externo, el manejador predeterminado obtiene los metadatos de la página (og:image, title, favicon, description), los envuelve en un asset de marcador (TLBookmarkAsset) y en la forma correspondiente, y lo renderiza con el estilo de marcador.
-   Cuando la URL es contenido incrustable (como YouTube, Figma, Google Maps, etc.), lo renderiza mediante un `<iframe>`.
-   Cuando la URL apunta a un recurso de imagen o de vídeo, lo carga como asset multimedia (TLImageAsset / TLVideoAsset) y lo renderiza con ImageShapeUtil.

```ts
// @see https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/hooks/clipboard/pasteUrl.ts#L12
export async function pasteUrl() {
    return await editor.putExternalContent({
        type: 'url',
        point,
        url,
        sources,
    });
}
```

### Marcador {#bookmark}

```ts
// @see https://github.com/tldraw/tldraw/blob/ef0eba14c5a8baf4f36b3659ac9af98256d3b5dd/packages/tldraw/src/lib/defaultExternalContentHandlers.ts#L249
export async function defaultHandleExternalUrlAsset() {
    let meta: {
        image: string;
        favicon: string;
        title: string;
        description: string;
    };

    const resp = await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
    });
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    meta = {
        image:
            doc.head
                .querySelector('meta[property="og:image"]')
                ?.getAttribute('content') ?? '',
        // title, favicon, description
    };

    // Create bookmark asset
}
```

### Renderizar con iframe {#render-with-iframe}

Muchos sitios web ofrecen controles para compartir que incrustan contenido en páginas web. Tomemos YouTube como ejemplo: hay que convertir el enlace de reproducción en un enlace incrustable mediante reglas concretas y, después, se puede mostrar con un `<iframe>`:

```ts
// Input URL: https://www.youtube.com/watch?v=37fvFffAmf8
const embedUrl = `https://www.youtube.com/embed/${videoId}${search}`;

const $iframe = document.createElement('iframe');
$iframe.src = embedUrl;
```

<Iframe />

### URL de imagen {#image-url}

## Pegar contenido HTML {#paste-html}

Los bloques de código copiados desde VS Code son fragmentos HTML:

```html
<meta charset="utf-8" />
<div
    style="color: #e4e4e4;background-color: #181818;font-family: Menlo, Monaco, 'Courier New', monospace;font-weight: normal;font-size: 12px;line-height: 18px;white-space: pre;"
>
    <div><span style="color: #d6d6dd;">### iframe</span></div>
</div>
```

Podemos intentar leerlo del portapapeles:

```ts
const html = event.clipboardData?.getData(MIME_TYPES.html); // text/html
```

Después podemos crear el contenido a partir del HTML. Para obtener su tamaño, inserta el HTML en un elemento oculto, deja que el navegador lo disponga y lee su `offsetWidth` / `offsetHeight`.

```ts
function createHTML(
    api: ExtendedAPI,
    appState: AppState,
    html: string,
    position?: { x: number; y: number },
) {
    const { width, height } = measureHTML(html);

    updateAndSelectNodes(api, appState, [
        {
            id: uuidv4(),
            type: 'html',
            x: position?.x ?? 0,
            y: position?.y ?? 0,
            width,
            height,
            html,
        },
    ]);
}
```

<HTML />

## Interactuar con el contenido HTML {#interact-with-HTML-content}

Parte del contenido HTML es interactivo, como incrustar un reproductor de YouTube en el lienzo y seguir permitiendo la reproducción. Sin embargo, asignar `pointer-events: none;` al contenedor HTML impide reproducir el vídeo. Una solución habitual es usar un doble clic para entrar en el modo de edición, y distinguirlo así del clic simple predeterminado del lienzo para seleccionar formas.

De hecho, en [Lección 16 - Entrada de texto] también usamos el doble clic sobre una forma Text para entrar en el modo de edición. Aquí añadimos de forma explícita una propiedad `isEditing` a las formas.

```ts
export interface BaseSerializeNode<Type extends string> {
    editable? boolean;
    isEditing?: boolean;
}
```

```ts
class RenderHTML extends System {
    private readonly editables = this.query(
        (q) => q.withAny(HTML, Embed).addedOrChanged.with(Editable).trackWrites,
    );

    execute() {
        this.editables.addedOrChanged.forEach((entity) => {
            const { element } = entity.read(HTMLContainer);
            const { isEditing } = entity.read(Editable);
            element.style.pointerEvents = isEditing ? 'auto' : 'none';
        });
    }
}
```

Haz doble clic en la forma seleccionada para entrar en el modo de edición. Haz clic en otro lugar para salir del modo de edición.

```ts
if (input.doubleClickTrigger) {
    selection.mode = SelectionMode.EDITING;
    api.updateNode(api.getNodeByEntity(selected), { isEditing: true });
}

if (input.pointerDownTrigger) {
    if (selection.mode === SelectionMode.EDITING) {
        const toSelect = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));
        if (selection.editing && toSelect !== selection.editing) {
            api.updateNode(api.getNodeByEntity(selection.editing), {
                isEditing: false,
            });
            selection.editing = undefined;
            selection.mode = SelectionMode.SELECT;
        }
    }
}
```

Haz doble clic en el ejemplo del reproductor de YouTube de arriba para entrar en el modo de edición, donde puedes reproducir el vídeo.

## Exportar como SVG o imagen {#export-svg-or-image}

En [Lección 10 - Importar y exportar imágenes] mostramos cómo exportar el contenido del lienzo como imágenes SVG o PNG. Para el contenido HTML puedes apoyarte en soluciones maduras de la comunidad, como [html-to-image].

> Esta biblioteca usa una función de SVG que permite incluir contenido HTML arbitrario dentro de la etiqueta \<foreignObject\>.

[Fuentes de contenido externo]: https://tldraw.dev/examples/external-content-sources
[TLEmbedShape]: https://tldraw.dev/reference/tlschema/TLEmbedShape
[Lección 24 - Leer del portapapeles]: /es/guide/lesson-024#clipboard-read
[Lección 4 - Cámara]: /es/guide/lesson-004
[Lección 10 - Importar y exportar imágenes]: /es/guide/lesson-010
[html-to-image]: https://github.com/bubkoo/html-to-image
[Lección 16 - Entrada de texto]: /es/guide/lesson-016#textarea
[Lección 8 - Culling]: /es/guide/lesson-008#culling
[Lección 18 - ECS]: /es/guide/lesson-018
