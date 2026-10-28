---
outline: deep
description: 'Implementação de um sistema de animação: design de uma API de animação declarativa, compatibilidade com a Web Animations API, fluxo de animação baseado em geradores e técnicas de animação de caminhos SVG.'
---

<script setup>
import AnimationController from '../../components/AnimationController.vue';
import AnimationEasing from '../../components/AnimationEasing.vue';
import AnimationTransformOrigin from '../../components/AnimationTransformOrigin.vue';
import AnimationDasharray from '../../components/AnimationDasharray.vue';
import AnimationDashoffset from '../../components/AnimationDashoffset.vue';
import AnimationMorphing from '../../components/AnimationMorphing.vue';
import AnimationLottieBouncyBall from '../../components/AnimationLottieBouncyBall.vue';
import AnimationLottiePolyStar from '../../components/AnimationLottiePolyStar.vue';
import AnimationLottieRepeater from '../../components/AnimationLottieRepeater.vue';
import AnimationTimeline from '../../components/AnimationTimeline.vue';
</script>

# Lição 36 - Animação {#lesson-36-animation}

Nesta lição, você vai aprender:

-   Como projetar uma API de animação
-   Como implementar keyframes declarativos e controladores alinhados à Web Animations API
-   Como implementar efeitos de caminho, traço e morphing
-   Como formatos como o Lottie se encaixam

## Como projetar a API de animação {#api-design}

O Motion é totalmente compatível com animação declarativa no estilo da WAAPI; veja [Improvements to Web Animations API]. Ele chama o `element.animate()` nativo do navegador para aceleração de GPU, uma thread de compositor independente e trabalho fora da thread principal. O JavaScript completa o que a WAAPI não oferece:

-   Física de mola (a WAAPI só aceita easing de Bézier)
-   Propriedades de `transform` independentes (animar `x`, `y` e `scale` separados, em vez de uma única string de transform combinada)
-   `transformOrigin` para os centros de escala e rotação
-   Auxiliares de timeline como `sequence()` e `stagger()`

```ts
import { animate, stagger } from 'motion';

// Returns a controller you can pause, play, and reverse
const controls = animate(
    '.box',
    { x: [0, 100], opacity: [0, 1] }, // keyframes
    { duration: 0.5, delay: stagger(0.1), easing: 'spring(1, 100, 10, 0)' },
);

// Serializable control calls
controls.pause();
controls.play();
controls.reverse();
```

Keyframes e opções são objetos simples e podem ser serializados em JSON. O estado de execução de `animate()` — vínculos com o DOM, tempo atual, velocidade e outros — não é serializável.

## Seguindo a WAAPI {#waapi}

Podemos seguir o polyfill da WAAPI [web-animations-js] e integrá-lo ao nosso ECS.

**Camada de dados:** keyframes no estilo da WAAPI (serializáveis)

```ts
interface Keyframe {
    offset?: number; // 0–1, same role as WAAPI offset
    [property: string]: any; // x, y, scale, fill, strokeWidth...
    easing?: string; // "ease-out", "spring(1, 100)"
}

interface AnimationOptions {
    duration: number; // ms
    delay?: number;
    iterations?: number | 'infinite';
    direction?: 'normal' | 'reverse' | 'alternate';
    fill?: 'forwards' | 'backwards' | 'both'; // How the animation appears when not running (before start, after end).
    easing?: string; // Global easing if a keyframe omits its own
}
```

**Camada de controle:** um controlador `Animation` no estilo da WAAPI. Diferenças em relação a um polyfill completo da WAAPI:

-   Sem parsing de string CSS. A WAAPI permite `{ transform: 'translate(100px)' }`, que é caro de analisar. Prefira `{ x: 100 }` (propriedades de transform independentes, no estilo do Motion).
-   `ease`, `ease-in`, `ease-out` e `linear` embutidos, além de `spring(mass, stiffness, damping)` no estilo do Motion.
-   Modos de **Composite**. Como o `composite: 'add' | 'replace'` da WAAPI, empilhe animações sobre os valores de base (por exemplo, a posição da entidade mais um deslocamento animado).
-   Suporte a **Timeline**. Como o `timeline()` do Motion ou o `GroupEffect` da WAAPI, incluindo stagger entre entidades.

### Controlador {#controller}

```ts
const animation = api.animate(
    node1,
    [
        { x: 100, fill: 'green' },
        { x: 200, fill: 'red' },
    ],
    {
        duration: 1000,
        direction: 'alternate',
        iterations: 'infinite',
        easing: 'ease-in-out',
    },
);
animation.pause();
animation.play();
animation.finish();
```

<AnimationController />

### Interpolação {#interpolation}

Escalares como `x` / `y` / `opacity` interpolam de forma trivial. Para `fill` / `stroke`, analise as cores com algo como `d3-color` e depois interpole cada canal rgba.

Para gradientes lineares, contagens de stops iguais interpolam a posição e a cor de cada stop. Contagens diferentes usam as posições de stop combinadas dos dois gradientes, preservando posições repetidas que representam transições duras de cor. Isso mantém o espaçamento não uniforme quando os dois keyframes contêm o mesmo gradiente.

No ECS, `fill` / `fillOpacity` e `stroke` / `strokeOpacity` atualizam juntos a primeira camada de pintura habilitada. As outras camadas e o estado habilitado delas são preservados. Se nenhuma camada estiver habilitada, animar uma pintura acrescenta uma; animar só a opacidade não cria uma camada nova.

```ts
function interpolateValue(from: unknown, to: unknown, t: number) {
    if (isFiniteNumber(from) && isFiniteNumber(to)) {
        return interpolateNumber(from, to, t);
    }
    const fromColor = parseColor(from);
    const toColor = parseColor(to);
    if (fromColor && toColor) {
        return colorToRgbaString({
            r: interpolateNumber(fromColor.r, toColor.r, t),
            g: interpolateNumber(fromColor.g, toColor.g, t),
            b: interpolateNumber(fromColor.b, toColor.b, t),
            a: interpolateNumber(fromColor.a, toColor.a, t),
        });
    }
    return t < 1 ? from : to;
}
```

### Easing {#easing-function}

Além das curvas padrão, podemos aceitar `spring`:

```ts
function evaluateEasing(easing: string, t: number) {
    const p = clamp01(t);
    const bezier = EASING_FUNCTION[easing as keyof typeof EASING_FUNCTION];
    if (bezier) {
        return clamp01(bezier(p));
    }
    if (easing.startsWith('spring(')) {
        return evaluateSpringEasing(p, easing);
    }
    return p;
}
```

<AnimationEasing />

### Origem da transformação {#transform-origin}

<AnimationTransformOrigin />

## Efeitos especiais de animação {#special-effects}

### Animação de caminho {#path-animation}

Mover gráficos ao longo de um caminho é comum; o CSS faz isso com Motion Path.

```css
#motion-demo {
    animation: move 3000ms infinite alternate ease-in-out;
    offset-path: path('M20,20 C20,100 200,0 200,100');
}
@keyframes move {
    0% {
        offset-distance: 0%;
    }
    100% {
        offset-distance: 100%;
    }
}
```

### Animação de traço {#stroke-animation}

Precisamos do comprimento do caminho:

```ts
const length = api.getTotalLength(path);
api.animate(
    path,
    [{ strokeDasharray: [0, length] }, { strokeDasharray: [length, 0] }],
    {
        duration: 3500,
    },
);
```

<AnimationDasharray />

### Deslocamento do tracejado {#dashline-offset}

O draw.io usa animação para mostrar a direção do conector:

![fonte: https://www.drawio.com/doc/faq/connector-animate](https://www.drawio.com/assets/img/blog/connector-flow-animation.svg)

> Exporte o diagrama para um arquivo SVG para incluir a animação do conector ao publicá-lo numa página web ou numa plataforma de conteúdo que aceite imagens SVG.

```ts
api.animate(node, [{ strokeDashoffset: -20 }, { strokeDashoffset: 0 }], {
    duration: 500,
    iterations: Infinity,
});
```

<AnimationDashoffset />

### Morphing {#morphing}

Muitas bibliotecas SVG demonstram morphing:

-   [Paper.js]
-   O [Kute.js] oferece Morph e CubicMorph
-   O MorphSVGPlugin do GreenSock consegue até renderizar em Canvas
-   [vectalign]

Algumas bibliotecas exigem que a estrutura dos segmentos coincida antes e depois do morph, senão a interpolação falha.

Seguindo o CubicMorph do Kute.js: converta os segmentos do caminho em Béziers cúbicas, use subdivisão simples para normalizar os dois caminhos para a mesma quantidade de segmentos e depois interpole os pontos de controle de cada segmento.

O alinhamento de winding e de ponto inicial só se aplica quando os dois caminhos contêm um único contorno fechado. Caminhos abertos preservam a ordem dos extremos, então transladar uma curva não troca os extremos nem faz a curva colapsar no meio da animação.

```ts
function mergePaths(
    left: { absolutePath: AbsoluteArray; curve: CurveArray | null },
    right: { absolutePath: AbsoluteArray; curve: CurveArray | null },
): [CurveArray, CurveArray, (b: CurveArray) => CurveArray] {
    let curve1 = left.curve;
    let curve2 = right.curve;
    if (!curve1 || curve1.length === 0) {
        // convert to curves to do morphing & picking later
        // @see http://thednp.github.io/kute.js/svgCubicMorph.html
        curve1 = path2Curve(left.absolutePath, false) as CurveArray;
        left.curve = curve1;
    }
    if (!curve2 || curve2.length === 0) {
        curve2 = path2Curve(right.absolutePath, false) as CurveArray;
        right.curve = curve2;
    }

    let curves = [curve1, curve2];
    if (curve1.length !== curve2.length) {
        curves = equalizeSegments(curve1, curve2);
    }

    const closed = [left.absolutePath, right.absolutePath].every(
        (path) =>
            path[path.length - 1]?.[0] === 'Z' &&
            path.filter(([command]) => command === 'M').length === 1,
    );
    const curve0 =
        closed && getDrawDirection(curves[0]) !== getDrawDirection(curves[1])
            ? reverseCurve(curves[0])
            : (clonePath(curves[0]) as CurveArray);

    return [
        curve0,
        closed ? (getRotatedCurve(curves[1], curve0) as CurveArray) : curves[1],
        (pathArray: CurveArray) => pathArray,
    ];
}
```

<AnimationMorphing />

## Lottie {#lottie}

-   [lottie json schema]
-   [Tips for rendering]
-   [lottie-parser] — seguimos sobretudo a lógica de parsing dele
-   [velato] — um renderizador construído sobre o Vello

### Uso {#lottie-usage}

Implementamos um plugin que converte JSON do Lottie em gráficos e keyframes. Destaques:

-   Aceita os seguintes elementos de camadas Shape:
    -   [Rectangle](https://lottiefiles.github.io/lottie-docs/shapes/#rectangle)
    -   [Ellipse](https://lottiefiles.github.io/lottie-docs/shapes/#ellipse)
    -   [PolyStar](https://lottiefiles.github.io/lottie-docs/shapes/#polystar)
    -   [Path](https://lottiefiles.github.io/lottie-docs/shapes/#path)
    -   [Group](https://lottiefiles.github.io/lottie-docs/shapes/#group)
-   No Lottie, `anchorX` / `anchorY` definem o centro de escala e rotação em relação ao canto superior esquerdo da caixa delimitadora da forma — tenha cuidado ao mapear para `transformOrigin`
-   Una várias faixas de animação num único conjunto de keyframes e preencha as propriedades que faltarem

```ts
import { loadAnimation } from '@infinite-canvas-tutorial/lottie';

const response = await fetch('/bouncy_ball.json');
const animation = loadAnimation(await response.json(), {
    loop: true,
    autoplay: true,
    onDiagnostic: ({ code, path, message }) =>
        console.info(code, path, message),
});

await api.edit(() => animation.render(api), { capture: 'NEVER' });

// On component unmount (also automatically cleaned up on canvas destruction):
// await animation.destroy();
```

Abaixo, o exemplo oficial rodando na nossa montagem: [Bouncy Ball]

<AnimationLottieBouncyBall />

### Compatibilidade {#lottie-compatibility}

Este importador converte Lottie em nós e keyframes do ECS; não é um renderizador Lottie completo. Analisar um campo não significa necessariamente implementar o efeito visual dele.

| Recurso                                                | Comportamento atual                                                                                                                                                                                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retângulos, elipses, caminhos, grupos; fill/stroke básico | Geometria estática básica, morphing de caminho e posição/rotação/escala 2D; a animação de tamanho e de canto das primitivas continua limitada                                                                                      |
| PolyStar                                               | Estrelas/polígonos, os dois windings, quantidade de pontas, posição, rotação, raio interno/externo e arredondamento; keyframes numéricos com easing temporal e retenção (hold)                                                                   |
| Repeater                                               | Cópias das formas/grupos anteriores; quantidade, offset, âncora, translação, escala, rotação, opacidade inicial/final e ordem de composição, inclusive keyframes numéricos                                                            |
| Solid, Null, parenting, Precomp                        | Suporte básico; visibilidade de entrada/saída da camada, estiramento de tempo e remapeamento estão incompletos                                                                                                                        |
| Gradientes e várias pinturas                           | Gradientes básicos; geometria de gradiente animada, realces radiais e a ordem de várias pinturas/operadores continuam limitados                                                                                                       |
| Trim Paths                                             | Aproximação por stroke-dash com cobertura cheia/vazia corrigida, ordenação de extremos e offsets; geometria preenchida, modos de vários caminhos, padrões de tracejado já existentes, caps redondas de comprimento zero animadas, direção e ordem dos modificadores continuam limitados |
| Movimento espacial de Bézier, Skew                     | Incompleto; reportado durante a inspeção                                                                                                                                                                                               |
| Merge Paths, Round Corners e outros modificadores      | Não são renderizados                                                                                                                                                                                                                   |
| Imagem                                                 | Parcial; diretórios de assets e o pré-carregamento não estão implementados                                                                                                                                                             |
| Texto, máscaras, Track Mattes, efeitos, modos de mistura, 3D | Não implementado ou não renderizado de forma confiável; capacidades do ECS não implicam suporte à importação do Lottie                                                                                                           |
| Expressões                                             | Pré-calculadas na importação; o padrão é o ExpressionManager empacotado do lottie-web, com um ambiente limitado de camada de forma, e não a semântica completa do AE                                                                  |

`inspectLottie(data)` verifica lacunas conhecidas sem alterar o JSON nem avaliar expressões. `animation.getDiagnostics()` e `onDiagnostic` fornecem um `code` estável, `severity` (`partial` / `unsupported`), o `path` em JSON Pointer e uma mensagem. A importação continua com os diagnósticos; uma lista vazia não certifica compatibilidade com o AE. Expanda **Notas de compatibilidade** nos exemplos para inspecionar as lacunas.

A reprodução usa um único relógio de composição. `goTo(value, true)` busca quadros relativos à composição; a unidade padrão é segundos, preservando o estado de reproduzir/pausar. `stop()` pausa no quadro zero. `setSpeed()` recebe um multiplicador positivo; `setDirection(-1)` inverte a partir da posição atual e preserva a velocidade. `playSegments([start, end])` respeita os dois extremos; extremos descendentes reproduzem para trás. `loop` numérico conta repetições extras. Os controladores ECS devolvidos por `getAnimations()` são amostrados pelo reprodutor; controle o tempo pela API do reprodutor.

Chamar `render(api)` de novo na mesma instância é idempotente; outra tela precisa de uma instância separada. `destroy()` é idempotente, cancela a reprodução e remove a árvore de nós importada numa edição segura. Os componentes também devem cancelar fetches pendentes e edições enfileiradas ao desmontar. Regressões de navegador comparam quadros fixos com uma versão fixada do lottie-web quanto a posição, Trim Paths com traço de um único caminho, geometria de PolyStar e grupos Repeater em quadros inteiros e fracionários; elas não estabelecem paridade do formato inteiro.

### Estrelas e polígonos {#lottie-polystar}

O PolyStar (`ty: "sr"`) gera um caminho de Bézier fechado: `sy: 1` seleciona uma estrela e `sy: 2` um polígono. A quantidade de pontas (`pt`), a posição (`p`), a rotação (`r`), o raio (`or` / `ir`) e o arredondamento (`os` / `is`) podem animar de forma independente. As propriedades internas só se aplicam a estrelas. `d: 3` inverte o winding. Quantidades fracionárias de pontas são arredondadas para baixo, como no lottie-web 5.13; isso não é um morph contínuo entre quantidades de pontas.

O exemplo anima as duas formas. Pause, inverta ou arraste **Seek frame** para inspecionar a geometria intermediária. Os parâmetros são interpolados antes de construir o caminho, então a rotação preserva o raio e as mudanças na quantidade de pontas entram em vigor no instante certo.

<AnimationLottiePolyStar />

A geometria animada do PolyStar é amostrada por um controlador de plugin no relógio da composição. Guarde o JSON original do Lottie para recarregá-lo: a serialização simples de keyframes do ECS e o editor de animação ainda não preservam nem editam essas faixas de parâmetros procedurais. Tangentes de posição espacial, combinações de modificadores (incluindo Trim Paths sobre geometria que muda), expressões e outras limitações da matriz continuam valendo. Traços curvos também herdam as fendas de transparência que o renderizador ECS já tem em algumas junções tesseladas; os testes de referência verificam a silhueta e a cor, não a paridade do alfa.

### Curvas de Bézier no Lottie {#beziers-in-lottie}

[Beziers in Lottie]

-   `v` é um array de vértices.
-   `i` é um array de pontos de tangente “de entrada”, relativos a `v`.
-   `o` é um array de pontos de tangente “de saída”, relativos a `v`.
-   `c` é um booleano que determina se a poli-Bézier está fechada. Se estiver, há um segmento de Bézier extra entre o último ponto de `v` e o primeiro.

### Repeater {#repeater}

O Repeater (`ty: "rp"`) duplica os operadores que vêm antes dele no grupo de forma atual. Mantenha o fill/stroke **dentro do grupo repetido** para pintar cada cópia de forma independente. Grupos de forma aninhados e geometria animada de PolyStar podem ser repetidos. Repeaters aninhados ou empilhados hoje usam duplicação recursiva e emitem `shape.repeater.nested`; a ordem composta e as cópias de origem retidas podem diferir do lottie-web.

As cópias (`c`) são arredondadas para cima; zero oculta todas as cópias. O offset (`o`) aceita valores fracionários e negativos. O transform (`tr`) inclui âncora (`a`), translação (`p`), escala não uniforme (`s`), rotação (`r`) e opacidade inicial/final (`so` / `eo`). O modo de composição (`m`) muda o empilhamento das cópias. Faixas numéricas aceitam easing temporal e retenção (hold). As transformações seguem o lottie-web 5.13, inclusive o comportamento de cruzar a identidade em offsets inteiros negativos.

<AnimationLottieRepeater />

O importador aloca um conjunto de cópias a partir do limite superior da faixa de quantidade, incluindo a ultrapassagem do easing. A reprodução e a busca reutilizam esse conjunto. Quantidades grandes e repeaters aninhados multiplicam a quantidade de nós importados. Como no PolyStar, guarde o JSON original do Lottie: a serialização simples de keyframes do ECS e o editor de animação não preservam essas faixas procedurais.

Operadores de pintura **depois** do Repeater têm suporte parcial e emitem `shape.repeater.paint-scope`: a herança de pintura por cópia não reproduz a cobertura/opacidade do preenchimento composto compartilhado do lottie-web. A ordem dos modificadores, a inclinação (skew), o movimento espacial e o tempo da camada continuam sujeitos à matriz de compatibilidade. Escalas inversas singulares (por exemplo escala zero com offset negativo) ocultam as cópias afetadas em vez de enviar transforms inválidos.

### Expressões {#expression}

[Expressions]

```json
{
    "ty": "sh",
    "ks": {
        "a": 0,
        "k": {
            "i": [],
            "o": [],
            "v": []
        },
        "x": "var group = thisLayer.content(\"Quadratic Points\");\nvar num_points = 3;\nvar points = [];\nvar ip = [];\nvar op = [];\nfor ( var i = 0; i < num_points; i++ )\n{\n    var pos = group.content(\"p\" + i).position;\n    points.push(pos);\n    ip.push(pos);\n    op.push(pos);\n}\nvar $bm_rt = {\n    v: points,\n    i: ip,\n    o: op\n};\n"
    }
}
```

### Camada de texto {#text-layer}

Camadas de texto e animadores de texto ainda não são importados.

### Máscara de recorte {#clipping-mask}

Modos de máscara, inversão, animação e track mattes não são renderizados de forma confiável.

[clipping-masks]

### Efeitos de camada {#layer-effects}

Os efeitos do Lottie ainda não estão mapeados para o ECS.

[Layer Effects]

## Rive {#rive}

[Rive vs Lottie]

![fonte: https://rive.app/blog/rive-as-a-lottie-alternative](https://framerusercontent.com/images/gKzhMgEDMMUPLVkhMtTDfQdQrQ.png?width=1920&height=800)

## Manim {#manim}

<https://github.com/3b1b/manim>

-   [Discussion in HN]

## Editor de animação {#animation-editor}

Inspirados por produtos como [lottielab] e [Jitter], construímos um editor de animação leve na camada de Web Components: o **painel de animação** à direita edita os keyframes do elemento selecionado, e o **painel Timeline** embaixo mostra a timeline da cena inteira e conduz a cabeça de reprodução dessa tela. Os dois compartilham os mesmos dados de keyframe serializáveis e o relógio da cena em `AppState`.

![fonte: https://jitter.video/](/jitter.png)

### Layout {#animation-editor-layout}

A barra de tarefas expõe dois interruptores independentes:

-   `SHOW_ANIMATION_PANEL` → `ic-spectrum-animation-panel` (lado direito, junto do painel de propriedades)
-   `SHOW_TIMELINE_PANEL` → `ic-spectrum-timeline-panel` (encaixe inferior, na largura toda da tela)

Fluxo típico:

1. Selecione um único elemento e adicione uma animação, ou edite as faixas de propriedade no painel de animação.
2. Abra a Timeline para ver cada camada animada da cena e o intervalo de tempo dela.
3. Percorra a cabeça de reprodução ou pressione Play para pré-visualizar a cena inteira num instante.
4. Selecionar uma faixa na Timeline também seleciona o elemento dela; o painel de animação à direita mostra os keyframes desse elemento.

### Relógio da cena e modo de edição {#animation-scene-clock}

A Timeline conduz a **cabeça de reprodução da tela em `AppState`**, desacoplada de cada `AnimationController`. Telas que compartilham um mundo ECS mantêm cabeças de reprodução, estado de reprodução e durações de cena independentes:

| Campo                  | Significado                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animationEditing`     | Quando `true`, entra no **modo de scrub determinístico**: cada controlador desta tela é amostrado no mesmo `animationCurrentTime`, em vez de correr livre por conta própria |
| `animationCurrentTime` | Posição da cabeça de reprodução desta tela (milissegundos)                                                                                                            |
| `animationPlaying`     | Se a cabeça de reprodução avança sozinha                                                                                                                               |
| `animationLoop`        | Se a reprodução volta a 0 no fim da cena                                                                                                                               |

Quando `animationEditing === true`, o `AnimationSystem` amostra só as entidades que pertencem a essa tela. Enquanto está pausado, os controladores ficam fixos em `animationCurrentTime`; enquanto reproduz, a cabeça de reprodução avança pelos deltas de `performance.now()`. O tempo de relógio de parede em pausa fica de fora quando a reprodução retoma, e a duração da cena é determinada pelas faixas dessa tela.

Depois de sair do modo de edição, os controladores pausados pelo editor retomam o autoplay a partir da posição atual. Controladores que o chamador já tinha pausado continuam pausados, e controladores cancelados não são reiniciados.

Abrir a Timeline chama automaticamente `setAnimationEditing(true)`, para que o scrub e a pré-visualização permaneçam consistentes.

### Design do painel Timeline {#animation-timeline}

<AnimationTimeline />

#### Dados das faixas {#track-data}

A Timeline não lê o JSON do nó diretamente; ela agrega por `api.getAnimatedTracks()`:

```ts
interface Track {
    id: string; // node id
    name: string; // layer name; falls back to id
    properties: string[]; // e.g. ['opacity', 'x']
    delay: number; // ms
    duration: number; // active animation length (total − delay)
    totalDuration: number;
}
```

A duração da cena é o máximo de `totalDuration` entre todas as faixas. O `left` / `width` da barra são calculados como `delay * PX_PER_MS` e `duration * PX_PER_MS`.

#### Interações {#interactions}

| Ação                   | Comportamento                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Clicar no rótulo da faixa | `layersSelected = [track.id]`, destaca a faixa e conduz o painel de animação   |
| Arrastar a lane / a régua | Percorre a cabeça de reprodução; a tela pré-visualiza esse quadro ao vivo      |
| Play / Pause           | `toggleAnimationPlaying()` avança o relógio global no modo de edição               |
| Loop                   | `setAnimationLoop()` controla se a cena volta ao início no fim                     |

### Painel de animação (funciona com a Timeline) {#animation-panel}

Componente: `packages/webcomponents/src/spectrum/animation-panel.ts`.

-   Só é editável com uma seleção **única**; seleção múltipla ou nenhuma seleção mostra um espaço reservado.
-   Opções globais: `duration`, `delay`, `easing` padrão, `iterations` (interruptor Loop).
-   Keyframes agrupados por **faixa de propriedade**; cada linha tem `offset` (0–1), valor, `easing` e um botão de excluir.
-   **Adicionar keyframe na cabeça de reprodução**: lê `animationCurrentTime`, converte para um offset normalizado e amostra os valores atuais da propriedade por `controller.getCurrentValues()`. Abra a Timeline e percorra até o instante desejado antes de inserir um keyframe.
-   `fill` / `stroke` usam um popover + `ic-spectrum-color-picker`; as outras propriedades numéricas usam `sp-number-field`.
-   A largura e a altura do painel são redimensionáveis; os tamanhos persistem em `localStorage` (a mesma interação de alça do painel de propriedades).

Todas as edições passam por `setNodeAnimation` / `updateNodeAnimationKeyframe` e participam do histórico de desfazer e da serialização do documento.

### Diferenças em relação a editores no estilo do Lottie {#animation-editor-vs-lottie}

A implementação atual permanece simples de propósito, em comparação com ferramentas DCC completas como o [lottielab]:

-   A Timeline usa **uma faixa por nó**, e não o layout de várias faixas de camada + propriedade do Lottie; os nomes das propriedades aparecem como sufixo do rótulo (`Rect · opacity, x`).
-   Keyframes e o tempo da barra ainda não podem ser arrastados na Timeline; o tempo é editado pelo `offset` no painel de animação.
-   As expressões usam um pré-cálculo limitado na hora da importação. Camadas de texto e máscaras de recorte não têm suporte confiável, e este editor também não as cria.

Extensões possíveis: subfaixas de propriedade, marcadores de losango nos keyframes, arrastar as bordas da barra para mudar delay/duração, e mais.

### Referências externas {#external-references}

-   [lottielab]
-   [omnilottie]
-   [thorvg.viewer]
-   [Jitter]

## Leitura adicional {#further-reading}

-   [Magic Animator]
-   [A major breakthrough in real-time vector graphics]
-   [Art meets technology: the next step in bringing our characters to life]
-   [Canvas vs WebGL]

[Improvements to Web Animations API]: https://motion.dev/docs/improvements-to-the-web-animations-api-dx
[A major breakthrough in real-time vector graphics]: https://rive.app/renderer
[Art meets technology: the next step in bringing our characters to life]: https://blog.duolingo.com/world-character-visemes/
[Canvas vs WebGL]: https://rive.app/community/doc/canvas-vs-webgl/docanjXoQ1uT
[vectalign]: https://github.com/bonnyfone/vectalign
[Magic Animator]: https://magicanimator.com/
[Discussion in HN]: https://news.ycombinator.com/item?id=44994071
[lottielab]: https://www.lottielab.com/
[Jitter]: https://jitter.video/
[omnilottie]: https://fal.ai/models/fal-ai/omnilottie/api
[web-animations-js]: https://github.com/web-animations/web-animations-js
[lottie json schema]: https://lottiefiles.github.io/lottie-docs/schema/
[Paper.js]: http://paperjs.org/
[Kute.js]: https://thednp.github.io/kute.js/
[Tips for rendering]: https://lottiefiles.github.io/lottie-docs/rendering/
[lottie-parser]: https://github.com/pissang/lottie-parser
[velato]: https://github.com/linebender/velato
[Bouncy Ball]: https://lottiefiles.github.io/lottie-docs/breakdown/bouncy_ball/
[Beziers in Lottie]: https://lottiefiles.github.io/lottie-docs/breakdown/bezier/#beziers-in-lottie
[Expressions]: https://lottiefiles.github.io/lottie-docs/expressions/
[clipping-masks]: https://lottie-animation-community.github.io/docs/specs/layers/common/#clipping-masks
[Layer Effects]: https://lottiefiles.github.io/lottie-docs/effects/#layer-effects
[thorvg.viewer]: https://github.com/thorvg/thorvg.viewer
[Rive vs Lottie]: https://rive.app/blog/rive-as-a-lottie-alternative
