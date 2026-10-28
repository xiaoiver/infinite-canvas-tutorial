---
outline: deep
description: 'Lit と Shoelace で、フレームワークに依存しない Web UI コンポーネントを作ります。再利用できるキャンバスコンポーネントとズームツールバーを、適切なライフサイクル管理と非同期タスクの処理とともに作成します。'
head:
    - ['meta', { property: 'og:title', content: '第7課 - Web UI' }]
---

# 第 7 課 - Web UI {#lesson-7-web-ui}

この課では、次の内容を学びます。

-   Lit と Shoelace で Web UI を開発します
-   キャンバスコンポーネントを実装します
-   ズームツールバーコンポーネントを実装します

<div style="width: 100%; height: 200px;">
  <ic-canvas-lesson7 />
</div>

## Lit と Shoelace による Web UI {#web-ui-with-lit-and-shoelace}

コンポーネントライブラリを選ぶとき、特定のフレームワーク実装に縛られたくありませんでした。[Web Components are not Framework Components — and That’s Okay] を参照してください。Web Components は良い選択で、[Lit] はリアクティブな状態、スコープされたスタイル、宣言的なテンプレートシステムを提供し、開発を容易にします。[Shoelace] は [Lit] を基にした UI ライブラリで、[Web Awesome] はその洒落た新しい名前です。これらを使えば、React、Vue、Angular を同時にサポートし、フレームワークに依存しないキャンバスコンポーネントを作れます。Photoshop Web が使う [spectrum-web-components] コンポーネントライブラリも Lit ベースです。[Photoshop is now on the web!] を参照してください。

> Photoshop は Adobe のより広い Creative Cloud エコシステムの一部です。Lit の上に構築した標準化された Web Components 戦略を使うと、アプリケーション間で UI の一貫性を保てます。

このチュートリアルの静的サイトは [VitePress] で書かれているため、例のページでは [Vue instructions] を使いますが、コンポーネントの中では Vue の構文は使いません。

次に、既にある単純な機能を UI コンポーネントへ包みます。

## キャンバスコンポーネント {#canvas-component}

キャンバスコンポーネントは [Lit] で宣言し、名前の衝突を避けるため、コンポーネントの接頭辞に `ic` を使います。

```ts
import { LitElement } from 'lit';

@customElement('ic-canvas')
export class InfiniteCanvas extends LitElement {}
```

デコレータで `renderer` プロパティを定義すると、`<ic-canvas renderer="webgl" />` のような構文で使えます。

```ts
import { property } from 'lit/decorators.js';

export class InfiniteCanvas extends LitElement {
    @property()
    renderer = 'webgl';
}
```

キャンバスには、ページの幅と高さに追従してほしいのです。Shoelace は、要素の幅や高さが変わったときにカスタムイベント `sl-resize` を発火する、すぐに使える [Resize Observer] を提供しています。[Lit] が提供する `render` ライフサイクルで HTML を宣言し、実際の HTMLCanvasElement は [query] ですばやく問い合わせできます。

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

[connectedCallback] ライフサイクルでサイズの変化をリッスンし、[disconnectedCallback] ライフサイクルでリッスンを解除します。

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

### キャンバス初期化のライフサイクル {#lifecycle-for-canvas-initialization}

キャンバスをいつ作るかは、しばらく私を悩ませていました。[connectedCallback] ライフサイクルで `<canvas>` を取得しようとすると `undefined` が返ります。その時点では CustomElement がまだドキュメントに追加されておらず、DOM API で問い合わせできないからです。最終的に、[firstUpdated] が良いタイミングだと分かりました。キャンバスを作ったあとカスタムイベント `ic-ready` を発火してイベントオブジェクトにキャンバスインスタンスを載せ、ティックごとにカスタムイベント `ic-frame` を発火します。

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

このその場しのぎより良い方法はあるでしょうか。

### 非同期タスクを使う {#async-task}

非同期タスクを実行してから描画する、このような場面には、React が [\<Suspense\>] を提供しています。

```tsx
<Suspense fallback={<Loading />}>
    <SomeComponent />
</Suspense>
```

Lit も似た [Async Tasks] を提供しているので、非同期タスクが完了する前の読み込み状態と、エラーになったときのエラー状態を表示できます。`Task` で非同期タスクを作るときはパラメータを指定し、作成した `<canvas>` を戻り値に含める必要があります。そうすれば、描画関数の `complete` フックでそれを取得して描画できます。

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

たとえば、WebGPU をサポートしていない Safari では、次のエラーメッセージが表示されます。

<sl-alert variant="danger" open>
  <sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
  <strong>キャンバスの初期化に失敗しました</strong><br />
  ブラウザは WebGPU をサポートしていません。
</sl-alert>

これでキャンバスコンポーネントが書けました。Web Components はフレームワークに依存しないので、一貫した方法で使えます。Vue と React を例にすると、次のとおりです。

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

キャンバスが読み込まれたら、`ic-ready` カスタムイベントをリッスンしてキャンバスインスタンスを取得します。

```ts
const $canvas = document.querySelector('ic-canvas');
$canvas.addEventListener('ic-ready', (e) => {
    const canvas = e.detail;
    // 创建场景图
    canvas.appendChild(circle);
});
```

ここで、カメラのズームコンポーネントを実装します。

## ズームコンポーネント {#zoom-component}

次の図は、Miro のズームコンポーネントです。

![Miro のズームツールバー](/miro-toolbar.png)

まず `ic-zoom-toolbar` を作ります。

```ts
@customElement('ic-zoom-toolbar')
export class ZoomToolbar extends LitElement {}
```

キャンバスコンポーネントへ追加します。

```html
<sl-resize-observer>
    <canvas></canvas>
    <ic-zoom-toolbar zoom="${this.zoom}"></ic-zoom-toolbar> // [!code ++]
</sl-resize-observer>
```

このコンポーネントの内部構造は次のとおりで、Lit のテンプレート構文が Vue に非常に近いことが分かります。

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

キャンバスインスタンスをキャンバスコンポーネントから子へ渡すために [Lit Context] を使い、インスタンス化のあとコンテキストへ保存します。

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

その後、子コンポーネントではコンテキストを通じて利用できます。キャンバスの作成は非同期なので、コンテキストをリアルタイムで追い続けるには `subscribe` する必要があります。

```ts
export class ZoomToolbar extends LitElement {
    @consume({ context: canvasContext, subscribe: true })
    canvas: Canvas;
}
```

カメラまたは投影行列が変わるたびに発火するコールバック関数を、カメラへ追加します。

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

コールバックが発火すると、リアクティブな変数 `zoom` が変更されます。

```ts
this.#canvas.camera.onchange = () => {
    this.zoom = Math.round(this.#canvas.camera.zoom * 100);
};
```

## テーマ {#theme}

テーマは UI コンポーネントとキャンバスの両方に適用する必要があります。まず前者から見ます。

### UI コンポーネント {#theme-in-ui}

Shoelace は、簡単に切り替えられる [Themes] 機能を提供しています。まず 2 つのテーマのスタイルシートを読み込みます。

```ts
import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/themes/dark.css';
```

ダークテーマへ切り替えるときは、ルート要素に識別用のクラスを追加するだけです。

```ts
this.classList.toggle('sl-theme-dark', this.theme === 'dark');
```

最後に、コンポーネントのスタイルを書くときは、固定値ではなく CSS 変数を使います。そうすれば、テーマを切り替えたときに自動で適用されます。

```ts
:host {
    background: var(--sl-panel-background-color);
}
```

その後の [第 18 課 - ECS でリファクタリング][Lesson 18 - Refactor with ECS] で、Web Components の実装を Shoelace から Spectrum へ置き換えました。Spectrum もライト／ダークテーマの切り替え機能を提供しています。

![第18課のあとのダークテーマ](/spectrum-theme-dark.png)

### キャンバスの背景とグリッド {#theme-in-canvas}

キャンバスの背景と [グリッド][Grid] も、テーマカラーに関連付ける必要があります。[Theme colors in DGM.js] を参考に、キャンバスを作るときにライトテーマとダークテーマの色の値を渡せるようにしました。

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

実行時の切り替えをサポートします。

```ts
canvas.theme = Theme.DARK;
```

このあと、UI 実装の詳細には立ち入りません。

## 国際化 {#i18n}

Lit は [Localization] の仕組みを提供しており、適切なツールを使えば自動化できます。

### ローカライズしたテンプレートをビルドする {#build-localized-template}

まず、国際化が必要な文字列を `msg` メソッドで包む必要があります。メインメニューを例にすると、次のとおりです。

```ts
import { msg, str } from '@lit/localize';

<sp-tooltip slot="tooltip" self-managed placement="bottom">
    ${msg(str`Main menu`)}
</sp-tooltip>;
```

続いて次のコマンドを実行し、ソースコードで使われている言語の文字列を抽出します。

```bash
lit-localize extract
```

この時点で、一連の `xlf` ファイルが得られます。これらの `xlf` ファイルを翻訳サービスへ送ります。もちろん、手で翻訳してもかまいません。すると、次のような結果が返ってきます。

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

続いて次のコマンドを実行すると、翻訳された文字列がコンポーネントへコンパイルされ、ソースコードのフォルダに置かれます。

```bash
lit-localize build
```

### ロケールの切り替え {#switch-locale}

このウェブサイトは VitePress で構築されています。右上に、言語を切り替えるコンポーネントがあります。

```ts
import { localized } from '@lit/localize';

@customElement('ic-spectrum-top-navbar')
@localized()
export class TopNavbar extends LitElement {}
```

実行時に、必要になったときだけ読み込めます。

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

デモのために [静的インポート][static imports] を使うことにしました。もちろんこの方法はすべての言語ファイルを読み込むので、最初のコンテンツが表示されるまでの時間に影響します。

## slot による合成 {#composite-with-slot}

その後の [第 18 課 - ECS でリファクタリング][Lesson 18 - Refactor with ECS] では、キャンバスの左側にツールバーを実装しました。ツールバーに新しいツールを追加したいときは、Web Components の `<slot>` 要素を使えば簡単に実現できます。

拡張可能なプラグインの多く（たとえば [消しゴムプラグイン][Eraser plugin]）で、似た使い方を実装しています。

```html
<ic-spectrum-canvas>
    <ic-spectrum-penbar-eraser slot="penbar-item"><ic-spectrum-penbar-eraser />
</ic-spectrum-canvas>
```

Lit コンポーネントの中では、`<slot>` を使って拡張できる位置を予約します。

```ts
export class Penbar extends LitElement {
    render() {
        return html`<sp-action-group class="penbar">
            <slot name="penbar-item"></slot>
        </sp-action-group>`;
    }
}
```

コンポーネントツリーを通して `<slot>` を渡すときは、親コンポーネントで名前付き slot を使う必要があります。

```html
<!-- ic-spectrum-canvas -->
<ic-spectrum-penbar>
    <slot name="penbar-item" slot="penbar-item"></slot>
</ic-spectrum-penbar>
```

## さらに読む {#extended-reading}

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
[Grid]: /ja/guide/lesson-005
[Theme colors in DGM.js]: https://dgmjs.dev/api-core/variables/themecolors
[Discussion about Lit on HN]: https://news.ycombinator.com/item?id=45112720
[Lesson 18 - Refactor with ECS]: /ja/guide/lesson-018
[Change themes in Figma]: https://help.figma.com/hc/en-us/articles/5576781786647-Change-themes-in-Figma
[Localization]: https://lit.dev/docs/localization/overview/
[static imports]: https://lit.dev/docs/localization/runtime-mode/#static-imports
[Using templates and slots]: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots
[Eraser plugin]: /reference/eraser
