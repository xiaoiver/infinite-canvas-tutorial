---
title: "Drop shadow on text"
description: "Layer shadow blur and offset for readable labels over busy backgrounds."
---
<!-- example-intro:en -->

# Drop shadow on text

Text shadows improve **contrast** on photos and gradients. Parameters mirror CSS-like shadow syntax; balance blur vs performance on low-end GPUs.

Related styling topics appear in [Lesson 16](/guide/lesson-016).

## Interactive demo

<script setup>
import TextDropShadow from '../components/TextDropShadow.vue'
</script>

Use offset when sampling SDF texture to implement drop shadow effect, see [Pixi.js DropShadow Filter].

<TextDropShadow />

```ts
const text = new Text({
    x: 50,
    y: 100,
    content: 'Hello, world!',
    fontSize: 30,
    fill: '#F67676',
    dropShadowColor: '#000000',
    dropShadowOffsetX: 2,
    dropShadowOffsetY: 2,
    dropShadowBlurRadius: 10,
});
```

[Pixi.js DropShadow Filter]: https://github.com/pixijs/filters/blob/main/src/drop-shadow/drop-shadow.frag#L13
