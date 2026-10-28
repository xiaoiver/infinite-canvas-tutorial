---
outline: deep
description: 'Frame e recorte: implementação de clip/erase com stencil buffer e o tratamento de clip-path e mask na exportação de PNG/SVG.'
---
<script setup>
import ClipPath from '../../components/ClipPath.vue'
import Mask from '../../components/Mask.vue'
import ClipPathSoft from '../../components/ClipPathSoft.vue'
import Cropping from '../../components/Cropping.vue'
import BrushWithEraser from '../../components/BrushWithEraser.vue'
import TransformerGroup from '../../components/TransformerGroup.vue'
</script>

# Lição 34 - Group, Frame e recorte {#lesson-34-group-frame-and-clip}

Hoje o nosso `Group / g` é um agrupamento lógico sem limites geométricos (por exemplo `x/y/width/height`), então ele não aplica recorte aos filhos. O tldraw oferece Group e Frame como [Structural shapes].

## Group {#group}

No Figma, um Group funciona essencialmente como um “contêiner”, parecido com uma pasta. Para mais detalhes, veja: [The difference between frames and groups]

-   Tratar vários elementos como uma única unidade nas operações (mover, escalar etc.)
-   O clique seleciona o Group inteiro por padrão; o tamanho do Group é determinado automaticamente pelos elementos filhos
-   Um clique duplo permite que você entre no Group e edite os elementos individuais
-   Group/Ungroup
    -   Use o menu de contexto e os atalhos de teclado
    -   Arraste e solte no painel de camadas

<TransformerGroup />

### Agrupar com arrastar e soltar {#group-ungroup-with-dnd}

Antes de implementar o agrupamento por arrastar e soltar, podemos usar o [sortablejs] para primeiro permitir a ordenação por arrastar e soltar dos itens na lista do mesmo nível.

```ts
import Sortable from 'sortablejs';

const lists = root.querySelectorAll<HTMLElement>('.layer-siblings');
lists.forEach((el) => {
    const parentId = el.dataset.layerParentId ?? '';
    const sortable = Sortable.create(el, {
        animation: 150,
        draggable: '.layer-branch',
        filter: '.layer-branch--locked', // 锁定图层无法拖拽
        preventOnFilter: false,
        group: {
            name: `layers-${parentId || 'root'}`,
            pull: true,
            put: true,
        },
        onEnd: (evt) => {
            if (evt.oldIndex === evt.newIndex) {
                return;
            }
            const to = evt.to as HTMLElement;
            const orderedIds = Array.from(to.children)
                .filter((c): c is HTMLElement =>
                    c.classList.contains('layer-branch'),
                )
                .map((c) => c.dataset.nodeId)
                .filter((id): id is string => !!id);
            // 所有兄弟节点重新排序，依次设置 zIndex
            this.applyLayerSiblingOrder(
                to.dataset.layerParentId ?? '',
                orderedIds,
            );
        },
    });
    this.sortableInstances.push(sortable);
});
```

Arrastar para agrupar ou desagrupar exige operações entre grupos.

## Buffer de stencil {#stencil-buffer}

No tldraw, o recorte é feito com o CSS [clip-path], definido no pai ao sobrescrever `getClipPath`; o Frame embutido é implementado assim. No Figma, essa propriedade se chama `clip content`; veja [Frame properties in Figma].

No [pencil.dev], o Frame é definido assim: um retângulo que pode conter elementos filhos e que possui capacidade de recorte:

```ts
/** A frame is a rectangle that can have children. */
export interface Frame extends Rectangleish, CanHaveChildren, Layout {
    type: 'frame';
    /** Visually clip content that overflows the frame bounds. Default is false. */
    clip?: BooleanOrVariable;
    placeholder?: boolean;
    /** The presence of this property indicates that this frame is a "slot" - which means that it is intended be customized with children in instances of the parent component. Each element of the array is an ID of a "recommended" reusable component, one which fits semantically as a child here (e.g. inside a menu bar, the content slot would recommend IDs of various menu item components). */
    slot?: string[];
}
```

De forma geral, queremos que qualquer forma possa agir como pai de recorte: os filhos fora da forma são recortados, enquanto o próprio pai continua sendo renderizado normalmente, com `fill`/`stroke` aplicados. A propriedade é declarada assim:

```ts
{
    clipChildren: true;
}
```

Em seguida, vemos como implementar esse recorte em WebGL / WebGPU.

![stencil buffer do learnopengl](https://maxammann.org/posts/2022/01/wgpu-stencil-testing/learnopengl-stencil_buffer.png)

Quando uma forma é um contêiner de recorte, também precisamos renderizar para o stencil buffer no RenderPass; o valor padrão dele é `0`:

```ts
{
    stencilWrite: true, // enable writing to stencil buffer
    stencilFront: {
        compare: CompareFunction.ALWAYS,
        passOp: StencilOp.REPLACE,
    },
    stencilBack: {
        compare: CompareFunction.ALWAYS,
        passOp: StencilOp.REPLACE,
    }
}
```

Depois gravamos um valor de referência no stencil buffer, para a comparação posterior ao renderizar os filhos; esse valor pode estar em `[0-255]`, por exemplo `1` no diagrama acima:

```ts
renderPass.setStencilReference(STENCIL_CLIP_REF);
```

Ao renderizar os filhos recortados, verificamos se o valor do buffer é igual a essa referência; regiões com valor `0` não são desenhadas, e o recorte acontece:

```ts
{
    stencilFront: {
        compare: CompareFunction.EQUAL,
        passOp: StencilOp.KEEP,
    }
}
```

<ClipPath />

## Efeito de borracha {#non-atomic-eraser}

Agora dá para implementar a parte que faltava de [Lição 25 - Borracha não atômica]. O efeito de borracha é o oposto do recorte: o CSS [clip-path] define a região “visível”, e o [\<clipPath\>] do SVG faz o mesmo. Nenhum dos dois consegue definir uma região “invisível”.

O `<mask>` do SVG consegue; veja [Clipping and masking in SVG]. Em WebGL / WebGPU, basta inverter a comparação:

```ts
{
    stencilFront: {
        compare: CompareFunction.EQUAL, // [!code --]
        compare: CompareFunction.NOTEQUAL, // [!code ++]
        passOp: StencilOp.KEEP,
    }
}
```

Por isso também precisamos de uma propriedade que distinga os modos `clip` e `erase`:

```ts
{
    clipChildren: true,  // [!code --]
    clipMode: 'erase', // 'clip' | 'erase' // [!code ++]
}
```

No Fragment Shader, ao usar o stencil buffer, é preciso pular a lógica usual de descarte baseada em alfa; veja [Lição 2 - SDF]. Caso contrário, com `fill='none'`, a renderização não sai correta:

```glsl
// sdf.glsl
#ifdef USE_STENCIL
  // Stencil pass: discard by geometry (SDF distance), not alpha. Include the same
  // anti-alias band as the normal pass (fwidth(distance)) so the stencil boundary
  // matches the visible shape and avoids edge holes.
  float outerBoundary = (strokeAlignment < 1.5) ? 0.0 : strokeWidth;
  if (distance > outerBoundary)
    discard;
#else
  if (outputColor.a < epsilon)
    discard;
#endif
```

<Mask />

<BrushWithEraser />

## Exportar como imagem {#export-as-image}

Ao exportar um único elemento recortado como imagem, precisamos da interseção dos limites dele com os limites do pai como tamanho para renderizar no OffscreenCanvas, ou como tamanho do `viewBox` ao exportar SVG:

```ts
const { minX, minY, maxX, maxY } =
    entity.read(ComputedBounds).renderWorldBounds;
const {
    minX: parentMinX,
    minY: parentMinY,
    maxX: parentMaxX,
    maxY: parentMaxY,
} = parentEntity.read(ComputedBounds).renderWorldBounds;
const isectMinX = Math.max(minX, parentMinX);
const isectMinY = Math.max(minY, parentMinY);
const isectMaxX = Math.min(maxX, parentMaxX);
const isectMaxY = Math.min(maxY, parentMaxY);
bounds.addFrame(isectMinX, isectMinY, isectMaxX, isectMaxY);
```

### Exportar PNG {#export-as-png}

O único cuidado é que, mesmo ao exportar só o filho recortado, é preciso renderizar o pai primeiro.

### Exportar SVG {#export-as-svg}

Primeiro, o caso `clipMode='clip'`.

O pai do recorte tem um `<g>` correspondente. Defina o `clip-path` dele para referenciar a definição da própria forma; note que o [\<clipPath\>] em si não é renderizado.

```html
<g clip-path="url(#clip-path-frame-1)" transform="matrix(1,0,0,1,100,100)">
    <defs>
        <clipPath id="clip-path-frame-1">
            <ellipse
                id="node-frame-1"
                fill="green"
                cx="100"
                cy="100"
                rx="100"
                ry="100"
            />
        </clipPath>
    </defs>
    <ellipse
        id="node-frame-1"
        fill="green"
        cx="100"
        cy="100"
        rx="100"
        ry="100"
    />
    <rect
        id="node-rect-1"
        fill="red"
        width="100"
        height="100"
        transform="matrix(1,0,0,1,-50,-50)"
    />
</g>
```

Para `clipMode='erase'`, as regras de máscara do SVG são:

-   Branco (luminância 1): o conteúdo mascarado fica visível
-   Preto (luminância 0): o conteúdo mascarado fica oculto

Desenhe primeiro um retângulo branco grande e depois a forma que apaga, em preto:

```ts
const $whiteRect = createSVGElement('rect');
$whiteRect.setAttribute('x', '-10000');
$whiteRect.setAttribute('y', '-10000');
$whiteRect.setAttribute('width', '20000');
$whiteRect.setAttribute('height', '20000');
$whiteRect.setAttribute('fill', 'white');
$clipPath.appendChild($whiteRect);

$parentNode.setAttribute('fill', 'black');
$parentNode.setAttribute('stroke', 'black');
```

A estrutura SVG resultante:

```html
<defs xmlns="http://www.w3.org/2000/svg">
    <mask id="mask-frame-1">
        <rect x="-10000" y="-10000" width="20000" height="20000" fill="white" />
        <rect fill="black" width="100" height="100" stroke="black" />
    </mask>
</defs>
```

## Recortar uma imagem {#crop-an-image}

O recorte é usado com mais frequência em imagens. Veja [Crop an image] e [image cropping in excalidraw] para mais detalhes.

![recortar uma imagem no Figma](https://help.figma.com/hc/article_attachments/34351829050391)

Vale notar que, nos editores, o recorte em geral preserva a imagem original, então a área recortada só fica oculta visualmente, e fica fácil reajustar a região de recorte:

> O recorte é uma ação não destrutiva, ou seja, a área recortada não é apagada. Isso permite que você altere a área recortada, se precisar.

### Efeito semitransparente da área recortada {#use-soft-clip-outside}

Depois de entrar no modo de recorte, o conteúdo original da imagem ainda precisa ser exibido, com a área recortada indicada pela transparência. Acrescentamos outro modo, `'soft'`, a `clipMode` para obter esse efeito:

<ClipPathSoft />

O princípio da implementação é o seguinte: na prática, renderizamos a forma recortada duas vezes. A primeira passagem (`compare: CompareFunction.EQUAL`) renderiza a parte recortada normalmente, como descrito antes, e a segunda passagem (`compare: CompareFunction.NOTEQUAL`) aplica uma transparência fixa:

```glsl
#ifdef USE_SOFT_CLIP_OUTSIDE
  outputColor *= 0.15;
#endif
```

### Adicionar interação {#interaction}

Em seguida, acrescentamos interação para deixar a região de recorte editável. Depois de entrar no modo de recorte, há duas partes interativas:

-   Fixar a região de recorte e arrastar o gráfico recortado
-   Ajustar o tamanho da região de recorte

<Cropping />

Seguindo o design de interação do Figma, depois de selecionar uma forma, você pode entrar no modo de recorte pelo menu de contexto. Nesse momento, um elemento pai de recorte é criado para os elementos selecionados:

```ts
const children = layersSelected.map((id) => this.api.getNodeById(id));
const bounds = this.api.getBounds(children);
const { minX, minY, maxX, maxY } = bounds;
// create a clip parent for all the selected nodes
const clipParent: RectSerializedNode = {
    id: uuidv4(),
    type: 'rect',
    clipMode: 'clip',
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
};

this.api.runAtNextTick(() => {
    this.api.updateNodes([clipParent]);
    // clipParent -> children
    children.forEach((child) => {
        this.api.reparentNode(child, clipParent);
    });
    this.api.setAppState({
        layersCropping: [clipParent.id],
        penbarSelected: Pen.SELECT,
    });
    this.api.record();
});
```

## Leitura adicional {#extended-reading}

-   [Shape clipping in tldraw]
-   [Frame properties in Figma]
-   [Stencil Testing in WebGPU and wgpu]
-   [Clipping and masking in SVG]

[Structural shapes]: https://tldraw.dev/sdk-features/default-shapes#Structural-shapes
[Shape clipping in tldraw]: https://tldraw.dev/sdk-features/shape-clipping
[Frame properties in Figma]: https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design#:~:text=Clip%20Content%3A%20Hide%20any%20objects%20within%20the%20frame%20that%20extend%20beyond%20the%20frame%27s%20bounds
[Stencil Testing in WebGPU and wgpu]: https://maxammann.org/posts/2022/01/wgpu-stencil-testing/
[Lição 25 - Borracha não atômica]: /pt-BR/guide/lesson-025
[clip-path]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/clip-path
[\<clipPath\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/clipPath
[Clipping and masking in SVG]: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Clipping_and_masking
[Lição 2 - SDF]: /pt-BR/guide/lesson-002#sdf
[Crop an image]: https://help.figma.com/hc/en-us/articles/360040675194-Crop-an-image
[image cropping in excalidraw]: https://github.com/excalidraw/excalidraw/pull/8613
[pencil.dev]: https://docs.pencil.dev/for-developers/the-pen-format#typescript-schema
[The difference between frames and groups]: https://help.figma.com/hc/en-us/articles/360039832054-The-difference-between-frames-and-groups?utm_source=chatgpt.com
[sortablejs]: https://github.com/sortablejs/Sortable
