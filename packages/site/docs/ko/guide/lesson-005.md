---
outline: deep
description: '선 기하와 화면 공간 기법으로 직선을 그리는 방법을 배웁니다. 그리드와 점 패턴을 구현하고, 기하 도형에 와이어프레임 렌더링을 추가합니다.'
head:
    - ['meta', { property: 'og:title', content: '5강 - 그리드' }]
---

# 5강 - 그리드 {#lesson-5-grid}

이번 강의에서는 다음 내용을 배웁니다.

-   선 기하(Line Geometry) 또는 화면 공간 기법으로 직선을 그립니다.
-   점 그리드를 그립니다.
-   기하의 와이어프레임을 그립니다.

```js eval code=false
$button = call(() => {
    const $button = document.createElement('button');
    $button.textContent = 'FlyTo origin';
    return $button;
});
```

```js eval code=false
checkboardStyle = Inputs.radio(['none', 'grid', 'dots'], {
    label: 'Checkboard Style',
    value: 'grid',
});
```

```js eval code=false inspector=false
canvas = call(() => {
    const { Canvas } = Lesson5;
    return Utils.createCanvas(Canvas, 400, 400);
});
```

```js eval code=false inspector=false
call(() => {
    const styles = ['none', 'grid', 'dots'];
    canvas.setCheckboardStyle(styles.indexOf(checkboardStyle));
});
```

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson5;

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    const landmark = canvas.camera.createLandmark({
        x: 0,
        y: 0,
        zoom: 1,
        rotation: 0,
    });
    $button.onclick = () => {
        canvas.camera.gotoLandmark(landmark, {
            duration: 1000,
            easing: 'ease',
        });
    };

    return canvas.getDOM();
})();
```

Figma와 FigJam에서는 어느 정도까지 확대하면 그리드가 나타납니다. 전자는 선으로, 후자는 점으로 표시됩니다.

![FigJam 그리드](/figjam-grid.png)

Miro는 선과 점 사이를 전환할 수 있습니다.

![Miro 그리드](/miro-grid.png)

직선 그리드부터 시작하겠습니다.

## 직선 그리드 {#lines-grid}

먼저, 그리드는 씬 그래프의 일부가 되면 안 됩니다. 캔버스를 확대하거나 축소할 때 그리드까지 커지거나 작아지기는 원하지 않습니다. 다만 확대·축소할 때는 페이드 인과 페이드 아웃이 있어야 합니다. 그래서 `beginFrame` 훅에서 그리드를 먼저 렌더링하고, 카메라처럼 씬에서 필요한 정보를 함께 넘깁니다.

```ts
hooks.initAsync.tapPromise(async () => {
    this.#grid = new Grid();
});
hooks.beginFrame.tap(() => {
    this.#grid.render(
        this.#device,
        this.#renderPass,
        this.#uniformBuffer,
        camera,
    );
});
```

### 선 기하 {#line-geometry}

가장 바로 떠오르는 방법은 [GridHelper - Three.js]와 비슷합니다. 그리드 크기에 맞춰 선분 묶음을 만듭니다.

```ts
// https://github.com/mrdoob/three.js/blob/master/src/helpers/GridHelper.js#L25-L37
for (var i = 0, j = 0, k = -halfSize; i <= divisions; i++, k += step) {
    vertices.push(-halfSize, 0, k, halfSize, 0, k);
    vertices.push(k, 0, -halfSize, k, 0, halfSize);
}

var geometry = new BufferGeometry();
geometry.addAttribute('position', new Float32BufferAttribute(vertices, 3));
geometry.addAttribute('color', new Float32BufferAttribute(colors, 3));

var material = new LineBasicMaterial({ vertexColors: VertexColors });
LineSegments.call(this, geometry, material);
```

Figma의 CTO인 Evan의 [thetamath] 프로젝트에서도 그리드를 이렇게 구현합니다. 가로와 세로 방향에서 그리드에 필요한 선분을 구성합니다.

```ts
for (let x = left; x < right; x++) {
    const tx = ox + (x * zoom) / step;
    this.strokeLine();
}
for (let y = top; y < bottom; y++) {
    const ty = oy - (y * zoom) / step;
    this.strokeLine();
}
```

WebGL에서 직선은 어떻게 그릴까요? 이전에 [Drawing Straight Lines in WebGL (Chinese)]라는 글을 쓴 적이 있습니다. 간단히 말하면, 조인트를 고려하지 않는다면 법선 방향으로 양쪽을 바깥으로 늘리고, 삼각형 두 개로 그리면 됩니다.

![선 돌출](https://pica.zhimg.com/70/v2-afa28c8cf89369a162816f21b7f53314_1440w.avis?source=172ae18b&biz_tag=Post)

[thetamath]는 작은 기법도 두 가지 씁니다. 첫 번째는 [Triangle strip]입니다. 일반적인 `Triangles`와 비교하면 정점 수를 줄일 수 있어서, 삼각형 개수를 `N`이라고 할 때 `3N`에서 `N + 2`가 됩니다.

```ts{5}
this.#pipeline = device.createRenderPipeline({
    inputLayout: this.#inputLayout,
    program: this.#program,
    colorAttachmentFormats: [Format.U8_RGBA_RT],
    topology: PrimitiveTopology.TRIANGLE_STRIP,
});
```

두 번째로, 색을 `Bytes` 4개에 저장합니다.

```ts
255 | (255 << 8) | (255 << 16) | (127 << 24);
```

[vertexAttribPointer]와 함께, 각 성분이 `gl.UNSIGNED_BYTE`이며 정규화가 필요하다고 선언합니다.

```ts{13}
this.#inputLayout = device.createInputLayout({
  vertexBufferDescriptors: [
    {
      arrayStride: 4 * 5,
      stepMode: VertexStepMode.VERTEX,
      attributes: [
        {
          format: Format.F32_RGBA,
          offset: 0,
          shaderLocation: 0,
        },
        {
          format: Format.U8_RGBA_NORM,
          offset: 4 * 4,
          shaderLocation: 1,
        },
      ],
    },
  ],
  indexBufferFormat: null,
  program: this.#program,
});
```

한번 시험해 보겠습니다.

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson5;
    const canvas = await Utils.createCanvas(Canvas, 400, 400);
    const $canvas = canvas.getDOM();

    canvas.setGridImplementation(0);

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    return $canvas;
})();
```

이 방법에서는 캔버스가 클수록, 그리드가 촘촘할수록 정점이 더 많이 필요합니다. 더 적은 정점으로 같은 결과를 얻을 방법은 없을까요? 그리드는 항상 화면 전체를 채우므로, 화면 공간에서 처리할 수 있지 않을까요?

### 프래그먼트 셰이더의 패턴 {#patterns-in-fragment-shader}

[Building Flexible and Powerful Cross-Sections with GridPaper and WebGL]에서는 이렇게 말합니다.

> 이 선들을 모두 기하로 렌더링하는 대신, WebGL 프래그먼트 셰이더로 픽셀마다 선을 생성할 수 있습니다.

화면 공간에서 구현하면 좋은 점은, 화면을 채우는 Quad 하나만 있으면 되고 정점은 4개뿐이라는 것입니다. 그 정점에는 클립 좌표계의 좌표를 넣습니다. 물론 정점 3개만 쓰는 전체 화면 삼각형을 쓸 수도 있습니다. 이 방식은 후처리에서 흔합니다.

```ts
this.appendVertex(-1, -1);
this.appendVertex(-1, 1);
this.appendVertex(1, -1);
this.appendVertex(1, 1);
```

이렇게 하면 정점 셰이더에서 변환 없이 그대로 쓸 수 있습니다.

```glsl
layout(location = 0) in vec4 a_Position;
void main() {
  gl_Position = vec4(a_Position.xy, 0, 1);
}
```

프래그먼트 셰이더에서 그리드를 그리려면, 픽셀의 월드 좌표계 좌표가 필요합니다. 그래서 카메라의 투영 변환 행렬의 역행렬을 쓰면, 클립 좌표계의 좌표를 월드 좌표계로 바꿀 수 있습니다.

```glsl{4}
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
};

out vec2 v_Position;

vec2 project_clipspace_to_world(vec2 p) {
  return (u_ViewProjectionInvMatrix * vec3(p, 1.0)).xy;
}

void main() {
  v_Position = project_clipspace_to_world(a_Position.xy);
}
```

Canvas2D와 SVG에서는 그리드를 흔히 Pattern으로 구현합니다. 프래그먼트 셰이더로 구현하는 기본 발상도 비슷해서, 내장 함수 `fract`로 Pattern을 그립니다. 처음의 좌표 공간을 n배로 확대한 뒤 `fract`로 소수부를 구하면, 좌표 범위가 `0-1`인 작은 칸만 보면 됩니다. 자세한 내용은 [the book of shaders - Patterns]를 참고하세요.

![패턴](https://pic4.zhimg.com/80/v2-1f7b0bc49eefe692f5a3c5935725feef_1440w.webp)

다음 코드는 Evan의 [Anti-Aliased Grid Shader]에서 가져온 것입니다.

```ts
vec4 render_grid_checkerboard(vec2 coord) {
  // Compute anti-aliased world-space grid lines
  vec2 grid = abs(fract(coord / gridSize - 0.5) - 0.5) / fwidth(coord) * gridSize;
  float line = min(grid.x, grid.y);
  float alpha = 1.0 - min(line, 1.0);
}
```

굵기가 다른 그리드 두 벌을 그리고자 합니다. 가는 그리드의 간격은 굵은 그리드의 `1/5`입니다. 동시에, 현재 픽셀이 굵은 그리드에 더 가까운지도 확인합니다.

```glsl
vec2 size = scale_grid_size(u_ZoomScale);
float gridSize1 = size.x;
float gridSize2 = gridSize1 / 5.0;
```

### 텍스처 기반 그리드 {#texture-based}

[The Best Darn Grid Shader (Yet)]는 텍스처에 기반한 또 다른 방식을 설명합니다. 특히 선 자체에도 원근이 있게 하고 싶을 때, 이 방식은 화면 공간의 고정 너비 그리드보다 결과가 좋습니다. 예를 들어 아래 그림의 오른쪽에는 뚜렷한 “모아레”가 있고, 왼쪽으로 더 먼 선은 더 가늘어지며 색도 더 어두워집니다.

![텍스처 그리드와 선 그리드](https://miro.medium.com/v2/resize:fit:1360/format:webp/1*P4a5_Z1u5WXOQWpVglPb2g.png)

원문에서 저자는 원근에 따른 굵기를 개선하고 “모아레” 패턴을 완화하는 등 여러 손을 보았습니다. Shadertoy의 예는 다음과 같습니다.

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/mdVfWw?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

## 점 그리드 {#dots-grid}

점 그리드도 화면 공간의 프래그먼트 셰이더에서 처리하기로 합니다. 앞에서 다룬 Signed Distance Field(SDF)로 원을 그릴 수도 있지만, 그러면 정점이 매우 많이 필요합니다. 그래서 직선 그리드의 Pattern을 계속 재사용하고, 여기서는 SDF로 픽셀이 원 안에 있는지만 판정합니다. 이 방법은 2강에서 이미 다뤘습니다.

```glsl
vec2 grid2 = abs(fract(coord / gridSize2 - 0.5) - 0.5) / fwidth(coord) * gridSize2;
alpha = 1.0 - smoothstep(0.0, 1.0, length(grid2) - BASE_DOT_SIZE * u_ZoomScale / zoomStep);
```

직선 그리드와 점 그리드를 전환하려면, 그리드 스타일을 구분하는 새 유니폼 변수를 도입하면 됩니다.

```glsl{6}
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
  float u_ZoomScale;
  float u_CheckboardStyle;
};
```

이제 프래그먼트 셰이더에서 다음과 같이 서로 다른 그리드를 그릴 수 있습니다.

```glsl
const int CHECKERBOARD_STYLE_NONE = 0;
const int CHECKERBOARD_STYLE_GRID = 1;
const int CHECKERBOARD_STYLE_DOTS = 2;

vec4 render_grid_checkerboard(vec2 coord) {
  int checkboardStyle = int(floor(u_CheckboardStyle + 0.5));
  if (checkboardStyle == CHECKERBOARD_STYLE_GRID) {
    // lines grid
  } else if (checkboardStyle == CHECKERBOARD_STYLE_DOTS) {
    // dots grid
  }
}
```

페이지 맨 위의 예제로 돌아가 여러 그리드 스타일을 전환해 볼 수 있습니다.

마지막으로, 마우스 상호작용을 넣은 흥미로운 예를 소개합니다. [How to Code a Subtle Shader Background Effect with React Three Fiber]

<video autoplay="" controls="" loop="" muted="" src="https://codrops-1f606.kxcdn.com/codrops/wp-content/uploads/2024/10/shaderbackground.mp4?x39556" playsinline=""></video>

## 밝기 조정 {#adjusting-brightness}

Figma / FigJam에서 쓰는 셰이더에서는 색의 밝기도 계산하고, 밝기 값에 따라 색을 조정합니다. 구체적으로는 밝기에 기반한 색 조정 알고리즘을 써서 색의 보이는 느낌을 개선하고, 더 밝은 배경 위에서도 텍스트나 그래픽이 더 분명히 보이게 합니다.

가중치 벡터 `weights`를 정의해 두었습니다. 가중치는 사람 눈이 색마다 밝기를 비선형으로 지각하는 특성에 맞춰 두었으며, RGB 색 공간에서 밝기 값을 계산할 때 흔히 씁니다.

```glsl{2}
vec3 gridColor; // Store the final adjusted color value
vec3 weights = vec3(0.299, 0.587, 0.114);
float c2 = dot(rgb * rgb, weights); // Calculate weighted sum of squares of RGB, c2 is an estimate of color brightness
float luminance = sqrt(c2);
```

밝기 값이 0.5보다 크면, 색 자체가 이미 꽤 밝다는 뜻입니다. 코드는 조정 계수 target을 계산하고, 그것으로 색 값 rgb를 고쳐 색을 조금 더 어둡게 만듭니다. 이렇게 하면 밝은 배경에서도 색을 더 쉽게 볼 수 있습니다. 밝기 값이 0.5보다 크지 않으면, 색 자체가 비교적 어두우므로 코드는 다른 전략으로 색을 조정합니다.

먼저 새로운 밝기 목표값 target을 계산한 다음, `b`와 `a`의 계산 결과에 따라 `mix` 함수로 rgb 색과 순백 `vec3(1)`을 섞습니다. 최종 색의 혼합 비율은 `b`와 `a`의 관계로 정해집니다. 여기서 `a`와 `b`는 원래 색의 밝기 값으로 계산되며, 색 조정 과정을 제어하는 데 쓰입니다.

```glsl
if (luminance > 0.5) {
    float target = (luminance - 0.05) / luminance;
    gridColor = rgb * target;
}
else {
    float target = luminance * 0.8 + 0.15;
    float c1 = dot(rgb, weights);
    float a = 1.0 - 2.0 * c1 + c2;
    float b = c2 - c1;
    gridColor = mix(rgb, vec3(1), (b + sqrt(b * b - a * (c2 - target * target))) / a);
}
rgb = mix(rgb, gridColor, gridWeight);
```

## 와이어프레임 그리기 {#wireframe}

와이어프레임을 그릴 때도 비슷한 기법을 쓰며, [폴리라인 그리기][Draw polyline]처럼 복잡한 기하를 디버깅하는 데 쓸 수 있습니다.

### 무게중심 좌표 {#barycentric-coordinates}

발상은 사실 매우 단순합니다. 래스터화하는 동안 각 삼각형에 와이어프레임을 그리고 싶으므로, 현재 프래그먼트가 삼각형의 세 변에서 얼마나 떨어져 있는지 알아야 합니다. 그 거리가 테두리 너비보다 작아지면, 현재 프래그먼트에 테두리 색을 칠합니다. 핵심은 프래그먼트와 삼각형의 세 변 사이 거리를 어떻게 구하느냐입니다. 무게중심 좌표를 쓸 수 있습니다. 현재 프래그먼트가 속한 삼각형만 보면 되므로, 세 정점의 무게중심 좌표로 무게중심 좌표계를 만들고, 프래그먼트 셰이더의 보간으로 현재 프래그먼트의 무게중심 좌표를 얻습니다.

실제로 렌더링 파이프라인도 무게중심 좌표를 가중치로 써서 프래그먼트의 색을 정합니다. 아래 그림과 같습니다. scratchapixel의 래스터화 구현 글을 이어서 읽을 수 있습니다. [Rasterization].

![무게중심 좌표](https://www.scratchapixel.com/images/rasterization/barycentric2.png)

구체적인 구현을 보겠습니다. 먼저 정점에 무게중심 좌표를 넘깁니다. 삼각형 세 정점의 좌표가 `(1,0,0)`, `(0,1,0)`, `(0,0,1)`이 되게 해야 합니다. 그릴 때 `gl.drawArrays()`를 쓴다면, 세 정점의 좌표를 순서대로 넣고 삼각형 개수만큼 여러 번 반복하면 됩니다. 예를 들면 다음과 같습니다.

```glsl
layout(location = BARYCENTRIC) in vec3 a_Barycentric;
out vec3 v_Barycentric;

void main() {
  v_Barycentric = a_Barycentric;
}
```

이어서 프래그먼트 셰이더에서는, 무게중심 좌표의 어느 성분이든 테두리 너비 임계값보다 작으면 테두리로 볼 수 있습니다. 여기서는 glsl 내장 함수 `any()`와 `lessThan()`을 씁니다.

```glsl
in vec3 v_Barycentric;
void main() {
  // less than border width
  if (any(lessThan(v_Barycentric, vec3(0.1)))) {
    // border color
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    // fill background color
    gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0);
  }
}
```

앞에서 직선 그리드를 그릴 때와 같이, 카메라 줌과 관계없이 선 너비를 일정하게 유지하고 싶으므로 `fwidth()`를 계속 씁니다.

```glsl
float edgeFactor() {
  vec3 d = fwidth(v_Barycentric);
  vec3 a3 = smoothstep(vec3(0.0), d * u_WireframeLineWidth, v_Barycentric);
  return min(min(a3.x, a3.y), a3.z);
}
```

### 정점 데이터 재할당 {#reallocate-vertex-data}

앞의 예에서는 그릴 때 `gl.drawArrays()`를 썼습니다. 하지만 버퍼 공간을 더 아끼는 `gl.drawElements()`를 쓰면, 즉 일부 정점을 공유하면(예를 들어 평면은 정점 6개가 아니라 4개만 씁니다), 정점 순서만으로 무게중심 좌표를 단순히 할당할 수 없고, 정점 인덱스에 따라 할당해야 합니다. 다만 모든 할당 방식이 이렇게 단순하지는 않습니다. 예를 들어 Stack Overflow의 이 문제 [Issue with Barycentric coordinates when using shared vertices]를 보면, `?`에는 할당할 수 없다는 것을 알 수 있습니다. 근본적인 이유는, 정점을 공유할 때 한 삼각형에 무게중심 좌표를 할당하고 나면, 같은 변을 공유하는 다음 삼각형의 남은 한 정점 좌표는 사실 이미 정해져 있기 때문입니다.

![물음표에 해당하는 무게중심 좌표는 없습니다](https://pica.zhimg.com/v2-30c2f4ab848d5f0cfcf8f6934b030298_b.jpg)

따라서 와이어프레임을 켜면, 재사용된 인덱스를 펼쳐야 합니다. 예를 들어 인덱스 4개 `[0, 1, 2, 0, 2, 3]`를 쓰던 원래 정점 6개는 `[0, 1, 2, 3, 4, 5]`로 펼쳐지고, 정점 배열의 데이터도 다시 할당해야 합니다.

```ts
let cursor = 0;
const uniqueIndices = new Uint32Array(indiceNum); // Reallocate indices
for (let i = 0; i < indiceNum; i++) {
    const ii = this.#indexBufferData[i];
    for (let j = 0; j < bufferDatas.length; j++) {
        const { arrayStride } = this.#vertexBufferDescriptors[j];
        const size = arrayStride / 4;
        for (let k = 0; k < size; k++) {
            bufferDatas[j][cursor * size + k] =
                originalVertexBuffers[j][ii * size + k]; // Reallocate vertex data
        }
    }
    uniqueIndices[i] = cursor;
    cursor++;
}
```

결과는 다음과 같으며, 도형을 그리는 방법은 이후에 더 소개합니다.

<script setup>
import Wireframe from '../../components/Wireframe.vue'
</script>

<Wireframe />

## 더 읽어보기 {#extended-reading}

-   [thetamath]
-   [The Best Darn Grid Shader (Yet)]
-   [Drawing Grid in WebGL (Chinese)]
-   [How to Draw Plane Grid Lines with WebGL (Chinese)]
-   [How to Code a Subtle Shader Background Effect with React Three Fiber]
-   [Love, derivatives and loops]

[thetamath]: http://thetamath.com/app/y=x%5E(3)-x
[GridHelper - Three.js]: https://threejs.org/docs/#api/en/helpers/GridHelper
[Drawing Grid in WebGL (Chinese)]: https://zhuanlan.zhihu.com/p/66637363
[How to Draw Plane Grid Lines with WebGL (Chinese)]: https://www.zhihu.com/question/325261675/answer/3149510989
[Drawing Straight Lines in WebGL (Chinese)]: https://zhuanlan.zhihu.com/p/59541559
[Triangle strip]: https://en.wikipedia.org/wiki/Triangle_strip
[Building Flexible and Powerful Cross-Sections with GridPaper and WebGL]: https://medium.com/life-at-propeller/building-flexible-and-powerful-cross-sections-with-gridpaper-and-webgl-c5b3b9929c71
[vertexAttribPointer]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer
[the book of shaders - Patterns]: https://thebookofshaders.com/09/?lan=ch
[Anti-Aliased Grid Shader]: https://madebyevan.com/shaders/grid/
[The Best Darn Grid Shader (Yet)]: https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8
[Draw polyline]: /ko/guide/lesson-012
[Rasterization]: https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/rasterization-stage.html
[Issue with Barycentric coordinates when using shared vertices]: https://stackoverflow.com/questions/24839857/wireframe-shader-issue-with-barycentric-coordinates-when-using-shared-vertices
[How to Code a Subtle Shader Background Effect with React Three Fiber]: https://tympanus.net/codrops/2024/10/31/how-to-code-a-subtle-shader-background-effect-with-react-three-fiber/
[Love, derivatives and loops]: https://medium.com/@akella/love-derivatives-and-loops-f4a0da6e2458
