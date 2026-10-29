---
outline: deep
description: 'Use o pós-processamento para processar a imagem. Use o grafo de renderização para otimizar o pipeline.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lição 30 - Pós-processamento e grafo de renderização',
          },
      ]
---

<script setup>
import ImageProcessing from '../../components/ImageProcessing.vue'
import HalftoneDots from '../../components/HalftoneDots.vue'
import Pixelate from '../../components/Pixelate.vue'
import CRT from '../../components/CRT.vue'
import Glitch from '../../components/Glitch.vue'
import LiquidGlass from '../../components/LiquidGlass.vue'
import LiquidMetal from '../../components/LiquidMetal.vue'
import Heatmap from '../../components/Heatmap.vue'
import GenSmoke from '../../components/GenSmoke.vue'
import Ascii from '../../components/Ascii.vue'
import GlobalEffects from '../../components/GlobalEffects.vue'
</script>

# Lição 30 - Pós-processamento e grafo de renderização {#lesson-30-post-processing-and-render-graph}

Nesta lição, voltamos ao pós-processamento tradicional de imagens baseado em shaders (passes de tela cheia, amostragem e efeitos comuns) e, em seguida, apresentamos como usar um grafo de renderização para organizar vários passes, gerenciar render targets e a sincronização, e otimizar o pipeline completo de pós-processamento.

## Efeitos de pós-processamento {#post-processing}

Com base em shaders, dá para obter efeitos comuns de processamento de imagem, como desfoque gaussiano, ruído de Perlin, glitch e, claro, o “vidro líquido” que anda popular:

![fonte: https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers](/figma-liquid-glass.png)

![Ajuste no Photoshop Web](/adjust-ps-web.png)

Para mais efeitos, veja:

-   [Image Processing]
-   [glfx.js]
-   [Paper Shaders]

Na implementação, os [Pixi.js filters] calculam a área de aplicação com base na caixa delimitadora do objeto, renderizam o objeto em uma textura de renderização temporária e depois aplicam efeitos de shader a essa textura.

### Renderizar para o RenderTarget {#render-to-render-target}

No Pixi.js:

```ts
// src/filters/FilterSystem.ts
const quadGeometry = new Geometry({
    attributes: {
        aPosition: {
            buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
            format: 'float32x2',
            stride: 2 * 4,
            offset: 0,
        },
    },
    indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
});
```

### Amostrar {#sample}

Em seguida, precisamos amostrar, a partir da textura da tela inteira, a área em que a forma alvo está:

```glsl
void main() {
  v_Uv = a_Position * (u_OutputFrame.zw / u_InputSize.xy) + u_OutputFrame.xy / u_InputSize.xy;

  gl_Position = vec4((a_Position * 2.0 - 1.0) * u_OutputTexture.xy / u_OutputFrame.zw * u_OutputTexture.z, 0.0, 1.0);
}
```

### Triângulo grande {#big-triangle}

Aqui dá para usar um triângulo de tela cheia, que reduz um vértice em relação a um Quad. Veja: [Optimizing Triangles for a Full-screen Pass]

![O retângulo azul representa o viewport. Em vermelho, os limites da geometria](https://wallisc.github.io/assets/FullscreenPass/1tri.jpg)

```ts
this.#bigTriangleVertexBuffer = this.device.createBuffer({
    viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
    usage: BufferUsage.VERTEX,
    hint: BufferFrequencyHint.DYNAMIC,
});
```

O vertex shader é bem simples; ele só precisa mapear corretamente as coordenadas de textura `v_Uv`:

```glsl
void main() {
  v_Uv = 0.5 * (a_Position + 1.0);
  gl_Position = vec4(a_Position, 0.0, 1.0);

  #ifdef VIEWPORT_ORIGIN_TL
    v_Uv.y = 1.0 - v_Uv.y;
  #endif
}
```

### Vários preenchimentos e ordem dos filtros {#fill-filter-order}

No ECS, os filtros de raster em primitivas SDF e em Paths rodam depois que os `fills` habilitados foram compostos na ordem de pintura. A opacidade da camada e os modos de mistura participam dessa composição; a cadeia de filtros processa a textura resultante uma vez, e a opacidade da forma se aplica ao desenho final. Aplicar a mesma cadeia separadamente a cada camada pode substituir texturas de que as camadas anteriores ainda precisam.

Por exemplo, um preenchimento inferior vermelho e um preenchimento superior azul com `opacity: 0.5` continuam roxos sob `brightness(0) contrast(0)`. Esses dois filtros usam a convenção de ajuste do glfx, em que zero é neutro. Efeitos não neutros são executados na ordem escrita na string `filter`; trocar brilho e contraste pode mudar o resultado.

Mudar preenchimentos ou a geometria reconstrói a entrada de raster afetada. Remover os filtros de raster libera a cadeia offscreen, inclusive quando a forma volta ao desenho direto em cor sólida. As texturas intermediárias de camada são liberadas depois da composição, e as texturas de renderização anexadas são liberadas por meio dos seus render targets.

### Alfa nos filtros de cor {#filter-alpha}

Os ajustes de brilho, contraste, matiz/saturação, ruído, pontos e meio-tom em cores operam sobre RGB direto, independentemente do alfa da pintura. As texturas de preenchimento por forma armazenam RGBA direto; os filtros da tela inteira recebem RGBA pré-multiplicado e o convertem para o ajuste. O RGB é limitado ao intervalo exibível antes da pré-multiplicação, enquanto o alfa é preservado. Isso também impede que um resultado intermediário claro demais mude o filtro seguinte de forma inesperada.

Por exemplo, `rgba(64,128,192,0.5)` com `brightness(0.2)` passa a ser aproximadamente `rgba(115,179,243,0.5)` antes de a opacidade da forma ser aplicada. Diminuir o alfa da pintura não deve reduzir o próprio ajuste de brilho. Esses filtros de cor atualizam uniforms comuns no WebGL1 e também uniform buffers no WebGL2; blocos escalares std140 mantêm o alinhamento obrigatório de 16 bytes no WebKit.

### Desfoque fora da forma original {#blur-bounds}

Para primitivas SDF e preenchimentos comuns de Path, um `blur()` positivo primeiro captura o preenchimento da forma, a silhueta e o traço sólido SDF em uma textura com padding transparente. O desenho final cobre essa área com padding, então o desfoque pode se estender além das bordas arredondadas e para dentro dos buracos do Path. Só os limites de renderização se expandem; a geometria de seleção permanece inalterada. Por exemplo, `filter: 'blur(6px, 3)'` suaviza o contorno, enquanto `blur(0px)` o preserva.

A amostragem interpola texels pré-multiplicados antes de converter de volta para RGBA direto. Isso faz a borda azul translúcida continuar azul, em vez de misturar preto transparente no RGB dela, inclusive ao ampliar o zoom. O padding inclui a área de amostragem de cada passe e de cada desfoque consecutivo. O WebGL1 atualiza os uniforms de kernel de cada passe imediatamente antes do desenho.

Esse caminho de captura cobre, no momento, preenchimentos e traços sólidos SDF e preenchimentos comuns de Path/VectorNetwork. Texto, traços separados de Path, preenchimentos rough, desenhos de wireframe/stencil e entradas externas de `FillTexture` mantêm os caminhos de filtro existentes; eles ainda não recebem essa geometria expandida. A renderização completa em WebGPU ainda precisa de validação separada.

### Brilho e contraste {#brightness-contrast}

Dá para usar a sintaxe de [CSS filter], por exemplo `filter: brightness(0.4);`

O shader a seguir ilustra o caminho de tela cheia pré-multiplicado; veja [brightnesscontrast.js]. Os filtros por forma usam as funções auxiliares de alfa compartilhadas para manter RGBA direto.

```glsl
uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_BrightnessContrast;
};

out vec4 outputColor;

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  float brightness = u_BrightnessContrast.x;
  float contrast = u_BrightnessContrast.y;

  if (color.a > 0.0) {
    color.rgb /= color.a;
    color.rgb += brightness;
    if (contrast > 0.0) {
      color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;
    } else {
      color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;
    }
    color.rgb = clamp(color.rgb, 0.0, 1.0) * color.a;
  } else {
    color = vec4(0.0);
  }

  outputColor = color;
}
```

<ImageProcessing />

### Ruído {#noise}

O ruído no pós-processamento costuma ser gerado a partir do UV da tela como valores pseudoaleatórios sobrepostos ao RGB, simulando granulação de filme, interferência de sinal e efeitos parecidos. A implementação neste tutorial segue o [filtro de ruído do glfx.js][glfx-noise], usando aleatoriedade uniforme e um fator de intensidade `u_Noise` para controlar a perturbação. Antes de escrever, a pré-multiplicação das cores é desfeita e elas são multiplicadas de novo pelo alfa, para evitar bordas cinza na transparência.

Na string `filter` dá para escrever `noise(0.1)`; o valor entre parênteses é a intensidade (aproximadamente 0–1). Se você partir de ferramentas de design, também dá para comparar a [camada de ruído do Spline][Spline - Noise Layer]: ela também empilha ruído procedural sobre materiais e preenchimentos; aqui aplicamos um passe de tela cheia sobre uma textura já rasterizada.

### Meio-tom {#halftone}

O meio-tom modula a luminosidade com um padrão regular para simular pontos de impressão.

-   **Ponto (retícula de meio-tom)**: Veja [Pixi `dot.frag`][dot.frag]: amostre `sin(x)·sin(y)` em coordenadas rotacionadas para pontos em preto e branco; pode ser combinado com escala de cinza para impressão antiga e meio-tom de quadrinhos. Exemplo de `filter`: `dot(1, 5, 1)` (escala, ângulo, escala de cinza ligada/desligada).
-   **Meio-tom em cores**: Veja [glfx `colorhalftone.js`][colorhalftone.js]: trate o RGB no estilo CMY/K e module ciano, magenta, amarelo e preto com quatro grades senoidais em fases diferentes, para um visual de impressão colorida. A forma curta `color-halftone(6)` (só o diâmetro do ponto), ou `color-halftone(6, 0.5)` (diâmetro e ângulo em radianos); a forma completa de quatro parâmetros pode definir o centro e o ângulo do padrão.

```glsl
float halftonePattern(float rotAngle) {
// Continuous sine screen; no dot shape, grain, hex grid, etc.
  float s = sin(rotAngle), c = cos(rotAngle);
  vec2 tex = v_Uv * u_CH1.xy - u_CH0.xy;
  vec2 point = vec2(
    c * tex.x - s * tex.y,
    s * tex.x + c * tex.y
  ) * u_CH0.w;
  return (sin(point.x) * sin(point.y)) * 4.0;
}

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  // ...
  vec3 cmy = 1.0 - color.rgb; // CMYK separation
  float k = min(cmy.x, min(cmy.y, cmy.z));
  // ...
  cmy = clamp(
    cmy * 10.0 - 3.0 + vec3(
      halftonePattern(baseAngle + 0.26179),
      halftonePattern(baseAngle + 1.30899),
      halftonePattern(baseAngle)
    ),
    0.0,
    1.0
  );
  k = clamp(k * 10.0 - 5.0 + halftonePattern(baseAngle + 0.78539), 0.0, 1.0);
  vec3 rgb = 1.0 - cmy - vec3(k);
  // ...
}
```

[Paper Shaders] adota outra abordagem, com suporte a pontos grandes no estilo de jornal, tamanho do ponto ligado à luminosidade e formas de ponto trocáveis, grades hexagonais, granulação e mais.

<HalftoneDots />

### Pixelizar {#pixelate}

Amostre e amplie blocos para um mosaico; veja [Pixi `pixelate.frag`][pixelate.frag], por exemplo `pixelate(12px)`. Também dá para aplicar isso a gradientes com ruído sobreposto.

<Pixelate />

### CRT e vinheta {#crt-vignette}

Imite o visual de um CRT antigo, mais a vinheta:

<CRT />

### Glitch {#glitch}

-   [CSSGlitchEffect]
-   [unityglitch]

<Glitch />

### Ascii {#ascii}

Primeiro divida a imagem em células usando `uSize` e calcule a escala de cinza; escolha uma constante de bitmap `n` a partir do nível de cinza e, para cada pixel da célula, use os bits de `n` para decidir claro ou escuro e multiplique na cor. Essa é a abordagem usual de fonte bitmap / arte ASCII — não glifos vetoriais nem fontes texturizadas.

```glsl
float n = 65536.0;
if (gray > 0.2) n = 65600.0; // .
if (gray > 0.3) n = 332772.0; // :
if (gray > 0.4) n = 15255086.0; // *
if (gray > 0.5) n = 23385164.0; // o
```

<Ascii />

### Vidro líquido {#liquid-glass}

<LiquidGlass />

### Metal líquido {#liquid-metal}

<LiquidMetal />

### Mapa de calor {#heatmap}

<Heatmap />

### Fumaça gerada {#gen-smoke}

<GenSmoke />

### Animação no tempo {#time-animation}

Alguns efeitos de pós-processamento podem ser animados; em geral, um valor de tempo por quadro é passado (semelhante a `u_Time` no Shadertoy):

```ts
export class PostEffectTime extends System {
    execute() {
        setPostEffectEngineTimeSeconds(perf.now() / 1000);
    }
}
```

[Lição 10 - Exportar GIF]

## Grafo de renderização {#render-graph}

Um Render Graph (às vezes chamado de FrameGraph) é uma arquitetura moderna de renderização que modela o processo de renderização como um grafo acíclico dirigido (DAG). Nesse modelo, cada passe de renderização e os recursos que ele usa são tratados como nós e arestas; a estrutura do grafo gerencia automaticamente as transições de estado dos recursos, a sincronização e o tempo de vida.

-   [FrameGraph: Extensible Rendering Architecture in Frostbite]
-   [Why Talking About Render Graphs]

![Exemplo de frame graph](/frame-graph.png)

O uso em [Render graph in bevy] é o seguinte:

```rs
// @see https://docs.rs/bevy/latest/bevy/render/render_graph/struct.RenderGraph.html
let mut graph = RenderGraph::default();
graph.add_node(Labels::A, MyNode);
graph.add_node(Labels::B, MyNode);
graph.add_node_edge(Labels::B, Labels::A);
```

### Conceito do design {#design-concept}

Tomamos como referência a implementação de grafo de renderização do [noclip], que usa um design em três fases:

1. Fase de construção do grafo: define de forma declarativa o pipeline de renderização. Vamos ver como ela é usada na próxima subseção.
2. Fase de agendamento: aloca e reutiliza recursos automaticamente. Isso pode ser dividido ainda em:

    - Fase de estatísticas: percorre todos os passes para contar as referências de cada RenderTarget e ResolveTexture
    - Fase de alocação: aloca recursos sob demanda. Recupera do pool de objetos ou cria no primeiro uso. Reutiliza recursos com as mesmas especificações. Devolve ao pool de objetos quando a contagem de referências chega a zero.
    - Fase de liberação: devolve ao pool de objetos quando a contagem de referências chega a zero.

3. Fase de execução: executa os passes de renderização em sequência.

A estrutura de dados do grafo de renderização é a seguinte. Ela armazena uma descrição declarativa do grafo de renderização, sem recursos reais. Só registra as relações de ID entre Passes e Render Targets.

```ts
class GraphImpl {
    renderTargetDescriptions: Readonly<RGRenderTargetDescription>[] = [];
    resolveTextureRenderTargetIDs: number[] = [];
    passes: RenderGraphPass[] = [];
}
```

### Uso {#usage}

Sempre que for preciso repintar, um novo RenderGraphBuilder é criado para construir o DAG. No momento, esse DAG simples inclui um passe principal de renderização que envia os resultados para um ColorRT e um DepthRT. Em seguida, vamos adicionar passes extras com `pushPass`. O ColorRT pode ser consumido como entrada e, no fim, esse ColorRT será renderizado na tela. A lógica principal de renderização fica escrita na função de callback de `pass.exec`, que recebe um objeto `RenderPass`. Para detalhes, veja: [Lição 2].

```ts
const builder = renderGraph.newGraphBuilder();
builder.pushPass((pass) => {
    pass.setDebugName('Main Render Pass');
    pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);
    pass.attachRenderTargetID(RGAttachmentSlot.DepthStencil, mainDepthTargetID);
    pass.exec((renderPass) => {
        // Render grid
        // Render shapes in current scene
    });
});
builder.resolveRenderTargetToExternalTexture(
    mainColorTargetID,
    onscreenTexture,
);
renderGraph.execute();
```

### FXAA {#fxaa}

Agora criamos um passe FXAA separado, fora do passe principal de renderização, para antialiasing rápido. Ao contrário de métodos tradicionais como o MSAA, baseado em amostragem geométrica, o FXAA não exige amostras extras nem conhecimento da geometria da cena; ele processa os pixels finais diretamente, então o custo de desempenho é bem baixo. Esse método converte RGB em escala de cinza usando os pesos NTSC `0.299R + 0.587G + 0.114B` para detecção de bordas:

```glsl
float MonochromeNTSC(vec3 t_Color) {
  // NTSC primaries.
  return dot(t_Color.rgb, vec3(0.299, 0.587, 0.114));
}
```

De volta à sintaxe declarativa do grafo de renderização. Primeiro, obtenha o ColorRT do passo anterior:

```ts
builder.pushPass((pass) => {
    pass.setDebugName('FXAA');
    pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);

    const mainColorResolveTextureID =
        builder.resolveRenderTarget(mainColorTargetID);
    pass.attachResolveTexture(mainColorResolveTextureID);

    pass.exec((passRenderer, scope) => {
        postProcessingRenderer.render(
            passRenderer,
            scope.getResolveTextureForID(mainColorResolveTextureID),
        );
    });
});
```

Aplicamos os três efeitos de pós-processamento a seguir à tela inteira:

```ts
api.setAppState({
    filter: 'fxaa() brightness(0.8) noise(0.1)',
});
```

<GlobalEffects />

## Leitura adicional {#extended-reading}

-   [Blob Tracking]
-   [reveals.cool]
-   [Liquid Metal Logo]

[Paper Shaders]: https://shaders.paper.design/
[Pixi.js filters]: https://github.com/pixijs/filters
[CSS filter]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter
[Image Processing]: https://luma.gl/docs/api-reference/shadertools/shader-passes/image-processing
[glfx.js]: https://github.com/evanw/glfx.js
[brightnesscontrast.js]: https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/brightnesscontrast.js
[FrameGraph: Extensible Rendering Architecture in Frostbite]: https://www.gdcvault.com/play/1024612/FrameGraph-Extensible-Rendering-Architecture-in
[Why Talking About Render Graphs]: https://logins.github.io/graphics/2021/05/31/RenderGraphs.html
[Render graph in bevy]: https://github.com/bevyengine/bevy/discussions/2524
[noclip]: https://github.com/magcius/noclip.website
[Lição 2]: /pt-BR/guide/lesson-002
[Spline - Noise Layer]: https://docs.spline.design/materials-shading/noise-layer
[glfx-noise]: https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/noise.js
[dot.frag]: https://github.com/pixijs/filters/blob/main/src/dot/dot.frag
[colorhalftone.js]: https://github.com/evanw/glfx.js/blob/master/src/filters/fun/colorhalftone.js
[pixelate.frag]: https://github.com/pixijs/filters/blob/main/src/pixelate/pixelate.frag
[Blob Tracking]: https://www.shadertoy.com/view/3fBXDD
[Optimizing Triangles for a Full-screen Pass]: https://wallisc.github.io/rendering/2021/04/18/Fullscreen-Pass.html
[CSSGlitchEffect]: https://tympanus.net/Tutorials/CSSGlitchEffect/
[unityglitch]: https://github.com/staffantan/unityglitch/blob/master/GlitchShader.shader
[reveals.cool]: https://reveals.cool/
[Liquid Metal Logo]: https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/liquid-metal.ts
[Lição 10 - Exportar GIF]: /pt-BR/guide/lesson-010#to-gif
