---
outline: deep
publish: false
---

# 图形基类

Shape 是所有图形的基类，提供了以下通用属性和方法。

## Transform

提供以下变换，包括平移、缩放、旋转和斜切。

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false
circle = call(() => {
    const { Canvas, Circle } = Core;
    const circle = new Circle({
        cx: 400,
        cy: 150,
        r: 50,
        fill: 'red',
    });
    return circle;
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Core;

    const gui = new GUI({
        container: $icCanvas.parentElement,
    });
    const config = {
        positionX: 0,
        positionY: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0,
    };
    gui.add(config, 'positionX', -100, 100, 1).onChange((positionX) => {
        circle.position.x = positionX;
        circle.boundsDirtyFlag = true;
    });
    gui.add(config, 'positionY', -100, 100, 1).onChange((positionY) => {
        circle.position.y = positionY;
        circle.boundsDirtyFlag = true;
    });
    gui.add(config, 'scaleX', 0.0001, 2, 0.1).onChange((scaleX) => {
        circle.scale.x = scaleX;
    });
    gui.add(config, 'scaleY', 0.0001, 2, 0.1).onChange((scaleY) => {
        circle.scale.y = scaleY;
    });
    gui.add(config, 'rotation', -Math.PI, Math.PI, 0.1).onChange((rotation) => {
        circle.rotation = rotation;
    });
    gui.add(config, 'skewX', 0, 2, 0.1).onChange((skewX) => {
        circle.skew.x = skewX;
    });
    gui.add(config, 'skewY', 0, 2, 0.1).onChange((skewY) => {
        circle.skew.y = skewY;
    });

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        canvas.appendChild(circle);
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### position

对图形应用平移变换，或者获取平移的值。

```ts
circle.position.x = 100;
circle.position.y = 100;
circle.position; // { x: 100, y: 100 }
```

### scale

对图形应用缩放变换，或者获取缩放的值。

```ts
circle.scale.x = 2;
circle.scale.y = 0.5;
circle.scale; // { x: 2, y: 0.5 }
```

### rotation

对图形应用旋转变换，或者获取旋转的弧度值。

```ts
circle.rotation = Math.PI / 2;
circle.rotation; // Math.PI / 2;
```

### angle

对图形应用旋转变换，或者获取旋转的角度值。

```ts
circle.angle = 90;
circle.angle; // 90;
```

### skew

对图形应用倾斜变换，参考 CSS [skew]：

-   `x` 表示用于沿横坐标扭曲元素的角度
-   `y` 表示用于沿纵坐标扭曲元素的角度

```ts
circle.skew.x = 10;
circle.skew.y = 0;
circle.skew; // { x: 10, y: 0 }
```

### pivot

设置或获取缩放和旋转中心，类似 CSS 中的 [transform-origin]，默认值为 `[0, 0]`：

```ts
circle.pivot.x = 100;
circle.pivot.y = 100;
circle.pivot; // { x: 100, y: 100 }
```

### localTransform

`只读` 获取局部坐标系下的 Matrix

```ts
circle.localTransform; // Matrix {a, b, c, d, tx, ty}
```

### worldTransform

`只读` 获取世界坐标系下的 Matrix

```ts
circle.localTransform; //  Matrix {a, b, c, d, tx, ty}
```

## 样式属性

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false
circle2 = call(() => {
    const { Canvas, Circle } = Core;
    const circle2 = new Circle({
        cx: 400,
        cy: 150,
        r: 100,
        fill: 'red',
    });
    return circle2;
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Core;

    const gui = new GUI({
        container: $icCanvas2.parentElement,
    });
    const config = {
        cx: 400,
        cy: 150,
        r: 100,
        fill: '#ff0000',
        fillOpacity: 1,
        stroke: '#00000',
        strokeWidth: 1,
        strokeOpacity: 1,
    };
    gui.add(config, 'cx', 100, 400, 1).onChange((cx) => {
        circle2.cx = cx;
    });
    gui.add(config, 'cy', 100, 300, 1).onChange((cy) => {
        circle2.cy = cy;
    });
    gui.add(config, 'r', 50, 300, 1).onChange((r) => {
        circle2.r = r;
    });
    gui.addColor(config, 'fill').onChange((fill) => {
        circle2.fill = fill;
    });
    gui.add(config, 'fillOpacity', 0, 1, 0.1).onChange((fillOpacity) => {
        circle2.fillOpacity = fillOpacity;
    });
    gui.addColor(config, 'stroke').onChange((stroke) => {
        circle2.stroke = stroke;
    });
    gui.add(config, 'strokeWidth', 0, 20, 1).onChange((strokeWidth) => {
        circle2.strokeWidth = strokeWidth;
    });
    gui.add(config, 'strokeOpacity', 0, 1, 0.1).onChange((strokeOpacity) => {
        circle2.strokeOpacity = strokeOpacity;
    });

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas2.parentElement.style.position = 'relative';
    $icCanvas2.parentElement.appendChild($stats);

    $icCanvas2.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        canvas.appendChild(circle2);
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### fill

填充色，参考 SVG [fill]，用法如下：

```ts
circle.fill = 'rgb(255, 255, 0)';
circle.fill = 'steelblue';
```

支持以下类型：

-   `'none'` 表示不填充
-   [d3-color] 支持的字符串。暂不支持部分 CSS Color Module Level 4 语法，例如 `rgb(255 255 0)` 或者 `oklch()` 颜色空间。
-   CSS 渐变字符串，目前支持以下类型：[linear-gradient]、[radial-gradient]、[conic-gradient]。可参考示例：[声明式渐变]。
-   `ImageBitmap` 使用 [createImageBitmap] 创建的对象。
-   `Texture` 使用命令式创建一个纹理传入。可参考示例：[使用 Device API 创建 Texture]

### stroke

描边色，参考 SVG [stroke]。可以使用 [d3-color] 支持的字符串。默认值为 `'none'`。

```ts
circle.stroke = 'rgb(255, 255, 0)';
circle.stroke = 'steelblue';
```

### strokeWidth

线宽，参考 SVG [stroke-width]。默认值为 `1`。

```ts
circle.strokeWidth = 1;
```

### opacity

整体透明度，参考 SVG [opacity]。默认值为 `1`。

```ts
circle.opacity = 0.5;
```

### fillOpacity

填充色的不透明度，参考 SVG [fill-opacity]。默认值为 `1`。

```ts
circle.fillOpacity = 0.5;
```

### strokeOpacity

描边色的不透明度，参考 SVG [stroke-opacity]。默认值为 `1`。

```ts
circle.fillOpacity = 0.5;
```

### cursor

当鼠标悬停在图形上时，我们可以改变它的样式，通过修改容器的 CSS 样式实现。支持的值可以参考 [cursor]。

```ts
circle.cursor = 'pointer';
```

### pointerEvents

设置图形如何响应交互事件，可参考 [pointer-events]。例如让图形完全不响应事件：

```ts
circle.pointerEvents = 'none';
```

### cullable

是否支持被剔除，默认值为 `true`。

### visible

是否可见，默认值为 `true`。

### draggable

### droppable

### batchable

## 场景图

### parent

`只读` 获取父节点。

### children

`只读` 获取子节点列表。

### appendChild

添加子元素。

```ts
circle.appendChild(child);
```

### removeChild

删除子元素。

```ts
circle.removeChild(child);
```

### getBounds

获取世界坐标系下的包围盒。

```ts
circle.getBounds(); // AABB {}
```

### containsPoint

判断点是否在图形内。

```ts
circle.containsPoint(0, 0); // false
```

## 事件

### addEventListener

在图形上注册事件监听器，参考 [addEventListener]：

```ts
circle.addEventListener('pointerdown', (e) => {});
```

### removeEventListener

从图形上删除已注册的事件监听器，参考 [removeEventListener]：

```ts
circle.removeEventListener('pointerdown', handler);
```

### dispatchEvent

向图形派发事件，参考 [dispatchEvent]：

```ts
circle.dispatchEvent(new FederatedEvent());
```

[fill]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill
[stroke]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke
[stroke-width]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-width
[opacity]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/opacity
[fill-opacity]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-opacity
[stroke-opacity]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-opacity
[d3-color]: https://d3js.org/d3-color#color
[cursor]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
[pointer-events]: https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
[skew]: https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/skew
[transform-origin]: https://developer.mozilla.org/en-US/docs/Web/CSS/transform-origin
[addEventListener]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
[removeEventListener]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener
[dispatchEvent]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent
[使用 Device API 创建 Texture]: /zh/experiment/gradient
[声明式渐变]: /zh/example/declarative-gradient
[createImageBitmap]: https://developer.mozilla.org/zh-CN/docs/Web/API/Window/createImageBitmap
[linear-gradient]: https://developer.mozilla.org/zh-CN/docs/Web/CSS/gradient/linear-gradient
[radial-gradient]: https://developer.mozilla.org/zh-CN/docs/Web/CSS/gradient/radial-gradient
[conic-gradient]: https://developer.mozilla.org/zh-CN/docs/Web/CSS/gradient/conic-gradient
