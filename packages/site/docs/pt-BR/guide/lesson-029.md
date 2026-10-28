---
outline: deep
description: 'Incorpore HTML e iframes, como blocos de código, vídeo e ShaderToy, para que eles se desloquem e apliquem zoom junto com a câmera.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lição 29 - Incorporar conteúdo HTML',
          },
      ]
---

<script setup>
import HTML from '../../components/HTML.vue'
import Iframe from '../../components/Iframe.vue'
</script>

# Lição 29 - Incorporar conteúdo HTML {#lesson-29-embedding-html-content}

Às vezes queremos incorporar conteúdo HTML na tela, como um player do YouTube, um componente do CodeSandbox, o ShaderToy e assim por diante.

## Criar um contêiner HTML {#create-html-container}

O Excalidraw não oferece suporte a incorporar conteúdo HTML na tela, mas o tldraw oferece suporte a [TLEmbedShape]. Ele exibe um contêiner HTML (com um iframe ou outros elementos) ao lado do elemento `<svg>` da tela na página, ou sobreposto a ele, em vez de ficar “completamente” dentro de uma única tela.

![Conteúdo HTML externo no tldraw](/html-in-tldraw.png)

O contêiner se divide em duas camadas:

-   A camada HTML existe ao lado do `<canvas>` como nó irmão, contém todos os contêineres HTML e trata da sincronização da câmera.
-   O contêiner HTML serve de contêiner para cada forma `html` / `embed` e trata do posicionamento de cada forma.

### Sincronização da câmera {#sync-camera}

Na [Lição 4 - Câmera], apresentamos uma série de parâmetros importantes da câmera: translação, rotação e zoom. Agora precisamos mapear os parâmetros da câmera para o transform CSS do contêiner HTML, para que a tela e o contêiner HTML permaneçam sincronizados.

```ts
const { cameraZoom, cameraX, cameraY } = this.appStateProvider.value;

$htmlLayer.style.transform = `scale(${toDomPrecision(
    cameraZoom,
)}) translate(${toDomPrecision(-cameraX)}px, ${toDomPrecision(-cameraY)}px)`;
```

Use `position: absolute;` na camada HTML, em relação ao elemento raiz:

```ts
$htmlLayer.style.position = 'absolute';
$htmlLayer.style.top = topbarVisible ? `${TOP_NAVBAR_HEIGHT}px` : '0px';
$htmlLayer.style.left = '0px';
```

### Forma HTML {#html-shape}

No exemplo [External content sources], dá para ver como o tldraw oferece suporte a conteúdo HTML:

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

Também adicionamos uma forma serializável. Além das props comuns `x/y/width/height`, o atributo mais importante é o conteúdo `innerHTML`:

```ts
export interface HtmlAttributes {
    html: string;
}
export interface HtmlSerializedNode
    extends BaseSerializeNode<'html'>,
        Partial<HtmlAttributes> {}
```

Quando a posição muda, precisamos sincronizá-la por meio de um transform CSS:

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

Na [Lição 8 - Culling], vimos que o conteúdo HTML totalmente fora do viewport deve ficar oculto, o que pode ser feito com `display: none;`. Usamos o método apresentado na [Lição 18 - ECS] para acompanhar todas as entidades que contêm componentes HTML em que o componente Culled mudou, com a abordagem de query do System.

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

Mas e se apenas parte dele estiver fora da tela? Vale notar que o tldraw define as seguintes propriedades CSS no contêiner `.tl-canvas`:

```css
.tl-canvas {
    overflow: clip;
    content-visibility: auto;
    touch-action: none;
    contain: strict;
}
```

| Propriedade CSS              | Problema a resolver                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **overflow: clip**           | Desativa a rolagem para garantir a estabilidade do sistema de coordenadas e impedir que o deslocamento da rolagem corrompa a renderização. |
| **content-visibility: auto** | Otimiza o desempenho dos elementos DOM fora do viewport (como seleções, cursores remotos etc.).                                  |
| **touch-action: none**       | Assume por completo o controle das operações de toque para evitar a interferência dos gestos padrão do navegador.                |
| **contain: strict**          | Trata a tela como uma ilha de renderização independente para reduzir o custo de reflow e repaint.                                |

Vamos ver como exibir conteúdo HTML.

## Colar URL {#paste-url}

Na [Lição 24 - Ler da área de transferência], vimos como tratar imagens e conteúdo de texto da área de transferência.

URLs são texto especial. No tldraw:

-   Quando a URL é reconhecida como um link externo, o manipulador padrão busca os metadados da página (og:image, title, favicon, description), empacota isso em um asset de marcador (TLBookmarkAsset) e na forma correspondente, e renderiza com o estilo de marcador.
-   Quando a URL é conteúdo incorporável (como YouTube, Figma, Google Maps etc.), ela é renderizada por meio de um `<iframe>`.
-   Quando a URL aponta para um recurso de imagem ou vídeo, ele é carregado como um asset de mídia (TLImageAsset / TLVideoAsset) e renderizado com ImageShapeUtil.

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

### Renderizar com iframe {#render-with-iframe}

Muitos sites oferecem controles de compartilhamento que incorporam conteúdo em páginas web. Tomando o YouTube como exemplo: é preciso converter o link de reprodução em um link incorporável por meio de regras específicas e, depois disso, dá para exibi-lo com um `<iframe>`:

```ts
// Input URL: https://www.youtube.com/watch?v=37fvFffAmf8
const embedUrl = `https://www.youtube.com/embed/${videoId}${search}`;

const $iframe = document.createElement('iframe');
$iframe.src = embedUrl;
```

<Iframe />

### URL de imagem {#image-url}

## Colar conteúdo HTML {#paste-html}

Blocos de código copiados do VS Code são fragmentos HTML:

```html
<meta charset="utf-8" />
<div
    style="color: #e4e4e4;background-color: #181818;font-family: Menlo, Monaco, 'Courier New', monospace;font-weight: normal;font-size: 12px;line-height: 18px;white-space: pre;"
>
    <div><span style="color: #d6d6dd;">### iframe</span></div>
</div>
```

Dá para tentar lê-lo da área de transferência:

```ts
const html = event.clipboardData?.getData(MIME_TYPES.html); // text/html
```

Em seguida, dá para criar o conteúdo a partir do HTML. Para obter o tamanho, insira o HTML em um elemento oculto e deixe o navegador fazer o layout; depois leia `offsetWidth` / `offsetHeight`.

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

## Interagir com o conteúdo HTML {#interact-with-HTML-content}

Parte do conteúdo HTML é interativa, como incorporar um player do YouTube na tela e ainda permitir a reprodução. Porém, definir `pointer-events: none;` no contêiner HTML impede a reprodução do vídeo. Uma solução comum é usar a interação de clique duplo para entrar no modo de edição, distinguindo-a do comportamento padrão da tela, de um clique simples para selecionar formas.

Na verdade, na [Lição 16 - Entrada de texto], também usamos o clique duplo em uma forma de texto para entrar no modo de edição. Aqui, adicionamos formalmente uma propriedade `isEditing` às formas.

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

Dê um duplo clique na forma selecionada para entrar no modo de edição. Clique em outro lugar para sair do modo de edição.

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

Dê um duplo clique no exemplo do player do YouTube acima para entrar no modo de edição, em que você pode reproduzir o vídeo.

## Exportar como SVG ou imagem {#export-svg-or-image}

Na [Lição 10 - Importar e exportar imagens], mostramos como exportar o conteúdo da tela como imagens SVG ou PNG. Para conteúdo HTML, dá para contar com soluções maduras da comunidade, como [html-to-image].

> Esta biblioteca usa um recurso do SVG que permite ter conteúdo HTML arbitrário dentro da tag \<foreignObject\>.

[External content sources]: https://tldraw.dev/examples/external-content-sources
[TLEmbedShape]: https://tldraw.dev/reference/tlschema/TLEmbedShape
[Lição 24 - Ler da área de transferência]: /pt-BR/guide/lesson-024#clipboard-read
[Lição 4 - Câmera]: /pt-BR/guide/lesson-004
[Lição 10 - Importar e exportar imagens]: /pt-BR/guide/lesson-010
[html-to-image]: https://github.com/bubkoo/html-to-image
[Lição 16 - Entrada de texto]: /pt-BR/guide/lesson-016#textarea
[Lição 8 - Culling]: /pt-BR/guide/lesson-008#culling
[Lição 18 - ECS]: /pt-BR/guide/lesson-018
