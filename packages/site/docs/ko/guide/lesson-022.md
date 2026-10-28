---
outline: deep
description: 'SVG 패스의 고급 대안으로 VectorNetwork를 살펴봅니다. 위상 정의, 공유 정점과 변, 채우기 알고리즘, 복잡한 벡터 그래픽 편집을 위한 위상 연산자를 다룹니다.'
head:
    - ['meta', { property: 'og:title', content: '22강 - VectorNetwork' }]
---

<script setup>
import VectorNetwork from '../../components/VectorNetwork.vue';
import VectorNetworkCube from '../../components/VectorNetworkCube.vue';
import VectorNetworkFaceCut from '../../components/VectorNetworkFaceCut.vue';
</script>

# 22강 - VectorNetwork {#lesson-22-vectornetwork}

이번 강의에서는 다음 내용을 다룹니다.

-   SVG Path의 한계
-   VectorNetwork란 무엇인가
-   펜 도구로 Path 수정하기
-   더블 클릭으로 벡터 편집 모드에 들어가 Move / Bend / Cut / Fill 도구 사용하기
-   위상 연산자: 세그먼트 분할, 정점 삭제, Cut으로 닫힌 루프 열기

## SVG Path의 한계 {#limitations-of-svg-path}

[Lesson 13 - Drawing path and sketchy style]에서 패스를 그리는 방법을 배웠습니다. Figma도 [VectorPath API]를 제공하며, SVG Path 명령의 일부(참고: [VectorPath-data])와 [fillRule]（Figma에서는 windingRule）을 지원합니다.

```ts
node.vectorPaths = [
    {
        windingRule: 'EVENODD',
        data: 'M 0 100 L 100 100 L 50 0 Z',
    },
];
```

그렇다면 왜 [VectorNetwork API]를 도입할까요? SVG Path에는 몇 가지 근본적인 한계가 있기 때문입니다. [The Engineering behind Figma's Vector Networks] 글이 이를 생생하게 보여 줍니다. 다음 도형은 Path 하나만으로는 표현할 수 없습니다.

![유효하지 않은 패스](https://alexharri.com/images/posts/vector-networks/3.svg)

여러 Path로 나누어야만 표현할 수 있습니다. 가능하기는 하지만, 편집 상황에서는 직관적인 조작 일부를 할 수 없습니다. 예를 들어 왼쪽 아래의 중심 정점을 드래그하면, 서로 독립된 두 Path로 이루어져 있어서 정점 하나만 따라옵니다.

![더 복잡한 도형을 만들기 위해 여러 패스를 사용합니다](https://alexharri.com/images/posts/vector-networks/4.svg)

정점이 변을 2개보다 많이 가질 수 없는 것에 더해, 변도 공유할 수 없습니다. [Vector Graphics Complexes]의 원논문과 PPT는 SVG와 Planar map을 비교하는데, 둘 다 겹침, 공유 정점, 공유 변을 지원하지 못합니다. 그래서 새로운 기하 표현(이하 VGC)이 나왔습니다.

![SVG와 Planar map의 비교](/svg-path-vector-network-comparison.jpeg)

[vpaint]는 VGC를 기반으로 구현되었습니다. 점과 변을 합친 뒤 편집할 때 상호작용이 얼마나 자연스러운지 볼 수 있습니다.

![vpaint](https://camo.githubusercontent.com/42f888c041ecc6799e9fe2bd3c895fcd8037417188a0d1db840e0ce0701a5201/68747470733a2f2f7777772e7667632e696f2f696d616765732f676c75652d30312d332d32346670732e676966)

또는 [The Engineering behind Figma's Vector Networks]에서 큐브의 한 변을 드래그하는 예를 보겠습니다.

![큐브의 변을 드래그](https://alexharri.com/images/posts/vector-networks/31.svg)

더블 클릭하여 편집 모드에 들어간 뒤, 큐브의 아무 변이나 드래그해 보세요.

<VectorNetworkCube />

[Discussion in HN]에서는 VGC와 Figma의 VectorNetwork가 놀랄 만큼 비슷하다고 지적합니다. 둘 다 비슷한 시기에 탐색을 시작했고, 다른 경로로 비슷한 해법에 이르렀기 때문에 이후에는 VectorNetwork라는 용어를 사용합니다.

> CEO of Figma here. Most of the original insights around vector networks were in 2013, though we continued to polish the implementation over time. We didn't exit stealth and ship the closed beta of Figma until December 2015 which is why there isn't blog content before then.
> At first glance, this thesis looks super neat! I'm excited to check it out! I don't believe I've seen it before which is surprising given the overlap.

VectorNetwork가 어떻게 정의되는지 살펴보겠습니다.

## VectorNetwork의 위상 정의 {#topology-of-vector-network}

VectorNetwork/VGC의 정의는 Path보다 훨씬 복잡합니다. 자료 구조는 정점, 변, 면(채워진 영역)으로 이루어진 그래프입니다. 다음 그림은 [Vector Graphics Complexes] 원논문에서 가져왔습니다.

![VGC의 위상](/vgc-topology.png)

여기서는 위상 정의만 다룹니다. 그 밖의 그리기 속성은 Path와 같게 둘 수 있습니다.

> On top of this core structure, more drawing attributes can be added for fine control on rendering. For instance, we added vertex radius, variable edge width, cell color (possibly transparent), and edge junctions style (mitre join or bevel join).

정점은 이해하기 쉽습니다. VGC에서 변은 `start`와 `end` 정점 인덱스 한 쌍으로 이루어지며, 둘이 일치하면 자기 루프가 됩니다.

![VGC의 노드와 변](/vgc-node-edge.png)

채워진 영역은 정점으로 이루어진 닫힌 루프로 정의됩니다. VGC에서는 하프에지 집합으로 정의합니다.

![VGC의 면](/vgc-face.png)

다음 삼각형 예는 [VectorNetwork API]에서 가져왔습니다. 채워진 영역이 정점 인덱스와 fillRule로 정의된다는 점을 제외하면 VGC와 기본적으로 같습니다. `strokeCap` 같은 비기하 속성은 Path와 같습니다.

```ts
node.vectorNetwork = {
    // The vertices of the triangle
    vertices: [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        { x: 50, y: 0 },
    ],

    // The edges of the triangle. 'start' and 'end' refer to indices in the vertices array.
    segments: [
        {
            start: 0,
            tangentStart: { x: 0, y: 0 }, // optional
            end: 1,
            tangentEnd: { x: 0, y: 0 }, // optional
        },
        {
            start: 1,
            end: 2,
        },
        {
            start: 2,
            end: 0,
        },
    ],

    // The loop that forms the triangle. Each loop is a
    // sequence of indices into the segments array.
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }],
};
```

Figma의 3차 곡선 규약을 따릅니다. *P*₀는 시작 앵커, *P*₃는 끝 앵커이고, *P*₁ = *P*₀ + `tangentStart`, *P*₂ = *P*₃ + `tangentEnd`입니다. 두 핸들이 앵커와 겹치면(직선) 점 두 개를 사용하고, 그렇지 않으면 `CubicBezierCurve.getPoints`로 샘플링합니다. 세그먼트 수는 현 길이와 제어 다각형을 기준으로 고릅니다(대략 8–64).

편집 상황에서는 정점과 변을 사용자가 정의하고, 채워진 영역은 시스템이 자동으로 계산해야 합니다. 그렇다면 이 채워진 영역은 어떻게 찾을까요?

### 채우기 {#filling}

`click to fill` 같은 조작에서는 정점이 이루는 최소 루프를 찾아야 합니다.

![출처: https://www.figma.com/blog/introducing-vector-networks/](https://alexharri.com/images/posts/vector-networks/40.gif)

VectorNetwork를 평면 그래프로 보고, 각 세그먼트를 방향이 있는 하프에지 두 개로 나눕니다. 모든 정점에서 나가는 변을 극각 순으로 정렬한 뒤, “다음 하프에지”(들어오는 역방향 변을 기준으로 가장 시계 방향인 나가는 변)를 따라가면 모든 최소 면을 열거할 수 있습니다. 클릭 위치를 둘러싼 면 가운데 가장 작은 면이 대상 영역이며, 그 정렬된 세그먼트 인덱스 루프를 `VectorRegion.loops`에 쓰면 위의 채우기 테셀레이션을 그대로 재사용합니다.

```ts
export function findRegionLoopAtPoint(
    vertices: VectorVertexLike[],
    segments: VectorSegmentLike[],
    point: [number, number],
): number[] | null;
```

> 수치 안정성: 한 직선 위의 변, 겹치는 정점, 자기 루프는 모두 EPS 허용 오차와 퇴화 경우 처리가 필요합니다. 이 순회에서 바깥쪽 무한 면의 부호 있는 면적은 양수이므로 건너뛰어야 합니다.

### VectorNetwork으로 변환 {#convert-to-vector-network}

[figma-fill-rule-editor]를 따라 다음 타입 정의를 사용합니다.

```ts
export class VectorNetwork {
    @field.object declare vertices: VectorVertex[];
    @field.object declare segments: VectorSegment[];
    @field.object declare regions?: VectorRegion[];
}

interface VectorVertex {
    x: number;
    y: number;
    strokeLinecap?: Stroke['linecap'];
    strokeLinejoin?: Stroke['linejoin'];
    cornerRadius?: number;
    handleMirroring?: HandleMirroring;
}

interface VectorSegment {
    start: number;
    end: number;
    tangentStart?: VectorVertex;
    tangentEnd?: VectorVertex;
}

interface VectorRegion {
    fillRule: CanvasFillRule;
    loops: ReadonlyArray<ReadonlyArray<number>>;
}
```

[Polyline]은 VectorNetwork으로 바꾸기 가장 쉬운 도형입니다.

```ts
class VectorNetwork {
    static fromEntity(entity: Entity): VectorNetwork {
        if (entity.has(Polyline)) {
            const { points } = entity.read(Polyline);
            const vertices: VectorVertex[] = points.map(([x, y]) => ({ x, y }));
            const segments: VectorSegment[] = points.slice(1).map((_, i) => ({
                start: i,
                end: i + 1,
            }));

            return { vertices, segments };
        }
    }
}
```

[Path] 변환은 단계가 더 많습니다. SVG 패스 명령을 정규화한 뒤(`path2Absolute`) 각 명령을 차례로 해석합니다. `M/L/H/V`는 직선 세그먼트를 만들고, `C/S/Q/T`는 3차 곡선을 만듭니다(`Q/T`는 먼저 3차로 차수를 올립니다). 절대 제어점은 Figma 스타일의 상대 탄젠트 `tangentStart = P1 - P0`, `tangentEnd = P2 - P3`로 바꿉니다. `S/T`는 반사를 위해 이전 제어점을 추적합니다. `Z`에서는 마지막 점이 시작점과 겹치면 중복을 피하려고 시작 정점을 다시 사용하고, 닫힌 서브패스는 영역 루프를 만듭니다. 이 로직은 순수 함수 `pathToVectorNetwork(d, fillRule)`에 있으며, `fromEntity`가 `entity.has(Path)`일 때 호출합니다.

## 테셀레이션 {#tessellatation}

### 스트로크 {#stroke}

그래프를 폴리라인으로 바꾼 뒤 [Lesson 12 - Draw polyline]의 방식으로 렌더링합니다.

-   정점마다 인접 관계를 유지합니다.
-   사용하지 않은 변을 따라갑니다. 시작 변에서 앞과 뒤로 늘리고, 현재 정점에 사용하지 않은 변이 정확히 하나 남을 때만 계속하므로, 차수 2인 접합은 하나의 폴리라인이 됩니다(캡 대신 조인).
-   분기(차수 ≥ 3)에서 멈추고, 서브패스 사이는 `NaN`으로 구분합니다.

순회한 각 변에 대해:

-   Figma 3차 곡선을 사용합니다. *P*₀와 *P*₃는 앵커이고, *P*₁ = *P*₀ + `tangentStart`, *P*₂ = *P*₃ + `tangentEnd`입니다.
-   직선 변(핸들이 앵커에 있음)은 점 두 개를 사용합니다.
-   그 외에는 현 길이와 제어 다각형에서 구한 세그먼트 수로 `CubicBezierCurve.getPoints`를 사용합니다.

```ts
function tessellateVectorSegment(
    vertices: VectorVertexLike[],
    seg: VectorSegmentLike,
): number[] {
    const a = vertices[seg.start];
    const b = vertices[seg.end];
    const p0 = vec2.fromValues(a.x, a.y);
    const p3 = vec2.fromValues(b.x, b.y);

    const ts = seg.tangentStart;
    const te = seg.tangentEnd;
    const p1 = vec2.create();
    const p2 = vec2.create();
    vec2.add(p1, p0, vec2.fromValues(ts?.x ?? 0, ts?.y ?? 0));
    vec2.add(p2, p3, vec2.fromValues(te?.x ?? 0, te?.y ?? 0));
}
```

<VectorNetwork />

### 채우기 {#fill}

Figma `loops` 항목(정렬된 세그먼트 인덱스)을 각각 따라가며, 3차 곡선을 포함한 모든 변을 같은 `tessellateVectorSegment`로 테셀레이션합니다. 순회 순서대로 이어 붙이고, 중복 점을 버린 뒤 고리를 닫습니다.

-   각 영역과 각 루프마다 닫힌 윤곽 하나를 만듭니다.
-   **nonzero** (또는 Figma `windingRule: 'NONZERO'`): 모든 윤곽에 nonzero 와인딩을 적용한 `triangulate`(libtess)를 사용합니다. 윤곽의 순서와 관계없이 연결되지 않은 섬과 중첩된 구멍을 지원합니다.
-   **evenodd** (또는 `EVENODD`): `triangulate`(libtess).
-   여러 영역은 순서대로 삼각화하고, 정점과 인덱스는 진행 중인 정점 오프셋과 함께 하나의 메시로 이어 붙입니다.

### 클릭하여 영역 채우기 {#click-to-fill}

VectorNetwork를 더블 클릭하고 **Fill**을 선택합니다. 마우스를 올리면 가장 작은 둘러싸인 면을 미리 보고, 클릭하면 채우며, 다시 클릭하면 지웁니다. 클릭 한 번이 실행 취소 한 단계입니다. 드래그, 취소된 포인터, 멀티터치 확대/축소는 채우기를 커밋하지 않습니다. 도구를 바꾸거나, Esc를 누르거나, 도형 밖의 빈 캔버스를 클릭하거나, 캔버스를 파괴하면 미리보기가 지워집니다.

아래 큐브는 **Fill** 모드로 시작합니다. 정면, 윗면, 오른쪽 면 위에 마우스를 올려 미리 본 뒤 클릭하여 채웁니다. 이웃한 면 두 개를 채운 다음 그중 하나를 다시 클릭하면 그 면만 지워집니다. 캔버스의 **Undo / Redo** 버튼으로 변경을 단계별로 살펴보세요.

<VectorNetworkCube fill />

**Fill** 모드에서 도구 버튼 옆의 색상 견본을 클릭하면 색상 선택기가 열립니다. 면을 클릭하기 전에 색을 고르거나 색상 값을 입력합니다. 색을 바꾸면 이 네트워크에서 이미 채워진 면도 모두 갱신되며, 색 변경은 실행 취소할 수 있습니다. 현재 면들은 채우기 스타일 하나를 공유합니다.

`findVectorNetworkFaces`는 방향 있는 하프에지를 따라가며, 안에 포함된 연결되지 않은 성분의 바깥 경계를 구멍으로 붙입니다. 미리보기와 새로 만든 영역은 `evenodd`를 쓰므로, 구멍은 변의 저장 방향에 의존하지 않습니다. 기존 `nonzero` / `evenodd` 채우기는 덮인 범위에 따라 최소 면으로 나뉘며, 한 면을 지워도 이웃 면의 채우기는 유지됩니다.

면은 노드의 `fills`를 공유합니다. 스트로크만 있는 네트워크의 첫 채우기는 펜에 설정된, 보이는 채우기를 사용하고, 없으면 파란색을 사용합니다. 미리보기는 일시적인 SVG 오버레이에만 있으며 문서, 내보내기, 히스토리에는 들어가지 않습니다. 피킹은 로컬 좌표를 사용하며 회전, 반사, 스케일을 지원합니다.

Fill은 면을 찾기 전에 임시 기하에서 교차점을 공유 정점으로 나눕니다. 호버는 문서를 바꾸지 않습니다. 첫 채우기 클릭이 위상과 페인트를 함께 커밋하고, 실행 취소 한 번으로 둘 다 되돌립니다. 면마다 독립된 페인트는 별도의 확장으로 남아 있습니다.

## 펜으로 그리기 {#drawing-with-pen}

**Vector Network** 펜을 선택합니다. 클릭하면 코너 앵커를 놓고, 드래그하면 스무스 앵커를 놓습니다. 첫 앵커는 첫 변이 커밋될 때까지 일시적인 미리보기로 남으므로, 점 하나만 두고 그만두면 빈 문서 노드가 생기지 않습니다.

드래그는 새 앵커의 나가는 핸들을 정합니다. 들어오는 핸들은 반대 벡터이고, 나가는 벡터는 다음 변의 `tangentStart`가 됩니다. 러버밴드 미리보기와 커밋된 기하 모두 같은 3차 제어를 사용하며, 첫 앵커를 드래그하는 경우도 포함합니다. 미리보기는 핸들 선도 보여 줍니다.

뷰포트 10픽셀 이내의 기존 앵커를 클릭하면 네트워크를 닫고 Select로 돌아갑니다. 스냅은 누른 위치를 사용하므로, 닫는 핸들을 멀리 드래그해도 정점이 더 생기지 않습니다. 닫힌 면은 자동으로 감지되어 펜에 설정된 채우기로 렌더링됩니다. 기본 스트로크 전용 스타일은 **Fill**을 사용하기 전까지 채워지지 않습니다. 활성 앵커를 클릭하거나 **Enter / Esc**를 누르면 열린 패스를 마칩니다. 끝나지 않은 드래그는 버립니다.

커밋된 변 하나가 실행 취소 한 단계입니다. 포인터 취소, 캔버스를 벗어남, 도구 전환은 대기 중인 제스처를 버리고, 커밋된 변은 남습니다. 실행 취소나 외부 기하 편집은 이어 그리기 지점을 지우므로, 다음 스트로크가 이미 유효하지 않은 정점에 붙지 않습니다. 미리보기는 그 캔버스의 SVG 오버레이에 속하며 저장된 노드, 히스토리, 내보내기에는 포함되지 않습니다. 캔버스를 파괴하면 미리보기도 제거됩니다.

### 기존 네트워크에서 이어서 그리기 {#resume-with-pen}

VectorNetwork를 선택하고 펜으로 전환합니다. 기존 정점 근처에 마우스를 올리면 스냅 표시가 보입니다. 그 정점을 클릭해 시작한 뒤, 다음 앵커를 클릭하거나 드래그하면 같은 네트워크에 변이 추가됩니다. 끝점을 연장하고, 공유 정점에서 분기를 만듭니다. 첫 앵커를 고르는 것만으로는 문서가 바뀌지 않으며, 커밋된 변 하나가 실행 취소 한 단계입니다. 정점에서 떨어진 곳에서 시작하면 별도의 네트워크가 생깁니다.

이어 그리기는 회전, 비균일 스케일, 반사를 지원하며, 미리보기와 커밋에 같은 3차 제어를 사용합니다. 기존 변의 핸들, 채우기, 구멍은 유지됩니다. 새로 둘러싸인 면은 Fill로 칠합니다. 기존 정점에 연결하면 스트로크가 끝나고, 동일한 변을 다시 따라가면 중복은 생기지 않습니다. 잠겨 있거나, 숨겨져 있거나, 역변환할 수 없는 노드는 이어서 그릴 수 없습니다. 그리는 도중의 취소, 도구 전환, 실행 취소는 대기 중인 변을 버리고 완료된 편집은 유지합니다.

## 구부리기 {#bending}

**Bend**에서는 변 위의 내부 점을 직접 드래그합니다. 앵커는 고정되고, 잡은 곡선 위의 점이 포인터를 따라갑니다. 직선 변은 3차 베지어가 됩니다. 모든 갱신은 포인터를 누른 시점의 스냅샷에서 시작하므로, 제어점 변위가 누적되지 않습니다. 피킹은 화면 좌표를 사용하며 회전, 반사, 비균일 스케일을 포함합니다.

매개변수 `t`에서 두 제어 가중치는 `a = 3(1-t)²t`와 `b = 3(1-t)t²`입니다. 포인터 변위 `Δ`에 대해 제어점은 `aΔ/(a²+b²)`와 `bΔ/(a²+b²)`만큼 이동합니다. 잡은 점을 포인터 아래에 유지하면서 제어점 변위의 제곱을 최소화합니다. 변을 직접 구부리면 그 끝점의 핸들 결합이 풀리고, 다른 변의 제어는 유지됩니다. 끝점 근처에서는 앵커와 핸들 상호작용이 우선합니다.

벡터 네트워크를 더블 클릭하고 **Bend**를 선택한 뒤 앵커를 선택하면 핸들이 나타납니다. 입사하는 변 끝이 정확히 두 개인 앵커에 대해 **Handle coupling**은 세 가지 모드를 제공합니다.

-   **Independent**: 한쪽 핸들을 움직여도 다른 쪽은 바뀌지 않습니다.
-   **Align angles**: 핸들을 서로 반대인 반직선 위에 두고, 다른 핸들의 길이는 유지합니다.
-   **Mirror angle and length**: 핸들을 반대 방향이고 길이가 같게 유지합니다.

모드를 바꾸면 0이 아닌 첫 핸들을 기준으로 쌍이 즉시 정렬됩니다. 드래그하는 동안 **Alt**를 누르고 있으면 결합이 풀리고, 이후 그 앵커는 독립 상태로 남습니다. 입사하는 변 끝이 세 개 이상인 분기 정점은 핸들을 독립으로 유지합니다. 자기 루프는 끝 두 개로 셉니다. 접힌 핸들에는 방향이 없으므로, 각도만 맞추는 결합은 드래그하는 핸들에 다시 방향이 생길 때까지 다른 핸들을 유지합니다.

직선 변은 반대쪽 끝점을 가리키는 임시 핸들 위치를 보여 주며, 그중 하나를 드래그하면 베지어 제어가 생깁니다. 이 안내선은 드래그하기 전까지 저장된 기하를 바꾸지 않습니다. 완료된 드래그 또는 결합 변경 하나가 실행 취소 한 단계입니다. **Esc**, 포인터 취소, 캔버스를 벗어남, 도구 전환은 대기 중인 드래그를 취소하고 원래 기하를 되돌립니다. 곡선의 범위가 바뀌어도 회전, 반사, 스케일 아래의 앵커 위치는 유지됩니다.

다음은 [Introducing Vector Networks - Bending]에서 가져온 내용입니다. 베지어 곡선 편집은 Path와 VectorNetwork 모두에서 공통입니다.

> Vector graphics today are based on cubic bezier splines, which are curves with two extra points called control handles that are positioned away from the curve itself and that control how much it bends, sort of like how a magnet might bend a wire towards it. Changing the shape of a curve involves dragging a control handle off in space instead of dragging the curve directly.

![변의 제어점](https://alexharri.com/images/posts/vector-networks/39.svg)

VectorNetwork의 변 정의에서 `tangentStart`와 `tangentEnd`는 3차 베지어 곡선의 제어점 두 개를 정의할 수 있습니다. 둘 다 `[0, 0]`이면 직선으로 퇴화합니다.

Konva 예제 [How to modify line points with anchors?]나 [bezierjs]도 해볼 수 있습니다.

더블 클릭 편집 모드, Move / Bend / Cut / Fill 도구 모음, 중점 삽입은 아래 [편집 모드 진입과 도구 모음](#vector-edit-mode)에서 다룹니다.

![Figma의 벡터 편집 모드](/figma-vectornetwork-mode.png)

```ts
export enum Pen {
    SELECT = 'select',
    HAND = 'hand',
    VECTOR_NETWORK = 'vector-network', // [!code ++]
}
```

[Lesson 21 - Transformer]의 OBB 기반 방식과는 다릅니다.

-   편집 모드에서 `VectorSegment`를 드래그하면 양 끝점이 움직이고, 그 정점을 공유하는 인접 변이 자연스럽게 따라옵니다.
-   `VectorVertex`를 드래그하면 그 정점만 움직이고, 그것을 공유하는 모든 세그먼트가 자동으로 따라옵니다. 이것이 Path에 비해 Vector Network가 가진 핵심 장점입니다. 새 좌표는 단일 진입점 `API.updateNodeVectorNetwork(node, vectorNetwork)`을 통해 다시 쓰입니다. 이 호출은 엔티티의 `VectorNetwork` 컴포넌트를 갱신하고, 다시 테셀레이션과 히스토리(실행 취소/다시 실행)를 일으킵니다.

```ts
// packages/ecs/src/systems/Select.ts
// In handleControlPointMoving, for a vector-network node:
// 1. Read the VectorNetwork component and map the pointer back to local
//    space via the inverse of GlobalTransform.
// 2. Update vertices[activeIndex].x/y.
// 3. Call api.updateNodeVectorNetwork to write back.
```

다시 쓸 때 `VectorNetwork.getGeometryBounds`가 기하 바운딩 박스를 다시 계산하고 모든 정점을 `-minX/-minY`만큼 옮겨, 왼쪽 위를 로컬 `(0, 0)`으로 정규화합니다. 보상 오프셋을 `node.x/y`에 더하기 전에 노드의 스케일과 회전을 적용해, 오프셋을 부모 좌표계로 나타냅니다. 따라서 이렇게 기준을 옮겨도 월드 공간의 앵커 위치는 유지됩니다. 탄젠트는 앵커에 대한 상대값이므로 평행 이동이 필요 없습니다.

### 편집 모드 진입과 도구 모음 {#vector-edit-mode}

Figma의 [Edit vector layers]를 따라, `vector-network` 노드를 더블 클릭하면 정점 편집 모드에 들어갑니다. 엔티티에 `Editable.isEditing = true`를 설정하고, 아래쪽 가운데에 **Move / Bend / Cut / Fill** 도구 모음(`VectorNetworkEditMode`, `context-vector-network-edit-bar.ts` 참고)을 표시합니다. 편집을 종료하면(도구 모음 닫기 버튼, Esc, 빈 캔버스 클릭) `isEditing: false`를 기록합니다. `RenderTransformer`는 모든 편집 앵커(정점, 세그먼트 중점, 탄젠트 핸들)를 숨깁니다.

| 모드     | 상호작용                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Move** | 정점을 드래그합니다. 세그먼트에 마우스를 올리면 중점이 나타나고, 클릭하면 새 정점이 삽입됩니다                                 |
| **Bend** | 변을 드래그해 직접 구부리거나, 세 가지 결합 모드로 핸들을 편집합니다                                                           |
| **Cut**  | Move와 같이 중점을 삽입합니다. **정점을 클릭**하면 자른 점에서 위상을 끊고, 떼어 드래그할 수 있도록 자동으로 Move로 전환합니다 |
| **Fill** | 마우스를 올리면 닫힌 면을 미리 봅니다. 클릭하면 구멍과 이웃 면을 유지한 채 그 면의 채우기를 전환합니다                         |

앵커의 **호버 강조**와 **선택**은 분리되어 있습니다. `Transformable.hoveredControlPointIndex`는 포인터가 떠나면 지워지고, `selectedControlPointIndex`는 클릭 뒤에도 남아 빈 공간이나 도형 안을 클릭할 때까지 유지됩니다.

### Move: 세그먼트 중점에 정점 삽입 {#insert-at-midpoint}

세그먼트에 마우스를 올리면 곡선 중점(`t = 0.5`, 3차 변은 곡선 위의 점)에 중점 앵커를 그립니다. 클릭하면 `splitSegmentAt`([생성과 삭제](#creation--delete) 참고)를 호출해 변을 나누고 네트워크를 다시 씁니다. `Select.insertControlPointFromMidpoint`와 `RenderTransformer.findHoveredVectorNetworkSegmentIndex`(뷰포트에서 로컬 곡선까지의 거리)를 참고하세요.

Move는 정점 하나 또는 변 전체를 드래그하며, 탄젠트를 유지한 채 양 끝점을 움직입니다. 회전, 스케일, 미러된 노드는 누른 순간에 캡처한 좌표계를 사용해, 바운딩 박스가 바뀔 때의 드리프트를 피합니다. 정점은 다른 정점 근처에서 스냅되고, 놓을 때 병합됩니다. Esc, 포인터 취소, 도구 전환은 새로 삽입한 중점을 포함해 제스처 전체를 되돌립니다. Cut은 클릭 시점에 커밋되고, 놓아도 끊긴 상태가 유지됩니다. Delete는 포인터가 떠나도 선택된 정점에 작용합니다.

드래그 중의 기하 변경은 커밋되지 않은 상태로 남습니다. 실행 취소와 다시 실행은 먼저 제스처가 시작될 때의 기하를 되돌린 다음 히스토리를 적용하므로, 바운딩 박스와 정점이 같은 편집에서 나옵니다. 외부 업데이트가 기하나 변환을 바꾼 경우에는 이전 제스처를 버립니다. 이후의 이동, 놓기, Escape로는 낡은 스냅샷을 되돌릴 수 없습니다. 스타일만 바꾸는 변경은 드래그를 중단하지 않으며, 기하를 취소해도 새 페인트는 남습니다. 드래그 중에 Delete를 누르면 먼저 끝나지 않은 이동을 취소한 뒤, 선택된 원래 정점을 삭제합니다. 대상이 새로 삽입한 중점이면 그 삽입만 취소합니다.

## 위상 연산자 {#topological-operators}

### 교차점 자동 분할 {#automatic-intersections}

펜 변을 커밋하거나 Move 또는 Bend 드래그를 마치면, 그 네트워크 안의 가로지르는 교차와 T 접합이 연결됩니다. 직선, 3차 베지어, 여러 교차, 3차 곡선의 자기 교차를 지원합니다. 드 카스텔조 세분은 곡선 형태를 유지하고, 영역과 구멍의 순회는 순회 순서대로 다시 기록됩니다. 기존 정점 인덱스는 그대로 유지되므로, 펜으로 이어 그리기는 여전히 클릭한 끝점에서 시작합니다.

드래그 중에는 위상이 바뀌지 않습니다. 분할은 놓을 때 도형 편집과 함께 커밋되고, 취소하면 접합이 남지 않으며, 실행 취소와 다시 실행은 연산 전체를 다룹니다. 가져온 기하를 명시적으로 정규화하려면 `splitVectorNetworkIntersections(network)`를 호출합니다. 검출은 적응적 세분과 수치 정제를 사용합니다. 접선 접촉, 겹치는 구간의 불리언 병합, 서로 다른 노드 사이의 연결은 지원하지 않습니다. 끝점만 닿는 접촉은 Cut 결과를 유지하기 위해 분리된 채로 둡니다.

Figma는 [Boolean operations]를 지원합니다. 예를 들어 union입니다.

![출처: https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations](https://help.figma.com/hc/article_attachments/30101990451607)

구현에는 Paper.js가 참고가 될 수 있습니다.

### 생성과 삭제 {#creation--delete}

[Delete and Heal for Vector Networks]

정점 추가: 점 배열에 단순히 splice하는 대신, 매개변수 `t`에서 세그먼트를 두 세그먼트로 나누고 새 정점을 삽입합니다(3차 변은 곡선 형태를 유지하도록 드 카스텔조로 세분합니다).

```ts
export function splitSegmentAt(
    network: VectorNetworkData,
    segIdx: number,
    t: number,
): number; // Mutates network and returns the new vertex index.
```

정점 삭제: 정점과 그에 입사하는 변을 제거한 뒤, 차수 2인 이웃은 변 두 개를 하나로 합쳐 복구(heal)하므로 패스 연결이 유지됩니다(Figma의 Delete and Heal과 같습니다). 편집 모드에서 **Delete / Backspace**로 실행합니다.

```ts
export function deleteVertex(
    network: VectorNetworkData,
    vertexIdx: number,
): VectorNetworkData;
```

> 삭제, 끊기, 병합은 새 네트워크를 반환합니다. `splitSegmentAt`은 전달된 네트워크 사본을 변경하고 삽입된 정점 인덱스를 반환합니다. `packages/ecs/src/utils/vector-network-topology.ts`의 연산자는 렌더링과 분리되어 있어 독립적으로 테스트할 수 있습니다. 편집 시스템은 그 결과를 `API.updateNodeVectorNetwork`를 통해 다시 반영합니다.

곡선의 경우 Heal은 먼저 원래 세분되었던 3차 곡선을 복구하려고 합니다. 그렇지 않으면 오차 상한을 검사하며 3차 곡선을 맞추고, 기본값은 제어점 바운딩 범위의 5%입니다. `maxError`는 로컬 단위의 허용 오차를 설정합니다. 허용 오차를 맞출 수 없으면 원래 네트워크를 유지합니다. **Shift + Delete / Backspace**는 복구 없이 정점과 입사 변을 제거합니다. 분할과 편집은 순회 순서대로 경계 인덱스를 다시 매핑하고 유효한 영역을 유지합니다.

### Glue와 Unglue {#glue-unglue}

![Glue와 Unglue 연산자](/vgc-operator-glue-unglue.png)

**Move**에서 정점을 선택한 뒤 **Glue / Unglue**(사슬 아이콘)를 클릭합니다. 패널은 캔버스에 정점을 **V1, V2, …**로, 입사 변을 **E1, E2, …**로 표시합니다.

-   **Glue**: 대상 정점을 고르고 확인합니다. 선택한 정점이 대상으로 이동하고 연결이 합쳐집니다. 서로 다른 곡선과 곡선 자기 루프는 유지되고, 동일한 변은 하나로 합쳐집니다.
-   **Unglue**: 분리할 변 끝을 체크한 뒤 확인합니다. 같은 위치에 새 정점이 생기고, 그 끝들에만 연결됩니다. 선택된 상태가 되어 바로 드래그해 뗄 수 있습니다. 원래 정점에는 적어도 한 끝을 붙여 둡니다. 자기 루프의 시작과 끝은 따로 고를 수 있습니다.

큐브 정면의 오른쪽 위 접합을 선택하고 **Glue / Unglue**를 연 뒤 **E7 · Start**를 분리해 보세요. 선택된 사본을 드래그해 뗀 뒤, **V3**를 대상으로 **Glue**하면 다시 붙습니다.

<VectorNetworkCube topology />

미리보기는 문서를 수정하지 않습니다. Cancel은 기하를 바꾸지 않고 닫습니다. 외부 기하 업데이트, 실행 취소, 편집 모드를 벗어나면 대기 중인 연산이 무효가 됩니다. 확인한 연산 하나가 실행 취소 한 단계입니다. Unglue는 곡선 기하와 아직 닫혀 있는 영역을 유지합니다. 바깥 경계나 구멍을 열면 영향받은 채우기 영역 전체가 제거됩니다. Glue는 연결은 복원하지만 제거된 채우기를 자동으로 되돌리지는 않습니다. Fill을 다시 사용하거나, Undo로 이전의 완전한 상태를 복원하세요.

`glueVertices(network, source, target)`와 `unglueVertex(network, vertex, endpoints)`는 `VectorTopologyResult`를 반환합니다. 실패 이유이거나, 새 네트워크와 정점/세그먼트 인덱스 맵, 선택된 정점 인덱스입니다. 끝점은 `{ segmentIndex, end: 'start' | 'end' }`를 사용합니다. API의 인덱스는 0부터 시작합니다. 입력은 변경되지 않습니다. 이 첫 단계는 한 네트워크 안의 정점을 대상으로 하며, 공유 변과 면 연산은 아래에서 설명합니다.

#### 공유 변의 Glue / Unglue {#shared-edge-glue-unglue}

**Move**에서 끝점을 선택하고 **Glue / Unglue**를 연 뒤 **Topology target**을 **Edges**로 설정합니다. **Source edge**를 고르면 그에 닿는 채워진 영역이 **R1, R2, …**로 표시됩니다. 체크한 영역은 강조 표시됩니다. 경계 사용은 **R (영역) · L (루프) · 루프 안의 위치**로 표시되며, 번호는 모두 1부터 시작합니다.

아래 큐브에는 채워진 면이 세 개 있습니다. 정면 오른쪽 위 정점 **V3**를 선택하고 **Unglue edge → E7**을 고른 뒤 **R2 · L1 · 4**(윗면)를 체크하고 확인합니다. 윗면은 이제 사본 **E10**을 사용하고, 오른쪽 면은 여전히 **E7**을 사용합니다. Unglue는 자동으로 **Bend**에 들어갑니다. 대각선의 가운데를 드래그하면 사본과 윗면의 경계만 구부러집니다. 양쪽 끝점은 계속 공유됩니다. 겹쳐 있는 원래 변을 편집하려면 Move로 돌아가 Edges 패널에서 E7을 고르고 **Bend selected edge**를 클릭합니다.

<VectorNetworkCube edges />

구부린 것을 실행 취소해 곡선이 다시 겹치게 한 뒤, Move로 돌아가 V3를 선택합니다. Edges 패널에서 **Glue edges**를 선택해 **E10**을 **E7**에 병합합니다. Glue는 저장 방향이 반대인 경우도 지원하고, 인덱스가 달라도 위치가 같은 끝점 정점을 용접합니다. 요청한 소스 변만 제거되고, 관계없는 중복 변은 남습니다. 곡선이나 제어점이 맞지 않는 경우, 끝점이 호환되지 않는 경우, 같은 경계 루프에서 변 두 개를 쓰는 경우, nonzero 채우기를 바꿀 수 있는 부분적인 와인딩 반전은 거부됩니다.

Unglue는 곡선 기하, 끝점, 구멍을 포함한 모든 영역을 유지하고, 선택된 경계 사용만 사본으로 옮깁니다. 원래 변에는 사용이 적어도 하나 남아야 합니다. 현재 영역은 채워진 경계를 저장합니다. 변은 그런 사용이 적어도 두 번 필요하므로, 필요하면 인접한 면을 먼저 채웁니다. Fill은 가져온 넓은 영역을 별도의 면으로 정규화할 수 있습니다. 사본이 아직 겹쳐 있는 동안에는 Bend나 Glue를 사용하세요. Fill과 면 단위 Cut / Uncut은 여전히 평면 임베딩을 가정합니다. Glue / Unglue 각각이 실행 취소 한 단계입니다. 미리보기와 **Bend selected edge**는 히스토리 항목을 만들지 않습니다.

순수 함수 `vectorEdgeUses(network, edge)`는 `{ regionIndex, loopIndex, offset }` 항목을 반환합니다. `unglueVectorNetworkEdge(network, edge, uses)`와 `glueVectorNetworkEdges(network, source, target)`는 `VectorEdgeTopologyResult`를 반환합니다. 새 네트워크, 정점/변 인덱스 맵, 선택된 변이거나 실패 이유입니다. API 인덱스는 0부터 시작하며, 입력은 변경되지 않습니다.

### Cut과 Uncut {#cut-uncut}

![Cut과 Uncut 연산자](/vgc-operator-cut-uncut.png)

#### 면 분할과 병합 {#split-and-merge-faces}

**Move**에서 정점을 선택하고 **Cut / Uncut faces**(나뉜 패스 아이콘)를 클릭합니다. **Cut face**는 같은 면의 경계 정점을 직선 이음선으로 연결하며, 구멍과의 연결과 구멍 사이의 연결을 포함합니다. **Uncut edge**는 인접한 면 사이의 공유 변, 또는 경계 성분을 잇는 이음선을 제거합니다. 정점 위치와 기존 곡선 제어점은 바뀌지 않습니다. 두 연산 모두 한 단계의 Undo / Redo를 지원합니다.

아래의 채워진 정면을 시험해 보세요. **왼쪽 아래 정점 V1**을 선택하고 **Cut face → V3**를 고른 뒤 확인합니다. 새 대각선 **E10**이 파란색 면을 채워진 삼각형 두 개로 나눕니다. 패널을 다시 열고 **Uncut edge → E10**을 고른 뒤 확인하면 다시 합쳐집니다. Fill로 삼각형 하나의 채우기를 지울 수 있습니다. 그러면 Uncut은 칠해진 영역이 뜻밖에 바뀌는 대신, 양쪽의 채우기 상태가 같아야 한다고 설명합니다.

<VectorNetworkCube faces />

Cut은 평면 면 안에 머물러야 합니다. 다른 변을 가로지르거나 닿는 경우, 변과 겹치는 경우, 구멍을 통과하는 경우는 거부됩니다. 기존 곡선 경계와 양쪽의 구멍은 유지됩니다. 현재 Cut은 임의로 그린 곡선이 아니라 직선 이음선을 사용합니다. Uncut이 유계인 면 두 개를 합칠 때는 둘 다 채워져 있거나 둘 다 비어 있어야 합니다. 구멍 경계를 잇는 이음선을 제거하면 원래 채우기가 유지됩니다. 매달린 스트로크는 경계를 잇는 이음선으로 제거되지 않습니다. 미리보기는 일시적입니다. Cancel, Undo, 선택한 정점을 바꾸기, 외부 기하 업데이트는 미리보기를 버립니다. 거부된 연산은 이유를 설명하고 히스토리 항목을 만들지 않습니다.

순수 함수 `cutVectorNetworkFace(network, from, to)`와 `uncutVectorNetworkEdge(network, edgeIndex)`는 `VectorFaceTopologyResult`를 반환합니다. 실패 이유, 또는 새 네트워크와 정점/변 인덱스 맵, 선택된 정점을 포함합니다. 인덱스는 0부터 시작합니다. 채워진 영역은 최소 평면 면으로 정규화되며, 눈에 보이는 칠해진 영역과 구멍을 유지합니다. 이 면 연산은 아래에서 설명하는, 정점을 여는 기존 Cut 도구와 별개입니다.

#### 구멍 경계 연결 {#connecting-hole-boundaries}

아래 고리에는 채워지지 않은 구멍이 있습니다. Move에서 바깥쪽 왼쪽 위 모서리 **V1**을 선택하고 **Cut / Uncut faces**를 연 뒤 **Cut face → V5**를 고릅니다. 새 **E9**가 바깥 경계를 구멍에 잇습니다. 파란색 영역은 면 하나로 남고, 구멍은 투명하게 유지되며, 경계는 E9를 각 방향으로 한 번씩 지나갑니다.

이어서 바깥쪽 오른쪽 위 모서리 **V2**를 선택하고 **Cut face → V6**을 고릅니다. 새 **E10**이 고리를, Fill로 각각 따로 전환할 수 있는 면 두 개로 나눕니다. 채우기를 바꾸지 않은 채로 V2를 선택하고 **Uncut edge → E10**을 실행한 뒤, V1을 선택하고 **Uncut edge → E9**를 실행하면 경계 루프 두 개가 분리된 고리로 돌아갑니다. 각 단계는 실행 취소와 다시 실행을 지원합니다.

<VectorNetworkFaceCut />

이음선 전체가 같은 면 안에 있고 다른 경계에 닿지 않으면 구멍 두 개도 연결할 수 있습니다. 서로 다른 경계를 이으면 면은 늘지 않고 경계 루프가 하나 줄어듭니다. 한 경계 안에서 자르면 면이 하나 늘어납니다. 기존 곡선 경계는 바뀌지 않고, 채우기는 덮인 범위를 유지한 채 `evenodd` 면 영역으로 정규화됩니다.

#### 정점 열기 {#open-a-vertex}

Cut은 **선택한 정점에서 위상을 끊습니다**. 그 정점을 복제하고, 첫 입사 끝점은 남긴 채 나머지 끝점을 사본으로 옮깁니다. 닫힌 루프와 열린 사슬은 같은 규칙을 사용합니다. 삼각형 `0—1—2—0`에서 정점 `1`을 자른 경우를 예로 들면 다음과 같습니다.

```plaintext
Before:  0 — 1 — 2 — 0 (closed)
After:   1 — 0 — 2 — 3 (3 coincident with 1, open polyline)
segments: [0,1], [3,2], [2,0]
```

열린 폴리라인에서는 **자른 정점을 복제**하고, 첫 입사 변을 제외한 나머지를 사본에 다시 연결해 두 사슬을 Move 모드에서 떼어 당길 수 있게 합니다. `breakVertex`를 참고하세요.

```ts
export function breakVertex(
    network: VectorNetworkData,
    vertexIndex: number,
): VectorNetworkData | null;
```

Cut 모드에서 정점을 클릭하면 `breakVectorNetworkAtVertex`(`Select.ts`)를 호출하고, 네트워크를 다시 쓰며, 히스토리를 기록하고, `setAppState({ vectorNetworkEditMode: MOVE })`로 바로 드래그할 수 있게 합니다. 경계가 닫힌 채로 남는 영역은 유지됩니다. 유효하지 않은 경계는 그것을 담은 영역을 제거합니다. 구멍이 끊어질 때도 마찬가지이며, 그 구멍을 실수로 채우지 않기 위해서입니다. 비울 때는 명시적으로 `regions: []`를 기록하여 엔티티와 실행 취소 히스토리가 어긋나지 않게 합니다. 정점 하나짜리 3차 자기 루프도 자를 수 있습니다.

## 더 읽어보기 {#extended-reading}

-   [Introducing Vector Networks]
-   [The Engineering behind Figma's Vector Networks]
-   [Vector Graphics Complexes]
-   [图形编辑器开发：钢笔工具的实现]
-   [vpaint]
-   [penpot]

[Introducing Vector Networks]: https://www.figma.com/blog/introducing-vector-networks/
[Introducing Vector Networks - Bending]: https://www.figma.com/blog/introducing-vector-networks/#bending
[Delete and Heal for Vector Networks]: https://www.figma.com/blog/delete-and-heal-for-vector-networks/
[VectorNetwork API]: https://www.figma.com/plugin-docs/api/VectorNetwork/
[VectorPath API]: https://www.figma.com/plugin-docs/api/VectorPath/
[VectorPath-data]: https://www.figma.com/plugin-docs/api/properties/VectorPath-data/
[Vector Graphics Complexes]: https://www.borisdalstein.com/research/vgc/
[The Engineering behind Figma's Vector Networks]: https://alexharri.com/blog/vector-networks
[Discussion in HN]: https://news.ycombinator.com/item?id=39241825
[vpaint]: https://github.com/dalboris/vpaint
[penpot]: https://github.com/penpot/penpot
[图形编辑器开发：钢笔工具的实现]: https://zhuanlan.zhihu.com/p/694407842
[Lesson 12 - Draw polyline]: /ko/guide/lesson-012
[Lesson 13 - Drawing path and sketchy style]: /ko/guide/lesson-013
[fillRule]: /ko/guide/lesson-013#fill-rule
[How to modify line points with anchors?]: https://konvajs.org/docs/sandbox/Modify_Curves_with_Anchor_Points.html
[bezierjs]: http://pomax.github.io/bezierjs
[figma-fill-rule-editor]: https://github.com/evanw/figma-fill-rule-editor
[Polyline]: /ko/guide/lesson-012
[Lesson 21 - Transformer]: /ko/guide/lesson-021
[Edit vector layers]: https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers#h_01JYM29VEN8ABWTDXJR529446R
[Boolean operations]: https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations
