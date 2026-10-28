---
outline: deep
description: '후처리로 이미지를 처리합니다. 렌더 그래프로 파이프라인을 최적화합니다.'
head:
    - ['meta', { property: 'og:title', content: '30강 - 후처리와 렌더 그래프' }]
---

<script setup>
import ImageProcessing from '../../components/ImageProcessing.vue'
import HalftoneDots from '../../components/HalftoneDots.vue'
import Pixelate from '../../components/Pixelate.vue'
import CRT from '../../components/CRT.vue'
import Glitch from '../../components/Glitch.vue'
import LiquidGlass from '../../components/LiquidGlass.vue'
import LiquidMetal from '../../components/LiquidMetal.vue'
import Heatmap from '../../components/Heatmap.vue'
import GenSmoke from '../../components/GenSmoke.vue'
import Ascii from '../../components/Ascii.vue'
import GlobalEffects from '../../components/GlobalEffects.vue'
</script>

# 30강 - 후처리와 렌더 그래프 {#lesson-30-post-processing-and-render-graph}

이번 강의에서는 이미지에 대한 전통적인 셰이더 기반 후처리를 다시 살펴봅니다. 전체 화면 패스, 샘플링, 흔한 효과입니다. 이어서 렌더 그래프로 여러 패스를 조직하고, 렌더 타깃과 동기화를 관리하며, 후처리 파이프라인 전체를 최적화하는 방법을 소개합니다.

## 후처리 효과 {#post-processing}

셰이더를 기반으로 가우시안 블러, 펄린 노이즈, 글리치 같은 흔한 이미지 처리 효과를 만들 수 있습니다. 물론 최근에 널리 알려진 “리퀴드 글라스”도 있습니다.

![출처: https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers](/figma-liquid-glass.png)

![Photoshop Web에서의 조정](/adjust-ps-web.png)

더 많은 효과는 다음을 참고하세요.

-   [Image Processing]
-   [glfx.js]
-   [Paper Shaders]

구현에서 [Pixi.js filters]는 객체의 바운딩 박스를 기준으로 적용 영역을 계산하고, 객체를 임시 렌더 텍스처에 그린 다음, 그 텍스처에 셰이더 효과를 적용합니다.

### RenderTarget에 렌더링 {#render-to-render-target}

Pixi.js에서는 다음과 같습니다.

```ts
// src/filters/FilterSystem.ts
const quadGeometry = new Geometry({
    attributes: {
        aPosition: {
            buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
            format: 'float32x2',
            stride: 2 * 4,
            offset: 0,
        },
    },
    indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
});
```

### 샘플링 {#sample}

다음으로 캔버스 전체 텍스처에서, 대상 도형이 있는 영역을 샘플링해야 합니다.

```glsl
void main() {
  v_Uv = a_Position * (u_OutputFrame.zw / u_InputSize.xy) + u_OutputFrame.xy / u_InputSize.xy;

  gl_Position = vec4((a_Position * 2.0 - 1.0) * u_OutputTexture.xy / u_OutputFrame.zw * u_OutputTexture.z, 0.0, 1.0);
}
```

### 큰 삼각형 {#big-triangle}

여기서는 전체 화면 삼각형을 사용할 수 있습니다. Quad보다 정점이 하나 적습니다. [Optimizing Triangles for a Full-screen Pass]를 참고하세요.

![파란 직사각형은 뷰포트입니다. 빨강은 지오메트리의 경계입니다](https://wallisc.github.io/assets/FullscreenPass/1tri.jpg)

```ts
this.#bigTriangleVertexBuffer = this.device.createBuffer({
    viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
    usage: BufferUsage.VERTEX,
    hint: BufferFrequencyHint.DYNAMIC,
});
```

정점 셰이더는 매우 단순합니다. `v_Uv` 텍스처 좌표만 올바르게 대응시키면 됩니다.

```glsl
void main() {
  v_Uv = 0.5 * (a_Position + 1.0);
  gl_Position = vec4(a_Position, 0.0, 1.0);

  #ifdef VIEWPORT_ORIGIN_TL
    v_Uv.y = 1.0 - v_Uv.y;
  #endif
}
```

### 여러 채우기와 필터 순서 {#fill-filter-order}

ECS에서 SDF 프리미티브와 Path의 래스터 필터는, 켜져 있는 `fills`가 페인트 순서대로 합성된 뒤에 실행됩니다. 레이어 불투명도와 블렌드 모드는 그 합성에 참여합니다. 필터 체인은 합성된 텍스처를 한 번만 처리하고, 도형 불투명도는 최종 그리기에 적용됩니다. 같은 체인을 레이어마다 따로 적용하면, 앞선 레이어가 아직 필요로 하는 텍스처가 바뀌어 버릴 수 있습니다.

예를 들어 빨간 아래쪽 채우기와 `opacity: 0.5`인 파란 위쪽 채우기는 `brightness(0) contrast(0)`에서도 보라색으로 남습니다. 이 두 필터는 glfx의 조정 관례를 따르며, 0은 중립입니다. 중립이 아닌 효과는 `filter` 문자열에 적힌 순서대로 실행됩니다. 밝기와 대비의 순서를 바꾸면 결과가 달라질 수 있습니다.

채우기나 지오메트리를 바꾸면 영향을 받는 래스터 입력이 다시 만들어집니다. 래스터 필터를 제거하면 오프스크린 체인이 해제되며, 도형이 단색을 직접 그리는 상태로 돌아갈 때도 마찬가지입니다. 중간 레이어 텍스처는 합성 뒤에 해제되고, 붙어 있는 렌더 텍스처는 자신의 렌더 타깃을 통해 해제됩니다.

### 색 필터의 알파 {#filter-alpha}

밝기, 대비, 색상/채도, 노이즈, dot, color-halftone 조정은 페인트 알파와 무관하게 스트레이트 RGB에서 동작합니다. 도형별 채우기 텍스처는 스트레이트 RGBA를 저장합니다. 캔버스 전체 필터는 프리멀티플라이드 RGBA를 받아 조정에 맞게 변환합니다. RGB는 다시 프리멀티플라이하기 전에 표시 가능한 범위로 클램프하고, 알파는 유지합니다. 이렇게 하면 지나치게 밝은 중간 결과가 다음 필터를 뜻밖에 바꾸지 않습니다.

예를 들어 `rgba(64,128,192,0.5)`에 `brightness(0.2)`를 적용하면, 도형 불투명도를 적용하기 전에 대략 `rgba(115,179,243,0.5)`가 됩니다. 페인트 알파를 낮춘다고 밝기 조정 자체가 줄어들어서는 안 됩니다. 이 색 필터들은 WebGL1의 일반 유니폼과 WebGL2의 유니폼 버퍼를 모두 갱신합니다. 스칼라 std140 블록은 WebKit이 요구하는 16바이트 정렬을 유지합니다.

### 원래 도형 밖으로 번지는 블러 {#blur-bounds}

SDF 프리미티브와 일반 Path 채우기에서, 양수 `blur()`는 먼저 도형의 채우기, 실루엣, SDF 단색 스트로크를 투명 패딩이 있는 텍스처에 캡처합니다. 최종 그리기는 그 패딩 영역을 덮으므로, 블러가 둥근 모서리 밖으로, 그리고 Path의 구멍 안으로 퍼질 수 있습니다. 넓어지는 것은 렌더 바운드뿐이고, 선택 지오메트리는 그대로입니다. 예를 들어 `filter: 'blur(6px, 3)'`는 윤곽을 부드럽게 하고, `blur(0px)`는 윤곽을 유지합니다.

샘플링은 프리멀티플라이드 텍셀을 보간한 뒤 스트레이트 RGBA로 되돌립니다. 그러면 반투명한 파란 가장자리가, 투명한 검정이 RGB에 섞이지 않고 파랑으로 남으며, 확대했을 때도 마찬가지입니다. 패딩에는 모든 패스와 연속된 모든 블러의 샘플링 범위가 포함됩니다. WebGL1은 각 패스를 그리기 직전에 그 패스의 커널 유니폼을 갱신합니다.

이 캡처 경로는 현재 SDF 채우기/단색 스트로크와 일반 Path/VectorNetwork 채우기를 다룹니다. 텍스트, 분리된 Path 스트로크, 러프 채우기, 와이어프레임/스텐실 그리기, 외부 `FillTexture` 입력은 기존 필터 경로를 유지하며, 아직 이 확장된 지오메트리를 받지 않습니다. WebGPU 렌더링 전체는 따로 검증이 필요합니다.

### 밝기와 대비 {#brightness-contrast}

[CSS filter] 문법을 사용할 수 있습니다. 예를 들어 `filter: brightness(0.4);`입니다.

다음 셰이더는 프리멀티플라이드된 캔버스 전체 경로를 보여 줍니다. [brightnesscontrast.js]를 참고하세요. 도형별 필터는 공통 알파 헬퍼를 사용해 스트레이트 RGBA를 유지합니다.

```glsl
uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_BrightnessContrast;
};

out vec4 outputColor;

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  float brightness = u_BrightnessContrast.x;
  float contrast = u_BrightnessContrast.y;

  if (color.a > 0.0) {
    color.rgb /= color.a;
    color.rgb += brightness;
    if (contrast > 0.0) {
      color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;
    } else {
      color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;
    }
    color.rgb = clamp(color.rgb, 0.0, 1.0) * color.a;
  } else {
    color = vec4(0.0);
  }

  outputColor = color;
}
```

<ImageProcessing />

### 노이즈 {#noise}

후처리의 노이즈는 보통 화면 UV로 의사 난수를 만들어 RGB 위에 겹치며, 필름 그레인이나 신호 간섭 같은 효과를 흉내 냅니다. 이 튜토리얼의 구현은 [glfx.js의 noise 필터][glfx-noise]를 따르며, 균일 난수와 강도 계수 `u_Noise`로 흔들림을 조절합니다. 기록하기 전에 색을 언프리멀티플라이한 뒤 알파를 다시 곱해, 투명 부분에 회색 가장자리가 생기지 않게 합니다.

`filter` 문자열에는 `noise(0.1)`처럼 쓸 수 있습니다. 괄호 안 값은 강도이며 대략 0–1입니다. 디자인 도구에서 출발한다면 [Spline의 Noise Layer][Spline - Noise Layer]와 비교할 수도 있습니다. 그쪽도 절차적 노이즈를 재질과 채우기 위에 쌓지만, 여기서는 이미 래스터화된 텍스처에 전체 화면 패스를 적용합니다.

### 하프톤 {#halftone}

하프톤은 규칙적인 패턴으로 명암을 변조해 인쇄 망점을 흉내 냅니다.

-   **Dot(하프톤 스크린)**: [Pixi `dot.frag`][dot.frag]를 참고하세요. 회전한 좌표에서 `sin(x)·sin(y)`를 샘플링해 흑백 망점을 만듭니다. 그레이스케일과 함께 쓰면 오래된 인쇄물이나 만화 하프톤에 맞습니다. `filter` 예: `dot(1, 5, 1)`(스케일, 각도, 그레이스케일 켜기/끄기).
-   **컬러 하프톤**: [glfx `colorhalftone.js`][colorhalftone.js]를 참고하세요. RGB를 CMY/K 방식으로 다루고, 위상이 다른 네 개의 사인 격자로 시안, 마젠타, 옐로, 블랙을 변조해 컬러 인쇄처럼 보이게 합니다. 줄여 쓰면 `color-halftone(6)`(망점 지름만) 또는 `color-halftone(6, 0.5)`(지름과 라디안 각도)입니다. 네 매개변수 전체 형태로는 패턴 중심과 각도를 지정할 수 있습니다.

```glsl
float halftonePattern(float rotAngle) {
// Continuous sine screen; no dot shape, grain, hex grid, etc.
  float s = sin(rotAngle), c = cos(rotAngle);
  vec2 tex = v_Uv * u_CH1.xy - u_CH0.xy;
  vec2 point = vec2(
    c * tex.x - s * tex.y,
    s * tex.x + c * tex.y
  ) * u_CH0.w;
  return (sin(point.x) * sin(point.y)) * 4.0;
}

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  // ...
  vec3 cmy = 1.0 - color.rgb; // CMYK separation
  float k = min(cmy.x, min(cmy.y, cmy.z));
  // ...
  cmy = clamp(
    cmy * 10.0 - 3.0 + vec3(
      halftonePattern(baseAngle + 0.26179),
      halftonePattern(baseAngle + 1.30899),
      halftonePattern(baseAngle)
    ),
    0.0,
    1.0
  );
  k = clamp(k * 10.0 - 5.0 + halftonePattern(baseAngle + 0.78539), 0.0, 1.0);
  vec3 rgb = 1.0 - cmy - vec3(k);
  // ...
}
```

[Paper Shaders]는 다른 접근을 취합니다. 신문처럼 큰 망점, 명암에 묶인 점 크기, 바꿀 수 있는 점 모양, 육각 격자, 그레인 등을 지원합니다.

<HalftoneDots />

### 픽셀화 {#pixelate}

블록을 샘플링해 키운 모자이크입니다. [Pixi `pixelate.frag`][pixelate.frag]를 참고하세요. 예: `pixelate(12px)`. 노이즈를 겹친 그라디언트에도 적용할 수 있습니다.

<Pixelate />

### CRT와 비네트 {#crt-vignette}

오래된 CRT 화면을 흉내 내고, 비네트를 더합니다.

<CRT />

### 글리치 {#glitch}

-   [CSSGlitchEffect]
-   [unityglitch]

<Glitch />

### 아스키 {#ascii}

먼저 `uSize`로 이미지를 셀로 나누고 그레이스케일을 계산합니다. 회색 단계에 따라 비트맵 상수 `n`을 고른 다음, 셀 안의 각 픽셀에서 `n`의 비트로 밝고 어둠을 정해 색에 곱합니다. 이것은 흔한 비트맵 폰트 / 아스키 아트 방식이며, 벡터 글리프나 텍스처 폰트가 아닙니다.

```glsl
float n = 65536.0;
if (gray > 0.2) n = 65600.0; // .
if (gray > 0.3) n = 332772.0; // :
if (gray > 0.4) n = 15255086.0; // *
if (gray > 0.5) n = 23385164.0; // o
```

<Ascii />

### 리퀴드 글라스 {#liquid-glass}

<LiquidGlass />

### 리퀴드 메탈 {#liquid-metal}

<LiquidMetal />

### 히트맵 {#heatmap}

<Heatmap />

### 연기 생성 {#gen-smoke}

<GenSmoke />

### 시간 애니메이션 {#time-animation}

일부 후처리 효과는 애니메이션할 수 있습니다. 보통 프레임마다 시간 값을 넘기며, Shadertoy의 `u_Time`과 비슷합니다.

```ts
export class PostEffectTime extends System {
    execute() {
        setPostEffectEngineTimeSeconds(perf.now() / 1000);
    }
}
```

[10강 - GIF 내보내기]

## 렌더 그래프 {#render-graph}

렌더 그래프(Render Graph, 때로는 FrameGraph라고도 합니다)는 렌더링 과정을 방향 비순환 그래프(DAG)로 모델링하는 현대적인 렌더링 아키텍처입니다. 이 모델에서 각 렌더링 패스와 그것이 쓰는 리소스는 노드와 간선이 되고, 그래프 구조가 리소스 상태 전환, 동기화, 수명을 자동으로 관리합니다.

-   [FrameGraph: Extensible Rendering Architecture in Frostbite]
-   [Why Talking About Render Graphs]

![프레임 그래프 예](/frame-graph.png)

[Render graph in bevy]에서의 사용법은 다음과 같습니다.

```rs
// @see https://docs.rs/bevy/latest/bevy/render/render_graph/struct.RenderGraph.html
let mut graph = RenderGraph::default();
graph.add_node(Labels::A, MyNode);
graph.add_node(Labels::B, MyNode);
graph.add_node_edge(Labels::B, Labels::A);
```

### 설계 개념 {#design-concept}

[noclip]의 렌더 그래프 구현을 참고합니다. 세 단계로 설계되어 있습니다.

1. 그래프 구축 단계: 렌더링 파이프라인을 선언적으로 정의합니다. 다음 소절에서 사용법을 봅니다.
2. 스케줄링 단계: 리소스를 자동으로 할당하고 재사용합니다. 다시 다음으로 나눌 수 있습니다.

    - 통계 단계: 모든 패스를 순회하며 각 RenderTarget과 ResolveTexture의 참조를 셉니다
    - 할당 단계: 필요할 때 리소스를 할당합니다. 오브젝트 풀에서 가져오거나 처음 쓸 때 만듭니다. 사양이 같은 리소스는 재사용합니다. 참조 횟수가 0이 되면 오브젝트 풀로 되돌립니다.
    - 해제 단계: 참조 횟수가 0이 되면 오브젝트 풀로 되돌립니다.

3. 실행 단계: 렌더링 패스를 순서대로 실행합니다.

렌더 그래프의 자료 구조는 다음과 같습니다. 실제 리소스는 담지 않고, 렌더 그래프의 선언적 설명만 저장합니다. Pass와 Render Target 사이의 ID 관계만 기록합니다.

```ts
class GraphImpl {
    renderTargetDescriptions: Readonly<RGRenderTargetDescription>[] = [];
    resolveTextureRenderTargetIDs: number[] = [];
    passes: RenderGraphPass[] = [];
}
```

### 사용법 {#usage}

다시 그려야 할 때마다 새 RenderGraphBuilder를 만들어 DAG를 구성합니다. 현재 이 단순한 DAG에는 결과를 ColorRT와 DepthRT로 출력하는 메인 렌더링 패스가 있습니다. 이어서 `pushPass`로 패스를 더합니다. ColorRT를 입력으로 소비할 수 있고, 최종적으로 이 ColorRT가 화면에 그려집니다. 주요 렌더링 로직은 `pass.exec`의 콜백에 작성하며, 이 콜백은 `RenderPass` 객체를 받습니다. 자세한 내용은 [2강]를 참고하세요.

```ts
const builder = renderGraph.newGraphBuilder();
builder.pushPass((pass) => {
    pass.setDebugName('Main Render Pass');
    pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);
    pass.attachRenderTargetID(RGAttachmentSlot.DepthStencil, mainDepthTargetID);
    pass.exec((renderPass) => {
        // Render grid
        // Render shapes in current scene
    });
});
builder.resolveRenderTargetToExternalTexture(
    mainColorTargetID,
    onscreenTexture,
);
renderGraph.execute();
```

### FXAA {#fxaa}

이제 메인 렌더 패스 밖에 빠른 안티앨리어싱을 위한 FXAA 패스를 따로 만듭니다. 기하 샘플링에 기반한 MSAA 같은 전통적인 방법과 달리, FXAA는 추가 샘플이나 씬 지오메트리에 대한 지식이 필요 없습니다. 최종 픽셀을 직접 처리하므로 성능 비용이 매우 낮습니다. 이 방법은 NTSC 가중치 `0.299R + 0.587G + 0.114B`로 RGB를 그레이스케일로 바꿔 가장자리를 검출합니다.

```glsl
float MonochromeNTSC(vec3 t_Color) {
  // NTSC primaries.
  return dot(t_Color.rgb, vec3(0.299, 0.587, 0.114));
}
```

렌더 그래프의 선언적 문법으로 돌아갑니다. 먼저 이전 단계의 ColorRT를 가져옵니다.

```ts
builder.pushPass((pass) => {
    pass.setDebugName('FXAA');
    pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);

    const mainColorResolveTextureID =
        builder.resolveRenderTarget(mainColorTargetID);
    pass.attachResolveTexture(mainColorResolveTextureID);

    pass.exec((passRenderer, scope) => {
        postProcessingRenderer.render(
            passRenderer,
            scope.getResolveTextureForID(mainColorResolveTextureID),
        );
    });
});
```

캔버스 전체에 다음 세 가지 후처리 효과를 적용합니다.

```ts
api.setAppState({
    filter: 'fxaa() brightness(0.8) noise(0.1)',
});
```

<GlobalEffects />

## 더 읽어보기 {#extended-reading}

-   [Blob Tracking]
-   [reveals.cool]
-   [Liquid Metal Logo]

[Paper Shaders]: https://shaders.paper.design/
[Pixi.js filters]: https://github.com/pixijs/filters
[CSS filter]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter
[Image Processing]: https://luma.gl/docs/api-reference/shadertools/shader-passes/image-processing
[glfx.js]: https://github.com/evanw/glfx.js
[brightnesscontrast.js]: https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/brightnesscontrast.js
[FrameGraph: Extensible Rendering Architecture in Frostbite]: https://www.gdcvault.com/play/1024612/FrameGraph-Extensible-Rendering-Architecture-in
[Why Talking About Render Graphs]: https://logins.github.io/graphics/2021/05/31/RenderGraphs.html
[Render graph in bevy]: https://github.com/bevyengine/bevy/discussions/2524
[noclip]: https://github.com/magcius/noclip.website
[2강]: /ko/guide/lesson-002
[Spline - Noise Layer]: https://docs.spline.design/materials-shading/noise-layer
[glfx-noise]: https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/noise.js
[dot.frag]: https://github.com/pixijs/filters/blob/main/src/dot/dot.frag
[colorhalftone.js]: https://github.com/evanw/glfx.js/blob/master/src/filters/fun/colorhalftone.js
[pixelate.frag]: https://github.com/pixijs/filters/blob/main/src/pixelate/pixelate.frag
[Blob Tracking]: https://www.shadertoy.com/view/3fBXDD
[Optimizing Triangles for a Full-screen Pass]: https://wallisc.github.io/rendering/2021/04/18/Fullscreen-Pass.html
[CSSGlitchEffect]: https://tympanus.net/Tutorials/CSSGlitchEffect/
[unityglitch]: https://github.com/staffantan/unityglitch/blob/master/GlitchShader.shader
[reveals.cool]: https://reveals.cool/
[Liquid Metal Logo]: https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/liquid-metal.ts
[10강 - GIF 내보내기]: /ko/guide/lesson-010#to-gif
