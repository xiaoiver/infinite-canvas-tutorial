---
outline: deep
publish: false
---

# 图形基类

Shape 是所有图形的基类，提供了以下通用属性和方法。

## Transform

提供以下变换，包括平移、缩放、旋转和 。

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

### fill

填充色，参考 SVG [fill]。可以使用 [d3-color] 支持的字符串。

```ts
circle.fill = 'rgb(255, 255, 0)';
circle.fill = 'steelblue';
```

### stroke

描边色，参考 SVG [stroke]。可以使用 [d3-color] 支持的字符串。

```ts
circle.stroke = 'rgb(255, 255, 0)';
circle.stroke = 'steelblue';
```

### strokeWidth

线宽，参考 SVG [stroke-width]。

```ts
circle.strokeWidth = 1;
```

### opacity

整体透明度，参考 SVG [opacity]。

```ts
circle.opacity = 0.5;
```

### fillOpacity

填充色的不透明度，参考 SVG [fill-opacity]。

```ts
circle.fillOpacity = 0.5;
```

### strokeOpacity

描边色的不透明度，参考 SVG [stroke-opacity]。

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

### visible

### draggable

### droppable

### batchable

## 场景图

### parent

`只读` 获取父节点。

### children

`只读` 获取子节点列表。

### appendChild

### removeChild

### getBounds

### containsPoint

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
[d3-color]: https://github.com/d3/d3-color
[cursor]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
[pointer-events]: https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
[skew]: https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/skew
[transform-origin]: https://developer.mozilla.org/en-US/docs/Web/CSS/transform-origin
[addEventListener]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
[removeEventListener]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener
[dispatchEvent]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent
