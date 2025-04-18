---
publish: false
---

Render a Rect, see:
<a href="/guide/lesson-009">Render rect and ellipse</a>

```js eval code=false
x = Inputs.range([50, 300], { label: 'x', value: 100, step: 1 });
```

```js eval code=false
y = Inputs.range([50, 300], { label: 'y', value: 100, step: 1 });
```

```js eval code=false
width = Inputs.range([-300, 300], { label: 'width', value: 100, step: 1 });
```

```js eval code=false
height = Inputs.range([-300, 300], { label: 'height', value: 100, step: 1 });
```

```js eval code=false
cornerRadius = Inputs.range([5, 30], {
    label: 'cornerRadius',
    value: 10,
    step: 1,
});
```

```js eval code=false
fill = Inputs.color({ label: 'fill', value: '#ff0000' });
```

```js eval code=false inspector=false
rect = (() => {
    const { Rect } = Core;
    const rect = new Rect({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        cornerRadius: 10,
        fill: 'red',
        batchable: false,
    });
    return rect;
})();
```

```js eval code=false inspector=false
(() => {
    rect.x = x;
    rect.y = y;
    rect.width = width;
    rect.height = height;
    rect.fill = fill;
    rect.cornerRadius = cornerRadius;
})();
```

```js eval code=false
(async () => {
    const { Canvas } = Core;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    canvas.appendChild(rect);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```
