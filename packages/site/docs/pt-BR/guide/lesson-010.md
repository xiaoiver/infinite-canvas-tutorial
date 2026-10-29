---
outline: deep
description: 'Aprenda a exportar o conteúdo da tela para os formatos PNG, JPEG e SVG. Implemente a renderização de imagens na tela e estenda as capacidades do SVG com recursos como stroke-alignment para ferramentas de design mais completas.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lição 10 - Importar e exportar imagens',
          },
      ]
---

<script setup>
import ObjectFit from '../../components/ObjectFit.vue';
</script>

# Lição 10 - Importar e exportar imagens {#lesson-10-importing-and-exporting-images}

Importar e exportar imagens é um recurso muito importante no Infinite Canvas e, por meio da imagem exportada, é possível se integrar a outras ferramentas. Então, embora as capacidades de desenho da nossa tela ainda sejam limitadas, vale pensar com antecedência nas questões relacionadas a imagens. Nesta lição, você vai aprender o seguinte:

-   Exportar o conteúdo da tela para PNG, JPEG e SVG, e exportar efeitos baseados em tempo para GIF
-   Renderizar imagens na tela, incluindo `object-fit` / `object-position` em preenchimentos de imagem
-   Estender as capacidades do SVG, usando `stroke-alignment` como exemplo.

## Exportar o conteúdo da tela para imagem {#export-canvas-to-image}

Primeiro, vamos ver como exportar o conteúdo de uma tela para uma imagem. O artigo [Export from Figma] descreve como exportar uma tela para vários formatos, inclusive PNG, usando a ferramenta de fatia no Figma.

![exportar do figma](https://help.figma.com/hc/article_attachments/24423129974679)

Algumas bibliotecas de gráficos baseadas em implementações Canvas2D também oferecem a capacidade de salvar o conteúdo em uma imagem. A imagem abaixo é do Highcharts, e você pode ver que ela também oferece a capacidade de exportar imagens em vários formatos, o que dispara o comportamento de download do navegador imediatamente após o clique:

<img alt="exportador no highcharts" src="https://user-images.githubusercontent.com/3608471/174998577-df1c54e9-d981-4d82-a4aa-7f0bedfb11a1.png" width="300" />

Gostaríamos de implementar a funcionalidade de exportação a seguir:

-   Suporte a vários formatos de imagem: PNG, JPEG e SVG.
-   Suporte a especificar a área de recorte
-   Suporte a escolher se uma grade é incluída ou não

Para isso, projetamos o exportador de imagem para ser usado da seguinte forma:

```ts
const exporter = new ImageExporter({
    canvas,
});

const canvas = await exporter.toCanvas(); // HTMLCanvasElement
const dataURL = canvas.toDataURL(); // data:...

exporter.downloadImage({
    dataURL,
    name: 'my-file',
});
```

Porém, há uma diferença “ligeira” entre os diferentes formatos de imagem. Abaixo, primeiro apresentamos a forma de exportar imagens no formato PNG / JPEG.

### Exportar PNG / JPEG {#to-raster-image}

[HTMLCanvasElement.toDataURL()] pode obter a imagem correspondente ao conteúdo da tela como [DataURI]. Pelo parâmetro `type` é possível especificar o formato da imagem, com suporte a PNG / JPEG e WebP.

```js
var canvas = document.getElementById('canvas');
var dataURL = canvas.toDataURL(); // 默认为 PNG
console.log(dataURL);
// "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNby
// blAAAADElEQVQImWNgoBMAAABpAAFEI8ARAAAAAElFTkSuQmCC"
```

Então adicionamos um método `toCanvas` ao exportador de imagem. Esse método serve para desenhar o conteúdo da tela da área especificada em um HTMLCanvasElement adicional, que depois pode ser manipulado conforme a necessidade, por exemplo adicionando uma cor de fundo, uma marca d'água e assim por diante. A assinatura completa do método está abaixo. Vale notar que esse método é assíncrono, e vamos explicar o motivo mais adiante:

```ts
toCanvas(options: Partial<CanvasOptions> = {}): Promise<HTMLCanvasElement>;

interface CanvasOptions {
  grid: boolean;
  clippingRegion: Rectangle;
  beforeDrawImage: (context: CanvasRenderingContext2D) => void;
  afterDrawImage: (context: CanvasRenderingContext2D) => void;
}
```

O significado de cada item de configuração é o seguinte:

-   `grid` Se uma grade deve ser incluída
-   `clippingRegion` A região de recorte da tela, representada por um retângulo.
-   `beforeDrawImage` Chamado antes de desenhar o conteúdo da tela, adequado para desenhar a cor de fundo.
-   `afterDrawImage` Chamado depois de desenhar o conteúdo da tela, adequado para desenhar marcas d'água.

O exemplo completo de uso é o seguinte:

```ts
const canvas = await exporter.toCanvas({
    clippingRegion: new Rectangle(
        clippingRegionX,
        clippingRegionY,
        clippingRegionWidth,
        clippingRegionHeight,
    ),
    beforeDrawImage: (context) => {
        // Customize background-color
        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, clippingRegionWidth, clippingRegionHeight);
    },
    afterDrawImage: (context) => {
        // Watermark
        context.font = '24px Times New Roman';
        context.fillStyle = '#FFC82C';
        context.fillText('Watermark', 20, 20);
    },
});
```

Colocamos o menu suspenso Exportar imagem no canto superior direito da tela. Se tiver interesse nos componentes, consulte: [Interface web com Lit e Shoelace].

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

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

        for (let i = 0; i < 100; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;
            const circle = new Circle({
                cx: Math.random() * 600,
                cy: Math.random() * 400,
                r: Math.random() * 40,
                fill,
            });
            canvas.appendChild(circle);

            circle.addEventListener('pointerenter', () => {
                circle.fill = 'red';
            });
            circle.addEventListener('pointerleave', () => {
                circle.fill = fill;
            });
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

Agora vamos responder por que o método `toCanvas` foi projetado para ser assíncrono. Como WebGL / WebGPU usam o mecanismo de buffer duplo da [SwapChain], e o valor padrão de [preserveDrawingBuffer] é `false` ao criar o contexto, você precisa garantir que a renderização não seja limpa (por exemplo, chamando `gl.clear()`) ao chamar `toDataURL`; caso contrário, você obtém uma imagem em branco. Adicionamos a lógica a seguir ao hook `endFrame` em [Arquitetura baseada em plugins] para salvar o conteúdo da tela assim que o comando de exportação é recebido, antes do fim do quadro atual, para o caso de ele ser limpo quando o próximo quadro chegar, o que tornaria o comportamento assíncrono.

```ts
hooks.endFrame.tap(() => {
    this.#device.endFrame();

    // capture here since we don't preserve drawing buffer
    if (this.#enableCapture && this.#resolveCapturePromise) {
        const { type, encoderOptions } = this.#captureOptions;
        const dataURL = (
            this.#swapChain.getCanvas() as HTMLCanvasElement
        ).toDataURL(type, encoderOptions);
        this.#resolveCapturePromise(dataURL);
        this.#enableCapture = false;
        this.#captureOptions = undefined;
        this.#resolveCapturePromise = undefined;
    }
});
```

Além disso, você pode escolher se inclui ou não a [Grade] na imagem exportada. Por enquanto, não usamos as funções de recorte e de marca d'água no processamento posterior. Como a implementação de um recurso de “fatiamento” parecido com o do Figma exige uma interação de seleção por caixa, ela será apresentada em uma implementação posterior. Agora vamos voltar a outro formato de imagem especial.

### Exportar SVG {#to-vector-image}

As vantagens dos gráficos vetoriais em relação aos bitmaps são:

-   Escala infinita sem distorção. Isso significa que eles podem ser ampliados ou reduzidos indefinidamente sem perder nitidez, o que os torna ideais para situações em que várias resoluções são necessárias.
-   Editabilidade: SVGs são arquivos de texto que podem ser editados com qualquer editor de texto, o que facilita modificar os atributos e o estilo do gráfico.
-   SVGs são arquivos de texto que podem ser editados com qualquer editor de texto, o que facilita modificar os atributos e os estilos dos gráficos.

Portanto, as ferramentas de design precisam oferecer suporte à conversão para esse formato. Para a nossa tela infinita, podemos converter o problema em: **Como serializar o grafo de cena**, incluindo os atributos de desenho de cada nó, as transformações e assim por diante. Quanto ao formato da serialização, além de JSON, como o projeto das propriedades de desenho dos nossos gráficos 2D em si referencia bastante as implementações SVG, é natural exportar para SVG.

Curiosamente, o Three.js também oferece [toJSON] para salvar o estado atual da cena (incluindo objetos, transformações, materiais etc.) como [JSON-Object-Scene-format-4]. Ele até inclui um [SVGRenderer] para renderizar gráficos 3D da melhor forma possível sob condições limitadas (sem sombreamento complexo, sombras).

#### De Shape para SerializedNode {#shape-to-serialized-node}

Muitas ferramentas de quadro branco também oferecem formatos personalizados de serialização de gráficos, como [JSON objects in tldraw] e [JSON schema in excalidraw].

Percorrido a partir do nó raiz do grafo de cena, chamado de forma recursiva nos elementos filhos. Atributos como `transform`, com valores estruturais complexos (`position/scale/rotation`), exigem processamento adicional:

```ts
function serializeNode(node: Shape): SerializedNode {
    const [type, attributes] = typeofShape(node);
    const data: SerializedNode = {
        type,
        attributes,
    };
    data.attributes.transform = serializeTransform(node.transform);
    data.children = node.children.map(serializeNode);
    return data;
}
```

Tome o Circle abaixo como exemplo: obtemos o objeto serializado dele:

```js eval code=true
serializedCircle = call(() => {
    const { Circle, serializeNode } = Lesson10;
    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
    });
    circle.transform.position.x = 100;
    return serializeNode(circle);
});
```

Ele pode ser importado para a tela pelo método de desserialização. `deserializeNode` cria o gráfico correspondente com base no atributo `type` do nó serializado, atribuindo valores aos atributos de desenho:

```js eval code=false inspector=false
canvas2 = (async () => {
    const { Canvas } = Lesson10;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

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

```js eval code=true
call(async () => {
    const { deserializeNode } = Lesson10;
    const circle = await deserializeNode(serializedCircle);
    canvas2.root.appendChild(circle);
    return canvas2.getDOM();
});
```

Os métodos de serialização e desserialização da tela inteira podem ser aplicados apenas ao nó raiz, mas, é claro, os listeners de evento não podem ser serializados:

```ts
const json = JSON.stringify(serializeNode(canvas.root)); // {}
canvas.root = (await deserializeNode(JSON.parse(json))) as Group;
```

#### De SerializedNode para SVGElement {#serialized-node-to-svgelement}

Neste ponto, é fácil converter o nó serializado em [SVG Element]. Adicionamos o método utilitário a seguir:

```ts
export function toSVGElement(node: SerializedNode): SVGElement;
```

A maioria dos atributos, como `fill / stroke / opacity`, são atributos SVG de mesmo nome, então podem ser atribuídos diretamente usando [setAttribute], mas há alguns atributos especiais que precisam ser tratados de forma especial, por exemplo:

-   `transform` Usamos o objeto `Transform` em `@pixi/math`, e precisamos que `position / rotation / scale` sejam convertidos para `matrix()`.
-   `transform-origin` corresponde ao atributo `pivot` em `transform`.
-   `innerShadow` não tem a propriedade SVG de mesmo nome; precisa ser implementado com um filtro.
-   `outerShadow` O mesmo que acima

O exemplo a seguir mostra o efeito de um círculo serializado convertido em um `<circle>`, que precisa ser embutido em [\<svg\>] para ser exibido em uma página HTML, com as mesmas dimensões da tela:

```js eval code=true
call(() => {
    const { toSVGElement } = Lesson10;

    const $circle = toSVGElement(serializedCircle);
    const $svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    $svg.setAttribute('width', '200');
    $svg.setAttribute('height', '200');
    $svg.appendChild($circle);

    return $svg;
});
```

#### De SVGElement para SerializedNode {#svgelement-to-serialized-node}

Naturalmente, também precisamos de um método de conversão de SVGElement para SerializedNode:

```ts
export function fromSVGElement(element: SVGElement): SerializedNode;
```

Observe que essa conversão não é totalmente reversível. Por exemplo, na [implementação do StrokeAlignment](#stroke-alignment-export-svg), que veremos mais adiante, um Circle corresponde a dois `<circle>`. O mesmo acontece no Figma, em que a imagem a seguir mostra a importação de um efeito de Ellipse exportado anteriormente, e você pode ver que as duas formas não são idênticas.

![importar uma elipse exportada no Figma](/import-exported-ellipse.png)

[@pixi-essentials/svg] também quer converter SVGElement em formas no Pixi.js; veja [Vector rendering of SVG content with PixiJS].

#### Grafo de cena no SVG {#scene-graph-in-svg}

Outro ponto a observar é que, embora qualquer gráfico no nosso grafo de cena possa ter nós filhos, no SVG só `<g>` pode ter filhos e, fora isso, por exemplo, `<circle>` não pode ter filhos. A solução é simples: para elementos que não são Group e têm filhos, gere o SVG com um `<g>` por fora e aplique o `transform` que teria sido aplicado a ele. Supondo que no futuro tenhamos suporte a renderizar texto, o SVG de um Circle com filhos de texto ficaria assim:

```html
<g transform="matrix(1,0,0,0,1,0)">
    <circle cx="100" cy="100" r="100" fill="red" />
    <text />
</g>
```

#### Exportar inner e outerShadow {#export-inner-outer-shadow}

Consultando [Adding Shadows to SVG Icons With CSS and SVG Filters], usamos [filter primitive] para realizar sombras internas e externas. Exemplo de sombras externas:

```ts
const $feDropShadow = createSVGElement('feDropShadow', doc);
$feDropShadow.setAttribute('dx', `${(dropShadowOffsetX || 0) / 2}`);
$feDropShadow.setAttribute('dy', `${(dropShadowOffsetY || 0) / 2}`);
$feDropShadow.setAttribute(
    'stdDeviation',
    `${(dropShadowBlurRadius || 0) / 4}`,
);
$feDropShadow.setAttribute('flood-color', dropShadowColor);
$filter.appendChild($feDropShadow);
```

As sombras internas são um pouco mais complicadas, então não vou detalhar por falta de espaço. Você pode baixar o SVG para vê-lo no exemplo abaixo:

```js eval code=false
$icCanvas4 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect } = Lesson10;

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

        const rect = new Rect({
            x: 50,
            y: 50,
            fill: 'green',
            cornerRadius: 50,
            batchable: false,
            innerShadowColor: 'black',
            innerShadowOffsetX: 10,
            innerShadowOffsetY: 10,
            innerShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            dropShadowBlurRadius: 10,
        });
        rect.width = 400;
        rect.height = 100;
        canvas.appendChild(rect);
    });

    $icCanvas4.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

#### Exportar imagem como valor de fill {#export-image-as-fill-value}

Embora ainda não tenhamos coberto a implementação da imagem de preenchimento, serializar diretamente o valor Image da propriedade `fill` resultaria no seguinte:

```html
<circle fill="[object ImageBitmap]" />
```

Isso obviamente não é exibido direito. Precisamos serializar o objeto Image para uma DataURL: basta desenhar a imagem em um `<canvas>` e usar o método `toDataURL` que apresentamos na seção anterior. Consultando [Convert ImageBitmap to Blob], primeiro tentei [ImageBitmapRenderingContext]. O ImageBitmap pode decodificar a imagem de forma assíncrona sem bloquear a thread principal, o que ajuda a melhorar o desempenho e a capacidade de resposta da aplicação.

```ts
async function imageBitmapToURL(bmp: ImageBitmap) {
    const canvas = document.createElement('canvas');
    // resize it to the size of our ImageBitmap
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    // get a bitmaprenderer context
    const ctx = canvas.getContext('bitmaprenderer');
    ctx.transferFromImageBitmap(bmp);
    const blob = await new Promise<Blob>((res) => canvas.toBlob(res));
    return canvas.toDataURL();
}
```

Infelizmente, recebemos o erro a seguir. O motivo é que já criamos uma textura usando esse ImageBitmap e não podemos transferir o controle dele para o novo `<canvas>`.

> [!CAUTION]
> O ImageBitmap de entrada foi desanexado

Então só podemos usar o método comum `drawImage` para desenhar a imagem no `<canvas>`.

#### Exportação de pintura ECS e geometria rough {#ecs-export-paints}

O exportador ECS lê a primeira camada habilitada em `fills` e `strokes`. Um preenchimento `image` estica até os limites da forma. Uma camada `pattern`, em vez disso, embute a imagem decodificada nas dimensões naturais e preserva `repeat`, `repeat-x`, `repeat-y` ou `no-repeat`. O `<pattern>` SVG usa coordenadas locais, com a transformação do nó aplicada uma vez ao grupo envolvente. As definições de pattern têm IDs separados quando os nós precisam de extensões de repetição diferentes.

```ts
const elements = await serializeNodesToSVGElements([
    {
        id: 'tile',
        type: 'rect',
        zIndex: 0,
        x: 40,
        y: 30,
        width: 200,
        height: 100,
        fills: [
            { type: 'pattern', value: imageDataURL, repetition: 'repeat-x' },
        ],
    },
]);
```

A decodificação de imagem é assíncrona. Aguarde `serializeNodesToSVGElements`, ou `exportFillGradientOrPattern` / `exportStrokeGradientOrPattern` ao usar esses utilitários de nível mais baixo diretamente. Uma falha na decodificação da imagem rejeita a exportação. Preenchimentos de gradiente, imagem e pattern em texto mantêm suas definições ao lado do elemento `<text>`, para que escrever o conteúdo não remova os recursos de pintura.

Formas rough exportam a geometria local como caminhos SVG. A opacidade do grupo, a opacidade da camada de preenchimento e a opacidade da camada de traço permanecem separadas, inclusive a opacidade zero. Traços hachure usam `roughFillWeight` (metade da largura do contorno quando omitido ou `-1`). Elipses derivam o centro local e os raios de `width` e `height`. Reimportar esses caminhos SVG preserva a geometria renderizada, mas não restaura os parâmetros rough editáveis. A importação de pattern não é coberta por esse suporte de exportação.

Para quem precisa de um resultado Canvas2D, `API.renderToCanvas(node, { width, height })` desenha esse nó e seus filhos em um canvas. Ele oferece suporte a preenchimentos e traços sólidos em retângulos, elipses, caminhos, polilinhas e linhas, além de retângulos preenchidos com imagem. Cada forma inicia o próprio caminho; comandos de caminho SVG, inclusive arcos, e a regra de preenchimento `evenodd` são convertidos para Canvas2D. Posições locais, cantos arredondados e a opacidade de nó/camada são preservados. Imagens filhas terminam a decodificação antes de o próximo irmão ser desenhado, então a ordem permanece estável. O método rejeita se uma imagem não puder ser decodificada, deixando um canvas fornecido pronto para outro desenho.

#### Grade no SVG {#export-grid}

Por fim, vamos ver como implementar uma grade usando SVG. Consultando [How to draw grid using HTML5 and canvas or SVG], usamos o ladrilhamento de `<pattern>`: para a grade reta, usamos dois conjuntos, um grande e um pequeno; para a grade de pontos, colocamos um círculo em cada um dos quatro cantos do “ladrilho”:

<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="small-grid" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(221,221,221,1)" stroke-width="1"/>
    </pattern>
    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#small-grid)"/>
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(221,221,221,1)" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
</svg>

<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <circle id="dot-tl" cx="0" cy="0" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-br" cx="20" cy="20" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-bl" cx="0" cy="20" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-tr" cx="20" cy="0" r="2" fill="rgba(221,221,221,1)" />
  </defs>
  <pattern id="dots-grid" patternUnits="userSpaceOnUse" width="20" height="20">
    <use xlink:href="#dot-tl" />
    <use xlink:href="#dot-tr" />
    <use xlink:href="#dot-bl" />
    <use xlink:href="#dot-br" />
  </pattern>
  <rect width="100%" height="100%" fill="url(#dots-grid)" />
</svg>

Outra implementação interessante é pelo `stroke-dasharray` de `<line>`, que usa menos elementos SVG do que o `<circle>` repetido em massa; veja [Dot Grid With pattern].

Em seguida, adicione um julgamento na lógica de desenhar a grade: ela permanece igual no modo que não é de captura de tela e, no modo de captura de tela, só desenha quando a opção de incluir grade está ligada:

```ts
hooks.beginFrame.tap(() => {
    if (
        !this.#enableCapture ||
        (this.#enableCapture && this.#captureOptions.grid)
    ) {
        this.#grid.render(this.#device, this.#renderPass, this.#uniformBuffer);
    }
});
```

#### Refletir parâmetros da câmera com viewBox {#use-viewbox}

Podemos colocar a largura e a altura da tela no elemento `<svg>`, mas como os parâmetros de transformação da câmera, como a translação `x/y` e o `zoom` (ainda não oferecemos suporte à exportação da rotação da câmera), devem se refletir no elemento SVG resultante?

Aqui você pode usar o [viewBox]:

```ts
const { x, y, rotation, zoom } = cameras[0].read(ComputedCamera);
$namespace.setAttribute(
    'viewBox',
    `${x} ${y} ${width / zoom} ${height / zoom}`,
);
```

#### Otimizador de SVG {#svg-optimizer}

Se você olhar com atenção para os produtos SVG atuais, verá que há alguns atributos redundantes, como `opacity=“1”`, que é um valor padrão e não precisa estar presente de forma explícita no produto. Na verdade, essa é uma das ferramentas usadas por ferramentas de otimização de SVG como o [svgo]:

> Arquivos SVG, especialmente os exportados de editores vetoriais, em geral contêm muita informação redundante. Isso inclui metadados do editor, comentários, elementos ocultos, **valores padrão ou abaixo do ideal** e outras coisas que podem ser removidas ou convertidas com segurança sem afetar a renderização.

Então precisamos manter um conjunto de tabelas de mapeamento para valores padrão de atributos e, se o valor do atributo for igual ao valor padrão, não precisamos chamar `setAttribute` para defini-lo:

```ts
const defaultValues = {
    opacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
    fill: 'black',
    stroke: 'none',
};

Object.entries(rest).forEach(([key, value]) => {
    if (`${value}` !== '' && `${defaultValues[key]}` !== `${value}`) {
        element.setAttribute(camelToKebabCase(key), `${value}`);
    }
});
```

#### [WIP] Fonte web embutida {#inlined-web-font}

Ao exportar para SVG, se fontes web forem usadas, o objetivo é embuti-las no arquivo. Naturalmente, por causa das restrições de tamanho do arquivo de fonte, é preciso algum recorte sob demanda durante a execução. Abaixo está o fluxo de processamento do Excalidraw, detalhado em: [Font subsetting in excalidraw]

![fonte: https://link.excalidraw.com/readonly/MbbnWPSWXgadXdtmzgeO](https://github.com/user-attachments/assets/e255df0a-13de-4cb6-ae2e-9e885b643c63)

### Exportar GIF {#to-gif}

Mais adiante, na [Lição 30 - Animação baseada em tempo], abordamos efeitos conduzidos por pós-processamento e por um uniform de tempo. Para **exportar** esse movimento, você precisa de formatos como GIF ou WebM; aqui delineamos o primeiro.

1. O caminho de renderização precisa aceitar o **índice do quadro** atual (ou o tempo do motor), para que cada passo mostre o momento certo do efeito.
2. **Capturar a tela como raster**, por exemplo PNG — a seção anterior já cobriu isso.
3. **Ler os pixels e quantizar** para uma paleta (por exemplo, 256 cores por quadro). Se você puder aceitar uma pequena perda de qualidade, 128 ou 64 cores em geral reduzem bastante o arquivo; gradientes e conteúdo parecido com foto vão mostrar mais faixas ou ruído.
4. **Paletas por quadro:** a abordagem direta é um `quantize` por quadro e uma `palette` por `writeFrame`, o que funciona bem para UI plana. Para laços curtos com pouca mudança entre quadros, **uma única paleta global** ou **menos quadros-chave** podem economizar mais espaço, a um custo de implementação nitidamente maior.

```ts
import { GIFEncoder, applyPalette, quantize } from 'gifenc';

const gif = GIFEncoder();
for (let i = 0; i < frameCount; i++) {
    renderFrame(i); // (1) drive time / frame
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const dataUrl = el.toDataURL('image/png', pngQuality); // (2) raster snapshot
    const imageData = await imageDataFromPngDataUrl(dataUrl, w, h, ctx!);
    const palette = quantize(imageData.data, 256); // (3) build palette
    const index = applyPalette(imageData.data, palette); // (4) map to indices
    gif.writeFrame(index, w, h, { palette, delay });
}
gif.finish();
return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' });
```

O ECS espera um callback de quadro do navegador depois de renderizar cada quadro, antes de ler o snapshot PNG, e exige um tamanho de canvas fixo ao longo das exportações GIF e WebM. Um canvas vazio, mudança de tamanho, erro de decodificação de PNG ou exceção de desenho rejeita a exportação, em vez de devolver um arquivo vazio ou uma animação parcial. Canvas temporários são liberados no sucesso e na falha. O WebM também para o gravador e cada trilha de captura, cancela callbacks de quadro pendentes e desanexa os handlers de imagem, para que uma exportação que falhou possa ser tentada de novo. O canvas de origem de quem chamou permanece disponível.

Os timestamps do WebM ainda seguem o relógio de captura em tempo real do `MediaRecorder`. O FPS escolhido avança o tempo do efeito, mas não garante uma taxa de quadros ou uma duração exatas do WebM. O GIF grava atrasos por quadro, armazenados em unidades de 10 milissegundos; os navegadores também podem limitar durações curtas de exibição.

### Exportar PDF {#to-pdf}

Agora que pixels e vetores estão disponíveis, se você ainda quiser exportar para PDF pode usar o [jsPDF], que oferece uma API para adicionar imagens, que não vou cobrir aqui por falta de espaço.

Vamos ver outro tópico: como renderizar uma imagem na tela.

## Renderizar imagem {#render-image}

Em WebGL / WebGPU, muitas vezes é necessário carregar imagens e usá-las como texturas. Como carregar diferentes tipos de recursos é um processo assíncrono complexo, a maioria dos motores de renderização oferece um carregador de recursos. Muitas vezes também há suporte a outros tipos de dados além dos diferentes tipos de imagem, como áudio, JSON, glTF e outros. Abaixo está um exemplo de como [PIXI Assets] é usado:

```ts
import { Sprite, Assets } from 'pixi.js';
// load the texture we need
const texture = await Assets.load('bunny.png');

// This creates a texture from a 'bunny.png' image
const bunny = new Sprite(texture);
```

Então, como implementar um carregador de recursos?

### Carregador de imagem {#image-loader}

[loaders.gl] oferece uma gama de loaders para diferentes tipos de recursos, como:

-   JSON, CSV, GeoJSON, GeoTiles e outros, muito usados em aplicações de visualização.
-   Formatos de modelo 3D, como glTF
-   Vários formatos de textura comprimida, que são carregados e analisados em WebWorker usando [CompressedTextureLoader].

Esses loaders oferecem grande conveniência para o desenvolvimento de aplicações de camada superior. Podemos usar diretamente o [ImageLoader], que oferece suporte a estes formatos de imagem: PNG, JPEG, GIF, WEBP, AVIF, BMP, SVG e assim por diante. core` garante a uniformidade nas chamadas de API e a extensibilidade para diferentes tipos de loaders:

```ts
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';

const image = await load(url, ImageLoader, options);
```

Além de definir o atributo `fill` diretamente, você também precisa restaurar a DataURL para um objeto Image durante a desserialização:

```ts
async function deserializeNode(data: SerializedNode) {
    // data:image/png:base64...
    if (fill && isString(fill) && isDataUrl(fill)) {
        shape.fill = (await load(fill, ImageLoader)) as ImageBitmap;
    }
}
```

### Projeto da API {#image-api}

Voltando ao projeto da nossa API, é claro que podemos adicionar um novo gráfico para a imagem, no modelo de Circle / Ellipse / Rect, que corresponde a [\<image\>] no SVG:

```ts
const image = new Image({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    src: 'data:image...',
});
```

Mas, pensando bem, uma Image deveria ter todas as capacidades de um Rect, como traços, cantos arredondados, sombras e assim por diante. Curiosamente, no Figma, se escolhermos inserir uma imagem de 1920 \* 1920 na tela e exportá-la como SVG, obtemos um elemento `<rect>` com a estrutura a seguir (alguns valores de atributo são omitidos), e o atributo `fill` referencia um [\<pattern\>], que usa indiretamente o preenchimento por ladrilhamento de imagem:

```html
<svg>
    <rect width="500" height="500" fill="url(#pattern0_2442_3)" />
    <defs>
        <pattern id="pattern0_2442_3">
            <use xlink:href="#image0_2442_3"
            <!-- 0.000520833 = 1 / 1920 -->
            transform="matrix(0.000520833 0 0 0.000527058 0 -0.0059761)" />
        </pattern>
        <image
            id="image0_2442_3"
            width="1920"
            height="1920"
            xlink:href="data:image/png;base64,iVBO..."
        />
    </defs>
</svg>
```

Isso nos dá uma ideia de que imagens não precisam existir como formas separadas, desde que o atributo `fill` de outras formas ofereça suporte a mapeamento, para que Circle / Rect e outros possam usar imagens como preenchimento. Imagine que precisamos implementar um ícone circular com traço: o projeto original exigiria um gráfico Image com algo como [\<clipPath\>], mas agora basta preencher o gráfico Circle existente com uma imagem:

```ts
circle.fill = image;
circle.stroke = 'black';
```

### Implementação {#implementation}

Então, como primeiro passo, estendemos os tipos aceitos por `fill`, de strings de cor para mais fontes de textura:

```ts
export interface IRenderable {
    fill: string; // [!code --]
    fill: string | TexImageSource; // [!code ++]
}

type TexImageSource =
    | ImageBitmap
    | ImageData
    | HTMLImageElement
    | HTMLCanvasElement
    | HTMLVideoElement
    | OffscreenCanvas
    | VideoFrame;
```

É preciso um campo nos dados de vértice para indicar se uma textura é usada e, se for, amostrar a textura. `SAMPLER_2D()` não é a sintaxe GLSL padrão, mas a nossa marcação personalizada para substituí-la pela sintaxe de amostragem GLSL100 / GLSL300 / WGSL na etapa de compilação do Shader. Além disso, as texturas atualmente são imagens enviadas, e gradientes criados com a API Canvas2D, como [createLinearGradient], serão suportados depois:

```glsl
// vert
out vec2 v_Uv;
v_Uv = (a_FragCoord * radius / size + 1.0) / 2.0;

// frag
in vec2 v_Uv;
uniform sampler2D u_Texture;

if (useFillImage) {
    fillColor = texture(SAMPLER_2D(u_Texture), v_Uv);
}
```

O uso de `uniform` quebra a nossa lógica anterior de renderização em lote. O artigo [Inside PixiJS: Batch Rendering System] descreve a lógica da implementação de BatchRenderer do Pixi.js e, como você pode ver no template de Shader compilado em tempo de execução abaixo, o número máximo de samplers que podem ser suportados ao mesmo tempo é um conjunto de `%count%` samplers, em que cada instância seleciona dentro do conjunto de samplers usando o dado de vértice `aTextureId`, e `aTextureId` é usado por cada instância para selecionar dentro do conjunto de samplers.

```glsl
// Shader template in Pixi.js BatchRenderer
// vert
attribute int aTextureId;
varying int vTextureId;
vTextureId = aTextureId;

// frag
uniform sampler2D uSamplers[%count%];
varying int vTextureId;
```

Para simplificar, vamos simplificar a lógica de mesclagem da seguinte forma:

1. `fill` com uma string de cor não pode ser combinado com uma Image.
2. `fill` com um valor de Image diferente não pode ser combinado.

Então os três círculos a seguir serão desenhados no mesmo lote.

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    $icCanvas3.addEventListener('ic-ready', async (e) => {
        const image = await Utils.loadImage('/canvas.png');

        const canvas = e.detail;

        const circle1 = new Circle({
            cx: 200,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle1);

        const circle2 = new Circle({
            cx: 320,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
        });
        canvas.appendChild(circle2);

        const circle3 = new Circle({
            cx: 460,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'outer',
        });
        canvas.appendChild(circle3);
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### Cache de renderização {#render-cache}

Antes, não consideramos o cache de objetos de GPU como Program, Bindings, Sampler e outros. Por isso, adicionamos um gerenciador de cache de recursos para permitir a reutilização e implementamos a lógica de acerto de acordo com o tipo de recurso. Tome o Sampler como exemplo: se as propriedades em `SamplerDescriptor` forem idênticas, o cache é atingido, e a lógica de comparação está em `samplerDescriptorEquals`.

```ts
import { samplerDescriptorEquals } from '@antv/g-device-api';

export class RenderCache {
    device: Device;
    private samplerCache = new HashMap<SamplerDescriptor, Sampler>(
        samplerDescriptorEquals,
        nullHashFunc,
    );

    createSampler(descriptor: SamplerDescriptor): Sampler {
        // 优先从缓存中取
        let sampler = this.samplerCache.get(descriptor);
        if (sampler === null) {
            // 未命中，创建并添加缓存
            sampler = this.device.createSampler(descriptor);
            this.samplerCache.add(descriptor, sampler);
        }
        return sampler;
    }
}
```

### Object fit (object-fit) {#object-fit}

A geometria de um retângulo muitas vezes não corresponde à proporção intrínseca da imagem. Desenhar com `drawImage(0, 0, width, height)` em todo lugar estica ícones e fotos. Ferramentas de design em geral oferecem modos de fit / fill / crop; seguimos o CSS [object-fit] e [object-position] em entradas de `FillLayers` com `type: 'image'`:

```ts
fills: [
    {
        type: 'image',
        value: '/canvas.png',
        objectFit: 'contain',
        objectPosition: 'top left',
    },
];
```

| `objectFit`           | Comportamento                                                              |
| --------------------- | -------------------------------------------------------------------------- |
| `fill`                | Estica para preencher a geometria (**padrão**, igual ao comportamento raster inicial) |
| `contain`             | Escala de forma uniforme; mostra a imagem inteira; pode aparecer letterboxing |
| `cover`               | Escala de forma uniforme; preenche a geometria; recorta o que transborda  |
| `none` / `scale-down` | A mesma semântica do CSS                                                   |

Veja [Exemplo de object-fit](/example/object-fit) para saber como isso se mapeia à escala de imagem do Figma e ao `mode` do Pencil (`stretch` / `fill` / `fit`).

Na CPU, rasterizamos a imagem em uma textura: calculamos o retângulo de desenho a partir de `objectFit` e pintamos em um canvas. Para `contain` / `cover`, o tamanho da textura é **geometria × device pixel ratio**, não `max(source width, geometry width)` — caso contrário, a imagem inteira preenche o bitmap e, ao ser mapeada para a forma, ainda parece um `fill` esticado.

<ObjectFit />

### iOS Live Photo {#ios-live-photo}

No nível do arquivo, um iOS Live Photo em geral é uma imagem estática HEIC mais um MOV acompanhante. O suporte nativo a HEIC varia entre navegadores; o carregador de imagem do ECS usa heic-to para oferecer um caminho de conversão.

O objetivo é tratá-lo como uma imagem normal: decodificar um único quadro estático em um bitmap e, então, enviá-lo para uma textura. Reproduzir o vídeo embutido do Live Photo na tela seria um passo seguinte, com um componente dedicado (por exemplo, toque para reproduzir) construído à parte.

`loadImageBitmapUniversal` aceita uma URL, um Blob ou um File. Ele reconhece HEIC/HEIF pelo MIME, pela extensão do arquivo ou pela assinatura do arquivo, e carrega heic-to apenas quando necessário, mantendo as importações de módulo seguras durante o SSR. Ele converte o primeiro quadro estático para PNG, com uma nova tentativa em JPEG se a conversão ou a decodificação do bitmap falhar. Imagens que não são HEIC continuam pelo loaders.gl.

Erros de HTTP são rejeitados antes da conversão. Se uma imagem comum falhar ao decodificar e a sondagem diagnóstica de HEIC também falhar, o erro original é preservado. Cada chamada pode tentar de novo de forma independente; um bitmap retornado pertence a quem chamou e deve ser fechado depois do uso. Uma object URL de entrada também permanece sob a posse de quem a chamou.

```ts
import { loadImageBitmapUniversal } from '@infinite-canvas-tutorial/ecs';

async function drawStill(
    context: CanvasRenderingContext2D,
    source: string | Blob,
) {
    const bitmap = await loadImageBitmapUniversal(source);
    try {
        context.drawImage(bitmap, 0, 0);
    } finally {
        bitmap.close?.();
    }
}
```

O decodificador usa heic-to 1.6.6 (libheif 1.23.6), corrigindo o desvio de cor e a transparência perdida do decodificador anterior nos fixtures SDR de faixa completa. Regressões de navegador comparam com as cores de origem e cobrem níveis de cinza, transparência de PNG, o primeiro quadro estático em um contêiner de várias imagens, decodificação concorrente e recuperação depois de entrada corrompida.
O fallback JPEG continua com perdas e não consegue preservar o alfa. Essas verificações não cobrem perfis ICC arbitrários, cor de gama ampla, HDR ou a reprodução de vídeo do Live Photo.

## SVG aprimorado: alinhamento do traço {#stroke-alignment}

Por fim, vamos apresentar um tópico interessante. Podemos implementar recursos que ainda não são suportados pela especificação SVG.

Vamos começar pela diferença entre `opacity`, `stroke-opacity` e `fill-opacity` no SVG. O círculo da esquerda tem `opacity=“0.5”` e o círculo da direita tem `fill-opacity=“0.5” stroke-opacity=“0.5”`. Você pode ver que o traço fica metade dentro do círculo e metade fora:

<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="red" stroke="black" stroke-width="20" opacity="0.5" />
  <circle cx="150" cy="50" r="40" fill="red" stroke="black" stroke-width="20" fill-opacity="0.5" stroke-opacity="0.5" />
</svg>

A posição de Stroke correspondente no Figma é `Center`, e outras opções incluem `Inside` e `Outside`, cada uma mostrada abaixo. No SVG, isso se chama `stroke-alignment`, mas ainda está em forma de rascunho; veja [Specifying stroke alignment]. O Pixi.js também oferece [PIXI.LineStyle alignment] no modo WebGL.

![Alinhamento do traço no Figma](/figma-stroke-align.png)

Adicionamos a propriedade `strokeAlignment` a todas as formas:

```ts
export interface IRenderable {
    strokeAlignment: 'center' | 'inner' | 'outer'; // [!code ++]
}
```

### Alinhamento do traço no Shader {#stroke-alignment-rendering}

A implementação na seção do Shader só precisa distinguir esses três valores e misturar as cores de preenchimento e de traço de formas diferentes:

```glsl
if (strokeAlignment < 0.5) { // center
    d1 = distance + strokeWidth;
    d2 = distance + strokeWidth / 2.0;
    color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
    color = mix_border_inside(strokeColor, color, d2);
} else if (strokeAlignment < 1.5) { // inner
    d1 = distance + strokeWidth;
    d2 = distance;
    color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
    color = mix_border_inside(strokeColor, color, d2);
} else if (strokeAlignment < 2.5) { // outer
    d2 = distance + strokeWidth;
    color = mix_border_inside(strokeColor, color, d2); // No need to use fillColor at all
}
```

Eis a nossa implementação. Você pode ver que a renderização é consistente com o Figma:

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

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

        const circle1 = new Circle({
            cx: 200,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle1);

        const circle2 = new Circle({
            cx: 320,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
        });
        canvas.appendChild(circle2);

        const circle3 = new Circle({
            cx: 460,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'outer',
        });
        canvas.appendChild(circle3);
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

Essa propriedade também precisa ser levada em conta ao calcular a caixa delimitadora de renderização e a determinação de picking. A função abaixo reflete o quanto o traço deve se estender para fora do próprio gráfico para valores diferentes.

```ts
function strokeOffset(
    strokeAlignment: 'center' | 'inner' | 'outer',
    strokeWidth: number,
) {
    if (strokeAlignment === 'center') {
        return strokeWidth / 2;
    } else if (strokeAlignment === 'inner') {
        return 0;
    } else if (strokeAlignment === 'outer') {
        return strokeWidth;
    }
}
```

### Exportar SVG {#stroke-alignment-export-svg}

Como mencionado antes, o SVG ainda não oferece suporte a `stroke-alignment`, então, no momento, só pode ser simulado com uma gambiarra. Se o desenho for simples, é possível desenhar o preenchimento e o traço em duas passadas. Eis a exportação do Figma de `stroke-alignment: 'inner'`, que também usa essa abordagem:

```html
<circle cx="200" cy="200" r="200" fill="#F67676" />
<circle
    cx="200"
    cy="200"
    r="160"
    stroke="black"
    stroke-opacity="0.5"
    stroke-width="100"
/>
```

<div style="display:flex;justify-content:center;align-items:center;">
    <svg width="100" height="100" viewBox="0 0 443 443" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="221.5" cy="221.5" r="221.5" fill="#F67676"/>
    <circle cx="221.5" cy="221.5" r="171.5" stroke="black" stroke-opacity="0.5" stroke-width="100"/>
    </svg>
    <svg width="120" height="120" viewBox="0 0 643 643" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="321.5" cy="321.5" r="221.5" fill="#F67676"/>
    <circle cx="321.5" cy="321.5" r="271.5" stroke="black" stroke-opacity="0.5" stroke-width="100"/>
    </svg>
</div>

Além disso, a documentação do Figma em [StrokeAlign in Figma widget] apresenta outra ideia, que não exige criar dois elementos parecidos. [How to simulate stroke-align (stroke-alignment) in SVG] tenta essa ideia ampliando a largura do traço para o dobro da largura original e eliminando o excesso com clipPath e mask:

> Traço interno e externo são, na verdade, implementados dobrando a espessura do traço e mascarando o traço pelo preenchimento. Isso significa que o traço alinhado por dentro nunca desenha traços fora do preenchimento e o traço alinhado por fora nunca desenha traços dentro do preenchimento.

Para simplificar a implementação, escolhemos a primeira abordagem, criando dois elementos parecidos para desenhar o preenchimento e o traço respectivamente, o que pode ser experimentado ao exportar SVG no exemplo acima.

Com a riqueza da funcionalidade da tela, é necessário introduzir testes para verificar se a funcionalidade de importação/exportação funciona direito, se a renderização está correta e se os componentes de UI são interativos. Vamos apresentar isso na próxima seção.

## Leitura adicional {#extended-reading}

-   [Export from Figma]
-   [Specifying stroke alignment]
-   [How to simulate stroke-align (stroke-alignment) in SVG]
-   [Vector rendering of SVG content with PixiJS]

[Export from Figma]: https://help.figma.com/hc/en-us/articles/360040028114-Export-from-Figma#h_01GWB002EPWMFSXKAEC62GS605
[How to simulate stroke-align (stroke-alignment) in SVG]: https://stackoverflow.com/questions/74958705/how-to-simulate-stroke-align-stroke-alignment-in-svg
[HTMLCanvasElement.toDataURL()]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
[preserveDrawingBuffer]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext#preservedrawingbuffer
[DataURI]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
[SwapChain]: /pt-BR/guide/lesson-001#swapchain
[Interface web com Lit e Shoelace]: /pt-BR/guide/lesson-007
[Arquitetura baseada em plugins]: /pt-BR/guide/lesson-001#plugin-based-architecture
[SVGRenderer]: https://threejs.org/docs/#examples/en/renderers/SVGRenderer
[toJSON]: https://threejs.org/docs/#api/en/core/Object3D.toJSON
[JSON-Object-Scene-format-4]: https://github.com/mrdoob/three.js/wiki/JSON-Object-Scene-format-4
[Grade]: /pt-BR/guide/lesson-005
[SVG Element]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element
[\<svg\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/svg
[setAttribute]: https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute
[jsPDF]: https://github.com/parallax/jsPDF
[loaders.gl]: https://github.com/visgl/loaders.gl
[ImageLoader]: https://loaders.gl/docs/modules/images/api-reference/image-loader
[CompressedTextureLoader]: https://loaders.gl/docs/modules/textures/api-reference/compressed-texture-loader
[PIXI Assets]: https://pixijs.download/release/docs/assets.html
[Specifying stroke alignment]: https://www.w3.org/TR/svg-strokes/#SpecifyingStrokeAlignment
[StrokeAlign in Figma widget]: https://www.figma.com/widget-docs/api/component-SVG/#strokealign
[How to draw grid using HTML5 and canvas or SVG]: https://stackoverflow.com/questions/14208673/how-to-draw-grid-using-html5-and-canvas-or-svg
[Convert ImageBitmap to Blob]: https://stackoverflow.com/questions/52959839/convert-imagebitmap-to-blob
[ImageBitmapRenderingContext]: https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmapRenderingContext
[@pixi-essentials/svg]: https://github.com/ShukantPal/pixi-essentials/tree/master/packages/svg
[Vector rendering of SVG content with PixiJS]: https://medium.com/javascript-in-plain-english/vector-rendering-of-svg-content-with-pixijs-6f26c91f09ee
[svgo]: https://github.com/svg/svgo
[Dot Grid With pattern]: https://www.smashingmagazine.com/2024/09/svg-coding-examples-recipes-writing-vectors-by-hand/#dot-grid-with-pattern
[Adding Shadows to SVG Icons With CSS and SVG Filters]: https://css-tricks.com/adding-shadows-to-svg-icons-with-css-and-svg-filters/
[filter primitive]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element#filter_primitive_elements
[JSON objects in tldraw]: https://tldraw.dev/docs/shapes#The-shape-object
[JSON schema in excalidraw]: https://docs.excalidraw.com/docs/codebase/json-schema
[viewBox]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox
[Font subsetting in excalidraw]: https://github.com/excalidraw/excalidraw/issues/1972#issuecomment-2417744618
[Lição 30 - Animação baseada em tempo]: /pt-BR/guide/lesson-030#time-animation
