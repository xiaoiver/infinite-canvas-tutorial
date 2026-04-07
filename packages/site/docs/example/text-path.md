---
title: "Text on a path"
description: "Place glyphs along curves for badges and annotations."
---
<!-- example-intro:en -->

# Text on a path

Path-on-text needs **arc length** sampling and rotation per glyph. Use it for circular badges and flow labels; performance scales with segment count.

See vector path math in [Lesson 12](/guide/lesson-012) and [Lesson 13](/guide/lesson-013).

## Interactive demo

<script setup>
import TextPath from '../components/TextPath.vue'
</script>

<TextPath />

```ts
const text = new Text({
    x: 0,
    y: 0,
    content: 'Quick brown fox jumps over the lazy dog.',
    fontSize: 15,
    fill: '#F67676',
    fontFamily: 'sans-serif',
    path: 'M10,90 Q90,90 90,45 Q90,10 50,10 Q10,10 10,40 Q10,70 45,70 Q70,70 75,50',
});
```
