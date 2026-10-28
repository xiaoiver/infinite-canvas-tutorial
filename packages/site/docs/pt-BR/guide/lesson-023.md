---
outline: deep
description: 'Implemente mapas mentais com algoritmos de layout de árvore. Estude a evolução do d3-tree ao d3-flextree, a análise de complexidade e a extensão a árvores N-árias para mapas mentais flexíveis.'
head:
    - ['meta', { property: 'og:title', content: 'Lição 23 - Mapa mental' }]
---
<script setup>
import Tree from '../../components/Tree.vue';
import FlexTree from '../../components/FlexTree.vue';
import Mindmap from '../../components/Mindmap.vue';
</script>

# Lição 23 - Mapa mental {#lesson-23-mindmap}

Muitos aplicativos de tela infinita oferecem suporte a mapas mentais, como [miro], [excalidraw], [canva], [xmind] e outros.
Gosto bastante da categorização do [excalidraw], que divide os mapas mentais em três subtipos:

-   O [Spider mapping] serve para cenários de brainstorming e se estende a partir do tema central como uma teia de aranha. Do ponto de vista da renderização, o [mermaid] também oferece esse tipo.
-   [Tree mapping]
-   [Flow map]

|                                                                           Mapa aranha                                                                            |                                                                        Mapa em árvore                                                                        |                                                                           Mapa de fluxo                                                                            |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| ![fonte: https://plus.excalidraw.com/use-cases/mind-map#spider-map](https://excalidraw.nyc3.cdn.digitaloceanspaces.com/lp-cms/media/Spider%20map%20example.png) | ![fonte: https://plus.excalidraw.com/use-cases/mind-map#tree-map](https://excalidraw.nyc3.cdn.digitaloceanspaces.com/lp-cms/media/Tree%20map%20example.png) | ![https://plus.excalidraw.com/use-cases/mind-map#multi-flow-map](https://excalidraw.nyc3.cdn.digitaloceanspaces.com/lp-cms/media/Multi-flow%20map%20example.png) |

Aqui tratamos só do último tipo.

Embora os mapas mentais possam variar muito na apresentação final, do ponto de vista da estrutura de dados eles são árvores feitas de nós e arestas. [markmap] e [mermaid] convertem markdown nessa estrutura. Árvores são um tipo especial de grafo, e também existem algoritmos de layout para grafos direcionados, como [dagre] e [elkjs], mas não vamos considerá-los aqui.

```json
{
    "id": "Modeling Methods",
    "children": [
        {
            "id": "Classification",
            "children": []
        }
    ]
}
```

Para esse tipo de dado, [d3-hierarchy] oferece uma série de algoritmos prontos, e o foco aqui é só o [d3-tree].

## d3-tree {#d3-tree}

Vamos começar com duas restrições que, mais adiante, veremos como romper: o alvo é uma árvore binária, e todos os nós têm o mesmo tamanho (ou não têm tamanho).

A abordagem de implementação do [d3-tree] vem de [Tidier Drawings of Trees], que propõe vários critérios estéticos a partir de pesquisas anteriores:

> -   Critério estético 1: nós no mesmo nível da árvore devem ficar
>     sobre uma reta, e as retas que definem os níveis
>     devem ser paralelas.
> -   Critério estético 2: um filho à esquerda deve ficar à esquerda
>     do pai, e um filho à direita, à direita.
> -   Critério estético 3: um pai deve ficar centralizado sobre os filhos.
> -   Critério estético 4: uma árvore e sua imagem espelhada devem produzir desenhos que sejam reflexos uma da outra; além disso, uma subárvore deve ser desenhada do mesmo jeito, qualquer que seja o lugar em que apareça na árvore.

O processo de melhoria dos três primeiros critérios pode ser lido em [Drawing Presentable Trees], que usa código Python e diagramas para mostrar em detalhe o raciocínio algorítmico dos artigos anteriores. Por exemplo, implementar o terceiro critério é simples: use um percurso pós-ordem e defina a coordenada x do nó pai como o ponto médio entre o filho mais à esquerda e o mais à direita:

```ts
// @see https://github.com/d3/d3-hierarchy/blob/main/src/tree.js#L150
var midpoint = (children[0].z + children[children.length - 1].z) / 2;
```

Dá para ver com clareza que ainda não é simétrico o bastante, com um viés geral para a direita, o que leva ao quarto critério:

|                          O mais estreito possível                           |                          Um pai deve ficar centralizado sobre os filhos                           |
| :-------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------: |
| ![O mais estreito possível](https://llimllib.github.io/pymag-trees/images/figure3.png) | ![Um pai deve ficar centralizado sobre os filhos](https://llimllib.github.io/pymag-trees/images/figure4.png) |

Centralizar o nó pai pode entrar em conflito com a posição dos nós irmãos. Nesse ponto, é preciso mover a subárvore inteira, mas, com a abordagem recursiva a seguir, a complexidade do algoritmo passaria a $O(n^2)$:

```python
def move_right(branch, n):
    branch.x += n
    for c in branch.children:
        move_right(c, n)
```

Nesse ponto, é preciso acrescentar um atributo `mod` aos nós, para que a centralização do pai possa ignorar conflitos por um momento e mover depois. Isso evita a recursão e devolve a complexidade do algoritmo a $O(n)$. Também é preciso acrescentar um atributo `prelim`, cujo nome vem de [A Node-Positioning Algorithm for General Trees]:

```ts
// @see https://github.com/d3/d3-hierarchy/blob/main/src/tree.js#L67
function TreeNode(node, i) {
    this._ = node; // final position: _.x
    this.parent = null;
    this.children = null;
    this.z = 0; // prelim // [!code ++]
    this.m = 0; // mod // [!code ++]
}
```

Por usar um percurso pós-ordem:

```ts
function tree(root) {
    var t = treeRoot(root);
    t.eachAfter(firstWalk);
    t.eachBefore(secondWalk);
}
```

No segundo percurso, em pré-ordem, acumule `mod` de forma recursiva para completar o deslocamento para a direita e obter a posição final `_.x`. Isso corresponde ao passo `PETRIFY` do artigo original:

```ts
// @see https://github.com/d3/d3-hierarchy/blob/main/src/tree.js#L164
function secondWalk(v) {
    v._.x = v.z + v.parent.m; // final x
    v.m += v.parent.m;
}
```

Aqui entra o conceito de `contour`. Por exemplo, o contorno direito da árvore da esquerda abaixo é `[1, 1, 2]`, e o contorno esquerdo da árvore da direita é `[1, 0, 1]`. Para impedir que essas duas subárvores se sobreponham, basta comparar esses dois contornos e determinar quanto a árvore da direita precisa se mover para a direita. Neste exemplo, a distância do movimento é 2.

![contour](https://llimllib.github.io/pymag-trees/images/figure6.png)

```python
def push_right(left, right):
    wl = contour(left, lt)
    wr = contour(right, gt)
    return max(x-y for x,y in zip(wl, wr)) + 1
```

O algoritmo que obtém os contornos das subárvores ainda exige recursão, então a complexidade é $O(n^2)$. Para otimizar isso, entra o conceito de `thread`. Na figura abaixo, as linhas tracejadas representam essa relação, diferente da relação pai-filho, e traçam o contorno de cada subárvore, mesmo quando ele não existe de fato:

![ ](/thread.png)

```ts
function TreeNode(node, i) {
    this.t = null; // thread // [!code ++]
}
```

Assim, ao calcular `contour`, dá para atravessar a hierarquia real e obtê-lo direto por `thread`, reduzindo a complexidade a $O(n)$:

```ts
// @see https://github.com/d3/d3-hierarchy/blob/main/src/tree.js#L15C1-L24C2
function nextLeft(v) {
    var children = v.children;
    return children ? children[0] : v.t;
}
function nextRight(v) {
    var children = v.children;
    return children ? children[children.length - 1] : v.t;
}
```

### Análise de complexidade {#math-analysis}

Vamos revisar o algoritmo. Primeiro, faça um percurso pós-ordem para calcular as coordenadas relativas e o `thread` dos nós; depois, um percurso pré-ordem para acumular `mod` e determinar a posição absoluta de cada nó. Cada nó é visitado só uma vez nesses dois percursos. Portanto, basta determinar a complexidade da varredura de contorno no primeiro percurso.

O artigo original também traz uma análise matemática da complexidade desse passo. $F(T)$ representa "na árvore T inteira, quantos nós a varredura de contorno precisa visitar no total?", em que $h(T)$ das subárvores é a profundidade máxima da raiz até as folhas, isto é, o número de nós do caminho menos 1. Ela representa a profundidade de acesso no pior caso durante a varredura de contorno. Ao comparar o espaçamento de dois contornos camada por camada, assim que um dos contornos chega ao fundo (não há camadas mais profundas), a varredura para, e por isso $min()$ é usado aqui:

![ ](/tidy-analysis.png)

Em seguida, basta provar $F(T) ≤ n(T)$, em que $n(T)$ é o número total de nós da subárvore. Isso confirma que a complexidade geral do algoritmo é $O(n)$.

O autor propõe a hipótese $F(T) = n(T) - h(T)$. O raciocínio é que cada nó interno (não folha) participa da comparação de contorno no máximo uma vez, enquanto as folhas não precisam de varredura, porque não há subárvores a comparar. A árvore inteira tem $n(T)$ nós, dos quais pelo menos $h(T)$ folhas estão no caminho mais profundo, então no máximo $n(T) − h(T)$ nós precisam participar da varredura de contorno. Isso determina o limite superior de nós acessados na varredura, e o passo seguinte é provar que, para qualquer árvore $T$, o número de nós acessados pela varredura de contorno satisfaz $Scan(T) ≤ F(T)$.

Por indução, vale para $N = 0$ (nenhuma varredura é necessária) e $N = 1$. Suponha $Scan(T) ≤ F(T) = n(T) − h(T)$.

Pela definição (acrescentando o nó raiz):

$$
\begin{align*}
n(T) &= 1 + n(T_l) + n(T_r) \\
h(T) &= 1 + max(h(T_r), h(T_r))
\end{align*}
$$

Substituindo:

$$
\begin{align*}
F(T) &= n(T) − h(T) \\
    &= 1 + n(T_l) + n(T_r) − [1 + max(h(T_l), h(T_r))] \\
    &= [n(T_l) − h_l] + [n(T_r) − h_r] + [h_l + h_r − max(h_l, h_r)] \\
    &≥ F(T_l) + F(T_r) + min(h_l, h_r)
\end{align*}
$$

Portanto: $F(T) ≥ F(T_l) + F(T_r) + min(h(T_l), h(T_r)) ≥ Scan(T)$

### Extensão a árvores N-árias {#n-ary-tree}

Dá para processar as subárvores deslocadas da esquerda para a direita, em sequência, mas isso resulta na figura (a) abaixo. Também daria para acrescentar um percurso da direita para a esquerda, mas isso resultaria na situação (b). O efeito desejado é o de (d):

![fonte: [Improving Walker's Algorithm to Run in Linear Time]](/n-ary.png)

[A Node-Positioning Algorithm for General Trees] propôs uma solução. Vale observar que a estrutura do código e os nomes de variáveis do [d3-tree] reaproveitam basicamente esse artigo. A figura abaixo mostra o efeito de rearranjo durante a inclusão de subárvores:

![fonte: [Improving Walker's Algorithm to Run in Linear Time]](/n-ary-2.png)

A função `apportion` é a "lógica de alinhamento entre subárvores" no centro de todo o layout. Ela compara os contornos da subárvore atual com os da subárvore anterior; se houver sobreposição, acrescenta um `shift` à subárvore atual; atualiza o modificador para que os nós descendentes também se ajustem; e suaviza os modificadores intermediários para evitar "lacunas".

```plaintext
function apportion(v):
    leftMost = firstChild(v)
    rightMost = lastChild(v)
    defaultAncestor = leftMost

    for each child w from second to last:
        leftSibling = previousSibling(w)

        # Initialize contour pointers
        vip = w
        vim = leftSibling
        sip = vip.mod
        sim = vim.mod

        # Compare right contour of vim and left contour of vip
        while vim ≠ null and vip ≠ null:
            shift = (vim.prelim + sim + separation) - (vip.prelim + sip)

            if shift > 0:
                # Move current subtree right
                moveSubtree(ancestor(w, v, defaultAncestor), v, shift)
                sip += shift

            # move to next lower level
            vim = rightmostChild(vim)
            vip = leftmostChild(vip)

            sim += vim?.mod or 0
            sip += vip?.mod or 0

        # update default ancestor
        if rightMostChild(vim) ≠ null and leftMostChild(vip) == null:
            defaultAncestor = ancestor(w, v, defaultAncestor)

```

Continue acrescentando atributos aos nós para armazenar `shift`:

```ts
function TreeNode(node, i) {
    this.c = 0; // change  // [!code ++]
    this.s = 0; // shift  // [!code ++]
    this.A = null; // default ancestor // [!code ++]
    this.a = this; // ancestor // [!code ++]
}
```

Em que `moveSubtree` move a subárvore inteira enraizada em `wp` para a direita em `shift` unidades.

```ts
// @see https://github.com/d3/d3-hierarchy/blob/main/src/tree.js#L28C10-L28C21
function moveSubtree(wm, wp, shift) {
    var change = shift / (wp.i - wm.i);
    wp.c -= change;
    wp.s += shift;
    wm.c += change;
    wp.z += shift;
    wp.m += shift;
}
```

Essa implementação tem complexidade $O(n^2)$. [Improving Walker's Algorithm to Run in Linear Time] tenta otimizá-la para $O(n)$.

Se você precisar exibir na horizontal, basta transpor o sistema de coordenadas, trocando as coordenadas x/y dos nós.

<Tree />

## d3-flextree {#d3-flextree}

O algoritmo acima tem uma limitação evidente: exige que todos os nós tenham a mesma largura e a mesma altura, como em muitos exemplos de d3-tree que usam círculos do mesmo tamanho como nós. Recomendo muito a leitura de [Drawing Non-layered Tidy Trees in Linear Time] e [High-performance tidy trees visualization].

![ ](/layered-non-layered-tidy.png)

O [d3-flextree] foi criado para resolver esse problema, e o [markmap] o usa.

> Uma limitação daquele algoritmo é que ele se aplica a árvores em que todos os nós têm o mesmo tamanho. Isso basta para muitos aplicativos, mas uma solução mais geral, que aceite tamanhos variáveis de nó, costuma ser preferível.

O efeito é o seguinte:

<FlexTree />

## @antv/hierarchy {#antv-hierarchy}

O algoritmo `mindmap` de [@antv/hierarchy] e de [mindmap-layouts] propõe os requisitos estéticos a seguir:

-   Nó raiz centralizado
-   Nós filhos podem ser distribuídos à esquerda e à direita (em geral de forma simétrica, ou conforme `getSide`)
-   Nós no mesmo nível ficam distribuídos de maneira uniforme na vertical

Ele também aceita definir o tamanho dos nós e não usa a varredura de contorno. Os passos gerais são estes, com complexidade geral $O(n)$:

-   Primeira passagem: definir rapidamente uma coordenada x básica.
-   Segunda passagem: calcular, de baixo para cima, o espaço vertical necessário para cada subárvore.
-   Terceira passagem (fase de ajuste): de cima para baixo, usar a informação de espaço calculada para dispor coordenadas y sem sobreposição para todos os nós filhos.
-   Quarta passagem: de novo de baixo para cima, com base no layout final dos filhos, ajustar as posições dos pais para obter a centralização vertical.

O efeito é o seguinte:

<Mindmap />

## [WIP] Interação {#interaction}

Mapas mentais têm muitas interações específicas, inclusive clicar em nós para expandir ou recolher os nós filhos.

## Leitura adicional {#extended-reading}

-   [HN discussion]
-   [Drawing Presentable Trees]
-   [A Node-Positioning Algorithm for General Trees]
-   [Improving Walker's Algorithm to Run in Linear Time]
-   [Drawing Non-layered Tidy Trees in Linear Time]
-   [High-performance tidy trees visualization]

[markmap]: https://github.com/markmap/markmap
[@antv/hierarchy]: https://github.com/antvis/hierarchy/
[xmind]: https://xmind.com/
[miro]: https://miro.com/mind-map/
[excalidraw]: https://plus.excalidraw.com/use-cases/mind-map
[canva]: https://www.canva.com/graphs/mind-maps/
[Spider mapping]: https://en.wikipedia.org/wiki/Spider_mapping
[mermaid]: https://mermaid.js.org/syntax/mindmap.html
[Tree mapping]: https://en.wikipedia.org/wiki/Treemapping
[Flow map]: https://en.wikipedia.org/wiki/Flow_map
[d3-hierarchy]: https://d3js.org/d3-hierarchy
[d3-tree]: https://d3js.org/d3-hierarchy/tree
[d3-flextree]: https://github.com/Klortho/d3-flextree
[Tidier Drawings of Trees]: https://reingold.co/tidier-drawings.pdf
[Drawing Presentable Trees]: https://llimllib.github.io/pymag-trees/
[HN discussion]: https://news.ycombinator.com/item?id=10366299
[Improving Walker's Algorithm to Run in Linear Time]: https://link.springer.com/content/pdf/10.1007/3-540-36151-0_32.pdf
[A Node-Positioning Algorithm for General Trees]: https://www.cs.unc.edu/techreports/89-034.pdf
[High-performance tidy trees visualization]: https://www.zxch3n.com/tidy/tidy/
[Drawing Non-layered Tidy Trees in Linear Time]: https://github.com/Klortho/d3-flextree/blob/master/papers/van-der-ploeg-2013.pdf
[mindmap-layouts]: https://github.com/leungwensen/mindmap-layouts
[dagre]: https://github.com/dagrejs/dagre
[elkjs]: https://github.com/kieler/elkjs
