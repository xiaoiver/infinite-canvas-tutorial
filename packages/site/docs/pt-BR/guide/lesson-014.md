---
outline: deep
description: 'Implemente modos da tela e interface auxiliar, incluindo as propriedades zIndex e sizeAttenuation. Adicione o modo mão para manipular a tela e o modo de seleção para editar formas, com painéis de propriedades.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lição 14 - Modo da tela e interface auxiliar',
          },
      ]
---
# Lição 14 - Modo da tela e interface auxiliar {#lesson-14-canvas-mode-and-auxiliary-ui}

Antes, implementamos alguns componentes de interface da tela com Web Components, incluindo o zoom da câmera e o download de imagens. Nesta lição, vamos expor mais capacidades da tela por meio de componentes e implementar algumas propriedades novas de desenho:

-   Implementar as propriedades de desenho `zIndex` e `sizeAttenuation`
-   Mover, girar e escalar a tela no modo mão
-   Selecionar, arrastar e mover formas no modo de seleção, e exibir o painel de propriedades da forma

Antes de implementar os modos da tela, precisamos de um trabalho preparatório para dar suporte às propriedades de desenho `zIndex` e `sizeAttenuation`.

## Implementar zIndex {#z-index}

A camada de máscara exibida depois de selecionar uma forma precisa aparecer acima de todas as formas, o que envolve a ordem de exibição, controlada por `zIndex`:

```ts
mask.zIndex = 999;
```

No [z-index] do CSS, o valor só faz sentido dentro do mesmo [Stacking context]. Por exemplo, na figura abaixo, embora `DIV #4` tenha um `z-index` maior que `DIV #1`, ele ainda é renderizado mais abaixo por estar no contexto de `DIV #3`:

![Entendendo o z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context/understanding_zindex_04.png)

Como a ordenação é uma operação que consome bastante desempenho, adicionamos a propriedade `sortDirtyFlag` a Shape, definida como `true` sempre que `zIndex` muda:

```ts
class Sortable {
    get zIndex() {
        return this.#zIndex;
    }
    set zIndex(zIndex: number) {
        if (this.#zIndex !== zIndex) {
            this.#zIndex = zIndex;
            this.renderDirtyFlag = true;
            if (this.parent) {
                this.parent.sortDirtyFlag = true; // [!code ++]
            }
        }
    }
}
```

Também precisamos considerar isso em `appendChild` e `removeChild`:

```ts
class Shapable {
    appendChild(child: Shape) {
        if (child.parent) {
            child.parent.removeChild(child);
        }

        child.parent = this;
        child.transform._parentID = -1;
        this.children.push(child);

        if (!isUndefined(child.zIndex)) {
            this.sortDirtyFlag = true; // [!code ++]
        }

        return child;
    }
}
```

Em seguida, em cada tick do loop de renderização, fazemos uma verificação de sujeira e ordenamos se necessário. Também não queremos alterar `children` diretamente, e sim usar `sorted` para guardar o resultado da ordenação; afinal, `z-index` deve afetar apenas a ordem de renderização, não a ordem real no grafo de cena:

```ts
traverse(this.#root, (shape) => {
    if (shape.sortDirtyFlag) {
        shape.sorted = shape.children.slice().sort(sortByZIndex); // [!code ++]
        shape.sortDirtyFlag = false; // [!code ++]
    }
    // Omit rendering each shape.
});
```

A implementação de `sortByZIndex` é a seguinte: se `zIndex` estiver definido, ordena em ordem decrescente; caso contrário, mantém a ordem original no nó pai. Isso também mostra por que não alteramos `children`: ele preserva a base de ordenação padrão:

```ts
export function sortByZIndex(a: Shape, b: Shape) {
    const zIndex1 = a.zIndex ?? 0;
    const zIndex2 = b.zIndex ?? 0;
    if (zIndex1 === zIndex2) {
        const parent = a.parent;
        if (parent) {
            const children = parent.children || [];
            return children.indexOf(a) - children.indexOf(b);
        }
    }
    return zIndex1 - zIndex2;
}
```

```js eval code=false
circle1Zindex = Inputs.range([-10, 10], {
    label: 'z-index of red circle',
    value: 0,
    step: 1,
});
```

```js eval code=false
circle2Zindex = Inputs.range([-10, 10], {
    label: 'z-index of green circle',
    value: 0,
    step: 1,
});
```

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false inspector=false
circle1 = call(() => {
    const { Circle } = Core;
    return new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
    });
});
```

```js eval code=false inspector=false
circle2 = call(() => {
    const { Circle } = Core;
    return new Circle({
        cx: 150,
        cy: 150,
        r: 50,
        fill: 'green',
    });
});
```

```js eval code=false inspector=false
call(() => {
    circle1.zIndex = circle1Zindex;
    circle2.zIndex = circle2Zindex;
});
```

```js eval code=false inspector=false
call(() => {
    $icCanvas3.setAttribute('modes', '[]');

    $icCanvas3.style.width = '100%';
    $icCanvas3.style.height = '250px';

    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        canvas.appendChild(circle1);
        canvas.appendChild(circle2);
    });
});
```

Ao exportar para SVG, `z-index` não pode ser mapeado diretamente para propriedades do elemento, porque o SVG é renderizado pela ordem em que os elementos aparecem no documento; veja: [How to use z-index in svg elements?]

> No SVG, o z-index é definido pela ordem em que o elemento aparece no documento.

Por isso, precisamos fazer um trabalho extra de ordenação na exportação, e a implementação da ordenação de `SerializedNode` é quase a mesma de `Shape`, que não é mostrada aqui:

```ts
export function toSVGElement(node: SerializedNode, doc?: Document) {
    // Omit handling other attributes.
    [...children]
        .sort(sortByZIndex) // [!code ++]
        .map((child) => toSVGElement(child, doc))
        .forEach((child) => {
            $g.appendChild(child);
        });

    return $g;
}
```

## Implementar sizeAttenuation {#size-attenuation}

Mencionamos antes [sizeAttenuation of polylines]. Ao exibir uma camada de máscara e pontos de âncora depois de selecionar uma forma, não queremos que eles mudem de tamanho com o zoom da câmera. Por exemplo, no excalidraw, interfaces auxiliares como alças de arraste (handle) ajustam a largura da linha de acordo com o nível de zoom, usando a API Canvas2D:

```ts
const renderTransformHandles = (): void => {
    context.save();
    context.lineWidth = 1 / appState.zoom.value; // [!code ++]
};
```

É claro que já passamos `u_ZoomScale` para o Shader, para o ajuste.

### Compressão de vértices {#vertex-compression}

Para bits de flag como `sizeAttenuation`, que só têm 0 e 1, dá para usar a técnica de compressão de vértices. Em resumo, tentamos usar vec4 para armazenar esses dados de vértice e aplicar certas técnicas de compressão, o que reduz o tempo de transferência de dados do lado da CPU para o lado da GPU e economiza bastante memória da GPU. Além disso, há um limite superior para o número de atributos suportados pelo OpenGL. O esquema de compressão também é bem simples: comprimir em JS no lado da CPU e descomprimir no vertex shader. Ele é aplicado tanto no mapbox quanto no Cesium; veja: [Graphics Tech in Cesium - Vertex Compression]. Vamos ver abaixo como comprimir dois valores em um único `float`:

Em GLSL, float é um número de ponto flutuante de precisão simples [Scalars], isto é, o formato IEEE-754 [Single-precision floating-point format]

![Disposição dos bits de binary32](https://picx.zhimg.com/v2-05e8c5427795ebe84919ceef053adaad_1440w.png)

Podemos comprimir `sizeAttenuation` e `type` em um único `float`, em que `sizeAttenuation` ocupa 1 bit e `type` ocupa 23 bits.

```ts
const LEFT_SHIFT23 = 8388608.0;
const compressed = (sizeAttenuation ? 1 : 0) * LEFT_SHIFT23 + type;

const u_Opacity = [opacity, fillOpacity, strokeOpacity, type]; // [!code --]
const u_Opacity = [opacity, fillOpacity, strokeOpacity, compressed]; // [!code ++]
```

Ao decodificar no shader, também é necessário manter a mesma ordem da codificação:

```glsl
#define SHIFT_RIGHT23 1.0 / 8388608.0
#define SHIFT_LEFT23 8388608.0

// unpack data(sizeAttenuation(1-bit), type(23-bit))
float compressed = a_Opacity;

// sizeAttenuation(1-bit)
float sizeAttenuation = floor(compressed * SHIFT_RIGHT23);
compressed -= sizeAttenuation * SHIFT_LEFT23;

// type(23-bit)
float type = compressed;
```

Depois de obter `sizeAttenuation`, use-o no vertex shader para ajustar as coordenadas dos vértices, tomando a implementação SDF como exemplo:

```glsl
float scale = 1.0;
if (sizeAttenuation > 0.5) {
    scale = 1.0 / u_ZoomScale;
}
gl_Position = vec4((u_ProjectionMatrix
    * u_ViewMatrix
    * model
    * vec3(position + v_FragCoord, 1)).xy, zIndex, 1); // [!code --]
    * vec3(position + v_FragCoord * scale, 1)).xy, zIndex, 1); // [!code ++]
```

### Exportar SVG {#export-svg}

Como essa propriedade está relacionada ao zoom da câmera, é necessário um processamento extra ao exportar SVG, que oferece [vector-effect]:

-   `non-scaling-size` -> `sizeAttenuation`, mas essas opções não têm implementações e são consideradas em risco.
-   `non-scaling-stroke` -> `strokeAttenuation`

## Modo da tela {#canvas-mode}

Telas infinitas costumam oferecer muitos modos, como modo de seleção, modo mão, modo caneta e outros. Você pode consultar [Excalidraw ToolType] e [rnote].

A mesma ação de interação corresponde a operações diferentes em modos diferentes. Por exemplo, arrastar na tela corresponde à operação de seleção no modo de seleção; no modo mão, arrasta a tela inteira; no modo caneta, é o desenho livre de traços de caneta.

Primeiro, vamos adicionar os modos de seleção e mão à tela, que podem ser ampliados no futuro:

```ts
export enum CanvasMode {
    SELECT,
    HAND,
    DRAW_RECT,
}

class Canvas {
    #mode: CanvasMode = CanvasMode.HAND;
    get mode() {
        return this.#mode;
    }
    set mode(mode: CanvasMode) {
        this.#mode = mode;
    }
}
```

Vamos implementar um novo componente de interface para alternar entre esses modos.

## Barra de seleção de modo {#mode-toolbar}

Usando [Dynamic classes and styles] do Lit, conseguimos um efeito parecido com [clsx] (se você já usou [tailwindcss] no seu projeto, vai reconhecer na hora), gerenciando `className`, por exemplo gerando-o com base em condições. Aqui usamos isso para implementar o estilo destacado do modo selecionado:

```ts
@customElement('ic-mode-toolbar')
export class ModeToolbar extends LitElement {
    render() {
        const items = [
            { name: CanvasMode.HAND, label: 'Move', icon: 'arrows-move' },
            { name: CanvasMode.SELECT, label: 'Select', icon: 'cursor' },
            {
                name: CanvasMode.DRAW_RECT,
                label: 'Draw rectangle',
                icon: 'sqaure',
            },
        ];
        return html`
            <sl-button-group label="Zoom toolbar">
                ${map(items, ({ name, label, icon }) => {
                    const classes = { active: this.mode === name }; // [!code ++]
                    return html`<sl-tooltip content=${label}>
                        <sl-icon-button
                            class=${classMap(classes)}
                            name=${icon}
                            label=${label}
                            @click="${() => this.changeCanvasMode(name)}"
                        ></sl-icon-button>
                    </sl-tooltip>`;
                })}
            </sl-button-group>
        `;
    }
}
```

Além disso, para reduzir a quantidade de código de template, usamos [Built-in directives - map] do Lit. O efeito é o seguinte:

```js eval code=false
call(() => {
    const $canvas = document.createElement('ic-canvas');
    $canvas.style.width = '100%';
    $canvas.style.height = '100px';
    return $canvas;
});
```

## Modo mão {#hand-mode}

Como o nome sugere, neste modo os usuários só podem fazer pan, girar e dar zoom na tela inteira. Já implementamos [CameraControlPlugin]; agora vamos combiná-lo com o modo da tela. No modo mão, o comportamento continua igual ao original, isto é, mover ou girar a tela. A diferença é que, no início do arraste e durante o processo, o estilo do mouse muda para `grab` e `grabbing`:

```ts
export class CameraControl implements Plugin {
    apply(context: PluginContext) {
        root.addEventListener('drag', (e: FederatedPointerEvent) => {
            const mode = getCanvasMode();
            if (mode === CanvasMode.HAND) {
                setCursor('grabbing'); // [!code ++]

                if (rotate) {
                    rotateCamera(e);
                } else {
                    moveCamera(e);
                }
            }
        });
    }
}
```

### Fazer pan da tela com a roda {#pan-with-wheel}

Eu sempre confundi, por engano, `wheel` com o comportamento de rolagem ou com o evento `scroll`. Esta é a explicação da MDN para [Element: wheel event]:

> Um evento wheel não dispara necessariamente um evento scroll. Por exemplo, o elemento pode não ser rolável. Ações de zoom com a roda ou o trackpad também disparam eventos wheel.

Durante o uso do Figma e do Excalidraw, percebi que, além de arrastar, usar a roda também completa rapidamente a operação de pan da tela. No Excalidraw, também há suporte a segurar `Space` para arrastar em outros modos da tela; veja: [handleCanvasPanUsingWheelOrSpaceDrag]. Portanto, vamos modificar primeiro a lógica original de zoom:

```ts
root.addEventListener('wheel', (e: FederatedWheelEvent) => {
    e.preventDefault();

    // zoomByClientPoint(  // [!code --]
    //     { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }, // [!code --]
    //     e.deltaY, // [!code --]
    // ); // [!code --]
    camera.x += e.deltaX / camera.zoom; // [!code ++]
    camera.y += e.deltaY / camera.zoom; // [!code ++]
});
```

Vale observar que a distância percorrida a cada vez precisa considerar o nível de zoom atual da câmera, e essa distância deve ser menor quando se está ampliado.

### Dar zoom na tela com a roda {#zoom-with-wheel}

É claro que o comportamento de zoom ainda precisa ser mantido, disparado quando `Command` ou `Control` está pressionado. Se você ativou a função `pinch to zoom` no trackpad do Mac, o evento `wheel` disparado carrega automaticamente `ctrlKey`; veja: [Catching Mac trackpad zoom]:

![zoom no trackpad do Mac](/mac-trackpad-zoom.gif)

Desse modo, distinguimos com facilidade os comportamentos diferentes que correspondem ao evento `wheel` nos cenários de zoom e de pan:

```ts
root.addEventListener('wheel', (e: FederatedWheelEvent) => {
    e.preventDefault();

    if (e.metaKey || e.ctrlKey) {
        zoomByClientPoint(
            { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
            e.deltaY,
        );
    } else {
        camera.x += e.deltaX / camera.zoom;
        camera.y += e.deltaY / camera.zoom;
    }
});
```

Vale mencionar que o Excalidraw também permite segurar <kbd>Shift</kbd> para rolar a tela na horizontal. Porém, já atribuímos a operação de rotação a esse comportamento da tela, então ele não será implementado aqui.

## Modo de seleção {#select-mode}

No modo de seleção, os usuários podem selecionar formas na tela clicando. No estado selecionado, uma interface auxiliar é sobreposta à forma original e, em geral, consiste em uma camada de máscara e vários pontos de âncora. Arrastar na camada de máscara move a forma, e arrastar nos pontos de âncora muda o tamanho da forma em várias direções. Também vamos adicionar um ponto de âncora fora da forma, na parte de cima, para rotação.

![Diagrama de posicionamento de âncora com propriedades físicas](https://developer.chrome.com/blog/anchor-positioning-api/image/anchor-diagram-1.png)

### Clicar para selecionar formas {#select-shape}

Vamos implementar o plugin Selector abaixo, e a interface a seguir também será exposta ao Canvas:

```ts
export class Selector implements Plugin {
    selectShape(shape: Shape): void;
    deselectShape(shape: Shape): void;
}
```

Depois de escutar o evento `click` neste plugin, precisamos tratar as seguintes situações:

-   Clicar em uma forma exibe a interface no estado selecionado. Se outras formas já estiverem selecionadas, cancele a seleção primeiro.
-   Clicar em uma área em branco da tela cancela a forma selecionada no momento.
-   Segurar <kbd>Shift</kbd> entra no modo de seleção múltipla.

```ts
const handleClick = (e: FederatedPointerEvent) => {
    const mode = getCanvasMode();
    if (mode !== CanvasMode.SELECT) {
        return;
    }

    const selected = e.target as Shape;

    if (selected === root) {
        if (!e.shiftKey) {
            this.deselectAllShapes();
            this.#selected = [];
        }
    } else if (selected.selectable) {
        if (!e.shiftKey) {
            this.deselectAllShapes();
        }
        this.selectShape(selected);
    } else if (e.shiftKey) {
        // Multi select
    }
};
root.addEventListener('click', handleClick);
```

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, CanvasMode, RoughEllipse } = Core;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    // $icCanvas.setAttribute('zoom', '200');
    $icCanvas.setAttribute('mode', CanvasMode.SELECT);
    $icCanvas.style.width = '100%';
    $icCanvas.style.height = '200px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const ellipse = new RoughEllipse({
            cx: 200,
            cy: 100,
            rx: 50,
            ry: 50,
            fill: 'black',
            strokeWidth: 2,
            stroke: 'red',
            fillStyle: 'zigzag',
        });
        canvas.appendChild(ellipse);

        // setTimeout(() => {
        canvas.selectShape(ellipse);
        // }, 1000);
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### Arrastar para mover formas {#dragndrop-move}

O HTML oferece suporte nativo a arrastar; é claro que também podemos implementar isso com eventos de mais baixo nível, como `pointermove / up / down`. Veja: [Drag'n'Drop with mouse events]. Nossa implementação também se apoia nas ideias desse artigo. No evento `dragstart`, registramos o deslocamento do mouse na tela. Observe que aqui usamos o sistema de coordenadas `screen`, porque o zoom da câmera precisa ser considerado:

```ts
let shiftX = 0;
let shiftY = 0;
this.addEventListener('dragstart', (e: FederatedPointerEvent) => {
    const target = e.target as Shape;
    if (target === this.mask) {
        shiftX = e.screen.x;
        shiftY = e.screen.y;
    }
});
```

No evento `drag`, ajustamos a posição da camada de máscara de acordo com o deslocamento. Usar a propriedade `position` não exige modificar a definição do caminho da máscara; na renderização de baixo nível, só `u_ModelMatrix` muda:

```ts
const moveAt = (canvasX: number, canvasY: number) => {
    const { x, y } = this.mask.position;
    const dx = canvasX - shiftX - x;
    const dy = canvasY - shiftY - y;

    this.mask.position.x += dx;
    this.mask.position.y += dy;
};

this.addEventListener('drag', (e: FederatedPointerEvent) => {
    const target = e.target as Shape;
    const { x, y } = e.screen;

    if (target === this.mask) {
        moveAt(x, y);
    }
});
```

No evento `dragend`, sincronizamos a posição da camada de máscara com a forma; nesse momento, o caminho da máscara é modificado:

```ts
this.addEventListener('dragend', (e: FederatedEvent) => {
    const target = e.target as Shape;
    if (target === this.mask) {
        this.tlAnchor.cx += this.mask.position.x;
        this.tlAnchor.cy += this.mask.position.y;

        const { cx: tlCx, cy: tlCy } = this.tlAnchor;

        this.mask.position.x = 0;
        this.mask.position.y = 0;
        this.mask.d = `M${tlCx} ${tlCy}L${trCx} ${trCy}L${brCx} ${brCy}L${blCx} ${blCy}Z`;
    }
});
```

### Exibir o painel de propriedades {#property-panel}

Quando uma forma é selecionada, queremos exibir o painel de propriedades correspondente à forma; veja [Drawer - Contained to an Element], que não será detalhado aqui. Tomando a propriedade `stroke` como exemplo, fazemos uma vinculação bidirecional, escutando a forma selecionada no momento e, depois que o usuário a modifica manualmente, sincronizando o novo valor com a forma:

```html
<sl-color-picker
    hoist
    size="small"
    value="${this.shape?.stroke}"
    @sl-input="${this.handleStrokeChange}"
    opacity
></sl-color-picker>
```

É preciso observar que, para cores, queremos separar a transparência, então usamos o método `getFormattedValue` de [sl-color-picker] para obter o valor da cor e, em seguida, a biblioteca `d3-color` para analisá-lo, atribuindo os valores a `stroke` e `strokeOpacity` respectivamente:

```ts
const strokeAndOpacity = (e.target as any).getFormattedValue('rgba') as string;
const { rgb, opacity } = rgbaToRgbAndOpacity(strokeAndOpacity); // with d3-color
```

É claro que há muitas funções a implementar no modo de seleção, como mesclar seleções em grupos, girar formas e outras, que vamos continuar aprimorando nas lições seguintes. Além disso, no modo de desenho, queremos oferecer suporte a desenhar retângulos, linhas, polígonos e outros, o que também implementaremos nas lições seguintes.

## Leitura adicional {#extended-reading}

-   [Excalidraw ToolType]
-   [Introducing the CSS anchor positioning API]
-   [Drag'n'Drop with mouse events]

[Introducing the CSS anchor positioning API]: https://developer.chrome.com/blog/anchor-positioning-api
[Excalidraw ToolType]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/types.ts#L120-L135
[rnote]: https://github.com/flxzt/rnote
[Dynamic classes and styles]: https://lit.dev/docs/components/styles/#dynamic-classes-and-styles
[Built-in directives - map]: https://lit.dev/docs/templates/directives/#map
[CameraControlPlugin]: /pt-BR/guide/lesson-004#implement-a-plugin
[clsx]: https://github.com/lukeed/clsx
[tailwindcss]: https://tailwindcss.com/
[handleCanvasPanUsingWheelOrSpaceDrag]: https://github.com/excalidraw/excalidraw/blob/57cf577376e283beae08eb46192cfea7caa48d0c/packages/excalidraw/components/App.tsx#L6561
[Element: wheel event]: https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
[Catching Mac trackpad zoom]: https://stackoverflow.com/a/28685082/4639324
[z-index]: https://developer.mozilla.org/en-US/docs/Web/CSS/z-index
[Stacking context]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context
[How to use z-index in svg elements?]: https://stackoverflow.com/questions/17786618/how-to-use-z-index-in-svg-elements
[Scalars]: https://www.khronos.org/opengl/wiki/Data_Type_(GLSL)#Scalars
[Single-precision floating-point format]: https://en.wikipedia.org/wiki/Single-precision_floating-point_format
[Graphics Tech in Cesium - Vertex Compression]: https://cesium.com/blog/2015/05/18/vertex-compression/
[Drag'n'Drop with mouse events]: https://javascript.info/mouse-drag-and-drop
[Drawer - Contained to an Element]: https://shoelace.style/components/drawer#contained-to-an-element
[sl-color-picker]: https://shoelace.style/components/color-picker
[vector-effect]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/vector-effect
