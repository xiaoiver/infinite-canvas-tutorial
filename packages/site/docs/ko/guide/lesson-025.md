---
outline: deep
description: '사각형, 타원, 다각형, 지우개, 레이저, 브러시 모드를 그립니다. 떨림을 없애는 선 그리기 알고리즘을 포함해, 매끄러운 그리기 경험을 만드는 브러시 기능의 구현을 다룹니다.'
head:
    - ['meta', { property: 'og:title', content: '25강 - 그리기 모드와 브러시' }]
---

<script setup>
import DrawRect from '../../components/DrawRect.vue'
import DrawArrow from '../../components/DrawArrow.vue'
import DrawPolygon from '../../components/DrawPolygon.vue'
import Pencil from '../../components/Pencil.vue'
import PencilFreehand from '../../components/PencilFreehand.vue'
import Brush from '../../components/Brush.vue'
import BrushWithStamp from '../../components/BrushWithStamp.vue'
import LaserPointer from '../../components/LaserPointer.vue'
import Eraser from '../../components/Eraser.vue'
</script>

# 25강 - 그리기 모드와 브러시 {#lesson-25-drawing-mode-and-brush}

[14강 - 캔버스 모드와 보조 UI]에서 손 모드와 선택 모드를 소개했습니다. 이번 강의에서는 그리기 모드를 소개합니다. 사각형, 타원, 화살표, 그리고 더 자유로운 브러시 모드입니다.

## 사각형 그리기 모드 {#draw-rect-mode}

<DrawRect />

먼저 다음 캔버스 모드를 추가합니다. 타원을 그리는 구현은 거의 같으므로, 같은 설명은 반복하지 않습니다.

```ts
export enum Pen {
    HAND = 'hand',
    SELECT = 'select',
    DRAW_RECT = 'draw-rect', // [!code ++]
    DRAW_Ellipse = 'draw-ellipse', // [!code ++]
}
```

[18강 - ECS로 리팩터링]에서 ECS 아키텍처를 소개했습니다. 여기서는 `DrawRect` System을 만들고, 그 모드에 들어가면 커서 스타일을 `crosshair`로 설정합니다.

```ts
import { System } from '@lastolivegames/becsy';

export class DrawRect extends System {
    execute() {
        if (pen !== Pen.DRAW_RECT) {
            return;
        }

        const input = canvas.write(Input);
        const cursor = canvas.write(Cursor);

        cursor.value = 'crosshair';
        //...
    }
}
```

그다음 마우스를 드래그하는 동안 대상 영역에 사각형을 계속 다시 그립니다. 선택 모드의 상자 선택 효과와 비슷합니다. 마우스 버튼을 떼어 사각형 생성을 마치면, 사각형 그리기 모드에서 선택 모드로 전환합니다.

```ts
export class DrawRect extends System {
    execute() {
        //...
        // Draw rect brush when dragging
        this.handleBrushing(api, x, y);

        if (input.pointerUpTrigger) {
            // Create rect when pointerup event triggered
            const node: RectSerializedNode = {
                id: uuidv4(),
                type: 'rect', // Change to 'ellipse' in draw-ellipse mode
                x,
                y,
                width,
                height,
            };
            api.setAppState({ penbarSelected: Pen.SELECT }); // Switch canvas mode
            api.updateNode(node);
            api.record(); // Save to history
        }
    }
}
```

이어서 드래그 과정에서 무슨 일이 일어나는지 살펴봅니다.

### 사각형 다시 그리기 {#redraw-rect}

상자 선택과 비슷하게, 짧은 거리를 드래그하는 것만으로 그리기가 시작되는 것을 피하려면 임계값을 두어야 합니다. 이 값은 Viewport 좌표계에서 계산합니다.

```ts
handleBrushing(api: API, viewportX: number, viewportY: number) {
    const camera = api.getCamera();
    const {
        pointerDownViewportX,
        pointerDownViewportY,
    } = camera.read(ComputedCameraControl);

    // Use a threshold to avoid showing the selection brush when the pointer is moved a little.
    const shouldShowSelectionBrush =
        distanceBetweenPoints(
            viewportX,
            viewportY,
            pointerDownViewportX,
            pointerDownViewportY,
        ) > 10;
}
```

보조 사각형의 `x/y` 좌표는 `pointerdown`이 발생한 위치입니다. `pointermove` 이벤트 객체의 좌표는 Canvas 좌표계로 변환한 뒤 너비와 높이를 계산해야 합니다.

```ts
const { x: cx, y: cy } = api.viewport2Canvas({
    x: viewportX,
    y: viewportY,
});

let x = pointerDownCanvasX;
let y = pointerDownCanvasY;
let width = cx - x;
let height = cy - y;

api.updateNode(
    selection.brush,
    {
        visibility: 'visible',
        x,
        y,
        width,
        height,
    },
    false,
);
```

반대 방향으로 드래그하는 경우도 고려할 가치가 있습니다. 이때 계산된 `width/height`가 음수가 될 수 있고, 대응하는 `x/y`는 더 이상 `pointerdown` 위치가 아니므로 다시 계산해야 합니다. Figma도 이렇게 합니다.

```ts
if (width < 0) {
    x += width;
    width = -width;
}
if (height < 0) {
    y += height;
    height = -height;
}
```

### 크기 레이블 {#size-label}

그리는 동안 사각형의 치수를 Figma처럼 실시간으로 보여 주고자 합니다.

![Figma의 크기 레이블](/figma-size-label.png)

마찬가지로, 이런 뷰포트 공간의 주석은 SVG 컨테이너에 두기 좋습니다. 아래에서 설명할 레이저 포인터와 지우개 도구가 그 예입니다. 사각형 레이블은 CSS 스타일로 배경색, padding, 가운데 정렬 등의 속성을 지정하고, 텍스트 내용에는 바운딩 박스의 너비와 높이를 사용합니다.

```ts
label.style.visibility = 'visible';
label.style.top = `${y + height}px`;
label.style.left = `${x + width / 2}px`;
label.innerText = `${Math.round(width)} × ${Math.round(height)}`;
```

직선을 그릴 때는 레이블이 선의 방향을 따라 회전하면서도, 텍스트는 항상 바로 읽히게 할 수 있습니다. 다음 절의 화살표 예제에서 확인해 볼 수 있습니다.

```ts
label.style.top = `${y + height / 2}px`;
const rad = Math.atan2(height, width);
let deg = rad * (180 / Math.PI);
if (deg >= 90 && deg <= 180) {
    deg = deg - 180;
} else if (deg <= -90 && deg >= -180) {
    deg = deg + 180;
}
label.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
```

### Shift로 정사각형 그리기 {#draw-square-with-shift}

드래그하는 동안 <kbd>Shift</kbd>를 누르면 정사각형, 정원, 정다각형을 만듭니다. 이때 너비와 높이의 절댓값 중 최솟값을 정사각형의 변 길이로 사용합니다.

```ts
if (isSquare) {
    if (Math.abs(width) > Math.abs(height)) {
        width = Math.sign(width) * Math.abs(height);
    } else {
        height = Math.sign(height) * Math.abs(width);
    }
}
```

## 화살표 그리기 {#draw-arrow}

사각형, 타원, 폴리라인 같은 기본 도형 외에, 화살표 같은 복합 도형도 자주 쓰입니다. 화살표의 바인딩 관계(머리와 꼬리에 연결된 도형이 움직이면 화살표의 방향도 바뀌는 관계)는 지금 다루지 않습니다. 이 주제는 별도의 장에서 다룹니다. 여기서는 화살표를 어떻게 그리는지만 살펴봅니다.

SVG에서는 먼저 `<marker>`로 화살표를 선언합니다. 보통 `<path>`입니다. 그다음 대상 그래픽의 [marker-start]와 [marker-end] 속성으로 화살표를 연결합니다.

```html
<defs>
    <!-- arrowhead marker definition -->
    <marker
        id="arrow"
        viewBox="0 0 10 10"
        refX="5"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
    >
        <path d="M 0 0 L 10 5 L 0 10 z" />
    </marker>
</defs>
<!-- Coordinate axes with a arrowhead in both direction -->
<polyline
    points="10,10 10,90 90,90"
    fill="none"
    stroke="black"
    marker-start="url(#arrow)"
    marker-end="url(#arrow)"
/>
```

화살표 끝점을 본체와 분리하는 이 방식은 매우 유연합니다. 다만 그래픽 편집기에서는 미리 준비한 일반적인 스타일 몇 가지를 제공하면 충분합니다. 예를 들어 Figma의 화살표는 Path의 두 끝점(`start/end point`)에 붙이는 방식으로 구현되며, `line/triangle/diamond` 같은 프리셋 스타일이 여러 개 있습니다. [How to Curve an Arrow in Figma]를 참고하세요.

![Figma의 화살표](/arrow-in-figma.png)

Drawio도 바로 쓸 수 있는 화살표 스타일을 많이 제공합니다.

![출처: https://www.drawio.com/assets/img/blog/style-tab-line-start-line-end.png](https://www.drawio.com/assets/img/blog/style-tab-line-start-line-end.png)

따라서 선언적 사용에서는 사용자 지정 화살표 스타일 기능을 포기하고, 내장된 화살표 스타일 리터럴 한 세트를 제공해도 전혀 문제없습니다. Polyline / Path를 구성할 때 화살표 끝점과 본체를 함께 생성합니다. 이 발상은 SVG로 렌더링하는 [plot - arrow]에서도 볼 수 있습니다. 그 구현은 `<marker>`를 쓰지 않고, 완전한 `<path>` 정의를 사용합니다.

```ts
export interface MarkerAttributes {
    markerStart: Marker['start'];
    markerEnd: Marker['end'];
}
```

다음으로 지오메트리를 구성하는 과정을 살펴봅니다.

### 시작점과 끝점 {#start-end-point}

먼저 화살표의 시작점과 끝점을 찾아야 합니다.

다만 방향은 직접 계산해야 합니다. 복잡하지 않으며, 접선을 따라 구하면 됩니다.

<DrawArrow />

### 화살표를 SVG로 내보내기 {#export-arrow-to-svg}

SVG에서는 [orient] 속성으로 `<marker>`의 방향을 조정할 수 있습니다. 다만 이 속성의 리터럴 값은 `‘auto’`와 `‘auto-start-reverse’` 두 가지뿐입니다.

```ts
if (isEnd) {
    $marker.setAttribute('orient', 'auto');
} else {
    $marker.setAttribute('orient', 'auto-start-reverse');
}
```

그다음 마커 타입에 따라 `<path>`를 만들고, 대상 그래픽의 `stroke` 같은 속성을 상속하게 합니다. SVG 전체는 [export arrow] 테스트 케이스에서 볼 수 있습니다.

```ts
if (marker === 'line') {
    const points = lineArrow(0, 0, arrowRadius, Math.PI);
    const $path = createSVGElement('path');
    $path.setAttribute('fill', 'none');
    $path.setAttribute('stroke', stroke);
    $path.setAttribute('stroke-width', `${strokeWidth}`);
    $marker.appendChild($path);
}
```

이와 함께, 내보낸 SVG 파일은 캔버스로 다시 가져올 수도 있어야 합니다.

## 다각형 그리기 {#draw-polygon}

[Shape tools - polygons]

<DrawPolygon />

직사각형 바운딩 박스가 주어지면, 프로그래밍 방식으로 다각형 패스를 생성합니다.

```ts
function regularPolygonPathInRect(
    sides: number,
    width: number,
    height: number,
    rotation = -Math.PI / 2,
): string {
    if (sides < 3 || width <= 0 || height <= 0) {
        return '';
    }

    const cx = width / 2;
    const cy = height / 2;
    const rx = width / 2;
    const ry = height / 2;
    const step = (Math.PI * 2) / sides;
    const points: [number, number][] = [];

    for (let i = 0; i < sides; i++) {
        const angle = rotation + i * step;
        points.push([
            formatNumber(cx + Math.cos(angle) * rx),
            formatNumber(cy + Math.sin(angle) * ry),
        ]);
    }

    return points
        .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
        .join(' ')
        .concat(' Z');
}
```

## 연필 도구 {#pencil-tool}

가장 단순한 구현부터 살펴봅니다. 폴리라인으로 표시하는 방식이며, Figma에서는 Pencil이라고 부릅니다.

드래그로 생기는 정점 수, 특히 중복된 정점이나 서로 가까운 정점의 수를 최대한 줄이기 위해, [12강 - 폴리라인 단순화]에서 설명한 방법으로 폴리라인을 단순화합니다. 구현은 [simplify-js]를 선택합니다. `tolerance` 매개변수의 정의에 주목할 필요가 있습니다. 이 값이 단순화 정도에 영향을 줍니다.

> 단순화의 양에 영향을 줍니다(점 좌표와 같은 단위).

현재 카메라 확대/축소 수준에 따라 `tolerance`를 다르게 설정하고자 합니다. 그렇지 않으면 높은 확대 배율에서 과도한 단순화로 생기는 떨림이 쉽게 눈에 띕니다.

![4배 확대에서 과도하게 단순화된 폴리라인](/over-simplified-polyline.gif)

```ts
import simplify from 'simplify-js';

export class DrawPencil extends System {
    private handleBrushing() {
        // choose tolerance based on the camera zoom level
        const tolerance = 1 / zoom;
        selection.points = simplify(selection.pointsBeforeSimplify, tolerance);
    }
}
```

<Pencil />

### Perfect freehand {#perfect-freehand}

선 너비가 고정되어 있으면 “유연함”이 부족합니다. 손으로 그린 느낌을 내려면 선이 압력에 따라 변하게 할 수 있습니다. 이를 위해 [perfect-freehand]를 사용할 수 있습니다. 이 기능은 아직 Excalidraw에 통합되어 있지 않습니다. 참고: [Perfect Freehand Drawing Issue].
선 너비가 가변이기 때문에, 최종적으로 그려지는 도형은 더 이상 Polyline이 아니라 Path입니다.

```ts
import { getStroke } from 'perfect-freehand';

const outlinePoints = getStroke(points);
const d = getSvgPathFromStroke(outlinePoints); // 'M 0 0 L...'
```

<PencilFreehand />

기본적으로 [perfect-freehand]는 인접한 점 사이의 거리로 가변 선 너비를 계산해 붓질의 속도를 시뮬레이션합니다. 펜이나 스타일러스에서 오는 실제 [pressure]를 쓰려면, 각 입력 점의 세 번째 숫자로 압력을 전달합니다.

```ts
export class Input {
    @field.float32 declare pressure: number; // [!code ++]
}
```

그리고 simulatePressure 옵션을 false로 설정합니다.

```ts
const outlinePoints = getStroke(inputPoints, {
    simulatePressure: false,
});
```

## 브러시 모드 {#brush-mode}

Photoshop Web에서 Paint 모드로 들어간 뒤 이 하위 도구를 선택할 수 있으며, 연속해서 드래그하며 스트로크를 그립니다.

![Photoshop Web의 브러시 모드](/photoshopweb-brush-mode.png)

Figma에서는 [Draw with illustration tools]라고 부릅니다.

이런 스트로크를 자세히 보면, 연속된 점의 집합으로 이루어져 있습니다. 점의 반지름이 서로 다르면 굵기가 변하는 효과가 납니다. 브러시의 압력을 반지름에 매핑하면 구현할 수 있습니다.

![출처: https://shenciao.github.io/brush-rendering-tutorial/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/brushes-9e58d24a7f40847be1ad6c1cb9f1b9dc.jpg)

여기서는 [Brush Rendering Tutorial]을 참고해 이 효과를 구현합니다.

### 기본 구현 {#basic-implementation}

기반 데이터 구조는 다음과 같습니다.

```ts
interface BrushPoint {
    x: number;
    y: number;
    radius: number;
}
```

폴리라인의 $N$개 정점은 $N-1$개의 세그먼트를 이루고, 각 세그먼트는 삼각형 두 개와 정점 네 개로 구성됩니다. [12강 - 세그먼트 돌출]에서는 정점 9개를 사용하는 방법을 소개했습니다. 여기서도 정확히 같은 방법을 쓰지만, 세그먼트 이음새는 고려하지 않아도 되므로 정점 4개만 쓰고 인스턴싱으로 그립니다.

```ts
renderPass.drawIndexed(6, points.length - 1); // indices: [0, 1, 2, 0, 2, 3]
```

[12강 - 세그먼트 돌출]에서 본 것처럼, `a_VertexNum`을 정점 셰이더에 전달할 수 있습니다. WebGL 1 호환을 고려하지 않는다면 [Brush Rendering Tutorial]처럼 `gl_VertexID`를 직접 쓸 수도 있습니다.

```glsl
layout(location = ${Location.POINTA}) in vec3 a_PointA;
layout(location = ${Location.POINTB}) in vec3 a_PointB;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum; // [0, 1, 2, 3]
```

다른 `attributes`도 짚어 둡니다. `a_PointA`와 `a_PointB`는 정점 위치 좌표 외에 가변 반지름도 저장합니다. 여기서도 `vertexBufferOffsets`로 같은 Buffer를 함께 쓰고, `a_PointB`는 `4 * 3` 오프셋부터 읽습니다. 이렇게 하면 정점 번호로 정점 셰이더에서 늘일 수 있습니다.

![출처: https://shenciao.github.io/brush-rendering-tutorial/Basics/Vanilla/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/coordinate-68714349e3013c769921a0eb25796188.png)

```glsl
vec2 position;
vec2 offsetSign;
float r;
if (vertexNum < 0.5) {
    position = p0;
    r = r0;
    offsetSign = vec2(-1.0, -1.0);
} else if (vertexNum < 1.5) {
    position = p0;
    r = r0;
    offsetSign = vec2(-1.0, 1.0);
}
```

가변 너비를 지원하려면, 늘인 거리가 항상 현재 점의 반지름과 같지는 않으며 선분의 기울기에 따라 계산해야 합니다.

![출처: https://shenciao.github.io/brush-rendering-tutorial/Basics/Vanilla/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/var-parameters-9d4c6d7aa31d0f61fd39ba9f69eaae6d.png)

```glsl
int MAX_i = 128; float currIndex = startIndex;
float A = 0.0;
for(int i = 0; i < MAX_i; i++){
    // Blend opacity
    A = A * (1.0-opacity) + opacity;
}
```

효과는 다음과 같습니다. 브러시 도구를 선택한 뒤 드래그 속도를 바꿔 보세요. ECS는 타임스탬프가 있는 마우스/터치 샘플을 사용해 빠른 스트로크는 더 가늘게, 느린 스트로크는 더 굵게 만들며, 그 사이는 부드럽게 전환합니다. 필압 펜은 측정된 압력을 대신 사용합니다. 계산된 반지름은 스트로크에 저장되므로, 실행 취소/다시 실행과 다시 불러오기에서도 형태가 유지됩니다.

<Brush />

### 스탬프 {#stamp}

이것만으로는 실제 붓 터치와 아직 다릅니다. 스탬프 이미지 URL을 위해 `brushStamp` 속성을 추가하지만, 이 속성은 브러시의 불투명도만 제어하고 색은 여전히 `stroke`가 결정합니다.

```ts
api.updateNodes([
    {
        id: '1',
        type: 'brush',
        brushType: BrushType.STAMP,
        brushStamp: '/stamp.png',
        points: position.map(([x, y], i) => `${x},${y},${radius[i]}`).join(' '),
        stroke: 'grey',
    },
]);
```

<BrushWithStamp />

현재 모든 텍스처는 고정된 방향으로 적용됩니다. 텍스처에 무작위 회전 각도를 더할 수 있습니다.

```glsl
float angle = rotationFactor*radians(360.0*fract(sin(currIndex)*1.0));
pToCurrStamp *= rotate(angle);
```

불투명도를 혼합할 때 노이즈 계수도 사용할 수 있습니다.

```glsl
float opacityNoise = noiseFactor*fbm(textureCoordinate*50.0);
```

### [WIP] SVG 내보내기 {#export-brush-to-svg}

Figma는 Brush를 SVG로 내보낼 수 있습니다.

## 레이저 포인터 {#laser-pointer}

캔버스에서 프레젠테이션 기능을 구현할 때 레이저 포인터는 필수 기능입니다. Excalidraw가 이 기능을 지원하며, 자세한 내용은 [laser pointer]를 참고하세요. 캡슐화된 [@excalidraw/laser-pointer] 모듈을 그대로 사용할 수 있습니다. 이 모듈은 입력 점 좌표의 집합으로 궤적 패스를 생성합니다. 내부에서는 [perfect-freehand]도 사용합니다.

이 기능은 이전에 캔버스에 그린 도형과 다음 점에서 다릅니다.

1. 레이저 포인터 궤적의 렌더링은 뷰포트 좌표계에서 이루어지며, 현재 캔버스 확대/축소 수준과 무관합니다. 따라서 독립된 HTML 컨테이너 안에서 구현할 수 있습니다. 참고: [29강 - HTML 컨테이너]
2. 궤적은 정해진 시간이 지나면 자동으로 사라집니다
3. 여러 사용자가 함께 쓰는 협업 시나리오를 위해 설계되었습니다. 참고: [20강 - Awareness와 Presence]

<LaserPointer />

## 지우개 {#eraser}

Excalidraw는 [freedraw eraser]를 지원합니다. 지우개 도구를 선택한 뒤 마우스 커서가 지나간 도형은 “흐려져” 곧 지워질 것임을 나타냅니다. 마우스 버튼을 떼면 지우기가 완료됩니다.

구현에서는 이전 절에서 소개한 Perfect freehand로 드래그 경로를 그리되, 가장 최근의 4개 점만 저장합니다. 동시에 지나간 도형을 실시간으로 감지해 불투명도를 설정합니다(취소했을 때 되돌릴 수 있도록 원래 불투명도는 저장해 두어야 합니다). 마우스 버튼을 떼면 선택된 도형을 제거합니다.

```ts
export class DrawEraser extends System {
    execute() {
        if (input.pointerUpTrigger) {
            api.runAtNextTick(() => {
                api.updateNode(brush, { visibility: 'hidden' }, false);
                api.setAppState({
                    penbarSelected: Pen.SELECT,
                });
                api.deleteNodesById(
                    Array.from(selected).map((e) => api.getNodeByEntity(e)?.id),
                );
                api.record();
            });
        }
    }
}
```

<Eraser />

### 비원자적 지우기 {#non-atomic}

도형 전체를 지우는 것으로 대부분의 상황에는 충분합니다. 다만 자유 그리기에서는 비원자적 지우기가 더 실용적입니다. 예를 들어 직선을 중간에서 끊는 경우입니다. Excalidraw는 현재 이 기능이 없습니다. 참고: [non-atomic erasing for linear & freedraw shapes]. FigJam도 같은 한계가 있습니다. 캔버스를 Canvas나 SVG로 렌더링하면, 이런 픽셀 단위 지우기 효과는 실제로 불가능합니다.

우리 캔버스는 WebGL/WebGPU로 구현되므로, 가장 알맞은 기법은 스텐실 버퍼입니다. 먼저 지우개 경로를 스텐실 버퍼에 그린 다음, 그것을 마스크로 삼아 씬을 다시 그립니다. OpenGL을 예로 들면 다음과 같으며, WebGL도 완전히 같은 방식입니다.

```c++
// 1. Disable color/depth writes, enable stencil, and draw the eraser shape:
//    This writes “1” into the stencil where the eraser stamp is drawn.
glColorMask(false,false,false,false);
glDepthMask(false);
glEnable(GL_STENCIL_TEST);
glStencilFunc(GL_ALWAYS, 1, 0xFF);
glStencilOp(GL_REPLACE, GL_REPLACE, GL_REPLACE);
// draw eraser brush geometry here (e.g. a textured quad or circle)

glColorMask(true,true,true,true);
glDepthMask(true);
// 2. Now render the shapes with stencil test=EQUAL, so only pixels where stencil==1 pass:
glStencilFunc(GL_EQUAL, 1, 0xFF);
glStencilOp(GL_KEEP, GL_KEEP, GL_KEEP);
// draw all scene objects (they will only appear where eraser just wrote 1)
```

이 내용은 나중에 [34강 - Frame과 클리핑]에서 소개합니다.

## 더 읽어보기 {#extended-reading}

-   [Draw with illustration tools]
-   [Brush Rendering Tutorial]
-   [p5.brush]
-   [Real-Time Paint System with WebGL]
-   [简简单单实现画笔工具，轻松绘制丝滑曲线]

[14강 - 캔버스 모드와 보조 UI]: /ko/guide/lesson-014
[18강 - ECS로 리팩터링]: /ko/guide/lesson-018
[Draw with illustration tools]: https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools
[p5.brush]: https://github.com/acamposuribe/p5.brush
[Real-Time Paint System with WebGL]: https://chrisarasin.com/paint-system-webgl
[简简单单实现画笔工具，轻松绘制丝滑曲线]: https://zhuanlan.zhihu.com/p/701668081
[12강 - 폴리라인 단순화]: /ko/guide/lesson-012#simplify-polyline
[simplify-js]: https://github.com/mourner/simplify-js
[Brush Rendering Tutorial]: https://shenciao.github.io/brush-rendering-tutorial/
[12강 - 세그먼트 돌출]: /ko/guide/lesson-012#extrude-segment
[How to Curve an Arrow in Figma]: https://imagy.app/how-to-curve-an-arrow-in-figma/
[marker-start]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-start
[marker-end]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-end
[Shape tools - polygons]: https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools#polygons
[plot - arrow]: https://github.com/observablehq/plot/blob/main/src/marks/arrow.js
[orient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/orient
[export arrow]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/ecs/snapshots/export-arrow.svg
[perfect-freehand]: https://github.com/steveruizok/perfect-freehand
[Perfect Freehand Drawing Issue]: https://github.com/excalidraw/excalidraw/issues/4802
[pressure]: https://developer.mozilla.org/docs/Web/API/PointerEvent/pressure
[freedraw eraser]: https://github.com/excalidraw/excalidraw/issues/3682
[non-atomic erasing for linear & freedraw shapes]: https://github.com/excalidraw/excalidraw/issues/4904
[laser pointer]: https://github.com/excalidraw/excalidraw/issues/5351
[@excalidraw/laser-pointer]: https://www.npmjs.com/package/@excalidraw/laser-pointer
[29강 - HTML 컨테이너]: /ko/guide/lesson-029#create-html-container
[20강 - Awareness와 Presence]: /ko/guide/lesson-020#awareness-presence
[34강 - Frame과 클리핑]: /ko/guide/lesson-034
