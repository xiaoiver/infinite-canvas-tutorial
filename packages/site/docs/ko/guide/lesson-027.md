---
outline: deep
description: '스냅과 정렬'
head:
    - ['meta', { property: 'og:title', content: '27강 - 스냅과 정렬' }]
---

<script setup>
import SnapToPixelGrid from '../../components/SnapToPixelGrid.vue'
import SnapToObjects from '../../components/SnapToObjects.vue'
</script>

# 27강 - 스냅과 정렬 {#lesson-27-snap-and-align}

스냅은 그래픽 편집기 애플리케이션에서 흔한 기능입니다. 핵심 아이디어는 요소를 이동하거나 그리거나 스케일할 때, 요소의 경계나 앵커 포인트를 가장 가까운 픽셀 그리드 선이나 다른 그래픽에 자동으로 맞추는 것입니다. 이번 강의에서는 그 구현을 소개합니다.

## 픽셀 그리드에 스냅 {#snap-to-pixel-grid}

[5강 - 그리드 그리기]에서 직선 그리드를 효율적으로 그리는 방법을 소개했습니다. 이동이나 그리기 같은 일부 드래그 상호작용에서 그리드의 최소 단위에 스냅하면, 그래픽의 위치나 기하 정보가 정수가 됩니다. 이 기능은 Figma에서 "Snap to pixel grid"라고 부르며, "사용자 환경설정"에서 켤 수 있습니다.

![픽셀 그리드에 스냅](https://user-images.githubusercontent.com/490574/85198268-4ff5f300-b322-11ea-897e-602ef5936995.gif)

출처: [Snap to grid in Excalidraw].

```ts
export interface AppState {
    snapToPixelGridEnabled: boolean; // [!code ++]
    snapToPixelGridSize: number; // [!code ++]
}
```

이 기능을 구현하려면, 먼저 월드 좌표계에서 점의 좌표를 계산해야 합니다. 사용자가 그래픽을 드래그하거나 스케일하거나 그릴 때 현재 좌표(예: x, y)를 얻은 다음, 그 좌표를 가장 가까운 정수(픽셀 점)나 지정한 그리드 간격으로 반올림합니다.

```ts
// Snap to custom grid (e.g. 10px)
function snapToGrid(value, gridSize = 10) {
    return Math.round(value / gridSize) * gridSize;
}
```

그다음 월드 좌표계에서 점의 좌표를 계산해야 하는 모든 System(예: Select, DrawRect)에 이 처리 함수를 적용합니다.

```ts
let { x: sx, y: sy } = api.viewport2Canvas({
    x: prevX,
    y: prevY,
});
let { x: ex, y: ey } = api.viewport2Canvas({
    x,
    y,
});
const { snapToPixelGridEnabled, snapToPixelGridSize } = api.getAppState(); // [!code ++]
// [!code ++]
if (snapToPixelGridEnabled) {
    // [!code ++]
    sx = snapToGrid(sx, snapToPixelGridSize);
    // [!code ++]
    sy = snapToGrid(sy, snapToPixelGridSize);
    // [!code ++]
    ex = snapToGrid(ex, snapToPixelGridSize);
    // [!code ++]
    ey = snapToGrid(ey, snapToPixelGridSize);
    // [!code ++]
}
```

아래 예제에서는 `snapToPixelGridSize`를 10으로 설정합니다. 드래그, 이동, 그리기로 효과를 확인해 볼 수 있습니다.

<SnapToPixelGrid />

## 객체 수준 스냅 {#snap-to-objects}

Excalidraw에서 스냅 기능의 구현은 다음 핵심 단계로 나뉩니다.

-   현재 작업이 스냅을 허용하는지 확인합니다([isSnappingEnabled]).
-   스냅 가능한 모든 점과 간격을 계산합니다([getPointSnaps]).
-   드래그/스케일 도중 스냅 오프셋과 가이드 선을 실시간으로 계산합니다([snapDraggedElements] / [snapResizingElements]).
-   snapLines를 UI 레이어에 전달하고 캔버스에 가이드 선을 렌더링합니다([renderSnaps]).

아래에서는 위에 정리한 단계를 따라 구현합니다.

객체 스냅은 픽셀 그리드와 독립적으로 동작합니다. `snapToObjectsDistance`는 CSS 픽셀 단위의 반경이므로, 확대/축소해도 체감되는 끌어당김 거리는 바뀌지 않습니다. 이동 중에는 포인터를 누른 시점의 기하와 가공하지 않은 포인터 변위로 후보 위치를 계산하고, 스냅은 표시 위치에만 적용합니다. 스냅된 위치를 다음 샘플에 다시 넣으면 객체가 가이드 쪽으로 계속 끌려 갑니다.

이동은 바운딩 박스의 가장자리/중심 정렬과 등간격 가이드를 지원합니다. 크기 조절은 움직이는 변이나 모서리를 다른 객체의 변과 중심에 스냅하면서, 반대편 변, 종횡비 제약, 중심 기준 스케일을 유지합니다. 회전된 객체는 움직이는 핸들을 월드 좌표에서 맞춥니다. 참조 대상에서는 숨겨진 객체, 화면 밖 객체, 그리고 선택 영역의 조상과 자손을 제외합니다. 여기까지가 현재 구현된 동작입니다. 크기 조절 중의 간격 분배, 같은 크기 맞추기, 그리는 동안의 스냅은 후속 작업으로 남아 있으므로, 이것은 Figma의 전체 동작과 같은 수준이 아닙니다.

### 스냅 허용 여부 {#is-snapping-enabled}

애플리케이션 설정에 다음 구성 옵션을 추가했으며, “환경설정 메뉴”에서도 켤 수 있습니다.

```ts
export interface AppState {
    snapToObjectsEnabled: boolean; // [!code ++]
}
```

선택한 도형을 이동하거나 크기를 조절할 때 트리거됩니다.

![출처: https://github.com/excalidraw/excalidraw/issues/263#issuecomment-577605528](https://user-images.githubusercontent.com/5153846/72973602-d804ba80-3dcd-11ea-9717-05448160044c.gif)

### 포인트 스냅 계산 {#get-point-snaps}

스냅 점은 두 부류로 나뉩니다. 선택된 도형과 그 밖의 도형입니다. 선택된 도형이 하나 또는 여러 개일 때, 흔한 스냅 점에는 바운딩 박스의 네 모서리와 중심이 포함됩니다.

```ts
const { minX, minY, maxX, maxY } = api.getGeometryBounds(
    elements.map((id) => api.getNodeById(id)),
);
const boundsWidth = maxX - minX;
const boundsHeight = maxY - minY;
return [
    [minX, minY], // corners
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
    [minX + boundsWidth / 2, minY + boundsHeight / 2], // center
] as [number, number][];
```

성능을 고려하면, 선택된 도형의 부착점을 다른 모든 도형에 대해 검사하는 횟수를 최대한 줄여야 합니다. 비슷한 문제는 [8강 - 공간 인덱싱 사용]에서 이미 다뤘으며, 뷰포트 안의 도형만 가져옵니다.

```ts
const unculledAndUnselected = api
    .getNodes()
    .map((node) => api.getEntity(node))
    .filter((entity) => !entity.has(Culled) && !entity.has(Selected));
```

마찬가지로, 이 도형들의 참조점을 계산합니다.

```ts
const referenceSnapPoints: [number, number][] = unculledAndUnselected
    .map((entity) => getElementsCorners(api, [api.getNodeByEntity(entity).id]))
    .flat();
```

다음으로, 선택된 도형의 스냅 점을 다른 도형의 스냅 점과 하나씩 비교합니다. 가로 또는 세로 방향으로 더 가까운 점의 쌍을 찾고, 둘 사이의 거리 차이를 이후의 스냅 거리로 기록합니다.

```ts
nearestSnapsX.push({
    type: 'point',
    points: [thisSnapPoint, otherSnapPoint],
    offset: offsetX,
});
minOffset[0] = Math.abs(offsetX);
```

모든 스냅 점을 계산한 뒤, 이 최소 거리를 스냅 거리로 사용할 수 있습니다. 이 단계에서는 도형이 아직 스냅 거리만큼 이동하지 않았다는 점이 중요합니다. 따라서 도형이 이미 최종 위치로 이동했다고 가정하고 한 번 더 계산해야 합니다.

```ts
// 1st round
getPointSnaps();
const snapOffset: [number, number] = [
    nearestSnapsX[0]?.offset ?? 0,
    nearestSnapsY[0]?.offset ?? 0,
];

// Clear the min offset
minOffset[0] = 0;
minOffset[1] = 0;
nearestSnapsX.length = 0;
nearestSnapsY.length = 0;
const newDragOffset: [number, number] = [
    round(dragOffset[0] + snapOffset[0]),
    round(dragOffset[1] + snapOffset[1]),
];

// 2nd round, a new offset must be considered.
getPointSnaps(newDragOffset);

// Render snap lines
```

### 간격 스냅 계산 {#get-gap-snaps}

캔버스에서 현재 선택된 도형 외에, 다른 도형들이 쌍을 이루어 그 사이에 간격을 만들 수도 있습니다. Excalidraw 코드의 도식이 이를 잘 보여 줍니다. `horizontalGap`을 예로 듭니다.

```ts
// https://github.com/excalidraw/excalidraw/blob/f55ecb96cc8db9a2417d48cd8077833c3822d64e/packages/excalidraw/snapping.ts#L65C1-L81C3
export type Gap = {
    //  start side ↓     length
    // ┌───────────┐◄───────────────►
    // │           │-----------------┌───────────┐
    // │  start    │       ↑         │           │
    // │  element  │    overlap      │  end      │
    // │           │       ↓         │  element  │
    // └───────────┘-----------------│           │
    //                               └───────────┘
    //                               ↑ end side
    startBounds: Bounds;
    endBounds: Bounds;
    startSide: [GlobalPoint, GlobalPoint];
    endSide: [GlobalPoint, GlobalPoint];
    overlap: InclusiveRange;
    length: number;
};
```

선택된 도형의 바운딩 박스가 간격과 겹치지 않으면 검사를 건너뜁니다.

```ts
for (const gap of horizontalGaps) {
    if (!rangesOverlap([minY, maxY], gap.overlap)) {
        continue;
    }
}
```

중심점, 오른쪽 가장자리, 왼쪽 가장자리를 순서대로 검사합니다.

```ts
// center
if (gapIsLargerThanSelection && Math.abs(centerOffset) <= minOffset[0]) {
}
// side right
if (Math.abs(sideOffsetRight) <= minOffset[0]) {
}
// side left
if (Math.abs(sideOffsetLeft) <= minOffset[0]) {
}
```

조건이 맞으면 기록합니다. 그 과정에서 최소 거리를 계속 기록합니다.

```ts
const snap: GapSnap = {
    type: 'gap',
    direction: 'center_horizontal',
    gap,
    offset: centerOffset,
};
nearestSnapsX.push(snap);
```

### 스냅 선 렌더링 {#render-snap-lines}

SVG 컨테이너에 스냅 선을 렌더링합니다. 참고: [26강 - 올가미 선택].

스냅 점은 보통 “십자”로 나타내며, 이 점들을 잇는 선은 `<line>`으로 렌더링할 수 있습니다.

```ts
renderSnapLines(
    api: API,
    snapLines: { type: string; points: [number, number][] }[],
) {
    const { svgSVGElement } = this.selections.get(api.getCamera().__id);
    this.clearSnapLines(api);

    snapLines.forEach(({ type, points }) => {
        if (type === 'points') {
            const pointsInViewport = points.map((p) =>
                api.canvas2Viewport({ x: p[0], y: p[1] }),
            );
            const line = createSVGElement('polyline') as SVGPolylineElement;
            svgSVGElement.appendChild(line);
        }
    });
}
```

간격 스냅 선의 표시에 대해, Excalidraw의 문서는 매우 알기 쉽습니다. 이를 바탕으로 보조선 아래(가로 방향) 또는 오른쪽(세로 방향)에 거리를 나타내는 텍스트 레이블을 추가할 수 있습니다. Figma가 처리하는 방식과 비슷합니다.

```ts
// a horizontal gap snap line
// |–––––––||–––––––|
// ^    ^   ^       ^
// \    \   \       \
// (1)  (2) (3)     (4)
```

![간격 스냅 선과 거리 레이블 표시](/snap-to-objects.gif)

아래 가운데 사각형을 이동하거나 크기를 조절해 보세요. 독립된 컨트롤로 객체 스냅과 픽셀 그리드 스냅을 비교할 수 있습니다.

<SnapToObjects />

## 더 읽어보기 {#extended-reading}

-   [How to snap shapes positions on dragging with Konva?]
-   [Custom snapping in tldraw]

[5강 - 그리드 그리기]: /ko/guide/lesson-005
[How to snap shapes positions on dragging with Konva?]: https://konvajs.org/docs/sandbox/Objects_Snapping.html
[Snap to grid in Excalidraw]: https://github.com/excalidraw/excalidraw/issues/521
[Custom snapping in tldraw]: https://tldraw.dev/examples/bounds-snapping-shape
[isSnappingEnabled]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L162C14-L162C31
[getPointSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L636
[snapDraggedElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L692
[snapResizingElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L1108C14-L1108C34
[renderSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/renderer/renderSnaps.ts
[8강 - 공간 인덱싱 사용]: /ko/guide/lesson-008#using-spatial-indexing
[26강 - 올가미 선택]: /ko/guide/lesson-026#lasso-selection
