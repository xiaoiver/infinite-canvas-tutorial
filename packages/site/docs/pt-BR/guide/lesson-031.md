---
outline: deep
description: 'Vincule conectores às formas para que as arestas acompanhem os nós quando eles se movem, incluindo vinculações ortogonais, curvas e de seta.'
---

<script setup>
import Binding from '../../components/Binding.vue'
import BindingWithEllipse from '../../components/BindingWithEllipse.vue'
import BindingOrthogonal from '../../components/BindingOrthogonal.vue'
import BindingConstraint from '../../components/BindingConstraint.vue'
import BindingRouteOrthConnector from '../../components/BindingRouteOrthConnector.vue'
import BindingRounded from '../../components/BindingRounded.vue'
import BindingCurved from '../../components/BindingCurved.vue'
import BindingBezier from '../../components/BindingBezier.vue'
import BindingArrow from '../../components/BindingArrow.vue'
import BindingDangling from '../../components/BindingDangling.vue'
import BindingLoop from '../../components/BindingLoop.vue'
</script>

# Lição 31 - Vinculações entre formas {#lesson-31-bindings-between-shapes}

Na [Lição 23 - Mapa mental], focamos só nos algoritmos de layout de nós e arestas, sem entrar em interações como mover as arestas quando os nós são movidos. Da mesma forma, na [Lição 25 - Desenhar setas], as propriedades de linhas e setas não incluíam informação de vinculação. Nesta lição, vamos completar essa funcionalidade.

## Estrutura de dados {#data-structure}

### Elementos lineares no excalidraw {#excalidraw-linear-element}

No Excalidraw, as linhas de conexão (como setas) são representadas no modelo de dados como `ExcalidrawLinearElement`, que acrescenta campos relacionados à conexão:

```ts
export declare type PointBinding = {
    elementId: ExcalidrawBindableElement['id'];
    focus: number;
    gap: number;
};
export declare type ExcalidrawLinearElement = _ExcalidrawElementBase &
    Readonly<{
        type: 'line' | 'arrow';
        points: readonly Point[];
        lastCommittedPoint: Point | null;
        startBinding: PointBinding | null;
        endBinding: PointBinding | null;
        startArrowhead: Arrowhead | null;
        endArrowhead: Arrowhead | null;
    }>;
```

Como mostrado acima, cada seta tem campos opcionais `startBinding` e `endBinding`, que existem em um nível semântico diferente de `points`. O primeiro representa restrições semânticas, enquanto `points` é a representação geométrica. Quando os dois existem ao mesmo tempo, `points` precisa ser recalculado. Além disso, há estilos de seta no início e no fim (`startArrowhead/endArrowhead`). O `elementId` em `PointBinding` aponta para a forma conectada (elementos vinculáveis, como retângulos, elipses, texto, imagens etc.), enquanto `focus` e `gap` servem para localizar o ponto de conexão (um índice em ponto flutuante e uma distância de deslocamento). Abaixo está um exemplo de elemento de seta em JSON:

```ts
{
  "type": "arrow",
  // ... other properties omitted ...
  "startBinding": {
    "elementId": "xw25sQBsbd2mecyjTrYHA",
    "focus": -0.0227,
    "gap": 15.6812
  },
  "endBinding": null,
  "points": [[0,0],[0,109]],
  "startArrowhead": null,
  "endArrowhead": null
}
```

Neste exemplo, o `startBinding` da seta aponta para uma forma com ID `"xw25sQBsbd2mecyjTrYHA"`, e `focus` e `gap` definem a posição da conexão a partir do limite dessa forma.

Ao mesmo tempo, cada forma vinculada (como um retângulo ou uma elipse) tem uma lista `boundElements` na estrutura de dados básica, usada para registrar todas as setas ou elementos de texto conectados a ela. O tipo desse campo costuma ser `{ id: ExcalidrawLinearElement["id"]; type: "arrow"|"text"; }[] | null`. Em outras palavras, a conexão entre setas e formas é mantida nos dois sentidos: as setas registram o ID do elemento alvo ao qual se vinculam, e os elementos alvo registram os IDs das setas que apontam para eles.

### Vinculações no tldraw {#tldraw-binding}

No tldraw, as “linhas de conexão” também são formas (o padrão é a forma de seta), e as relações de conexão são representadas por objetos Binding. Cada registro de vinculação existe separadamente no armazenamento e representa a associação entre duas formas. Para conexões de seta, usa-se o tipo `TLArrowBinding`, que é uma especialização de `TLBaseBinding<'arrow',TLArrowBindingProps>`. Um exemplo típico de registro de vinculação de seta é o seguinte:

```ts
{
  id: 'binding:abc123',
  typeName: 'binding',
  type: 'arrow',           // Binding type is arrow
  fromId: 'shape:arrow1',  // Arrow shape ID (arrow shape departure end)
  toId:   'shape:rect1',   // Target shape ID (shape the arrow points to)
  props: {
    terminal: 'end',       // Which end of the arrow to bind to (start or end)
    normalizedAnchor: { x: 0.5, y: 0.5 }, // Normalized anchor point on target shape
    isExact: false,        // Whether arrow enters inside target shape
    isPrecise: true,       // Whether to use anchor point precisely, otherwise use shape center
    snap: 'edge',          // Snap mode (such as edge snapping)
  },
  meta: {}
}
```

Aqui, os campos `fromId/toId` associam setas a alvos por meio de IDs de forma, e `props` guarda os detalhes da conexão (como pontos de âncora, opções de alinhamento etc.)

### antv/g6 {#antv-g6}

As relações de conexão são lógicas, não geométricas, e os caminhos são calculados por meio de `type` e de algoritmos de roteamento de arestas:

```ts
interface EdgeConfig {
    id?: string;
    source: string; // Source node ID
    target: string; // Target node ID

    sourceAnchor?: number; // Source node anchor index
    targetAnchor?: number; // Target node anchor index

    type?: string; // line / polyline / cubic / loop ...
    style?: ShapeStyle;
}
```

As âncoras são declaradas nos nós, com coordenadas normalizadas:

```ts
anchorPoints: [
    [0.5, 0], // top
    [1, 0.5], // right
    [0.5, 1], // bottom
    [0, 0.5], // left
];
```

Os índices de âncora são usados nas arestas, bem parecidos com o `normalizedAnchor` do tldraw, mas o G6 coloca a autoridade de definição da âncora nos nós:

```ts
{
    source: 'nodeA',
    target: 'nodeB',
    sourceAnchor: 1,
    targetAnchor: 3,
}
```

### mxGraph {#mxgraph}

O mxGraph tem um sistema completo de restrições de conexão, definido nas formas dos nós e que representa os pontos de conexão permitidos:

```ts
class mxConnectionConstraint {
    point: mxPoint | null; // (0.5, 0) = top center (1, 0.5) = right center
    perimeter: boolean; // Indicates projection along shape boundary
}
```

### JSON Canvas Spec {#json-canvas-spec}

O Obsidian publica a [JSON Canvas Spec], que é estruturalmente parecida com `antv/g6`: o nível superior guarda arrays de nós e arestas:

```json
{
    "nodes": [],
    "edges": []
}
```

As arestas se parecem com o seguinte — elas não carregam geometria, só a conexão lógica:

```json
{
    "id": "f67890123456789a",
    "fromNode": "6f0ad84f44ce9c17",
    "toNode": "a1b2c3d4e5f67890"
}
```

## Nosso design {#our-design}

No schema, nos apoiamos mais na abordagem do mxGraph. As relações lógicas de uma aresta são expressas com `fromId` e `toId`, então não precisamos de campos geométricos como `x1/y1`. Uma seta que conecta `rect-1` e `rect-2` é declarada assim:

```ts
const edge1 = {
    id: 'line-1',
    type: 'line',
    fromId: 'rect-1',
    toId: 'rect-2',
    stroke: 'black',
    strokeWidth: 10,
    markerEnd: 'line',
};
```

As restrições ficam no nó, de um jeito parecido com [mxConnectionConstraint]:

```ts
interface ConstraintAttributes {
    /**
     * Normalized point, relative to bounding box top-left.
     */
    point: [number, number];
    /**
     * Use perimeter.
     */
    perimeter: boolean;
    name?: string;
    dx?: number;
    dy?: number;
}
```

De forma parecida com a [Lição 18 - Definir componentes pai-filho], dá para implementar relações de vinculação nos dois sentidos:

```ts
class Binding {
    @field.ref declare from: Entity;
    @field.ref declare to: Entity;
}

class Binded {
    @field.backrefs(Binding, 'from') declare fromBindings: Entity[];
    @field.backrefs(Binding, 'to') declare toBindings: Entity[];
}
```

### Caso especial {#special-case}

Na próxima lição, vamos encontrar um caso especial em que `fromId/toId` pode ser nulo, como indicam as linhas tracejadas no diagrama de sequência abaixo, `fromId: 'alice', toId: undefined`

![Diagramas de sequência no D2](/d2.png)

Introduzimos um novo componente que registra uma relação com apenas um nó associado:

```ts
/**
 * Edge with only one end attached to a shape; the other end is fixed by `sourcePoint` / `targetPoint`.
 * `attached` is the entity on the connected side; `sourceIsAttached === 1` means the connection is on the source (`fromId`) side.
 */
class PartialBinding {
    @field.ref declare attached: Entity;
    /** 1 = source (from) side attached to node, 0 = target (to) side */
    @field.int32 declare sourceIsAttached: number;
}
```

<BindingDangling />

## Atualização automática {#auto-update}

Quando a posição das formas conectadas muda, os caminhos das arestas vinculadas precisam ser recalculados. Dá para consultar todas as formas que têm o componente `Binded`, monitorar as mudanças da caixa delimitadora e atualizar as arestas vinculadas nesse momento:

```ts
class RenderBindings extends System {
    private readonly boundeds = this.query(
        (q) => q.with(Binded).changed.with(ComputedBounds).trackWrites,
    );

    execute() {
        const bindingsToUpdate = new Set<Entity>();
        this.boundeds.changed.forEach((entity) => {
            const { fromBindings, toBindings } = entity.read(Binded);
            [...fromBindings, ...toBindings].forEach((binding) => {
                bindingsToUpdate.add(binding);
            });
        });
        // Recalculate paths of bound edges and render
    }
}
```

No exemplo abaixo, você pode tentar arrastar os nós, e as arestas vão recalcular os caminhos e redesenhar:

<Binding />

No momento, os pontos inicial e final das arestas são os centros das caixas delimitadoras das formas conectadas, consistente com o efeito quando `isPrecise` é igual a `false` no tldraw, o que indica uma vinculação imprecisa.
Na maioria dos casos, queremos que as setas não atravessem as formas conectadas, mas que se encaixem com elegância nas bordas da forma.

## Algoritmo de perímetro {#perimeter}

Para os limites da forma, o drawio oferece a propriedade `perimeter`; mudá-la afeta as conexões. Para detalhes, veja: [Change the shape perimeter]

![Estilos de perímetro e restrições de porta](https://drawio-app.com/wp-content/uploads/2019/02/drawio-perimeter-constraint-styles.png)

```ts
// Note: generally next is passed as "the other center point", orthogonal is usually false
var pointA = graph.view.getPerimeterPoint(stateA, centerB, false, 0);
var pointB = graph.view.getPerimeterPoint(stateB, centerA, false, 0);
```

### Algoritmo de perímetro do retângulo {#rectangle-perimeter}

O algoritmo de perímetro do retângulo é o mais usado. Na implementação a seguir, `vertex` é o nó de origem e `next` é o centro da caixa delimitadora do nó alvo.
Primeiro, trace uma linha a partir dos centros das caixas delimitadoras dos nós de origem e alvo e, em seguida, determine de qual aresta da caixa delimitadora do nó de origem o ponto alvo está mais perto. As duas diagonais da caixa delimitadora dividem o plano em quatro regiões. O intervalo do limite esquerdo é a região fora de $[-\pi+t, \pi-t]$ (isto é, o teste `alpha < -pi + t || alpha > pi - t` no código):

```ts
function rectanglePerimeter(
    vertex: SerializedNode,
    next: IPointData,
    orthogonal: boolean,
): IPointData {
    const { x, y, width, height } = vertex;
    const cx = x + width / 2; // Source node center
    const cy = y + height / 2;
    const dx = next.x - cx;
    const dy = next.y - cy;
    const alpha = Math.atan2(dy, dx); // Slope of line from source node center to target node center
    const p: IPointData = { x: 0, y: 0 };
    const pi = Math.PI;
    const pi2 = Math.PI / 2;
    const beta = pi2 - alpha;
    const t = Math.atan2(height, width); // Diagonals divide into four regions
    if (alpha < -pi + t || alpha > pi - t) {
        // Intersects with left edge
        p.x = x;
        p.y = cy - (width * Math.tan(alpha)) / 2; // Calculate intersection point
    }
    // Other three edges omitted
    return p;
}
```

Por fim, calcule o ponto de interseção da linha com essa aresta como o ponto de partida da linha final. Por exemplo, quando determinamos que a linha vai passar pela “aresta esquerda”:

1. Determine a coordenada $x$: como é a aresta esquerda, a coordenada $x$ do ponto de interseção precisa ser igual ao valor do limite esquerdo do retângulo, `vertex.x`.
2. Calcule o deslocamento $y$:
    1. A distância horizontal do centro até a aresta esquerda é `width / 2`.
    2. Use a fórmula da tangente: $\tan(\alpha) = \frac{\Delta y}{\Delta x}$.
    3. No lado esquerdo, $\Delta x = -(\text{width} / 2)$.
    4. Então o deslocamento vertical $\Delta y = \Delta x \cdot \tan(\alpha) = -\frac{\text{width}}{2} \cdot \tan(\alpha)$.
3. Coordenada final: `p.y = cy + Δy`, que no código é `cy - (width * Math.tan(alpha)) / 2`.

O draw.io também oferece outra opção, `orthogonal`, que significa que a linha calculada precisa estar alinhada de forma ortogonal (isto é, alinhada com o eixo x ou y), e a linha só considera extensão horizontal ou vertical. Nesse caso, o outro ponto central não pode ser usado como referência:

```ts
if (orthogonal) {
    if (next.x >= x && next.x <= x + width) {
        p.x = next.x;
    } else if (next.y >= y && next.y <= y + height) {
        p.y = next.y;
    }
    if (next.x < x) {
        p.x = x;
    } else if (next.x > x + width) {
        p.x = x + width;
    }
    if (next.y < y) {
        p.y = y;
    } else if (next.y > y + height) {
        p.y = y + height;
    }
}
```

<BindingOrthogonal />

### Algoritmo de perímetro da elipse {#ellipse-perimeter}

Para nós em elipse, precisamos calcular o ponto de interseção da linha com ela:

```ts
const d = dy / dx;
const h = cy - d * cx;
const e = a * a * d * d + b * b;
const f = -2 * cx * e;
const g = a * a * d * d * cx * cx + b * b * cx * cx - a * a * b * b;
const det = Math.sqrt(f * f - 4 * e * g);

const xout1 = (-f + det) / (2 * e);
const xout2 = (-f - det) / (2 * e);
const yout1 = d * xout1 + h;
const yout2 = d * xout2 + h;
const dist1 = Math.sqrt(Math.pow(xout1 - px, 2) + Math.pow(yout1 - py, 2));
const dist2 = Math.sqrt(Math.pow(xout2 - px, 2) + Math.pow(yout2 - py, 2));

let xout = 0;
let yout = 0;
if (dist1 < dist2) {
    xout = xout1;
    yout = yout1;
} else {
    xout = xout2;
    yout = yout2;
}
return { x: xout, y: yout };
```

A linha passa pelo centro $(cx, cy)$, e a equação dela é $y = d \cdot x + h$:

-   Inclinação $d = \frac{dy}{dx}$
-   Intercepto $h = cy - d \cdot cx$

Substitua a equação da linha na equação padrão da elipse:

$$\frac{(x-cx)^2}{a^2} + \frac{(d \cdot x + h - cy)^2}{b^2} = 1$$

Expanda e reorganize em uma equação quadrática em $x$: $ex^2 + fx + g = 0$. Os e, f, g no código correspondem a:

-   $e$: coeficiente quadrático
-   $f$: coeficiente linear
-   $g$: termo constante

Fórmula quadrática: use o discriminante $det = \sqrt{f^2 - 4eg}$ para calcular os dois pontos de interseção $xout1$ e $xout2$. Escolha um ponto: um raio que atravessa uma elipse produz dois pontos de interseção (um à frente e outro atrás). O código calcula as distâncias dos dois pontos de interseção até o ponto alvo `next` (dist1 e dist2) e seleciona o ponto mais próximo.

<BindingWithEllipse />

## Restrição {#constraint}

Neste ponto, implementamos conexões lógicas nas arestas usando apenas `fromId` e `toId`. Os pontos de conexão de arestas e nós são flutuantes, chamados de `FloatingTerminalPoint` no mxGraph. Porém, às vezes queremos que as arestas saiam de uma posição fixa em um nó e entrem por uma posição fixa na forma conectada, o que o mxGraph chama de `FixedTerminalPoint`. Nesses casos, precisamos definir restrições, dividindo o processo em partes separadas para nós e arestas.

### Restrição no nó {#constraint-on-node}

As restrições do nó definem onde e como as conexões podem ser feitas. Elas não são “pontos”, mas objetos de regra, definidos no mxGraph assim:

```ts
class mxConnectionConstraint {
    point: mxPoint | null; // Normalized coordinates (0~1)
    perimeter: boolean; // Whether to project onto the boundary
    name?: string; // Optional port name
}
```

No editor do draw.io que acompanha, dá para ver vários “pontos de conexão azuis” no diagrama. Eles são definidos ao sobrescrever as restrições do diagrama:

```ts
mxRectangleShape.prototype.getConstraints = function (style) {
    return [
        new mxConnectionConstraint(new mxPoint(0.5, 0), true), // top
        new mxConnectionConstraint(new mxPoint(1, 0.5), true), // right
        new mxConnectionConstraint(new mxPoint(0.5, 1), true), // bottom
        new mxConnectionConstraint(new mxPoint(0, 0.5), true), // left
    ];
};
```

Nossas restrições são definidas assim: um conjunto de restrições pode ser declarado em um nó:

```ts
export interface ConstraintAttributes {
    x?: number;
    y?: number;
    perimeter?: boolean;
    dx?: number;
    dy?: number;
}

export interface BindedAttributes {
    constraints: ConstraintAttributes[];
}
```

Recupere as restrições candidatas, selecione a restrição mais próxima e converta a restrição em um ponto geométrico. Se for preciso projetar no limite, siga para a lógica de cálculo do algoritmo de limite apresentada na seção anterior.

### Restrição na aresta {#constraint-on-edge}

Você também precisa definir de qual ponto de âncora do nó a aresta vai entrar ou sair. Durante a interação, isso corresponde a arrastar a extremidade da aresta até o ponto de âncora do nó. Nesse momento, `entryX/entryY` precisa copiar o campo `x/y` da restrição do ponto de âncora:

```ts
interface BindingAttributes {
    fromId: string;
    toId: string;
    orthogonal: boolean;
    exitX: number; // [!code ++]
    exitY: number; // [!code ++]
    exitPerimeter: boolean; // [!code ++]
    exitDx: number; // [!code ++]
    exitDy: number; // [!code ++]
    entryX: number; // [!code ++]
    entryY: number; // [!code ++]
    entryPerimeter: boolean; // [!code ++]
    entryDx: number; // [!code ++]
    entryDy: number; // [!code ++]
}
```

No exemplo a seguir, definimos os pontos de âncora `[1, 0]` e `[0, 1]` nos retângulos cinza e verde, respectivamente.

As coordenadas das extremidades `exitX/exitY` e `entryX/entryY` precisam ser números finitos. Se qualquer uma das coordenadas for inválida, a extremidade volta ao perímetro da forma, em vez de produzir um caminho não finito. Deslocamentos em pixels inválidos (`exitDx/exitDy` ou `entryDx/entryDy`) são ignorados enquanto uma âncora válida permanece fixa.

Com a ferramenta de seta, clique uma vez para escolher a origem e mova o ponteiro para pré-visualizar a conexão. A pré-visualização acompanha o movimento horizontal e vertical, inclusive quando qualquer extremidade está na tela vazia. Clique de novo para concluir, ou pressione Escape para cancelar.

<BindingConstraint />

## Regras de roteamento {#routing rules}

O mxGraph usa funções EdgeStyle para implementar regras de roteamento, responsáveis por:

-   Selecionar automaticamente as direções de saída e entrada
-   Inserir pontos de passagem
-   Evitar as caixas delimitadoras dos nós
-   Calcular caminhos ortogonais e em ângulo reto

![Estilos de conector](https://drawio-app.com/wp-content/uploads/2019/02/drawio-connector-styles.png)

| Conector         | Recursos                                                                          | Casos de uso                                                                 |
| ---------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| OrthConnector    | Gera automaticamente arestas ortogonais com suporte complexo a restrições        | Fluxogramas, organogramas e outros cenários de layout automático             |
| SegmentConnector | Oferece suporte a pontos de controle definidos pelo usuário, flexível e interativo | Quando o usuário precisa ajustar manualmente caminhos de arestas ortogonais |
| ElbowConnector   | Um único ponto de virada em L                                                     | Caminhos simples de 2 segmentos (por exemplo, navegação em trilha)           |
| SideToSide       | Conexão com prioridade na direção horizontal                                      | Quando os nós de origem e alvo estão distribuídos na horizontal              |
| TopToBottom      | Conexão com prioridade na direção vertical                                        | Quando os nós de origem e alvo estão distribuídos na vertical                |
| EntityRelation   | Específico de diagrama de relacionamento de banco de dados, gera caminhos flexíveis | Diagramas ER de banco de dados, relacionamentos bidirecionais             |
| Loop             | Implementa conexões de laço próprio                                               | Relacionamentos de laço próprio em diagramas de estado ou de autômatos       |

### OrthConnector {#orth-connector}

[OrthConnector] é o algoritmo de roteamento mais comum, com o objetivo central de criar um caminho entre os nós de origem e destino formado apenas por segmentos de linha horizontais e verticais, evitando linhas diagonais. Os passos específicos são:

1. Determinar a direção de saída e entrada da origem e do destino
2. Buscar padrões de roteamento predefinidos com base nas combinações de direção
3. Aplicar os padrões de roteamento para gerar uma sequência de pontos de virada
4. Tratar o desvio de obstáculos e a otimização

```ts
┌──────┐        ┌──────┐
│ Node │ ─┐     │ Node │
└──────┘  └────▶└──────┘
```

<BindingRouteOrthConnector />

#### Seleções de porta preferidas {#preferred-port-selections}

Primeiro, considere o caso sem restrições de porta. O passo inicial é determinar a posição do quadrante do alvo em relação à origem. Ao comparar os centros geométricos dos dois, obtemos:

```ts
// 0 | 1
// -----
// 3 | 2

let dx = sourceCenX - targetCenX;
let dy = sourceCenY - targetCenY;
let quad = 0;
if (dx < 0) {
    if (dy < 0) {
        quad = 2;
    } else {
        quad = 1;
    }
}
// Other circumstances omitted.
```

Em seguida vem a parte mais complexa: determinar de qual direção as arestas devem sair do nó de origem e entrar no nó de destino.

Primeiro, calcule a distância entre os nós:

```ts
        sourceTopDist
             ↑
    [Source] |
             ↓
        sourceBottomDist
             ↑
             | [Target]

sourceLeftDist ← [Source] → sourceRightDist → [Target]
```

Depois determine a direção preferida com uma estratégia que favorece a direção com mais espaço disponível:

-   Se a distância até a esquerda ≥ a distância até a direita, o nó de origem prefere ir para o oeste (esquerda).
-   Se a distância até o topo ≥ a distância até a base, o nó de origem prefere ir para o norte (cima).
-   A direção preferida do nó alvo é a direção oposta à do nó de origem.

```ts
var dirPref = [];
var horPref = [];
var vertPref = [];

horPref[0] =
    sourceLeftDist >= sourceRightDist
        ? mxConstants.DIRECTION_MASK_WEST
        : mxConstants.DIRECTION_MASK_EAST;
vertPref[0] =
    sourceTopDist >= sourceBottomDist
        ? mxConstants.DIRECTION_MASK_NORTH
        : mxConstants.DIRECTION_MASK_SOUTH;

horPref[1] = mxUtils.reversePortConstraints(horPref[0]);
vertPref[1] = mxUtils.reversePortConstraints(vertPref[0]);

var preferredHorizDist =
    sourceLeftDist >= sourceRightDist ? sourceLeftDist : sourceRightDist;
var preferredVertDist =
    sourceTopDist >= sourceBottomDist ? sourceTopDist : sourceBottomDist;
```

#### Escolher padrões de rota {#choose-route-patterns}

Com base nos índices direcionais da origem e do destino, selecione um padrão de rota entre os `routePatterns` predefinidos para garantir a qualidade, codificado com uma bitmask:

-   4 bits baixos: direção (1=oeste, 2=norte, 4=leste, 8=sul)
-   Bits 5–8: qual lado da aresta
-   Bit 9: se deve usar o ponto central
-   Bit 10: se deve se associar ao nó de origem
-   Bit 11: se deve se associar ao nó de destino

```ts
routePatterns: [
    [ [ 513, 2308, 2081, 2562 ], [ 513, 1090, 514, 2184, 2114, 2561 ],
        [ 513, 1090, 514, 2564, 2184, 2562 ],
        [ 513, 2308, 2561, 1090, 514, 2568, 2308 ] ],
    // ... more patterns
],
```

#### Gerar pontos de passagem {#generate-waypoints}

Percorra os padrões de roteamento e gere os pontos reais do caminho com base na direção.

```ts
for (var i = 0; i < routePattern.length; i++)
{
    var nextDirection = routePattern[i] & 0xF;

    // Rotate the index of this direction by the quad
    var directionIndex = nextDirection == mxConstants.DIRECTION_MASK_EAST ? 3
            : nextDirection;

    directionIndex += quad;

    if (directionIndex > 4)
    {
        directionIndex -= 4;
    }
```

Por fim, simplifique pontos de caminho adjacentes que estejam muito próximos. Para isso, continuamos usando [simplify-js], como na [Lição 12 - Simplificar a polilinha].

### SegmentConnector {#segment-connector}

O OrthConnector tende ao roteamento automático. Quando o usuário especifica explicitamente pontos de controle `controlHints`, o SegmentConnector transforma essas dicas em pontos de passagem que precisam ser atravessados ou aos quais é preciso se alinhar, e a polilinha resultante é construída em grande parte em torno dessas dicas — então ela é mais previsível e consistente para a edição interativa.

### LoopConnector {#loop-connector}

Quando o início e o fim coincidem, precisamos de um laço próprio.

<BindingLoop />

## Estilo da linha do conector {#connectors-style}

![fonte: https://www.drawio.com/doc/faq/connector-styles](https://www.drawio.com/assets/img/blog/style-tab-line-style.png)

### Arredondado {#rounded}

Cantos arredondados significam que ainda usamos os pontos de passagem da polilinha calculados antes, mas substituímos os cantos vivos por transições suaves nas junções. Os passos são:

-   Percorra cada dobra da polilinha.
-   Dos dois lados de cada canto, recue ao longo do segmento (no máximo metade do comprimento do segmento).
-   Use `quadTo` (ou um comando de curva equivalente) para desenhar um filete suave no canto.

<BindingRounded />

### Bézier quadrática {#curved}

Use segmentos de Bézier quadrática para conectar pontos de controle adjacentes:

```ts
const p0 = pts[n - 2];
const p1 = pts[n - 1];
parts.push(
    `Q ${formatNumber(p0.x)} ${formatNumber(p0.y)} ${formatNumber(
        p1.x,
    )} ${formatNumber(p1.y)}`,
);
```

<BindingCurved />

### Bézier cúbica {#bezier}

Quando há `3n+1` pontos, interprete-os diretamente como pontos de controle de Bézier cúbica na forma `[anchor, cp1, cp2, anchor, ...]`; caso contrário, volte para segmentos de Bézier quadrática.

```ts
if ((n - 1) % 3 === 0) {
    for (let i = 1; i + 2 < n; i += 3) {
        const cp1 = pts[i];
        const cp2 = pts[i + 1];
        const end = pts[i + 2];
        parts.push(
            `C ${formatNumber(cp1.x)} ${formatNumber(cp1.y)} ` +
                `${formatNumber(cp2.x)} ${formatNumber(cp2.y)} ` +
                `${formatNumber(end.x)} ${formatNumber(end.y)}`,
        );
    }
    return parts.join(' ');
}
```

<BindingBezier />

### Preservar curvas editáveis {#editable-curves}

Um `path` ou `rough-path` do ECS com um único segmento editável `Q` ou `C` conserva os pontos de controle ao carregar um documento ou atualizar as vinculações. Mover uma extremidade vinculada também move o controle cúbico adjacente. Quando uma quadrática conecta as duas extremidades diretamente, o controle compartilhado se move pela média dos deslocamentos delas. Mover as duas extremidades pela mesma quantidade, portanto, translada essa curva sem mudar a forma.
Uma extremidade não vinculada conserva a geometria editada mesmo se um `sourcePoint` ou `targetPoint` salvo estiver desatualizado. Rotação, reflexão e escala entram na aplicação dessas mudanças. Rotas com vários segmentos de Bézier continuam usando o roteador.

### Rótulos de aresta {#edge-labels}

Um nó filho `text` pode usar `edgeLabelPosition` para especificar uma posição na aresta pai. Os valores são limitados a `[0, 1]`. `edgeLabelOffset` é uma distância com sinal ao longo da normal; valores positivos colocam o rótulo abaixo de uma aresta horizontal que vai da esquerda para a direita. Editar qualquer uma das propriedades atualiza o rótulo na hora e oferece suporte a desfazer, refazer e recarregar o documento. Limpar `edgeLabelOffset` restaura zero; limpar `edgeLabelPosition` desativa o posicionamento automático.

Os rótulos de Path interpolam, no momento, ao longo da polilinha dos pontos finais dos comandos, usando uma corda para cada segmento curvo. Os comandos com suporte incluem `H/V`, `S/T` e `A`, além de `L`, `Q` e `C`. Isso é uma aproximação do comprimento da curva, e não um posicionamento exato ao longo do contorno curvo.

## [WIP] Exportar SVG {#export-svg}

Na exportação, já não basta salvar só a informação geométrica; as relações lógicas também precisam ser persistidas. Por exemplo, o draw.io salva o conteúdo mxfile original no atributo `content` do `<svg>` ao exportar (isso não faz parte de nenhuma especificação formal):

```html
<svg content='&lt;mxfile host="app.diagrams.net" diagram name="Page-1"'></svg>
```

Também poderíamos usar:

```html
<line x1="0" y1="0" data-binding="" />
```

## Editor {#editor}

### Destacar âncoras {#highlight-anchors}

-   Quando um nó está selecionado, exiba os pontos de âncora disponíveis a partir dos quais as conexões podem ser iniciadas.
-   Quando uma aresta está selecionada, destaque os pontos de âncora encaixáveis durante o arraste.

<BindingArrow />

[Lição 23 - Mapa mental]: /pt-BR/guide/lesson-023
[Lição 25 - Desenhar setas]: /pt-BR/guide/lesson-025#draw-arrow
[Lição 18 - Definir componentes pai-filho]: /pt-BR/guide/lesson-018#define-component
[Change the shape perimeter]: https://www.drawio.com/doc/faq/shape-perimeter-change
[JSON Canvas Spec]: https://jsoncanvas.org/spec/1.0/
[mxConnectionConstraint]: https://github.com/jgraph/drawio/blob/81a267568da862d3c99970758c09a8e768dea973/src/main/webapp/mxgraph/src/view/mxConnectionConstraint.js#L23
[OrthConnector]: https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/view/mxEdgeStyle.js#L1067
[simplify-js]: https://github.com/mourner/simplify-js
[Lição 12 - Simplificar a polilinha]: /pt-BR/guide/lesson-012#simplify-polyline
