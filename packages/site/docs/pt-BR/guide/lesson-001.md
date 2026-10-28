---
outline: deep
description: 'Aprenda a inicializar uma tela com camadas de abstração de hardware baseadas em WebGL/WebGPU, projetar a API Canvas, implementar uma arquitetura baseada em plugins e criar um plugin de renderização. Construa um framework de tela extensível com suporte a vários renderizadores.'
head:
    - [
          'meta',
          { property: 'og:title', content: 'Lição 1 - Inicializar a tela' },
      ]
---
# Lição 1 - Inicializar a tela {#lesson-1-initialize-canvas}

Nesta lição, você vai aprender o seguinte:

-   Camadas de abstração de hardware (HAL) baseadas em WebGL1/2 e WebGPU
-   Projetar a nossa API Canvas
-   Implementar um sistema simples de plugins
-   Implementar um plugin de renderização baseado na HAL

::: warning Nota de segurança: @antv/g-device-api

[GHSA-hqjp-pg4j-q8g2](https://github.com/advisories/GHSA-hqjp-pg4j-q8g2) identifica as versões **1.7.13 e 1.8.13** do npm como lançamentos maliciosos que contêm um script `preinstall` que rouba credenciais. **Não instale essas versões.** Em 13 de outubro de 2026, o aviso não lista nenhuma versão corrigida.

A URL do WASM do compilador de shaders abaixo está fixada em **1.6.13**, a versão mais recente disponível no npm e no UNPKG nessa data, correspondente ao pacote JavaScript no `pnpm-lock.yaml` deste repositório. Seu WASM é idêntico, byte a byte, ao artefato **1.6.8** usado anteriormente e ao compilador incluído neste repositório; esta mudança alinha os números de versão sem alterar a funcionalidade do compilador. A versão 1.6.13 não está listada como afetada, e buscar o WASM em um navegador não executa scripts de instalação do npm. Nenhum desses fatos constitui uma auditoria de segurança do artefato.

Ao seguir a lição a partir deste repositório, preserve o arquivo de lock com `pnpm install --frozen-lockfile`. Evite instalações sem versão ou com `latest`, e revise a procedência de qualquer atualização de dependência. Um compilador substituto precisa ser verificado antes de poder ser recomendado aqui. Em projetos ECS atuais que usam `@infinite-canvas-tutorial/device-api`, prefira o [asset WASM empacotado](/reference/create-app#shader-compiler) para manter os bindings JavaScript e o compilador juntos e evitar uma requisição de CDN em tempo de execução.

:::

Quando você iniciar o projeto, verá uma tela vazia e poderá alterar o aspecto ou alternar entre os renderizadores WebGL e WebGPU.

```js eval code=false
width = Inputs.range([50, 300], { label: 'width', value: 100, step: 1 });
```

```js eval code=false
height = Inputs.range([50, 300], { label: 'height', value: 100, step: 1 });
```

```js eval code=false
renderer = Inputs.select(['webgl', 'webgpu'], { label: 'renderer' });
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson1;

    const $canvas = document.createElement('canvas');
    $canvas.style.outline = 'none';
    $canvas.style.padding = '0px';
    $canvas.style.margin = '0px';
    $canvas.style.border = '1px solid black';

    const canvas = await new Canvas({
        canvas: $canvas,
        renderer,
        shaderCompilerPath:
            'https://unpkg.com/@antv/g-device-api@1.6.13/dist/pkg/glsl_wgsl_compiler_bg.wasm',
    }).initialized;

    const resize = (width, height) => {
        const scale = window.devicePixelRatio;
        $canvas.width = Math.floor(width * scale);
        $canvas.height = Math.floor(height * scale);
        $canvas.style.width = `${width}px`;
        $canvas.style.height = `${height}px`;
        canvas.resize(width, height);
    };
    resize(width, height);

    const animate = () => {
        canvas.render();
        requestAnimationFrame(animate);
    };
    animate();
    return $canvas;
})();
```

## Camadas de abstração de hardware {#hardware-abstraction-layers}

Quero que a tela use APIs de renderização de mais baixo nível, como WebGL e WebGPU, o sucessor do WebGL, que traz muitos aprimoramentos de recursos. Veja [Do WebGL ao WebGPU]:

-   A camada inferior se baseia em uma nova geração de APIs nativas de GPU, incluindo Direct3D12 / Metal / Vulkan e outras.
-   API sem estado, sem um estado global impossível de gerenciar.
-   Suporte a Compute Shader.
-   Não há mais limite para o número de contextos criados por `<canvas>`.
-   Melhorias na experiência do desenvolvedor. Incluem mensagens de erro mais amigáveis e rótulos personalizados para objetos de GPU.

O ecossistema WebGPU agora se estende a JavaScript, C++ e Rust, e vários motores de renderização no lado web (por exemplo, Three.js, Babylon.js) estão em processo de adotá-lo, ou já concluíram essa adoção. Uma menção especial vai para o [wgpu], que, além do motor de jogos [bevy], também é usado em produção por ferramentas de design criativo baseadas na web, como o [Modyfi], e tem se saído muito bem. A imagem abaixo vem de: [Ecossistema WebGPU]

![Ecossistema WebGPU em 2023](https://developer.chrome.com/static/blog/webgpu-ecosystem/image/diagram-the-webgpu-ecosy-384594168a61_1920.png)

É claro que, dada a compatibilidade dos navegadores, ainda precisamos ser o mais compatíveis possível com WebGL1/2. No motor de renderização, a camada de abstração de hardware (HAL) abstrai os detalhes do hardware da GPU, permitindo que as camadas superiores independam da implementação específica de hardware.

Esperamos fornecer, na medida do possível, um conjunto unificado de APIs baseado em WebGL1/2 e WebGPU, junto com tradução e modularização de shaders. Esta lição usa o [@antv/g-device-api], cuja implementação referencia o [noclip] e adiciona compatibilidade com WebGL1. Consulte a nota de segurança acima antes de instalar a dependência.

Como WebGL e WebGPU usam linguagens de shader diferentes, e não queremos manter dois conjuntos de código, GLSL e WGSL, escolhemos traduzir o shader em tempo de execução:

![Transpilação do shader em tempo de execução](/shader-transpile.png)

No projeto, basta manter um conjunto de shaders com a sintaxe GLSL 300, fazer substituições de palavras-chave ao rebaixar para WebGL1 e converter para GLSL 440 antes de entregar a um [compilador](https://github.com/antvis/g-device-api/tree/master/rust) em formato WASM (usando naga e naga-oil) para gerar WGSL. Não por coincidência, a [Three.js Shading Language] também usa um nível mais alto de abstração e igualmente usa um compilador para gerar o código de shader da plataforma de execução de destino.

A seguir, as declarações de atributo usadas com frequência no Vertex Shader. Este é um cenário muito simples, e a sintaxe na verdade varia bastante quando se trata da parte de amostragem de textura.

```glsl
// GLSL 300
layout(location = 0) in vec4 a_Position;

// compiled GLSL 100
attribute vec4 a_Position;

// compiled GLSL 440
layout(location = 0) in vec4 a_Position;

// compiled WGSL
var<private> a_Position_1: vec4<f32>;
@vertex
fn main(@location(0) a_Position: vec4<f32>) -> VertexOutput {
    a_Position_1 = a_Position;
}
```

Recentemente, encontrei este artigo: [Renderização do Figma: impulsionada por WebGPU], e descobri que o Figma também adotou uma abordagem de implementação semelhante para concluir sua atualização para WebGPU:

> Mantemos nossos shaders GLSL existentes, escritos em um formato compatível com WebGL 1. O processador de shaders então traduz automaticamente esses shaders para WGSL. Isso envolve analisar os shaders, fazer as traduções necessárias para convertê-los a uma versão mais nova de GLSL e, em seguida, executar a ferramenta de código aberto naga para convertê-los em WGSL.

Bem, chega de camada de abstração de hardware. Se você tiver interesse nos detalhes de implementação, pode consultar diretamente o código-fonte do [@antv/g-device-api]. Vamos usar parte dessa API na última subseção desta lição.

## Projetar a API da tela {#design-the-canvas-api}

Finalmente chegamos à parte de projeto da nossa API da tela. O uso simples que esperamos é o seguinte:

-   Passar um HTMLCanvasElement `<canvas>` para criar e inicializar a tela, incluindo a criação do Device (uma instância abstrata da GPU) usando a camada de abstração de hardware.
-   Criar um loop de renderização que continua chamando os métodos de renderização da tela.
-   Suporte a redimensionar a tela, por exemplo em resposta ao evento `resize`.
-   Destruir a si mesma no momento adequado.

```ts
const canvas = new Canvas({
    canvas: $canvas,
});

const animate = () => {
    requestAnimationFrame(animate);
    canvas.render();
};
animate();

canvas.resize(500, 500);
canvas.destroy();
```

O uso de loops de renderização é muito comum em motores de renderização, como [Renderizando a cena] no Three.js e [Loop básico de desenho] no CanvasKit. Veja [Loops de jogo performáticos em JavaScript] para mais informações sobre por que se usa `requestAnimationFrame` em vez de `setTimeout`.

Parece uma definição de interface muito simples, mas não vamos nos apressar em implementá-la ainda, porque há um problema de inicialização assíncrona aqui.

```ts
interface Canvas {
    constructor(config: { canvas: HTMLCanvasElement });
    render(): void;
    destroy(): void;
    resize(width: number, height: number): void;
}
```

### Inicialização assíncrona {#asynchronous-initialization}

Esta também é uma diferença significativa entre WebGPU e WebGL. No WebGL, obter o contexto é um processo síncrono, enquanto obter um Device no WebGPU é assíncrono:

```ts
// create a context in WebGL
const gl = $canvas.getContext('webgl');

// obtaining a device in WebGPU
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
```

Portanto, ao usar a camada de abstração de hardware que mencionamos na seção anterior, também é preciso usar uma abordagem assíncrona. Isso representa uma mudança incompatível para todos os motores de renderização que queiram migrar de WebGL para WebGPU, como o Babylon.js: [A criação do motor WebGPU é assíncrona]：

```ts
import {
    WebGLDeviceContribution,
    WebGPUDeviceContribution,
} from '@antv/g-device-api';

// create a device in WebGL
const deviceContribution = new WebGLDeviceContribution({
    targets: ['webgl2', 'webgl1'],
});
// create a device in WebGPU
const deviceContribution = new WebGPUDeviceContribution({
    shaderCompilerPath: '/glsl_wgsl_compiler_bg.wasm',
});
// here's the asynchronous process
const swapChain = await deviceContribution.createSwapChain($canvas);
const device = swapChain.getDevice();
// create GPU objects with Device API
```

Como os construtores em JavaScript não suportam operações assíncronas, um método init assíncrono é adicionado à tela para inicializá-la, e o método de renderização é chamado depois que a inicialização termina:

```ts
const canvas = new Canvas();
await canvas.init();
canvas.render();
```

Mas não acho que essa seja uma boa abordagem. Em primeiro lugar, a palavra-chave `new` já implica inicialização. Em segundo lugar, o método init parece poder ser chamado várias vezes, mas, na realidade, não pode. Inspirado pelo [Padrão de construtor assíncrono em JavaScript], eu, pessoalmente, prefiro a seguinte sintaxe:

```ts
const canvas = await new Canvas().initialized;
```

Na verdade, esse padrão de projeto também é usado, por exemplo, pela [Animation: propriedade ready] da Web Animations API:

```ts
animation.ready.then(() => {});
```

### Implementação {#implementation}

Na implementação, usamos uma variável privada para guardar a Promise, e o getter também garante que ela seja somente leitura:

```ts
export class Canvas {
    #instancePromise: Promise<this>;
    get initialized() {
        return this.#instancePromise.then(() => this);
    }
}
```

Use uma Expressão de Função Assíncrona Imediatamente Invocada (IIAFE) dentro do construtor para fazer a inicialização:

```ts
constructor() {
  this.#instancePromise = (async () => {
    // Omit the specific implementation...
    return this;
  })();
}
```

Vamos continuar a otimizar o projeto atual.

## Arquitetura baseada em plugins {#plugin-based-architecture}

Poderíamos, é claro, colocar o código que chama a camada de abstração de hardware dentro do construtor de Canvas e destruir tudo junto no método `destroy`. Porém, à medida que adicionamos mais tarefas durante as fases de inicialização, renderização e destruição, a lógica de Canvas continua a crescer. É difícil pensar, logo no início, em todas as funcionalidades que precisam ser suportadas; por isso, queremos que a tela seja extensível.

```ts
destroy() {
  this.device.destroy();
  this.eventManager.destroy();
  // Omit other tasks...
}
```

Uma arquitetura baseada em plugins é um padrão de projeto comum, que pode ser visto no webpack, no VS Code e até no Chrome. Ela tem as seguintes características:

-   Modularidade. Cada plugin é responsável por uma parte independente, com menos acoplamento entre eles, o que facilita a manutenção.
-   Extensibilidade. Os plugins podem ser carregados e descarregados dinamicamente em tempo de execução sem afetar a estrutura do módulo central, alcançando a capacidade de expansão dinâmica da aplicação.

Essa arquitetura normalmente consiste nas seguintes partes:

-   A aplicação principal. Ela oferece a funcionalidade de registrar plugins, chama os plugins para executar no estágio adequado e fornece o contexto necessário para a execução do plugin.
-   A interface do plugin. Ela serve de ponte entre a aplicação principal e os plugins.
-   A coleção de plugins. Um conjunto de módulos executáveis de forma independente; cada plugin segue o princípio da separação de responsabilidades e contém apenas a funcionalidade mínima necessária.

Como a aplicação principal invoca a execução do plugin? Vamos olhar primeiro a abordagem do webpack:

-   Na aplicação principal, uma série de hooks é definida. Esses hooks podem ser síncronos ou assíncronos, e podem ser seriais ou paralelos. Se forem síncronos e seriais, são semelhantes aos ouvintes de evento comuns que conhecemos. No exemplo abaixo, `run` é um hook síncrono serial.
-   Cada plugin, ao se registrar, escuta os eventos de ciclo de vida que lhe interessam. No exemplo abaixo, `apply` é chamado durante o registro.
-   A aplicação principal dispara os hooks.

```ts
class ConsoleLogOnBuildWebpackPlugin {
    apply(compiler) {
        compiler.hooks.run.tap(pluginName, (compilation) => {
            console.log('webpack starting...');
        });
    }
}
```

O webpack implementa o toolkit [tapable] para fornecer essas capacidades e também usa `new Function` para melhorar o desempenho em cenários de chamadas em massa, como discutido em [O desempenho de new Function é realmente bom?]. Mas podemos simplesmente implementar na mesma linha, por exemplo: os hooks de execução serial sincronizada usam um array de `callbacks`, e não há magia negra:

```ts
export class SyncHook<T> {
    #callbacks: ((...args: AsArray<T>) => void)[] = [];

    tap(fn: (...args: AsArray<T>) => void) {
        this.#callbacks.push(fn);
    }

    call(...argsArr: AsArray<T>): void {
        this.#callbacks.forEach(function (callback) {
            /* eslint-disable-next-line prefer-spread */
            callback.apply(void 0, argsArr);
        });
    }
}
```

Definimos os seguintes hooks, com nomes que refletem visualmente em qual fase da aplicação principal eles serão chamados:

```ts
export interface Hooks {
    init: SyncHook<[]>;
    initAsync: AsyncParallelHook<[]>;
    destroy: SyncHook<[]>;
    resize: SyncHook<[number, number]>; // When height or width changed.
    beginFrame: SyncHook<[]>;
    endFrame: SyncHook<[]>;
}
```

O contexto do plugin que contém esses hooks é passado durante a fase de registro do plugin, e continuaremos a estender o contexto do plugin em seguida:

```ts
export interface PluginContext {
    hooks: Hooks;
    canvas: HTMLCanvasElement;
}
export interface Plugin {
    apply: (context: PluginContext) => void;
}
```

Chamar o método `apply` na inicialização da tela e passar o contexto conclui o registro do plugin e dispara a inicialização dos hooks síncronos e assíncronos, e o plugin de renderização que implementamos na próxima seção conclui a inicialização assíncrona:

```ts{8}
import { Renderer } from './plugins';

this.#instancePromise = (async () => {
  const { hooks } = this.#pluginContext;
  [new Renderer()].forEach((plugin) => {
    plugin.apply(this.#pluginContext);
  });
  hooks.init.call();
  await hooks.initAsync.promise();
  return this;
})();
```

Agora temos todo o conhecimento necessário para implementar o primeiro plugin.

## Plugin de renderização {#renderer-plugin}

Queremos dar suporte a WebGL e WebGPU, então permitimos a configuração pelo parâmetro `renderer` no construtor da tela, que em seguida é passado ao contexto do plugin:

```ts{3}
constructor(config: {
  canvas: HTMLCanvasElement;
  renderer?: 'webgl' | 'webgpu';
}) {}

this.#pluginContext = {
  canvas,
  renderer,
};
```

A seguir, descrevemos como usar a camada de abstração de hardware no plugin de renderização.

### SwapChain {#swapchain}

No OpenGL / WebGL, o [Default Framebuffer] é diferente do Framebuffer Object (FBO) usual, que é criado automaticamente ao inicializar o contexto. Se você não especificar um FBO ao chamar o comando de desenho, o OpenGL grava automaticamente o resultado da renderização no Default Framebuffer, onde o buffer de cor acaba sendo exibido na tela.

Não é assim no Vulkan. Em vez disso, temos a [SwapChain]. A imagem a seguir, de [Contexto do Canvas e Swap Chain], mostra como ela funciona: a GPU grava o resultado renderizado no backbuffer, o frontbuffer é usado para exibi-lo na tela, e os dois podem ser trocados.

![Buffer duplo](https://res.cloudinary.com/dx1kpewvo/image/upload/v1670938992/2022-12-19/webgpu_swap_1_nnce5v.png)

Sem esse mecanismo de buffer duplo, há uma boa chance de a GPU gravar os resultados renderizados ao mesmo tempo em que a tela está atualizando, o que pode causar tearing. Portanto, também é necessário usar sincronização vertical para forçar a tela a não permitir atualizações, e a figura a seguir, de [Contexto do Canvas e Swap Chain], mostra a temporização desse processo.

![Buffer duplo e V-Sync](https://res.cloudinary.com/dx1kpewvo/image/upload/v1671030455/2022-12-19/webgpu_swap_5_asrq42.png)

No WebGPU, o usuário normalmente não tem acesso direto à SwapChain, que é integrada ao [GPUCanvasContext]. O [wgpu], que também segue o projeto do WebGPU, combina a SwapChain na [Surface], que também não é acessível diretamente ao usuário. Porém, a nossa camada de abstração de hardware ainda usa esse conceito para encapsulamento. Isso permite que a SwapChain e o Device sejam criados durante a inicialização do plugin com base no parâmetro `renderer`:

```ts{13}
import {
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@antv/g-device-api';
import type { SwapChain, DeviceContribution, Device } from '@antv/g-device-api';

export class Renderer implements Plugin {
  apply(context: PluginContext) {
    const { hooks, canvas, renderer } = context;

    hooks.initAsync.tapPromise(async () => {
      let deviceContribution: DeviceContribution;
      if (renderer === 'webgl') {
        deviceContribution = new WebGLDeviceContribution();
      } else {
        deviceContribution = new WebGPUDeviceContribution();
      }
      const { width, height } = canvas;
      const swapChain = await deviceContribution.createSwapChain(canvas);
      swapChain.configureSwapChain(width, height);

      this.#swapChain = swapChain;
      this.#device = swapChain.getDevice();
    });
  }
}
```

### devicePixelRatio {#devicepixelratio}

O [devicePixelRatio] descreve quantos pixels reais da tela devem ser usados para desenhar um único pixel CSS. Normalmente, definimos o `<canvas>` com o seguinte código:

```ts
const $canvas = document.getElementById('canvas');
$canvas.style.width = `${width}px`; // CSS Pixels
$canvas.style.height = `${height}px`;

const scale = window.devicePixelRatio;
$canvas.width = Math.floor(width * scale); // Screen Pixels
$canvas.height = Math.floor(height * scale);
```

Usamos pixels CSS ao descrever a largura e a altura da tela e o tamanho do gráfico, e os pixels reais da tela ao criar a SwapChain. A largura e a altura passadas em `resize` também usam pixels CSS, então precisam ser convertidas:

```ts{3}
hooks.resize.tap((width, height) => {
  this.#swapChain.configureSwapChain(
    width * devicePixelRatio,
    height * devicePixelRatio,
  );
});
```

Então, como obtemos o [devicePixelRatio]? É claro que podemos usar `window.devicePixelRatio` para obtê-lo, o que funciona na maioria dos casos. Mas e se não houver um objeto `window` no ambiente de execução? Por exemplo:

-   Renderização no lado do servidor com Node.js. Por exemplo, usando [headless-gl]
-   Renderização em um WebWorker, usando [OffscreenCanvas].
-   Ambientes de navegador não padrão, como applets

Por isso, é melhor permitir passar o valor ao criar a tela e tentar obtê-lo de [globalThis] quando ele não for passado. Modificamos os parâmetros do construtor de Canvas da seguinte forma:

```ts{2}
export interface CanvasConfig {
  devicePixelRatio?: number;
}

const { devicePixelRatio } = config;
const globalThis = getGlobalThis();
this.#pluginContext = {
  devicePixelRatio: devicePixelRatio ?? globalThis.devicePixelRatio,
};
```

Os outros hooks são implementados da seguinte forma:

```ts
hooks.destroy.tap(() => {
    this.#device.destroy();
});

hooks.beginFrame.tap(() => {
    this.#device.beginFrame();
});

hooks.endFrame.tap(() => {
    this.#device.endFrame();
});
```

Por fim, adicione o plugin à lista de plugins da tela:

```ts{1}
[new Renderer(), ...plugins].forEach((plugin) => {
  plugin.apply(this.#pluginContext);
});
```

## Demonstração {#demo}

Como ainda não desenhamos nenhum gráfico e a tela está em branco, como sabemos quais comandos WebGL / WebGPU de baixo nível estão sendo chamados? A depuração no lado web pode ser feita com os plugins do Chrome: [Spector.js] e [WebGPU Inspector].

A imagem a seguir mostra o comando do primeiro quadro capturado com o Spector.js, e você pode ver que criamos uma série de objetos de GPU, como FrameBuffer, Texture etc.:

![Captura do Spector.js](/spectorjs.png)

Depois de alternar para a renderização WebGPU:

```ts{3}
const canvas = await new Canvas({
  canvas: $canvas,
  renderer: 'webgpu',
}).initialized;
```

Abra o WebGPU Inspector para ver os objetos de GPU que criamos e os comandos chamados em cada quadro:

![Captura do WebGPU Inspector](/webgpu-inspector.png)

## Leitura adicional {#extended-reading}

Se você não tiver nenhum conhecimento básico de WebGL, pode tentar aprendê-lo primeiro:

-   [WebGL Fundamentals]
-   [WebGPU Fundamentals]

Mais sobre o padrão de projeto de plugins:

-   [Introdução à programação orientada a plugins]
-   [Apresentando: sistema de plugins do Penpot]
-   [Extensões no Tiptap]

[Ecossistema WebGPU]: https://developer.chrome.com/blog/webgpu-ecosystem/
[Do WebGL ao WebGPU]: https://developer.chrome.com/blog/from-webgl-to-webgpu
[@antv/g-device-api]: https://github.com/antvis/g-device-api
[Introdução à programação orientada a plugins]: https://pop-book.readthedocs.io/en/latest/index.html
[wgpu]: https://wgpu.rs/
[bevy]: https://bevyengine.org/
[noclip]: https://github.com/magcius/noclip.website
[Modyfi]: https://digest.browsertech.com/archive/browsertech-digest-how-modyfi-is-building-with/
[Padrão de construtor assíncrono em JavaScript]: https://qwtel.com/posts/software/async-constructor-pattern/
[Animation: propriedade ready]: https://developer.mozilla.org/en-US/docs/Web/API/Animation/ready
[Renderizando a cena]: https://threejs.org/docs/index.html#manual/en/introduction/Creating-a-scene
[A criação do motor WebGPU é assíncrona]: https://doc.babylonjs.com/setup/support/WebGPU/webGPUBreakingChanges#creation-of-the-webgpu-engine-is-asynchronous
[Spector.js]: https://spector.babylonjs.com/
[WebGPU Inspector]: https://github.com/brendan-duncan/webgpu_inspector
[tapable]: https://github.com/webpack/tapable
[O desempenho de new Function é realmente bom?]: https://github.com/webpack/tapable/issues/162
[WebGL Fundamentals]: https://webglfundamentals.org/
[WebGPU Fundamentals]: https://webgpufundamentals.org/
[devicePixelRatio]: https://developer.mozilla.org/zh-CN/docs/Web/API/Window/devicePixelRatio
[headless-gl]: https://github.com/stackgl/headless-gl
[OffscreenCanvas]: https://developer.mozilla.org/zh-CN/docs/Web/API/OffscreenCanvas
[SwapChain]: https://vulkan-tutorial.com/Drawing_a_triangle/Presentation/Swap_chain
[Default Framebuffer]: https://www.khronos.org/opengl/wiki/Default_Framebuffer
[globalThis]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
[Surface]: https://docs.rs/wgpu/latest/wgpu/struct.Surface.html
[GPUCanvasContext]: https://gpuweb.github.io/gpuweb/#canvas-context
[Contexto do Canvas e Swap Chain]: https://carmencincotti.com/2022-12-19/how-to-render-a-webgpu-triangle-series-part-three-video/#bonus-content-swap-chain
[Apresentando: sistema de plugins do Penpot]: https://www.smashingmagazine.com/2024/11/open-source-meets-design-tooling-penpot/
[Loops de jogo performáticos em JavaScript]: https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/
[Extensões no Tiptap]: https://tiptap.dev/docs/editor/core-concepts/extensions#what-are-extensions
[Loop básico de desenho]: https://skia.org/docs/user/modules/quickstart/#basic-draw-loop
[Three.js Shading Language]: https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language
[Renderização do Figma: impulsionada por WebGPU]: https://www.figma.com/blog/figma-rendering-powered-by-webgpu/
