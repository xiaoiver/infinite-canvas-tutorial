---
outline: deep
description: 'AI와 통합합니다. GPT 4o, Nano banana 같은 이미지 생성 모델과 채팅 대화창을 사용합니다. WebWorker에서 SAM으로 이미지를 분할하고, LaMa로 인페인팅하며, UpscalerJS로 이미지를 업스케일합니다.'
head:
    - ['meta', { property: 'og:title', content: '28강 - AI 통합' }]
---

<script setup>
import WhenCanvasMeetsChat from '../../components/WhenCanvasMeetsChat.vue'
</script>

# 28강 - AI 통합 {#lesson-28-integrating-with-ai}

오늘날 GPT 4o(gpt-image-1)와 Nano banana(gemini-2.5-flash-image)는 이미지 편집의 문턱을 크게 낮췄습니다. 인간-컴퓨터 상호작용의 관점에서 보면, 채팅 인터페이스와 캔버스의 조합이 점점 널리 쓰입니다. 모델과의 채팅 기록은 자연스럽게 이미지의 수정 히스토리를 나타내고, 자유롭게 드래그할 수 있는 캔버스는 이미지 선택과 병렬 처리를 자연스럽게 만듭니다. 자세한 내용은 [UI for AI]를 참고하세요.

아래 이미지는 Lovart의 제품 인터페이스입니다. 기반 기술로 [21강 - 트랜스포머]에서 다룬 Konva.js를 사용합니다. 이미지 편집이 중심이지만, 그래픽 편집기의 흔한 기능을 버리지는 않습니다. 예를 들어 왼쪽 아래에는 레이어 목록이 기본적으로 숨겨져 있고, 왼쪽 도구 모음에서도 기본 도형을 몇 가지 넣을 수 있습니다.

![Lovart](/lovart.png)

Recraft도 채팅 기능을 시험하고 있습니다. 제가 보기에, 캔버스와 채팅은 이런 종류의 편집기에서 두 개의 주된 입구가 되고 있습니다.

![Recraft 채팅](/recraft-chat.png)

이번 강의에서는 Nano banana와 결합해 이미지 편집 기능을 풍부하게 만들겠습니다.

<WhenCanvasMeetsChat />

## 모델 통합 {#client-sdk}

Nano banana를 쓰기 위해 저는 Google 공식 [generative-ai] 대신 [fal.ai]를 선택했습니다. 통일된 API가 있으면 [qwen-image-edit]나 [FLUX.1 Kontext] 같은 다른 이미지 생성 모델의 결과를 비교하기가 더 쉽기 때문입니다.

[OpenRouter]처럼 여러 모델을 모아 제공하는 SDK도 많습니다. 이미지 생성 인터페이스를 예로 들면, 프롬프트만 넘기면 생성된 이미지의 URL과 모델의 원래 텍스트 응답을 받습니다.

```ts
import { fal } from '@fal-ai/client';

const result = await fal.subscribe('fal-ai/gemini-25-flash-image', {
    input: {
        prompt: '',
    },
});
console.log(result.data); // { image: [{ url: 'https://...' }]; description: 'Sure, this is your image:' }
```

이미지 편집 API도 이미지 URL 묶음을 매개변수로 받습니다. 인코딩된 DataURL을 넘겨도 “이미지 정보를 읽을 수 없습니다” 같은 경고가 여전히 나올 수 있습니다. 그래서 [fal.ai]는 파일 업로드 인터페이스를 제공하며, 로컬 이미지가 캔버스에 추가될 때 업로드를 켤 수 있습니다.

### API 설계 {#api-design}

이미지를 생성하고 수정하는 API가 필요합니다. 두 경우 모두 매개변수는 같아야 합니다. 프롬프트 하나와 참조 이미지 목록입니다.

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

### 채팅 상자 {#chatbox}

채팅 상자는 캔버스 밖에 또 하나의 시작점을 제공합니다.

### 배경 제거 {#remove-background}

이미지를 두 번 클릭하면 편집 모드로 들어갑니다.

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

## 인페인팅 {#inpainting}

이미지 안에서 고른 기존 객체를 지우거나 고치면서, 나머지 부분은 그대로 둘 때 맞습니다.

<https://www.recraft.ai/docs#inpaint-image>

> 인페인팅은 이미지의 특정 부분을 바꾸거나 수정합니다. 마스크로 채울 영역을 지정합니다. 흰 픽셀은 인페인팅할 영역이고, 검은 픽셀은 그대로 둘 영역입니다. 즉 흰 픽셀은 프롬프트에 넣은 입력에 따라 채워집니다.

사용자가 간단한 편집기로 닫힌 영역을 그리면, 그것을 마스크 매개변수로 바꿔 API에 넘겨야 합니다. 이 마스크는 본질적으로 그레이스케일 이미지입니다.

![gpt-4o의 인페인팅](/inpainting.webp)

여기서 편집기의 중요성이 드러납니다. 단순한 편집 기능도 가치가 있습니다. Recraft는 세 가지를 말합니다. <https://www.recraft.ai/blog/inpainting-with-ai-how-to-edit-images-with-precision-using-recraft>

1. 확대와 축소가 쉽습니다. 정밀한 작업이므로 캔버스 확대·축소가 중요합니다.
2. SAM 같은 분할 모델로 AI 인페인팅을 자동으로 수행합니다.
3. 창의적인 유연성

### 마스크 만들기 {#create-mask}

사용자가 마스크를 만들 수 있도록 여러 상호작용 방법을 제공합니다.

1. [26강 - 선택 도구]
2. [25강 - 그리기 모드와 브러시]

### WebGPU로 SAM 사용하기 {#use-sam-via-webgpu}

사용자가 수정 영역을 가능한 한 정밀하게 지정하는 것에 더해, 클릭으로 고르는 것처럼 더 단순한 방법으로 영역을 선택할 수 있으면 더 좋습니다.

![Midjourney의 스마트 선택](/midjourney-smart-select.jpeg)

[1강 - 하드웨어 추상화 레이어]에서 WebGPU의 장점을 소개했습니다(Figma도 최근에 렌더링 엔진을 업그레이드했습니다). 렌더링을 넘어, 컴퓨트 셰이더 지원으로 브라우저 쪽 GPGPU가 가능해집니다. ONNX는 웹 런타임을 제공하므로, 토큰을 전혀 쓰지 않고 브라우저에서 바로 실시간 추론을 할 수 있습니다. 자세한 내용은 [How to add machine learning to your web application with ONNX Runtime]을 참고하세요.

이 글을 참고했습니다. [Image Segmentation in the Browser with Segment Anything Model 2]. 그리고 다음 최적화를 구현했습니다.

-   런타임에 내려받는 모델 크기를 줄이려고 [ORT model format]을 사용했습니다
-   더 빠른 추론을 위해 WebGPU를 사용했습니다. 자세한 내용은 [Using the WebGPU Execution Provider]를 참고하세요
-   메인 스레드를 막지 않도록 WebWorker 안에서 실행했습니다

이것들을 [SAM plugin]으로 감쌌습니다. 예제는 [Use SAM in WebWorker]입니다.

![WebWorker의 SAM](/sam.gif)

다른 실천 사례와 SAM3 관련 자료는 다음을 참고하세요.

-   [Segment Anything 2, in WebGPU]
-   [Request for Official ONNX Export + TensorRT Conversion Scripts for SAM3]

SAM으로 얻은 마스크는 참조 이미지로 써서 이미지 생성 모델에 넣을 수 있습니다.

### LaMa 사용하기 {#use-lama}

[Client-Side Image Inpainting with ONNX and Next.js]는 클라이언트에서 [LaMa] 모델을 쓰는 방법을 설명합니다.

### 여러 이미지 합성 {#combine-multiple-images}

캔버스를 쓰면 이미지의 위치 정보를 추가로 얻을 수 있습니다. 이 정보는 말로 설명하기 어려운 경우가 많습니다. 예를 들어 찻잔을 책상 위 아무 위치로 끌어 이미지를 합성할 수 있습니다.

## 아웃페인팅 {#outpainting}

이 기능은 OpenAI에 대응하는 API 구현이 아직 없습니다. 먼저 Recraft가 어떻게 하는지 보겠습니다. <https://www.recraft.ai/blog/ai-outpainting-how-to-expand-images>

> 아웃페인팅은 사용자가 이미지를 원래 프레임 바깥으로 확장할 수 있게 합니다. 잘린 이미지를 완성하거나 배경 풍경을 더할 때 특히 유용합니다.

이미지 안에서 선택한 객체를 그대로 두고 배경을 바꾸는 경우에 맞습니다.

![Recraft의 아웃페인팅](/outpainting-fixed.webp)

또는 바깥으로 확장하는 경우입니다.

![Recraft의 아웃페인팅](/outpainting.webp)

현재 GPT 4o는 고정된 세 가지 크기만 지원합니다. Nano banana로 임의의 이미지 크기를 출력하려면, 지정한 크기의 빈 이미지를 참조로 넘기고 프롬프트에서 그것을 강조하는 식의 우회 방법이 필요합니다. 캔버스 조작으로 이것을 매우 자연스럽게 만들 수 있습니다. 사용자는 알맞은 크기까지 드래그하기만 하면 되고, 애플리케이션이 Canvas API로 이 빈 참조 이미지를 자동으로 생성합니다.

## 레이어 분리 {#layer-separation}

-   [Editing Text in Images with AI]
-   [Move Anything with Layered Scene Diffusion]

### 래스터에서 벡터로 {#raster-to-vector}

많은 온라인 도구와 오픈 소스 도구가 전통적인 이미지 처리에 기반한 해법을 제공합니다.

-   Recraft [AI image vectorizer]
-   Lottiefiles [Raster to Vector converter]
-   [vtracer]

다만 이 접근은 텍스트 처리에서 만족스러운 결과를 내지 못합니다.

![lottiefiles의 래스터에서 벡터로. 출처: https://lottiefiles.com/tools/raster-to-vector](/lottiefiles-raster-vector.png)

이 알고리즘은 보통 다음 단계로 나뉘며, 첫 단계는 텍스트와 벡터화에 적합한 그래픽을 구분하지 않기 때문입니다.

1. “Path walking”은 픽셀을 패스로 변환합니다
2. 패스를 폴리곤으로 단순화합니다
3. 폴리곤을 매끄럽게 만들려고 시도합니다

![출처: https://www.visioncortex.org/vtracer-docs#path-walking](https://www.visioncortex.org/public/vtracer/WalkerOptim.svg)

### 배경과 텍스트 분리 {#split-background-text}

먼저 OCR과 비슷한 도구로 텍스트 영역을 찾고 마스크를 만듭니다. 그다음 마스크를 지우고, 표준 인페인팅 과정으로 모델이 이미지를 다시 생성하게 하면 텍스트가 없는 배경 이미지를 얻습니다.

[FLUX-Text: A Simple and Advanced Diffusion Transformer Baseline for Scene Text Editing]

![flux-text로 텍스트 편집](/flux-text.png)

오픈 소스 [Qwen-Image-Layered]를 쓰면 레이어 분해가 가능합니다. [fal.ai plugin]에서 다음 효과를 구현했습니다.

![Qwen-Image-Layered](/decompose-layers.gif)

### 글꼴 인식 {#font-recognition}

다음으로 텍스트 영역 안의 글꼴, 글자 크기 같은 스타일 속성을 알아내야 합니다.

[TextStyleBrush: Transfer of Text Aesthetics from a Single Example]

Adobe Photoshop은 [Match fonts]를 제공합니다.

![글꼴 일치 대화 상자에서 비슷한 글꼴 목록 중 글꼴을 선택](https://helpx-prod.scene7.com/is/image/HelpxProd/A-sample-document-showing-an-image-with-the-text-s?$pjpeg$&jpegSize=300&wid=1600)

[whatfontis]는 공개 API를 제공하며, 이미지 안의 지정한 영역에 대해 자신의 글꼴 라이브러리에서 가장 가까운 글꼴을 맞춥니다.

```json
[
    {
        "title": "Abril Fatface",
        "url": "https://www.whatfontis.com/FF_Abril-Fatface.font",
        "image": "https://www.whatfontis.com/img16/A/B/FF_Abril-FatfaceA.png"
    }
]
```

마지막으로 모든 레이어를 겹칩니다.

## 이미지 업스케일 {#upscale-image}

모델로 이미지를 업스케일할 수 있습니다. 다음 비교 이미지는 [Topaz Gigapixel]에서 가져온 것입니다.

![출처: https://www.adobe.com/products/photoshop/image-upscaler.html](https://www.adobe.com/products/photoshop/media_1bef0720b9cf0858149ccc837fa56e1ed726defe6.jpg?width=2000&format=webply&optimize=medium)

fal.ai에서는 [fal-ai/topaz/upscale/image]나 [SeedVR2]를 사용할 수 있습니다. 브라우저에서는 WebWorker 안에서 [UpscalerJS]를 사용할 수 있습니다. [upscaler plugin]을 참고하세요. 기본 모델은 `@upscalerjs/esrgan-medium 4x`입니다.

![@upscalerjs/esrgan-medium 4x](/upscaler.png)

### 다른 브라우저 런타임 {#other-browser-runtime}

[UpscalerJS]는 tensorflow.js를 사용합니다. ONNX 런타임을 쓰는 [super-resolution-js]를 고를 수도 있고, LiteRT라는 새로운 런타임도 있습니다.

![LiteRT.js로 이미지 업스케일](/image-upscaler.jpg)

## 프로젝트 캔버스의 WebMCP {#webmcp}

로그인한 프로젝트 편집기는 `document.modelContext`를 사용할 수 있을 때 [WebMCP imperative tools] 여섯 개를 등록합니다. `get_canvas_summary`, `get_selection`, `get_nodes`, `export_canvas_code`, `create_shape`, `update_node`입니다. 예를 들어 에이전트는 현재 선택을 읽고, 사각형을 만든 다음, 너비를 바꿀 수 있습니다. 두 쓰기 도구는 편집기와 같은 `api.edit()` 경로를 쓰므로, 편집이 실행 취소 히스토리와 캔버스 협업에 들어갑니다.

WebMCP는 현재 지원하는 브라우저가 필요합니다(Chrome 149 오리진 트라이얼, 또는 `chrome://flags/#enable-webmcp-testing` 개발 플래그). 도구를 시험하기 전에 자신이 소유한 프로젝트를 열고 로그인하세요. 다른 브라우저는 보통의 편집기로 계속 동작합니다. 캔버스가 닫히거나 프로젝트가 바뀌면 도구는 제거됩니다. 첫 버전은 사각형과 타원을 만들고 편집할 수 있습니다. 노드 읽기는 제한된 속성 집합만 돌려주고, 코드 내보내기는 32,000자로 제한됩니다.

프로젝트 페이지에서 DevTools로 도구를 살펴보고 편집을 처음부터 끝까지 시험할 수 있습니다.

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

편집기에서 실행 취소하면 사각형이 이전 너비로 돌아갑니다. 도구의 범위는 현재 프로젝트이며, 다른 프로젝트의 캔버스 데이터는 노출하지 않습니다.

WebMCP는 열려 있는 브라우저 탭 안에서 동작합니다. 데스크톱 에이전트를 위한 독립 실행형 MCP 서버는 별개의, 이후 연동입니다.

### 다른 MCP 연동 {#other-mcp-integrations}

[MCP: What It Is and Why It Matters]：

> 사람이 쓰는 GUI나 API만 있는 것이 아니라, AI 인터페이스를 “공짜로” 얻게 됩니다. 이 생각은 앱의 GUI와 함께, 또는 그보다 먼저 MCP 서버를 만드는 “MCP-first development”라는 개념으로 이어졌습니다.

### pencil.dev {#pencil-dev}

꿈꾸던 양방향 MCP 벡터 캔버스입니다. [pencil.dev]를 참고하세요.

> Pencil은 MCP 읽기 도구만 제공하지 않습니다. 캔버스를 완전히 조작할 수 있도록 전체 쓰기 권한과 여러 유용한 도구도 제공합니다. 이것이 진짜 핵심입니다. MCP의 세계 전체를 연결하고, 데이터베이스, API, 차트 데이터, Playwright/Puppeteer 같은 다른 출처에서 데이터를 가져오거나 다른 에이전트를 플러그인으로 쉽게 붙일 수 있습니다. 주도권은 여러분에게 있습니다.

[Figma MCP Server]는 [Figma API]를 조작할 수 있습니다.

[21강 - 트랜스포머]: /ko/guide/lesson-021
[UI for AI]: https://medium.com/ui-for-ai
[1강 - 하드웨어 추상화 레이어]: /ko/guide/lesson-001#hardware-abstraction-layers
[Image Segmentation in the Browser with Segment Anything Model 2]: https://medium.com/@geronimo7/in-browser-image-segmentation-with-segment-anything-model-2-c72680170d92
[fal.ai]: https://fal.ai/
[OpenRouter]: https://openrouter.ai/
[qwen-image-edit]: https://fal.ai/models/fal-ai/qwen-image-edit
[FLUX.1 Kontext]: https://fal.ai/models/fal-ai/flux-pro/kontext
[generative-ai]: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions
[26강 - 선택 도구]: /ko/guide/lesson-026#marquee-selection
[25강 - 그리기 모드와 브러시]: /ko/guide/lesson-025#brush-mode
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
