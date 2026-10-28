---
outline: deep
description: 'Aprenda a adicionar formas à tela e a desenhar um círculo usando SDF (campo de distância com sinal). Aborda técnicas de antialiasing e o padrão de projeto flag suja para otimização de desempenho.'
head:
    - ['meta', { property: 'og:title', content: 'Lição 2 - Desenhar um círculo' }]
---
# Lição 2 - Desenhar um círculo {#lesson-2-draw-a-circle}

Nesta lição, você vai aprender o seguinte:

-   Adicionar formas à tela
-   Desenhar um círculo usando SDF
-   Antialiasing
-   Padrão de projeto flag suja

Quando você iniciar o projeto, verá um círculo desenhado na tela e poderá modificar a largura e a altura ou alternar o renderizador WebGL / WebGPU.

```js eval code=false
width = Inputs.range([50, 300], { label: 'width', value: 100, step: 1 });
```

```js eval code=false
height = Inputs.range([50, 300], { label: 'height', value: 100, step: 1 });
```

```js eval code=false
renderer = Inputs.select(['webgl', 'webgpu'], { label: 'renderer' });
```

```js eval code=false inspector=false
canvas = (async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 100, 100, renderer);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 3,
    });
    canvas.appendChild(circle);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    return canvas;
})();
```

```js eval code=false inspector=false
call(() => {
    Utils.resizeCanvas(canvas, width, height);
});
```

```js eval code=false
call(() => {
    return canvas.getDOM();
});
```

## Adicionar formas à tela {#adding-shapes-to-canvas}

Na última lição, criamos uma tela em branco à qual vamos, em seguida, adicionar vários gráficos. Como projetar uma API assim? Como desenvolvedor front-end, você pode querer desenhar com o familiar [appendChild da API Node]:

```ts
canvas.appendChild(shape);
canvas.removeChild(shape);
```

Crie temporariamente uma classe base gráfica, que será herdada por Circle, Ellipse, Rect e assim por diante:

```ts
export abstract class Shape {}
```

Use um array para armazenar uma lista de formas na tela:

```ts
#shapes: Shape[] = [];

appendChild(shape: Shape) {
  this.#shapes.push(shape);
}

removeChild(shape: Shape) {
  const index = this.#shapes.indexOf(shape);
  if (index !== -1) {
    this.#shapes.splice(index, 1);
  }
}
```

Percorra a lista de formas no método de renderização da tela e chame o hook de renderização:

```ts{4}
render() {
  const { hooks } = this.#pluginContext;
  hooks.beginFrame.call();
  this.#shapes.forEach((shape) => {
    hooks.render.call(shape);
  });
  hooks.endFrame.call();
}
```

No plugin de renderização, um `RenderPass` é criado antes do início de cada quadro. Ele é encapsulado na camada de abstração de hardware. Não existe esse conceito no WebGL, mas no WebGPU [beginRenderPass] retorna um [GPURenderPassEncoder], que registra uma série de comandos, incluindo comandos `draw`, como veremos mais adiante no hook `render`. Ao criar o `RenderPass`, fornecemos os seguintes parâmetros:

-   `colorAttachment`
-   `colorResolveTo`
-   `colorClearColor` Isso é implementado no WebGL com o comando [gl.clearColor]; no WebGPU, é declarado com a propriedade [clearValue], que definimos como branco aqui.

```ts{4}
hooks.beginFrame.tap(() => {
  this.#device.beginFrame();

  this.#renderPass = this.#device.createRenderPass({
    colorAttachment: [renderTarget],
    colorResolveTo: [onscreenTexture],
    colorClearColor: [TransparentWhite],
  });
});
```

Correspondendo à criação, enviamos o `RenderPass` no fim de cada quadro. De novo, o método [submit] correspondente é fácil de encontrar no WebGPU, mas, é claro, a API nativa envia um buffer de comandos codificado, e a camada de abstração de hardware simplifica esses conceitos.

```ts{2}
hooks.endFrame.tap(() => {
  this.#device.submitPass(this.#renderPass);
  this.#device.endFrame();
});
```

Por fim, chegamos ao hook `render`, em que cada gráfico é responsável por implementar a lógica para desenhar a si mesmo, e o plugin é responsável por passar os objetos de GPU necessários, como Device e `RenderPass`.

```ts
hooks.render.tap((shape) => {});
```

## Desenhar um círculo {#draw-a-circle}

A primeira coisa que precisamos fazer é definir os atributos básicos de um círculo. Quem estiver familiarizado com o [circle] do SVG saberá que é possível definir a geometria de um círculo a partir do centro, `cx/cy`, e do raio, `r`, e que os atributos genéricos de desenho `fill` e `stroke` atendem às necessidades básicas.

```ts
export class Circle extends Shape {
    constructor(
        config: Partial<{
            cx: number;
            cy: number;
            r: number;
            fill: string;
        }> = {},
    ) {}
}
```

### Coordenadas da tela {#canvas-coordinates}

Já que estamos falando de atributos de posição, como o centro do círculo `cx/cy`, é importante deixar claro o sistema de coordenadas da tela que estamos usando. Tanto no Canvas quanto no SVG, a origem do sistema de coordenadas é o canto superior esquerdo, o eixo X positivo aponta para 👉 e o eixo Y positivo aponta para 👇. Porém, o [sistema de coordenadas de recorte] usado no WebGL segue a especificação OpenGL, com a origem no centro do viewport, o eixo X apontando para 👉, o eixo Y apontando para 👆 e o eixo Z apontando para dentro da tela. O cubo abaixo, que tem uma proporção de aspecto de 2, também é conhecido como coordenadas normalizadas de dispositivo (NDC):

![espaço de recorte](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection/clip_space_graph.svg)

Porém, o WebGPU segue a especificação Metal, que difere do WebGL porque o eixo Y aponta para 👇 e o eixo Z aponta para fora. Também há uma diferença no intervalo de recorte do eixo Z, que é `[-1, 1]` no WebGL e `[0, 1]` no WebGPU:

![Intervalos do espaço de recorte Z no WebGL e no WebGPU](/clip-space-z-range.png)

A nossa camada de abstração de hardware tenta suavizar as diferenças entre WebGL e WebGPU, mas escolhe alinhar-se ao Canvas / SVG quanto ao sistema de coordenadas, o que acreditamos estar mais de acordo com o hábito dos usuários de quadros.

![grade padrão da tela](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_shapes/canvas_default_grid.png)

Assim, se a nossa tela tem largura e altura 200, o `Circle` adicionado da seguinte forma aparece no centro da tela:

```ts
const circle = new Circle({
    cx: 100,
    cy: 100,
    r: 50,
    fill: 'red',
});
canvas.appendChild(circle);
```

A próxima pergunta é como converter `cx/cy` do sistema de coordenadas da tela em NDC para o pipeline de renderização. Vamos passar a largura e a altura da tela como um Uniform, e a posição do círculo como um Attribute. Dividir a posição pela largura e pela altura nos dá um valor no intervalo `[0, 1]`, que é multiplicado por dois e do qual se subtrai um para converter para `[-1, 1]`, o intervalo de valores no NDC. Por fim, invertemos o eixo Y para baixo:

```glsl
layout(std140) uniform SceneUniforms {
  vec2 u_Resolution; // width & height of canvas
};
layout(location = 1) in vec2 a_Position; // cx & cy

// Pixel space to [0, 1] (Screen space)
vec2 zeroToOne = (a_Position + a_Size * a_FragCoord) / u_Resolution;

// Convert from [0, 1] to [0, 2]
vec2 zeroToTwo = zeroToOne * 2.0;

// Convert from [0, 2] to [-1, 1] (NDC/clip space)
vec2 clipSpace = zeroToTwo - 1.0;

// Flip Y axis
gl_Position = vec4(clipSpace * vec2(1, -1), 0.0, 1.0);
```

### Processamento de valores de cor {#processing-color-values}

Ao contrário do Canvas ou do SVG, valores de cor em forma de string não podem ser usados diretamente no WebGL ou no WebGPU, mas o [d3-color] pode convertê-los para o formato `{ r, g, b, opacity }`, que então pode ser passado diretamente ao `attribute` como `vec4` ou comprimido. Por fim, por enquanto só damos suporte a valores de cor no espaço RGB, o que significa que [hsl] e [oklch] não estão disponíveis:

```ts
import * as d3 from 'd3-color';

set fill(fill: string) {
  this.#fill = fill;
  this.#fillRGB = d3.rgb(fill); // { r, g, b, opacity }
}
```

Com a questão de estilo resolvida, voltemos à geometria. Triangle Mesh é uma representação comum de geometria na renderização 3D, e o [CircleGeometry] do Three.js gera a geometria de forma procedural, dividindo o círculo em triângulos a partir do centro. Obviamente, quanto mais triângulos houver, mais suave será o círculo; se houver apenas dois triângulos, ele degenera em um quadrado. Para obter um círculo suave, são necessários mais vértices, o que causa um aumento significativo da memória da GPU à medida que o número de círculos cresce.

![CircleGeometry no Three.js](/circle-geometry.png)

### SDF {#sdf}

São necessários apenas quatro vértices com um método chamado funções de distância com sinal (SDF). O diagrama a seguir visualiza o conceito de SDFs, do artigo prático [drawing-rectangles] do editor emergente Zed. Um ponto no plano é um círculo de raio 100, com distância 0 sobre o círculo, e valores negativos e positivos dentro e fora do círculo, respectivamente:

![Círculo SDF](/sdf.svg)

> O artigo original usa animações Lottie para mostrar a definição de um campo de distância direcionado e a derivação de algumas fórmulas do gráfico subjacente. No GPUI do Zed, o SDF também é usado para desenhar os gráficos subjacentes, em busca de melhor desempenho.

Normalmente, construímos o sistema de coordenadas no Vertex Shader.

```glsl
layout(location = 0) in vec2 a_FragCoord;
out vec2 v_FragCoord;
void main() {
  v_FragCoord = a_FragCoord;
}
```

Com a informação de distância, você pode usar a fórmula SDF de diferentes gráficos no Fragment Shader, trazendo as coordenadas do pixel atual para determinar se o ponto está dentro do gráfico. Se estiver fora, pode ser descartado diretamente; caso contrário, será colorido. O código GLSL é o seguinte. Alguns efeitos não se importam com transparência parcial, mas querem mostrar algo ou nada com base no valor de cor de uma textura. Veja [Descartando fragmentos].

```glsl
float sdf_circle(vec2 p, float r) {
  return length(p) - r;
}

void main() {
  float distance = sdf_circle(v_FragCoord, 1.0);
  if (distance > 0.0) {
    discard;
  }
  outputColor = vec4(1.0, 0.0, 0.0, 1.0);
}
```

Além de usar menos vértices, o SDF oferece as seguintes vantagens:

-   Antialiasing fácil. Vamos tratar disso na próxima subseção.
-   Fácil de combinar. Operações de interseção e diferença podem ser combinadas para completar gráficos complexos.
-   É fácil realizar alguns efeitos de aparência complexa. Por exemplo, traços, cantos arredondados e sombras. É claro que vamos apresentar algumas limitações deste método quando realizarmos esses efeitos.

Uma explicação e uma derivação detalhada do SDF também podem ser encontradas em [distfunctions]. Este método pode ser usado para desenhar uma variedade de formas 2D comuns e até 3D, e continuaremos a usá-lo para desenhar retângulos e texto.

Voltemos à classe base gráfica e adicionemos um método que recebe os parâmetros necessários para desenhar:

```ts{2}
export abstract class Shape {
  abstract render(device: Device, renderPass: RenderPass): void;
}
```

Chamado no hook `render` do plugin, com os parâmetros necessários passados:

```ts
hooks.render.tap((shape) => {
    shape.render(this.#device, this.#renderPass);
});
```

Constrói um sistema de coordenadas unitário no método `render` de `Circle`, consistente com o espaço de recorte, contendo quatro vértices divididos em dois triângulos (V0 -> V1 -> V2 e V0 -> V2 -> V3) pelo array de índices `indexBuffer`:

<img alt="círculo unitário" src="/unit-circle.png" width="300" />

```ts
this.#fragUnitBuffer = device.createBuffer({
    viewOrSize: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]),
    usage: BufferUsage.VERTEX,
});

this.#indexBuffer = device.createBuffer({
    viewOrSize: new Uint32Array([0, 1, 2, 0, 2, 3]),
    usage: BufferUsage.INDEX,
});
```

Cada um desses quatro vértices pode compartilhar os mesmos atributos de estilo, como centro do círculo, raio, cor de preenchimento etc. Isso reduz o tamanho da memória do array de vértices:

```ts
this.#instancedBuffer = device.createBuffer({
    viewOrSize: new Float32Array([
        this.#cx,
        this.#cy,
        this.#r,
        this.#r,
        this.#fillRGB.r / 255,
        this.#fillRGB.g / 255,
        this.#fillRGB.b / 255,
        this.#fillRGB.opacity,
    ]),
    usage: BufferUsage.VERTEX,
});
```

Em seguida, especifique como o array de vértices deve ser disposto, o que se associa ao shader por meio de `shaderLocation`.

```ts
this.#inputLayout = device.createInputLayout({
    vertexBufferDescriptors: [
        {
            arrayStride: 4 * 2,
            stepMode: VertexStepMode.VERTEX,
            attributes: [
                {
                    shaderLocation: 0, // layout(location = 0) in vec2 a_FragCoord;
                    offset: 0,
                    format: Format.F32_RG,
                },
            ],
        },
        {
            arrayStride: 4 * 8,
            stepMode: VertexStepMode.INSTANCE,
            attributes: [
                {
                    shaderLocation: 1, // layout(location = 1) in vec2 a_Position;
                    offset: 0,
                    format: Format.F32_RG,
                },
                {
                    shaderLocation: 2, // layout(location = 2) in vec2 a_Size;
                    offset: 4 * 2,
                    format: Format.F32_RG,
                },
                {
                    shaderLocation: 3, // layout(location = 3) in vec4 a_FillColor;
                    offset: 4 * 4,
                    format: Format.F32_RGBA,
                },
            ],
        },
    ],
    indexBufferFormat: Format.U32_R,
    program: this.#program,
});
```

SDFs também podem ser usados para desenhar elipses, retângulos, texto e assim por diante, mas não vamos adicionar outras formas agora e vamos nos concentrar primeiro em outra questão.

## Antialiasing {#antialiasing}

Se você olhar de perto ou ampliar, verá que as bordas estão claramente serrilhadas. Afinal, no Fragment Shader usamos uma decisão por força bruta para cada ponto de pixel: ou o colorimos, ou o descartamos, sem transição entre os dois.

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
    });
    canvas.appendChild(circle);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

Abaixo, recorremos ao artigo [Bordas suaves de formas SDF] para usar várias abordagens diferentes e comparar os resultados.

### Smoothstep {#smoothstep}

A primeira coisa que vem à mente é que podemos fazer a suavização com a função integrada `smoothstep` de GLSL / WGSL, que gera um valor suavizado para um intervalo especificado de valores, semelhante ao efeito da função de easing `ease-in/out`, em comparação com a função `step`. Você pode visualizar a forma dela modificando os parâmetros em [Smoothstep - thebookofshaders.com], por exemplo na figura a seguir: y é 1 quando x é maior que `0`, y é 0 quando x é menor que `-0.5`, e a área intermediária é suavizada:

<img alt="smoothstep" src="/smoothstep.png" width="300" />

A distância SDF calculada na seção anterior é um valor negativo, e escolhemos um valor fixo menor, `0.01`, para que o intervalo menor de distâncias nas bordas possa ser suavizado, e o valor processado possa ser tratado como transparência.

```glsl
float alpha = smoothstep(0.0, 0.01, -distance);

outputColor = v_FillColor;
outputColor.a *= alpha;
```

O efeito é o seguinte:

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 1,
    });
    canvas.appendChild(circle);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

O problema deste método é que ele aumenta ligeiramente o raio do círculo, afinal é um por cento a mais. Além disso, quando se amplia (falaremos mais sobre recursos relacionados à câmera depois), as bordas não ficam nítidas o bastante.

### Divisão fixa {#divide-fixed}

A função `saturate` não está disponível no GLSL e pode ser implementada com `clamp`:

```glsl
float alpha = clamp(-distance / 0.01, 0.0, 1.0);
```

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 2,
    });
    canvas.appendChild(circle);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

### Derivadas no espaço da tela {#screen-space-derivatives}

O uso de `fwidth` para antialiasing baseado em distância é descrito em [Usando fwidth para anti-aliasing baseado em distância]. O que é `fwidth`?

[O que são derivadas no espaço da tela e quando eu as usaria?] e [O que é fwidth e como ele funciona?] descrevem em detalhe os conceitos e os cálculos do método. Em resumo, o Fragment Shader processa um quad de 2x2 de cada vez, em vez de um único ponto de pixel. O raciocínio da GPU para fazer isso é o seguinte, de [Uma viagem pelo pipeline gráfico de 2011, parte 8]:

> Além disso, este é um bom momento para explicar por que lidamos com quads de 2×2 pixels e não com pixels individuais. O grande motivo são as derivadas. Os amostradores de textura dependem das derivadas no espaço da tela das coordenadas de textura para fazer a seleção e a filtragem do mipmap (como vimos na parte 4); e, a partir do shader model 3.0, o mesmo mecanismo fica disponível diretamente aos pixel shaders na forma de instruções de derivada.

Veja como as derivadas parciais são calculadas em cada quad de 2x2, por exemplo para uv:

![uv fwidth](https://pic2.zhimg.com/80/v2-0f2d0605965ab352aec8826d0eed02dd_1440w.webp)

Para facilitar que os desenvolvedores percebam o quanto o pixel mudou para um dado valor, tanto OpenGL / WebGL quanto WebGPU fornecem os seguintes métodos. Mas o WebGL1 exige habilitar a extensão `GL_OES_standard_derivatives`, enquanto WebGL2 e WebGPU não exigem:

-   `dFdx` calcula o quanto o valor de um atributo de parâmetro mudou ao longo de um pixel na direção horizontal da tela.
-   `dFdy` calcula o quanto o valor de um atributo de parâmetro mudou ao longo de um pixel na direção vertical da tela.
-   `fwidth` calcula `abs(dFdx) + abs(dFdy)`

Portanto, temos duas maneiras de calcular o quanto um parâmetro muda dentro de um pixel. Há diferenças entre elas?

```glsl
pixelSize = fwidth(dist);
/* or */
pixelSize = length(vec2(dFdx(dist), dFdy(dist)));
```

[AAA - Anti-aliasing analítico] aponta que `fwidth` tem menos sobrecarga em comparação com `length` e, embora haja um leve desvio na direção diagonal, ele é quase desprezível no nosso cenário.

> O Fast LAA tem um leve viés nas direções diagonais, fazendo com que formas circulares pareçam muito levemente romboides e tenham uma curvatura um pouco mais acentuada nas direções ortogonais, especialmente quando são pequenas. Às vezes, as bordas nas diagonais também ficam levemente difusas.

Passamos a distância do cálculo SDF e calculamos o quanto ela mudou, para que isso se reflita na transparência.

```glsl
float alpha = clamp(-distance / fwidth(-distance), 0.0, 1.0);
```

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 3,
    });
    canvas.appendChild(circle);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

## Flag suja {#dirty-flag}

Antes, gravávamos os atributos de estilo, como cor de preenchimento e centro do círculo, no array de vértices, então, quando queremos modificar a cor, também precisamos modificar de novo os dados no Buffer. No cenário de modificação contínua do exemplo abaixo, haveria muita sobrecarga desnecessária se a API de baixo nível fosse chamada imediatamente toda vez que uma propriedade fosse modificada.

```ts
circle.fill = 'blue';
circle.fill = 'yellow';
circle.cx = 500;
```

Queremos adiar tarefas demoradas, como modificar dados, e mesclá-las no momento certo, por exemplo antes da renderização, aplicando um padrão de projeto comum chamado "flag suja": [Flag suja - Padrões de programação de jogos]. Ao modificar uma propriedade, simplesmente definimos uma flag suja e não executamos nenhuma outra operação demorada:

```ts{4}
set cx(cx: number) {
  if (this.#cx !== cx) {
    this.#cx = cx;
    this.renderDirtyFlag = true;
  }
}
```

No método `render`, o buffer de baixo nível só é atualizado quando uma modificação de propriedade é detectada, de modo que, não importa quantas vezes uma propriedade seja modificada entre renderizações, o buffer só é atualizado uma vez:

```ts
if (this.renderDirtyFlag) {
    this.#instancedBuffer.setSubData(
        0,
        new Uint8Array(
            new Float32Array([
                this.#cx,
                this.#cy,
                this.#r,
                this.#r,
                this.#fillRGB.r / 255,
                this.#fillRGB.g / 255,
                this.#fillRGB.b / 255,
                this.#fillRGB.opacity,
            ]).buffer,
        ),
    );
}
```

É claro, não se esqueça de redefinir a flag suja quando a renderização terminar:

```ts
this.renderDirtyFlag = false;
```

Experimente o efeito:

```js eval code=false
cx2 = Inputs.range([50, 300], { label: 'cx', value: 100, step: 1 });
```

```js eval code=false
cy2 = Inputs.range([50, 300], { label: 'cy', value: 100, step: 1 });
```

```js eval code=false
r2 = Inputs.range([50, 300], { label: 'r', value: 100, step: 1 });
```

```js eval code=false
fill2 = Inputs.color({ label: 'fill', value: '#ff0000' });
```

```js eval code=false inspector=false
circle = (() => {
    const { Circle } = Lesson2;
    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 3,
    });
    return circle;
})();
```

```js eval code=false inspector=false
(() => {
    circle.cx = cx2;
    circle.cy = cy2;
    circle.r = r2;
    circle.fill = fill2;
})();
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    canvas.appendChild(circle);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

Na introdução posterior aos grafos de cena, também vamos aplicar a flag suja.

## Leitura adicional {#extended-reading}

-   [distfunctions]
-   [Usando Rust e a GPU para renderizar interfaces de usuário a 120 FPS]
-   [Transformada de distância subpixel - renderização de fontes de alta qualidade para WebGPU]
-   [AAA - Anti-aliasing analítico]
-   [Aprenda programação de shaders com Rick and Morty]

[appendChild da API Node]: https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
[GPURenderPassEncoder]: https://developer.mozilla.org/en-US/docs/Web/API/GPURenderPassEncoder
[beginRenderPass]: https://developer.mozilla.org/en-US/docs/Web/API/GPUCommandEncoder/beginRenderPass
[submit]: https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/submit
[circle]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle
[d3-color]: https://github.com/d3/d3-color
[hsl]: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl
[CircleGeometry]: https://threejs.org/docs/#api/en/geometries/CircleGeometry
[drawing-rectangles]: https://zed.dev/blog/videogame#drawing-rectangles
[distfunctions]: https://iquilezles.org/articles/distfunctions/
[Usando Rust e a GPU para renderizar interfaces de usuário a 120 FPS]: https://zed.dev/blog/videogame
[gl.clearColor]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/clearColor
[clearValue]: https://www.w3.org/TR/webgpu/#dom-gpurenderpasscolorattachment-clearvalue
[Usando fwidth para anti-aliasing baseado em distância]: http://www.numb3r23.net/2015/08/17/using-fwidth-for-distance-based-anti-aliasing/
[O que é fwidth e como ele funciona?]: https://computergraphics.stackexchange.com/a/63
[O que são derivadas no espaço da tela e quando eu as usaria?]: https://gamedev.stackexchange.com/questions/130888/what-are-screen-space-derivatives-and-when-would-i-use-them
[Smoothstep - thebookofshaders.com]: https://thebookofshaders.com/glossary/?search=smoothstep
[Bordas suaves de formas SDF]: https://bohdon.com/docs/smooth-sdf-shape-edges/
[Transformada de distância subpixel - renderização de fontes de alta qualidade para WebGPU]: https://acko.net/blog/subpixel-distance-transform/
[Uma viagem pelo pipeline gráfico de 2011, parte 8]: https://fgiesen.wordpress.com/2011/07/10/a-trip-through-the-graphics-pipeline-2011-part-8/
[Descartando fragmentos]: https://learnopengl.com/Advanced-OpenGL/Blending
[AAA - Anti-aliasing analítico]: https://blog.frost.kiwi/analytical-anti-aliasing
[Aprenda programação de shaders com Rick and Morty]: https://danielchasehooper.com/posts/code-animated-rick/
[oklch]: https://github.com/d3/d3-color/issues/87
