---
outline: deep
description: 'Implemente polilinhas com recursos avançados, incluindo larguras de linha arbitrárias, junções e extremidades do traço, linhas tracejadas e antialiasing. Aprenda a construção de malha na CPU e na GPU e os cálculos de caixa delimitadora.'
head:
    - ['meta', { property: 'og:title', content: 'Lição 12 - Polilinhas' }]
---

<script setup>
import Wireframe from '../../components/Wireframe.vue';
</script>

# Lição 12 - Desenhar polilinha {#lesson-12-draw-polyline}

Vamos continuar adicionando formas básicas: polilinhas. Nesta lição, você vai aprender o seguinte:

-   Por que não usar `gl.LINES` diretamente?
-   Construir a malha na CPU ou no shader
-   Analisar os detalhes do shader, incluindo:
    -   Esticar vértices e junções
    -   Antialiasing
    -   Desenhar linhas tracejadas
-   Como calcular a caixa delimitadora de uma polilinha?

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline, Rect } = Lesson12;

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

        const polyline1 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            fill: 'none',
        });
        canvas.appendChild(polyline1);

        const polyline2 = new Polyline({
            points: [
                [220, 100],
                [220, 200],
                [320, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'bevel',
            fill: 'none',
        });
        canvas.appendChild(polyline2);

        const polyline3 = new Polyline({
            points: [
                [340, 100],
                [340, 200],
                [440, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'round',
            strokeLinecap: 'round',
            fill: 'none',
        });
        canvas.appendChild(polyline3);

        const polyline4 = new Polyline({
            points: [
                [100, 300],
                [200, 300],
                [300, 210],
                [400, 300],
                [500, 300],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'round',
            strokeLinecap: 'round',
            strokeDasharray: [10, 5],
            fill: 'none',
        });
        canvas.appendChild(polyline4);

        const rect2 = new Rect({
            x: 500,
            y: 100,
            fill: 'black',
            fillOpacity: 0.5,
            stroke: 'red',
            strokeWidth: 10,
            dropShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            strokeDasharray: [5, 5],
        });
        rect2.width = 100;
        rect2.height = 100;
        canvas.appendChild(rect2);
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## Limitações de gl.LINES {#limitation-of-gl-lines}

Os `gl.LINES` e `gl.LINE_STRIP` fornecidos pelo WebGL muitas vezes não são muito práticos em cenários reais:

-   Não suportam largura. Se tentarmos usar [lineWidth], navegadores comuns como o Chrome emitem um aviso:

> [!WARNING]
> Desde janeiro de 2017, a maioria das implementações de WebGL só suporta um mínimo de 1 e um máximo de 1, pois a tecnologia em que se baseiam tem esses mesmos limites.

-   Não é possível definir o formato da conexão entre segmentos de linha adjacentes [lineJoin] nem o formato das extremidades [lineCap]
-   A implementação padrão tem serrilhados perceptíveis, o que exige antialiasing adicional

Vale observar que a solução de [Lição 5 - Grade de linhas] não serve para desenhar segmentos de linha arbitrários; ela nem sequer consegue definir as duas extremidades de um segmento de forma arbitrária. Além disso, a maior diferença entre segmentos de linha e polilinhas é o tratamento nas junções, para o qual o deck.gl oferece [LineLayer] e [PathLayer], respectivamente.

Agora vamos deixar claras as funcionalidades que queremos implementar para polilinhas:

-   Suporte a larguras de linha arbitrárias
-   Suporte para definir um número arbitrário de extremidades. Semelhante ao atributo [points] do SVG.
-   Suporte aos formatos de conexão entre segmentos de linha adjacentes [stroke-linejoin] e aos formatos das extremidades [stroke-linecap]
-   Suporte a linhas tracejadas. [stroke-dashoffset] e [stroke-dasharray]
-   Bom efeito de antialiasing
-   Suporte a desenho instanciado; veja o [desenho instanciado] apresentado antes

A API que projetamos é a seguinte:

```ts
const line = new Polyline({
  points: [
    [0, 0],
    [100, 100]
  ],
  strokeWidth: 100,
  strokeLinejoin: 'round'
  strokeLinecap: 'round',
  strokeMiterlimit: 4,
  strokeDasharray: [4, 1],
  strokeDashoffset: 10
});
```

Vamos olhar primeiro para a primeira pergunta: como implementar valores arbitrários de `strokeWidth`.

## Construir a malha {#construct-mesh}

A imagem a seguir vem do meetup de WebGL compartilhado pelo Pixi.js: [How 2 draw lines in WebGL]. Este artigo vai se apoiar bastante nas capturas dele, e vou indicar os números das páginas no PPT. Como os métodos nativos não estão disponíveis, só nos resta voltar ao esquema tradicional de desenho, que é construir a malha.

![Como desenhar linha em WebGL - página 5](/how-to-draw-line-in-webgl.png)

A prática comum é esticar e triangular na direção da normal do segmento de linha. A imagem a seguir vem de [Drawing Antialiased Lines with OpenGL]. As duas extremidades do segmento de linha são esticadas para os dois lados ao longo da normal tracejada em vermelho, formando 4 vértices, triangulados em 2 triângulos, de modo que `strokeWidth` pode ser qualquer valor.

![extrudar linha](/extrude-line.png)

### Construir na CPU {#construct-mesh-on-cpu}

O esticamento do segmento de linha e a construção da malha de `strokeLinejoin` e `strokeLinecap` podem ser feitos na CPU ou no shader. Implementações que seguem a primeira abordagem incluem:

-   [Instanced Line Rendering Part I]
-   [Instanced Line Rendering Part II]
-   [regl-gpu-lines]

![malha de instância do segmento](https://wwwtyro.net/media/instanced-lines/segment-instance.svg)

![instância de segmento, malhas de lineCap e lineJoin](https://rreusser.github.io/regl-gpu-lines/docs/debug.png)

Percebe-se que, quando `strokeLinejoin` e `strokeLinecap` assumem o valor `round`, a construção da malha exige o maior número de vértices para que os cantos arredondados pareçam suaves. Em [regl-gpu-lines], cada segmento exige até `32 * 4 + 6 = 134` vértices:

```ts
// @see https://github.com/rreusser/regl-gpu-lines/blob/main/src/index.js#L81
cache.indexBuffer = regl.buffer(
    new Uint8Array([...Array(MAX_ROUND_JOIN_RESOLUTION * 4 + 6).keys()]), // MAX_ROUND_JOIN_RESOLUTION = 32
);
```

`strokeLinecap` e os segmentos de linha precisam ser desenhados em Drawcalls diferentes. Ainda tomando o [instanced example] de [regl-gpu-lines] como exemplo, é preciso compilar dois Programs e usar 3 Drawcalls para desenhar, entre os quais:

-   As duas extremidades usam o mesmo Program, mas o Uniform `orientation` é diferente. O número de vértices é `cap + join`
-   Todos os segmentos de linha do meio são desenhados com um Drawcall, o número de vértices é `join + join`, e o número de instâncias é o número de segmentos de linha

```ts
const computeCount = isEndpoints
    ? // Draw a cap
      (props) => [props.capRes2, props.joinRes2]
    : // Draw two joins
      (props) => [props.joinRes2, props.joinRes2];
```

Se houver várias polilinhas, as condições para mesclar são os mesmos valores de `strokeLinecap` e `strokeLinejoin` e o número de segmentos de linha. A figura a seguir mostra a situação de desenhar 5 polilinhas, em que a parte do segmento do meio de cada polilinha contém 8 `instance`, então o número total de `instance` é 40:

![drawcalls de linecap e segmentos](/regl-gpu-lines.png)

### Construir no shader {#construct-mesh-on-shader}

Do meetup de WebGL compartilhado pelo Pixi.js, construir a malha no shader:

-   [How 2 draw lines in WebGL]
-   [pixijs/graphics-smooth]

Em comparação com a construção na CPU, as vantagens incluem:

-   Só é necessário um Drawcall para desenhar `strokeLinecap`, `strokeLineJoin` e o segmento do meio
-   Os vértices são fixos em 9, em que os vértices 1234 formam dois triângulos para desenhar a parte do segmento de linha, e os vértices 56789 formam três triângulos para desenhar a parte da junção
-   Quando `strokeLinecap` e `strokeLinejoin` assumem o valor `round`, o resultado é mais suave porque um método semelhante a desenhar círculos com SDF é usado no Fragment Shader
-   Bom efeito de antialiasing

![empacotar junções em instâncias - página 15](/pack-joints-into-instances.png)

```glsl
layout(location = ${Location.PREV}) in vec2 a_Prev;
layout(location = ${Location.POINTA}) in vec2 a_PointA;
layout(location = ${Location.POINTB}) in vec2 a_PointB;
layout(location = ${Location.NEXT}) in vec2 a_Next;
layout(location = ${Location.VERTEX_JOINT}) in float a_VertexJoint;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum;
```

O layout do Buffer é o seguinte, com cada Stride de tamanho `4 * 3`. No Buffer, os mesmos dados contínuos, como `x1 y1 t1`, são lidos como `A_0` na primeira instância e como `Prev_1` na segunda instância. Esse layout entrelaçado pode economizar o máximo possível de tamanho de Buffer:

```ts
const vertexBufferDescriptors: InputLayoutBufferDescriptor[] = [
    {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
            {
                format: Format.F32_RG,
                offset: 4 * 0,
                shaderLocation: Location.PREV,
            },
            {
                format: Format.F32_RG,
                offset: 4 * 3,
                shaderLocation: Location.POINTA,
            },
            {
                format: Format.F32_R,
                offset: 4 * 5,
                shaderLocation: Location.VERTEX_JOINT,
            },
            {
                format: Format.F32_RG,
                offset: 4 * 6,
                shaderLocation: Location.POINTB,
            },
            {
                format: Format.F32_RG,
                offset: 4 * 9,
                shaderLocation: Location.NEXT,
            },
        ],
    },
];
```

Infelizmente, se mudarmos para o renderizador WebGPU, vamos receber o seguinte erro:

> [!WARNING]
> O deslocamento do atributo (12) com o formato VertexFormat::Float32x2 (tamanho: 8) não cabe no stride do vertex buffer (12).

O motivo é que o WebGPU tem a seguinte regra de verificação para VertexBufferLayout, e o nosso arrayStride é `4 * 3`. [WebGPU instancing problem] e [spec: It is useful to allow GPUVertexBufferLayout.arrayStride to be less than offset + sizeof(attrib.format)] também mencionam isso.

> attrib.offset + byteSize(attrib.format) ≤ descriptor.arrayStride.
>
> 4 _3 + 4_ 2 ≤ 4 \* 3 // Oops!

Portanto, temos que mudar o layout do Buffer. Primeiro, no Layout, dividimos o layout de um Buffer que contém vários Attributes em vários Buffers, cada um contendo apenas um Attribute:

```ts
const vertexBufferDescriptors: InputLayoutBufferDescriptor[] = [
    {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
            {
                format: Format.F32_RG,
                offset: 4 * 0,
                shaderLocation: Location.PREV,
            },
        ],
    },
    {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
            {
                format: Format.F32_RG,
                offset: 4 * 0,
                shaderLocation: Location.POINTA,
            },
        ],
    },
    // Omit VERTEX_JOINT
    // Omit POINTB
    // Omit NEXT
];
```

Embora dividido em várias declarações de BufferLayout, a referência real é ao mesmo Buffer; só o Attribute correspondente é lido por meio de `offset`. Veja os detalhes: [Offset in bytes into buffer where the vertex data begins]。

```ts
const buffers = [
    {
        buffer: this.#segmentsBuffer, // PREV
    },
    {
        buffer: this.#segmentsBuffer, // POINTA
        offset: 4 * 3,
    },
    {
        buffer: this.#segmentsBuffer, // VERTEX_JOINT
        offset: 4 * 5,
    },
    {
        buffer: this.#segmentsBuffer, // POINTB
        offset: 4 * 6,
    },
    {
        buffer: this.#segmentsBuffer, // NEXT
        offset: 4 * 9,
    },
];
renderPass.setVertexInput(this.#inputLayout, buffers, {
    buffer: this.#indexBuffer,
});
```

Outros recursos também serão implementados mais adiante com base nesse esquema.

<Wireframe />

## Análise da implementação do shader {#shader-implementation}

Primeiro, vamos ver como esticar os vértices no corpo principal e nas junções do segmento de linha.

### Extrudar o segmento {#extrude-segment}

Vamos nos concentrar nos vértices 1 a 4, isto é, a parte principal do segmento de linha. Considerando o ângulo que o segmento de linha e os segmentos adjacentes formam, há as quatro formas a seguir: `/-\` `\-/` `/-/` e `\-\`:

![extrudar ao longo do segmento de linha - página 16](/line-vertex-shader.png)

Antes de calcular o vetor normal unitário, converta a posição de cada vértice para o sistema de coordenadas do modelo:

```glsl
vec2 pointA = (model * vec3(a_PointA, 1.0)).xy;
vec2 pointB = (model * vec3(a_PointB, 1.0)).xy;

vec2 xBasis = pointB - pointA;
float len = length(xBasis);
vec2 forward = xBasis / len;
vec2 norm = vec2(forward.y, -forward.x);

xBasis2 = next - base;
float len2 = length(xBasis2);
vec2 norm2 = vec2(xBasis2.y, -xBasis2.x) / len2;
float D = norm.x * norm2.y - norm.y * norm2.x;
```

Na primeira forma, por exemplo, os vértices 1 e 2 são esticados para fora ao longo da normal, e os vértices 3 e 4 são esticados para dentro ao longo das bissetrizes (`doBisect()`) das junções:

```glsl
if (vertexNum < 3.5) { // Vertex #1 ~ 4
    if (abs(D) < 0.01) {
        pos = dy * norm;
    } else {
        if (flag < 0.5 && inner < 0.5) { // Vertex #1, 2
            pos = dy * norm;
        } else { // Vertex #3, 4
            pos = doBisect(norm, len, norm2, len2, dy, inner);
        }
    }
}
```

### Extrudar a junção {#extrude-linejoin}

Em seguida, focamos nos vértices 5~9 da junção. A direção e a distância do esticamento variam de acordo com o formato da junção. A implementação do autor original é bem complexa: nela, `bevel` e `round` compartilham o mesmo método de esticamento, e o segundo completa os cantos arredondados do desenho no Fragment Shader, por meio do SDF.

![extrudar ao longo do segmento de linha - página 16](/line-vertex-shader2.png)

Vamos começar a análise pelo `miter` mais simples, que, por definição, se converte em `bevel` se `strokeMiterlimit` for excedido.

```glsl
if (length(pos) > abs(dy) * strokeMiterlimit) {
    type = BEVEL;
} else {
    if (vertexNum < 4.5) {
        dy = -dy;
        pos = doBisect(norm, len, norm2, len2, dy, 1.0);
    } else if (vertexNum < 5.5) {
        pos = dy * norm;
    } else if (vertexNum > 6.5) {
        pos = dy * norm2;
    }
    v_Type = 1.0;
    dy = -sign * dot(pos, norm);
    dy2 = -sign * dot(pos, norm2);
    hit = 1.0;
}
```

Vale mencionar que, no Cairo, a escolha entre junções round ou bevel precisa ser determinada com base em `arc height`. A figura a seguir vem de: [Cairo - Fix for round joins]

![Cairo - correção para junções arredondadas](https://gitlab.freedesktop.org/-/project/956/uploads/b53d20cf0156e48b4a9766f6c5ff5cff/round_join.png)

### Antialiasing {#anti-aliasing}

Por fim, vamos ver como fazer o antialiasing das bordas do segmento de linha. Já apresentamos o [antialiasing no SDF] antes, e aqui usamos uma abordagem parecida:

1. Calcular o vetor unitário vertical do vértice até o segmento de linha no Vertex Shader e passá-lo ao Fragment Shader por meio de `varying`, para interpolação automática
2. O vetor interpolado deixa de ser um vetor unitário. Calcule o comprimento dele, que é a distância perpendicular do pixel atual até o segmento de linha, no intervalo `[0, 1]`
3. Use esse valor para calcular a transparência final do pixel, concluindo o antialiasing. O `smoothstep` ocorre na borda do segmento de linha, isto é, no intervalo `[linewidth - feather, linewidth + feather]`. A figura a seguir vem de: [Drawing Antialiased Lines with OpenGL], e a lógica específica de cálculo será apresentada mais adiante.

![feather](https://miro.medium.com/v2/resize:fit:818/format:webp/0*EV5FGcUOHAbFFPjy.jpg)

Quanto deve valer esse "feather"? No [desenho da sombra externa do retângulo], expandimos o tamanho original do retângulo em `3 * dropShadowBlurRadius`. A figura a seguir ainda vem de [How 2 draw lines in WebGL]: expandir um pixel para fora (de `w` -> `w+1`) é suficiente. Do outro lado, a distância dos dois vértices (vértices #3 e #4) é negativa:

```glsl
const float expand = 1.0;
lineWidth *= 0.5;

float dy = lineWidth + expand; // w + 1
if (vertexNum >= 1.5) { // Vertex #3 & #4
  dy = -dy; // -w - 1
}
```

Pela figura no canto inferior direito, também é possível ver que, quando ampliamos para olhar cada pixel no Fragment Shader, usando essa distância orientada `d`, podemos calcular a cobertura do segmento de linha e do pixel atual (a área do triângulo na figura a seguir), obtendo um efeito de antialiasing.

![estender 1 pixel para fora](/line-segment-antialias.png)

Então, como usar essa distância para calcular a cobertura? Isso precisa ser dividido entre o corpo principal do segmento de linha e a situação da junção.

Primeiro, vamos olhar a situação do corpo principal do segmento de linha, que pode ser simplificada ainda mais para o caso de um segmento de linha vertical. O autor original também forneceu um método de cálculo que considera a rotação, e ele não difere muito da versão de estimativa simplificada. Use `clamp` para calcular a cobertura de um lado e considere também o caso de uma largura de linha muito fina: subtraia o lado esquerdo do lado direito para obter a cobertura final, como coeficiente de transparência da cor final.

![calcular a cobertura segundo a distância com sinal](/line-segment-antialias2.png)

É claro que calcular a área de interseção entre a parte do segmento de linha e a reta é o caso mais simples. O tratamento nas junções e nas extremidades será bem complexo. Tomando a junção Miter como exemplo, ainda ignore a rotação e considere apenas o caso em que os segmentos de linha adjacentes são perpendiculares (observe a área da caixa vermelha no lado direito da figura a seguir). Ao contrário do segmento de linha acima, que só tem uma distância orientada `d`, aqui há duas distâncias orientadas `d1` e `d2`, que representam os dois segmentos de linha da frente e de trás na junção. Da mesma forma, considerando uma linha muito fina dentro da área de um pixel, a área de cobertura é a diferença de área entre os dois quadrados (`a2 * b2 - a1 * b1`):

![calcular a cobertura na junção miter](/line-segment-antialias3.png)

O método de cálculo da junção Bevel é praticamente o mesmo do Miter (a situação do meio na figura a seguir). `d3` representa a distância do centro do pixel até a "linha de bevel", e pode ser usado para calcular a cobertura no lado direito da figura a seguir. Você pode tomar o valor mínimo dessas duas situações para obter um resultado de cálculo aproximado.

![calcular a cobertura na junção bevel](/line-segment-antialias5.png)

![calcular a cobertura na junção bevel](/line-segment-antialias4.png)

Por fim, chegamos ao caso das junções arredondadas. Ele exige uma distância adicional `d3`, do centro do círculo até o pixel (semelhante a desenhar círculos com SDF), passada a partir do Vertex Shader.

![calcular a cobertura na junção arredondada](/line-segment-antialias6.png)

![calcular a cobertura na junção arredondada](/line-segment-antialias7.png)

O autor original também forneceu uma versão exata da implementação de `pixelLine`, que não será desenvolvida por limitação de espaço.

### Suporte a stroke-alignment {#stroke-alignment}

Antes, implementamos [SVG aprimorado: alinhamento do traço] em Circle, Ellipse e Rect desenhados com SDF. Agora vamos adicionar esse atributo às polilinhas. A figura a seguir vem do efeito `lineStyle.alignment` no Pixi.js, em que a linha vermelha representa a posição geométrica da polilinha, e ela flutua para cima e para baixo de acordo com valores diferentes:

![alinhamento do traço - p27](/line-stroke-alignment.png)

Nas polilinhas de ECS, o alinhamento do traço também afeta os limites geométricos calculados.
Mudar `strokeWidth` ou `strokeAlignment`, remover a geometria do traço e
desfazer ou refazer essas edições atualizam os pontos deslocados e os limites deles. Uma
polilinha sem traço mantém os pontos originais. Amostras duplicadas consecutivas
compartilham o deslocamento do vértice comum; uma polilinha feita inteiramente de amostras coincidentes
permanece finita. A ordem e a quantidade originais de pontos são mantidas na exportação para SVG.

No shader, refletimos esse atributo no deslocamento ao longo do esticamento da normal. Se `strokeAlignment` assumir o valor `center`, o deslocamento é `0`:

```glsl
float shift = strokeWidth * strokeAlignment;
pointA += norm * shift;
pointB += norm * shift;
```

Da esquerda para a direita estão os efeitos de `outer`, `center` e `inner`:

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

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

        const polyline1 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 200],
                [200, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeAlignment: 'outer',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);
        const polyline4 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 200],
                [200, 100],
            ],
            stroke: 'red',
            strokeWidth: 2,
            // strokeAlignment: 'outer',
            fill: 'none',
        });
        canvas.appendChild(polyline4);

        const polyline2 = new Polyline({
            points: [
                [220, 100],
                [220, 200],
                [320, 200],
                [320, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            cursor: 'pointer',
            fill: 'none',
        });
        canvas.appendChild(polyline2);
        const polyline5 = new Polyline({
            points: [
                [220, 100],
                [220, 200],
                [320, 200],
                [320, 100],
            ],
            stroke: 'red',
            strokeWidth: 2,
            fill: 'none',
        });
        canvas.appendChild(polyline5);

        const polyline3 = new Polyline({
            points: [
                [360, 100],
                [360, 200],
                [460, 200],
                [460, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeAlignment: 'inner',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
        const polyline6 = new Polyline({
            points: [
                [360, 100],
                [360, 200],
                [460, 200],
                [460, 100],
            ],
            stroke: 'red',
            strokeWidth: 2,
            fill: 'none',
        });
        canvas.appendChild(polyline6);

        polyline1.addEventListener('pointerenter', () => {
            polyline1.stroke = 'green';
        });
        polyline1.addEventListener('pointerleave', () => {
            polyline1.stroke = 'black';
        });
        polyline2.addEventListener('pointerenter', () => {
            polyline2.stroke = 'green';
        });
        polyline2.addEventListener('pointerleave', () => {
            polyline2.stroke = 'black';
        });
        polyline3.addEventListener('pointerenter', () => {
            polyline3.stroke = 'green';
        });
        polyline3.addEventListener('pointerleave', () => {
            polyline3.stroke = 'black';
        });
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

Por fim, há dois pontos a observar:

1. Como `stroke-alignment` não é um atributo SVG padrão, é necessário recalcular `points` ao exportar para SVG, o que é consistente com a lógica de esticar ao longo da normal e da bissetriz no shader, e não será desenvolvido por limitação de espaço
2. O método de determinação de picking, isto é, `containsPoint`, também precisa ser calculado com base nos vértices deslocados de `points`. Você pode tentar mudar a cor da polilinha movendo o mouse para dentro e para fora do exemplo acima

### Linhas tracejadas {#dash}

Um traço do tracejado tem suas próprias duas extremidades. Aplicar uma máscara de alpha periódica a um traço sólido pode produzir cortes retos em segmentos retos, mas não consegue criar extremidades arredondadas, e projetar um canto apenas sobre o segmento de entrada produz cunhas fora do lugar.

Primeiro, associe as distâncias acumuladas da **linha central** às instâncias de segmento corretas. Para `[[0, 0], [100, 0], [200, 0]]`, as instâncias são a extremidade inicial opcional e dois segmentos, com distâncias iniciais `[0, 0, 100]`. Cada instância também carrega a distância inicial do segmento anterior e do seguinte; `-1` significa que esse vizinho não existe:

```glsl
layout(location = ${Location.TRAVEL}) in vec3 a_Travel;
// x: current segment start; y: previous start; z: next start
```

No fragment shader, use `period = dash + gap` para localizar os intervalos pintados mais próximos e, então, recorte esses intervalos no segmento da linha central deles. O comprimento pintado é o **dash**, não o gap. Este capítulo ainda suporta um padrão de dois números; qualquer período positivo é válido, inclusive valores abaixo de um pixel. Um gap zero produz um traço sólido.

Para `strokeLinecap: 'round'`, cada intervalo pintado é uma cápsula. Aqui `p.x` é a distância ao longo desse intervalo em unidades de mundo, `p.y` é a distância perpendicular a partir da linha central dele, e `dashLength` é o comprimento recortado dele nas mesmas unidades:

```glsl
float radius = strokeWidth * 0.5;
float alongOutside = max(max(-p.x, p.x - dashLength), 0.0);
float distance = length(vec2(alongOutside, p.y)) - radius;
float coverage = clamp(
    0.5 - distance / max(fwidth(distance), 0.0001),
    0.0, 1.0
);
```

Use a meia largura completa como raio; misturar isso com uma distância perpendicular que já foi escalada deixa as extremidades e o corpo estreitos demais. `butt` usa um retângulo; `square` estende o retângulo pela meia largura em cada extremidade. Extremidades round e square avançam sobre o gap nominal, então um gap mais estreito que a largura do traço pode fazer traços vizinhos se tocarem.

Os cantos precisam das duas direções dos segmentos:

1. Avalie os intervalos visíveis do traço tracejado do segmento atual, do anterior e do seguinte, e tome a união deles. As células de período vizinhas também são verificadas, para que traços parciais nas extremidades e deslocamentos negativos funcionem.
2. Se um traço do tracejado continua através de um vértice, suprima as extremidades artificiais nesse limite de segmento e use `strokeLinejoin` para o canto externo.
3. Se o traço do tracejado para ali, ou se o vértice está em um gap, não adicione uma cunha sólida de junção. As extremidades reais do tracejado ainda podem se sobrepor ao canto; não as recorte pela junção round ou bevel do traço sólido.
4. Caminhos fechados conectam o primeiro e o último segmento com as distâncias acumuladas reais deles. Subcaminhos independentes recomeçam em zero.

A geometria permanece fixa enquanto `strokeDashoffset` muda; só o uniform dele muda. O denominador do antialiasing por distância com sinal fica limitado longe de zero, inclusive em fragmentos de cobertura constante.

Também podemos alterar (incrementar) `stroke-dashoffset` em tempo real para obter um efeito de formigas. Efeitos de animação como esse costumam ser implementados pelo atributo SVG de mesmo nome; veja: [How to animate along an SVG path at the same time the path animates?]

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    let polyline1;
    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        polyline1 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 200],
                [200, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeDasharray: [10, 10],
            strokeDashoffset: 0,
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);

        const polyline2 = new Polyline({
            points: [
                [300, 100],
                [300, 200],
                [500, 200],
                [500, 100],
            ],
            stroke: 'black',
            strokeWidth: 10,
            strokeDasharray: [20, 20],
            strokeDashoffset: 0,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);

        polyline1.addEventListener('pointerenter', () => {
            polyline1.stroke = 'green';
        });
        polyline1.addEventListener('pointerleave', () => {
            polyline1.stroke = 'black';
        });
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
        polyline1.strokeDashoffset += 0.1;
    });
});
```

Outro método de implementação usa `fract()`; veja: [Pure WebGL Dashed Line].

De acordo com a especificação SVG, os atributos `stroke-dasharray` e `stroke-dashoffset` também podem ser aplicados a outras formas, como Circle / Ellipse / Rect. Portanto, quando esses dois atributos têm valores razoáveis, o contorno originalmente desenhado com SDF precisa passar a ser implementado com Polyline. Tomando Rect como exemplo, podem ser necessários até 3 drawcalls para desenhar a sombra externa, o corpo principal do retângulo e o contorno tracejado:

```ts
SHAPE_DRAWCALL_CTORS.set(Rect, [ShadowRect, SDF, SmoothPolyline]);
```

Para Rect, construa cinco pontos: os quatro cantos e o primeiro ponto repetido. Ao preparar as instâncias da GPU, conecte o ponto anterior do primeiro segmento ao último segmento, e o ponto seguinte do último segmento ao primeiro. Isso fecha a junção sem um segmento extra de comprimento epsilon nem extremidades de cap. Circle e Ellipse usam o mesmo fechamento com mais amostras (aqui `64`):

```ts
if (object instanceof Polyline) {
    points = object.points.reduce((prev, cur) => {
        prev.push(cur[0], cur[1]);
        return prev;
    }, [] as number[]);
} else if (object instanceof Rect) {
    const { x, y, width, height } = object;
    points = [x, y, x + width, y, x + width, y + height, x, y + height, x, y];
}
```

```js eval code=false
$icCanvas5 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect, Circle, Ellipse } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas5.parentElement.style.position = 'relative';
    $icCanvas5.parentElement.appendChild($stats);

    $icCanvas5.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const rect = new Rect({
            x: 50,
            y: 50,
            fill: 'black',
            fillOpacity: 0.5,
            dropShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            stroke: 'red',
            strokeWidth: 10,
        });
        rect.width = 100;
        rect.height = 100;
        canvas.appendChild(rect);

        const rect2 = new Rect({
            x: 200,
            y: 50,
            fill: 'black',
            fillOpacity: 0.5,
            stroke: 'red',
            strokeWidth: 10,
            dropShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            strokeDasharray: [5, 5],
        });
        rect2.width = 100;
        rect2.height = 100;
        canvas.appendChild(rect2);

        const circle = new Circle({
            cx: 400,
            cy: 100,
            r: 50,
            fill: 'black',
            stroke: 'red',
            strokeWidth: 20,
            strokeDasharray: [5, 5],
        });
        canvas.appendChild(circle);

        const circle2 = new Circle({
            cx: 550,
            cy: 100,
            r: 50,
            fill: 'black',
            stroke: 'red',
            strokeWidth: 20,
            strokeDasharray: [5, 20],
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle2);

        const ellipse = new Ellipse({
            cx: 150,
            cy: 250,
            rx: 100,
            ry: 50,
            fill: 'black',
            stroke: 'red',
            strokeWidth: 20,
            strokeDasharray: [5, 5],
        });
        canvas.appendChild(ellipse);
    });

    $icCanvas5.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## Calcular a caixa delimitadora {#geometry-bounds}

Vamos sair temporariamente da renderização e fazer alguns cálculos geométricos. Como foi apresentado em lições anteriores, as caixas delimitadoras precisam ser calculadas tanto no picking quanto no culling.

Ignorando atributos de desenho como a largura da linha, o cálculo da caixa delimitadora geométrica é bem simples. Basta encontrar as coordenadas mínima e máxima de todos os vértices da polilinha:

```ts
const minX = Math.min(...points.map((point) => point[0]));
const maxX = Math.max(...points.map((point) => point[0]));
const minY = Math.min(...points.map((point) => point[1]));
const maxY = Math.max(...points.map((point) => point[1]));

return new AABB(minX, minY, maxX, maxY);
```

Quando entram em cena a largura da linha, as extremidades e as junções, calcular a caixa delimitadora de uma polilinha fica mais complexo. Se um resultado preciso não for necessário, você pode simplesmente estender a caixa delimitadora mencionada para fora em metade da largura da linha. [Calculate bounding box of line with thickness] usa o método [cairo-stroke-extents] fornecido pelo Cairo. Se a largura da linha for `0`, ele degenera em [cairo-path-extents]:

> Calcula uma caixa delimitadora em coordenadas do usuário cobrindo a área que seria afetada (a área "pintada")

Ao continuar examinando o código-fonte do Cairo, descobre-se que, para caixas delimitadoras de traço, ele também oferece dois métodos (omitindo aqui um grande número de parâmetros). O primeiro usa um método de estimativa e, por isso, é mais rápido, enquanto o segundo considera os formatos específicos das extremidades e das junções para um cálculo preciso:

```c
cairo_private void
_cairo_path_fixed_approximate_stroke_extents ();

cairo_private cairo_status_t
_cairo_path_fixed_stroke_extents ();
```

### Estimativa rápida {#approximate-stroke-extents}

Essa estimativa consiste em expandir uma certa distância para fora, nas direções horizontal e vertical, a partir da caixa delimitadora geométrica: `style_expansion * strokeWidth`.

```c
/*
 * For a stroke in the given style, compute the maximum distance
 * from the path that vertices could be generated.  In the case
 * of rotation in the ctm, the distance will not be exact.
 */
void
_cairo_stroke_style_max_distance_from_path (const cairo_stroke_style_t *style,
         const cairo_path_fixed_t *path,
                                            const cairo_matrix_t *ctm,
                                            double *dx, double *dy)
{
    double style_expansion = 0.5;

    if (style->line_cap == CAIRO_LINE_CAP_SQUARE)
 style_expansion = M_SQRT1_2;

    if (style->line_join == CAIRO_LINE_JOIN_MITER &&
 ! path->stroke_is_rectilinear &&
 style_expansion < M_SQRT2 * style->miter_limit)
    {
 style_expansion = M_SQRT2 * style->miter_limit;
    }

    style_expansion *= style->line_width;
}
```

Considerando o caso de `stroke-linecap="square"`, a figura a seguir mostra que, na situação mais ideal, `style_expansion` é igual a `0.5`, isto é, estender `0.5 * strokeWidth` a partir do corpo vermelho, e a área preta é a caixa delimitadora do `<polyline>`.

<svg xmlns="http://www.w3.org/2000/svg" width="400" height="30">
  <g>
    <polyline
      fill="none"
      stroke="black"
      stroke-width="20"
      stroke-linecap="square"
      points="10,10 300,10"
    />
    <polyline
      fill="none"
      stroke="red"
      stroke-width="2"
      points="10,10 300,10"
    />
  </g>
</svg>

Mas, se a polilinha estiver levemente inclinada a 45 graus, a distância estendida para fora nesse momento é `sqrt(2) / 2 * strokeWidth`:

<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
  <g>
    <polyline
      fill="none"
      stroke="black"
      stroke-width="20"
      stroke-linecap="square"
      points="30,30 200,200"
    />
    <polyline
      fill="none"
      stroke="red"
      stroke-width="2"
      points="30,30 200,200"
    />
    <polygon
      fill="none"
      stroke="red"
      stroke-width="2"
      points="15,15 215,15 215,215 15,215"
    />
  </g>
</svg>

Da mesma forma, o caso de `stroke-linejoin="miter"` também precisa ser considerado. Percebe-se que esse método de estimativa não considera com precisão cada vértice e cada junção, e apenas faz a estimativa mais generosa para garantir que a caixa delimitadora consiga acomodar a polilinha.

Abaixo desenhamos a caixa delimitadora da polilinha em tempo real, mostrando os diferentes valores de `strokeLinecap` da esquerda para a direita:

```js eval code=false
$icCanvas6 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline, Rect } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas6.parentElement.style.position = 'relative';
    $icCanvas6.parentElement.appendChild($stats);

    function drawBounds(canvas, polyline) {
        const { minX, minY, maxX, maxY } = polyline.getBounds();
        const bounds = new Rect({
            x: minX,
            y: minY,
            stroke: 'red',
            fill: 'none',
        });
        bounds.width = maxX - minX;
        bounds.height = maxY - minY;
        canvas.appendChild(bounds);
    }

    $icCanvas6.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        const polyline1 = new Polyline({
            points: [
                [100, 100],
                [200, 200],
            ],
            stroke: 'black',
            strokeWidth: 20,
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);
        drawBounds(canvas, polyline1);

        const polyline2 = new Polyline({
            points: [
                [300, 100],
                [400, 200],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeLinecap: 'round',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);
        drawBounds(canvas, polyline2);

        const polyline3 = new Polyline({
            points: [
                [500, 100],
                [600, 200],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeLinecap: 'square',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
        drawBounds(canvas, polyline3);
    });

    $icCanvas6.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### Cálculo preciso {#stroke-extents}

E se você realmente quiser calcular com precisão? A ideia do Cairo é primeiro converter isso em um Polygon e, então, calcular a caixa delimitadora dele:

![extensão do traço](/polyline-extents.png)

```c
cairo_status_t
_cairo_path_fixed_stroke_extents (const cairo_path_fixed_t *path,
      const cairo_stroke_style_t *stroke_style,
      const cairo_matrix_t  *ctm,
      const cairo_matrix_t  *ctm_inverse,
      double    tolerance,
      cairo_rectangle_int_t  *extents)
{
    cairo_polygon_t polygon;
    cairo_status_t status;
    cairo_stroke_style_t style;

    _cairo_polygon_init (&polygon, NULL, 0);
    status = _cairo_path_fixed_stroke_to_polygon (path,
        stroke_style,
        ctm, ctm_inverse,
        tolerance,
        &polygon);
    _cairo_box_round_to_rectangle (&polygon.extents, extents);
    _cairo_polygon_fini (&polygon);

    return status;
}
```

## Teste de desempenho {#perf}

Vamos testar o desempenho, mostrando várias polilinhas, cada uma contendo 20.000 pontos:

```js eval code=false
$icCanvas4 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas4.parentElement.style.position = 'relative';
    $icCanvas4.parentElement.appendChild($stats);

    let polyline1;
    $icCanvas4.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        const data = new Array(20000)
            .fill(undefined)
            .map((_, i) => [i, Math.random() * 50]);
        polyline1 = new Polyline({
            points: data,
            stroke: 'black',
            strokeWidth: 2,
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);

        const data2 = new Array(20000)
            .fill(undefined)
            .map((_, i) => [i, Math.random() * 50 + 100]);
        polyline2 = new Polyline({
            points: data2,
            stroke: 'black',
            strokeWidth: 2,
            strokeLinejoin: 'round',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);

        const data3 = new Array(20000)
            .fill(undefined)
            .map((_, i) => [i, Math.random() * 50 + 200]);
        polyline3 = new Polyline({
            points: data3,
            stroke: 'black',
            strokeWidth: 2,
            strokeDasharray: [4, 4],
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
    });

    $icCanvas4.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

Parece razoável, mas, depois de uma análise cuidadosa, ainda há as questões a seguir, que podem ser vistas como direções de melhoria futuras:

-   Como cada Instance usa 15 vértices, e o Buffer tem um limite de tamanho, o número real de vértices contidos em uma única polilinha é limitado
-   Atualmente, uma polilinha corresponde a um Drawcall. E se houver um grande número de polilinhas semelhantes repetidas? [regl-gpu-lines] oferece duas ideias:
    -   Um Drawcall também pode desenhar várias polilinhas, usando `[NaN, NaN]` para indicar pontos de quebra; exemplo: [Multiple lines]
    -   Se os dados de vértice de várias polilinhas forem os mesmos, e só o deslocamento for diferente, cada polilinha pode ser tratada como uma Instance. É claro que os vértices dentro de cada polilinha precisam ser expandidos; exemplo: [Fake instancing]
-   Simplificar vértices com base no nível de zoom atual da câmera

Abaixo continuamos a otimizar nessa linha.

### Polilinha com vários segmentos {#polyline-with-multiple-segments}

Na linha da otimização anterior para reduzir o número de Drawcalls, podemos emendar várias polilinhas, mas é claro que precisamos usar algum tipo de separador; cf. [regl-gpu-lines], usamos `[NaN, NaN]`. E logo vamos usá-lo ao desenhar caminhos mais adiante: um caminho pode conter vários subcaminhos!

```bash
Polyline1: [[0, 0], [100, 100]]
Polyline2: [[100, 0], [200, 100]]
MultiPolyline: [[0, 0], [100, 100], [NaN, NaN], [100, 0], [200, 100]]
```

Depois de dividir pelo separador, o array de vértices ainda é construído para cada segmento da mesma forma que acima:

```ts
const subPaths = [];
let lastNaNIndex = 0;
for (let i = 0; i < points.length; i += stridePoints) {
    if (isNaN(points[i]) || isNaN(points[i + 1])) {
        subPaths.push(points.slice(lastNaNIndex, i));
        lastNaNIndex = i + 2;
    }
}
subPaths.push(points.slice(lastNaNIndex));
subPaths.forEach((points) => {
    // Omit constructing each segments
});
```

O efeito é o seguinte, com as observações abaixo:

-   Como as várias polilinhas foram mescladas em uma só, o picking também passa a valer para o conjunto inteiro. Tente passar o mouse sobre os três conjuntos de linhas abaixo.
-   Ao exportar para SVG, já não é possível exportar diretamente para o elemento `<polyline>` correspondente.

```js eval code=false
$icCanvas7 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas7.parentElement.style.position = 'relative';
    $icCanvas7.parentElement.appendChild($stats);

    $icCanvas7.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        const data = new Array(200).fill(undefined).map((_, i) => [
            [Math.random() * 200, Math.random() * 200],
            [Math.random() * 200, Math.random() * 200],
            [NaN, NaN],
        ]);
        const polyline = new Polyline({
            points: data.flat(1),
            stroke: 'black',
            strokeWidth: 2,
            strokeLinecap: 'round',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline);
        polyline.addEventListener(
            'pointerenter',
            () => (polyline.stroke = 'red'),
        );
        polyline.addEventListener(
            'pointerleave',
            () => (polyline.stroke = 'black'),
        );

        const data2 = new Array(200).fill(undefined).map((_, i) => [
            [Math.random() * 200 + 200, Math.random() * 200],
            [Math.random() * 200 + 200, Math.random() * 200],
            [NaN, NaN],
        ]);
        const polyline2 = new Polyline({
            points: data2.flat(1),
            stroke: 'black',
            strokeWidth: 2,
            strokeLinecap: 'round',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);
        polyline2.addEventListener(
            'pointerenter',
            () => (polyline2.stroke = 'green'),
        );
        polyline2.addEventListener(
            'pointerleave',
            () => (polyline2.stroke = 'black'),
        );

        const data3 = new Array(200).fill(undefined).map((_, i) => [
            [Math.random() * 200 + 400, Math.random() * 200],
            [Math.random() * 200 + 400, Math.random() * 200],
            [NaN, NaN],
        ]);
        const polyline3 = new Polyline({
            points: data3.flat(1),
            stroke: 'black',
            strokeWidth: 2,
            strokeLinecap: 'round',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
        polyline3.addEventListener(
            'pointerenter',
            () => (polyline3.stroke = 'blue'),
        );
        polyline3.addEventListener(
            'pointerleave',
            () => (polyline3.stroke = 'black'),
        );
    });

    $icCanvas7.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### [WIP] Mesclar polilinhas semelhantes {#merge-similar-polylines}

### Simplificar a polilinha {#simplify-polyline}

Para polilinhas (e, em seguida, Paths e polígonos) que contêm um grande número de vértices, uma otimização importante é simplificá-las de acordo com o nível de zoom atual, reduzindo o máximo possível a quantidade de dados renderizados. A base da simplificação é dupla:

1. Segmentos curtos demais e polígonos pequenos demais podem ser filtrados.
2. Vértices de uma polilinha que têm pouco impacto na forma geral podem ser filtrados.

O algoritmo básico para simplificação de vértices de segmento é o [Ramer–Douglas–Peucker algorithm], que funciona assim:

1. Primeiro mantenha o primeiro e o último vértice da polilinha e conecte-os.
2. Encontre, entre os vértices restantes, o vértice mais distante do segmento, e guarde essa distância.
3. Se a distância for menor que um limiar, descarte-o.
4. Se a distância for maior que o limiar, mantenha-o. Se a distância for menor que o limiar, descarte-o. Se a distância for maior que o limiar, mantenha-o.
5. O método de partição trata os dois subsegmentos, voltando ao passo 1.

O diagrama abaixo (da wiki) demonstra o processo: os pontos vermelhos são descartados e os pontos verdes são mantidos.

![Simplificando uma curva linear por partes com o algoritmo de Douglas–Peucker.](https://upload.wikimedia.org/wikipedia/commons/3/30/Douglas-Peucker_animated.gif)

É evidente que, quanto maior o limiar (ε) escolhido, menor o número de vértices (n) que restam depois da simplificação final, e menos suave fica a polilinha:

![O efeito de variar epsilon em uma implementação paramétrica do RDP](https://upload.wikimedia.org/wikipedia/commons/6/69/RDP%2C_varying_epsilon.gif)

Há muitas implementações em JS baseadas nesse algoritmo: [simplify-js], [turf-simplify], [geojson-vt] etc. Vamos tomar a implementação do geojson-vt como exemplo:

```ts
export default function simplify(coords, first, last, sqTolerance) {
    let maxSqDist = sqTolerance;
    const mid = (last - first) >> 1;
    let minPosToMid = last - first;
    let index; // index of maximum distance

    const ax = coords[first];
    const ay = coords[first + 1];
    const bx = coords[last];
    const by = coords[last + 1];

    // Find the point with the greatest distance from the line segment
    for (let i = first + 3; i < last; i += 3) {
        const d = getSqSegDist(coords[i], coords[i + 1], ax, ay, bx, by);
        if (d > maxSqDist) {
            index = i;
            maxSqDist = d;
        }
    }

    if (maxSqDist > sqTolerance) {
        // Recursively process the first half of the line segment
        if (index - first > 3) simplify(coords, first, index, sqTolerance);
        // Preserving the maximum distance indicates that this vertex needs to be preserved
        coords[index + 2] = maxSqDist;
        // Half of the line segments after recursive processing
        if (last - index > 3) simplify(coords, index, last, sqTolerance);
    }
}
```

Vamos usar esse método mais adiante em [Lição 25 - Usar polilinha no modo pincel].

## Outras questões {#followup-issues}

Até aqui, concluímos o trabalho básico de desenho das polilinhas. Por fim, vamos olhar outras questões relacionadas. Por limitação de espaço, algumas questões serão detalhadas em lições futuras.

### SizeAttenuation {#size-attenuation}

Em alguns cenários, não queremos que os gráficos mudem de tamanho com o zoom da câmera, como o wireframe da caixa delimitadora e os rótulos de tamanho abaixo dele ao selecionar uma forma no Figma:

![atenuação de tamanho no Figma](/size-attenuation.gif)

Isso se chama `sizeAttenuation` no Three.js. No modo de projeção em perspectiva, os Sprites ficam menores à medida que a profundidade da câmera aumenta. Vamos implementar isso mais adiante, quando implementarmos a UI de seleção.

### Linha, Path e polígono {#line-path-polygon}

No SVG, ainda há três elementos: `<line>`, `<path>` e `<polygon>`, entre os quais:

-   `<line>` não precisa considerar `strokeLinejoin`, então o número de vértices usados pode ser simplificado
-   A parte de preenchimento de `<polygon>` pode ser desenhada depois da triangulação com alguns algoritmos, como o earcut, e a parte do contorno é exatamente igual à da polilinha
-   `<path>` também pode ser amostrado sobre o caminho de forma semelhante a `<rect>` e `<circle>`, e por fim desenhado com polilinhas, mas haverá um problema como este: [Draw arcs, arcs are not smooth ISSUE]

Vamos apresentar em detalhe como desenhá-los na próxima lição.

## Leitura adicional {#extended-reading}

-   [How 2 draw lines in WebGL]
-   [regl-gpu-lines]
-   [Drawing Instanced Lines with regl]
-   [Instanced Line Rendering Part I]
-   [Instanced Line Rendering Part II]
-   [pixijs/graphics-smooth]
-   [Polar Stroking: New Theory and Methods for Stroking Paths]

[Lição 5 - Grade de linhas]: /pt-BR/guide/lesson-005#lines-grid
[lineJoin]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineJoin
[lineCap]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineCap
[lineWidth]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/lineWidth
[points]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/points
[stroke-linejoin]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linejoin
[stroke-linecap]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap
[stroke-dashoffset]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dashoffset
[stroke-dasharray]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray
[Instanced Line Rendering Part I]: https://wwwtyro.net/2019/11/18/instanced-lines.html
[Instanced Line Rendering Part II]: https://wwwtyro.net/2021/10/01/instanced-lines-part-2.html
[LineLayer]: https://deck.gl/docs/api-reference/layers/line-layer
[PathLayer]: https://deck.gl/docs/api-reference/layers/path-layer
[Drawing Antialiased Lines with OpenGL]: https://blog.mapbox.com/drawing-antialiased-lines-with-opengl-8766f34192dc
[regl-gpu-lines]: https://github.com/rreusser/regl-gpu-lines
[instanced example]: https://rreusser.github.io/regl-gpu-lines/docs/instanced.html
[Drawing Instanced Lines with regl]: https://observablehq.com/@rreusser/drawing-instanced-lines-with-regl
[pixijs/graphics-smooth]: https://github.com/pixijs/graphics-smooth
[How 2 draw lines in WebGL]: https://www.khronos.org/assets/uploads/developers/presentations/Crazy_Panda_How_to_draw_lines_in_WebGL.pdf
[desenho instanciado]: /pt-BR/guide/lesson-008#instanced
[antialiasing no SDF]: /pt-BR/guide/lesson-002#antialiasing
[desenho da sombra externa do retângulo]: /pt-BR/guide/lesson-009#drop-shadow
[WebGPU instancing problem]: https://github.com/pixijs/pixijs/issues/7511#issuecomment-2247464973
[spec: It is useful to allow GPUVertexBufferLayout.arrayStride to be less than offset + sizeof(attrib.format)]: https://github.com/gpuweb/gpuweb/issues/2349
[Draw arcs, arcs are not smooth ISSUE]: https://github.com/pixijs/graphics-smooth/issues/23
[SVG aprimorado: alinhamento do traço]: /pt-BR/guide/lesson-010#stroke-alignment
[Calculate bounding box of line with thickness]: https://stackoverflow.com/questions/51210467/calculate-bounding-box-of-line-with-thickness
[cairo-stroke-extents]: https://cairographics.org/manual/cairo-cairo-t.html#cairo-stroke-extents
[cairo-path-extents]: https://cairographics.org/manual/cairo-Paths.html#cairo-path-extents
[Cairo - Fix for round joins]: https://gitlab.freedesktop.org/cairo/cairo/-/merge_requests/372#note_1698225
[Pure WebGL Dashed Line]: https://webgl2fundamentals.org/webgl/lessons/webgl-qna-pure-webgl-dashed-line.html
[How to animate along an SVG path at the same time the path animates?]: https://benfrain.com/how-to-animate-along-an-svg-path-at-the-same-time-the-path-animates/
[Fake instancing]: https://rreusser.github.io/regl-gpu-lines/docs/instanced.html
[Multiple lines]: https://rreusser.github.io/regl-gpu-lines/docs/multiple.html
[Offset in bytes into buffer where the vertex data begins]: https://www.w3.org/TR/webgpu/#dom-gpurendercommandsmixin-setvertexbuffer-slot-buffer-offset-size-offset
[simplify-js]: https://github.com/mourner/simplify-js
[geojson-vt]: https://github.com/mapbox/geojson-vt
[turf-simplify]: https://github.com/Turfjs/turf/tree/master/packages/turf-simplify
[Ramer–Douglas–Peucker algorithm]: https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
[Lição 25 - Usar polilinha no modo pincel]: /pt-BR/guide/lesson-025#use-polyline
[Polar Stroking: New Theory and Methods for Stroking Paths]: https://developer.download.nvidia.com/video/siggraph/2020/presentations/sig03-polar-stroking-new-theory-and-methods-for-stroking-paths.pdf
