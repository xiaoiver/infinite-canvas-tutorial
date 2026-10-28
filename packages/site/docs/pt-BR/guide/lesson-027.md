---
outline: deep
description: 'Encaixe e alinhamento'
head:
    - ['meta', { property: 'og:title', content: 'Lição 27 - Encaixe e alinhamento' }]
---

<script setup>
import SnapToPixelGrid from '../../components/SnapToPixelGrid.vue'
import SnapToObjects from '../../components/SnapToObjects.vue'
</script>

# Lição 27 - Encaixe e alinhamento {#lesson-27-snap-and-align}

O encaixe é um recurso comum em aplicativos de edição gráfica. A ideia central é alinhar automaticamente os limites ou os pontos de ancoragem dos elementos às linhas mais próximas da grade de pixels, ou a outros gráficos, ao mover, desenhar ou escalar elementos. Nesta lição, vamos apresentar a implementação.

## Encaixar na grade de pixels {#snap-to-pixel-grid}

Na [Lição 5 - Desenhar grades], vimos como desenhar grades de linhas retas com eficiência. Em algumas interações de arraste, como mover e desenhar, encaixar na unidade mínima da grade garante que a posição ou a informação geométrica dos gráficos seja inteira. No Figma, esse recurso se chama "Snap to pixel grid" e pode ser ativado em "User Preferences".

![Encaixe na grade de pixels](https://user-images.githubusercontent.com/490574/85198268-4ff5f300-b322-11ea-897e-602ef5936995.gif)

Fonte: [Snap to grid in Excalidraw].

```ts
export interface AppState {
    snapToPixelGridEnabled: boolean; // [!code ++]
    snapToPixelGridSize: number; // [!code ++]
}
```

Para implementar esse recurso, primeiro calculamos as coordenadas dos pontos no sistema de coordenadas do mundo. Quando o usuário arrasta, escala ou desenha gráficos, obtemos as coordenadas atuais (como x, y) e arredondamos essas coordenadas para o inteiro mais próximo (ponto de pixel) ou para o espaçamento de grade indicado:

```ts
// Snap to custom grid (e.g. 10px)
function snapToGrid(value, gridSize = 10) {
    return Math.round(value / gridSize) * gridSize;
}
```

Depois, aplique essa função de processamento em todos os Systems que precisam calcular coordenadas de pontos no sistema de coordenadas do mundo (como Select e DrawRect):

```ts
let { x: sx, y: sy } = api.viewport2Canvas({
    x: prevX,
    y: prevY,
});
let { x: ex, y: ey } = api.viewport2Canvas({
    x,
    y,
});
const { snapToPixelGridEnabled, snapToPixelGridSize } = api.getAppState(); // [!code ++]
// [!code ++]
if (snapToPixelGridEnabled) {
    // [!code ++]
    sx = snapToGrid(sx, snapToPixelGridSize);
    // [!code ++]
    sy = snapToGrid(sy, snapToPixelGridSize);
    // [!code ++]
    ex = snapToGrid(ex, snapToPixelGridSize);
    // [!code ++]
    ey = snapToGrid(ey, snapToPixelGridSize);
    // [!code ++]
}
```

No exemplo abaixo, definimos `snapToPixelGridSize` como 10. Você pode ver o efeito arrastando, movendo e desenhando:

<SnapToPixelGrid />

## Encaixe no nível do objeto {#snap-to-objects}

A implementação do encaixe no Excalidraw se divide nestes passos principais:

-   Verificar se a operação atual permite encaixe ([isSnappingEnabled]).
-   Calcular todos os pontos e intervalos encaixáveis ([getPointSnaps]).
-   Calcular em tempo real os deslocamentos de encaixe e as linhas-guia durante as operações de arraste e escala ([snapDraggedElements] / [snapResizingElements]).
-   Passar snapLines para a camada de UI e renderizar as linhas-guia na tela ([renderSnaps]).

Abaixo, vamos implementar isso seguindo os passos acima.

O encaixe em objetos funciona de forma independente da grade de pixels. `snapToObjectsDistance` é um raio em pixels CSS, então o zoom não muda a distância de atração percebida. Durante o movimento, calcule o candidato a partir da geometria do pointer-down e do deslocamento bruto do ponteiro; aplique o encaixe só à posição exibida. Alimentar a posição já encaixada na amostra seguinte faria o objeto ser puxado de volta para a guia o tempo todo.

O movimento oferece suporte ao alinhamento de borda e centro da caixa delimitadora e a guias de intervalos iguais. O redimensionamento encaixa a borda ou o canto em movimento nas bordas e nos centros de outros objetos, preservando a borda oposta, as restrições de proporção e a escala centralizada. Em objetos rotacionados, a alça em movimento é alinhada em coordenadas de mundo. As referências excluem objetos ocultos ou fora da tela e os ancestrais e descendentes da seleção. Esses são os comportamentos implementados; a distribuição de intervalos no redimensionamento, a correspondência de tamanhos iguais e o encaixe durante o desenho ficam como trabalho seguinte, então isto ainda não equivale por completo ao Figma.

### O encaixe está ativado {#is-snapping-enabled}

Adicionamos as seguintes opções de configuração aos ajustes do aplicativo, que também podem ser ativadas no “Menu de preferências”:

```ts
export interface AppState {
    snapToObjectsEnabled: boolean; // [!code ++]
}
```

Disparado ao mover ou redimensionar formas selecionadas:

![fonte: https://github.com/excalidraw/excalidraw/issues/263#issuecomment-577605528](https://user-images.githubusercontent.com/5153846/72973602-d804ba80-3dcd-11ea-9717-05448160044c.gif)

### Obter pontos de encaixe {#get-point-snaps}

Os pontos de encaixe se dividem em duas categorias: formas selecionadas e as demais formas. Para uma ou mais formas selecionadas, os pontos de encaixe comuns incluem os quatro cantos e o centro da caixa delimitadora:

```ts
const { minX, minY, maxX, maxY } = api.getGeometryBounds(
    elements.map((id) => api.getNodeById(id)),
);
const boundsWidth = maxX - minX;
const boundsHeight = maxY - minY;
return [
    [minX, minY], // corners
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
    [minX + boundsWidth / 2, minY + boundsHeight / 2], // center
] as [number, number][];
```

Pensando no desempenho, devemos reduzir ao máximo quantas vezes detectamos os pontos de contato da forma selecionada em relação a todas as outras formas. Já tratamos de questões parecidas na [Lição 8 - Usar indexação espacial], em que só recuperamos as formas dentro do viewport.

```ts
const unculledAndUnselected = api
    .getNodes()
    .map((node) => api.getEntity(node))
    .filter((entity) => !entity.has(Culled) && !entity.has(Selected));
```

Da mesma forma, calcule os pontos de referência dessas formas:

```ts
const referenceSnapPoints: [number, number][] = unculledAndUnselected
    .map((entity) => getElementsCorners(api, [api.getNodeByEntity(entity).id]))
    .flat();
```

Em seguida, compare um a um os pontos de encaixe da forma selecionada com os das outras formas. Identifique o par de pontos mais próximo na horizontal ou na vertical e registre a diferença de distância como a distância de encaixe seguinte:

```ts
nearestSnapsX.push({
    type: 'point',
    points: [thisSnapPoint, otherSnapPoint],
    offset: offsetX,
});
minOffset[0] = Math.abs(offsetX);
```

Depois que todos os pontos de encaixe forem calculados, essa distância mínima pode ser usada como distância de encaixe. É importante notar que, nesta etapa, o gráfico ainda não se moveu de acordo com a distância de encaixe. Por isso, precisamos supor que o gráfico já chegou à posição final e fazer outra rodada de cálculos:

```ts
// 1st round
getPointSnaps();
const snapOffset: [number, number] = [
    nearestSnapsX[0]?.offset ?? 0,
    nearestSnapsY[0]?.offset ?? 0,
];

// Clear the min offset
minOffset[0] = 0;
minOffset[1] = 0;
nearestSnapsX.length = 0;
nearestSnapsY.length = 0;
const newDragOffset: [number, number] = [
    round(dragOffset[0] + snapOffset[0]),
    round(dragOffset[1] + snapOffset[1]),
];

// 2nd round, a new offset must be considered.
getPointSnaps(newDragOffset);

// Render snap lines
```

### Obter encaixes de intervalo {#get-gap-snaps}

Além da forma selecionada na tela, outras formas podem formar pares com intervalos entre elas. O diagrama no código do Excalidraw ilustra isso bem. Tome `horizontalGap` como exemplo:

```ts
// https://github.com/excalidraw/excalidraw/blob/f55ecb96cc8db9a2417d48cd8077833c3822d64e/packages/excalidraw/snapping.ts#L65C1-L81C3
export type Gap = {
    //  start side ↓     length
    // ┌───────────┐◄───────────────►
    // │           │-----------------┌───────────┐
    // │  start    │       ↑         │           │
    // │  element  │    overlap      │  end      │
    // │           │       ↓         │  element  │
    // └───────────┘-----------------│           │
    //                               └───────────┘
    //                               ↑ end side
    startBounds: Bounds;
    endBounds: Bounds;
    startSide: [GlobalPoint, GlobalPoint];
    endSide: [GlobalPoint, GlobalPoint];
    overlap: InclusiveRange;
    length: number;
};
```

Se a caixa delimitadora da forma selecionada não se sobrepõe ao intervalo, pule a detecção.

```ts
for (const gap of horizontalGaps) {
    if (!rangesOverlap([minY, maxY], gap.overlap)) {
        continue;
    }
}
```

Detecte, em sequência, o ponto central, a borda direita e a borda esquerda:

```ts
// center
if (gapIsLargerThanSelection && Math.abs(centerOffset) <= minOffset[0]) {
}
// side right
if (Math.abs(sideOffsetRight) <= minOffset[0]) {
}
// side left
if (Math.abs(sideOffsetLeft) <= minOffset[0]) {
}
```

Se a condição for atendida, registre. Durante o processo, continue registrando a distância mínima:

```ts
const snap: GapSnap = {
    type: 'gap',
    direction: 'center_horizontal',
    gap,
    offset: centerOffset,
};
nearestSnapsX.push(snap);
```

### Renderizar linhas de encaixe {#render-snap-lines}

Renderize as linhas de encaixe no contêiner SVG. Veja: [Lição 26 - Seleção laço].

Os pontos de encaixe costumam ser representados por uma “cruz”, e as linhas que ligam esses pontos podem ser renderizadas com `<line>`.

```ts
renderSnapLines(
    api: API,
    snapLines: { type: string; points: [number, number][] }[],
) {
    const { svgSVGElement } = this.selections.get(api.getCamera().__id);
    this.clearSnapLines(api);

    snapLines.forEach(({ type, points }) => {
        if (type === 'points') {
            const pointsInViewport = points.map((p) =>
                api.canvas2Viewport({ x: p[0], y: p[1] }),
            );
            const line = createSVGElement('polyline') as SVGPolylineElement;
            svgSVGElement.appendChild(line);
        }
    });
}
```

Quanto à exibição das linhas de encaixe de intervalo, a documentação do Excalidraw é bem ilustrativa. A partir dela, podemos adicionar rótulos de texto com a distância abaixo das linhas auxiliares (direção horizontal) ou à direita delas (direção vertical), como o Figma faz:

```ts
// a horizontal gap snap line
// |–––––––||–––––––|
// ^    ^   ^       ^
// \    \   \       \
// (1)  (2) (3)     (4)
```

![Exibição das linhas de encaixe de intervalo e dos rótulos de distância](/snap-to-objects.gif)

Mova ou redimensione o retângulo do meio abaixo. Use os controles independentes para comparar o encaixe em objetos e o encaixe na grade de pixels:

<SnapToObjects />

## Leitura adicional {#extended-reading}

-   [How to snap shapes positions on dragging with Konva?]
-   [Custom snapping in tldraw]

[Lição 5 - Desenhar grades]: /pt-BR/guide/lesson-005
[How to snap shapes positions on dragging with Konva?]: https://konvajs.org/docs/sandbox/Objects_Snapping.html
[Snap to grid in Excalidraw]: https://github.com/excalidraw/excalidraw/issues/521
[Custom snapping in tldraw]: https://tldraw.dev/examples/bounds-snapping-shape
[isSnappingEnabled]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L162C14-L162C31
[getPointSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L636
[snapDraggedElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L692
[snapResizingElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L1108C14-L1108C34
[renderSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/renderer/renderSnaps.ts
[Lição 8 - Usar indexação espacial]: /pt-BR/guide/lesson-008#using-spatial-indexing
[Lição 26 - Seleção laço]: /pt-BR/guide/lesson-026#lasso-selection
