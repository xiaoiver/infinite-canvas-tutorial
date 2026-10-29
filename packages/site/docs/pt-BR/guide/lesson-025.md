---
outline: deep
description: 'Desenhe retângulo, elipse, polígono, borracha, laser e o modo pincel. Implementação dos recursos do pincel, incluindo algoritmos de desenho de linha para eliminar o tremor e uma experiência de desenho suave.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lição 25 - Modo de desenho e pincel',
          },
      ]
---

<script setup>
import DrawRect from '../../components/DrawRect.vue'
import DrawArrow from '../../components/DrawArrow.vue'
import DrawPolygon from '../../components/DrawPolygon.vue'
import Pencil from '../../components/Pencil.vue'
import PencilFreehand from '../../components/PencilFreehand.vue'
import Brush from '../../components/Brush.vue'
import BrushWithStamp from '../../components/BrushWithStamp.vue'
import LaserPointer from '../../components/LaserPointer.vue'
import Eraser from '../../components/Eraser.vue'
</script>

# Lição 25 - Modo de desenho e pincel {#lesson-25-drawing-mode-and-brush}

Na [Lição 14 - Modo da tela e interface auxiliar] apresentamos os modos mão e de seleção. Nesta lição, vamos apresentar os modos de desenho: retângulos, elipses e setas, além dos modos de pincel, mais livres.

## Modo de desenhar retângulo {#draw-rect-mode}

<DrawRect />

Primeiro, adicione o seguinte modo da tela. A implementação do desenho de elipses é quase idêntica, então não vou repetir a apresentação:

```ts
export enum Pen {
    HAND = 'hand',
    SELECT = 'select',
    DRAW_RECT = 'draw-rect', // [!code ++]
    DRAW_Ellipse = 'draw-ellipse', // [!code ++]
}
```

Na [Lição 18 - Refatorar com ECS] apresentamos a arquitetura ECS, em que um System `DrawRect` é criado e, ao entrar nesse modo, o estilo do cursor passa a ser `crosshair`:

```ts
import { System } from '@lastolivegames/becsy';

export class DrawRect extends System {
    execute() {
        if (pen !== Pen.DRAW_RECT) {
            return;
        }

        const input = canvas.write(Input);
        const cursor = canvas.write(Cursor);

        cursor.value = 'crosshair';
        //...
    }
}
```

Em seguida, enquanto o mouse é arrastado, o retângulo é redesenhado continuamente na área de destino, de forma parecida com o efeito de seleção por caixa no modo de seleção. Quando o mouse é solto e a criação do retângulo termina, o modo passa de desenhar retângulo para seleção:

```ts
export class DrawRect extends System {
    execute() {
        //...
        // Draw rect brush when dragging
        this.handleBrushing(api, x, y);

        if (input.pointerUpTrigger) {
            // Create rect when pointerup event triggered
            const node: RectSerializedNode = {
                id: uuidv4(),
                type: 'rect', // Change to 'ellipse' in draw-ellipse mode
                x,
                y,
                width,
                height,
            };
            api.setAppState({ penbarSelected: Pen.SELECT }); // Switch canvas mode
            api.updateNode(node);
            api.record(); // Save to history
        }
    }
}
```

A seguir, vemos o que acontece durante o arraste.

### Redesenhar o retângulo {#redraw-rect}

Assim como na seleção por caixa, para evitar que um arraste curto já comece o desenho, precisamos definir um limiar, calculado no sistema de coordenadas do Viewport:

```ts
handleBrushing(api: API, viewportX: number, viewportY: number) {
    const camera = api.getCamera();
    const {
        pointerDownViewportX,
        pointerDownViewportY,
    } = camera.read(ComputedCameraControl);

    // Use a threshold to avoid showing the selection brush when the pointer is moved a little.
    const shouldShowSelectionBrush =
        distanceBetweenPoints(
            viewportX,
            viewportY,
            pointerDownViewportX,
            pointerDownViewportY,
        ) > 10;
}
```

As coordenadas `x/y` do retângulo auxiliar são o ponto em que `pointerdown` foi disparado, e as coordenadas do objeto do evento `pointermove` precisam ser convertidas para o sistema de coordenadas da tela para calcular a largura e a altura:

```ts
const { x: cx, y: cy } = api.viewport2Canvas({
    x: viewportX,
    y: viewportY,
});

let x = pointerDownCanvasX;
let y = pointerDownCanvasY;
let width = cx - x;
let height = cy - y;

api.updateNode(
    selection.brush,
    {
        visibility: 'visible',
        x,
        y,
        width,
        height,
    },
    false,
);
```

Vale a pena considerar o arraste no sentido inverso: `width/height` calculados podem ser negativos, e o `x/y` correspondente deixa de estar na posição do `pointerdown` e precisa ser recalculado. O Figma faz o mesmo:

```ts
if (width < 0) {
    x += width;
    width = -width;
}
if (height < 0) {
    y += height;
    height = -height;
}
```

### Rótulo de tamanho {#size-label}

Queremos mostrar as dimensões do retângulo em tempo real durante o desenho, como o Figma faz:

![Rótulo de tamanho no Figma](/figma-size-label.png)

Da mesma forma, anotações nesse tipo de espaço de viewport cabem bem em contêineres SVG, como mostram as ferramentas de ponteiro laser e borracha descritas abaixo. Os rótulos retangulares usam estilos CSS para definir cor de fundo, padding, centralização e outras propriedades, enquanto o texto usa a largura e a altura da caixa delimitadora:

```ts
label.style.visibility = 'visible';
label.style.top = `${y + height}px`;
label.style.left = `${x + width / 2}px`;
label.innerText = `${Math.round(width)} × ${Math.round(height)}`;
```

Se você estiver desenhando uma linha reta, os rótulos podem girar na direção da linha, garantindo que o texto sempre fique voltado para a frente. Dá para experimentar isso no exemplo da seta na próxima seção:

```ts
label.style.top = `${y + height / 2}px`;
const rad = Math.atan2(height, width);
let deg = rad * (180 / Math.PI);
if (deg >= 90 && deg <= 180) {
    deg = deg - 180;
} else if (deg <= -90 && deg >= -180) {
    deg = deg + 180;
}
label.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
```

### Desenhar quadrado perfeito com Shift {#draw-square-with-shift}

Mantenha <kbd>Shift</kbd> pressionado ao arrastar para criar quadrados, círculos e polígonos perfeitos. Nesse caso, o menor valor absoluto entre a largura e a altura é usado como o lado do quadrado.

```ts
if (isSquare) {
    if (Math.abs(width) > Math.abs(height)) {
        width = Math.sign(width) * Math.abs(height);
    } else {
        height = Math.sign(height) * Math.abs(width);
    }
}
```

## Desenhar seta {#draw-arrow}

Além de formas básicas como retângulos, elipses e polilinhas, formas compostas como setas também são comuns. Não vamos tratar agora das relações de vínculo da seta (em que a direção muda quando as formas ligadas pela ponta e pela cauda se movem); esse tema fica para um capítulo separado. Aqui, o foco é apenas como as setas são desenhadas.

As setas são declaradas primeiro no SVG com um `<marker>`, em geral um `<path>`, e depois associadas por meio dos atributos [marker-start] e [marker-end] do gráfico de destino:

```html
<defs>
    <!-- arrowhead marker definition -->
    <marker
        id="arrow"
        viewBox="0 0 10 10"
        refX="5"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
    >
        <path d="M 0 0 L 10 5 L 0 10 z" />
    </marker>
</defs>
<!-- Coordinate axes with a arrowhead in both direction -->
<polyline
    points="10,10 10,90 90,90"
    fill="none"
    stroke="black"
    marker-start="url(#arrow)"
    marker-end="url(#arrow)"
/>
```

Separar as extremidades da seta do corpo é bem flexível. Em um editor gráfico, porém, basta oferecer alguns estilos comuns predefinidos. No Figma, por exemplo, a seta é aplicada às duas extremidades do Path (`start/end point`), com estilos predefinidos como `line/triangle/diamond`. Veja [How to Curve an Arrow in Figma].

![Seta no Figma](/arrow-in-figma.png)

O drawio também oferece muitos estilos de seta prontos para usar:

![fonte: https://www.drawio.com/assets/img/blog/style-tab-line-start-line-end.png](https://www.drawio.com/assets/img/blog/style-tab-line-start-line-end.png)

No uso declarativo, é aceitável abrir mão de estilos de seta personalizados e oferecer um conjunto de literais de estilo embutidos, que geram as extremidades junto com o corpo ao construir a Polyline / o Path. Essa ideia também aparece em [plot - arrow], renderizado com SVG, que não usa `<marker>`, e sim uma definição completa de `<path>`.

```ts
export interface MarkerAttributes {
    markerStart: Marker['start'];
    markerEnd: Marker['end'];
}
```

A seguir, vejamos o processo de construção da geometria.

### Ponto inicial e final {#start-end-point}

Primeiro, você precisa encontrar os pontos inicial e final das setas.

A orientação, porém, precisa ser calculada manualmente. Não é complicado: ela segue a reta tangente.

<DrawArrow />

### Exportar seta para SVG {#export-arrow-to-svg}

No SVG, você pode ajustar a orientação do `<marker>` com o atributo [orient], mas esse atributo só tem dois valores literais: `‘auto’` e `‘auto-start-reverse’`.

```ts
if (isEnd) {
    $marker.setAttribute('orient', 'auto');
} else {
    $marker.setAttribute('orient', 'auto-start-reverse');
}
```

Em seguida, crie um `<path>` de acordo com o tipo do marcador, para que ele herde propriedades como `stroke` do gráfico de destino. O SVG completo está no caso de teste [export arrow]:

```ts
if (marker === 'line') {
    const points = lineArrow(0, 0, arrowRadius, Math.PI);
    const $path = createSVGElement('path');
    $path.setAttribute('fill', 'none');
    $path.setAttribute('stroke', stroke);
    $path.setAttribute('stroke-width', `${strokeWidth}`);
    $marker.appendChild($path);
}
```

Por outro lado, os arquivos SVG exportados também precisam poder ser importados de novo para a tela.

## Desenhar polígono {#draw-polygon}

[Shape tools - polygons]

<DrawPolygon />

Dada uma caixa delimitadora retangular, gere por código um caminho poligonal:

```ts
function regularPolygonPathInRect(
    sides: number,
    width: number,
    height: number,
    rotation = -Math.PI / 2,
): string {
    if (sides < 3 || width <= 0 || height <= 0) {
        return '';
    }

    const cx = width / 2;
    const cy = height / 2;
    const rx = width / 2;
    const ry = height / 2;
    const step = (Math.PI * 2) / sides;
    const points: [number, number][] = [];

    for (let i = 0; i < sides; i++) {
        const angle = rotation + i * step;
        points.push([
            formatNumber(cx + Math.cos(angle) * rx),
            formatNumber(cy + Math.sin(angle) * ry),
        ]);
    }

    return points
        .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
        .join(' ')
        .concat(' Z');
}
```

## Ferramenta lápis {#pencil-tool}

Vamos começar pela implementação mais simples, que exibe uma linha quebrada, chamada Pencil no Figma.

Para reduzir a quantidade de vértices gerados pelo arraste, sobretudo vértices duplicados ou muito próximos, vamos simplificar a polilinha com o método descrito em [Lição 12 - Simplificar a polilinha], usando a implementação [simplify-js]. Vale notar a definição do parâmetro `tolerance`, que afeta o grau de simplificação:

> Afeta a quantidade de simplificação (na mesma unidade das coordenadas dos pontos).

Queremos definir `tolerance` de acordo com o nível de zoom atual da câmera. Caso contrário, o tremor causado pela simplificação excessiva em zooms altos fica fácil de ver:

![Polilinha simplificada demais no zoom de 4x](/over-simplified-polyline.gif)

```ts
import simplify from 'simplify-js';

export class DrawPencil extends System {
    private handleBrushing() {
        // choose tolerance based on the camera zoom level
        const tolerance = 1 / zoom;
        selection.points = simplify(selection.pointsBeforeSimplify, tolerance);
    }
}
```

<Pencil />

### Traço livre perfeito {#perfect-freehand}

Como a largura da linha é fixa, falta uma sensação de “flexibilidade”. Para um traço à mão, a linha pode variar com a pressão. Para isso, dá para usar [perfect-freehand]. Esse recurso ainda não está integrado ao Excalidraw; veja: [Perfect Freehand Drawing Issue].
Como a largura da linha é variável, a forma final deixa de ser uma Polyline e passa a ser um Path:

```ts
import { getStroke } from 'perfect-freehand';

const outlinePoints = getStroke(points);
const d = getSvgPathFromStroke(outlinePoints); // 'M 0 0 L...'
```

<PencilFreehand />

Por padrão, [perfect-freehand] simula a velocidade das pinceladas calculando larguras variáveis a partir da distância entre pontos adjacentes. Para usar a [pressure] real, como a de uma caneta ou stylus, informe a pressão como o terceiro número de cada ponto de entrada:

```ts
export class Input {
    @field.float32 declare pressure: number; // [!code ++]
}
```

E defina a opção simulatePressure como false.

```ts
const outlinePoints = getStroke(inputPoints, {
    simulatePressure: false,
});
```

## Modo pincel {#brush-mode}

Você pode escolher essa subferramenta ao entrar no modo Paint no Photoshop Web e desenhar traços arrastando de forma contínua:

![Modo pincel no Photoshop Web](/photoshopweb-brush-mode.png)

No Figma, isso se chama [Draw with illustration tools].

Olhando de perto esse tipo de traço, ele é um conjunto de pontos consecutivos. Se os raios forem diferentes, surge o efeito de espessura variável. Isso pode ser feito mapeando a pressão do pincel para o raio:

![fonte: https://shenciao.github.io/brush-rendering-tutorial/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/brushes-9e58d24a7f40847be1ad6c1cb9f1b9dc.jpg)

Aqui seguimos o [Brush Rendering Tutorial] para obter esse efeito.

### Implementação básica {#basic-implementation}

A estrutura de dados de base é a seguinte:

```ts
interface BrushPoint {
    x: number;
    y: number;
    radius: number;
}
```

Os $N$ vértices de uma polilinha formam $N-1$ segmentos, cada um com dois triângulos e quatro vértices. Na [Lição 12 - Extrudar o segmento], apresentamos o uso de 9 vértices. Aqui usamos exatamente o mesmo método, mas não precisamos considerar as junções dos segmentos, então bastam 4 vértices, desenhados de forma instanciada:

```ts
renderPass.drawIndexed(6, points.length - 1); // indices: [0, 1, 2, 0, 2, 3]
```

Como vimos na [Lição 12 - Extrudar o segmento], você pode passar `a_VertexNum` para o Vertex Shader ou usar `gl_VertexID` diretamente, como no [Brush Rendering Tutorial], se não precisar considerar a compatibilidade com WebGL 1:

```glsl
layout(location = ${Location.POINTA}) in vec3 a_PointA;
layout(location = ${Location.POINTB}) in vec3 a_PointB;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum; // [0, 1, 2, 3]
```

Os outros `attributes`, `a_PointA` e `a_PointB`, guardam raios variáveis além das coordenadas de posição dos vértices. De novo usamos `vertexBufferOffsets` para multiplexar o mesmo Buffer, e `a_PointB` lê a partir de um deslocamento de `4 * 3`. Assim temos os números de vértice para esticar no Vertex Shader:

![fonte: https://shenciao.github.io/brush-rendering-tutorial/Basics/Vanilla/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/coordinate-68714349e3013c769921a0eb25796188.png)

```glsl
vec2 position;
vec2 offsetSign;
float r;
if (vertexNum < 0.5) {
    position = p0;
    r = r0;
    offsetSign = vec2(-1.0, -1.0);
} else if (vertexNum < 1.5) {
    position = p0;
    r = r0;
    offsetSign = vec2(-1.0, 1.0);
}
```

Para dar suporte a larguras variáveis, a distância esticada nem sempre é igual ao raio do ponto atual. Ela precisa ser calculada a partir da inclinação do segmento de linha:

![fonte: https://shenciao.github.io/brush-rendering-tutorial/Basics/Vanilla/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/var-parameters-9d4c6d7aa31d0f61fd39ba9f69eaae6d.png)

```glsl
int MAX_i = 128; float currIndex = startIndex;
float A = 0.0;
for(int i = 0; i < MAX_i; i++){
    // Blend opacity
    A = A * (1.0-opacity) + opacity;
}
```

O efeito é o seguinte. Selecione a ferramenta pincel e varie a velocidade do arraste: o ECS usa amostras de mouse/toque com carimbo de tempo para deixar traços rápidos mais finos e traços lentos mais grossos, com transições suaves. Uma caneta sensível à pressão usa a pressão medida. Os raios resultantes ficam armazenados no traço, então desfazer/refazer e recarregar preservam a forma.

<Brush />

### Carimbo {#stamp}

Isso ainda não funciona como uma pincelada de verdade. Adicionamos a propriedade `brushStamp` para a URL da imagem do carimbo, mas ela só controla a opacidade do pincel; `stroke` continua definindo a cor.

```ts
api.updateNodes([
    {
        id: '1',
        type: 'brush',
        brushType: BrushType.STAMP,
        brushStamp: '/stamp.png',
        points: position.map(([x, y], i) => `${x},${y},${radius[i]}`).join(' '),
        stroke: 'grey',
    },
]);
```

<BrushWithStamp />

No momento, todas as texturas são aplicadas com orientação fixa. Podemos adicionar ângulos de rotação aleatórios às texturas:

```glsl
float angle = rotationFactor*radians(360.0*fract(sin(currIndex)*1.0));
pToCurrStamp *= rotate(angle);
```

Também podemos usar um fator de ruído ao misturar a opacidade:

```glsl
float opacityNoise = noiseFactor*fbm(textureCoordinate*50.0);
```

### [WIP] Exportar SVG {#export-brush-to-svg}

O Figma consegue exportar o pincel para SVG.

## Ponteiro laser {#laser-pointer}

Ao implementar recursos de apresentação na tela, o ponteiro laser é uma função essencial. O Excalidraw oferece esse recurso, como detalhado em: [laser pointer]. Dá para usar direto o módulo encapsulado [@excalidraw/laser-pointer], que gera um caminho de trajetória a partir de um conjunto de coordenadas de pontos. No núcleo, essa função também usa [perfect-freehand].

Esse recurso difere das formas desenhadas antes na tela nos seguintes pontos:

1. A renderização da trajetória do ponteiro laser ocorre no sistema de coordenadas do viewport, independente do nível de zoom atual da tela. Isso permite implementá-la em um contêiner HTML separado. Veja: [Lição 29 - Contêiner HTML]
2. Os traços somem sozinhos depois de um tempo definido
3. Pensado para cenários de colaboração com vários usuários. Veja: [Lição 20 - Awareness e Presence]

<LaserPointer />

## Borracha {#eraser}

O Excalidraw oferece a [freedraw eraser]. Depois de escolher a ferramenta borracha, as formas percorridas pelo cursor do mouse aparecem “desbotadas”, indicando que estão prestes a ser apagadas. Soltar o mouse conclui o apagamento.

Na implementação, usamos a técnica Perfect freehand da seção anterior para desenhar o caminho do arraste, mas só guardamos os 4 pontos mais recentes. Ao mesmo tempo, detectamos em tempo real as formas percorridas, ajustamos a opacidade delas (lembrando de salvar a opacidade original para restaurar se a operação for cancelada) e removemos as formas selecionadas quando o mouse é solto:

```ts
export class DrawEraser extends System {
    execute() {
        if (input.pointerUpTrigger) {
            api.runAtNextTick(() => {
                api.updateNode(brush, { visibility: 'hidden' }, false);
                api.setAppState({
                    penbarSelected: Pen.SELECT,
                });
                api.deleteNodesById(
                    Array.from(selected).map((e) => api.getNodeByEntity(e)?.id),
                );
                api.record();
            });
        }
    }
}
```

<Eraser />

### Não atômico {#non-atomic}

Apagar formas inteiras basta na maior parte dos casos, mas o apagamento não atômico se mostra mais útil no desenho à mão livre, por exemplo ao cortar uma linha reta no meio. O Excalidraw ainda não tem esse recurso; veja: [non-atomic erasing for linear & freedraw shapes]. O FigJam tem a mesma limitação. Se a tela for renderizada com Canvas ou SVG, esse efeito de apagamento no nível do pixel de fato não é possível.

Como a nossa tela é implementada com WebGL/WebGPU, a técnica mais adequada é o stencil buffer. Primeiro, desenhe o caminho da borracha no stencil buffer e depois use-o como máscara para redesenhar a cena. Tomando o OpenGL como exemplo (o WebGL é totalmente análogo):

```c++
// 1. Disable color/depth writes, enable stencil, and draw the eraser shape:
//    This writes “1” into the stencil where the eraser stamp is drawn.
glColorMask(false,false,false,false);
glDepthMask(false);
glEnable(GL_STENCIL_TEST);
glStencilFunc(GL_ALWAYS, 1, 0xFF);
glStencilOp(GL_REPLACE, GL_REPLACE, GL_REPLACE);
// draw eraser brush geometry here (e.g. a textured quad or circle)

glColorMask(true,true,true,true);
glDepthMask(true);
// 2. Now render the shapes with stencil test=EQUAL, so only pixels where stencil==1 pass:
glStencilFunc(GL_EQUAL, 1, 0xFF);
glStencilOp(GL_KEEP, GL_KEEP, GL_KEEP);
// draw all scene objects (they will only appear where eraser just wrote 1)
```

Vamos apresentar isso mais adiante na [Lição 34 - Frame e recorte].

## Leitura adicional {#extended-reading}

-   [Draw with illustration tools]
-   [Brush Rendering Tutorial]
-   [p5.brush]
-   [Real-Time Paint System with WebGL]
-   [简简单单实现画笔工具，轻松绘制丝滑曲线]

[Lição 14 - Modo da tela e interface auxiliar]: /pt-BR/guide/lesson-014
[Lição 18 - Refatorar com ECS]: /pt-BR/guide/lesson-018
[Draw with illustration tools]: https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools
[p5.brush]: https://github.com/acamposuribe/p5.brush
[Real-Time Paint System with WebGL]: https://chrisarasin.com/paint-system-webgl
[简简单单实现画笔工具，轻松绘制丝滑曲线]: https://zhuanlan.zhihu.com/p/701668081
[Lição 12 - Simplificar a polilinha]: /pt-BR/guide/lesson-012#simplify-polyline
[simplify-js]: https://github.com/mourner/simplify-js
[Brush Rendering Tutorial]: https://shenciao.github.io/brush-rendering-tutorial/
[Lição 12 - Extrudar o segmento]: /pt-BR/guide/lesson-012#extrude-segment
[How to Curve an Arrow in Figma]: https://imagy.app/how-to-curve-an-arrow-in-figma/
[marker-start]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-start
[marker-end]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-end
[Shape tools - polygons]: https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools#polygons
[plot - arrow]: https://github.com/observablehq/plot/blob/main/src/marks/arrow.js
[orient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/orient
[export arrow]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/ecs/snapshots/export-arrow.svg
[perfect-freehand]: https://github.com/steveruizok/perfect-freehand
[Perfect Freehand Drawing Issue]: https://github.com/excalidraw/excalidraw/issues/4802
[pressure]: https://developer.mozilla.org/docs/Web/API/PointerEvent/pressure
[freedraw eraser]: https://github.com/excalidraw/excalidraw/issues/3682
[non-atomic erasing for linear & freedraw shapes]: https://github.com/excalidraw/excalidraw/issues/4904
[laser pointer]: https://github.com/excalidraw/excalidraw/issues/5351
[@excalidraw/laser-pointer]: https://www.npmjs.com/package/@excalidraw/laser-pointer
[Lição 29 - Contêiner HTML]: /pt-BR/guide/lesson-029#create-html-container
[Lição 20 - Awareness e Presence]: /pt-BR/guide/lesson-020#awareness-presence
[Lição 34 - Frame e recorte]: /pt-BR/guide/lesson-034
