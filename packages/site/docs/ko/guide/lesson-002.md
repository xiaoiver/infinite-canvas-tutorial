---
outline: deep
description: 'SDF(Signed Distance Field)를 이용해 캔버스에 원을 그리는 방법을 학습합니다. 안티앨리어싱 기법과 성능 최적화를 위한 더티 플래그(Dirty flag) 디자인 패턴의 설계 및 구현 과정을 다룹니다.'
head:
    - ['meta', { property: 'og:title', content: '2강 - 원 그리기' }]
---
# 2강 - 원 그리기

이번 강의에서는 다음 내용을 중점적으로 다룹니다.

-   캔버스에 도형 추가하기
-   SDF를 이용한 원 그리기
-   안티앨리어싱(Anti-Aliasing) 적용
-   더티 플래그(Dirty flag) 디자인 패턴의 활용

구현을 마치면 캔버스에 원을 그리고, 속성을 변경하거나 렌더러를 전환하며 실시간으로 결과를 확인할 수 있습니다.

```js eval code=false
width = Inputs.range([50, 300], { label: 'width', value: 100, step: 1 });
```

```js eval code=false
height = Inputs.range([50, 300], { label: 'height', value: 100, step: 1 });
```

```js eval code=false
renderer = Inputs.select(['webgl', 'webgpu'], { label: 'renderer' });
```

```js eval code=false inspector=false
canvas = (async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 100, 100, renderer);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 3,
    });
    canvas.appendChild(circle);

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

```js eval code=false inspector=false
call(() => {
    Utils.resizeCanvas(canvas, width, height);
});
```

```js eval code=false
call(() => {
    return canvas.getDOM();
});
```

## 캔버스에 도형 추가하기 {#adding-shapes-to-canvas}

지난 강의에서 우리는 빈 캔버스를 만들었고, 이제 여기에 다양한 그래픽을 추가할 것입니다. 이러한 API를 어떻게 설계할까요? 프런트엔드 개발자라면 익숙한 [Node API appendChild]를 참고하고 싶을 것입니다.

```ts
canvas.appendChild(shape);
canvas.removeChild(shape);
```

임시로 그래픽 기본 클래스를 생성하며, 이는 Circle, Ellipse, Rect 등에 의해 상속됩니다.

```ts
export abstract class Shape {}
```

캔버스에서 도형 목록을 저장하기 위해 배열을 사용합니다.

```ts
#shapes: Shape[] = [];

appendChild(shape: Shape) {
  this.#shapes.push(shape);
}

removeChild(shape: Shape) {
  const index = this.#shapes.indexOf(shape);
  if (index !== -1) {
    this.#shapes.splice(index, 1);
  }
}
```

캔버스 render 메서드에서 도형 목록을 순회하며 render 훅을 호출합니다.

```ts{4}
render() {
  const { hooks } = this.#pluginContext;
  hooks.beginFrame.call();
  this.#shapes.forEach((shape) => {
    hooks.render.call(shape);
  });
  hooks.endFrame.call();
}
```

렌더링 플러그인에서는 매 프레임 시작 시 하드웨어 추상화 레이어로 캡슐화된 `RenderPass`를 생성합니다. WebGL에는 없는 개념이지만, WebGPU의 [beginRenderPass]는 나중에 `render` 훅에서 볼 수 있는 `draw` 명령을 포함한 일련의 명령을 기록하는 [GPURenderPassEncoder]를 반환합니다. `RenderPass` 생성 시 다음과 같은 파라미터를 제공합니다.

-   `colorAttachment`
-   `colorResolveTo`
-   `colorClearColor` 이것은 WebGL에서 [gl.clearColor] 명령으로 구현되며, WebGPU에서는 [clearValue] 속성으로 선언되고 여기서는 흰색으로 설정합니다.

```ts{4}
hooks.beginFrame.tap(() => {
  this.#device.beginFrame();

  this.#renderPass = this.#device.createRenderPass({
    colorAttachment: [renderTarget],
    colorResolveTo: [onscreenTexture],
    colorClearColor: [TransparentWhite],
  });
});
```

생성에 대응하여 각 프레임이 끝날 때 `RenderPass`를 제출합니다. 다시 한 번 WebGPU에서 해당 [submit] 메서드를 쉽게 찾을 수 있지만, 물론 네이티브 API는 인코딩된 명령 버퍼를 제출하고 하드웨어 추상화 레이어는 이러한 개념을 단순화합니다.

```ts{2}
hooks.endFrame.tap(() => {
  this.#device.submitPass(this.#renderPass);
  this.#device.endFrame();
});
```

마지막으로 `render` 훅에 도달합니다. 여기서 각 그래프는 자신을 그리는 로직을 구현하는 역할을 하며, 플러그인은 Device와 `RenderPass`와 같은 필요한 GPU 객체를 전달하는 역할을 합니다.

```ts
hooks.render.tap((shape) => {});
```

## 원 그리기 {#draw-a-circle}

가장 먼저 해야 할 일은 원의 기본 속성을 정의하는 것입니다. SVG [circle]에 익숙한 분들은 중심 `cx/cy`와 반지름 `r`을 기반으로 원의 기하학적 형태를 정의할 수 있으며, `fill`과 `stroke`의 일반적인 그리기 속성을 사용하여 기본 요구 사항을 충족할 수 있다는 것을 알 것입니다.

```ts
export class Circle extends Shape {
    constructor(
        config: Partial<{
            cx: number;
            cy: number;
            r: number;
            fill: string;
        }> = {},
    ) {}
}
```

### 캔버스 좌표계 {#canvas-coordinates}

`cx/cy` 원의 중심과 같은 위치 속성에 대해 이야기하고 있으므로 우리가 사용하는 캔버스 좌표계를 명확히 하는 것이 중요합니다. Canvas와 SVG 모두에서 좌표계의 원점은 왼쪽 상단 모서리에 있으며, X축은 양의 방향 👉, Y축은 양의 방향 👇입니다. 그러나 WebGL에서 사용되는 [클리핑 좌표계]는 OpenGL 사양을 따르며, 원점은 뷰포트의 중심에 있고 X축은 👉을 가리키고, Y축은 👆을 가리키며, Z축은 화면 안쪽을 향합니다. 아래 큐브는 가로 세로 비율이 2이며, normalized device coordinates (NDC)로도 알려져 있습니다.

![clip space](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection/clip_space_graph.svg)

그러나 WebGPU는 Metal 사양을 따르며, WebGL과 다른 점은 Y축이 앞으로 👇이고 Z축이 바깥쪽으로 앞으로 향한다는 것입니다. Z축의 클리핑 범위도 차이가 있는데, WebGL에서는 `[-1, 1]`이고 WebGPU에서는 `[0, 1]`입니다.

![Z clip space ranges in WebGL and WebGPU](/clip-space-z-range.png)

우리의 하드웨어 추상화 레이어는 WebGL과 WebGPU 간의 차이를 원활하게 처리하려고 하지만 좌표계 측면에서는 Canvas / SVG와 정렬하기로 선택했으며, 이것이 보드 사용자가 익숙한 것과 더 일치한다고 생각합니다.

![canvas default grid](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_shapes/canvas_default_grid.png)

따라서 너비와 높이가 200인 캔버스가 있다면, 다음과 같이 추가된 `Circle`은 캔버스 중앙에 나타납니다.

```ts
const circle = new Circle({
    cx: 100,
    cy: 100,
    r: 50,
    fill: 'red',
});
canvas.appendChild(circle);
```

다음 질문은 화면 좌표계의 `cx/cy`를 렌더 파이프라인을 위한 NDC로 어떻게 변환하는가입니다. 캔버스의 너비와 높이를 Uniform으로 전달하고 원의 위치를 Attribute로 전달할 것입니다. 위치를 너비와 높이로 나누면 `[0, 1]` 범위의 값을 얻게 되며, 이를 2배하고 1을 빼면 NDC에서의 값 범위인 `[-1, 1]`로 변환됩니다. 마지막으로 Y축을 아래로 뒤집습니다.

```glsl
layout(std140) uniform SceneUniforms {
  vec2 u_Resolution; // width & height of canvas
};
layout(location = 1) in vec2 a_Position; // cx & cy

// Pixel space to [0, 1] (Screen space)
vec2 zeroToOne = (a_Position + a_Size * a_FragCoord) / u_Resolution;

// Convert from [0, 1] to [0, 2]
vec2 zeroToTwo = zeroToOne * 2.0;

// Convert from [0, 2] to [-1, 1] (NDC/clip space)
vec2 clipSpace = zeroToTwo - 1.0;

// Flip Y axis
gl_Position = vec4(clipSpace * vec2(1, -1), 0.0, 1.0);
```

### 색상 값 처리 {#processing-color-values}

Canvas나 SVG와 달리 문자열 형태의 색상 값은 WebGL이나 WebGPU에서 직접 사용할 수 없지만, [d3-color]는 `{ r, g, b, opacity }` 형식으로 변환할 수 있으며, 이후 `vec4`로 `attribute`에 직접 전달하거나 압축할 수 있습니다. 마지막으로 현재는 RGB 공간 색상 값만 지원하며, 이는 [hsl]과 [oklch]를 사용할 수 없음을 의미합니다.

```ts
import * as d3 from 'd3-color';

set fill(fill: string) {
  this.#fill = fill;
  this.#fillRGB = d3.rgb(fill); // { r, g, b, opacity }
}
```

스타일 문제는 제쳐두고 기하학으로 돌아가 보겠습니다. Triangle Mesh는 3D 렌더링에서 기하학의 일반적인 표현이며, Three.js의 [CircleGeometry]는 중심에서 원을 삼각형으로 분할하여 절차적으로 기하학을 생성합니다. 분명히 삼각형이 많을수록 원이 더 부드러워지며, 삼각형이 두 개만 있으면 정사각형으로 퇴화합니다. 부드러운 원을 얻기 위해서는 더 많은 정점이 필요하며, 이는 원의 개수가 증가함에 따라 GPU 메모리가 상당히 증가하는 원인이 됩니다.

![Circle Geometry in Three.js](/circle-geometry.png)

### SDF (Signed Distance Field) {#sdf}

Signed Distance Functions(SDF)라는 방법을 사용하면 단 4개의 정점만 필요합니다. 다음 다이어그램은 신흥 에디터 Zed의 실습 문서 [drawing-rectangles]에서 가져온 SDF의 개념을 시각화한 것입니다. 평면 위의 한 점은 반지름 100인 원에서 원 위에 있으면 거리가 0이고, 원 내부와 외부에서는 각각 음수와 양수 값을 가집니다.

![SDF Circle](/sdf.svg)

> 원본 문서는 Lottie 애니메이션을 사용하여 방향 거리 필드의 정의와 기본 그래프의 일부 공식 도출을 보여줍니다. Zed의 GPUI에서도 더 나은 성능을 위해 SDF를 사용하여 기본 그래프를 그립니다.

일반적으로 Vertex Shader에서 좌표계를 구성합니다.

```glsl
layout(location = 0) in vec2 a_FragCoord;
out vec2 v_FragCoord;
void main() {
  v_FragCoord = a_FragCoord;
}
```

거리 정보가 있으면 Fragment Shader에서 다양한 그래픽의 SDF 공식을 사용하여 현재 픽셀의 좌표를 가져와 해당 점이 그래픽 내부에 있는지 판단할 수 있습니다. 외부에 있으면 직접 버릴 수 있고, 그렇지 않으면 색상을 입히게 됩니다. GLSL 코드는 다음과 같습니다. 일부 효과는 부분 투명도를 신경 쓰지 않고, 텍스처의 색상 값을 기반으로 무언가를 표시하거나 아무것도 표시하지 않으려고 합니다. [Discarding fragments]를 참조하세요.

```glsl
float sdf_circle(vec2 p, float r) {
  return length(p) - r;
}

void main() {
  float distance = sdf_circle(v_FragCoord, 1.0);
  if (distance > 0.0) {
    discard;
  }
  outputColor = vec4(1.0, 0.0, 0.0, 1.0);
}
```

더 적은 정점을 사용하는 것 외에도 SDF는 다음과 같은 이점을 제공합니다.

-   쉬운 안티앨리어싱. 다음 하위 섹션에서 다룰 예정입니다.
-   쉬운 결합. 교차와 차이 연산을 결합하여 복잡한 그래프를 완성할 수 있습니다.
-   복잡해 보이는 일부 효과를 쉽게 구현할 수 있습니다. 예를 들어 스트로크, 둥근 모서리, 그림자 등이 있으며, 물론 이러한 효과를 구현할 때 이 방법의 일부 제한 사항도 소개할 것입니다.

SDF에 대한 설명과 자세한 도출도 [distfunctions]에서 찾을 수 있습니다. 이 방법은 다양한 일반적인 2D 및 심지어 3D 도형을 그리는 데 사용할 수 있으며, 우리는 계속해서 사각형과 텍스트를 그리는 데 사용할 것입니다.

그래픽 기본 클래스로 돌아가서 그리는 데 필요한 매개변수를 받는 메서드를 추가합니다.

```ts{2}
export abstract class Shape {
  abstract render(device: Device, renderPass: RenderPass): void;
}
```

플러그인의 `render` 훅에서 호출하고 필요한 매개변수를 전달합니다.

```ts
hooks.render.tap((shape) => {
    shape.render(this.#device, this.#renderPass);
});
```

`Circle`의 `render` 메서드에서 클립 공간과 일치하는 유닛 좌표계를 구성합니다. 4개의 정점을 포함하고 `indexBuffer` 인덱스 배열을 통해 2개의 삼각형(V0 -> V1 -> V2 및 V0 -> V2 -> V3)으로 분할됩니다.

<img alt="unit circle" src="/unit-circle.png" width="300" />

```ts
this.#fragUnitBuffer = device.createBuffer({
    viewOrSize: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]),
    usage: BufferUsage.VERTEX,
});

this.#indexBuffer = device.createBuffer({
    viewOrSize: new Uint32Array([0, 1, 2, 0, 2, 3]),
    usage: BufferUsage.INDEX,
});
```

이 4개의 정점 각각은 원의 중심, 반지름, 채우기 색상과 같은 동일한 스타일 속성을 공유할 수 있습니다. 이렇게 하면 정점 배열 메모리 크기가 줄어듭니다.

```ts
this.#instancedBuffer = device.createBuffer({
    viewOrSize: new Float32Array([
        this.#cx,
        this.#cy,
        this.#r,
        this.#r,
        this.#fillRGB.r / 255,
        this.#fillRGB.g / 255,
        this.#fillRGB.b / 255,
        this.#fillRGB.opacity,
    ]),
    usage: BufferUsage.VERTEX,
});
```

다음으로 정점 배열이 어떻게 배치되어야 하는지 지정하고, `shaderLocation`을 통해 셰이더와 연결합니다.

```ts
this.#inputLayout = device.createInputLayout({
    vertexBufferDescriptors: [
        {
            arrayStride: 4 * 2,
            stepMode: VertexStepMode.VERTEX,
            attributes: [
                {
                    shaderLocation: 0, // layout(location = 0) in vec2 a_FragCoord;
                    offset: 0,
                    format: Format.F32_RG,
                },
            ],
        },
        {
            arrayStride: 4 * 8,
            stepMode: VertexStepMode.INSTANCE,
            attributes: [
                {
                    shaderLocation: 1, // layout(location = 1) in vec2 a_Position;
                    offset: 0,
                    format: Format.F32_RG,
                },
                {
                    shaderLocation: 2, // layout(location = 2) in vec2 a_Size;
                    offset: 4 * 2,
                    format: Format.F32_RG,
                },
                {
                    shaderLocation: 3, // layout(location = 3) in vec4 a_FillColor;
                    offset: 4 * 4,
                    format: Format.F32_RGBA,
                },
            ],
        },
    ],
    indexBufferFormat: Format.U32_R,
    program: this.#program,
});
```

SDF는 타원, 사각형, 텍스트 등을 그리는 데도 사용할 수 있지만, 지금은 다른 도형을 추가하지 않고 먼저 다른 문제에 집중하겠습니다.

## 안티앨리어싱 {#antialiasing}

자세히 보거나 확대하면 가장자리가 명확하게 들쭉날쭉한 것을 볼 수 있습니다. 결국 Fragment Shader에서 우리는 각 픽셀 포인트에 대해 무차별 대입 결정을 사용합니다: 색상을 칠하거나 버리며, 그 사이에 전환이 없습니다.

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
    });
    canvas.appendChild(circle);

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
    return canvas.getDOM();
})();
```

[Smooth SDF Shape Edges] 문헌을 참고하여 몇 가지 접근 방식을 비교해 보겠습니다.

### Smoothstep 활용 {#smoothstep}

가장 먼저 떠오르는 것은 GLSL / WGSL의 내장 함수 `smoothstep`으로 부드럽게 만들 수 있다는 것입니다. 이는 `step` 함수와 비교하여 `ease-in/out` 이징 함수의 효과와 유사하게 지정된 값 범위에 대해 부드러운 값을 생성합니다. [Smoothstep - thebookofshaders.com]에서 매개변수를 수정하여 모양을 시각화할 수 있습니다. 예를 들어 다음 그림에서 x가 `0`보다 크면 y는 1이고, x가 `-0.5`보다 작으면 y는 0이며, 그 사이의 영역은 부드럽게 처리됩니다.

<img alt="smoothstep" src="/smoothstep.png" width="300" />

이전 섹션에서 계산된 SDF 거리는 음수 값이며, 가장자리의 더 작은 거리 범위를 부드럽게 할 수 있도록 고정된 더 작은 값 `0.01`을 선택합니다. 처리된 값은 투명도로 다룰 수 있습니다.

```glsl
float alpha = smoothstep(0.0, 0.01, -distance);

outputColor = v_FillColor;
outputColor.a *= alpha;
```

효과는 다음과 같습니다.

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 1,
    });
    canvas.appendChild(circle);

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
    return canvas.getDOM();
})();
```

이 방법의 문제는 원의 반지름이 약간 증가한다는 것입니다. 결국 1퍼센트 더 많습니다. 또한 확대할 때 (나중에 카메라 관련 기능에 대해 자세히 설명합니다) 가장자리가 충분히 날카롭지 않습니다.

### 고정 값으로 나누기 {#divide-fixed}

`saturate` 함수는 GLSL에서 사용할 수 없으며 `clamp`를 사용하여 구현할 수 있습니다.

```glsl
float alpha = clamp(-distance / 0.01, 0.0, 1.0);
```

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 2,
    });
    canvas.appendChild(circle);

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
    return canvas.getDOM();
})();
```

### 화면 공간 미분 (Screen space derivatives) {#screen-space-derivatives}

거리 기반 안티앨리어싱에 `fwidth`를 사용하는 것은 [Using fwidth for distance based anti-aliasing]에 설명되어 있습니다. `fwidth`는 무엇일까요?

[What are screen space derivatives and when would I use them?]와 [What is fwidth and how does it work?]는 이 방법의 개념과 계산을 자세히 설명합니다. 간단히 말하면 Fragment Shader는 단일 픽셀 포인트가 아닌 한 번에 2x2 쿼드를 처리합니다. GPU가 이렇게 하는 이유는 [A trip through the Graphics Pipeline 2011, part 8]에서 다음과 같이 설명합니다.

> Also, this is a good point to explain why we're dealing with quads of 2×2 pixels and not individual pixels. The big reason is derivatives. Texture samplers depend on screen-space derivatives of texture coordinates to do their mip-map selection and filtering (as we saw back in part 4); and, as of shader model 3.0 and later, the same machinery is directly available to pixel shaders in the form of derivative instructions.

각 2x2 쿼드에서 편미분이 어떻게 계산되는지 살펴보겠습니다. 예를 들어 uv의 경우:

![uv fwidth](https://pic2.zhimg.com/80/v2-0f2d0605965ab352aec8826d0eed02dd_1440w.webp)

개발자가 주어진 값에 대해 픽셀이 얼마나 크게 변경되었는지 쉽게 이해할 수 있도록 OpenGL / WebGL과 WebGPU 모두 다음 방법을 제공합니다. 그러나 WebGL1은 `GL_OES_standard_derivatives` 확장을 활성화해야 하지만 WebGL2와 WebGPU는 그렇지 않습니다.

-   `dFdx` 화면의 수평 방향에서 1픽셀 범위에 걸쳐 매개변수 속성 값이 얼마나 변경되었는지 계산합니다.
-   `dFdy` 화면의 수직 방향에서 1픽셀 범위에 걸쳐 매개변수 속성 값이 얼마나 변경되었는지 계산합니다.
-   `fwidth`는 `abs(dFdx) + abs(dFdy)`를 계산합니다.

따라서 픽셀 내에서 매개변수가 얼마나 변경되는지 계산하는 두 가지 방법이 있습니다. 둘 사이에 차이가 있을까요?

```glsl
pixelSize = fwidth(dist);
/* or */
pixelSize = length(vec2(dFdx(dist), dFdy(dist)));
```

[AAA - Analytical Anti-Aliasing]는 `fwidth`가 `length`에 비해 오버헤드가 적다고 지적하며, 대각선 방향에 약간의 편차가 있지만 우리 시나리오에서는 거의 무시할 만합니다.

> Fast LAA has a slight bias in the diagonal directions, making circular shapes appear ever so slightly rhombous and have a slightly sharper curvature in the orthogonal directions, especially when small. Sometimes the edges in the diagonals are slightly fuzzy as well.

SDF 계산에서 거리를 전달하고 투명도에 반영하기 위해 얼마나 변경되었는지 계산합니다.

```glsl
float alpha = clamp(-distance / fwidth(-distance), 0.0, 1.0);
```

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 3,
    });
    canvas.appendChild(circle);

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
    return canvas.getDOM();
})();
```

## 더티 플래그 {#dirty-flag}

이전에 우리는 채우기 색상과 원의 중심과 같은 스타일 속성을 정점 배열에 작성했으므로, 색상을 수정하고 싶을 때 Buffer의 데이터도 다시 수정해야 합니다. 아래 예제의 연속 수정 시나리오에서는 속성이 수정될 때마다 즉시 기본 API를 호출하면 많은 불필요한 오버헤드가 발생합니다.

```ts
circle.fill = 'blue';
circle.fill = 'yellow';
circle.cx = 500;
```

우리는 데이터 수정과 같은 시간이 많이 걸리는 작업을 연기하고 렌더링 전과 같이 적절한 시간에 병합하기를 원합니다. "더티 플래그"라는 일반적인 디자인 패턴을 적용함으로써: [Dirty Flag - Game Programming Patterns]. 속성을 수정할 때 우리는 단순히 더티 플래그를 설정하고 다른 시간이 많이 걸리는 작업은 수행하지 않습니다.

```ts{4}
set cx(cx: number) {
  if (this.#cx !== cx) {
    this.#cx = cx;
    this.renderDirtyFlag = true;
  }
}
```

`render` 메서드에서 기본 버퍼는 속성 수정이 감지된 경우에만 업데이트되므로, 렌더링 사이에 속성 수정이 몇 번 발생하든 상관없이 버퍼는 한 번만 업데이트됩니다.

```ts
if (this.renderDirtyFlag) {
    this.#instancedBuffer.setSubData(
        0,
        new Uint8Array(
            new Float32Array([
                this.#cx,
                this.#cy,
                this.#r,
                this.#r,
                this.#fillRGB.r / 255,
                this.#fillRGB.g / 255,
                this.#fillRGB.b / 255,
                this.#fillRGB.opacity,
            ]).buffer,
        ),
    );
}
```

물론 렌더링이 완료되면 더티 플래그를 재설정하는 것을 잊지 마세요.

```ts
this.renderDirtyFlag = false;
```

효과를 시도해 보세요.

```js eval code=false
cx2 = Inputs.range([50, 300], { label: 'cx', value: 100, step: 1 });
```

```js eval code=false
cy2 = Inputs.range([50, 300], { label: 'cy', value: 100, step: 1 });
```

```js eval code=false
r2 = Inputs.range([50, 300], { label: 'r', value: 100, step: 1 });
```

```js eval code=false
fill2 = Inputs.color({ label: 'fill', value: '#ff0000' });
```

```js eval code=false inspector=false
circle = (() => {
    const { Circle } = Lesson2;
    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 3,
    });
    return circle;
})();
```

```js eval code=false inspector=false
(() => {
    circle.cx = cx2;
    circle.cy = cy2;
    circle.r = r2;
    circle.fill = fill2;
})();
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    canvas.appendChild(circle);

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
    return canvas.getDOM();
})();
```

이후의 씬 그래프 소개에서도 더티 플래그를 적용할 것입니다.

## 더 읽어보기 {#extended-reading}

-   [distfunctions]
-   [Leveraging Rust and the GPU to render user interfaces at 120 FPS]
-   [Sub-pixel Distance Transform - High quality font rendering for WebGPU]
-   [AAA - Analytical Anti-Aliasing]
-   [Learn Shader Programming with Rick and Morty]

[Node API appendChild]: https://developer.mozilla.org/ko/docs/Web/API/Node/appendChild
[GPURenderPassEncoder]: https://developer.mozilla.org/ko/docs/Web/API/GPURenderPassEncoder
[beginRenderPass]: https://developer.mozilla.org/ko/docs/Web/API/GPUCommandEncoder/beginRenderPass
[submit]: https://developer.mozilla.org/ko/docs/Web/API/GPUQueue/submit
[circle]: https://developer.mozilla.org/ko/docs/Web/SVG/Element/circle
[d3-color]: https://github.com/d3/d3-color
[hsl]: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl
[CircleGeometry]: https://threejs.org/docs/#api/en/geometries/CircleGeometry
[drawing-rectangles]: https://zed.dev/blog/videogame#drawing-rectangles
[distfunctions]: https://iquilezles.org/articles/distfunctions/
[Leveraging Rust and the GPU to render user interfaces at 120 FPS]: https://zed.dev/blog/videogame
[gl.clearColor]: https://developer.mozilla.org/ko/docs/Web/API/WebGLRenderingContext/clearColor
[clearValue]: https://www.w3.org/TR/webgpu/#dom-gpurenderpasscolorattachment-clearvalue
[Using fwidth for distance based anti-aliasing]: http://www.numb3r23.net/2015/08/17/using-fwidth-for-distance-based-anti-aliasing/
[What is fwidth and how does it work?]: https://computergraphics.stackexchange.com/a/63
[What are screen space derivatives and when would I use them?]: https://gamedev.stackexchange.com/questions/130888/what-are-screen-space-derivatives-and-when-would-i-use-them
[Smoothstep - thebookofshaders.com]: https://thebookofshaders.com/glossary/?search=smoothstep
[Smooth SDF Shape Edges]: https://bohdon.com/docs/smooth-sdf-shape-edges/
[Sub-pixel Distance Transform - High quality font rendering for WebGPU]: https://acko.net/blog/subpixel-distance-transform/
[A trip through the Graphics Pipeline 2011, part 8]: https://fgiesen.wordpress.com/2011/07/10/a-trip-through-the-graphics-pipeline-2011-part-8/
[Discarding fragments]: https://learnopengl.com/Advanced-OpenGL/Blending
[AAA - Analytical Anti-Aliasing]: https://blog.frost.kiwi/analytical-anti-aliasing
[Learn Shader Programming with Rick and Morty]: https://danielchasehooper.com/posts/code-animated-rick/
[oklch]: https://github.com/d3/d3-color/issues/87
[Dirty Flag - Game Programming Patterns]: https://gameprogrammingpatterns.com/dirty-flag.html
[클리핑 좌표계]: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection#clip_space
