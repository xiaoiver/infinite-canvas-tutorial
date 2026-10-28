---
outline: deep
description: 'WebGL/WebGPU に基づくハードウェア抽象化レイヤーでキャンバスを初期化し、Canvas API を設計し、プラグインベースのアーキテクチャを実装し、レンダリングプラグインを作る方法を学びます。複数のレンダラーに対応する、拡張可能なキャンバスフレームワークを構築します。'
head:
    - ['meta', { property: 'og:title', content: '第1課 - キャンバスの初期化' }]
---

# 第 1 課 - キャンバスの初期化 {#lesson-1-initialize-canvas}

この課では、次の内容を学びます。

-   WebGL1/2 と WebGPU に基づくハードウェア抽象化レイヤー（HAL）
-   Canvas API の設計
-   単純なプラグインシステムの実装
-   HAL に基づくレンダリングプラグインの実装

::: warning セキュリティに関する注意: @antv/g-device-api

[GHSA-hqjp-pg4j-q8g2](https://github.com/advisories/GHSA-hqjp-pg4j-q8g2) は、npm のバージョン **1.7.13 と 1.8.13** を、資格情報を窃取する `preinstall` スクリプトを含む悪意のあるリリースとして特定しています。**これらのバージョンをインストールしないでください。** 2026 年 10 月 13 日時点で、このアドバイザリに修正済みバージョンは記載されていません。

以下に示すシェーダーコンパイラの WASM の URL は **1.6.13** に固定されています。これはその日付時点で npm と UNPKG から入手できる最新バージョンであり、このリポジトリの `pnpm-lock.yaml` にある JavaScript パッケージと一致します。その WASM は、以前使っていた **1.6.8** の成果物、およびこのリポジトリに同梱されているコンパイラと、1 バイト単位で同一です。今回の変更はバージョン番号を揃えるだけで、コンパイラの機能は変えません。バージョン 1.6.13 は影響を受けるバージョンとして記載されておらず、ブラウザで WASM を取得しても npm のインストールスクリプトは実行されません。いずれの事実も、この成果物のセキュリティ監査を行ったことにはなりません。

このリポジトリに沿ってこの課を進めるときは、`pnpm install --frozen-lockfile` でロックファイルを維持してください。バージョンを指定しないインストールや `latest` によるインストールは避け、依存関係を更新するときはその来歴を確認してください。代替コンパイラは、ここで推奨できるようになる前に検証されなければなりません。現在 `@infinite-canvas-tutorial/device-api` を使っている ECS プロジェクトでは、JavaScript のバインディングとコンパイラを一緒に保ち、実行時の CDN リクエストを避けるため、[同梱の WASM アセット](/reference/create-app#shader-compiler)を優先してください。

:::

プロジェクトを起動すると空のキャンバスが表示され、幅と高さを変えたり、WebGL と WebGPU のレンダラーを切り替えたりできます。

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

## ハードウェア抽象化レイヤー {#hardware-abstraction-layers}

キャンバスでは、WebGL や、その後継である WebGPU のような、より低レベルなレンダリング API を使いたいと考えています。WebGPU には多くの機能強化があります。詳しくは [From WebGL to WebGPU] を参照してください。

-   基盤は、Direct3D12 / Metal / Vulkan などを含む新世代のネイティブ GPU API に基づいています。
-   ステートレスな API であり、手に負えないグローバル状態はもうありません。
-   Compute Shader に対応しています。
-   `<canvas>` ごとに作れるコンテキストの数に、上限はなくなります。
-   開発体験が向上します。より分かりやすいエラーメッセージや、GPU オブジェクトへのカスタムラベルが含まれます。

WebGPU のエコシステムは、今では JavaScript、C++、Rust に広がっています。Three.js や Babylon.js のような Web 側のレンダリングエンジンの多くが、対応を進めているか、すでに完了しています。特に [wgpu] は、ゲームエンジンの [bevy] に加え、[Modyfi] のような Web ベースのクリエイティブなデザインツールの本番環境でも使われ、非常に良い結果を出しています。下の画像の出典は [WebGPU Ecosystem] です。

![2023 年の WebGPU エコシステム](https://developer.chrome.com/static/blog/webgpu-ecosystem/image/diagram-the-webgpu-ecosy-384594168a61_1920.png)

もちろん、ブラウザの互換性を考えると、WebGL1/2 にも可能な限り対応する必要があります。レンダリングエンジンでは、ハードウェア抽象化レイヤー（Hardware Abstraction Layer、HAL）が GPU ハードウェアの詳細を抽象化し、上位層が特定のハードウェア実装に依存しないようにします。

WebGL1/2 と WebGPU に基づく、統一された API 一式を、シェーダーの変換とモジュール化とともに、できるだけ提供したいと考えています。この課で使う [@antv/g-device-api] の実装は [noclip] を参考にしており、WebGL1 互換が追加されています。この依存関係をインストールする前に、上のセキュリティに関する注意を参照してください。

WebGL と WebGPU は異なるシェーダー言語を使うため、GLSL と WGSL の 2 系統のコードは維持したくありません。そこで、実行時にシェーダーを変換します。

![実行時にシェーダーを変換する](/shader-transpile.png)

プロジェクトで維持する必要があるのは、GLSL 300 構文のシェーダー 1 セットだけです。WebGL1 へ落とすときはキーワードを置換します。WASM 形式の [コンパイラ](https://github.com/antvis/g-device-api/tree/master/rust)（naga と naga-oil を使用）へ渡して WGSL にする前には、GLSL 440 へ変換します。偶然ではなく、[Three.js Shading Language] もより高い水準の抽象化を使い、同じくコンパイラで対象ランタイム向けのシェーダーコードを出力します。

以下は、頂点シェーダーでよく使う属性宣言です。これは非常に単純な場合で、テクスチャのサンプリングになると、構文は実際には大きく変わります。

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

最近、[Figma rendering: Powered by WebGPU] という記事に出会いました。Figma も、WebGPU へのアップグレードを完了するために、よく似た実装を採っていることが分かりました。

> 既存の GLSL シェーダーは、WebGL 1 準拠の形式で書かれたまま維持しています。その後、シェーダープロセッサが WGSL への変換を自動的に行います。これには、シェーダーを解析し、より新しい版の GLSL へ変換するために必要な書き換えを行い、オープンソースのツール naga を実行して WGSL へ変換することが含まれます。

ハードウェア抽象化レイヤーの話は、これくらいにしておきましょう。実装の詳細に興味があるなら、[@antv/g-device-api] のソースコードを直接参照できます。この課の最後の小節で、この API の一部を使います。

## キャンバス API を設計する {#design-the-canvas-api}

いよいよ、キャンバス API の設計に入ります。目指している単純な使い方は、次のとおりです。

-   HTMLCanvasElement の `<canvas>` を渡し、キャンバスの作成と初期化を行います。これには、ハードウェア抽象化レイヤーを使って Device（GPU の抽象インスタンス）を作ることも含まれます。
-   キャンバスのレンダリングメソッドを呼び続けるレンダリングループを作ります。
-   キャンバスのリサイズに対応します。たとえば `resize` イベントに応答します。
-   適切なタイミングで自身を破棄します。

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

レンダーループは、Three.js の [Rendering the scene] や CanvasKit の [Basic draw loop] のように、レンダリングエンジンでごく一般的に使われます。`setTimeout` ではなく `requestAnimationFrame` を使う理由については、[Performant Game Loops in JavaScript] を参照してください。

見た目はとても単純なインターフェース定義ですが、まだ実装には進まないでください。ここには非同期初期化という問題があります。

```ts
interface Canvas {
    constructor(config: { canvas: HTMLCanvasElement });
    render(): void;
    destroy(): void;
    resize(width: number, height: number): void;
}
```

### 非同期初期化 {#asynchronous-initialization}

これは WebGPU と WebGL の大きな違いでもあります。WebGL ではコンテキストの取得は同期的ですが、WebGPU で Device を取得する処理は非同期です。

```ts
// create a context in WebGL
const gl = $canvas.getContext('webgl');

// obtaining a device in WebGPU
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
```

したがって、前の節で触れたハードウェア抽象化レイヤーを使うときも、非同期の方法を使わなければなりません。これは、WebGL から WebGPU へ移行したいすべてのレンダリングエンジンにとって破壊的変更です。たとえば Babylon.js の [Creation of the WebGPU engine is asynchronous]：

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

JavaScript のコンストラクタは非同期処理に対応していないため、キャンバスに非同期の init メソッドを追加して初期化し、初期化が完了してからレンダリングメソッドを呼びます。

```ts
const canvas = new Canvas();
await canvas.init();
canvas.render();
```

しかし、これは良い方法ではないと考えます。第一に、`new` キーワードはすでに初期化を意味しています。第二に、init メソッドは何度でも呼べるように見えますが、実際にはそうではありません。[Async Constructor Pattern in JavaScript] に着想を得て、個人的には次の構文を好みます。

```ts
const canvas = await new Canvas().initialized;
```

実際、この設計パターンは、たとえば Web Animations API の [Animation: ready property] でも使われています。

```ts
animation.ready.then(() => {});
```

### 実装 {#implementation}

実装では Promise をプライベート変数に保持し、getter でも読み取り専用になるようにします。

```ts
export class Canvas {
    #instancePromise: Promise<this>;
    get initialized() {
        return this.#instancePromise.then(() => this);
    }
}
```

コンストラクタの中で、即時実行の非同期関数式（Immediately Invoked Async Function Expression、IIAFE）を使って初期化を行います。

```ts
constructor() {
  this.#instancePromise = (async () => {
    // Omit the specific implementation...
    return this;
  })();
}
```

現在の設計を、さらに改善していきましょう。

## プラグインベースのアーキテクチャ {#plugin-based-architecture}

もちろん、ハードウェア抽象化レイヤーを呼ぶコードを Canvas のコンストラクタに置き、`destroy` メソッドですべてまとめて破棄することもできます。しかし、初期化、レンダリング、破棄の各段階で作業が増えていくと、Canvas のロジックは膨らみ続けます。最初の時点で、サポートすべき機能をすべて考え抜くのは難しいため、キャンバスには拡張性を持たせたいと考えています。

```ts
destroy() {
  this.device.destroy();
  this.eventManager.destroy();
  // Omit other tasks...
}
```

プラグインベースのアーキテクチャは、webpack、VS Code、そして Chrome にも見られる一般的な設計パターンです。次の特徴があります。

-   モジュール性。各プラグインは独立した部分を担当し、互いの結合が弱くなるため、保守しやすくなります。
-   拡張性。プラグインは実行時に動的に読み込んだり外したりでき、コアモジュールの構造には影響しません。これにより、アプリケーションを動的に拡張できます。

このアーキテクチャは、通常は次の部分から成ります。

-   メインアプリケーション。プラグインを登録する機能を提供し、適切な段階でプラグインを呼び出して実行し、実行に必要なコンテキストを渡します。
-   プラグインインターフェース。メインアプリケーションとプラグインをつなぐ橋です。
-   プラグイン集合。独立して実行できるモジュールの集まりです。各プラグインは責務分離の原則に従い、必要な最小限の機能だけを含みます。

メインアプリケーションは、どのようにプラグインの実行を呼び出すのでしょうか。まず webpack のやり方を見てみましょう。

-   メインアプリケーションでは、一連のフックを定義します。これらのフックは同期にも非同期にもでき、直列にも並列にもできます。同期かつ直列であれば、よく知っている一般的なイベントリスナーと同じです。下の例では、`run` は同期の直列フックです。
-   各プラグインは登録時に、関心のあるライフサイクルイベントを購読します。下の例では、登録時に `apply` が呼ばれます。
-   メインアプリケーションがフックを発火します。

```ts
class ConsoleLogOnBuildWebpackPlugin {
    apply(compiler) {
        compiler.hooks.run.tap(pluginName, (compilation) => {
            console.log('webpack starting...');
        });
    }
}
```

webpack はこれらの機能を提供するため [tapable] ツールキットを実装しており、大量に呼び出す場面では性能を上げるために `new Function` も使っています。この点は [Is the new Function performance really good?] で議論されています。しかし、同じ方針に沿って単純に実装できます。たとえば同期かつ直列に実行するフックは `callbacks` の配列を使い、黒魔術はありません。

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

次のフックを定義します。名前を見れば、メインアプリケーションのどの段階で呼ばれるかが分かります。

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

これらのフックを含むプラグインコンテキストは、プラグインの登録段階で渡されます。この後も、プラグインコンテキストは拡張していきます。

```ts
export interface PluginContext {
    hooks: Hooks;
    canvas: HTMLCanvasElement;
}
export interface Plugin {
    apply: (context: PluginContext) => void;
}
```

キャンバスの初期化時に `apply` メソッドを呼び、コンテキストを渡すと、プラグインの登録が完了し、同期フックと非同期フックの両方の初期化が走ります。次の節で実装するレンダリングプラグインが、非同期の初期化を完了します。

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

これで、最初のプラグインを実装するために必要な知識が揃いました。

## レンダラープラグイン {#renderer-plugin}

WebGL と WebGPU に対応したいので、キャンバスのコンストラクタでは `renderer` パラメータによる設定を受け付け、その後プラグインコンテキストへ渡します。

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

次に、レンダリングプラグインの中でハードウェア抽象化レイヤーをどう使うかを説明します。

### SwapChain {#swapchain}

OpenGL / WebGL の [Default Framebuffer] は、通常の Framebuffer Object（FBO）とは違い、コンテキストの初期化時に自動的に作られます。描画コマンドを呼ぶときに FBO を指定しなければ、OpenGL はレンダリング結果を自動的に Default Framebuffer へ書き込み、その中のカラーバッファが最終的に画面へ表示されます。

Vulkan ではそうではありません。代わりに [SwapChain] があります。次の画像は [Canvas Context and Swap Chain] からのもので、仕組みを示しています。GPU はレンダリング結果をバックバッファへ書き込み、フロントバッファは画面への表示に使われ、この 2 つは入れ替えられます。

![ダブルバッファリング](https://res.cloudinary.com/dx1kpewvo/image/upload/v1670938992/2022-12-19/webgpu_swap_1_nnce5v.png)

このダブルバッファリングがなければ、画面のリフレッシュと同時に GPU がレンダリング結果を書き込む可能性が高く、ティアリングが起きることがあります。そのため、垂直同期も使い、表示側が更新を許可しないように強制する必要があります。次の図は [Canvas Context and Swap Chain] からのもので、この処理のタイミングを示しています。

![ダブルバッファリングと V-Sync](https://res.cloudinary.com/dx1kpewvo/image/upload/v1671030455/2022-12-19/webgpu_swap_5_asrq42.png)

WebGPU では、利用者は通常 SwapChain に直接触れません。SwapChain は [GPUCanvasContext] に統合されています。WebGPU の設計に従う [wgpu] も、SwapChain を [Surface] にまとめており、利用者はやはり直接触れません。しかし、私たちのハードウェア抽象化レイヤーは、カプセル化のために今もこの概念を使っています。こうすると、プラグインの初期化時に `renderer` パラメータに基づいて SwapChain と Device を作成できます。

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

[devicePixelRatio] は、1 つの CSS ピクセルを描くのに、実際の画面ピクセルを何個使うべきかを表します。通常、`<canvas>` は次のコードで設定します。

```ts
const $canvas = document.getElementById('canvas');
$canvas.style.width = `${width}px`; // CSS Pixels
$canvas.style.height = `${height}px`;

const scale = window.devicePixelRatio;
$canvas.width = Math.floor(width * scale); // Screen Pixels
$canvas.height = Math.floor(height * scale);
```

キャンバスの幅と高さ、図形のサイズを述べるときは CSS ピクセルを使い、SwapChain を作るときは画面上の実際のピクセルを使います。`resize` のときに渡される幅と高さも CSS ピクセルなので、変換が必要です。

```ts{3}
hooks.resize.tap((width, height) => {
  this.#swapChain.configureSwapChain(
    width * devicePixelRatio,
    height * devicePixelRatio,
  );
});
```

では、[devicePixelRatio] はどう取得すればよいでしょうか。もちろん `window.devicePixelRatio` で取得でき、ほとんどの場合はそれで問題ありません。しかし、実行環境に `window` オブジェクトがない場合はどうでしょうか。たとえば次です。

-   Node.js でのサーバーサイドレンダリング。たとえば [headless-gl] を使う場合です。
-   [OffscreenCanvas] を使って、WebWorker の中でレンダリングする場合です。
-   ミニアプリのような、非標準のブラウザ環境です。

そのため、キャンバスの作成時にこの値を渡せるようにし、渡されないときは [globalThis] から取得しようとする方がよいでしょう。Canvas のコンストラクタ引数を、次のように変更します。

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

他のフックは、次のように実装します。

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

最後に、このプラグインをキャンバスのプラグイン一覧へ追加します。

```ts{1}
[new Renderer(), ...plugins].forEach((plugin) => {
  plugin.apply(this.#pluginContext);
});
```

## デモ {#demo}

まだ図形を一つも描いていないので、キャンバスは空白です。基盤となる WebGL / WebGPU のコマンドが何を呼んでいるか、どうすれば分かるでしょうか。Web 側のデバッグには、Chrome のプラグイン [Spector.js] と [WebGPU Inspector] を使えます。

次の画像は、Spector.js でキャプチャした最初のフレームのコマンドです。FrameBuffer や Texture など、一連の GPU オブジェクトを作成していることが分かります。

![Spector.js のスナップショット](/spectorjs.png)

WebGPU レンダリングへ切り替えたあと：

```ts{3}
const canvas = await new Canvas({
  canvas: $canvas,
  renderer: 'webgpu',
}).initialized;
```

WebGPU Inspector を開くと、これまでに作成した GPU オブジェクトと、各フレームで呼ばれたコマンドを確認できます。

![WebGPU Inspector のスナップショット](/webgpu-inspector.png)

## さらに読む {#extended-reading}

WebGL の基礎がまったくない場合は、まず次を学んでみてください。

-   [WebGL Fundamentals]
-   [WebGPU Fundamentals]

プラグインの設計パターンについては、次も参照できます。

-   [Intro to Plugin Oriented Programming]
-   [Introducing: Penpot Plugin System]
-   [Extensions in Tiptap]

[WebGPU Ecosystem]: https://developer.chrome.com/blog/webgpu-ecosystem/
[From WebGL to WebGPU]: https://developer.chrome.com/blog/from-webgl-to-webgpu
[@antv/g-device-api]: https://github.com/antvis/g-device-api
[Intro to Plugin Oriented Programming]: https://pop-book.readthedocs.io/en/latest/index.html
[wgpu]: https://wgpu.rs/
[bevy]: https://bevyengine.org/
[noclip]: https://github.com/magcius/noclip.website
[Modyfi]: https://digest.browsertech.com/archive/browsertech-digest-how-modyfi-is-building-with/
[Async Constructor Pattern in JavaScript]: https://qwtel.com/posts/software/async-constructor-pattern/
[Animation: ready property]: https://developer.mozilla.org/en-US/docs/Web/API/Animation/ready
[Rendering the scene]: https://threejs.org/docs/index.html#manual/en/introduction/Creating-a-scene
[Creation of the WebGPU engine is asynchronous]: https://doc.babylonjs.com/setup/support/WebGPU/webGPUBreakingChanges#creation-of-the-webgpu-engine-is-asynchronous
[Spector.js]: https://spector.babylonjs.com/
[WebGPU Inspector]: https://github.com/brendan-duncan/webgpu_inspector
[tapable]: https://github.com/webpack/tapable
[Is the new Function performance really good?]: https://github.com/webpack/tapable/issues/162
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
[Canvas Context and Swap Chain]: https://carmencincotti.com/2022-12-19/how-to-render-a-webgpu-triangle-series-part-three-video/#bonus-content-swap-chain
[Introducing: Penpot Plugin System]: https://www.smashingmagazine.com/2024/11/open-source-meets-design-tooling-penpot/
[Performant Game Loops in JavaScript]: https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/
[Extensions in Tiptap]: https://tiptap.dev/docs/editor/core-concepts/extensions#what-are-extensions
[Basic draw loop]: https://skia.org/docs/user/modules/quickstart/#basic-draw-loop
[Three.js Shading Language]: https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language
[Figma rendering: Powered by WebGPU]: https://www.figma.com/blog/figma-rendering-powered-by-webgpu/
