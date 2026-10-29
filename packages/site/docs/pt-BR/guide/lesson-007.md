---
outline: deep
description: 'Construa componentes de interface web independentes de framework com Lit e Shoelace. Crie componentes de tela reutilizáveis e uma barra de zoom, com o gerenciamento correto do ciclo de vida e o tratamento de tarefas assíncronas.'
head:
    - ['meta', { property: 'og:title', content: 'Lição 7 - Interface web' }]
---
# Lição 7 - Interface web {#lesson-7-web-ui}

Nesta lição, você vai aprender o seguinte:

-   Desenvolver interface web com Lit e Shoelace
-   Implementar um componente de tela
-   Implementar um componente de barra de zoom

<div style="width: 100%; height: 200px;">
  <ic-canvas-lesson7 />
</div>

## Interface web com Lit e Shoelace {#web-ui-with-lit-and-shoelace}

Ao escolher uma biblioteca de componentes, eu não queria que ela ficasse presa à implementação de um framework específico; veja [Web Components are not Framework Components — and That’s Okay]. Web components são uma boa escolha, e o [Lit] oferece estado reativo, estilos com escopo e um sistema de templates declarativo para facilitar o processo de desenvolvimento. O [Shoelace] é uma biblioteca de UI baseada em [Lit], e [Web Awesome] é o nome novo e pomposo dela. Com eles, podemos tornar nossos componentes de tela independentes de framework, com suporte a React, Vue e Angular ao mesmo tempo. Vale observar que a biblioteca de componentes [spectrum-web-components], usada pelo Photoshop Web, também se baseia em Lit; veja: [Photoshop is now on the web!]

> O Photoshop faz parte do ecossistema mais amplo Creative Cloud da Adobe. Usar uma estratégia padronizada de Web Components construída sobre o Lit permite consistência de UI entre os aplicativos.

Como o site estático deste tutorial é escrito com [VitePress], [Vue instructions] é usado nas páginas de exemplo, mas nenhuma sintaxe de Vue será usada nos componentes.

Em seguida, vamos pegar a funcionalidade simples que já temos e envolvê-la em componentes de UI.

## Componente de tela {#canvas-component}

Um componente de tela é declarado com [Lit] e, para evitar possíveis conflitos de nome, usamos `ic` como prefixo do componente:

```ts
import { LitElement } from 'lit';

@customElement('ic-canvas')
export class InfiniteCanvas extends LitElement {}
```

Definimos a propriedade `renderer` com um decorator, para poder usá-la com esta sintaxe: `<ic-canvas renderer="webgl" />`.

```ts
import { property } from 'lit/decorators.js';

export class InfiniteCanvas extends LitElement {
    @property()
    renderer = 'webgl';
}
```

Queremos que a tela acompanhe a largura e a altura da página, e o Shoelace oferece um [Resize Observer] pronto para uso, que dispara um evento personalizado `sl-resize` quando a largura ou a altura do elemento muda. Declaramos o HTML no ciclo de vida `render` fornecido pelo [Lit], e o HTMLCanvasElement real pode ser consultado rapidamente por meio de [query]:

```ts
export class InfiniteCanvas extends LitElement {
    @query('canvas', true)
    $canvas: HTMLCanvasElement;

    render() {
        return html`
            <sl-resize-observer>
                <canvas></canvas>
            </sl-resize-observer>
        `;
    }
}
```

Escuta mudanças de tamanho durante o ciclo de vida [connectedCallback] e deixa de escutar durante o ciclo de vida [disconnectedCallback]:

```ts
export class InfiniteCanvas extends LitElement {
    connectedCallback() {
        this.addEventListener('sl-resize', this.resize);
    }
    disconnectedCallback() {
        this.removeEventListener('sl-resize', this.resize);
    }
}
```

### Ciclo de vida da inicialização da tela {#lifecycle-for-canvas-initialization}

A questão de quando criar a tela tem me incomodado há um tempo. Tentar obter `<canvas>` no ciclo de vida [connectedCallback] retornava `undefined`, porque o CustomElement ainda não tinha sido adicionado ao documento, então naturalmente eu não conseguia consultá-lo pela API do DOM. No fim, descobri que [firstUpdated] era um bom momento para disparar o evento personalizado `ic-ready` depois de criar a tela e incluir a instância da tela no objeto de evento, e para disparar o evento personalizado `ic-frame` a cada tick:

```ts
export class InfiniteCanvas extends LitElement {
    async firstUpdated() {
        this.#canvas = await new Canvas({
            canvas: this.$canvas,
            renderer: this.renderer as 'webgl' | 'webgpu',
        }).initialized;

        this.dispatchEvent(
            new CustomEvent('ic-ready', { detail: this.#canvas }),
        );

        const animate = (time?: DOMHighResTimeStamp) => {
            this.dispatchEvent(new CustomEvent('ic-frame', { detail: time }));
            this.#canvas.render();
            this.#rafHandle = window.requestAnimationFrame(animate);
        };
        animate();
    }
}
```

Existe uma solução melhor do que essa gambiarra?

### Usar tarefa assíncrona {#async-task}

Para esse tipo de cenário, em que uma tarefa assíncrona é executada e depois renderizada, o React oferece [\<Suspense\>]:

```tsx
<Suspense fallback={<Loading />}>
    <SomeComponent />
</Suspense>
```

O Lit também oferece [Async Tasks] parecidas, para podermos exibir os estados de carregamento e de erro antes de a tarefa assíncrona terminar e quando ela falha. Ao criar uma tarefa assíncrona com `Task`, você precisa especificar os parâmetros e incluir o `<canvas>` criado como valor de retorno, para que ele possa ser recuperado e renderizado no hook `complete` da função de renderização.

```ts
private initCanvas = new Task(this, {
    task: async ([renderer]) => {
      return canvas.getDOM();
    },
    args: () => [this.renderer as 'webgl' | 'webgpu'] as const,
});

render() {
  return this.initCanvas.render({
    pending: () => html`<sl-spinner></sl-spinner>`,
    complete: ($canvas) => html`
      <sl-resize-observer>
        ${$canvas}
        <ic-zoom-toolbar-lesson7 zoom=${this.zoom}></ic-zoom-toolbar-lesson7>
      </sl-resize-observer>
    `,
    error: (e) => html`<sl-alert variant="danger" open>${e}</sl-alert>`,
  });
}
```

Por exemplo, no Safari, que não oferece suporte a WebGPU, a mensagem de erro a seguir será exibida:

<sl-alert variant="danger" open>
  <sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
  <strong>Falha ao inicializar a tela</strong><br />
  O WebGPU não é suportado pelo navegador.
</sl-alert>

Assim, nosso componente de tela está escrito. A natureza independente de framework dos web components permite usá-los de forma consistente. Veja Vue e React, por exemplo:

```vue
<template>
    <ic-canvas renderer="webgl"></ic-canvas>
</template>
```

```tsx
<div>
    <ic-canvas renderer="webgl"></ic-canvas>
</div>
```

Obtenha a instância da tela escutando o evento personalizado `ic-ready` quando a tela terminar de carregar:

```ts
const $canvas = document.querySelector('ic-canvas');
$canvas.addEventListener('ic-ready', (e) => {
    const canvas = e.detail;
    // 创建场景图
    canvas.appendChild(circle);
});
```

Aqui vamos implementar o componente de zoom da câmera.

## Componente de zoom {#zoom-component}

A figura a seguir mostra o componente de zoom do Miro:

![barra de zoom do Miro](/miro-toolbar.png)

Vamos criar primeiro um `ic-zoom-toolbar`:

```ts
@customElement('ic-zoom-toolbar')
export class ZoomToolbar extends LitElement {}
```

Adicione-o ao componente de tela:

```html
<sl-resize-observer>
    <canvas></canvas>
    <ic-zoom-toolbar zoom="${this.zoom}"></ic-zoom-toolbar> // [!code ++]
</sl-resize-observer>
```

A estrutura interna desse componente é assim, e você pode ver que o Lit usa uma sintaxe de template muito próxima da do Vue:

```html
<sl-button-group label="Zoom toolbar">
    <sl-tooltip content="Zoom out">
        <sl-icon-button
            name="dash-lg"
            label="Zoom out"
            @click="${this.zoomOut}"
        ></sl-icon-button>
    </sl-tooltip>
    <span>${this.zoom}%</span>
    <sl-tooltip content="Zoom in">
        <sl-icon-button
            name="plus-lg"
            label="Zoom in"
            @click="${this.zoomIn}"
        ></sl-icon-button>
    </sl-tooltip>
</sl-button-group>
```

Para passar a instância da tela do componente de tela para os filhos, usamos [Lit Context], que é salvo no contexto depois da instanciação:

```ts{9}
const canvasContext = createContext<Canvas>(Symbol('canvas'));

export class InfiniteCanvas extends LitElement {
    #provider = new ContextProvider(this, { context: canvasContext });

    private initCanvas = new Task(this, {
      task: async ([renderer]) => {
        // ...省略实例化画布过程
        this.#provider.setValue(this.#canvas);
      }
    });
}
```

Ele pode então ser consumido no componente filho por meio do contexto e, como a criação da tela é assíncrona, é preciso usar `subscribe` para acompanharmos o contexto em tempo real:

```ts
export class ZoomToolbar extends LitElement {
    @consume({ context: canvasContext, subscribe: true })
    canvas: Canvas;
}
```

Adicione uma função de callback à câmera, disparada toda vez que a câmera ou a matriz de projeção mudar:

```ts
export class Camera {
    onchange: () => void;
    private updateViewProjectionMatrix() {
        if (this.onchange) {
            this.onchange();
        }
    }
}
```

A variável reativa `zoom` é modificada quando o callback é disparado.

```ts
this.#canvas.camera.onchange = () => {
    this.zoom = Math.round(this.#canvas.camera.zoom * 100);
};
```

## Tema {#theme}

O tema precisa ser aplicado aos componentes de UI e à tela. Vamos começar pelos primeiros.

### Componentes de UI {#theme-in-ui}

O Shoelace oferece a funcionalidade de [Themes], que pode ser alternada com facilidade. Primeiro, importe as folhas de estilo dos dois temas:

```ts
import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/themes/dark.css';
```

Ao alternar para o tema escuro, basta adicionar uma classe identificadora ao elemento raiz:

```ts
this.classList.toggle('sl-theme-dark', this.theme === 'dark');
```

Por fim, ao escrever os estilos do componente, use variáveis CSS em vez de valores fixos, para que sejam aplicadas automaticamente ao alternar os temas:

```ts
:host {
    background: var(--sl-panel-background-color);
}
```

Mais adiante, na [Lição 18 - Refatorar com ECS], substituímos a implementação de Web Components do Shoelace pelo Spectrum, que também oferece a alternância de tema claro/escuro:

![Tema escuro depois da lição 18](/spectrum-theme-dark.png)

### Fundo e grade da tela {#theme-in-canvas}

O fundo e a [Grade] da tela também precisam estar associados à cor do tema. Com base em [Theme colors in DGM.js], oferecemos suporte a passar os valores de cor dos temas claro e escuro ao criar a tela:

```ts
enum Theme {
    LIGHT,
    DARK,
}

interface ThemeColors {
    background: string;
    grid: string;
}

interface CanvasConfig {
    themeColors?: Partial<{
        [Theme.LIGHT]: Partial<ThemeColors>; // [!code ++]
        [Theme.DARK]: Partial<ThemeColors>; // [!code ++]
    }>; // [!code ++]
}
```

Há suporte à troca em tempo de execução:

```ts
canvas.theme = Theme.DARK;
```

Não vamos entrar nos detalhes da implementação de UI depois.

## Internacionalização {#i18n}

O Lit oferece uma solução de [Localization], que pode ser automatizada com as ferramentas certas.

### Compilar o template localizado {#build-localized-template}

Primeiro, você precisa envolver as strings que exigem internacionalização usando o método `msg`. Tomando o menu principal como exemplo:

```ts
import { msg, str } from '@lit/localize';

<sp-tooltip slot="tooltip" self-managed placement="bottom">
    ${msg(str`Main menu`)}
</sp-tooltip>;
```

Em seguida, execute o comando a seguir para extrair as strings de idioma usadas no código-fonte:

```bash
lit-localize extract
```

Nesse ponto, você obtém uma série de arquivos `xlf`. Envie esses arquivos `xlf` a um serviço de tradução (ou traduza-os manualmente, é claro) e você receberá resultados parecidos com os seguintes:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
<file target-language="zh-Hans" source-language="en" original="lit-localize-inputs" datatype="plaintext">
<body>
<trans-unit id="sa10f310edb35fa9f">
  <source>Main menu</source>
  <target>主菜单</target>
</trans-unit>
</body>
</file>
</xliff>
```

Em seguida, execute o comando a seguir para compilar as strings traduzidas em componentes e colocá-los na pasta do código-fonte:

```bash
lit-localize build
```

### Trocar o locale {#switch-locale}

Este site é construído com VitePress. Você pode encontrar um componente de troca de idioma no canto superior direito.

```ts
import { localized } from '@lit/localize';

@customElement('ic-spectrum-top-navbar')
@localized()
export class TopNavbar extends LitElement {}
```

Pode ser carregado sob demanda em tempo de execução:

```ts
import { configureLocalization } from '@lit/localize';
// Generated via output.localeCodesModule
import { sourceLocale, targetLocales } from './generated/locale-codes.js';

export const { getLocale, setLocale } = configureLocalization({
    sourceLocale,
    targetLocales,
    loadLocale: (locale) => import(`/locales/${locale}.js`),
});
```

Para fins de demonstração, optamos por usar [static imports]. É claro que essa abordagem carrega todos os arquivos de idioma, o que impacta o tempo até o primeiro conteúdo.

## Compor com slot {#composite-with-slot}

Mais adiante, na [Lição 18 - Refatorar com ECS], implementamos uma barra de ferramentas no lado esquerdo da tela. Se quisermos adicionar uma nova ferramenta à barra de ferramentas, podemos fazer isso com facilidade usando o elemento `<slot>` dos Web Components.

Em muitos plugins extensíveis (como o [Eraser plugin]), implementamos um uso parecido:

```html
<ic-spectrum-canvas>
    <ic-spectrum-penbar-eraser slot="penbar-item"><ic-spectrum-penbar-eraser />
</ic-spectrum-canvas>
```

Reserve posições expansíveis dentro dos componentes Lit usando `<slot>`:

```ts
export class Penbar extends LitElement {
    render() {
        return html`<sp-action-group class="penbar">
            <slot name="penbar-item"></slot>
        </sp-action-group>`;
    }
}
```

Vale observar que, ao passar um `<slot>` pela árvore de componentes, um slot nomeado precisa ser usado no componente pai.

```html
<!-- ic-spectrum-canvas -->
<ic-spectrum-penbar>
    <slot name="penbar-item" slot="penbar-item"></slot>
</ic-spectrum-penbar>
```

## Leitura adicional {#extended-reading}

-   [Discussion about Lit on HN]
-   [Change themes in Figma]
-   [Using templates and slots]

[Shoelace]: https://shoelace.style/
[VitePress]: https://vitepress.dev/
[Vue instructions]: https://shoelace.style/frameworks/vue
[Resize Observer]: https://shoelace.style/components/resize-observer
[Lit]: https://lit.dev/
[connectedCallback]: https://lit.dev/docs/components/lifecycle/#connectedcallback
[disconnectedCallback]: https://lit.dev/docs/components/lifecycle/#disconnectedCallback
[query]: https://lit.dev/docs/api/decorators/#query
[firstUpdated]: https://lit.dev/docs/components/lifecycle/#firstupdated
[Lit Context]: https://lit.dev/docs/data/context/
[Async Tasks]: https://lit.dev/docs/data/task/#overview
[\<Suspense\>]: https://react.dev/reference/react/Suspense
[Web Components are not Framework Components — and That’s Okay]: https://lea.verou.me/blog/2024/wcs-vs-frameworks/
[Photoshop is now on the web!]: https://medium.com/@addyosmani/photoshop-is-now-on-the-web-38d70954365a
[spectrum-web-components]: https://opensource.adobe.com/spectrum-web-components/
[Web Awesome]: https://www.kickstarter.com/projects/fontawesome/web-awesome
[Themes]: https://shoelace.style/getting-started/themes
[Grade]: /pt-BR/guide/lesson-005
[Theme colors in DGM.js]: https://dgmjs.dev/api-core/variables/themecolors
[Discussion about Lit on HN]: https://news.ycombinator.com/item?id=45112720
[Lição 18 - Refatorar com ECS]: /pt-BR/guide/lesson-018
[Change themes in Figma]: https://help.figma.com/hc/en-us/articles/5576781786647-Change-themes-in-Figma
[Localization]: https://lit.dev/docs/localization/overview/
[static imports]: https://lit.dev/docs/localization/runtime-mode/#static-imports
[Using templates and slots]: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots
[Eraser plugin]: /reference/eraser
