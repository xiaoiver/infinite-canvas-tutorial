---
outline: deep
description: '커넥터를 도형에 바인딩하여, 노드가 움직일 때 간선이 따라가도록 합니다. 직교, 곡선, 화살표 바인딩을 포함합니다.'
head:
    - ['meta', { property: 'og:title', content: '31강 - 도형 간 바인딩' }]
---

<script setup>
import Binding from '../../components/Binding.vue'
import BindingWithEllipse from '../../components/BindingWithEllipse.vue'
import BindingOrthogonal from '../../components/BindingOrthogonal.vue'
import BindingConstraint from '../../components/BindingConstraint.vue'
import BindingRouteOrthConnector from '../../components/BindingRouteOrthConnector.vue'
import BindingRounded from '../../components/BindingRounded.vue'
import BindingCurved from '../../components/BindingCurved.vue'
import BindingBezier from '../../components/BindingBezier.vue'
import BindingArrow from '../../components/BindingArrow.vue'
import BindingDangling from '../../components/BindingDangling.vue'
import BindingLoop from '../../components/BindingLoop.vue'
</script>

# 31강 - 도형 간 바인딩 {#lesson-31-bindings-between-shapes}

[23강 - 마인드맵]에서는 노드와 간선의 레이아웃 알고리즘만 다루었고, 노드를 움직일 때 간선도 함께 움직이는 상호작용에는 들어가지 않았습니다. 마찬가지로 [25강 - 화살표 그리기]에서 선과 화살표의 속성에는 바인딩 정보가 들어 있지 않았습니다. 이번 강의에서 이 기능을 완성합니다.

## 데이터 구조 {#data-structure}

### excalidraw의 선형 요소 {#excalidraw-linear-element}

Excalidraw에서 연결선(화살표 등)은 데이터 모델에서 `ExcalidrawLinearElement`로 표현되며, 이 타입은 연결과 관련된 필드를 추가합니다.

```ts
export declare type PointBinding = {
    elementId: ExcalidrawBindableElement['id'];
    focus: number;
    gap: number;
};
export declare type ExcalidrawLinearElement = _ExcalidrawElementBase &
    Readonly<{
        type: 'line' | 'arrow';
        points: readonly Point[];
        lastCommittedPoint: Point | null;
        startBinding: PointBinding | null;
        endBinding: PointBinding | null;
        startArrowhead: Arrowhead | null;
        endArrowhead: Arrowhead | null;
    }>;
```

위에서 보듯, 각 화살표에는 선택적인 `startBinding`과 `endBinding` 필드가 있으며, 이들은 `points`와 의미 계층이 다릅니다. 전자는 의미적 제약이고, 후자인 `points`는 기하학적 표현입니다. 둘이 동시에 있으면 `points`를 다시 계산해야 합니다. 또한 시작과 끝의 화살표 스타일(`startArrowhead/endArrowhead`)이 있습니다. `elementId`는 `PointBinding` 안에서 연결된 도형(사각형, 타원, 텍스트, 이미지처럼 바인딩할 수 있는 요소)을 가리키고, `focus`와 `gap`은 연결 위치를 정하는 데 쓰입니다(부동소수점 인덱스와 오프셋 거리). 예를 들어 아래는 JSON으로 나타낸 화살표 요소입니다.

```ts
{
  "type": "arrow",
  // ... other properties omitted ...
  "startBinding": {
    "elementId": "xw25sQBsbd2mecyjTrYHA",
    "focus": -0.0227,
    "gap": 15.6812
  },
  "endBinding": null,
  "points": [[0,0],[0,109]],
  "startArrowhead": null,
  "endArrowhead": null
}
```

이 예에서 화살표의 `startBinding`은 ID가 `"xw25sQBsbd2mecyjTrYHA"`인 도형을 가리키며, `focus`와 `gap`은 그 도형 경계에서 시작하는 연결 위치를 정의합니다.

동시에, 바인딩된 각 도형(사각형이나 타원 등)의 기본 데이터 구조에는 `boundElements` 목록이 있어, 그 도형에 연결된 모든 화살표나 텍스트 요소를 기록합니다. 이 필드 타입은 보통 `{ id: ExcalidrawLinearElement["id"]; type: "arrow"|"text"; }[] | null`입니다. 다시 말해, 화살표와 도형의 연결은 양방향으로 유지됩니다. 화살표는 자신이 바인딩하는 대상 요소 ID를 기록하고, 대상 요소는 자신을 가리키는 화살표 ID를 기록합니다.

### tldraw의 바인딩 {#tldraw-binding}

tldraw에서 "연결선" 자체도 도형이며(기본값은 화살표 도형), 연결 관계는 Binding 객체로 표현됩니다. 각 바인딩 레코드는 스토리지에 따로 존재하며, 두 도형 사이의 연관을 나타냅니다. 화살표 연결에는 `TLArrowBinding` 타입을 쓰며, 이는 `TLBaseBinding<'arrow',TLArrowBindingProps>`의 특수화입니다. 전형적인 화살표 바인딩 레코드의 예는 다음과 같습니다.

```ts
{
  id: 'binding:abc123',
  typeName: 'binding',
  type: 'arrow',           // Binding type is arrow
  fromId: 'shape:arrow1',  // Arrow shape ID (arrow shape departure end)
  toId:   'shape:rect1',   // Target shape ID (shape the arrow points to)
  props: {
    terminal: 'end',       // Which end of the arrow to bind to (start or end)
    normalizedAnchor: { x: 0.5, y: 0.5 }, // Normalized anchor point on target shape
    isExact: false,        // Whether arrow enters inside target shape
    isPrecise: true,       // Whether to use anchor point precisely, otherwise use shape center
    snap: 'edge',          // Snap mode (such as edge snapping)
  },
  meta: {}
}
```

여기서 `fromId/toId` 필드는 도형 ID로 화살표와 대상을 연관 짓고, `props`에는 연결의 세부 정보(앵커 포인트, 정렬 옵션 등)가 저장됩니다.

### antv/g6 {#antv-g6}

연결 관계는 기하가 아니라 논리이며, 경로는 `type`과 간선 라우팅 알고리즘으로 계산합니다.

```ts
interface EdgeConfig {
    id?: string;
    source: string; // Source node ID
    target: string; // Target node ID

    sourceAnchor?: number; // Source node anchor index
    targetAnchor?: number; // Target node anchor index

    type?: string; // line / polyline / cubic / loop ...
    style?: ShapeStyle;
}
```

앵커는 노드에 선언하며, 좌표는 정규화되어 있습니다.

```ts
anchorPoints: [
    [0.5, 0], // top
    [1, 0.5], // right
    [0.5, 1], // bottom
    [0, 0.5], // left
];
```

간선에서는 앵커 인덱스를 사용합니다. tldraw의 `normalizedAnchor`와 매우 비슷하지만, G6는 앵커 정의의 권한을 노드에 둡니다.

```ts
{
    source: 'nodeA',
    target: 'nodeB',
    sourceAnchor: 1,
    targetAnchor: 3,
}
```

### mxGraph {#mxgraph}

mxGraph에는 완전한 연결 제약 시스템이 있으며, 노드 도형 위에 정의되어 연결이 허용되는 점을 나타냅니다.

```ts
class mxConnectionConstraint {
    point: mxPoint | null; // (0.5, 0) = top center (1, 0.5) = right center
    perimeter: boolean; // Indicates projection along shape boundary
}
```

### JSON Canvas Spec {#json-canvas-spec}

Obsidian은 [JSON Canvas Spec]을 공개합니다. 구조는 `antv/g6`와 비슷하며, 최상위에 노드와 간선의 배열을 저장합니다.

```json
{
    "nodes": [],
    "edges": []
}
```

간선은 다음과 같습니다. 기하는 없고, 논리적 연결만 담습니다.

```json
{
    "id": "f67890123456789a",
    "fromNode": "6f0ad84f44ce9c17",
    "toNode": "a1b2c3d4e5f67890"
}
```

## 우리 설계 {#our-design}

스키마에서는 mxGraph의 방식에 더 기댑니다. 간선 위의 논리 관계는 `fromId`와 `toId`로 표현하므로, `x1/y1` 같은 기하 필드는 필요 없습니다. `rect-1`과 `rect-2`를 잇는 화살표는 이렇게 선언합니다.

```ts
const edge1 = {
    id: 'line-1',
    type: 'line',
    fromId: 'rect-1',
    toId: 'rect-2',
    stroke: 'black',
    strokeWidth: 10,
    markerEnd: 'line',
};
```

제약은 노드에 두며, [mxConnectionConstraint]와 비슷합니다.

```ts
interface ConstraintAttributes {
    /**
     * Normalized point, relative to bounding box top-left.
     */
    point: [number, number];
    /**
     * Use perimeter.
     */
    perimeter: boolean;
    name?: string;
    dx?: number;
    dy?: number;
}
```

[18강 - 부모-자식 컴포넌트 정의]와 비슷하게, 양방향 바인딩 관계를 구현할 수 있습니다.

```ts
class Binding {
    @field.ref declare from: Entity;
    @field.ref declare to: Entity;
}

class Binded {
    @field.backrefs(Binding, 'from') declare fromBindings: Entity[];
    @field.backrefs(Binding, 'to') declare toBindings: Entity[];
}
```

### 특수한 경우 {#special-case}

다음 강의에서는 `fromId/toId`가 null일 수 있는 특수한 경우를 만납니다. 아래 시퀀스 다이어그램의 점선이 이를 나타내며, `fromId: 'alice', toId: undefined`입니다.

![D2의 시퀀스 다이어그램](/d2.png)

연관된 노드가 한쪽뿐인 관계를 기록하는 새 컴포넌트를 도입합니다.

```ts
/**
 * Edge with only one end attached to a shape; the other end is fixed by `sourcePoint` / `targetPoint`.
 * `attached` is the entity on the connected side; `sourceIsAttached === 1` means the connection is on the source (`fromId`) side.
 */
class PartialBinding {
    @field.ref declare attached: Entity;
    /** 1 = source (from) side attached to node, 0 = target (to) side */
    @field.int32 declare sourceIsAttached: number;
}
```

<BindingDangling />

## 자동 갱신 {#auto-update}

연결된 도형의 위치가 바뀌면, 바인딩된 간선의 경로를 다시 계산해야 합니다. `Binded` 컴포넌트를 가진 모든 도형을 조회하고, 바운딩 박스 변화를 감시한 뒤, 그 시점에 바인딩된 간선을 갱신할 수 있습니다.

```ts
class RenderBindings extends System {
    private readonly boundeds = this.query(
        (q) => q.with(Binded).changed.with(ComputedBounds).trackWrites,
    );

    execute() {
        const bindingsToUpdate = new Set<Entity>();
        this.boundeds.changed.forEach((entity) => {
            const { fromBindings, toBindings } = entity.read(Binded);
            [...fromBindings, ...toBindings].forEach((binding) => {
                bindingsToUpdate.add(binding);
            });
        });
        // Recalculate paths of bound edges and render
    }
}
```

아래 예에서는 노드를 드래그해 볼 수 있으며, 간선은 경로를 다시 계산하고 다시 그립니다.

<Binding />

현재 간선의 시작점과 끝점은 연결된 도형의 바운딩 박스 중심이며, tldraw에서 `isPrecise`가 `false`일 때의 효과와 같습니다. 이는 정밀하지 않은 바인딩을 뜻합니다.
대부분의 경우, 화살표가 연결된 도형을 관통하지 않고 도형 가장자리에 깔끔하게 닿기를 원합니다.

## 둘레 알고리즘 {#perimeter}

도형 경계에 대해 drawio는 `perimeter` 속성을 제공하며, 이 값을 바꾸면 연결에 영향을 줍니다. 자세한 내용은 [Change the shape perimeter]를 참고하세요.

![둘레 스타일과 포트 제약](https://drawio-app.com/wp-content/uploads/2019/02/drawio-perimeter-constraint-styles.png)

```ts
// Note: generally next is passed as "the other center point", orthogonal is usually false
var pointA = graph.view.getPerimeterPoint(stateA, centerB, false, 0);
var pointB = graph.view.getPerimeterPoint(stateB, centerA, false, 0);
```

### 사각형 둘레 알고리즘 {#rectangle-perimeter}

사각형 둘레 알고리즘이 가장 흔히 쓰입니다. 아래 구현에서 `vertex`는 소스 노드이고, `next`는 대상 노드의 바운딩 박스 중심입니다.
먼저 소스 노드와 대상 노드 바운딩 박스의 중심을 잇는 선을 긋고, 대상 점이 소스 노드 바운딩 박스의 어느 변에 더 가까운지 판정합니다. 바운딩 박스의 두 대각선이 평면을 네 영역으로 나눕니다. 왼쪽 경계의 범위는 $[-\pi+t, \pi-t]$ 바깥의 영역입니다(즉, 코드의 `alpha < -pi + t || alpha > pi - t` 판정).

```ts
function rectanglePerimeter(
    vertex: SerializedNode,
    next: IPointData,
    orthogonal: boolean,
): IPointData {
    const { x, y, width, height } = vertex;
    const cx = x + width / 2; // Source node center
    const cy = y + height / 2;
    const dx = next.x - cx;
    const dy = next.y - cy;
    const alpha = Math.atan2(dy, dx); // Slope of line from source node center to target node center
    const p: IPointData = { x: 0, y: 0 };
    const pi = Math.PI;
    const pi2 = Math.PI / 2;
    const beta = pi2 - alpha;
    const t = Math.atan2(height, width); // Diagonals divide into four regions
    if (alpha < -pi + t || alpha > pi - t) {
        // Intersects with left edge
        p.x = x;
        p.y = cy - (width * Math.tan(alpha)) / 2; // Calculate intersection point
    }
    // Other three edges omitted
    return p;
}
```

마지막으로, 그 선과 해당 변의 교점을 최종 선의 출발점으로 계산합니다. 예를 들어 선이 "왼쪽 변"을 지난다고 판정했을 때:

1. $x$ 좌표를 정합니다. 왼쪽 변이므로, 교점의 $x$ 좌표는 사각형의 왼쪽 경계 값인 `vertex.x`와 같아야 합니다.
2. $y$ 오프셋을 계산합니다.
    1. 중심에서 왼쪽 변까지의 수평 거리는 `width / 2`입니다.
    2. 탄젠트 공식을 사용합니다. $\tan(\alpha) = \frac{\Delta y}{\Delta x}$.
    3. 왼쪽에서는 $\Delta x = -(\text{width} / 2)$입니다.
    4. 따라서 수직 오프셋은 $\Delta y = \Delta x \cdot \tan(\alpha) = -\frac{\text{width}}{2} \cdot \tan(\alpha)$입니다.
3. 최종 좌표는 `p.y = cy + Δy`이며, 코드에서는 `cy - (width * Math.tan(alpha)) / 2`입니다.

draw.io는 또 다른 옵션 `orthogonal`도 제공합니다. 계산된 선이 직교로 정렬되어야 한다는 뜻입니다(즉, x축 또는 y축에 맞춥니다). 선은 수평 또는 수직 연장만 고려합니다. 이 경우에는 상대편 중심점을 기준으로 쓸 수 없습니다.

```ts
if (orthogonal) {
    if (next.x >= x && next.x <= x + width) {
        p.x = next.x;
    } else if (next.y >= y && next.y <= y + height) {
        p.y = next.y;
    }
    if (next.x < x) {
        p.x = x;
    } else if (next.x > x + width) {
        p.x = x + width;
    }
    if (next.y < y) {
        p.y = y;
    } else if (next.y > y + height) {
        p.y = y + height;
    }
}
```

<BindingOrthogonal />

### 타원 둘레 알고리즘 {#ellipse-perimeter}

타원 노드에서는 선과 타원의 교점을 계산해야 합니다.

```ts
const d = dy / dx;
const h = cy - d * cx;
const e = a * a * d * d + b * b;
const f = -2 * cx * e;
const g = a * a * d * d * cx * cx + b * b * cx * cx - a * a * b * b;
const det = Math.sqrt(f * f - 4 * e * g);

const xout1 = (-f + det) / (2 * e);
const xout2 = (-f - det) / (2 * e);
const yout1 = d * xout1 + h;
const yout2 = d * xout2 + h;
const dist1 = Math.sqrt(Math.pow(xout1 - px, 2) + Math.pow(yout1 - py, 2));
const dist2 = Math.sqrt(Math.pow(xout2 - px, 2) + Math.pow(yout2 - py, 2));

let xout = 0;
let yout = 0;
if (dist1 < dist2) {
    xout = xout1;
    yout = yout1;
} else {
    xout = xout2;
    yout = yout2;
}
return { x: xout, y: yout };
```

선은 중심 $(cx, cy)$를 지나며, 그 방정식은 $y = d \cdot x + h$입니다.

-   기울기 $d = \frac{dy}{dx}$
-   절편 $h = cy - d \cdot cx$

직선의 방정식을 타원의 표준 방정식에 대입합니다.

$$\frac{(x-cx)^2}{a^2} + \frac{(d \cdot x + h - cy)^2}{b^2} = 1$$

전개하고 정리하여 $x$에 대한 이차방정식 $ex^2 + fx + g = 0$으로 만듭니다. 코드의 e, f, g는 다음에 대응합니다.

-   $e$: 이차항 계수
-   $f$: 일차항 계수
-   $g$: 상수항

근의 공식: 판별식 $det = \sqrt{f^2 - 4eg}$로 두 교점 $xout1$과 $xout2$를 계산합니다. 점 하나를 고릅니다. 타원을 지나는 반직선은 교점을 두 개 만듭니다(앞쪽 하나, 뒤쪽 하나). 코드는 두 교점에서 대상 점 `next`까지의 거리(dist1과 dist2)를 계산하고, 더 가까운 점을 선택합니다.

<BindingWithEllipse />

## 제약 {#constraint}

여기까지, 간선의 논리 연결을 `fromId`와 `toId`만으로 구현했습니다. 간선과 노드의 연결점은 떠 있으며, mxGraph에서는 `FloatingTerminalPoint`라고 합니다. 그러나 때로는 간선이 노드의 고정된 위치에서 출발해, 연결된 도형의 고정된 위치로 들어가기를 원합니다. mxGraph에서는 이를 `FixedTerminalPoint`라고 합니다. 이런 경우에는 제약을 정의해야 하며, 과정을 노드와 간선으로 나눕니다.

### 노드의 제약 {#constraint-on-node}

노드 제약은 어디에서, 어떤 방식으로 연결할 수 있는지를 정의합니다. 그것은 "점"이 아니라 규칙 객체이며, mxGraph에서는 다음과 같이 정의됩니다.

```ts
class mxConnectionConstraint {
    point: mxPoint | null; // Normalized coordinates (0~1)
    perimeter: boolean; // Whether to project onto the boundary
    name?: string; // Optional port name
}
```

함께 제공되는 draw.io 편집기에서는 다이어그램 위에 수많은 "파란색 연결점"을 볼 수 있습니다. 이들은 다이어그램의 제약을 재정의하여 정의됩니다.

```ts
mxRectangleShape.prototype.getConstraints = function (style) {
    return [
        new mxConnectionConstraint(new mxPoint(0.5, 0), true), // top
        new mxConnectionConstraint(new mxPoint(1, 0.5), true), // right
        new mxConnectionConstraint(new mxPoint(0.5, 1), true), // bottom
        new mxConnectionConstraint(new mxPoint(0, 0.5), true), // left
    ];
};
```

우리 제약은 다음과 같이 정의됩니다. 노드에 제약의 집합을 선언할 수 있습니다.

```ts
export interface ConstraintAttributes {
    x?: number;
    y?: number;
    perimeter?: boolean;
    dx?: number;
    dy?: number;
}

export interface BindedAttributes {
    constraints: ConstraintAttributes[];
}
```

후보 제약을 가져오고, 가장 가까운 제약을 선택한 다음, 그 제약을 기하학적 점으로 변환합니다. 경계로 투영해야 하면, 이전 절에서 소개한 둘레 알고리즘의 계산 논리로 진행합니다.

### 간선의 제약 {#constraint-on-edge}

간선이 노드의 어느 앵커 포인트에서 나가거나 들어갈지도 정의해야 합니다. 상호작용에서는 간선의 끝점을 노드의 앵커 포인트 위로 드래그하는 것에 해당합니다. 이때 `entryX/entryY`는 앵커 포인트 제약의 `x/y` 필드를 복사해야 합니다.

```ts
interface BindingAttributes {
    fromId: string;
    toId: string;
    orthogonal: boolean;
    exitX: number; // [!code ++]
    exitY: number; // [!code ++]
    exitPerimeter: boolean; // [!code ++]
    exitDx: number; // [!code ++]
    exitDy: number; // [!code ++]
    entryX: number; // [!code ++]
    entryY: number; // [!code ++]
    entryPerimeter: boolean; // [!code ++]
    entryDx: number; // [!code ++]
    entryDy: number; // [!code ++]
}
```

아래 예에서는 회색 사각형과 초록 사각형에 각각 앵커 포인트 `[1, 0]`과 `[0, 1]`을 정의했습니다.

끝점 좌표 `exitX/exitY`와 `entryX/entryY`는 유한한 수여야 합니다. 어느 한쪽 좌표라도 유효하지 않으면, 끝점은 유한하지 않은 경로를 만들지 않고 도형 둘레로 되돌아갑니다. 유효하지 않은 픽셀 오프셋(`exitDx/exitDy` 또는 `entryDx/entryDy`)은 무시되며, 유효한 앵커는 고정된 채로 남습니다.

화살표 도구로 한 번 클릭해 소스를 고르고, 포인터를 움직여 연결을 미리 봅니다. 미리보기는 수평 이동과 수직 이동을 따르며, 어느 쪽 끝점이 빈 캔버스 위에 있을 때도 마찬가지입니다. 다시 클릭하면 완료되고, Escape를 누르면 취소됩니다.

<BindingConstraint />

## 라우팅 규칙 {#routing rules}

mxGraph는 EdgeStyle 함수로 라우팅 규칙을 구현하며, 이 함수들은 다음을 담당합니다.

-   출구 방향을 자동으로 선택합니다
-   경유점을 삽입합니다
-   노드 바운딩 박스를 피합니다
-   직교/직각 경로를 계산합니다

![커넥터 스타일](https://drawio-app.com/wp-content/uploads/2019/02/drawio-connector-styles.png)

| 커넥터           | 특징                                                         | 사용 사례                                          |
| ---------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| OrthConnector    | 복잡한 제약 지원과 함께 직교 간선을 자동으로 생성합니다      | 플로차트, 조직도 등 자동 레이아웃 시나리오         |
| SegmentConnector | 사용자가 정의한 제어점을 지원하며, 유연하고 상호작용적입니다 | 사용자가 직교 간선 경로를 수동으로 조정해야 할 때  |
| ElbowConnector   | 단일 L자형 꺾임                                              | 단순한 2구간 경로(예: 브레드크럼 탐색)             |
| SideToSide       | 수평 방향을 우선하는 연결                                    | 소스 노드와 대상 노드가 수평으로 배치될 때         |
| TopToBottom      | 수직 방향을 우선하는 연결                                    | 소스 노드와 대상 노드가 수직으로 배치될 때         |
| EntityRelation   | 데이터베이스 관계도 전용이며, 유연한 경로를 생성합니다       | 데이터베이스 ER 다이어그램, 양방향 관계            |
| Loop             | 자기 루프 연결을 구현합니다                                  | 상태 다이어그램이나 오토마톤 차트의 자기 루프 관계 |

### OrthConnector {#orth-connector}

[OrthConnector]는 가장 흔한 라우팅 알고리즘입니다. 핵심 목표는 소스 노드와 대상 노드 사이에 수평 선분과 수직 선분만으로 이루어진 경로를 만들어 대각선을 피하는 것입니다. 구체적인 단계는 다음과 같습니다.

1. 소스와 대상의 출구/입구 방향을 정합니다
2. 방향 조합에 따라 미리 정의된 라우팅 패턴을 찾습니다
3. 라우팅 패턴을 적용해 꺾임점의 순서를 생성합니다
4. 장애물 회피와 최적화를 처리합니다

```ts
┌──────┐        ┌──────┐
│ Node │ ─┐     │ Node │
└──────┘  └────▶└──────┘
```

<BindingRouteOrthConnector />

#### 선호 포트 선택 {#preferred-port-selections}

먼저 포트 제약이 없는 경우를 봅니다. 첫 단계는 소스에 대한 대상의 사분면 위치를 정하는 것입니다. 둘의 기하학적 중심점을 비교하면 다음을 얻습니다.

```ts
// 0 | 1
// -----
// 3 | 2

let dx = sourceCenX - targetCenX;
let dy = sourceCenY - targetCenY;
let quad = 0;
if (dx < 0) {
    if (dy < 0) {
        quad = 2;
    } else {
        quad = 1;
    }
}
// Other circumstances omitted.
```

다음은 가장 복잡한 부분입니다. 간선이 소스 노드에서 어느 방향으로 나가고, 대상 노드로 어느 방향으로 들어갈지 정합니다.

먼저 노드 사이의 거리를 계산합니다.

```ts
        sourceTopDist
             ↑
    [Source] |
             ↓
        sourceBottomDist
             ↑
             | [Target]

sourceLeftDist ← [Source] → sourceRightDist → [Target]
```

그런 다음, 가용 공간이 더 큰 방향을 선호하는 전략으로 선호 방향을 정합니다.

-   왼쪽까지의 거리 ≥ 오른쪽까지의 거리이면, 소스 노드는 서쪽(왼쪽)으로 가기를 선호합니다.
-   위까지의 거리 ≥ 아래까지의 거리이면, 소스 노드는 북쪽(위)으로 가기를 선호합니다.
-   대상 노드의 선호 방향은 소스 노드의 반대 방향입니다.

```ts
var dirPref = [];
var horPref = [];
var vertPref = [];

horPref[0] =
    sourceLeftDist >= sourceRightDist
        ? mxConstants.DIRECTION_MASK_WEST
        : mxConstants.DIRECTION_MASK_EAST;
vertPref[0] =
    sourceTopDist >= sourceBottomDist
        ? mxConstants.DIRECTION_MASK_NORTH
        : mxConstants.DIRECTION_MASK_SOUTH;

horPref[1] = mxUtils.reversePortConstraints(horPref[0]);
vertPref[1] = mxUtils.reversePortConstraints(vertPref[0]);

var preferredHorizDist =
    sourceLeftDist >= sourceRightDist ? sourceLeftDist : sourceRightDist;
var preferredVertDist =
    sourceTopDist >= sourceBottomDist ? sourceTopDist : sourceBottomDist;
```

#### 라우트 패턴 선택 {#choose-route-patterns}

소스와 대상의 방향 인덱스를 바탕으로, 품질을 보장하도록 미리 정의된 `routePatterns`에서 라우트 패턴을 고릅니다. 비트마스크로 인코딩합니다.

-   하위 4비트: 방향(1=서쪽, 2=북쪽, 4=동쪽, 8=남쪽)
-   5-8비트: 간선의 어느 쪽인지
-   9비트: 중심점을 사용할지
-   10비트: 소스 노드와 연관할지
-   11비트: 대상 노드와 연관할지

```ts
routePatterns: [
    [ [ 513, 2308, 2081, 2562 ], [ 513, 1090, 514, 2184, 2114, 2561 ],
        [ 513, 1090, 514, 2564, 2184, 2562 ],
        [ 513, 2308, 2561, 1090, 514, 2568, 2308 ] ],
    // ... more patterns
],
```

#### 경유점 생성 {#generate-waypoints}

라우팅 패턴을 순회하고, 방향에 따라 실제 경로 점을 생성합니다.

```ts
for (var i = 0; i < routePattern.length; i++)
{
    var nextDirection = routePattern[i] & 0xF;

    // Rotate the index of this direction by the quad
    var directionIndex = nextDirection == mxConstants.DIRECTION_MASK_EAST ? 3
            : nextDirection;

    directionIndex += quad;

    if (directionIndex > 4)
    {
        directionIndex -= 4;
    }
```

마지막으로, 서로 매우 가까이 있는 인접 경로 점을 단순화합니다. 이를 위해 [12강 - 폴리라인 단순화]에서와 같이 [simplify-js]를 계속 사용합니다.

### SegmentConnector {#segment-connector}

OrthConnector는 자동 라우팅 쪽에 가깝습니다. 사용자가 제어점 `controlHints`를 명시하면, SegmentConnector는 그 힌트를 반드시 지나거나 정렬해야 하는 경유점으로 바꾸고, 결과 폴리라인은 대체로 이 힌트를 중심으로 만들어집니다. 그래서 상호작용 편집에서 더 예측 가능하고 일관됩니다.

### LoopConnector {#loop-connector}

시작과 끝이 일치하면 자기 루프가 필요합니다.

<BindingLoop />

## 커넥터 선 스타일 {#connectors-style}

![출처: https://www.drawio.com/doc/faq/connector-styles](https://www.drawio.com/assets/img/blog/style-tab-line-style.png)

### 둥근 모서리 {#rounded}

둥근 모서리는 앞서 계산한 폴리라인 경유점을 그대로 쓰되, 이음에서 뾰족한 모서리를 부드러운 전환으로 바꿉니다. 단계는 다음과 같습니다.

-   폴리라인의 각 꺾임을 따라갑니다.
-   각 모서리 양쪽에서 선분을 따라 뒤로 물러납니다(최대 선분 길이의 절반).
-   `quadTo`(또는 동등한 곡선 명령)로 모서리에 부드러운 필렛을 그립니다.

<BindingRounded />

### 이차 베지에 {#curved}

이차 베지에 선분으로 인접한 제어점을 연결합니다.

```ts
const p0 = pts[n - 2];
const p1 = pts[n - 1];
parts.push(
    `Q ${formatNumber(p0.x)} ${formatNumber(p0.y)} ${formatNumber(
        p1.x,
    )} ${formatNumber(p1.y)}`,
);
```

<BindingCurved />

### 삼차 베지에 {#bezier}

점이 `3n+1`개이면 `[anchor, cp1, cp2, anchor, ...]` 형태의 삼차 베지에 제어점으로 직접 해석합니다. 그렇지 않으면 이차 베지에 선분으로 되돌립니다.

```ts
if ((n - 1) % 3 === 0) {
    for (let i = 1; i + 2 < n; i += 3) {
        const cp1 = pts[i];
        const cp2 = pts[i + 1];
        const end = pts[i + 2];
        parts.push(
            `C ${formatNumber(cp1.x)} ${formatNumber(cp1.y)} ` +
                `${formatNumber(cp2.x)} ${formatNumber(cp2.y)} ` +
                `${formatNumber(end.x)} ${formatNumber(end.y)}`,
        );
    }
    return parts.join(' ');
}
```

<BindingBezier />

### 편집 가능한 곡선 유지 {#editable-curves}

ECS `path` 또는 `rough-path`에 편집 가능한 `Q` 또는 `C` 선분이 하나이면, 문서를 불러오거나 바인딩을 갱신할 때 제어점을 유지합니다. 바인딩된 끝점을 움직이면 인접한 삼차 제어점도 함께 움직입니다. 하나의 이차 곡선이 양쪽 끝점을 직접 이을 때, 공유 제어점은 두 변위의 평균만큼 움직입니다. 따라서 양쪽 끝을 같은 양만큼 움직이면 그 곡선은 모양을 바꾸지 않고 평행 이동합니다.
바인딩되지 않은 끝점은 저장된 `sourcePoint`나 `targetPoint`가 오래되었더라도 편집된 기하를 유지합니다. 이 변화를 적용할 때 회전, 반사, 스케일이 포함됩니다. 베지에 선분이 여러 개인 라우트는 계속 라우터를 사용합니다.

### 간선 레이블 {#edge-labels}

자식 `text` 노드는 `edgeLabelPosition`으로 부모 간선 위의 위치를 지정할 수 있습니다. 값은 `[0, 1]`로 클램프됩니다. `edgeLabelOffset`은 법선을 따른 부호 있는 거리이며, 양수이면 왼쪽에서 오른쪽으로 향하는 수평 간선의 아래에 레이블을 둡니다. 두 속성 중 하나를 편집하면 레이블이 즉시 갱신되며, 실행 취소, 다시 실행, 문서 다시 불러오기를 지원합니다. `edgeLabelOffset`을 지우면 0으로 되돌리고, `edgeLabelPosition`을 지우면 자동 배치를 끕니다.

패스 레이블은 현재 명령 끝점으로 이루어진 폴리라인을 따라 보간하며, 각 곡선 선분에는 현을 사용합니다. 지원하는 명령에는 `H/V`, `S/T`, `A`와 함께 `L`, `Q`, `C`가 있습니다. 이것은 곡선 길이의 근사이며, 곡선 윤곽을 따른 정확한 배치는 아닙니다.

## [WIP] SVG 내보내기 {#export-svg}

내보낼 때는 기하 정보만 저장하는 것으로는 충분하지 않으며, 논리 관계도 함께 보존해야 합니다. 예를 들어 draw.io는 내보낼 때 원본 mxfile 내용을 `<svg>`의 `content` 속성에 저장합니다(이것은 어떤 정식 스펙의 일부도 아닙니다).

```html
<svg content='&lt;mxfile host="app.diagrams.net" diagram name="Page-1"'></svg>
```

다음과 같이 쓸 수도 있습니다.

```html
<line x1="0" y1="0" data-binding="" />
```

## 편집기 {#editor}

### 앵커 강조 {#highlight-anchors}

-   노드가 선택되면, 연결을 시작할 수 있는 사용 가능한 앵커 포인트를 표시합니다.
-   간선이 선택되면, 드래그하는 동안 도킹할 수 있는 앵커 포인트를 강조합니다.

<BindingArrow />

[23강 - 마인드맵]: /ko/guide/lesson-023
[25강 - 화살표 그리기]: /ko/guide/lesson-025#draw-arrow
[18강 - 부모-자식 컴포넌트 정의]: /ko/guide/lesson-018#define-component
[Change the shape perimeter]: https://www.drawio.com/doc/faq/shape-perimeter-change
[JSON Canvas Spec]: https://jsoncanvas.org/spec/1.0/
[mxConnectionConstraint]: https://github.com/jgraph/drawio/blob/81a267568da862d3c99970758c09a8e768dea973/src/main/webapp/mxgraph/src/view/mxConnectionConstraint.js#L23
[OrthConnector]: https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/view/mxEdgeStyle.js#L1067
[simplify-js]: https://github.com/mourner/simplify-js
[12강 - 폴리라인 단순화]: /ko/guide/lesson-012#simplify-polyline
