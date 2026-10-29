---
outline: deep
description: 'Implemente ferramentas de seleção.'
---

<script setup>
import MultiSelection from '../../components/MultiSelection.vue'
import Lasso from '../../components/Lasso.vue'
</script>

# Lição 26 - Ferramenta de seleção {#lesson-26-selection-tool}

Na [Lição 14 - Modo de seleção] só implementamos a seleção simples por clique em formas individuais. Nesta lição, vamos continuar melhorando a ferramenta de seleção, acrescentando seleção múltipla, seleção por letreiro e laço.

## Seleção múltipla {#multi-selection}

A partir da seleção por clique individual, manter <kbd>Shift</kbd> pressionado permite adicionar ou remover formas da seleção atual.

![Mantenha <kbd>Shift</kbd> pressionado para selecionar várias camadas no Figma](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042572c7d3a0cb93253d5/file-TQrRIcwMNR.gif)

No modo de seleção, decidimos se a seleção atual é preservada pelo estado de `input.shiftKey` (se <kbd>Shift</kbd> está pressionado): se não estiver, passamos à seleção única; se estiver, adicionamos a forma alvo à seleção existente:

```ts
if (selection.mode === SelectionMode.SELECT) {
    if (layersSelected.length > 1 && layersSelected.includes(selected.id)) {
        // deselect if already selected in a group
        api.deselectNodes([selected]);
    } else {
        api.selectNodes([selected], input.shiftKey); // whether to add to existed selection
    }
}
```

Na [Lição 21 - Transformer] implementamos a seleção de uma única forma. Em seguida, precisamos exibir um Group para várias formas selecionadas. Ao contrário do Transformer de seleção única, o Group da seleção múltipla não precisa considerar `rotation` e `scale`.

```ts
export class RenderTransformer extends System {
    getOBB(camera: Entity): OBB {
        const { selecteds } = camera.read(Transformable);

        // Single selected, keep the original OBB include rotation & scale.
        if (selecteds.length === 1 && selecteds[0].has(ComputedBounds)) {
            const { obb } = selecteds[0].read(ComputedBounds);
            return obb;
        }

        // [!code ++]
        if (selecteds.length > 1) {
            // [!code ++]
        }
    }
}
```

O efeito é o seguinte. A lógica para transformar todas as formas selecionadas durante o redimensionamento já foi apresentada na [Lição 21 - Transformar formas], então não vamos repeti-la aqui:

<MultiSelection />

## Seleção por letreiro {#marquee-selection}

A imagem a seguir vem de [Select layers and objects in Figma]

![Letreiro de seleção no Figma](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042ec04286350d088ba04/file-tAFIn9Cimd.gif)

Essa ferramenta de seleção por letreiro se chama "marquee". Veja: [Make selections with the Rectangular Marquee tool]. Chamamos a área retangular formada de pincel (Brush).

Quando a seleção por letreiro termina (mouse up), primeiro precisamos ocultar o retângulo do pincel (vamos ver a implementação na próxima seção) e depois usar o método rápido de picking apresentado na [Lição 8 - Usar indexação espacial para aceleração]. Como a largura e a altura do retângulo podem ser negativas, conforme a direção do arraste, é preciso fazer alguns cálculos para garantir que a BBox seja válida:

```ts
if (input.pointerUpTrigger) {
    if (selection.mode === SelectionMode.BRUSH) {
        // Hide Brush...

        if (selection.brush) {
            const { x, y, width, height } = selection.brush.read(Rect);
            // Make a valid BBox
            const minX = Math.min(x, x + width);
            const minY = Math.min(y, y + height);
            const maxX = Math.max(x, x + width);
            const maxY = Math.max(y, y + height);
            const selecteds = api
                .elementsFromBBox(minX, minY, maxX, maxY) // Use space index
                .filter((e) => !e.has(UI))
                .map((e) => api.getNodeByEntity(e));
            api.selectNodes(selecteds); // Finish selection
        }
    }
}
```

Durante a seleção por letreiro, também queremos mostrar o estado da seleção em tempo real, com destaque e Transformer. Com base na lógica de picking e seleção acima, adicionamos o destaque:

![Destaque ao arrastar a seleção](/brush.gif)

```ts
api.selectNodes(selecteds);
// [!code ++]
if (needHighlight) {
    api.highlightNodes(selecteds); // [!code ++]
}
```

É claro que, para componentes no espaço do viewport, também dá para implementá-los com SVG, como vamos ver na ferramenta Laço a seguir.

## Desmarcar com Esc {#deselect-with-esc}

Pressionar <kbd>Esc</kbd> com algo selecionado cancela a seleção. Além disso, durante a seleção por letreiro, precisamos ocultar o pincel:

```ts
if (input.key === 'Escape') {
    api.selectNodes([]);
    if (selection.mode === SelectionMode.BRUSH) {
        this.hideBrush(selection);
    }
}
```

## Bloquear e desbloquear camadas {#lock-and-unlock-layers}

Camadas bloqueadas não podem ser selecionadas. Para detalhes, veja: [Lock and unlock layers]

## Seleção laço {#lasso-selection}

Em comparação com a Ferramenta Letreiro Retangular, a Ferramenta Laço permite seleções mais precisas, criando polígonos irregulares.

-   [Feature Request: Lasso Selection (free selection) in Excalidraw]
-   [lasso-tool-figma]

Na edição de imagem baseada em IA, a ferramenta laço também pode criar máscaras com mais precisão para fazer inpainting. A imagem abaixo mostra o efeito no Figma, em que as áreas selecionadas podem ser apagadas ou separadas em camadas:

![fonte: https://help.figma.com/hc/en-us/articles/24004542669463-Make-or-edit-an-image-with-AI#h_01KBJQAF0G6X98H5JJ8GBAPTGP](https://help.figma.com/hc/article_attachments/36912285044247)

### Desenhar o laço {#draw-lasso}

Na [Lição 25 - Ferramenta lápis], vimos como desenhar caminhos de polilinha livremente. Continuamos desenhando os caminhos do laço dentro do contêiner SVG, em geral representados por linhas tracejadas com animação (formigas marchando).

```html
<path d="...">
    <animate
        attribute-name="stroke-dashoffset"
        stroke-dasharray="7 7"
        stroke-dashoffset="10"
        from="0"
        to="-14"
        dur="0.3s"
    />
</path>
```

Primeiro, converta as coordenadas dos pontos do sistema de coordenadas do viewport para o da tela. Depois, simplifique o caminho de acordo com o zoom atual da câmera: em zoom alto, a seleção precisa de granularidade mais fina, e o contrário em zoom baixo. Menos vértices também melhoram o desempenho da renderização e a eficiência da detecção de interseção que vem a seguir:

```ts
import simplify from 'simplify-js';

const lassoPath = super
    .getCurrentTrail()
    ?.originalPoints?.map(([x, y]) => this.api.viewport2Canvas({ x, y }));

const simplifyDistance = 5 / this.api.getAppState().cameraZoom;
const points = simplify(lassoPath, simplifyDistance).map((p) => [p.x, p.y]);
// Hit-test the current path as it changes for preview, and again on pointerup
// before clearing the trail to commit the final selection.
const selected = selectByLassoPath(this.api, points);
```

<Lasso />

Arraste ao redor das formas para ver os acertos na hora: os contornos aparecem ou somem conforme o laço muda. O laço incompleto se fecha sozinho de volta ao ponto inicial para o teste de acerto. Solte para confirmar a seleção final em um único passo de desfazer. Pressione Escape, cancele o gesto de toque, inicie um gesto de pinça ou troque de ferramenta para limpar a prévia sem selecionar. Toques e movimentos mínimos não selecionam nada. Escolha a ferramenta laço de novo para outra seleção. O modo de desenho de máscara cria o caminho só ao soltar e não mostra a prévia da seleção de formas.

O teste de acerto usa coordenadas de mundo, incluindo as transformações pai de cada forma, a rotação e os espelhamentos. Polilinhas abertas são testadas segmento a segmento, sem uma aresta de fechamento implícita. Formas bloqueadas e ocultas ficam de fora.

### Detecção de interseção de polígonos {#polygon-intersection}

Com o Path criado, precisamos obter a geometria da cena que o intersecta. Como antes, começamos pela [Lição 8 - Usar indexação espacial para aceleração].

```ts
function selectByLassoPath(api: API, lassoPath: [number, number][]) {
    const lassoBounds = lassoPath.reduce(
        (acc, item) => {
            return [
                Math.min(acc[0], item[0]),
                Math.min(acc[1], item[1]),
                Math.max(acc[2], item[0]),
                Math.max(acc[3], item[1]),
            ];
        },
        [Infinity, Infinity, -Infinity, -Infinity],
    ) as [number, number, number, number];

    // Hit-test with rbush
    const elements = api.elementsFromBBox(
        lassoBounds[0],
        lassoBounds[1],
        lassoBounds[2],
        lassoBounds[3],
    );

    // elementsFromBBox excludes locked elements; also filter UI and hidden nodes.
}
```

Depois da detecção rápida pela caixa delimitadora, dois casos precisam ser tratados: o laço está inteiramente dentro do gráfico; o laço intersecta o gráfico.

```ts
function isPolygonsIntersect(points1: number[][], points2: number[][]) {
    let isIn = false;
    // Determine whether a point lies inside a polygon. If any point is inside another polygon, return true.
    points2.forEach((point) => {
        if (isPointInPolygon(points1, point[0], point[1])) {
            isIn = true;
            return false;
        }
    });
    if (isIn) {
        return true;
    }
}
```

## Leitura adicional {#extended-reading}

-   [How do I determine if two convex polygons intersect?]

[Lição 14 - Modo de seleção]: /pt-BR/guide/lesson-014#select-mode
[Lição 21 - Transformer]: /pt-BR/guide/lesson-021
[Lição 21 - Transformar formas]: /pt-BR/guide/lesson-021#transform-shape
[Select layers and objects in Figma]: https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
[Make selections with the Rectangular Marquee tool]: https://helpx.adobe.com/photoshop/using/tool-techniques/rectangular-marquee-tool.html
[Lição 8 - Usar indexação espacial para aceleração]: /pt-BR/guide/lesson-008#using-spatial-indexing
[lasso-tool-figma]: https://github.com/kernel-picnic/lasso-tool-figma
[Feature Request: Lasso Selection (free selection) in Excalidraw]: https://github.com/excalidraw/excalidraw/issues/6350
[Lição 25 - Ferramenta lápis]: /pt-BR/guide/lesson-025#pencil-tool
[How do I determine if two convex polygons intersect?]: https://stackoverflow.com/questions/753140/how-do-i-determine-if-two-convex-polygons-intersect
[Lock and unlock layers]: https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers
