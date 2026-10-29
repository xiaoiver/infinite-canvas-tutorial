---
outline: deep
description: 'Sistema de layout Flex integrado, com suporte ao motor de composição Yoga. Exploração do desenvolvimento de um motor de layout no ambiente WebGL para obter um design de interface responsivo.'
---

<script setup>
import YogaGap from '../../components/YogaGap.vue'
import YogaFlexBasisGrowShrink from '../../components/YogaFlexBasisGrowShrink.vue'
import YogaAlignItemsJustifyContent from '../../components/YogaAlignItemsJustifyContent.vue'
import YogaButton from '../../components/YogaButton.vue'
import YogaMinMaxWidthHeight from '../../components/YogaMinMaxWidthHeight.vue'
</script>

# Lição 33 - Motor de layout {#lesson-33-layout-engine}

Os navegadores implementam vários sistemas de layout, como Flexbox, Grid e Block, e assim fica fácil obter efeitos como “centralizar” sem calcular à mão a posição dos nós.

Em aplicativos no estilo de uma tela que rodam fora do DOM, você precisa implementar a lógica do próprio motor de layout. O Figma implementou o Auto Layout, em que `Grid` está em beta, enquanto `Vertical` e `Horizontal` correspondem à propriedade `flex-direction` do CSS. Para detalhes, veja: [Figma - Guide to auto layout]

![fonte: https://www.figma.com/community/file/1284819663700490015](/figma-flexbox.png)

Ferramentas voltadas a design para código em geral oferecem essa capacidade. Para detalhes, veja:
[Layout in pencil.dev]

> Um objeto pai pode assumir o tamanho e o posicionamento dos filhos com um sistema de layout no estilo flexbox, por meio de propriedades como layout, justifyContent e alignItems.

```ts
export interface Layout {
    /** Enable flex layout. None means all children are absolutely positioned and will not be affected by layout properties. Frames default to horizontal, groups default to none. */
    layout?: 'none' | 'vertical' | 'horizontal';
    /** The gap between children in the main axis direction. Defaults to 0. */
    gap?: NumberOrVariable;
    layoutIncludeStroke?: boolean;
    /** The Inside padding along the edge of the container */
    padding?:
        | /** The inside padding to all sides */ NumberOrVariable
        | /** The inside horizontal and vertical padding */ [
              NumberOrVariable,
              NumberOrVariable,
          ]
        | /** Top, Right, Bottom, Left padding */ [
              NumberOrVariable,
              NumberOrVariable,
              NumberOrVariable,
              NumberOrVariable,
          ];
    /** Control the justify alignment of the children along the main axis. Defaults to 'start'. */
    justifyContent?:
        | 'start'
        | 'center'
        | 'end'
        | 'space_between'
        | 'space_around';
    /** Control the alignment of children along the cross axis. Defaults to 'start'. */
    alignItems?: 'start' | 'center' | 'end';
}
```

![fonte: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Basic_concepts](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Basic_concepts/basics1.svg)

Nesta lição, vamos implementar layouts Flexbox e oferecer, nos nós, propriedades CSS com os mesmos nomes:

```ts
const parent = {
    id: 'parent',
    type: 'rect',
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};
const child = {
    id: 'child',
    parentId: 'parent',
    type: 'rect',
    width: 50,
    height: 50,
};
```

## Yoga {#yoga}

Usar o motor de layout [Yoga] no frontend só é possível via WASM. Hoje existem várias implementações disponíveis:

-   [yoga-layout-prebuilt] Faz bastante tempo que não recebe atualização.
-   [yoga-wasm-web] As primeiras versões do [satori] usavam esse pacote para converter HTML em SVG e calcular layouts. O [taffy] também tem um [exemplo](https://github.com/DioxusLabs/taffy/pull/394#issuecomment-1476430705) relacionado
-   [yoga-layout] Recomendamos usá-lo, e a nossa implementação também se baseia nele. O [react-pdf/yoga] também o usa.

Vale notar que o Yoga também se aplica ao espaço 3D, desde que um plano seja especificado. Para detalhes, veja: [react-three-flex]

> Outra diferença importante em relação ao Flexbox do DOM é que você precisa especificar o plano do contêiner em 3D. Os elementos são posicionados no plano 2D definido pelos dois eixos, usando a largura e a altura calculadas ao longo desses eixos.

![orientação dos eixos](https://github.com/pmndrs/react-three-flex/raw/master/docs/axes_orientation.png)

### pixijs/layout {#pixijs-layout}

O [pixijs/layout] também é implementado com o Yoga. Implementações parecidas incluem: [pixi-flex-layout]

```ts
const container = new Container({
    layout: {
        width: '80%',
        height: '80%',
        gap: 4,
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignContent: 'center',
    },
});
```

### troika-flex-layout {#troika-flex-layout}

O [troika-flex-layout] calcula o layout num WebWorker usando o [yoga-layout-prebuilt]:

```ts
import { requestFlexLayout } from 'troika-flex-layout';

// Describe your layout style tree, with a unique id for each node:
const styleTree = {
    id: 'root',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    children: [
        {
            id: 'child',
            width: '50%',
            height: '50%',
        },
    ],
};

// Initiate a layout request with a callback function:
requestFlexLayout(styleTree, (results) => {
    // The results are a mapping of node ids to layout boxes:
    // {
    //   root: { left: 0, top: 0, width: 100, height: 100 },
    //   child: { left: 25, top: 25, width: 50, height: 50 }
    // }
});
```

## Alternativas ao Yoga {#alternatives-to-yoga}

Implementações em JS puro:

-   [Motion Canvas Layouts] Implementação de Flexbox nativa do navegador, sem precisar reimplementar algoritmos complexos de layout
-   [Simplifying WebGL: Building an Effective Layout Engine]

Implementações em Rust:

-   [stretch] implementa Flexbox e oferece um binding WASM `stretch-layout`, mas está sem manutenção há muito tempo.
-   [taffy] Biblioteca de layout de UI de alto desempenho escrita em Rust. Hoje implementa vários algoritmos de layout CSS, incluindo Flexbox, Grid e Block. Os bindings WASM, porém, ainda não estão disponíveis. Para detalhes, veja: [taffy wasm bindings]

## Nossa implementação {#our-implementation}

Escolhemos o [yoga-layout] oficial. Além do Flexbox conhecido, ele também oferece propriedades básicas de layout, como Margin e Padding.

```ts
import { loadYoga } from 'yoga-layout/load';

class YogaSystem extends System {
    async prepare() {
        Yoga = await loadYoga();
    }
}
```

É preciso construir uma árvore de layout paralela ao grafo de cena.

Primeiro, construímos uma árvore de layout paralela ao grafo de cena. A estrutura de cada nó é a seguinte:

```ts
interface StyleTreeNode {
    id: string;
    top?: number | string;
    left?: number | string;
    width?: number | string;
    height?: number | string;
    children: StyleTreeNode[];
    padding?: number | number[];
    margin?: number | number[];
    gap?: number;
    rowGap?: number;
    columnGap?: number;
}
```

Depois, no momento certo, convertemos a árvore de layout numa árvore Yoga, executamos o cálculo do layout e aplicamos o resultado aos nós do grafo de cena:

```ts
const root = Yoga.Node.createWithConfig(yogaConfig);
populateNode(root, styleTree);

root.calculateLayout();
const results = Object.create(null);
walkStyleTree(styleTree, (styleNode) => {
    const { id, yogaNode } = styleNode;
    results[id] = {
        x: yogaNode.getComputedLeft(),
        y: yogaNode.getComputedTop(),
        width: yogaNode.getComputedWidth(),
        height: yogaNode.getComputedHeight(),
    };
});
root.freeRecursive();
```

### Quando fazer o layout {#when-to-do-layout}

Quando o tamanho do próprio contêiner Flexbox muda, o layout precisa ser recalculado e aplicado à posição e ao tamanho dos filhos. O mesmo vale quando novos filhos entram no contêiner.

```ts
class YogaSystem extends System {
    private readonly bounds = this.query((q) =>
        q.addedOrChanged.and.removed
            .with(ComputedBounds)
            .trackWrites.and.with(Flex),
    );

    execute() {
        this.bounds.addedOrChanged.forEach((entity) => {
            // relayout
        });
    }
}
```

### AlignItems e JustifyContent {#align-items-justify-content}

O uso mais comum é centralizar o conteúdo com essas duas propriedades:

<YogaAlignItemsJustifyContent />

Para implementar botões com texto centralizado:

O rótulo usa a largura intrínseca (`wordWrap: false`), e o Yoga centraliza a caixa de texto medida dentro do botão. Um `wordWrapWidth` fixo com `maxLines: 1` e `textOverflow: 'ellipsis'` pode truncar o rótulo mesmo quando o botão tem espaço de sobra. Reserve essas opções para rótulos que precisem de truncamento de propósito.

<YogaButton />

### Gap {#gap}

O exemplo a seguir mostra o efeito de `padding` e `gap`:

```ts
const parent = {
    id: 'yoga-gap-parent',
    type: 'rect',
    x: 100,
    y: 100,
    width: 200,
    height: 250,
    fill: 'grey',
    display: 'flex',
    padding: 10,
    flexWrap: 'wrap',
    gap: 10,
    zIndex: 0,
};
```

<YogaGap />

### Flex Basis, Grow e Shrink {#flex-basis-grow-shrink}

[Flex Basis, Grow, and Shrink]

> O flex grow aceita qualquer valor de ponto flutuante >= 0, e 0 é o valor padrão. Um contêiner distribui o espaço restante entre os filhos, ponderado pelo valor de flex grow de cada filho.

<YogaFlexBasisGrowShrink />

### Largura e altura mínimas e máximas {#min-max-width-height}

[Min/Max Width and Height]

<YogaMinMaxWidthHeight />

## Exportar SVG {#export-svg}

Como o Flexbox do CSS só aceita elementos HTML como contêineres, e não elementos SVG, ainda é preciso usar as posições absolutas depois do layout ao exportar para SVG.

```ts
const layoutNodes = api.readLayoutFromECS(nodes);

(await serializeNodesToSVGElements(layoutNodes)).forEach((element) => {
    $namespace.appendChild(element);
});
```

## Leitura adicional {#extended-reading}

-   [Simplifying WebGL: Building an Effective Layout Engine]
-   [clay]
-   [react-three-flex]
-   [Figma - Guide to auto layout]
-   [Layout in rive]

[Yoga]: https://yogalayout.com/
[yoga-layout-prebuilt]: https://github.com/vadimdemedes/yoga-layout-prebuilt
[yoga-wasm-web]: https://github.com/shuding/yoga-wasm-web
[yoga-layout]: https://www.yogalayout.dev/
[taffy]: https://github.com/DioxusLabs/taffy
[Simplifying WebGL: Building an Effective Layout Engine]: https://blog.certa.dev/building-a-layout-engine-for-webgl
[troika-flex-layout]: https://github.com/protectwise/troika/blob/main/packages/troika-flex-layout/
[clay]: https://github.com/nicbarker/clay
[Motion Canvas Layouts]: https://motioncanvas.io/docs/layouts
[pixijs/layout]: https://github.com/pixijs/layout
[pixi-flex-layout]: https://github.com/fireveined/pixi-flex-layout/
[react-three-flex]: https://github.com/pmndrs/react-three-flex/
[satori]: https://github.com/vercel/satori
[stretch]: https://github.com/vislyhq/stretch
[taffy wasm bindings]: https://github.com/DioxusLabs/taffy/pull/394
[Figma - Guide to auto layout]: https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout
[react-pdf/yoga]: https://github.com/diegomura/react-pdf/blob/master/packages/layout/src/yoga/index.ts
[Flex Basis, Grow, and Shrink]: https://www.yogalayout.dev/docs/styling/flex-basis-grow-shrink
[Min/Max Width and Height]: https://www.yogalayout.dev/docs/styling/min-max-width-height
[Layout in pencil.dev]: https://docs.pencil.dev/for-developers/the-pen-format#layout
[Layout in rive]: https://rive.app/docs/editor/layouts/layouts-overview
