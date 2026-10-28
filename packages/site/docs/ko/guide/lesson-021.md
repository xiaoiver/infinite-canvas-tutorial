---
outline: deep
description: '크기 조절과 회전이 되는 도형 Transformer를 구현합니다. 앵커, 좌표계 변환, CSS 커서 사용자 정의, 히트 영역 확장으로 직관적인 도형 편집을 다룹니다.'
head:
    - ['meta', { property: 'og:title', content: '21강 - 트랜스포머' }]
---

<script setup>
import TransformerRect from '../../components/TransformerRect.vue'
import TransformerRectRotated from '../../components/TransformerRectRotated.vue'
import TransformerLine from '../../components/TransformerLine.vue'
import TransformerPolyline from '../../components/TransformerPolyline.vue'
import TransformerPath from '../../components/TransformerPath.vue'
</script>

# 21강 - 트랜스포머 {#lesson-21-transformer}

[Lesson 14]에서 캔버스 모드의 "선택 모드"를 간단히 소개했습니다. 이 모드에서는 도형을 선택한 뒤 도형 위에 조작 레이어를 겹치고, 드래그로 도형을 옮길 수 있습니다. 이번 강의에서는 크기 조절과 회전을 포함한, 더 많은 도형 편집 기능을 제공합니다.

Konva에서 선택된 도형 위의 조작 레이어는 [Transformer]라고 하며, 다음 예제를 제공합니다.

-   [HTML5 Canvas Shape select, resize and rotate]
-   [Limit Dragging and Resizing]

우리도 Transformer라는 이름을 쓰기로 했습니다. 도형의 AABB와 매우 비슷해 보입니다. 실제로는 OBB(oriented bounding box, 방향이 있는 바운딩 박스)라고 하며, 월드 좌표에서 회전각을 가진 사각형입니다.

<TransformerRect />

## 변환 행렬과 크기 정보 직렬화 {#serialize-transform-dimension}

Figma에서 도형의 로컬 변환 행렬과 크기 정보는 다음과 같습니다. 2D 도형의 mat3 변환 행렬은 이동, 스케일, 회전으로 분해할 수 있습니다. 그중 X/Y는 이동에 해당하고, 스케일은 [뒤집기](#flip) 절에서 다룹니다. [fig-file-parser]

![출처: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions](https://help.figma.com/hc/article_attachments/29799649003671)

그래서 [SerializedNode] 구조를 고쳐, 가능한 한 여러 도형을 서술하게 하고, Circle의 `cx/cy` 같은 일부 위치 속성은 제거했습니다. `x/y`와 `width/height`로 `cx/cy`를 계산할 수 있기 때문입니다.

```ts
export interface TransformAttributes {
    // Transform
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    // Dimension
    width: number;
    height: number;
}
```

`<circle cx="100" cy="100" r="50" />`는 다음과 같이 직렬화합니다. 이후 크기를 더 유연하게 조절할 수 있도록 `ellipse`로 나타냅니다.

```js eval code=false
call(() => {
    const { createSVGElement, svgElementsToSerializedNodes } = ECS;
    const $circle = createSVGElement('circle');
    $circle.setAttribute('cx', '100');
    $circle.setAttribute('cy', '100');
    $circle.setAttribute('r', '50');
    const nodes = svgElementsToSerializedNodes([$circle]);
    return nodes[0];
});
```

`point`와 `d` 속성으로 정의되는 폴리라인과 패스 같은 도형에서는 이 속성을 지울 수 없습니다. 대신 AABB를 계산하고 이 속성들을 다시 계산해야 합니다. `<polyline points="50,50 100,100, 100,50" />`를 예로 들면 다음과 같습니다.

```js eval code=false
call(() => {
    const { createSVGElement, svgElementsToSerializedNodes } = ECS;
    const $polyline = createSVGElement('polyline');
    $polyline.setAttribute('points', '50,50 100,100, 100,50');
    const nodes = svgElementsToSerializedNodes([$polyline]);
    return nodes[0];
});
```

## 앵커 {#anchors}

Transformer의 앵커는 크기 조절(Resize)과 회전의 두 종류로 나뉘며, 개수에는 흔히 쓰이는 조합이 두 가지 있습니다.

하나는 Excalidraw와 Konva가 채택한 방식으로, 둘레의 앵커 8개로 크기를 조절하고 회전 앵커를 따로 둡니다.

![출처: https://csswolf.com/the-ultimate-excalidraw-tutorial-for-beginners/](https://sp-ao.shortpixel.ai/client/to_auto,q_lossy,ret_img,w_1148/https://csswolf.com/wp-content/uploads/2023/11/image-9.png)

다른 하나는 tldraw와 Figma가 채택한 방식으로, 앵커 4개를 사용합니다. 이 4개 앵커에 바깥쪽에서 다가가면 회전이 되고, 가로와 세로 크기 조절은 네 변을 드래그하여 수행합니다.

![출처: https://wpdean.com/how-to-rotate-in-figma/](https://wpdean.com/wp-content/uploads/2024/12/how-to-rotate-in-figma.jpg)

우리는 더 간결해 보이는 이 방식을 골랐습니다. 부모 노드는 `Rect` 마스크이고, 자식 노드 네 개는 `Circle` 앵커입니다.

```ts
const mask = this.commands.spawn(
    new UI(UIType.TRANSFORMER_MASK),
    new Transform(),
    new Renderable(),
    new Rect(), // Using Rect component
);
const tlAnchor = this.createAnchor(0, 0, AnchorName.TOP_LEFT); // Using Circle component
const trAnchor = this.createAnchor(width, 0, AnchorName.TOP_RIGHT);
const blAnchor = this.createAnchor(0, height, AnchorName.BOTTOM_LEFT);
const brAnchor = this.createAnchor(width, height, AnchorName.BOTTOM_RIGHT);

this.commands
    .entity(mask)
    .appendChild(this.commands.entity(tlAnchor))
    .appendChild(this.commands.entity(trAnchor))
    .appendChild(this.commands.entity(blAnchor))
    .appendChild(this.commands.entity(brAnchor));
```

### Transformer 좌표계 {#transformer-coordinates}

[Lesson 6 - Coordinate System Conversion]에서 Viewport, Canvas, Client 좌표계 사이의 변환을 구현했습니다. 여기서는 새로운 좌표계, 즉 마스크의 로컬 좌표계를 도입해야 합니다. 예를 들어 마스크에 회전 같은 변환이 있으면, 자식 노드인 앵커는 월드 좌표계에서의 자기 위치를 알아야 합니다. 이 변환 메서드 묶음을 추가합니다.

```ts
transformer2Canvas(camera: Entity, point: IPointData) {
    const { mask } = camera.read(Transformable);
    const matrix = Mat3.toGLMat3(mask.read(GlobalTransform).matrix);
    const [x, y] = vec2.transformMat3(
      vec2.create(),
      [point.x, point.y],
      matrix,
    );
    return {
      x,
      y,
    };
}
canvas2Transformer(camera: Entity, point: IPointData) {}
```

### CSS 커서 표시 {#display-css-cursor}

앵커 위에 마우스를 올리면, 마우스 스타일이 해당 기능을 직관적으로 보여 줘야 합니다. 웹 쪽에서 `<canvas>` 스타일을 바꿔 구현합니다. 기본 [CSS cursor]가 지원하는 아이콘은 제한적입니다. 예를 들어 회전을 뜻하는 아이콘은 없고, Excalidraw와 Konva에서는 `grab`으로 대신할 수밖에 없습니다. 또 크기 조절용 아이콘은 8개 있지만, 도형은 회전할 수 있습니다. 회전각이 45의 정수배가 아니면, Konva처럼 계산해서 알맞은 아이콘을 골라도 정확하게 나타낼 수 없습니다.

```ts
function getCursor(anchorName: string, rad: number) {
    rad += DEG_TO_RAD * (ANGLES[anchorName] || 0);
    const angle = (((RAD_TO_DEG * rad) % 360) + 360) % 360;

    if (inRange(angle, 315 + 22.5, 360) || inRange(angle, 0, 22.5)) {
        return 'ns-resize';
    }
}
```

그래서 사용자 정의 마우스 스타일이 필요하고, 회전각에 따라 동적으로 조정할 수 있어야 합니다. [How can I rotate a css cursor]는 SVG를 쓰는 방법을 제시하고, tldraw는 그 위에 각도를 동적으로 계산하는 로직을 더합니다. 자세한 내용은 [useCursor]를 참고하세요. 오른쪽 위 앵커를 예로 들면 다음과 같습니다.

![회전 앵커](/transformer-anchor-rotate.png)

SVG 아이콘에 회전 변환을 적용하면, 이때의 Cursor 값을 얻습니다.

```ts
// SVG angles are in degrees; both reflections are in the object's local axes.
const sx = scaleX < 0 ? -1 : 1;
const sy = scaleY < 0 ? -1 : 1;
const r = (rotation - cameraRotation) * RAD_TO_DEG;
const transform = `translate(16 16) rotate(${r}) scale(${sx} ${sy}) rotate(${tr}) translate(-16 -16)`;
```

각 스케일 축의 부호는 유지합니다. SVG는 변환을 오른쪽에서 왼쪽으로 적용합니다. 핸들에 맞게 아이콘의 방향을 잡고, 도형의 로컬 축에서 반사한 다음, 뷰포트 방향으로 회전합니다. 행렬식만으로는 수평 반사, 수직 반사, 양축 반사를 구분할 수 없으며, 회전 뒤에 반사하면 커서가 잘못된 방향을 가리킵니다.

그리고 마우스가 앵커에 더 가까워지면, 회전에서 크기 조절 상호작용으로 바뀝니다.

![크기 조절 앵커](/transformer-anchor-resize.png)

멀리서 앵커에 다가갈 때 피킹을 어떻게 일으킬까요?

### 히트 영역 확장 {#hit-area}

먼저 떠올린 방법은, 도형이 히트 영역을 넓히거나 직접 지정할 수 있게 하는 것입니다. 예를 들어 Pixi.js는 [hitArea]를 제공합니다. Renderable 컴포넌트에도 이 필드를 추가할 수 있습니다.

```ts
export class Renderable {
    @field({ type: Type.object, default: null }) declare hitArea: Circle | Rect;
}
```

ComputeBounds 시스템에서 바운드를 계산할 때 이 속성을 고려하면, 앵커보다 큰 원형 판정 영역을 설정할 수 있습니다.

```ts
if (hitArea instanceof Circle) {
    renderBounds = Circle.getRenderBounds(hitArea);
}
```

하지만 이 방식에는 분명한 문제가 있습니다. 히트 영역을 앵커의 5배로 잡아도, 카메라가 줌되면 여전히 앵커 위에 마우스를 올려야 피킹이 일어납니다. 그래서 Canvas 월드 좌표계 밖에서 피킹을 고려해야 합니다.

### 뷰포트 좌표에서의 피킹 {#picking-in-viewport-coordinates}

Viewport 좌표계에서 피킹 판정을 수행해야 카메라 줌을 무시할 수 있습니다.

먼저 네 앵커의 위치를 Canvas 월드 좌표계에서 계산해야 합니다. 앵커의 `cx/cy`를 그대로 쓰면, Transformer 자체에 회전이 있을 때 어긋납니다(곧 보게 됩니다).

```ts
hitTest(api: API, { x, y }: IPointData) {
    const { tlAnchor, trAnchor, blAnchor, brAnchor } = camera.read(Transformable);

    const { x: tlX, y: tlY } = api.canvas2Viewport(
        // Need to consider Transformer's own transformation, such as rotation
        api.transformer2Canvas(camera, {
            x: tlAnchor.read(Circle).cx,
            y: tlAnchor.read(Circle).cy,
        }),
    );
    // Omit calculation of other anchor positions

    const distanceToTL = distanceBetweenPoints(x, y, tlX, tlY);
}
```

그런 다음, 네 앵커까지의 최소 거리가 크기 조절 상호작용의 임계값을 만족하는지 먼저 판정합니다. 만족하면 해당하는 마우스 스타일 아이콘 이름을 반환하고, 회전각을 더해 회전된 SVG를 얻습니다.

```ts
if (minDistanceToAnchors <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
    if (minDistanceToAnchors === distanceToTL) {
        return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-resize',
        };
    }
}
```

다음에는 회전 상호작용 판정으로 들어갑니다. 이때 판정 점은 Transformer 안에 있을 수 없습니다. [Check if Point Is Inside A Polygon]에서 소개한 판정 방법을 사용할 수 있습니다.

```ts
else if (
    !isInside &&
    minDistanceToAnchors <= TRANSFORMER_ANCHOR_ROTATE_RADIUS
) {
    if (minDistanceToAnchors === distanceToTL) {
        return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-rotate',
        };
    }
}
```

마지막으로 Transformer의 네 변에 대한 크기 조절 판정입니다. 여기서는 판정 점에서 선분까지의 거리를 계산해야 합니다. [Gist - point to line 2d]를 참고하세요.

```ts
import distanceBetweenPointAndLineSegment from 'point-to-segment-2d';

const distanceToTopEdge = distanceBetweenPointAndLineSegment(
    point,
    [tlX, tlY],
    [trX, trY],
);
// Omit calculation of distance to other 3 edges

if (minDistanceToEdges <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
    if (minDistanceToEdges === distanceToTopEdge) {
        return {
            anchor: AnchorName.TOP_CENTER,
            cursor: 'ns-resize',
        };
    }
}
```

## 단일 도형 크기 조절 {#resize-single-shape}

Figma / FigJam에서는 네 모서리 앵커와 네 변을 드래그하여 크기를 자유롭게 바꾸는 것 외에, 다음도 할 수 있습니다.

-   <kbd>Option</kbd> 또는 <kbd>Alt</kbd>를 누른 채 드래그하면 기하학적 중심에서 스케일합니다
-   <kbd>Shift</kbd>를 누른 채 드래그하면 반대쪽 꼭짓점/변을 고정하고, 가로와 세로 방향으로 비례하여 스케일합니다
-   이 키들을 함께 누릅니다

효과는 다음과 같으며, 출처는 [Resize, rotate, and flip objects in FigJam]입니다.

![FigJam에서의 크기 조절](https://help.figma.com/hc/article_attachments/1500011223302)

먼저 크기를 자유롭게 바꾸는 구현을 살펴봅니다. 왼쪽 위 앵커를 예로 들면, 드래그하는 동안 오른쪽 아래 앵커는 고정됩니다.

```ts
private handleSelectedResizing(
    api: API,
    canvasX: number,
    canvasY: number,
    anchorName: AnchorName,
) {
    const { x, y } = api.canvas2Transformer({
      x: canvasX,
      y: canvasY,
    });
    if (anchorName === AnchorName.TOP_LEFT) {
        // Set top-left anchor point position
        Object.assign(tlAnchor.write(Circle), {
            cx: x,
            cy: y,
        });
    }
    // Omit other anchor point handling logic
    {
        const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
        const { cx: brCx, cy: brCy } = brAnchor.read(Circle);
        const width = brCx - tlCx;
        const height = brCy - tlCy;
        const { x, y } = api.transformer2Canvas({ x: tlCx, y: tlCy });
        // Recalculate selected shape position and size
        this.fitSelected(api, {
            x,
            y,
            width,
            height,
            rotation: this.#rotation,
        });
    }
}
```

마지막으로 왼쪽 위와 오른쪽 아래 앵커를 기준으로 선택된 도형을 변환합니다.

### 도형 변환 {#transform-shape}

크기 조절 전과 후의 속성(변환과 크기 정보)을 알고 있으므로, 두 상태 사이의 전이 행렬을 쉽게 계산할 수 있습니다.

```plaintext
// @see https://github.com/konvajs/konva/blob/master/src/shapes/Transformer.ts#L1106

[delta transform] = [new transform] * [old transform inverted]
```

```ts
const baseSize = 10000000;
const oldTr = mat3.create();
mat3.translate(oldTr, oldTr, [oldAttrs.x, oldAttrs.y]);
mat3.rotate(oldTr, oldTr, oldAttrs.rotation);
mat3.scale(oldTr, oldTr, [
    oldAttrs.width / baseSize,
    oldAttrs.height / baseSize,
]);
const newTr = mat3.create();
mat3.translate(newTr, newTr, [newAttrs.x, newAttrs.y]);
mat3.rotate(newTr, newTr, newAttrs.rotation);
mat3.scale(newTr, newTr, [
    newAttrs.width / baseSize,
    newAttrs.height / baseSize,
]);

const delta = mat3.multiply(newTr, newTr, mat3.invert(mat3.create(), oldTr));
```

이 행렬을 선택된 도형에 바로 적용할 수는 없습니다. 씬 그래프에서 부모 노드가 월드 좌표계에서 가지는 변환도 고려해야 합니다.

```plaintext
[delta transform] * [parent transform] * [old local transform] = [parent transform] * [new local transform]
```

부모의 월드 변환의 역행렬을 왼쪽에서 곱하면, 선택된 도형의 로컬 좌표계에서의 새 변환을 얻을 수 있습니다.

```plaintext
[new local] = [parent inverted] * [delta] * [parent] * [old local]
```

마지막으로 로컬 좌표계의 새 행렬을 선택된 도형에 적용합니다.

### 종횡비 고정 {#lock-aspect-ratio}

역시 왼쪽 위 앵커를 예로 들면, 종횡비를 잠글 때는 그 위치를 직접 설정할 수 없습니다. 오른쪽 아래 앵커의 위치는 그대로 두고, 드래그를 시작할 때의 도형 종횡비에 따라 왼쪽 위 앵커의 위치를 다시 계산해야 합니다.

먼저 앵커 드래그를 시작할 때 선택된 도형의 OBB와 종횡비를 기록합니다. 이것은 대각선의 기울기에 해당합니다.

```ts
if (input.pointerDownTrigger) {
    if (type === UIType.TRANSFORMER_ANCHOR) {
        this.#obb = this.getSelectedOBB();
        const { width, height } = this.#obb;
        const hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
        this.#sin = Math.abs(height / hypotenuse);
        this.#cos = Math.abs(width / hypotenuse);
    }
}
```

드래그하는 동안:

1. 오른쪽 아래 앵커의 위치는 그대로 둡니다
2. 이때 왼쪽 위에서 오른쪽 아래까지의 대각선 거리를 계산합니다
3. 앞서 저장한 종횡비에 따라 왼쪽 위 앵커의 위치를 다시 계산합니다

```ts
if (lockAspectRatio) {
    // 1.
    const comparePoint = {
        x: brAnchor.read(Circle).cx,
        y: brAnchor.read(Circle).cy,
    };
    // 2.
    newHypotenuse = Math.sqrt(
        Math.pow(comparePoint.x - x, 2) + Math.pow(comparePoint.y - y, 2),
    );
    const { cx, cy } = tlAnchor.read(Circle);
    const reverseX = cx > comparePoint.x ? -1 : 1;
    const reverseY = cy > comparePoint.y ? -1 : 1;
    // 3.
    Object.assign(tlAnchor.write(Circle), {
        cx: comparePoint.x - newHypotenuse * this.#cos * reverseX,
        cy: comparePoint.y - newHypotenuse * this.#sin * reverseY,
    });
}
```

Konva.js는 종횡비를 유지한 채 네 변을 모두 드래그하는 것을 지원하지 않습니다. 그런 경우에는 이 네 앵커를 비활성화해야 합니다. 자세한 내용은 [Is there a way to keep the image aspect ratio on transform?]을 참고하세요.

우리는 이것을 쉽게 구현할 수 있습니다. 오른쪽 변 앵커를 드래그하는 경우를 예로 들면 다음과 같습니다.

1. 먼저 오른쪽 아래 앵커의 X 좌표를 설정합니다
2. 왼쪽 위 앵커의 X 좌표는 그대로이므로, 변환 후의 너비를 계산할 수 있습니다
3. 종횡비가 잠겨 있으므로 변환 후의 높이도 정해지며, 그 높이를 계산할 수 있습니다
4. 변환 전후의 높이 차이에 따라, 왼쪽 위와 오른쪽 아래 앵커의 Y 좌표를 설정합니다

```ts
if (anchorName === AnchorName.MIDDLE_RIGHT) {
    // 1.
    brAnchor.write(Circle).cx = x;

    if (lockAspectRatio) {
        // 2.
        const newWidth = brAnchor.read(Circle).cx - tlAnchor.read(Circle).cx;
        const tan = sin / cos;
        const newHeight = newWidth * tan; // 3.
        const deltaY = newHeight - (prevBrAnchorY - prevTlAnchorY);
        // 4.
        brAnchor.write(Circle).cy = brAnchor.read(Circle).cy + deltaY / 2;
        tlAnchor.write(Circle).cy = tlAnchor.read(Circle).cy - deltaY / 2;
    }
}
```

드래그하는 동안 대각선을 실시간으로 보여 주면, 사용자에게 분명한 힌트를 줄 수 있습니다(보통 점선).

### 중심 기준 스케일 {#centered-scaling}

역시 왼쪽 위 앵커를 예로 들면, 이때 고정된 기준점은 오른쪽 아래 앵커에서 기하학적 중심점으로 바뀌며, 이것도 드래그 시작 시에 기록합니다.

```ts
const comparePoint = centeredScaling
    ? {
          x: this.#obb.width / 2, // [!code ++]
          y: this.#obb.height / 2, // [!code ++]
      }
    : {
          x: brAnchor.read(Circle).cx,
          y: brAnchor.read(Circle).cy,
      };
```

그런 다음 오른쪽 아래 앵커의 위치를 다시 계산합니다. 중심점에 대해 왼쪽 위 앵커와 대칭입니다.

```ts
if (centeredScaling) {
    const tlOffsetX = tlAnchor.read(Circle).cx - prevTlAnchorX;
    const tlOffsetY = tlAnchor.read(Circle).cy - prevTlAnchorY;
    Object.assign(brAnchor.write(Circle), {
        cx: brAnchor.read(Circle).cx - tlOffsetX,
        cy: brAnchor.read(Circle).cy - tlOffsetY,
    });
}
```

### 뒤집기 {#flip}

앵커나 변을 반대 방향으로 드래그하면 뒤집기가 일어납니다. 다음은 Figma에서의 효과이며, Rotation의 변화에 주목하세요.

![뒤집을 때 180도 회전](/resize-flip.gif)

그라디언트 배경으로 이 뒤집기 효과를 더 분명하게 보여 줍니다.

![그라디언트 채우기가 있는 사각형 뒤집기](/rotate-when-flipped.png)

변을 넘는 뒤집기는 기본적으로 꺼져 있습니다. 이 페이지 맨 위의 인터랙티브 예제는 이것을 켜 두고, 주황에서 파랑으로 이어지는 그라디언트로 미러링이 보이게 합니다.

```ts
api.setAppState({ flipEnabled: true });
```

제스처가 진행되는 동안에는 포인터를 누른 시점의 선택 프레임, 노드 변환, 핸들 정체성을 고정합니다. 포인터를 그 원래 프레임으로 변환하고, 반대쪽 꼭짓점이나 변(Alt / Option을 누른 경우에는 중심)을 기준으로 부호 있는 크기를 계산합니다. 음수 크기는 반사를 의미합니다. 핸들을 서로 바꾼 뒤 너무 이르게 크기의 절댓값을 취하면 그 반사가 사라지거나, 다음 프레임에서 고정된 변이 움직입니다. 크기가 정확히 0일 때는 0이 아닌 작은 크기를 쓰고, 이후 샘플은 계속 원래 프레임에서 계산합니다.

변환을 적용한 뒤에는 노드의 `width` / `height`를 양수로 유지하고, `rotation`과 `scaleX` / `scaleY`는 같은 행렬 분해에서 얻습니다. 분해된 회전과 이전 스케일의 부호를 조합하는 것은 올바르지 않습니다. 패스, 폴리라인, VectorNetwork 기하를 구울 때는 Transform에 이미 남아 있는 회전과 반사를 제거하여, 기하가 두 번 미러링되지 않게 합니다.

반사된 행렬은 서로 동등한 회전/스케일 분해를 가질 수 있습니다. Rotation이 180° 바뀌었는지만 요구하지 말고, 미러링된 도형과 그라디언트, 고정된 변, 핸들 위치를 확인합니다. Shift는 종횡비를 유지하고 Alt / Option은 중심을 유지합니다. 손을 뗀 뒤의 프레임, 다음 제스처, 실행 취소/다시 실행도 일관되어야 합니다.

## 회전 {#rotation}

Figma에서의 회전:

> 레이어 경계 바로 바깥에 마우스를 올리면 아이콘이 나타납니다.
> 클릭한 뒤 드래그하여 선택 항목을 회전합니다.
> 시계 방향으로 드래그하면 음의 각도(-180° 쪽)가 됩니다.
> 시계 반대 방향으로 드래그하면 양의 각도(180° 쪽)가 됩니다.
> Shift를 누른 채 회전하면 15° 간격으로 스냅됩니다.

1. 포인터를 누를 때 OBB와 로컬 피벗, 월드 피벗을 모두 저장합니다. 사용자 지정 피벗이 없으면 기하학적 중심을 사용합니다.
2. 캔버스 좌표에서 이전 포인터 각도를 추적합니다. 인접한 `atan2` 차이를 누적하고 `atan2(sin, cos)`로 정규화하여 ±π를 넘어도 연속되게 합니다.
3. 그 고정된 피벗과 초기 OBB로 새 원점과 회전을 구하고, `Select.fitSelected`로 노드를 갱신합니다. 다중 선택 회전 중에는 같은 방식으로 회전한 초기 프레임을 표시하고, 손을 떼면 월드 축에 정렬된 합집합으로 되돌립니다.

ECS 모듈 `systems/select/rotate-gesture.ts`가 제스처의 시작, 샘플링, 완료, 정리를 담당합니다. `Select`는 입력 분배, 노드 갱신, 히스토리를 유지합니다. `resize-gesture.ts`는 크기 조절 제약, 스냅, 끝점 드래그, 터치 오프셋을 담당합니다.

```ts
// Pointer down, after converting to canvas coordinates and pixel snapping:
beginRotateGesture(api, selection, { x: canvasX, y: canvasY });

// Pointer move:
updateRotateGesture(api, selection, { x: canvasX, y: canvasY }, (obb) => {
    this.fitSelected(api, obb, selection);
});

// Pointer up; Select records the resulting document once afterwards:
finishRotateGesture(api, selection);
```

<TransformerRectRotated />

### 회전 원점 변경 {#change-the-rotation-origin}

다음은 Figma의 [Change the rotation origin] 효과입니다.

![회전 원점 변경](https://help.figma.com/hc/article_attachments/31937330391447)

구현 메모:

1. Transformer 마스크에 중심 앵커(`AnchorName.CENTER`)를 추가합니다. 이 앵커는 드래그할 수 있습니다.
2. 사용자 지정 회전 원점을 Transformer 로컬 좌표(`rotatePivotX/Y`)에 저장하고, 사용자가 고정했는지(`rotatePivotPinned`)를 표시합니다.
3. 중심 앵커를 드래그하는 동안 포인터가 움직이면, 캔버스 좌표를 Transformer 로컬 좌표로 변환합니다.

```ts
const { x, y } = api.canvas2Transformer({ x: canvasX, y: canvasY }, mask);
tf.rotatePivotX = x;
tf.rotatePivotY = y;
tf.rotatePivotPinned = true;
```

4. 회전하는 동안 이 피벗을 사용하고(설정되지 않았으면 기하학적 중심으로 되돌림), 새 OBB 원점을 구할 때 피벗의 월드 위치는 고정합니다.

```ts
const {
    obb,
    pivotWorld: [px, py],
    pivotLocal: [lx, ly],
} = gesture;
const rotation = obb.rotation + gesture.accumulated;
const c = Math.cos(rotation);
const s = Math.sin(rotation);
const newAttrs = {
    ...obb,
    x: px - lx * obb.scaleX * c + ly * obb.scaleY * s,
    y: py - lx * obb.scaleX * s - ly * obb.scaleY * c,
    rotation,
};
```

5. 선택된 노드 집합이 바뀌면 피벗을 중심으로 되돌립니다.

## 방향키로 도형 이동 {#nudge-the-position}

Figma는 [Nudge layers] 기능을 제공하여, 위, 아래, 왼쪽, 오른쪽 방향키로 도형을 옮길 수 있고 <kbd>Shift</kbd>로 더 큰 거리도 이동할 수 있습니다. 우리 구현에서는 고정된 거리를 사용합니다.

```ts
if (e.key === 'ArrowUp') {
    e.preventDefault();
    this.api.updateNodeOBB(selected, { y: selected.y - 10 });
    this.api.record();
}
```

## 선택 항목 정렬과 분배 {#align-distribute}

ECS API는 `left`, `right`, `top`, `bottom`, `centerH`, `centerV`의 여섯 가지 정렬 모드를 제공합니다. 스트로크 두께를 제외한, 월드 공간의 기하 바운드를 사용합니다. 바뀌는 것은 위치뿐입니다. 회전, 반사, 크기, 패스 데이터, 텍스트 메트릭, Flex 크기 설정은 그대로 유지되며, 부모가 회전하거나 스케일된 경우에도 같습니다.

```ts
const ids = [...api.getAppState().layersSelected];
await api.edit((editor) => {
    editor.alignSelectedNodes('left', ids);
});
// Run a separate edit so derived geometry is refreshed between operations.
await api.edit((editor) => {
    editor.distributeSelectedNodesSpacing('horizontal', ids);
});
```

간격 분배는 `horizontal` 또는 `vertical`을 받습니다. 해당 월드 축을 따라 노드를 정렬하고, 선택 영역의 범위에서 가장자리와 가장자리 사이의 간격을 균등하게 계산합니다. 도형이 겹치면 간격은 음수가 될 수 있습니다. 중복된 ID, 삭제되었거나 없거나 잠긴 노드, 역행렬을 구할 수 없는 부모 변환은 건너뜁니다. 선택된 자손은 선택된 조상과 함께 움직이며 두 번 이동하지 않습니다. 조건을 만족하는 최상위 노드가 적어도 두 개 필요합니다. 이 메서드는 노드가 이동했는지를 반환하며, 레이아웃이 변하지 않았으면 메서드 자체가 기록을 남기지 않습니다.

속성 패널은 이 작업을 `api.edit()`으로 제출합니다. 클릭이 받아들인 캔버스와 ID를 유지하고, 쓰기 단계에서 현재 노드를 확인한 뒤, 실행 취소 한 단계로 커밋합니다. 삭제나 잠금 때문에 변화가 없으면, 대기 중인 작업은 관련 없는 미반영 편집을 기록하지 않고 취소됩니다. API를 호출하는 쪽에서도 `edit()`에 `AbortSignal`을 넘겨, 변경이 일어나기 전에 취소할 수 있습니다.

## 다른 도형의 Transformer {#transformer-for-other-shapes}

지금까지 구현한 Transformer는 원, 타원, 사각형 같은 도형에는 맞지만, 직선, 폴리라인 구간, 구간별 곡선에는 맞지 않습니다. 후자는 제어점이 더 필요합니다.

### 직선의 Transformer {#transformer-for-line}

직선에는 앵커가 두 개만 필요하므로, 앞에서 소개한 바운딩 사각형에 기반한 일련의 처리를 크게 단순화할 수 있습니다.

```ts
export class Transformable {
    @field.ref declare lineMask: Entity;
    @field.ref declare x1y1Anchor: Entity;
    @field.ref declare x2y2Anchor: Entity;
}
```

![직선의 Transformer](/line-transformer.gif)

<TransformerLine />

### 폴리라인의 Transformer {#transformer-for-polyline}

폴리라인에서는 각 연결점에 대응하는 제어점이 있고, 인접한 제어점 쌍마다 그 사이에 점을 하나 더 넣어 새 선분을 만듭니다.

```ts
export class Transformable {
    @field.ref declare polylineMask: Entity;
    @field.object declare controlPoints: Entity[];
    @field.object declare segmentMidpoints: Entity[];
}
```

이에 대응하는 상호작용은, 제어점 위에 마우스를 올린 뒤 <kbd>Delete</kbd> 키로 그 점을 삭제하는 것입니다. 사각형 Transformer의 크기 조절 및 회전과 정점 편집을 함께 수용하기 위해, 두 번 클릭하여 제어점 편집 모드로 들어가는 것도 지원합니다.

<TransformerPolyline />

### 패스 {#transformer-for-path}

tldraw는 [cubic-bezier-shape] 예제를 제공합니다. 인터랙티브 편집에서는 두 문제를 풀어야 합니다.

1. **안정적인 편집 가능 점**: 모든 앵커와 모든 베지에 제어점을 선택하고 드래그할 수 있으며, 변경은 `d`에 다시 씁니다.
2. **의미를 잃지 않는 왕복**: 가능한 한 작고 예측 가능한 명령 타입 집합을 쓰고, 에디터 안에서 완전한 패스 파서를 직접 만들지 않습니다.

그래서 `d`를 적은 수의 명령 어휘로 정규화하고(예를 들어 상대 명령을 절대 명령으로 변환), **명령 인덱스 + 배열 안의 좌표 오프셋**을 각 핸들의 정체성으로 사용합니다. 드래그하는 동안에는 숫자 좌표만 바뀌고, 마지막에 `path2String`이 다시 문자열로 직렬화합니다.

| 명령  | 만들어지는 핸들 | `meta`의 의미                                                            |
| ----- | --------------- | ------------------------------------------------------------------------ |
| M / L | 정점 하나       | `coordOffset: 1` → 그 점 `(x, y)`                                        |
| Q     | 제어점 + 끝점   | 오프셋 `1`과 `3`                                                         |
| C     | cp1, cp2, 끝점  | 오프셋 `1`, `3`, `5`                                                     |
| A     | 끝점만          | 오프셋 `6`(이 에디터에서 호에는 베지에 핸들이 없으며, 끝점만 노출됩니다) |

```ts
interface PathControlHandleMeta {
    commandIndex: number; // Index in the normalized command array.
    coordOffset: number; // Start index of this handle’s coordinates (1-based, since `command[0]` is the command letter).
}

type HandlePoint = {
    x: number;
    y: number;
    meta: PathControlHandleMeta;
};
```

마찬가지로, 두 번 클릭하면 제어점 편집 모드로 들어갑니다.

<TransformerPath />

## 더 읽어보기 {#extended-reading}

-   [Graphics Editor Development: Custom Cursor]

[Lesson 14]: /ko/guide/lesson-014
[Limit Dragging and Resizing]: https://konvajs.org/docs/sandbox/Limited_Drag_And_Resize.html
[HTML5 Canvas Shape select, resize and rotate]: https://konvajs.org/docs/select_and_transform/Basic_demo.html
[Transformer]: https://konvajs.org/api/Konva.Transformer.html
[Change the rotation origin]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01JTK11ERHCSVFRSE9F4125HAZ
[Resize, rotate, and flip objects in FigJam]: https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam
[Nudge layers]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01HNBH5565CW1S5FTNP6RZF00C
[How can I rotate a css cursor]: https://stackoverflow.com/questions/44817022/how-can-i-rotate-a-css-cursor
[Graphics Editor Development: Custom Cursor]: https://zhuanlan.zhihu.com/p/667709457
[useCursor]: https://github.com/tldraw/tldraw/blob/324a049abe8f414f96fdcbca68bb95396b6c1a46/packages/editor/src/lib/hooks/useCursor.ts#L12
[CSS cursor]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
[hitArea]: https://pixijs.com/8.x/examples/events/custom-hitarea
[Check if Point Is Inside A Polygon]: https://stackoverflow.com/questions/22521982/check-if-point-is-inside-a-polygon
[Gist - point to line 2d]: https://gist.github.com/mattdesl/47412d930dcd8cd765c871a65532ffac
[Lesson 6 - Coordinate System Conversion]: /ko/guide/lesson-006#coordinates
[SerializedNode]: /ko/guide/lesson-010#shape-to-serialized-node
[fig-file-parser]: https://madebyevan.com/figma/fig-file-parser
[Is there a way to keep the image aspect ratio on transform?]: https://github.com/konvajs/react-konva/issues/407
[cubic-bezier-shape]: https://examples.tldraw.com/cubic-bezier-shape
