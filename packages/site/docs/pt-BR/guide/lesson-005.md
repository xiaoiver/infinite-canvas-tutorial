---
outline: deep
description: 'Aprenda a desenhar linhas retas com geometria de linha e técnicas no espaço de tela. Implemente padrões de grade e de pontos e adicione a renderização de wireframe para formas geométricas.'
head:
    - ['meta', { property: 'og:title', content: 'Lição 5 - Grade' }]
---
# Lição 5 - Grade {#lesson-5-grid}

Nesta lição, você vai aprender o seguinte:

-   Desenhar linhas retas com geometria de linha ou técnicas no espaço de tela.
-   Desenhar uma grade de pontos.
-   Desenhar wireframe para a geometria.

```js eval code=false
$button = call(() => {
    const $button = document.createElement('button');
    $button.textContent = 'FlyTo origin';
    return $button;
});
```

```js eval code=false
checkboardStyle = Inputs.radio(['none', 'grid', 'dots'], {
    label: 'Checkboard Style',
    value: 'grid',
});
```

```js eval code=false inspector=false
canvas = call(() => {
    const { Canvas } = Lesson5;
    return Utils.createCanvas(Canvas, 400, 400);
});
```

```js eval code=false inspector=false
call(() => {
    const styles = ['none', 'grid', 'dots'];
    canvas.setCheckboardStyle(styles.indexOf(checkboardStyle));
});
```

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson5;

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    const landmark = canvas.camera.createLandmark({
        x: 0,
        y: 0,
        zoom: 1,
        rotation: 0,
    });
    $button.onclick = () => {
        canvas.camera.gotoLandmark(landmark, {
            duration: 1000,
            easing: 'ease',
        });
    };

    return canvas.getDOM();
})();
```

No Figma e no FigJam, as grades aparecem ao ampliar o zoom até certo nível: o primeiro as exibe como linhas e o segundo, como pontos.

![grade do FigJam](/figjam-grid.png)

O Miro permite alternar entre linhas e pontos:

![grade do Miro](/miro-grid.png)

Vamos começar pela grade de linhas.

## Grade de linhas {#lines-grid}

Em primeiro lugar, a grade não deve fazer parte do grafo de cena. Não queremos que a grade aumente e diminua conforme o zoom da tela. Queremos, porém, que ela tenha um efeito de aparecimento e desaparecimento gradual conforme o zoom acontece. Por isso, primeiro renderizamos a grade no hook `beginFrame`, passando as informações necessárias da cena, como a câmera:

```ts
hooks.initAsync.tapPromise(async () => {
    this.#grid = new Grid();
});
hooks.beginFrame.tap(() => {
    this.#grid.render(
        this.#device,
        this.#renderPass,
        this.#uniformBuffer,
        camera,
    );
});
```

### Geometria de linha {#line-geometry}

A abordagem mais direta é parecida com a de [GridHelper - Three.js], em que um conjunto de linhas é criado com base no tamanho da grade:

```ts
// https://github.com/mrdoob/three.js/blob/master/src/helpers/GridHelper.js#L25-L37
for (var i = 0, j = 0, k = -halfSize; i <= divisions; i++, k += step) {
    vertices.push(-halfSize, 0, k, halfSize, 0, k);
    vertices.push(k, 0, -halfSize, k, 0, halfSize);
}

var geometry = new BufferGeometry();
geometry.addAttribute('position', new Float32BufferAttribute(vertices, 3));
geometry.addAttribute('color', new Float32BufferAttribute(colors, 3));

var material = new LineBasicMaterial({ vertexColors: VertexColors });
LineSegments.call(this, geometry, material);
```

No projeto [thetamath], do CTO do Figma, Evan, a grade também é implementada dessa forma, construindo as linhas necessárias da grade nas direções horizontal e vertical:

```ts
for (let x = left; x < right; x++) {
    const tx = ox + (x * zoom) / step;
    this.strokeLine();
}
for (let y = top; y < bottom; y++) {
    const ty = oy - (y * zoom) / step;
    this.strokeLine();
}
```

Como desenhamos linhas retas em WebGL? Eu já escrevi um texto sobre [Drawing Straight Lines in WebGL (Chinese)]. Em resumo, se não considerarmos as junções, basta estender para fora, dos dois lados, ao longo da direção da normal, usando dois triângulos para desenhar:

![linha extrudada](https://pica.zhimg.com/70/v2-afa28c8cf89369a162816f21b7f53314_1440w.avis?source=172ae18b&biz_tag=Post)

O [thetamath] também usa dois pequenos truques. O primeiro é o uso de [Triangle strip] que, em comparação com `Triangles` comuns, economiza o número de vértices, reduzindo de `3N` para `N + 2`, em que `N` é o número de triângulos:

```ts{5}
this.#pipeline = device.createRenderPipeline({
    inputLayout: this.#inputLayout,
    program: this.#program,
    colorAttachmentFormats: [Format.U8_RGBA_RT],
    topology: PrimitiveTopology.TRIANGLE_STRIP,
});
```

Em segundo lugar, ele armazena a cor em quatro `Bytes`:

```ts
255 | (255 << 8) | (255 << 16) | (127 << 24);
```

Junto com [vertexAttribPointer], ele declara que cada componente é `gl.UNSIGNED_BYTE` e precisa ser normalizado:

```ts{13}
this.#inputLayout = device.createInputLayout({
  vertexBufferDescriptors: [
    {
      arrayStride: 4 * 5,
      stepMode: VertexStepMode.VERTEX,
      attributes: [
        {
          format: Format.F32_RGBA,
          offset: 0,
          shaderLocation: 0,
        },
        {
          format: Format.U8_RGBA_NORM,
          offset: 4 * 4,
          shaderLocation: 1,
        },
      ],
    },
  ],
  indexBufferFormat: null,
  program: this.#program,
});
```

Vamos experimentar:

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson5;
    const canvas = await Utils.createCanvas(Canvas, 400, 400);
    const $canvas = canvas.getDOM();

    canvas.setGridImplementation(0);

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    return $canvas;
})();
```

Nesse método, quanto maior o tamanho da tela e maior a densidade da grade, mais vértices são necessários. Existe uma forma de conseguir isso com menos vértices? Como a grade sempre preenche a tela inteira, isso pode ser feito no espaço de tela?

### Padrões no fragment shader {#patterns-in-fragment-shader}

Como diz [Building Flexible and Powerful Cross-Sections with GridPaper and WebGL]:

> Em vez de renderizar todas essas linhas como geometria, podemos usar um fragment shader de WebGL para gerar as linhas pixel a pixel.

A vantagem de implementar no espaço de tela é que basta um único Quad que preencha a tela, exigindo apenas quatro vértices, nos quais são passadas coordenadas do sistema de coordenadas de recorte. Também é possível usar um triângulo de tela cheia, que precisa de apenas três vértices. Essa abordagem é bem comum em pós-processamento:

```ts
this.appendVertex(-1, -1);
this.appendVertex(-1, 1);
this.appendVertex(1, -1);
this.appendVertex(1, 1);
```

Desse modo, no vertex shader, você pode usá-los diretamente, sem nenhuma transformação:

```glsl
layout(location = 0) in vec4 a_Position;
void main() {
  gl_Position = vec4(a_Position.xy, 0, 1);
}
```

Para desenhar a grade no fragment shader, você vai precisar das coordenadas dos pixels no sistema de coordenadas do mundo. Portanto, usando a inversa da matriz de transformação de projeção da câmera, é possível converter as coordenadas do sistema de coordenadas de recorte para o sistema de coordenadas do mundo:

```glsl{4}
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
};

out vec2 v_Position;

vec2 project_clipspace_to_world(vec2 p) {
  return (u_ViewProjectionInvMatrix * vec3(p, 1.0)).xy;
}

void main() {
  v_Position = project_clipspace_to_world(a_Position.xy);
}
```

Em Canvas2D e SVG, as grades costumam ser implementadas com Patterns. A ideia básica de implementar isso com um fragment shader também é parecida: usar a função nativa `fract` para desenhar um padrão. Ao escalar o espaço de coordenadas inicial por um fator n e então usar `fract` para obter a parte fracionária, você só precisa considerar um pequeno bloco com intervalo de coordenadas `0-1`. Para mais informações, consulte [the book of shaders - Patterns].

![padrões](https://pic4.zhimg.com/80/v2-1f7b0bc49eefe692f5a3c5935725feef_1440w.webp)

O código a seguir vem do [Anti-Aliased Grid Shader] de Evan:

```ts
vec4 render_grid_checkerboard(vec2 coord) {
  // Compute anti-aliased world-space grid lines
  vec2 grid = abs(fract(coord / gridSize - 0.5) - 0.5) / fwidth(coord) * gridSize;
  float line = min(grid.x, grid.y);
  float alpha = 1.0 - min(line, 1.0);
}
```

Queremos desenhar dois conjuntos de grades com espessuras diferentes, em que o espaçamento da grade fina é `1/5` da grade grossa. Ao mesmo tempo, verificamos se o pixel atual está mais perto da grade grossa:

```glsl
vec2 size = scale_grid_size(u_ZoomScale);
float gridSize1 = size.x;
float gridSize2 = gridSize1 / 5.0;
```

### Grade baseada em textura {#texture-based}

[The Best Darn Grid Shader (Yet)] descreve outro esquema baseado em textura. Especialmente quando queremos que as próprias linhas tenham perspectiva, esse esquema funciona melhor do que uma grade de largura fixa no espaço de tela. Por exemplo, na imagem abaixo, há um nítido fenômeno de “moiré” no lado direito, enquanto a cor das linhas mais à esquerda fica mais fina e mais escura.

![grade por textura versus grade por linhas](https://miro.medium.com/v2/resize:fit:1360/format:webp/1*P4a5_Z1u5WXOQWpVglPb2g.png)

No artigo original, o autor fez uma série de melhorias na espessura em perspectiva, atenuou os padrões “moire”, entre outras coisas. Exemplos no Shadertoy aparecem abaixo:

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/mdVfWw?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

## Grade de pontos {#dots-grid}

Para uma grade de pontos, ainda optamos por tratá-la no fragment shader, no espaço de tela. Embora seja possível desenhar círculos com o método de campo de distância com sinal (Signed Distance Field, SDF) que discutimos antes, isso exigiria um grande número de vértices. Por isso, continuamos reutilizando o padrão das grades de linhas retas; aqui, porém, usamos SDF para determinar se um pixel está dentro de um círculo, um método que já vimos na segunda lição:

```glsl
vec2 grid2 = abs(fract(coord / gridSize2 - 0.5) - 0.5) / fwidth(coord) * gridSize2;
alpha = 1.0 - smoothstep(0.0, 1.0, length(grid2) - BASE_DOT_SIZE * u_ZoomScale / zoomStep);
```

Para permitir a alternância entre grades de linhas retas e grades de pontos, podemos introduzir uma nova variável uniform para diferenciar os estilos de grade.

```glsl{6}
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
  float u_ZoomScale;
  float u_CheckboardStyle;
};
```

Agora podemos desenhar grades diferentes no fragment shader desta forma:

```glsl
const int CHECKERBOARD_STYLE_NONE = 0;
const int CHECKERBOARD_STYLE_GRID = 1;
const int CHECKERBOARD_STYLE_DOTS = 2;

vec4 render_grid_checkerboard(vec2 coord) {
  int checkboardStyle = int(floor(u_CheckboardStyle + 0.5));
  if (checkboardStyle == CHECKERBOARD_STYLE_GRID) {
    // lines grid
  } else if (checkboardStyle == CHECKERBOARD_STYLE_DOTS) {
    // dots grid
  }
}
```

Você pode voltar ao exemplo no início da página e alternar entre os diferentes estilos de grade.

Por fim, há um exemplo interessante que incorpora interação com o mouse: [How to Code a Subtle Shader Background Effect with React Three Fiber]

<video autoplay="" controls="" loop="" muted="" src="https://codrops-1f606.kxcdn.com/codrops/wp-content/uploads/2024/10/shaderbackground.mp4?x39556" playsinline=""></video>

## Ajuste de brilho {#adjusting-brightness}

Nos shaders usados no Figma / FigJam, o brilho das cores também é calculado e, com base nos valores de brilho, as cores são ajustadas. Especificamente, emprega-se um algoritmo de ajuste de cor baseado em brilho, pensado para melhorar o apelo visual das cores, tornando texto ou gráficos mais claramente visíveis sobre fundos mais claros.

Foi definido um vetor de pesos `weights`, com pesos definidos de acordo com as características não lineares da percepção de brilho do olho humano para cores diferentes. Isso é comumente usado para calcular valores de brilho no espaço de cor RGB.

```glsl{2}
vec3 gridColor; // Store the final adjusted color value
vec3 weights = vec3(0.299, 0.587, 0.114);
float c2 = dot(rgb * rgb, weights); // Calculate weighted sum of squares of RGB, c2 is an estimate of color brightness
float luminance = sqrt(c2);
```

Se o valor de brilho for maior que 0,5, isso indica que a própria cor já é bastante clara. O código calcula um fator de ajuste target e o usa para modificar o valor de cor rgb, deixando a cor um pouco mais escura. Essa mudança garante que a cor seja mais fácil de observar sobre um fundo claro. Se o valor de brilho não for maior que 0,5, a própria cor é comparativamente escura, e o código adota outra estratégia para ajustar a cor.

Primeiro, ele calcula um novo valor alvo de brilho, target, e então usa a função `mix` para misturar a cor rgb com o branco puro `vec3(1)`, com base nos resultados do cálculo de `b` e `a`. A proporção final da mistura de cores é determinada pela relação de `b` com `a`. Aqui, `a` e `b` são calculados a partir do valor de brilho da cor original e servem para controlar o processo de ajuste da cor.

```glsl
if (luminance > 0.5) {
    float target = (luminance - 0.05) / luminance;
    gridColor = rgb * target;
}
else {
    float target = luminance * 0.8 + 0.15;
    float c1 = dot(rgb, weights);
    float a = 1.0 - 2.0 * c1 + c2;
    float b = c2 - c1;
    gridColor = mix(rgb, vec3(1), (b + sqrt(b * b - a * (c2 - target * target))) / a);
}
rgb = mix(rgb, gridColor, gridWeight);
```

## Desenhar wireframe {#wireframe}

Desenhar wireframe também usa técnicas parecidas, que podem servir para depurar geometrias complexas, como [Desenhar polilinha].

### Coordenadas baricêntricas {#barycentric-coordinates}

A ideia é, na verdade, bem simples. Queremos desenhar o wireframe em cada triângulo durante a rasterização, então precisamos saber a que distância o fragmento atual está dos três lados do triângulo. Quando essa distância for menor que a largura da borda, colorimos o fragmento atual com a cor da borda. A chave, portanto, é como calcular a distância do fragmento aos três lados do triângulo. Podemos usar coordenadas baricêntricas. Como só nos importa o triângulo em que o fragmento atual está, podemos usar as coordenadas baricêntricas dos três vértices para construir um sistema de coordenadas baricêntricas e, então, usar a interpolação do fragment shader para obter as coordenadas baricêntricas do fragmento atual.

Na verdade, o pipeline de renderização também usa coordenadas baricêntricas como pesos para determinar a cor do fragmento, como mostra a figura abaixo. Você pode continuar lendo o artigo sobre a implementação da rasterização no scratchapixel: [Rasterization].

![baricêntricas](https://www.scratchapixel.com/images/rasterization/barycentric2.png)

Vamos ver a implementação específica. Primeiro, passe as coordenadas baricêntricas para os vértices. Precisamos garantir que as coordenadas dos três vértices do triângulo sejam `(1,0,0)`, `(0,1,0)` e `(0,0,1)`. Se você estiver usando `gl.drawArrays()` durante o desenho, basta passar as coordenadas dos três vértices em ordem e repeti-las várias vezes (o número de triângulos), por exemplo:

```glsl
layout(location = BARYCENTRIC) in vec3 a_Barycentric;
out vec3 v_Barycentric;

void main() {
  v_Barycentric = a_Barycentric;
}
```

Então, no fragment shader, quando qualquer componente das coordenadas baricêntricas for menor que o limiar da largura da borda, pode ser considerado uma borda. Aqui são usadas as funções nativas de GLSL `any()` e `lessThan()`:

```glsl
in vec3 v_Barycentric;
void main() {
  // less than border width
  if (any(lessThan(v_Barycentric, vec3(0.1)))) {
    // border color
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    // fill background color
    gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0);
  }
}
```

E, como no exemplo anterior de desenhar grades de linhas retas, queremos que a largura da linha permaneça constante independentemente do zoom da câmera, então continuamos usando `fwidth()`:

```glsl
float edgeFactor() {
  vec3 d = fwidth(v_Barycentric);
  vec3 a3 = smoothstep(vec3(0.0), d * u_WireframeLineWidth, v_Barycentric);
  return min(min(a3.x, a3.y), a3.z);
}
```

### Realocar dados de vértice {#reallocate-vertex-data}

No exemplo anterior, usamos `gl.drawArrays()` durante o desenho, mas, se usarmos `gl.drawElements()`, que é mais econômico em espaço, isto é, compartilhando alguns vértices (por exemplo, um plano usa apenas 4 em vez de 6 vértices), não podemos simplesmente alocar coordenadas baricêntricas com base na ordem dos vértices: precisamos alocá-las com base no índice do vértice. Porém, nem todos os métodos de alocação são tão simples. Por exemplo, no problema do Stack Overflow [Issue with Barycentric coordinates when using shared vertices], você vai ver que o `?` não pode ser alocado. A razão fundamental é que, no caso de vértices compartilhados, uma vez alocadas as coordenadas baricêntricas de um triângulo, a coordenada do vértice restante do triângulo seguinte que compartilha o mesmo lado já está, na prática, determinada:

![não há coordenada baricêntrica para o ponto de interrogação](https://pica.zhimg.com/v2-30c2f4ab848d5f0cfcf8f6934b030298_b.jpg)

Portanto, quando o wireframe está ativado, os índices reutilizados precisam ser expandidos. Por exemplo, os 6 vértices originais que usam 4 índices `[0, 1, 2, 0, 2, 3]` são expandidos para `[0, 1, 2, 3, 4, 5]`, e os dados no array de vértices precisam ser realocados.

```ts
let cursor = 0;
const uniqueIndices = new Uint32Array(indiceNum); // Reallocate indices
for (let i = 0; i < indiceNum; i++) {
    const ii = this.#indexBufferData[i];
    for (let j = 0; j < bufferDatas.length; j++) {
        const { arrayStride } = this.#vertexBufferDescriptors[j];
        const size = arrayStride / 4;
        for (let k = 0; k < size; k++) {
            bufferDatas[j][cursor * size + k] =
                originalVertexBuffers[j][ii * size + k]; // Reallocate vertex data
        }
    }
    uniqueIndices[i] = cursor;
    cursor++;
}
```

O efeito é o seguinte, e mais métodos de desenho de gráficos serão apresentados depois.

<script setup>
import Wireframe from '../../components/Wireframe.vue'
</script>

<Wireframe />

## Leitura adicional {#extended-reading}

-   [thetamath]
-   [The Best Darn Grid Shader (Yet)]
-   [Drawing Grid in WebGL (Chinese)]
-   [How to Draw Plane Grid Lines with WebGL (Chinese)]
-   [How to Code a Subtle Shader Background Effect with React Three Fiber]
-   [Love, derivatives and loops]

[thetamath]: http://thetamath.com/app/y=x%5E(3)-x
[GridHelper - Three.js]: https://threejs.org/docs/#api/en/helpers/GridHelper
[Drawing Grid in WebGL (Chinese)]: https://zhuanlan.zhihu.com/p/66637363
[How to Draw Plane Grid Lines with WebGL (Chinese)]: https://www.zhihu.com/question/325261675/answer/3149510989
[Drawing Straight Lines in WebGL (Chinese)]: https://zhuanlan.zhihu.com/p/59541559
[Triangle strip]: https://en.wikipedia.org/wiki/Triangle_strip
[Building Flexible and Powerful Cross-Sections with GridPaper and WebGL]: https://medium.com/life-at-propeller/building-flexible-and-powerful-cross-sections-with-gridpaper-and-webgl-c5b3b9929c71
[vertexAttribPointer]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer
[the book of shaders - Patterns]: https://thebookofshaders.com/09/?lan=ch
[Anti-Aliased Grid Shader]: https://madebyevan.com/shaders/grid/
[The Best Darn Grid Shader (Yet)]: https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8
[Desenhar polilinha]: /pt-BR/guide/lesson-012
[Rasterization]: https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/rasterization-stage.html
[Issue with Barycentric coordinates when using shared vertices]: https://stackoverflow.com/questions/24839857/wireframe-shader-issue-with-barycentric-coordinates-when-using-shared-vertices
[How to Code a Subtle Shader Background Effect with React Three Fiber]: https://tympanus.net/codrops/2024/10/31/how-to-code-a-subtle-shader-background-effect-with-react-three-fiber/
[Love, derivatives and loops]: https://medium.com/@akella/love-derivatives-and-loops-f4a0da6e2458
