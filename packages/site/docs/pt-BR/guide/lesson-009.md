---
outline: deep
description: 'Derive representações SDF para elipses e retângulos arredondados. Aprenda a adicionar sombras projetadas e sombras internas às formas e a implementar testes de ponto dentro da forma para geometrias complexas.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lição 9 - Desenhar elipse e retângulo',
          },
      ]
---
# Lição 9 - Desenhar elipse e retângulo {#lesson-9-drawing-ellipse-and-rectangle}

Nesta lição, você vai aprender o seguinte:

-   Derivar as representações SDF da elipse e do retângulo arredondado
-   Adicionar sombras projetadas e internas ao retângulo arredondado e a outros SDFs
-   Determinar se um ponto qualquer está dentro de uma elipse ou de um retângulo arredondado

Na [Lição 2], usamos SDFs para desenhar círculos, e é fácil estender isso à elipse e ao retângulo. [2D distance functions] oferece mais expressões de SDF para gráficos 2D:

```glsl
float sdf_ellipse(vec2 p, vec2 r) {}
float sdf_rounded_box(vec2 p, vec2 b, vec4 r) {}
```

No Shader, use a variável `shape` para distinguir essas três formas, para podermos desenhá-las com o mesmo conjunto de Shaders:

```glsl
if (shape < 0.5) {
  outerDistance = sdf_circle(v_FragCoord, 1.0);
  innerDistance = sdf_circle(v_FragCoord, r.x);
} else if (shape < 1.5) {
  outerDistance = sdf_ellipse(v_FragCoord, vec2(wh, 1.0));
  innerDistance = sdf_ellipse(v_FragCoord, r);
} else if (shape < 2.5) {
  outerDistance = sdf_rounded_box(v_FragCoord, vec2(wh, 1.0), 0.0);
  innerDistance = sdf_rounded_box(v_FragCoord, r, 0.0);
}
```

Em seguida, vamos ver como o SDF é derivado.

## Retângulo {#rect}

[The SDF of a Box] e [Leveraging Rust and the GPU to render user interfaces at 120 FPS] demonstraram o processo de derivação em forma de vídeos e animações.

Com base na simetria do retângulo, ao colocar o centro na origem, podemos transformar o problema da distância de um ponto qualquer até a borda do retângulo para o primeiro quadrante usando a função `abs()`, em que `p` é a coordenada de um ponto qualquer, `b` é a coordenada do canto superior direito do retângulo e, como o centro coincide com a origem, vale `[width / 2, height / 2]`, e `q` representa o vetor do ponto até o canto superior direito:

```glsl
float sdf_box(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
}
```

![função abs do SDF do retângulo](/rect-sdf-abs.png)

Em seguida, considere o caso em que o ponto está fora do retângulo. Estendendo para fora a partir do canto superior direito do retângulo, a região pode ser dividida em quatro quadrantes. No primeiro quadrante mostrado na figura abaixo, a distância é o comprimento do vetor `q`, `length(q)`. Se o ponto cai no segundo quadrante, a distância é `q.y`, porque `q.x` é negativo e, da mesma forma, se cai no quarto quadrante, a distância é `q.x`.

![SDF do retângulo](/rect-sdf-dist.png)

O autor original usou com habilidade `length(max(q, 0.0))` para unificar esses três casos, usando `max()` para eliminar os componentes negativos e reduzir ao máximo o julgamento de ramificação no Shader. Depois, considere o caso em que o ponto está dentro do retângulo, isto é, no terceiro quadrante da figura acima. Nesse momento, os dois componentes de `q` são negativos, `max(q.x, q.y)` obtém o valor absoluto da distância mais próxima, e o `min()` mais externo unifica o caso em que o ponto está dentro com os três anteriores, ainda para reduzir o julgamento de ramificação. O SDF completo é o seguinte:

```glsl
float sdf_box(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
```

Até aqui, podemos desenhar retângulos e, consultando [SVG \<rect\>], adicionar as propriedades a seguir:

```js
const rect = new Rect({
    x,
    y,
    width,
    height,
    fill,
});
```

### Adicionar cantos arredondados {#rounded-rect}

A figura a seguir vem de [Rounding Corners in SDFs]. Se observarmos o campo de distância visualizado por linhas de contorno, podemos perceber que o próprio retângulo é arredondado. Tomando como exemplo os pontos próximos ao canto superior direito do retângulo, não existe apenas um ponto com a mesma distância: eles se distribuem no círculo que tem o canto superior direito como centro.

![sdf de retângulo arredondado](/rect-sdf-rounded.png)

Na verdade, não só retângulos, mas todos os gráficos representados por SDFs podem ser convertidos em versões “arredondadas”. A figura a seguir vem de [2D distance functions]:

```glsl
float opRound( in vec2 p, in float r ) {
  return sdShape(p) - r;
}
```

![mais formas arredondadas](/shapes-sdf-rounded.png)

Então, a representação SDF completa do retângulo arredondado é a seguinte:

```glsl
float sdf_rounded_box(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
```

Seguindo a nomenclatura do Figma, usamos `cornerRadius`, mas o SDF sozinho não consegue o efeito de `smoothing`. Veja os detalhes em [Adjust corner radius and smoothing] e [Desperately seeking squircles]. Além disso, também é possível oferecer raios de canto diferentes para cada canto; consulte [Zed Blade WGSL], um Shader escrito pelo Zed com base no renderizador [blade], usando a sintaxe WGSL.

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson9');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect } = Lesson9;

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

        for (let i = 0; i < 1000; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;
            const rect = new Rect({
                x: Math.random() * 1000,
                y: Math.random() * 1000,
                fill,
                cornerRadius: 10,
            });
            // rect.x = Math.random() * 1000;
            // rect.y = Math.random() * 1000;
            rect.width = Math.random() * 40;
            rect.height = Math.random() * 40;
            canvas.appendChild(rect);

            rect.addEventListener('pointerenter', () => {
                rect.fill = 'red';
            });
            rect.addEventListener('pointerleave', () => {
                rect.fill = fill;
            });
        }
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### Adicionar sombra projetada {#drop-shadow}

Quando se fala em sombras, você pode ter ouvido falar de [box-shadow] e de `filter: drop-shadow()` no CSS. A figura a seguir vem do artigo [Drop-Shadow: The Underrated CSS Filter], que mostra de forma intuitiva a diferença entre os dois:

![Comparar box-shadow com drop-shadow](https://css-irl.info/drop-shadow-01.jpg)

O segundo costuma ser mais usado, como em [tailwindcss - Drop Shadow]. Então adicionamos as propriedades a seguir ao retângulo:

```ts
rect.dropShadowColor = 'black';
rect.dropShadowOffsetX = 10;
rect.dropShadowOffsetY = 10;
rect.dropShadowBlurRadius = 5;
```

![Sombra projetada no Figma](/figma-drop-shadow.png)

Em seguida, vamos usar WebGL / WebGPU para desenhar sombras de gráficos 2D. A abordagem usual é usar desfoque gaussiano no pós-processamento, como o [DropShadowFilter] do Pixi.js. O efeito de desfoque gaussiano 2D pode ser decomposto em dois efeitos 1D, para processamento horizontal e vertical, mas a operação de convolução ainda exige a amostragem de pixels vizinhos (dependendo do tamanho do núcleo de convolução).

O CTO do Figma, Evan Wallace, apresentou um método de aproximação mais rápido no artigo [Fast Rounded Rectangle Shadows], que não exige amostragem de texturas, e o artigo [Leveraging Rust and the GPU to render user interfaces at 120 FPS] também trouxe uma introdução mais detalhada. A convolução da função gaussiana com a função degrau equivale à integral da função gaussiana, o que resulta na função erro [Error function] (também conhecida como erf). Portanto, gerar um retângulo desfocado equivale a desfocar cada dimensão separadamente e depois tomar a interseção dos dois resultados, sem considerar o raio dos cantos.

Função gaussiana:

$$ f(x) = \frac{\exp(-x^2 / (2 \sigma^2))}{(\sigma \sqrt{2 \pi})} $$

A função erro é a integral de uma função gaussiana, usada para descrever a função de distribuição acumulada de uma distribuição normal.

$$ ∫f(x)dx=F(x) $$

$$ F(x) = \frac{(1 + erf(\frac{x}{\sigma \sqrt2}))}{2} $$

Uma aproximação comum da função erro vem de [Abramowitz and Stegun. Handbook of Mathematical Functions.]

$$ erf(x) ≈ \frac{x}{1 + ax^2 + bx^4 + cx^6 + dx^8 + ex^{10}} $$

em que os coeficientes dos termos do polinômio são:

$$
\displaylines{
a =0.278393, \\
b =0.230389, \\
c =0.000972, \\
d =0.078108, \\
e =2.03380×10^{−4}
}
$$

A implementação a seguir vem de [Zed Blade WGSL], que reescrevemos em GLSL. [Blurred rounded rectangles] também apresenta outra versão da erf.

```glsl
vec2 erf(vec2 x) {
  vec2 s = sign(x), a = abs(x);
  x = 1.0 + (0.278393 + (0.230389 + 0.078108 * (a * a)) * a) * a;
  x *= x;
  return s - s / (x * x);
}
```

Deixe os cantos arredondados de lado por enquanto e calcule o valor final da máscara de sombra. Aqui o limite da sombra é determinado pela diferença entre `integral_x` e `integral_y`. `integral_x.x - integral_x.y` calcula a largura da sombra no eixo x e `integral_y.x - integral_y.y` calcula a altura da sombra no eixo y. Multiplique esses dois valores para obter o valor final da máscara de sombra.

```glsl
// Return the mask for the shadow of a box from lower to upper
float rect_shadow(vec2 pixel_position, vec2 origin, vec2 size, float sigma) {
  vec2 bottom_right = origin + size;
  vec2 x_distance = vec2(pixel_position.x - origin.x, pixel_position.x - bottom_right.x);
  vec2 y_distance = vec2(pixel_position.y - origin.y, pixel_position.y - bottom_right.y);
  vec2 integral_x = 0.5 + 0.5 * erf(x_distance * (sqrt(0.5) / sigma));
  vec2 integral_y = 0.5 + 0.5 * erf(y_distance * (sqrt(0.5) / sigma));
  return (integral_x.x - integral_x.y) * (integral_y.x - integral_y.y);
}
```

Uma solução de forma fechada como a de cima, porém, não existe para a convolução 2D de um retângulo arredondado com uma gaussiana, porque a fórmula de um retângulo arredondado não é separável. A sagacidade da aproximação de Evan Wallace está em fazer uma convolução exata, de forma fechada, ao longo de um eixo e, em seguida, deslizar manualmente a gaussiana ao longo do eixo oposto um número finito de vezes:

```glsl
float blur_along_x(float x, float y, float sigma, float corner, vec2 half_size) {
  float delta = min(half_size.y - corner - abs(y), 0.);
  float curved =
  half_size.x - corner + sqrt(max(0., corner * corner - delta * delta));
  vec2 integral =
  0.5 + 0.5 * erf((x + vec2(-curved, curved)) * (sqrt(0.5) / sigma));
  return integral.y - integral.x;
}
```

```glsl
// The signal is only non-zero in a limited range, so don't waste samples
float low = center_to_point.y - half_size.y;
float high = center_to_point.y + half_size.y;
float start = clamp(-3. * blur_radius, low, high);
float end = clamp(3. * blur_radius, low, high);

// Accumulate samples (we can get away with surprisingly few samples)
float step = (end - start) / 4.;
float y = start + step * 0.5;

for (int i = 0; i < 4; i++) {
  alpha += blur_along_x(center_to_point.x, center_to_point.y - y, blur_radius,
                        cornerRadius, half_size) *
          gaussian(y, blur_radius) * step;
  y += step;
}
```

Na implementação, as sombras precisam ser desenhadas individualmente para cada retângulo, o que quebra o efeito do lote combinado anterior. O motivo é que precisamos seguir uma ordem de desenho estrita, reordenando até mesmo antes de cada redesenho. O código a seguir vem deste artigo: [Fast Rounded Rectangle Shadows]. Antes de desenhar, é preciso ordenar todos os retângulos por uma profundidade predefinida e, então, desenhar as sombras e o corpo em sequência:

```ts
render() {
  boxes.sort(function(a, b) {
    return a.depth - b.depth;
  });
  for (var i = 0; i < boxes.length; i++) {
    boxes[i].callback(); // Draw shadow first and then the rectangle itself.
  }
}
```

Como exemplo, os dois retângulos a seguir são desenhados nesta ordem: sombra do retângulo verde, retângulo verde, sombra do retângulo vermelho, retângulo vermelho. Se seguirmos a ideia anterior de mesclar as duas sombras e os dois corpos dos retângulos em dois lotes separados de desenho, não conseguiremos fazer as sombras dos retângulos vermelhos serem projetadas sobre os retângulos verdes. Então, ao usar, precisamos definir `batchable = false` para os retângulos com sombras

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson9');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect } = Lesson9;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const rect = new Rect({
            x: 50,
            y: 50,
            fill: 'green',
            cornerRadius: 50,
            batchable: false,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            dropShadowBlurRadius: 10,
        });
        rect.width = 400;
        rect.height = 100;
        canvas.appendChild(rect);

        const rect2 = new Rect({
            x: 100,
            y: 100,
            fill: 'red',
            batchable: false,
            cornerRadius: 50,
            dropShadowColor: 'black',
            dropShadowBlurRadius: 10,
        });
        rect2.width = 400;
        rect2.height = 100;
        canvas.appendChild(rect2);
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

Mais um ponto a observar é que, por causa do raio de desfoque da sombra, é preciso fazer o retângulo se expandir para fora do tamanho original, o que aqui é definido como `3 * dropShadowBlurRadius`.

```glsl
float margin = 3.0 * dropShadow.z;
origin += dropShadow.xy;
v_Origin = origin;
v_Size = size;

origin -= margin;
size += 2.0 * margin;
vec2 center = origin + size / 2.0;
v_Point = center + a_FragCoord * (size / 2.0);
```

Por fim, as sombras também afetam o cálculo de `RenderBounds`; caso contrário, os retângulos serão rejeitados incorretamente quando o corpo estiver fora do viewport, mas as sombras estiverem dentro:

```ts
this.renderBounds.addBounds(
    new AABB(
        x + dropShadowOffsetX - dropShadowBlurRadius,
        y + dropShadowOffsetY - dropShadowBlurRadius,
        x + dropShadowOffsetX + width + dropShadowBlurRadius,
        y + dropShadowOffsetY + height + dropShadowBlurRadius,
    ),
);
```

Com base nessa abordagem, também é possível realizar alguns efeitos interessantes; veja: [Shape Lens Blur Effect with SDFs and WebGL].

É evidente que o método acima só funciona para retângulos arredondados, mas existe um método mais geral para círculos, elipses e outras representações SDF? Há um exemplo no Shader toy: [Drop shadow of rounded rect] e, curiosamente, há outro exemplo baseado nesse que permite implementações tanto de sombra externa quanto de sombra interna. Abaixo, nos concentramos na implementação da sombra interna.

### Adicionar sombra interna {#inner-shadow}

A imagem abaixo mostra o efeito de sombra interna do Figma, muito usado em componentes de UI como o Button.

![Sombra interna no Figma](/figma-inner-shadow.png)

Vamos adicionar o atributo a seguir:

```ts
rect.innerShadowColor = 'black';
rect.innerShadowOffsetX = 10;
rect.innerShadowOffsetY = 10;
rect.innerShadowBlurRadius = 5;
```

Consultando o exemplo no Shader toy: [Inner shadow of rounded rect], adicionamos de forma parecida a lógica de desenho de sombra para cada uma das três formas atuais. Usamos `sigmoid` aqui para suavizar:

```glsl
float make_shadow(vec2 pos, vec2 halfSize, float cornerRd, float blurRd, float distMul, float shape) {
  float distance;
  if (shape < 0.5) {
    distance = sdf_circle(pos, halfSize.x);
  } else if (shape < 1.5) {
    distance = sdf_ellipse(pos, halfSize);
  } else if (shape < 2.5) {
    distance = sdf_rounded_box(pos, halfSize, cornerRd + blurRd);
  }
  float dist = sigmoid(distMul * distance / blurRd);
  return clamp(dist, 0.0, 1.0);
}
```

```js eval code=false
$icCanvas4 = call(() => {
    return document.createElement('ic-canvas-lesson9');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect, Circle, Ellipse } = Lesson9;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas4.parentElement.style.position = 'relative';
    $icCanvas4.parentElement.appendChild($stats);

    $icCanvas4.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        for (let i = 0; i < 10; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;

            const rect = new Rect({
                x: Math.random() * 1000,
                y: Math.random() * 1000,
                fill,
                cornerRadius: 50,
                innerShadowColor: 'black',
                innerShadowOffsetX: Math.random() * 20 - 10,
                innerShadowOffsetY: Math.random() * 20 - 10,
                innerShadowBlurRadius: Math.random() * 10,
            });
            rect.width = 200;
            rect.height = 100;
            canvas.appendChild(rect);

            const circle = new Circle({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                r: 100,
                fill,
                innerShadowColor: 'black',
                innerShadowOffsetX: Math.random() * 20 - 10,
                innerShadowOffsetY: Math.random() * 20 - 10,
                innerShadowBlurRadius: Math.random() * 10,
            });
            canvas.appendChild(circle);

            const ellipse = new Ellipse({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                rx: 100,
                ry: 50,
                fill,
                innerShadowColor: 'blue',
                innerShadowOffsetX: Math.random() * 20 - 10,
                innerShadowOffsetY: Math.random() * 20 - 10,
                innerShadowBlurRadius: Math.random() * 10,
            });
            canvas.appendChild(ellipse);
        }
    });

    $icCanvas4.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## Elipse {#ellipse}

Ao contrário de determinar a menor distância de um ponto arbitrário até um círculo, o método exato de analisar uma elipse é bem mais complexo, e [Distance to an ellipse] apresenta dois métodos: a equação quártica e o método de Newton.

### Equação quártica {#quartic-equation}

Uma elipse é representada por $q(\omega) = \{ a⋅cos \omega, b⋅sin \omega \}$, em que o quadrado da distância de um ponto qualquer $p$ até um ponto da elipse é:

$$ s^2(\omega) = \left| q(\omega) - p \right|^2 $$

Desdobrada:

$$ a^2cos^2\omega + b^2sin^2\omega + x^2 + y^2 - 2(axcos \omega - bysin \omega) $$

Derivada em relação a $\omega$:

$$ −2a^2sin\omega ⋅cos\omega + 2b^2cos\omega ⋅sin\omega + 2axsin\omega − 2bycos\omega $$

A derivada no ponto mais próximo é 0, obtida ao introduzir $\lambda=cos\omega$:

$$ \sqrt{1-\lambda^{2}}\left(\left(b^{2}-a^{2}\right) \lambda+a x\right)=b y \lambda $$

Esta é uma equação quártica de uma variável em $\lambda$, com os coeficientes de cada termo:

$$
\displaylines{
  a_4=\left(b^{2}-a^{2}\right)^{2} \\
  a_3=2 a x\left(b^{2}-a^{2}\right) \\
  a_2=\left(a^{2} x^{2}+b^{2} y^{2}\right)-\left(b^{2}-a^{2}\right)^{2} \\
  a_1=-2 a x\left(b^{2}-a^{2}\right) \\
  a_0=-a^{2} x^{2}
}
$$

Para reduzir os coeficientes do termo de quarto grau a 1 e obter [Monic Polynomial], divida cada um dos coeficientes acima por $a_4$, e não se preocupe em dividir por 0, porque se trata de uma elipse. Use também a substituição $m n$:

$$ m=x \frac{a}{b^{2}-a^{2}} \quad n=y \frac{b}{b^{2}-a^{2}} $$

Isso produz [Quartic Equation] com os coeficientes a seguir:

$$
\displaylines{
  a_4=1\\
  a_3=2m \\
  a_2=m^2 + n^2  - 1 \\
  a_1=-2m \\
  a_0=-m^2
}
$$

Como o coeficiente de maior grau é 1, isso pode ser transformado em um problema de resolver uma equação cúbica [Cubic Formula], usando [Resolvent Cubic]:

$$
\displaylines{
f(x)=x^4+a_3x^3+a_2x^2+a_1x+a_0 \\
g(x)=x^3+b_2x^2+b_1x+b_0
}
$$

em que os coeficientes correspondem a:

$$
b_2 = -a_2 \quad
b_1 = a_1a_3-4a_0 \quad
b_0 = 4a_0a_2-a_1^2-a_0a_3^2
$$

A substituição dá:

$$
b_2 = -(m^2+n^2-1) \quad
b_1 = 0 \quad
b_0 = -4m^2n^2
$$

Resolver [Cubic Formula] envolve tentar eliminar os coeficientes binomiais, o que pode ser feito com $z=x-1/3k_2$. Isso produz a forma padrão: $x^3+px=q$, em que:

$$
p = (3k_1-k_2^2)/3 \quad
q = (9k_1k_2-27k_0-2k_2^3)/27
$$

Substituir $b_0 b_1 b_2$ dá:

$$
\displaylines{
p = -(m^2+n^2-1)^2/3 \\
q = 4m^2n^2+2(m^2+n^2-1)^3/27
}
$$

Continuando a simplificar a equação acima, seja:

$$
\displaylines{
Q = (\frac{m^2+n^2-1}{3})^2 \\
R = 2m^2n^2 + (\frac{m^2+n^2-1}{3})^3
}
$$

A forma padronizada passa a ser: $x^3 - 3Qx + 2R = 0$

Esse método tem custo computacional alto, e o exemplo escrito no ShaderToy mostrado em [Distance to an ellipse] tem um FPS bem menor do que os dois métodos descritos abaixo.

### Método de Newton {#newton-method}

O vetor formado por um ponto qualquer $p$ até o ponto mais próximo $q$ na elipse precisa ser perpendicular à tangente à elipse no ponto $q$.

$$ <p-q(\omega), q'(\omega)> = 0 $$

Em que:

$$ q'(\omega) = (-a⋅sin \omega, b⋅cos \omega) $$

A substituição dá:

$$
\displaylines{
  f(\omega) = -a⋅sin \omega ⋅(x-a⋅cos \omega) + b⋅cos \omega ⋅(y-b⋅sin \omega) = 0 \\
  f'(\omega) = -<p-u,v> - <v,v> \\

  u = ( a⋅cos \omega, b⋅sin \omega ) \\
  v = (-a⋅sin \omega, b⋅cos \omega )
}
$$

[Newton's method], que é um método para resolver equações de forma aproximada nos domínios dos números reais e complexos.

$$x_{n+1} =x_n-{\frac {f(x_n)}{f'(x_n)}} $$

A substituição dá:

$$\omega_{n+1} = \omega_n + {\frac {<p-u,v>}{<p-u,u> + <v,v>}} $$

[Distance to an ellipse] O autor original usou 5 iterações para alcançar um resultado muito bom:

```glsl
for (int i=0; i<5; i++) {
  vec2 cs = vec2(cos(w),sin(w));
  vec2 u = ab*vec2( cs.x,cs.y);
  vec2 v = ab*vec2(-cs.y,cs.x);
  w = w + dot(p-u,v)/(dot(p-u,u)+dot(v,v));
}
```

Tudo o que falta abaixo é encontrar $\omega_0$. Ainda usando a simetria e considerando apenas o caso em que o ponto está no primeiro quadrante, primeiro determine se o ponto está dentro da elipse e substitua na equação da elipse:

```glsl
bool s = dot(p/ab,p/ab)>1.0;
```

Se estiver fora da elipse, ela pode ser esticada até virar um círculo (o método descrito na subseção seguinte também será usado), em que $\omega_0 = atan(y / x)$, e depois esticada de volta para a elipse na direção inversa: $\omega_0 = atan(a⋅y / b⋅x)$

Se estiver dentro da elipse, escolha o semieixo maior $0$ ou o eixo menor $\pi/2$ como ponto de partida:

```glsl
float w = s ? atan(p.y*ab.x, p.x*ab.y) :
  ((ab.x*(p.x-ab.x)<ab.y*(p.y-ab.y))? 1.5707963 : 0.0);
```

Em comparação com o método anterior de resolver uma equação quártica de uma variável, este método tem menos custo. Mas, afinal, ele ainda contém um laço for com um número fixo de iterações, que é desenrolado ao compilar GLSL; veja: [Loop performance in a shader].
Por fim, apresentaremos um método de estimativa aproximada com o menor custo.

### Método aproximado de estiramento {#stretch-approximately-method}

[Ellipsoid SDF] descreve esse método de esticar até um círculo unitário e depois recuperar a elipse. Mas como você escolhe os coeficientes de estiramento na recuperação? Se o ponto está no eixo X, o coeficiente é `r.x`, e no eixo Y é `r.y`, e o menor dos dois é escolhido primeiro:

```glsl
float sdf_ellipse_V1( in vec2 p, in vec2 r )
{
  float k1 = length(p/r);
  return (k1-1.0)*min(r.x,r.y);
}
```

A renderização real revela que essa abordagem tem problemas significativos no eixo maior e não se ajusta bem:

![artefato na borda da elipse](/ellipse-approximate-v1.png)

O autor original apresentou uma versão melhorada:

```glsl
float sdf_ellipse_V3( in vec3 p, in vec3 r )
{
  float k1 = length(p/r);
  return length(p)*(1.0-1.0/k1);
}
```

Porém, a renderização real revela que essa abordagem tem um serrilhado significativo nas bordas:

![artefato na borda da elipse](/ellipse-approximate-v3.png)

Por fim, os autores acrescentaram a consideração dos gradientes, que também usamos:

```glsl
float sdf_ellipse_V2( in vec2 p, in vec2 r )
{
  float k1 = length(p/r);
  float k2 = length(p/(r*r));
  return k1*(k1-1.0)/k2;
}
```

Você pode ver que os resultados ficam bem melhores.

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson9');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Ellipse } = Lesson9;

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

        for (let i = 0; i < 1000; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;
            const ellipse = new Ellipse({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                rx: Math.random() * 20,
                ry: Math.random() * 20,
                fill,
            });
            canvas.appendChild(ellipse);
            ellipse.addEventListener('pointerenter', () => {
                ellipse.fill = 'red';
            });
            ellipse.addEventListener('pointerleave', () => {
                ellipse.fill = fill;
            });
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## Picking {#picking}

Atualmente, o nosso plugin de picking usa o [método geométrico], então precisamos implementar métodos de determinação separados para elipses e retângulos arredondados, e mais adiante apresentaremos um método mais geral de picking baseado em GPU com codificação de cor. Nos dois exemplos acima, você pode passar o mouse sobre qualquer forma para experimentar o efeito de picking.

### Elipse {#picking-ellipse}

As decisões de picking da elipse são mais simples; por exemplo, as áreas de preenchimento e de traço são levadas em conta por padrão:

```ts
function isPointInEllipse(
    x: number,
    y: number,
    h: number,
    k: number,
    a: number,
    b: number,
) {
    const dx = x - h;
    const dy = y - k;

    const squaredDistance = (dx * dx) / (a * a) + (dy * dy) / (b * b);

    // Inside ellipse
    return squaredDistance <= 1;
}
```

### Retângulo arredondado {#picking-rounded-rect}

Também é bem simples se os cantos arredondados não forem considerados.

```ts
function isPointInRoundedRectangle(
    x: number,
    y: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r: number,
) {
    // Determine if a point is inside the corners of a rectangle.
    function isInsideCorner(
        x: number,
        y: number,
        cornerX: number,
        cornerY: number,
        r: number,
    ) {
        const distance = Math.sqrt(
            Math.pow(x - cornerX, 2) + Math.pow(y - cornerY, 2),
        );
        return distance <= r;
    }

    // Determine if a point is inside a rounded rectangle
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
        // Points inside the rectangle
        if (
            isInsideCorner(x, y, x1 + r, y1 + r, r) || // top-left
            isInsideCorner(x, y, x2 - r, y1 + r, r) || // top-right
            isInsideCorner(x, y, x2 - r, y2 - r, r) || // bottom-right
            isInsideCorner(x, y, x1 + r, y2 - r, r) // bottom-left
        ) {
            return true; // Points inside the corner
        }
        return !(
            x <= x1 + r ||
            x >= x2 - r || // The point is on the non-circular boundary of the rectangle
            y <= y1 + r ||
            y >= y2 - r
        );
    }
    return false; // Points outside the rectangle
}
```

## Leitura adicional {#extended-reading}

-   [Distance to an ellipse]
-   [Distance from a Point to an Ellipse, an Ellipsoid, or a
    Hyperellipsoid]
-   [Fast Rounded Rectangle Shadows]
-   [Blurred rounded rectangles]
-   [Desperately seeking squircles]

[Lição 2]: /pt-BR/guide/lesson-002
[2D distance functions]: https://iquilezles.org/articles/distfunctions2d/
[Distance to an ellipse]: https://iquilezles.org/articles/ellipsedist/
[Ellipsoid SDF]: https://iquilezles.org/articles/ellipsoids/
[The SDF of a Box]: https://www.youtube.com/watch?v=62-pRVZuS5c&t=18s&ab_channel=InigoQuilez
[Rounding Corners in SDFs]: https://www.youtube.com/watch?v=s5NGeUV2EyU&t=110s
[Leveraging Rust and the GPU to render user interfaces at 120 FPS]: https://zed.dev/blog/videogame
[Blurred rounded rectangles]: https://raphlinus.github.io/graphics/2020/04/21/blurred-rounded-rects.html
[Shape Lens Blur Effect with SDFs and WebGL]: https://tympanus.net/codrops/2024/06/12/shape-lens-blur-effect-with-sdfs-and-webgl/
[Quartic Equation]: https://mathworld.wolfram.com/QuarticEquation.html
[Cubic Formula]: https://mathworld.wolfram.com/CubicFormula.html
[Monic Polynomial]: https://mathworld.wolfram.com/MonicPolynomial.html
[Resolvent Cubic]: https://mathworld.wolfram.com/ResolventCubic.html
[Newton's method]: https://en.wikipedia.org/wiki/Newton%27s_method
[Distance from a Point to an Ellipse, an Ellipsoid, or a Hyperellipsoid]: https://www.geometrictools.com/Documentation/DistancePointEllipseEllipsoid.pdf
[Loop performance in a shader]: https://computergraphics.stackexchange.com/questions/2153/loop-performance-in-a-shader
[SVG \<rect\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/rect
[Adjust corner radius and smoothing]: https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing
[Fast Rounded Rectangle Shadows]: https://madebyevan.com/shaders/fast-rounded-rectangle-shadows/
[DropShadowFilter]: https://pixijs.io/filters/docs/DropShadowFilter.html
[Error function]: https://en.wikipedia.org/wiki/Error_function
[método geométrico]: /pt-BR/guide/lesson-006#geometric-method
[Abramowitz and Stegun. Handbook of Mathematical Functions.]: https://personal.math.ubc.ca/~cbm/aands/page_299.htm
[box-shadow]: https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow
[Zed Blade WGSL]: https://github.com/zed-industries/zed/blob/main/crates/gpui/src/platform/blade/shaders.wgsl
[blade]: https://github.com/kvark/blade
[Drop-Shadow: The Underrated CSS Filter]: https://css-irl.info/drop-shadow-the-underrated-css-filter/
[tailwindcss - Drop Shadow]: https://tailwindcss.com/docs/drop-shadow
[Drop shadow of rounded rect]: https://www.shadertoy.com/view/NtVSW1
[Inner shadow of rounded rect]: https://www.shadertoy.com/view/mssGzn
[Desperately seeking squircles]: https://www.figma.com/blog/desperately-seeking-squircles/
