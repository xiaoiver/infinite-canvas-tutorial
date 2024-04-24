---
outline: deep
---

# 课程 6 - 事件系统

在这节课中你将学习到以下内容：

-   参考 DOM API 实现事件系统
-   如何拾取一个圆形
-   实现一个拖拽插件
-   支持双指缩放手势

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

目前我们支持的交互是画布级的，后续我们肯定要支持针对图形的编辑功能。以鼠标点选为例，我们在画布上监听到点击事件之后，如何知道选中了哪个图形呢？我们希望通过下面的代码，实现当鼠标移入移出红色圆形时改变它的颜色：

```ts
sun.addEventListener('pointerenter', () => {
    sun.fill = 'green';
});
sun.addEventListener('pointerleave', () => {
    sun.fill = 'red';
});
```

这就需要实现一个完整的事件系统。

## 事件系统设计

在设计事件系统时我们希望遵循以下原则：

-   尽可能和 DOM Event API 保持一致，除了能降低学习成本，最重要的是能接入已有生态（例如手势库）。
-   仅提供标准事件。拖拽、手势等高级事件通过扩展方式定义。

下面我们介绍的实现完全参考自 [PIXI.js Events Design Documents]，目前 PIXI.js v8 仍在沿用，如果想深入了解更多细节完全可以阅读它的源代码。

### PointerEvent

浏览器对于交互事件的支持历经了以下阶段，详见：[The brief history of PointerEvent]

-   最早支持的是 mouse 事件
-   随着移动设备普及，touch 事件出现，同时也触发 mouse 事件
-   再后来新的设备又出现了，比如 pen，这样一来各种事件结构各异，使用起来非常痛苦。例如 [hammer.js 对各类事件的兼容性处理]
-   新的标准被提出，[PointerEvent] 希望涵盖以上所有输入设备

![mouse, pointer and touch events](/mouse-pointer-touch-events.png)

于是如今 Level 2 的 [PointerEvent] 已经被所有主流浏览器支持。hammer.js 在 2016 年就支持了它 [hammer.js issue]。

![can i use pointer events](/can-i-use-pointer-events.png)

因此我们希望尽可能把 Mouse / Touch / PointerEvent 这些原生事件都规范化到 PointerEvent，同时拥有完整的事件传播流程。期望的使用方式如下：

```ts
circle.addEventListener('pointerdown', (e) => {
    e.target; // circle
    e.preventDefault();
    e.stopPropagation();
});
```

### 监听事件插件

首先我们需要监听画布上的一系列交互事件，还是通过插件实现：

```ts
export class DOMEventListener implements Plugin {}
```

首先在画布初始化时进行特性检测，判断当前环境是否支持 Pointer 和 Touch 事件：

```ts
const supportsPointerEvents = !!globalThis.PointerEvent;
const supportsTouchEvents = 'ontouchstart' in globalThis;
```

一旦当前环境支持 PointerEvent，就可以开始监听了。要注意并不能都在 `HTMLCanvasElement` 上监听，例如 `pointermove` 事件的监听器必须绑定在 `window` 或者 `document` 上，否则一旦在画布 DOM 元素之外触发事件就无法感知了。

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

如果不支持 PointerEvent，则改为监听 MouseEvent，但都会调用类似 `onPointerDown` 这样的处理函数，内部触发对应的钩子函数：

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

我们为画布增加更多钩子，监听插件触发它们，而后续的事件系统处理插件则会响应它们：

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

### 图形事件方法

首先让图形基类继承 `EventEmitter`，它提供了 `on` `once` `off` 等事件监听和解除监听的方法：

```ts
import EventEmitter from 'eventemitter3';
export abstract class Shape
    extends EventEmitter
    implements FederatedEventTarget {}
```

以 [addEventListener] 为例，我们需要使用已有方法按照 DOM API 标准实现。例如对于只想触发一次的事件监听器，在注册时通过 [once] 参数指定：

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

其他方法限于篇幅就不展开介绍了，详细实现可以参考 PIXI.js 源码：

-   `removeEventListener` 移除事件监听器
-   `removeAllListeners` 移除所有事件监听器
-   `dispatchEvent` 派发自定义事件

这样我们就可以使用如下 API 监听事件了，接下来需要实现传入监听器的事件对象 `e`：

```ts
circle.addEventListener('pointerenter', (e) => {
    circle.fill = 'green';
});
```

### 事件对象

为了完全兼容 DOM Event API，PIXI.js 使用了 `FederatedEvent` 意在体现它的通用性，让它实现 [UIEvent] 接口，一些方法可以直接调用原生事件，例如 `preventDefault`。

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

那如何将原生事件对象转换成 `FederatedEvent` 呢？PIXI.js 首先将它们格式化成 `PointerEvent`。特别是对于 `TouchEvent` 中多触控点的情况，将 `changedTouches` 中每一个 Touch 对象都格式化成独立的 `PointerEvent`。

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

接下来将 `PointerEvent` 转换成 `FederatedPointerEvent`

```ts
function bootstrapEvent(
    event: FederatedPointerEvent,
    nativeEvent: PointerEvent,
): FederatedPointerEvent {}
```

其中大部分属性都可以从原生事件上拷贝，需要特殊处理的是两类属性：

-   画布坐标系下事件所在的位置。
-   [target] 事件派发的目标对象，即事件发生在画布中哪个图形上。

我们先来看第一类属性。

### 坐标系转换

当我们说起“位置”，一定是相对于某个坐标系下而言。Client、Screen、Page 都是浏览器原生支持的坐标系。我们新增了画布和视口两个坐标系。

Canvas 画布坐标系可以类比浏览器的 Screen 坐标系，也称作世界坐标系，我们在创建图形时指定的位置均相对于该坐标系。它以画布 DOM 元素的左上角为原点，X 轴正向指向屏幕右侧，Y 轴正向指向屏幕下方。也称作“世界坐标系”，涉及到旋转时，我们设定沿坐标轴正向顺时针为旋转方向。

Viewport 视口坐标系可以类比浏览器的 Client 坐标系。相机决定了我们观察世界的角度，如果相机没有发生移动，Viewport 视口坐标系和 Canvas 坐标系将完全重合，因此在我们的可见范围内，视口左上角坐标与 Canvas 坐标系原点一样，都是 `[0, 0]`。但如果相机发生了平移、旋转、缩放，视口也会发生相应变化，此时视口左上角 `[0, 0]` 对应 Canvas 坐标系下的位置就不再是 `[0, 0]` 了。

我们提供了它们之间的转换方法，并将其加入插件的上下文中：

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

在进行后续拾取前，我们将原生事件上的坐标转换到视口坐标系下，再转换到世界坐标系下。这是在 `Event` 插件中完成的：

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

这样事件对象上的坐标就有了，我们暂时跳过“事件发生在哪个图形上”这个问题，先来看看如何实现一套完整的事件传播流程。

### 事件传播流程

熟悉 DOM 事件流 的开发者对以下概念肯定不陌生：

-   事件对象的 `target` 属性指向目标元素，在 DOM API 中自然是 DOM 元素，在我们的画布中是某个图形。我们将在下一小节介绍它。
-   事件流包含捕获和冒泡阶段，可以通过事件对象上的某些方法介入它们
-   可以为某个事件添加一个或多个监听器，它们按照注册顺序依次触发

[Bubbling and capturing] 展示了事件传播的三个阶段，在捕获阶段自顶向下依次触发监听器，到达目标节点后向上冒泡。在监听器中可以通过 `eventPhase` 获取当前所处的阶段。

![eventflow](https://javascript.info/article/bubbling-and-capturing/eventflow.svg)

PIXI.js 将这部分流程放在 `EventBoundary` 中。

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

## 拾取

判断事件发生在哪个图形中是通过拾取功能完成的。DOM API 提供了 [elementsFromPoint] 方法返回视口坐标系下指定点对应的元素列表。但由于我们使用的并不是 SVG 渲染器，因此没法使用它。我们有以下两种选择：

-   几何方法。例如判断一个点是否在圆内。
-   基于 GPU 颜色编码的方法。后续我们会详细介绍。

从拾取的判定条件看，图形可见性、描边、填充都可以考虑进来，例如 CSS 就提供了 [pointer-events] 属性。我们给图形基类也增加 `pointerEvents` 属性：

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

### 拾取插件

创建一个拾取插件，从根节点开始遍历场景图，依次判断世界坐标系下的点是否在图形内。需要注意的是命中后需要添加到列表的前部，因为靠后的元素渲染次序也靠后，因此会出现在更上层。当然后续我们会引入 `zIndex` 属性用于修改渲染次序。

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

在检测时，首先将世界坐标系下的目标点转换到模型坐标系下，通过模型变换矩阵的逆矩阵实现。变换到模型坐标系下能最大程度简化后续的几何判断方法：

```ts
export class Picker implements Plugin {
    private hitTest(shape: Shape, wx: number, wy: number): boolean {
        // 跳过检测
        if (shape.pointerEvents === 'none') {
            return false;
        }

        shape.worldTransform.applyInverse({ x: wx, y: wy }, tempLocalMapping);
        const { x, y } = tempLocalMapping;
        return shape.containsPoint(x, y);
    }
}
```

接下来我们来实现 `containsPoint` 这个方法。

### 数学方法

如何判断一个点是否在圆内呢？还是使用熟悉的 SDF 方法，不过这次将 `strokeWidth` 和 `pointerEvents` 属性也考虑进来：

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

看起来不错，但每次都需要从场景图的根节点开始遍历，如果场景中图形众多，在频繁触发事件时开销巨大。在下一节课我们会介绍相关的优化手段。

### hitArea

有时候我们想改变图形的可交互区域，例如当图形较小时稍稍增大便于点击，或者为不存在实体的 `Group` 增加可交互的区域。

```ts
export interface FederatedEventTarget {
    hitArea?: Rectangle;
}
```

我们可以改造一下之前的 `CameraControl` 插件，首先为根节点增加一个无限大的交互区域。这里并不能直接指定矩形左上角坐标为 `[-Infinity, -Infinity]`，因为这样会导致计算宽度和高度为 `NaN`，就无法进行后续的检测了：

```ts
root.hitArea = new Rectangle(
    -Number.MAX_VALUE,
    -Number.MAX_VALUE,
    Infinity,
    Infinity,
);
```

然后从直接监听 DOM 事件改为监听事件系统抛出的 PointerEvent：

```ts
canvas.addEventListener('mousedown', (e: MouseEvent) => {}); // [!code --]
root.addEventListener('pointerdown', (e: FederatedPointerEvent) => {}); // [!code ++]
```

### 通过 API 方式拾取

拾取功能不光可以通过交互事件完成，也可以以 API 形式暴露供显式调用，例如 [elementsFromPoint]。在下一节我们实现拖拽插件时就会用到。

```ts
class Canvas {
    elementsFromPoint(x: number, y: number): Shape[] {}
    elementFromPoint(x: number, y: number): Shape {}
}
```

下面让我们实现一个很常用的插件，并基于它让图形可移动。

## 拖拽插件

参考 [Drag'n'Drop with mouse events]，基于 PointerEvent 可以实现一个拖拽插件：

```ts
export class Dragndrop implements Plugin {}
```

对于满足何种条件判定“开始拖拽”，我们提供了以下配置项：分别基于拖拽距离和时间。只有这些判定条件全部满足，才会触发 `dragstart` 等一系列拖放事件。

-   `dragstartDistanceThreshold` 该配置项用于配置拖放距离的检测阈值，单位为像素，只有大于该值才会判定通过。默认值为 `0`。
-   `dragstartTimeThreshold` 该配置项用于配置拖放时间的检测阈值，单位为毫秒，只有大于该值才会判定通过。默认值为 `0`。

在 HTML 的 Drag'n'drop 实现中，`click` 和 `drag` 事件同时只会触发一个：[示例](https://plnkr.co/edit/5mdl7oTg0dPWXIip)

我们在实现中也保留了这一设定，在触发 `dragend` 事件之后不会再触发 `click`。

```ts
if (!e.detail.preventClick) {
    this.dispatchEvent(clickEvent, 'click');
}
```

## 改造相机控制插件

下面我们将之前的 `CameraControl` 插件改用拖拽实现。首先设置根节点 `draggable`，将之前对 `pointerdown` 等事件改为对 `drag` 系列事件的监听：

```ts
root.draggable = true;
root.addEventListener('dragstart', (e: FederatedPointerEvent) => {});
root.addEventListener('drag', (e: FederatedPointerEvent) => {});
root.addEventListener('dragend', (e: FederatedPointerEvent) => {});
```

目前我们的相机还不支持手势操作，除了通过鼠标滚轮缩放画布，参考
[pixi-viewport]，我们希望加上常见的 `pinch` 双指手势。

### 支持手势

为了在 PC 开发时也能模拟手势事件，我们可以使用 [hammer-touchemulator]，它是 [hammer.js] 生态的一部分。通过鼠标加键盘 <kbd>Shift</kbd> 可以模拟触发多个 PointerEvent。当然也可以使用 XCode 中的 iOS 模拟器，同样可以测试手势交互，例如双指缩放：[Interacting with your app in the iOS and iPadOS simulator]

> Two-finger pinch, zoom, or rotate: Click and drag while pressing the Option key.

在监听 `pointerdown` 事件时，记录每个触控点的位置：

```ts
this.#touches[event.pointerId] = { last: null };
```

在监听 `pointermove` 事件时，记录两个触控点间的距离，与上一次的距离进行比较，两个点越靠越近对应缩小，越来越远对应放大：

```ts
zoomByPoint(point.x, point.y, (last / dist - 1) * PINCH_FACTOR);
```

在 iOS 模拟器上效果如下：

![Pinch in ios simulator](/pinch-ios-simulator.gif)

## 扩展阅读

-   [The brief history of PointerEvent]
-   [Bubbling and capturing]
-   [Drag'n'Drop with mouse events]:

[The brief history of PointerEvent]: https://javascript.info/pointer-events#the-brief-history
[hammer.js 对各类事件的兼容性处理]: https://github.com/hammerjs/hammer.js/tree/master/src/input
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
