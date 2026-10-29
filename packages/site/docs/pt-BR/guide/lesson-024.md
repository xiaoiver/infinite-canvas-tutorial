---
outline: deep
description: 'Implemente o menu de contexto e a área de transferência. Ajuste o z-index trazendo para a frente e enviando para trás. Escreva e leia o conteúdo da área de transferência, com suporte a colar gráficos serializados, imagens não vetoriais, SVG e texto simples. Importe arquivos de imagem arrastando e soltando a partir do sistema de arquivos e de páginas.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lição 24 - Menu de contexto e área de transferência',
          },
      ]
---

<script setup>
import ZIndex from '../../components/ZIndex.vue';
import DragNDropImage from '../../components/DragNDropImage.vue';
</script>

# Lição 24 - Menu de contexto e área de transferência {#lesson-24-context-menu-and-clipboard}

Nesta lição, vamos apresentar o seguinte:

-   Como implementar o menu de contexto
-   Ajustar o z-index trazendo para a frente e enviando para trás
-   Escrever e ler o conteúdo da área de transferência, com suporte a colar gráficos serializados, imagens não vetoriais, SVG e texto simples
-   Importar arquivos de imagem arrastando e soltando a partir do sistema de arquivos e de páginas

<img src="/context-menu.png" alt="menu de contexto" style="max-width: 300px;"/>

## Implementar o menu de contexto {#context-menu}

Menus de contexto em geral são disparados por clique com o botão direito ou por um toque longo. Os navegadores montam um conteúdo de menu padrão; por exemplo, disparar o menu em `<canvas>` mostra "Salvar como" e outras opções.
Por isso, o primeiro passo é escutar o evento [contextmenu] e impedir o comportamento padrão do navegador. Referência: [radix - Context Menu].

```ts
private handleContextMenu = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // ...show Overlay
};

this.api.element.addEventListener('contextmenu', this.handleContextMenu);
```

Em seguida, é preciso exibir o componente de interface do menu na posição indicada. Em [Lição 18 - Implementar a interface com o Spectrum], usamos a API imperativa de Overlay, junto com [Using a virtual trigger]:

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

No exemplo abaixo, depois de abrir o menu de contexto em uma forma selecionada, você pode ajustar o `z-index`. Também dá para usar atalhos de teclado. No Figma, eles são <kbd>[</kbd> e <kbd>]</kbd>. Aqui, a referência foi o Photoshop Web, com <kbd>⌘[</kbd> e <kbd>⌘]</kbd>.

<ZIndex />

## Escrever na área de transferência {#clipboard-write-text}

O objetivo é gravar uma lista serializada de formas na área de transferência. O usuário pode disparar isso de dois jeitos: pelo evento [copy] (como <kbd>Ctrl+C</kbd>) e pelo menu de contexto. Vamos ver primeiro o primeiro caso, escutando o evento [copy]. A opção [passive] aqui informa ao navegador que podemos chamar `preventDefault` no tratador do evento:

```ts
document.addEventListener('copy', this.handleCopy, { passive: false });
```

Nesse ponto, é preciso garantir que a tela esteja ativa por meio de `activeElement`, desativar o comportamento padrão do navegador e impedir o borbulhamento do evento:

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

Nos cenários disparados pelo menu de contexto, não há [ClipboardEvent]. Seguindo a implementação de [excalidraw clipboard] e [actionClipboard], tente as APIs do navegador da mais nova para a mais antiga:

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

## Ler da área de transferência {#clipboard-read}

A implementação da leitura da área de transferência define quais tipos comuns de arquivo têm suporte. Pelos tipos MIME, isso inclui imagens e texto. O texto pode conter formas serializadas, SVG, URLs ou até sintaxe mermaid, entre outros. Começamos pelo caso mais simples: aceitar o texto da lista serializada de formas da seção anterior.

```ts
document.addEventListener('paste', this.handlePaste, { passive: false });
```

Como na escrita, tente primeiro o método [read], que só funciona em HTTPS e, em teoria, aceita todos os tipos de dado, não só texto simples. Quase todos os navegadores modernos aceitam esse método, embora limitem os tipos de dado, em geral texto, HTML e imagens. Se o método não estiver disponível ou rejeitar o pedido, caia para [readText].

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

Também dá para usar esse método para saber se a área de transferência está vazia naquele momento e desativar o item de menu `Paste` se estiver. O último ponto é que o método de leitura precisa do documento em foco. Se o foco estiver na barra de endereço do navegador ou nas ferramentas de desenvolvedor no momento do disparo, o erro a seguir é reportado. Por isso, você pode usar `document.hasFocus()` para saber se a leitura vai ter sucesso antes de fazê-la:

> [!CAUTION]
> Uncaught (in promise) NotAllowedError: Failed to execute 'read' on 'Clipboard': Document is not focused

### Desserializar formas {#deserialize}

Depois da desserialização, só é preciso gerar de novo o `id`:

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

Desse jeito, porém, as formas copiadas ficam sobrepostas. Dá para adotar duas estratégias:

1. Criar acompanhando a posição do mouse, o que exige registrar a posição do movimento mais recente do mouse
2. Somar um deslocamento à posição original da forma

A segunda é mais simples:

```ts
const nodes = data.elements.map((node) => {
    node.id = uuidv4();
    node.x += 10; // [!code ++]
    node.y += 10; // [!code ++]
    return node;
});
```

A primeira precisa registrar a posição do menu de contexto quando ele é disparado, ou o movimento mais recente do mouse:

```ts
private handleContextMenu = async (event: MouseEvent) => {
    this.lastContextMenuPosition = { x: event.clientX, y: event.clientY }; // [!code ++]
}
private handlePointerMove = (event: PointerEvent) => {
    this.lastPointerMovePosition = { x: event.clientX, y: event.clientY }; // [!code ++]
};
```

Já vimos [Lição 6 - Coordenadas], a conversão de coordenadas Client para o sistema de coordenadas da tela:

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

### Imagem não vetorial {#non-vector-image}

Vamos ver primeiro a cópia de imagens não vetoriais. Como já vimos em [Lição 10 - Renderizar imagem], com `@loaders.gl` dá para carregar um arquivo de imagem da área de transferência, obter a largura e a altura originais e o `dataURL`, passar por uma série de ajustes até a largura e a altura finais e, por fim, criar um retângulo e definir o `fill` dele como o `dataURL`:

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

Por que não usar direto a largura e a altura da imagem original? A largura e a altura do retângulo criado estão no sistema de coordenadas de mundo e devem ser afetadas pelo tamanho da tela, pelo zoom atual da câmera e pelo tamanho da imagem original. O Excalidraw usa um algoritmo heurístico:

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

Ao colar imagens, o Excalidraw não faz um tratamento especial de imagens do tipo SVG, e com isso se perde a possibilidade de continuar editando os elementos internos.

O Figma consegue converter elementos SVG em gráficos da tela e deixar os elementos editáveis; veja [Convert SVG to frames]. Isso foi tratado em [Lição 10 - De SVGElement para SerializedNode], mas antes é preciso usar `DOMParser` para converter uma string em um SVGElement:

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

Também dá para usar a abordagem com `innerHTML`, mas ela não é recomendada para SVGs complexos (você pode perder o namespace):

```ts
const container = document.createElement('div');
container.innerHTML = svgString.trim();
const svgElement = container.firstChild;
```

O último caso também é o mais simples. Se o conteúdo da área de transferência for texto simples, criamos o `text` correspondente. Vale mencionar que, no Excalidraw, são usados a fonte, a cor e outros atributos definidos pelo usuário atual:

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

## Arrastar e soltar para importar imagens {#drag-n-drop}

Muitos componentes de envio de arquivo aceitam arrastar e soltar arquivos de um gerenciador de arquivos, ou de outro lugar, em uma zona indicada para concluir o envio, como o [react-dropzone]. O Excalidraw também aceita [handleAppOnDrop], o que facilita muito arrastar e soltar imagens, produtos exportados e até vídeos na tela para concluir a importação:

```tsx
<div onDrop={this.handleAppOnDrop} />
```

Para o evento `drop` disparar direito no `<canvas>`, também é preciso escutar `dragover` e desativar o comportamento padrão do navegador; veja [HTML5/Canvas onDrop event isn't firing?] e [Prevent the browser's default drag behavior].

```ts
this.api.element.addEventListener('dragover', this.handleDragOver);
this.api.element.addEventListener('drop', this.handleDrop);
```

Em seguida, dá para tentar ler os arquivos arrastados do sistema de arquivos a partir de [files]:

```ts
private handleDrop = async (event: DragEvent) => {
    for (const file of Array.from(event.dataTransfer.files)) {}
}
```

Também dá para aceitar texto e imagens arrastados da página. O texto pode ser lido direto do `dataTransfer`. Para imagens, veja [Dragging Images]: o recomendado é gravar a URL da imagem no `dataTransfer`. No exemplo a seguir, isso é feito no `dragstart` da imagem:

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

No exemplo a seguir, você pode arrastar e soltar a imagem do lado direito, ou o texto desta página, direto na tela.

<DragNDropImage />

## Fazer upload a partir do sistema de arquivos {#upload-from-filesystem}

Também existe o jeito mais tradicional de enviar a partir do sistema de arquivos: o `<input type="file">`, o mais familiar para quem desenvolve front-end. Aqui seguimos a implementação [filesystem] do Excalidraw e usamos [browser-fs-access] para tentar a [File System API], mais imperativa, que recua sozinha se o navegador não tiver suporte.

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

Você pode experimentar esse recurso clicando no botão “Image” da barra de ferramentas à esquerda.

## Exportar as formas selecionadas {#export-selected-shapes}

Além de [Lição 10 - Exportar o conteúdo da tela para imagem], a exportação mais usada mira os gráficos selecionados. Continuamos usando a [File System API] para exportar os gráficos selecionados como imagens SVG e PNG e salvá-los localmente.

### Exportar para SVG {#export-selected-shapes-to-svg}

Diferente de exportar a tela inteira, é preciso calcular a caixa delimitadora das formas selecionadas. Ajustando o viewport do SVG para um tamanho adequado por meio de `viewBox`, garantimos que todas as formas selecionadas já estejam contidas no viewport.

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

### Exportar para PNG {#export-selected-shapes-to-png}

Para exportar gráficos não vetoriais, ainda usamos `HTMLCanvasElement.toDataURL()`, mas o desenho precisa ser feito em um elemento `<canvas>` temporário.

### Embutir metadados da cena {#embed-scene-metadata}

Além da informação gráfica, os metadados da cena também podem ser embutidos no resultado exportado. A imagem abaixo é do Excalidraw.

![Exportar imagem no excalidraw](/export-image-in-excalidraw.png)

```ts
// https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/index.ts#L176-L178
encodePngMetadata({
    blob,
    metadata: serializeAsJSON(elements, appState, files, 'local'),
});
```

## Leitura adicional {#extended-reading}

-   [Interact with the clipboard]
-   [Prevent the browser's default drag behavior]

[contextmenu]: https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
[radix - Context Menu]: https://www.radix-ui.com/primitives/docs/components/context-menu
[Lição 18 - Implementar a interface com o Spectrum]: /pt-BR/guide/lesson-018
[Using a virtual trigger]: https://opensource.adobe.com/spectrum-web-components/components/imperative-api/#using-a-virtual-trigger
[copy]: https://developer.mozilla.org/en-US/docs/Web/API/Element/copy_event
[Interact with the clipboard]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard
[excalidraw clipboard]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/clipboard.ts
[actionClipboard]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/actions/actionClipboard.tsx#L62
[ClipboardEvent]: https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent
[passive]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#passive
[read]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/read
[readText]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText
[Convert SVG to frames]: https://forum.figma.com/ask-the-community-7/convert-svg-to-frames-18578
[Lição 6 - Coordenadas]: /pt-BR/guide/lesson-006#coordinates
[Lição 10 - Renderizar imagem]: /pt-BR/guide/lesson-010#render-image
[Lição 10 - De SVGElement para SerializedNode]: /pt-BR/guide/lesson-010#svgelement-to-serialized-node
[react-dropzone]: https://github.com/react-dropzone/react-dropzone
[handleAppOnDrop]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L1560C9-L1560C38
[HTML5/Canvas onDrop event isn't firing?]: https://stackoverflow.com/questions/7699987/html5-canvas-ondrop-event-isnt-firing
[files]: https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files
[Dragging Images]: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#dragging_images
[Prevent the browser's default drag behavior]: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop#prevent_the_browsers_default_drag_behavior
[filesystem]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/filesystem.ts
[browser-fs-access]: https://www.npmjs.com/package/browser-fs-access
[File System API]: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
[Lição 10 - Exportar o conteúdo da tela para imagem]: /pt-BR/guide/lesson-010#export-canvas-to-image
