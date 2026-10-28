---
outline: deep
description: '도형 피킹, 드래그 앤 드롭, 제스처를 갖춘 DOM 호환 이벤트 시스템을 구현합니다. 인터랙티브한 캔버스 애플리케이션을 위해 포인터, 마우스, 터치 이벤트를 처리하는 방법을 배웁니다.'
head:
    - ['meta', { property: 'og:title', content: '6강 - 이벤트 시스템' }]
---

# 6강 - 이벤트 시스템 {#lesson-6-event-system}

이번 강의에서는 다음 내용을 배웁니다.

-   DOM Event API와 호환되는 이벤트 시스템을 구현합니다
-   원을 피킹하는 방법
-   우리 이벤트 시스템 위에 드래그 앤 드롭 플러그인을 구현합니다
-   핀치 줌 제스처를 지원합니다

```js eval code=false
$button = call(() => {
    const $button = document.createElement('button');
    $button.textContent = 'FlyTo origin';
    return $button;
});
```

```js eval code=false inspector=false
canvas = call(() => {
    const { Canvas } = Lesson6;
    return Utils.createCanvas(Canvas, 400, 400);
});
```

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson6;

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
        cursor: 'pointer',
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

    sun.addEventListener('pointerenter', () => {
        sun.fill = 'green';
    });
    sun.addEventListener('pointerleave', () => {
        sun.fill = 'red';
    });

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

현재 지원하는 상호작용은 캔버스 수준입니다. 하지만 앞으로는 개별 도형의 편집 기능도 반드시 지원해야 합니다. 예를 들어 마우스로 도형을 선택할 때, 캔버스에서 클릭 이벤트를 감지한 뒤 어느 도형이 선택되었는지 어떻게 알 수 있을까요? 다음 코드처럼, 마우스가 빨간 원에 들어오거나 나갈 때 색을 바꾸고자 합니다.

```ts
sun.addEventListener('pointerenter', () => {
    sun.fill = 'green';
});
sun.addEventListener('pointerleave', () => {
    sun.fill = 'red';
});
```

이를 위해서는 완전한 이벤트 시스템을 구현해야 합니다.

## 이벤트 시스템 설계 {#design-a-event-system}

이벤트 시스템을 설계할 때, 다음 원칙을 지키고자 합니다.

-   DOM Event API와 가능한 한 일치시킵니다. 학습 곡선을 낮추기 위해서이기도 하고, 제스처 라이브러리 같은 기존 생태계와 통합하기 위해서이기도 합니다.
-   표준 이벤트만 제공합니다. 드래그 앤 드롭이나 제스처 같은 고급 이벤트는 확장을 통해 정의합니다.

아래에서 소개하는 구현은 전적으로 [PIXI.js Events Design Documents]에 기반하며, PIXI.js v8도 여전히 이것을 사용합니다. 세부 사항을 더 알고 싶다면 소스 코드를 읽어 보시기 바랍니다.

### PointerEvent {#pointerevent}

브라우저의 상호작용 이벤트 지원은 다음 단계를 거쳐 발전했습니다. 자세한 내용은 [The brief history of PointerEvent]를 참고하세요.

-   처음에는 마우스 이벤트를 지원했습니다.
-   모바일 기기가 보편화되면서 터치 이벤트가 나타났고, 그와 함께 마우스 이벤트도 발생했습니다.
-   이후 펜 같은 새로운 입력 장치가 등장하면서 이벤트 구조가 제각각이 되었고, 이를 처리하기가 매우 힘들었습니다. 예를 들어 [hammer.js compatibility handling for various events]를 보세요.
-   위의 입력 장치를 모두 아우르려는 새 표준 [PointerEvent]가 제안되었습니다.

![마우스, 포인터, 터치 이벤트](/mouse-pointer-touch-events.png)

그 결과, 지금 Level 2 [PointerEvent]는 모든 주요 브라우저가 지원합니다. Hammer.js는 2016년부터 이것을 지원해 왔습니다. [hammer.js issue].

![Can I Use의 Pointer Events](/can-i-use-pointer-events.png)

그래서 Mouse / Touch / PointerEvent를 정규화하고자 합니다. 기대하는 사용법은 다음과 같습니다.

```ts
circle.addEventListener('pointerdown', (e) => {
    e.target; // circle
    e.preventDefault();
    e.stopPropagation();
});
```

### DOMEventListener {#domeventlistener}

먼저, 캔버스에서 일련의 상호작용 이벤트를 수신해야 하며, 이것도 플러그인으로 구현합니다.

```ts
export class DOMEventListener implements Plugin {}
```

현재 환경이 Pointer 이벤트와 Touch 이벤트를 지원하는지 감지하려면 다음과 같습니다.

```ts
const supportsPointerEvents = !!globalThis.PointerEvent;
const supportsTouchEvents = 'ontouchstart' in globalThis;
```

현재 환경이 PointerEvent를 지원하면 수신을 시작할 수 있습니다. 모든 이벤트를 `HTMLCanvasElement`에서 수신할 수 있는 것은 아닙니다. 예를 들어 `pointermove` 이벤트의 리스너는 `window`나 `document`에 묶어야 합니다. 그렇지 않으면 캔버스 DOM 요소 밖에서 이벤트가 일어났을 때 감지하지 못합니다.

```ts
const addPointerEventListener = ($el: HTMLCanvasElement) => {
    globalThis.document.addEventListener('pointermove', onPointerMove, true);
    $el.addEventListener('pointerdown', onPointerDown, true);
    $el.addEventListener('pointerleave', onPointerOut, true);
    $el.addEventListener('pointerover', onPointerOver, true);
    globalThis.addEventListener('pointerup', onPointerUp, true);
    globalThis.addEventListener('pointercancel', onPointerCancel, true);
};
```

PointerEvent를 지원하지 않으면 MouseEvent를 수신하도록 바꿉니다. 그래도 `onPointerDown` 같은 처리 함수를 호출하고, 내부에서 대응하는 훅 함수를 실행합니다.

```ts
const addMouseEventListener = ($el: HTMLCanvasElement) => {
    globalThis.document.addEventListener('mousemove', onPointerMove, true);
    $el.addEventListener('mousedown', onPointerDown, true);
    $el.addEventListener('mouseout', onPointerOut, true);
    $el.addEventListener('mouseover', onPointerOver, true);
    globalThis.addEventListener('mouseup', onPointerUp, true);
};
const onPointerMove = (ev: InteractivePointerEvent) => {
    hooks.pointerMove.call(ev);
};
const onPointerUp = (ev: InteractivePointerEvent) => {
    hooks.pointerUp.call(ev);
};
```

캔버스에 훅을 더 추가합니다. 리스너 플러그인이 이 훅을 트리거하고, 이후의 이벤트 시스템 처리 플러그인이 이에 응답합니다.

```ts
export interface Hooks {
    pointerDown: SyncHook<[InteractivePointerEvent]>;
    pointerUp: SyncHook<[InteractivePointerEvent]>;
    pointerMove: SyncHook<[InteractivePointerEvent]>;
    pointerOut: SyncHook<[InteractivePointerEvent]>;
    pointerOver: SyncHook<[InteractivePointerEvent]>;
    pointerWheel: SyncHook<[InteractivePointerEvent]>;
    pointerCancel: SyncHook<[InteractivePointerEvent]>;
}
```

### 도형에 리스너 추가 {#add-listeners-to-shape}

기본 도형 클래스는 `on`, `once`, `off` 메서드를 제공하는 `EventEmitter`를 확장해야 합니다.

```ts
import EventEmitter from 'eventemitter3';
export abstract class Shape
    extends EventEmitter
    implements FederatedEventTarget {}
```

[addEventListener]를 예로 들면, 이미 있는 메서드로 DOM API 표준에 맞게 구현해야 합니다. 예를 들어 한 번만 호출하려는 이벤트 리스너는, 등록할 때 [once] 매개변수로 지정합니다.

```ts{10}
export abstract class Shape {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    const once = isObject(options) && options.once;
    const listenerFn = isFunction(listener) ? listener : listener.handleEvent;

    if (once) {
      this.once(type, listenerFn, context);
    } else {
      this.on(type, listenerFn, context);
    }
  }
}
```

지면 관계상 다른 메서드는 여기서 자세히 다루지 않습니다. 자세한 구현은 PIXI.js 소스 코드를 참고할 수 있습니다.

-   이벤트 리스너를 제거하는 `removeEventListener`
-   모든 이벤트 리스너를 제거하는 `removeAllListeners`
-   사용자 정의 이벤트를 전달하는 `dispatchEvent`

이것으로 다음 API를 사용해 이벤트를 수신할 수 있습니다. 다음에는 리스너에 넘어오는 이벤트 객체 `e`를 구현해야 합니다.

```ts
circle.addEventListener('pointerenter', (e) => {
    circle.fill = 'green';
});
```

### 이벤트 객체 {#event-object}

DOM Event API를 완전히 따르기 위해, PIXI.js는 범용성을 나타내려고 `FederatedEvent`를 쓰며, 이를 통해 [UIEvent] 인터페이스를 구현할 수 있습니다. 일부 메서드는 `preventDefault`처럼 네이티브 이벤트를 직접 호출할 수 있습니다.

```ts
export class FederatedEvent<N extends UIEvent | PixiTouch = UIEvent | PixiTouch>
    implements UIEvent
{
    preventDefault(): void {
        if (this.nativeEvent instanceof Event && this.nativeEvent.cancelable) {
            this.nativeEvent.preventDefault();
        }

        this.defaultPrevented = true;
    }
}
```

그렇다면 네이티브 이벤트 객체를 `FederatedEvent`로 어떻게 바꿀까요? PIXI.js는 먼저 이들을 `PointerEvent` 형태로 정리합니다. 특히 `TouchEvent`의 다중 터치에서는 `changedTouches` 안의 각 Touch 객체를 별도의 `PointerEvent`로 만듭니다.

```ts
function normalizeToPointerEvent(
    event: InteractivePointerEvent,
): PointerEvent[] {
    if (supportsTouchEvents && event instanceof TouchEvent) {
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i] as PixiTouch;
        }
    }
}
```

다음에는 `PointerEvent`를 `FederatedPointerEvent`로 변환해야 합니다.

```ts
function bootstrapEvent(
    event: FederatedPointerEvent,
    nativeEvent: PointerEvent,
): FederatedPointerEvent {}
```

대부분의 속성은 네이티브 이벤트에서 그대로 복사할 수 있지만, 특별히 처리해야 하는 속성이 두 종류 있습니다.

-   캔버스 좌표계에서 이벤트가 일어난 위치.
-   [target] 이벤트가 전달되는 대상 객체, 즉 캔버스의 어느 그래픽 객체에서 이벤트가 일어나는가.

먼저 첫 번째 종류의 속성을 살펴보겠습니다.

### 좌표 {#coordinates}

“위치”를 말할 때는 언제나 어떤 좌표계에 대한 상대적인 값입니다. Client, Screen, Page는 브라우저가 기본으로 지원하는 좌표계입니다. 우리는 캔버스와 뷰포트라는 좌표계 두 개를 추가했습니다.

Canvas 좌표계는 브라우저의 Screen 좌표계에 비길 수 있으며, 월드 좌표계라고도 합니다. 그래픽을 만들 때 지정하는 위치는 모두 이 좌표계를 기준으로 합니다. 원점은 캔버스 DOM 요소의 왼쪽 위이고, X축 양의 방향은 화면 오른쪽, Y축 양의 방향은 화면 아래를 가리킵니다. 이것 역시 “월드 좌표계”라고 부르며, 회전을 다룰 때는 좌표축의 양의 방향을 따라 시계 방향을 회전 방향으로 정합니다.

Viewport 좌표계는 브라우저의 Client 좌표계에 비길 수 있습니다. 카메라는 우리가 세계를 바라보는 각도를 결정합니다. 카메라가 움직이지 않았다면 Viewport 좌표계와 Canvas 좌표계는 완전히 겹칩니다. 그래서 보이는 범위 안에서 뷰포트 왼쪽 위의 좌표는 Canvas 좌표계의 원점과 같고, 둘 다 `[0, 0]`입니다. 하지만 카메라가 이동하거나 회전하거나 확대·축소되면 뷰포트도 그에 따라 바뀌고, 이때 뷰포트 왼쪽 위 `[0, 0]`에 대응하는 Canvas 좌표계의 위치는 더 이상 `[0, 0]`이 아닙니다.

둘을 서로 변환하는 메서드를 제공하고, 플러그인의 컨텍스트에 넣습니다.

```ts
interface PluginContext {
    api: {
        client2Viewport({ x, y }: IPointData): IPointData;
        viewport2Client({ x, y }: IPointData): IPointData;
        viewport2Canvas({ x, y }: IPointData): IPointData;
        canvas2Viewport({ x, y }: IPointData): IPointData;
    };
}
```

이후 이벤트 처리를 진행하기 전에, 네이티브 이벤트의 좌표를 뷰포트 좌표계로 바꾼 다음 월드 좌표계로 바꿉니다. 이 작업은 `Event` 플러그인 안에서 합니다.

```ts
export class Event implements Plugin {
    private bootstrapEvent(
        event: FederatedPointerEvent,
        nativeEvent: PointerEvent,
    ): FederatedPointerEvent {
        const { x, y } = this.getViewportXY(nativeEvent);
        event.client.x = x;
        event.client.y = y;
        const { x: canvasX, y: canvasY } = this.viewport2Canvas(event.client);
        event.screen.x = canvasX;
        event.screen.y = canvasY;
    }
}
```

이렇게 해서 이벤트 객체의 좌표가 정해집니다. “이벤트가 어느 그래픽 객체에서 일어나는가”라는 문제는 잠시 미루고, 먼저 완전한 이벤트 전파 과정을 어떻게 구현하는지 살펴보겠습니다.

### 이벤트 전파 과정 {#event-propagation-process}

DOM 이벤트 흐름에 익숙한 개발자라면 다음 개념을 바로 알아볼 것입니다.

-   이벤트 객체의 `target` 속성은 대상 요소를 가리킵니다. DOM API에서는 당연히 DOM 요소이고, 우리 캔버스에서는 특정 그래픽 객체입니다. 다음 절에서 소개합니다.
-   이벤트 흐름에는 캡처 단계와 버블링 단계가 있으며, 이벤트 객체의 일부 메서드로 이 단계에 개입할 수 있습니다.
-   특정 이벤트에 리스너를 하나 이상 추가할 수 있으며, 등록한 순서대로 호출됩니다.

[Bubbling and capturing]는 이벤트 전파의 세 단계를 보여 줍니다. 캡처 단계에서는 리스너가 위에서 아래로 호출되고, 대상 노드에 도달한 뒤 위로 버블링합니다. 리스너 안에서는 `eventPhase`로 현재 단계를 알 수 있습니다.

![이벤트 흐름](https://javascript.info/article/bubbling-and-capturing/eventflow.svg)

PIXI.js는 이를 `EventBoundary`에서 구현합니다.

```ts
propagate(e: FederatedEvent, type?: string): void {
  const composedPath = e.composedPath();

  // Capturing phase
  e.eventPhase = e.CAPTURING_PHASE;
  for (let i = 0, j = composedPath.length - 1; i < j; i++) {
    e.currentTarget = composedPath[i];
    this.notifyTarget(e, type);
    if (e.propagationStopped || e.propagationImmediatelyStopped) return;
  }

  // At target phase
  e.eventPhase = e.AT_TARGET;
  e.currentTarget = e.target;
  this.notifyTarget(e, type);
  if (e.propagationStopped || e.propagationImmediatelyStopped) return;

  // Bubbling phase
  e.eventPhase = e.BUBBLING_PHASE;
  for (let i = composedPath.length - 2; i >= 0; i--) {
    e.currentTarget = composedPath[i];
    this.notifyTarget(e, type);
    if (e.propagationStopped || e.propagationImmediatelyStopped) return;
  }
}
```

## 피킹 {#picking}

이벤트가 어느 그래픽 객체 안에서 일어나는지는 피킹 기능으로 판단합니다. DOM API는 [elementsFromPoint] 메서드를 제공하며, 뷰포트 좌표계의 지정한 점에 해당하는 요소 목록을 반환합니다. 하지만 우리는 SVG 렌더러를 쓰지 않으므로 이 메서드를 쓸 수 없습니다. 선택지는 다음 두 가지입니다.

-   기하학적 방법. 예를 들어 점이 원 안에 있는지 판정합니다.
-   GPU 색상 부호화에 기반한 방법. 나중에 자세히 다룹니다.

피킹 기준을 보면, 그래픽의 가시성, 스트로크, 채우기 같은 요소를 모두 고려할 수 있습니다. CSS가 [pointer-events] 속성을 제공하는 것과 비슷합니다. 그래픽 기본 클래스에도 `pointerEvents` 속성을 추가합니다.

```ts{2}
export abstract class Shape {
  pointerEvents: PointerEvents = 'auto';
}

type PointerEvents =
  | 'none'
  | 'auto'
  | 'stroke'
  | 'fill'
  | 'painted'
  | 'visible'
  | 'visiblestroke'
  | 'visiblefill'
  | 'visiblepainted'
  | 'all'
  | 'non-transparent-pixel';
```

### 피킹 플러그인 {#picking-plugin}

루트 노드에서 씬 그래프를 순회하며, 월드 좌표계의 점이 그래픽 객체 안에 있는지 차례로 판정하는 피킹 플러그인을 만듭니다. 맞았을 때 항목을 목록의 앞에 넣어야 한다는 점이 중요합니다. 나중에 렌더링되는 요소는 렌더 순서 때문에 더 위쪽 레이어에 나타나기 때문입니다. 물론 이후에는 렌더 순서를 조정하는 `zIndex` 속성을 도입합니다.

```ts{10}
export class Picker implements Plugin {
  private pick(result: PickingResult, root: Group) {
    const {
      position: { x, y },
    } = result;

    const picked: Shape[] = [];
    traverse(root, (shape: Shape) => {
      if (this.hitTest(shape, x, y)) {
        picked.unshift(shape);
      }
    });

    result.picked = picked;
    return result;
  }
}
```

판정할 때 첫 단계는, 대상 점을 월드 좌표계에서 모델 좌표계로 변환하는 것입니다. 모델 변환 행렬의 역행렬로 합니다. 모델 좌표계로 바꾸면, 이후의 기하 판정 방법이 최대한 단순해집니다.

```ts
export class Picker implements Plugin {
    private hitTest(shape: Shape, wx: number, wy: number): boolean {
        // skip testing
        if (shape.pointerEvents === 'none') {
            return false;
        }

        shape.worldTransform.applyInverse({ x: wx, y: wy }, tempLocalMapping);
        const { x, y } = tempLocalMapping;
        return shape.containsPoint(x, y);
    }
}
```

이제 `containsPoint` 메서드를 구현하겠습니다.

### 기하학적 방법 {#geometric-method}

점이 원 안에 있는지 판정하려면, 익숙한 Signed Distance Field(SDF) 방법을 쓸 수 있습니다. 이번에는 `strokeWidth`와 `pointerEvents` 속성도 함께 고려합니다.

```ts
class Circle {
    containsPoint(x: number, y: number) {
        const halfLineWidth = this.#strokeWidth / 2;
        const absDistance = vec2.length([this.#cx - x, this.#cy - y]);

        const [hasFill, hasStroke] = isFillOrStrokeAffected(
            this.pointerEvents,
            this.#fill,
            this.#stroke,
        );
        if (hasFill) {
            return absDistance <= this.#r;
        }
        if (hasStroke) {
            return (
                absDistance >= this.#r - halfLineWidth &&
                absDistance <= this.#r + halfLineWidth
            );
        }
        return false;
    }
}
```

괜찮아 보이지만, 매번 씬 그래프의 루트 노드부터 순회해야 합니다. 씬에 그래픽 객체가 많으면, 이벤트가 자주 일어날 때 비용이 큽니다. 다음 강의에서 관련 최적화 방법을 소개합니다.

### hitArea {#hitarea}

때로는 그래픽의 상호작용 영역을 바꾸고 싶을 수 있습니다. 그래픽이 작을 때 클릭하기 쉽도록 조금 키우거나, 실체가 없는 `Group`에 상호작용 영역을 더하는 경우입니다.

```ts
export interface FederatedEventTarget {
    hitArea?: Rectangle;
}
```

이전에 만든 `CameraControl` 플러그인을 고칠 수 있습니다. 먼저 루트 노드에 무한히 큰 상호작용 영역을 추가합니다. 여기서 사각형의 왼쪽 위 좌표를 `[-Infinity, -Infinity]`로 직접 두면 안 됩니다. 그러면 너비와 높이 계산이 `NaN`이 되어, 이후 판정을 할 수 없게 됩니다.

```ts
root.hitArea = new Rectangle(
    -Number.MAX_VALUE,
    -Number.MAX_VALUE,
    Infinity,
    Infinity,
);
```

네이티브 MouseEvent 대신 `FederatedPointerEvent`를 수신합니다.

```ts
canvas.addEventListener('mousedown', (e: MouseEvent) => {}); // [!code --]
root.addEventListener('pointerdown', (e: FederatedPointerEvent) => {}); // [!code ++]
```

### hitStrokeWidth {#hit-stroke-width}

`Line`, `Polyline`, `Path`는 `strokeWidth`가 너무 작으면 상호작용이 어렵습니다. Konva는 상호작용 영역을 넓히려고 `hitStrokeWidth`를 제공합니다. [What is hitStrokeWidth?]를 참고하세요.

우리도 이 속성 이름을 사용합니다.

### API로 피킹하기 {#picking-with-api}

피킹은 상호작용 이벤트로만 하는 것이 아니라, [elementsFromPoint]처럼 명시적으로 호출할 수 있는 API로 노출할 수도 있습니다. 다음 절에서 드래그 앤 드롭 플러그인을 구현할 때 이것을 사용합니다.

```ts
class Canvas {
    elementsFromPoint(x: number, y: number): Shape[] {}
    elementFromPoint(x: number, y: number): Shape {}
}
```

## 드래그 앤 드롭 플러그인 {#dragndrop-plugin}

[Drag'n'Drop with mouse events]를 참고해, PointerEvent로 드래그 앤 드롭 플러그인을 구현할 수 있습니다.

```ts
export class Dragndrop implements Plugin {}
```

“드래그 시작”으로 볼 조건을 정하려고, 드래그 거리와 시간에 각각 기반한 다음 설정 항목을 제공합니다. 이 조건이 모두 충족될 때만 `dragstart` 같은 일련의 드래그 앤 드롭 이벤트가 발생합니다.

-   `dragstartDistanceThreshold`: 이 설정 항목은 드래그 거리의 감지 임계값을 픽셀 단위로 설정합니다. 이 값보다 큰 거리만 유효한 시작으로 봅니다. 기본값은 `0`입니다.
-   `dragstartTimeThreshold`: 이 설정 항목은 드래그 시간의 감지 임계값을 밀리초 단위로 설정합니다. 이 임계값보다 긴 시간만 유효한 시작으로 봅니다. 기본값은 `0`입니다.

HTML Drag and Drop API 구현에서는 같은 동작에 대해 `click` 이벤트와 `drag` 이벤트 중 하나만 발생하고, 둘 다 발생하지는 않습니다. 이 동작은 제공된 [예제](https://plnkr.co/edit/5mdl7oTg0dPWXIip)에서 확인할 수 있습니다.

구현에서도 이 설정을 유지합니다. `dragend` 이벤트 뒤에는 `click` 이벤트가 발생하지 않습니다. 이는 사용자가 드래그 가능한 요소를 보통 이해하고 조작하는 방식과 맞습니다. 드래그와 클릭을 분명히 구분하므로, 일관되고 예측 가능한 동작이 되어 사용자 경험이 좋아집니다.

```ts
if (!e.detail.preventClick) {
    this.dispatchEvent(clickEvent, 'click');
}
```

## CameraControl 플러그인 수정 {#modify-cameracontrol-plugin}

드래그 기능으로 `CameraControl` 플러그인을 구현하려면, 먼저 루트 노드를 드래그 가능하게 만든 다음, `pointerdown` 같은 이벤트를 듣던 것을 드래그 관련 이벤트를 듣는 것으로 바꿉니다.

```ts
root.draggable = true;
root.addEventListener('dragstart', (e: FederatedPointerEvent) => {});
root.addEventListener('drag', (e: FederatedPointerEvent) => {});
root.addEventListener('dragend', (e: FederatedPointerEvent) => {});
```

현재 카메라는 제스처 조작을 지원하지 않습니다. 마우스 휠로 캔버스를 확대·축소하는 것에 더해, [pixi-viewport]와 같이 두 손가락 조작에서 흔한 `pinch` 제스처를 추가하고 싶습니다.

### 핀치 제스처 지원 {#support-pinch-gesture}

PC에서 개발할 때 제스처 이벤트를 흉내 내려면, [hammer.js] 생태계의 일부인 [hammer-touchemulator]를 쓸 수 있습니다. 마우스와 <kbd>Shift</kbd> 키를 함께 쓰면 여러 PointerEvent가 일어나는 상황을 흉내 낼 수 있습니다. 물론 Xcode의 iOS 시뮬레이터를 쓸 수도 있으며, 두 손가락 핀치 줌 같은 제스처 조작을 시험할 수 있습니다. [Interacting with your app in the iOS and iPadOS simulator]

> 두 손가락 핀치, 확대/축소 또는 회전: Option 키를 누른 채 클릭하고 드래그합니다.

`pointerdown` 이벤트를 수신할 때, 각 터치 객체의 위치를 저장합니다.

```ts
this.#touches[event.pointerId] = { last: null };
```

`pointermove` 이벤트를 수신할 때는 두 터치 점 사이의 거리를 기록하고, 이전 거리와 비교합니다. 두 점이 가까워지면 축소에 해당하고, 멀어지면 확대에 해당합니다.

```ts
zoomByPoint(point.x, point.y, (last / dist - 1) * PINCH_FACTOR);
```

iOS 시뮬레이터에서의 효과는 다음과 같습니다.

![iOS 시뮬레이터의 핀치](/pinch-ios-simulator.gif)

### use-gesture {#use-gesture}

[@use-gesture/vanilla]처럼 바로 쓸 수 있는 제스처 라이브러리를 사용할 수도 있습니다. 두 손가락 핀치 줌은 카메라의 확대/축소에 해당하고, 두 손가락 스와이프는 카메라의 팬에 해당합니다.

```ts
import { Gesture } from '@use-gesture/vanilla';

const gesture = new Gesture(element as HTMLCanvasElement, {
    // camera zoom in/out
    onPinch: ({ event, first, last, da, origin }) => {},
});
```

## 더 읽어보기 {#extended-reading}

-   [The brief history of PointerEvent]
-   [Bubbling and capturing]
-   [Drag'n'Drop with mouse events]:

[The brief history of PointerEvent]: https://javascript.info/pointer-events#the-brief-history
[hammer.js compatibility handling for various events]: https://github.com/hammerjs/hammer.js/tree/master/src/input
[hammer.js issue]: https://github.com/hammerjs/hammer.js/issues/946
[PointerEvent]: https://www.w3.org/TR/pointerevents2/
[PIXI.js Events Design Documents]: https://docs.google.com/document/d/1RyXrhrcZly2oPHPApKahE8pC7mEIDvuCPbE9VeYvmZw/edit
[addEventListener]: https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener
[pointer-events]: https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
[elementsFromPoint]: https://developer.mozilla.org/en-US/docs/Web/API/Document/elementsFromPoint
[Interacting with your app in the iOS and iPadOS simulator]: https://developer.apple.com/documentation/xcode/interacting-with-your-app-in-the-ios-or-ipados-simulator#Interact-with-your-interface
[pixi-viewport]: https://github.com/davidfig/pixi-viewport
[hammer-touchemulator]: https://github.com/hammerjs/touchemulator
[hammer.js]: https://hammerjs.github.io/
[UIEvent]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/UIEvent
[once]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#once
[target]: https://developer.mozilla.org/en-US/docs/Web/API/Event/target
[Bubbling and capturing]: https://javascript.info/bubbling-and-capturing#capturing
[Drag'n'Drop with mouse events]: https://javascript.info/mouse-drag-and-drop
[What is hitStrokeWidth?]: https://konvajs.org/docs/events/Custom_Hit_Region.html#2-what-is-hitstrokewidth
[@use-gesture/vanilla]: https://github.com/pmndrs/use-gesture
