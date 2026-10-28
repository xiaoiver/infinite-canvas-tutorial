---
outline: deep
description: 'キャンバスの内容を PNG、JPEG、SVG 形式へ書き出す方法を学びます。キャンバス内での画像レンダリングを実装し、stroke-alignment のような機能で SVG の能力を拡張してデザインツールを強化します。'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '第10課 - 画像の読み込みと書き出し',
          },
      ]
---

<script setup>
import ObjectFit from '../../components/ObjectFit.vue';
</script>

# 第 10 課 - 画像の読み込みと書き出し {#lesson-10-importing-and-exporting-images}

画像の読み込みと書き出しは無限キャンバスにおいて非常に重要な機能で、書き出した画像を通じて他のツールと連携できます。現在のキャンバスの描画能力はまだ限られていますが、画像に関する問題を先に考えておくとよいでしょう。この課では次の内容を学びます。

-   キャンバス内容を PNG、JPEG、SVG に書き出し、時間ベースの効果を GIF に書き出すこと
-   キャンバス内での画像レンダリング。画像塗りの `object-fit` / `object-position` を含みます
-   `stroke-alignment` を例に、SVG の能力を拡張すること

## キャンバス内容を画像へ書き出す {#export-canvas-to-image}

まず、キャンバスの内容を画像へ書き出す方法を見ます。[Export from Figma] では、Figma のスライスツールを使って PNG を含むさまざまな形式へキャンバスを書き出す方法が説明されています。

![Figma からの書き出し](https://help.figma.com/hc/article_attachments/24423129974679)

Canvas2D 実装に基づく一部のチャートライブラリも、内容を画像として保存する機能を提供しています。下の画像は Highcharts のもので、複数形式の画像書き出しがあり、クリックするとすぐにブラウザのダウンロードが始まることが分かります。

<img alt="Highcharts の書き出し" src="https://user-images.githubusercontent.com/3608471/174998577-df1c54e9-d981-4d82-a4aa-7f0bedfb11a1.png" width="300" />

次のような書き出し機能を実装したいと考えています。

-   複数の画像形式に対応する: PNG、JPEG、SVG
-   切り抜き領域の指定に対応する
-   グリッドを含めるかどうかの選択に対応する

このために、画像エクスポーターを次のように使う設計にしています。

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

ただし形式によって「わずかな」違いがあります。以下ではまず PNG / JPEG 形式の画像を書き出す方法を紹介します。

### PNG / JPEG の書き出し {#to-raster-image}

[HTMLCanvasElement.toDataURL()] で、キャンバス内容に対応する画像の [DataURI] を取得できます。`type` 引数で画像形式を指定でき、PNG / JPEG と WebP に対応します。

```js
var canvas = document.getElementById('canvas');
var dataURL = canvas.toDataURL(); // 默认为 PNG
console.log(dataURL);
// "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNby
// blAAAADElEQVQImWNgoBMAAABpAAFEI8ARAAAAAElFTkSuQmCC"
```

そこで画像エクスポーターに `toCanvas` メソッドを追加します。このメソッドは、指定した領域のキャンバス内容を別の HTMLCanvasElement に描き、その後必要に応じて背景色や透かしなどを追加加工できるようにします。メソッドシグネチャ全体は次のとおりです。このメソッドは非同期です。理由は後で説明します。

```ts
toCanvas(options: Partial<CanvasOptions> = {}): Promise<HTMLCanvasElement>;

interface CanvasOptions {
  grid: boolean;
  clippingRegion: Rectangle;
  beforeDrawImage: (context: CanvasRenderingContext2D) => void;
  afterDrawImage: (context: CanvasRenderingContext2D) => void;
}
```

各設定項目の意味は次のとおりです。

-   `grid` グリッドを含めるかどうか
-   `clippingRegion` 矩形で表すキャンバスのクリップ領域
-   `beforeDrawImage` キャンバス内容を描く前に呼ばれ、背景色を描くのに向いています。
-   `afterDrawImage` キャンバス内容を描いた後に呼ばれ、透かしを描くのに向いています。

完全な使用例は次のとおりです。

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

キャンバスの右上に画像書き出しのドロップダウンを置きました。コンポーネントに関心がある場合は [Web UI with Lit and Shoelace] を参照してください。

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

では、`toCanvas` メソッドを非同期にした理由を説明します。WebGL / WebGPU は [SwapChain] のダブルバッファリングを使い、コンテキスト作成時の [preserveDrawingBuffer] の既定値は `false` です。そのため `toDataURL` を呼ぶ時点でレンダリング結果がクリアされていない必要があります（たとえば `gl.clear()` を呼んではいけません）。そうでないと空白の画像になります。[Plugin-based architecture] の `endFrame` フックに次のロジックを追加し、書き出し命令を受け取ったら現在のフレームが終わる前にキャンバス内容を保存します。次のフレームが来たときにクリアされるのを防ぐためで、このために動作が非同期になります。

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

また、書き出す画像に [Grid] を含めるかどうかを選べます。今のところ、後続の加工で切り抜きや透かしの機能は使っていません。Figma のような「スライス」機能はボックス選択のインタラクションが必要なので、後の実装で紹介します。ここからは、もう一つの特殊な画像形式に戻ります。

### SVG の書き出し {#to-vector-image}

ビットマップに対するベクターグラフィックスの利点は次のとおりです。

-   歪みなく無限に拡大縮小できます。鮮明さを失わずにいくらでも拡大・縮小できるため、複数の解像度が必要な場面に適しています。
-   編集可能性: SVG はテキストファイルなので、任意のテキストエディタで編集でき、図形の属性やスタイルを簡単に変更できます。
-   SVG はテキストファイルなので、任意のテキストエディタで編集でき、図形の属性やスタイルを簡単に変更できます。

したがってデザインツールは、この形式への変換を必ずサポートしなければなりません。無限キャンバスでは、問題を次のように置き換えられます。**シーングラフをどのように直列化するか**。各ノードの描画属性や変換などを含みます。直列化の形式については、JSON 以外にも、2D 図形の描画属性の設計自体が SVG の実装を大きく参考にしているため、SVG へ書き出すのが自然です。

興味深いことに、Three.js も [toJSON] でシーンの現在の状態（オブジェクト、変換、マテリアルなど）を [JSON-Object-Scene-format-4] として保存します。限られた条件（複雑なシェーディングや影がない）で 3D グラフィックスをできる限りレンダリングする [SVGRenderer] もあります。

#### 図形から SerializedNode へ {#shape-to-serialized-node}

多くのホワイトボードツールも、独自の図形直列化形式を提供しています。たとえば [JSON objects in tldraw] や [JSON schema in excalidraw] です。

シーングラフのルートノードから走査し、子要素に対して再帰的に呼び出します。`transform` のように複雑な構造の値（`position/scale/rotation`）を持つ属性は、さらに処理が必要です。

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

下の Circle を例にすると、直列化されたオブジェクトが得られます。

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

deserialize メソッドでキャンバスへ読み戻せます。`deserializeNode` は、直列化ノードの `type` 属性に基づいて対応する図形を作り、描画属性へ値を代入します。

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

キャンバス全体の直列化と逆直列化のメソッドは、ルートノードにそのまま適用できます。もちろんイベントリスナーは直列化できません。

```ts
const json = JSON.stringify(serializeNode(canvas.root)); // {}
canvas.root = (await deserializeNode(JSON.parse(json))) as Group;
```

#### SerializedNode から SVGElement へ {#serialized-node-to-svgelement}

ここまで来ると、直列化ノードを [SVG Element] へ変換するのは簡単です。次のユーティリティメソッドを追加します。

```ts
export function toSVGElement(node: SerializedNode): SVGElement;
```

`fill / stroke / opacity` などの属性の多くは同名の SVG 属性なので、[setAttribute] で直接代入できます。ただし一部の属性は特別な扱いが必要です。たとえば次のとおりです。

-   `transform` は `@pixi/math` の `Transform` オブジェクトを使うため、`position / rotation / scale` を `matrix()` へ変換する必要があります。
-   `transform-origin` は `transform` の `pivot` 属性に対応します。
-   `innerShadow` には同名の SVG プロパティがないため、フィルタで実装する必要があります。
-   `outerShadow` も同様です。

次の例は、直列化した円を `<circle>` に変換した結果です。HTML ページに表示するには [\<svg\>] に埋め込む必要があり、寸法はキャンバスと同じです。

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

#### SVGElement から SerializedNode へ {#svgelement-to-serialized-node}

当然、SVGElement から SerializedNode への変換メソッドも必要です。

```ts
export function fromSVGElement(element: SVGElement): SerializedNode;
```

この変換は完全には可逆ではありません。たとえば後で扱う [StrokeAlignment の実装](#stroke-alignment-export-svg) では、1 つの Circle が 2 つの `<circle>` に対応します。Figma でも同様です。次の画像は、以前に書き出した Ellipse を読み込んだ結果で、2 つの図形が同一ではないことが分かります。

![書き出した楕円を Figma に読み込む](/import-exported-ellipse.png)

[@pixi-essentials/svg] も SVGElement を Pixi.js の図形へ変換しようとしています。[Vector rendering of SVG content with PixiJS] を参照してください。

#### SVG におけるシーングラフ {#scene-graph-in-svg}

もう一つ注意すべき点は、こちらのシーングラフではどの図形も子ノードを持てますが、SVG では `<g>` だけが子を持て、`<circle>` などは子を持てないことです。解決は簡単です。子を持つ Group 以外の要素については、外側に `<g>` を付けて SVG を生成し、本来その要素に適用するはずだった `transform` を適用します。将来テキストのレンダリングに対応すると仮定すると、テキストの子を持つ Circle の SVG は次のようになります。

```html
<g transform="matrix(1,0,0,0,1,0)">
    <circle cx="100" cy="100" r="100" fill="red" />
    <text />
</g>
```

#### innerShadow と outerShadow の書き出し {#export-inner-outer-shadow}

[Adding Shadows to SVG Icons With CSS and SVG Filters] を参考に、[filter primitive] で内側と外側の影を実現します。外側の影の例は次のとおりです。

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

内側の影はもう少し複雑なため、紙幅の都合で詳しくは述べません。下の例で SVG をダウンロードして確認できます。

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

#### fill の値としての画像の書き出し {#export-image-as-fill-value}

塗り画像の実装はまだ扱っていませんが、`fill` プロパティの Image 値をそのまま直列化すると次のようになります。

```html
<circle fill="[object ImageBitmap]" />
```

これは正しく表示されません。Image オブジェクトを DataURL に直列化する必要があり、画像を `<canvas>` に描いて、前の節で紹介した `toDataURL` メソッドを使えばよいのです。[Convert ImageBitmap to Blob] を参考に、まず [ImageBitmapRenderingContext] を試しました。ImageBitmap はメインスレッドをブロックせずに画像を非同期でデコードできるため、アプリケーションの性能と応答性の向上に役立ちます。

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

残念ながら次のエラーになります。この ImageBitmap で既にテクスチャを作っているため、制御を新しい `<canvas>` へ移せないことが原因です。

> [!CAUTION]
> The input ImageBitmap has been detached

そのため、通常の `drawImage` メソッドで画像を `<canvas>` に描くしかありません。

#### ECS のペイントと Rough ジオメトリの書き出し {#ecs-export-paints}

ECS エクスポーターは `fills` と `strokes` の最初に有効なレイヤーを読みます。`image` 塗りは図形の境界まで引き伸ばされます。`pattern` レイヤーはデコード済み画像を本来の寸法で埋め込み、`repeat`、`repeat-x`、`repeat-y`、または `no-repeat` を保ちます。SVG の `<pattern>` はローカル座標を使い、ノードの変換は囲むグループに一度だけ適用されます。ノードごとに繰り返し範囲が異なる場合、パターン定義の ID は別になります。

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

画像のデコードは非同期です。`serializeNodesToSVGElements` の完了を待つか、より低レベルのヘルパーを直接使う場合は `exportFillGradientOrPattern` / `exportStrokeGradientOrPattern` の完了を待ってください。画像のデコードに失敗すると書き出しは拒否されます。テキスト上のグラデーション、画像、パターン塗りは、定義を `<text>` 要素と並べて保持するため、内容を書き込んでもペイントリソースは削除されません。

Rough 図形はローカルジオメトリを SVG パスとして書き出します。グループの不透明度、塗りレイヤーの不透明度、ストロークレイヤーの不透明度は、ゼロを含めて別々のままです。ハッチングのストロークは `roughFillWeight` を使います（省略時または `-1` のときは輪郭線の幅の半分）。楕円は `width` と `height` からローカルな中心と半径を求めます。これらの SVG パスを再読み込みすると、レンダリングされたジオメトリは保たれますが、編集可能な Rough パラメータは復元されません。パターンの読み込みは、今回の書き出しサポートの対象外です。

Canvas2D の結果が必要な呼び出し元は、`API.renderToCanvas(node, { width, height })` でそのノードと子を 1 枚のキャンバスに描きます。矩形、楕円、パス、ポリライン、直線の単色の塗りとストローク、および画像で塗った矩形に対応します。各図形は自身のパスから始まります。円弧を含む SVG パスコマンドと `evenodd` 塗りルールは Canvas2D 向けに変換されます。ローカル位置、角丸、ノードとレイヤーの不透明度は保持されます。子の画像は次の兄弟を描く前にデコードを終えるため、順序は安定します。画像をデコードできない場合、メソッドは拒否され、渡されたキャンバスは次の描画に使えます。

#### SVG のグリッド {#export-grid}

最後に、SVG でグリッドを実装する方法を見ます。[How to draw grid using HTML5 and canvas or SVG] を参考に、`<pattern>` のタイル配置を使います。直線グリッドには大小 2 組を使い、ドットグリッドでは「タイル」の四隅にそれぞれ円を置きます。

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

別の興味深い実装は `<line>` の `stroke-dasharray` を使う方法です。大量に繰り返す `<circle>` より SVG 要素が少なくて済みます。[Dot Grid With pattern] を参照してください。

次に、グリッドを描くロジックへ判定を追加します。スクリーンショットモード以外では従来どおりで、スクリーンショットモードではグリッドを含めるオプションがオンのときだけ描きます。

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

#### viewBox でカメラパラメータを反映する {#use-viewbox}

キャンバスの幅と高さは `<svg>` 要素に置けますが、平行移動 `x/y` や `zoom` といったカメラの変換パラメータ（カメラの回転の書き出しはまだサポートしていません）は、生成される SVG 要素にどう反映すればよいでしょうか。

ここでは [viewBox] を使えます。

```ts
const { x, y, rotation, zoom } = cameras[0].read(ComputedCamera);
$namespace.setAttribute(
    'viewBox',
    `${x} ${y} ${width / zoom} ${height / zoom}`,
);
```

#### SVG オプティマイザ {#svg-optimizer}

現在の SVG 出力をよく見ると、`opacity=“1”` のような冗長な属性があります。これは既定値なので、出力に明示する必要はありません。実際、これは [svgo] のような SVG 最適化ツールが使う手法の一つです。

> SVG files, especially those exported from vector editors, usually contain a lot of redundant information. This includes editor metadata, comments, hidden elements, **default or suboptimal values**, and other stuff that can be safely removed or converted without impacting rendering.

そのため、既定の属性値の対応表を維持する必要があります。属性値がちょうど既定値と等しければ、`setAttribute` で設定する必要はありません。

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

#### [WIP] インライン Web フォント {#inlined-web-font}

SVG へ書き出すとき、Web フォントを使っていればファイル内へインラインすることを目指します。もちろんフォントファイルのサイズ制約があるため、実行時に必要分だけ切り出す必要があります。以下は Excalidraw の処理の流れで、詳細は [Font subsetting in excalidraw] にあります。

![出典: https://link.excalidraw.com/readonly/MbbnWPSWXgadXdtmzgeO](https://github.com/user-attachments/assets/e255df0a-13de-4cb6-ae2e-9e885b643c63)

### GIF の書き出し {#to-gif}

後の [Lesson 30 - Time-based animation] では、ポストプロセスと時間ユニフォームで駆動する効果を扱います。その動きを**書き出す**には GIF や WebM のような形式が必要です。ここでは前者の概要を示します。

1. レンダリング経路は現在の**フレームインデックス**（またはエンジン時間）を受け取り、各ステップが効果の正しい瞬間を示す必要があります。
2. **キャンバスをラスターへスナップショット**します。たとえば PNG で、前の節で既に扱いました。
3. **ピクセルを読んで量子化**し、パレットにします（例: フレームあたり 256 色）。わずかな品質低下を受け入れられるなら、128 色や 64 色でもファイルはたいてい大きく縮みます。グラデーションや写真に近い内容では、バンディングやノイズがより目立ちます。
4. **フレームごとのパレット:** 素直な方法は、フレームごとに `quantize` を 1 回、`writeFrame` ごとに `palette` を 1 つ置くやり方で、フラットな UI にはよく合います。フレーム間の変化が少ない短いループでは、**単一のグローバルパレット**や**より少ないキーフレーム**の方が容量を節約できますが、実装コストは明らかに高くなります。

```ts
import { GIFEncoder, applyPalette, quantize } from 'gifenc';

const gif = GIFEncoder();
for (let i = 0; i < frameCount; i++) {
    renderFrame(i); // (1) drive time / frame
    await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
    );
    const dataUrl = el.toDataURL('image/png', pngQuality); // (2) raster snapshot
    const imageData = await imageDataFromPngDataUrl(dataUrl, w, h, ctx!);
    const palette = quantize(imageData.data, 256); // (3) build palette
    const index = applyPalette(imageData.data, palette); // (4) map to indices
    gif.writeFrame(index, w, h, { palette, delay });
}
gif.finish();
return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' });
```

ECS は各フレームをレンダリングしたあと、ブラウザのフレームコールバックを待ってから PNG スナップショットを読み、GIF と WebM の書き出しの間はキャンバスサイズが固定されている必要があります。空のキャンバス、サイズ変更、PNG のデコードエラー、描画例外があると、空ファイルや部分的なアニメーションを返さずに書き出しを拒否します。一時キャンバスは成功時も失敗時も解放されます。WebM はレコーダーとすべてのキャプチャトラックを止め、保留中のフレームコールバックを取り消し、画像ハンドラを外すので、失敗した書き出しを再試行できます。呼び出し元の元キャンバスは引き続き使えます。

WebM のタイムスタンプは、引き続きリアルタイムの `MediaRecorder` キャプチャクロックに従います。選んだ FPS は効果の時間を進めますが、WebM の正確なフレームレートや尺は保証しません。GIF はフレームごとの遅延を書き込み、単位は 10 ミリ秒です。ブラウザは短い表示時間をさらに制限することもあります。

### PDF の書き出し {#to-pdf}

ピクセルとベクターが揃ったので、それでも PDF へ書き出したい場合は、画像を追加する API を提供する [jsPDF] を使えます。紙幅の都合でここでは扱いません。

別の話題として、キャンバス内で画像をレンダリングする方法を見ます。

## 画像のレンダリング {#render-image}

WebGL / WebGPU では、画像を読み込んでテクスチャとして使うことがよく必要になります。種類の異なるリソースの読み込みは複雑な非同期処理なので、ほとんどのレンダリングエンジンはリソースローダーを提供します。画像の種類以外にも、音声、JSON、glTF などのデータ型をサポートすることもよくあります。以下は [PIXI Assets] の使用例です。

```ts
import { Sprite, Assets } from 'pixi.js';
// load the texture we need
const texture = await Assets.load('bunny.png');

// This creates a texture from a 'bunny.png' image
const bunny = new Sprite(texture);
```

では、リソースローダーはどう実装すればよいでしょうか。

### 画像ローダー {#image-loader}

[loaders.gl] は、リソースの種類ごとに一連のローダーを提供します。たとえば次のとおりです。

-   可視化アプリケーションでよく使う JSON、CSV、GeoJSON、GeoTiles など
-   glTF などの 3D モデル形式
-   さまざまな圧縮テクスチャ形式。[CompressedTextureLoader] を使い WebWorker で読み込んで解析します。

これらのローダーは上位アプリケーションの開発に大きな利便性をもたらします。[ImageLoader] を直接使え、PNG、JPEG、GIF、WEBP、AVIF、BMP、SVG などの画像形式に対応します。`@loaders.gl/core` は、API 呼び出しの統一と、種類の異なるローダーの拡張性を保証します。

```ts
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';

const image = await load(url, ImageLoader, options);
```

`fill` 属性を直接設定するだけでなく、逆直列化のときに DataURL を Image オブジェクトへ戻す必要もあります。

```ts
async function deserializeNode(data: SerializedNode) {
    // data:image/png:base64...
    if (fill && isString(fill) && isDataUrl(fill)) {
        shape.fill = (await load(fill, ImageLoader)) as ImageBitmap;
    }
}
```

### API 設計 {#image-api}

API の設計に戻ると、もちろん Circle / Ellipse / Rect にならって画像用の図形を新しく追加でき、これは SVG の [\<image\>] に対応します。

```ts
const image = new Image({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    src: 'data:image...',
});
```

しかし考えてみると、Image はストローク、角丸、影など、Rect の能力をすべて持つべきです。興味深いことに、Figma で 1920 \* 1920 の画像をキャンバスに挿入して SVG として書き出すと、次の構造の `<rect>` 要素が得られます（一部の属性値は省略）。`fill` 属性は [\<pattern\>] を参照しており、間接的に画像のタイル塗りを使っています。

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

ここから少しヒントが得られます。画像は独立した図形として存在する必要はなく、他の図形の `fill` 属性がマッピングに対応していれば、Circle / Rect などが画像を塗りとして使えます。ストローク付きの円形アイコンを実装する場面を想像してください。元の設計では [\<clipPath\>] のようなものを持つ Image 図形が必要でしたが、今は既存の Circle 図形を画像で塗るだけで済みます。

```ts
circle.fill = image;
circle.stroke = 'black';
```

### 実装 {#implementation}

そこで第一歩として、`fill` がサポートする型を色文字列から、より多くのテクスチャソースへ拡張します。

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

頂点データには、テクスチャを使うかどうかを示すフィールドが必要で、使う場合はテクスチャをサンプリングします。ここで `SAMPLER_2D()` は標準の GLSL 構文ではなく、シェーダーコンパイル段階で GLSL100 / GLSL300 / WGSL のサンプリング構文へ置き換えるための独自の印です。また、現在のテクスチャはアップロードされた画像であり、[createLinearGradient] のような Canvas2D API で作るグラデーションは後でサポートします。

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

`uniform` を使うと、これまでのバッチレンダリングのロジックが壊れます。[Inside PixiJS: Batch Rendering System] は Pixi.js の BatchRenderer 実装のロジックを説明しています。下の実行時コンパイルのシェーダーテンプレートから分かるように、同時にサポートできるサンプラーの最大数は `%count%` 個のサンプラー集合で、各インスタンスは頂点データ `aTextureId` を使ってその集合からサンプラーを選びます。

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

単純にするため、結合ロジックを次のように簡略化します。

1. 色文字列の `fill` は Image と結合できません。
2. 異なる Image 値の `fill` は結合できません。

したがって次の 3 つの円は同じバッチで描かれます。

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

### レンダーキャッシュ {#render-cache}

これまでは Program、Bindings、Sampler などの GPU オブジェクトのキャッシュを考慮していませんでした。そのためにリソースキャッシュマネージャを追加して再利用できるようにし、リソースの種類に応じたヒット判定を実装します。Sampler を例にすると、`SamplerDescriptor` のプロパティが同一ならキャッシュがヒットし、比較ロジックは `samplerDescriptorEquals` にあります。

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

### オブジェクトフィット (object-fit) {#object-fit}

矩形のジオメトリは、画像本来のアスペクト比と一致しないことがよくあります。どこでも `drawImage(0, 0, width, height)` で描くと、アイコンや写真が引き伸ばされます。デザインツールは通常、フィット / フィル / クロップのモードを提供します。私たちは `type: 'image'` の `FillLayers` 項目で、CSS の [object-fit] と [object-position] に従います。

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

| `objectFit`           | 動作                                                                             |
| --------------------- | -------------------------------------------------------------------------------- |
| `fill`                | ジオメトリを埋めるように引き伸ばします（**既定**。初期のラスター動作と同じです） |
| `contain`             | 一様に拡縮し、画像全体を表示します。レターボックスが生じることがあります         |
| `cover`               | 一様に拡縮し、ジオメトリを埋めます。はみ出しは切り取ります                       |
| `none` / `scale-down` | CSS と同じ意味です                                                               |

Figma の画像スケーリングや Pencil の `mode`（`stretch` / `fill` / `fit`）との対応は、[オブジェクトフィットの例](/example/object-fit) を参照してください。

CPU 側では画像をテクスチャへラスタライズします。`objectFit` から描画矩形を計算し、キャンバスへ塗ります。`contain` / `cover` のテクスチャサイズは `max(source width, geometry width)` ではなく、**ジオメトリ × デバイスピクセル比**です。そうしないと画像全体がビットマップを埋め、図形へ対応付けたときに、引き伸ばした `fill` のように見えたままになります。

<ObjectFit />

### iOS Live Photo {#ios-live-photo}

ファイルの水準では、iOS Live Photo は通常、HEIC の静止画と対になる MOV です。ブラウザによって HEIC のネイティブ対応は異なり、ECS の画像ローダーは heic-to で変換経路を提供します。

通常の画像と同じように扱うことを目指します。静止フレームを 1 枚ビットマップへデコードしてからテクスチャへアップロードします。キャンバスで Live Photo に埋め込まれた動画を再生するのは後続の作業で、タップして再生する専用コンポーネントなどを別に作ります。

`loadImageBitmapUniversal` は URL、Blob、または File を受け取ります。MIME、ファイル拡張子、またはファイルシグネチャから HEIC/HEIF を認識し、必要なときだけ heic-to を読み込むので、SSR 中にモジュールを読み込んでも安全です。最初の静止フレームを PNG へ変換し、変換またはビットマップのデコードに失敗すると JPEG で 1 回再試行します。HEIC 以外の画像は引き続き loaders.gl で処理します。

HTTP エラーは変換の前に拒否されます。通常の画像のデコードに失敗し、診断用の HEIC プローブも失敗した場合は、元のエラーを保持します。各呼び出しは独立して再試行できます。返されたビットマップは呼び出し元に属し、使用後に閉じる必要があります。入力のオブジェクト URL も呼び出し元が所有したままです。

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

デコーダーは heic-to 1.6.6（libheif 1.23.6）を使い、以前のデコーダーがフルレンジ SDR のフィクスチャで起こしていた色ずれと透明度の喪失を修正します。ブラウザの回帰は元の色と比較し、グレー階調、PNG の透明度、複数画像コンテナの最初の静止画、並行デコード、破損入力のあとの回復を対象にします。
JPEG フォールバックは依然として非可逆で、アルファを保持できません。これらの検査は、任意の ICC プロファイル、広色域カラー、HDR、Live Photo の動画再生は対象にしません。

## SVG の拡張: ストローク配置 {#stroke-alignment}

最後に、興味深い話題を紹介します。現在の SVG 仕様がサポートしていない機能を実装できます。

まず SVG における `opacity`、`stroke-opacity`、`fill-opacity` の違いから始めます。左の円は `opacity=“0.5”`、右の円は `fill-opacity=“0.5” stroke-opacity=“0.5”` です。ストロークの半分が円の内側に、半分が外側にあることが分かります。

<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="red" stroke="black" stroke-width="20" opacity="0.5" />
  <circle cx="150" cy="50" r="40" fill="red" stroke="black" stroke-width="20" fill-opacity="0.5" stroke-opacity="0.5" />
</svg>

Figma で対応する Stroke の位置は `Center` で、他の選択肢に `Inside` と `Outside` があります。それぞれを下に示します。SVG ではこれを `stroke-alignment` と呼びますが、現在は草案の段階です。[Specifying stroke alignment] を参照してください。Pixi.js も WebGL モードで [PIXI.LineStyle alignment] を提供します。

![Figma のストローク配置](/figma-stroke-align.png)

すべての図形に `strokeAlignment` プロパティを追加します。

```ts
export interface IRenderable {
    strokeAlignment: 'center' | 'inner' | 'outer'; // [!code ++]
}
```

### シェーダーにおけるストローク配置 {#stroke-alignment-rendering}

シェーダー側の実装では、この 3 つの値を区別し、塗りとストロークの色を異なる方法で混ぜるだけで済みます。

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

以下が私たちの実装で、レンダリングが Figma と一致していることが分かります。

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

レンダリングのバウンディングボックスとピッキング判定を計算するときも、このプロパティを考慮する必要があります。下の関数は、値ごとにストロークが図形自体から外側へどれだけ伸びるべきかを表します。

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

### SVG の書き出し {#stroke-alignment-export-svg}

先に述べたように、SVG は現在 `stroke-alignment` をサポートしていないため、今はハックでシミュレートするしかありません。描画が単純なら、塗りとストロークを 2 パスに分けて描けます。以下は Figma が `stroke-alignment: 'inner'` を書き出した結果で、同じ方法を使っています。

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

これに加え、Figma のドキュメント [StrokeAlign in Figma widget] は、似た要素を 2 つ作らなくてよい別の考え方を示しています。[How to simulate stroke-align (stroke-alignment) in SVG] は、ストローク幅を元の 2 倍に拡大し、clipPath と mask で余分を取り除くことでこの考え方を試しています。

> Inside and outside stroke are actually implemented by doubling the stroke weight and masking the stroke by the fill. This means inside-aligned stroke will never draw strokes outside the fill and outside-aligned stroke will never draw strokes inside the fill.

実装を単純にするため、最初の方法を選びます。似た要素を 2 つ作って塗りとストロークをそれぞれ描き、上の例で SVG の書き出しを試せます。

キャンバス機能が豊富になるにつれて、読み込みと書き出しが正しく動くか、レンダリングが正しいか、UI コンポーネントがインタラクティブかを検証するテストを導入する必要があります。次の節で紹介します。

## さらに読む {#extended-reading}

-   [Export from Figma]
-   [Specifying stroke alignment]
-   [How to simulate stroke-align (stroke-alignment) in SVG]
-   [Vector rendering of SVG content with PixiJS]

[Export from Figma]: https://help.figma.com/hc/en-us/articles/360040028114-Export-from-Figma#h_01GWB002EPWMFSXKAEC62GS605
[How to simulate stroke-align (stroke-alignment) in SVG]: https://stackoverflow.com/questions/74958705/how-to-simulate-stroke-align-stroke-alignment-in-svg
[HTMLCanvasElement.toDataURL()]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
[preserveDrawingBuffer]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext#preservedrawingbuffer
[DataURI]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
[SwapChain]: /ja/guide/lesson-001#swapchain
[Web UI with Lit and Shoelace]: /ja/guide/lesson-007
[Plugin-based architecture]: /ja/guide/lesson-001#plugin-based-architecture
[SVGRenderer]: https://threejs.org/docs/#examples/en/renderers/SVGRenderer
[toJSON]: https://threejs.org/docs/#api/en/core/Object3D.toJSON
[JSON-Object-Scene-format-4]: https://github.com/mrdoob/three.js/wiki/JSON-Object-Scene-format-4
[Grid]: /ja/guide/lesson-005
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
[Lesson 30 - Time-based animation]: /ja/guide/lesson-030#time-animation
