---
outline: deep
description: 'Explore recursos avançados de texto, incluindo renderização com curvas de Bézier, traços de texto, decorações, sombras, texto sobre caminho e edição interativa de texto, com suporte a seleção e acessibilidade.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lição 16 - Recursos avançados de texto',
          },
      ]
---

<script setup>
import WebFontLoader from '../../components/WebFontLoader.vue';
import Opentype from '../../components/Opentype.vue';
import Harfbuzz from '../../components/Harfbuzz.vue';
import TeXMath from '../../components/TeXMath.vue';
import TextDropShadow from '../../components/TextDropShadow.vue';
import TextStroke from '../../components/TextStroke.vue';
import TextDecoration from '../../components/TextDecoration.vue';
import TextPath from '../../components/TextPath.vue';
import PhysicalText from '../../components/PhysicalText.vue';
import TextEditor from '../../components/TextEditor.vue';
</script>

# Lição 16 - Recursos avançados de texto {#lesson-16-text-advanced-features}

Na lição anterior, apresentamos os princípios da renderização de texto baseada em SDF, experimentamos ESDT e MSDF para melhorar a qualidade da renderização e mencionamos os recursos avançados de renderização de texto que o CanvasKit oferece em comparação com o Canvas.

Nesta lição, vamos primeiro olhar métodos de renderização além do SDF e, em seguida, discutir e tentar implementar recursos como: linhas decorativas, sombras e texto que segue caminhos. Por fim, o texto não deve apenas poder ser renderizado, mas também ter uma boa interação. Vamos discutir temas como caixas de entrada, seleção de texto e A11y.

Vamos primeiro ver quais métodos de renderização de texto existem além do SDF.

## Renderizar texto com curvas de Bézier {#render-text-with-bezier-curve}

Usando o recurso de exportação SVG do Figma, dá para ver que o texto dele também é renderizado com Paths. Se não considerarmos o desempenho da renderização nem os caracteres CJK, usar curvas de Bézier para renderizar texto é, de fato, uma boa escolha. Para obter informações vetoriais dos caracteres em um ambiente de navegador, podemos usar:

-   [opentype.js]
-   o use-gpu usa [use-gpu-text], que é um wrapper baseado em [ab-glyph](https://github.com/alexheretic/ab-glyph)
-   Cada vez mais aplicativos usam [harfbuzzjs]; veja: [State of Text Rendering 2024]. Por exemplo, [font-mesh-pipeline] é uma demonstração simples

Abaixo mostramos exemplos de renderização de texto com opentype.js e harfbuzzjs, ambos com suporte ao formato de fonte `ttf`.

### opentype.js {#opentypejs}

O opentype.js oferece o método `getPath`, que completa o Shaping e obtém [path-commands] de SVG a partir do conteúdo do texto, da posição e do tamanho da fonte.

```ts
opentype.load('fonts/Roboto-Black.ttf', function (err, font) {
    const path = font.getPath('Hello, World!', 0, 0, 32); // x, y, fontSize
    // convert to svg path definition
});
```

<Opentype />

### harfbuzzjs {#harfbuzzjs}

Primeiro inicialize o WASM do harfbuzzjs usando a sintaxe ?init do Vite. Em seguida, carregue o arquivo de fonte e crie um objeto de fonte.

```ts
import init from 'harfbuzzjs/hb.wasm?init';
import hbjs from 'harfbuzzjs/hbjs.js';

const instance = await init();
hb = hbjs(instance);

const data = await (
    await window.fetch('/fonts/NotoSans-Regular.ttf')
).arrayBuffer();
blob = hb.createBlob(data);
face = hb.createFace(blob, 0);
font = hb.createFont(face);
font.setScale(32, 32); // Set font size
```

Depois crie um objeto buffer e adicione o conteúdo do texto. Como mencionado antes, o harfbuzz não trata BiDi, então precisamos definir manualmente a direção do texto. Por fim, chame o método hb.shape para executar o cálculo de Shaping.

```ts
buffer = hb.createBuffer();
buffer.addText('Hello, world!');
buffer.guessSegmentProperties();
// TODO: use BiDi
// buffer.setDirection(segment.direction);

hb.shape(font, buffer);
const result = buffer.json(font);
```

Agora temos os dados do glifo e podemos usar Path para desenhá-lo

```ts
result.forEach(function (x) {
    const d = font.glyphToPath(x.g);
    const path = new Path({
        d,
        fill: '#F67676',
    });
});
```

<Harfbuzz />

### Renderização de matemática TeX {#tex-math-rendering}

Podemos usar [MathJax] para renderizar fórmulas matemáticas TeX, convertê-las em SVG e, em seguida, renderizá-las com Path. Aqui seguimos a abordagem de [LaTeX in motion-canvas] para obter o SVGElement:

```ts
const JaxDocument = mathjax.document('', {
    InputJax: new TeX({ packages: AllPackages }),
    OutputJax: new SVG({ fontCache: 'local' }),
});

const svg = Adaptor.innerHTML(JaxDocument.convert(formula));
const parser = new DOMParser();
const doc = parser.parseFromString(svg, 'image/svg+xml');
const $svg = doc.documentElement;
```

Em seguida, use o método apresentado em [Lição 10 - De SVGElement ao nó serializado] para converter o SVGElement em gráficos e adicioná-los à tela.

```ts
const root = await deserializeNode(fromSVGElement($svg));
```

<TeXMath />

## Traço de texto {#text-stroke}

Tanto [strokeText] no Canvas quanto [-webkit-text-stroke] no CSS oferecem traços de texto. A boa notícia é que traços são naturalmente fáceis de implementar em SDF:

```glsl
if (strokeWidth > 0.0 && strokeColor.a > 0.0) {
    float fillAlpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, dist);
    float strokeThreshold = buff - strokeWidth / fontSize;
    float strokeAlpha = smoothstep(strokeThreshold - gamma_scaled, strokeThreshold + gamma_scaled, dist);

    vec4 finalColor = mix(strokeColor, fillColor, fillAlpha);
    outputColor = finalColor;
    opacity *= strokeAlpha;
}
```

A seguir estão renderizações baseadas em SDF e MSDF, e dá para ver que o MSDF permanece nítido mesmo com traço:

<TextStroke />

## Decoração de texto {#text-decoration}

No CSS, os navegadores antigos tinham uma implementação tosca de [text-decoration], exemplificada por `underline`, de onde vem a imagem a seguir: [Crafting link underlines on Medium]

![Feio. Distrai. Sublinhados inaceitáveis](https://miro.medium.com/v2/resize:fit:2000/format:webp/1*RmN57MMY_q9-kEt7j7eiVA.gif)

> O sublinhado perfeito deve ser visível, mas discreto — permitindo que as pessoas percebam o que é clicável, sem chamar atenção demais para si. Ele deve ficar a uma distância exatamente certa do texto, repousando com conforto atrás dele quando os descendentes quiserem ocupar o mesmo espaço:

![Sublinhado bonito](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*5iD2Znv03I2XR5QI3KLJrg.png)

Os navegadores atuais aperfeiçoaram essa implementação. Além disso, o Canvas não oferece esse recurso, e o CanvasKit o amplia com um conjunto de propriedades que correspondem ao `text-decoration` do CSS:

```ts
// @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration#constituent_properties
// @see https://skia.org/docs/dev/design/text_shaper/#principles
const paraStyle = new CanvasKit.ParagraphStyle({
    textStyle: {
        decoration: CanvasKit.UnderlineDecoration,
        decorationColor,
        decorationThickness,
        decorationStyle: CanvasKit.DecorationStyle.Solid,
    },
});
```

Outra implementação interessante, [underlineJS], é baseada em Canvas.

### Usar polilinha {#use-polyline}

O estilo da linha de decoração é controlado pela propriedade `decorationStyle`:

```ts
export type TextDecorationStyle =
  | 'solid'
  | 'double'
  | 'dotted'
  | 'dashed'
  | 'wavy';
: TextDecorationStyle;
```

No estilo `solid` mais simples, por exemplo, passamos `decorationColor` e `decorationThickness` como `strokeColor` e `strokeWidth`:

```ts
if (instance instanceof Text) {
    const {
        decorationColorRGB,
        decorationThickness,
        decorationStyle,
        metrics,
    } = instance;
    u_StrokeColor = [
        decorationColorRGB.r / 255,
        decorationColorRGB.g / 255,
        decorationColorRGB.b / 255,
        fo,
    ];
    u_ZIndexStrokeWidth[1] = decorationThickness;
}
```

### Estilo de decoração {#decoration-style}

A própria polilinha oferece suporte a `strokeDasharray`, então tanto `dotted` quanto `dashed` podem ser obtidos com ela. Aqui nos referimos à implementação do Skia para definir a proporção entre `dash` e `gap`:

```c++
// @see https://github.com/google/skia/blob/main/modules/skparagraph/src/Decorations.cpp#L187
SkScalar scaleFactor = textStyle.getFontSize() / 14.f;
switch (textStyle.getDecorationStyle()) {
    case TextDecorationStyle::kDotted: {
        dashPathEffect.emplace(1.0f * scaleFactor, 1.5f * scaleFactor);
        break;
    }
    case TextDecorationStyle::kDashed: {
        dashPathEffect.emplace(4.0f * scaleFactor, 2.0f * scaleFactor);
        break;
    }
    default: break;
}
```

De forma específica, precisamos calcular e amostrar as linhas `wavy`, o que faremos aqui gerando um Path SVG e usando o método descrito em [Lição 13 - Amostragem em uma curva]:

```c++
// @see https://github.com/google/skia/blob/main/modules/skparagraph/src/Decorations.cpp#L215
let d = 'M 0 0';
while (x_start + quarterWave * 2 < line.width) {
    d += ` Q ${x_start + quarterWave} ${
        wave_count % 2 != 0 ? quarterWave : -quarterWave
    } ${x_start + quarterWave * 2} 0`;

    x_start += quarterWave * 2;
    ++wave_count;
}
```

O efeito é o seguinte:

<TextDecoration />

### Calcular a posição {#calculate-position}

A posição é controlada pela propriedade `decorationLine`:

```ts
export type TextDecorationLine =
    | 'underline'
    | 'overline'
    | 'line-through'
    | 'none';
```

Referimo-nos à implementação [Decorations::calculatePosition] do Skia, usando `underline` como exemplo:

```c++
void Decorations::calculatePosition(TextDecoration decoration, SkScalar ascent) {
    switch (decoration) {
        case TextDecoration::kUnderline:
            if ((fFontMetrics.fFlags & SkFontMetrics::FontMetricsFlags::kUnderlinePositionIsValid_Flag) &&
                fFontMetrics.fUnderlinePosition > 0) {
                fPosition  = fFontMetrics.fUnderlinePosition;
            } else {
                fPosition = fThickness;
            }
            fPosition -= ascent;
            break;
    }
}
```

### Exportar SVG {#export-svg-text-decoration}

Infelizmente, até o momento (2025.7.9), o SVG não oferece suporte completo a [text-decoration]. Na imagem da direita abaixo, text-decoration-color não respeita a cor azul que definimos e é substituída pela cor do texto, e text-decoration-style não tem suporte algum. Veja: [Text decoration of a text svg in html].

> Aparentemente, text-decoration-color não se aplica a elementos de texto SVG

O Figma contorna isso exportando como `<path>`. Ainda queremos manter `<text>`, então, ao exportar SVGs, só podemos usar wrappers `<foreignObject>`, como à esquerda abaixo:

```html
<foreignObject width="50" height="20">
    <span style="text-decoration: underline; text-decoration-color: blue;">
        Text
    </span>
</foreignObject>
```

<svg viewBox="0 0 100 20">
  <foreignObject width="50" height="20">
    <span style="text-decoration: underline; text-decoration-color: blue;">
      Text
    </span>
  </foreignObject>
  <text x="50" y="17" style="text-decoration: underline; text-decoration-color: blue;"  >
    Text
  </text>
</svg>

## Sombras {#dropshadow}

O Pixi.js oferece [DropShadowFilter], mas podemos implementar a sombra diretamente em SDF, sem pós-processamento. Use `shadowOffset` e `shadowBlurRadius` para controlar o deslocamento e o desfoque da textura SDF.

```glsl
// @see https://github.com/soimy/pixi-msdf-text/blob/master/src/msdf.frag#L49
vec3 shadowSample = texture2D(uSampler, vTextureCoord - shadowOffset).rgb;
float shadowDist = median(shadowSample.r, shadowSample.g, shadowSample.b);
float distAlpha = smoothstep(0.5 - shadowSmoothing, 0.5 + shadowSmoothing, shadowDist);
vec4 shadow = vec4(shadowColor, shadowAlpha * distAlpha);
gl_FragColor = mix(shadow, text, text.a);
```

<TextDropShadow />

## Texto ao longo de um caminho {#text-along-path}

Na comunidade do Figma, muitos usuários esperam por esse recurso, por exemplo: [Make text follow a path or a circle]. Ele passou a ter suporte oficial recentemente: [Type text on a path].

![Digitar texto em um caminho](https://help.figma.com/hc/article_attachments/31937313416471)

Em SVG, isso pode ser obtido com [textPath]; veja: [Curved Text Along a Path]

```html
<path
    id="curve"
    d="M73.2,148.6c4-6.1,65.5-96.8,178.6-95.6c111.3,1.2,170.8,90.3,175.1,97"
/>
<text width="500">
    <textPath xlink:href="#curve"> Dangerous Curves Ahead </textPath>
</text>
```

O Skia oferece o método `MakeOnPath`; veja [Draw text along a path]:

```ts
const textblob = CanvasKit.TextBlob.MakeOnPath(text, skPath, skFont);
canvas.drawTextBlob(textblob, 0, 0, textPaint);
```

No Mapbox, posicionar rótulos ao longo de estradas e rios é um cenário comum; veja [Map Label Placement in Mapbox GL]

![Posicionamento de rótulos de mapa no Mapbox GL](https://miro.medium.com/v2/resize:fit:480/format:webp/0*qVAASwC-tjIXnjax.gif)

O Kittl oferece uma ferramenta [Easily Type Text On Any Path].

Veja [fabricjs - text on path] para outra implementação. Posicione cada glifo pelo **comprimento de arco** no centro da caixa de avanço e, em seguida, use a tangente nessa mesma distância para a orientação. Um parâmetro de Bézier `t` em geral não é uma fração do comprimento: a amostragem do ponto e da tangente precisa usar o mesmo mapeamento de comprimento de arco, como descrito em [Lição 13 - Amostragem em uma curva].

```ts
const centerDistance =
    startOffset + alignmentOffset + advanceBefore + advance / 2;
const ratio = centerDistance / totalPathLength;
const point = curve.getPointAt(ratio);
const tangent = curve.getTangentAt(ratio);
```

A largura de avanço posiciona o glifo seguinte. Ela difere da largura da textura, dos apoios de tinta e do preenchimento do SDF. `letterSpacing` se aplica apenas entre glifos adjacentes.

### Ajustar a rotação {#adjust-rotation}

A implementação gira cada Quad na CPU em torno da **origem da linha de base do glifo** e, em seguida, o renderiza com SDF/MSDF. Girar em torno da borda inferior da textura deslocaria o texto de forma diferente para cada fonte e tamanho.

```ts
const rotation = Math.atan2(tangent[1], tangent[0]);
const x =
    point[0] -
    (Math.cos(rotation) * advance) / 2 -
    Math.sin(rotation) * pathOffset;
const y =
    point[1] -
    (Math.sin(rotation) * advance) / 2 +
    Math.cos(rotation) * pathOffset;
```

Este exemplo usa a linha de base `alphabetic`; outros ajustes de `textBaseline` também seguem a normal local. Os limites são a união dos retângulos de tinta dos glifos rotacionados, então mudar o conteúdo, o tamanho, o caminho ou os deslocamentos também atualiza os limites de seleção.

| Atributo        | Comportamento                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| `textAlign`     | `start` / `left`, `center` ou `end` / `right`, em relação ao comprimento disponível do caminho                  |
| `startOffset`   | Move o texto alinhado ao longo da direção de leitura, em unidades do documento                                  |
| `side`          | `left` segue o caminho; `right` percorre a partir da outra extremidade e gira os glifos preservando a ordem de leitura |
| `pathOffset`    | Move a linha de base ao longo da normal local; valores positivos ficam 90° no sentido horário a partir da tangente da direção de leitura |
| `letterSpacing` | Acrescenta distância entre glifos adjacentes                                                                    |

Em caminhos abertos, glifos cujo centro cai além de qualquer extremidade são omitidos, em vez de dar a volta ou se empilhar em uma extremidade. Um único contorno fechado pode cruzar a emenda com deslocamentos positivos ou negativos, com no máximo uma volta por linha. Subcaminhos separados concatenam seus comprimentos sem inventar uma linha sobre as lacunas de `M`. Linhas adicionais seguem a normal local no espaçamento da altura de linha.

Arraste o texto ou a alça azul ao longo do caminho, e arraste os pontos de controle laranja para remodelar a curva. Alterne entre uma curva, um círculo e uma linha, mude os lados e o alinhamento, ou ajuste o espaçamento e a distância da linha de base. As alças aceitam as setas do teclado, Shift para passos maiores e Esc para cancelar; um gesto de toque cancelado restaura o estado inicial.

<TextPath />

Este exemplo usa o renderizador de texto SDF do `core`. As melhorias de layout e edição do caminho preservam o pipeline de grafemas existente; elas não acrescentam shaping OpenType completo nem suporte a ligaduras.

O ECS também oferece suporte a esses atributos de caminho, com gestos do transformer, picking de glifos, desfazer/refazer e edição de texto. Experimente o [exemplo de texto em caminho no ECS](/example/text-path#ecs-editor); a edição usa uma caixa de texto reta e, ao confirmar, o layout curvo é restaurado.

### Exportar SVG {#export-svg-text-path}

O SVG nativo oferece suporte a [textPath], como mostrado abaixo; veja [Curved Text Along a Path]. O exportador compartilha o layout da tela e emite elementos `<tspan>` posicionados com `x`, `y` e `rotate` para preservar mudanças de lado, recorte de transbordo e emendas fechadas em navegadores com suporte diferente a `textPath side`. A serialização JSON preserva o caminho, o lado, o alinhamento e os deslocamentos para edição posterior depois da importação.

```html
<path
    id="MyPath"
    fill="none"
    stroke="red"
    d="M10,90 Q90,90 90,45 Q90,10 50,10 Q10,10 10,40 Q10,70 45,70 Q70,70 75,50"
></path>
<text>
    <textPath href="#MyPath">Quick brown fox jumps over the lazy dog.</textPath>
</text>
```

<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <!-- para ocultar o caminho, ele costuma ser envolvido em um elemento <defs> -->
  <!-- <defs> -->
  <path id="MyPath" fill="none" stroke="red" d="M10,90 Q90,90 90,45 Q90,10 50,10 Q10,10 10,40 Q10,70 45,70 Q70,70 75,50"></path>
  <!-- </defs> -->

  <text>
    <textPath href="#MyPath">Quick brown fox jumps over the lazy dog.</textPath>
  </text>
</svg>

## Interação mais amigável {#more-friendly-interaction}

Os `<textarea>` nativos do navegador oferecem recursos convenientes, como cursores piscando, seleções, controle por teclado, copiar e colar e outros. Se você quiser implementar esses recursos do zero com base em `<canvas>`, a tarefa seria muito tediosa, por exemplo [fabricjs - loading custom fonts] e o Google Docs, então não vamos escolher essa opção.

<TextEditor />

### Entrada de texto {#textarea}

Abaixo, a partir do Figma, dá para ver que o elemento nativo `<textarea>` é usado para se posicionar na tela e, quando o Text recebe um clique duplo, a caixa de entrada é exibida:

![textarea no figma](/textarea-in-figma.png)

Isso também é usado no excalidraw; veja: [textWysiwyg.tsx].

![Editor de texto no excalidraw](/excalidraw-text-editor.png)

Também adicionamos um elemento `<ic-text-editor>` para que ele se ajuste o máximo possível à renderização de Text na tela. O elemento nativo `<textarea>` tem o estilo redefinido, por exemplo sem mostrar bordas nem fundos. As propriedades `fontFamily`, `fontSize` e `color` têm propriedades CSS correspondentes que podem ser definidas diretamente, mas há uma série de fatores a considerar ao usar posicionamento absoluto:

```ts
@customElement('ic-text-editor')
export class TextEditor extends LitElement {
    static styles = css`
        :host {
            position: absolute;
        }
        textarea {
            position: absolute;
            display: none;
            margin: 0;
            padding: 0;
            border: 0;
            outline: 0;
            resize: none;
            background: transparent;
        }
    `;

    @query('textarea')
    editable: HTMLTextAreaElement;

    render() {
        return html`<textarea></textarea>`;
    }
}
```

Primeiro é preciso converter as coordenadas da posição do evento de mouse do clique duplo para o sistema de coordenadas do viewport:

```ts
const { x, y } = this.api.canvas2Viewport({
    x: this.node.x,
    y: this.node.y,
});

this.editable.style.left = `${x}px`;
this.editable.style.top = `${y}px`;
```

Em seguida, é preciso considerar o nível de zoom atual da câmera:

```ts
const { zoom } = this.api.getCamera().read(ComputedCamera);
this.editable.style.transform = `scale(${zoom})`;
this.editable.style.transformOrigin = `left top`;
```

Por fim, queremos que a rolagem no elemento `<textarea>` não dispare o comportamento padrão do navegador, e sim atravesse o elemento e dispare no elemento `<canvas>`, que executa as operações de pan e zoom da câmera:

```ts
handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const newWheelEvent = new WheelEvent('wheel', {});
    $canvas.dispatchEvent(newWheelEvent);
};
```

O efeito é o seguinte:

![pan e zoom com a câmera](/text-editor-with-camera.gif)

### Calcular o tamanho quando o texto muda {#calculate-size}

A largura e a altura de `<textarea>` precisam ser recalculadas e definidas em tempo real ao digitar e colar texto.

### Tratar Tab {#in-and-outdent}

O comportamento padrão de pressionar a tecla Tab em `<textarea>` é mudar o foco para o elemento seguinte. Queremos que ele seja igual ao do editor de código.

[excalidraw - handle tab]

### Seleção de texto {#text-selection}

Quando há suporte para sobrepor o textarea ao Text, é fácil implementar esse recurso.

## Efeitos especiais {#special-effects}

### Carregar fontes web {#load-web-font}

Para soluções que usam a API Canvas2D para gerar SDF, basta usar [webfontloader] para carregar as fontes primeiro e, em seguida, especificar a fonte com `fontFamily`.

```ts
import WebFont from 'webfontloader';
WebFont.load({
    google: {
        families: ['Gaegu'], // specify font
    },
    active: () => {
        const text = new Text({
            x: 150,
            y: 150,
            content: 'Hello, world',
            fontFamily: 'Gaegu', // specify font
            fontSize: 55,
            fill: '#F67676',
        });
    },
});
```

<WebFontLoader />

Você também pode mudar para o modo Text e selecionar a fonte personalizada `Gaegu` no exemplo da página inicial:

![WebFont na caneta de texto](/webfont-in-text-pen.png)

### Material Design na GPU {#material-design-on-the-gpu}

[Material Design on the GPU] apresenta um efeito de material baseado em texto SDF, usando mapas de normal e iluminação para simular tinta se espalhando no papel. Não precisamos considerar a iluminação; basta usar ruído simplex para implementar o efeito e adicionar vários efeitos de absorção:

```js
import { simplex_2d } from './simplex-2d';
import { aastep } from './aastep';
export const absorb = /* wgsl */ `
  ${aastep}
  ${simplex_2d}
  float absorb(float sdf, vec2 uv, float scale, float falloff) {
    float distort = sdf + snoise(uv * scale) * falloff;
    return aastep(0.5, distort);
  }
`;
```

<PhysicalText />

## Leitura adicional {#extended-reading}

-   [Material Design on the GPU]
-   [Make text follow a path or a circle]
-   [Curved Text Along a Path]
-   [Draw text along a path]
-   [textPath]
-   [Map Label Placement in Mapbox GL]

[Material Design on the GPU]: https://mattdesl.svbtle.com/material-design-on-the-gpu
[Make text follow a path or a circle]: https://forum.figma.com/t/make-text-follow-a-path-or-a-circle/23476/34
[Curved Text Along a Path]: https://css-tricks.com/snippets/svg/curved-text-along-path/
[Draw text along a path]: https://fiddle.skia.org/c/@Canvas_drawTextRSXform
[textPath]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/textPath
[Map Label Placement in Mapbox GL]: https://blog.mapbox.com/map-label-placement-in-mapbox-gl-c6f843a7caaa
[font-mesh-pipeline]: https://github.com/beanandbean/font-mesh-pipeline
[opentype.js]: https://github.com/opentypejs/opentype.js
[use-gpu-text]: https://gitlab.com/unconed/use.gpu/-/tree/master/rust/use-gpu-text
[harfbuzzjs]: https://github.com/harfbuzz/harfbuzzjs
[State of Text Rendering 2024]: https://behdad.org/text2024/
[webfontloader]: https://github.com/typekit/webfontloader
[DropShadowFilter]: https://pixijs.io/filters/docs/DropShadowFilter.html
[MathJax]: https://github.com/mathjax/MathJax-src
[LaTeX in motion-canvas]: https://github.com/motion-canvas/motion-canvas/issues/190
[Lição 10 - De SVGElement ao nó serializado]: /pt-BR/guide/lesson-010#svgelement-to-serialized-node
[path-commands]: https://github.com/opentypejs/opentype.js?tab=readme-ov-file#path-commands
[text-decoration]: https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration
[Easily Type Text On Any Path]: https://www.kittl.com/article/easily-type-text-on-any-path
[textWysiwyg.tsx]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx
[fabricjs - text on path]: https://fabricjs.com/demos/text-on-path/
[fabricjs - loading custom fonts]: https://fabricjs.com/demos/loading-custom-fonts/
[excalidraw - handle tab]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx#L412-L429
[underlineJS]: https://github.com/wentin/underlineJS
[Crafting link underlines on Medium]: https://medium.design/crafting-link-underlines-on-medium-7c03a9274f9
[-webkit-text-stroke]: https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-text-stroke
[strokeText]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/strokeText
[Decorations::calculatePosition]: https://github.com/google/skia/blob/main/modules/skparagraph/src/Decorations.cpp#L161-L185
[Lição 13 - Amostragem em uma curva]: /pt-BR/guide/lesson-013#sample-on-curve
[Text decoration of a text svg in html]: https://stackoverflow.com/questions/76894327/text-decoration-of-a-text-svg-in-html
[Type text on a path]: https://help.figma.com/hc/en-us/articles/360039956434-Guide-to-text-in-Figma-Design#h_01JTH0B6GEA7AVVXVS72X7ANHK
