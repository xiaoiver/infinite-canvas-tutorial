---
outline: deep
description: 'Aprenda a desenhar caminhos complexos e implementar estilos desenhados à mão. Experimente SDF para caminhos, use métodos de triangulação para preenchimentos e crie efeitos de renderização de esboço com rough.js.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lição 13 - Desenhar caminho e estilo de esboço',
          },
      ]
---
<script setup>
import Holes from '../../components/Holes.vue';
import FillRule from '../../components/FillRule.vue';
import Watercolor from '../../components/Watercolor.vue';
</script>

# Lição 13 - Desenhar caminho e estilo de esboço {#lesson-13-drawing-path-and-sketchy-style}

Na lição anterior, apresentamos o desenho de uma polilinha. A parte de traço de um Path pode, em teoria, ser convertida em uma polilinha por amostragem; [p5js - bezierDetail()] faz isso, mas, para um efeito suave, é preciso adicionar mais pontos de amostragem. A parte de preenchimento, porém, ainda precisa ser implementada. Vamos tratar disso nesta lição:

-   Experimentar com SDF
-   Tentar desenhar preenchimentos usando alguns métodos de triangulação e traços usando polilinhas.
-   Desenhar algumas formas feitas à mão

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson13');
});
```

```js eval code=false inspector=false
call(() => {
    const {
        Canvas,
        Path,
        RoughCircle,
        RoughRect,
        deserializeNode,
        fromSVGElement,
        TesselationMethod,
    } = Lesson13;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const circle = new RoughCircle({
            cx: 600,
            cy: 100,
            r: 50,
            fill: 'black',
            strokeWidth: 2,
            stroke: 'red',
            fillStyle: 'zigzag',
        });
        canvas.appendChild(circle);

        const rect = new RoughRect({
            x: 550,
            y: 200,
            fill: 'black',
            strokeWidth: 2,
            stroke: 'red',
            fillStyle: 'dots',
        });
        rect.width = 100;
        rect.height = 50;
        canvas.appendChild(rect);

        fetch(
            '/Ghostscript_Tiger.svg',
            // '/photo-camera.svg',
        ).then(async (res) => {
            const svg = await res.text();
            const $container = document.createElement('div');
            $container.innerHTML = svg;
            const $svg = $container.children[0];
            for (const child of $svg.children) {
                const group = await deserializeNode(fromSVGElement(child));
                group.children.forEach((path) => {
                    path.cullable = false;
                });
                group.position.x = 100;
                group.position.y = 75;
                canvas.appendChild(group);

                const group2 = await deserializeNode(fromSVGElement(child));
                group2.children.forEach((path) => {
                    path.tessellationMethod = TesselationMethod.LIBTESS;
                    path.cullable = false;
                });
                group2.position.x = 300;
                group2.position.y = 75;
                canvas.appendChild(group2);
            }
        });
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## Alguns conceitos básicos {#basic-concepts}

### Diferenças em relação à polilinha {#diff-with-polyline}

Antes de tudo, vamos esclarecer a definição de [Paths] em SVG, em especial a diferença entre ele e `<polyline>`, a partir da MDN.

> O elemento \<path\> é o elemento mais poderoso da biblioteca SVG de formas básicas. Ele pode ser usado para criar linhas, curvas, arcos e muito mais.
>
> Embora os elementos \<polyline\> e \<path\> possam criar formas de aparência parecida, os elementos \<polyline\> exigem muitas linhas retas pequenas para simular curvas e não escalam bem para tamanhos maiores.

Por isso, falta suavização quando a curva é representada por `<polyline>`, como mostra a figura abaixo: [Draw arcs, arcs are not smooth ISSUE]

![polilinha - arco pouco suave](https://user-images.githubusercontent.com/89827437/191234694-5d5637f8-c59a-42a7-84ce-c319c470629f.png)

Já usando Path no sentido inverso, é possível realizar uma linha com algo como `d=“M 100 100 L 200 200 L 200 100”`.

### Subcaminho {#subpath}

Além de caminhos simples, como uma linha ou uma curva, um único `<path>` também pode conter uma série de linhas ou curvas, que podem ser chamadas de subcaminhos.

Cada subcaminho começa com um comando moveto, em geral M ou m, que diz à ferramenta de desenho para se mover a uma nova posição no sistema de coordenadas sem desenhar uma linha. Isso pode ser seguido por uma série de comandos de desenho, como segmentos de linha (L ou l), segmentos de linha horizontais (H ou h), segmentos de linha verticais (V ou v), curvas (C, S, Q, T etc.) e arcos (A ou a).

## Usar SDF {#sdf-path}

Já usamos SDF para desenhar Circle, Ellipse e Rect. Dá para fazer o mesmo com Path?

Parece funcionar para caminhos simples, por exemplo [Quadratic Bezier - distance 2D] no shadertoy, como mencionado no PPT do autor original na lição anterior, mas funciona para curvas de Bézier individuais. Não funciona para caminhos complexos, e o desempenho pode ser afetado por operações matemáticas excessivamente complexas no Fragment Shader. A matemática no Fragment Shader também pode afetar o desempenho.

![caminho SDF](/sdf-line.png)

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/MlKcDD?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

### Path2D {#path2d}

Outra ideia é dada por [svg-path-sdf] e, curiosamente, é quase idêntica à ideia de desenhar texto que apresentaremos mais adiante. Há um exemplo online no OB: [SDF Points with regl]

![prévia do svg-path-sdf](https://github.com/dy/svg-path-sdf/raw/master/preview.png?raw=true)

`fill()` e `stroke()` na API Canvas2D podem receber [Path2D] como argumento, e este pode ser criado diretamente a partir de definições de caminho SVG. A API Canvas2D é então usada para gerar um SDF a ser passado como textura; veja [tiny-sdf] para detalhes de como fazer isso, e falaremos mais sobre o assunto adiante, quando apresentarmos o desenho de texto.

```ts
// @see https://github.com/dy/svg-path-sdf/blob/master/index.js#L61C3-L63C31
var path2d = new Path2D(path);
ctx.fill(path2d);
ctx.stroke(path2d);

var data = bitmapSdf(ctx);
```

É claro que Path2D é uma API com suporte nativo em ambientes de navegador, então, se você quiser usá-la para renderização no servidor, vai precisar de um polyfill, como descrito com mais detalhes aqui: [Support Path2D API].

## Usar malha {#use-mesh}

Assim, a forma usual de triangular um Path, seja em 2D ou em 3D, é o exemplo a seguir, de: [SVG loader in three.js]. O texto SVG é primeiro convertido em um conjunto de `ShapePath`s, depois um conjunto de `ShapeGeometry`s é criado e renderizado:

```ts
const shapes = SVGLoader.createShapes(path);
for (const shape of shapes) {
    const geometry = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = renderOrder++;

    group.add(mesh);
}
```

Vamos implementar a nossa própria versão abaixo:

-   Normalizar as definições de caminho para comandos absolutos
-   Amostrar em curvas
-   Desenhar traços com Polyline
-   Usar a triangulação earcut e libtess para desenhar preenchimentos.

### Normalizar para comandos absolutos {#convert-to-absolute-commands}

Os comandos de caminho SVG são absolutos e relativos. Por exemplo, `M 100 100 L 200 100` equivale a `M 100 100 l 100 0`. Para facilitar o processamento, vamos converter primeiro todos os comandos relativos em absolutos. Para facilitar o processamento, primeiro convertemos todos os comandos relativos em comandos absolutos, e a API Canvas2D também usa esse estilo, semelhante a [lineTo]. Referimo-nos à implementação [ShapePath] do Three.js, que implementa uma série de métodos de [CanvasRenderingContext2D], como `moveTo / lineTo / bezierCurveTo` e outros.

```ts
import { path2Absolute } from '@antv/util';

const path = new ShapePath();
const commands = path2Absolute(d);
commands.forEach((command) => {
    const type = command[0];
    const data = command.slice(1);
    switch (type) {
        case 'M':
            path.moveTo();
        case 'L':
            path.lineTo();
        //...
    }
});
```

Vamos apresentar brevemente os métodos oferecidos por [ShapePath], que consiste em um conjunto de subPaths correspondentes a vários comandos na definição do caminho. Tome `moveTo` e `lineTo` como exemplo: o primeiro cria um novo subPath e define o ponto inicial; o segundo completa a linha até o ponto seguinte.

```ts
export class ShapePath {
    currentPath: Path | null;
    subPaths: Path[];

    moveTo(x: number, y: number) {
        this.currentPath = new Path();
        this.subPaths.push(this.currentPath);
        this.currentPath.moveTo(x, y);
        return this;
    }

    lineTo(x: number, y: number) {
        this.currentPath.lineTo(x, y);
        return this;
    }
}
```

Aqui está uma olhada na estrutura de cada subPath.

```ts
export class Path extends CurvePath {}
```

### Amostragem em uma curva {#sample-on-curve}

Amostre linhas retas e curvas de Bézier com precisões diferentes. Isso é compreensível: para curvas de Bézier, a única forma de fazer a linha parecer mais suave é adicionar mais amostras; para linhas retas, não é preciso adicionar nenhuma amostra extra.

```ts
export class CurvePath extends Curve {
    getPoints(divisions = 12) {
        const resolution =
            curve instanceof EllipseCurve
                ? divisions * 2
                : curve instanceof LineCurve
                ? 1
                : divisions;
        const pts = curve.getPoints(resolution);
    }
}
```

### Precisão adaptativa ao ampliar {#adaptive-precision}

As divisões fixas acima explicam o algoritmo básico. Os renderizadores de Path atuais de `core` e `ecs`, em vez disso, achatam Béziers quadráticas/cúbicas e arcos de elipse de acordo com o tamanho deles na tela. Eles miram um erro de 0,25 pixel físico, levando em conta o zoom da câmera, o device pixel ratio, as transformações pai e o passo de renderização usado na exportação. Traços espessos também restringem mudanças de tangente, incluindo a direção das tampas das extremidades. A cobertura do traço do Path usa pixels físicos, para que a franja de antialiasing não cresça com o zoom.

A precisão é arredondada para cima até potências de dois. Ampliar refina assim que o nível atual se torna insuficiente; reduzir tem uma oitava extra de histerese para evitar reconstruções repetidas perto de um limite. Cada drawcall mantém até quatro conjuntos de pontos amostrados por Path. Pan e zoom dentro de um nível reutilizam a geometria da GPU. Mudanças em `d` invalidam essas amostras.

Os limites da geometria vêm dos extremos das curvas originais, independentemente da precisão da renderização. `Path.points`, o `ComputedPoints` do ECS e os cálculos de comprimento de curva e de texto sobre caminho preservam o comportamento independente da vista, então mudar o zoom não move os limites de seleção nem faz o texto refluir. Provedores personalizados de limites do ECS continuam com suporte.

A subdivisão para depois de 16 níveis recursivos ou 4096 segmentos por comando SVG. Em ampliação extrema, esse limite de trabalho pode relaxar o erro alvo. Essa mudança cobre Paths comuns; caminhos Rough, a amostragem de VectorNetwork e os pacotes históricos das lições mantêm as estratégias de amostragem existentes.

Tomando uma curva de Bézier de terceira ordem como exemplo, dado o `t` normalizado, os pontos de amostragem podem ser obtidos pela definição dela: [Bézier_curve]

```ts
export class CubicBezierCurve extends Curve {
    getPoint(t: number) {
        const point = vec2.create();
        const { v0, v1, v2, v3 } = this;

        vec2.set(
            point,
            CubicBezier(t, v0[0], v1[0], v2[0], v3[0]),
            CubicBezier(t, v0[1], v1[1], v2[1], v3[1]),
        );

        return point;
    }
}
```

Aqui está um exemplo de um Path circular, com a lista de vértices amostrados a seguir:

```js eval
points = call(() => {
    const { Path } = Lesson13;
    return new Path({
        d: 'M40,0A40,40 0 1,1 0,-40A40,40 0 0,1 40,0Z',
        fill: 'black',
        opacity: 0.5,
    }).points;
});
```

### Desenhar traços com polilinha {#use-polyline-to-draw-stroke}

Agora que temos todos os pontos amostrados no subPath, podemos desenhar preenchimentos e traços, respectivamente. Chegaremos ao primeiro daqui a pouco, e o segundo pode ser feito diretamente com a Polyline implementada na lição anterior, [polilinha com vários segmentos], que por acaso oferece suporte a uma série de subPaths.

```ts
SHAPE_DRAWCALL_CTORS.set(Path, [Mesh, SmoothPolyline]);
```

### Triangulação com earcut {#earcut}

![RTR 3ª ed. - Tesselação](https://picx.zhimg.com/80/v2-f38400d225d0397f99563c96ce45053d_1440w.webp?source=d16d100b)

Então, como se divide um triângulo? Um método comum se chama `ear clipping`. Um vértice é `ear` se a linha que liga dois de seus vértices vizinhos não intersecta nenhum lado do polígono.
Vamos tomar o lado esquerdo da figura abaixo como exemplo. Sob esse critério, v2, v4 e v5 são `ear`. Em seguida, removemos o `ear` encontrado, como v4, e seguimos determinando os vizinhos v5 e v3, em que v5 constitui um `ear`. No fim, todos os `ear`s são removidos, e o polígono acaba dividido em triângulos.

![RTR - 12. Técnicas poligonais - Ear clipping
](https://picx.zhimg.com/80/v2-7c2a99be56ca9e4af6269e2c070b853b_1440w.webp?source=d16d100b)

O algoritmo detalhado pode ser encontrado no artigo: [Triangulation By Ear Clipping], enquanto [earcut] oferece uma implementação em JS:

```ts
function isEar(ear) {
    var a = ear.prev,
        b = ear,
        c = ear.next;

    if (area(a, b, c) >= 0) return false; // reflex, can't be an ear

    // now make sure we don't have other points inside the potential ear
    var p = ear.next.next;

    while (p !== ear.prev) {
        // If the poing is in triangle, it's not an ear.
        if (
            pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
            area(p.prev, p, p.next) >= 0
        )
            return false;
        p = p.next;
    }

    return true;
}
```

A triangulação é feita com [earcut], que recebe as coordenadas dos pontos de amostragem para obter um array de índices, e até calcula o erro. Como você verá adiante, ao comparar com outros métodos de triangulação, o earcut melhora muito a velocidade do cálculo, mas perde alguma precisão:

```ts
import earcut, { flatten, deviation } from 'earcut';

const { d } = path;
const { subPaths } = parsePath(d);
const points = subPaths
    .map((subPath) => subPath.getPoints().map((point) => [point[0], point[1]]))
    .flat(2); // [100, 100, 200, 200, 300, 100, 100, 100]

const { vertices, holes, dimensions } = flatten(points);
const indices = earcut(vertices, holes, dimensions); // [1, 3, 2]
const err = deviation(vertices, holes, dimensions, indices); // 0
```

Em seguida, podemos usar `gl.drawElements()` ou `passEncoder.drawIndexed()` para fazer o desenho. Na imagem abaixo, o Path da esquerda é definido assim. Comparando-o com o círculo da direita, desenhado com SDF, dá para ver que as bordas não ficam realmente suaves, e isso fica ainda mais evidente quando a câmera amplia:

```ts
const path = new Path({
    d: 'M40,0A40,40 0 1,1 0,-40A40,40 0 0,1 40,0Z',
    fill: 'black',
    opacity: 0.5,
});
```

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson13');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Path, Circle } = Lesson13;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas2.parentElement.style.position = 'relative';
    $icCanvas2.parentElement.appendChild($stats);

    $icCanvas2.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        canvas.camera.zoom = 2;

        const path = new Path({
            d: 'M40,0A40,40 0 1,1 0,-40A40,40 0 0,1 40,0Z',
            fill: 'black',
            opacity: 0.5,
        });
        path.position.x = 100;
        path.position.y = 100;
        canvas.appendChild(path);

        const circle = new Circle({
            cx: 0,
            cy: 0,
            r: 40,
            fill: 'black',
            opacity: 0.5,
        });
        circle.position.x = 200;
        circle.position.y = 100;
        canvas.appendChild(circle);
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

Descobri que muitos motores de renderização 2D, como [vello], usam [Ghostscript Tiger.svg] para testar a renderização do Path, como você pode ver no exemplo do início deste artigo. Mas, se você comparar com o SVG original (lembra do recurso de exportação que implementamos? Você vai ver que ele fica no canto superior direito da tela.), vai perceber que falta alguma coisa.

### Outras técnicas de triangulação {#other-tesselation-techniques}

O Pixi.js usa [earcut] para a triangulação de polígonos. Outras bibliotecas de triangulação incluem [cdt2d] e [libtess.js]; esta última é menos potente, mas mais precisa, em especial para caminhos com muitos `holes` e autointerseções. Como [earcut] menciona na documentação, veja: [Ability to substitute earcut for libtess.js for a given Graphics object]:

> Se você quiser obter uma triangulação correta mesmo em dados muito ruins, com muitas autointerseções, e o earcut não for preciso o bastante, dê uma olhada em libtess.js.

O efeito do earcut e do [libtess.js] é comparado em [Polygon Tesselation]. Ao contrário do earcut, que retorna um array de índices, o libtess.js retorna um array de vértices, como mostra o exemplo no repositório. Isso significa que precisamos gerar o array de índices manualmente, mas é claro que isso é muito simples: como não precisamos pensar em reutilizar vértices, basta usar um array incremental a partir de `0`.

```ts
export function triangulate(contours: [number, number][][]) {
    tessy.gluTessNormal(0, 0, 1);

    const triangleVerts = [];
    tessy.gluTessBeginPolygon(triangleVerts);
    // Omit...
    return triangleVerts;
}

triangulate(points); // [100, 0, 0, 100, 0, 0, 0, 100, 100, 0, 100, 100]
// indices: [0, 1, 2, 3, 4, 5]
```

Você pode voltar ao exemplo dos “dois tigres” no início do artigo e compará-lo com o gerado com earcut à esquerda e libtess.js à direita. Adicionamos um atributo `tessellationMethod` ao Path para alternar entre os dois métodos de triangulação:

```ts
export enum TesselationMethod {
    EARCUT,
    LIBTESS,
}
export interface PathAttributes extends ShapeAttributes {
    tessellationMethod?: TesselationMethod;
}
```

### Desenhar buracos {#draw-holes}

Sob a regra padrão `nonzero` do SVG, os buracos podem ser definidos com a direção de enrolamento oposta à do contorno. Por exemplo, no caminho abaixo, o contorno é no sentido horário `M0 0 L100 0 L100 100 L0 100 Z`, e os dois buracos seguintes são no sentido anti-horário:

```bash
M0 0 L100 0 L100 100 L0 100 Z M50 50 L50 75 L75 75 L75 50 Z M25 25 L25
```

Você também pode inverter o sentido horário na sua definição, por exemplo: [Draw a hollow circle in SVG]. O ponto-chave é que a direção do buraco deve ser oposta à direção do contorno.

<Holes />

### Regra de preenchimento {#fill-rule}

A [fill-rule] no SVG é usada para determinar a área de preenchimento de um Path. No exemplo abaixo, o da esquerda usa a regra nonzero, enquanto o da direita usa a regra evenodd.

<FillRule />

Tomando um ponto na área oca central como exemplo, o raio intersecta a forma um número par de vezes; portanto, ele é determinado como estando fora da forma e não precisa ser preenchido. Veja os detalhes em [how does fill-rule="evenodd" work on a star SVG].

![regra de preenchimento evenodd](/fill-rule-evenodd.png)

Como o earcut não oferece suporte a caminhos autointersectantes, usamos libtess.js para a triangulação do caminho.

```ts
tessy.gluTessProperty(
    libtess.gluEnum.GLU_TESS_WINDING_RULE,
    fillRule === 'evenodd'
        ? libtess.windingRule.GLU_TESS_WINDING_ODD
        : libtess.windingRule.GLU_TESS_WINDING_NONZERO,
);
```

No ECS, `fillRule` também se aplica com o `tessellationMethod: 'earcut'` padrão. Caminhos compostos e preenchimentos `evenodd` usam automaticamente libtess para resolver o enrolamento ou a paridade ao longo de todo o caminho, em vez de adivinhar buracos pela ordem de entrada ou pela direção do primeiro contorno. Os buracos podem preceder os contornos; ilhas aninhadas, contornos sobrepostos e contornos duplicados seguem a mesma regra das máscaras nativas do Canvas usadas para filtros.

Um único contorno `nonzero` conserva o caminho rápido do Earcut. Para autointerseções gerais nesse contorno, escolha explicitamente `libtess`. Resolver caminhos compostos pode aumentar o custo da tesselação; os caches de geometria existentes ainda evitam reconstruir a cada quadro. Paths com regras de preenchimento ou opções de tesselação diferentes deixam de compartilhar uma malha de preenchimento. A pintura Rough conserva o próprio caminho de triangulação, para preservar o alfa sobreposto do pincel.

## Caixa delimitadora e picking {#bounding-box-picking}

A caixa delimitadora pode ser estimada da mesma forma que na lição anterior para a polilinha. Vamos nos concentrar na implementação de como determinar se um ponto está dentro de um Path.

### Usar métodos nativos {#native-methods}

CanvasRenderingContext2D oferece dois métodos prontos, [isPointInPath] e [isPointInStroke], que podem ser usados com facilidade junto com [Path2D], que apresentamos antes.

```ts
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const isPointInPath = ctx.isPointInPath(new Path2D(d), x, y);
```

Apresentamos [OffscreenCanvas] antes, e ele é particularmente bom para cálculos como decisões de picking que não têm relação com a tarefa de renderização da thread principal. Fazemos a inicialização em [PickingPlugin] e, em seguida, passamos `containsPoint` para ser chamado sob demanda para gráficos específicos:

```ts
export class Picker implements Plugin {
    private ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

    private hitTest(shape: Shape, wx: number, wy: number): boolean {
        if (shape.hitArea || shape.renderable) {
            shape.worldTransform.applyInverse(
                { x: wx, y: wy },
                tempLocalPosition,
            );
            const { x, y } = tempLocalPosition;

            return shape.containsPoint(x, y); // [!code --]
            return shape.containsPoint(x, y, this.ctx); // [!code ++]
        }

        return false;
    }
}
```

### Método geométrico {#geometry-method}

Cada subPath de um Path pode realizar operações geométricas sobre a posição dele em relação a um ponto. Por exemplo, o Pixi.js implementa [GraphicsContext - containsPoint]; leia mais a respeito.

## Desenho em estilo feito à mão {#hand-drawn-style-drawing}

O [excalidraw] usa [rough] para desenho em estilo feito à mão. Não precisamos da funcionalidade real de desenho baseada em Canvas2D ou SVG que o rough oferece por padrão, então usar [RoughGenerator] é uma escolha melhor.

![demonstração do rough.js](https://camo.githubusercontent.com/5d90838c20ae2cab9f295e3dd812800285c42e82d04787883c9d5acecaec85ed/68747470733a2f2f726f7567686a732e636f6d2f696d616765732f6361705f64656d6f2e706e67)

### Gerar definições de caminho desenhadas à mão {#generate-rough-path-definitions}

O RoughGenerator oferece métodos de geração para formas comuns, usando retângulos como exemplo:

```ts
const generator = rough.generator();
const rect = generator.rectangle(0, 0, 100, 100);
```

Ele gera para nós um conjunto de estruturas parecidas com subPath, com base nos parâmetros de entrada, chamado OpSet, que contém os operadores `move`, `lineTo` e `bcurveTo`. Podemos converter isso com facilidade em um comando com caminho absoluto, depois amostrá-lo e continuar desenhando com Polyline!

```ts
import { AbsoluteArray } from '@antv/util';
import { OpSet } from 'roughjs/bin/core';

export function opSet2Absolute(set: OpSet) {
    const array = [];
    set.ops.forEach(({ op, data }) => {
        if (op === 'move') {
            array.push(['M', data[0], data[1]]);
        } else if (op === 'lineTo') {
            array.push(['L', data[0], data[1]]);
        } else if (op === 'bcurveTo') {
            array.push([
                'C',
                data[0],
                data[1],
                data[2],
                data[3],
                data[4],
                data[5],
            ]);
        }
    });
    return array as AbsoluteArray;
}
```

### Mixin Rough {#rough-mixin-rough-mixin}

Gostaríamos de reutilizar a versão que não é desenhada à mão para as funções de cálculo da caixa delimitadora e de picking, pelos seguintes motivos:

-   Essa renderização estilizada deve afetar apenas o efeito de renderização; ela não muda as propriedades físicas.
-   Um gráfico desenhado à mão na verdade consiste em vários conjuntos de Paths, então é um desperdício de desempenho calcular a caixa delimitadora com exatidão.
-   No picking, ele deve ser tratado como um todo, e julgar pelos Paths dá resultados errados. Por exemplo, se o mouse estiver pairando dentro do gráfico, mas no espaço vazio entre as linhas, ele não é considerado dentro do gráfico.

Então criamos um novo Mixin com todos os parâmetros suportados pelo rough, como `seed`, `roughness` e outros, e o redesenhamos assim que esses parâmetros mudam:

```ts
import { Drawable, Options } from 'roughjs/bin/core';
import { GConstructor } from '.';
import { parsePath } from '../../utils';

export interface IRough
    extends Omit<Options, 'stroke' | 'fill' | 'strokeWidth'> {
    /**
     * @see https://github.com/rough-stuff/rough/wiki#roughness
     */
    roughness: Options['roughness'];
}
export function Rough<TBase extends GConstructor>(Base: TBase) {
    abstract class Rough extends Base implements IRough {
        get roughness() {
            return this.#roughness;
        }
        set roughness(roughness: number) {
            if (this.#roughness !== roughness) {
                this.#roughness = roughness;
                this.renderDirtyFlag = true;
                this.generate();
            }
        }
    }
}
```

Desse modo, conseguimos efeitos desenhados à mão envolvendo nele as formas que já suportamos. A forma de usar é a seguinte, tomando RoughRect como exemplo, que herda de Rect:

```ts
import { RectWrapper, RectAttributes } from './Rect';

export class RoughRect extends Rough(RectWrapper(Shape)) {}
```

### fillStyle solid {#fill-style-solid}

Para dar suporte ao caso `fillStyle = 'solid'`:

```ts
SHAPE_DRAWCALL_CTORS.set(RoughRect, [
    ShadowRect,
    Mesh, // fillStyle === 'solid' // [!code ++]
    SmoothPolyline, // fill
    SmoothPolyline, // stroke
]);
```

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson13');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, RoughCircle } = Lesson13;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    const circle1 = new RoughCircle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'dots',
    });

    const circle2 = new RoughCircle({
        cx: 200,
        cy: 100,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'hachure',
    });

    const circle3 = new RoughCircle({
        cx: 300,
        cy: 100,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'zigzag',
    });

    const circle4 = new RoughCircle({
        cx: 400,
        cy: 100,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'cross-hatch',
    });

    const circle5 = new RoughCircle({
        cx: 500,
        cy: 100,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'solid',
    });

    const circle6 = new RoughCircle({
        cx: 100,
        cy: 200,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'dashed',
    });

    const circle7 = new RoughCircle({
        cx: 200,
        cy: 200,
        r: 50,
        fill: 'black',
        strokeWidth: 2,
        stroke: 'red',
        fillStyle: 'zigzag-line',
    });

    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        canvas.appendChild(circle1);
        canvas.appendChild(circle2);
        canvas.appendChild(circle3);
        canvas.appendChild(circle4);
        canvas.appendChild(circle5);
        canvas.appendChild(circle6);
        canvas.appendChild(circle7);
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### Exportar SVG {#export-svg}

Como você pode ver, os gráficos gerados pelo rough são feitos de um conjunto de Paths. Portanto, é preciso usar `<path>` ao exportar para SVG. Você pode tentar exportar no exemplo acima:

```ts
export function exportRough(
    node: SerializedNode,
    $g: SVGElement,
    doc: Document,
) {
    const {
        attributes: { drawableSets, stroke, fill },
    } = node;

    drawableSets.forEach((drawableSet) => {
        const { type } = drawableSet;
        const commands = opSet2Absolute(drawableSet);
        const d = path2String(commands, 2); // retain two decimal places
        const $path = createSVGElement('path', doc);
        $path.setAttribute('d', d);
        $g.appendChild($path);
        if (type === 'fillSketch') {
            $path.setAttribute('stroke', fill as string);
            $path.setAttribute('fill', 'none');
        }
    });
}
```

## Estilo aquarela {#watercolor}

Usando [watercolorizer], adicionamos um novo `fillStyle: 'watercolor'`.

Vale notar que os retângulos deixam de ser modelados com apenas quatro vértices. Em vez disso, usamos `subdivideAxisAlignedRect` para escolher uma contagem de subdivisão por aresta entre 4 e 16 a partir do tamanho (via `hypot(w, h) / 40`), para que o contorno se comporte mais como um polígono com muitos vértices e a protuberância uniforme para fora de um quad simples seja reduzida.

<Watercolor />

## Leitura adicional {#extended-reading}

-   [Rendering SVG Paths in WebGL]
-   [Shaping Curves with Parametric Equations]
-   [WebGL 3D Geometry - Lathe]
-   [Fun with WebGL 2.0 : 027 : Bezier Curves in 3D]
-   [GPU-accelerated Path Rendering]
-   [Making plot sketchy]
-   [How to Hack a Painting]
-   [A Guide to Simulating Watercolor Paint with Generative Art]

[Paths]: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths
[Quadratic Bezier - distance 2D]: https://www.shadertoy.com/view/MlKcDD
[Path2D]: https://developer.mozilla.org/en-US/docs/Web/API/Path2D
[svg-path-sdf]: https://github.com/dy/svg-path-sdf/
[SDF Points with regl]: https://observablehq.com/@rreusser/sdf-points-with-regl
[WebGL 3D Geometry - Lathe]: https://webglfundamentals.org/webgl/lessons/webgl-3d-geometry-lathe.html
[Fun with WebGL 2.0 : 027 : Bezier Curves in 3D]: https://www.youtube.com/watch?v=s3k8Od9lZBE
[Shaping Curves with Parametric Equations]: https://mattdesl.svbtle.com/shaping-curves-with-parametric-equations
[Rendering SVG Paths in WebGL]: https://css-tricks.com/rendering-svg-paths-in-webgl/
[GPU-accelerated Path Rendering]: https://developer.download.nvidia.com/devzone/devcenter/gamegraphics/files/opengl/gpupathrender.pdf
[p5js - bezierDetail()]: https://p5js.org/reference/p5/bezierDetail/
[rough]: https://github.com/rough-stuff/rough
[excalidraw]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/scene/ShapeCache.ts#L2
[Draw arcs, arcs are not smooth ISSUE]: https://github.com/pixijs/graphics-smooth/issues/23
[SVG loader in three.js]: https://github.com/mrdoob/three.js/blob/dev/examples/webgl_loader_svg.html#L156
[earcut]: https://github.com/mapbox/earcut
[cdt2d]: https://github.com/mikolalysenko/cdt2d
[libtess.js]: https://github.com/brendankenny/libtess.js
[Ability to substitute earcut for libtess.js for a given Graphics object]: https://github.com/pixijs/pixijs/issues/4151
[lineTo]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineTo
[Support Path2D API]: https://github.com/Automattic/node-canvas/issues/1116
[tiny-sdf]: https://github.com/mapbox/tiny-sdf
[ShapePath]: https://github.com/mrdoob/three.js/blob/dev/src/extras/core/ShapePath.js
[CanvasRenderingContext2D]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
[Bézier_curve]: https://en.wikipedia.org/wiki/B%C3%A9zier_curve
[Ghostscript Tiger.svg]: https://en.m.wikipedia.org/wiki/File:Ghostscript_Tiger.svg
[vello]: https://github.com/linebender/vello
[Polygon Tesselation]: https://andrewmarsh.com/software/tesselation-web/
[polilinha com vários segmentos]: /pt-BR/guide/lesson-012#polyline-with-multiple-segments
[RoughGenerator]: https://github.com/rough-stuff/rough/wiki/RoughGenerator
[isPointInPath]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInPath
[isPointInStroke]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInStroke
[GraphicsContext - containsPoint]: https://github.com/pixijs/pixijs/blob/dev/src/scene/graphics/shared/GraphicsContext.ts#L1072
[OffscreenCanvas]: /pt-BR/guide/lesson-011#offscreen-canvas
[PickingPlugin]: /pt-BR/guide/lesson-006#picking-plugin
[Draw a hollow circle in SVG]: https://stackoverflow.com/questions/8193675/draw-a-hollow-circle-in-svg
[fill-rule]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-rule
[how does fill-rule="evenodd" work on a star SVG]: https://stackoverflow.com/a/46145333/4639324
[Triangulation By Ear Clipping]: https://www.geometrictools.com/Documentation/TriangulationByEarClipping.pdf
[Making plot sketchy]: https://observablehq.com/@jwolondon/making-plot-sketchy
[watercolorizer]: https://github.com/32bitkid/watercolorizer
[How to Hack a Painting]: https://www.tylerxhobbs.com/words/how-to-hack-a-painting
[A Guide to Simulating Watercolor Paint with Generative Art]: https://www.tylerxhobbs.com/words/a-guide-to-simulating-watercolor-paint-with-generative-art
