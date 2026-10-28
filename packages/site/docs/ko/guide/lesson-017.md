---
outline: deep
description: 'CanvasGradient API로 그라디언트와 패턴을 구현하고, 노이즈 효과를 포함한 셰이더로 메시 그라디언트를 만들며, 그라디언트 편집 패널을 구성합니다. CSS 그라디언트 문법과 반복 패턴을 지원합니다.'
head:
    - ['meta', { property: 'og:title', content: '17강 - 그라디언트와 패턴' }]
---

<script setup>
import Gradient from '../../components/Gradient.vue';
import MeshGradient from '../../components/MeshGradient.vue';
import DeclarativeGradient from '../../components/DeclarativeGradient.vue';
import Pattern from '../../components/Pattern.vue';
import Voronoi from '../../components/Voronoi.vue';
import FractalBrownianMotion from '../../components/FractalBrownianMotion.vue';
import DomainWarping from '../../components/DomainWarping.vue';
</script>

# 17강 - 그라디언트와 패턴 {#lesson-17-gradient-and-pattern}

이번 강의에서는 그라디언트와 반복 패턴을 구현하는 방법을 살펴봅니다.

-   CanvasGradient로 그라디언트 구현
    -   명령형. Device API로 텍스처를 만듭니다
    -   선언형. CSS 그라디언트 문법을 지원합니다. `linear-gradient`, `radial-gradient`, `conic-gradient`
    -   Shoelace로 그라디언트 설정 패널을 구현합니다
-   셰이더로 메시 그라디언트 구현
    -   난수 시뮬레이션
    -   값 노이즈와 그라디언트 노이즈
    -   Voronoi, FBM, 도메인 워핑
-   SVG 내보내기
-   CanvasPattern으로 반복 패턴 구현

## CanvasGradient 사용 {#canvas-gradient}

[CanvasGradient] API로 다양한 그라디언트 효과를 만든 다음, 텍스처로 소비할 수 있습니다. 명령형 구현과 선언형 구현을 모두 소개합니다.

### 명령형으로 그라디언트 텍스처 만들기 {#create-gradient-texture}

선형 그라디언트를 예로 들면, `<canvas>`를 만들고 컨텍스트를 얻은 뒤 [createLinearGradient]에는 그라디언트 방향을 정하는 시작점과 끝점이 필요합니다. 그런 다음 여러 색 정지점을 추가하고 `<canvas>`에 그린 뒤, 텍스처를 만들 원본으로 사용합니다.

```ts
const gradient = ctx.createLinearGradient(0, 0, 1, 0); // x1, y1, x2, y2

gradient.addColorStop(0, 'red');
gradient.addColorStop(1, 'blue');

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 256, 1);
```

[Device] API로 텍스처 객체를 만들고, 마지막으로 도형의 `fill` 속성에 전달하면 그리기가 끝납니다.

```ts
// 0. Create gradient data
const ramp = generateColorRamp({
    colors: [
        '#FF4818',
        '#F7B74A',
        '#FFF598',
        '#91EABC',
        '#2EA9A1',
        '#206C7C',
    ].reverse(),
    positions: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
});

// 1. Get canvas device
const device = canvas.getDevice();

// 2. Create texture object
const texture = device.createTexture({
    format: Format.U8_RGBA_NORM,
    width: ramp.width,
    height: ramp.height,
    usage: TextureUsage.SAMPLED,
});
texture.setImageData([ramp.data]); // Pass the previously created <canvas> data to texture

// 3. Pass the texture object to the shape's `fill` property
rect.fill = { texture };
```

<Gradient />

다만 사용성을 높이고 직렬화를 쉽게 하려고, 선언적 문법을 지원하고자 합니다.

### 선언적 CSS 그라디언트 문법 {#css-gradient-syntax}

CSS 그라디언트 문법에 따라 [gradient-parser]로 구조화된 결과를 얻은 다음, [createLinearGradient] 같은 API를 호출하는 데 사용할 수 있습니다.

```ts
rect.fill = 'linear-gradient(0deg, blue, green 40%, red)';
rect.fill = 'radial-gradient(circle at center, red, blue, green 100%)';
```

ECS에서 그라디언트 함수 이름과 방향, 모양, 크기, 위치 키워드는 대소문자를 구분하지 않습니다. 판별은 함수 이름을 확인하므로, `linear`나 `radial`이 들어 있는 이미지 URL은 그라디언트로 취급하지 않습니다. `top center`, `bottom center` 같은 두 키워드 위치는 세로 축을 유지합니다. 원형 방사형 그라디언트는 경계 밖의 중심도 지원합니다. `closest-side`는 가장 가까운 변까지의 거리를 쓰며, 그 거리는 음이 아닌 값으로 남습니다.

파서는 원형 방사형 그라디언트를 지원합니다. 타원형과 반복 그라디언트는 아직 렌더링하지 않습니다. 원뿔형 문자열은 현재 기본 각도와 기존의 `circle at …` 위치 문법을 사용합니다. CSS의 `from … at …` 문법은 구현되어 있지 않습니다. 구조화된 `ConicGradient.angle` 값은 도 단위이며, 일반 채우기와 필터 입력에서 방향이 일치합니다.

파싱 결과는 다음과 같습니다.

```js eval code=false
linearGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient('linear-gradient(0deg, blue, green 40%, red)');
});
```

```js eval code=false
radialGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient(
        'radial-gradient(circle at center, red, blue, green 100%)',
    );
});
```

흔한 그라디언트 유형이 여러 가지 있으며, 현재는 앞의 세 가지를 지원합니다.

-   [linear-gradient] CSS와 Canvas가 지원합니다
-   [radial-gradient] CSS와 Canvas가 지원합니다
-   [conic-gradient] CSS와 Canvas가 지원합니다
-   [repeating-linear-gradient] CSS가 지원합니다. Canvas로도 우회해 구현할 수 있습니다. [How to make a repeating CanvasGradient]를 참고하세요
-   [repeating-radial-gradient] CSS가 지원합니다
-   [sweep-gradient] CanvasKit / Skia에서 지원합니다

<DeclarativeGradient />

또한 여러 그라디언트를 겹치는 것도 지원합니다. 예를 들면 다음과 같습니다.

```ts
rect.fill = `linear-gradient(217deg, rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%),
    linear-gradient(127deg, rgba(0,255,0,.8), rgba(0,255,0,0) 70.71%),
    linear-gradient(336deg, rgba(0,0,255,.8), rgba(0,0,255,0) 70.71%)`;
```

### 그라디언트 편집 패널 {#gradient-editor}

Figma의 그라디언트 편집 패널에서 착안해 비슷한 편집기를 구현했습니다. 위 예제에서 도형을 선택하면 편집 패널을 열 수 있습니다.

![Figma 그라디언트 패널](/figma-gradient-panel.png)

## 채우기와 스트로크에 그라디언트 적용 {#applying-gradients-to-fill-and-stroke}

채우기 그라디언트는 `SDF`와 `Mesh` 같은 드로우 콜이 소비하고, 스트로크 그라디언트는 `SmoothPolyline`이 소비합니다. 그라디언트를 텍스처로 래스터화한 뒤에는, 정점 셰이더에서 UV를 어떻게 계산하는지가 남은 문제입니다.

메시 채우기에서 정점 셰이더는 **`u_FillUVRect`**(`minX`, `minY`, `1/width`, `1/height`)로 **로컬 기하 좌표**를 텍스처 공간에 매핑합니다.

스트로크의 정점 셰이더에는 모델 행렬 이후 **월드 공간**에 놓인 **`pos`**가 이미 있습니다. 스트로크 리본 위로 확장된 점입니다. **`ComputedBounds.geometryBounds`**와 맞추려면 **로컬 공간**으로 되돌린 다음 `min`을 빼고, 범위의 역수를 곱합니다.

`local = inverse(model) * vec3(pos, 1.0)`, 이어서 `v_StrokeUv = (local.xy - u_StrokeUVRect.xy) * u_StrokeUVRect.zw`.

**WebGPU** 경로에서는 GLSL을 **naga**를 거쳐 WGSL로 내릴 때 **`inverse(mat3)`은 지원되지 않으므로**, 구현에서는 직접 작성한 **`inverseMat3`**(수반 행렬 / 행렬식)을 내장 `inverse` 대신 사용합니다.

## 메시로 그라디언트 구현 {#mesh-gradient}

ECS 메시 그라디언트 파서는 명시적인 점 위치를 유지합니다. 선택적인 type, warp, time 제어는 직렬화한 뒤 다시 파싱할 수 있습니다. 점 개수가 가변인 모드에서 `points(10)`은 열 번째 셰이더 슬롯을 유지합니다. 고정 메시 모드(`gtype(2)`)는 계속 3×3 그리드를 사용합니다. 패킹된 유니폼 데이터는 정렬 패딩을 포함해, 96-float 버퍼 안의 92개 float를 사용합니다.

Canvas와 SVG에 기반해 구현한 그라디언트는 표현력이 제한되어 복잡한 효과를 보여줄 수 없습니다. Sketch / Figma 같은 디자인 도구의 커뮤니티에는 Mesh 기반 구현이 많습니다. 예를 들면 다음과 같습니다.

-   [Mesh gradients plugin for Sketch]
-   [Mesh Gradient plugin for Figma]
-   [Photo gradient plugin for Figma]
-   [Noise & Texture plugin for Figma]

일부 오픈 소스 구현을 참고했습니다. 정점 셰이더에서 구현한 것도 있고 프래그먼트 셰이더에서 구현한 것도 있는데, 우리는 후자를 선택했습니다.

-   [meshgradient]
-   [Mesh gradient generator]
-   [react-mesh-gradient]

<MeshGradient />

WebGL1의 GLSL100 문법과 맞추려면 `switch` 사용을 피해야 합니다. 그렇지 않으면 다음과 같은 오류가 납니다.

> [!CAUTION]
> ERROR: 0:78: 'switch' : Illegal use of reserved word

또한 `for` 루프에서는 Uniform을 `index`의 종료 조건으로 사용할 수 없습니다.

> [!CAUTION]
> ERROR: 0:87: 'i' : Loop index cannot be compared with non-constant expression

따라서 Three.js 청크가 광원을 처리하는 방식과 비슷하게, 상수 `MAX_POINTS`로만 루프 반복 횟수를 제한할 수 있습니다.

```glsl
#define MAX_POINTS 10

for (int i = 0; i < MAX_POINTS; i++) {
    if (i < int(u_PointsNum)) {
        // ...
    }
}
```

이제 셰이더의 세부 내용을 살펴보겠습니다. 더 자세한 내용은 [The Book of Shaders - Generative Design]을 참고하세요.

### 난수 {#random}

노이즈 효과를 구현하려면 난수 함수가 필요합니다. 하지만 GLSL에는 내장 `random` 함수가 없으므로, 이 동작을 시뮬레이션해야 합니다. 시뮬레이션이기 때문에 같은 `random(x)`에 대해서는 항상 같은 반환값을 얻습니다. 따라서 의사 난수입니다.

0과 1 사이의 값을 반환하는 `random` 함수를 원한다면 `y = fract(sin(x)*1.0);`를 사용할 수 있습니다. 소수 부분만 남깁니다.

![y = fract(sin(x)*1.0)](https://xiaoiver.github.io/assets/img/resized/480/tbs-rand1.png)

이 함수를 보면, 주기를 극단적으로 짧게 줄이면 같은 x에 대응하는 값을 대략적인 난수(의사 난수)로 볼 수 있습니다. 구체적인 방법은 계수를 키우는 것입니다. 예를 들어 `y = fract(sin(x)*10.0);`입니다.

![y = fract(sin(x)*10.0)](https://xiaoiver.github.io/assets/img/resized/480/tbs-rand2.png)

100000까지 더 키우면 `sin`의 파형을 더 이상 구분할 수 없습니다. 다시 분명히 해 두면, JS의 `Math.random()`과 달리 이 방법은 결정적 난수이며, 그 본질은 사실 해시 함수입니다.

`random` 함수를 2D 장면에 적용해야 합니다. 입력은 하나의 `x`에서 `xy` 좌표로 바뀝니다. 2D 벡터를 하나의 값으로 매핑해야 합니다. The Book of Shaders는 `dot` 내장 함수로 특정 벡터를 곱하지만, 그 이유는 설명하지 않습니다.

```glsl
float random (vec2 st) {
    return fract(sin(
        dot(st.xy,vec2(12.9898,78.233)))*
        43758.5453123);
}
```

온라인에서 검색한 뒤 이 답변을 찾았습니다. [What's the origin of this GLSL rand() one-liner?]. 원래 어떤 논문에서 왔으며, 세 개의 매직 넘버를 고른 이유에 대한 설명은 없다고 합니다. 어쨌든 생성되는 효과는 좋으며, 흑백 TV의 스노우 화면과 비슷합니다. 위 예제에서 `NoiseRatio`를 키우면 이 효과를 볼 수 있습니다.

### 값 노이즈 {#value-noise}

정의한 `random` 함수와 `floor`를 쓰면 계단 형태의 함수를 얻을 수 있습니다.

```glsl
float i = floor(x);
y = random(i);
```

![계단](https://xiaoiver.github.io/assets/img/webgl/tbs-noise1.png)

인접한 "계단" 사이를 보간하려면 선형 함수나 부드러운 보간 함수 `smoothstep`을 사용할 수 있습니다.

```glsl
float i = floor(x);
float f = fract(x);
y = mix(rand(i), rand(i + 1.0), f);
// y = mix(rand(i), rand(i + 1.0), smoothstep(0.,1.,f));
```

![smoothstep](https://xiaoiver.github.io/assets/img/webgl/tbs-noise2.png)

1차원에서는 `i+1`을 골랐고, 2차원에서는 인접한 점 4개를 고를 수 있습니다. 대응하는 혼합 함수도 수정해야 합니다. 원문의 혼합 함수는 전개된 형태라 조금 이해하기 어렵지만, `mix`를 두 번 덜 호출한다는 이점이 있습니다.

```glsl
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = smoothstep(0.,1.,f);

    // Mix 4 coorners percentages
    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;

    // It's actually the expanded form below
    return mix( mix( a, b , u.x),
                mix( c, d, u.x), u.y);
}
```

위의 노이즈 생성 방법은 난수 값 사이를 보간하므로 "값 노이즈"라고 부릅니다. 자세히 보면 이 방법은 뚜렷한 블록 흔적이 있는 결과를 만듭니다. 아래 예제의 왼쪽 부분이 그렇습니다.

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/lsf3WH?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

### 그라디언트 노이즈 {#gradient-noise}

> 1985년 Ken Perlin은 Gradient Noise라는 또 다른 노이즈 알고리즘을 개발했습니다. Ken은 고정된 값 대신 무작위 그라디언트(기울기, 그라데이션)를 끼워 넣는 방법을 해결했습니다. 이 그라디언트 값은 2차원 난수 함수에서 나오며, 그 함수는 하나의 값(float 형식)이 아니라 방향(vec2 형식의 벡터)을 반환합니다.

구체적인 알고리즘은 다음과 같으며, 값 노이즈와 가장 큰 차이는 `dot`으로 네 방향을 보간한다는 점입니다.

```glsl
float noise( in vec2 st ) {
    vec2 i = floor(st);
    vec2 f = fract(st);

 vec2 u = smoothstep(0., 1., f);

    return mix( mix( dot( random( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ),
                     dot( random( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                mix( dot( random( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ),
                     dot( random( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
}
```

> Ken Perlin에게 이 알고리즘의 성공은 결코 충분하지 않았습니다. 더 나아질 수 있다고 느꼈습니다. 2001년 Siggraph에서 그는 "simplex noise"를 선보였습니다.

구체적인 구현은 [2d-snoise-clear]에서 볼 수 있으며, 3D 버전도 있습니다.

### 보로노이 노이즈 {#voronoi-noise}

"패턴 그리기" 절에서 공간을 작은 격자 영역으로 나누는 방법을 이미 배웠습니다. 각 격자에 무작위 특징점을 생성할 수 있고, 어떤 격자 안의 프래그먼트에 대해서는 인접한 8개 격자 안 특징점까지의 최소 거리만 계산하면 되므로 계산량이 크게 줄어듭니다. 이것이 Steven Worley 논문의 주요 아이디어입니다.

무작위 특징점은 앞에서 배운 `random` 방법을 사용합니다. 결정적 난수이므로 각 격자 안의 특징점은 고정됩니다.

```glsl
// Divide the grid
vec2 i_st = floor(st);
vec2 f_st = fract(st);
float m_dist = 1.;
// 8 directions
for (int y= -1; y <= 1; y++) {
    for (int x= -1; x <= 1; x++) {
        // Current adjacent grid
        vec2 neighbor = vec2(float(x),float(y));
        // Feature point in adjacent grid
        vec2 point = random2(i_st + neighbor);
        // Distance from fragment to feature point
        vec2 diff = neighbor + point - f_st;
        float dist = length(diff);
        // Save the minimum value
        m_dist = min(m_dist, dist);
    }
}
color += m_dist;
```

<Voronoi />

이 아이디어에 기반한 voronoi 노이즈 구현은 [lygia/generative]에서 볼 수 있습니다.

### fBM {#fbm}

[Inigo Quilez's fBM]을 참고하세요. `noise`는 값 노이즈나 그라디언트 노이즈일 수 있습니다.

> 주파수는 점점 높아지고 진폭은 점점 줄어드는 노이즈 파를 단순히 합한 표준 fBM(Fractional Brownian Motion, 프랙탈 브라운 운동)을 사용합니다.

원문은 `gain = 0.5`를 쓰는 이유도 자세히 설명하며, 이는 `H = 1`에 대응합니다. `H`는 곡선의 "자기 유사성"을 나타내며, 절차적 생성에서 구름, 산, 바다 같은 자연 형태를 시뮬레이션하는 데 쓰입니다.

$$ G=2^{-H} $$

```glsl
const int octaves = 6;
float lacunarity = 2.0;
float gain = 0.5;

float amplitude = 0.5;
float frequency = 1.;

for (int i = 0; i < octaves; i++) {
 y += amplitude * noise(frequency*x);
 frequency *= lacunarity;
 amplitude *= gain;
}
```

<FractalBrownianMotion />

[Inigo Quilez's Domain Warping]과 [Mike Bostock's Domain Warping]을 참고하세요. `fbm`을 재귀적으로 호출합니다.

```glsl
f(p) = fbm( p )
f(p) = fbm( p + fbm( p ) )
f(p) = fbm( p + fbm( p + fbm( p )) )
```

<DomainWarping />

## 패턴 구현 {#pattern}

Canvas API의 [createPattern]으로 패턴을 만들 수 있으며, 다음 문법을 지원합니다.

```ts
export interface Pattern {
    image: string | CanvasImageSource;
    repetition?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
    transform?: string;
}

rect.fill = {
    image,
    repetition: 'repeat',
};
```

문자열로 된 `transform`은 `mat3`으로 파싱한 다음 [setTransform]에 전달해야 합니다.

<Pattern />

## 그라디언트를 SVG로 내보내기 {#export-gradient-to-svg}

### 선형 그라디언트 {#linear-gradient}

SVG는 [linearGradient]와 [radialGradient]를 제공하지만, 지원하는 속성은 [CanvasGradient]와 상당히 다릅니다.

### 원뿔 그라디언트 {#conic-gradient}

[SVG angular gradient]를 참고하면 근사 구현을 할 수 있습니다. [CSS conic-gradient() polyfill]의 접근은 Canvas로 렌더링한 뒤 dataURL로 내보내고, `<image>`로 참조하는 것입니다.

### 여러 그라디언트 겹치기 {#multiple-gradient-overlay}

여러 그라디언트를 겹칠 때 Canvas API에서는 `fillStyle`을 여러 번 설정해 겹칠 수 있습니다. 선언적 SVG에서는 `<feBlend>`를 여러 개 사용해 같은 결과를 얻습니다.

## 더 읽어보기 {#extended-reading}

-   [A flowing WebGL gradient, deconstructed]
-   [Static Mesh Gradient]

[CanvasGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasGradient
[Device]: /reference/canvas#getdevice
[linear-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient
[radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/radial-gradient
[repeating-linear-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-linear-gradient
[repeating-radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-radial-gradient
[conic-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/conic-gradient
[sweep-gradient]: https://stackoverflow.com/questions/44912075/sweep-gradient-what-it-is-and-its-examples
[gradient-parser]: https://github.com/rafaelcaricio/gradient-parser
[Mesh gradients plugin for Sketch]: https://www.meshgradients.com/
[Mesh Gradient plugin for Figma]: https://www.figma.com/community/plugin/958202093377483021/mesh-gradient
[Photo gradient plugin for Figma]: https://www.figma.com/community/plugin/1438020299097238961/photo-gradient
[Noise & Texture plugin for Figma]: https://www.figma.com/community/plugin/1138854718618193875
[meshgradient]: https://meshgradient.com/
[Mesh gradient generator]: https://kevingrajeda.github.io/meshGradient/
[react-mesh-gradient]: https://github.com/JohnnyLeek1/React-Mesh-Gradient
[Inigo Quilez's fBM]: https://iquilezles.org/articles/fbm/
[Inigo Quilez's Domain Warping]: https://iquilezles.org/articles/warp/
[Mike Bostock's Domain Warping]: https://observablehq.com/@mbostock/domain-warping
[linearGradient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/linearGradient
[radialGradient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/radialGradient
[createLinearGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient
[SVG angular gradient]: https://stackoverflow.com/questions/2465405/svg-angular-gradient
[How to make a repeating CanvasGradient]: https://stackoverflow.com/questions/56398519/how-to-make-a-repeating-canvasgradient
[CSS conic-gradient() polyfill]: https://projects.verou.me/conic-gradient/
[createPattern]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createPattern
[setTransform]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasPattern/setTransform
[What's the origin of this GLSL rand() one-liner?]: https://stackoverflow.com/questions/12964279/whats-the-origin-of-this-glsl-rand-one-liner
[The Book of Shaders - Generative Design]: https://thebookofshaders.com/10/
[2d-snoise-clear]: https://thebookofshaders.com/edit.php#11/2d-snoise-clear.frag
[lygia/generative]: https://lygia.xyz/generative
[A flowing WebGL gradient, deconstructed]: https://alexharri.com/blog/webgl-gradients
[Static Mesh Gradient]: https://shaders.paper.design/static-mesh-gradient
