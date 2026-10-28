---
outline: deep
description: 'AI と連携します。GPT 4o や Nano banana などの画像生成モデルをチャットダイアログとともに使います。WebWorker で SAM を使って画像を分割し、LaMa でインペインティングを行い、UpscalerJS で画像をアップスケールします。'
head:
    - ['meta', { property: 'og:title', content: '第28課 - AI との連携' }]
---

<script setup>
import WhenCanvasMeetsChat from '../../components/WhenCanvasMeetsChat.vue'
</script>

# 第 28 課 - AI との連携 {#lesson-28-integrating-with-ai}

いま、GPT 4o（gpt-image-1）と Nano banana（gemini-2.5-flash-image）は、画像編集の敷居を大きく下げました。ヒューマンコンピュータインタラクションの観点から見ると、チャットインターフェースとキャンバスの組み合わせはますます一般的になっています。モデルとのチャット履歴は、画像の修正履歴を自然に表します。自由にドラッグできるキャンバスは、画像の選択と並列処理を自然なものにします。詳しくは [UI for AI] を参照してください。

下の画像は Lovart の製品インターフェースです。基盤技術には、[第 21 課 - トランスフォーマー] で触れた Konva.js を使っています。主眼は画像編集ですが、グラフィックエディタでよく使う機能を捨ててはいません。たとえば左下にはレイヤー一覧がデフォルトで隠れており、左のツールバーからも基本図形をいくつか挿入できます。

![Lovart](/lovart.png)

Recraft もチャット機能を試しています。私の見るところ、キャンバスとチャットは、この種のエディタにおける二つの主な入り口になりつつあります。

![Recraft のチャット](/recraft-chat.png)

この課では Nano banana と組み合わせて、画像編集機能を豊かにします。

<WhenCanvasMeetsChat />

## モデルの組み込み {#client-sdk}

Nano banana を使うために、私は Google 公式の [generative-ai] ではなく [fal.ai] を選びました。統一された API の方が、[qwen-image-edit] や [FLUX.1 Kontext] など、ほかの画像生成モデルの効果を比べやすいからです。

[OpenRouter] のように、複数のモデルをまとめた SDK はほかにもたくさんあります。画像生成インターフェースを例にすると、プロンプトを渡すだけで、生成された画像の URL と、モデルが返した元のテキスト応答を受け取れます。

```ts
import { fal } from '@fal-ai/client';

const result = await fal.subscribe('fal-ai/gemini-25-flash-image', {
    input: {
        prompt: '',
    },
});
console.log(result.data); // { image: [{ url: 'https://...' }]; description: 'Sure, this is your image:' }
```

画像編集 API も、画像 URL の集まりをパラメータとして受け取ります。エンコードした DataURL を渡しても、「画像情報を読み取れません」のような警告が出ることがあります。そのため [fal.ai] はファイルアップロードのインターフェースを用意しており、ローカル画像がキャンバスに追加されたときにアップロードを有効にできます。

### API 設計 {#api-design}

画像の生成と修正を担う API が必要です。どちらの場合もパラメータは同じにします。プロンプト一つと、参照画像の一覧です。

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

### チャットボックス {#chatbox}

チャットボックスは、キャンバス以外のもう一つの出発点を提供します。

### 背景の除去 {#remove-background}

画像をダブルクリックすると編集モードに入ります。

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

## インペインティング {#inpainting}

画像内で選んだ既存のオブジェクトを消したり修正したりしながら、ほかの部分は変えない用途に向いています。

<https://www.recraft.ai/docs#inpaint-image>

> インペインティングは、画像の特定の部分を置き換えたり修正したりします。埋める領域はマスクで指定します。白いピクセルはインペインティングする領域、黒いピクセルは残す領域です。つまり白いピクセルは、プロンプトで渡した入力に基づいて塗られます。

ユーザーが簡単なエディタで閉じた領域を描くと、それをマスクパラメータに変換して API へ渡す必要があります。このマスクは、本質的にはグレースケール画像です。

![gpt-4o のインペインティング](/inpainting.webp)

ここでエディタの重要さがはっきりします。簡単な編集機能にも価値があります。Recraft は三つの点を挙げています。<https://www.recraft.ai/blog/inpainting-with-ai-how-to-edit-images-with-precision-using-recraft>

1. 拡大と縮小がしやすいこと。精密な操作なので、キャンバスのズームが重要です。
2. SAM のようなセグメンテーションモデルによる、自動の AI インペインティング
3. 創造的な柔軟性

### マスクを作る {#create-mask}

ユーザーがマスクを作れるよう、複数のインタラクション方法を用意しています。

1. [第 26 課 - 選択ツール]
2. [第 25 課 - 描画モードとブラシ]

### WebGPU で SAM を使う {#use-sam-via-webgpu}

ユーザーが修正領域をできるだけ精密に指定できることに加え、クリックで選ぶような、より簡単な方法で領域を選択できればさらに好都合です。

![Midjourney のスマート選択](/midjourney-smart-select.jpeg)

[第 1 課 - ハードウェア抽象化レイヤー] で WebGPU の利点を紹介しました（Figma も最近レンダリングエンジンをアップグレードしました）。レンダリングに加えて、コンピュートシェーダーのサポートによりブラウザ側の GPGPU が可能になります。ONNX はウェブ向けランタイムを提供しているので、トークンをまったく消費せず、ブラウザ上で直接リアルタイム推論ができます。詳しくは [How to add machine learning to your web application with ONNX Runtime] を参照してください。

次の記事を参考にしました。[Image Segmentation in the Browser with Segment Anything Model 2]。そして次の最適化を実装しました。

-   実行時にダウンロードするモデルのサイズを減らすため、[ORT model format] を使いました
-   推論を速くするため WebGPU を使いました。詳しくは [Using the WebGPU Execution Provider] を参照してください
-   メインスレッドを止めないよう、WebWorker の中で実行しました

これらを [SAM plugin] にまとめました。例は [Use SAM in WebWorker] です。

![WebWorker の SAM](/sam.gif)

ほかの実践と SAM3 関連の資料は、次を参照してください。

-   [Segment Anything 2, in WebGPU]
-   [Request for Official ONNX Export + TensorRT Conversion Scripts for SAM3]

SAM で得たマスクは、参照画像として画像生成モデルに渡せます。

### LaMa を使う {#use-lama}

[Client-Side Image Inpainting with ONNX and Next.js] は、クライアント側で [LaMa] モデルを使う方法を説明しています。

### 複数の画像を合成する {#combine-multiple-images}

キャンバスを使うと、画像の位置情報を追加で得られます。この情報は言葉で説明するのが難しいことがよくあります。たとえばティーカップを机の上の任意の位置へドラッグし、一枚の画像に合成できます。

## アウトペインティング {#outpainting}

この機能には、OpenAI 側の対応する API 実装がまだありません。まず Recraft のやり方を見ます。<https://www.recraft.ai/blog/ai-outpainting-how-to-expand-images>

> アウトペインティングを使うと、画像を元のフレームの外側へ広げることができます。切り取られた画像を補完したり、背景の風景を足したりするときに特に役立ちます。

画像内で選んだオブジェクトを変えず、背景を差し替えるような場合に向いています。

![Recraft のアウトペインティング](/outpainting-fixed.webp)

または外側へ広げる場合です。

![Recraft のアウトペインティング](/outpainting.webp)

現在、GPT 4o がサポートするのは固定の三サイズだけです。Nano banana で任意の画像サイズを出力するには、指定サイズの空白画像を参照として渡し、プロンプトでそれを強調するようなハックが必要です。キャンバス操作で、これをとても自然にできます。ユーザーは適切なサイズまでドラッグするだけで、アプリケーションが Canvas API を通じてこの空白の参照画像を自動生成します。

## レイヤー分離 {#layer-separation}

-   [Editing Text in Images with AI]
-   [Move Anything with Layered Scene Diffusion]

### ラスターからベクターへ {#raster-to-vector}

多くのオンラインツールとオープンソースツールが、伝統的な画像処理に基づく方法を提供しています。

-   Recraft [AI image vectorizer]
-   Lottiefiles [Raster to Vector converter]
-   [vtracer]

ただし、この方法はテキスト処理では満足できる結果になりません。

![lottiefiles のラスターからベクターへ。出典: https://lottiefiles.com/tools/raster-to-vector](/lottiefiles-raster-vector.png)

このアルゴリズムは通常、次の段階に分かれ、最初の段階ではテキストと、ベクター化に向いたグラフィックを区別しないからです。

1. “Path walking” はピクセルをパスに変換します
2. パスをポリゴンへ単純化します
3. ポリゴンを滑らかにしようと試みます

![出典: https://www.visioncortex.org/vtracer-docs#path-walking](https://www.visioncortex.org/public/vtracer/WalkerOptim.svg)

### 背景とテキストを分ける {#split-background-text}

まず OCR に似たツールでテキスト領域を特定し、マスクを作ります。次にマスクを取り除き、標準的なインペインティングの手順でモデルに画像を再生成させると、テキストのない背景画像が得られます。

[FLUX-Text: A Simple and Advanced Diffusion Transformer Baseline for Scene Text Editing]

![flux-text によるテキスト編集](/flux-text.png)

オープンソースの [Qwen-Image-Layered] を使うと、レイヤー分解ができます。[fal.ai plugin] では次の効果を実現しました。

![Qwen-Image-Layered](/decompose-layers.gif)

### フォント認識 {#font-recognition}

次に、テキスト領域の中のフォントやフォントサイズといったスタイル属性を特定する必要があります。

[TextStyleBrush: Transfer of Text Aesthetics from a Single Example]

Adobe Photoshop は [Match fonts] を提供しています。

![Match Fonts ダイアログで、似たフォントの一覧からフォントを選ぶ](https://helpx-prod.scene7.com/is/image/HelpxProd/A-sample-document-showing-an-image-with-the-text-s?$pjpeg$&jpegSize=300&wid=1600)

[whatfontis] は公開 API を提供しており、画像内の指定領域に対して、自らのフォントライブラリの中から最も近いフォントを照合します。

```json
[
    {
        "title": "Abril Fatface",
        "url": "https://www.whatfontis.com/FF_Abril-Fatface.font",
        "image": "https://www.whatfontis.com/img16/A/B/FF_Abril-FatfaceA.png"
    }
]
```

最後に、すべてのレイヤーを重ねます。

## 画像のアップスケール {#upscale-image}

モデルで画像をアップスケールできます。次の比較画像は [Topaz Gigapixel] のものです。

![出典: https://www.adobe.com/products/photoshop/image-upscaler.html](https://www.adobe.com/products/photoshop/media_1bef0720b9cf0858149ccc837fa56e1ed726defe6.jpg?width=2000&format=webply&optimize=medium)

fal.ai では [fal-ai/topaz/upscale/image] または [SeedVR2] を使えます。ブラウザ側では WebWorker の中で [UpscalerJS] を使えます。[upscaler plugin] を参照してください。既定のモデルは `@upscalerjs/esrgan-medium 4x` です。

![@upscalerjs/esrgan-medium 4x](/upscaler.png)

### その他のブラウザランタイム {#other-browser-runtime}

[UpscalerJS] は tensorflow.js を使います。ONNX ランタイムの [super-resolution-js] を選ぶこともできますし、LiteRT という新しいランタイムもあります。

![LiteRT.js による画像アップスケール](/image-upscaler.jpg)

## プロジェクトキャンバスの WebMCP {#webmcp}

サインイン済みのプロジェクトエディタは、`document.modelContext` が使えるときに六つの [WebMCP imperative tools] を登録します。`get_canvas_summary`、`get_selection`、`get_nodes`、`export_canvas_code`、`create_shape`、`update_node` です。たとえばエージェントは現在の選択を読み、矩形を作り、その幅を変更できます。二つの書き込みツールはエディタと同じ `api.edit()` の経路を使うので、編集は元に戻す履歴とキャンバスの共同編集に入ります。

WebMCP は現在、対応ブラウザが必要です（Chrome 149 のオリジントライアル、または `chrome://flags/#enable-webmcp-testing` 開発フラグ）。ツールを試す前に、自分が所有するプロジェクトを開いてサインインしてください。ほかのブラウザは通常のエディタとして動作し続けます。キャンバスを閉じるかプロジェクトが変わると、ツールは取り除かれます。最初の版では矩形と楕円を作成・編集できます。ノードの読み取りが返すプロパティは限られており、コードの書き出しは 32,000 文字が上限です。

プロジェクトページでは、DevTools からツールを調べ、編集を一通り試せます。

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

エディタで元に戻すと、矩形は以前の幅に戻ります。ツールの範囲は現在のプロジェクトであり、ほかのプロジェクトのキャンバスデータは公開しません。

WebMCP は、開いているブラウザタブの中で動作します。デスクトップエージェント向けのスタンドアロン MCP サーバーは、別の、これからの連携です。

### その他の MCP 連携 {#other-mcp-integrations}

[MCP: What It Is and Why It Matters]：

> 人が使う GUI や API だけがあるのではなく、AI インターフェースが「ただで」手に入ります。この考えは、アプリの GUI と同時に、あるいはそれに先立って MCP サーバーを作る「MCP-first development」という概念につながりました。

### pencil.dev {#pencil-dev}

夢見ていた双方向の MCP ベクターキャンバスです。[pencil.dev] を参照してください。

> Pencil が提供するのは MCP の読み取りツールだけではありません。キャンバスを完全に操作できる、書き込み権限のすべてと、便利なツールも多数提供します。これが本当の核心です。MCP の世界全体を接続し、データベース、API、チャートデータ、Playwright/Puppeteer のような別の情報源からデータを持ち込んだり、ほかのエージェントをプラグインとして簡単に追加したりできます。主導権はあなたにあります。

[Figma MCP Server] は [Figma API] を操作できます。

[第 21 課 - トランスフォーマー]: /ja/guide/lesson-021
[UI for AI]: https://medium.com/ui-for-ai
[第 1 課 - ハードウェア抽象化レイヤー]: /ja/guide/lesson-001#hardware-abstraction-layers
[Image Segmentation in the Browser with Segment Anything Model 2]: https://medium.com/@geronimo7/in-browser-image-segmentation-with-segment-anything-model-2-c72680170d92
[fal.ai]: https://fal.ai/
[OpenRouter]: https://openrouter.ai/
[qwen-image-edit]: https://fal.ai/models/fal-ai/qwen-image-edit
[FLUX.1 Kontext]: https://fal.ai/models/fal-ai/flux-pro/kontext
[generative-ai]: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions
[第 26 課 - 選択ツール]: /ja/guide/lesson-026#marquee-selection
[第 25 課 - 描画モードとブラシ]: /ja/guide/lesson-025#brush-mode
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
