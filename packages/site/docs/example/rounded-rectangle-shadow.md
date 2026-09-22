---
title: "Drop shadows on rounded rectangles"
description: "Tune shadow color and offset for rounded rects with interactive controls."
---
<!-- example-intro:en -->

# Drop shadows on rounded rectangles

Shadows separate layers visually and are implemented as part of the **effect** or post-processing stack depending on your pipeline. These controls map to shadow color and X/Y offset—see [Lesson 9](/guide/lesson-009) for the underlying shape and [Lesson 30](/guide/lesson-030) for broader post-processing ideas.

Use the sliders to find values that read well on both light and dark backgrounds.

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
