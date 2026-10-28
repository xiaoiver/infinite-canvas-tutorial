---
outline: deep
description: '선택 도구를 구현합니다.'
head:
    - ['meta', { property: 'og:title', content: '26강 - 선택 도구' }]
---

<script setup>
import MultiSelection from '../../components/MultiSelection.vue'
import Lasso from '../../components/Lasso.vue'
</script>

# 26강 - 선택 도구 {#lesson-26-selection-tool}

[14강 - 선택 모드]에서는 개별 도형을 클릭해 선택하는 간단한 기능만 구현했습니다. 이번 강의에서는 다중 선택, 마퀴 선택, 올가미 기능을 더해 선택 도구를 계속 다듬습니다.

## 다중 선택 {#multi-selection}

개별 클릭 선택을 바탕으로, <kbd>Shift</kbd>를 누른 채 현재 선택에 도형을 더하거나 뺄 수 있습니다.

![Figma에서 <kbd>Shift</kbd>를 누른 채 여러 레이어를 선택](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042572c7d3a0cb93253d5/file-TQrRIcwMNR.gif)

선택 모드에서는 `input.shiftKey` 상태, 즉 <kbd>Shift</kbd>가 눌렸는지에 따라 현재 선택을 유지할지 결정합니다. 누르지 않았으면 단일 선택으로 바꾸고, 눌렸으면 대상 도형을 기존 선택에 더합니다.

```ts
if (selection.mode === SelectionMode.SELECT) {
    if (layersSelected.length > 1 && layersSelected.includes(selected.id)) {
        // deselect if already selected in a group
        api.deselectNodes([selected]);
    } else {
        api.selectNodes([selected], input.shiftKey); // whether to add to existed selection
    }
}
```

[21강 - 트랜스포머]에서는 도형 하나를 선택하는 기능을 구현했습니다. 다음으로, 여러 도형이 선택된 경우를 보여 주는 Group 표시를 추가해야 합니다. 단일 선택 트랜스포머와 달리, 다중 선택의 Group은 `rotation`과 `scale`을 고려하지 않아도 됩니다.

```ts
export class RenderTransformer extends System {
    getOBB(camera: Entity): OBB {
        const { selecteds } = camera.read(Transformable);

        // Single selected, keep the original OBB include rotation & scale.
        if (selecteds.length === 1 && selecteds[0].has(ComputedBounds)) {
            const { obb } = selecteds[0].read(ComputedBounds);
            return obb;
        }

        // [!code ++]
        if (selecteds.length > 1) {
            // [!code ++]
        }
    }
}
```

효과는 다음과 같습니다. 크기를 바꿀 때 선택된 모든 도형을 변환하는 로직은 [21강 - 도형 변환]에서 이미 소개했으므로 여기서는 반복하지 않습니다.

<MultiSelection />

## 마퀴 선택 {#marquee-selection}

다음 그림은 [Select layers and objects in Figma]에서 가져왔습니다.

![Figma의 선택 마퀴](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5aa962fe2c7d3a2c4983093d/images/5c8042ec04286350d088ba04/file-tAFIn9Cimd.gif)

이 마퀴 선택 도구는 “marquee”라고 부릅니다. 참고: [Make selections with the Rectangular Marquee tool]. 이렇게 만들어지는 직사각형 영역을 브러시(Brush)라고 부릅니다.

마퀴 선택이 끝날 때(마우스 버튼을 뗄 때) 먼저 브러시 직사각형을 숨겨야 합니다. 구현은 다음 절에서 봅니다. 그다음 [8강 - 공간 인덱스로 가속]에서 소개한 빠른 피킹을 사용합니다. 직사각형의 너비와 높이가 음수일 수 있으므로(드래그 방향에 따라), BBox가 유효하도록 계산이 필요하다는 점에 유의하세요.

```ts
if (input.pointerUpTrigger) {
    if (selection.mode === SelectionMode.BRUSH) {
        // Hide Brush...

        if (selection.brush) {
            const { x, y, width, height } = selection.brush.read(Rect);
            // Make a valid BBox
            const minX = Math.min(x, x + width);
            const minY = Math.min(y, y + height);
            const maxX = Math.max(x, x + width);
            const maxY = Math.max(y, y + height);
            const selecteds = api
                .elementsFromBBox(minX, minY, maxX, maxY) // Use space index
                .filter((e) => !e.has(UI))
                .map((e) => api.getNodeByEntity(e));
            api.selectNodes(selecteds); // Finish selection
        }
    }
}
```

마퀴 선택을 하는 동안에도 하이라이트와 트랜스포머로 선택 상태를 실시간으로 보여 주고 싶습니다. 위의 피킹과 선택 로직을 바탕으로 하이라이트를 추가합니다.

![브러시하는 동안의 하이라이트](/brush.gif)

```ts
api.selectNodes(selecteds);
// [!code ++]
if (needHighlight) {
    api.highlightNodes(selecteds); // [!code ++]
}
```

물론 뷰포트 공간 안의 컴포넌트는 SVG로도 구현할 수 있으며, 이어지는 올가미 도구에서 그 예를 봅니다.

## Esc로 선택 해제 {#deselect-with-esc}

선택된 상태에서 <kbd>Esc</kbd>를 누르면 선택이 취소됩니다. 또한 마퀴 선택 중에는 브러시를 숨겨야 합니다.

```ts
if (input.key === 'Escape') {
    api.selectNodes([]);
    if (selection.mode === SelectionMode.BRUSH) {
        this.hideBrush(selection);
    }
}
```

## 레이어 잠금과 잠금 해제 {#lock-and-unlock-layers}

잠긴 레이어는 선택할 수 없습니다. 자세한 내용은 [Lock and unlock layers]를 참고하세요.

## 올가미 선택 {#lasso-selection}

사각형 마퀴 도구에 비해 올가미 도구는 불규칙한 다각형을 만들어 더 정밀하게 선택할 수 있습니다.

-   [Feature Request: Lasso Selection (free selection) in Excalidraw]
-   [lasso-tool-figma]

AI 기반 이미지 편집에서 올가미 도구는 더 정밀하게 마스크를 만들어 인페인팅을 수행할 수도 있습니다. 아래 그림은 Figma에서의 효과이며, 선택한 영역은 지우거나 레이어로 분리할 수 있습니다.

![출처: https://help.figma.com/hc/en-us/articles/24004542669463-Make-or-edit-an-image-with-AI#h_01KBJQAF0G6X98H5JJ8GBAPTGP](https://help.figma.com/hc/article_attachments/36912285044247)

### 올가미 그리기 {#draw-lasso}

[25강 - 연필 도구]에서는 폴리라인 패스를 자유롭게 그리는 방법을 다루었습니다. SVG 컨테이너 안에 올가미 패스를 계속 그리며, 보통 애니메이션 효과(개미선)가 있는 점선으로 나타냅니다.

```html
<path d="...">
    <animate
        attribute-name="stroke-dashoffset"
        stroke-dasharray="7 7"
        stroke-dashoffset="10"
        from="0"
        to="-14"
        dur="0.3s"
    />
</path>
```

먼저 점 좌표를 뷰포트 좌표계에서 캔버스 좌표계로 변환합니다. 그다음 현재 카메라 확대/축소 수준에 따라 패스를 단순화합니다. 확대 수준이 높으면 더 촘촘한 선택 입도가 필요하고, 낮으면 그 반대입니다. 또한 정점이 적을수록 렌더링 성능과 이후 교차 검출의 효율이 모두 좋아집니다.

```ts
import simplify from 'simplify-js';

const lassoPath = super
    .getCurrentTrail()
    ?.originalPoints?.map(([x, y]) => this.api.viewport2Canvas({ x, y }));

const simplifyDistance = 5 / this.api.getAppState().cameraZoom;
const points = simplify(lassoPath, simplifyDistance).map((p) => [p.x, p.y]);
// Hit-test the current path as it changes for preview, and again on pointerup
// before clearing the trail to commit the final selection.
const selected = selectByLassoPath(this.api, points);
```

<Lasso />

도형 주변을 드래그하면 히트가 즉시 미리보기됩니다. 올가미가 바뀌면 윤곽선이 나타나거나 사라집니다. 아직 끝나지 않은 올가미는 히트 테스트를 위해 시작점으로 자동으로 닫힙니다. 손을 떼면 최종 선택이 실행 취소 한 단계로 확정됩니다. Escape를 누르거나, 터치 제스처를 취소하거나, 핀치를 시작하거나, 도구를 바꾸면 선택하지 않고 미리보기가 지워집니다. 탭과 아주 작은 움직임으로는 아무것도 선택되지 않습니다. 다시 선택하려면 올가미 도구를 다시 고릅니다. 마스크 그리기 모드는 손을 뗄 때만 패스를 만들며, 도형 선택 미리보기는 하지 않습니다.

히트 테스트는 월드 좌표를 사용하며, 각 도형의 부모 변환, 회전, 뒤집기를 포함합니다. 열린 폴리라인은 암묵적인 닫는 변을 두지 않고 선분마다 검사합니다. 잠긴 도형과 숨겨진 도형은 제외됩니다.

### 다각형의 교차 검출 {#polygon-intersection}

이제 Path를 만들었으므로, 씬에서 그것과 교차하는 지오메트리를 가져와야 합니다. 이전과 같이 [8강 - 공간 인덱스로 가속]부터 사용합니다.

```ts
function selectByLassoPath(api: API, lassoPath: [number, number][]) {
    const lassoBounds = lassoPath.reduce(
        (acc, item) => {
            return [
                Math.min(acc[0], item[0]),
                Math.min(acc[1], item[1]),
                Math.max(acc[2], item[0]),
                Math.max(acc[3], item[1]),
            ];
        },
        [Infinity, Infinity, -Infinity, -Infinity],
    ) as [number, number, number, number];

    // Hit-test with rbush
    const elements = api.elementsFromBBox(
        lassoBounds[0],
        lassoBounds[1],
        lassoBounds[2],
        lassoBounds[3],
    );

    // elementsFromBBox excludes locked elements; also filter UI and hidden nodes.
}
```

빠른 바운딩 박스 검출을 통과한 뒤에는 두 경우를 처리해야 합니다. 올가미가 도형 안에 완전히 들어 있는 경우, 그리고 올가미가 도형과 교차하는 경우입니다.

```ts
function isPolygonsIntersect(points1: number[][], points2: number[][]) {
    let isIn = false;
    // Determine whether a point lies inside a polygon. If any point is inside another polygon, return true.
    points2.forEach((point) => {
        if (isPointInPolygon(points1, point[0], point[1])) {
            isIn = true;
            return false;
        }
    });
    if (isIn) {
        return true;
    }
}
```

## 더 읽어보기 {#extended-reading}

-   [How do I determine if two convex polygons intersect?]

[14강 - 선택 모드]: /ko/guide/lesson-014#select-mode
[21강 - 트랜스포머]: /ko/guide/lesson-021
[21강 - 도형 변환]: /ko/guide/lesson-021#transform-shape
[Select layers and objects in Figma]: https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
[Make selections with the Rectangular Marquee tool]: https://helpx.adobe.com/photoshop/using/tool-techniques/rectangular-marquee-tool.html
[8강 - 공간 인덱스로 가속]: /ko/guide/lesson-008#using-spatial-indexing
[lasso-tool-figma]: https://github.com/kernel-picnic/lasso-tool-figma
[Feature Request: Lasso Selection (free selection) in Excalidraw]: https://github.com/excalidraw/excalidraw/issues/6350
[25강 - 연필 도구]: /ko/guide/lesson-025#pencil-tool
[How do I determine if two convex polygons intersect?]: https://stackoverflow.com/questions/753140/how-do-i-determine-if-two-convex-polygons-intersect
[Lock and unlock layers]: https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers
