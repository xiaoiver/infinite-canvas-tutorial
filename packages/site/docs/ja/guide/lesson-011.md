---
outline: deep
description: 'Jest によるユニットテスト、ビジュアルリグレッションテスト、headless-gl を使ったサーバーサイドレンダリング、Playwright による E2E テスト、ブラウザ互換性テストを含む総合的なテスト環境を整えます。'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '第11課 - テストとサーバーサイドレンダリング',
          },
      ]
---

# 第 11 課 - テストとサーバーサイドレンダリング {#lesson-11-test-and-server-side-rendering}

現在、キャンバスの機能は次第に複雑になっているので、プロジェクトの品質を高めるためにテストを導入する段階です。この課では次の内容を学びます。

-   Jest ベースのテスト環境の構築。ローカル環境と CI 環境を含みます
-   ユニットテストでコードカバレッジを高める
-   視覚的回帰テスト
    -   headless-gl ベースのサーバーサイドレンダリング。対象は WebGL1 です
    -   Playwright ベースの E2E テスト。対象は WebGL2 と WebGPU です
-   E2E UI テスト
-   BrowserStack ベースのブラウザ互換性テスト
-   WebWorker でのレンダリング

上で触れたプロジェクト関連のコードは、すべてプロジェクトの [\_\_tests\_\_] フォルダにあります。

## テスト環境 {#test-environment}

テストフレームワークには Jest を選び、`package.json` にコードカバレッジを集計するテストコマンドを追加します。

```json
"scripts": {
    "cov": "jest --coverage"
}
```

GitHub ワークフローでテストコマンド `pnpm cov` を実行します。サーバーサイドレンダリングを導入したあとは、このコマンドの前に `xvfb-run` を付けます。

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

`d3-color` を使うと、よくある問題にぶつかります。D3 はデフォルトで ESM の出力しか提供しないため、Node.js で直接実行できません。選択肢は二つあります。

1. Jest は [transformIgnorePatterns] という設定を提供しているので、`d3-color` だけでなく D3 関連の依存関係まで追加し、CJS へコンパイルできます。
2. D3 の代替ライブラリ [victory-vendor] を使います。機能は同じで、追加で CJS の出力を提供します。詳しくは [d3-color issue in recharts] を参照してください。

一つ目の方法を選びます。

```js
const esm = ['d3-*'].map((d) => `_${d}|${d}`).join('|');
module.exports = {
    transformIgnorePatterns: [`<rootDir>/node_modules/(?!(?:.pnpm/)?(${esm}))`],
};
```

テスト環境の準備ができたので、最初のテストケースを書き始められます。

## ユニットテスト {#unit-test}

最も実装しやすいユニットテストから始めます。ユニットテストは、レンダリングに関係しない機能を調べるのに向いています。図形プロパティの設定、バウンディングボックスのサイズ計算、ピッキング判定、各種ユーティリティメソッドなどが該当します。

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

良さそうです。Circle のテストカバレッジを 100% まで上げました。

```bash
------------------------------|---------|----------|---------|---------|-----------------------
File                          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------------|---------|----------|---------|---------|-----------------------
All files                     |   14.21 |    10.44 |    8.18 |   14.29 |
 src/shapes                   |   26.81 |    22.64 |   21.62 |   28.15 |
  Circle.ts                   |     100 |      100 |     100 |     100 |
```

ただし、ユニットテストには限界があります。結局のところコードの一部だけを対象にするので、システム全体が正しく動いていることまでは保証できません。たとえば円が 1 つ正しく描けているかは判断できても、100 個だったらどうでしょうか。テストのアサーションを書く時間と難しさが大きく増します。

## 視覚的回帰テスト {#visual-regression-testing}

テストの世界では "golden image" は、一連のテストケースにおける標準画像、つまり参照画像を指す用語です。この用語は視覚的回帰テスト（Visual Regression Testing）でよく使われます。視覚的回帰テストは、アプリケーションやウェブサイトのスクリーンショットを、あらかじめ定義した参照画像の集合と比較し、見た目の変化を検出する自動テストの手法です。

レンダリングエンジンでは、ユニットテストよりもレンダリング結果の正しさを検証しやすく、手動のアサーションを書く負担も大きく減らせます。[pixelmatch] を使うと、画像を簡単に比較し、差分を強調できます。

![pixelmatch](/pixelmatch.png)

Node.js でスクリーンショットを得る考え方は二つあります。

1. サーバーサイドレンダリング。レンダリング技術に応じて、対応する Node.js 実装を選びます。

    - [node-canvas] Cairo ベースの Canvas 実装
    - [jsdom] DOM と HTML の純粋な JS 実装
    - [headless-gl] は WebGL コンテキストを作成できますが、WebGL1 のみをサポートします。

2. ヘッドレスブラウザ。初期の puppeteer や electron、あるいは比較的新しい Playwright が例です。

現在よく使われているレンダリングエンジンがどの方式を採用しているかを見ると興味深いです。

-   [Three.js Puppeteer]
-   Babylon.js は以前 Jest + Puppeteer を使っていましたが、現在は Playwright を使っています。詳しくは [Move visualization testing to playwright] を参照してください。
-   luma.gl は [headless-gl] を使っています。詳しくは [Register devices] を参照してください。
-   plot は [mocha + JSDOM] を使っています。

二つの方式をそれぞれ見ていきます。

### サーバーサイドレンダリング {#server-side-rendering}

headless-gl の実装に基づくサーバーサイドレンダリングは WebGL1 しかサポートしませんが、サーバーサイドレンダリングが適する場面はあります。

-   インタラクションがほとんどない、あるいはまったくない場面
-   リアルタイム性があまり求められず、オフラインで生成でき、ランタイムの性能問題がない、インタラクションの弱い、あるいはないシーン
-   出力は、複数の環境にまたがって表示できるピクセル画像またはベクター画像です

サーバーサイドレンダリングをサポートするには、コードが Node.js 環境で動くようにする必要があります。では、コード中の DOM API 呼び出しはどのように扱えばよいでしょうか。第一の考え方は、環境によって判断することです。たとえばブラウザ環境のときだけイベントリスナーを登録し、`addEventListener()` メソッドを呼び出します。

```ts{2}
const plugins = [
    isBrowser ? new DOMEventListener() : undefined,
    //...
];
```

別の考え方は [d3-selector] に見られます。ここではグローバル変数 `document` が存在すると仮定せず、コンテキストから取得します。こうすると上位層が `jsdom` のような DOM API の純粋な JS 実装を渡す余地が生まれ、サーバー側でも動作します。

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

同じ発想は [react-reconciler] にも見られます。DOM、Canvas、コンソールのように異なる環境は、設定で取り決めたインターフェースを実装するだけで済みます。

> "host config" は自分で用意するオブジェクトであり、"host" 環境（例: DOM、canvas、console、あるいはレンダリング対象が何であれ）で何かを起こす方法を記述します。次のような形です。

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

Vite の [Environment API] も、似た問題を解決しようとしています。

> Runtime API から始まった変更は、今や Vite が環境（client、SSR、workerd など）を扱う方法を全面的に見直すきっかけになっています。

私たちの場面に戻ると、Node.js 環境には次の設定項目を用意する必要があります。

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

#### PNG の生成 {#ssr-png}

[headless-gl] を使うと WebGLRenderingContext を作成し、それを HTMLCanvasElement と同じ形のオブジェクトに包むことができます。その後は、このオブジェクトで通常どおりキャンバスを作成できます。

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

WebGLRenderingContext を得たあとは、[readPixels] を呼び出して指定領域のピクセル値を読み取り、PNG に書き出して基準画像を得ます。

```ts
async function writePNG(gl: WebGLRenderingContext, path: string) {
    const width = gl.canvas.width;
    const height = gl.canvas.height;

    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    await createPNGFromRawdata(path, width, height, pixels);
}
```

テストを実行するたびに、[pixelmatch] で基準画像と今回のテストが生成した画像を比較し、差分もファイルに書き出して確認しやすくします。ここでは Jest が提供するカスタムアサーション拡張を使います。

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

完全なコードは [toMatchWebGLSnapshot.ts] にあります。

#### SVG の生成 {#ssr-svg}

画像エクスポート機能をテストするには、ImageExporter に対してブラウザ環境の代替として [jsdom] と [xmlserializer] を用意する必要があります。前者は Node.js 環境で SVGElement を作るために使い、後者はそれを文字列へシリアライズするために使います。

```ts{6,7}
import xmlserializer from 'xmlserializer';
import { JSDOM } from 'jsdom';

const exporter = new ImageExporter({
    canvas,
    document: new JSDOM().window._document,
    xmlserializer,
});
```

SVGElement の文字列を得たあとは、ファイルに書き出せます。書き出す前に prettier で整形すると読みやすくなります。

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

完全なコードは [toMatchSVGSnapshot.ts] にあります。

#### インタラクションイベントをシミュレートする方法 {#how-to-mock-event}

JSDOM を使うと、`MouseEvent` のようなインタラクションイベントをシミュレートし、生成した直後に対応するフックを直接呼び出せます。これで、DOM API 経由でイベントを監視しなければならない制約を回避できます。

```ts
const window = new JSDOM().window;

const pointerdownEvent = new window.MouseEvent('pointerdown', {
    clientX: 100,
    clientY: 100,
});
canvas.pluginContext.hooks.pointerDown.call(pointerdownEvent);
```

この方法なら、ドラッグアンドドロップのようなイベントの組み合わせも簡単にシミュレートできます。次のテストケースは、[Drag & Drop Plugin] の判定しきい値をテストする例です。連続した `pointerdown`、`pointermove`、`pointerup` イベントをシミュレートしますが、隣り合うイベントの間隔が短く位置も近いため、`dragstart` イベントは発生しません。

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

#### CI での SSR {#ssr-ci}

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

完全なコードは [github workflows - test] にあります。

### ヘッドレスブラウザ {#headless-browser}

サーバーサイドレンダリングがどれほど優れていても、ヘッドレスブラウザの方式にはテストにおいて置き換えられない利点があります。Playwright を例にすると、次のとおりです。

-   最新の Chrome で WebGL 1/2 はもちろん WebGPU までサポートします。
-   toHaveScreenshot のような公式アサーションをそのまま提供します。ピクセル単位の比較が組み込まれており、失敗するとレポートに diff が表示されます。詳細は [Visual comparisons] を参照してください。
-   [sharding] をサポートし、CI で複数マシンの並列実行ができます。

#### 開発サーバーの起動 {#run-webserver}

Playwright のブラウザは、開発サーバーに配置されたテストケースへアクセスする必要があり、テストサーバーには Vite を選びました。

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

#### テストケースを開く {#browse-testcase}

サーバーを起動したあと、テストケースに対応する URL へアクセスします。

```ts
test(name, async ({ page, context }) => {
    const url = `./infinitecanvas/?name=${name}`;
    await page.goto(url);
    await readyPromise;

    await expect(page.locator('canvas')).toHaveScreenshot(`${name}.png`);
});
```

この結果と基準画像の比較は、生成されたテストレポートで視覚的に確認できます。

![Playwright の画像差分](/playwright-image-diff.png)

実際には、ローカルで生成したスクリーンショットは CI 環境と少し違うことがよくあります。たとえば下の画像の左側はローカル環境で生成したスクリーンショット、右側は CI 環境で生成したスクリーンショットで、一部の矩形に不自然な斜線が入っています。
この場合は、ローカルで生成した基準画像の代わりに CI 環境の画像を使うと、一貫性を保てます。GitHub ワークフローのアーティファクトをアップロードして CI 環境のスクリーンショットを取得し、ローカルにダウンロードして基準画像として使えます。

![ローカル環境と CI 環境の差分](/playwright-local-vs-ci.png)

#### WebGL2 と WebGPU {#webgl2-webgpu}

[headless-gl] のサーバーサイドレンダリングと比べたとき、エンドツーエンドテスト方式の最大の利点は WebGL2 と WebGPU の両方をサポートすることです。テストケースを一式だけ書き、URL のレンダラー設定に基づいてキャンバスを作成し、WebGL2 と WebGPU それぞれの基準画像を生成できます。

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

#### CI の設定 {#e2e-ci}

前に述べたように、[sharding] は CI で複数マシンの並列実行をサポートし、各マシンでは複数のスレッドを有効にできます。たとえばマシンを 4 台使い、各マシンでワーカーを 10 個並列に動かし、最後にレポートを一つにまとめます。

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

実行の様子は次のとおりです。詳細は [E2E action] を参照してください。

![Playwright のシャーディング](/playwright-sharding.png)

#### AWS Lambda 関数 {#aws-lambda-function}

ここで AWS 上に Lambda 関数を作成する必要があります。この関数は、`headless-gl` を含むカスタム Layer を使ってサーバーサイドレンダリングを行います。

![AWS Lambda レイヤー](/aws-lambda-layer.png)

対象ランタイム環境が Node.js 20.x なので、Amazon Linux 2023 イメージを使って Layer をローカルでビルドします。

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

続いて S3 にアップロードし、レイヤーの作成を完了します。

```bash
aws lambda publish-layer-version \
  --layer-name headless-gl-layer \
  --description "Headless GL for Node.js on AL2 arm64" \
  --compatible-runtimes nodejs20.x \
  --compatible-architectures arm64 \
  --content S3Bucket=<your-bucket>,S3Key=headless-gl-layer.zip
```

これで AWS コンソールからこの Layer を選び、関数に追加できます。

## E2E テスト {#e2e-test}

[Playwright Components (experimental)] は、React、Svelte、Vue などの UI フレームワークに対するコンポーネントレベルのテストをサポートします。`@playwright/test` でテストケースを書く方式と比べると、パラメータオブジェクトに `mount` メソッドが追加されています。

```ts{3}
import { test, expect } from '@playwright/experimental-ct-react';

test('should work', async ({ mount }) => {
  const component = await mount(<HelloWorld msg="greetings" />);
  await expect(component).toContainText('Greetings');
});
```

[Lit Testing] で推奨されているテストフレームワークに Playwright は含まれていませんが、コミュニティの [Playwright Web component testing] を使って私たちの [Web Components] をテストできます。

```ts
import { defineConfig } from '@playwright/test'; // [!code --]
import { defineConfig } from '@sand4rt/experimental-ct-web'; // [!code ++]

export default defineConfig({});
```

ここから、私たちの Web Component に対するテストを書いていきます。

### Web Component のテスト {#webcomponent-test}

カメラズームのツールバーコンポーネントを例に、`zoom` プロパティが正しく表示されているかをテストできます。

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

## ブラウザ互換性テスト {#browser-compatibility-test}

BrowserStack は、異なるブラウザ、オペレーティングシステム、デバイス、実環境にわたってウェブアプリケーションとモバイルアプリケーションをテストするためのさまざまなツールとサービスを提供するクラウドテストプラットフォームです。開発者と QA（品質保証）チームは、BrowserStack 上で多様な構成に対してアプリケーションをテストし、互換性、性能、ユーザー体験を確認できます。

Babylon.js は互換性テストに [browserstack-local] を使っています。

## WebWorker でのレンダリング {#rendering-in-webworker}

サーバー側に加えて、WebWorker も特別なランタイム環境と見なせます。レンダリングコードを WebWorker で実行すると、メインスレッドをブロックせず、性能が向上します。よく知られたレンダリングエンジンが使用例を提供しています。

-   [Three.js OffscreenCanvas]
-   [Babylon.js OffscreenCanvas]

私たちの [WebWorker example] ではメインスレッドが忙しくないため、この方式の利点は表れません。それでも、カメラのズーム、パン、回転、図形のピッキングといったキャンバス操作は体験できます。

### OffscreenCanvas を作成する {#offscreen-canvas}

まず、実行環境が OffscreenCanvas をサポートしていることを確認する必要があります。[Can I use OffscreenCanvas?] を参照してください。

```ts
if ('OffscreenCanvas' in window && 'transferControlToOffscreen' in mainCanvas) {
    // Ok to use offscreen canvas
}
```

次に、キャンバスが OffscreenCanvas から作成できるようにする必要があります。

```ts
export interface CanvasConfig {
    canvas: HTMLCanvasElement; // [!code --]
    canvas: HTMLCanvasElement | OffscreenCanvas; // [!code ++]
}
```

メインスレッドのコードは次のとおりです。

1. まず [transferControlToOffscreen] で、メインキャンバスの制御を OffscreenCanvas へ移します。
2. Vite が提供する方法で WebWorker を作成します。このワーカーは、マウススタイルの設定のように渡されてくるメッセージを待ち受けます。
3. 通常は [postMessage] の第 1 引数で WebWorker に値を渡しますが、OffscreenCanvas は [Transferable] なので、ここでは第 2 引数を使う必要があります。

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

WebWorker のコードは次のとおりです。

1. イベントオブジェクトから、メインスレッドが渡した OffscreenCanvas を受け取ります。
2. OffscreenCanvas でキャンバスを作成し、devicePixelRatio を設定します。
3. 図形を作り、通常どおりキャンバスに追加する [Render Loop] を作成します。

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

実際には、メインスレッドと WebWorker のあいだの通信を手動で処理しなければならない場面が避けられません。たとえば次のとおりです。

1. インタラクションイベント。[event system] は DOM API に依存しますが、WebWorker では DOM API を使えないため、メインスレッドのキャンバスでインタラクションイベントを監視し、WebWorker へ通知する必要があります。
2. キャンバスサイズの変更。上記と同じです。
3. メインキャンバスのマウススタイルを設定します。

### WebWorker でのイベント {#events-in-webworker}

`pointerdown` イベントを例にすると、メインキャンバスでこのイベントを監視します。ネイティブの Event は [Transferable] ではないため、シリアライズして WebWorker に渡す必要があります。

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

WebWorker がこの種類のメッセージを受け取ると、対応するフックが直接呼び出されます。

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

キャンバスサイズ変更イベントの扱いは上記と同じなので、ここでは省略します。

### カーソルスタイルの設定 {#set-cursor}

レンダリング中、WebWorker もメインスレッドへメッセージを渡す必要があります。たとえば次のとおりです。

-   毎フレーム、レンダリングが完了したことをメインスレッドへ通知し、実際にレンダリングされた図形や、カリングで除外された図形の数などの統計を渡します。
-   図形がピッキングされたときにマウススタイルを設定します。

```ts
setCursor: (cursor) => {
    self.postMessage({ type: 'cursor', cursor });
},
```

メインスレッドはメッセージを受け取り、キャンバスのマウススタイルを設定します。

```ts
worker.onmessage = function (event) {
    if (event.data.type === 'cursor') {
        mainCanvas.style.cursor = event.data.cursor;
    }
};
```

いずれにしても、WebWorker でキャンバスをレンダリングするには、メインスレッドとの通信を追加で処理する必要があります。インタラクションイベント、スタイル、UI コンポーネントのすべてに、対応するイベントを設計しなければなりません。ほとんどの Web 3D レンダリングエンジンが簡単な例や指針しか提供しない理由も、ここにあるのだと思います。

## さらに読む {#extended-reading}

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
[Render Loop]: /ja/guide/lesson-001#design-the-canvas-api
[event system]: /ja/guide/lesson-006
[WebWorker example]: /example/webworker
[readPixels]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/readPixels
[toMatchWebGLSnapshot.ts]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/toMatchWebGLSnapshot.ts
[toMatchSVGSnapshot.ts]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/toMatchSVGSnapshot.ts
[xmlserializer]: https://www.npmjs.com/package/xmlserializer
[github workflows - test]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/.github/workflows/test.yml
[How can I use headless-gl with a continuous integration service?]: https://github.com/stackgl/headless-gl?tab=readme-ov-file#how-can-i-use-headless-gl-with-a-continuous-integration-service
[Drag & Drop Plugin]: /ja/guide/lesson-006#dragndrop-plugin
[E2E action]: https://github.com/xiaoiver/infinite-canvas-tutorial/actions/runs/10282078732
[\_\_tests\_\_]: https://github.com/xiaoiver/infinite-canvas-tutorial/tree/master/__tests__
[Visual comparisons]: https://playwright.dev/docs/test-snapshots
[Playwright Web component testing]: https://github.com/sand4rt/playwright-ct-web
[Playwright Components (experimental)]: https://playwright.dev/docs/test-components
[Web Components]: /ja/guide/lesson-007
[browserstack-local]: https://github.com/browserstack/browserstack-local-nodejs
[Canvas Lambda Layer]: https://github.com/ShivamJoker/Canvas-Lambda-Layer
