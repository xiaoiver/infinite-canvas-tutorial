---
outline: deep
description: 'Construye componentes de Web UI independientes del framework con Lit y Shoelace. Crea componentes de lienzo reutilizables y una barra de herramientas de zoom, con una gestión adecuada del ciclo de vida y el manejo de tareas asíncronas.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 7 - Web UI' }]
---
# Lección 7 - Web UI {#lesson-7-web-ui}

En esta lección aprenderás lo siguiente:

-   Desarrollar una Web UI con Lit y Shoelace
-   Implementar un componente de lienzo
-   Implementar un componente de barra de herramientas de zoom

<div style="width: 100%; height: 200px;">
  <ic-canvas-lesson7 />
</div>

## Web UI con Lit y Shoelace {#web-ui-with-lit-and-shoelace}

Al elegir una biblioteca de componentes, no quería que estuviera atada a la implementación de un framework concreto; consulta [Los Web Components no son componentes de framework, y eso está bien]. Los Web Components son una buena elección, y [Lit] ofrece estado reactivo, estilos con alcance y un sistema de plantillas declarativo que facilita el proceso de desarrollo. [Shoelace] es una biblioteca de UI basada en [Lit], y [Web Awesome] es su nuevo nombre, más llamativo. Con ellos podemos hacer que nuestros componentes de lienzo sean independientes del framework, al admitir React, Vue y Angular al mismo tiempo. Cabe destacar que la biblioteca de componentes [spectrum-web-components] que usa Photoshop Web también se basa en Lit; consulta [¡Photoshop ya está en la web!].

> Photoshop forma parte del ecosistema más amplio Creative Cloud de Adobe. Usar una estrategia estandarizada de Web Components construida sobre Lit permite mantener la coherencia de la UI entre aplicaciones.

Como el sitio estático de este tutorial está escrito con [VitePress], en las páginas de ejemplo se usan las [instrucciones de Vue], pero en los componentes no se usará sintaxis de Vue.

A continuación tomaremos la funcionalidad sencilla que ya tenemos y la envolveremos en componentes de UI.

## Componente de lienzo {#canvas-component}

Un componente de lienzo se declara con [Lit] y, para evitar posibles conflictos de nombres, usamos `ic` como prefijo del componente:

```ts
import { LitElement } from 'lit';

@customElement('ic-canvas')
export class InfiniteCanvas extends LitElement {}
```

Definimos la propiedad `renderer` con un decorador, de modo que podamos usarla con una sintaxis como esta: `<ic-canvas renderer="webgl" />`.

```ts
import { property } from 'lit/decorators.js';

export class InfiniteCanvas extends LitElement {
    @property()
    renderer = 'webgl';
}
```

Queremos que el lienzo siga el ancho y el alto de la página, y Shoelace ofrece un [Resize Observer] listo para usar que emite un evento personalizado `sl-resize` cuando cambia el ancho o el alto del elemento. Declaramos el HTML en el ciclo de vida `render` que ofrece [Lit], y el HTMLCanvasElement real puede consultarse con rapidez mediante [query]:

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

Escucha los cambios de tamaño durante el ciclo de vida [connectedCallback] y deja de escuchar durante el ciclo de vida [disconnectedCallback]:

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

### Ciclo de vida de la inicialización del lienzo {#lifecycle-for-canvas-initialization}

La pregunta de cuándo crear el lienzo me ha estado rondando un tiempo. Intentar obtener `<canvas>` en el ciclo de vida [connectedCallback] devolvía `undefined`, porque el CustomElement todavía no se había añadido al documento, así que, naturalmente, no podía consultarlo mediante la DOM API. Al final descubrí que [firstUpdated] era un buen momento para disparar el evento personalizado `ic-ready` después de crear el lienzo y llevar la instancia del lienzo en el objeto de evento, y para disparar el evento personalizado `ic-frame` en cada tick:

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

¿Hay una solución mejor que este apaño?

### Usar una tarea asíncrona {#async-task}

Para este tipo de escenario, en el que se ejecuta una tarea asíncrona y después se renderiza, React ofrece [\<Suspense\>]:

```tsx
<Suspense fallback={<Loading />}>
    <SomeComponent />
</Suspense>
```

Lit también ofrece unas [tareas asíncronas] parecidas, de modo que podemos mostrar los estados de carga y de error antes de que la tarea asíncrona termine y cuando falla. Al crear una tarea asíncrona con `Task`, tienes que especificar los parámetros e incluir el `<canvas>` creado como valor de retorno, para poder recuperarlo y renderizarlo en el hook `complete` de la función de renderizado.

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

Por ejemplo, en Safari, que no admite WebGPU, se mostrará el mensaje de error siguiente:

<sl-alert variant="danger" open>
  <sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
  <strong>Error al inicializar el lienzo</strong><br />
  El navegador no admite WebGPU.
</sl-alert>

Así queda escrito nuestro componente de lienzo. El carácter independiente del framework de los Web Components nos permite usarlos de una forma coherente. Tomemos Vue y React como ejemplo:

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

Obtén la instancia del lienzo escuchando el evento personalizado `ic-ready` cuando el lienzo se ha cargado:

```ts
const $canvas = document.querySelector('ic-canvas');
$canvas.addEventListener('ic-ready', (e) => {
    const canvas = e.detail;
    // 创建场景图
    canvas.appendChild(circle);
});
```

Aquí implementaremos el componente de zoom de la cámara.

## Componente de zoom {#zoom-component}

La figura siguiente muestra el componente de zoom de Miro:

![barra de zoom de Miro](/miro-toolbar.png)

Creemos primero un `ic-zoom-toolbar`:

```ts
@customElement('ic-zoom-toolbar')
export class ZoomToolbar extends LitElement {}
```

Añádelo al componente de lienzo:

```html
<sl-resize-observer>
    <canvas></canvas>
    <ic-zoom-toolbar zoom="${this.zoom}"></ic-zoom-toolbar> // [!code ++]
</sl-resize-observer>
```

La estructura interna de este componente tiene este aspecto, y puedes ver que Lit usa una sintaxis de plantillas muy cercana a la de Vue:

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

Para pasar la instancia del lienzo desde el componente de lienzo a sus hijos usamos [Lit Context], que se guarda en el contexto después de la instanciación:

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

Después puede consumirse en el componente hijo a través del contexto y, como la creación del lienzo es asíncrona, hay que hacer `subscribe` para poder seguir el contexto en tiempo real:

```ts
export class ZoomToolbar extends LitElement {
    @consume({ context: canvasContext, subscribe: true })
    canvas: Canvas;
}
```

Añade a la cámara una función callback que se dispara cada vez que cambian la cámara o la matriz de proyección:

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

La variable reactiva `zoom` se modifica cuando se dispara el callback.

```ts
this.#canvas.camera.onchange = () => {
    this.zoom = Math.round(this.#canvas.camera.zoom * 100);
};
```

## Tema {#theme}

El tema debe aplicarse a los componentes de UI y al lienzo. Empecemos por los primeros.

### Componentes de UI {#theme-in-ui}

Shoelace ofrece la funcionalidad de [Temas], que puede cambiarse con facilidad. Primero importa las hojas de estilo de los dos temas:

```ts
import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/themes/dark.css';
```

Al cambiar al tema oscuro, basta con añadir una clase identificadora al elemento raíz:

```ts
this.classList.toggle('sl-theme-dark', this.theme === 'dark');
```

Por último, al escribir los estilos del componente, usa variables CSS en lugar de valores fijos, para que se apliquen de forma automática al cambiar de tema:

```ts
:host {
    background: var(--sl-panel-background-color);
}
```

En la [Lección 18 - Refactorización con ECS] posterior sustituimos la implementación de Web Components de Shoelace por Spectrum, que también ofrece la posibilidad de alternar entre tema claro y tema oscuro:

![Tema oscuro después de la lección 18](/spectrum-theme-dark.png)

### Fondo y cuadrícula del lienzo {#theme-in-canvas}

El fondo y la [Cuadrícula] del lienzo también tienen que asociarse con el color del tema. Tomando como referencia [Colores de tema en DGM.js], admitimos pasar los valores de color de los temas claro y oscuro al crear el lienzo:

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

Admite el cambio en tiempo de ejecución:

```ts
canvas.theme = Theme.DARK;
```

Más adelante no entraremos en los detalles de la implementación de la UI.

## Internacionalización {#i18n}

Lit ofrece una solución de [Localización]; puede automatizarse con las herramientas adecuadas.

### Construir una plantilla localizada {#build-localized-template}

Primero tienes que envolver con el método `msg` las cadenas que requieran internacionalización. Tomando el menú principal como ejemplo:

```ts
import { msg, str } from '@lit/localize';

<sp-tooltip slot="tooltip" self-managed placement="bottom">
    ${msg(str`Main menu`)}
</sp-tooltip>;
```

A continuación ejecuta el comando siguiente para extraer del código fuente las cadenas de idioma que se usan:

```bash
lit-localize extract
```

En este punto obtendrás una serie de archivos `xlf`. Envía estos archivos `xlf` a un servicio de traducción (o tradúcelos a mano, por supuesto) y recibirás resultados parecidos a los siguientes:

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

Después ejecuta el comando siguiente para compilar las cadenas traducidas en componentes y colocarlos en la carpeta del código fuente:

```bash
lit-localize build
```

### Cambiar el locale {#switch-locale}

Este sitio está construido con VitePress. Puedes encontrar un componente de cambio de idioma en la esquina superior derecha.

```ts
import { localized } from '@lit/localize';

@customElement('ic-spectrum-top-navbar')
@localized()
export class TopNavbar extends LitElement {}
```

Puede cargarse bajo demanda en tiempo de ejecución:

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

Con fines de demostración hemos optado por usar [importaciones estáticas]. Por supuesto, este enfoque carga todos los archivos de idioma, lo que afecta al tiempo hasta el primer contenido.

## Componer con slot {#composite-with-slot}

En la [Lección 18 - Refactorización con ECS] posterior implementamos una barra de herramientas en el lado izquierdo del lienzo. Si queremos añadir una herramienta nueva a la barra de herramientas, podemos lograrlo con facilidad mediante el elemento `<slot>` de los Web Components.

En muchos plugins extensibles (como el [Plugin de borrador]) hemos implementado un uso parecido:

```html
<ic-spectrum-canvas>
    <ic-spectrum-penbar-eraser slot="penbar-item"><ic-spectrum-penbar-eraser />
</ic-spectrum-canvas>
```

Reserva posiciones ampliables dentro de los componentes de Lit mediante `<slot>`:

```ts
export class Penbar extends LitElement {
    render() {
        return html`<sp-action-group class="penbar">
            <slot name="penbar-item"></slot>
        </sp-action-group>`;
    }
}
```

Conviene señalar que, al pasar un `<slot>` a través del árbol de componentes, en el componente padre hay que usar un slot con nombre.

```html
<!-- ic-spectrum-canvas -->
<ic-spectrum-penbar>
    <slot name="penbar-item" slot="penbar-item"></slot>
</ic-spectrum-penbar>
```

## Lectura adicional {#extended-reading}

-   [Debate sobre Lit en HN]
-   [Cambiar los temas en Figma]
-   [Uso de plantillas y slots]

[Shoelace]: https://shoelace.style/
[VitePress]: https://vitepress.dev/
[instrucciones de Vue]: https://shoelace.style/frameworks/vue
[Resize Observer]: https://shoelace.style/components/resize-observer
[Lit]: https://lit.dev/
[connectedCallback]: https://lit.dev/docs/components/lifecycle/#connectedcallback
[disconnectedCallback]: https://lit.dev/docs/components/lifecycle/#disconnectedCallback
[query]: https://lit.dev/docs/api/decorators/#query
[firstUpdated]: https://lit.dev/docs/components/lifecycle/#firstupdated
[Lit Context]: https://lit.dev/docs/data/context/
[tareas asíncronas]: https://lit.dev/docs/data/task/#overview
[\<Suspense\>]: https://react.dev/reference/react/Suspense
[Los Web Components no son componentes de framework, y eso está bien]: https://lea.verou.me/blog/2024/wcs-vs-frameworks/
[¡Photoshop ya está en la web!]: https://medium.com/@addyosmani/photoshop-is-now-on-the-web-38d70954365a
[spectrum-web-components]: https://opensource.adobe.com/spectrum-web-components/
[Web Awesome]: https://www.kickstarter.com/projects/fontawesome/web-awesome
[Temas]: https://shoelace.style/getting-started/themes
[Cuadrícula]: /es/guide/lesson-005
[Colores de tema en DGM.js]: https://dgmjs.dev/api-core/variables/themecolors
[Debate sobre Lit en HN]: https://news.ycombinator.com/item?id=45112720
[Lección 18 - Refactorización con ECS]: /es/guide/lesson-018
[Cambiar los temas en Figma]: https://help.figma.com/hc/en-us/articles/5576781786647-Change-themes-in-Figma
[Localización]: https://lit.dev/docs/localization/overview/
[importaciones estáticas]: https://lit.dev/docs/localization/runtime-mode/#static-imports
[Uso de plantillas y slots]: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots
[Plugin de borrador]: /reference/eraser
