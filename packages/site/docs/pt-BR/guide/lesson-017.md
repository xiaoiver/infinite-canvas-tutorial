---
outline: deep
description: 'Implemente gradientes e padrões com a API CanvasGradient, crie gradientes de malha com shaders, incluindo efeitos de ruído, e monte painéis de edição de gradiente. Ofereça suporte à sintaxe de gradiente do CSS e a padrões repetidos.'
head:
    - [
          'meta',
          { property: 'og:title', content: 'Lição 17 - Gradiente e padrão' },
      ]
---

<script setup>
import Gradient from '../../components/Gradient.vue';
import MeshGradient from '../../components/MeshGradient.vue';
import DeclarativeGradient from '../../components/DeclarativeGradient.vue';
import Pattern from '../../components/Pattern.vue';
import Voronoi from '../../components/Voronoi.vue';
import FractalBrownianMotion from '../../components/FractalBrownianMotion.vue';
import DomainWarping from '../../components/DomainWarping.vue';
</script>

# Lição 17 - Gradiente e padrão {#lesson-17-gradient-and-pattern}

Nesta lição, vamos ver como implementar gradientes e padrões repetidos.

-   Usar CanvasGradient para implementar gradientes
    -   Imperativo. Criar texturas com a API Device
    -   Declarativo. Oferece suporte à sintaxe de gradiente do CSS: `linear-gradient`, `radial-gradient`, `conic-gradient`
    -   Usar o Shoelace para implementar o painel de configuração do gradiente
-   Usar Shader para implementar gradiente de malha
    -   Simular aleatoriedade
    -   Ruído de valor e ruído de gradiente
    -   Voronoi, FBM e Domain Warping
-   Exportar SVG
-   Usar CanvasPattern para implementar padrões repetidos

## Usar CanvasGradient {#canvas-gradient}

Dá para usar a API [CanvasGradient] para criar vários efeitos de gradiente, que então podem ser consumidos como texturas. Vamos apresentar implementações imperativa e declarativa.

### Criar texturas de gradiente de forma imperativa {#create-gradient-texture}

Tomando o gradiente linear como exemplo, depois de criar um `<canvas>` e obter o contexto dele, [createLinearGradient] exige pontos inicial e final que definem a direção do gradiente. Em seguida, adicione várias paradas de cor, desenhe no `<canvas>` e use-o como fonte para criar texturas:

```ts
const gradient = ctx.createLinearGradient(0, 0, 1, 0); // x1, y1, x2, y2

gradient.addColorStop(0, 'red');
gradient.addColorStop(1, 'blue');

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 256, 1);
```

Crie um objeto de textura com a API [Device] e, por fim, passe-o à propriedade `fill` da forma para concluir o desenho.

```ts
// 0. Create gradient data
const ramp = generateColorRamp({
    colors: [
        '#FF4818',
        '#F7B74A',
        '#FFF598',
        '#91EABC',
        '#2EA9A1',
        '#206C7C',
    ].reverse(),
    positions: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
});

// 1. Get canvas device
const device = canvas.getDevice();

// 2. Create texture object
const texture = device.createTexture({
    format: Format.U8_RGBA_NORM,
    width: ramp.width,
    height: ramp.height,
    usage: TextureUsage.SAMPLED,
});
texture.setImageData([ramp.data]); // Pass the previously created <canvas> data to texture

// 3. Pass the texture object to the shape's `fill` property
rect.fill = { texture };
```

<Gradient />

Porém, queremos oferecer suporte a uma sintaxe declarativa para melhorar a usabilidade e facilitar a serialização.

### Sintaxe declarativa de gradiente do CSS {#css-gradient-syntax}

Seguindo a sintaxe de gradiente do CSS, dá para usar [gradient-parser] para obter resultados estruturados, que então podem ser usados para chamar APIs como [createLinearGradient]:

```ts
rect.fill = 'linear-gradient(0deg, blue, green 40%, red)';
rect.fill = 'radial-gradient(circle at center, red, blue, green 100%)';
```

No ECS, os nomes das funções de gradiente e as palavras-chave de direção, forma, tamanho e posição não diferenciam maiúsculas de minúsculas. A detecção verifica o nome da função, então uma URL de imagem que contenha `linear` ou `radial` não é tratada como gradiente. Posições com duas palavras-chave, como `top center` e `bottom center`, preservam o eixo vertical. Gradientes radiais circulares também aceitam centros fora dos limites: `closest-side` usa a distância até o lado mais próximo, que permanece não negativa.

O parser aceita gradientes radiais circulares; gradientes elípticos e repetidos ainda não são renderizados. As strings de gradiente cônico usam, por enquanto, o ângulo padrão e a sintaxe de posição `circle at …` já existente; a sintaxe CSS `from … at …` não está implementada. Os valores estruturados de `ConicGradient.angle` estão em graus, com a mesma orientação em preenchimentos comuns e em entradas de filtro.

Os resultados da análise são os seguintes:

```js eval code=false
linearGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient('linear-gradient(0deg, blue, green 40%, red)');
});
```

```js eval code=false
radialGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient(
        'radial-gradient(circle at center, red, blue, green 100%)',
    );
});
```

Há vários tipos comuns de gradiente, e no momento oferecemos suporte aos três primeiros:

-   [linear-gradient] Com suporte no CSS e no Canvas
-   [radial-gradient] Com suporte no CSS e no Canvas
-   [conic-gradient] Com suporte no CSS e no Canvas
-   [repeating-linear-gradient] Com suporte no CSS; pode ser improvisado com o Canvas, veja [How to make a repeating CanvasGradient]
-   [repeating-radial-gradient] Com suporte no CSS
-   [sweep-gradient] Com suporte no CanvasKit / Skia

<DeclarativeGradient />

Além disso, oferecemos suporte à sobreposição de vários gradientes, por exemplo:

```ts
rect.fill = `linear-gradient(217deg, rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%),
    linear-gradient(127deg, rgba(0,255,0,.8), rgba(0,255,0,0) 70.71%),
    linear-gradient(336deg, rgba(0,0,255,.8), rgba(0,0,255,0) 70.71%)`;
```

### Painel de edição de gradiente {#gradient-editor}

Inspirados pelo painel de edição de gradiente do Figma, implementamos um editor parecido. Você pode abrir o painel de edição selecionando uma forma no exemplo acima.

![Painel de gradiente do Figma](/figma-gradient-panel.png)

## Aplicar gradientes ao preenchimento e ao traço {#applying-gradients-to-fill-and-stroke}

Gradientes de preenchimento são consumidos por draw calls como `SDF` e `Mesh`, enquanto gradientes de traço são consumidos por `SmoothPolyline`. Depois que o gradiente é rasterizado em uma textura, a questão que resta é como calcular os UVs no vertex shader.

Para preenchimentos de malha, o vertex shader usa **`u_FillUVRect`** (`minX`, `minY`, `1/width`, `1/height`) para mapear **coordenadas locais da geometria** para o espaço da textura.

Para traços, o vertex shader já tem **`pos`** no **espaço de mundo** depois da matriz de modelo: o ponto expandido na faixa do traço. Para alinhar com **`ComputedBounds.geometryBounds`**, transformamos de volta para o **espaço local**, subtraímos `min` e multiplicamos pelo inverso da extensão:

`local = inverse(model) * vec3(pos, 1.0)`, e então `v_StrokeUv = (local.xy - u_StrokeUVRect.xy) * u_StrokeUVRect.zw`.

No caminho **WebGPU**, quando o GLSL é rebaixado para WGSL por meio do **naga**, **`inverse(mat3)` não tem suporte**, então a implementação usa um **`inverseMat3`** escrito à mão (adjunta / determinante) no lugar do `inverse` embutido.

## Implementar gradientes com malha {#mesh-gradient}

O parser de gradiente de malha do ECS preserva posições explícitas dos pontos. Controles opcionais de tipo, warp e tempo podem ser serializados e analisados de novo. Em modos que usam uma quantidade variável de pontos, `points(10)` preserva o décimo slot do shader; o modo de malha fixa (`gtype(2)`) continua usando a grade 3×3. Os dados de uniform empacotados usam 92 floats em um buffer de 96 floats, incluindo o padding de alinhamento.

Os gradientes implementados com base em Canvas e SVG têm expressividade limitada e não conseguem exibir efeitos complexos. Algumas ferramentas de design, como Sketch / Figma, têm muitas implementações baseadas em Mesh nas comunidades, por exemplo:

-   [Mesh gradients plugin for Sketch]
-   [Mesh Gradient plugin for Figma]
-   [Photo gradient plugin for Figma]
-   [Noise & Texture plugin for Figma]

Consultamos algumas implementações de código aberto, algumas feitas no Vertex Shader e outras no Fragment Shader. Escolhemos a segunda:

-   [meshgradient]
-   [Mesh gradient generator]
-   [react-mesh-gradient]

<MeshGradient />

Por causa da compatibilidade com a sintaxe GLSL100 do WebGL1, precisamos evitar o uso de `switch`. Caso contrário, recebemos erros como:

> [!CAUTION]
> ERROR: 0:78: 'switch' : Illegal use of reserved word

Além disso, em loops `for`, não dá para usar Uniform como condição de término de `index`:

> [!CAUTION]
> ERROR: 0:87: 'i' : Loop index cannot be compared with non-constant expression

Portanto, só dá para usar a constante `MAX_POINTS` para limitar as iterações do loop, de forma parecida com o tratamento de fontes de luz nos chunks do Three.js:

```glsl
#define MAX_POINTS 10

for (int i = 0; i < MAX_POINTS; i++) {
    if (i < int(u_PointsNum)) {
        // ...
    }
}
```

Agora vamos entrar nos detalhes dos Shaders. Você pode consultar [The Book of Shaders - Generative Design] para saber mais.

### Aleatório {#random}

Para implementar efeitos de ruído, precisamos de uma função aleatória. Porém, o GLSL não tem uma função `random` embutida, então precisamos simular esse comportamento. Como é uma simulação, para o mesmo `random(x)` sempre obtemos o mesmo valor de retorno. Portanto, é um número pseudoaleatório.

Se quisermos uma função `random` que retorne um valor entre 0 e 1, dá para usar `y = fract(sin(x)*1.0);`, que conserva apenas a parte decimal.

![y = fract(sin(x)*1.0)](https://xiaoiver.github.io/assets/img/resized/480/tbs-rand1.png)

Observando essa função, dá para perceber que, se reduzirmos o período até ele ficar extremamente curto, os valores correspondentes ao mesmo x podem ser considerados aproximadamente aleatórios (pseudoaleatórios). O método específico é aumentar o coeficiente, por exemplo `y = fract(sin(x)*10.0);`.

![y = fract(sin(x)*10.0)](https://xiaoiver.github.io/assets/img/resized/480/tbs-rand2.png)

Aumentando ainda mais, até 100000, já não conseguimos distinguir a forma de onda de `sin`. É importante notar de novo que, ao contrário de `Math.random()` no JS, esse método é aleatório determinístico, e a essência dele é, na verdade, uma função de hash.

Precisamos aplicar a função `random` a uma cena 2D, em que a entrada deixa de ser um único `x` e passa a ser uma coordenada `xy`. Precisamos mapear o vetor 2D para um único valor. O The Book of Shaders usa a função embutida `dot` para multiplicar um vetor específico, mas não explica o porquê.

```glsl
float random (vec2 st) {
    return fract(sin(
        dot(st.xy,vec2(12.9898,78.233)))*
        43758.5453123);
}
```

Depois de procurar online, encontramos esta resposta: [What's the origin of this GLSL rand() one-liner?]. Dizem que ela veio originalmente de um artigo, e não há explicação para a escolha dos três números mágicos. De qualquer forma, o efeito gerado é bom, parecido com o chuvisco de uma TV em preto e branco. Dá para ver esse efeito aumentando o `NoiseRatio` no exemplo acima.

### Ruído de valor {#value-noise}

Usando a função `random` que definimos, e `floor`, conseguimos uma função em degraus.

```glsl
float i = floor(x);
y = random(i);
```

![degrau](https://xiaoiver.github.io/assets/img/webgl/tbs-noise1.png)

Se quisermos interpolar entre "degraus" adjacentes, dá para usar uma função linear ou uma função de interpolação suave `smoothstep`:

```glsl
float i = floor(x);
float f = fract(x);
y = mix(rand(i), rand(i + 1.0), f);
// y = mix(rand(i), rand(i + 1.0), smoothstep(0.,1.,f));
```

![smoothstep](https://xiaoiver.github.io/assets/img/webgl/tbs-noise2.png)

Em uma dimensão, escolhemos `i+1`, e em duas dimensões dá para escolher os 4 pontos adjacentes. A função de mistura correspondente também precisa ser modificada. A função de mistura do texto original é a forma expandida, um pouco difícil de entender, mas a vantagem é que ela chama `mix` duas vezes a menos.

```glsl
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = smoothstep(0.,1.,f);

    // Mix 4 coorners percentages
    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;

    // It's actually the expanded form below
    return mix( mix( a, b , u.x),
                mix( c, d, u.x), u.y);
}
```

O método acima de gerar ruído é a interpolação entre valores aleatórios, por isso se chama "ruído de valor". Observando com cuidado, dá para perceber que esse método gera resultados com rastros evidentes de blocos, como a parte esquerda do exemplo abaixo.

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/lsf3WH?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

### Ruído de gradiente {#gradient-noise}

> Em 1985, Ken Perlin desenvolveu outro algoritmo de ruído chamado Gradient Noise. Ken resolveu como inserir gradientes aleatórios (gradiente no sentido de inclinação e de transição) em vez de um valor fixo. Esses valores de gradiente vêm de uma função aleatória bidimensional, que retorna uma direção (um vetor no formato vec2) em vez de um único valor (formato float).

O algoritmo específico é o seguinte, e a maior diferença em relação ao ruído de valor é o uso de `dot` para interpolar as quatro direções:

```glsl
float noise( in vec2 st ) {
    vec2 i = floor(st);
    vec2 f = fract(st);

 vec2 u = smoothstep(0., 1., f);

    return mix( mix( dot( random( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ),
                     dot( random( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                mix( dot( random( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ),
                     dot( random( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
}
```

> Para Ken Perlin, o sucesso do algoritmo estava longe de ser suficiente. Ele achava que dava para ser melhor. No Siggraph de 2001, ele mostrou o "simplex noise".

A implementação específica pode ser encontrada em: [2d-snoise-clear], e também existe uma versão 3D.

### Ruído de Voronoi {#voronoi-noise}

Já vimos como dividir o espaço em pequenas áreas de grade na seção "Desenhar padrões". Dá para gerar um ponto característico aleatório para cada grade e, para um fragmento dentro de uma grade, basta calcular a distância mínima até os pontos característicos nas 8 grades adjacentes, o que reduz muito a quantidade de cálculo. Essa é a ideia principal do artigo de Steven Worley.

Os pontos característicos aleatórios usam o método `random` que vimos antes. Como é aleatório determinístico, os pontos característicos dentro de cada grade são fixos.

```glsl
// Divide the grid
vec2 i_st = floor(st);
vec2 f_st = fract(st);
float m_dist = 1.;
// 8 directions
for (int y= -1; y <= 1; y++) {
    for (int x= -1; x <= 1; x++) {
        // Current adjacent grid
        vec2 neighbor = vec2(float(x),float(y));
        // Feature point in adjacent grid
        vec2 point = random2(i_st + neighbor);
        // Distance from fragment to feature point
        vec2 diff = neighbor + point - f_st;
        float dist = length(diff);
        // Save the minimum value
        m_dist = min(m_dist, dist);
    }
}
color += m_dist;
```

<Voronoi />

A implementação de ruído de Voronoi baseada nessa ideia pode ser encontrada em [lygia/generative].

### fBM {#fbm}

Veja [Inigo Quilez's fBM]. O `noise` pode ser ruído de valor ou ruído de gradiente:

> Então vamos usar um fBM (Fractional Brownian Motion) padrão, que é uma soma simples de ondas de ruído com frequências crescentes e amplitudes decrescentes.

O texto original também explica em detalhe o motivo de usar `gain = 0.5`, que corresponde a `H = 1`. `H` reflete a "autossimilaridade" da curva, usada na geração procedural para simular formas naturais como nuvens, montanhas e oceanos:

$$ G=2^{-H} $$

```glsl
const int octaves = 6;
float lacunarity = 2.0;
float gain = 0.5;

float amplitude = 0.5;
float frequency = 1.;

for (int i = 0; i < octaves; i++) {
 y += amplitude * noise(frequency*x);
 frequency *= lacunarity;
 amplitude *= gain;
}
```

<FractalBrownianMotion />

Veja [Inigo Quilez's Domain Warping] e [Mike Bostock's Domain Warping]. Chame `fbm` de forma recursiva:

```glsl
f(p) = fbm( p )
f(p) = fbm( p + fbm( p ) )
f(p) = fbm( p + fbm( p + fbm( p )) )
```

<DomainWarping />

## Implementar padrões {#pattern}

Dá para usar [createPattern] da API Canvas para criar padrões, com suporte à sintaxe a seguir:

```ts
export interface Pattern {
    image: string | CanvasImageSource;
    repetition?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
    transform?: string;
}

rect.fill = {
    image,
    repetition: 'repeat',
};
```

O `transform` baseado em string precisa ser analisado em `mat3` e, em seguida, passado a [setTransform].

<Pattern />

## Exportar gradientes para SVG {#export-gradient-to-svg}

### Gradiente linear {#linear-gradient}

O SVG oferece [linearGradient] e [radialGradient], mas os atributos com suporte são bem diferentes de [CanvasGradient].

### Gradiente cônico {#conic-gradient}

Consulte [SVG angular gradient] para uma implementação aproximada. A abordagem do [CSS conic-gradient() polyfill] é renderizar com Canvas e exportar como dataURL, e então referenciar com `<image>`.

### Sobreposição de vários gradientes {#multiple-gradient-overlay}

Para sobreposições de vários gradientes, na API Canvas dá para definir `fillStyle` várias vezes para sobrepor. No SVG declarativo, dá para usar vários `<feBlend>` para conseguir isso.

## Leitura adicional {#extended-reading}

-   [A flowing WebGL gradient, deconstructed]
-   [Static Mesh Gradient]

[CanvasGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasGradient
[Device]: /reference/canvas#getdevice
[linear-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient
[radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/radial-gradient
[repeating-linear-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-linear-gradient
[repeating-radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-radial-gradient
[conic-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/conic-gradient
[sweep-gradient]: https://stackoverflow.com/questions/44912075/sweep-gradient-what-it-is-and-its-examples
[gradient-parser]: https://github.com/rafaelcaricio/gradient-parser
[Mesh gradients plugin for Sketch]: https://www.meshgradients.com/
[Mesh Gradient plugin for Figma]: https://www.figma.com/community/plugin/958202093377483021/mesh-gradient
[Photo gradient plugin for Figma]: https://www.figma.com/community/plugin/1438020299097238961/photo-gradient
[Noise & Texture plugin for Figma]: https://www.figma.com/community/plugin/1138854718618193875
[meshgradient]: https://meshgradient.com/
[Mesh gradient generator]: https://kevingrajeda.github.io/meshGradient/
[react-mesh-gradient]: https://github.com/JohnnyLeek1/React-Mesh-Gradient
[Inigo Quilez's fBM]: https://iquilezles.org/articles/fbm/
[Inigo Quilez's Domain Warping]: https://iquilezles.org/articles/warp/
[Mike Bostock's Domain Warping]: https://observablehq.com/@mbostock/domain-warping
[linearGradient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/linearGradient
[radialGradient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/radialGradient
[createLinearGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient
[SVG angular gradient]: https://stackoverflow.com/questions/2465405/svg-angular-gradient
[How to make a repeating CanvasGradient]: https://stackoverflow.com/questions/56398519/how-to-make-a-repeating-canvasgradient
[CSS conic-gradient() polyfill]: https://projects.verou.me/conic-gradient/
[createPattern]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createPattern
[setTransform]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasPattern/setTransform
[What's the origin of this GLSL rand() one-liner?]: https://stackoverflow.com/questions/12964279/whats-the-origin-of-this-glsl-rand-one-liner
[The Book of Shaders - Generative Design]: https://thebookofshaders.com/10/
[2d-snoise-clear]: https://thebookofshaders.com/edit.php#11/2d-snoise-clear.frag
[lygia/generative]: https://lygia.xyz/generative
[A flowing WebGL gradient, deconstructed]: https://alexharri.com/blog/webgl-gradients
[Static Mesh Gradient]: https://shaders.paper.design/static-mesh-gradient
