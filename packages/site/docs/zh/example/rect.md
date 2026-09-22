---
title: "矩形几何与实时参数"
description: "交互调节位置、尺寸、圆角与填充，理解圆角矩形各属性。"
---
<!-- example-intro:zh -->

# 矩形几何与实时参数

矩形（含圆角）是界面与图示中最常用的图元之一。下方滑块对应 [第 9 课 — 绘制椭圆与矩形](/zh/guide/lesson-009) 中的位置、尺寸、`cornerRadius` 与填充等概念。

内嵌 **genji** 代码块可在不刷新页面的情况下每帧更新参数，适合教学与快速试验。

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
