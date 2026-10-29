---
outline: deep
description: 'Explore o VectorNetwork como alternativa avançada aos caminhos SVG. Aprenda definições de topologia, vértices e arestas compartilhados, algoritmos de preenchimento e operadores topológicos para editar gráficos vetoriais complexos.'
head:
    - ['meta', { property: 'og:title', content: 'Lição 22 - VectorNetwork' }]
---

<script setup>
import VectorNetwork from '../../components/VectorNetwork.vue';
import VectorNetworkCube from '../../components/VectorNetworkCube.vue';
import VectorNetworkFaceCut from '../../components/VectorNetworkFaceCut.vue';
</script>

# Lição 22 - VectorNetwork {#lesson-22-vectornetwork}

Nesta lição, você vai aprender:

-   Limitações do Path SVG
-   O que é VectorNetwork?
-   Usar a ferramenta Caneta para modificar um Path
-   Duplo clique para entrar no modo de edição vetorial e as ferramentas Move / Bend / Cut / Fill
-   Operadores topológicos: dividir segmento, excluir vértice e Cut para abrir um laço fechado

## Limitações do Path SVG {#limitations-of-svg-path}

Em [Lição 13 - Desenhar caminho e estilo de esboço] vimos como desenhar caminhos. O Figma também oferece a [VectorPath API], que aceita um subconjunto dos comandos de Path SVG (veja [VectorPath-data]) e [fillRule] (chamado windingRule no Figma).

```ts
node.vectorPaths = [
    {
        windingRule: 'EVENODD',
        data: 'M 0 100 L 100 100 L 50 0 Z',
    },
];
```

Então, por que introduzir a [VectorNetwork API]? Porque o Path SVG tem limitações inerentes. O artigo [The Engineering behind Figma's Vector Networks] mostra isso com clareza. A forma a seguir não pode ser descrita com um único Path:

![Caminhos inválidos](https://alexharri.com/images/posts/vector-networks/3.svg)

Ela só pode ser descrita se for dividida em vários Paths. Isso é possível, mas algumas operações intuitivas não acontecem na edição. Por exemplo, ao arrastar o vértice central no canto inferior esquerdo, só um vértice acompanha o gesto, porque a forma é feita de dois Paths independentes:

![Vários caminhos criam formas mais complexas](https://alexharri.com/images/posts/vector-networks/4.svg)

Além de os vértices não poderem ter mais de 2 arestas, as arestas também não podem ser compartilhadas. O artigo e o PPT originais de [Vector Graphics Complexes] comparam SVG e mapas planares. Nenhum dos dois aceita sobreposição, vértices compartilhados e arestas compartilhadas, o que leva a uma nova representação geométrica (daqui em diante, VGC):

![Comparação entre SVG e mapas planares](/svg-path-vector-network-comparison.jpeg)

O [vpaint] é implementado com base no VGC. Dá para ver como a interação fica natural na edição, depois de unir pontos e arestas:

![vpaint](https://camo.githubusercontent.com/42f888c041ecc6799e9fe2bd3c895fcd8037417188a0d1db840e0ce0701a5201/68747470733a2f2f7777772e7667632e696f2f696d616765732f676c75652d30312d332d32346670732e676966)

Ou, no exemplo de arrastar uma aresta de um cubo, de [The Engineering behind Figma's Vector Networks]:

![Arrastar uma aresta do cubo](https://alexharri.com/images/posts/vector-networks/31.svg)

Dê um duplo clique para entrar no modo de edição e, em seguida, arraste qualquer aresta do cubo:

<VectorNetworkCube />

Vale mencionar que a [Discussion in HN] aponta a semelhança notável entre o VGC e o VectorNetwork do Figma. Como os dois começaram a exploração por volta da mesma época e chegaram a soluções parecidas por caminhos diferentes, daqui em diante usamos o termo VectorNetwork.

> Aqui é o CEO do Figma. A maior parte das ideias originais sobre redes vetoriais é de 2013, embora tenhamos continuado a polir a implementação ao longo do tempo. Só saímos do modo stealth e lançamos o beta fechado do Figma em dezembro de 2015, e é por isso que não há conteúdo de blog antes disso.
> À primeira vista, esta tese parece excelente! Estou animado para lê-la! Não acredito que a tenha visto antes, o que surpreende diante de tanta sobreposição.

Vamos ver como o VectorNetwork é definido.

## Definição topológica do VectorNetwork {#topology-of-vector-network}

A definição de VectorNetwork/VGC é bem mais complexa do que a de Path. A estrutura de dados é um grafo de vértices, arestas e faces (regiões preenchidas). A imagem a seguir vem do artigo original [Vector Graphics Complexes].

![Topologia do VGC](/vgc-topology.png)

Aqui tratamos só da definição topológica. Os outros atributos de desenho podem continuar iguais aos do Path:

> Sobre essa estrutura central, é possível acrescentar mais atributos de desenho para um controle fino da renderização. Por exemplo, adicionamos raio do vértice, largura variável da aresta, cor da célula (possivelmente transparente) e o estilo das junções das arestas (junção em meia-esquadria ou em bisel).

Os vértices são fáceis de entender. No VGC, as arestas são um par de índices de vértice `start` e `end`, e formam um laço próprio quando coincidem.

![Nós e arestas no VGC](/vgc-node-edge.png)

As regiões preenchidas são definidas por laços fechados de vértices. No VGC, elas usam um conjunto de meias-arestas:

![Faces no VGC](/vgc-face.png)

O triângulo a seguir vem da [VectorNetwork API]. Ele é basicamente consistente com o VGC, com a diferença de que as regiões preenchidas são definidas por índices de vértice e fillRule. Outros atributos não geométricos, como `strokeCap`, continuam iguais aos do Path:

```ts
node.vectorNetwork = {
    // The vertices of the triangle
    vertices: [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        { x: 50, y: 0 },
    ],

    // The edges of the triangle. 'start' and 'end' refer to indices in the vertices array.
    segments: [
        {
            start: 0,
            tangentStart: { x: 0, y: 0 }, // optional
            end: 1,
            tangentEnd: { x: 0, y: 0 }, // optional
        },
        {
            start: 1,
            end: 2,
        },
        {
            start: 2,
            end: 0,
        },
    ],

    // The loop that forms the triangle. Each loop is a
    // sequence of indices into the segments array.
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }],
};
```

Seguindo a convenção do Figma para cúbicas: *P*₀ é a âncora inicial, *P*₃ a âncora final, *P*₁ = *P*₀ + `tangentStart`, *P*₂ = *P*₃ + `tangentEnd`. Quando as duas alças coincidem com as âncoras (reta), use dois pontos; caso contrário, amostre com `CubicBezierCurve.getPoints`, escolhendo a quantidade de segmentos a partir do comprimento da corda e do casco de controle (cerca de 8–64).

Na edição, vértices e arestas são definidos por quem usa a ferramenta, e as regiões preenchidas precisam ser calculadas automaticamente pelo sistema. Como encontrar essas regiões?

### Preenchimento {#filling}

Em operações como `click to fill`, é preciso encontrar o menor laço formado pelos vértices.

![Fonte: https://www.figma.com/blog/introducing-vector-networks/](https://alexharri.com/images/posts/vector-networks/40.gif)

Tratamos o VectorNetwork como um grafo planar e dividimos cada segmento em duas meias-arestas direcionadas. Em cada vértice, ordenamos as arestas de saída pelo ângulo polar; percorrer a "próxima meia-aresta" (a aresta de saída mais no sentido horário em relação à aresta reversa de entrada) enumera cada face mínima. A menor face que contém a posição do clique é a região alvo, e gravar o laço ordenado de índices de segmento em `VectorRegion.loops` reaproveita a tesselação de preenchimento acima.

```ts
export function findRegionLoopAtPoint(
    vertices: VectorVertexLike[],
    segments: VectorSegmentLike[],
    point: [number, number],
): number[] | null;
```

> Robustez numérica: arestas colineares, vértices coincidentes e laços próprios precisam de uma tolerância EPS e de tratamento de casos degenerados; a face externa ilimitada tem área com sinal positiva nessa travessia e deve ser ignorada.

### Converter para VectorNetwork {#convert-to-vector-network}

Seguindo [figma-fill-rule-editor], usamos estas definições de tipo:

```ts
export class VectorNetwork {
    @field.object declare vertices: VectorVertex[];
    @field.object declare segments: VectorSegment[];
    @field.object declare regions?: VectorRegion[];
}

interface VectorVertex {
    x: number;
    y: number;
    strokeLinecap?: Stroke['linecap'];
    strokeLinejoin?: Stroke['linejoin'];
    cornerRadius?: number;
    handleMirroring?: HandleMirroring;
}

interface VectorSegment {
    start: number;
    end: number;
    tangentStart?: VectorVertex;
    tangentEnd?: VectorVertex;
}

interface VectorRegion {
    fillRule: CanvasFillRule;
    loops: ReadonlyArray<ReadonlyArray<number>>;
}
```

[Polyline] é a geometria mais fácil de converter em um VectorNetwork:

```ts
class VectorNetwork {
    static fromEntity(entity: Entity): VectorNetwork {
        if (entity.has(Polyline)) {
            const { points } = entity.read(Polyline);
            const vertices: VectorVertex[] = points.map(([x, y]) => ({ x, y }));
            const segments: VectorSegment[] = points.slice(1).map((_, i) => ({
                start: i,
                end: i + 1,
            }));

            return { vertices, segments };
        }
    }
}
```

Converter um [Path] exige mais trabalho: depois de normalizar os comandos do caminho SVG (`path2Absolute`), cada comando é analisado por vez. `M/L/H/V` emitem segmentos retos; `C/S/Q/T` emitem cúbicas (`Q/T` são elevados primeiro a cúbicas), convertendo os pontos de controle absolutos em tangentes relativas no estilo do Figma, `tangentStart = P1 - P0` e `tangentEnd = P2 - P3`; `S/T` acompanham o ponto de controle anterior para a reflexão; em `Z`, se o último ponto coincide com o início, o vértice inicial é reutilizado para evitar duplicatas, e um subcaminho fechado emite um laço de região. Isso fica na função pura `pathToVectorNetwork(d, fillRule)`, que `fromEntity` chama quando `entity.has(Path)`.

## Tesselação {#tessellatation}

### Traço {#stroke}

Transformamos o grafo em polilinhas e as renderizamos com a abordagem de [Lição 12 - Desenhar polilinha].

-   Mantenha a adjacência de cada vértice.
-   Percorra as arestas ainda não usadas: estenda para a frente e para trás a partir de uma aresta inicial, continuando só quando o vértice atual tem exatamente uma aresta não usada restante, para que junções de grau 2 virem uma única polilinha (junção em vez de tampa).
-   Pare nas ramificações (grau ≥ 3); separe subcaminhos com `NaN`.

Para cada aresta percorrida:

-   Use a cúbica do Figma: *P*₀ e *P*₃ são âncoras, *P*₁ = *P*₀ + `tangentStart`, *P*₂ = *P*₃ + `tangentEnd`.
-   Arestas retas (alças nas âncoras) usam dois pontos.
-   Nos outros casos, use `CubicBezierCurve.getPoints` com uma quantidade de segmentos derivada do comprimento da corda e do casco de controle.

```ts
function tessellateVectorSegment(
    vertices: VectorVertexLike[],
    seg: VectorSegmentLike,
): number[] {
    const a = vertices[seg.start];
    const b = vertices[seg.end];
    const p0 = vec2.fromValues(a.x, a.y);
    const p3 = vec2.fromValues(b.x, b.y);

    const ts = seg.tangentStart;
    const te = seg.tangentEnd;
    const p1 = vec2.create();
    const p2 = vec2.create();
    vec2.add(p1, p0, vec2.fromValues(ts?.x ?? 0, ts?.y ?? 0));
    vec2.add(p2, p3, vec2.fromValues(te?.x ?? 0, te?.y ?? 0));
}
```

<VectorNetwork />

### Preenchimento {#fill}

Percorra cada entrada `loops` do Figma (índices de segmento ordenados), tessele cada aresta, inclusive as cúbicas, com o mesmo `tessellateVectorSegment`, una na ordem da travessia, descarte pontos duplicados e feche o anel.

-   Para cada região e cada laço, construa um contorno fechado.
-   **nonzero** (ou `windingRule: 'NONZERO'` do Figma): use `triangulate` (libtess) com enrolamento nonzero em todos os contornos, com suporte a ilhas desconectadas e buracos aninhados, qualquer que seja a ordem dos contornos.
-   **evenodd** (ou `EVENODD`): `triangulate` (libtess).
-   Várias regiões são trianguladas em sequência; vértices e índices são concatenados em uma malha, com um deslocamento acumulado de vértices.

### Clicar para preencher uma região {#click-to-fill}

Dê um duplo clique em um VectorNetwork e escolha **Fill**. Ao passar o cursor, a menor face fechada aparece na pré-visualização; clique para preenchê-la e clique de novo para limpá-la. Cada clique é um passo de desfazer. Arrastes, ponteiros cancelados e zoom multitoque não confirmam um preenchimento. Trocar de ferramenta, pressionar Esc, clicar na tela vazia fora da forma ou destruir a tela limpa a pré-visualização.

Experimente o cubo abaixo, que começa no modo **Fill**. Passe o cursor sobre a face da frente, de cima ou da direita para pré-visualizá-la e clique para preenchê-la. Preencha duas faces vizinhas e clique de novo em qualquer uma delas: só essa face é limpa. Use os botões **Undo / Redo** da tela para percorrer as mudanças.

<VectorNetworkCube fill />

No modo **Fill**, clique na amostra de cor ao lado dos botões de ferramenta para abrir o seletor de cor. Escolha uma cor ou informe um valor antes de clicar em uma face. Mudar a cor também atualiza todas as faces já preenchidas desta rede; mudanças de cor podem ser desfeitas. Por enquanto, as faces compartilham um único estilo de preenchimento.

`findVectorNetworkFaces` percorre meias-arestas direcionadas e anexa, como buracos, os limites exteriores de componentes desconectados fechados. Pré-visualizações e regiões recém-criadas usam `evenodd`, então os buracos não dependem da direção em que as arestas estão armazenadas. Preenchimentos `nonzero` / `evenodd` já existentes são resolvidos em faces mínimas pela cobertura; limpar uma face preserva os preenchimentos vizinhos.

As faces compartilham os `fills` do nó. O primeiro preenchimento de uma rede que só tem traço usa o preenchimento visível configurado na caneta e, se não houver, cai no azul. As pré-visualizações ficam em uma sobreposição SVG transitória e nunca entram no documento, nas exportações ou no histórico. O picking usa coordenadas locais e aceita rotação, reflexão e escala.

O Fill divide cruzamentos em vértices compartilhados numa geometria temporária antes de encontrar as faces. Passar o cursor não altera o documento: o primeiro clique de preenchimento confirma topologia e pintura, e um desfazer restaura as duas. Pintura independente por face continua sendo uma extensão à parte.

## Desenhar com a caneta {#drawing-with-pen}

Escolha a caneta **Vector Network**. Clique para colocar âncoras de canto; arraste para colocar âncoras suaves. A primeira âncora permanece uma pré-visualização transitória até a primeira aresta ser confirmada, então abandonar um único ponto não cria um nó vazio no documento.

Um arraste define a alça de saída da nova âncora. A alça de entrada é o vetor oposto, e o vetor de saída vira o `tangentStart` da aresta seguinte. Tanto a pré-visualização em elástico quanto a geometria confirmada usam esses mesmos controles cúbicos, inclusive um arraste na primeira âncora. A pré-visualização também mostra a linha da alça.

Clique em uma âncora existente dentro de 10 pixels do viewport para fechar a rede e voltar a Select. O encaixe usa a posição do pressionamento, então arrastar a alça de fechamento para longe não cria um vértice extra. Faces fechadas são detectadas automaticamente e renderizadas com o preenchimento configurado na caneta; o estilo padrão, só com traço, permanece sem preenchimento até **Fill** ser usado. Clique na âncora ativa, ou pressione **Enter / Esc**, para terminar um caminho aberto. Um arraste não concluído é descartado.

Cada aresta confirmada é um passo de desfazer. Cancelar o ponteiro, sair da tela e trocar de ferramenta descartam o gesto pendente; as arestas confirmadas permanecem. Desfazer ou uma edição externa da geometria limpa o ponto de continuação, então o traço seguinte não pode se ligar a um vértice obsoleto. As pré-visualizações pertencem à sobreposição SVG da própria tela e ficam de fora dos nós salvos, do histórico e das exportações; destruir a tela as remove.

### Retomar uma rede existente {#resume-with-pen}

Selecione um VectorNetwork e mude para a caneta. Passe o cursor perto de um vértice existente para ver o indicador de encaixe, clique nele para começar e, em seguida, clique ou arraste a próxima âncora para acrescentar uma aresta à mesma rede. Isso estende extremidades e cria ramificações em vértices compartilhados. Escolher a primeira âncora não altera o documento; cada aresta confirmada é um passo de desfazer. Começar longe de um vértice cria uma rede separada.

A continuação aceita rotação, escala não uniforme e reflexão, com os mesmos controles cúbicos na pré-visualização e na confirmação. Alças, preenchimentos e buracos já existentes são preservados; use Fill para pintar faces recém-fechadas. Ligar a um vértice existente termina o traço, e refazer uma aresta idêntica não cria duplicata. Nós bloqueados, ocultos ou não invertíveis não podem ser retomados. Cancelar, trocar de ferramenta ou desfazer durante o desenho descarta a aresta pendente e mantém as edições concluídas.

## Curvar {#bending}

Em **Bend**, arraste diretamente um ponto interior de uma aresta. As âncoras ficam fixas enquanto o ponto da curva que você segurou acompanha o ponteiro. Arestas retas viram Béziers cúbicas. Cada atualização parte do instantâneo do pointer down, o que evita deslocamento acumulado dos controles. O picking usa coordenadas de tela, inclusive rotação, reflexão e escala não uniforme.

No parâmetro `t`, os dois pesos de controle são `a = 3(1-t)²t` e `b = 3(1-t)t²`. Para um deslocamento do ponteiro `Δ`, os controles se movem `aΔ/(a²+b²)` e `bΔ/(a²+b²)`. Isso minimiza o deslocamento quadrático dos controles e mantém o ponto segurado sob o ponteiro. Dobrar a aresta diretamente solta o acoplamento das alças nas extremidades dela; as outras arestas conservam os controles. Perto das extremidades, as interações de âncora e de alça têm prioridade.

Dê um duplo clique em uma rede vetorial, escolha **Bend** e selecione uma âncora para revelar as alças. Para âncoras com exatamente duas extremidades de aresta incidentes, **Handle coupling** oferece três modos:

-   **Independent**: mova uma alça sem alterar a outra.
-   **Align angles**: mantenha as alças em semirretas opostas e preserve o comprimento da outra alça.
-   **Mirror angle and length**: mantenha as alças opostas e com o mesmo comprimento.

Mudar o modo alinha o par na hora, usando a primeira alça diferente de zero como referência. Segure **Alt** enquanto arrasta para romper o acoplamento; a âncora permanece independente depois disso. Vértices de ramificação com três ou mais extremidades de aresta incidentes mantêm alças independentes. Um laço próprio contribui com duas extremidades. Uma alça colapsada não tem direção, então o acoplamento só de ângulo conserva a outra alça até a alça arrastada ter direção de novo.

Arestas retas mostram posições temporárias de alça apontando para a outra extremidade; arrastar uma delas cria o controle de Bézier. Esses guias não alteram a geometria salva até serem arrastados. Cada arraste concluído ou mudança de acoplamento é um passo de desfazer. **Esc**, cancelamento do ponteiro, sair da tela ou trocar de ferramenta cancela um arraste pendente e restaura a geometria original. Mudar os limites da curva preserva as posições das âncoras sob rotação, reflexão e escala.

O trecho a seguir vem de [Introducing Vector Networks - Bending]. A edição de curvas de Bézier é comum tanto no Path quanto no VectorNetwork:

> Os gráficos vetoriais de hoje se baseiam em splines de Bézier cúbicas, curvas com dois pontos extras chamados alças de controle, posicionados fora da própria curva, que controlam o quanto ela se curva, mais ou menos como um ímã puxaria um fio na direção dele. Mudar a forma de uma curva envolve arrastar uma alça de controle pelo espaço, em vez de arrastar a curva diretamente.

![Pontos de controle na aresta](https://alexharri.com/images/posts/vector-networks/39.svg)

Na definição de aresta do VectorNetwork, `tangentStart` e `tangentEnd` podem definir os dois pontos de controle de uma Bézier cúbica. Quando os dois são `[0, 0]`, ela degenera em uma reta.

Você também pode experimentar o exemplo do Konva [How to modify line points with anchors?] ou o [bezierjs].

O modo de edição por duplo clique, a barra Move / Bend / Cut / Fill e a inserção no ponto médio são tratados abaixo, em [Entrar no modo de edição e na barra de ferramentas](#vector-edit-mode).

![Modo de edição vetorial no Figma](/figma-vectornetwork-mode.png)

```ts
export enum Pen {
    SELECT = 'select',
    HAND = 'hand',
    VECTOR_NETWORK = 'vector-network', // [!code ++]
}
```

Isso é diferente da abordagem baseada em OBB de [Lição 21 - Transformer]:

-   No modo de edição, arrastar um `VectorSegment` move as duas extremidades; arestas adjacentes que compartilham esses vértices acompanham naturalmente.
-   Arrastar um `VectorVertex` move só esse vértice; cada segmento que o compartilha acompanha automaticamente. Essa é a vantagem central de uma Vector Network em relação a um Path. As novas coordenadas são gravadas por um único ponto de entrada, `API.updateNodeVectorNetwork(node, vectorNetwork)`, que atualiza o componente `VectorNetwork` da entidade e dispara a nova tesselação e o histórico (desfazer/refazer).

```ts
// packages/ecs/src/systems/Select.ts
// In handleControlPointMoving, for a vector-network node:
// 1. Read the VectorNetwork component and map the pointer back to local
//    space via the inverse of GlobalTransform.
// 2. Update vertices[activeIndex].x/y.
// 3. Call api.updateNodeVectorNetwork to write back.
```

Na gravação, `VectorNetwork.getGeometryBounds` recalcula os limites da geometria e desloca todos os vértices em `-minX/-minY`, normalizando o canto superior esquerdo para o `(0, 0)` local. Antes de somar o deslocamento de compensação a `node.x/y`, aplica a escala e a rotação do nó para expressar o deslocamento no sistema de coordenadas do pai. Reposicionar a origem, portanto, preserva as posições das âncoras no espaço de mundo. As tangentes são relativas às âncoras e não precisam de translação.

### Entrar no modo de edição e na barra de ferramentas {#vector-edit-mode}

Seguindo [Edit vector layers] do Figma, dê um duplo clique em um nó `vector-network` para entrar no modo de edição de vértices: defina `Editable.isEditing = true` na entidade e mostre, centralizada na parte de baixo, a barra **Move / Bend / Cut / Fill** (`VectorNetworkEditMode`; veja `context-vector-network-edit-bar.ts`). Sair da edição (botão de fechar da barra, Esc ou clique na tela vazia) grava `isEditing: false`; `RenderTransformer` esconde todos os pontos de edição (vértices, pontos médios de segmento e alças de tangente).

| Modo     | Interação                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Move** | Arraste vértices; passe o cursor sobre um segmento para mostrar o ponto médio e clique para inserir um vértice novo                            |
| **Bend** | Arraste uma aresta para curvá-la diretamente, ou edite as alças com três modos de acoplamento                                                   |
| **Cut**  | A mesma inserção de ponto médio de Move; **clique em um vértice** para romper a topologia no ponto de corte e passar automaticamente para Move, para afastar as partes |
| **Fill** | Passe o cursor para pré-visualizar uma face fechada; clique para alternar o preenchimento dela, preservando buracos e faces vizinhas           |

O **realce ao passar o cursor** e a **seleção** são separados nas âncoras: `Transformable.hoveredControlPointIndex` se limpa quando o ponteiro sai; `selectedControlPointIndex` permanece depois do clique até você clicar no espaço vazio ou dentro da forma.

### Move: inserir vértice no ponto médio do segmento {#insert-at-midpoint}

Ao passar o cursor sobre um segmento, desenhe uma âncora de ponto médio no meio da curva (`t = 0.5`; em arestas cúbicas, o ponto sobre a curva). Um clique chama `splitSegmentAt` (veja [Criação e exclusão](#creation--delete)) para dividir a aresta e gravar a rede. Veja `Select.insertControlPointFromMidpoint` e `RenderTransformer.findHoveredVectorNetworkSegmentIndex` (distância da curva, do viewport até o espaço local).

Move arrasta um vértice ou uma aresta inteira, movendo as duas extremidades e preservando as tangentes. Nós rotacionados, escalados e espelhados usam o sistema de coordenadas capturado no pressionamento, o que evita deriva quando os limites mudam. Um vértice encaixa perto de outro e se funde ao soltar. Esc, cancelamento do ponteiro ou troca de ferramenta restaura o gesto inteiro, inclusive um ponto médio recém-inserido. Cut confirma no clique e permanece desconectado ao soltar. Delete age sobre o vértice selecionado mesmo depois que o ponteiro se afasta.

Mudanças de geometria durante um arraste permanecem sem confirmação. Desfazer e refazer primeiro restauram a geometria do início do gesto e depois aplicam o histórico, mantendo limites e vértices da mesma edição. Se uma atualização externa substituiu a geometria ou as transformações, o gesto antigo é descartado: movimento posterior, soltar ou Escape não restauram o instantâneo obsoleto. Mudanças só de estilo não interrompem o arraste, e cancelar a geometria preserva a pintura nova. Delete durante um arraste primeiro cancela o movimento não concluído e depois exclui o vértice original selecionado; para um ponto médio recém-inserido, só cancela essa inserção.

## Operadores topológicos {#topological-operators}

### Divisão automática de interseções {#automatic-intersections}

Confirmar uma aresta da caneta, ou terminar um arraste de Move ou Bend, conecta cruzamentos transversais e junções em T dentro dessa rede. Isso cobre retas, Béziers cúbicas, vários cruzamentos e a autointerseção de uma cúbica. A subdivisão de De Casteljau preserva a forma da curva; as travessias de região e de buraco são reescritas na ordem da travessia. Os índices de vértice existentes permanecem estáveis, então a continuação da caneta ainda começa na extremidade clicada.

A topologia não muda durante um arraste. A divisão é confirmada junto com a edição da forma ao soltar; o cancelamento não deixa junções, e desfazer/refazer cobre a operação inteira. Chame `splitVectorNetworkIntersections(network)` para normalizar explicitamente uma geometria importada. A detecção usa subdivisão adaptativa e refinamento numérico; contatos tangentes, a união booleana de trechos sobrepostos e conexões entre nós separados não têm suporte. Contatos só de extremidade permanecem separados, para preservar os resultados de Cut.

O Figma aceita [Boolean operations], por exemplo união.

![fonte: https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations](https://help.figma.com/hc/article_attachments/30101990451607)

O Paper.js pode ser uma referência útil para implementações.

### Criação e exclusão {#creation--delete}

[Delete and Heal for Vector Networks]

Acrescentar um vértice: divida um segmento no parâmetro `t` em dois segmentos e insira o vértice novo (arestas cúbicas são subdivididas com de Casteljau para preservar a curva), em vez de um splice simples em um array de pontos:

```ts
export function splitSegmentAt(
    network: VectorNetworkData,
    segIdx: number,
    t: number,
): number; // Mutates network and returns the new vertex index.
```

Excluir um vértice: depois de remover o vértice e as arestas incidentes, um vizinho de grau 2 é "curado" ao fundir as duas arestas dele em uma, mantendo o caminho conectado (como o Delete and Heal do Figma). O disparo é **Delete / Backspace** no modo de edição:

```ts
export function deleteVertex(
    network: VectorNetworkData,
    vertexIdx: number,
): VectorNetworkData;
```

> Delete, break e merge devolvem uma rede nova; `splitSegmentAt` muta a cópia de rede recebida e devolve o índice do vértice inserido. Os operadores em `packages/ecs/src/utils/vector-network-topology.ts` estão desacoplados da renderização e podem ser testados sozinhos; o sistema de edição devolve o resultado deles por `API.updateNodeVectorNetwork`.

Em curvas, Heal primeiro tenta recuperar uma cúbica original que tenha sido subdividida. Se não conseguir, ajusta uma cúbica com um limite de erro verificado, por padrão 5% da extensão da caixa dos pontos de controle; `maxError` define uma tolerância em unidades locais. Se a tolerância não puder ser atingida, a rede original é mantida. **Shift + Delete / Backspace** remove o vértice e as arestas incidentes sem curar. Dividir e editar remapeiam os índices de limite na ordem da travessia e preservam regiões válidas.

### Glue e Unglue {#glue-unglue}

![Operador Glue e Unglue](/vgc-operator-glue-unglue.png)

Em **Move**, selecione um vértice e clique em **Glue / Unglue** (o ícone de corrente). O painel rotula os vértices **V1, V2, …** e as arestas incidentes **E1, E2, …** na tela.

-   **Glue**: escolha um vértice alvo e confirme. O vértice selecionado vai até o alvo e as conexões dos dois se combinam. Curvas distintas e laços próprios curvos são mantidos; arestas idênticas se fundem.
-   **Unglue**: marque as extremidades de aresta a soltar e confirme. Um vértice novo é criado na mesma posição, ligado só a essas extremidades. Ele fica selecionado para você arrastá-lo para longe na hora. Mantenha pelo menos uma extremidade ligada ao vértice original. O início e o fim de um laço próprio podem ser escolhidos separadamente.

Experimente selecionar a junção superior direita da frente do cubo, abra **Glue / Unglue** e solte **E7 · Start**. Arraste a cópia selecionada para longe e, em seguida, use **Glue** com **V3** como alvo para juntá-la de volta.

<VectorNetworkCube topology />

A pré-visualização não modifica o documento. Cancelar a fecha sem mudar a geometria; uma atualização externa da geometria, desfazer ou sair do modo de edição invalida a operação pendente. Cada operação confirmada é um passo de desfazer. Unglue preserva a geometria das curvas e as regiões que continuam fechadas; abrir um limite externo ou um buraco remove a região de preenchimento afetada inteira. Glue restaura a conectividade, mas não restaura sozinho os preenchimentos removidos: use Fill de novo, ou Undo para restaurar o estado anterior completo.

`glueVertices(network, source, target)` e `unglueVertex(network, vertex, endpoints)` devolvem um `VectorTopologyResult`: ou um motivo de falha, ou a rede nova, os mapas de índice de vértice/segmento e o índice do vértice selecionado. As extremidades usam `{ segmentIndex, end: 'start' | 'end' }`; os índices na API começam em zero. As entradas não são mutadas. Este primeiro estágio opera em vértices dentro de uma rede; as operações de aresta compartilhada e de face são descritas abaixo.

#### Glue / Unglue de aresta compartilhada {#shared-edge-glue-unglue}

Em **Move**, selecione uma extremidade e abra **Glue / Unglue**; em seguida, defina **Topology target** como **Edges**. Escolha uma **Source edge** para rotular as regiões preenchidas incidentes **R1, R2, …**. As regiões marcadas ficam em destaque. Os usos de limite são rotulados **R (região) · L (laço) · posição dentro do laço**, todos começando em 1.

O cubo abaixo tem três faces preenchidas. Selecione o vértice superior direito da frente, **V3**, escolha **Unglue edge → E7**, marque **R2 · L1 · 4** (a face de cima) e confirme. A face de cima passa a usar a cópia **E10**, e a face da direita continua usando **E7**. Unglue entra em **Bend** automaticamente: arraste o meio da diagonal para curvar só a cópia e o limite da face de cima. As duas extremidades continuam compartilhadas. Para editar o original sobreposto, volte a Move, escolha E7 no painel Edges e clique em **Bend selected edge**.

<VectorNetworkCube edges />

Desfaça a dobra para as curvas coincidirem de novo, volte a Move e selecione V3. No painel Edges, escolha **Glue edges** para fundir **E10** em **E7**. Glue aceita direção de armazenamento invertida e solda vértices de extremidade coincidentes com índices diferentes. Só a aresta de origem pedida é removida; duplicatas sem relação permanecem. Curvas ou pontos de controle incompatíveis, extremidades incompatíveis, duas arestas usadas no mesmo laço de limite e reversões parciais de enrolamento que poderiam mudar preenchimentos nonzero são rejeitados.

Unglue preserva a geometria da curva, as extremidades e todas as regiões, inclusive buracos, movendo só os usos de limite selecionados para a cópia. Pelo menos um uso precisa permanecer no original. As regiões hoje armazenam limites preenchidos: uma aresta precisa de pelo menos dois desses usos, então preencha as faces adjacentes antes, se for preciso. Fill pode normalizar regiões amplas importadas em faces separadas. Enquanto as cópias ainda se sobrepõem, use Bend ou Glue; Fill e Cut / Uncut de face ainda pressupõem uma imersão planar. Cada Glue / Unglue é um passo de desfazer. A pré-visualização e **Bend selected edge** não criam entrada de histórico.

A função pura `vectorEdgeUses(network, edge)` devolve entradas `{ regionIndex, loopIndex, offset }`. `unglueVectorNetworkEdge(network, edge, uses)` e `glueVectorNetworkEdges(network, source, target)` devolvem `VectorEdgeTopologyResult`: a rede nova, os mapas de índice de vértice/aresta e a aresta selecionada, ou um motivo de falha. Os índices da API começam em zero; as entradas não são mutadas.

### Cut e Uncut {#cut-uncut}

![Operador Cut e Uncut](/vgc-operator-cut-uncut.png)

#### Dividir e mesclar faces {#split-and-merge-faces}

Em **Move**, selecione um vértice e clique em **Cut / Uncut faces** (o ícone de caminho dividido). **Cut face** liga vértices de limite da mesma face com uma costura reta, inclusive ligações até buracos ou entre eles. **Uncut edge** remove uma aresta compartilhada entre faces adjacentes ou uma costura que une componentes de limite. As posições dos vértices e os pontos de controle de curva já existentes não mudam. As duas operações aceitam desfazer e refazer em um passo.

Experimente a face da frente preenchida abaixo: selecione o **vértice inferior esquerdo V1**, escolha **Cut face → V3** e confirme. A diagonal nova **E10** divide a face azul em dois triângulos preenchidos. Abra o painel de novo, escolha **Uncut edge → E10** e confirme para fundi-los de volta. Você pode usar Fill para limpar um triângulo; Uncut então explica que os dois lados precisam ter o mesmo estado de preenchimento, em vez de mudar a área pintada de surpresa.

<VectorNetworkCube faces />

Os cortes precisam permanecer dentro de uma face planar: cruzar ou tocar outra aresta, sobrepor uma aresta ou passar por um buraco é rejeitado. Limites curvos e buracos já existentes dos dois lados são preservados. Os cortes hoje usam costuras retas, e não curvas desenhadas arbitrárias. Quando Uncut mescla duas faces limitadas, as duas precisam estar preenchidas ou as duas sem preenchimento. Remover uma costura que une limites de buraco preserva o preenchimento original. Traços soltos não são removidos como costuras que unem limites. A pré-visualização é temporária; Cancelar, Undo, mudar o vértice selecionado ou atualizações externas de geometria a descartam. Uma operação rejeitada explica o motivo e não cria entrada de histórico.

As funções puras `cutVectorNetworkFace(network, from, to)` e `uncutVectorNetworkEdge(network, edgeIndex)` devolvem `VectorFaceTopologyResult`, com motivos de falha ou a rede nova, os mapas de índice de vértice/aresta e o vértice selecionado. Os índices começam em zero. Regiões preenchidas são normalizadas em faces planares mínimas, preservando a área pintada visível e os buracos. Esta operação de face é separada da ferramenta Cut já existente, que abre um vértice, descrita abaixo.

#### Conectar limites de buracos {#connecting-hole-boundaries}

O anel abaixo tem um buraco sem preenchimento. Em Move, selecione o canto superior esquerdo externo **V1**, abra **Cut / Uncut faces** e escolha **Cut face → V5**. A nova **E9** liga o limite externo ao buraco. A área azul continua sendo uma face, o buraco permanece transparente e o limite percorre E9 uma vez em cada direção.

Em seguida, selecione o canto superior direito externo **V2** e escolha **Cut face → V6**. A nova **E10** divide o anel em duas faces que Fill pode alternar de forma independente. Sem mudar os preenchimentos, selecione V2 e **Uncut edge → E10** e, depois, selecione V1 e **Uncut edge → E9**, para restaurar o anel com dois laços de limite separados. Cada passo aceita desfazer e refazer.

<VectorNetworkFaceCut />

Dois buracos também podem ser conectados quando a costura inteira fica dentro da mesma face, sem tocar outros limites. Unir limites diferentes remove um laço de limite sem acrescentar uma face; cortar dentro de um limite acrescenta uma face. Limites curvos já existentes não mudam, e os preenchimentos são normalizados em regiões de face `evenodd`, preservando a cobertura.

#### Abrir um vértice {#open-a-vertex}

Cut **rompe a topologia no vértice selecionado**. Duplique esse vértice, mantenha a primeira extremidade incidente e mova as extremidades restantes para a cópia. Laços fechados e cadeias abertas usam a mesma regra. Para o triângulo `0—1—2—0` com um corte no vértice `1`:

```plaintext
Before:  0 — 1 — 2 — 0 (closed)
After:   1 — 0 — 2 — 3 (3 coincident with 1, open polyline)
segments: [0,1], [3,2], [2,0]
```

Em uma polilinha aberta, **duplique o vértice de corte** e reatribua todas as arestas incidentes, menos a primeira, à cópia, para que as duas cadeias possam ser afastadas no modo Move. Veja `breakVertex`:

```ts
export function breakVertex(
    network: VectorNetworkData,
    vertexIndex: number,
): VectorNetworkData | null;
```

Clicar em um vértice no modo Cut chama `breakVectorNetworkAtVertex` (`Select.ts`), grava a rede, registra o histórico e chama `setAppState({ vectorNetworkEditMode: MOVE })` para você arrastar na hora. Regiões cujos limites continuam fechados são preservadas. Um limite inválido remove a região que o contém, inclusive quando um buraco se rompe, para evitar preencher esse buraco por acidente. A limpeza usa `regions: []` explícito, para a entidade e o histórico de desfazer permanecerem sincronizados. Um laço próprio cúbico de um vértice também pode ser cortado.

## Leitura adicional {#extended-reading}

-   [Introducing Vector Networks]
-   [The Engineering behind Figma's Vector Networks]
-   [Vector Graphics Complexes]
-   [图形编辑器开发：钢笔工具的实现]
-   [vpaint]
-   [penpot]

[Introducing Vector Networks]: https://www.figma.com/blog/introducing-vector-networks/
[Introducing Vector Networks - Bending]: https://www.figma.com/blog/introducing-vector-networks/#bending
[Delete and Heal for Vector Networks]: https://www.figma.com/blog/delete-and-heal-for-vector-networks/
[VectorNetwork API]: https://www.figma.com/plugin-docs/api/VectorNetwork/
[VectorPath API]: https://www.figma.com/plugin-docs/api/VectorPath/
[VectorPath-data]: https://www.figma.com/plugin-docs/api/properties/VectorPath-data/
[Vector Graphics Complexes]: https://www.borisdalstein.com/research/vgc/
[The Engineering behind Figma's Vector Networks]: https://alexharri.com/blog/vector-networks
[Discussion in HN]: https://news.ycombinator.com/item?id=39241825
[vpaint]: https://github.com/dalboris/vpaint
[penpot]: https://github.com/penpot/penpot
[图形编辑器开发：钢笔工具的实现]: https://zhuanlan.zhihu.com/p/694407842
[Lição 12 - Desenhar polilinha]: /pt-BR/guide/lesson-012
[Lição 13 - Desenhar caminho e estilo de esboço]: /pt-BR/guide/lesson-013
[fillRule]: /pt-BR/guide/lesson-013#fill-rule
[How to modify line points with anchors?]: https://konvajs.org/docs/sandbox/Modify_Curves_with_Anchor_Points.html
[bezierjs]: http://pomax.github.io/bezierjs
[figma-fill-rule-editor]: https://github.com/evanw/figma-fill-rule-editor
[Polyline]: /pt-BR/guide/lesson-012
[Lição 21 - Transformer]: /pt-BR/guide/lesson-021
[Edit vector layers]: https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers#h_01JYM29VEN8ABWTDXJR529446R
[Boolean operations]: https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations
