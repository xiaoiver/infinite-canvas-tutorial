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

지난 강의에서 빈 캔버스를 만들었습니다. 이제 여기에 다양한 그래픽을 추가해야 합니다. API를 어떻게 설계하면 좋을까요? 프런트엔드 개발자에게 익숙한 [Node API appendChild]와 유사한 방식이 직관적일 것입니다.

```ts
canvas.appendChild(shape);
canvas.removeChild(shape);
```

먼저 Circle, Ellipse, Rect 등이 상속받을 공통 기반 클래스를 만듭니다.

```ts
export abstract class Shape {}
```

캔버스 내부에서는 배열을 사용해 도형 목록을 관리합니다.

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

캔버스의 `render` 메서드에서 이 목록을 순회하며 렌더링 훅을 호출합니다.

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

렌더링 플러그인에서는 매 프레임 시작 시 하드웨어 추상화 레이어로 캡슐화된 `RenderPass`를 생성합니다. WebGL에는 없는 개념이지만, WebGPU의 [beginRenderPass]는 `draw` 명령 등을 기록하는 [GPURenderPassEncoder]를 반환합니다. `RenderPass` 생성 시 다음과 같은 파라미터를 설정합니다.

-   `colorAttachment`: 렌더링 대상
-   `colorResolveTo`: 결과가 반영될 텍스처
-   `colorClearColor`: 배경색. WebGL의 [gl.clearColor]와 유사하며 여기서는 흰색으로 설정합니다.

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

프레임 종료 시에는 `RenderPass`를 제출합니다. 하드웨어 추상화 레이어는 WebGPU의 [submit] 같은 복잡한 저수준 과정을 단순화하여 제공합니다.

```ts{2}
hooks.endFrame.tap(() => {
  this.#device.submitPass(this.#renderPass);
  this.#device.endFrame();
});
```

마지막으로 `render` 훅에서 각 도형은 자신을 그리는 로직을 수행합니다. 플러그인은 Device나 `RenderPass` 같은 필요한 GPU 객체를 전달합니다.

```ts
hooks.render.tap((shape) => {});
```

## 원 그리기 {#draw-a-circle}

원의 기본 속성을 정의해 봅시다. SVG의 [circle]과 마찬가지로 중심점(`cx/cy`)과 반지름(`r`), 그리고 채우기 색상(`fill`) 등이 필요합니다.

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

중심점 `cx/cy`를 다루기 위해 좌표계를 명확히 해야 합니다. Canvas와 SVG는 좌측 상단이 원점(0,0)이며, X축은 오른쪽👉, Y축은 아래쪽👇 방향입니다. 반면 WebGL의 [클리핑 좌표계]는 뷰포트 중앙이 원점이며 Y축이 위쪽👆 방향인 NDC(Normalized Device Coordinates)를 사용합니다.

![clip space](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection/clip_space_graph.svg)

WebGPU는 Metal 명세를 따라 Y축이 아래쪽👇 방향이지만, Z축의 범위가 WebGL(`[-1, 1]`)과 달리 `[0, 1]`인 차이가 있습니다.

![Z clip space ranges in WebGL and WebGPU](/clip-space-z-range.png)

우리의 하드웨어 추상화 레이어는 이러한 차이를 흡수하여 사용자가 익숙한 Canvas/SVG 방식의 좌표계를 제공합니다.

![canvas default grid](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_shapes/canvas_default_grid.png)

따라서 화면 좌표계의 `cx/cy`를 NDC로 변환하는 과정이 필요합니다. 캔버스의 해상도를 Uniform으로, 원의 위치를 Attribute로 전달하여 계산합니다.

```glsl
layout(std140) uniform SceneUniforms {
  vec2 u_Resolution; // 캔버스 너비와 높이
};
layout(location = 1) in vec2 a_Position; // 원의 중심 cx, cy

// 픽셀 공간을 [0, 1] 범위로 변환
vec2 zeroToOne = (a_Position + a_Size * a_FragCoord) / u_Resolution;

// [0, 1]을 [0, 2]로 변환
vec2 zeroToTwo = zeroToOne * 2.0;

// [0, 2]를 [-1, 1] (NDC)로 변환
vec2 clipSpace = zeroToTwo - 1.0;

// Y축 뒤집기
gl_Position = vec4(clipSpace * vec2(1, -1), 0.0, 1.0);
```

### 색상 값 처리 {#processing-color-values}

WebGL/WebGPU는 문자열 형태의 색상 값을 직접 인식하지 못합니다. [d3-color]를 사용하여 `{ r, g, b, opacity }` 형식으로 변환한 뒤 GPU로 전달합니다.

```ts
import * as d3 from 'd3-color';

set fill(fill: string) {
  this.#fill = fill;
  this.#fillRGB = d3.rgb(fill); // { r, g, b, opacity }
}
```

기존의 3D 렌더링 방식([CircleGeometry])은 원을 수많은 삼각형으로 쪼개서 표현합니다. 원을 부드럽게 표현할수록 정점 수가 급격히 늘어나 GPU 메모리 부담이 커집니다.

![Circle Geometry in Three.js](/circle-geometry.png)

### SDF (Signed Distance Field) {#sdf}

우리는 단 4개의 정점만 사용하는 **SDF(Signed Distance Field)** 방식을 사용합니다. SDF는 평면 위의 한 점과 도형 경계 사이의 거리를 계산하는 함수입니다. 원의 경우 중심에서의 거리가 반지름과 같으면 0, 안쪽이면 음수, 바깥쪽이면 양수 값을 가집니다.

![SDF Circle](/sdf.svg)

버텍스 셰이더에서 좌표계를 구성하고, 프래그먼트 셰이더에서 각 픽셀이 도형 내부인지 판단하여 색을 입힙니다. 도형 밖의 픽셀은 `discard` 명령으로 버립니다.

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

SDF 방식은 정점 수를 줄여줄 뿐만 아니라, 다음과 같은 강력한 장점이 있습니다.

-   안티앨리어싱 구현이 매우 쉽습니다.
-   도형 간의 합집합, 교집합 등 복잡한 연산이 가능합니다.
-   테두리(Stroke), 둥근 모서리, 그림자 등 복잡한 효과를 효율적으로 구현할 수 있습니다.

상세한 원리는 [distfunctions]에서 확인할 수 있습니다. 우리는 이 방식을 이후 사각형과 텍스트 렌더링에도 계속 활용할 것입니다.

## 안티앨리어싱 (Antialiasing) {#antialiasing}

단순히 픽셀을 칠하거나 버리는 방식은 경계면이 계단 현상(Jagged edge)처럼 거칠게 보입니다. 이를 해결하기 위해 경계면을 부드럽게 만드는 안티앨리어싱 기법이 필요합니다.

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

내장 함수 `smoothstep`을 사용해 경계면 근처의 투명도를 부드럽게 조절할 수 있습니다. 특정 거리 범위 내에서 값을 점진적으로 변화시켜 부드러운 전환 효과를 줍니다.

```glsl
float alpha = smoothstep(0.0, 0.01, -distance);
outputColor = v_FillColor;
outputColor.a *= alpha;
```

이 방식은 구현이 쉽지만, 고정된 범위를 사용하기 때문에 캔버스를 확대했을 때 경계면이 흐릿해 보일 수 있습니다.

### 화면 공간 미분 (Screen space derivatives) {#screen-space-derivatives}

더 정교한 방법은 `fwidth`를 사용하는 것입니다. GPU는 픽셀을 처리할 때 2x2 쿼드 단위로 계산하며, 이를 통해 인접한 픽셀 간의 값 변화량(미분값)을 알 수 있습니다.

`fwidth`를 이용하면 현재 픽셀의 크기에 맞춰 안티앨리어싱 범위를 동적으로 계산할 수 있어, 확대/축소 시에도 일관되게 날카롭고 부드러운 경계를 유지합니다.

```glsl
float alpha = clamp(-distance / fwidth(-distance), 0.0, 1.0);
```

이 방식은 [AAA - Analytical Anti-Aliasing]에서 언급하듯 성능 효율이 매우 좋으며 대부분의 시각화 시나리오에서 훌륭한 결과물을 보여줍니다.

## 더티 플래그 (Dirty flag) {#dirty-flag}

도형의 속성(색상, 위치 등)이 변경될 때마다 매번 GPU 버퍼를 업데이트하는 것은 비효율적입니다. 한 프레임 내에서 여러 속성이 바뀌더라도 렌더링 직전에 한 번만 업데이트하도록 **더티 플래그(Dirty Flag)** 패턴을 적용합니다.

```ts{4}
set cx(cx: number) {
  if (this.#cx !== cx) {
    this.#cx = cx;
    this.renderDirtyFlag = true; // 값이 바뀌었음을 표시
  }
}
```

`render` 메서드에서는 이 플래그가 설정된 경우에만 실제 버퍼 데이터를 갱신합니다.

```ts
if (this.renderDirtyFlag) {
    // GPU 버퍼 업데이트 로직...
    this.renderDirtyFlag = false; // 플래그 초기화
}
```

이 패턴은 이후 복잡한 씬 그래프(Scene Graph) 구조에서도 성능을 유지하는 핵심 원리가 됩니다. 아래 데모에서 속성 변경이 실시간으로 부드럽게 반영되는 것을 확인해 보세요.

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

## 더 읽어보기 {#extended-reading}

-   [distfunctions] - 다양한 도형의 SDF 공식
-   [Zed Editor의 렌더링 엔진] - Rust와 GPU를 활용한 120 FPS UI 렌더링
-   [Analytical Anti-Aliasing] - 정교한 안티앨리어싱 기법의 원리

[Node API appendChild]: https://developer.mozilla.org/ko/docs/Web/API/Node/appendChild
[GPURenderPassEncoder]: https://developer.mozilla.org/ko/docs/Web/API/GPURenderPassEncoder
[beginRenderPass]: https://developer.mozilla.org/ko/docs/Web/API/GPUCommandEncoder/beginRenderPass
[submit]: https://developer.mozilla.org/ko/docs/Web/API/GPUQueue/submit
[circle]: https://developer.mozilla.org/ko/docs/Web/SVG/Element/circle
[d3-color]: https://github.com/d3/d3-color
[CircleGeometry]: https://threejs.org/docs/#api/en/geometries/CircleGeometry
[distfunctions]: https://iquilezles.org/articles/distfunctions/
[Zed Editor의 렌더링 엔진]: https://zed.dev/blog/videogame
[gl.clearColor]: https://developer.mozilla.org/ko/docs/Web/API/WebGLRenderingContext/clearColor
[Smooth SDF Shape Edges]: https://bohdon.com/docs/smooth-sdf-shape-edges/
[Analytical Anti-Aliasing]: https://blog.frost.kiwi/analytical-anti-aliasing
