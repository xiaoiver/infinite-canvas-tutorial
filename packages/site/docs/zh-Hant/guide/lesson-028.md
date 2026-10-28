---
outline: deep
description: '與 AI 整合，使用聊天對話搭配影像生成模型，例如 GPT 4o 與 Nano banana。在 WebWorker 中使用 SAM 分割影像，使用 LaMa 進行局部重繪，並使用 UpscalerJS 放大影像。'
head:
    - [
          'meta',
          { property: 'og:title', content: '第 28 課 - 與 AI 整合' },
      ]
---

<script setup>
import WhenCanvasMeetsChat from '../../components/WhenCanvasMeetsChat.vue'
</script>

# 第 28 課 - 與 AI 整合 {#lesson-28-integrating-with-ai}

如今，GPT 4o（gpt-image-1）與 Nano banana（gemini-2.5-flash-image）大幅降低了影像編輯的門檻。從人機互動的角度看，聊天介面與畫布的結合正變得越來越流行。與模型的聊天紀錄自然反映了影像的修改歷史，而可自由拖曳的畫布則讓影像選取與平行處理變得自然。更多細節見 [UI for AI]。

下圖是 Lovart 的產品介面，底層使用我們在 [第 21 課 - Transformer] 中提到的 Konva.js。雖然主要以影像編輯為主，它並沒有放棄圖形編輯器的常見功能，例如左下角預設隱藏的圖層清單，左側工具列也可以插入一些基本圖形。

![Lovart](/lovart.png)

Recraft 也在測試聊天功能。依我的觀察，畫布與聊天正成為這類編輯器的兩個主要入口：

![Recraft 聊天](/recraft-chat.png)

這一課會結合 Nano banana，豐富我們的影像編輯功能。

<WhenCanvasMeetsChat />

## 整合模型 {#client-sdk}

為了使用 Nano banana，我選擇 [fal.ai]，而不是 Google 官方的 [generative-ai]。原因是統一的 API 讓我更容易比較其他影像生成模型的效果，例如 [qwen-image-edit] 或 [FLUX.1 Kontext]。

還有許多其他聚合式 SDK，例如 [OpenRouter]。以影像生成介面為例，只需要傳入一個 prompt，就能收到生成影像的 URL，以及原始模型的文字回應：

```ts
import { fal } from '@fal-ai/client';

const result = await fal.subscribe('fal-ai/gemini-25-flash-image', {
    input: {
        prompt: '',
    },
});
console.log(result.data); // { image: [{ url: 'https://...' }]; description: 'Sure, this is your image:' }
```

影像編輯 API 也接受一組影像 URL 作為參數。即使傳入編碼後的 DataURL，仍可能出現「Unable to read image information」這類警告。因此，[fal.ai] 提供檔案上傳介面，讓我們在本機影像加入畫布時可以啟用上傳。

### API 設計 {#api-design}

我們需要一個負責生成與修改影像的 API。兩種情境的參數應該相同：一段 prompt，以及一組參考影像。

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

### 聊天框 {#chatbox}

聊天框提供了畫布之外的另一個起點。

### 移除背景 {#remove-background}

雙擊影像以進入編輯模式：

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

## 局部重繪 {#inpainting}

適合擦除或修改影像中已選取的既有物件，同時確保其他部分維持不變。

<https://www.recraft.ai/docs#inpaint-image>

> 局部重繪會替換或修改影像的特定部分。它使用遮罩標示要填入的區域：白色像素代表要局部重繪的區域，黑色像素代表要保持原樣的區域，也就是白色像素會依照 prompt 中提供的輸入被填入。

當使用者用一個簡單的編輯器畫出封閉區域時，需要把它轉換成遮罩參數再傳給 API。這個遮罩本質上是一張灰階影像：

![gpt-4o 中的局部重繪](/inpainting.webp)

這時編輯器的重要性就顯現出來了。即使是簡單的編輯功能也有價值。Recraft 提到三點：<https://www.recraft.ai/blog/inpainting-with-ai-how-to-edit-images-with-precision-using-recraft>

1. 易於放大與縮小——畢竟這是精密操作，所以畫布縮放至關重要。
2. 使用像 SAM 這類分割模型，自動進行 AI 局部重繪
3. 創作上的彈性

### 建立遮罩 {#create-mask}

我們提供多種互動方式，讓使用者生成遮罩：

1. [第 26 課 - 選取工具]
2. [第 25 課 - 繪製模式與筆刷]

### 透過 WebGPU 使用 SAM {#use-sam-via-webgpu}

除了讓使用者盡可能精確地定義修改區域，如果能用更簡單的方式完成區域選取，例如點擊選取，那就更好了。

![Midjourney 中的智慧選取](/midjourney-smart-select.jpeg)

在 [第 1 課 - 硬體抽象層] 中，我們介紹了 WebGPU 的優勢（Figma 最近也升級了它的渲染引擎）。除了渲染，它透過 Compute Shader 的支援，使瀏覽器端的 GPGPU 成為可能。ONNX 提供以網頁為基礎的執行環境，可以直接在瀏覽器中即時推論，而不消耗任何 token。詳見：[如何用 ONNX Runtime 為網頁應用程式加入機器學習]。

我們參考這篇文章：[在瀏覽器中使用 Segment Anything Model 2 進行影像分割]，並實作了下列最佳化：

-   使用 [ORT 模型格式]，縮小執行期間下載的模型大小
-   採用 WebGPU，以獲得更快的推論速度。詳見：[使用 WebGPU Execution Provider]
-   在 WebWorker 中執行，避免阻塞主執行緒

我們把它們包裝在 [SAM 外掛] 中。這是我們的範例：[在 WebWorker 中使用 SAM]。

![WebWorker 中的 SAM](/sam.gif)

其他實務做法與 SAM3 相關資料，請參考：

-   [WebGPU 中的 Segment Anything 2]
-   [請求提供 SAM3 的官方 ONNX 匯出與 TensorRT 轉換指令碼]

透過 SAM 取得的遮罩可以作為參考影像，送進原始影像模型。

### 使用 LaMa {#use-lama}

[使用 ONNX 與 Next.js 在用戶端進行影像局部重繪] 說明如何在用戶端使用 [LaMa] 模型。

### 合併多張影像 {#combine-multiple-images}

使用畫布可以取得影像的額外位置資訊，這往往很難用語言描述。例如，我們可以把茶杯拖到桌面上的任意位置，再合成一張影像。

## 向外擴圖 {#outpainting}

這項功能目前還沒有來自 OpenAI 的對應 API 實作。我們先看看 Recraft 怎麼做。<https://www.recraft.ai/blog/ai-outpainting-how-to-expand-images>

> 向外擴圖讓使用者把影像擴展到原始畫框之外——特別適合補全被裁切的影像，或增加更多背景景物。

適合保持影像中已選取的物件不變，例如更換背景：

![Recraft 中的向外擴圖](/outpainting-fixed.webp)

或向外擴展：

![Recraft 中的向外擴圖](/outpainting.webp)

目前 GPT 4o 只支援三種固定尺寸，而 Nano banana 需要一些權宜做法，才能輸出任意影像尺寸，例如傳入指定尺寸的空白影像作為參考，並在 prompt 中強調它。我們可以透過畫布操作讓這件事變得很自然：使用者只需要拖曳到合適的尺寸，應用程式就會透過 Canvas API 自動產生這張空白參考影像。

## 圖層分離 {#layer-separation}

-   [用 AI 編輯影像中的文字]
-   [用分層場景擴散移動任何東西]

### 點陣轉向量 {#raster-to-vector}

許多線上與開源工具都提供基於傳統影像處理的解決方案：

-   Recraft [AI 影像向量化工具]
-   Lottiefiles [點陣轉向量轉換器]
-   [vtracer]

不過，這種方法對文字處理得不到令人滿意的結果：

![lottiefiles 中的點陣轉向量。來源：https://lottiefiles.com/tools/raster-to-vector](/lottiefiles-raster-vector.png)

原因是這個演算法通常分為下列階段，而第一階段不會區分文字與適合向量化的圖形：

1. 「路徑行走」（Path walking）把像素轉換成路徑
2. 路徑被簡化成多邊形
3. 嘗試把多邊形平滑化

![來源: https://www.visioncortex.org/vtracer-docs#path-walking](https://www.visioncortex.org/public/vtracer/WalkerOptim.svg)

### 分離背景與文字 {#split-background-text}

首先，使用類似 OCR 的工具辨識文字區域並生成遮罩。然後移除遮罩，讓模型透過標準的局部重繪流程重新生成影像，得到不含文字的背景影像。

[FLUX-Text：場景文字編輯的簡潔進階 Diffusion Transformer 基準]

![使用 flux-text 編輯文字](/flux-text.png)

使用開源的 [Qwen-Image-Layered] 可以進行圖層分解。在 [fal.ai 外掛] 中，我們達到了下列效果：

![Qwen-Image-Layered](/decompose-layers.gif)

### 字型辨識 {#font-recognition}

接下來，需要辨識文字區域內的字型、字級等樣式屬性。

[TextStyleBrush：從單一範例遷移文字美學]

Adobe Photoshop 提供 [相符字型]：

![在相符字型對話框中，從相似字型清單裡選取一種字型](https://helpx-prod.scene7.com/is/image/HelpxProd/A-sample-document-showing-an-image-with-the-text-s?$pjpeg$&jpegSize=300&wid=1600)

[whatfontis] 提供公開 API，能把影像中指定區域，與字型庫裡最接近的字型配對。

```json
[
    {
        "title": "Abril Fatface",
        "url": "https://www.whatfontis.com/FF_Abril-Fatface.font",
        "image": "https://www.whatfontis.com/img16/A/B/FF_Abril-FatfaceA.png"
    }
]
```

最後，把所有圖層疊加起來。

## 放大影像 {#upscale-image}

我們可以用模型放大影像，下面的對比圖來自 [Topaz Gigapixel]：

![來源: https://www.adobe.com/products/photoshop/image-upscaler.html](https://www.adobe.com/products/photoshop/media_1bef0720b9cf0858149ccc837fa56e1ed726defe6.jpg?width=2000&format=webply&optimize=medium)

我們可以在 fal.ai 中使用 [fal-ai/topaz/upscale/image] 或 [SeedVR2]。在瀏覽器端，可以在 webworker 中使用 [UpscalerJS]，見我們的 [放大外掛]，它預設使用 `@upscalerjs/esrgan-medium 4x` 模型。

![@upscalerjs/esrgan-medium 4x](/upscaler.png)

### 其他瀏覽器執行環境 {#other-browser-runtime}

[UpscalerJS] 使用 tensorflow.js，你也可以改用搭配 ONNX runtime 的 [super-resolution-js]，或稱為 LiteRT 的新執行環境：

![使用 LiteRT.js 的影像放大器](/image-upscaler.jpg)

## 專案畫布的 WebMCP {#webmcp}

已登入的專案編輯器會在 `document.modelContext` 可用時，註冊六個 [WebMCP 指令式工具]：`get_canvas_summary`、`get_selection`、`get_nodes`、`export_canvas_code`、`create_shape` 與 `update_node`。例如，代理可以讀取目前的選取、建立一個矩形，然後改變它的寬度。兩個寫入工具與編輯器使用同一條 `api.edit()` 路徑，因此編輯會進入復原歷史與畫布協作。

WebMCP 目前需要支援它的瀏覽器（Chrome 149 origin trial，或 `chrome://flags/#enable-webmcp-testing` 開發旗標）。請先開啟你擁有的專案並登入，再試用這些工具。其他瀏覽器仍會作為一般編輯器運作。畫布關閉或專案變更時，工具會被移除。第一個版本可以建立與編輯矩形和橢圓；節點讀取只回傳有限的一組屬性，程式碼匯出上限為 32,000 個字元。

在專案頁面上，你可以從 DevTools 檢視這些工具，並試著做一次完整的編輯：

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

在編輯器中復原，會還原矩形先前的寬度。這些工具的範圍限於目前的專案，不會暴露其他專案的畫布資料。

WebMCP 在已開啟的瀏覽器分頁中運作。供桌面代理使用的獨立 MCP 伺服器，是另一項未來的整合。

### 其他 MCP 整合 {#other-mcp-integrations}

[MCP：它是什麼，以及為什麼重要]：

> 你得到的不只是人類使用的 GUI 或 API，還能「免費」得到一個 AI 介面。這個想法引出了「MCP-first development」的概念：在建立 GUI 之前或同時，先為應用程式建立 MCP 伺服器。

### pencil.dev {#pencil-dev}

你一直夢想的雙向 MCP 向量畫布。見 [pencil.dev]

> Pencil 提供的不只是 MCP 讀取工具，還有完整的寫入權限，以及許多其他順手的工具，足以完整操作畫布。這才是真正的魔力。你可以接上整個 MCP 世界，從資料庫、API、圖表資料、Playwright/Puppeteer 等其他來源帶入資料，或輕鬆外掛其他代理。主導權在你手上。

[Figma MCP Server] 可以操作 [Figma API]。

[第 21 課 - Transformer]: /zh-Hant/guide/lesson-021
[UI for AI]: https://medium.com/ui-for-ai
[第 1 課 - 硬體抽象層]: /zh-Hant/guide/lesson-001#hardware-abstraction-layers
[在瀏覽器中使用 Segment Anything Model 2 進行影像分割]: https://medium.com/@geronimo7/in-browser-image-segmentation-with-segment-anything-model-2-c72680170d92
[fal.ai]: https://fal.ai/
[OpenRouter]: https://openrouter.ai/
[qwen-image-edit]: https://fal.ai/models/fal-ai/qwen-image-edit
[FLUX.1 Kontext]: https://fal.ai/models/fal-ai/flux-pro/kontext
[generative-ai]: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions
[第 26 課 - 選取工具]: /zh-Hant/guide/lesson-026#marquee-selection
[第 25 課 - 繪製模式與筆刷]: /zh-Hant/guide/lesson-025#brush-mode
[MCP：它是什麼，以及為什麼重要]: https://addyo.substack.com/p/mcp-what-it-is-and-why-it-matters
[Figma MCP Server]: https://github.com/GLips/Figma-Context-MCP
[Figma API]: https://www.figma.com/developers/api
[WebMCP 指令式工具]: https://developer.chrome.com/docs/ai/webmcp/imperative-api
[用 AI 編輯影像中的文字]: https://medium.com/data-science/editing-text-in-images-with-ai-03dee75d8b9c
[whatfontis]: https://www.whatfontis.com/API-identify-fonts-from-image.html#font_Examples_good
[相符字型]: https://helpx.adobe.com/photoshop/desktop/text-typography/select-manage-fonts/match-fonts.html
[FLUX-Text：場景文字編輯的簡潔進階 Diffusion Transformer 基準]: https://arxiv.org/pdf/2505.03329
[TextStyleBrush：從單一範例遷移文字美學]: https://arxiv.org/pdf/2106.08385
[用分層場景擴散移動任何東西]: https://openaccess.thecvf.com/content/CVPR2024/papers/Ren_Move_Anything_with_Layered_Scene_Diffusion_CVPR_2024_paper.pdf
[點陣轉向量轉換器]: https://lottiefiles.com/tools/raster-to-vector
[AI 影像向量化工具]: https://www.recraft.ai/ai-image-vectorizer
[vtracer]: https://github.com/visioncortex/vtracer
[WebGPU 中的 Segment Anything 2]: https://lucasgelfond.online/software/webgpu-sam2/
[LaMa]: https://github.com/advimman/lama
[使用 ONNX 與 Next.js 在用戶端進行影像局部重繪]: https://medium.com/@geronimo7/client-side-image-inpainting-with-onnx-and-next-js-3d9508dfd059
[請求提供 SAM3 的官方 ONNX 匯出與 TensorRT 轉換指令碼]: https://github.com/facebookresearch/sam3/issues/224
[在 WebWorker 中使用 SAM]: /experiment/sam-in-worker
[SAM 外掛]: /reference/sam
[fal.ai 外掛]: /reference/fal
[放大外掛]: /reference/upscaler
[如何用 ONNX Runtime 為網頁應用程式加入機器學習]: https://onnxruntime.ai/docs/tutorials/web/
[ORT 模型格式]: https://onnxruntime.ai/docs/performance/model-optimizations/ort-format-models.html
[使用 WebGPU Execution Provider]: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
[Qwen-Image-Layered]: https://arxiv.org/pdf/2512.15603
[SeedVR2]: https://huggingface.co/ByteDance-Seed/SeedVR2-7B
[UpscalerJS]: https://upscalerjs.com/documentation/guides/browser/performance/webworker
[super-resolution-js]: https://github.com/josephrocca/super-resolution-js
[Topaz Gigapixel]: https://www.topazlabs.com/topaz-gigapixel
[fal-ai/topaz/upscale/image]: https://fal.ai/models/fal-ai/topaz/upscale/image/api
[pencil.dev]: https://www.pencil.dev/
