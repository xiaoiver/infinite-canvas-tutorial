---
title: "圆角矩形的投影参数"
description: "交互调节投影颜色与偏移，观察圆角矩形上的阴影效果。"
---
<!-- example-intro:zh -->

# 圆角矩形的投影参数

投影用于分层与强调，具体实现可能落在特效或后处理管线中。下方控件对应阴影颜色与 X/Y 偏移，图元基础见 [第 9 课](/zh/guide/lesson-009)，管线层面可参考 [第 30 课 — 后处理与渲染图](/zh/guide/lesson-030)。

可拖动参数观察在浅色/深色背景下更易读的组合。

```js eval code=false
dropShadowColor = Inputs.color({ label: 'dropShadowColor', value: '#000000' });
```

```js eval code=false
dropShadowOffsetX = Inputs.range([-50, 50], {
    label: 'dropShadowOffsetX',
    value: 0,
    step: 1,
});
```

```js eval code=false
dropShadowOffsetY = Inputs.range([-50, 50], {
    label: 'dropShadowOffsetY',
    value: 0,
    step: 1,
});
```

```js eval code=false
dropShadowBlurRadius = Inputs.range([5, 30], {
    label: 'dropShadowBlurRadius',
    value: 10,
    step: 1,
});
```

```js eval code=false
cornerRadius = Inputs.range([5, 30], {
    label: 'cornerRadius',
    value: 10,
    step: 1,
});
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
        dropShadowBlurRadius: 10,
        fill: 'red',
    });
    return rect;
})();
```

```js eval code=false inspector=false
(() => {
    rect.dropShadowOffsetX = dropShadowOffsetX;
    rect.dropShadowOffsetY = dropShadowOffsetY;
    rect.dropShadowColor = dropShadowColor;
    rect.dropShadowBlurRadius = dropShadowBlurRadius;
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
