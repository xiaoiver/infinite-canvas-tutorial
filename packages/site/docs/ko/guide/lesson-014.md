---
outline: deep
description: 'zIndex와 sizeAttenuation 속성을 포함한 캔버스 모드와 보조 UI를 구현합니다. 캔버스 조작용 손 모드와, 속성 패널로 도형을 편집하는 선택 모드를 추가합니다.'
head:
    - [
          'meta',
          { property: 'og:title', content: '14강 - 캔버스 모드와 보조 UI' },
      ]
---

# 14강 - 캔버스 모드와 보조 UI {#lesson-14-canvas-mode-and-auxiliary-ui}

이전에는 Web Components로 카메라 확대/축소와 이미지 다운로드를 포함한 몇 가지 캔버스 UI 컴포넌트를 구현했습니다. 이번 강의에서는 컴포넌트를 통해 더 많은 캔버스 기능을 노출하고, 새로운 그리기 속성을 구현합니다.

-   `zIndex`와 `sizeAttenuation` 그리기 속성 구현
-   손 모드에서 캔버스 이동, 회전, 확대/축소
-   선택 모드에서 도형을 선택하고 드래그하여 이동하며, 도형 속성 패널을 표시

캔버스 모드를 구현하기 전에, `zIndex`와 `sizeAttenuation` 그리기 속성을 지원하기 위한 준비 작업이 필요합니다.

## zIndex 구현 {#z-index}

도형을 선택한 뒤 표시되는 마스크 레이어는 모든 도형 위에 표시되어야 합니다. 여기에는 표시 순서가 관련되며, `zIndex`로 제어합니다.

```ts
mask.zIndex = 999;
```

CSS의 [z-index]에서 값은 같은 [Stacking context] 안에서만 의미가 있습니다. 예를 들어 아래 그림에서 `DIV #4`의 `z-index`가 `DIV #1`보다 높아도, `DIV #3`의 컨텍스트 안에 있기 때문에 더 아래에 렌더링됩니다.

![z-index 이해하기](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context/understanding_zindex_04.png)

정렬은 성능 비용이 매우 큰 연산이므로, Shape에 `sortDirtyFlag` 속성을 추가하고, `zIndex`가 바뀔 때마다 `true`로 설정합니다.

```ts
class Sortable {
    get zIndex() {
        return this.#zIndex;
    }
    set zIndex(zIndex: number) {
        if (this.#zIndex !== zIndex) {
            this.#zIndex = zIndex;
            this.renderDirtyFlag = true;
            if (this.parent) {
                this.parent.sortDirtyFlag = true; // [!code ++]
            }
        }
    }
}
```

`appendChild`와 `removeChild`에서도 이를 고려해야 합니다.

```ts
class Shapable {
    appendChild(child: Shape) {
        if (child.parent) {
            child.parent.removeChild(child);
        }

        child.parent = this;
        child.transform._parentID = -1;
        this.children.push(child);

        if (!isUndefined(child.zIndex)) {
            this.sortDirtyFlag = true; // [!code ++]
        }

        return child;
    }
}
```

그다음 렌더링 루프의 각 틱에서 더티 검사를 하고, 필요하면 정렬합니다. `children`을 직접 바꾸고 싶지는 않아서, 정렬 결과는 `sorted`에 담습니다. 결국 `z-index`는 렌더링 순서에만 영향을 주어야 하고, 씬 그래프의 실제 순서에는 영향을 주지 않아야 하기 때문입니다.

```ts
traverse(this.#root, (shape) => {
    if (shape.sortDirtyFlag) {
        shape.sorted = shape.children.slice().sort(sortByZIndex); // [!code ++]
        shape.sortDirtyFlag = false; // [!code ++]
    }
    // Omit rendering each shape.
});
```

`sortByZIndex`의 구현은 다음과 같습니다. `zIndex`가 설정되어 있으면 내림차순으로 정렬하고, 그렇지 않으면 부모 노드 안의 원래 순서를 유지합니다. 여기서 `children`을 바꾸지 않는 이유도 드러납니다. 이 배열이 기본 정렬의 기준을 유지하기 때문입니다.

```ts
export function sortByZIndex(a: Shape, b: Shape) {
    const zIndex1 = a.zIndex ?? 0;
    const zIndex2 = b.zIndex ?? 0;
    if (zIndex1 === zIndex2) {
        const parent = a.parent;
        if (parent) {
            const children = parent.children || [];
            return children.indexOf(a) - children.indexOf(b);
        }
    }
    return zIndex1 - zIndex2;
}
```

```js eval code=false
circle1Zindex = Inputs.range([-10, 10], {
    label: 'z-index of red circle',
    value: 0,
    step: 1,
});
```

```js eval code=false
circle2Zindex = Inputs.range([-10, 10], {
    label: 'z-index of green circle',
    value: 0,
    step: 1,
});
```

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false inspector=false
circle1 = call(() => {
    const { Circle } = Core;
    return new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
    });
});
```

```js eval code=false inspector=false
circle2 = call(() => {
    const { Circle } = Core;
    return new Circle({
        cx: 150,
        cy: 150,
        r: 50,
        fill: 'green',
    });
});
```

```js eval code=false inspector=false
call(() => {
    circle1.zIndex = circle1Zindex;
    circle2.zIndex = circle2Zindex;
});
```

```js eval code=false inspector=false
call(() => {
    $icCanvas3.setAttribute('modes', '[]');

    $icCanvas3.style.width = '100%';
    $icCanvas3.style.height = '250px';

    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        canvas.appendChild(circle1);
        canvas.appendChild(circle2);
    });
});
```

SVG로 내보낼 때 `z-index`는 요소 속성에 직접 대응시킬 수 없습니다. SVG는 문서에 요소가 나타나는 순서에 따라 렌더링되기 때문입니다. [How to use z-index in svg elements?]를 참고하세요.

> SVG에서 z-index는 요소가 문서에 나타나는 순서로 정의됩니다.

따라서 내보낼 때 정렬을 한 번 더 해야 합니다. `SerializedNode`의 정렬 구현은 `Shape`와 거의 같으므로 여기서는 생략합니다.

```ts
export function toSVGElement(node: SerializedNode, doc?: Document) {
    // Omit handling other attributes.
    [...children]
        .sort(sortByZIndex) // [!code ++]
        .map((child) => toSVGElement(child, doc))
        .forEach((child) => {
            $g.appendChild(child);
        });

    return $g;
}
```

## sizeAttenuation 구현 {#size-attenuation}

이전에 [폴리라인의 sizeAttenuation](/ko/guide/lesson-012#size-attenuation)를 언급했습니다. 도형을 선택한 뒤 마스크 레이어와 앵커 포인트를 표시할 때, 카메라 확대/축소에 따라 크기가 바뀌는 것을 원하지 않습니다. 예를 들어 excalidraw에서는 드래그 핸들(handle) 같은 보조 UI의 선 두께를 확대/축소 수준에 맞춰 조절하며, 이때 Canvas2D API를 사용합니다.

```ts
const renderTransformHandles = (): void => {
    context.save();
    context.lineWidth = 1 / appState.zoom.value; // [!code ++]
};
```

물론 조정을 위해 `u_ZoomScale`을 셰이더에 이미 전달해 두었습니다.

### 정점 압축 {#vertex-compression}

`sizeAttenuation`처럼 0과 1만 가지는 플래그 비트에는 정점 압축 기술을 쓸 수 있습니다. 간단히 말해, 이런 정점 데이터를 vec4에 담고 일정한 압축 기법을 써서, CPU에서 GPU로 데이터를 옮기는 시간을 줄이고 GPU 메모리도 크게 절약합니다. 또한 OpenGL이 지원하는 attribute 개수에는 상한이 있습니다. 압축 방식도 매우 단순합니다. CPU 쪽 JS에서 압축하고, 정점 셰이더에서 해제합니다. mapbox와 Cesium 모두에서 쓰입니다. [Graphics Tech in Cesium - Vertex Compression]을 참고하세요. 아래에서 두 값을 하나의 `float`로 압축하는 방법을 살펴봅니다.

GLSL에서 float는 단정밀도 부동소수점 수인 [Scalars], 즉 IEEE-754 [Single-precision floating-point format]입니다.

![binary32 비트 배치](https://picx.zhimg.com/v2-05e8c5427795ebe84919ceef053adaad_1440w.png)

`sizeAttenuation`과 `type`을 하나의 `float`로 압축할 수 있습니다. `sizeAttenuation`은 1비트, `type`은 23비트를 차지합니다.

```ts
const LEFT_SHIFT23 = 8388608.0;
const compressed = (sizeAttenuation ? 1 : 0) * LEFT_SHIFT23 + type;

const u_Opacity = [opacity, fillOpacity, strokeOpacity, type]; // [!code --]
const u_Opacity = [opacity, fillOpacity, strokeOpacity, compressed]; // [!code ++]
```

셰이더에서 디코딩할 때도 인코딩과 같은 순서를 유지해야 합니다.

```glsl
#define SHIFT_RIGHT23 1.0 / 8388608.0
#define SHIFT_LEFT23 8388608.0

// unpack data(sizeAttenuation(1-bit), type(23-bit))
float compressed = a_Opacity;

// sizeAttenuation(1-bit)
float sizeAttenuation = floor(compressed * SHIFT_RIGHT23);
compressed -= sizeAttenuation * SHIFT_LEFT23;

// type(23-bit)
float type = compressed;
```

`sizeAttenuation`을 얻은 뒤에는 정점 셰이더에서 이 값으로 정점 좌표를 조정합니다. SDF 구현을 예로 듭니다.

```glsl
float scale = 1.0;
if (sizeAttenuation > 0.5) {
    scale = 1.0 / u_ZoomScale;
}
gl_Position = vec4((u_ProjectionMatrix
    * u_ViewMatrix
    * model
    * vec3(position + v_FragCoord, 1)).xy, zIndex, 1); // [!code --]
    * vec3(position + v_FragCoord * scale, 1)).xy, zIndex, 1); // [!code ++]
```

### SVG 내보내기 {#export-svg}

이 속성은 카메라 확대/축소와 관련되므로 SVG를 내보낼 때 추가 처리가 필요합니다. SVG는 [vector-effect]를 제공합니다.

-   `non-scaling-size` -> `sizeAttenuation`. 다만 구현이 없고 at-risk로 간주됩니다.
-   `non-scaling-stroke` -> `strokeAttenuation`

## 캔버스 모드 {#canvas-mode}

무한 캔버스는 보통 선택 모드, 손 모드, 펜 모드처럼 여러 모드를 지원합니다. [Excalidraw ToolType]과 [rnote]를 참고할 수 있습니다.

같은 상호작용 동작도 모드에 따라 서로 다른 작업에 대응합니다. 예를 들어 캔버스 위에서의 드래그는 선택 모드에서는 영역 선택에 해당하고, 손 모드에서는 캔버스 전체를 드래그하며, 펜 모드에서는 펜 자국을 자유롭게 그립니다.

먼저 캔버스에 선택 모드와 손 모드를 추가합니다. 이후 더 확장할 수 있습니다.

```ts
export enum CanvasMode {
    SELECT,
    HAND,
    DRAW_RECT,
}

class Canvas {
    #mode: CanvasMode = CanvasMode.HAND;
    get mode() {
        return this.#mode;
    }
    set mode(mode: CanvasMode) {
        this.#mode = mode;
    }
}
```

이 모드들을 전환하는 새 UI 컴포넌트를 구현해 보겠습니다.

## 모드 선택 툴바 {#mode-toolbar}

Lit의 [Dynamic classes and styles]를 사용하면 [clsx]와 비슷한 효과를 낼 수 있습니다. 프로젝트에서 [tailwindcss]를 써 보았다면 익숙할 것입니다. `className`을 관리하고, 조건에 따라 생성할 수 있습니다. 여기서는 선택된 모드의 강조 스타일을 구현하는 데 씁니다.

```ts
@customElement('ic-mode-toolbar')
export class ModeToolbar extends LitElement {
    render() {
        const items = [
            { name: CanvasMode.HAND, label: 'Move', icon: 'arrows-move' },
            { name: CanvasMode.SELECT, label: 'Select', icon: 'cursor' },
            {
                name: CanvasMode.DRAW_RECT,
                label: 'Draw rectangle',
                icon: 'sqaure',
            },
        ];
        return html`
            <sl-button-group label="Zoom toolbar">
                ${map(items, ({ name, label, icon }) => {
                    const classes = { active: this.mode === name }; // [!code ++]
                    return html`<sl-tooltip content=${label}>
                        <sl-icon-button
                            class=${classMap(classes)}
                            name=${icon}
                            label=${label}
                            @click="${() => this.changeCanvasMode(name)}"
                        ></sl-icon-button>
                    </sl-tooltip>`;
                })}
            </sl-button-group>
        `;
    }
}
```

또한 템플릿 코드의 양을 줄이기 위해 Lit의 [Built-in directives - map]을 사용했습니다. 결과는 다음과 같습니다.

```js eval code=false
call(() => {
    const $canvas = document.createElement('ic-canvas');
    $canvas.style.width = '100%';
    $canvas.style.height = '100px';
    return $canvas;
});
```

## 손 모드 {#hand-mode}

이름 그대로, 이 모드에서 사용자는 캔버스 전체를 팬, 회전, 확대/축소하는 것만 할 수 있습니다. 이전에 [CameraControlPlugin]을 구현했으므로, 이제 캔버스 모드와 결합합니다. 손 모드의 동작은 원래와 같아서, 캔버스를 이동하거나 회전합니다. 달라진 점은 드래그가 시작될 때와 진행되는 동안 마우스 스타일을 `grab`과 `grabbing`으로 바꾼다는 것입니다.

```ts
export class CameraControl implements Plugin {
    apply(context: PluginContext) {
        root.addEventListener('drag', (e: FederatedPointerEvent) => {
            const mode = getCanvasMode();
            if (mode === CanvasMode.HAND) {
                setCursor('grabbing'); // [!code ++]

                if (rotate) {
                    rotateCamera(e);
                } else {
                    moveCamera(e);
                }
            }
        });
    }
}
```

### 휠로 캔버스 팬 {#pan-with-wheel}

오랫동안 `wheel`을 스크롤 동작이나 `scroll` 이벤트와 잘못 혼동해 왔습니다. [Element: wheel event]에 대한 MDN의 설명은 다음과 같습니다.

> wheel 이벤트가 반드시 scroll 이벤트를 발생시키지는 않습니다. 예를 들어 요소가 아예 스크롤되지 않을 수도 있습니다. 휠이나 트랙패드로 확대/축소하는 동작도 wheel 이벤트를 발생시킵니다.

Figma와 Excalidraw를 쓰면서, 드래그 외에도 휠로 캔버스 팬을 빠르게 끝낼 수 있다는 점을 알게 되었습니다. Excalidraw는 다른 캔버스 모드에서도 `Space`를 누른 채 드래그하는 것을 지원합니다. [handleCanvasPanUsingWheelOrSpaceDrag]를 참고하세요. 따라서 먼저 원래의 확대/축소 로직을 수정합니다.

```ts
root.addEventListener('wheel', (e: FederatedWheelEvent) => {
    e.preventDefault();

    // zoomByClientPoint(  // [!code --]
    //     { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }, // [!code --]
    //     e.deltaY, // [!code --]
    // ); // [!code --]
    camera.x += e.deltaX / camera.zoom; // [!code ++]
    camera.y += e.deltaY / camera.zoom; // [!code ++]
});
```

매번 이동하는 거리는 카메라의 현재 확대/축소 수준을 고려해야 하며, 확대된 상태에서는 한 번에 이동하는 거리가 더 작아야 한다는 점에 유의하세요.

### 휠로 캔버스 확대/축소 {#zoom-with-wheel}

물론 확대/축소 동작은 그대로 남겨 두어야 하며, `Command` 또는 `Control`을 눌렀을 때 발생합니다. Mac 트랙패드에서 `pinch to zoom` 기능을 켜 두었다면, 그때 발생하는 `wheel` 이벤트에는 `ctrlKey`가 자동으로 실립니다. [Catching Mac trackpad zoom]을 참고하세요.

![Mac 트랙패드에서의 확대](/mac-trackpad-zoom.gif)

이렇게 하면 확대/축소와 팬에서 `wheel` 이벤트가 가리키는 서로 다른 동작을 쉽게 구분할 수 있습니다.

```ts
root.addEventListener('wheel', (e: FederatedWheelEvent) => {
    e.preventDefault();

    if (e.metaKey || e.ctrlKey) {
        zoomByClientPoint(
            { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
            e.deltaY,
        );
    } else {
        camera.x += e.deltaX / camera.zoom;
        camera.y += e.deltaY / camera.zoom;
    }
});
```

Excalidraw는 <kbd>Shift</kbd>를 누른 채 캔버스를 가로로 스크롤하는 것도 지원한다는 점을 언급해 둘 만합니다. 다만 우리는 이미 캔버스의 이 동작에 회전을 할당했으므로, 여기서는 구현하지 않습니다.

## 선택 모드 {#select-mode}

선택 모드에서 사용자는 클릭으로 캔버스의 도형을 선택할 수 있습니다. 선택된 상태에서는 원래 도형 위에 보조 UI가 겹치며, 보통 마스크 레이어와 여러 앵커 포인트로 이루어집니다. 마스크 레이어를 드래그하면 도형을 옮길 수 있고, 앵커 포인트를 드래그하면 여러 방향으로 도형 크기를 바꿀 수 있습니다. 도형 위쪽 바깥에는 회전용 앵커 포인트도 하나 추가합니다.

![물리적 속성을 나타낸 앵커 배치 다이어그램](https://developer.chrome.com/blog/anchor-positioning-api/image/anchor-diagram-1.png)

### 클릭으로 도형 선택 {#select-shape}

아래에서 Selector 플러그인을 구현합니다. 다음 인터페이스도 Canvas에 노출됩니다.

```ts
export class Selector implements Plugin {
    selectShape(shape: Shape): void;
    deselectShape(shape: Shape): void;
}
```

이 플러그인에서 `click` 이벤트를 수신한 뒤에는 다음 상황을 처리해야 합니다.

-   도형을 클릭하면 선택 상태의 UI가 표시됩니다. 이전에 다른 도형이 선택되어 있었다면 먼저 선택을 해제합니다.
-   캔버스의 빈 영역을 클릭하면 현재 선택된 도형의 선택이 해제됩니다.
-   <kbd>Shift</kbd>를 누르고 있으면 다중 선택 모드로 들어갑니다.

```ts
const handleClick = (e: FederatedPointerEvent) => {
    const mode = getCanvasMode();
    if (mode !== CanvasMode.SELECT) {
        return;
    }

    const selected = e.target as Shape;

    if (selected === root) {
        if (!e.shiftKey) {
            this.deselectAllShapes();
            this.#selected = [];
        }
    } else if (selected.selectable) {
        if (!e.shiftKey) {
            this.deselectAllShapes();
        }
        this.selectShape(selected);
    } else if (e.shiftKey) {
        // Multi select
    }
};
root.addEventListener('click', handleClick);
```

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, CanvasMode, RoughEllipse } = Core;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    // $icCanvas.setAttribute('zoom', '200');
    $icCanvas.setAttribute('mode', CanvasMode.SELECT);
    $icCanvas.style.width = '100%';
    $icCanvas.style.height = '200px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const ellipse = new RoughEllipse({
            cx: 200,
            cy: 100,
            rx: 50,
            ry: 50,
            fill: 'black',
            strokeWidth: 2,
            stroke: 'red',
            fillStyle: 'zigzag',
        });
        canvas.appendChild(ellipse);

        // setTimeout(() => {
        canvas.selectShape(ellipse);
        // }, 1000);
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### 드래그하여 도형 이동 {#dragndrop-move}

HTML은 드래그를 기본으로 지원합니다. 물론 `pointermove / up / down` 같은 더 낮은 수준의 이벤트로도 구현할 수 있습니다. [Drag'n'Drop with mouse events]를 참고하세요. 우리 구현도 이 글의 아이디어를 참고했습니다. `dragstart` 이벤트에서는 캔버스 위 마우스의 오프셋을 기록합니다. 카메라 확대/축소를 고려해야 하므로, 여기서는 `screen` 좌표계를 사용한다는 점에 유의하세요.

```ts
let shiftX = 0;
let shiftY = 0;
this.addEventListener('dragstart', (e: FederatedPointerEvent) => {
    const target = e.target as Shape;
    if (target === this.mask) {
        shiftX = e.screen.x;
        shiftY = e.screen.y;
    }
});
```

`drag` 이벤트에서는 오프셋에 따라 마스크 레이어의 위치를 조정합니다. `position` 속성을 쓰면 마스크 패스 정의를 수정할 필요가 없고, 하위 렌더링에서는 `u_ModelMatrix`만 바뀝니다.

```ts
const moveAt = (canvasX: number, canvasY: number) => {
    const { x, y } = this.mask.position;
    const dx = canvasX - shiftX - x;
    const dy = canvasY - shiftY - y;

    this.mask.position.x += dx;
    this.mask.position.y += dy;
};

this.addEventListener('drag', (e: FederatedPointerEvent) => {
    const target = e.target as Shape;
    const { x, y } = e.screen;

    if (target === this.mask) {
        moveAt(x, y);
    }
});
```

`dragend` 이벤트에서는 마스크 레이어의 위치를 도형에 동기화합니다. 이때 마스크 패스가 수정됩니다.

```ts
this.addEventListener('dragend', (e: FederatedEvent) => {
    const target = e.target as Shape;
    if (target === this.mask) {
        this.tlAnchor.cx += this.mask.position.x;
        this.tlAnchor.cy += this.mask.position.y;

        const { cx: tlCx, cy: tlCy } = this.tlAnchor;

        this.mask.position.x = 0;
        this.mask.position.y = 0;
        this.mask.d = `M${tlCx} ${tlCy}L${trCx} ${trCy}L${brCx} ${brCy}L${blCx} ${blCy}Z`;
    }
});
```

### 속성 패널 표시 {#property-panel}

도형이 선택되면 그 도형에 해당하는 속성 패널을 표시하고자 합니다. [Drawer - Contained to an Element]를 참고하세요. 여기서는 펼쳐 설명하지 않습니다. `stroke` 속성을 예로 들면 양방향 바인딩을 합니다. 현재 선택된 도형을 지켜보고, 사용자가 직접 값을 고치면 새 값을 도형에 동기화합니다.

```html
<sl-color-picker
    hoist
    size="small"
    value="${this.shape?.stroke}"
    @sl-input="${this.handleStrokeChange}"
    opacity
></sl-color-picker>
```

색상에서는 투명도를 분리하고 싶다는 점에 유의해야 합니다. 그래서 [sl-color-picker]의 `getFormattedValue` 메서드로 색상 값을 얻은 다음, `d3-color` 라이브러리로 파싱하고, `stroke`와 `strokeOpacity`에 각각 값을 넣습니다.

```ts
const strokeAndOpacity = (e.target as any).getFormattedValue('rgba') as string;
const { rgb, opacity } = rgbaToRgbAndOpacity(strokeAndOpacity); // with d3-color
```

물론 선택 모드에서 구현해야 할 기능은 더 많습니다. 선택한 항목을 그룹으로 합치기, 도형 회전 등이 있으며, 이후 강의에서 계속 다듬겠습니다. 또한 그리기 모드에서는 사각형, 직선, 다각형 등의 그리기를 지원하고자 하며, 이 역시 이후 강의에서 구현합니다.

## 더 읽어보기 {#extended-reading}

-   [Excalidraw ToolType]
-   [Introducing the CSS anchor positioning API]
-   [Drag'n'Drop with mouse events]

[Introducing the CSS anchor positioning API]: https://developer.chrome.com/blog/anchor-positioning-api
[Excalidraw ToolType]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/types.ts#L120-L135
[rnote]: https://github.com/flxzt/rnote
[Dynamic classes and styles]: https://lit.dev/docs/components/styles/#dynamic-classes-and-styles
[Built-in directives - map]: https://lit.dev/docs/templates/directives/#map
[CameraControlPlugin]: /ko/guide/lesson-004#implement-a-plugin
[clsx]: https://github.com/lukeed/clsx
[tailwindcss]: https://tailwindcss.com/
[handleCanvasPanUsingWheelOrSpaceDrag]: https://github.com/excalidraw/excalidraw/blob/57cf577376e283beae08eb46192cfea7caa48d0c/packages/excalidraw/components/App.tsx#L6561
[Element: wheel event]: https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
[Catching Mac trackpad zoom]: https://stackoverflow.com/a/28685082/4639324
[z-index]: https://developer.mozilla.org/en-US/docs/Web/CSS/z-index
[Stacking context]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context
[How to use z-index in svg elements?]: https://stackoverflow.com/questions/17786618/how-to-use-z-index-in-svg-elements
[Scalars]: https://www.khronos.org/opengl/wiki/Data_Type_(GLSL)#Scalars
[Single-precision floating-point format]: https://en.wikipedia.org/wiki/Single-precision_floating-point_format
[Graphics Tech in Cesium - Vertex Compression]: https://cesium.com/blog/2015/05/18/vertex-compression/
[Drag'n'Drop with mouse events]: https://javascript.info/mouse-drag-and-drop
[Drawer - Contained to an Element]: https://shoelace.style/components/drawer#contained-to-an-element
[sl-color-picker]: https://shoelace.style/components/color-picker
[vector-effect]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/vector-effect
