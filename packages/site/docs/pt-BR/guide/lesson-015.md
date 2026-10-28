---
outline: deep
description: 'Domine a renderização complexa de texto, incluindo TextMetrics, shaping com HarfBuzz, segmentação de texto, suporte a BiDi, geração de atlas SDF e tratamento de emoji para tipografia internacional.'
head:
    - ['meta', { property: 'og:title', content: 'Lição 15 - Renderização de texto' }]
---

<script setup>
import MSDFText from '../../components/MSDFText.vue';
import BitmapFont from '../../components/BitmapFont.vue';
import Emoji from '../../components/Emoji.vue';
import Bidi from '../../components/Bidi.vue';
import TextBaseline2 from '../../components/TextBaseline2.vue';
</script>

# Lição 15 - Renderização de texto {#lesson-15-text-rendering}

A renderização de texto é um processo altamente complexo, e o [State of Text Rendering 2024] oferece uma introdução muito detalhada, cuja leitura é bastante recomendada.

Nesta lição, você vai aprender o seguinte:

-   O que é TextMetrics e como obtê-lo no servidor e no navegador
-   O que é Shaping
-   Segmentação de texto e quebra automática de linha, BiDi e caracteres compostos
-   Como gerar um atlas SDF e usá-lo para desenhar
-   Como tratar emoji

Para desenvolvedores acostumados a usar [Drawing text] do Canvas 2D oferecido pelo navegador, ou SVG, a complexidade da renderização de texto pode superar a sua imaginação. A imagem a seguir, de [Modern text rendering with Linux: Overview], mostra o fluxo de dados da renderização de texto, do texto aos glifos, à rasterização e, por fim, ao desenho na tela. [HarfBuzz], [FreeType], Bidi e OpenType, que é atualmente o formato de fonte mais popular, serão apresentados brevemente mais adiante. Curiosamente, HarfBuzz é o nome persa de "open type".

![O fluxo de dados da renderização de texto](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/overview.svg)

Com base na minha experiência anterior em projetos de visualização na web, [Text rendering in mapbox] pode ser mais instrutivo na prática, pois não vamos lidar diretamente com a maior parte das ferramentas da cadeia mencionada. Ainda assim, entender o máximo possível do processo ajuda você a captar a essência da renderização de texto.

## Shaping {#shaping}

Vamos começar pela nossa entrada: um trecho de texto e uma fonte, fornecida na forma de `fontstack` e, portanto, um array:

```json
{
    "text-field": "Hey",
    "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"]
}
```

::: info pilha de fontes
Uma fontstack é uma lista ordenada formada por uma fonte principal e uma ou mais fontes de fallback opcionais.
<https://docs.mapbox.com/help/troubleshooting/manage-fontstacks/>
:::

O que é Shaping? A imagem a seguir, de [Text rendering in mapbox], em resumo, trata de posicionar cada caractere em sequência, é claro considerando muitas situações, como encontrar quebras de linha:

![shaping de texto](https://cloud.githubusercontent.com/assets/375121/22094138/068c663a-ddc0-11e6-8b70-3866cb8af02a.gif)

A imagem a seguir vem de [Modern text rendering with Linux: Overview]

![HarfBuzz](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/harfbuzz.svg)

Para posicionar os caracteres corretamente, precisamos obter TextMetrics. Mesmo com o posicionamento lado a lado mais simples, precisamos pelo menos saber a largura de cada caractere. Abaixo, vamos nos concentrar em como obtê-lo no navegador.

### TextMetrics {#textmetrics}

A especificação HTML oferece uma definição de [TextMetrics], dividida em conjuntos horizontal e vertical:

```ts
// @see https://html.spec.whatwg.org/multipage/canvas.html#textmetrics
interface TextMetrics {
  // x-direction
  readonly attribute double width; // advance width
  readonly attribute double actualBoundingBoxLeft;
  readonly attribute double actualBoundingBoxRight;

  // y-direction
  readonly attribute double fontBoundingBoxAscent;
  readonly attribute double fontBoundingBoxDescent;
  readonly attribute double actualBoundingBoxAscent;
  readonly attribute double actualBoundingBoxDescent;
  readonly attribute double emHeightAscent;
  readonly attribute double emHeightDescent;
  readonly attribute double hangingBaseline;
  readonly attribute double alphabeticBaseline;
  readonly attribute double ideographicBaseline;
};
```

Vamos nos concentrar primeiro nos três atributos horizontais. A imagem a seguir vem de [Differences between width and actualBoundingBoxLeft(Right)]. Dá para ver que há uma diferença entre `width` e `actualBoundingBoxLeft/Right`. Em resumo, o último representa o limite máximo do caractere (o mesmo vale para `actualBoundingBoxAscent/Descent` na direção vertical), enquanto o primeiro (azul) pode perfeitamente ser menor que a soma do último (vermelho + verde). Por exemplo, o `f` itálico no lado direito da figura: considerando o font-kerning, se o caractere seguinte ainda for `f`, esses dois `f` podem ficar entrelaçados lado a lado.

![width e actualBoundingBoxLeft(Right)](/text-metrics.png)

Vamos olhar os atributos verticais. A imagem a seguir vem de [Meaning of top, ascent, baseline, descent, bottom, and leading in Android's FontMetrics]. Primeiro, encontre `text-baseline`; as propriedades que terminam com `Ascent/Descent` se baseiam nela:

![FontMetrics do Android](/text-metrics2.png)

O valor de `text-baseline` pode se referir a [text-baseline], como mostra a figura abaixo. Por exemplo, ao usar o valor `hanging`, o valor de `hangingBaseline` é `0`, e o valor de `alphabeticBaseline` é a distância de `alphabetic` até `hanging`.

![linha de base do texto](/text-baseline.png)

Por fim, `fontBoundingBoxAscent/Descent` é o limite máximo da própria fonte, e `actualBoundingBoxAscent/Descent` é o limite máximo da fonte quando ela é de fato desenhada. Por isso, o primeiro serve para desenhar um fundo consistente para o texto, que não vai parecer irregularmente alto ou baixo conforme o conteúdo muda.

<TextBaseline2 />

### measureText {#measuretext}

Como obter [TextMetrics]? A API Canvas 2D oferece [measureText], mas, no uso real, é preciso considerar a situação em que só `width` está disponível. Tomando [PIXI.TextMetrics] como exemplo, a implementação leva isso em conta: se `actualBoundingBoxLeft/Right` forem ambos `0`, usa-se `width`:

```ts
let textMetrics = PIXI.TextMetrics.measureText('Your text', style);

// @see https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/CanvasTextMetrics.ts#L334
const metrics = context.measureText(text);
let metricWidth = metrics.width;
const actualBoundingBoxLeft = -metrics.actualBoundingBoxLeft;
const actualBoundingBoxRight = metrics.actualBoundingBoxRight;
let boundsWidth = actualBoundingBoxRight - actualBoundingBoxLeft;
return Math.max(metricWidth, boundsWidth);
```

Para atributos relacionados à fonte, alguns caracteres representativos são escolhidos para garantir que `Ascent/Descent` possam ser medidos e, se não forem obtidos, usa-se o valor de `fontSize` informado manualmente pelo usuário.

```ts
// @see https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/CanvasTextMetrics.ts#L779
context.font = font;
const metrics = context.measureText(
    CanvasTextMetrics.METRICS_STRING + // |ÉqÅ
        CanvasTextMetrics.BASELINE_SYMBOL, // M
);

const properties = {
    ascent: metrics.actualBoundingBoxAscent,
    descent: metrics.actualBoundingBoxDescent,
    fontSize:
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
};

if (fontProperties.fontSize === 0) {
    fontProperties.fontSize = style.fontSize as number;
    fontProperties.ascent = style.fontSize as number;
}
```

Além de usar a API Canvas 2D, há também as seguintes opções no navegador:

-   [opentype.js]
-   o use-gpu usa um [use-gpu-text] baseado em [ab-glyph](https://github.com/alexheretic/ab-glyph)
-   Cada vez mais aplicativos usam [harfbuzzjs]; veja: [State of Text Rendering 2024]

> O uso de HarfBuzz na web vem crescendo, primeiro transpilado para JavaScript e, mais recentemente, compilado de forma cruzada para WebAssembly, por meio do harfbuzzjs. Aplicativos como o Photopea, um editor de fotos online, usam dessa forma. O Crowbar, de Simon Cozens, é um aplicativo web depurador de shaping OpenType, construído com a API de mensagens de buffer do HarfBuzz. O Sploot é outro aplicativo web de Simon, um inspetor de fontes. O Prezi e o [Figma](https://www.figma.com/) também usam HarfBuzz em seus aplicativos web.

Como dito em [What HarfBuzz doesn't do], resolver o problema de medição de caracteres individuais está longe de ser suficiente. Em seguida, consideramos `letterSpacing`.

> O HarfBuzz pode dizer a largura de um trecho de texto já conformado, o que é uma entrada útil para um algoritmo de justificação, mas ele não sabe nada sobre parágrafos, linhas ou comprimentos de linha. Tampouco vai **ajustar o espaço entre as palavras** para encaixá-las proporcionalmente em uma linha.

### letterSpacing {#letterspacing}

A API Canvas 2D oferece [letterSpacing], que pode ser usado para ajustar o espaçamento entre caracteres. Nós o definimos antes de medir o texto:

```ts
measureText(
    text: string,
    letterSpacing: number, // [!code ++]
    context: ICanvasRenderingContext2D
) {
    context.letterSpacing = `${letterSpacing}px`; // [!code ++]
    // Omitted measurement process
}
```

Em seguida, ao dispor a posição de cada caractere, também é preciso considerá-lo, o que apresentaremos em [Gerar quads](#generate-quads).

## Layout de parágrafo {#paragraph-layout}

Caracteres individuais se combinam para formar frases, e as frases formam parágrafos. A imagem a seguir, de [Text layout is a loose hierarchy of segmentation], mostra a estrutura hierárquica do layout de texto de baixo para cima.

![pirâmide de layout](https://raphlinus.github.io/assets/layout_pyramid.svg)

A API Canvas 2D não oferece capacidades relacionadas a parágrafo no desenho de texto, apenas a função mais básica de [Drawing text]. O CanvasKit, baseado no Skia, estendeu isso e oferece adicionalmente um método `drawParagraph`; veja: [CanvasKit Text Shaping]

> Um dos maiores recursos que o CanvasKit oferece em relação à API HTML Canvas é o **shaping de parágrafo**.

```ts
const paragraph = builder.build();
paragraph.layout(290); // width in pixels to use when wrapping text
canvas.drawParagraph(paragraph, 10, 10);
```

Vamos começar pela segmentação de parágrafo.

### Segmentação de parágrafo {#paragraph-segmentation}

A base mais simples de segmentação são as quebras de linha explícitas.

```ts
const newlines: number[] = [
    0x000a, // line feed
    0x000d, // carriage return
];
```

Além disso, a quebra automática de linha também precisa ser considerada. Ao mesmo tempo, faça cada linha ficar o mais próxima possível do mesmo comprimento; veja: [Beautifying map labels with better line breaking]

```ts
const breakingSpaces: number[] = [
    0x0009, // character tabulation
    0x0020, // space
    0x2000, // en quad
    0x2001, // em quad
    0x2002, // en space
    0x2003, // em space
    0x2004, // three-per-em space
    0x2005, // four-per-em space
    0x2006, // six-per-em space
    0x2008, // punctuation space
    0x2009, // thin space
    0x200a, // hair space
    0x205f, // medium mathematical space
    0x3000, // ideographic space
];
```

Em CJK, alguns caracteres não podem aparecer no início de uma linha, e alguns não podem aparecer no fim. Por exemplo, em chinês, a maioria dos sinais de pontuação não pode aparecer no início de uma linha. Para as regras específicas, veja: [Line breaking rules in East Asian languages]. O [pixi-cjk] trata essas situações:

![pixi-cjk](https://github.com/huang-yuwei/pixi-cjk/raw/main/docs/screenshot.png)

Outro cenário comum de quebra automática de linha é quando uma largura máxima é especificada e o texto passa para a linha seguinte se ultrapassar essa largura. Além disso, você pode definir um número máximo de linhas e, quando esse limite é ultrapassado, a propriedade [text-overflow] é aplicada.

```ts
{
    wordWrap: true,
    wordWrapWidth: 100,
    maxLines: 3,
    textOverflow: TextOverflow.ELLIPSIS,
}
```

Podemos nos referir à implementação no Pixi.js: [CanvasTextMetrics]

```ts
for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const prevChar = text[i - 1];
    const nextChar = text[i + 1];
    const charWidth = calcWidth(char);

    if (currentWidth > 0 && currentWidth + charWidth > maxWidth) {
        if (currentIndex + 1 >= maxLines) {
            // 超出最大行数，添加省略号
            appendEllipsis(currentIndex);
            break;
        }

        currentIndex++;
        currentWidth = 0;
        lines[currentIndex] = '';

        if (isBreakingSpace(char)) {
            continue;
        }
    }
}
```

### BiDi {#bidi}

O HarfBuzz não trata [BiDi]; veja [What HarfBuzz doesn't do]:

> O HarfBuzz não vai ajudar você com a bidirecionalidade.

::: info BiDi
Suporte para tratar texto que contém uma mistura de dados da esquerda para a direita (inglês) e da direita para a esquerda (árabe ou hebraico).
:::

Por exemplo, para este conteúdo misto LTR e RTL `ABCאבגDEF`, precisamos mudar manualmente a ordem do texto RTL para exibir o efeito correto:

```ts
'ABCאבגDEF'.split(''); // ['A', 'B', 'C', 'ג' ,'ב' ,'א', 'D', 'E', 'F']
```

Esse problema não é fácil de resolver no navegador; veja: [BiDi in Pixi.js]. [mapbox-gl-rtl-text] e [rtl-text] portaram [International Components for Unicode (ICU)] para WASM, o que aumenta o tamanho do bundle JS. Porém, no momento, podemos usar [bidi-js] para tratá-lo. Ao encontrar caracteres RTL, precisamos invertê-los manualmente:

```ts
import bidiFactory from 'bidi-js';

this.#bidi = bidiFactory();
const embeddingLevels = this.#bidi.getEmbeddingLevels(text);
let bidiChars = '';
for (const segment of segmentStack[0]!) {
    const { text, direction } = segment;
    bidiChars += direction === 'ltr' ? text : text.split('').reverse().join('');
}
```

No árabe impresso, cada caractere pode ter uma forma “isolada”, “inicial”, “medial” e “final”. Como exemplo, estas são as quatro formas da letra árabe “meem” (U+0645); veja: [Improving Arabic and Hebrew text in map labels].

![Direitos autorais © 2015–2017 W3C® https://w3c.github.io/alreq/](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*bw5EsYu7dRATHtvg.png)

Escolhemos [JavaScript-Arabic-Reshaper], que é bem mais leve em comparação com o ICU.

```ts
import ArabicReshaper from 'arabic-reshaper';

if (direction === 'ltr') {
    bidiChars += text;
} else {
    bidiChars += ArabicReshaper.convertArabic(text)
        .split('')
        .reverse()
        .join('');
}
```

<Bidi />

Depois de resolver o BiDi, agora precisamos tratar a questão dos caracteres compostos. O exemplo a seguir vem de [cosmic-text](https://github.com/pop-os/cosmic-text/blob/166b59f560c551dab391a864f7c1f503c1e18446/examples/editor-test/src/main.rs#L97-L101), uma biblioteca de processamento de texto multilinha implementada em Rust.

```rust
for line in BidiParagraphs::new(&text) {
    for grapheme in line.graphemes(true) {
        for c in grapheme.chars() {}
    }
}
```

### Caracteres compostos {#cluster}

Nem todos os caracteres são compostos por um único caractere. [clusters] é o termo usado pelo HarfBuzz para tratar caracteres compostos

> No shaping de texto, um cluster é uma sequência de caracteres que precisa ser tratada como uma única unidade indivisível.

Por exemplo, emojis o são. Se os processarmos como um único caractere (por exemplo, usando `split('')`), tanto a medição quanto o desenho posterior resultam em um truncamento incorreto:

```ts
'🌹'.length; // 2
'🌹'[0]; // '\uD83C'
'🌹'[1]; //'\uDF39'
```

No navegador, podemos usar uma biblioteca como [grapheme-splitter]. O uso é o seguinte:

```ts
var splitter = new GraphemeSplitter();
// plain latin alphabet - nothing spectacular
splitter.splitGraphemes('abcd'); // returns ["a", "b", "c", "d"]
// two-char emojis and six-char combined emoji
splitter.splitGraphemes('🌷🎁💩😜👍🏳️‍🌈'); // returns ["🌷","🎁","💩","😜","👍","🏳️‍🌈"]
```

Mas o tamanho dela (ainda 22 kB depois da compressão) não é desprezível; veja [BundlePhobia grapheme-splitter]. Por isso, no Pixi.js, o [Intl.Segmenter] do próprio navegador é usado por padrão para tratar caracteres compostos, e esse recurso tem suporte na maioria dos navegadores modernos:

```ts
// @see https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/CanvasTextMetrics.ts#L121C19-L131C10
const splitGraphemes: (s: string) => string[] = (() => {
    if (typeof (Intl as IIntl)?.Segmenter === 'function') {
        const segmenter = new (Intl as IIntl).Segmenter();

        return (s: string) => [...segmenter.segment(s)].map((x) => x.segment);
    }

    return (s: string) => [...s];
})();
```

Também adotamos essa solução, que será usada mais adiante ao gerar o SDF dos caracteres.

### text-align {#text-align}

Implementar [text-align] é simples:

![alinhamento do texto](/text-align.png)

```ts
let offsetX = 0;
if (textAlign === 'center') {
    offsetX -= width / 2;
} else if (textAlign === 'right' || textAlign === 'end') {
    offsetX -= width;
}
```

Mas implementar o alinhamento vertical não é tão simples. [text-baseline] vale apenas para texto de uma linha e, em muitos cenários, queremos o parágrafo inteiro centralizado. Vamos apresentar isso quando discutirmos o layout flex mais adiante.

## Renderização {#rendering}

A imagem a seguir mostra a posição do motor de renderização de fontes [FreeType] no processo:

![FreeType](https://mrandri19.github.io/assets/images/modern-text-rendering-linux-overview/freetype.svg)

Vamos nos concentrar nas técnicas específicas de renderização de texto. Para caracteres latinos, com um conjunto de caracteres limitado, é perfeitamente possível gerar um atlas de glifos offline e enviá-lo à GPU em tempo de execução. O [freetype-gl] é implementado dessa forma.

> O atlas de glifos é uma única imagem que será enviada como textura à GPU, junto com o restante dos dados do tile. Eis uma representação visual de um atlas de glifos:

A imagem a seguir vem de: [Drawing Text with Signed Distance Fields in Mapbox GL]

![atlas de glifos](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*POsS7DlWOnqaJXI_.jpg)

Mas o problema dessa abordagem não vetorial é que os caracteres ficam muito borrados quando ampliados. A imagem a seguir vem de [Distance field fonts]

![a fonte de campo de distância permanece nítida](https://libgdx.com/assets/wiki/images/distance-field-fonts.png)

A solução dominante baseada em SDF vem atualmente do artigo da Valve [Improved Alpha-Tested Magnification for Vector Textures and Special Effects]. As vantagens dessa solução incluem:

-   Permanece nítida depois da escala
-   É fácil implementar antialiasing, Halo, sombras e outros recursos

Mas o problema é que as bordas não ficam nítidas o bastante, embora, em cenários de visualização, a tolerância seja maior, e também seja possível otimizar por métodos como msdf. Além disso, o SDF também não consegue oferecer suporte a [font hinting].

Vamos primeiro olhar a situação da geração de SDF para um único caractere.

### Geração de SDF {#generate-sdf}

A imagem a seguir vem de [msdf-atlas-gen]. Vamos nos concentrar nestes dois tipos de atlas, SDF e MSDF:

|                | Máscara dura | Máscara suave | SDF | PSDF | MSDF | MTSDF |
| -------------- | ------------ | ------------- | --- | ---- | ---- | ----- |
| Canais:        | 1 (1 bit)    | 1             | 1   | 1    | 3    | 4     |
| Antialiasing:  | -            | Sim           | Sim | Sim  | Sim  | Sim   |
| Escalabilidade: | -           | -             | Sim | Sim  | Sim  | Sim   |
| Cantos vivos:  | -            | -             | -   | -    | Sim  | Sim   |
| Efeitos suaves: | -           | -             | Sim | -    | -    | Sim   |
| Efeitos duros: | -            | -             | -   | Sim  | Sim  | Sim   |

Se a geração offline for permitida, você pode usar [msdf-atlas-gen] ou [node-fontnik] (o mapbox o usa para gerar SDF codificado em protocol buffer no servidor). Mas, considerando os caracteres CJK, você pode usar [tiny-sdf] para geração em tempo de execução. O uso é o seguinte: depois de passar os atributos relacionados à fonte, você obtém dados de pixel.

```ts
const tinySdf = new TinySDF({
    fontSize: 24,
    fontFamily: 'sans-serif',
});
const glyph = tinySdf.draw('泽'); // Contains pixel data, width and height, character metrics, etc.
```

Vamos analisar brevemente o princípio de geração. Primeiro, ele usa a API Canvas2D do navegador [getImageData] para obter dados de pixel, mas, na escrita, há uma margem de buffer, considerada para a implementação de Halo.

```ts
const size = (this.size = fontSize + buffer * 4);
```

O método de travessia mais bruto, $O(n^2)$, é definitivamente inaceitável. Uma imagem de 300K significa 90 bilhões de cálculos de distância. Precisamos de um algoritmo eficiente $O(n)$ para concluí-lo em tempo de execução.

Para uma grade bidimensional, a “distância” no campo de distância é a distância euclidiana, então a EDT (Euclidean Distance Transform) é definida assim. Em que $(x',y')$ é o conjunto de pontos que compõem a forma, e $f(x, y)$ é a função amostrada. Na grade, se $(x,y) \in P$, então $f(x, y) = 0$; caso contrário, é $\infty$:

$$ \mathcal{D}_f(x,y) = \min_{x',y'} \left( (x - x')^2 + (y - y')^2 + f(x', y') \right) $$

A primeira parte não depende de $y'$, então ela pode ser expandida em dois cálculos de DT unidimensionais, em que a primeira passagem fixa $x'$:

$$
\begin{align*}
\mathcal{D}_f(x,y) &= \min_{x'} \left( (x - x')^2 + \min_{y'} \left( (y - y')^2 + f(x', y') \right) \right), \\
&= \min_{x'} \left( (x - x')^2 + \mathcal{D}_{f_{|x'}}(y) \right),
\end{align*}
$$

Portanto, só precisamos considerar o quadrado da distância unidimensional:

$$ \mathcal{D}_f(p) = \min_{q \in \mathcal{G}} \left( (p - q)^2 + f(q) \right) $$

Se entendermos a fórmula acima do campo do quadrado da distância unidimensional de um ponto de vista geométrico, ela é, na verdade, um conjunto de parábolas. Cada parábola tem o ponto mais baixo em $(q, f(q))$. A imagem a seguir vem do artigo original [Distance Transforms of Sampled Functions]:

![transformada de distância de funções amostradas](/dt-sampled-functions.png)

Portanto, o limite inferior desse conjunto de parábolas, isto é, a parte de linha cheia na imagem a seguir, representa o resultado do cálculo da EDT:

![EDT](https://pica.zhimg.com/v2-2dd0b94f2de83162f314300b933a3708_1440w.jpg)

Para encontrar esse limite inferior, precisamos calcular os pontos de interseção de quaisquer duas parábolas. Por exemplo, para as duas parábolas $(x=r, x=q)$, a abscissa $s$ do ponto de interseção é:

$$ s = \frac{(f(r) + r^2) - (f(q) + q^2)}{2r - 2q} $$

Agora que temos o conhecimento para calcular a EDT 1D, salvamos em $v[]$ o número de sequência da parábola mais à direita no limite inferior. O limite de cada segmento da parábola do limite inferior é salvo em $z[]$. Desse modo, ao calcular a próxima parábola $x=q$, basta encontrar a interseção com a parábola $v[k]$, e há apenas duas relações possíveis entre a abscissa do ponto de interseção e a posição de $z[k]$:

![Os dois casos possíveis considerados pelo algoritmo ao adicionar a parábola de q ao envelope inferior construído até então.](/dt-2-possible-cases.png)

O algoritmo completo é o seguinte. [tiny-sdf] o implementa (EDT 1D), e até os nomes das variáveis são consistentes:

![Transformada de distância unidimensional sob a distância euclidiana ao quadrado](/dt-euclidean-distance.png)

[Sub-pixel Distance Transform] apresenta a ideia desse algoritmo em detalhe, calculando o campo de distância externo separadamente e, em seguida, combinando os dois:

> Para fazer um campo de distância com sinal, você faz isso para o interior e o exterior separadamente e, em seguida, combina os dois como interior – exterior, ou vice-versa.

Ele começa pelo 1D mais básico. Primeiro, supomos que a nossa entrada só tem preto e branco, isto é, a máscara dura mencionada acima, e primeiro calculamos o campo de distância externo:

![linha de pixels](https://acko.net/files/gpubox/image/pixels-row.png)

$$ O = [\infty, \infty, \infty, 0, 0, 0, 0, 0, \infty, 0, 0, 0, \infty, \infty, \infty] $$
$$ P = [3, 2, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3] $$

Em seguida, calculamos o campo de distância interno. `I` inverte `O`:

$$ I = [0, 0, 0, \infty, \infty, \infty, \infty, \infty, 0, \infty, \infty, \infty, 0, 0, 0] $$
$$ N = [0, 0, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1, 0, 0, 0] $$

Por fim, combinamos, usando o campo de distância externo menos o campo de distância interno:

$$ P - N = [3, 2, 1,-1,-2,-3,-2,-1, 1,-1,-2,-1, 1, 2, 3] $$

Na implementação de [tiny-sdf], o processo acima corresponde à lógica de processamento quando `a` é `1`:

```ts
// @see https://github.com/mapbox/tiny-sdf/blob/main/index.js#L85
gridOuter.fill(INF, 0, len);
gridInner.fill(0, 0, len);

for (let y = 0; y < glyphHeight; y++) {
    for (let x = 0; x < glyphWidth; x++) {
        if (a === 1) {
            // fully drawn pixels
            gridOuter[j] = 0;
            gridInner[j] = INF;
        } else {
        }
    }
}

edt(outer, 0, 0, wp, hp, wp, this.f, this.z, this.v);
edt(inner, pad, pad, w, h, wp, this.f, this.z, this.v);

for (let i = 0; i < np; i++) {
    const d = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
    out[i] = Math.max(
        0,
        Math.min(255, Math.round(255 - 255 * (d / this.radius + this.cutoff))),
    );
}
```

Para o cálculo da EDT 2D, como apresentamos no início desta seção, ele é decomposto em duas passagens do quadrado da distância 1D e, por fim, obtém-se a raiz quadrada. É semelhante ao efeito de desfoque gaussiano no pós-processamento:

> Como uma transformada de Fourier, você pode aplicá-la a imagens 2D aplicando-a horizontalmente em cada linha X e, em seguida, verticalmente em cada coluna Y (ou vice-versa).

Aqui também dá para ver diretamente que, para uma grade de tamanho `height * width`, a complexidade é $O(n)$:

```ts
// @see https://github.com/mapbox/tiny-sdf/blob/main/index.js#L110
function edt(data, width, height, f, d, v, z) {
    // Pass 1
    for (var x = 0; x < width; x++) {
        for (var y = 0; y < height; y++) {
            f[y] = data[y * width + x];
        }
        // Fix x and calculate 1D distance squared
        edt1d(f, d, v, z, height);
        for (y = 0; y < height; y++) {
            data[y * width + x] = d[y];
        }
    }
    // Pass 2
    for (y = 0; y < height; y++) {
        for (x = 0; x < width; x++) {
            f[x] = data[y * width + x];
        }
        edt1d(f, d, v, z, width);
        for (x = 0; x < width; x++) {
            // Take the square root to get the Euclidean distance
            data[y * width + x] = Math.sqrt(d[x]);
        }
    }
}
```

Resolvido o problema da geração de SDF para um único caractere, o passo seguinte é mesclar todos os SDFs de caracteres em uma imagem grande, que será usada como textura mais adiante.

### Atlas de glifos {#glyph-atlas}

O SDF individual precisa ser mesclado em uma imagem grande para ser usado como textura mais adiante, de forma parecida com CSS Sprite. Esse tipo de problema se chama: [Bin packing problem], colocar uma caixa pequena dentro de uma caixa grande, usando o espaço de forma razoável para reduzir lacunas. Escolhemos [potpack]. Esse algoritmo consegue um resultado o mais próximo possível de um quadrado. A desvantagem é que, depois de gerar o layout, não é permitido modificá-lo, apenas gerá-lo de novo.

![atlas de glifos com potpack](https://miro.medium.com/v2/resize:fit:1024/format:webp/0*YcJm5NJXJCIO20ds.png)

O atlas armazena os glifos usados no momento por um lote de texto. A primeira construção também inclui um glifo de espaço, para que o texto vazio tenha métricas válidas. Um caractere novo, ou uma mudança de família, peso, estilo ou preenchimento da fonte, pode reconstruir o atlas; mudar só o tamanho da fonte o reutiliza. Gerar apenas os caracteres visíveis evita gravar 96 glifos ASCII não usados para cada estilo de texto ao importar um SVG com muitos rótulos.

Essa textura só precisa usar um canal. Se for WebGL, você pode usar o formato `gl.ALPHA`, mas não há formato correspondente no WebGPU. Por isso, usamos o formato `Format.U8_R_NORM`, que é `gl.LUMINANCE` no WebGL e [r8unorm] no WebGPU.

```ts
this.glyphAtlasTexture = device.createTexture({
    ...makeTextureDescriptor2D(Format.U8_R_NORM, atlasWidth, atlasHeight, 1),
    pixelStore: {
        unpackFlipY: false,
        unpackAlignment: 1,
    },
});
```

Em seguida, no Shader, a distância com sinal é obtida do canal `r`:

```glsl
uniform sampler2D u_SDFMap; // glyph atlas
varying vec2 v_UV;

float dist = texture2D(u_SDFMap, v_UV).r;
```

O que está acima é a lógica de desenho no fragment shader. Vamos ver como calcular a posição de cada caractere passada ao vertex shader.

### Gerar quads {#generate-quads}

Primeiro, precisamos converter cada glifo de dados de glifo em dois triângulos (chamados de "quad"), contendo quatro vértices:

![Uma sequência de texto como uma malha de triângulos texturizada.](/glyph-quad.png)

Os dados simplificados do glifo `SymbolQuad` são definidos assim:

```ts
// @see https://github.com/mapbox/mapbox-gl-js/blob/main/src/symbol/quads.ts#L42
export type SymbolQuad = {
    tl: Point; // The coordinates of the four vertices in local coordinates
    tr: Point;
    bl: Point;
    br: Point;
    tex: {
        x: number; // Texture coordinates
        y: number;
        w: number;
        h: number;
    };
};
```

Para cada dado de glifo, divida-o em quatro vértices, em que uv e offset são combinados em um único stride e, em seguida, acessados no vertex shader por meio de `a_UvOffset`:

```ts
glyphQuads.forEach((quad) => {
    charUVOffsetBuffer.push(quad.tex.x, quad.tex.y, quad.tl.x, quad.tl.y);
    charUVOffsetBuffer.push(
        quad.tex.x + quad.tex.w,
        quad.tex.y,
        quad.tr.x,
        quad.tr.y,
    );
    charUVOffsetBuffer.push(
        quad.tex.x + quad.tex.w,
        quad.tex.y + quad.tex.h,
        quad.br.x,
        quad.br.y,
    );
    charUVOffsetBuffer.push(
        quad.tex.x,
        quad.tex.y + quad.tex.h,
        quad.bl.x,
        quad.bl.y,
    );
    charPositionsBuffer.push(x, y, x, y, x, y, x, y);

    indexBuffer.push(0 + i, 2 + i, 1 + i);
    indexBuffer.push(2 + i, 0 + i, 3 + i);
    i += 4;
});
```

No vertex shader, divida uv pelo tamanho da textura para obter as coordenadas de textura passadas ao fragment shader para amostrar o atlas de glifos. Ao mesmo tempo, multiplique o offset pela escala da fonte para obter o deslocamento em relação ao ponto de âncora e, por fim, some a posição e o offset para obter a posição final do vértice:

```glsl
v_Uv = a_UvOffset.xy / u_AtlasSize;

vec2 offset = a_UvOffset.zw * fontScale;
gl_Position = vec4((u_ProjectionMatrix
    * u_ViewMatrix
    * u_ModelMatrix
    * vec3(a_Position + offset, 1)).xy, zIndex, 1);
```

Por fim, vamos ver como calcular os dados do glifo. Depois da segmentação de parágrafo na seção anterior, obtivemos um array de strings de várias linhas, `lines`, combinado com `textAlign`, `letterSpacing` e `fontMetrics` para calcular a informação de posição de cada caractere em relação ao ponto de âncora.

```ts
function layout(
    lines: string[], // after paragraph segmentation
    fontStack: string,
    lineHeight: number,
    textAlign: CanvasTextAlign,
    letterSpacing: number,
    fontMetrics: globalThis.TextMetrics & { fontSize: number },
): PositionedGlyph[] {}
```

Aqui nos referimos à implementação de [mapbox-gl-js shaping.ts]:

```ts
export type PositionedGlyph = {
    glyph: number; // charCode
    x: number;
    y: number;
    scale: number; // The scale ratio calculated according to the zoom level
    fontStack: string;
};
```

```ts
lines.forEach((line) => {
    const lineStartIndex = positionedGlyphs.length;

    canvasTextMetrics.splitGraphemes(line).forEach((char) => {});
});
```

## Melhorias {#improvements}

O texto renderizado atualmente tem “traços artificiais” evidentes quando ampliado. Um motivo óbvio é a resolução do SDF gerado. Na implementação atual do Mapbox, `SDF_SCALE` é usado para controlá-la. Quanto maior a resolução do SDF gerado, mais delicado ele fica, mas isso também traz uma queda de desempenho.

<https://github.com/mapbox/mapbox-gl-js/blob/main/src/render/glyph_manager.ts#L34>

> A escolha de SDF_SCALE é um compromisso entre desempenho e qualidade.
> O tempo de geração de glifos cresce quadraticamente com a escala, enquanto as melhorias
> de qualidade caem rapidamente quando a escala é maior que a pixel ratio
> do dispositivo. A escala de 2 compra melhorias perceptíveis em telas HDPI
> a um custo aceitável.

A imagem a seguir mostra o efeito de comparação quando ampliado, com valores de `SDF_SCALE` de 1 e 4:

|          SDF_SCALE = 1           |          SDF_SCALE = 4           |
| :------------------------------: | :------------------------------: |
| ![escala sdf 1](/sdf-scale-1.png) | ![escala sdf 4](/sdf-scale-4.png) |

Mas, primeiro, não vamos ajustar a resolução do SDF. A implementação atual de [tiny-sdf] ainda tem problemas.

### Transformada de distância subpixel {#sub-pixel-distance-transform}

[Sub-pixel Distance Transform] aponta que há problemas na implementação de [tiny-sdf] e oferece uma implementação melhorada.

Primeiro, usamos o Canvas para gerar não apenas uma máscara dura em preto e branco, mas uma imagem em escala de cinza:

![linha de pixels em cinza](https://acko.net/files/gpubox/image/pixels-row-grey.png)

Na implementação de [tiny-sdf], quando `a` não é 1, o processamento é o seguinte:

```ts
// @see https://github.com/mapbox/tiny-sdf/blob/main/index.js#L89
if (a === 1) {
} else {
    const d = 0.5 - a; // aliased pixels
    gridOuter[j] = d > 0 ? d * d : 0;
    gridInner[j] = d < 0 ? d * d : 0;
}
```

![tiny-sdf contra use.gpu](https://acko.net/files/gpubox/image/glyph-xy-compare-t@2x.png)

### MSDF {#msdf}

Ao usar um campo de distância de baixa resolução para reconstrução, os cantos dos caracteres ficam suaves demais e não conseguem manter a nitidez original. Agora vamos resolver esse problema.

![sdf contra msdf](/msdf-vs-sdf.png)

O campo de distância pode ser submetido a operações de conjunto. A imagem a seguir vem de [Shape Decomposition for Multi-channel Distance Fields]. Armazenamos os dois campos de distância em dois componentes do bitmap (R, G), respectivamente. Na reconstrução, embora esses dois campos de distância sejam suaves nos cantos, a interseção pode ser usada para obter um efeito de restauração nítido:

![Uma decomposição possível da forma em uma união de duas formas arredondadas.](/msdf.png)

O algoritmo de decomposição pode se referir ao artigo original [Shape Decomposition for Multi-channel Distance Fields], na seção 4.4: Direct multi-channel distance field construction. No uso real, o autor oferece [msdfgen]. Dá para ver que o MSDF tem um efeito muito melhor em baixa resolução, até melhor que um SDF de resolução mais alta.

Em termos de ferramentas de geração, as ferramentas online incluem [MSDF font generator], e as ferramentas de CLI incluem [msdf-bmfont-xml]. Essas ferramentas geram um atlas MSDF ao mesmo tempo e também geram um arquivo `fnt` ou `json`, que contém a informação de layout de cada caractere para o desenho posterior. [pixi-msdf-text] é um exemplo completo usando Pixi.js, que usa [BitmapFontLoader] para carregar o arquivo `fnt`, e o nosso projeto também referencia a implementação dele.

Ao reconstruir com `median` no Fragment Shader:

```glsl
float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

#ifdef USE_MSDF
    vec3 s = texture(SAMPLER_2D(u_Texture), v_Uv).rgb;
    float dist = median(s.r, s.g, s.b);
#else
```

No exemplo abaixo, dá para ver que os caracteres permanecem nítidos mesmo quando ampliados:

<MSDFText />

### font-kerning {#font-kerning}

Em fontes Bitmap pré-geradas, `kernings` podem ser incluídos, o que pode ajustar o espaçamento entre dois caracteres em uma sequência fixa.

Por exemplo <https://pixijs.com/assets/bitmap-font/desyrel.xml>

```xml
<kernings count="1816">
    <kerning first="102" second="102" amount="2" />
    <kerning first="102" second="106" amount="-2" />
</kernings>
```

Tanto o cálculo da caixa delimitadora quanto o layout precisam levá-lo em conta. O exemplo a seguir mostra as diferenças:

<BitmapFont />

Em tempo de execução, se quisermos obter [font-kerning], podemos nos referir à forma dada por <https://github.com/mapbox/tiny-sdf/issues/6#issuecomment-1532395796>:

![font-kerning](https://developer.mozilla.org/en-US/docs/Web/CSS/font-kerning/font-kerning.png)

```ts
const unkernedWidth =
    tinySdf.ctx.measureText('A').width + tinySdf.ctx.measureText('V').width;
const kernedWidth = tinySdf.ctx.measureText('AV').width;
const kerning = kernedWidth - unkernedWidth; // a negative value indicates you should adjust the SDFs closer together by that much
```

### emoji {#emoji}

Em algumas implementações de renderização de emoji, como [EmojiEngine], usa-se uma abordagem de atlas de emoji pré-gerado. Porém, essa abordagem não só tem limitações de tamanho de textura, como também não consegue manter a aparência de emoji específica da plataforma em plataformas diferentes. Por isso, de forma semelhante ao SDF, queremos gerar emojis sob demanda em tempo de execução na plataforma atual.

A maior diferença entre essa abordagem e o SDF é que não podemos preservar apenas o canal alfa: precisamos reter os três canais RGB para a reconstrução posterior do campo de distância.

<Emoji />

## Exportar SVG {#export-svg}

Ao exportar texto de várias linhas para SVG, você pode usar `<tspan>`, definindo `dy` como a altura da linha depois da medição:

```html
<text
    x="0"
    y="0"
    dominant-baseline="ideographic"
    id="node-text-5"
    font-family="Gaegu"
    font-size="16"
    fill="black"
    transform="matrix(1,0,0,1,50,234)"
>
    <tspan x="0" dy="17.368">Abcdef</tspan>
    <tspan x="0" dy="17.368">ghijklm</tspan>
    <tspan x="0" dy="17.368">nop(ide</tspan>
</text>
```

## Leitura adicional {#extended-reading}

-   [State of Text Rendering 2024]
-   [Signed Distance Field Fonts - basics]
-   [Approaches to robust realtime text rendering in threejs (and WebGL in general)]
-   [Easy Scalable Text Rendering on the GPU]
-   [Text Visualization Browser]
-   [Rive Text Overview]
-   [Texture-less Text Rendering]
-   [Text layout is a loose hierarchy of segmentation]
-   [End-To-End Tour of Text Layout/Rendering]
-   [Text rendering in mapbox]
-   [Rendering Crispy Text On The GPU]
-   [Localization, languages, and listening]
-   [RTL languages in Figma]

[Drawing text]: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_text
[FreeType]: https://freetype.org/
[freetype-gl]: https://github.com/rougier/freetype-gl
[Easy Scalable Text Rendering on the GPU]: https://medium.com/@evanwallace/easy-scalable-text-rendering-on-the-gpu-c3f4d782c5ac
[use-gpu-text]: https://gitlab.com/unconed/use.gpu/-/tree/master/rust/use-gpu-text
[Text Visualization Browser]: https://textvis.lnu.se
[State of Text Rendering 2024]: https://behdad.org/text2024/
[Rive Text Overview]: https://rive.app/community/doc/text-overview/docSfhykWoWu
[Texture-less Text Rendering]: https://poniesandlight.co.uk/reflect/debug_print_text/
[Text layout is a loose hierarchy of segmentation]: https://raphlinus.github.io/text/2020/10/26/text-layout.html
[End-To-End Tour of Text Layout/Rendering]: https://litherum.blogspot.com/2015/02/end-to-end-tour-of-text-rendering.html
[Text rendering in mapbox]: https://github.com/mapbox/mapbox-gl-native/wiki/Text-Rendering
[HarfBuzz]: https://harfbuzz.github.io/what-is-harfbuzz.html
[harfbuzzjs]: https://github.com/harfbuzz/harfbuzzjs
[EmojiEngine]: https://github.com/trishume/EmojiEngine
[What HarfBuzz doesn't do]: https://harfbuzz.github.io/what-harfbuzz-doesnt-do.html
[Modern text rendering with Linux: Overview]: https://mrandri19.github.io/2019/07/24/modern-text-rendering-linux-overview.html
[Beautifying map labels with better line breaking]: https://blog.mapbox.com/beautifying-map-labels-with-better-line-breaking-2a6ce3ed432
[Improving Arabic and Hebrew text in map labels]: https://blog.mapbox.com/improving-arabic-and-hebrew-text-in-map-labels-fd184cf5ebd1
[mapbox-gl-js shaping.ts]: https://github.com/mapbox/mapbox-gl-js/blob/main/src/symbol/shaping.ts
[Drawing Text with Signed Distance Fields in Mapbox GL]: https://blog.mapbox.com/drawing-text-with-signed-distance-fields-in-mapbox-gl-b0933af6f817
[font hinting]: http://en.wikipedia.org/wiki/Font_hinting
[potpack]: https://github.com/mapbox/potpack
[BiDi]: https://en.wikipedia.org/wiki/Bidirectional_text
[bidi-js]: https://github.com/lojjic/bidi-js
[mapbox-gl-rtl-text]: https://github.com/mapbox/mapbox-gl-rtl-text
[Approaches to robust realtime text rendering in threejs (and WebGL in general)]: https://github.com/harfbuzz/harfbuzzjs/discussions/30
[TextMetrics]: https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics
[Differences between width and actualBoundingBoxLeft(Right)]: https://stackoverflow.com/a/66846914/4639324
[Meaning of top, ascent, baseline, descent, bottom, and leading in Android's FontMetrics]: https://stackoverflow.com/questions/27631736/meaning-of-top-ascent-baseline-descent-bottom-and-leading-in-androids-font
[node-fontnik]: https://github.com/mapbox/node-fontnik
[opentype.js]: https://github.com/opentypejs/opentype.js
[msdfgen]: https://github.com/Chlumsky/msdfgen
[msdf-atlas-gen]: https://github.com/Chlumsky/msdf-atlas-gen?tab=readme-ov-file#atlas-types
[measureText]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText
[text-baseline]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
[text-align]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textAlign
[PIXI.TextMetrics]: https://api.pixijs.io/@pixi/text/PIXI/TextMetrics.html
[letterSpacing]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/letterSpacing
[grapheme-splitter]: https://github.com/orling/grapheme-splitter
[BundlePhobia grapheme-splitter]: https://bundlephobia.com/package/grapheme-splitter@1.0.4
[CanvasKit Text Shaping]: https://skia.org/docs/user/modules/quickstart/#text-shaping
[pixi-cjk]: https://github.com/huang-yuwei/pixi-cjk
[Line breaking rules in East Asian languages]: https://en.wikipedia.org/wiki/Line_breaking_rules_in_East_Asian_languages
[clusters]: https://harfbuzz.github.io/clusters.html
[Intl.Segmenter]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
[Improved Alpha-Tested Magnification for Vector Textures and Special Effects]: https://steamcdn-a.akamaihd.net/apps/valve/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf
[Signed Distance Field Fonts - basics]: https://www.redblobgames.com/x/2403-distance-field-fonts/
[Bin packing problem]: https://en.wikipedia.org/wiki/Bin_packing_problem
[msdf-bmfont-xml]: https://github.com/soimy/msdf-bmfont-xml
[pixi-msdf-text]: https://github.com/soimy/pixi-msdf-text
[Distance field fonts]: https://libgdx.com/wiki/graphics/2d/fonts/distance-field-fonts
[Distance Transforms of Sampled Functions]: https://cs.brown.edu/people/pfelzens/papers/dt-final.pdf
[tiny-sdf]: https://github.com/mapbox/tiny-sdf
[r8unorm]: https://gpuweb.github.io/gpuweb/#dom-gputextureformat-r8unorm
[Shape Decomposition for Multi-channel Distance Fields]: https://dspace.cvut.cz/bitstream/handle/10467/62770/F8-DP-2015-Chlumsky-Viktor-thesis.pdf
[Sub-pixel Distance Transform]: https://acko.net/blog/subpixel-distance-transform
[getImageData]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/getImageData
[BitmapFontLoader]: https://api.pixijs.io/@pixi/text-bitmap/PIXI/BitmapFontLoader.html
[MSDF font generator]: https://msdf-bmfont.donmccurdy.com/
[font-kerning]: https://developer.mozilla.org/en-US/docs/Web/CSS/font-kerning
[BiDi in Pixi.js]: https://github.com/pixijs/pixijs/issues/4482
[Rendering Crispy Text On The GPU]: https://osor.io/text
[Localization, languages, and listening]: https://www.figma.com/blog/expanding-figmas-international-presence/
[RTL languages in Figma]: https://help.figma.com/hc/en-us/articles/4972283635863-Add-right-to-left-text
[International Components for Unicode (ICU)]: http://site.icu-project.org/
[rtl-text]: https://www.jsdelivr.com/package/npm/rtl-text
[JavaScript-Arabic-Reshaper]: https://github.com/louy/JavaScript-Arabic-Reshaper
[text-overflow]: https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow
[CanvasTextMetrics]: https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/CanvasTextMetrics.ts#L369
