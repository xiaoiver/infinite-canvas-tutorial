---
title: 'Text on a path'
description: 'Place glyphs along curves for badges and annotations.'
---

<!-- example-intro:en -->

# Text on a path

Text on a path needs **arc length** sampling and rotation per glyph. Use it for circular badges and flow labels; performance scales with segment count.

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
    content: 'Text follows your curve',
    fontSize: 30,
    fill: '#F67676',
    fontFamily: 'sans-serif',
    path: 'M65 220C170 35 430 35 535 220',
    textAlign: 'center',
    side: 'left',
    startOffset: 0,
    pathOffset: 0,
    letterSpacing: 1,
});
```

Drag the text or blue handle along the path, and drag orange control points to reshape it. Choose a curve, circle or line and adjust side, alignment, size, spacing and baseline distance. Handles support arrow keys, Shift for larger steps and Esc or touch cancellation to restore the starting state.

`startOffset` moves along the reading direction; `pathOffset` moves along its local normal. Open paths omit overflowing glyphs. Closed paths can cross the seam with at most one lap per line. Bounds follow the glyphs, and SVG export preserves their positions and rotations. See [Text Along Path](/guide/lesson-016#text-along-path) for layout details and current limitations.
