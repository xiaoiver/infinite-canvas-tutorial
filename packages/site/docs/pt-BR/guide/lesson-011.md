---
outline: deep
description: 'Configure testes abrangentes com Jest, incluindo testes unitários, testes de regressão visual, renderização no servidor com headless-gl, testes E2E com Playwright e testes de compatibilidade de navegadores.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lição 11 - Teste e renderização no servidor',
          },
      ]
---
# Lição 11 - Teste e renderização no servidor {#lesson-11-test-and-server-side-rendering}

Atualmente, a funcionalidade da nossa tela está ficando cada vez mais complexa, e chegou a hora de introduzir testes para melhorar a qualidade do projeto. Nesta lição, você vai aprender o seguinte:

-   Configuração do ambiente de testes baseado em Jest, incluindo os ambientes local e de CI
-   Uso de testes unitários para melhorar a cobertura de código
-   Teste de regressão visual
    -   Renderização no servidor baseada em headless-gl, voltada para WebGL1
    -   Teste E2E baseado em Playwright, voltado para WebGL2 e WebGPU
-   Teste de UI E2E
-   Teste de compatibilidade de navegadores baseado no BrowserStack
-   Renderizar em WebWorker

Todo o código do projeto relacionado ao que foi dito acima pode ser encontrado na pasta [\_\_tests\_\_] do nosso projeto.

## Ambiente de testes {#test-environment}

Escolhemos o Jest como framework de testes e adicionamos comandos de teste no `package.json` para contabilizar a cobertura de código:

```json
"scripts": {
    "cov": "jest --coverage"
}
```

Execute o comando de teste `pnpm cov` no workflow do GitHub, precedido pelo comando `xvfb-run` quando a renderização no servidor é introduzida:

```yaml
- name: Cov
run: |
    xvfb-run -s "-ac -screen 0 1280x1024x16" pnpm cov
env:
    CI: true
- name: Coveralls
uses: coverallsapp/github-action@master
with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

Com o `d3-color`, esbarramos em um problema comum. Como o D3, por padrão, só fornece saída ESM, não conseguimos executá-lo diretamente no Node.js. Temos duas opções.

1. O Jest oferece a configuração [transformIgnorePatterns], que permite adicionar o `d3-color` e até dependências relacionadas ao D3 e compilá-las para CJS.
2. Usar a biblioteca substituta do D3 [victory-vendor], que é funcionalmente idêntica, mas oferece saída CJS adicional; veja [d3-color issue in recharts].

Escolhemos a primeira abordagem:

```js
const esm = ['d3-*'].map((d) => `_${d}|${d}`).join('|');
module.exports = {
    transformIgnorePatterns: [`<rootDir>/node_modules/(?!(?:.pnpm/)?(${esm}))`],
};
```

O ambiente de testes está pronto, e agora você pode começar a escrever seu primeiro caso de teste.

## Teste unitário {#unit-test}

Vamos começar pelos testes unitários, os mais fáceis de implementar. Eles servem bem para testar funcionalidades que não estão relacionadas à renderização, como definir propriedades gráficas, calcular o tamanho da caixa delimitadora, determinações de picking, vários métodos utilitários e assim por diante.

```ts
// __tests__/unit/circle.spec.ts
import { Circle } from '../../packages/core/src';

describe('Circle', () => {
    it('should get/set attributes correctly.', () => {
        const circle = new Circle({
            cx: 50,
            cy: 50,
            r: 50,
            fill: '#F67676',
        });
        expect(circle.cx).toBe(50);
    });
});
```

Parece bom. Aumentamos a cobertura de testes do Circle para 100%.

```bash
------------------------------|---------|----------|---------|---------|-----------------------
File                          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------------|---------|----------|---------|---------|-----------------------
All files                     |   14.21 |    10.44 |    8.18 |   14.29 |
 src/shapes                   |   26.81 |    22.64 |   21.62 |   28.15 |
  Circle.ts                   |     100 |      100 |     100 |     100 |
```

Mas o teste unitário tem suas limitações. Afinal, ele só mira uma pequena parte do código e não garante que o sistema, como um todo, esteja funcionando corretamente. Por exemplo, talvez consigamos dizer se um círculo foi desenhado corretamente, mas e se forem 100? Escrever asserções de teste seria bem mais demorado e difícil.

## Teste de regressão visual {#visual-regression-testing}

No mundo dos testes, "golden image" é um termo usado para descrever uma imagem padrão ou de referência em um conjunto de casos de teste. O termo é usado com frequência em testes de regressão visual, uma metodologia de testes automatizados que detecta mudanças visuais ao comparar capturas de tela de um aplicativo ou site com um conjunto de imagens de referência predefinidas.

Para motores de renderização, é mais fácil verificar a correção dos resultados de renderização do que com testes unitários, e isso pode reduzir bastante a necessidade de escrever asserções manuais. O [pixelmatch] facilita a comparação de imagens e o destaque das diferenças:

![pixelmatch](/pixelmatch.png)

Há duas formas de pensar em como obter capturas de tela no Node.js:

1. renderização no servidor. Dependendo da técnica de renderização, você pode escolher a implementação em Node.js:

    - [node-canvas], implementação de Canvas baseada em Cairo
    - [jsdom], implementação em JS puro de DOM e HTML.
    - [headless-gl] suporta a criação de um contexto WebGL, mas só suporta WebGL1. 2.

2. navegadores headless. Exemplos incluem o puppeteer antigo, o electron ou o Playwright, mais recente.

É interessante ver o que os motores de renderização populares usam atualmente:

-   [Three.js Puppeteer]
-   O Babylon.js usou Jest + Puppeteer no passado, mas agora usa Playwright; veja: [Move visualization testing to playwright]
-   O luma.gl usa [headless-gl]; veja: [Register devices]
-   O plot usa [mocha + JSDOM]

Vamos explorar as duas opções separadamente.

### Renderização no servidor {#server-side-rendering}

Embora a renderização no servidor baseada na implementação do headless-gl só suporte WebGL1, há cenários em que a renderização no servidor é adequada:

-   Cenários com pouca ou nenhuma interação
-   Cenas pouco interativas ou até não interativas, que não exigem alto desempenho em tempo real e podem ser geradas offline, sem problemas de desempenho em tempo de execução.
-   A saída é uma imagem de pixels ou vetorial, que pode ser exibida em vários sites.

Para suportar a renderização no servidor, precisamos garantir que o nosso código rode em um ambiente Node.js. Então, como devemos tratar as chamadas da API do DOM no código? A primeira ideia é decidir pelo ambiente; por exemplo, registrar listeners de eventos apenas no ambiente do navegador e chamar o método `addEventListener()`:

```ts{2}
const plugins = [
    isBrowser ? new DOMEventListener() : undefined,
    //...
];
```

Outra forma de pensar nisso pode ser encontrada em [d3-selector]. Observamos que ele não assume a existência da variável global `document` e, em vez disso, escolhe obtê-la a partir do contexto, para que as camadas superiores tenham a oportunidade de passar uma implementação em JS puro da API do DOM, como o `jsdom`, que também funciona no servidor.

```ts{3}
function creatorInherit(name) {
  return function() {
    var document = this.ownerDocument,
        uri = this.namespaceURI;
    return uri === xhtml && document.documentElement.namespaceURI === xhtml
        ? document.createElement(name)
        : document.createElementNS(uri, name);
  };
}
```

A mesma ideia pode ser vista em [react-reconciler], em que ambientes diferentes, como DOM, Canvas, console etc., só precisam implementar as interfaces combinadas na configuração:

> Uma "host config" é um objeto que você precisa fornecer e que descreve como fazer algo acontecer no ambiente "host" (por exemplo, DOM, canvas, console ou qualquer que seja o alvo de renderização). Ela se parece com isto:

```ts
const HostConfig = {
    createInstance(type, props) {
        // e.g. DOM renderer returns a DOM node
    },
    // ...
    appendChild(parent, child) {
        // e.g. DOM renderer would call .appendChild() here
    },
    // ...
};
```

A [Environment API] do Vite tenta resolver um problema parecido:

> As mudanças iniciadas pela Runtime API agora estão motivando uma revisão completa da forma como o Vite lida com ambientes (client, SSR, workerd etc.).

Voltando ao nosso cenário, os seguintes itens de configuração precisam ser fornecidos para o ambiente Node.js:

```ts
export interface CanvasConfig {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
     */
    devicePixelRatio?: number;
    /**
     * There is no `style.cursor = 'pointer'` in WebWorker.
     */
    setCursor?: (cursor: Cursor | string) => void;
}
```

#### Gerar PNG {#ssr-png}

Com o [headless-gl], você pode criar um WebGLRenderingContext e encapsulá-lo em um objeto da classe HTMLCanvasElement. Depois, você pode usá-lo para criar uma tela normalmente:

```ts
export function getCanvas(width = 100, height = 100) {
    let gl = _gl(width, height, {
        antialias: false,
        preserveDrawingBuffer: true,
        stencil: true,
    });

    const mockedCanvas: HTMLCanvasElement = {
        width,
        height,
        getContext: () => {
            gl.canvas = mockedCanvas;
            return gl;
        },
        addEventListener: () => {},
    };

    return mockedCanvas;
}
```

Quando você tem o WebGLRenderingContext, pode chamar [readPixels] para obter os valores dos pixels na área especificada e, em seguida, gravá-los no PNG para obter a imagem de base.

```ts
async function writePNG(gl: WebGLRenderingContext, path: string) {
    const width = gl.canvas.width;
    const height = gl.canvas.height;

    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    await createPNGFromRawdata(path, width, height, pixels);
}
```

Cada vez que você executa um teste, pode comparar a imagem de base com a imagem gerada por esse teste usando o [pixelmatch] e gravar as diferenças em um arquivo para facilitar a visualização. Isso é feito com uma extensão de asserção personalizada fornecida pelo Jest:

```ts
// useSnapshotMatchers.ts
// @see https://jestjs.io/docs/26.x/expect#expectextendmatchers
expect.extend({
    toMatchWebGLSnapshot,
    toMatchSVGSnapshot,
});

// Diff with golden image in test case.
expect($canvas.getContext()).toMatchWebGLSnapshot(dir, 'rect');
```

O código completo está detalhado em: [toMatchWebGLSnapshot.ts]

#### Gerar SVG {#ssr-svg}

Para testar a nossa funcionalidade de exportação de imagem, precisamos fornecer [jsdom] e [xmlserializer] como alternativas ao ambiente do navegador para o ImageExporter. O primeiro é usado para criar um SVGElement no ambiente Node.js, e o segundo é usado para serializá-lo em uma string:

```ts{6,7}
import xmlserializer from 'xmlserializer';
import { JSDOM } from 'jsdom';

const exporter = new ImageExporter({
    canvas,
    document: new JSDOM().window._document,
    xmlserializer,
});
```

Quando você tem a string do SVGElement, pode gravá-la em um arquivo e, antes disso, formatá-la com o prettier para facilitar a leitura:

```ts{11}
import xmlserializer from 'xmlserializer';
import { format } from 'prettier';

export function toMatchSVGSnapshot(
    dom: SVGElement | null,
    dir: string,
    name: string,
    options: ToMatchSVGSnapshotOptions = {},
) {
    let actual = dom
      ? format(xmlserializer.serializeToString(dom), {
          parser: 'babel',
        })
}
```

O código completo está detalhado em: [toMatchSVGSnapshot.ts]

#### Como simular eventos de interação {#how-to-mock-event}

Com o JSDOM, você pode simular eventos de interação como `MouseEvent` e disparar o Hook correspondente diretamente após a criação, contornando assim a limitação de ter que escutar eventos pela API do DOM:

```ts
const window = new JSDOM().window;

const pointerdownEvent = new window.MouseEvent('pointerdown', {
    clientX: 100,
    clientY: 100,
});
canvas.pluginContext.hooks.pointerDown.call(pointerdownEvent);
```

Isso também facilita simular uma combinação de eventos como arrastar e soltar. O caso de teste a seguir demonstra o teste do limiar de decisão do [Plugin de arrastar e soltar]. Simulamos um conjunto de eventos consecutivos `pointerdown`, `pointermove` e `pointerup`, mas o evento `dragstart` não será disparado por causa do intervalo curto e da proximidade dos eventos vizinhos:

```ts
const dragstartHandler = jest.fn();

canvas.root.addEventListener('dragstart', dragstartHandler);
canvas.pluginContext.hooks.pointerDown.call(
    createMouseEvent('pointerdown', { clientX: 100, clientY: 100 }),
);
canvas.pluginContext.hooks.pointerMove.call(
    createMouseEvent('pointermove', { clientX: 101, clientY: 101 }),
);
canvas.pluginContext.hooks.pointerUp.call(
    createMouseEvent('pointerup', { clientX: 101, clientY: 101 }),
);
expect(dragstartHandler).not.toBeCalled();
```

#### SSR na CI {#ssr-ci}

[How can I use headless-gl with a continuous integration service?]

```yaml
- name: Install headless-gl dependencies
    run: |
        sudo apt-get update
        sudo apt-get install -y mesa-utils xvfb libgl1-mesa-dri libglapi-mesa libosmesa6

- name: Cov
    run: |
        xvfb-run -s "-ac -screen 0 1280x1024x16" pnpm cov
```

O código completo está detalhado em: [github workflows - test]

### Navegador headless {#headless-browser}

Por melhor que seja a renderização no servidor, as soluções de navegador headless têm vantagens próprias e insubstituíveis nos testes. Usando o Playwright como exemplo:

-   Suporte a WebGL 1/2 e até WebGPU com o Chrome mais recente.
-   Asserções oficiais como toHaveScreenshot são fornecidas diretamente, comparações em nível de pixel vêm integradas e as diferenças aparecem no relatório quando falham; veja [Visual comparisons] para detalhes.
-   O suporte a [sharding] permite paralelismo em várias máquinas na CI.

#### Executar o servidor de desenvolvimento {#run-webserver}

O navegador do Playwright precisa acessar os casos de teste implantados no servidor de desenvolvimento, e escolhemos o Vite como servidor de testes:

```ts{6}
import { devices, defineConfig } from '@playwright/test';

export default defineConfig({
    // Run your local dev server before starting the tests
    webServer: {
        command: 'npm run dev:e2e', // vite dev
        url: 'http://localhost:8080',
        reuseExistingServer: !process.env.CI,
        stdout: 'ignore',
        stderr: 'pipe',
    },
});
```

#### Abrir o caso de teste {#browse-testcase}

Acesse a URL correspondente ao caso de teste depois de iniciar o servidor:

```ts
test(name, async ({ page, context }) => {
    const url = `./infinitecanvas/?name=${name}`;
    await page.goto(url);
    await readyPromise;

    await expect(page.locator('canvas')).toHaveScreenshot(`${name}.png`);
});
```

A comparação entre esse resultado e a imagem de referência é visualizada no relatório de teste gerado:

![Diferença de imagem do Playwright](/playwright-image-diff.png)

Na prática, percebi que as capturas de tela geradas localmente costumam ser um pouco diferentes do ambiente de CI. Por exemplo, no lado esquerdo da imagem abaixo está uma captura gerada pelo meu ambiente local, enquanto no lado direito está uma captura gerada pelo ambiente de CI, com alguns retângulos apresentando cortes estranhos.
Nesse caso, você pode usar o ambiente de CI no lugar da imagem de base gerada localmente para garantir consistência. Você pode enviar os artefatos do workflow do GitHub para obter uma captura do ambiente de CI e baixá-la localmente como imagem de base.

![Diferença entre os ambientes local e de CI](/playwright-local-vs-ci.png)

#### WebGL2 e WebGPU {#webgl2-webgpu}

A maior vantagem de uma solução de teste de ponta a ponta em relação à renderização no servidor com [headless-gl] é que ela suporta tanto WebGL2 quanto WebGPU. Isso nos permite escrever apenas um conjunto de casos de teste, criar uma tela com base nas configurações de renderizador nas URLs e gerar as imagens de base de WebGL2 e WebGPU, respectivamente.

```ts
['webgl', 'webgpu'].forEach((renderer) => {
    test(`${name} with ${renderer}`, async ({ page, context }) => {
        const url = `./infinitecanvas/?name=${name}`; // [!code --]
        const url = `./infinitecanvas/?name=${name}&renderer=${renderer}`; // [!code ++]
        await page.goto(url);
        await expect(page.locator('canvas')).toHaveScreenshot([
            renderer,
            `${name}.png`,
        ]);
    });
});
```

#### Configuração de CI {#e2e-ci}

Como mencionei antes, o [sharding] suporta paralelismo em várias máquinas na CI, e cada máquina pode ter várias threads ativadas. Por exemplo, vamos usar 4 máquinas, cada uma com 10 workers em paralelo, e mesclar os relatórios em um só no final.

```yaml
jobs:
    e2e:
        timeout-minutes: 60
        runs-on: ubuntu-latest
        strategy:
            fail-fast: false
            matrix:
                shard: [1/4, 2/4, 3/4, 4/4]
```

A execução é a seguinte; para detalhes: [E2E action]

![Sharding do Playwright](/playwright-sharding.png)

#### Função Lambda da AWS {#aws-lambda-function}

Agora precisamos criar uma função Lambda na AWS que faça a renderização no servidor usando uma Layer personalizada que contém o `headless-gl`.

![camada do Lambda na AWS](/aws-lambda-layer.png)

Vamos construir a Layer localmente usando a imagem Amazon Linux 2023, já que o nosso ambiente de execução alvo é o Node.js 20.x:

```bash
# Lambda runtime compatible base
FROM amazonlinux:2023

# Enable Node.js 20 and essential build tools
RUN yum update -y && \
    yum install -y \
      gcc \
      gcc-c++ \
      make \
      python3 \
      pkgconf-pkg-config \
      mesa-libGL-devel \
      mesa-libEGL-devel \
      mesa-libGLU-devel \
      mesa-libOSMesa-devel \
      libXi-devel \
      libXext-devel \
      libX11-devel \
      libxcb-devel \
      libXau-devel \
      libXdmcp-devel && \
    ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /build

# Create nodejs directory (Lambda Layer structure)
RUN mkdir -p nodejs

# Install Node.js (Amazon Linux 2023 default no Node)
RUN curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && \
    yum install -y nodejs

# Install headless-gl and dependencies
RUN npm install --prefix ./nodejs gl --build-from-source

# Copy mesa libraries (optional but helps ensure runtime success)
RUN mkdir -p lib64 && \
    cp /usr/lib64/libGL.so.* lib64/ && \
    cp /usr/lib64/libGLU.so.* lib64/ && \
    cp /usr/lib64/libOSMesa.so.* lib64/ && \
    cp /usr/lib64/libX11.so.* lib64/ && \
    cp /usr/lib64/libXau.so.* lib64/ && \
    cp /usr/lib64/libXi.so.* lib64/ && \
    cp /usr/lib64/libxcb.so.* lib64/ && \
    cp /usr/lib64/libXdmcp.so.* lib64/ && \
    cp /usr/lib64/libXext.so.* lib64/ || true

# Package final layer zip (AWS expects nodejs/ at root)
RUN zip -r9 /opt/headless-gl-layer.zip nodejs lib64

CMD ["bash"]
```

Em seguida, envie para o S3 para concluir a criação da layer:

```bash
aws lambda publish-layer-version \
  --layer-name headless-gl-layer \
  --description "Headless GL for Node.js on AL2 arm64" \
  --compatible-runtimes nodejs20.x \
  --compatible-architectures arm64 \
  --content S3Bucket=<your-bucket>,S3Key=headless-gl-layer.zip
```

Agora você pode selecionar essa Layer no console da AWS para adicioná-la à sua função.

## Teste E2E {#e2e-test}

O [Playwright Components (experimental)] suporta testes em nível de componente de frameworks de UI como React, Svelte, Vue e outros. Em comparação com escrever casos de teste usando `@playwright/test`, um método `mount` foi adicionado ao objeto de parâmetros:

```ts{3}
import { test, expect } from '@playwright/experimental-ct-react';

test('should work', async ({ mount }) => {
  const component = await mount(<HelloWorld msg="greetings" />);
  await expect(component).toContainText('Greetings');
});
```

O framework de testes recomendado em [Lit Testing] não inclui o Playwright, mas podemos testar os nossos [Web Components] usando [Playwright Web component testing] da comunidade.

```ts
import { defineConfig } from '@playwright/test'; // [!code --]
import { defineConfig } from '@sand4rt/experimental-ct-web'; // [!code ++]

export default defineConfig({});
```

Agora é hora de escrever testes para o nosso componente Web Component.

### Testar Web Component {#webcomponent-test}

Usando o componente da barra de ferramentas de zoom da câmera como exemplo, podemos testar se a propriedade `zoom` está sendo exibida corretamente:

```ts
import { test, expect } from '@sand4rt/experimental-ct-web';
import { ZoomToolbar } from '../../packages/ui/src';

test('should display zoom correctly.', async ({ mount }) => {
    const component = await mount(ZoomToolbar, {
        props: {
            zoom: 100,
        },
    });
    await expect(component).toContainText('100%');
});
```

## Teste de compatibilidade de navegadores {#browser-compatibility-test}

O BrowserStack é uma plataforma de testes na nuvem que oferece uma série de ferramentas e serviços para testar aplicativos web e móveis em diferentes navegadores, sistemas operacionais, dispositivos e ambientes do mundo real. O BrowserStack permite que desenvolvedores e equipes de QA (garantia de qualidade) testem seus aplicativos em uma variedade de configurações para garantir compatibilidade, desempenho e experiência do usuário.

O Babylon.js usa [browserstack-local] para testes de compatibilidade.

## Renderização em WebWorker {#rendering-in-webworker}

Além do lado do servidor, o WebWorker também é considerado um ambiente de execução especial. Executar o código de renderização em um WebWorker evita bloquear a thread principal e melhora o desempenho. Casos de uso são fornecidos por motores de renderização conhecidos:

-   [Three.js OffscreenCanvas]
-   [Babylon.js OffscreenCanvas]

No nosso [WebWorker example], a thread principal não está ocupada e, portanto, não mostra suas vantagens. No entanto, é possível experimentar interações da tela, como zoom, panorâmica e rotação da câmera, picking de formas e assim por diante.

### Criar OffscreenCanvas {#offscreen-canvas}

Primeiro, você precisa garantir que seu ambiente de execução suporte OffscreenCanvas; veja [Can I use OffscreenCanvas?]：

```ts
if ('OffscreenCanvas' in window && 'transferControlToOffscreen' in mainCanvas) {
    // Ok to use offscreen canvas
}
```

Depois, precisamos fazer a nossa tela suportar a criação a partir de OffscreenCanvas:

```ts
export interface CanvasConfig {
    canvas: HTMLCanvasElement; // [!code --]
    canvas: HTMLCanvasElement | OffscreenCanvas; // [!code ++]
}
```

O código da thread principal é o seguinte:

1. primeiro transfira o controle da tela principal para o OffscreenCanvas com [transferControlToOffscreen]
2. Crie um WebWorker, usando o método fornecido pelo Vite. Ele escuta mensagens que são passadas para ele, como definir o estilo do mouse.
3. Normalmente passaríamos o primeiro parâmetro de [postMessage] para o WebWorker, mas, como OffscreenCanvas é [Transferable], precisamos usar o segundo parâmetro aqui.

```ts
// @see https://vitejs.dev/guide/features.html#import-with-query-suffixes
import Worker from './worker.js?worker&inline';

// 1.
const offscreenCanvas = mainCanvas.transferControlToOffscreen();

// 2.
worker = new Worker();
worker.onmessage = function (event) {
    // TODO: Handle message from WebWorker later.
};

// 3.
worker.postMessage(
    {
        type: 'init',
        offscreenCanvas,
        devicePixelRatio,
        boundingClientRect: mainCanvas.getBoundingClientRect(),
    },
    [offscreenCanvas],
);
```

O código do WebWorker é o seguinte:

1. Obtenha o OffscreenCanvas passado pela thread principal no objeto de evento. 2.
2. Crie uma tela com o OffscreenCanvas e defina o devicePixelRatio.
3. Crie um [Loop de renderização] que cria os gráficos e os adiciona à tela normalmente.

```ts
// worker.js
self.onmessage = function (event) {
    const { type } = event.data;
    if (type === 'init') {
        // 1.
        const { offscreenCanvas, devicePixelRatio } = event.data;

        (async () => {
            // 2.
            const canvas = await new Canvas({
                canvas: offscreenCanvas,
                devicePixelRatio,
            }).initialized;

            // 3.
            const animate = () => {
                canvas.render();
                self.requestAnimationFrame(animate);
            };
            animate();
        })();
    }
    // ...Handle other messages.
};
```

Na prática, é inevitável que a comunicação entre a thread principal e o WebWorker precise ser tratada manualmente. Por exemplo:

1. eventos de interação. O [sistema de eventos] depende da API do DOM, mas ela não está disponível no WebWorker, então você precisa escutar os eventos de interação da tela na thread principal e notificar o WebWorker.
2. mudança de tamanho da tela. O mesmo que acima. 3.
3. definir o estilo do mouse da tela principal.

### Eventos no WebWorker {#events-in-webworker}

Tomando o evento `pointerdown` como exemplo, escutamos por ele na tela principal e, como o Event nativo não é [Transferable], precisamos serializá-lo e passá-lo para o WebWorker:

```ts
mainCanvas.addEventListener(
    'pointerdown',
    (e) => {
        worker.postMessage({
            type: 'event',
            name: 'pointerdown',
            event: clonePointerEvent(e), // Simple copy of common properties on event objects
        });
    },
    true,
);
```

O Hook correspondente é disparado diretamente quando o WebWorker recebe uma mensagem desse tipo:

```ts
self.onmessage = function (event) {
    const { type } = event.data;
    if (type === 'event') {
        const { name, event: ev } = event.data;
        if (name === 'pointerdown') {
            canvas.pluginContext.hooks.pointerDown.call(ev);
        }
    }
};
```

O tratamento do evento de mudança de tamanho da tela é o mesmo que acima, então o omitimos.

### Definir o estilo do cursor {#set-cursor}

O WebWorker também precisa passar mensagens para a thread principal durante a renderização, por exemplo:

-   Notificar a thread principal a cada quadro de que a renderização terminou, passando estatísticas como os gráficos realmente renderizados, o número de gráficos rejeitados etc.
-   Definir o estilo do mouse quando o gráfico recebe o picking

```ts
setCursor: (cursor) => {
    self.postMessage({ type: 'cursor', cursor });
},
```

A thread principal recebe a mensagem e define o estilo do mouse da tela:

```ts
worker.onmessage = function (event) {
    if (event.data.type === 'cursor') {
        mainCanvas.style.cursor = event.data.cursor;
    }
};
```

De qualquer forma, renderizar a tela no WebWorker exige tratamento adicional da comunicação com a thread principal. Eventos de interação, estilos e componentes de UI precisam ser projetados com os eventos correspondentes. Acredito que esse seja o motivo pelo qual a maioria dos motores de renderização 3D para a web só fornece exemplos simples ou diretrizes.

## Leitura adicional {#extended-reading}

-   [How can I use headless-gl with a continuous integration service?]
-   [Playwright Components (experimental)]
-   [Canvas Lambda Layer]

[node-canvas]: https://github.com/Automattic/node-canvas
[headless-gl]: https://github.com/stackgl/headless-gl
[jsdom]: https://github.com/jsdom/jsdom
[Lit Testing]: https://lit.dev/docs/tools/testing/
[transformIgnorePatterns]: https://jestjs.io/docs/configuration#transformignorepatterns-arraystring
[d3-color issue in recharts]: https://github.com/recharts/recharts/commit/bcb199c0d60b79fa09704413ed9a440cc0a7b1c9
[victory-vendor]: https://www.npmjs.com/package/victory-vendor
[Three.js Puppeteer]: https://github.com/mrdoob/three.js/blob/dev/test/e2e/puppeteer.js
[Move visualization testing to playwright]: https://github.com/BabylonJS/Babylon.js/pull/15149
[Register devices]: https://github.com/visgl/luma.gl/blob/master/modules/test-utils/src/register-devices.ts#L7
[pixelmatch]: https://github.com/mapbox/pixelmatch
[sharding]: https://playwright.dev/docs/test-sharding
[d3-selector]: https://github.com/d3/d3-selection/blob/main/src/creator.js#L6
[mocha + JSDOM]: https://github.com/observablehq/plot/blob/main/test/jsdom.js
[Can I use OffscreenCanvas?]: https://caniuse.com/#feat=offscreencanvas
[react-reconciler]: https://www.npmjs.com/package/react-reconciler
[Environment API]: https://github.com/vitejs/vite/discussions/16358
[Transferable]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
[postMessage]: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
[Three.js OffscreenCanvas]: https://threejs.org/examples/webgl_worker_offscreencanvas.html
[Babylon.js OffscreenCanvas]: https://doc.babylonjs.com/features/featuresDeepDive/scene/offscreenCanvas
[transferControlToOffscreen]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen
[Loop de renderização]: /pt-BR/guide/lesson-001#design-the-canvas-api
[sistema de eventos]: /pt-BR/guide/lesson-006
[WebWorker example]: /example/webworker
[readPixels]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/readPixels
[toMatchWebGLSnapshot.ts]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/toMatchWebGLSnapshot.ts
[toMatchSVGSnapshot.ts]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/toMatchSVGSnapshot.ts
[xmlserializer]: https://www.npmjs.com/package/xmlserializer
[github workflows - test]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/.github/workflows/test.yml
[How can I use headless-gl with a continuous integration service?]: https://github.com/stackgl/headless-gl?tab=readme-ov-file#how-can-i-use-headless-gl-with-a-continuous-integration-service
[Plugin de arrastar e soltar]: /pt-BR/guide/lesson-006#dragndrop-plugin
[E2E action]: https://github.com/xiaoiver/infinite-canvas-tutorial/actions/runs/10282078732
[\_\_tests\_\_]: https://github.com/xiaoiver/infinite-canvas-tutorial/tree/master/__tests__
[Visual comparisons]: https://playwright.dev/docs/test-snapshots
[Playwright Web component testing]: https://github.com/sand4rt/playwright-ct-web
[Playwright Components (experimental)]: https://playwright.dev/docs/test-components
[Web Components]: /pt-BR/guide/lesson-007
[browserstack-local]: https://github.com/browserstack/browserstack-local-nodejs
[Canvas Lambda Layer]: https://github.com/ShivamJoker/Canvas-Lambda-Layer
