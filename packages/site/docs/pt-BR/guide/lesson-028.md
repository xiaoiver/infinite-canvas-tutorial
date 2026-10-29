---
outline: deep
description: 'Integração com IA, usando diálogos de chat com modelos de geração de imagem como GPT 4o e Nano banana. Use o SAM para segmentar a imagem em um WebWorker, use o LaMa para inpainting e amplie a imagem com o UpscalerJS.'
head:
    - [
          'meta',
          { property: 'og:title', content: 'Lição 28 - Integração com IA' },
      ]
---

<script setup>
import WhenCanvasMeetsChat from '../../components/WhenCanvasMeetsChat.vue'
</script>

# Lição 28 - Integração com IA {#lesson-28-integrating-with-ai}

Hoje, o GPT 4o (gpt-image-1) e o Nano banana (gemini-2.5-flash-image) reduziram bastante a barreira da edição de imagem. Do ponto de vista da interação humano-computador, a combinação de interfaces de chat e tela está cada vez mais popular. O histórico de chat com os modelos reflete naturalmente o histórico de modificação das imagens, enquanto a tela, que pode ser arrastada com liberdade, torna naturais a seleção de imagens e o processamento em paralelo. Para mais detalhes, veja [UI for AI].

A imagem abaixo mostra a interface do produto Lovart, que usa o Konva.js mencionado na [Lição 21 - Transformer] como tecnologia de base. Embora o foco principal seja a edição de imagem, ele não abandona recursos comuns de editores gráficos, como a lista de camadas oculta por padrão no canto inferior esquerdo, e a barra de ferramentas à esquerda também pode inserir algumas formas básicas.

![Lovart](/lovart.png)

O Recraft também está testando a funcionalidade de chat. Na minha observação, a tela e o chat estão se tornando as duas entradas principais desse tipo de editor:

![Chat do Recraft](/recraft-chat.png)

Nesta lição, vamos combinar com o Nano banana para enriquecer a edição de imagem.

<WhenCanvasMeetsChat />

## Integrar modelos {#client-sdk}

Para usar o Nano banana, escolhi o [fal.ai] em vez do [generative-ai] oficial do Google. O motivo é que uma API unificada facilita comparar o efeito de outros modelos de geração de imagem, como [qwen-image-edit] ou [FLUX.1 Kontext].

Há muitos outros SDKs agregados, como o [OpenRouter]. Tomando a interface de geração de imagem como exemplo, basta passar um prompt para receber a URL da imagem gerada e a resposta de texto original do modelo:

```ts
import { fal } from '@fal-ai/client';

const result = await fal.subscribe('fal-ai/gemini-25-flash-image', {
    input: {
        prompt: '',
    },
});
console.log(result.data); // { image: [{ url: 'https://...' }]; description: 'Sure, this is your image:' }
```

A API de edição de imagem também aceita um conjunto de URLs de imagem como parâmetros. Mesmo ao passar DataURLs codificados, avisos como “Unable to read image information” ainda podem aparecer. Por isso, o [fal.ai] oferece uma interface de upload de arquivo, o que permite ativar o envio quando imagens locais são adicionadas à tela.

### Design da API {#api-design}

Precisamos de uma API responsável por gerar e modificar imagens. Nos dois cenários, os parâmetros devem ser os mesmos: um prompt e uma lista de imagens de referência.

```ts
import { fal } from '@fal-ai/client';

api.createOrEditImage = async (
    isEdit: boolean,
    prompt: string,
    image_urls: string[],
): Promise<{ images: { url: string }[]; description: string }> => {
    const result = await fal.subscribe(
        isEdit
            ? 'fal-ai/gemini-25-flash-image/edit'
            : 'fal-ai/gemini-25-flash-image',
        {
            input: {
                prompt,
                image_urls,
            },
        },
    );
    return result.data;
};
```

### Caixa de chat {#chatbox}

A caixa de chat oferece outro ponto de partida além da tela.

### Remover fundo {#remove-background}

Dê um clique duplo na imagem para entrar no modo de edição:

```ts
private async removeBackground() {
    this.removingBackground = true;
    const { images } = await createOrEditImage(
        true,
        'Remove background from the image',
        [this.node.fill],
    );
    if (images.length > 0) {
        this.api.runAtNextTick(() => {
        this.api.updateNode(newImage, { fill: images[0].url });

        this.api.record();
        this.removingBackground = false;
        });
    }
}
```

## Inpainting {#inpainting}

Serve para apagar ou modificar objetos já existentes e selecionados em uma imagem, garantindo que as outras partes permaneçam inalteradas.

<https://www.recraft.ai/docs#inpaint-image>

> O inpainting substitui ou modifica partes específicas de uma imagem. Ele usa uma máscara para identificar as áreas a preencher, em que pixels brancos representam as regiões a retocar e pixels pretos indicam as áreas que devem permanecer intactas, isto é, os pixels brancos são preenchidos com base na entrada fornecida no prompt.

Quando o usuário desenha uma área fechada em um editor simples, ela precisa ser convertida em um parâmetro de máscara para enviar à API. Essa máscara é, na essência, uma imagem em tons de cinza:

![inpainting no gpt-4o](/inpainting.webp)

É aqui que a importância dos editores fica evidente. Até recursos simples de edição têm valor. O Recraft menciona três pontos: <https://www.recraft.ai/blog/inpainting-with-ai-how-to-edit-images-with-precision-using-recraft>

1. Facilidade para ampliar e reduzir o zoom. Afinal, é uma operação de precisão, então o zoom da tela é crucial.
2. Inpainting com IA usando modelos de segmentação como o SAM de forma automática
3. Flexibilidade criativa

### Criar máscara {#create-mask}

Oferecemos vários métodos interativos para o usuário gerar máscaras:

1. [Lição 26 - Ferramenta de seleção]
2. [Lição 25 - Modo de desenho e pincel]

### Usar o SAM via WebGPU {#use-sam-via-webgpu}

Além de permitir que o usuário defina a área de modificação com a maior precisão possível, seria ainda melhor se a seleção da área pudesse ser feita por métodos mais simples, como clicar para selecionar.

![Seleção inteligente no Midjourney](/midjourney-smart-select.jpeg)

Na [Lição 1 - Camadas de abstração de hardware], apresentamos as vantagens do WebGPU (o Figma também atualizou recentemente o motor de renderização). Além da renderização, ele torna possível o GPGPU no navegador, com suporte a Compute Shader. O ONNX oferece um runtime para a web, permitindo inferência em tempo real direto no navegador, sem consumir tokens. Para detalhes, veja: [How to add machine learning to your web application with ONNX Runtime].

Seguimos este artigo: [Image Segmentation in the Browser with Segment Anything Model 2] e implementamos as seguintes otimizações:

-   Usamos o [ORT model format] para reduzir o tamanho dos modelos baixados em tempo de execução
-   Empregamos WebGPU para uma inferência mais rápida. Para detalhes, veja: [Using the WebGPU Execution Provider]
-   Executamos dentro de WebWorkers para não bloquear a thread principal

Reunimos isso no [SAM plugin]. Eis o nosso exemplo: [Use SAM in WebWorker].

![SAM no WebWorker](/sam.gif)

Para outras práticas e materiais relacionados ao SAM3, consulte:

-   [Segment Anything 2, in WebGPU]
-   [Request for Official ONNX Export + TensorRT Conversion Scripts for SAM3]

A máscara obtida pelo SAM pode ser usada como imagem de referência para alimentar o modelo de imagem original.

### Usar o LaMa {#use-lama}

[Client-Side Image Inpainting with ONNX and Next.js] explica como usar o modelo [LaMa] no lado do cliente.

### Combinar várias imagens {#combine-multiple-images}

Usar a tela permite obter informação extra de posição sobre as imagens, algo muitas vezes difícil de descrever com linguagem. Por exemplo, podemos arrastar uma xícara para qualquer posição de uma mesa e compor uma imagem.

## Outpainting {#outpainting}

Esse recurso ainda não tem uma implementação de API correspondente da OpenAI. Vamos ver primeiro como o Recraft faz isso. <https://www.recraft.ai/blog/ai-outpainting-how-to-expand-images>

> O outpainting permite que o usuário expanda uma imagem para além do quadro original. É especialmente útil para completar imagens cortadas ou acrescentar mais cenário de fundo.

Serve para manter inalterados os objetos selecionados na imagem, por exemplo ao mudar o fundo:

![Outpainting no Recraft](/outpainting-fixed.webp)

Ou para expandir para fora:

![Outpainting no Recraft](/outpainting.webp)

No momento, o GPT 4o só oferece suporte a três tamanhos fixos, enquanto o Nano banana precisa de alguns truques para produzir uma imagem de tamanho arbitrário, como passar uma imagem em branco de um tamanho definido como referência e enfatizar isso no prompt. Dá para tornar isso bem natural por meio de operações na tela: o usuário só precisa arrastar até o tamanho adequado, e o aplicativo gera automaticamente essa imagem de referência em branco pela Canvas API.

## Separação de camadas {#layer-separation}

-   [Editing Text in Images with AI]
-   [Move Anything with Layered Scene Diffusion]

### Raster para vetor {#raster-to-vector}

Muitas ferramentas online e de código aberto oferecem soluções baseadas em processamento de imagem tradicional:

-   Recraft [AI image vectorizer]
-   Lottiefiles [Raster to Vector converter]
-   [vtracer]

Essa abordagem, porém, não dá resultados satisfatórios no processamento de texto:

![Raster para vetor no lottiefiles. fonte: https://lottiefiles.com/tools/raster-to-vector](/lottiefiles-raster-vector.png)

O motivo é que esse algoritmo costuma se dividir nas etapas a seguir, e a primeira etapa não distingue texto de gráficos adequados à vetorização:

1. O “Path walking” converte pixels em caminhos
2. Os caminhos são simplificados em polígonos
3. Há tentativas de suavizar os polígonos

![fonte: https://www.visioncortex.org/vtracer-docs#path-walking](https://www.visioncortex.org/public/vtracer/WalkerOptim.svg)

### Separar fundo e texto {#split-background-text}

Primeiro, use uma ferramenta parecida com OCR para identificar regiões de texto e gerar uma máscara. Depois, remova a máscara e faça o modelo regenerar a imagem por um processo padrão de inpainting, para obter uma imagem de fundo sem texto.

[FLUX-Text: A Simple and Advanced Diffusion Transformer Baseline for Scene Text Editing]

![edição de texto com flux-text](/flux-text.png)

Usar o [Qwen-Image-Layered] de código aberto permite a decomposição em camadas. No [fal.ai plugin], chegamos ao efeito a seguir:

![Qwen-Image-Layered](/decompose-layers.gif)

### Reconhecimento de fonte {#font-recognition}

Em seguida, precisamos identificar atributos de estilo, como a fonte e o tamanho da fonte, dentro da área de texto.

[TextStyleBrush: Transfer of Text Aesthetics from a Single Example]

O Adobe Photoshop oferece [Match fonts]:

![Selecione uma fonte na lista de fontes semelhantes na caixa de diálogo Match Fonts](https://helpx-prod.scene7.com/is/image/HelpxProd/A-sample-document-showing-an-image-with-the-text-s?$pjpeg$&jpegSize=300&wid=1600)

O [whatfontis] oferece uma API pública que encontra, na biblioteca de fontes, a fonte mais próxima de uma área especificada da imagem.

```json
[
    {
        "title": "Abril Fatface",
        "url": "https://www.whatfontis.com/FF_Abril-Fatface.font",
        "image": "https://www.whatfontis.com/img16/A/B/FF_Abril-FatfaceA.png"
    }
]
```

Por fim, sobreponha todas as camadas.

## Ampliar imagem {#upscale-image}

Podemos ampliar a imagem com um modelo. A figura de comparação a seguir vem do [Topaz Gigapixel]:

![fonte: https://www.adobe.com/products/photoshop/image-upscaler.html](https://www.adobe.com/products/photoshop/media_1bef0720b9cf0858149ccc837fa56e1ed726defe6.jpg?width=2000&format=webply&optimize=medium)

Podemos usar [fal-ai/topaz/upscale/image] ou [SeedVR2] no fal.ai. No navegador, podemos usar o [UpscalerJS] em um webworker. Veja o nosso [upscaler plugin], que usa por padrão o modelo `@upscalerjs/esrgan-medium 4x`.

![@upscalerjs/esrgan-medium 4x](/upscaler.png)

### Outro runtime de navegador {#other-browser-runtime}

O [UpscalerJS] usa tensorflow.js. Você pode escolher o [super-resolution-js] com o runtime ONNX, ou um runtime novo chamado LiteRT:

![Ampliador de imagem com LiteRT.js](/image-upscaler.jpg)

## WebMCP para a tela do projeto {#webmcp}

Com o usuário autenticado, o editor do projeto registra seis [WebMCP imperative tools] quando `document.modelContext` está disponível: `get_canvas_summary`, `get_selection`, `get_nodes`, `export_canvas_code`, `create_shape` e `update_node`. Por exemplo, um agente pode ler a seleção atual, criar um retângulo e depois mudar a largura. As duas ferramentas de escrita usam o mesmo caminho `api.edit()` do editor, então as edições entram no histórico de desfazer e na colaboração da tela.

No momento, o WebMCP exige um navegador com suporte (origin trial do Chrome 149, ou a flag de desenvolvimento `chrome://flags/#enable-webmcp-testing`). Abra um projeto seu e entre na conta antes de experimentar as ferramentas. Os outros navegadores continuam funcionando como editores comuns. As ferramentas são removidas quando a tela fecha ou o projeto muda. A primeira versão pode criar e editar retângulos e elipses; a leitura de nós devolve um conjunto limitado de propriedades, e a exportação de código tem limite de 32.000 caracteres.

Na página do projeto, você pode inspecionar as ferramentas no DevTools e experimentar uma edição completa:

```js
const tools = await document.modelContext.getTools();
const findTool = (name) => tools.find((tool) => tool.name === name);
const summary = await document.modelContext.executeTool(
    findTool('get_canvas_summary'),
    {},
);
console.log(JSON.parse(summary));

const created = JSON.parse(
    await document.modelContext.executeTool(findTool('create_shape'), {
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        fill: '#3b82f6',
    }),
);
await document.modelContext.executeTool(findTool('update_node'), {
    id: created.id,
    width: 240,
});
```

Desfazer no editor restaura a largura anterior do retângulo. As ferramentas ficam restritas ao projeto atual e não expõem dados da tela de outros projetos.

O WebMCP opera dentro de uma aba aberta do navegador. Um servidor MCP independente para agentes de desktop é uma integração separada, futura.

### Outras integrações MCP {#other-mcp-integrations}

[MCP: What It Is and Why It Matters]:

> Em vez de ter apenas uma GUI ou uma API usada por pessoas, você ganha uma interface de IA “de graça”. Essa ideia levou ao conceito de “desenvolvimento MCP-first”, em que você constrói o servidor MCP do aplicativo antes ou junto com a GUI.

### pencil.dev {#pencil-dev}

A tela vetorial MCP bidirecional com a qual você sonhava. Veja [pencil.dev]

> O Pencil não oferece apenas ferramentas MCP de leitura, mas também acesso completo de escrita e muitas outras ferramentas úteis para operar a tela por completo. Essa é a verdadeira mágica. Você pode conectar o mundo inteiro de MCPs, trazer dados de outras fontes, como bancos de dados, APIs, dados de gráficos, Playwright/Puppeteer, ou ligar outros agentes com facilidade. Você está no comando!

O [Figma MCP Server] pode manipular a [Figma API].

[Lição 21 - Transformer]: /pt-BR/guide/lesson-021
[UI for AI]: https://medium.com/ui-for-ai
[Lição 1 - Camadas de abstração de hardware]: /pt-BR/guide/lesson-001#hardware-abstraction-layers
[Image Segmentation in the Browser with Segment Anything Model 2]: https://medium.com/@geronimo7/in-browser-image-segmentation-with-segment-anything-model-2-c72680170d92
[fal.ai]: https://fal.ai/
[OpenRouter]: https://openrouter.ai/
[qwen-image-edit]: https://fal.ai/models/fal-ai/qwen-image-edit
[FLUX.1 Kontext]: https://fal.ai/models/fal-ai/flux-pro/kontext
[generative-ai]: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions
[Lição 26 - Ferramenta de seleção]: /pt-BR/guide/lesson-026#marquee-selection
[Lição 25 - Modo de desenho e pincel]: /pt-BR/guide/lesson-025#brush-mode
[MCP: What It Is and Why It Matters]: https://addyo.substack.com/p/mcp-what-it-is-and-why-it-matters
[Figma MCP Server]: https://github.com/GLips/Figma-Context-MCP
[Figma API]: https://www.figma.com/developers/api
[WebMCP imperative tools]: https://developer.chrome.com/docs/ai/webmcp/imperative-api
[Editing Text in Images with AI]: https://medium.com/data-science/editing-text-in-images-with-ai-03dee75d8b9c
[whatfontis]: https://www.whatfontis.com/API-identify-fonts-from-image.html#font_Examples_good
[Match fonts]: https://helpx.adobe.com/photoshop/desktop/text-typography/select-manage-fonts/match-fonts.html
[FLUX-Text: A Simple and Advanced Diffusion Transformer Baseline for Scene Text Editing]: https://arxiv.org/pdf/2505.03329
[TextStyleBrush: Transfer of Text Aesthetics from a Single Example]: https://arxiv.org/pdf/2106.08385
[Move Anything with Layered Scene Diffusion]: https://openaccess.thecvf.com/content/CVPR2024/papers/Ren_Move_Anything_with_Layered_Scene_Diffusion_CVPR_2024_paper.pdf
[Raster to Vector converter]: https://lottiefiles.com/tools/raster-to-vector
[AI image vectorizer]: https://www.recraft.ai/ai-image-vectorizer
[vtracer]: https://github.com/visioncortex/vtracer
[Segment Anything 2, in WebGPU]: https://lucasgelfond.online/software/webgpu-sam2/
[LaMa]: https://github.com/advimman/lama
[Client-Side Image Inpainting with ONNX and Next.js]: https://medium.com/@geronimo7/client-side-image-inpainting-with-onnx-and-next-js-3d9508dfd059
[Request for Official ONNX Export + TensorRT Conversion Scripts for SAM3]: https://github.com/facebookresearch/sam3/issues/224
[Use SAM in WebWorker]: /experiment/sam-in-worker
[SAM plugin]: /reference/sam
[fal.ai plugin]: /reference/fal
[upscaler plugin]: /reference/upscaler
[How to add machine learning to your web application with ONNX Runtime]: https://onnxruntime.ai/docs/tutorials/web/
[ORT model format]: https://onnxruntime.ai/docs/performance/model-optimizations/ort-format-models.html
[Using the WebGPU Execution Provider]: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
[Qwen-Image-Layered]: https://arxiv.org/pdf/2512.15603
[SeedVR2]: https://huggingface.co/ByteDance-Seed/SeedVR2-7B
[UpscalerJS]: https://upscalerjs.com/documentation/guides/browser/performance/webworker
[super-resolution-js]: https://github.com/josephrocca/super-resolution-js
[Topaz Gigapixel]: https://www.topazlabs.com/topaz-gigapixel
[fal-ai/topaz/upscale/image]: https://fal.ai/models/fal-ai/topaz/upscale/image/api
[pencil.dev]: https://www.pencil.dev/
