---
outline: deep
publish: false
---

# Base Shape Class

Shape is the base class for all shapes, providing the following common properties and methods.

## Transform

Provides the following transformations, including translation, scaling, rotation and skewing.

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

Apply translation transform to the shape, or get the translation value.

```ts
circle.position.x = 100;
circle.position.y = 100;
circle.position; // { x: 100, y: 100 }
```

### scale

Apply scaling transform to the shape, or get the scale value.

```ts
circle.scale.x = 2;
circle.scale.y = 0.5;
circle.scale; // { x: 2, y: 0.5 }
```

### rotation

Apply rotation transform to the shape, or get the rotation value in radians.

```ts
circle.rotation = Math.PI / 2;
circle.rotation; // Math.PI / 2;
```

### angle

Apply rotation transform to the shape, or get the rotation value in degrees.

```ts
circle.angle = 90;
circle.angle; // 90;
```

### skew

Apply skew transform to the shape, refer to CSS [skew]:

-   `x` represents the angle to skew the element along the x-axis
-   `y` represents the angle to skew the element along the y-axis

```ts
circle.skew.x = 10;
circle.skew.y = 0;
circle.skew; // { x: 10, y: 0 }
```

### pivot

Set or get the center point for scaling and rotation, similar to CSS [transform-origin], default value is `[0, 0]`:

```ts
circle.pivot.x = 100;
circle.pivot.y = 100;
circle.pivot; // { x: 100, y: 100 }
```

### localTransform

`readonly` Get the Matrix in local coordinate system

```ts
circle.localTransform; // Matrix {a, b, c, d, tx, ty}
```

### worldTransform

`readonly` Get the Matrix in world coordinate system

```ts
circle.localTransform; //  Matrix {a, b, c, d, tx, ty}
```

## Style Properties

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

Fill color, refer to SVG [fill]. Can use strings supported by [d3-color].

```ts
circle.fill = 'rgb(255, 255, 0)';
circle.fill = 'steelblue';
```

### stroke

Stroke color, refer to SVG [stroke]. Can use strings supported by [d3-color]. Default value is `none`.

```ts
circle.stroke = 'rgb(255, 255, 0)';
circle.stroke = 'steelblue';
```

### strokeWidth

Line width, refer to SVG [stroke-width]. Default value is `1`.

```ts
circle.strokeWidth = 1;
```

### opacity

Overall opacity, refer to SVG [opacity]. Default value is `1`.

```ts
circle.opacity = 0.5;
```

### fillOpacity

Fill opacity, refer to SVG [fill-opacity]. Default value is `1`.

```ts
circle.fillOpacity = 0.5;
```

### strokeOpacity

Stroke opacity, refer to SVG [stroke-opacity]. Default value is `1`.

```ts
circle.fillOpacity = 0.5;
```

### cursor

When hovering over the shape, we can change its style by modifying the container's CSS style. Supported values can be found at [cursor].

```ts
circle.cursor = 'pointer';
```

### pointerEvents

Set how the shape responds to interaction events, refer to [pointer-events]. For example, to make the shape completely unresponsive to events:

```ts
circle.pointerEvents = 'none';
```

### cullable

Whether the shape can be culled, default value is `true`.

### visible

Whether the shape is visible, default value is `true`.

### draggable

Whether the shape can be dragged.

### droppable

Whether the shape can be dropped onto.

### batchable

Whether the shape can be batched for rendering.

## Scene Graph

### parent

`readonly` Get the parent node.

### children

`readonly` Get the list of child nodes.

### appendChild

Add a child element.

```ts
circle.appendChild(child);
```

### removeChild

Remove a child element.

```ts
circle.removeChild(child);
```

### getBounds

Get the bounding box in world coordinates.

```ts
circle.getBounds(); // AABB {}
```

### containsPoint

Check if a point is inside the shape.

```ts
circle.containsPoint(0, 0); // false
```

## Events

### addEventListener

Register an event listener on the shape, refer to [addEventListener]:

```ts
circle.addEventListener('pointerdown', (e) => {});
```

### removeEventListener

Remove a registered event listener from the shape, refer to [removeEventListener]:

```ts
circle.removeEventListener('pointerdown', handler);
```

### dispatchEvent

Dispatch an event to the shape, refer to [dispatchEvent]:

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
